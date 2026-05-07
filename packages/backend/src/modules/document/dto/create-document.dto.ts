import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @ApiProperty({
    example: 'Project Proposal',
    description: 'Document or folder name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    enum: DocumentType,
    example: 'FILE',
    description: 'Document type (FILE or FOLDER)',
  })
  @IsEnum(DocumentType)
  type!: DocumentType;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Parent folder ID for hierarchical nesting',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Team ID the document belongs to',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;
}
