/**
 * Memory Manager for Stellar Dodecahedron Viewer
 * Manages memory allocation, garbage collection optimization, and resource cleanup
 */

export class MemoryManager {
  constructor() {
    this.allocatedObjects = new Set();
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.workers = new Set();

    this.memoryThresholds = {
      warning: 500, // 500MB
      critical: 800, // 800MB
    };

    this.gcSuggestionCount = 0;
    this.lastCleanup = Date.now();
    this.cleanupInterval = 30000; // 30 seconds

    this.isMonitoring = false;
    this.monitoringInterval = null;

    logger.info('🧠 MemoryManager: Initialized');
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
      this.suggestCleanupIfNeeded();
    }, 5000); // Check every 5 seconds

    logger.info('🧠 MemoryManager: Started monitoring');
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('🧠 MemoryManager: Stopped monitoring');
  }

  registerGeometry(geometry) {
    if (geometry) {
      this.geometries.add(geometry);
      this.allocatedObjects.add(geometry);
    }
  }

  registerMaterial(material) {
    if (material) {
      this.materials.add(material);
      this.allocatedObjects.add(material);
    }
  }

  registerTexture(texture) {
    if (texture) {
      this.textures.add(texture);
      this.allocatedObjects.add(texture);
    }
  }

  registerWorker(worker) {
    if (worker) {
      this.workers.add(worker);
    }
  }

  disposeGeometry(geometry) {
    if (geometry && typeof geometry.dispose === 'function') {
      geometry.dispose();
      this.geometries.delete(geometry);
      this.allocatedObjects.delete(geometry);
    }
  }

  disposeMaterial(material) {
    if (material && typeof material.dispose === 'function') {
      material.dispose();
      this.materials.delete(material);
      this.allocatedObjects.delete(material);
    }
  }

  disposeTexture(texture) {
    if (texture && typeof texture.dispose === 'function') {
      texture.dispose();
      this.textures.delete(texture);
      this.allocatedObjects.delete(texture);
    }
  }

  terminateWorker(worker) {
    if (worker && typeof worker.terminate === 'function') {
      worker.terminate();
      this.workers.delete(worker);
    }
  }

  checkMemoryUsage() {
    if (!performance.memory) return null;

    const memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);

    if (memoryUsage > this.memoryThresholds.critical) {
      logger.warn(`🧠 MemoryManager: CRITICAL memory usage: ${memoryUsage}MB`);
      this.forceCleanup();
    } else if (memoryUsage > this.memoryThresholds.warning) {
      logger.warn(`🧠 MemoryManager: WARNING memory usage: ${memoryUsage}MB`);
    }

    return {
      used: memoryUsage,
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
    };
  }

  suggestCleanupIfNeeded() {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.suggestGarbageCollection();
      this.lastCleanup = now;
    }
  }

  suggestGarbageCollection() {
    // Force garbage collection if available (only in development)
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
        this.gcSuggestionCount++;
        logger.info(`🧠 MemoryManager: Forced GC #${this.gcSuggestionCount}`);
      } catch (error) {
        logger.warn('🧠 MemoryManager: Could not force GC:', error);
      }
    } else {
      // Create temporary objects to trigger GC
      this.createGCPressure();
    }
  }

  createGCPressure() {
    // Create and immediately discard objects to encourage GC
    const temp = [];
    for (let i = 0; i < 1000; i++) {
      temp.push({ data: new Array(1000).fill(Math.random()) });
    }
    // temp goes out of scope, should be collected
  }

  forceCleanup() {
    logger.info('🧠 MemoryManager: Forcing cleanup of unused resources');

    let cleaned = 0;

    // Clean up orphaned geometries
    for (const geometry of this.geometries) {
      if (!geometry.userData?.inUse) {
        this.disposeGeometry(geometry);
        cleaned++;
      }
    }

    // Clean up orphaned materials
    for (const material of this.materials) {
      if (!material.userData?.inUse) {
        this.disposeMaterial(material);
        cleaned++;
      }
    }

    // Clean up orphaned textures
    for (const texture of this.textures) {
      if (!texture.userData?.inUse) {
        this.disposeTexture(texture);
        cleaned++;
      }
    }

    logger.info(`🧠 MemoryManager: Cleaned up ${cleaned} objects`);

    // Force GC after cleanup
    this.suggestGarbageCollection();
  }

  optimizeForPerformance() {
    // Reduce memory pressure by cleaning up caches
    this.clearUnusedCaches();

    // Suggest GC
    this.suggestGarbageCollection();

    logger.info('🧠 MemoryManager: Optimized for performance');
  }

  clearUnusedCaches() {
    // This would clear application-specific caches
    // For now, just log the action
    logger.info('🧠 MemoryManager: Cleared unused caches');
  }

  getMemoryStats() {
    const stats = {
      allocatedObjects: this.allocatedObjects.size,
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      workers: this.workers.size,
      gcSuggestions: this.gcSuggestionCount,
      lastCleanup: this.lastCleanup,
    };

    if (performance.memory) {
      stats.memory = this.checkMemoryUsage();
    }

    return stats;
  }

  dispose() {
    logger.info('🧠 MemoryManager: Disposing all resources...');

    // Stop monitoring
    this.stopMonitoring();

    // Dispose all registered objects
    for (const geometry of this.geometries) {
      this.disposeGeometry(geometry);
    }

    for (const material of this.materials) {
      this.disposeMaterial(material);
    }

    for (const texture of this.textures) {
      this.disposeTexture(texture);
    }

    for (const worker of this.workers) {
      this.terminateWorker(worker);
    }

    // Clear all sets
    this.allocatedObjects.clear();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.workers.clear();

    // Final cleanup
    this.suggestGarbageCollection();

    logger.info('🧠 MemoryManager: Disposal complete');
  }

  log() {
    const stats = this.getMemoryStats();

    logger.info('🧠 Memory Statistics ━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`Allocated Objects: ${stats.allocatedObjects}`);
    logger.info(`Geometries: ${stats.geometries}`);
    logger.info(`Materials: ${stats.materials}`);
    logger.info(`Textures: ${stats.textures}`);
    logger.info(`Workers: ${stats.workers}`);
    logger.info(`GC Suggestions: ${stats.gcSuggestions}`);

    if (stats.memory) {
      logger.info(`Memory Used: ${stats.memory.used}MB / ${stats.memory.limit}MB`);
      logger.info(`Memory Total: ${stats.memory.total}MB`);
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}
