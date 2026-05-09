import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { MCPContextBuilder } from './mcp/mcp.context-builder';
import { MCPToolRegistry } from './mcp/mcp.tool-registry';
import { SkillRegistry } from './skills/skill.registry';
import { MCPToolDefinition } from './mcp/mcp.protocol';

describe('LlmService', () => {
  const createService = () =>
    new LlmService(
      {
        get: jest.fn().mockReturnValue({}),
      } as unknown as ConfigService,
      {} as MCPContextBuilder,
      {} as MCPToolRegistry,
      {} as SkillRegistry,
    );

  it('does not inject saved memories into the system prompt', () => {
    const service = createService();

    const systemMessage = (service as any).buildSystemMessage({
      tenantId: 'tenant-1',
      tenantName: 'Tenant One',
      userId: 'user-1',
      userDisplayName: 'Alice',
      userEmail: 'alice@example.com',
      teamId: 'team-1',
      teamName: 'Team One',
      role: 'owner',
      metadata: {
        memories: [
          { content: '用户喜欢简洁回复' },
          { content: '上次查过前端文档' },
        ],
      },
    });

    expect(systemMessage).toContain('Current context:');
    expect(systemMessage).not.toContain('Relevant saved memory:');
    expect(systemMessage).not.toContain('用户喜欢简洁回复');
    expect(systemMessage).not.toContain('上次查过前端文档');
  });

  it('sanitizes tool names for provider function calling and resolves them back', () => {
    const service = createService();
    const tools: MCPToolDefinition[] = [
      {
        id: 'task.list',
        name: '任务列表',
        description: '查询任务',
        parameters: [],
        requiredPermission: 'task.read',
        resourceType: 'task',
        actionType: 'read',
        riskLevel: 'low',
      },
    ];

    const llmTools = service.buildLlmToolDefinitions(tools);

    expect(llmTools[0]?.function.name).toBe('tool__task_list');
    expect(service.resolveToolName('tool__task_list', tools)).toBe('task.list');
    expect(service.resolveToolName('task.list', tools)).toBe('task.list');
  });

  it('serializes tool call messages using provider snake_case fields', () => {
    const service = createService();

    const payload = (service as any).serializeMessageForProvider({
      role: 'tool',
      content: '{"ok":true}',
      toolCallId: 'call_123',
    });

    expect(payload).toEqual({
      role: 'tool',
      content: '{"ok":true}',
      tool_call_id: 'call_123',
    });
  });
});
