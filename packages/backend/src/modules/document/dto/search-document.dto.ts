import { IsString, IsNotEmpty, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchDocumentDto {
  @ApiProperty({
    example: 'proposal',
    description: 'Full-text search query',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  q!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Team ID to scope the search',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teamId!: string;
}
