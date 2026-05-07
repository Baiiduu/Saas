import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Approval Timeout Reminder Service.
 *
 * In production, this would be driven by a Bull queue cron job that
 * periodically checks for approvals stuck in PENDING past a configurable
 * timeout and sends reminders to the current approver.
 *
 * For V2, we provide a simplified placeholder that checks and logs
 * pending approvals.
 */
@Injectable()
export class ApprovalTimeoutService {
  private readonly logger = new Logger(ApprovalTimeoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check for timed-out approvals and log reminders.
   * In production, this would be called by a Bull cron job.
   *
   * @param timeoutHours Number of hours after which a pending approval is considered timed out.
   */
  async checkTimeouts(timeoutHours = 48): Promise<{ timedOut: number; reminders: Array<{ approvalId: string; approverInfo: string }> }> {
    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);

    const pendingApprovals = await this.prisma.approval.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      include: {
        template: {
          select: { name: true },
        },
        creator: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    if (pendingApprovals.length > 0) {
      this.logger.log(
        `[TIMEOUT REMINDER] Found ${pendingApprovals.length} timed-out approvals (timeout: ${timeoutHours}h)`,
      );

      for (const approval of pendingApprovals) {
        this.logger.log(
          `  → Approval "${approval.id}" (${approval.template?.name}) created by ${approval.creator.displayName} ` +
          `on ${approval.createdAt.toISOString()} — REMINDER SENT to approver`,
        );
      }
    } else {
      this.logger.log('[TIMEOUT REMINDER] No timed-out approvals found');
    }

    return {
      timedOut: pendingApprovals.length,
      reminders: pendingApprovals.map((a) => ({
        approvalId: a.id,
        approverInfo: `${a.creator.displayName} (${a.creator.email})`,
      })),
    };
  }
}
