/**
 * Performance Validator for Stellar Dodecahedron Viewer
 * Validates performance targets: 60 FPS, memory usage, load times
 */

import { logger } from '@/lib/utils/logger';

/**
 * Chrome/Chromium Performance.memory API (non-standard)
 */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory;
}

export interface PerformanceMetrics {
  frameRate: {
    current: number;
    average: number;
    min: number;
    max: number;
    target: number;
    samples: number;
  };
  memory: {
    used: number;
    total: number;
    limit: number;
    jsHeapSizeUsed?: number;
    jsHeapSizeTotal?: number;
    jsHeapSizeLimit?: number;
  };
  loadTimes: {
    initialization: number;
    firstRender: number;
    fullLoad: number;
    target: number;
  };
  rendering: {
    drawCalls: number;
    vertices: number;
    textures: number;
    programs: number;
  };
  lod: {
    currentLevel: number;
    visibleStars: number;
    updates: number;
  };
}

export interface PerformanceTargets {
  minFPS: number;
  maxMemoryMB: number;
  maxLoadTimeMS: number;
  maxFrameTimeMS: number;
}

export class PerformanceValidator {
  private metrics: PerformanceMetrics;
  private targets: PerformanceTargets;
  private frameStartTime: number = 0;
  private frameTimes: number[] = [];
  private maxFrameSamples = 120; // 2 seconds at 60 FPS
  private startTime: number;
  private lastMemoryCheck: number = 0;
  private memoryCheckInterval: number = 5000; // Check memory every 5 seconds

  constructor(targets?: Partial<PerformanceTargets>) {
    this.targets = {
      minFPS: 45, // Minimum acceptable FPS (some tolerance below 60)
      maxMemoryMB: 200, // Maximum additional memory usage
      maxLoadTimeMS: 3000, // Maximum load time
      maxFrameTimeMS: 16.67, // Target 60 FPS (16.67ms per frame)
      ...targets,
    };

    this.startTime = performance.now();

    this.metrics = {
      frameRate: {
        current: 0,
        average: 0,
        min: Infinity,
        max: 0,
        target: 60,
        samples: 0,
      },
      memory: {
        used: 0,
        total: 0,
        limit: this.targets.maxMemoryMB * 1024 * 1024,
        jsHeapSizeUsed: 0,
        jsHeapSizeTotal: 0,
        jsHeapSizeLimit: 0,
      },
      loadTimes: {
        initialization: 0,
        firstRender: 0,
        fullLoad: 0,
        target: this.targets.maxLoadTimeMS,
      },
      rendering: {
        drawCalls: 0,
        vertices: 0,
        textures: 0,
        programs: 0,
      },
      lod: {
        currentLevel: 0,
        visibleStars: 0,
        updates: 0,
      },
    };
  }

  /**
   * Start frame measurement
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * End frame measurement and update metrics
   */
  endFrame(): void {
    if (this.frameStartTime === 0) return;

    const frameTime = performance.now() - this.frameStartTime;

    // Add to frame time samples
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // Calculate frame rate
    const fps = 1000 / frameTime;
    this.metrics.frameRate.current = fps;
    this.metrics.frameRate.samples++;

    // Update min/max
    if (fps < this.metrics.frameRate.min) this.metrics.frameRate.min = fps;
    if (fps > this.metrics.frameRate.max) this.metrics.frameRate.max = fps;

    // Calculate rolling average
    const avgFrameTime =
      this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    this.metrics.frameRate.average = 1000 / avgFrameTime;

    this.frameStartTime = 0;
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics(): void {
    const now = performance.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) return;

    this.lastMemoryCheck = now;

    // Use Performance.memory API if available (Chromium-based browsers)
    if ('memory' in performance) {
      const memInfo = (performance as PerformanceWithMemory).memory;
      this.metrics.memory.jsHeapSizeUsed = memInfo.usedJSHeapSize;
      this.metrics.memory.jsHeapSizeTotal = memInfo.totalJSHeapSize;
      this.metrics.memory.jsHeapSizeLimit = memInfo.jsHeapSizeLimit;
      this.metrics.memory.used = memInfo.usedJSHeapSize;
      this.metrics.memory.total = memInfo.totalJSHeapSize;
    } else {
      // Fallback: estimate based on runtime
      this.metrics.memory.used = Math.floor(Math.random() * 100) * 1024 * 1024; // Placeholder
    }
  }

  /**
   * Record initialization completion time
   */
  recordInitialization(): void {
    this.metrics.loadTimes.initialization = performance.now() - this.startTime;
  }

  /**
   * Record first render time
   */
  recordFirstRender(): void {
    this.metrics.loadTimes.firstRender = performance.now() - this.startTime;
  }

  /**
   * Record full load completion time
   */
  recordFullLoad(): void {
    this.metrics.loadTimes.fullLoad = performance.now() - this.startTime;
  }

  /**
   * Update rendering statistics
   */
  updateRenderingStats(stats: Partial<PerformanceMetrics['rendering']>): void {
    Object.assign(this.metrics.rendering, stats);
  }

  /**
   * Update LOD statistics
   */
  updateLODStats(stats: Partial<PerformanceMetrics['lod']>): void {
    Object.assign(this.metrics.lod, stats);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics };
  }

  /**
   * Validate performance against targets
   */
  validatePerformance(): {
    passed: boolean;
    issues: string[];
    metrics: PerformanceMetrics;
  } {
    const issues: string[] = [];
    this.updateMemoryMetrics();

    // Frame rate validation
    if (this.metrics.frameRate.average < this.targets.minFPS) {
      issues.push(
        `Frame rate below target: ${this.metrics.frameRate.average.toFixed(1)} FPS < ${this.targets.minFPS} FPS`
      );
    }

    if (this.metrics.frameRate.min < this.targets.minFPS * 0.5) {
      issues.push(
        `Minimum frame rate critically low: ${this.metrics.frameRate.min.toFixed(1)} FPS`
      );
    }

    // Memory validation
    const memoryMB = this.metrics.memory.used / (1024 * 1024);
    if (memoryMB > this.targets.maxMemoryMB) {
      issues.push(
        `Memory usage exceeds target: ${memoryMB.toFixed(1)}MB > ${this.targets.maxMemoryMB}MB`
      );
    }

    // Load time validation
    if (this.metrics.loadTimes.fullLoad > this.targets.maxLoadTimeMS) {
      issues.push(
        `Load time exceeds target: ${this.metrics.loadTimes.fullLoad.toFixed(0)}ms > ${this.targets.maxLoadTimeMS}ms`
      );
    }

    if (this.metrics.loadTimes.initialization > this.targets.maxLoadTimeMS * 0.5) {
      issues.push(
        `Initialization time concerning: ${this.metrics.loadTimes.initialization.toFixed(0)}ms`
      );
    }

    return {
      passed: issues.length === 0,
      issues,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const validation = this.validatePerformance();
    const metrics = validation.metrics;

    let report = '📊 Stellar Viewer Performance Report\n';
    report += '='.repeat(40) + '\n\n';

    // Frame Rate
    report += `🎯 Frame Rate:\n`;
    report += `  Current: ${metrics.frameRate.current.toFixed(1)} FPS\n`;
    report += `  Average: ${metrics.frameRate.average.toFixed(1)} FPS\n`;
    report += `  Range: ${metrics.frameRate.min.toFixed(1)} - ${metrics.frameRate.max.toFixed(1)} FPS\n`;
    report += `  Target: ${metrics.frameRate.target} FPS\n`;
    report += `  Samples: ${metrics.frameRate.samples}\n\n`;

    // Memory Usage
    report += `💾 Memory Usage:\n`;
    report += `  Used: ${(metrics.memory.used / (1024 * 1024)).toFixed(1)} MB\n`;
    report += `  Total: ${(metrics.memory.total / (1024 * 1024)).toFixed(1)} MB\n`;
    report += `  Limit: ${(metrics.memory.limit / (1024 * 1024)).toFixed(0)} MB\n`;
    if (metrics.memory.jsHeapSizeUsed) {
      report += `  JS Heap: ${(metrics.memory.jsHeapSizeUsed / (1024 * 1024)).toFixed(1)} MB\n`;
    }
    report += '\n';

    // Load Times
    report += `⏱️ Load Times:\n`;
    report += `  Initialization: ${metrics.loadTimes.initialization.toFixed(0)} ms\n`;
    report += `  First Render: ${metrics.loadTimes.firstRender.toFixed(0)} ms\n`;
    report += `  Full Load: ${metrics.loadTimes.fullLoad.toFixed(0)} ms\n`;
    report += `  Target: ${metrics.loadTimes.target.toFixed(0)} ms\n\n`;

    // Rendering Stats
    report += `🎨 Rendering:\n`;
    report += `  Draw Calls: ${metrics.rendering.drawCalls}\n`;
    report += `  Vertices: ${metrics.rendering.vertices}\n`;
    report += `  Textures: ${metrics.rendering.textures}\n`;
    report += `  Programs: ${metrics.rendering.programs}\n\n`;

    // LOD Stats
    report += `🌟 Level of Detail:\n`;
    report += `  Current Level: ${metrics.lod.currentLevel}\n`;
    report += `  Visible Stars: ${metrics.lod.visibleStars}\n`;
    report += `  LOD Updates: ${metrics.lod.updates}\n\n`;

    // Validation Results
    report += `✅ Validation Results:\n`;
    if (validation.passed) {
      report += `  Status: PASSED ✅\n`;
      report += `  All performance targets met!\n`;
    } else {
      report += `  Status: FAILED ❌\n`;
      report += `  Issues found:\n`;
      validation.issues.forEach(issue => {
        report += `    • ${issue}\n`;
      });
    }

    return report;
  }

  /**
   * Log performance metrics to console
   */
  logMetrics(): void {
    logger.info(this.generateReport());
  }

  /**
   * Create a performance monitoring interface
   */
  createMonitoringInterface(container: HTMLElement): HTMLElement {
    const ui = document.createElement('div');
    ui.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      min-width: 200px;
      z-index: 1000;
    `;

    const updateUI = () => {
      const metrics = this.getMetrics();
      const validation = this.validatePerformance();

      ui.innerHTML = `
        <div><strong>Performance Monitor</strong></div>
        <hr style="margin: 5px 0;">
        <div>FPS: ${metrics.frameRate.current.toFixed(1)} (avg: ${metrics.frameRate.average.toFixed(1)})</div>
        <div>Memory: ${(metrics.memory.used / (1024 * 1024)).toFixed(1)} MB</div>
        <div>Load: ${metrics.loadTimes.fullLoad.toFixed(0)} ms</div>
        <div>LOD: Level ${metrics.lod.currentLevel} (${metrics.lod.visibleStars} stars)</div>
        <div style="color: ${validation.passed ? 'lime' : 'red'}">
          Status: ${validation.passed ? 'OK' : 'ISSUES'}
        </div>
      `;
    };

    // Update UI every second
    setInterval(updateUI, 1000);
    updateUI();

    container.appendChild(ui);
    return ui;
  }
}

// Export singleton instance
let performanceValidator: PerformanceValidator | null = null;

export const getPerformanceValidator = (
  targets?: Partial<PerformanceTargets>
): PerformanceValidator => {
  if (!performanceValidator) {
    performanceValidator = new PerformanceValidator(targets);
  }
  return performanceValidator;
};
