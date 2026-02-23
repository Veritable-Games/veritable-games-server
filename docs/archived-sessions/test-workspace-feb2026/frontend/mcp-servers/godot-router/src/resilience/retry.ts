/**
 * Retry Logic with Exponential Backoff
 *
 * Provides configurable retry logic for transient failures.
 * Uses exponential backoff to prevent hammering resources.
 *
 * Example:
 * ```typescript
 * const result = await withRetry(
 *   async () => dbPool.getConnection('content'),
 *   DB_RETRY_CONFIG
 * );
 * ```
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Initial backoff delay in milliseconds */
  initialDelayMs: number;

  /** Maximum backoff delay in milliseconds */
  maxDelayMs: number;

  /** Backoff multiplier (delay *= multiplier each attempt) */
  backoffMultiplier: number;

  /** Optional jitter to prevent thundering herd */
  jitterMs?: number;

  /** Function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;

  /** Optional name for logging */
  name?: string;
}

/**
 * Preset configurations
 */
export const DB_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitterMs: 50,
  isRetryable: error => {
    const message = error.message.toLowerCase();
    // Retry on connection errors, not on logic errors
    return (
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('pool')
    );
  },
  name: 'database',
};

export const SOCKET_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterMs: 100,
  isRetryable: error => {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('timeout') ||
      message.includes('socket') ||
      message.includes('connection')
    );
  },
  name: 'socket',
};

export const SPAWN_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  initialDelayMs: 500,
  maxDelayMs: 3000,
  backoffMultiplier: 2,
  jitterMs: 100,
  isRetryable: error => {
    const message = error.message.toLowerCase();
    return (
      message.includes('socket not ready') ||
      message.includes('eaddrinuse') ||
      message.includes('timeout') ||
      message.includes('spawn')
    );
  },
  name: 'spawn',
};

/**
 * Retry with exponential backoff
 *
 * @param operation The async operation to retry
 * @param config Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(operation: () => Promise<T>, config: RetryConfig): Promise<T> {
  let lastError: Error | null = null;
  const configName = config.name || 'operation';

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check if error is retryable
      const isRetryable = config.isRetryable ? config.isRetryable(err) : true;

      if (!isRetryable || attempt === config.maxAttempts) {
        console.error(
          `[Retry] ${configName} failed (attempt ${attempt}/${config.maxAttempts}): ${err.message}`
        );
        throw err;
      }

      // Calculate backoff delay
      const baseDelay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
      const delayMs = baseDelay + jitter;

      console.error(
        `[Retry] ${configName} attempt ${attempt}/${config.maxAttempts} failed, retrying in ${Math.round(delayMs)}ms: ${err.message}`
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error(`Operation failed after ${config.maxAttempts} attempts`);
}
