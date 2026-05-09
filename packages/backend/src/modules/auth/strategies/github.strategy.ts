import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Simulated GitHub OAuth strategy.
 *
 * In production this would extend PassportStrategy(Strategy, 'github')
 * and use the passport-github package. Since the infrastructure may not
 * be available for dev/test, we provide a simulated implementation that
 * accepts a mock code and creates/finds a user.
 */
@Injectable()
export class GithubOAuthStrategy {
  private readonly logger = new Logger(GithubOAuthStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Simulate GitHub OAuth login.
   * In production this would be called by Passport after GitHub redirects.
   *
   * Accepts a `code` param. For development, a special code "dev_github"
   * creates a mock GitHub-linked user.
   */
  async authenticate(code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const clientId = this.configService.get<string>('oauth.github.clientId');
    const clientSecret = this.configService.get<string>('oauth.github.clientSecret');

    if (!clientId || !clientSecret) {
      this.logger.warn('GitHub OAuth not configured. Using simulated auth.');
      return this.simulateAuth(code);
    }

    // In production, exchange code for access token, then fetch user profile.
    // This is a placeholder for the actual OAuth flow.
    throw new Error('GitHub OAuth requires infrastructure setup. Use simulated auth for development.');
  }

  private async simulateAuth(code: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    // Development mock: use a deterministic email based on the code
    const email = `github-user-${code}@example.com`;
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          displayName: `GitHub User (${code.substring(0, 8)})`,
          passwordHash: 'oauth-simulated-no-password',
          status: 'ACTIVE',
        },
      });
      this.logger.log(`Simulated GitHub OAuth user created: ${email}`);
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

    this.logger.log(`Simulated GitHub OAuth login: ${email}`);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }
}
