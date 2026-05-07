import { IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalTimeoutConfigDto {
  @ApiPropertyOptional({ description: 'Timeout in hours before sending a reminder' })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutHours?: number;

  constructor(data?: Partial<ApprovalTimeoutConfigDto>) {
    if (data) Object.assign(this, data);
  }
}
