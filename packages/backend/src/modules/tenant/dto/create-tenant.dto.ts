import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Enterprise/tenant name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Technology', description: 'Industry sector' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: '50-200', description: 'Company scale' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scale?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png', description: 'Tenant logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;
}
