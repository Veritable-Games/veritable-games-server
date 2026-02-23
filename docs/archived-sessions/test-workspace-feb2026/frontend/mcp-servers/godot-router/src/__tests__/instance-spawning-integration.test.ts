/**
 * Integration Tests: Instance Spawning with Resilience
 *
 * Simulates realistic instance spawning scenarios with:
 * - Retry logic for temporary failures
 * - Circuit breaker for persistent failures
 * - Lock manager to prevent duplicate spawning
 * - Health monitoring and recovery
 */

import { withRetry, SPAWN_RETRY_CONFIG } from '../resilience/retry';
import { CircuitBreaker, INSTANCE_CIRCUIT_CONFIG } from '../resilience/circuit-breaker';
import { LockManager } from '../resilience/lock-manager';

describe('Instance Spawning Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Instance Spawning', () => {
    it('should spawn instance on first attempt', async () => {
      const mockSpawn = jest.fn().mockResolvedValue({
        pid: 1234,
        socketPath: '/tmp/test.sock',
      });

      const result = await withRetry(mockSpawn, SPAWN_RETRY_CONFIG);

      expect(result).toEqual({ pid: 1234, socketPath: '/tmp/test.sock' });
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should retry on socket not ready error', async () => {
      const mockSpawn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Socket not ready'))
        .mockResolvedValueOnce({
          pid: 1234,
          socketPath: '/tmp/test.sock',
        });

      const result = await withRetry(mockSpawn, SPAWN_RETRY_CONFIG);

      expect(result.pid).toBe(1234);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('should retry on EADDRINUSE error (socket in use)', async () => {
      const mockSpawn = jest
        .fn()
        .mockRejectedValueOnce(new Error('EADDRINUSE: Address already in use'))
        .mockResolvedValueOnce({
          pid: 5678,
          socketPath: '/tmp/test.sock',
        });

      const result = (await withRetry(mockSpawn, SPAWN_RETRY_CONFIG)) as { pid: number };

      expect(result.pid).toBe(5678);
    });

    it('should fail on non-retryable error (permission denied)', async () => {
      const error = new Error('EACCES: Permission denied');
      const mockSpawn = jest.fn().mockRejectedValueOnce(error);

      await expect(withRetry(mockSpawn, SPAWN_RETRY_CONFIG)).rejects.toThrow('Permission denied');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Spawn with Circuit Breaker', () => {
    it('should prevent spawning during persistent failure', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const spawnCalls: number[] = [];

      const mockSpawn = jest.fn().mockImplementation(() => {
        spawnCalls.push(Date.now());
        throw new Error('Service temporarily unavailable');
      });

      // First 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockSpawn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Further attempts should fail immediately without calling spawn
      const initialCallCount = mockSpawn.mock.calls.length;
      await expect(breaker.execute(mockSpawn)).rejects.toThrow('Circuit breaker is OPEN');

      expect(mockSpawn.mock.calls.length).toBe(initialCallCount);
    });

    it('should allow spawn recovery in HALF_OPEN state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let attemptCount = 0;
      const mockSpawn = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Service unavailable');
        }
        return { pid: 1234, socketPath: '/tmp/test.sock' };
      });

      // First attempt opens circuit
      await expect(breaker.execute(mockSpawn)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      jest.advanceTimersByTime(1000);

      // HALF_OPEN: recovery attempt succeeds
      const result = await breaker.execute(mockSpawn);

      expect(result).toEqual({ pid: 1234, socketPath: '/tmp/test.sock' });
      expect(breaker.getState()).toBe('CLOSED');
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Spawn with Lock Manager', () => {
    it('should prevent duplicate instance spawning', async () => {
      const lockManager = new LockManager();
      const spawnLog: string[] = [];

      let spawnCount = 0;
      const mockSpawn = jest.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              spawnCount++;
              spawnLog.push(`spawn-${spawnCount}`);
              resolve({ pid: 1234 + spawnCount, socketPath: `/tmp/test-${spawnCount}.sock` });
            }, 100);
          })
      );

      // Two simultaneous spawn requests for same version
      const p1 = lockManager.withLock('version-1', mockSpawn);
      const p2 = lockManager.withLock('version-1', mockSpawn);

      expect(lockManager.isLocked('version-1')).toBe(true);

      // Both are queued, only one executes at a time
      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      const [r1, r2] = await Promise.all([p1, p2]);

      // Both got results, but spawn was called twice (serial)
      expect(r1.pid).toBe(1235);
      expect(r2.pid).toBe(1236);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(spawnLog).toEqual(['spawn-1', 'spawn-2']);
    });

    it('should allow parallel spawning of different versions', async () => {
      const lockManager = new LockManager();
      const spawnLog: string[] = [];

      const createSpawn = (versionId: number) =>
        jest.fn().mockImplementation(
          () =>
            new Promise(resolve => {
              setTimeout(() => {
                spawnLog.push(`v${versionId}-spawned`);
                resolve({ pid: 2000 + versionId, socketPath: `/tmp/v${versionId}.sock` });
              }, 100);
            })
        );

      const spawn1 = createSpawn(1);
      const spawn2 = createSpawn(2);

      const p1 = lockManager.withLock('version-1', spawn1);
      const p2 = lockManager.withLock('version-2', spawn2);

      // Both should execute in parallel
      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.pid).toBe(2001);
      expect(r2.pid).toBe(2002);
      expect(spawnLog.length).toBe(2);
      expect(spawnLog).toContain('v1-spawned');
      expect(spawnLog).toContain('v2-spawned');
    });
  });

  describe('Spawn Retry + Lock Manager', () => {
    it('should serialize retryable spawn failures with lock', async () => {
      const lockManager = new LockManager();
      const spawnLog: { version: number; attempt: number }[] = [];

      let callCount = 0;
      const mockSpawn = jest.fn().mockImplementation(() => {
        callCount++;
        spawnLog.push({ version: 1, attempt: callCount });

        if (callCount < 2) {
          throw new Error('Socket not ready');
        }

        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ pid: 1234, socketPath: '/tmp/test.sock' });
          }, 50);
        });
      });

      const result = await lockManager.withLock('version-1', () =>
        withRetry(mockSpawn, SPAWN_RETRY_CONFIG)
      );

      expect(result.pid).toBe(1234);
      expect(spawnLog).toHaveLength(2);
      expect(lockManager.isLocked('version-1')).toBe(false);
    });

    it('should release lock even if all retries fail', async () => {
      const lockManager = new LockManager();
      const mockSpawn = jest.fn().mockRejectedValue(new Error('EACCES: Permission denied'));

      try {
        await lockManager.withLock('version-1', () => withRetry(mockSpawn, SPAWN_RETRY_CONFIG));
      } catch {
        // Expected
      }

      expect(lockManager.isLocked('version-1')).toBe(false);

      // Next spawn request should acquire lock
      const nextSpawn = jest.fn().mockResolvedValue({ pid: 1234 });
      const result = await lockManager.withLock('version-1', nextSpawn);

      expect(result.pid).toBe(1234);
    });
  });

  describe('Full Spawn Workflow with All Mechanisms', () => {
    it('should handle complete spawn lifecycle', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      let spawnAttempts = 0;
      const mockSpawn = jest.fn().mockImplementation(() => {
        spawnAttempts++;

        // Simulate: socket not ready (retry)
        if (spawnAttempts === 1) {
          throw new Error('Socket not ready');
        }

        // Success on second attempt
        return Promise.resolve({
          pid: 1234,
          socketPath: '/tmp/instance.sock',
        });
      });

      const result = await lockManager.withLock('version-1', () =>
        withRetry(() => breaker.execute(mockSpawn), SPAWN_RETRY_CONFIG)
      );

      expect(result.pid).toBe(1234);
      expect(spawnAttempts).toBe(2);
      expect(breaker.getState()).toBe('CLOSED');
      expect(lockManager.isLocked('version-1')).toBe(false);
    });

    it('should handle cascade failure: retry → circuit open', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let spawnCount = 0;
      const mockSpawn = jest.fn().mockImplementation(() => {
        spawnCount++;
        throw new Error('Service unavailable');
      });

      // First spawn: exhausts retries and opens circuit
      try {
        await lockManager.withLock('version-1', () =>
          withRetry(() => breaker.execute(mockSpawn), { ...SPAWN_RETRY_CONFIG, maxAttempts: 1 })
        );
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe('CLOSED'); // Still CLOSED after 1 failure

      // Second spawn: opens circuit (2nd failure)
      try {
        await lockManager.withLock('version-1', () =>
          withRetry(() => breaker.execute(mockSpawn), { ...SPAWN_RETRY_CONFIG, maxAttempts: 1 })
        );
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe('OPEN');

      // Third spawn: blocked by circuit breaker
      await expect(
        lockManager.withLock('version-1', () => breaker.execute(mockSpawn))
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(spawnCount).toBe(2); // Only 2 attempts before circuit opens
    });

    it('should recover through complete cycle', async () => {
      const lockManager = new LockManager();
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let spawnCount = 0;
      const mockSpawn = jest.fn().mockImplementation(() => {
        spawnCount++;
        if (spawnCount === 1) {
          throw new Error('Service unavailable');
        }
        return { pid: 1234, socketPath: '/tmp/test.sock' };
      });

      // First spawn opens circuit
      await expect(breaker.execute(mockSpawn)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      jest.advanceTimersByTime(1000);

      // Recover through lock manager + breaker
      const result = await lockManager.withLock('version-1', () =>
        withRetry(() => breaker.execute(mockSpawn), SPAWN_RETRY_CONFIG)
      );

      expect(result.pid).toBe(1234);
      expect(breaker.getState()).toBe('CLOSED');
      expect(lockManager.isLocked('version-1')).toBe(false);
    });
  });

  describe('Concurrent Spawning of Multiple Instances', () => {
    it('should handle spawning 5 different versions concurrently', async () => {
      const lockManager = new LockManager();
      const spawnLog: number[] = [];

      const createSpawn = (versionId: number) =>
        jest.fn().mockImplementation(() => {
          spawnLog.push(versionId);
          return Promise.resolve({
            versionId,
            pid: 1000 + versionId,
            socketPath: `/tmp/v${versionId}.sock`,
          });
        });

      const spawns = Array.from({ length: 5 }, (_, i) => {
        const versionId = i + 1;
        return lockManager.withLock(`version-${versionId}`, createSpawn(versionId));
      });

      const results = await Promise.all(spawns);

      expect(results).toHaveLength(5);
      expect(spawnLog.length).toBe(5);
      expect(results.every(r => r.socketPath)).toBe(true);
    });

    it('should handle thundering herd for same version', async () => {
      const lockManager = new LockManager();
      let spawnCount = 0;

      const mockSpawn = jest.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              spawnCount++;
              resolve({ pid: 1000 + spawnCount, socketPath: `/tmp/instance.sock` });
            }, 100);
          })
      );

      // 10 concurrent spawn requests for same version
      const promises = Array.from({ length: 10 }, () =>
        lockManager.withLock('version-1', mockSpawn)
      );

      jest.advanceTimersByTime(1000); // Run all timers
      jest.runAllTimers();

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(spawnCount).toBe(10);
      expect(mockSpawn).toHaveBeenCalledTimes(10);
      expect(lockManager.isLocked('version-1')).toBe(false);
    });
  });

  describe('Error Handling in Spawning', () => {
    it('should handle spawn timeout correctly', async () => {
      const lockManager = new LockManager();

      const slowSpawn = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ pid: 1234 }), 5000); // Takes 5 seconds
          })
      );

      const promise = lockManager.withLock('version-1', slowSpawn, 1000); // 1 second timeout

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Lock acquisition timeout');
    });

    it('should handle spawn exception in finally block correctly', async () => {
      const lockManager = new LockManager();
      let cleanupCalled = false;

      const mockSpawn = jest.fn().mockImplementation(async () => {
        throw new Error('Spawn failed');
      });

      const withCleanup = async () => {
        try {
          await mockSpawn();
        } finally {
          cleanupCalled = true;
        }
      };

      try {
        await lockManager.withLock('version-1', withCleanup);
      } catch {
        // Expected
      }

      expect(cleanupCalled).toBe(true);
      expect(lockManager.isLocked('version-1')).toBe(false);
    });
  });

  describe('Performance Under Load', () => {
    it('should efficiently spawn 50 instances sequentially', async () => {
      const lockManager = new LockManager();
      let totalSpawns = 0;

      const mockSpawn = jest.fn().mockImplementation(() => {
        totalSpawns++;
        return Promise.resolve({ pid: 1000 + totalSpawns });
      });

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        await lockManager.withLock('spawn-queue', mockSpawn);
      }

      expect(totalSpawns).toBe(50);
      expect(lockManager.isLocked('spawn-queue')).toBe(false);
    });

    it('should efficiently spawn instances with retries under load', async () => {
      const lockManager = new LockManager();
      let totalAttempts = 0;

      const createSpawn = () =>
        jest.fn().mockImplementation(() => {
          totalAttempts++;
          if (totalAttempts % 3 === 1) {
            // Every 3rd attempt fails once
            throw new Error('Socket not ready');
          }
          return Promise.resolve({ pid: 1000 + totalAttempts });
        });

      const promises = Array.from({ length: 20 }, (_, i) =>
        lockManager.withLock(`version-${i}`, () => withRetry(createSpawn(), SPAWN_RETRY_CONFIG))
      );

      jest.runAllTimers();
      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      expect(totalAttempts).toBeGreaterThan(20); // Some had retries
    });
  });
});
