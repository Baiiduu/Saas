import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsNotEmpty, IsUUID, MinLength, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchDocumentDto {
  @ApiProperty({
    example: 'proposal',
    description: 'Full-text search query',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  q!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Team ID to scope the search',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Optional creator user ID filter',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  creatorId?: string;

  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
    description: 'Optional created time range start',
  })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
    description: 'Optional created time range end',
  })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
    description: 'Optional updated time range start',
  })
  @IsOptional()
  @IsString()
  updatedFrom?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
    description: 'Optional updated time range end',
  })
  @IsOptional()
  @IsString()
  updatedTo?: string;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of results',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
