import { Injectable, Logger } from '@nestjs/common';
import { MCPToolRegistry } from '../mcp/mcp.tool-registry';
import { SkillDefinition, SkillExecutionRequest, SkillExecutionResult } from '../mcp/mcp.protocol';
import { BaseSkill, SkillRegistry } from './skill.registry';

@Injectable()
export class DocDraftSkill extends BaseSkill {
  private readonly logger = new Logger(DocDraftSkill.name);

  readonly definition: SkillDefinition = {
    id: 'doc-draft',
    name: 'Document Draft',
    description: 'Create a draft document and fill it with an AI-assisted outline.',
    requiredPermission: 'llm.create',
    toolChain: ['document.create', 'document.update_content'],
  };

  async execute(
    request: SkillExecutionRequest,
    toolRegistry: MCPToolRegistry,
  ): Promise<SkillExecutionResult> {
    const steps: SkillExecutionResult['steps'] = [];
    const teamId = (request.args.teamId as string | undefined) ?? request.teamId;
    const name = (request.args.name as string | undefined) ?? 'AI 文档草稿';
    const prompt = (request.args.prompt as string | undefined) ?? '请根据当前上下文生成一份结构化草稿';
    const content = (request.args.content as string | undefined) ?? [
      `# ${name}`,
      '',
      '## 背景',
      prompt,
      '',
      '## 关键点',
      '- 待补充',
      '- 待补充',
      '',
      '## 后续行动',
      '- 待确认',
    ].join('\n');

    if (!teamId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Missing required argument: teamId',
        status: 'failed',
        steps: [],
      };
    }

    const createResult = await toolRegistry.execute({
      toolId: 'document.create',
      args: {
        name,
        teamId,
        parentId: request.args.parentId as string | undefined,
      },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });

    steps.push({
      toolId: 'document.create',
      success: createResult.success,
      status: createResult.status,
      result: createResult.data,
      error: createResult.error,
      toolCallId: createResult.toolCallId,
      requiresConfirmation: createResult.requiresConfirmation,
      confirmationToken: createResult.confirmationToken,
    });

    if (createResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: createResult.confirmationToken,
        steps,
      };
    }

    if (!createResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error: createResult.error ?? 'Failed to create document draft',
        status: 'failed',
        steps,
      };
    }

    const createdDocument = createResult.data as Record<string, unknown>;
    const docId = createdDocument.id as string | undefined;
    if (!docId) {
      return {
        skillId: request.skillId,
        success: false,
        error: 'Document draft was created without an ID',
        status: 'failed',
        steps,
      };
    }

    const updateResult = await toolRegistry.execute({
      toolId: 'document.update_content',
      args: {
        docId,
        content,
      },
      userId: request.userId,
      tenantId: request.tenantId,
      teamId,
      sessionId: request.sessionId,
      skillRunId: request.skillRunId,
    });

    steps.push({
      toolId: 'document.update_content',
      success: updateResult.success,
      status: updateResult.status,
      result: updateResult.data,
      error: updateResult.error,
      toolCallId: updateResult.toolCallId,
      requiresConfirmation: updateResult.requiresConfirmation,
      confirmationToken: updateResult.confirmationToken,
    });

    if (updateResult.status === 'pending_confirmation') {
      return {
        skillId: request.skillId,
        success: false,
        status: 'pending_confirmation',
        requiresConfirmation: true,
        confirmationToken: updateResult.confirmationToken,
        steps,
      };
    }

    if (!updateResult.success) {
      return {
        skillId: request.skillId,
        success: false,
        error: updateResult.error ?? 'Failed to update document content',
        status: 'failed',
        steps,
      };
    }

    this.logger.log(`Document draft created for team ${teamId}`);

    return {
      skillId: request.skillId,
      success: true,
      status: 'completed',
      data: {
        document: updateResult.data,
        content,
      },
      steps,
    };
  }
}

export function registerDocDraftSkill(
  registry: SkillRegistry,
  skill: DocDraftSkill,
): void {
  registry.registerSkill(skill);
}
