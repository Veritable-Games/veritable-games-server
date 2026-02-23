/**
 * Lock Manager
 *
 * Prevents concurrent execution of the same operation using named locks.
 * Useful for preventing duplicate instance spawning when multiple requests
 * arrive simultaneously for the same version.
 *
 * Example:
 * ```typescript
 * await lockManager.withLock('spawn-instance-123', async () => {
 *   return await spawnInstance(123);
 * }, 30000);
 * ```
 */

/**
 * Lock state
 */
interface Lock {
  /** Time when lock was acquired */
  acquiredAt: number;

  /** Resolve function for waiters */
  resolvers: Array<(value: void) => void>;

  /** Reject function for waiters */
  rejecters: Array<(reason: Error) => void>;
}

/**
 * Lock Manager implementation
 */
export class LockManager {
  private locks = new Map<string, Lock>();
  private readonly cleanupIntervalMs = 60000; // 1 minute

  constructor() {
    // Periodically clean up stale locks
    this.startCleanupTimer();
  }

  /**
   * Execute function with lock
   *
   * @param key Lock identifier
   * @param operation Operation to execute exclusively
   * @param timeoutMs Maximum time to hold lock (defaults to 30s)
   * @returns Result of operation
   * @throws Error if lock cannot be acquired or operation fails
   */
  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    // Acquire lock
    await this.acquire(key, timeoutMs);

    try {
      // Execute operation
      return await operation();
    } finally {
      // Always release lock
      this.release(key);
    }
  }

  /**
   * Acquire lock (wait if already held)
   */
  private async acquire(key: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (true) {
      // Check if lock is available
      if (!this.locks.has(key)) {
        // Acquire lock
        this.locks.set(key, {
          acquiredAt: Date.now(),
          resolvers: [],
          rejecters: [],
        });
        return;
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new Error(`Lock acquisition timeout for "${key}" after ${elapsed}ms`);
      }

      // Wait for lock to be released
      await this.waitForRelease(key, Math.max(100, timeoutMs - elapsed));
    }
  }

  /**
   * Release lock and notify waiters
   */
  private release(key: string): void {
    const lock = this.locks.get(key);
    if (!lock) {
      return;
    }

    // Notify all waiters
    const resolvers = lock.resolvers;
    this.locks.delete(key);

    // Resolve waiters asynchronously
    for (const resolver of resolvers) {
      setImmediate(() => resolver());
    }
  }

  /**
   * Wait for lock to be released
   */
  private waitForRelease(key: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const lock = this.locks.get(key);
      if (!lock) {
        resolve();
        return;
      }

      // Add to waiters
      lock.resolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });

      lock.rejecters.push(reason => {
        clearTimeout(timer);
        reject(reason);
      });

      // Timeout if lock not released
      const timer = setTimeout(() => {
        const idx = lock.resolvers.indexOf(resolve as any);
        if (idx >= 0) {
          lock.resolvers.splice(idx, 1);
        }

        reject(new Error(`Lock wait timeout for "${key}" after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Check if lock is held
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Get lock holder info (for debugging)
   */
  getLockInfo(key: string): { acquiredAt: number; ageMs: number } | null {
    const lock = this.locks.get(key);
    if (!lock) {
      return null;
    }

    return {
      acquiredAt: lock.acquiredAt,
      ageMs: Date.now() - lock.acquiredAt,
    };
  }

  /**
   * Start periodic cleanup of stale locks
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupStaleLocks();
    }, this.cleanupIntervalMs);
  }

  /**
   * Clean up locks that have exceeded their timeout
   */
  private cleanupStaleLocks(): void {
    const now = Date.now();
    const maxLockAgeMs = 5 * 60 * 1000; // 5 minutes

    let cleanedCount = 0;
    for (const [key, lock] of this.locks.entries()) {
      const age = now - lock.acquiredAt;
      if (age > maxLockAgeMs) {
        console.error(`[LockManager] Cleaning up stale lock "${key}" (age: ${age}ms)`);

        // Reject all waiters
        const error = new Error(`Lock "${key}" exceeded maximum age of ${maxLockAgeMs}ms`);
        for (const rejecter of lock.rejecters) {
          rejecter(error);
        }

        this.locks.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.error(`[LockManager] Cleaned up ${cleanedCount} stale locks`);
    }
  }

  /**
   * Get all locked keys (for debugging)
   */
  getLockedKeys(): Array<{ key: string; ageMs: number }> {
    const now = Date.now();
    return Array.from(this.locks.entries()).map(([key, lock]) => ({
      key,
      ageMs: now - lock.acquiredAt,
    }));
  }
}

/**
 * Global lock manager instance
 */
export const globalLockManager = new LockManager();
