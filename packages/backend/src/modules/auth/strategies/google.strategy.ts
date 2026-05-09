import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Simulated Google OAuth strategy.
 *
 * In production this would extend PassportStrategy(Strategy, 'google')
 * and use the passport-google-oauth20 package. Since the infrastructure
 * may not be available for dev/test, we provide a simulated implementation.
 */
@Injectable()
export class GoogleOAuthStrategy {
  private readonly logger = new Logger(GoogleOAuthStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Simulate Google OAuth login.
   *
   * Accepts an `idToken` or `accessToken` param. For development, a
   * special token "dev_google" creates a mock Google-linked user.
   */
  async authenticate(idToken: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const clientId = this.configService.get<string>('oauth.google.clientId');
    const clientSecret = this.configService.get<string>('oauth.google.clientSecret');

    if (!clientId || !clientSecret) {
      this.logger.warn('Google OAuth not configured. Using simulated auth.');
      return this.simulateAuth(idToken);
    }

    // In production, verify the idToken, then fetch user profile.
    throw new Error('Google OAuth requires infrastructure setup. Use simulated auth for development.');
  }

  private async simulateAuth(idToken: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const email = `google-user-${idToken}@example.com`;
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          displayName: `Google User (${idToken.substring(0, 8)})`,
          passwordHash: 'oauth-simulated-no-password',
          status: 'ACTIVE',
        },
      });
      this.logger.log(`Simulated Google OAuth user created: ${email}`);
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.configService.get<string>('jwt.expiration', '1d') },
    );
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti: randomUUID() },
      { expiresIn: this.configService.get<string>('jwt.refreshExpiration', '7d') },
    );

    this.logger.log(`Simulated Google OAuth login: ${email}`);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }
}
