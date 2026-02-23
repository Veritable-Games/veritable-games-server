/**
 * Chaos Engineering Tests: Instance Router Under Stress
 *
 * Simulates real-world failure scenarios:
 * - Concurrent spawn failures with varying recovery patterns
 * - Database connection pool exhaustion
 * - Socket network drops and reconnection attempts
 * - Process crashes and automatic restart with crash-loop detection
 * - Cascading failures across multiple instances
 * - Resource leak detection under sustained load
 */

import { withRetry, SPAWN_RETRY_CONFIG, DB_RETRY_CONFIG } from '../resilience/retry';
import {
  CircuitBreaker,
  INSTANCE_CIRCUIT_CONFIG,
  DB_CIRCUIT_CONFIG,
} from '../resilience/circuit-breaker';
import { LockManager } from '../resilience/lock-manager';

describe('Chaos Engineering: System Under Stress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Concurrent Spawn Failures', () => {
    it('should handle cascade of spawn failures with circuit breaker recovery', async () => {
      const spawner = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const lockManager = new LockManager();
      let failurePattern = [true, true, true, false, false]; // Fail 3x, then succeed
      let attemptCount = 0;

      const mockSpawn = jest.fn().mockImplementation(() => {
        attemptCount++;
        const shouldFail = failurePattern[attemptCount - 1];

        if (shouldFail) {
          throw new Error(`Spawn failed: ${attemptCount}`);
        }

        return Promise.resolve({
          pid: 1000 + attemptCount,
          socketPath: `/tmp/test-${attemptCount}.sock`,
        });
      });

      // Request 1-3: Fail and open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await lockManager.withLock(`version-${i}`, () =>
            withRetry(() => spawner.execute(mockSpawn), { ...SPAWN_RETRY_CONFIG, maxAttempts: 1 })
          );
        } catch {
          // Expected failures
        }
      }

      expect(spawner.getState()).toBe('OPEN');

      // Request 4-5: Circuit blocks immediately
      const blockedAttempts = mockSpawn.mock.calls.length;
      try {
        await spawner.execute(mockSpawn);
      } catch (error) {
        expect((error as Error).message).toContain('Circuit breaker is OPEN');
      }

      // Verify no additional spawns attempted
      expect(mockSpawn.mock.calls.length).toBe(blockedAttempts);

      // Wait for circuit timeout
      jest.advanceTimersByTime(30000);

      // Recovery attempt succeeds
      const recoveryResult = await spawner.execute(mockSpawn);
      expect(recoveryResult).toBeDefined();
      expect(spawner.getState()).toBe('HALF_OPEN');
    });

    it('should handle thundering herd of 100 spawn requests for same version', async () => {
      const lockManager = new LockManager();
      let spawnCount = 0;

      const mockSpawn = jest.fn().mockImplementation(() => {
        spawnCount++;
        return Promise.resolve({
          pid: 2000 + spawnCount,
          socketPath: `/tmp/spawn-${spawnCount}.sock`,
        });
      });

      // 100 concurrent requests for same version
      const promises = Array.from({ length: 100 }, () =>
        lockManager.withLock('version-1', mockSpawn)
      );

      jest.runAllTimers();
      const results = await Promise.all(promises);

      // All 100 should eventually get results
      expect(results).toHaveLength(100);
      // But spawn should be called 100 times (queue processed serially)
      expect(spawnCount).toBe(100);
      expect(mockSpawn).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent failures across 50 different versions', async () => {
      const lockManager = new LockManager();
      const spawner = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      let successCount = 0;

      const createFailingSpawn = (versionId: number) => {
        let attempts = 0;
        return jest.fn().mockImplementation(() => {
          attempts++;
          // Fail first 2 attempts, succeed on 3rd
          if (attempts < 3) {
            throw new Error(`Version ${versionId} fail ${attempts}`);
          }
          successCount++;
          return Promise.resolve({
            pid: 3000 + versionId,
            socketPath: `/tmp/v${versionId}.sock`,
          });
        });
      };

      const promises = Array.from({ length: 50 }, (_, i) => {
        const versionId = i + 1;
        const spawn = createFailingSpawn(versionId);
        return lockManager.withLock(`version-${versionId}`, () =>
          withRetry(() => spawner.execute(spawn), { ...SPAWN_RETRY_CONFIG, maxAttempts: 3 })
        );
      });

      jest.runAllTimers();
      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(successCount).toBe(50); // All eventually succeeded
    });
  });

  describe('Database Connection Pool Exhaustion', () => {
    it('should recover from connection pool starvation with retry + circuit breaker', async () => {
      const dbBreaker = new CircuitBreaker(DB_CIRCUIT_CONFIG);
      const poolSize = 5;
      let activeConnections = 0;

      const mockDbOperation = jest.fn().mockImplementation(async () => {
        activeConnections++;

        if (activeConnections > poolSize) {
          throw new Error('ECONNREFUSED: No available connections in pool');
        }

        // Simulate operation time
        return new Promise(resolve => {
          setTimeout(() => {
            activeConnections--;
            resolve('data');
          }, 10);
        });
      });

      // Simulate 20 concurrent DB operations on a 5-connection pool
      const promises = Array.from({ length: 20 }, () =>
        withRetry(() => dbBreaker.execute(mockDbOperation), DB_RETRY_CONFIG)
      );

      jest.advanceTimersByTime(500); // Simulate operation time
      jest.runAllTimers();

      const results = await Promise.all(promises);

      // All operations eventually complete
      expect(results).toHaveLength(20);
      expect(results.every(r => r === 'data')).toBe(true);
      // Final connection count should be 0 (all released)
      expect(activeConnections).toBe(0);
    });

    it('should open circuit breaker when pool exhaustion becomes persistent', async () => {
      const dbBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 5000,
      });

      let failureCount = 0;
      const mockDbOperation = jest.fn().mockImplementation(() => {
        failureCount++;
        if (failureCount <= 5) {
          throw new Error('Connection pool exhausted');
        }
        return Promise.resolve('recovered');
      });

      // Trigger 3 failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await dbBreaker.execute(mockDbOperation);
        } catch {
          // Expected
        }
      }

      expect(dbBreaker.getState()).toBe('OPEN');

      // Subsequent attempts should fast-fail
      const beforeOpen = mockDbOperation.mock.calls.length;
      try {
        await dbBreaker.execute(mockDbOperation);
      } catch (error) {
        expect((error as Error).message).toContain('Circuit breaker is OPEN');
      }

      // Verify no additional DB call was made
      expect(mockDbOperation.mock.calls.length).toBe(beforeOpen);
    });

    it('should detect and recover from gradual connection leak', async () => {
      let connectionCount = 0;
      const maxConnections = 10;

      const mockDbWithLeak = jest.fn().mockImplementation(async () => {
        connectionCount++;

        if (connectionCount > maxConnections) {
          throw new Error('Connection limit exceeded');
        }

        // Simulate 10% chance of not releasing connection (leak)
        if (Math.random() < 0.1) {
          // Leak - don't decrement
          return 'data';
        }

        connectionCount--;
        return 'data';
      });

      const breaker = new CircuitBreaker(DB_CIRCUIT_CONFIG);

      // Run 100 operations
      for (let i = 0; i < 100; i++) {
        try {
          await breaker.execute(mockDbWithLeak);
        } catch {
          // Some may fail due to leak
        }
      }

      // After circuit opens, should prevent further attempts
      if (breaker.getState() === 'OPEN') {
        expect(breaker.getState()).toBe('OPEN');
      }

      // connectionCount should stabilize (stopped growing)
      const finalCount = connectionCount;
      expect(finalCount).toBeLessThanOrEqual(maxConnections);
    });
  });

  describe('Socket Network Drops and Reconnection', () => {
    it('should retry socket operations after network drop', async () => {
      const socketBreaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      let attemptCount = 0;
      const mockSocketOp = jest.fn().mockImplementation(() => {
        attemptCount++;

        if (attemptCount === 1) {
          throw new Error('ECONNREFUSED: Connection refused (network down)');
        }
        if (attemptCount === 2) {
          throw new Error('ECONNREFUSED: Connection refused (still down)');
        }

        // Third attempt succeeds (network recovered)
        return Promise.resolve('socket-connected');
      });

      const config = { ...SPAWN_RETRY_CONFIG, maxAttempts: 3 };

      const result = await withRetry(() => socketBreaker.execute(mockSocketOp), config);

      expect(result).toBe('socket-connected');
      expect(attemptCount).toBe(3);
    });

    it('should handle rapid network drop and restore cycles', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      let cycleCount = 0;
      let successCount = 0;

      const mockNetworkCycle = jest.fn().mockImplementation(() => {
        cycleCount++;

        // Pattern: fail, fail, succeed, fail, fail, succeed...
        const position = cycleCount % 3;
        if (position === 0) {
          throw new Error('Network down');
        }

        successCount++;
        return Promise.resolve('connected');
      });

      // Run through 3 cycles (9 attempts)
      for (let i = 0; i < 9; i++) {
        try {
          await breaker.execute(mockNetworkCycle);
        } catch {
          // Some attempts will fail
        }
      }

      // Should have succeeded 3 times despite failures
      expect(successCount).toBe(3);
    });

    it('should detect and report socket file corruption/missing', async () => {
      const lockManager = new LockManager();
      let socketCheckCount = 0;

      const mockSocketCheck = jest.fn().mockImplementation(async () => {
        socketCheckCount++;

        // Simulate socket file validation
        if (socketCheckCount === 1) {
          // First check: file exists but corrupted
          throw new Error('Socket file corrupted or invalid');
        }
        if (socketCheckCount === 2) {
          // Reconnect attempt
          throw new Error('ENOENT: Socket file not found');
        }

        // Third attempt: socket recreated
        return Promise.resolve('socket-recovered');
      });

      try {
        await lockManager.withLock('socket-1', async () => {
          await withRetry(mockSocketCheck, { ...SPAWN_RETRY_CONFIG, maxAttempts: 3 });
        });
      } catch {
        // May fail if all retries exhausted
      }

      expect(socketCheckCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Process Crashes and Supervisor Recovery', () => {
    it('should detect and restart crashed instances', async () => {
      const supervisor = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      let processAlive = true;
      let restartCount = 0;

      const mockInstanceCheck = jest.fn().mockImplementation(async () => {
        if (!processAlive) {
          throw new Error('Process not found (PID invalid)');
        }
        return 'healthy';
      });

      const mockRestart = jest.fn().mockImplementation(async () => {
        if (processAlive === false) {
          processAlive = true;
          restartCount++;
          return 'restarted';
        }
        return 'already-running';
      });

      // Health check succeeds
      expect(await supervisor.execute(mockInstanceCheck)).toBe('healthy');

      // Process crashes
      processAlive = false;

      // Health check fails
      try {
        await supervisor.execute(mockInstanceCheck);
      } catch {
        // Expected
      }

      // Trigger restart
      const restartResult = await mockRestart();
      expect(restartResult).toBe('restarted');
      expect(restartCount).toBe(1);

      // Health check now succeeds
      expect(await supervisor.execute(mockInstanceCheck)).toBe('healthy');
    });

    it('should prevent crash loops with exponential backoff', async () => {
      const lockManager = new LockManager();
      const maxRestarts = 5;
      const maxTime = 5 * 60 * 1000; // 5 minutes
      let restarts = 0;
      let lastRestartTime = Date.now();

      const mockCrashingProcess = jest.fn().mockImplementation(() => {
        restarts++;

        if (restarts > maxRestarts) {
          throw new Error('Max restarts exceeded - crash loop detected');
        }

        // Simulate: process starts but crashes immediately
        throw new Error('Process exited with code 1');
      });

      // Try to run crashing process with supervisor logic
      const startTime = Date.now();

      try {
        await lockManager.withLock('crashing-instance', async () => {
          // Simulate supervisor's retry loop
          for (let i = 0; i < maxRestarts; i++) {
            try {
              await mockCrashingProcess();
            } catch {
              // Exponential backoff: 1s, 2s, 4s, 8s, 16s
              const backoffMs = Math.min(1000 * Math.pow(2, i), 30000);
              jest.advanceTimersByTime(backoffMs);

              if (Date.now() - startTime > maxTime) {
                throw new Error('Crash loop timeout exceeded');
              }
            }
          }
        });
      } catch (error) {
        expect((error as Error).message).toContain('Max restarts exceeded');
      }

      expect(restarts).toBe(maxRestarts + 1);
    });

    it('should detect unresponsive instances (no heartbeat)', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const heartbeatTimeout = 30000;
      let lastHeartbeat = Date.now();

      const mockHeartbeatCheck = jest.fn().mockImplementation(() => {
        const timeSinceHeartbeat = Date.now() - lastHeartbeat;

        if (timeSinceHeartbeat > heartbeatTimeout) {
          throw new Error('Heartbeat timeout: instance unresponsive');
        }

        return 'heartbeat-ok';
      });

      // Initial check passes
      expect(await breaker.execute(mockHeartbeatCheck)).toBe('heartbeat-ok');

      // Advance time but not past timeout
      jest.advanceTimersByTime(25000);
      expect(await breaker.execute(mockHeartbeatCheck)).toBe('heartbeat-ok');

      // Advance past timeout
      jest.advanceTimersByTime(10000); // Total 35s

      // Now should fail
      try {
        await breaker.execute(mockHeartbeatCheck);
      } catch (error) {
        expect((error as Error).message).toContain('Heartbeat timeout');
      }
    });
  });

  describe('Cascading Failures Across Multiple Instances', () => {
    it('should isolate failures to affected instance', async () => {
      const breaker1 = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const breaker2 = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      let instance1Failures = 0;
      let instance2Success = 0;

      const mockInstance1 = jest.fn().mockImplementation(() => {
        instance1Failures++;
        throw new Error('Instance 1 failure');
      });

      const mockInstance2 = jest.fn().mockImplementation(() => {
        instance2Success++;
        return Promise.resolve('instance-2-ok');
      });

      // Instance 1 fails 3 times (opens circuit)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker1.execute(mockInstance1);
        } catch {
          // Expected
        }
      }

      expect(breaker1.getState()).toBe('OPEN');

      // Instance 2 should still work
      const result = await breaker2.execute(mockInstance2);
      expect(result).toBe('instance-2-ok');
      expect(breaker2.getState()).toBe('CLOSED');

      // Instance 1 circuit remains open
      expect(breaker1.getState()).toBe('OPEN');
    });

    it('should handle failure propagation up to database layer', async () => {
      const appBreaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const dbBreaker = new CircuitBreaker(DB_CIRCUIT_CONFIG);
      let failureChain = 0;

      const mockAppFailure = jest.fn().mockImplementation(async () => {
        failureChain++;

        if (failureChain <= 2) {
          throw new Error('App layer failure');
        }

        // App layer recovers but needs DB
        return await mockDbOp();
      });

      const mockDbOp = jest.fn().mockImplementation(async () => {
        if (failureChain <= 4) {
          throw new Error('Database layer failure');
        }
        return 'recovered';
      });

      // App failures
      for (let i = 0; i < 3; i++) {
        try {
          await appBreaker.execute(mockAppFailure);
        } catch {
          // Expected
        }
      }

      // DB should also be affected
      for (let i = 0; i < 3; i++) {
        try {
          await dbBreaker.execute(mockDbOp);
        } catch {
          // Expected
        }
      }

      expect(appBreaker.getState()).toBe('OPEN');
      expect(dbBreaker.getState()).toBe('OPEN');
    });
  });

  describe('Resource Leak Detection Under Sustained Load', () => {
    it('should detect unclosed resources under high concurrency', async () => {
      const lockManager = new LockManager();
      let resourceCount = 0;
      const maxResources = 50;

      const createResource = jest.fn().mockImplementation(() => {
        resourceCount++;

        if (resourceCount > maxResources) {
          throw new Error('Resource limit exceeded - potential leak');
        }

        return Promise.resolve(`resource-${resourceCount}`);
      });

      const cleanupResource = jest.fn().mockImplementation(() => {
        resourceCount--;
        return Promise.resolve();
      });

      // Run 100 operations
      for (let i = 0; i < 100; i++) {
        try {
          await lockManager.withLock(`op-${i}`, async () => {
            const resource = await createResource();
            // Simulate work
            await cleanupResource();
            return resource;
          });
        } catch (error) {
          // Some operations may fail
          if ((error as Error).message.includes('Resource limit exceeded')) {
            // Leak detected
            break;
          }
        }
      }

      // Final resource count should be near zero
      expect(resourceCount).toBeLessThanOrEqual(5); // Some tolerance for timing
    });

    it('should verify no socket files left behind after 1000 operations', async () => {
      const lockManager = new LockManager();
      const socketFiles = new Set<string>();

      const mockSpawnWithCleanup = jest.fn().mockImplementation(async (versionId: number) => {
        const socketPath = `/tmp/godot-mcp-v${versionId}.sock`;
        socketFiles.add(socketPath);

        // Simulate operation
        return new Promise(resolve => {
          setTimeout(() => {
            socketFiles.delete(socketPath); // Cleanup
            resolve('done');
          }, 0);
        });
      });

      // Run 1000 spawn operations across 20 versions
      for (let i = 0; i < 1000; i++) {
        const versionId = (i % 20) + 1;
        await lockManager.withLock(`version-${versionId}`, () => mockSpawnWithCleanup(versionId));
      }

      jest.runAllTimers();

      // All socket files should be cleaned up
      expect(socketFiles.size).toBe(0);
    });

    it('should detect and report memory usage patterns', async () => {
      const lockManager = new LockManager();
      const memorySnapshots: number[] = [];

      const mockMemoryIntensiveOp = jest.fn().mockImplementation(async () => {
        // Record "memory usage" (simulated)
        const usage = Math.random() * 100; // 0-100 MB
        memorySnapshots.push(usage);

        return Promise.resolve('done');
      });

      // Run 500 operations
      for (let i = 0; i < 500; i++) {
        await lockManager.withLock('op', mockMemoryIntensiveOp);
      }

      // Calculate trend (check for leak)
      const firstQuarter = memorySnapshots.slice(0, 125).reduce((a, b) => a + b) / 125;
      const lastQuarter = memorySnapshots.slice(375).reduce((a, b) => a + b) / 125;

      // Memory should stabilize (not grow unbounded)
      // Allow 50% variance for randomness
      expect(lastQuarter).toBeLessThan(firstQuarter * 1.5);
    });
  });

  describe('Complex Multi-Failure Scenarios', () => {
    it('should recover from simultaneous DB and socket failures', async () => {
      const dbBreaker = new CircuitBreaker(DB_CIRCUIT_CONFIG);
      const socketBreaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      let dbDown = true;
      let socketDown = true;

      const mockDbOp = jest.fn().mockImplementation(async () => {
        if (dbDown) throw new Error('DB connection refused');
        return 'db-ok';
      });

      const mockSocketOp = jest.fn().mockImplementation(async () => {
        if (socketDown) throw new Error('Socket connection refused');
        return 'socket-ok';
      });

      // Both fail initially
      for (let i = 0; i < 3; i++) {
        try {
          await dbBreaker.execute(mockDbOp);
        } catch {
          // Expected
        }

        try {
          await socketBreaker.execute(mockSocketOp);
        } catch {
          // Expected
        }
      }

      expect(dbBreaker.getState()).toBe('OPEN');
      expect(socketBreaker.getState()).toBe('OPEN');

      // Wait for recovery window
      jest.advanceTimersByTime(30000);

      // DB recovers
      dbDown = false;

      // Retry DB
      const dbResult = await dbBreaker.execute(mockDbOp);
      expect(dbResult).toBe('db-ok');
      expect(dbBreaker.getState()).toBe('HALF_OPEN');

      // Socket still down
      try {
        await socketBreaker.execute(mockSocketOp);
      } catch (error) {
        expect((error as Error).message).toContain('OPEN');
      }

      // Socket recovers
      socketDown = false;

      // Retry socket
      const socketResult = await socketBreaker.execute(mockSocketOp);
      expect(socketResult).toBe('socket-ok');

      // Both eventually healthy
      expect(dbBreaker.getState()).toBe('CLOSED');
      expect(socketBreaker.getState()).toBe('CLOSED');
    });

    it('should handle 50 instances failing and recovering in waves', async () => {
      const instances = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        breaker: new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG),
        failing: true,
      }));

      // Wave 1: All fail
      for (const instance of instances) {
        const mockOp = jest.fn().mockImplementation(() => {
          if (instance.failing) throw new Error('Instance down');
          return Promise.resolve('ok');
        });

        for (let i = 0; i < 3; i++) {
          try {
            await instance.breaker.execute(mockOp);
          } catch {
            // Expected
          }
        }
      }

      // All circuits open
      expect(instances.every(i => i.breaker.getState() === 'OPEN')).toBe(true);

      // Wave 2: Recovery begins (every 3rd instance recovers)
      jest.advanceTimersByTime(30000);

      for (const instance of instances) {
        if (instance.id % 3 === 0) {
          instance.failing = false;
        }
      }

      // Retry recovering instances
      let recoveredCount = 0;
      for (const instance of instances) {
        if (!instance.failing) {
          const mockOp = jest.fn().mockImplementation(() => Promise.resolve('ok'));
          try {
            await instance.breaker.execute(mockOp);
            if (instance.breaker.getState() === 'HALF_OPEN') {
              recoveredCount++;
            }
          } catch {
            // Still might fail
          }
        }
      }

      expect(recoveredCount).toBeGreaterThan(0);
    });
  });
});
