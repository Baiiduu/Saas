import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalService } from './approval.service';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalTemplateService } from './approval-template.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { ApprovalStatus } from '@prisma/client';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let prisma: any;

  const mockTemplateWithNodes = {
    id: 'template-1',
    name: '请假申请',
    description: '员工请假审批流程',
    scope: 'attendance',
    formFields: {
      fields: [
        { name: 'reason', type: 'text', label: '请假原因' },
        { name: 'days', type: 'number', label: '天数' },
      ],
    },
    teamId: 'team-1',
    createdBy: 'user-1',
    deletedAt: null,
    nodes: [
      { id: 'node-1', templateId: 'template-1', name: '直属经理审批', approverType: 'single', sortOrder: 1, config: {} },
      { id: 'node-2', templateId: 'template-1', name: 'HR 审批', approverType: 'single', sortOrder: 2, config: {} },
    ],
  };

  const mockApproval = {
    id: 'approval-1',
    templateId: 'template-1',
    formData: { reason: '病假', startDate: '2026-05-01', endDate: '2026-05-03', days: 3 },
    status: ApprovalStatus.PENDING,
    currentSortOrder: 1,
    teamId: 'team-1',
    creatorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    template: {
      ...mockTemplateWithNodes,
    },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.resolve(arg);
      }),
      approvalTemplate: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      approval: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ApprovalEngineService,
          useValue: {
            processAction: jest.fn(),
            getActionHistory: jest.fn(),
          },
        },
        {
          provide: ApprovalTemplateService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateApprovalDto = {
      title: '请假申请',
      templateId: 'template-1',
      formData: { reason: '病假', days: 3 },
      teamId: 'team-1',
    };

    it('should create an approval with PENDING status and currentSortOrder', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(mockTemplateWithNodes);
      prisma.approval.create.mockResolvedValue(mockApproval);

      const result = await service.create('user-1', dto);

      expect(prisma.approvalTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        include: { nodes: { orderBy: { sortOrder: 'asc' } } },
      });
      expect(prisma.approval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templateId: 'template-1',
            formData: { reason: '病假', days: 3 },
            status: 'PENDING',
            currentSortOrder: 1,
            teamId: 'team-1',
            creatorId: 'user-1',
          }),
        }),
      );
      expect(result.status).toBe(ApprovalStatus.PENDING);
      expect(result.currentSortOrder).toBe(1);
    });

    it('should set currentSortOrder to null when template has no nodes', async () => {
      const templateNoNodes = { ...mockTemplateWithNodes, nodes: [] };
      prisma.approvalTemplate.findUnique.mockResolvedValue(templateNoNodes);
      prisma.approval.create.mockResolvedValue({ ...mockApproval, currentSortOrder: null });

      const result = await service.create('user-1', dto);

      expect(result.currentSortOrder).toBeNull();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
      expect(prisma.approval.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when template is soft-deleted', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue({ ...mockTemplateWithNodes, deletedAt: new Date() });

      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when formData is null', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(mockTemplateWithNodes);

      await expect(
        service.create('user-1', { ...dto, formData: null as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when formData is not an object', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(mockTemplateWithNodes);

      await expect(
        service.create('user-1', { ...dto, formData: 'string' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when formData is an array', async () => {
      prisma.approvalTemplate.findUnique.mockResolvedValue(mockTemplateWithNodes);

      await expect(
        service.create('user-1', { ...dto, formData: [] as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated approvals with default params', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by teamId', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      await service.findAll({ teamId: 'team-1' } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: 'team-1' }),
        }),
      );
    });

    it('should filter by creatorId', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      await service.findAll({ creatorId: 'user-1' } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creatorId: 'user-1' }),
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      await service.findAll({ status: ApprovalStatus.PENDING } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ApprovalStatus.PENDING }),
        }),
      );
    });

    it('should sort by allowed fields', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      await service.findAll({ sortBy: 'status', sortOrder: 'asc' } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { status: 'asc' },
        }),
      );
    });

    it('should fall back to createdAt for disallowed sort fields', async () => {
      prisma.approval.findMany.mockResolvedValue([mockApproval]);
      prisma.approval.count.mockResolvedValue(1);

      await service.findAll({ sortBy: 'injected' } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should paginate correctly', async () => {
      prisma.approval.findMany.mockResolvedValue(Array(5).fill(mockApproval));
      prisma.approval.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 5 } as QueryApprovalDto);

      expect(prisma.approval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(2);
    });
  });

  // ── findById ────────────────────────────────────────────────

  describe('findById', () => {
    it('should return approval detail with current node resolved', async () => {
      prisma.approval.findUnique.mockResolvedValue({
        ...mockApproval,
        actions: [
          {
            id: 'action-1',
            approvalId: 'approval-1',
            nodeId: 'node-1',
            action: 'APPROVED',
            comment: 'OK',
            processorId: 'user-2',
            createdAt: new Date(),
            node: { id: 'node-1', name: '直属经理审批', sortOrder: 1 },
            processor: { id: 'user-2', email: 'manager@example.com', displayName: 'Manager', avatar: null },
          },
        ],
      });

      const result = await service.findById('approval-1');

      expect(prisma.approval.findUnique).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
        include: expect.objectContaining({
          template: expect.any(Object),
          creator: expect.any(Object),
          actions: expect.any(Object),
        }),
      });
      expect(result.id).toBe('approval-1');
      expect(result.currentNode).toBeDefined();
      expect(result.currentNode!.name).toBe('直属经理审批');
      expect(result.currentNode!.sortOrder).toBe(1);
    });

    it('should set currentNode to null when currentSortOrder is null', async () => {
      prisma.approval.findUnique.mockResolvedValue({
        ...mockApproval,
        currentSortOrder: null,
        actions: [],
      });

      const result = await service.findById('approval-1');

      expect(result.currentNode).toBeNull();
    });

    it('should throw NotFoundException when approval does not exist', async () => {
      prisma.approval.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when approval is soft-deleted', async () => {
      prisma.approval.findUnique.mockResolvedValue({ ...mockApproval, deletedAt: new Date() });

      await expect(service.findById('approval-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getTemplates ────────────────────────────────────────────

  describe('getTemplates', () => {
    it('should return existing templates when available', async () => {
      prisma.approvalTemplate.findMany.mockResolvedValue([mockTemplateWithNodes]);

      const result = await service.getTemplates('user-1', 'team-1');

      expect(prisma.approvalTemplate.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { nodes: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('请假申请');
      // Should NOT have called create
      expect(prisma.approvalTemplate.create).not.toHaveBeenCalled();
    });

    it('should seed built-in templates when none exist and teamId is provided', async () => {
      prisma.approvalTemplate.findMany.mockResolvedValue([]);
      prisma.approvalTemplate.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'seeded-' + Date.now(),
          ...args.data,
          nodes: args.data.nodes?.create?.map((n: any, i: number) => ({
            id: `node-${i}`,
            ...n,
          })) ?? [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      );

      const result = await service.getTemplates('user-1', 'team-1');

      // Should have created 3 seed templates
      expect(prisma.approvalTemplate.create).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('请假申请');
      expect(result[1].name).toBe('报销申请');
      expect(result[2].name).toBe('通用审批');
    });

    it('should return empty array when no templates exist and no teamId', async () => {
      prisma.approvalTemplate.findMany.mockResolvedValue([]);

      const result = await service.getTemplates('user-1', undefined);

      expect(result).toEqual([]);
      expect(prisma.approvalTemplate.create).not.toHaveBeenCalled();
    });

    it('should create each template with its nodes', async () => {
      prisma.approvalTemplate.findMany.mockResolvedValue([]);
      prisma.approvalTemplate.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'seeded-1',
          ...args.data,
          nodes: args.data.nodes?.create?.map((n: any) => ({ id: 'n-' + n.sortOrder, ...n })) ?? [],
        }),
      );

      const result = await service.getTemplates('user-1', 'team-1');

      // Verify first template (请假申请) was created correctly
      expect(prisma.approvalTemplate.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          data: expect.objectContaining({
            name: '请假申请',
            scope: 'attendance',
            teamId: 'team-1',
            createdBy: 'user-1',
            nodes: {
              create: [
                { name: '直属经理审批', approverType: 'single', sortOrder: 1, config: {} },
                { name: 'HR 审批', approverType: 'single', sortOrder: 2, config: {} },
              ],
            },
          }),
        }),
      );
      expect(result).toHaveLength(3);
    });
  });
});
