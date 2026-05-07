import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, description: 'New role to assign to the member' })
  @IsEnum(Role)
  role!: Role;
}
