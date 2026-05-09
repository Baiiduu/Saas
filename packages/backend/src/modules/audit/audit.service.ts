import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Allowed sort fields for audit log queries.
 */
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'action',
  'resourceType',
  'userId',
];

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  format?: 'csv' | 'json';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Append ──────────────────────────────────────────────────

  /**
   * Append a new audit log entry. This is append-only — no UPDATE or DELETE.
   * Called internally by the audit interceptor or directly when needed.
   */
  async append(data: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    detail?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;
  }) {
    const log = await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        detail: data.detail ?? undefined,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        tenantId: data.tenantId ?? '',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Audit log: ${data.action} on ${data.resourceType}/${data.resourceId}`);
    return log;
  }

  // ── Query ───────────────────────────────────────────────────

  /**
   * Query audit logs with filters and pagination.
   */
  async query(filter: AuditLogFilter) {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      tenantId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filter;

    const normalizedPage = this.normalizePositiveInt(page, 1);
    const normalizedLimit = this.normalizePositiveInt(limit, 20);

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (tenantId) where.tenantId = tenantId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const field = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (normalizedPage - 1) * normalizedLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { [field]: order },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  // ── Export ──────────────────────────────────────────────────

  /**
   * Export audit logs matching the filter to an array of plain objects.
   * Suitable for CSV or JSON serialization by the caller.
   */
  async export(filter: AuditLogFilter): Promise<{
    format: 'csv' | 'json';
    data: any[];
  }> {
    const format = filter.format === 'csv' ? 'csv' : 'json';

    const where: any = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.resourceType) where.resourceType = filter.resourceType;
    if (filter.resourceId) where.resourceId = filter.resourceId;
    if (filter.tenantId) where.tenantId = filter.tenantId;

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.createdAt.lte = new Date(filter.dateTo);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    // Flatten for export
    const data = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      userId: log.userId,
      userEmail: log.user?.email ?? '',
      userDisplayName: log.user?.displayName ?? '',
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      detail: log.detail ? JSON.stringify(log.detail) : '',
      ipAddress: log.ipAddress ?? '',
      userAgent: log.userAgent ?? '',
      tenantId: log.tenantId,
    }));

    this.logger.log(`Audit log export: ${data.length} records (${format})`);
    return { format, data };
  }

  private normalizePositiveInt(value: number | string | undefined, fallback: number): number {
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
    if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
