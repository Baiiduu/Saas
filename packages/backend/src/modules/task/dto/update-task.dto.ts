import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, Priority } from '@prisma/client';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Updated task title', description: 'Task title' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Task description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS, description: 'Task status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority, example: Priority.LOW, description: 'Task priority' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: ['user-id-1', 'user-id-2'], description: 'Assignee user IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ example: ['frontend', 'urgent'], description: 'Tag names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];
}
