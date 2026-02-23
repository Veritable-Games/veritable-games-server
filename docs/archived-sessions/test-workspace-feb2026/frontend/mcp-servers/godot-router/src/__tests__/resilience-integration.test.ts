/**
 * Integration Tests: Resilience Modules Working Together
 *
 * Tests retry, circuit breaker, and lock manager functioning as a cohesive system.
 */

import { withRetry, DB_RETRY_CONFIG, SOCKET_RETRY_CONFIG } from '../resilience/retry';
import {
  CircuitBreaker,
  INSTANCE_CIRCUIT_CONFIG,
  DB_CIRCUIT_CONFIG,
} from '../resilience/circuit-breaker';
import { LockManager } from '../resilience/lock-manager';

describe('Resilience Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Retry + Circuit Breaker Integration', () => {
    it('should protect operation with both retry and circuit breaker', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      let attemptCount = 0;

      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('ECONNREFUSED: Connection refused');
        }
        return 'success';
      };

      // First execution: retries succeed
      const result1 = await withRetry(() => breaker.execute(operation), DB_RETRY_CONFIG);

      expect(result1).toBe('success');
      expect(attemptCount).toBe(3); // 2 failures + 1 success
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should open circuit breaker after retry exhaustion', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 5000,
      });

      const mockOp = jest.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      // First withRetry exhausts retries and throws
      const config = { ...DB_RETRY_CONFIG, maxAttempts: 1 };

      try {
        await withRetry(() => breaker.execute(mockOp), config);
      } catch {
        // Expected
      }

      // Second withRetry exhausts retries again
      try {
        await withRetry(() => breaker.execute(mockOp), config);
      } catch {
        // Expected - breaker should be OPEN now
      }

      expect(breaker.getState()).toBe('OPEN');

      // Further attempts should fail immediately
      await expect(breaker.execute(mockOp)).rejects.toThrow('Circuit breaker is OPEN');
      expect(mockOp).toHaveBeenCalledTimes(2); // Only 2 attempts before opening
    });

    it('should recover through circuit breaker HALF_OPEN state after retries', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ECONNREFUSED');
        }
        return 'recovered';
      };

      const config = { ...DB_RETRY_CONFIG, maxAttempts: 1 };

      // First call opens circuit
      try {
        await withRetry(() => breaker.execute(operation), config);
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      jest.advanceTimersByTime(1000);

      // Next execution transitions to HALF_OPEN and succeeds
      const result = await withRetry(() => breaker.execute(operation), config);

      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('Lock Manager + Retry Integration', () => {
    it('should serialize retryable operations with lock manager', async () => {
      const lockManager = new LockManager();
      const executionLog: string[] = [];

      const createOperation = (name: string) => {
        let attempts = 0;
        return async () => {
          attempts++;
          executionLog.push(`${name}-attempt-${attempts}`);

          if (attempts < 2) {
            throw new Error('ETIMEDOUT: Connection timeout');
          }

          return `${name}-success`;
        };
      };

      const op1Promise = lockManager.withLock('resource', () =>
        withRetry(createOperation('op1'), { ...DB_RETRY_CONFIG, maxAttempts: 2 })
      );

      const op2Promise = lockManager.withLock('resource', () =>
        withRetry(createOperation('op2'), { ...DB_RETRY_CONFIG, maxAttempts: 2 })
      );

      // Both operations wait for lock
      jest.advanceTimersByTime(0);
      expect(executionLog).toContain('op1-attempt-1');

      // First operation retries
      jest.advanceTimersByTime(100); // Wait for retry delay
      expect(executionLog).toContain('op1-attempt-2');

      // Second operation starts after first completes
      jest.advanceTimersByTime(100);
      expect(executionLog).toContain('op2-attempt-1');

      jest.advanceTimersByTime(100);
      expect(executionLog).toContain('op2-attempt-2');

      const [result1, result2] = await Promise.all([op1Promise, op2Promise]);

      expect(result1).toBe('op1-success');
      expect(result2).toBe('op2-success');
      expect(lockManager.isLocked('resource')).toBe(false);
    });

    it('should allow parallel retries on different resources', async () => {
      const lockManager = new LockManager();
      const executionLog: string[] = [];

      const createOperation = (name: string) => {
        let attempts = 0;
        return async () => {
          attempts++;
          executionLog.push(`${name}-${attempts}`);

          if (attempts === 1) {
            throw new Error('ECONNREFUSED');
          }

          return `${name}-ok`;
        };
      };

      const config = { ...DB_RETRY_CONFIG, maxAttempts: 2 };

      const p1 = lockManager.withLock('res1', () => withRetry(createOperation('op1'), config));
      const p2 = lockManager.withLock('res2', () => withRetry(createOperation('op2'), config));

      // Both should start in parallel
      jest.advanceTimersByTime(0);
      expect(executionLog).toContain('op1-1');
      expect(executionLog).toContain('op2-1');

      // Both retry in parallel
      jest.advanceTimersByTime(100);
      expect(executionLog).toContain('op1-2');
      expect(executionLog).toContain('op2-2');

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe('op1-ok');
      expect(r2).toBe('op2-ok');
    });

    it('should preserve lock on retry failure', async () => {
      const lockManager = new LockManager();
      const mockOp = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await lockManager.withLock('resource', () => withRetry(mockOp, DB_RETRY_CONFIG));
      } catch {
        // Expected
      }

      // Lock should be released even though operation failed
      expect(lockManager.isLocked('resource')).toBe(false);

      // Next operation should acquire lock successfully
      const op2 = jest.fn().mockResolvedValue('success');
      const result = await lockManager.withLock('resource', op2);

      expect(result).toBe('success');
    });
  });

  describe('Lock Manager + Circuit Breaker Integration', () => {
    it('should serialize access while tracking circuit state', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Connection failed');
        }
        return 'recovered';
      };

      // First request opens circuit
      const p1 = lockManager.withLock('lock', () => breaker.execute(operation));

      jest.advanceTimersByTime(0);
      expect(breaker.getState()).toBe('CLOSED');

      await expect(p1).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Second request blocked by circuit, even before acquiring lock
      const p2 = lockManager.withLock('lock', () => breaker.execute(operation));
      expect(breaker.getState()).toBe('OPEN');

      // This will try to acquire lock, but circuit is still open
      await expect(p2).rejects.toThrow('Circuit breaker is OPEN');

      // Wait for circuit timeout
      jest.advanceTimersByTime(1000);

      // Third request acquires lock and transitions circuit
      const p3 = lockManager.withLock('lock', () => breaker.execute(operation));

      jest.advanceTimersByTime(0);
      const result = await p3;

      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should handle concurrent requests properly with all three mechanisms', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      let successCount = 0;
      const operation = async () => {
        successCount++;
        return `result-${successCount}`;
      };

      // Create 5 concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        lockManager.withLock('op', () => breaker.execute(operation))
      );

      jest.advanceTimersByTime(0);
      jest.runAllTimers();

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(successCount).toBe(5);
      expect(breaker.getState()).toBe('CLOSED');
      expect(lockManager.isLocked('op')).toBe(false);
    });
  });

  describe('Three-Way Integration: Retry + Circuit Breaker + Lock Manager', () => {
    it('should handle complex failure and recovery scenario', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 2000,
      });

      let callCount = 0;
      const operation = async () => {
        callCount++;

        // Fail first 3 times, then succeed
        if (callCount <= 3) {
          throw new Error('ECONNREFUSED');
        }

        return 'success';
      };

      // Request 1: Opens circuit after 2 failures
      const req1 = lockManager.withLock('op', () =>
        withRetry(() => breaker.execute(operation), { ...DB_RETRY_CONFIG, maxAttempts: 1 })
      );

      jest.advanceTimersByTime(0);
      try {
        await req1;
      } catch {
        // Expected: callCount = 1, breaker CLOSED
      }

      // Request 2: Opens circuit after 2 failures total
      const req2 = lockManager.withLock('op', () =>
        withRetry(() => breaker.execute(operation), { ...DB_RETRY_CONFIG, maxAttempts: 1 })
      );

      jest.advanceTimersByTime(0);
      try {
        await req2;
      } catch {
        // Expected: callCount = 2, breaker OPEN
      }

      expect(breaker.getState()).toBe('OPEN');

      // Request 3: Blocked by circuit immediately
      const req3 = lockManager.withLock('op', () => breaker.execute(operation));

      await expect(req3).rejects.toThrow('Circuit breaker is OPEN');

      // Wait for circuit timeout
      jest.advanceTimersByTime(2000);

      // Request 4: HALF_OPEN, calls operation (3rd call succeeds)
      const req4 = lockManager.withLock('op', () => breaker.execute(operation));

      jest.advanceTimersByTime(0);
      const result = await req4;

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
      expect(callCount).toBe(3);
    });

    it('should maintain isolation with multiple concurrent lock requests and circuit failures', async () => {
      const lockManager = new LockManager();
      const breaker1 = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const breaker2 = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      let op1Count = 0;
      let op2Count = 0;

      const op1 = async () => {
        op1Count++;
        if (op1Count < 2) throw new Error('fail');
        return 'op1-ok';
      };

      const op2 = async () => {
        op2Count++;
        if (op2Count < 2) throw new Error('fail');
        return 'op2-ok';
      };

      const config = { ...DB_RETRY_CONFIG, maxAttempts: 2 };

      // Request 1 & 2 target different locks and breakers
      const p1 = lockManager.withLock('lock1', () =>
        withRetry(() => breaker1.execute(op1), config)
      );

      const p2 = lockManager.withLock('lock2', () =>
        withRetry(() => breaker2.execute(op2), config)
      );

      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe('op1-ok');
      expect(r2).toBe('op2-ok');
      expect(breaker1.getState()).toBe('CLOSED');
      expect(breaker2.getState()).toBe('CLOSED');
    });
  });

  describe('Performance Under Stress', () => {
    it('should handle high concurrency with all resilience mechanisms', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      let totalExecutions = 0;
      const operation = async () => {
        totalExecutions++;
        return `result-${totalExecutions}`;
      };

      // 50 concurrent operations
      const promises = Array.from({ length: 50 }, (_, i) =>
        lockManager.withLock('op', () => breaker.execute(operation))
      );

      jest.runAllTimers();
      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(totalExecutions).toBe(50);
      expect(lockManager.getLockedKeys()).toHaveLength(0);
    });

    it('should handle many locks with retries efficiently', async () => {
      const lockManager = new LockManager();

      let executionCount = 0;
      const operation = async () => {
        executionCount++;
        return `ok-${executionCount}`;
      };

      // 20 different locks, 5 concurrent operations each
      const promises: Promise<any>[] = [];

      for (let lockIdx = 0; lockIdx < 20; lockIdx++) {
        for (let opIdx = 0; opIdx < 5; opIdx++) {
          promises.push(
            lockManager.withLock(`lock-${lockIdx}`, () =>
              withRetry(operation, { ...DB_RETRY_CONFIG, maxAttempts: 1 })
            )
          );
        }
      }

      jest.runAllTimers();
      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(executionCount).toBe(100);
      expect(lockManager.getLockedKeys()).toHaveLength(0);
    });

    it('should efficiently recover from circuit breaker opens at scale', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 500,
      });

      let callCount = 0;
      const operation = async () => {
        callCount++;
        // Fail first 3 times per cycle
        if (callCount % 5 <= 3 && callCount <= 15) {
          throw new Error('fail');
        }
        return `ok-${callCount}`;
      };

      // First batch: opens circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {
          // Expected
        }
      }
      expect(breaker.getState()).toBe('OPEN');

      // Wait for recovery
      jest.advanceTimersByTime(500);

      // Recovery batch
      for (let i = 0; i < 2; i++) {
        const result = await breaker.execute(operation);
        expect(result).toBeDefined();
      }
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('Error Propagation Through Layers', () => {
    it('should preserve error context through all layers', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      const customError = new Error('Custom database error: table not found');

      const operation = async () => {
        throw customError;
      };

      try {
        await lockManager.withLock('op', () =>
          withRetry(() => breaker.execute(operation), DB_RETRY_CONFIG)
        );
      } catch (error) {
        expect((error as Error).message).toContain('table not found');
      }
    });

    it('should handle timeout errors through all layers', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      const operation = jest.fn(async () => {
        throw new Error('ETIMEDOUT: Connection timeout');
      });

      // Lock should timeout waiting
      try {
        await lockManager.withLock('op', () =>
          withRetry(() => breaker.execute(operation), SOCKET_RETRY_CONFIG)
        );
      } catch (error) {
        expect((error as Error).message).toContain('ETIMEDOUT');
      }
    });
  });
});
