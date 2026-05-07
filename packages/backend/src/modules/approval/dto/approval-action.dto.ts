import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApprovalActionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN',
  REDIRECT = 'REDIRECT',
}

export class ApprovalActionDto {
  @ApiProperty({
    enum: ApprovalActionType,
    description: 'Action to perform on the approval',
    example: ApprovalActionType.APPROVE,
  })
  @IsEnum(ApprovalActionType)
  action!: ApprovalActionType;

  @ApiPropertyOptional({
    description: 'Comment / reason for the action',
    example: 'Looks good, approved.',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description:
      'Target node ID — required for RETURN (previous node) and REDIRECT (any node)',
    example: 'node-id-xyz',
  })
  @IsOptional()
  @IsUUID()
  targetNodeId?: string;
}
