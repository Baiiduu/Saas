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
import { TaskService } from './task.service';
import { TaskTemplateService } from './task-template.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { BatchTaskDto } from './dto/batch-task.dto';
import { CreateTaskRelationDto } from './dto/task-relation.dto';
import { TaskStatus } from '@prisma/client';

@ApiTags('Task')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskTemplateService: TaskTemplateService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks with pagination, filter, and sort' })
  @ApiResponse({ status: 200, description: 'List of tasks returned' })
  async findAll(@Query() query: QueryTaskDto) {
    return this.taskService.findAll(query);
  }

  @Get(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task detail by ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task returned' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findById(@Param('taskId') taskId: string) {
    return this.taskService.findById(taskId);
  }

  @Patch(':taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task fields' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async update(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(taskId, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async delete(@Param('taskId') taskId: string) {
    await this.taskService.delete(taskId);
  }

  // ── Assignment ─────────────────────────────────────────────

  @Post(':taskId/assignees')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign/reassign task to user(s)' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['user-id-1', 'user-id-2'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task assignees updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async assign(
    @Param('taskId') taskId: string,
    @Body('userIds') userIds: string[],
  ) {
    return this.taskService.assign(taskId, userIds ?? []);
  }

  // ── Position (Drag-drop) ───────────────────────────────────

  @Patch(':taskId/position')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task status and sort order (drag-drop)' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CLOSED'] },
        sortOrder: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task position updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updatePosition(
    @Param('taskId') taskId: string,
    @Body('status') status: TaskStatus,
    @Body('sortOrder') sortOrder: number,
  ) {
    return this.taskService.updatePosition(taskId, status, sortOrder);
  }

  // ── Subtask Tree ──────────────────────────────────────────

  @Get(':taskId/subtasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get recursive subtask tree' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Subtask tree returned' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getSubTaskTree(@Param('taskId') taskId: string) {
    return this.taskService.getSubTaskTree(taskId);
  }

  // ── Batch Operations ──────────────────────────────────────

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch update or delete tasks' })
  @ApiBody({ type: BatchTaskDto })
  @ApiResponse({ status: 200, description: 'Batch operation completed' })
  @ApiResponse({ status: 404, description: 'One or more tasks not found' })
  async batch(@Body() dto: BatchTaskDto) {
    return this.taskService.batch(dto);
  }

  // ── Relations ─────────────────────────────────────────────

  @Get(':taskId/relations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all relations for a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task relations returned' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getRelations(@Param('taskId') taskId: string) {
    return this.taskService.getRelations(taskId);
  }

  @Post(':taskId/relations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a relation (link) to a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({ type: CreateTaskRelationDto })
  @ApiResponse({ status: 201, description: 'Relation created' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async addRelation(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskRelationDto,
  ) {
    return this.taskService.addRelation(taskId, dto);
  }

  // ── Task Templates ────────────────────────────────────────

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task template' })
  @ApiBody({ type: CreateTaskTemplateDto })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskTemplateDto,
  ): Promise<any> {
    return this.taskTemplateService.create(user.sub, dto);
  }

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List task templates for a team' })
  @ApiQuery({ name: 'teamId', required: true, description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'List of templates returned' })
  async listTemplates(@Query('teamId') teamId: string): Promise<any[]> {
    return this.taskTemplateService.findByTeam(teamId);
  }

  @Get('templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get task template detail' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template detail returned' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(@Param('templateId') templateId: string): Promise<any> {
    return this.taskTemplateService.findById(templateId);
  }

  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task template' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Param('templateId') templateId: string) {
    await this.taskTemplateService.delete(templateId);
  }
}
