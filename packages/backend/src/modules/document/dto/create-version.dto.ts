import { ApiProperty } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({ description: 'Version notes / change description' })
  notes?: string;

  constructor(data?: Partial<CreateVersionDto>) {
    if (data) Object.assign(this, data);
  }
}
