import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ActivateDto } from './dto/activate.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GithubOAuthStrategy } from './strategies/github.strategy';
import { GoogleOAuthStrategy } from './strategies/google.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly githubOAuthStrategy: GithubOAuthStrategy,
    private readonly googleOAuthStrategy: GoogleOAuthStrategy,
  ) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('activate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a pending user account with the 6-digit code' })
  @ApiResponse({ status: 200, description: 'Account activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid activation code or already activated' })
  async activate(@Body() dto: ActivateDto) {
    return this.authService.activate(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'Login successful, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account not activated' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and revoke the current refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a new access token using a refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset link sent if email is registered' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiResponse({ status: 200, description: 'Password has been reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ── OAuth ────────────────────────────────────────────────────

  @Post('oauth/github')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with GitHub OAuth (simulated)' })
  @ApiQuery({ name: 'code', required: true, description: 'OAuth authorization code (use "dev_github" for simulated auth)' })
  @ApiResponse({ status: 200, description: 'OAuth login successful' })
  async githubOAuth(@Query('code') code: string) {
    return this.githubOAuthStrategy.authenticate(code);
  }

  @Post('oauth/google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with Google OAuth (simulated)' })
  @ApiQuery({ name: 'idToken', required: true, description: 'Google id_token (use "dev_google" for simulated auth)' })
  @ApiResponse({ status: 200, description: 'OAuth login successful' })
  async googleOAuth(@Query('idToken') idToken: string) {
    return this.googleOAuthStrategy.authenticate(idToken);
  }
}
