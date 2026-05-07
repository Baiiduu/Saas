import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TeamVisibility } from '@prisma/client';

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: 'Engineering Team', description: 'Updated team name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Software engineering team', description: 'Updated team description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: TeamVisibility })
  @IsOptional()
  @IsEnum(TeamVisibility)
  visibility?: TeamVisibility;
}
