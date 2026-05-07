import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({ enum: Role, description: 'Role to assign to the new member' })
  @IsEnum(Role)
  role!: Role;
}
