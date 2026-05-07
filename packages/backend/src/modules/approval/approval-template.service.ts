import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class ApprovalTemplateService {
  private readonly logger = new Logger(ApprovalTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new approval template with its approval nodes.
   */
  async create(userId: string, dto: CreateTemplateDto) {
    const { name, description, scope, formFields, teamId, nodes } = dto;

    // Basic validation
    if (!nodes || nodes.length === 0) {
      throw new BadRequestException('At least one approval node is required');
    }

    // Check sort-order uniqueness
    const sortOrders = nodes.map((n) => n.sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      throw new BadRequestException('Duplicate sortOrder values in nodes');
    }

    const template = await this.prisma.approvalTemplate.create({
      data: {
        name,
        description: description ?? null,
        scope,
        formFields,
        teamId,
        createdBy: userId,
        nodes: {
          create: nodes.map((n) => ({
            name: n.name,
            approverType: n.approverType,
            sortOrder: n.sortOrder,
            config: n.config ?? {},
          })),
        },
      },
      include: {
        nodes: { orderBy: { sortOrder: 'asc' } },
      },
    });

    this.logger.log(`Approval template "${template.name}" (${template.id}) created`);

    return template;
  }

  /**
   * List approval templates for a team (excluding soft-deleted).
   */
  async findAll(teamId?: string) {
    const where: any = { deletedAt: null };
    if (teamId) {
      where.teamId = teamId;
    }

    return this.prisma.approvalTemplate.findMany({
      where,
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single template by ID.
   */
  async findById(templateId: string) {
    const template = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
      include: {
        nodes: { orderBy: { sortOrder: 'asc' } },
        creator: {
          select: { id: true, email: true, displayName: true, avatar: true },
        },
      },
    });

    if (!template || template.deletedAt) {
      throw new NotFoundException('Approval template not found');
    }

    return template;
  }

  /**
   * Update a template's metadata (name, description, scope, formFields).
   * Nodes are managed separately via updateNodes / addNode / removeNode.
   */
  async update(
    templateId: string,
    data: { name?: string; description?: string; scope?: string; formFields?: Record<string, any> },
  ) {
    const existing = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Approval template not found');
    }

    const updated = await this.prisma.approvalTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.formFields !== undefined && { formFields: data.formFields }),
      },
      include: {
        nodes: { orderBy: { sortOrder: 'asc' } },
      },
    });

    this.logger.log(`Approval template ${templateId} updated`);

    return updated;
  }

  /**
   * Soft-delete an approval template.
   */
  async remove(templateId: string) {
    const existing = await this.prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Approval template not found');
    }

    await this.prisma.approvalTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Approval template ${templateId} soft-deleted`);
  }
}
