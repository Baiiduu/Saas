import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivateDto } from './dto/activate.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenBlacklistService } from './token-blacklist.service';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
// Pre-computed dummy hash for timing side-channel protection
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-attack-prevention-dummy-42!', SALT_ROUNDS);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * In-memory store for password reset tokens.
   * Maps token -> { email, expiresAt }
   * ⚠ In production this should be moved to Redis.
   */
  private readonly resetTokens = new Map<string, { email: string; expiresAt: Date }>();

  /**
   * In-memory store for login attempt counting (Redis fallback).
   * Maps email -> { count, lockedUntil }
   * ⚠ In production this should be moved to Redis with TTL.
   */
  private readonly loginAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  // ── Registration ──────────────────────────────────────────

  async register(dto: RegisterDto) {
    // 1. Uniqueness check
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // 3. Generate 6-digit activation code
    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Create user (status = PENDING)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone ?? null,
        displayName: dto.displayName,
        passwordHash,
        status: 'PENDING',
        activationCode,
      },
    });

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.logger.log(`User registered: ${user.email} (code: ${activationCode})`);

    // In production the code would be sent via email; return it here
    // for testing / development convenience.
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      ...(isProduction ? {} : { activationCode }),
    };
  }

  // ── Activation ────────────────────────────────────────────

  async activate(dto: ActivateDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status !== 'PENDING') {
      throw new BadRequestException('Account is already activated');
    }

    if (user.activationCode !== dto.code) {
      throw new BadRequestException('Invalid activation code');
    }

    // Activate the account and clear the code
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        activationCode: null,
      },
    });

    this.logger.log(`User activated: ${user.email}`);
    return { message: 'Account activated successfully' };
  }

  // ── Login ─────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Timing side-channel protection: always run bcrypt.compare
      // against a dummy hash so that the response time is indistinguishable
      // from a real password check.
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check in-memory (Redis) lockout first — fast path
    if (this.isAccountLocked(dto.email)) {
      throw new UnauthorizedException(
        'Account is temporarily locked due to too many failed attempts. Please try again later.',
      );
    }

    // Check DB lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account is temporarily locked due to too many failed attempts. Please try again later.',
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      // Record in both DB and in-memory store
      await this.handleFailedLogin(user);
      this.recordFailedLogin(dto.email);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check activation
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Account is not activated. Please check your email for the activation code.',
      );
    }

    // Reset login attempts & record last login
    this.clearLoginAttempts(dto.email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return this.generateTokens(user);
  }

  // ── Logout ────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      if (payload.jti) {
        // TTL roughly matches the refresh token lifetime
        await this.tokenBlacklistService.add(payload.jti, 7 * 24 * 60 * 60 * 1000);
        this.logger.log(`Refresh token ${payload.jti} blacklisted for user ${payload.sub}`);
      }
    } catch {
      // Even if the token is already expired/invalid we still consider
      // the logout successful from the client's perspective.
      this.logger.warn('Logout attempted with an invalid or expired refresh token');
    }
  }

  // ── Token refresh ─────────────────────────────────────────

  async refresh(refreshToken: string) {
    let payload: any;

    // Verify the refresh token signature & expiration
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check blacklist
    if (payload.jti) {
      const blacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (blacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    }

    // Ensure the user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    // Blacklist the old refresh token (rotation)
    if (payload.jti) {
      await this.tokenBlacklistService.add(payload.jti, 7 * 24 * 60 * 60 * 1000);
    }

    // Issue a new access (and refresh) token pair
    return this.generateTokens(user);
  }

  // ── Internal helpers ──────────────────────────────────────

  // ── Forgot Password ─────────────────────────────────────────

  /**
   * Initiate a password reset flow.
   * Generates a reset token, stores it in-memory (Redis in production) with a 15-minute TTL,
   * and simulates sending a reset link via console.log.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true },
    });

    // Don't reveal whether the email exists (timing side-channel safe)
    if (!user) {
      // Normalize response time: always perform bcrypt work
      await bcrypt.compare('dummy', DUMMY_PASSWORD_HASH);
      this.logger.warn(`Password reset requested for unknown email: ${dto.email}`);
      return { message: 'If this email is registered, you will receive a password reset link.' };
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');

    // Store the reset token with a 15-minute TTL
    this.resetTokens.set(token, {
      email: user.email,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    // Auto-remove the token after TTL expires
    const expirationTimer = setTimeout(() => {
      this.resetTokens.delete(token);
      this.logger.debug(`Reset token ${token.substring(0, 8)}... expired and removed`);
    }, RESET_TOKEN_TTL_MS);
    expirationTimer.unref?.();

    // Simulate sending a reset link via email
    const resetLink = `https://app.example.com/auth/reset-password?token=${token}`;
    this.logger.log(`Password reset link for ${user.email}: ${resetLink}`);

    // In production this would dispatch an email task
    console.log(`\n📧 PASSWORD RESET EMAIL\n   To: ${user.email}\n   Link: ${resetLink}\n`);

    return {
      message: 'If this email is registered, you will receive a password reset link.',
      ...(this.configService.get<string>('NODE_ENV') === 'production' ? {} : { resetToken: token }),
    };
  }

  // ── Reset Password ──────────────────────────────────────────

  /**
   * Complete a password reset using a valid reset token.
   * Verifies the token, updates the password hash, and deletes the token.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const record = this.resetTokens.get(dto.token);

    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (record.expiresAt < new Date()) {
      this.resetTokens.delete(dto.token);
      throw new BadRequestException('Reset token has expired');
    }

    // Find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true, email: true },
    });

    if (!user) {
      // Token is valid but user was deleted — clean up and return generic error
      this.resetTokens.delete(dto.token);
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    // Update the password and reset login attempts / lockout
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Delete the used token
    this.resetTokens.delete(dto.token);

    this.logger.log(`Password reset completed for ${user.email}`);

    return { message: 'Password has been reset successfully.' };
  }

  // ── Login failure helpers (Redis / in-memory) ───────────────

  /**
   * Check if the account is temporarily locked in the in-memory store.
   * This provides an additional fast check before consulting the database.
   */
  private isAccountLocked(email: string): boolean {
    const record = this.loginAttempts.get(email);
    if (!record || !record.lockedUntil) return false;
    if (record.lockedUntil > new Date()) return true;
    // Lock expired — clean up
    this.loginAttempts.delete(email);
    return false;
  }

  /**
   * Record a failed login attempt in the in-memory store.
   * When the threshold is reached, lock the account for the configured duration.
   */
  private recordFailedLogin(email: string): void {
    const now = Date.now();
    let record = this.loginAttempts.get(email);

    if (!record) {
      record = { count: 0, lockedUntil: null };
    }

    record.count += 1;

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = new Date(now + LOCK_DURATION_MS);
      this.logger.warn(
        `[RATE-LIMIT] ${email} locked for ${LOCK_DURATION_MS / 1000 / 60} minutes (${record.count} failed attempts)`,
      );
    }

    this.loginAttempts.set(email, record);

    // Auto-reset after the lock duration
    const resetTimer = setTimeout(() => {
      this.loginAttempts.delete(email);
    }, LOCK_DURATION_MS);
    resetTimer.unref?.();
  }

  /**
   * Clear the in-memory login attempts record for a successful login.
   */
  private clearLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }

  private async handleFailedLogin(user: any): Promise<void> {
    const attempts = user.loginAttempts + 1;
    const update: any = { loginAttempts: attempts };

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      this.logger.warn(
        `User ${user.email} locked for ${LOCK_DURATION_MS / 1000 / 60} minutes (${attempts} failed attempts)`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: update,
    });
  }

  private async generateTokens(user: any) {
    const latestTenantMembership = await this.prisma.tenantMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: 'desc' },
      select: { role: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        expiresIn: this.configService.get<string>('jwt.expiration', '1d'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      {
        expiresIn: this.configService.get<string>('jwt.refreshExpiration', '7d'),
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
      },
      role: latestTenantMembership?.role ?? null,
    };
  }
}
