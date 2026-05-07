import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { TaskStatus, Priority } from '@prisma/client';

export class QueryTaskDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'Filter by task status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority, description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ example: 'user-id-xyz', description: 'Filter by assignee user ID' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', description: 'Due date range start (ISO 8601)' })
  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31T00:00:00.000Z', description: 'Due date range end (ISO 8601)' })
  @IsOptional()
  @IsString()
  dueDateTo?: string;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', description: 'Sort order (asc or desc)' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ example: 'team-id-xyz', description: 'Team ID to filter tasks' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ example: 'pipeline', description: 'Full-text search on task title and description' })
  @IsOptional()
  @IsString()
  search?: string;
}
