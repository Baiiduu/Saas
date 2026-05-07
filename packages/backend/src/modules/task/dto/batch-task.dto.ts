import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, Priority } from '@prisma/client';

export enum BatchAction {
  UPDATE_STATUS = 'updateStatus',
  UPDATE_PRIORITY = 'updatePriority',
  UPDATE_ASSIGNEE = 'updateAssignee',
  DELETE = 'delete',
}

export class BatchTaskDto {
  @ApiProperty({
    description: 'Array of task IDs to operate on',
    example: ['task-id-1', 'task-id-2'],
  })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({
    enum: BatchAction,
    description: 'Batch operation action',
    example: BatchAction.UPDATE_STATUS,
  })
  @IsEnum(BatchAction)
  action!: BatchAction;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'New status (for updateStatus action)' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority, description: 'New priority (for updatePriority action)' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Assignee user IDs (for updateAssignee action)',
    example: ['user-id-1', 'user-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}
