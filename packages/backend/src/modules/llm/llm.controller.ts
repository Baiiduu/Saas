import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';
import { ExecuteAiSkillDto } from './dto/execute-ai-skill.dto';
import { ListAiSessionsDto } from './dto/list-ai-sessions.dto';
import { SendAiMessageDto } from './dto/send-ai-message.dto';
import { LlmService } from './llm.service';
import { LlmAuthorizationService } from './llm.authorization.service';
import { LlmSessionService } from './llm.session.service';
import { LlmSkillService } from './llm.skill.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';

@ApiTags('LLM')
@ApiBearerAuth('access-token')
@Controller('llm')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly authorizationService: LlmAuthorizationService,
    private readonly sessionService: LlmSessionService,
    private readonly skillService: LlmSkillService,
    private readonly contextBuilder: MCPContextBuilder,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backward-compatible raw LLM chat endpoint' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
        model: { type: 'string' },
        temperature: { type: 'number' },
        maxTokens: { type: 'number' },
        stream: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'LLM response returned' })
  async chat(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      teamId?: string;
    },
  ) {
    await this.authorizationService.assertPermission(
      'llm.create',
      user.sub,
      tenantId || 'unknown',
      dto.teamId,
    );

    const context = await this.contextBuilder.buildContext({
      userId: user.sub,
      tenantId: tenantId || 'unknown',
      teamId: dto.teamId,
    });

    return this.llmService.chat(
      {
        messages: dto.messages.map((message) => ({
          role: message.role as 'system' | 'user' | 'assistant',
          content: message.content,
        })),
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        stream: dto.stream,
      },
      context,
    );
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List current user AI sessions in the tenant' })
  async listSessions(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Query() query: ListAiSessionsDto,
  ) {
    return this.sessionService.listSessions(user.sub, tenantId || 'unknown', query);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new AI session' })
  async createSession(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAiSessionDto,
  ) {
    return this.sessionService.createSession(user.sub, tenantId || 'unknown', dto);
  }

  @Get('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get AI session detail with message history and pending confirmations' })
  @ApiParam({ name: 'sessionId', description: 'AI session ID' })
  async getSessionDetail(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionService.getSessionDetail(sessionId, user.sub, tenantId || 'unknown');
  }

  @Post('sessions/:sessionId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message inside an AI session' })
  @ApiParam({ name: 'sessionId', description: 'AI session ID' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.sessionService.sendMessage(user.sub, tenantId || 'unknown', sessionId, dto);
  }

  @Get('mcp/tools')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List AI tools available in the current context' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Optional team context for filtering' })
  async listTools(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Query('teamId') teamId?: string,
  ) {
    await this.authorizationService.assertPermission('llm.read', user.sub, tenantId || 'unknown', teamId);
    return this.llmService.listToolsForContext(user.sub, tenantId || 'unknown', teamId);
  }

  @Get('skills')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List AI skills available in the current context' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Optional team context for filtering' })
  async listSkills(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Query('teamId') teamId?: string,
  ) {
    await this.authorizationService.assertPermission('llm.read', user.sub, tenantId || 'unknown', teamId);
    return this.skillService.listSkillsForContext(user.sub, tenantId || 'unknown', teamId);
  }

  @Post('skills/:skillId/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a registered AI skill' })
  @ApiParam({ name: 'skillId', description: 'Skill ID' })
  async executeSkill(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('skillId') skillId: string,
    @Body() body: ExecuteAiSkillDto,
  ) {
    await this.authorizationService.assertPermission(
      'llm.read',
      user.sub,
      tenantId || 'unknown',
      body.teamId,
    );

    const result = await this.skillService.execute({
      skillId,
      args: body.args ?? {},
      userId: user.sub,
      tenantId: tenantId || 'unknown',
      teamId: body.teamId,
      sessionId: body.sessionId,
    });

    if (body.sessionId) {
      await this.sessionService.appendAssistantMessage(
        body.sessionId,
        this.buildSkillMessage(skillId, result),
        {
          skillId,
          skillRunId: result.skillRunId ?? null,
          status: result.status ?? (result.success ? 'completed' : 'failed'),
          steps: result.steps,
          requiresConfirmation: result.requiresConfirmation ?? false,
          confirmationToken: result.confirmationToken ?? null,
        },
      );
    }

    return result;
  }

  @Post('tool-calls/:toolCallId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm and execute a pending high-risk AI tool call' })
  @ApiParam({ name: 'toolCallId', description: 'Pending AI tool call ID' })
  async confirmToolCall(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('toolCallId') toolCallId: string,
  ) {
    await this.authorizationService.assertPermission('llm.create', user.sub, tenantId || 'unknown');
    return this.llmService.confirmToolCall(toolCallId, user.sub, tenantId || 'unknown');
  }

  private buildSkillMessage(
    skillId: string,
    result: Awaited<ReturnType<LlmSkillService['execute']>>,
  ): string {
    if (result.status === 'pending_confirmation') {
      return `技能 ${skillId} 已生成待确认操作，请确认后继续。`;
    }

    if (!result.success) {
      return `技能 ${skillId} 执行失败：${result.error ?? '未知错误'}`;
    }

    if (typeof result.data === 'object' && result.data && 'summary' in (result.data as Record<string, unknown>)) {
      return String((result.data as Record<string, unknown>).summary);
    }

    if (typeof result.data === 'object' && result.data && 'report' in (result.data as Record<string, unknown>)) {
      return String((result.data as Record<string, unknown>).report);
    }

    return JSON.stringify(result.data ?? {}, null, 2) ?? '技能执行完成。';
  }
}
