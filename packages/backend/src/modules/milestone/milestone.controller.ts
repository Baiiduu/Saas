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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@ApiTags('Milestone')
@ApiBearerAuth('access-token')
@Controller('milestones')
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new milestone with optional task links' })
  @ApiBody({ type: CreateMilestoneDto })
  @ApiResponse({ status: 201, description: 'Milestone created successfully' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestoneService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List milestones for a team with pagination' })
  @ApiQuery({ name: 'teamId', required: true, description: 'Team ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'List of milestones returned' })
  async findAll(
    @Query('teamId') teamId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.milestoneService.findAll(
      teamId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('kanban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get milestones grouped by status (kanban view)' })
  @ApiQuery({ name: 'teamId', required: true, description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Milestones grouped by status' })
  async getKanban(@Query('teamId') teamId: string) {
    return this.milestoneService.getKanban(teamId);
  }

  @Get(':milestoneId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get milestone detail with tasks' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({ status: 200, description: 'Milestone detail returned' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async findById(@Param('milestoneId') milestoneId: string) {
    return this.milestoneService.findById(milestoneId);
  }

  @Patch(':milestoneId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update milestone fields and task associations' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        dueDate: { type: 'string', format: 'date-time' },
        status: { type: 'string' },
        progress: { type: 'number' },
        taskIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Milestone updated' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async update(
    @Param('milestoneId') milestoneId: string,
    @Body() data: {
      name?: string;
      description?: string;
      dueDate?: string;
      status?: string;
      progress?: number;
      taskIds?: string[];
    },
  ) {
    return this.milestoneService.update(milestoneId, data);
  }

  @Delete(':milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a milestone' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({ status: 204, description: 'Milestone deleted' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async delete(@Param('milestoneId') milestoneId: string) {
    await this.milestoneService.delete(milestoneId);
  }
}
