import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({
    example: 'Updated comment content',
    description: 'Updated comment content (rich text)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
