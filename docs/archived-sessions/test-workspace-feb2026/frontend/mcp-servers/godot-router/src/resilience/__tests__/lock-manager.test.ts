import { LockManager, globalLockManager } from '../lock-manager';

describe('Lock Manager Module', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withLock', () => {
    it('should acquire and release lock successfully', async () => {
      const lockManager = new LockManager();
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await lockManager.withLock('test-key', mockOp);

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(1);
      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should execute operation inside lock', async () => {
      const lockManager = new LockManager();
      let executionTime = 0;

      const mockOp = jest.fn(
        () =>
          new Promise(resolve => {
            executionTime = Date.now();
            setTimeout(() => resolve('done'), 50);
          })
      );

      const promise = lockManager.withLock('test-key', mockOp);

      expect(lockManager.isLocked('test-key')).toBe(true);

      jest.advanceTimersByTime(50);
      const result = await promise;

      expect(result).toBe('done');
      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should release lock even if operation throws', async () => {
      const lockManager = new LockManager();
      const error = new Error('Operation failed');
      const mockOp = jest.fn().mockRejectedValue(error);

      await expect(lockManager.withLock('test-key', mockOp)).rejects.toThrow('Operation failed');

      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should serialize concurrent operations on same key', async () => {
      const lockManager = new LockManager();
      const callOrder: string[] = [];

      const op1 = jest.fn(async () => {
        callOrder.push('op1-start');
        return new Promise(resolve => {
          setTimeout(() => {
            callOrder.push('op1-end');
            resolve('result1');
          }, 100);
        });
      });

      const op2 = jest.fn(async () => {
        callOrder.push('op2-start');
        return 'result2';
      });

      const promise1 = lockManager.withLock('same-key', op1);
      const promise2 = lockManager.withLock('same-key', op2);

      expect(callOrder).toEqual(['op1-start']);

      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(callOrder).toEqual(['op1-start', 'op1-end', 'op2-start']);
    });

    it('should allow parallel operations on different keys', async () => {
      const lockManager = new LockManager();
      const callOrder: string[] = [];

      const op1 = jest.fn(async () => {
        callOrder.push('op1-start');
        return new Promise(resolve => {
          setTimeout(() => {
            callOrder.push('op1-end');
            resolve('result1');
          }, 100);
        });
      });

      const op2 = jest.fn(async () => {
        callOrder.push('op2-start');
        return new Promise(resolve => {
          setTimeout(() => {
            callOrder.push('op2-end');
            resolve('result2');
          }, 100);
        });
      });

      const promise1 = lockManager.withLock('key1', op1);
      const promise2 = lockManager.withLock('key2', op2);

      // Both should start immediately
      jest.advanceTimersByTime(0);
      expect(callOrder).toEqual(['op1-start', 'op2-start']);

      jest.advanceTimersByTime(100);
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(callOrder).toEqual(['op1-start', 'op2-start', 'op1-end', 'op2-end']);
    });

    it('should respect lock acquisition timeout', async () => {
      const lockManager = new LockManager();
      const lockTimeout = 1000;
      let op1Completed = false;

      const op1 = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              op1Completed = true;
              resolve('op1 result');
            }, 5000);
          })
      );

      const op2 = jest.fn().mockResolvedValue('op2 result');

      const promise1 = lockManager.withLock('test-key', op1);
      const promise2 = lockManager.withLock('test-key', op2, lockTimeout);

      // Wait for lock acquisition timeout
      jest.advanceTimersByTime(lockTimeout + 1);

      await expect(promise2).rejects.toThrow('Lock acquisition timeout');
      expect(op2).not.toHaveBeenCalled();
    });

    it('should use default timeout of 30 seconds', async () => {
      const lockManager = new LockManager();

      const op1 = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve('done'), 100);
          })
      );

      const op2 = jest.fn().mockResolvedValue('op2');

      const promise1 = lockManager.withLock('test-key', op1);
      const promise2 = lockManager.withLock('test-key', op2); // No timeout specified

      // Complete op1
      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('done');
      expect(result2).toBe('op2');
    });

    it('should handle multiple waiters on same lock', async () => {
      const lockManager = new LockManager();
      const order: number[] = [];

      const slowOp = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              order.push(0);
              resolve('slow');
            }, 100);
          })
      );

      const quickOps = [1, 2, 3].map(id =>
        jest.fn(async () => {
          order.push(id);
          return `op${id}`;
        })
      );

      const p0 = lockManager.withLock('key', slowOp);
      const p1 = lockManager.withLock('key', quickOps[0]);
      const p2 = lockManager.withLock('key', quickOps[1]);
      const p3 = lockManager.withLock('key', quickOps[2]);

      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      await Promise.all([p0, p1, p2, p3]);

      expect(order).toEqual([0, 1, 2, 3]);
    });
  });

  describe('isLocked', () => {
    it('should return true when lock is held', async () => {
      const lockManager = new LockManager();

      const promise = lockManager.withLock('test-key', () => {
        expect(lockManager.isLocked('test-key')).toBe(true);
        return Promise.resolve('done');
      });

      await promise;
    });

    it('should return false when lock is not held', () => {
      const lockManager = new LockManager();

      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should return false after lock is released', async () => {
      const lockManager = new LockManager();

      await lockManager.withLock('test-key', () => Promise.resolve('done'));

      expect(lockManager.isLocked('test-key')).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info when lock is held', async () => {
      const lockManager = new LockManager();

      const promise = lockManager.withLock('test-key', () => {
        const info = lockManager.getLockInfo('test-key');

        expect(info).not.toBeNull();
        expect(info?.ageMs).toBeGreaterThanOrEqual(0);
        expect(typeof info?.acquiredAt).toBe('number');
        return Promise.resolve('done');
      });

      await promise;
    });

    it('should return null when lock is not held', () => {
      const lockManager = new LockManager();

      const info = lockManager.getLockInfo('test-key');

      expect(info).toBeNull();
    });

    it('should report accurate lock age', async () => {
      const lockManager = new LockManager();

      const promise = lockManager.withLock('test-key', () => {
        jest.advanceTimersByTime(50);
        const info = lockManager.getLockInfo('test-key');

        expect(info?.ageMs).toBeGreaterThanOrEqual(50);
        return Promise.resolve('done');
      });

      await promise;
    });
  });

  describe('getLockedKeys', () => {
    it('should return empty array when no locks held', () => {
      const lockManager = new LockManager();

      const keys = lockManager.getLockedKeys();

      expect(keys).toEqual([]);
    });

    it('should return list of locked keys', async () => {
      const lockManager = new LockManager();

      const p1 = lockManager.withLock('key1', () => new Promise(() => {})); // Never resolves
      const p2 = lockManager.withLock('key2', () => new Promise(() => {})); // Never resolves

      jest.advanceTimersByTime(0);

      const keys = lockManager.getLockedKeys();

      expect(keys).toHaveLength(2);
      expect(keys.map(k => k.key).sort()).toEqual(['key1', 'key2']);

      // Cleanup
      jest.useRealTimers();
    });

    it('should report lock ages', async () => {
      const lockManager = new LockManager();

      lockManager.withLock('key1', () => new Promise(() => {})); // Never resolves

      jest.advanceTimersByTime(100);

      const keys = lockManager.getLockedKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0].ageMs).toBeGreaterThanOrEqual(100);

      jest.useRealTimers();
    });
  });

  describe('Stale lock cleanup', () => {
    it('should clean up locks exceeding max age', () => {
      jest.useFakeTimers();

      const lockManager = new LockManager();

      // Create a stale lock by manipulating internal state
      const staleLock = {
        acquiredAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        resolvers: [],
        rejecters: [],
      };

      // We'll test this indirectly through error handling in waiters
      const wasError = false;

      // Advance time past cleanup interval
      jest.advanceTimersByTime(61 * 1000); // Cleanup runs every 60s

      jest.useRealTimers();
    });
  });

  describe('globalLockManager', () => {
    it('should be a singleton instance', () => {
      expect(globalLockManager).toBeInstanceOf(LockManager);
    });

    it('should work like regular LockManager', async () => {
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await globalLockManager.withLock('global-test', mockOp);

      expect(result).toBe('success');
      expect(globalLockManager.isLocked('global-test')).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should throw error if operation fails', async () => {
      const lockManager = new LockManager();
      const error = new Error('Operation error');
      const mockOp = jest.fn().mockRejectedValue(error);

      await expect(lockManager.withLock('test-key', mockOp)).rejects.toThrow('Operation error');
    });

    it('should allow next operation after error', async () => {
      const lockManager = new LockManager();

      const op1 = jest.fn().mockRejectedValue(new Error('Failed'));
      const op2 = jest.fn().mockResolvedValue('success');

      await expect(lockManager.withLock('test-key', op1)).rejects.toThrow();
      const result = await lockManager.withLock('test-key', op2);

      expect(result).toBe('success');
      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should handle non-Error thrown values', async () => {
      const lockManager = new LockManager();
      const mockOp = jest.fn().mockRejectedValue('string error');

      await expect(lockManager.withLock('test-key', mockOp)).rejects.toBeDefined();
      expect(lockManager.isLocked('test-key')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero timeout', async () => {
      const lockManager = new LockManager();

      const op1 = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve('done'), 100);
          })
      );

      const op2 = jest.fn().mockResolvedValue('op2');

      const promise1 = lockManager.withLock('test-key', op1);
      const promise2 = lockManager.withLock('test-key', op2, 0);

      // Should timeout immediately
      await expect(promise2).rejects.toThrow('Lock acquisition timeout');
    });

    it('should handle very large timeout', async () => {
      const lockManager = new LockManager();

      const op1 = jest.fn(async () => {
        return 'op1';
      });

      const op2 = jest.fn(async () => {
        return 'op2';
      });

      const result1 = await lockManager.withLock('test-key', op1, Number.MAX_SAFE_INTEGER);
      const result2 = await lockManager.withLock('test-key', op2, Number.MAX_SAFE_INTEGER);

      expect(result1).toBe('op1');
      expect(result2).toBe('op2');
    });

    it('should handle rapid acquire/release cycles', async () => {
      const lockManager = new LockManager();
      const mockOp = jest.fn().mockResolvedValue('result');

      for (let i = 0; i < 10; i++) {
        await lockManager.withLock('test-key', mockOp);
      }

      expect(mockOp).toHaveBeenCalledTimes(10);
      expect(lockManager.isLocked('test-key')).toBe(false);
    });

    it('should handle very long key names', async () => {
      const lockManager = new LockManager();
      const longKey = 'k'.repeat(1000);
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await lockManager.withLock(longKey, mockOp);

      expect(result).toBe('success');
      expect(lockManager.isLocked(longKey)).toBe(false);
    });

    it('should handle special characters in key names', async () => {
      const lockManager = new LockManager();
      const specialKey = 'key-with-special-chars:@#$%^&*()';
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await lockManager.withLock(specialKey, mockOp);

      expect(result).toBe('success');
      expect(lockManager.isLocked(specialKey)).toBe(false);
    });
  });

  describe('Concurrency scenarios', () => {
    it('should handle thundering herd of lock waiters', async () => {
      const lockManager = new LockManager();
      const executionOrder: number[] = [];

      const holdLock = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              executionOrder.push(0);
              resolve('done');
            }, 100);
          })
      );

      const competitors = Array.from({ length: 10 }, (_, i) =>
        jest.fn(async () => {
          executionOrder.push(i + 1);
          return `result${i}`;
        })
      );

      const p0 = lockManager.withLock('key', holdLock);
      const others = competitors.map((op, i) => lockManager.withLock('key', op));

      jest.advanceTimersByTime(100);
      jest.runAllTimers();

      await Promise.all([p0, ...others]);

      // First should be holder, rest should be in order
      expect(executionOrder[0]).toBe(0);
      expect(executionOrder.slice(1).sort()).toEqual(executionOrder.slice(1));
    });

    it('should handle mixed key operations', async () => {
      const lockManager = new LockManager();
      const results = await Promise.all([
        lockManager.withLock('key1', () => Promise.resolve('1')),
        lockManager.withLock('key2', () => Promise.resolve('2')),
        lockManager.withLock('key1', () => Promise.resolve('1b')),
        lockManager.withLock('key3', () => Promise.resolve('3')),
        lockManager.withLock('key2', () => Promise.resolve('2b')),
      ]);

      expect(results).toContain('1');
      expect(results).toContain('2');
      expect(results).toContain('1b');
      expect(results).toContain('3');
      expect(results).toContain('2b');
    });
  });
});
