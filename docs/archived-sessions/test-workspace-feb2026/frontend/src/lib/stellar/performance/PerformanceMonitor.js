/**
 * Performance Monitor for Stellar Dodecahedron Viewer
 * Tracks FPS, memory usage, render calls, and performance metrics
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      memoryUsage: 0,
      renderCalls: 0,
      triangles: 0,
      points: 0,
      textures: 0,
      geometries: 0,
      programs: 0,
      lastUpdate: performance.now(),
    };

    this.frameCount = 0;
    this.lastFPSUpdate = performance.now();
    this.fpsHistory = [];
    this.maxHistoryLength = 60; // Keep 60 frames of history

    this.isRunning = false;
    this.callbacks = [];
  }

  start() {
    this.isRunning = true;
    this.lastFPSUpdate = performance.now();
    logger.info('🔍 PerformanceMonitor: Started monitoring');
  }

  stop() {
    this.isRunning = false;
    logger.info('🔍 PerformanceMonitor: Stopped monitoring');
  }

  update(renderer = null) {
    if (!this.isRunning) return;

    const now = performance.now();
    this.frameCount++;

    // Update frame time
    this.metrics.frameTime = now - this.metrics.lastUpdate;
    this.metrics.lastUpdate = now;

    // Calculate FPS every second
    if (now - this.lastFPSUpdate >= 1000) {
      this.metrics.fps = (this.frameCount * 1000) / (now - this.lastFPSUpdate);

      // Add to history
      this.fpsHistory.push(this.metrics.fps);
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }

      this.frameCount = 0;
      this.lastFPSUpdate = now;
    }

    // Update memory usage if available
    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }

    // Update Three.js renderer metrics if available
    if (renderer && renderer.info) {
      this.metrics.renderCalls = renderer.info.render.calls;
      this.metrics.triangles = renderer.info.render.triangles;
      this.metrics.points = renderer.info.render.points;
      this.metrics.textures = renderer.info.memory.textures;
      this.metrics.geometries = renderer.info.memory.geometries;
      this.metrics.programs = renderer.info.programs?.length || 0;
    }

    // Notify callbacks
    this.notifyCallbacks();
  }

  addCallback(callback) {
    this.callbacks.push(callback);
  }

  removeCallback(callback) {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  notifyCallbacks() {
    for (const callback of this.callbacks) {
      try {
        callback(this.metrics);
      } catch (error) {
        logger.warn('PerformanceMonitor callback error:', error);
      }
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getAverageFPS() {
    if (this.fpsHistory.length === 0) return this.metrics.fps;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  getMinFPS() {
    if (this.fpsHistory.length === 0) return this.metrics.fps;
    return Math.min(...this.fpsHistory);
  }

  getMaxFPS() {
    if (this.fpsHistory.length === 0) return this.metrics.fps;
    return Math.max(...this.fpsHistory);
  }

  isPerformingWell() {
    const avgFPS = this.getAverageFPS();
    const minFPS = this.getMinFPS();

    // Consider performance good if average FPS > 55 and minimum > 30
    return avgFPS > 55 && minFPS > 30;
  }

  getPerformanceGrade() {
    const avgFPS = this.getAverageFPS();

    if (avgFPS >= 58) return 'A'; // Excellent
    if (avgFPS >= 45) return 'B'; // Good
    if (avgFPS >= 30) return 'C'; // Fair
    if (avgFPS >= 20) return 'D'; // Poor
    return 'F'; // Very poor
  }

  reset() {
    this.frameCount = 0;
    this.lastFPSUpdate = performance.now();
    this.fpsHistory = [];
    this.metrics.lastUpdate = performance.now();
    logger.info('🔍 PerformanceMonitor: Reset metrics');
  }

  log() {
    logger.info('🔍 Performance Metrics ━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`FPS: ${this.metrics.fps.toFixed(1)} (avg: ${this.getAverageFPS().toFixed(1)})`);
    logger.info(`Frame Time: ${this.metrics.frameTime.toFixed(2)}ms`);
    logger.info(`Memory Usage: ${this.metrics.memoryUsage}MB`);
    logger.info(`Render Calls: ${this.metrics.renderCalls}`);
    logger.info(`Triangles: ${this.metrics.triangles.toLocaleString()}`);
    logger.info(`Points: ${this.metrics.points.toLocaleString()}`);
    logger.info(`Performance Grade: ${this.getPerformanceGrade()}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}
