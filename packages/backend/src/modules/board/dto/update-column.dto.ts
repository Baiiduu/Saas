import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class ColumnConfigItem {
  @ApiPropertyOptional({ example: 'col-uuid', description: 'Column ID (omit for new columns)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'In Progress', description: 'Column display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS, description: 'Mapped task status' })
  @IsEnum(TaskStatus)
  statusMapping!: TaskStatus;

  @ApiPropertyOptional({ example: '#FF6B6B', description: 'Column color hex code' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 0, description: 'Column sort order' })
  @IsInt()
  sortOrder!: number;
}

export class UpdateColumnDto {
  @ApiProperty({ type: [ColumnConfigItem], description: 'Array of column configurations' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnConfigItem)
  columns!: ColumnConfigItem[];

  @ApiPropertyOptional({ type: [String], description: 'Column IDs to delete' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deletedIds?: string[];
}
