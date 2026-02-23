/**
 * Performance Utilities for Stellar Dodecahedron Viewer
 * Export performance monitoring and memory management utilities
 */

export { PerformanceMonitor } from './PerformanceMonitor.js';
export { MemoryManager } from './MemoryManager.js';

// Convenience function to create and configure both utilities
export function createPerformanceTools(options = {}) {
  const performanceMonitor = new PerformanceMonitor();
  const memoryManager = new MemoryManager();

  if (options.startMonitoring !== false) {
    performanceMonitor.start();
    memoryManager.startMonitoring();
  }

  return {
    performanceMonitor,
    memoryManager,
  };
}
