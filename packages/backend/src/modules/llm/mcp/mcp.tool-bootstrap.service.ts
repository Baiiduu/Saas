import { Injectable, OnModuleInit } from '@nestjs/common';
import { MCPToolRegistry } from './mcp.tool-registry';
import { TaskService } from '../../task/task.service';
import { DocumentService } from '../../document/document.service';
import { DocumentSearchService } from '../../document/document-search.service';
import { ApprovalService } from '../../approval/approval.service';
import { TeamService } from '../../team/team.service';
import { MilestoneService } from '../../milestone/milestone.service';

@Injectable()
export class MCPToolBootstrapService implements OnModuleInit {
  constructor(
    private readonly toolRegistry: MCPToolRegistry,
    private readonly taskService: TaskService,
    private readonly documentService: DocumentService,
    private readonly documentSearchService: DocumentSearchService,
    private readonly approvalService: ApprovalService,
    private readonly teamService: TeamService,
    private readonly milestoneService: MilestoneService,
  ) {}

  onModuleInit(): void {
    this.registerTaskTools();
    this.registerDocumentTools();
    this.registerApprovalTools();
    this.registerTeamTools();
    this.registerMilestoneTools();
  }

  private registerTaskTools(): void {
    this.toolRegistry.registerTool(
      {
        id: 'task.list',
        name: '任务列表',
        description: '查询当前权限范围内的任务列表',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: false },
          { name: 'mine', type: 'boolean', description: '是否仅查询当前用户负责的任务', required: false },
          { name: 'status', type: 'string', description: '任务状态', required: false },
          { name: 'assigneeId', type: 'string', description: '负责人 ID', required: false },
          { name: 'search', type: 'string', description: '搜索关键词', required: false },
          { name: 'page', type: 'number', description: '页码', required: false },
          { name: 'limit', type: 'number', description: '每页数量', required: false },
        ],
        requiredPermission: 'task.read',
        resourceType: 'task',
        actionType: 'read',
        riskLevel: 'low',
        category: 'task',
      },
      async (request) => ({
        success: true,
        data: await this.taskService.findAll(request.userId, request.tenantId, {
          page: request.args.page as number | undefined,
          limit: request.args.limit as number | undefined,
          teamId: (request.args.teamId as string | undefined) ?? request.teamId,
          status: request.args.status as any,
          priority: request.args.priority as any,
          assigneeId:
            (request.args.mine as boolean | undefined)
              ? request.userId
              : (request.args.assigneeId as string | undefined),
          search: request.args.search as string | undefined,
          sortBy: request.args.sortBy as string | undefined,
          sortOrder: request.args.sortOrder as 'asc' | 'desc' | undefined,
          dueDateFrom: request.args.dueDateFrom as string | undefined,
          dueDateTo: request.args.dueDateTo as string | undefined,
        }),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'task.get',
        name: '任务详情',
        description: '查询单个任务详情',
        parameters: [
          { name: 'taskId', type: 'string', description: '任务 ID', required: true },
        ],
        requiredPermission: 'task.read',
        resourceType: 'task',
        actionType: 'read',
        riskLevel: 'low',
        category: 'task',
      },
      async (request) => ({
        success: true,
        data: await this.taskService.findById(
          request.userId,
          request.tenantId,
          request.args.taskId as string,
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'task.create',
        name: '创建任务',
        description: '创建一个新任务',
        parameters: [
          { name: 'title', type: 'string', description: '任务标题', required: true },
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'description', type: 'string', description: '任务描述', required: false },
          { name: 'priority', type: 'string', description: '优先级', required: false, enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
          { name: 'dueDate', type: 'string', description: '截止时间', required: false },
          { name: 'assigneeIds', type: 'array', description: '负责人 ID 列表', required: false },
          { name: 'tagNames', type: 'array', description: '标签列表', required: false },
        ],
        requiredPermission: 'task.create',
        resourceType: 'task',
        actionType: 'write',
        riskLevel: 'low',
        category: 'task',
      },
      async (request) => ({
        success: true,
        data: await this.taskService.create(request.userId, request.tenantId, {
          title: request.args.title as string,
          teamId: ((request.args.teamId as string | undefined) ?? request.teamId)!,
          description: request.args.description as string | undefined,
          priority: request.args.priority as any,
          dueDate: request.args.dueDate as string | undefined,
          assigneeIds: request.args.assigneeIds as string[] | undefined,
          tagNames: request.args.tagNames as string[] | undefined,
          parentTaskId: request.args.parentTaskId as string | undefined,
        }),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'task.update',
        name: '更新任务',
        description: '更新任务标题、状态、优先级或负责人',
        parameters: [
          { name: 'taskId', type: 'string', description: '任务 ID', required: true },
          { name: 'title', type: 'string', description: '任务标题', required: false },
          { name: 'description', type: 'string', description: '任务描述', required: false },
          { name: 'status', type: 'string', description: '任务状态', required: false, enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CLOSED'] },
          { name: 'priority', type: 'string', description: '优先级', required: false, enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
          { name: 'dueDate', type: 'string', description: '截止时间', required: false },
          { name: 'assigneeIds', type: 'array', description: '负责人 ID 列表', required: false },
          { name: 'tagNames', type: 'array', description: '标签列表', required: false },
        ],
        requiredPermission: 'task.update',
        resourceType: 'task',
        actionType: 'write',
        riskLevel: 'medium',
        category: 'task',
      },
      async (request) => ({
        success: true,
        data: await this.taskService.update(
          request.userId,
          request.tenantId,
          request.args.taskId as string,
          {
          title: request.args.title as string | undefined,
          description: request.args.description as string | undefined,
          status: request.args.status as any,
          priority: request.args.priority as any,
          dueDate: request.args.dueDate as string | undefined,
          assigneeIds: request.args.assigneeIds as string[] | undefined,
          tagNames: request.args.tagNames as string[] | undefined,
          },
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'task.assign',
        name: '指派任务',
        description: '调整任务负责人',
        parameters: [
          { name: 'taskId', type: 'string', description: '任务 ID', required: true },
          { name: 'userIds', type: 'array', description: '负责人 ID 列表', required: true },
        ],
        requiredPermission: 'task.assign',
        resourceType: 'task',
        actionType: 'write',
        riskLevel: 'high',
        confirmationRequired: true,
        category: 'task',
      },
      async (request) => ({
        success: true,
        data: await this.taskService.assign(
          request.userId,
          request.tenantId,
          request.args.taskId as string,
          (request.args.userIds as string[]) ?? [],
        ),
        executionTimeMs: 0,
      }),
    );
  }

  private registerDocumentTools(): void {
    this.toolRegistry.registerTool(
      {
        id: 'document.list',
        name: '文档列表',
        description: '查询当前团队下的文档树',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'parentId', type: 'string', description: '父级目录 ID', required: false },
        ],
        requiredPermission: 'document.read',
        resourceType: 'document',
        actionType: 'read',
        riskLevel: 'low',
        category: 'document',
      },
      async (request) => ({
        success: true,
        data: await this.documentService.getTree(
          request.userId,
          request.tenantId,
          ((request.args.teamId as string | undefined) ?? request.teamId)!,
          (request.args.parentId as string | undefined) ?? undefined,
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'document.search',
        name: '文档检索',
        description: '按关键词、时间范围、创建者检索团队内正式文档',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'query', type: 'string', description: '检索关键词', required: true },
          { name: 'creatorId', type: 'string', description: '创建者用户 ID', required: false },
          { name: 'createdFrom', type: 'string', description: '创建时间起点', required: false },
          { name: 'createdTo', type: 'string', description: '创建时间终点', required: false },
          { name: 'updatedFrom', type: 'string', description: '更新时间起点', required: false },
          { name: 'updatedTo', type: 'string', description: '更新时间终点', required: false },
          { name: 'limit', type: 'number', description: '最大结果数', required: false },
        ],
        requiredPermission: 'document.read',
        resourceType: 'document',
        actionType: 'read',
        riskLevel: 'low',
        category: 'document',
      },
      async (request) => ({
        success: true,
        data: await this.documentSearchService.search(
          request.userId,
          request.tenantId,
          ((request.args.teamId as string | undefined) ?? request.teamId)!,
          request.args.query as string,
          {
            creatorId: request.args.creatorId as string | undefined,
            createdFrom: request.args.createdFrom as string | undefined,
            createdTo: request.args.createdTo as string | undefined,
            updatedFrom: request.args.updatedFrom as string | undefined,
            updatedTo: request.args.updatedTo as string | undefined,
            limit: request.args.limit as number | undefined,
          },
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'document.get',
        name: '文档详情',
        description: '查询单个文档详情和内容',
        parameters: [
          { name: 'docId', type: 'string', description: '文档 ID', required: true },
        ],
        requiredPermission: 'document.read',
        resourceType: 'document',
        actionType: 'read',
        riskLevel: 'low',
        category: 'document',
      },
      async (request) => ({
        success: true,
        data: await this.documentService.findById(
          request.userId,
          request.tenantId,
          request.args.docId as string,
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'document.create',
        name: '创建文档草稿',
        description: '创建一个可继续编辑的文本草稿文档',
        parameters: [
          { name: 'name', type: 'string', description: '文档名称', required: true },
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'parentId', type: 'string', description: '父级目录 ID', required: false },
          { name: 'content', type: 'string', description: '初始草稿内容', required: false },
        ],
        requiredPermission: 'document.create',
        resourceType: 'document',
        actionType: 'write',
        riskLevel: 'low',
        category: 'document',
      },
      async (request) => ({
        success: true,
        data: await this.documentService.createDraft(request.userId, request.tenantId, {
          name: request.args.name as string,
          teamId: ((request.args.teamId as string | undefined) ?? request.teamId)!,
          parentId: (request.args.parentId as string | undefined) ?? null,
          content: request.args.content as string | undefined,
        }),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'document.update_content',
        name: '更新文档内容',
        description: '更新指定文档的正文内容',
        parameters: [
          { name: 'docId', type: 'string', description: '文档 ID', required: true },
          { name: 'content', type: 'string', description: '新的文档内容', required: true },
        ],
        requiredPermission: 'document.update',
        resourceType: 'document',
        actionType: 'write',
        riskLevel: 'medium',
        category: 'document',
      },
      async (request) => ({
        success: true,
        data: await this.documentService.saveContent(
          request.args.docId as string,
          request.userId,
          request.tenantId,
          request.args.content as string,
        ),
        executionTimeMs: 0,
      }),
    );
  }

  private registerApprovalTools(): void {
    this.toolRegistry.registerTool(
      {
        id: 'approval.list',
        name: '审批列表',
        description: '查询当前权限范围内的审批单',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: false },
          { name: 'status', type: 'string', description: '审批状态', required: false },
          { name: 'page', type: 'number', description: '页码', required: false },
          { name: 'limit', type: 'number', description: '每页数量', required: false },
        ],
        requiredPermission: 'approval.read',
        resourceType: 'approval',
        actionType: 'read',
        riskLevel: 'low',
        category: 'approval',
      },
      async (request) => ({
        success: true,
        data: await this.approvalService.findAll(request.userId, request.tenantId, {
          page: request.args.page as number | undefined,
          limit: request.args.limit as number | undefined,
          teamId: (request.args.teamId as string | undefined) ?? request.teamId,
          status: request.args.status as any,
          creatorId: request.args.creatorId as string | undefined,
          sortBy: request.args.sortBy as string | undefined,
          sortOrder: request.args.sortOrder as 'asc' | 'desc' | undefined,
        }),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'approval.get',
        name: '审批详情',
        description: '查询单个审批单详情',
        parameters: [
          { name: 'approvalId', type: 'string', description: '审批 ID', required: true },
        ],
        requiredPermission: 'approval.read',
        resourceType: 'approval',
        actionType: 'read',
        riskLevel: 'low',
        category: 'approval',
      },
      async (request) => ({
        success: true,
        data: await this.approvalService.findById(
          request.userId,
          request.tenantId,
          request.args.approvalId as string,
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'approval.create',
        name: '发起审批',
        description: '根据模板创建审批单',
        parameters: [
          { name: 'title', type: 'string', description: '审批标题', required: true },
          { name: 'templateId', type: 'string', description: '审批模板 ID', required: true },
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'formData', type: 'object', description: '审批表单数据', required: true },
        ],
        requiredPermission: 'approval.create',
        resourceType: 'approval',
        actionType: 'write',
        riskLevel: 'high',
        confirmationRequired: true,
        category: 'approval',
      },
      async (request) => ({
        success: true,
        data: await this.approvalService.create(request.userId, request.tenantId, {
          title: request.args.title as string,
          templateId: request.args.templateId as string,
          teamId: ((request.args.teamId as string | undefined) ?? request.teamId)!,
          formData: (request.args.formData as Record<string, any>) ?? {},
        }),
        executionTimeMs: 0,
      }),
    );
  }

  private registerTeamTools(): void {
    this.toolRegistry.registerTool(
      {
        id: 'member.resolve',
        name: '成员解析',
        description: '根据姓名或邮箱片段解析团队内成员',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'query', type: 'string', description: '成员姓名或邮箱关键词', required: true },
          { name: 'limit', type: 'number', description: '最大候选数', required: false },
        ],
        requiredPermission: 'member.read',
        resourceType: 'member',
        actionType: 'read',
        riskLevel: 'low',
        category: 'team',
      },
      async (request) => ({
        success: true,
        data: await this.teamService.resolveMembers(
          ((request.args.teamId as string | undefined) ?? request.teamId)!,
          request.userId,
          request.tenantId,
          request.args.query as string,
          (request.args.limit as number | undefined) ?? 5,
        ),
        executionTimeMs: 0,
      }),
    );

    this.toolRegistry.registerTool(
      {
        id: 'team.member.list',
        name: '团队成员列表',
        description: '查询团队成员列表',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
        ],
        requiredPermission: 'member.read',
        resourceType: 'member',
        actionType: 'read',
        riskLevel: 'low',
        category: 'team',
      },
      async (request) => ({
        success: true,
        data: await this.teamService.getMembers(
          ((request.args.teamId as string | undefined) ?? request.teamId)!,
          request.userId,
          request.tenantId,
        ),
        executionTimeMs: 0,
      }),
    );
  }

  private registerMilestoneTools(): void {
    this.toolRegistry.registerTool(
      {
        id: 'milestone.list',
        name: '里程碑列表',
        description: '查询团队里程碑列表',
        parameters: [
          { name: 'teamId', type: 'string', description: '团队 ID', required: true },
          { name: 'page', type: 'number', description: '页码', required: false },
          { name: 'limit', type: 'number', description: '每页数量', required: false },
        ],
        requiredPermission: 'milestone.read',
        resourceType: 'milestone',
        actionType: 'read',
        riskLevel: 'low',
        category: 'milestone',
      },
      async (request) => ({
        success: true,
        data: await this.milestoneService.findAll(
          ((request.args.teamId as string | undefined) ?? request.teamId)!,
          (request.args.page as number | undefined) ?? 1,
          (request.args.limit as number | undefined) ?? 20,
        ),
        executionTimeMs: 0,
      }),
    );
  }
}
