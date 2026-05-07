import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuotaDto {
  @ApiProperty({ description: 'Maximum number of team members', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;

  @ApiProperty({ description: 'Maximum storage in MB', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageMb?: number;

  @ApiProperty({ description: 'Maximum number of teams', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTeams?: number;

  constructor(data?: Partial<UpdateQuotaDto>) {
    if (data) Object.assign(this, data);
  }
}

export class TenantQuota {
  maxMembers!: number;
  maxStorageMb!: number;
  maxTeams!: number;
  usedMembers!: number;
  usedStorageMb!: number;
  usedTeams!: number;

  constructor(data: Partial<TenantQuota>) {
    Object.assign(this, data);
  }
}
