import {
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskRelationDto {
  @ApiPropertyOptional({
    description: 'Related task ID',
    example: 'related-task-id',
  })
  @IsOptional()
  @IsString()
  relatedTaskId?: string;

  @ApiPropertyOptional({
    description: 'Related document ID',
    example: 'related-doc-id',
  })
  @IsOptional()
  @IsString()
  relatedDocId?: string;

  @ApiPropertyOptional({
    description: 'Related resource item ID',
    example: 'related-resource-id',
  })
  @IsOptional()
  @IsString()
  relatedResourceId?: string;

  @ApiProperty({
    description: 'Type of relation (e.g. "blocks", "relates_to", "duplicates")',
    example: 'blocks',
  })
  @IsString()
  relationType!: string;
}
