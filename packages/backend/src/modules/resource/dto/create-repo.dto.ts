import {
  IsString,
  IsUUID,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsObject,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRepoDto {
  @ApiProperty({
    example: 'frontend-app',
    description: 'Repository name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: 'GIT_REPO',
    description: 'Resource type (GIT_REPO or S3_BUCKET)',
  })
  @IsString()
  @IsNotEmpty()
  type!: 'GIT_REPO' | 'S3_BUCKET';

  @ApiProperty({
    example: { url: 'https://github.com/org/repo.git', branch: 'main' },
    description: 'Repository configuration (URL, credentials, etc.)',
  })
  @IsObject()
  config!: Record<string, any>;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Team ID the repo belongs to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;
}
