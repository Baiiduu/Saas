import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SharePermission {
  VIEW = 'view',
  EDIT = 'edit',
  COMMENT = 'comment',
}

export class ShareDocumentDto {
  @ApiProperty({
    enum: SharePermission,
    example: 'view',
    description: 'Permission level for the shared link',
  })
  @IsEnum(SharePermission)
  permission!: SharePermission;

  @ApiPropertyOptional({
    example: 'secret123',
    description: 'Optional access code required to view the document',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  accessCode?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59Z',
    description: 'Optional expiration date/time for the share link',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
