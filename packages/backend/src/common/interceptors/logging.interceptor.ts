import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.originalUrl || request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        const tenantId = (request as any).tenantId || '-';
        const userId = (request as any).user?.sub || (request as any).user?.id || '-';
        this.logger.log(
          `${method} ${url} ${duration}ms tenant=${tenantId} user=${userId}`,
        );
      }),
    );
  }
}
