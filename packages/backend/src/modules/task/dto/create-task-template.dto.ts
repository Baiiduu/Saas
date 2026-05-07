import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';

export class CreateTaskTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Default title for tasks created from this template' })
  @IsString()
  defaultTitle!: string;

  @ApiPropertyOptional({ description: 'Default description' })
  @IsOptional()
  @IsString()
  defaultDescription?: string;

  @ApiPropertyOptional({ description: 'Default priority', enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  defaultPriority?: Priority;

  @ApiPropertyOptional({ description: 'Default tag names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultTags?: string[];

  @ApiProperty({ description: 'Team ID' })
  @IsString()
  teamId!: string;
}
