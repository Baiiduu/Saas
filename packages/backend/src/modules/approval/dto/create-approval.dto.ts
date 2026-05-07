import { IsString, IsObject, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApprovalDto {
  @ApiPropertyOptional({ example: '请假申请', description: 'Approval title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'template-id-xyz', description: 'Approval template ID' })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({
    example: { reason: '病假', startDate: '2026-05-01', endDate: '2026-05-03', days: 3 },
    description: 'Form data matching the template formFields',
  })
  @IsObject()
  @IsNotEmpty()
  formData!: Record<string, any>;

  @ApiProperty({ example: 'team-id-xyz', description: 'Team ID the approval belongs to' })
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
