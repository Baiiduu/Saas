import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * AuditLogInterceptor — automatically writes an audit log entry
 * after a route handler marked with @AuditLog() completes successfully.
 *
 * The interceptor reads metadata set by the @AuditLog() decorator
 * and delegates to AuditService.append().
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    // If no @AuditLog() decorator, skip
    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const userId = user?.sub || user?.id || 'unknown';
    const tenantId = (request as any).tenantId || '';
    const ipAddress = request.ip || request.socket?.remoteAddress || '';
    const userAgent = request.headers?.['user-agent'] || '';

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget audit logging (non-blocking)
          this.auditService
            .append({
              userId,
              action: auditOptions.action,
              resourceType: auditOptions.resourceType,
              resourceId: this.extractResourceId(request, auditOptions),
              detail: auditOptions.details ? (request.body as any) : undefined,
              ipAddress,
              userAgent: userAgent as string,
              tenantId,
            })
            .catch((err) => {
              this.logger.error('Failed to write audit log', err);
            });
        },
      }),
    );
  }

  /**
   * Extract the resource ID from request params.
   * Convention: the param name ends with the resource type + 'Id'.
   * E.g., 'taskId', 'documentId', 'approvalId'.
   */
  private extractResourceId(
    request: Request,
    options: AuditLogOptions,
  ): string {
    // Try common patterns
    const paramName = `${options.resourceType}Id`;
    if ((request.params as any)[paramName]) {
      return (request.params as any)[paramName];
    }
    // Fallback: look for 'id' param
    if ((request.params as any).id) {
      return (request.params as any).id;
    }
    return 'unknown';
  }
}
