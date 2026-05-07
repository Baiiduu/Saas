import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRequestDto {
  @ApiPropertyOptional({ example: 'I would like to join this team to collaborate on projects.', description: 'Optional message from the requester' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class ApproveJoinRequestDto {
  @ApiPropertyOptional({ example: 'approved', description: 'Action: approve or reject' })
  @IsString()
  action!: string;
}
