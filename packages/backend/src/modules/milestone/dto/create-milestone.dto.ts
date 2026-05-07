import {
  IsString,
  IsUUID,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsDateString,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMilestoneDto {
  @ApiProperty({
    example: 'Sprint 1',
    description: 'Milestone name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    example: 'Complete core features for MVP',
    description: 'Milestone description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Milestone due date',
  })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({
    example: 'pending',
    description: 'Milestone status (pending, in_progress, completed, overdue)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Progress percentage (0-100)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Team ID the milestone belongs to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;

  @ApiPropertyOptional({
    example: ['task-uuid-1', 'task-uuid-2'],
    description: 'Task IDs to associate with this milestone',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskIds?: string[];
}
