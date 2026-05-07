import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Set up CI/CD pipeline', description: 'Task title' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Configure GitHub Actions for the monorepo', description: 'Task description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: Priority, example: Priority.HIGH, description: 'Task priority' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ example: '2026-05-15T00:00:00.000Z', description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'task-parent-id', description: 'Parent task ID for subtask' })
  @IsOptional()
  @IsString()
  parentTaskId?: string;

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

  @ApiProperty({ example: 'team-id-xyz', description: 'Team ID the task belongs to' })
  @IsString()
  teamId!: string;
}
