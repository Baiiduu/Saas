import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import * as crypto from 'crypto';

interface ErrorResponse {
  code: number;
  message: string;
  details?: any;
  requestId: string;
}

/**
 * Global exception filter — catches all exceptions and returns
 * a unified JSON response:
 *
 *   { code: <httpStatus>, message: <string>, details: <any>, requestId: <uuid> }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = crypto.randomUUID();

    let status: number;
    let message: string;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        // NestJS class-validator errors return { message: [string], error: string, statusCode: number }
        message = Array.isArray(resp.message)
          ? resp.message[0] || exception.message
          : resp.message || exception.message;
        details = Array.isArray(resp.message) ? resp.message : resp.details;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      details =
        process.env.NODE_ENV === 'development'
          ? exception.message
          : undefined;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Log server errors for debugging
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const errorResponse: ErrorResponse = {
      code: status,
      message,
      details,
      requestId,
    };

    response.status(status).json(errorResponse);
  }
}
