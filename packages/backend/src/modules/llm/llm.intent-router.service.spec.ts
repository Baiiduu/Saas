import { LlmIntentRouterService } from './llm.intent-router.service';

describe('LlmIntentRouterService', () => {
  let service: LlmIntentRouterService;

  beforeEach(() => {
    service = new LlmIntentRouterService();
  });

  it('routes my task queries to task.list with mine semantics', () => {
    const plan = service.plan({
      content: '有哪些委派给我的任务？',
      teamId: 'team-1',
    });

    expect(plan).toEqual({
      mode: 'tool',
      classification: 'read_data',
      toolId: 'task.list',
      args: expect.objectContaining({
        teamId: 'team-1',
        mine: true,
      }),
    });
  });

  it('routes document search queries to document.search', () => {
    const plan = service.plan({
      content: '文档中心有哪些与前端相关的文档？',
      teamId: 'team-1',
    });

    expect(plan).toEqual({
      mode: 'tool',
      classification: 'read_data',
      toolId: 'document.search',
      args: expect.objectContaining({
        teamId: 'team-1',
        query: '前端',
      }),
    });
  });

  it('routes task creation requests to task.create', () => {
    const plan = service.plan({
      content: '帮我创建一个前端适配任务。',
      teamId: 'team-1',
    });

    expect(plan).toEqual({
      mode: 'tool',
      classification: 'write_data',
      toolId: 'task.create',
      args: expect.objectContaining({
        teamId: 'team-1',
        title: '前端适配任务',
      }),
    });
  });

  it('routes draft document requests to doc-draft skill', () => {
    const plan = service.plan({
      content: '帮我起草一份“前端适配方案”文档草稿。',
      teamId: 'team-1',
    });

    expect(plan).toEqual({
      mode: 'skill',
      classification: 'generate_content',
      skillId: 'doc-draft',
      args: expect.objectContaining({
        teamId: 'team-1',
        name: '前端适配方案',
      }),
    });
  });
});
