/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by stopping requests when a service is unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * Example:
 * ```typescript
 * const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
 * const result = await breaker.execute(async () => {
 *   return await spawnInstance(versionId);
 * });
 * ```
 */

/**
 * Circuit breaker state
 */
type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;

  /** Number of successful requests before fully closing */
  successThreshold: number;

  /** Duration to wait before trying half-open (milliseconds) */
  timeoutMs: number;

  /** Optional name for logging */
  name?: string;
}

/**
 * Preset configurations
 */
export const INSTANCE_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  timeoutMs: 30000, // 30 seconds
  name: 'instance',
};

export const DB_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 10000, // 10 seconds
  name: 'database',
};

export const SOCKET_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 4,
  successThreshold: 2,
  timeoutMs: 15000, // 15 seconds
  name: 'socket',
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const configName = this.config.name || 'breaker';

    // Check if circuit should transition
    if (this.state === 'OPEN') {
      const now = Date.now();
      const timeSinceLastFailure = now - (this.lastFailureTime || now);

      if (timeSinceLastFailure > this.config.timeoutMs) {
        console.error(`[CircuitBreaker] ${configName} transitioning to HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Retry in ${this.config.timeoutMs - timeSinceLastFailure}ms`
        );
      }
    }

    // Execute operation
    try {
      const result = await operation();

      // Success
      if (this.state === 'CLOSED') {
        this.failureCount = 0;
      } else if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          console.error(`[CircuitBreaker] ${configName} transitioning to CLOSED`);
          this.state = 'CLOSED';
          this.failureCount = 0;
          this.successCount = 0;
        }
      }

      return result;
    } catch (error) {
      // Failure
      this.lastFailureTime = Date.now();

      if (this.state === 'HALF_OPEN') {
        // Immediately open if half-open fails
        console.error(`[CircuitBreaker] ${configName} transitioning to OPEN (half-open failed)`);
        this.state = 'OPEN';
        this.successCount = 0;
        throw error;
      }

      this.failureCount++;

      if (this.failureCount >= this.config.failureThreshold) {
        console.error(
          `[CircuitBreaker] ${configName} transitioning to OPEN (${this.failureCount} failures)`
        );
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get status for debugging
   */
  getStatus(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Create a circuit breaker for a component
 */
export function createCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreaker(config);
}
