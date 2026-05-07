import { IsString, IsUUID, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    example: 'Great work on this task!',
    description: 'Comment content (rich text)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiProperty({
    example: 'task',
    description: 'Resource type (e.g. task, doc)',
  })
  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Resource ID the comment belongs to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  resourceId!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Parent comment ID for replies',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;
}
