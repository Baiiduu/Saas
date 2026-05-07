/**
 * Idempotency helper — in-memory idempotency key store.
 *
 * ⚠ SKELETON IMPLEMENTATION (V0):
 * Uses an in-memory Map which is lost on restart and does not
 * scale across multiple instances. Full implementation with
 * Redis (using the Redis config) will be done in V1.
 *
 * @example
 * ```ts
 * const key = IdempotencyHelper.generateKey('POST', '/api/v1/tasks', body);
 * const existing = await IdempotencyHelper.get(key);
 * if (existing) return existing;
 * // ... process request ...
 * await IdempotencyHelper.set(key, result, 3600000);
 * return result;
 * ```
 */
export class IdempotencyHelper {
  private static store = new Map<
    string,
    { response: any; expiresAt: number }
  >();

  /**
   * Retrieve a cached idempotent response.
   * Returns `null` if the key does not exist or has expired.
   */
  static async get(key: string): Promise<any | null> {
    const entry = IdempotencyHelper.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      IdempotencyHelper.store.delete(key);
      return null;
    }

    return entry.response;
  }

  /**
   * Store an idempotent response with a TTL (default 1 hour).
   */
  static async set(
    key: string,
    response: any,
    ttlMs: number = 3600_000,
  ): Promise<void> {
    IdempotencyHelper.store.set(key, {
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Generate a deterministic key from the request method, path,
   * and body payload.
   */
  static generateKey(method: string, path: string, body: any): string {
    return `${method}:${path}:${JSON.stringify(body)}`;
  }
}
