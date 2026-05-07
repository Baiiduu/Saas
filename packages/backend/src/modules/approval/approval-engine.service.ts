import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalActionDto, ApprovalActionType } from './dto/approval-action.dto';

/**
 * Maps DTO action type → stored action value (past-tense convention).
 */
const ACTION_VALUE_MAP: Record<ApprovalActionType, string> = {
  [ApprovalActionType.APPROVE]: 'APPROVED',
  [ApprovalActionType.REJECT]: 'REJECTED',
  [ApprovalActionType.RETURN]: 'RETURNED',
  [ApprovalActionType.REDIRECT]: 'REDIRECTED',
};

@Injectable()
export class ApprovalEngineService {
  private readonly logger = new Logger(ApprovalEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process an approval action.
   *
   * Validates the approval is PENDING, determines the current node,
   * then applies the requested action:
   *
   * - **APPROVE** — moves to the next node or finalises the approval.
   * - **REJECT** — marks the approval as REJECTED.
   * - **RETURN** — rewinds to a previous node (`targetNodeId` required).
   * - **REDIRECT** — jumps to any node (`targetNodeId` required).
   *
   * An `ApprovalAction` record is persisted for audit trail.
   */
  async processAction(
    userId: string,
    approvalId: string,
    dto: ApprovalActionDto,
  ) {
    // 1. Load approval with template nodes
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        template: {
          include: {
            nodes: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!approval || approval.deletedAt) {
      throw new NotFoundException('Approval not found');
    }

    // 2. Validate status
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Cannot process action on approval with status "${approval.status}"`,
      );
    }

    const nodes = approval.template?.nodes ?? [];
    if (nodes.length === 0) {
      throw new BadRequestException('Approval template has no nodes configured');
    }

    const currentSortOrder = approval.currentSortOrder;
    if (currentSortOrder == null) {
      throw new BadRequestException('Approval has no current node');
    }

    const currentNode = nodes.find((n) => n.sortOrder === currentSortOrder);
    if (!currentNode) {
      throw new BadRequestException(
        `Current node (sortOrder=${currentSortOrder}) not found in template`,
      );
    }

    // 3. Determine new state based on action type
    const { action, comment, targetNodeId } = dto;

    let newStatus: ApprovalStatus;
    let newSortOrder: number | null;

    switch (action) {
      case ApprovalActionType.APPROVE: {
        const nextNode = nodes.find((n) => n.sortOrder > currentSortOrder);
        if (nextNode) {
          newSortOrder = nextNode.sortOrder;
          newStatus = ApprovalStatus.PENDING;
        } else {
          // Last node — finalize
          newSortOrder = null;
          newStatus = ApprovalStatus.APPROVED;
        }
        break;
      }

      case ApprovalActionType.REJECT: {
        newSortOrder = null;
        newStatus = ApprovalStatus.REJECTED;
        break;
      }

      case ApprovalActionType.RETURN: {
        if (!targetNodeId) {
          throw new BadRequestException('targetNodeId is required for return action');
        }
        const targetNode = nodes.find((n) => n.id === targetNodeId);
        if (!targetNode) {
          throw new BadRequestException('Target node not found in template');
        }
        if (targetNode.sortOrder >= currentSortOrder) {
          throw new BadRequestException(
            'Cannot return to a node at or after the current node',
          );
        }
        newSortOrder = targetNode.sortOrder;
        newStatus = ApprovalStatus.PENDING;
        break;
      }

      case ApprovalActionType.REDIRECT: {
        if (!targetNodeId) {
          throw new BadRequestException('targetNodeId is required for redirect action');
        }
        const targetNode = nodes.find((n) => n.id === targetNodeId);
        if (!targetNode) {
          throw new BadRequestException('Target node not found in template');
        }
        if (targetNode.sortOrder === currentSortOrder) {
          throw new BadRequestException('Cannot redirect to the current node');
        }
        newSortOrder = targetNode.sortOrder;
        newStatus = ApprovalStatus.PENDING;
        break;
      }

      default:
        throw new BadRequestException(`Unknown action: ${action}`);
    }

    // 4. Persist: update approval + record action (atomic transaction)
    const [updated] = await this.prisma.$transaction([
      this.prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: newStatus,
          currentSortOrder: newSortOrder,
        },
      }),
      this.prisma.approvalAction.create({
        data: {
          approvalId,
          nodeId: currentNode.id,
          action: ACTION_VALUE_MAP[action],
          comment: comment ?? null,
          processorId: userId,
        },
      }),
    ]);

    this.logger.log(
      `Approval ${approvalId}: action=${action} by user ${userId}, newStatus=${newStatus}`,
    );

    return updated;
  }

  /**
   * Return the full action history for an approval.
   */
  async getActionHistory(approvalId: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      select: { id: true, deletedAt: true },
    });

    if (!approval || approval.deletedAt) {
      throw new NotFoundException('Approval not found');
    }

    return this.prisma.approvalAction.findMany({
      where: { approvalId },
      include: {
        node: { select: { id: true, name: true, sortOrder: true } },
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
    });
  }
}
