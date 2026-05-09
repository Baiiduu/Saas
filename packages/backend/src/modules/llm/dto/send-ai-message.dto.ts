import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendAiMessageDto {
  @ApiProperty({ example: '帮我总结一下本周任务进展', description: 'User message content' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Optional team context override' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ example: 'task', description: 'Current business resource type' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contextResourceType?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Current business resource ID' })
  @IsOptional()
  @IsUUID()
  contextResourceId?: string;

  @ApiPropertyOptional({ example: 'gpt-4.1', description: 'Optional model override' })
  @IsOptional()
  @IsString()
  model?: string;
}
