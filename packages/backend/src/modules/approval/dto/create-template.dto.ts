import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateNodeDto {
  @ApiProperty({ example: '直属经理审批', description: 'Node display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'single', description: 'Approver type (single / multiple / role-based)' })
  @IsString()
  @IsNotEmpty()
  approverType!: string;

  @ApiProperty({ example: 1, description: 'Sort order within the template (starts at 1)' })
  @IsNotEmpty()
  sortOrder!: number;

  @ApiPropertyOptional({
    example: {},
    description: 'Additional node configuration (e.g. assigned approvers)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CreateTemplateDto {
  @ApiProperty({ example: '请假申请', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: '员工请假审批流程', description: 'Template description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'attendance', description: 'Template scope / category' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scope!: string;

  @ApiProperty({
    example: { fields: [{ name: 'reason', type: 'text', label: '请假原因' }] },
    description: 'Form field definitions as a JSON object',
  })
  @IsObject()
  @IsNotEmpty()
  formFields!: Record<string, any>;

  @ApiProperty({ example: 'team-id-xyz', description: 'Team ID the template belongs to' })
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @ApiProperty({
    type: [CreateTemplateNodeDto],
    description: 'Approval nodes defining the workflow chain',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateNodeDto)
  nodes!: CreateTemplateNodeDto[];
}
