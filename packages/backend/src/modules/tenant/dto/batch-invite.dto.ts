import { IsArray, IsEmail, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchInviteDto {
  @ApiProperty({
    example: ['user1@example.com', 'user2@example.com'],
    description: 'Array of email addresses to invite',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  emails!: string[];
}
