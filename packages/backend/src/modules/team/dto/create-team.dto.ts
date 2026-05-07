import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamVisibility } from '@prisma/client';

export class CreateTeamDto {
  @ApiProperty({ example: 'Engineering', description: 'Team name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Software engineering team', description: 'Team description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: TeamVisibility, default: TeamVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(TeamVisibility)
  visibility?: TeamVisibility;
}
