import {
  CircuitBreaker,
  CircuitBreakerConfig,
  INSTANCE_CIRCUIT_CONFIG,
  DB_CIRCUIT_CONFIG,
  SOCKET_CIRCUIT_CONFIG,
  createCircuitBreaker,
} from '../circuit-breaker';

describe('Circuit Breaker Module', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('CircuitBreaker - CLOSED state', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should execute successful operations in CLOSED state', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const mockOp = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(mockOp);

      expect(result).toBe('success');
      expect(mockOp).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reset failure count on successful execution', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      await expect(breaker.execute(mockOp)).rejects.toThrow();
      const status1 = breaker.getStatus();
      expect(status1.failureCount).toBe(1);

      await breaker.execute(mockOp);
      const status2 = breaker.getStatus();

      expect(status2.failureCount).toBe(0);
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN when failure threshold reached', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValue(error);

      // First two failures
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');

      // Third failure should open the circuit
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.getStatus().failureCount).toBe(3);
    });

    it('should throw immediately on non-threshold error', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValueOnce(error);

      await expect(breaker.execute(mockOp)).rejects.toThrow('Connection failed');

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStatus().failureCount).toBe(1);
    });
  });

  describe('CircuitBreaker - OPEN state', () => {
    it('should fast-fail in OPEN state without calling operation', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValue(error);

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOp)).rejects.toThrow();
      }
      expect(breaker.getState()).toBe('OPEN');

      // Reset mock to verify it's not called again
      mockOp.mockClear();

      // Try to execute in OPEN state
      await expect(breaker.execute(mockOp)).rejects.toThrow('Circuit breaker is OPEN');

      expect(mockOp).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after timeout in OPEN state', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 5000,
      });

      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValue(error);

      // Open the circuit
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Advance time but not enough
      jest.advanceTimersByTime(4999);
      await expect(breaker.execute(mockOp)).rejects.toThrow('Circuit breaker is OPEN');
      expect(breaker.getState()).toBe('OPEN');

      // Advance past timeout
      jest.advanceTimersByTime(1);
      expect(breaker.getState()).toBe('OPEN'); // Not transitioned yet, needs next execute

      // Next execute should transition to HALF_OPEN
      mockOp.mockResolvedValueOnce('success');
      const result = await breaker.execute(mockOp);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });

  describe('CircuitBreaker - HALF_OPEN state', () => {
    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 1,
        successThreshold: 2,
        timeoutMs: 100,
      };
      const breaker = new CircuitBreaker(config);
      const error = new Error('Connection failed');
      const mockOp = jest.fn();

      // Open the circuit
      mockOp.mockRejectedValueOnce(error);
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      jest.advanceTimersByTime(100);

      // First success in HALF_OPEN
      mockOp.mockResolvedValueOnce('success1');
      const result1 = await breaker.execute(mockOp);
      expect(result1).toBe('success1');
      expect(breaker.getState()).toBe('HALF_OPEN');
      expect(breaker.getStatus().successCount).toBe(1);

      // Second success - should transition to CLOSED
      mockOp.mockResolvedValueOnce('success2');
      const result2 = await breaker.execute(mockOp);
      expect(result2).toBe('success2');
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStatus().successCount).toBe(0); // Reset on CLOSED
      expect(breaker.getStatus().failureCount).toBe(0); // Reset on CLOSED
    });

    it('should immediately transition back to OPEN on failure in HALF_OPEN', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 1,
        successThreshold: 2,
        timeoutMs: 100,
      };
      const breaker = new CircuitBreaker(config);
      const error1 = new Error('First failure');
      const error2 = new Error('Second failure');
      const mockOp = jest.fn();

      // Open the circuit
      mockOp.mockRejectedValueOnce(error1);
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      jest.advanceTimersByTime(100);

      // One success in HALF_OPEN
      mockOp.mockResolvedValueOnce('success');
      await breaker.execute(mockOp);
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Failure should immediately open
      mockOp.mockRejectedValueOnce(error2);
      await expect(breaker.execute(mockOp)).rejects.toThrow(error2);
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.getStatus().successCount).toBe(0);
    });

    it('should allow limited requests in HALF_OPEN state', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 1,
        successThreshold: 3,
        timeoutMs: 100,
      };
      const breaker = new CircuitBreaker(config);
      const mockOp = jest.fn();

      // Open and transition to HALF_OPEN
      mockOp.mockRejectedValueOnce(new Error('fail'));
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      jest.advanceTimersByTime(100);

      // Execute multiple requests in HALF_OPEN
      mockOp.mockResolvedValue('ok');
      for (let i = 0; i < 3; i++) {
        const result = await breaker.execute(mockOp);
        expect(result).toBe('ok');
        expect(breaker.getState()).toBe(i < 2 ? 'HALF_OPEN' : 'CLOSED');
      }

      expect(mockOp).toHaveBeenCalledTimes(4); // 1 fail + 3 successes
    });
  });

  describe('Circuit Breaker Configurations', () => {
    it('INSTANCE_CIRCUIT_CONFIG should have correct values', () => {
      expect(INSTANCE_CIRCUIT_CONFIG.failureThreshold).toBe(3);
      expect(INSTANCE_CIRCUIT_CONFIG.successThreshold).toBe(2);
      expect(INSTANCE_CIRCUIT_CONFIG.timeoutMs).toBe(30000);
      expect(INSTANCE_CIRCUIT_CONFIG.name).toBe('instance');
    });

    it('DB_CIRCUIT_CONFIG should have correct values', () => {
      expect(DB_CIRCUIT_CONFIG.failureThreshold).toBe(5);
      expect(DB_CIRCUIT_CONFIG.successThreshold).toBe(3);
      expect(DB_CIRCUIT_CONFIG.timeoutMs).toBe(10000);
      expect(DB_CIRCUIT_CONFIG.name).toBe('database');
    });

    it('SOCKET_CIRCUIT_CONFIG should have correct values', () => {
      expect(SOCKET_CIRCUIT_CONFIG.failureThreshold).toBe(4);
      expect(SOCKET_CIRCUIT_CONFIG.successThreshold).toBe(2);
      expect(SOCKET_CIRCUIT_CONFIG.timeoutMs).toBe(15000);
      expect(SOCKET_CIRCUIT_CONFIG.name).toBe('socket');
    });
  });

  describe('State Management', () => {
    it('getState() should return current state', () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('getStatus() should return detailed status', () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const mockOp = jest.fn().mockRejectedValue(new Error('fail'));

      // Execute once to record failure
      breaker.execute(mockOp).catch(() => {});

      const status = breaker.getStatus();

      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(1);
      expect(status.successCount).toBe(0);
      expect(typeof status.lastFailureTime).toBe('number');
    });

    it('reset() should reset all state', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Connection failed');
      const mockOp = jest.fn().mockRejectedValue(error);

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOp)).rejects.toThrow();
      }
      expect(breaker.getState()).toBe('OPEN');

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStatus().failureCount).toBe(0);
      expect(breaker.getStatus().successCount).toBe(0);
      expect(breaker.getStatus().lastFailureTime).toBe(null);
    });
  });

  describe('createCircuitBreaker factory', () => {
    it('should create a new CircuitBreaker instance', () => {
      const breaker = createCircuitBreaker(INSTANCE_CIRCUIT_CONFIG);

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should create breakers with different configs independently', () => {
      const breaker1 = createCircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const breaker2 = createCircuitBreaker(DB_CIRCUIT_CONFIG);

      expect(breaker1).not.toBe(breaker2);
      expect(breaker1.getState()).toBe('CLOSED');
      expect(breaker2.getState()).toBe('CLOSED');
    });
  });

  describe('Error handling', () => {
    it('should preserve original error message', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const error = new Error('Specific database connection error');
      const mockOp = jest.fn().mockRejectedValueOnce(error);

      await expect(breaker.execute(mockOp)).rejects.toThrow('Specific database connection error');
    });

    it('should handle non-Error thrown values', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const mockOp = jest.fn().mockRejectedValueOnce('string error');

      await expect(breaker.execute(mockOp)).rejects.toBeDefined();
    });

    it('should handle async errors', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const mockOp = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Async error')), 10);
          })
      );

      jest.advanceTimersByTime(0);
      await expect(breaker.execute(mockOp)).rejects.toThrow('Async error');
    });
  });

  describe('Edge cases', () => {
    it('should handle failureThreshold of 1', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      const mockOp = jest.fn().mockRejectedValueOnce(new Error('fail'));

      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should handle successThreshold of 1', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 100,
      });

      const mockOp = jest.fn();

      // Open
      mockOp.mockRejectedValueOnce(new Error('fail'));
      await expect(breaker.execute(mockOp)).rejects.toThrow();

      // Transition to HALF_OPEN
      jest.advanceTimersByTime(100);

      // One success should close
      mockOp.mockResolvedValueOnce('success');
      const result = await breaker.execute(mockOp);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should handle multiple sequential operations', async () => {
      const breaker = new CircuitBreaker(INSTANCE_CIRCUIT_CONFIG);
      const mockOp = jest.fn().mockResolvedValue('result');

      for (let i = 0; i < 10; i++) {
        const result = await breaker.execute(mockOp);
        expect(result).toBe('result');
        expect(breaker.getState()).toBe('CLOSED');
      }

      expect(mockOp).toHaveBeenCalledTimes(10);
    });
  });

  describe('Timing precision', () => {
    it('should distinguish between OPEN and timeout boundary', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 1000,
      });

      const mockOp = jest.fn();

      mockOp.mockRejectedValueOnce(new Error('fail'));
      await expect(breaker.execute(mockOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Just before timeout
      jest.advanceTimersByTime(999);
      await expect(breaker.execute(mockOp)).rejects.toThrow('Circuit breaker is OPEN');
      expect(breaker.getState()).toBe('OPEN');

      // At timeout boundary
      jest.advanceTimersByTime(1);
      mockOp.mockResolvedValueOnce('success');
      const result = await breaker.execute(mockOp);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should report remaining time in error message', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 1,
        timeoutMs: 5000,
      });

      const mockOp = jest.fn().mockRejectedValueOnce(new Error('fail'));

      await expect(breaker.execute(mockOp)).rejects.toThrow();

      jest.advanceTimersByTime(2000);

      try {
        await breaker.execute(mockOp);
      } catch (error) {
        expect((error as Error).message).toMatch(/Retry in \d+ms/);
      }
    });
  });
});
