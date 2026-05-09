import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class ExecuteAiSkillDto {
  @ApiPropertyOptional({ type: 'object', description: 'Skill-specific arguments' })
  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Optional team context' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Optional session ID for persistence' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
