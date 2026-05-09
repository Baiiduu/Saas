import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GraphNodeTypeDto {
  TASK = 'task',
  DOCUMENT = 'document',
  MEMBER = 'member',
  MILESTONE = 'milestone',
  GIT_REPO = 'git_repo',
}

export enum GraphRelationTypeDto {
  DEPENDS_ON = 'depends_on',
  PRODUCES = 'produces',
  OWNED_BY = 'owned_by',
  BELONGS_TO = 'belongs_to',
  REFERENCES = 'references',
  BACKED_BY_REPO = 'backed_by_repo',
}

export class GraphPositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class GraphSizeDto {
  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

export class CreateGraphNodeDto {
  @IsEnum(GraphNodeTypeDto)
  nodeType!: GraphNodeTypeDto;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GraphPositionDto)
  position?: GraphPositionDto;

  @IsOptional()
  @IsUUID()
  parentNodeId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateGraphNodeDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GraphPositionDto)
  position?: GraphPositionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GraphSizeDto)
  size?: GraphSizeDto;

  @IsOptional()
  @IsUUID()
  parentNodeId?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateGraphEdgeDto {
  @IsUUID()
  sourceNodeId!: string;

  @IsUUID()
  targetNodeId!: string;

  @IsEnum(GraphRelationTypeDto)
  relationType!: GraphRelationTypeDto;
}

export class UpdateGraphEdgeDto {
  @IsOptional()
  @IsEnum(GraphRelationTypeDto)
  relationType?: GraphRelationTypeDto;
}

export class SaveGraphCanvasNodeDto extends CreateGraphNodeDto {
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class SaveGraphCanvasEdgeDto extends CreateGraphEdgeDto {
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class SaveGraphCanvasDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveGraphCanvasNodeDto)
  nodes?: SaveGraphCanvasNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveGraphCanvasEdgeDto)
  edges?: SaveGraphCanvasEdgeDto[];

  @IsOptional()
  @IsObject()
  viewport?: Record<string, unknown>;
}
