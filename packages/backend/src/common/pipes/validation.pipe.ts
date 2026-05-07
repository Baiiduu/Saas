import {
  Injectable,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

/**
 * Application-wide validation pipe.
 *
 * Wraps NestJS built-in ValidationPipe with opinionated defaults:
 * - whitelist: strip properties without decorators
 * - forbidNonWhitelisted: throw when unknown properties are present
 * - transform: automatically transform payloads to DTO instances
 * - enableImplicitConversion: convert query params to appropriate types
 */
@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  }
}
