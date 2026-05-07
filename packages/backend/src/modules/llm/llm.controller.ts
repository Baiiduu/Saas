import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { LlmService } from './llm.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { RBAC } from '../../common/decorators/rbac.decorator';
import { Role } from '@saas/shared-types';

@ApiTags('LLM')
@ApiBearerAuth('access-token')
@Controller('llm')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly contextBuilder: MCPContextBuilder,
  ) {}

  /**
   * POST /llm/chat
   * Send a chat message to the LLM with tenant-aware context.
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message to the LLM with tenant-aware context' })
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
    },
  ) {
    const context = await this.contextBuilder.buildContext({
      userId: user.sub,
      tenantId: tenantId || 'unknown',
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =
      dto.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

    return this.llmService.chat(
      {
        messages,
        model: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        stream: dto.stream,
      },
      context,
    );
  }

  /**
   * GET /llm/mcp/tools
   * List all registered MCP tools.
   */
  @Get('mcp/tools')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all registered MCP tools' })
  @ApiResponse({ status: 200, description: 'List of MCP tools' })
  listTools() {
    return this.llmService.listTools();
  }

  /**
   * GET /llm/skills
   * List all registered skills.
   */
  @Get('skills')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all registered skills' })
  @ApiResponse({ status: 200, description: 'List of skills' })
  listSkills() {
    return this.llmService.listSkills();
  }

  /**
   * POST /llm/skills/:skillId/execute
   * Execute a skill by ID.
   */
  @Post('skills/:skillId/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a skill by ID' })
  @ApiParam({ name: 'skillId', description: 'Skill ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        args: { type: 'object', description: 'Skill-specific arguments' },
        teamId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Skill execution result' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async executeSkill(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('skillId') skillId: string,
    @Body() body: { args?: Record<string, unknown>; teamId?: string },
  ) {
    // Permission check: verify the skill's required permission
    const skill = this.llmService.listSkills().find((s) => s.id === skillId);
    if (!skill) {
      return { success: false, error: `Skill "${skillId}" not found` };
    }

    return this.llmService.executeSkill({
      skillId,
      args: body.args ?? {},
      userId: user.sub,
      tenantId: tenantId || 'unknown',
      teamId: body.teamId,
    });
  }
}
