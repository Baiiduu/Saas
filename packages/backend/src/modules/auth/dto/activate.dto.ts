import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateDto {
  @ApiProperty({ example: 'user@example.com', description: 'Registered email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: '6-digit activation code sent via email' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
