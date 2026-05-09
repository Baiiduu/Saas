import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAiSessionDto {
  @ApiPropertyOptional({ example: '本周项目协作', description: 'Optional session title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Optional team context' })
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
}
