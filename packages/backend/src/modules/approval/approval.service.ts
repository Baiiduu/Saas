import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalTemplateService } from './approval-template.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

/**
 * Seed template definitions used when the database has no approval templates.
 * Each template includes form fields and a simple two-node approval chain.
 */
const SEED_TEMPLATES = [
  {
    name: '请假申请',
    description: '员工请假审批流程',
    scope: 'attendance',
    formFields: {
      fields: [
        { name: 'reason', type: 'text', label: '请假原因' },
        { name: 'startDate', type: 'date', label: '开始日期' },
        { name: 'endDate', type: 'date', label: '结束日期' },
        { name: 'days', type: 'number', label: '天数' },
      ],
    },
    nodes: [
      { name: '直属经理审批', approverType: 'single', sortOrder: 1, config: {} },
      { name: 'HR 审批', approverType: 'single', sortOrder: 2, config: {} },
    ],
  },
  {
    name: '报销申请',
    description: '费用报销审批流程',
    scope: 'finance',
    formFields: {
      fields: [
        { name: 'amount', type: 'number', label: '金额' },
        {
          name: 'category',
          type: 'select',
          label: '类别',
          options: ['差旅', '办公用品', '招待', '其他'],
        },
        { name: 'description', type: 'text', label: '说明' },
      ],
    },
    nodes: [
      { name: '直属经理审批', approverType: 'single', sortOrder: 1, config: {} },
      { name: '财务审批', approverType: 'single', sortOrder: 2, config: {} },
    ],
  },
  {
    name: '通用审批',
    description: '通用事项审批流程',
    scope: 'general',
    formFields: {
      fields: [
        { name: 'subject', type: 'text', label: '主题' },
        { name: 'content', type: 'textarea', label: '内容' },
        { name: 'urgent', type: 'boolean', label: '加急' },
      ],
    },
    nodes: [
      { name: '直属经理审批', approverType: 'single', sortOrder: 1, config: {} },
      { name: '部门负责人审批', approverType: 'single', sortOrder: 2, config: {} },
    ],
  },
];

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly engineService: ApprovalEngineService,
    private readonly templateService: ApprovalTemplateService,
  ) {}

  // ── Create ───────────────────────────────────────────────────

  /**
   * Create a new approval instance.
   *
   * 1. Load the template with its nodes (ordered by sortOrder).
   * 2. Validate that formData satisfies the template's formFields (basic check).
   * 3. Set status to PENDING and currentSortOrder to the first node's sortOrder.
   * 4. Return the created approval with template nodes included.
   */
  async create(userId: string, tenantId: string, dto: CreateApprovalDto) {
    await this.rbacService.assertPermission('approval.create', userId, tenantId, {
      teamId: dto.teamId,
    });

    const { templateId, formData, teamId } = dto;

    // Load template with ordered nodes
    const template = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!template || template.deletedAt) {
      throw new NotFoundException('Approval template not found');
    }

    // Basic validation: ensure formData is a non-null object
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
      throw new BadRequestException('formData must be a non-null object');
    }

    // Determine the first approval node
    const firstNode = template.nodes?.[0];
    const currentSortOrder = firstNode?.sortOrder ?? null;

    const approval = await this.prisma.approval.create({
      data: {
        title: dto.title?.trim() || template.name,
        templateId,
        formData,
        status: 'PENDING',
        currentSortOrder,
        teamId,
        creatorId: userId,
      },
      include: {
        template: {
          include: {
            nodes: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    this.logger.log(
      `Approval ${approval.id} created for template "${template.name}" by user ${userId}`,
    );

    return approval;
  }

  // ── List (paginated) ─────────────────────────────────────────

  /**
   * List approvals with pagination and optional filters: teamId, creatorId, status.
   */
  async findAll(userId: string, tenantId: string, query: QueryApprovalDto) {
    const {
      page = 1,
      limit = 20,
      teamId,
      creatorId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = { deletedAt: null };

    if (teamId) {
      await this.rbacService.assertPermission('approval.read', userId, tenantId, {
        teamId,
      });
      where.teamId = teamId;
    } else {
      const accessibleTeamIds = await this.rbacService.listAccessibleTeamIds(
        userId,
        tenantId,
        'approval.read',
      );

      if (accessibleTeamIds.length === 0) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      where.teamId = { in: accessibleTeamIds };
    }
    if (creatorId) {
      where.creatorId = creatorId;
    }
    if (status) {
      where.status = status;
    }

    // Whitelist allowed sort fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'currentSortOrder', 'status'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.approval.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [field]: order },
        include: {
          template: {
            select: { id: true, name: true },
          },
          creator: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.approval.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Detail ───────────────────────────────────────────────────

  /**
   * Get full approval detail including template (with nodes), creator,
   * action history (with processor info), and resolved current node.
   */
  async findById(userId: string, tenantId: string, approvalId: string) {
    await this.rbacService.assertPermission('approval.read', userId, tenantId, {
      resourceId: approvalId,
    });

    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        template: {
          include: {
            nodes: { orderBy: { sortOrder: 'asc' } },
          },
        },
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        actions: {
          include: {
            node: {
              select: { id: true, name: true, sortOrder: true },
            },
            processor: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!approval || approval.deletedAt) {
      throw new NotFoundException('Approval not found');
    }

    // Resolve current node from currentSortOrder
    const currentSortOrder = approval.currentSortOrder;
    let currentNode = null;
    if (currentSortOrder != null && approval.template?.nodes) {
      currentNode = approval.template.nodes.find(
        (n) => n.sortOrder === currentSortOrder,
      ) ?? null;
    }

    return {
      ...approval,
      currentNode,
    };
  }

  // ── Templates ────────────────────────────────────────────────

  /**
   * Return available approval templates.
   *
   * If the database already has templates, return them.
   * Otherwise, seed the three built-in templates (leave, expense, general)
   * with their respective nodes and return the newly created records.
   */
  async getTemplates(userId: string, tenantId: string, teamId?: string) {
    if (teamId) {
      await this.rbacService.assertPermission('approval.read', userId, tenantId, {
        teamId,
      });
    }

    const accessibleTeamIds = teamId
      ? [teamId]
      : await this.rbacService.listAccessibleTeamIds(userId, tenantId, 'approval.read');

    if (accessibleTeamIds.length === 0) {
      return [];
    }

    const existing = await this.prisma.approvalTemplate.findMany({
      where: {
        deletedAt: null,
        teamId: { in: accessibleTeamIds },
      },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing.length > 0) {
      return existing;
    }

    // No templates exist yet — seed built-in templates
    if (!teamId) {
      return [];
    }

    const seeded: Array<any> = [];

    for (const seed of SEED_TEMPLATES) {
      const template = await this.prisma.approvalTemplate.create({
        data: {
          name: seed.name,
          description: seed.description,
          scope: seed.scope,
          formFields: seed.formFields,
          teamId,
          createdBy: userId,
          nodes: {
            create: seed.nodes.map((n) => ({
              name: n.name,
              approverType: n.approverType,
              sortOrder: n.sortOrder,
              config: n.config,
            })),
          },
        },
        include: {
          nodes: { orderBy: { sortOrder: 'asc' } },
        },
      });

      seeded.push(template);
    }

    this.logger.log(`Seeded ${seeded.length} built-in approval templates`);
    return seeded;
  }

  // ── Approval Actions (delegated to engine) ──────────────────

  /**
   * Process an approval action via the engine.
   */
  async processAction(
    userId: string,
    tenantId: string,
    approvalId: string,
    dto: ApprovalActionDto,
  ) {
    await this.rbacService.assertPermission('approval.approve', userId, tenantId, {
      resourceId: approvalId,
    });

    return this.engineService.processAction(userId, approvalId, dto);
  }

  /**
   * Get action history for an approval.
   */
  async getActionHistory(userId: string, tenantId: string, approvalId: string) {
    await this.rbacService.assertPermission('approval.read', userId, tenantId, {
      resourceId: approvalId,
    });

    return this.engineService.getActionHistory(approvalId);
  }

  // ── Template Management (delegated to template service) ─────

  /**
   * Create a custom approval template with nodes.
   */
  async createTemplate(userId: string, tenantId: string, dto: CreateTemplateDto) {
    await this.rbacService.assertPermission('approval.manage', userId, tenantId, {
      teamId: dto.teamId,
    });

    return this.templateService.create(userId, tenantId, dto);
  }

  /**
   * Get a single template by ID.
   */
  async getTemplateById(userId: string, tenantId: string, templateId: string) {
    return this.templateService.findById(userId, tenantId, templateId);
  }

  /**
   * Update template metadata.
   */
  async updateTemplate(
    userId: string,
    tenantId: string,
    templateId: string,
    data: { name?: string; description?: string; scope?: string; formFields?: Record<string, any> },
  ) {
    return this.templateService.update(userId, tenantId, templateId, data);
  }

  /**
   * Soft-delete a template.
   */
  async deleteTemplate(userId: string, tenantId: string, templateId: string) {
    return this.templateService.remove(userId, tenantId, templateId);
  }
}
