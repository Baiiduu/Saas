import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { GraphService } from './graph.service';

@ApiTags('Graph')
@ApiBearerAuth('access-token')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get(':resourceType/:resourceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get collaboration resource graph (React Flow compatible node/edge format)',
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
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('typeFilter') typeFilter?: string,
  ) {
    return this.graphService.getGraph(resourceType, resourceId, typeFilter);
  }

  @Get(':resourceType/:resourceId/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export graph as JSON file download',
  })
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
    @Res() res: Response,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('typeFilter') typeFilter?: string,
  ) {
    const graph = await this.graphService.getGraph(resourceType, resourceId, typeFilter);
    const filename = `graph-${resourceType}-${resourceId.substring(0, 8)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(graph);
  }
}
