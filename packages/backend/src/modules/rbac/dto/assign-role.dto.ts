import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@saas/shared-types';

export class AssignRoleDto {
  @ApiProperty({ enum: Role, description: 'Role to assign' })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({
    required: false,
    description: 'Team UUID — if set, the role applies at the team level; otherwise it applies at the tenant level',
  })
  @IsOptional()
  @IsUUID('4')
  teamId?: string;
}
