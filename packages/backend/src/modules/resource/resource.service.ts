import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { LinkResourceDto } from './dto/link-resource.dto';

@Injectable()
export class ResourceService {
  private readonly logger = new Logger(ResourceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Repo CRUD ───────────────────────────────────────────────

  /**
   * Create a new external repo configuration (Git / S3).
   */
  async createRepo(userId: string, dto: CreateRepoDto) {
    const repo = await this.prisma.resourceRepo.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: dto.config,
        teamId: dto.teamId,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Resource repo "${repo.name}" (${repo.id}) created by user ${userId}`);
    return repo;
  }

  /**
   * List all repos for a team.
   */
  async findReposByTeam(teamId: string) {
    return this.prisma.resourceRepo.findMany({
      where: { teamId, deletedAt: null },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Browse items inside a repo (directory listing).
   */
  async browseRepo(repoId: string, path?: string) {
    const repo = await this.prisma.resourceRepo.findUnique({
      where: { id: repoId },
      select: { id: true, name: true, type: true, deletedAt: true },
    });

    if (!repo || repo.deletedAt) {
      throw new NotFoundException('Resource repo not found');
    }

    const where: any = { repoId, deletedAt: null };
    if (path) {
      where.path = { startsWith: path };
    }

    return this.prisma.resourceItem.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Links ───────────────────────────────────────────────────

  /**
   * Link a resource item to a task or document.
   */
  async linkResource(userId: string, dto: LinkResourceDto) {
    // Verify the resource item exists
    const item = await this.prisma.resourceItem.findUnique({
      where: { id: dto.resourceItemId },
      select: { id: true, deletedAt: true },
    });

    if (!item || item.deletedAt) {
      throw new NotFoundException('Resource item not found');
    }

    const link = await this.prisma.resourceLink.create({
      data: {
        resourceItemId: dto.resourceItemId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        createdBy: userId,
      },
      include: {
        resourceItem: {
          select: { id: true, name: true, path: true, type: true },
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
    });

    this.logger.log(
      `Resource link created: item ${dto.resourceItemId} -> ${dto.targetType}/${dto.targetId}`,
    );

    return link;
  }
}
