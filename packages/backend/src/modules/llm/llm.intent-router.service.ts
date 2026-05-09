import { Injectable } from '@nestjs/common';

export type AiRouteClassification =
  | 'normal_chat'
  | 'read_data'
  | 'write_data'
  | 'generate_content';

export type AiRoutePlan =
  | {
      mode: 'chat';
      classification: 'normal_chat';
    }
  | {
      mode: 'clarify';
      classification: Exclude<AiRouteClassification, 'normal_chat'>;
      message: string;
    }
  | {
      mode: 'tool';
      classification: 'read_data' | 'write_data';
      toolId: string;
      args: Record<string, unknown>;
    }
  | {
      mode: 'skill';
      classification: 'generate_content' | 'write_data';
      skillId: string;
      args: Record<string, unknown>;
    };

@Injectable()
export class LlmIntentRouterService {
  plan(input: {
    content: string;
    teamId?: string;
  }): AiRoutePlan {
    const content = input.content.trim();
    const normalized = content.toLowerCase();

    if (!content) {
      return {
        mode: 'clarify',
        classification: 'read_data',
        message: '请输入你要查询或执行的内容。',
      };
    }

    if (this.isTaskListQuery(normalized)) {
      return {
        mode: 'tool',
        classification: 'read_data',
        toolId: 'task.list',
        args: {
          teamId: input.teamId,
          mine: true,
          limit: 20,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        },
      };
    }

    if (this.isDocumentSearchQuery(normalized)) {
      if (!input.teamId) {
        return {
          mode: 'clarify',
          classification: 'read_data',
          message: '文档检索需要团队上下文，请先进入目标团队后再查询。',
        };
      }

      const keyword = this.extractDocumentKeyword(content);
      if (!keyword) {
        return {
          mode: 'clarify',
          classification: 'read_data',
          message: '请补充要检索的文档关键词，例如“前端”“周报”“报销”。',
        };
      }

      return {
        mode: 'tool',
        classification: 'read_data',
        toolId: 'document.search',
        args: {
          teamId: input.teamId,
          query: keyword,
          limit: 10,
        },
      };
    }

    if (this.isTaskCreateQuery(normalized)) {
      if (!input.teamId) {
        return {
          mode: 'clarify',
          classification: 'write_data',
          message: '创建任务需要团队上下文，请先进入目标团队。',
        };
      }

      const title = this.extractTaskTitle(content);
      if (!title) {
        return {
          mode: 'clarify',
          classification: 'write_data',
          message: '请补充任务标题，例如“帮我创建一个前端适配任务”。',
        };
      }

      return {
        mode: 'tool',
        classification: 'write_data',
        toolId: 'task.create',
        args: {
          teamId: input.teamId,
          title,
        },
      };
    }

    if (this.isDocDraftRequest(normalized)) {
      if (!input.teamId) {
        return {
          mode: 'clarify',
          classification: 'generate_content',
          message: '生成文档草稿需要团队上下文，请先进入目标团队。',
        };
      }

      return {
        mode: 'skill',
        classification: 'generate_content',
        skillId: 'doc-draft',
        args: {
          teamId: input.teamId,
          name: this.extractDocumentDraftName(content),
          prompt: content,
        },
      };
    }

    if (this.isApprovalCreateRequest(normalized)) {
      return {
        mode: 'clarify',
        classification: 'write_data',
        message:
          '发起审批需要审批模板和表单字段。请使用右侧的 approval-assist 表单，或明确提供模板、标题和表单内容。',
      };
    }

    return {
      mode: 'chat',
      classification: 'normal_chat',
    };
  }

  private isTaskListQuery(content: string): boolean {
    return content.includes('任务') && (
      content.includes('委派给我') ||
      content.includes('分配给我') ||
      content.includes('我的任务') ||
      content.includes('我负责的任务') ||
      content.includes('assigned to me')
    );
  }

  private isDocumentSearchQuery(content: string): boolean {
    return content.includes('文档') && (
      content.includes('有哪些') ||
      content.includes('搜索') ||
      content.includes('查找') ||
      content.includes('相关') ||
      content.includes('查下')
    );
  }

  private isTaskCreateQuery(content: string): boolean {
    return content.includes('任务') && (
      content.includes('创建') ||
      content.includes('新建')
    );
  }

  private isDocDraftRequest(content: string): boolean {
    return content.includes('文档') && (
      content.includes('草稿') ||
      content.includes('起草') ||
      content.includes('初稿')
    );
  }

  private isApprovalCreateRequest(content: string): boolean {
    return content.includes('审批') && (
      content.includes('创建') ||
      content.includes('发起') ||
      content.includes('提交')
    );
  }

  private extractDocumentKeyword(content: string): string | null {
    const quoted = content.match(/[“"]([^”"]+)[”"]/);
    if (quoted?.[1]) {
      return quoted[1].trim();
    }

    const cleaned = content
      .replace(/文档中心/g, '')
      .replace(/有哪些/g, '')
      .replace(/相关的文档/g, '')
      .replace(/相关文档/g, '')
      .replace(/有关的文档/g, '')
      .replace(/有关文档/g, '')
      .replace(/文档/g, '')
      .replace(/搜索/g, '')
      .replace(/查找/g, '')
      .replace(/查下/g, '')
      .replace(/[？?。！!]/g, '')
      .trim();

    const normalized = cleaned.replace(/^(与|和|关于)/, '').trim();
    return normalized || null;
  }

  private extractTaskTitle(content: string): string | null {
    const match = content.match(/(?:创建|新建|帮我创建|帮我新建)(?:一个|一条)?(.+?)任务(?:$|，|。|,)/);
    const rawTitle = match?.[1]?.trim();
    if (!rawTitle) {
      return null;
    }

    return rawTitle.endsWith('任务') ? rawTitle : `${rawTitle}任务`;
  }

  private extractDocumentDraftName(content: string): string {
    const quoted = content.match(/[“"]([^”"]+)[”"]/);
    if (quoted?.[1]) {
      return quoted[1].trim();
    }

    return 'AI 文档草稿';
  }
}
