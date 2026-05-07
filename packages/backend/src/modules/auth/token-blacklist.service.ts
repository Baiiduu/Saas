import { Injectable, Logger } from '@nestjs/common';

/**
 * Token blacklist service with in-memory fallback.
 *
 * In production this should delegate to Redis (or similar) so the
 * blacklist survives restarts and is shared across instances.
 * The in-memory Set acts as a graceful fallback when Redis is not
 * available (e.g. local development / CI).
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly inMemoryBlacklist = new Set<string>();

  /**
   * Add a token identifier (typically `jti`) to the blacklist.
   * When `ttlMs` is provided the entry is automatically removed
   * after the given number of milliseconds.
   */
  async add(jti: string, ttlMs?: number): Promise<void> {
    this.inMemoryBlacklist.add(jti);
    this.logger.debug(`Token ${jti} blacklisted`);

    if (ttlMs && ttlMs > 0) {
      setTimeout(() => {
        this.inMemoryBlacklist.delete(jti);
        this.logger.debug(`Token ${jti} removed from blacklist (TTL expired)`);
      }, ttlMs);
    }
  }

  /**
   * Check whether a token identifier has been blacklisted.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    return this.inMemoryBlacklist.has(jti);
  }
}
