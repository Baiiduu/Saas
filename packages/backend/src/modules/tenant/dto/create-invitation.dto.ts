import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email of the invited user' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Team ID the invitation grants access to' })
  @IsString()
  teamId!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.MEMBER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
