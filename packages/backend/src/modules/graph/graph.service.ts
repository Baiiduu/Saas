import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import {
  CreateGraphEdgeDto,
  CreateGraphNodeDto,
  GraphNodeTypeDto,
  GraphRelationTypeDto,
  SaveGraphCanvasDto,
  SaveGraphCanvasNodeDto,
  UpdateGraphEdgeDto,
  UpdateGraphNodeDto,
} from './dto/graph-canvas.dto';

const RELATION_LABELS: Record<GraphRelationTypeDto, string> = {
  [GraphRelationTypeDto.DEPENDS_ON]: '依赖',
  [GraphRelationTypeDto.PRODUCES]: '产出',
  [GraphRelationTypeDto.OWNED_BY]: '负责',
  [GraphRelationTypeDto.BELONGS_TO]: '归属',
  [GraphRelationTypeDto.REFERENCES]: '引用',
  [GraphRelationTypeDto.BACKED_BY_REPO]: '仓库支撑',
};

type CanvasNodeRecord = {
  id: string;
  canvasId: string;
  teamId: string;
  tenantId: string;
  nodeType: string;
  resourceType: string | null;
  resourceId: string | null;
  title: string;
  description: string | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  parentNodeId: string | null;
  metadata: unknown;
};

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  async getTeamCanvas(userId: string, tenantId: string, teamId: string) {
    await this.rbacService.assertPermission('graph.read', userId, tenantId, { teamId });
    const canvas = await this.getOrCreateDefaultCanvas(userId, tenantId, teamId);
    const canEdit = await this.rbacService.canAccessPermission('graph.update', userId, tenantId, {
      teamId,
    });

    return {
      canvas: {
        id: canvas.id,
        name: canvas.name,
        description: canvas.description,
        teamId: canvas.teamId,
        tenantId: canvas.tenantId,
        viewport: canvas.viewport,
        canEdit,
      },
      nodes: canvas.nodes.map((node) => this.toCanvasNode(node)),
      edges: canvas.edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        label: edge.relationType,
        relationType: edge.relationType,
        data: {
          relationType: edge.relationType,
          label: RELATION_LABELS[edge.relationType as GraphRelationTypeDto] ?? edge.relationType,
          metadata: edge.metadata,
        },
      })),
      relationTypes: Object.entries(RELATION_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async getResourcePool(userId: string, tenantId: string, teamId: string) {
    await this.rbacService.assertPermission('graph.read', userId, tenantId, { teamId });

    const [canReadTasks, canReadDocs, canReadMembers, canReadMilestones] = await Promise.all([
      this.rbacService.canAccessPermission('task.read', userId, tenantId, { teamId }),
      this.rbacService.canAccessPermission('document.read', userId, tenantId, { teamId }),
      this.rbacService.canAccessPermission('member.read', userId, tenantId, { teamId }),
      this.rbacService.canAccessPermission('milestone.read', userId, tenantId, { teamId }),
    ]);

    const [tasks, documents, members, milestones] = await Promise.all([
      canReadTasks
        ? this.prisma.task.findMany({
            where: { teamId, deletedAt: null },
            select: { id: true, title: true, status: true, priority: true },
            orderBy: { updatedAt: 'desc' },
            take: 100,
          })
        : [],
      canReadDocs
        ? this.prisma.document.findMany({
            where: { teamId, deletedAt: null },
            select: { id: true, name: true, type: true, mimeType: true },
            orderBy: { updatedAt: 'desc' },
            take: 100,
          })
        : [],
      canReadMembers
        ? this.prisma.teamMember.findMany({
            where: { teamId },
            include: {
              user: {
                select: { id: true, displayName: true, email: true, avatar: true },
              },
            },
            orderBy: { joinedAt: 'asc' },
          })
        : [],
      canReadMilestones
        ? this.prisma.milestone.findMany({
            where: { teamId, deletedAt: null },
            select: { id: true, name: true, status: true, progress: true, dueDate: true },
            orderBy: { dueDate: 'asc' },
            take: 100,
          })
        : [],
    ]);

    return {
      tasks: tasks.map((task) => ({
        id: task.id,
        type: GraphNodeTypeDto.TASK,
        label: task.title,
        meta: { status: task.status, priority: task.priority },
      })),
      documents: documents.map((document) => ({
        id: document.id,
        type: GraphNodeTypeDto.DOCUMENT,
        label: document.name,
        meta: { documentType: document.type, mimeType: document.mimeType },
      })),
      members: members.map((member) => ({
        id: member.userId,
        type: GraphNodeTypeDto.MEMBER,
        label: member.user.displayName || member.user.email,
        meta: { email: member.user.email, role: member.role, avatar: member.user.avatar },
      })),
      milestones: milestones.map((milestone) => ({
        id: milestone.id,
        type: GraphNodeTypeDto.MILESTONE,
        label: milestone.name,
        meta: {
          status: milestone.status,
          progress: milestone.progress,
          dueDate: milestone.dueDate,
        },
      })),
    };
  }

  async createNode(
    userId: string,
    tenantId: string,
    teamId: string,
    dto: CreateGraphNodeDto,
  ) {
    await this.rbacService.assertPermission('graph.update', userId, tenantId, { teamId });
    const canvas = await this.getOrCreateDefaultCanvas(userId, tenantId, teamId);
    const resolved = await this.resolveNodePayload(tenantId, teamId, dto);

    if (resolved.resourceId) {
      const existing = await this.prisma.graphNode.findFirst({
        where: {
          canvasId: canvas.id,
          nodeType: dto.nodeType,
          resourceId: resolved.resourceId,
          deletedAt: null,
        },
      });
      if (existing) {
        return this.toCanvasNode(existing);
      }
    }

    if (dto.parentNodeId) {
      if (dto.nodeType === GraphNodeTypeDto.MILESTONE) {
        throw new BadRequestException('Milestone nodes cannot have a parent node');
      }
      await this.assertMilestoneParent(canvas.id, dto.parentNodeId);
    }

    const node = await this.prisma.graphNode.create({
      data: {
        canvasId: canvas.id,
        teamId,
        tenantId,
        nodeType: dto.nodeType,
        resourceType: resolved.resourceType,
        resourceId: resolved.resourceId,
        title: resolved.title,
        description: dto.description ?? resolved.description ?? null,
        x: dto.position?.x ?? 80,
        y: dto.position?.y ?? 80,
        parentNodeId: dto.parentNodeId ?? null,
        metadata: {
          ...(dto.metadata ?? {}),
          ...(resolved.metadata ?? {}),
        },
        createdBy: userId,
      },
    });

    await this.auditService.append({
      userId,
      tenantId,
      action: 'graph.node.create',
      resourceType: 'graph_node',
      resourceId: node.id,
      detail: {
        teamId,
        canvasId: canvas.id,
        nodeType: node.nodeType,
        resourceType: node.resourceType,
        resourceId: node.resourceId,
        parentNodeId: node.parentNodeId,
      },
    });

    this.logger.log(`Graph node ${node.id} created in canvas ${canvas.id}`);
    return this.toCanvasNode(node);
  }

  async updateNode(userId: string, tenantId: string, nodeId: string, dto: UpdateGraphNodeDto) {
    const existing = await this.findActiveNode(nodeId);
    await this.rbacService.assertPermission('graph.update', userId, tenantId, {
      teamId: existing.teamId,
    });
    this.assertSameTenant(existing.tenantId, tenantId);

    if (dto.parentNodeId) {
      if (dto.parentNodeId === nodeId) {
        throw new BadRequestException('A node cannot be its own parent');
      }
      if (existing.nodeType === GraphNodeTypeDto.MILESTONE) {
        throw new BadRequestException('Milestone nodes cannot have a parent node');
      }
      await this.assertMilestoneParent(existing.canvasId, dto.parentNodeId);
    }

    const data: Record<string, unknown> = {};
    if (dto.position) {
      data.x = dto.position.x;
      data.y = dto.position.y;
    }
    if (dto.size) {
      data.width = dto.size.width;
      data.height = dto.size.height;
    }
    if (dto.parentNodeId !== undefined) {
      data.parentNodeId = dto.parentNodeId;
    }
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.metadata !== undefined) {
      data.metadata = {
        ...((existing.metadata as Record<string, unknown>) ?? {}),
        ...dto.metadata,
      };
    }

    const updated = await this.prisma.graphNode.update({
      where: { id: nodeId },
      data,
    });

    if (dto.position && (existing.x !== dto.position.x || existing.y !== dto.position.y)) {
      await this.auditService.append({
        userId,
        tenantId,
        action: 'graph.node.move',
        resourceType: 'graph_node',
        resourceId: nodeId,
        detail: {
          from: { x: existing.x, y: existing.y },
          to: dto.position,
          canvasId: existing.canvasId,
          teamId: existing.teamId,
        },
      });
    }

    if (
      dto.size &&
      (existing.width !== dto.size.width || existing.height !== dto.size.height)
    ) {
      await this.auditService.append({
        userId,
        tenantId,
        action: 'graph.node.resize',
        resourceType: 'graph_node',
        resourceId: nodeId,
        detail: {
          from: { width: existing.width, height: existing.height },
          to: dto.size,
          canvasId: existing.canvasId,
          teamId: existing.teamId,
        },
      });
    }

    if (dto.parentNodeId !== undefined && existing.parentNodeId !== dto.parentNodeId) {
      await this.auditService.append({
        userId,
        tenantId,
        action: 'graph.node.parent.update',
        resourceType: 'graph_node',
        resourceId: nodeId,
        detail: {
          fromParentNodeId: existing.parentNodeId,
          toParentNodeId: dto.parentNodeId,
          canvasId: existing.canvasId,
          teamId: existing.teamId,
        },
      });
    }

    return this.toCanvasNode(updated);
  }

  async createEdge(
    userId: string,
    tenantId: string,
    teamId: string,
    dto: CreateGraphEdgeDto,
  ) {
    await this.rbacService.assertPermission('graph.update', userId, tenantId, { teamId });
    const canvas = await this.getOrCreateDefaultCanvas(userId, tenantId, teamId);
    const edge = await this.createCanvasEdge(userId, tenantId, canvas.id, dto);

    await this.auditService.append({
      userId,
      tenantId,
      action: 'graph.edge.create',
      resourceType: 'graph_edge',
      resourceId: edge.id,
      detail: {
        teamId,
        canvasId: canvas.id,
        relationType: edge.relationType,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
      },
    });

    return {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      relationType: edge.relationType,
      label: edge.relationType,
    };
  }

  async deleteEdge(userId: string, tenantId: string, edgeId: string) {
    const edge = await this.prisma.graphEdge.findUnique({ where: { id: edgeId } });
    if (!edge) {
      return;
    }
    if (!edge.canvasId || !edge.teamId || !edge.tenantId) {
      throw new NotFoundException('Graph edge not found');
    }
    this.assertSameTenant(edge.tenantId, tenantId);

    await this.rbacService.assertPermission('graph.update', userId, tenantId, {
      teamId: edge.teamId,
    });

    await this.prisma.graphEdge.delete({ where: { id: edgeId } });
    await this.auditService.append({
      userId,
      tenantId,
      action: 'graph.edge.delete',
      resourceType: 'graph_edge',
      resourceId: edgeId,
      detail: {
        teamId: edge.teamId,
        canvasId: edge.canvasId,
        relationType: edge.relationType,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
      },
    });
  }

  async updateEdge(
    userId: string,
    tenantId: string,
    edgeId: string,
    dto: UpdateGraphEdgeDto,
  ) {
    const edge = await this.prisma.graphEdge.findUnique({ where: { id: edgeId } });
    if (!edge || !edge.canvasId || !edge.teamId || !edge.tenantId) {
      throw new NotFoundException('Graph edge not found');
    }
    this.assertSameTenant(edge.tenantId, tenantId);

    await this.rbacService.assertPermission('graph.update', userId, tenantId, {
      teamId: edge.teamId,
    });

    const updated = await this.prisma.graphEdge.update({
      where: { id: edgeId },
      data: {
        relationType: dto.relationType ?? edge.relationType,
      },
    });

    if (dto.relationType && dto.relationType !== edge.relationType) {
      await this.auditService.append({
        userId,
        tenantId,
        action: 'graph.edge.update',
        resourceType: 'graph_edge',
        resourceId: edgeId,
        detail: {
          teamId: edge.teamId,
          canvasId: edge.canvasId,
          fromRelationType: edge.relationType,
          toRelationType: dto.relationType,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
        },
      });
    }

    return {
      id: updated.id,
      source: updated.sourceNodeId,
      target: updated.targetNodeId,
      sourceNodeId: updated.sourceNodeId,
      targetNodeId: updated.targetNodeId,
      relationType: updated.relationType,
      label: updated.relationType,
    };
  }

  async deleteNode(userId: string, tenantId: string, nodeId: string) {
    const node = await this.findActiveNode(nodeId);
    this.assertSameTenant(node.tenantId, tenantId);

    await this.rbacService.assertPermission('graph.update', userId, tenantId, {
      teamId: node.teamId,
    });

    const affectedEdges = await this.prisma.graphEdge.findMany({
      where: {
        canvasId: node.canvasId,
        OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
      },
      select: { id: true, relationType: true, sourceNodeId: true, targetNodeId: true },
    });

    const childCount = await this.prisma.graphNode.count({
      where: { parentNodeId: nodeId, deletedAt: null },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.graphEdge.deleteMany({
        where: {
          canvasId: node.canvasId,
          OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
        },
      });

      await tx.graphNode.updateMany({
        where: { parentNodeId: nodeId, deletedAt: null },
        data: { parentNodeId: null },
      });

      await tx.graphNode.update({
        where: { id: nodeId },
        data: { deletedAt: new Date(), parentNodeId: null },
      });
    });

    await this.auditService.append({
      userId,
      tenantId,
      action: 'graph.node.delete',
      resourceType: 'graph_node',
      resourceId: nodeId,
      detail: {
        teamId: node.teamId,
        canvasId: node.canvasId,
        nodeType: node.nodeType,
        resourceType: node.resourceType,
        resourceId: node.resourceId,
        detachedChildren: childCount,
        deletedEdges: affectedEdges,
      },
    });
  }

  async saveCanvas(
    userId: string,
    tenantId: string,
    teamId: string,
    dto: SaveGraphCanvasDto,
  ) {
    await this.rbacService.assertPermission('graph.update', userId, tenantId, { teamId });
    const canvas = await this.getOrCreateDefaultCanvas(userId, tenantId, teamId);

    for (const node of dto.nodes ?? []) {
      if (node.id) {
        await this.updateNode(userId, tenantId, node.id, {
          position: node.position,
          parentNodeId: node.parentNodeId,
          title: node.title,
          description: node.description,
          metadata: node.metadata,
        });
      } else {
        await this.createNode(userId, tenantId, teamId, node);
      }
    }

    for (const edge of dto.edges ?? []) {
      if (!edge.id) {
        await this.createEdge(userId, tenantId, teamId, edge);
      }
    }

    if (dto.viewport) {
      await this.prisma.graphCanvas.update({
        where: { id: canvas.id },
        data: { viewport: dto.viewport as Prisma.InputJsonValue },
      });
    }

    return this.getTeamCanvas(userId, tenantId, teamId);
  }

  /**
   * Backward-compatible resource-centric graph query.
   */
  async getGraph(
    resourceType: string,
    resourceId: string,
    typeFilter?: string,
    userId?: string,
    tenantId?: string,
  ) {
    if (userId && tenantId) {
      await this.rbacService.assertPermission(`${resourceType}.read`, userId, tenantId, {
        resourceId,
      });
    }

    let resource: any = null;
    switch (resourceType) {
      case 'task':
        resource = await this.prisma.task.findUnique({
          where: { id: resourceId },
          select: { id: true, title: true, deletedAt: true },
        });
        break;
      case 'document':
        resource = await this.prisma.document.findUnique({
          where: { id: resourceId },
          select: { id: true, name: true, deletedAt: true },
        });
        break;
      default:
        throw new NotFoundException(`Unknown resource type: ${resourceType}`);
    }

    if (!resource || resource.deletedAt) {
      throw new NotFoundException(`${resourceType} not found`);
    }

    const edgeFilter: any = {
      OR: [
        { sourceType: resourceType, sourceId: resourceId },
        { targetType: resourceType, targetId: resourceId },
      ],
    };

    if (typeFilter) {
      edgeFilter.relationType = typeFilter;
    }

    const edges = await this.prisma.graphEdge.findMany({
      where: edgeFilter,
      orderBy: { createdAt: 'desc' },
    });

    const nodeMap = new Map<string, any>();
    const resultEdges: any[] = [];

    nodeMap.set(`${resourceType}:${resourceId}`, {
      id: `${resourceType}:${resourceId}`,
      type: resourceType,
      label: resource.name || resource.title || resourceId,
      data: { resourceType, resourceId },
      position: { x: 0, y: 0 },
    });

    for (const edge of edges) {
      const sourceKey = `${edge.sourceType}:${edge.sourceId}`;
      const targetKey = `${edge.targetType}:${edge.targetId}`;

      if (!nodeMap.has(sourceKey)) {
        nodeMap.set(sourceKey, {
          id: sourceKey,
          type: edge.sourceType,
          label: edge.sourceId,
          data: { resourceType: edge.sourceType, resourceId: edge.sourceId },
          position: { x: 0, y: 0 },
        });
      }

      if (!nodeMap.has(targetKey)) {
        nodeMap.set(targetKey, {
          id: targetKey,
          type: edge.targetType,
          label: edge.targetId,
          data: { resourceType: edge.targetType, resourceId: edge.targetId },
          position: { x: 0, y: 0 },
        });
      }

      resultEdges.push({
        id: edge.id,
        source: sourceKey,
        target: targetKey,
        label: edge.relationType,
        type: 'default',
        data: { relationType: edge.relationType },
      });
    }

    await this.enrichNodeLabels(nodeMap);

    this.logger.log(
      `Graph queried for ${resourceType}:${resourceId} - ${nodeMap.size} nodes, ${resultEdges.length} edges`,
    );

    return {
      nodes: Array.from(nodeMap.values()),
      edges: resultEdges,
    };
  }

  private async getOrCreateDefaultCanvas(userId: string, tenantId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tenantId: true, name: true, deletedAt: true },
    });
    if (!team || team.deletedAt) {
      throw new NotFoundException('Team not found');
    }
    this.assertSameTenant(team.tenantId, tenantId);

    const existing = await this.prisma.graphCanvas.findFirst({
      where: { teamId, tenantId, isDefault: true, deletedAt: null },
      include: {
        nodes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        edges: {
          where: {
            sourceNodeId: { not: null },
            targetNodeId: { not: null },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.graphCanvas.create({
      data: {
        name: '团队资源关系画布',
        teamId,
        tenantId,
        createdBy: userId,
      },
      include: {
        nodes: true,
        edges: true,
      },
    });
  }

  private async resolveNodePayload(
    tenantId: string,
    teamId: string,
    dto: CreateGraphNodeDto | SaveGraphCanvasNodeDto,
  ) {
    if (dto.nodeType === GraphNodeTypeDto.GIT_REPO) {
      if (!dto.title || !dto.url) {
        throw new BadRequestException('Git repository node requires title and url');
      }
      return {
        resourceType: null,
        resourceId: null,
        title: dto.title,
        description: dto.description ?? null,
        metadata: { url: dto.url },
      };
    }

    if (!dto.resourceId) {
      throw new BadRequestException(`${dto.nodeType} node requires resourceId`);
    }

    if (dto.nodeType === GraphNodeTypeDto.TASK) {
      const task = await this.prisma.task.findUnique({
        where: { id: dto.resourceId },
        select: { id: true, title: true, description: true, teamId: true, deletedAt: true },
      });
      if (!task || task.deletedAt || task.teamId !== teamId) {
        throw new NotFoundException('Task not found in current team');
      }
      return {
        resourceType: 'task',
        resourceId: task.id,
        title: dto.title ?? task.title,
        description: dto.description ?? task.description,
        metadata: {},
      };
    }

    if (dto.nodeType === GraphNodeTypeDto.DOCUMENT) {
      const document = await this.prisma.document.findUnique({
        where: { id: dto.resourceId },
        select: { id: true, name: true, teamId: true, deletedAt: true, type: true },
      });
      if (!document || document.deletedAt || document.teamId !== teamId) {
        throw new NotFoundException('Document not found in current team');
      }
      return {
        resourceType: 'document',
        resourceId: document.id,
        title: dto.title ?? document.name,
        description: dto.description ?? null,
        metadata: { documentType: document.type },
      };
    }

    if (dto.nodeType === GraphNodeTypeDto.MEMBER) {
      const member = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: dto.resourceId } },
        include: {
          user: {
            select: { id: true, displayName: true, email: true, avatar: true },
          },
          team: {
            select: { tenantId: true },
          },
        },
      });
      if (!member || member.team.tenantId !== tenantId) {
        throw new NotFoundException('Member not found in current team');
      }
      return {
        resourceType: 'member',
        resourceId: member.userId,
        title: dto.title ?? member.user.displayName ?? member.user.email,
        description: dto.description ?? member.user.email,
        metadata: { role: member.role, avatar: member.user.avatar },
      };
    }

    if (dto.nodeType === GraphNodeTypeDto.MILESTONE) {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: dto.resourceId },
        select: {
          id: true,
          name: true,
          description: true,
          teamId: true,
          status: true,
          progress: true,
          deletedAt: true,
        },
      });
      if (!milestone || milestone.deletedAt || milestone.teamId !== teamId) {
        throw new NotFoundException('Milestone not found in current team');
      }
      return {
        resourceType: 'milestone',
        resourceId: milestone.id,
        title: dto.title ?? milestone.name,
        description: dto.description ?? milestone.description,
        metadata: { status: milestone.status, progress: milestone.progress },
      };
    }

    throw new BadRequestException(`Unsupported graph node type: ${dto.nodeType}`);
  }

  private async createCanvasEdge(
    userId: string,
    tenantId: string,
    canvasId: string,
    dto: CreateGraphEdgeDto,
  ) {
    if (dto.sourceNodeId === dto.targetNodeId) {
      throw new BadRequestException('Cannot connect a node to itself');
    }

    const [source, target] = await Promise.all([
      this.findActiveNode(dto.sourceNodeId),
      this.findActiveNode(dto.targetNodeId),
    ]);

    if (source.canvasId !== canvasId || target.canvasId !== canvasId) {
      throw new BadRequestException('Both nodes must belong to the current canvas');
    }
    if (source.teamId !== target.teamId || source.tenantId !== target.tenantId) {
      throw new BadRequestException('Cannot connect nodes across teams or tenants');
    }
    this.assertSameTenant(source.tenantId, tenantId);

    return this.prisma.graphEdge.upsert({
      where: {
        canvasId_sourceNodeId_targetNodeId_relationType: {
          canvasId,
          sourceNodeId: dto.sourceNodeId,
          targetNodeId: dto.targetNodeId,
          relationType: dto.relationType,
        },
      },
      update: {},
      create: {
        canvasId,
        teamId: source.teamId,
        tenantId,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        sourceType: source.resourceType ?? source.nodeType,
        sourceId: source.resourceId ?? source.id,
        targetType: target.resourceType ?? target.nodeType,
        targetId: target.resourceId ?? target.id,
        relationType: dto.relationType,
        createdBy: userId,
      },
    });
  }

  private async assertMilestoneParent(canvasId: string, parentNodeId: string) {
    const parent = await this.prisma.graphNode.findFirst({
      where: { id: parentNodeId, canvasId, deletedAt: null },
      select: { id: true, nodeType: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent node not found');
    }
    if (parent.nodeType !== GraphNodeTypeDto.MILESTONE) {
      throw new BadRequestException('Only milestone nodes can be parent nodes');
    }
  }

  private async findActiveNode(nodeId: string): Promise<CanvasNodeRecord> {
    const node = await this.prisma.graphNode.findUnique({ where: { id: nodeId } });
    if (!node || node.deletedAt) {
      throw new NotFoundException('Graph node not found');
    }
    return node as CanvasNodeRecord;
  }

  private assertSameTenant(resourceTenantId: string, requestTenantId: string) {
    if (resourceTenantId !== requestTenantId) {
      throw new BadRequestException('Cross-tenant graph access is not allowed');
    }
  }

  private toCanvasNode(node: CanvasNodeRecord) {
    return {
      id: node.id,
      type: node.nodeType,
      nodeType: node.nodeType,
      resourceType: node.resourceType,
      resourceId: node.resourceId,
      label: node.title,
      title: node.title,
      description: node.description,
      parentNodeId: node.parentNodeId,
      size: {
        width: node.width,
        height: node.height,
      },
      position: { x: node.x, y: node.y },
      data: {
        ...(node.metadata as Record<string, unknown>),
        resourceType: node.resourceType,
        resourceId: node.resourceId,
        parentNodeId: node.parentNodeId,
      },
    };
  }

  private async enrichNodeLabels(nodeMap: Map<string, any>): Promise<void> {
    const taskIds: string[] = [];
    const docIds: string[] = [];
    const milestoneIds: string[] = [];
    const memberIds: string[] = [];

    for (const [, node] of nodeMap.entries()) {
      if (node.type === 'task') {
        taskIds.push(node.data.resourceId);
      } else if (node.type === 'document') {
        docIds.push(node.data.resourceId);
      } else if (node.type === 'milestone') {
        milestoneIds.push(node.data.resourceId);
      } else if (node.type === 'member') {
        memberIds.push(node.data.resourceId);
      }
    }

    if (taskIds.length > 0) {
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, title: true },
      });
      const taskMap = new Map(tasks.map((task) => [task.id, task.title]));
      for (const [, node] of nodeMap.entries()) {
        if (node.type === 'task') {
          node.label = taskMap.get(node.data.resourceId) ?? node.label;
        }
      }
    }

    if (docIds.length > 0) {
      const docs = await this.prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, name: true },
      });
      const docMap = new Map(docs.map((doc) => [doc.id, doc.name]));
      for (const [, node] of nodeMap.entries()) {
        if (node.type === 'document') {
          node.label = docMap.get(node.data.resourceId) ?? node.label;
        }
      }
    }

    if (milestoneIds.length > 0) {
      const milestones = await this.prisma.milestone.findMany({
        where: { id: { in: milestoneIds } },
        select: { id: true, name: true },
      });
      const milestoneMap = new Map(milestones.map((milestone) => [milestone.id, milestone.name]));
      for (const [, node] of nodeMap.entries()) {
        if (node.type === 'milestone') {
          node.label = milestoneMap.get(node.data.resourceId) ?? node.label;
        }
      }
    }

    if (memberIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, displayName: true, email: true },
      });
      const userMap = new Map(users.map((user) => [user.id, user.displayName || user.email]));
      for (const [, node] of nodeMap.entries()) {
        if (node.type === 'member') {
          node.label = userMap.get(node.data.resourceId) ?? node.label;
        }
      }
    }
  }
}
