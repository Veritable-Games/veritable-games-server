/**
 * WorkerManager for React Integration
 * Handles Web Workers lifecycle, message passing, and error handling in Next.js environment
 */

// Message type definitions for type-safe worker communication
import { logger } from '@/lib/utils/logger';

export interface OrbitalWorkerMessage {
  type: 'CALCULATE_BATCH' | 'SOLVE_KEPLER' | 'UPDATE_POSITION' | 'INIT';
  id: string;
  payload: any;
}

export interface StellarWorkerMessage {
  type: 'GENERATE_STARS' | 'CLASSIFY_SPECTRUM' | 'PROCESS_BATCH' | 'INIT';
  id: string;
  payload: any;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  progress?: number;
}

export interface OrbitalBodyData {
  name: string;
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  meanAnomaly: number;
  centralMass: number;
}

export interface StarGenerationParams {
  count: number;
  seed?: number;
  magnitude_limit?: number;
  spectral_types?: string[];
}

/**
 * React-integrated Web Worker Manager
 * Provides promise-based APIs for orbital and stellar calculations
 */
export class WorkerManager {
  private orbitalWorker: Worker | null = null;
  private stellarWorker: Worker | null = null;
  private initialized: boolean = false;
  private fallbackMode: boolean = false;
  private messageId: number = 0;
  private pendingMessages: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout?: NodeJS.Timeout;
    }
  > = new Map();

  // Performance tracking
  private performanceMetrics = {
    orbitalCalculations: 0,
    stellarGenerations: 0,
    averageLatency: 0,
    errors: 0,
  };

  constructor() {
    this.initializeWorkers();
  }

  /**
   * Initialize Web Workers with error handling and fallback
   */
  private async initializeWorkers(): Promise<void> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        this.fallbackMode = true;
        logger.warn('WorkerManager: Server-side environment detected, using fallback mode');
        return;
      }

      // Check for Web Worker support
      if (!window.Worker) {
        this.fallbackMode = true;
        logger.warn('WorkerManager: Web Workers not supported, using fallback mode');
        return;
      }

      // Initialize orbital worker
      try {
        this.orbitalWorker = new Worker('/stellar/workers/orbital-worker.js');
        this.orbitalWorker.onmessage = this.handleOrbitalWorkerMessage.bind(this);
        this.orbitalWorker.onerror = this.handleOrbitalWorkerError.bind(this);

        // Test orbital worker
        await this.sendOrbitalMessage({ type: 'INIT', id: 'init-test', payload: {} });
        logger.info('✅ Orbital Worker initialized successfully');
      } catch (error) {
        logger.error('❌ Failed to initialize orbital worker:', error);
        this.orbitalWorker = null;
      }

      // Initialize stellar worker
      try {
        this.stellarWorker = new Worker('/stellar/workers/stellar-worker.js');
        this.stellarWorker.onmessage = this.handleStellarWorkerMessage.bind(this);
        this.stellarWorker.onerror = this.handleStellarWorkerError.bind(this);

        // Test stellar worker
        await this.sendStellarMessage({ type: 'INIT', id: 'init-test', payload: {} });
        logger.info('✅ Stellar Worker initialized successfully');
      } catch (error) {
        logger.error('❌ Failed to initialize stellar worker:', error);
        this.stellarWorker = null;
      }

      this.initialized = true;
      this.fallbackMode = !this.orbitalWorker && !this.stellarWorker;

      if (this.fallbackMode) {
        logger.warn('⚠️ WorkerManager running in fallback mode - some features may be limited');
      }
    } catch (error) {
      logger.error('❌ WorkerManager initialization failed:', error);
      this.fallbackMode = true;
    }
  }

  /**
   * Handle messages from orbital worker
   */
  private handleOrbitalWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;
    const pending = this.pendingMessages.get(response.id);

    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      this.pendingMessages.delete(response.id);

      if (response.success) {
        pending.resolve(response.data);
        this.performanceMetrics.orbitalCalculations++;
      } else {
        pending.reject(new Error(response.error || 'Orbital worker calculation failed'));
        this.performanceMetrics.errors++;
      }
    }
  }

  /**
   * Handle messages from stellar worker
   */
  private handleStellarWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const response = event.data;
    const pending = this.pendingMessages.get(response.id);

    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      this.pendingMessages.delete(response.id);

      if (response.success) {
        pending.resolve(response.data);
        this.performanceMetrics.stellarGenerations++;
      } else {
        pending.reject(new Error(response.error || 'Stellar worker generation failed'));
        this.performanceMetrics.errors++;
      }
    }
  }

  /**
   * Handle orbital worker errors
   */
  private handleOrbitalWorkerError(error: ErrorEvent): void {
    logger.error('Orbital Worker Error:', error);
    this.performanceMetrics.errors++;

    // Reject any pending orbital messages
    for (const [id, pending] of this.pendingMessages.entries()) {
      if (id.startsWith('orbital-')) {
        pending.reject(new Error(`Orbital worker error: ${error.message}`));
        this.pendingMessages.delete(id);
      }
    }
  }

  /**
   * Handle stellar worker errors
   */
  private handleStellarWorkerError(error: ErrorEvent): void {
    logger.error('Stellar Worker Error:', error);
    this.performanceMetrics.errors++;

    // Reject any pending stellar messages
    for (const [id, pending] of this.pendingMessages.entries()) {
      if (id.startsWith('stellar-')) {
        pending.reject(new Error(`Stellar worker error: ${error.message}`));
        this.pendingMessages.delete(id);
      }
    }
  }

  /**
   * Send message to orbital worker with promise-based response
   */
  private sendOrbitalMessage(message: OrbitalWorkerMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.orbitalWorker || this.fallbackMode) {
        reject(new Error('Orbital worker not available'));
        return;
      }

      const messageId = `orbital-${this.messageId++}`;
      const messageWithId = { ...message, id: messageId };

      // Set up timeout (30 seconds for complex calculations)
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Orbital worker timeout'));
      }, 30000);

      this.pendingMessages.set(messageId, { resolve, reject, timeout });
      this.orbitalWorker.postMessage(messageWithId);
    });
  }

  /**
   * Send message to stellar worker with promise-based response
   */
  private sendStellarMessage(message: StellarWorkerMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.stellarWorker || this.fallbackMode) {
        reject(new Error('Stellar worker not available'));
        return;
      }

      const messageId = `stellar-${this.messageId++}`;
      const messageWithId = { ...message, id: messageId };

      // Set up timeout (60 seconds for star generation)
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Stellar worker timeout'));
      }, 60000);

      this.pendingMessages.set(messageId, { resolve, reject, timeout });
      this.stellarWorker.postMessage(messageWithId);
    });
  }

  /**
   * Calculate orbital positions for multiple bodies (batch processing)
   */
  public async calculateOrbitalBatch(
    bodies: OrbitalBodyData[],
    currentTime: number
  ): Promise<any[]> {
    try {
      if (this.fallbackMode) {
        throw new Error('Orbital calculations require Web Worker support');
      }

      const startTime = performance.now();
      const result = await this.sendOrbitalMessage({
        type: 'CALCULATE_BATCH',
        id: '',
        payload: { bodies, currentTime },
      });

      const latency = performance.now() - startTime;
      this.updateAverageLatency(latency);

      return result;
    } catch (error) {
      logger.error('Orbital batch calculation failed:', error);
      throw error;
    }
  }

  /**
   * Solve Kepler's equation for eccentric anomaly
   */
  public async solveKeplersEquation(meanAnomaly: number, eccentricity: number): Promise<number> {
    try {
      if (this.fallbackMode) {
        // Fallback implementation (simplified Newton-Raphson)
        return this.fallbackKeplersEquation(meanAnomaly, eccentricity);
      }

      return await this.sendOrbitalMessage({
        type: 'SOLVE_KEPLER',
        id: '',
        payload: { meanAnomaly, eccentricity },
      });
    } catch (error) {
      logger.error('Kepler equation solving failed:', error);
      return this.fallbackKeplersEquation(meanAnomaly, eccentricity);
    }
  }

  /**
   * Generate star field with scientific accuracy
   */
  public async generateStars(params: StarGenerationParams): Promise<any[]> {
    try {
      if (this.fallbackMode) {
        throw new Error('Star generation requires Web Worker support');
      }

      const startTime = performance.now();
      const result = await this.sendStellarMessage({
        type: 'GENERATE_STARS',
        id: '',
        payload: params,
      });

      const latency = performance.now() - startTime;
      this.updateAverageLatency(latency);

      return result;
    } catch (error) {
      logger.error('Star generation failed:', error);
      throw error;
    }
  }

  /**
   * Fallback Kepler's equation solver (main thread)
   */
  private fallbackKeplersEquation(M: number, e: number): number {
    let E = M;
    const tolerance = 1e-6;
    const maxIterations = 20;

    for (let i = 0; i < maxIterations; i++) {
      const f = E - e * Math.sin(E) - M;
      const fPrime = 1 - e * Math.cos(E);
      const deltaE = f / fPrime;
      E -= deltaE;

      if (Math.abs(deltaE) < tolerance) {
        break;
      }
    }

    return E;
  }

  /**
   * Update average latency for performance monitoring
   */
  private updateAverageLatency(latency: number): void {
    const totalOps =
      this.performanceMetrics.orbitalCalculations + this.performanceMetrics.stellarGenerations;
    const currentAvg = this.performanceMetrics.averageLatency;
    this.performanceMetrics.averageLatency = (currentAvg * (totalOps - 1) + latency) / totalOps;
  }

  /**
   * Get performance metrics for monitoring
   */
  public getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Check if workers are available and initialized
   */
  public isReady(): boolean {
    return this.initialized && !this.fallbackMode;
  }

  /**
   * Check if running in fallback mode
   */
  public isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Clean up workers and pending operations (for React useEffect cleanup)
   */
  public cleanup(): void {
    // Clear all pending timeouts
    for (const [id, pending] of this.pendingMessages.entries()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('WorkerManager cleanup'));
    }
    this.pendingMessages.clear();

    // Terminate workers
    if (this.orbitalWorker) {
      this.orbitalWorker.terminate();
      this.orbitalWorker = null;
    }

    if (this.stellarWorker) {
      this.stellarWorker.terminate();
      this.stellarWorker = null;
    }

    this.initialized = false;
    logger.info('🧹 WorkerManager cleaned up');
  }
}

// Export singleton instance for React components
let workerManagerInstance: WorkerManager | null = null;

export const getWorkerManager = (): WorkerManager => {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager();
  }
  return workerManagerInstance;
};

// React hook for easy integration
export const useWorkerManager = () => {
  if (typeof window === 'undefined') {
    // Server-side rendering fallback
    return {
      workerManager: null,
      isReady: false,
      isFallbackMode: true,
    };
  }

  const workerManager = getWorkerManager();

  return {
    workerManager,
    isReady: workerManager.isReady(),
    isFallbackMode: workerManager.isFallbackMode(),
  };
};
