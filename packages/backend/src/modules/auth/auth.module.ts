import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GithubOAuthStrategy } from './strategies/github.strategy';
import { GoogleOAuthStrategy } from './strategies/google.strategy';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenBlacklistService,
    JwtStrategy,
    GithubOAuthStrategy,
    GoogleOAuthStrategy,
  ],
  exports: [AuthService, TokenBlacklistService],
})
export class AuthModule {}
