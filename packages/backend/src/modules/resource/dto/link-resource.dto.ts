import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkResourceDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Resource item ID to link from',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  resourceItemId!: string;

  @ApiProperty({
    example: 'task',
    description: 'Target resource type (task, document)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['task', 'document'])
  targetType!: 'task' | 'document';

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Target resource ID',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetId!: string;
}
