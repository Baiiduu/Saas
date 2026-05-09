import { Injectable } from '@nestjs/common';

interface ResponseSource {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
}

interface ComposedResponse {
  content: string;
  sources: ResponseSource[];
}

@Injectable()
export class LlmResponseComposerService {
  composeToolResponse(toolId: string, data: unknown): ComposedResponse {
    if (toolId === 'task.list') {
      return this.composeTaskList(data);
    }

    if (toolId === 'document.search') {
      return this.composeDocumentSearch(data);
    }

    if (toolId === 'task.create') {
      return this.composeTaskWrite(data, '创建');
    }

    if (toolId === 'task.update') {
      return this.composeTaskWrite(data, '更新');
    }

    if (toolId === 'member.resolve') {
      return this.composeResolvedMembers(data);
    }

    if (toolId === 'document.get') {
      return this.composeDocumentDetail(data);
    }

    return {
      content: JSON.stringify(data ?? {}, null, 2),
      sources: [],
    };
  }

  composeSkillResponse(skillId: string, data: unknown): ComposedResponse {
    if (skillId === 'doc-draft') {
      return this.composeDocDraft(data);
    }

    return {
      content: JSON.stringify(data ?? {}, null, 2),
      sources: [],
    };
  }

  private composeTaskList(data: unknown): ComposedResponse {
    const items = Array.isArray((data as { items?: unknown[] } | undefined)?.items)
      ? ((data as { items: Array<Record<string, unknown>> }).items)
      : [];
    const pagination = (data as { pagination?: { total?: number } } | undefined)?.pagination;

    if (items.length === 0) {
      return {
        content: '已通过 `task.list` 查询，当前没有找到符合条件的任务。',
        sources: [],
      };
    }

    const lines = items.slice(0, 8).map((task, index) => {
      const assignees = Array.isArray(task.assignees)
        ? task.assignees
            .map((assignee) => {
              const user = (assignee as { user?: Record<string, unknown> }).user;
              return typeof user?.displayName === 'string' ? user.displayName : null;
            })
            .filter((name): name is string => !!name)
        : [];
      const parts = [
        `${index + 1}. ${String(task.title ?? '未命名任务')}`,
        `ID: ${String(task.id ?? '-')}`,
        typeof task.status === 'string' ? `状态: ${task.status}` : null,
        typeof task.priority === 'string' ? `优先级: ${task.priority}` : null,
        assignees.length ? `负责人: ${assignees.join('、')}` : null,
      ].filter(Boolean);
      return parts.join(' | ');
    });

    return {
      content: [
        `已通过 \`task.list\` 查询到 ${pagination?.total ?? items.length} 条任务。`,
        ...lines,
      ].join('\n'),
      sources: items.slice(0, 8).map((task) => ({
        type: 'task',
        id: String(task.id ?? ''),
        title: String(task.title ?? '未命名任务'),
        subtitle: typeof task.status === 'string' ? `状态 ${task.status}` : undefined,
      })),
    };
  }

  private composeTaskWrite(data: unknown, action: string): ComposedResponse {
    const task = data as Record<string, unknown> | null;
    if (!task?.id) {
      return {
        content: `任务${action}已执行，但返回结果缺少任务标识。`,
        sources: [],
      };
    }

    return {
      content: `已通过正式写入链路${action}任务：${String(task.title ?? '未命名任务')}（ID: ${String(task.id)}）。`,
      sources: [
        {
          type: 'task',
          id: String(task.id),
          title: String(task.title ?? '未命名任务'),
          subtitle: typeof task.status === 'string' ? `状态 ${task.status}` : undefined,
        },
      ],
    };
  }

  private composeDocumentSearch(data: unknown): ComposedResponse {
    const items = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];

    if (items.length === 0) {
      return {
        content: '已通过 `document.search` 检索，但没有找到匹配文档。',
        sources: [],
      };
    }

    const lines = items.slice(0, 8).map((item, index) => [
      `${index + 1}. ${String(item.name ?? '未命名文档')}`,
      `ID: ${String(item.id ?? '-')}`,
      item.creatorDisplayName ? `创建者: ${String(item.creatorDisplayName)}` : null,
      item.updatedAt ? `更新于: ${new Date(String(item.updatedAt)).toLocaleString('zh-CN')}` : null,
    ].filter(Boolean).join(' | '));

    return {
      content: [
        `已通过 \`document.search\` 检索到 ${items.length} 条匹配文档。`,
        ...lines,
      ].join('\n'),
      sources: items.slice(0, 8).map((item) => ({
        type: 'document',
        id: String(item.id ?? ''),
        title: String(item.name ?? '未命名文档'),
        subtitle: item.creatorDisplayName
          ? `创建者 ${String(item.creatorDisplayName)}`
          : undefined,
      })),
    };
  }

  private composeResolvedMembers(data: unknown): ComposedResponse {
    const items = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    if (items.length === 0) {
      return {
        content: '未找到匹配的团队成员。',
        sources: [],
      };
    }

    return {
      content: [
        `已解析到 ${items.length} 个候选成员：`,
        ...items.map((item, index) => {
          const user = item.user as Record<string, unknown> | undefined;
          return `${index + 1}. ${String(user?.displayName ?? '未知成员')} | ${String(user?.email ?? '-')}`;
        }),
      ].join('\n'),
      sources: items.map((item) => {
        const user = item.user as Record<string, unknown> | undefined;
        return {
          type: 'member',
          id: String(user?.id ?? ''),
          title: String(user?.displayName ?? '未知成员'),
          subtitle: typeof user?.email === 'string' ? user.email : undefined,
        };
      }),
    };
  }

  private composeDocumentDetail(data: unknown): ComposedResponse {
    const document = data as Record<string, unknown> | null;
    if (!document?.id) {
      return {
        content: '未获取到有效文档详情。',
        sources: [],
      };
    }

    const creator = document.creator as Record<string, unknown> | undefined;
    return {
      content: [
        `已获取文档详情：${String(document.name ?? '未命名文档')}`,
        `ID: ${String(document.id)}`,
        creator?.displayName ? `创建者: ${String(creator.displayName)}` : null,
        document.updatedAt ? `更新时间: ${new Date(String(document.updatedAt)).toLocaleString('zh-CN')}` : null,
      ].filter(Boolean).join('\n'),
      sources: [
        {
          type: 'document',
          id: String(document.id),
          title: String(document.name ?? '未命名文档'),
          subtitle: creator?.displayName ? `创建者 ${String(creator.displayName)}` : undefined,
        },
      ],
    };
  }

  private composeDocDraft(data: unknown): ComposedResponse {
    const payload = data as Record<string, unknown> | null;
    const document = payload?.document as Record<string, unknown> | undefined;
    if (!document?.id) {
      return {
        content: '文档草稿已执行，但返回结果缺少文档标识。',
        sources: [],
      };
    }

    return {
      content: `已生成文档草稿：${String(document.name ?? 'AI 文档草稿')}（ID: ${String(document.id)}）。`,
      sources: [
        {
          type: 'document',
          id: String(document.id),
          title: String(document.name ?? 'AI 文档草稿'),
        },
      ],
    };
  }
}
