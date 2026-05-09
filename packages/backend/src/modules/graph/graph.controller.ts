import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GraphService } from './graph.service';
import {
  CreateGraphEdgeDto,
  CreateGraphNodeDto,
  SaveGraphCanvasDto,
  UpdateGraphEdgeDto,
  UpdateGraphNodeDto,
} from './dto/graph-canvas.dto';

@ApiTags('Graph')
@ApiBearerAuth('access-token')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('teams/:teamId/canvas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create the default team-level resource canvas' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team canvas returned' })
  async getTeamCanvas(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.graphService.getTeamCanvas(user.sub, tenantId, teamId);
  }

  @Put('teams/:teamId/canvas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save team canvas node collection, edges, and viewport' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Canvas saved and returned' })
  async saveTeamCanvas(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('teamId') teamId: string,
    @Body() dto: SaveGraphCanvasDto,
  ) {
    return this.graphService.saveCanvas(user.sub, tenantId, teamId, dto);
  }

  @Get('teams/:teamId/resources')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get permission-scoped resources available for the team canvas' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Resource pool returned' })
  async getResourcePool(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.graphService.getResourcePool(user.sub, tenantId, teamId);
  }

  @Post('teams/:teamId/nodes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a resource or Git repository node to the team canvas' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 201, description: 'Node created' })
  async createNode(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('teamId') teamId: string,
    @Body() dto: CreateGraphNodeDto,
  ) {
    return this.graphService.createNode(user.sub, tenantId, teamId, dto);
  }

  @Patch('nodes/:nodeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update graph node position, metadata, or milestone parent' })
  @ApiParam({ name: 'nodeId', description: 'Graph node ID' })
  @ApiResponse({ status: 200, description: 'Node updated' })
  async updateNode(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateGraphNodeDto,
  ) {
    return this.graphService.updateNode(user.sub, tenantId, nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a graph node, detach children, and remove connected edges' })
  @ApiParam({ name: 'nodeId', description: 'Graph node ID' })
  @ApiResponse({ status: 204, description: 'Node deleted' })
  async deleteNode(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('nodeId') nodeId: string,
  ) {
    await this.graphService.deleteNode(user.sub, tenantId, nodeId);
  }

  @Post('teams/:teamId/edges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a typed relation edge between two canvas nodes' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 201, description: 'Edge created' })
  async createEdge(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('teamId') teamId: string,
    @Body() dto: CreateGraphEdgeDto,
  ) {
    return this.graphService.createEdge(user.sub, tenantId, teamId, dto);
  }

  @Patch('edges/:edgeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a graph relation edge type' })
  @ApiParam({ name: 'edgeId', description: 'Graph edge ID' })
  @ApiResponse({ status: 200, description: 'Edge updated' })
  async updateEdge(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('edgeId') edgeId: string,
    @Body() dto: UpdateGraphEdgeDto,
  ) {
    return this.graphService.updateEdge(user.sub, tenantId, edgeId, dto);
  }

  @Delete('edges/:edgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a graph relation edge' })
  @ApiParam({ name: 'edgeId', description: 'Graph edge ID' })
  @ApiResponse({ status: 204, description: 'Edge deleted' })
  async deleteEdge(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('edgeId') edgeId: string,
  ) {
    await this.graphService.deleteEdge(user.sub, tenantId, edgeId);
  }

  @Get(':resourceType/:resourceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get legacy collaboration resource graph (React Flow compatible node/edge format)',
  })
  @ApiParam({ name: 'resourceType', description: 'Resource type (task, document)' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiQuery({
    name: 'typeFilter',
    required: false,
    description: 'Filter by edge relation type',
  })
  @ApiResponse({ status: 200, description: 'Graph data returned' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async getGraph(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('typeFilter') typeFilter?: string,
  ) {
    return this.graphService.getGraph(resourceType, resourceId, typeFilter, user.sub, tenantId);
  }

  @Get(':resourceType/:resourceId/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export legacy graph as JSON file download' })
  @ApiParam({ name: 'resourceType', description: 'Resource type (task, document)' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiQuery({
    name: 'typeFilter',
    required: false,
    description: 'Filter by edge relation type',
  })
  @ApiResponse({ status: 200, description: 'JSON file download' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async exportGraph(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('typeFilter') typeFilter?: string,
  ) {
    const graph = await this.graphService.getGraph(
      resourceType,
      resourceId,
      typeFilter,
      user.sub,
      tenantId,
    );
    const filename = `graph-${resourceType}-${resourceId.substring(0, 8)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(graph);
  }
}
