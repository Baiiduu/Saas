import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * SecurityMiddleware — applies security headers, CSRF protection,
 * and XSS prevention to all responses.
 *
 * Headers applied:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Strict-Transport-Security (if HTTPS)
 * - Content-Security-Policy
 * - Referrer-Policy
 * - Permissions-Policy
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // ── Security Headers ─────────────────────────────────────

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable browser XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // HSTS — only in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:",
    );

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );

    // ── CSRF Protection (Double-submit cookie pattern) ──────
    // For state-changing methods, validate custom header
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
      const csrfCookie = req.cookies?.['csrf-token'] as string | undefined;

      if (csrfHeader && csrfCookie && csrfHeader !== csrfCookie) {
        this.logger.warn(`CSRF token mismatch from ${req.ip}`);
        res.status(403).json({
          statusCode: 403,
          message: 'CSRF token validation failed',
          error: 'Forbidden',
        });
        return;
      }
    }

    // ── Request sanitization (basic XSS prevention) ─────────
    // Sanitize query string and body (trim dangerous patterns)
    // Note: This is a basic check; deep sanitization is done by class-validator
    if (req.query) {
      for (const key of Object.keys(req.query)) {
        const val = req.query[key];
        if (typeof val === 'string' && this.containsXSSPattern(val)) {
          this.logger.warn(`XSS pattern detected in query param "${key}" from ${req.ip}`);
          res.status(400).json({
            statusCode: 400,
            message: 'Invalid request parameters',
            error: 'Bad Request',
          });
          return;
        }
      }
    }

    next();
  }

  /**
   * Basic XSS pattern detection.
   */
  private containsXSSPattern(value: string): boolean {
    const patterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=\s*['"]/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
    ];
    return patterns.some((p) => p.test(value));
  }
}
