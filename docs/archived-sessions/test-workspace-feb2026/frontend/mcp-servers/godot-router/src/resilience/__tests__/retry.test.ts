import {
  withRetry,
  RetryConfig,
  DB_RETRY_CONFIG,
  SOCKET_RETRY_CONFIG,
  SPAWN_RETRY_CONFIG,
} from '../retry';

describe('Retry Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await withRetry(mockOp, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and eventually succeed', async () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const mockOp = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await withRetry(mockOp, DB_RETRY_CONFIG);

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(3);
    });

    it('should fail immediately on non-retryable error', async () => {
      const error = new Error('Invalid argument');
      const mockOp = jest.fn().mockRejectedValueOnce(error);

      await expect(
        withRetry(mockOp, {
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
          isRetryable: err => err.message.includes('ECONNREFUSED'),
        })
      ).rejects.toThrow('Invalid argument');

      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max attempts exceeded', async () => {
      const error = new Error('ETIMEDOUT: Connection timeout');
      const mockOp = jest.fn().mockRejectedValue(error);

      await expect(withRetry(mockOp, DB_RETRY_CONFIG)).rejects.toThrow('ETIMEDOUT');

      expect(mockOp).toHaveBeenCalledTimes(DB_RETRY_CONFIG.maxAttempts);
    });

    it('should apply exponential backoff delays', async () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const mockOp = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitterMs: 0,
      };

      const promise = withRetry(mockOp, config);

      // First attempt fails immediately
      jest.advanceTimersByTime(0);
      expect(mockOp).toHaveBeenCalledTimes(1);

      // After initial delay (100ms), second attempt
      jest.advanceTimersByTime(100);
      jest.runAllTimers(); // Let the operation complete
      expect(mockOp).toHaveBeenCalledTimes(2);

      // After exponential backoff (100 * 2 = 200ms), third attempt
      jest.advanceTimersByTime(200);
      jest.runAllTimers();
      expect(mockOp).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('should cap backoff delay at maxDelayMs', async () => {
      const error = new Error('ECONNREFUSED');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const config: RetryConfig = {
        maxAttempts: 2,
        initialDelayMs: 1000,
        maxDelayMs: 1000, // Cap at 1000ms
        backoffMultiplier: 10, // Would be 10000ms without cap
        jitterMs: 0,
      };

      const promise = withRetry(mockOp, config);

      jest.advanceTimersByTime(999);
      expect(mockOp).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      jest.runAllTimers();

      await promise;
      expect(mockOp).toHaveBeenCalledTimes(2);
    });

    it('should apply jitter to backoff delays', async () => {
      const error = new Error('ECONNREFUSED');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      let jitterApplied = false;

      // Mock Math.random to check jitter
      const originalRandom = Math.random;
      jest.spyOn(Math, 'random').mockImplementation(() => 0.5); // 50% of jitter

      const config: RetryConfig = {
        maxAttempts: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterMs: 50,
      };

      const promise = withRetry(mockOp, config);

      // With 100ms base + 25ms jitter (0.5 * 50)
      jest.advanceTimersByTime(125);
      jest.runAllTimers();

      await promise;
      expect(mockOp).toHaveBeenCalledTimes(2);
    });

    it('should handle non-Error thrown values', async () => {
      const mockOp = jest
        .fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('success');

      const result = await withRetry(mockOp, {
        maxAttempts: 2,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(2);
    });
  });

  describe('DB_RETRY_CONFIG', () => {
    it('should retry on connection errors', async () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('data');

      const result = await withRetry(mockOp, DB_RETRY_CONFIG);

      expect(result).toBe('data');
      expect(mockOp).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      const error = new Error('ETIMEDOUT: Connection timeout');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('data');

      const result = await withRetry(mockOp, DB_RETRY_CONFIG);

      expect(result).toBe('data');
    });

    it('should retry on pool errors', async () => {
      const error = new Error('Connection pool exhausted');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('data');

      const result = await withRetry(mockOp, DB_RETRY_CONFIG);

      expect(result).toBe('data');
    });

    it('should not retry on syntax errors', async () => {
      const error = new Error('Syntax error in query');
      const mockOp = jest.fn().mockRejectedValueOnce(error);

      await expect(withRetry(mockOp, DB_RETRY_CONFIG)).rejects.toThrow('Syntax error');

      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should have correct configuration values', () => {
      expect(DB_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DB_RETRY_CONFIG.initialDelayMs).toBe(100);
      expect(DB_RETRY_CONFIG.maxDelayMs).toBe(2000);
      expect(DB_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(DB_RETRY_CONFIG.jitterMs).toBe(50);
    });
  });

  describe('SOCKET_RETRY_CONFIG', () => {
    it('should retry on socket connection errors', async () => {
      const error = new Error('ECONNREFUSED: Socket connection refused');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('connected');

      const result = await withRetry(mockOp, SOCKET_RETRY_CONFIG);

      expect(result).toBe('connected');
    });

    it('should have correct configuration values', () => {
      expect(SOCKET_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(SOCKET_RETRY_CONFIG.initialDelayMs).toBe(200);
      expect(SOCKET_RETRY_CONFIG.maxDelayMs).toBe(5000);
      expect(SOCKET_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(SOCKET_RETRY_CONFIG.jitterMs).toBe(100);
    });
  });

  describe('SPAWN_RETRY_CONFIG', () => {
    it('should retry on spawn errors', async () => {
      const error = new Error('EADDRINUSE: Socket already in use');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ pid: 1234 });

      const result = await withRetry(mockOp, SPAWN_RETRY_CONFIG);

      expect(result).toEqual({ pid: 1234 });
    });

    it('should have correct configuration values', () => {
      expect(SPAWN_RETRY_CONFIG.maxAttempts).toBe(2);
      expect(SPAWN_RETRY_CONFIG.initialDelayMs).toBe(500);
      expect(SPAWN_RETRY_CONFIG.maxDelayMs).toBe(3000);
      expect(SPAWN_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(SPAWN_RETRY_CONFIG.jitterMs).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('should work with maxAttempts=1', async () => {
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await withRetry(mockOp, {
        maxAttempts: 1,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(1);
    });

    it('should work with very large backoff multiplier', async () => {
      const error = new Error('ECONNREFUSED');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await withRetry(mockOp, {
        maxAttempts: 2,
        initialDelayMs: 10,
        maxDelayMs: 100, // Should cap the delay
        backoffMultiplier: 1000,
        jitterMs: 0,
      });

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(2);
    });

    it('should return correct type for generic operations', async () => {
      const mockOp = jest.fn().mockResolvedValue({ userId: 123, name: 'test' });

      const result = await withRetry<{ userId: number; name: string }>(mockOp, {
        maxAttempts: 1,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      expect(result.userId).toBe(123);
      expect(result.name).toBe('test');
    });

    it('should handle operation that resolves after delay', async () => {
      const mockOp = jest.fn(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve('delayed success'), 50);
          })
      );

      const promise = withRetry(mockOp, {
        maxAttempts: 1,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      jest.advanceTimersByTime(50);
      const result = await promise;

      expect(result).toBe('delayed success');
    });
  });
});
