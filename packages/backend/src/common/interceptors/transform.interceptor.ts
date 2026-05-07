import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // If the handler explicitly returned a response in our format,
        // use it as-is (e.g. for error-like scenarios from services).
        if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
          return data;
        }

        // Handle paginated results: { data: T[], meta: { ... } }
        // Unwrap to avoid nested response.data.data
        if (data && typeof data === 'object' && Array.isArray(data.data) && data.meta) {
          return {
            code: statusCode,
            message: 'success',
            data: data.data,
            meta: data.meta,
          };
        }

        // Extract meta if the returned data has a meta property
        const meta = data?.meta ?? undefined;
        if (meta) {
          // Remove meta from the data payload so it's not nested
          const { meta: _, ...cleanData } = data;
          return {
            code: statusCode,
            message: 'success',
            data: cleanData,
            meta,
          };
        }

        return {
          code: statusCode,
          message: 'success',
          data: data ?? null,
        };
      }),
    );
  }
}
