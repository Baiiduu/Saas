import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { Type } from 'class-transformer';

class MessageMention {
  @ApiProperty({ description: 'Mention type: "task" or "doc"' })
  @IsString()
  type!: 'task' | 'doc';

  @ApiProperty({ description: 'Referenced resource ID' })
  @IsString()
  resourceId!: string;

  @ApiPropertyOptional({ description: 'Display label for the reference' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Message type', enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Task quick-create: create a task from this message' })
  @IsOptional()
  @IsString()
  quickCreateTaskTitle?: string;

  @ApiPropertyOptional({ description: 'Document reference mentions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageMention)
  references?: MessageMention[];
}
