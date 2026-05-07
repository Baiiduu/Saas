import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123def456', description: 'Password reset token received via email' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123!', description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
