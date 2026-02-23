/**
 * Performance Monitoring Types and Utilities
 * Basic types for performance reporting functionality
 */

/**
 * Chrome-specific Performance extension with memory info
 * Note: performance.memory is non-standard and only available in Chrome/Chromium
 */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface PerformanceReport {
  timestamp: number;
  score: number;
  metrics: {
    lcp?: number; // Largest Contentful Paint
    inp?: number; // Interaction to Next Paint
    cls?: number; // Cumulative Layout Shift
    scrollFps?: number;
    renderTime?: number;
    memoryUsage?: number;
    domNodeCount?: number;
    sortTime?: number;
    filterTime?: number;
    selectAllTime?: number;
  };
  recommendations?: string[];
  url?: string;
  userAgent?: string;
}

export interface PerformanceMetrics {
  [key: string]: number | string | undefined;
}

export class PerformanceMonitor {
  private reports: PerformanceReport[] = [];
  private maxReports = 100;

  addReport(report: PerformanceReport): void {
    this.reports.push(report);

    // Keep only the latest reports
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(-this.maxReports);
    }
  }

  getReports(): PerformanceReport[] {
    return [...this.reports];
  }

  getLatestReport(): PerformanceReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  getAverageMetrics(): PerformanceMetrics {
    if (this.reports.length === 0) return {};

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    this.reports.forEach(report => {
      Object.entries(report.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          sums[key] = (sums[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      sums.score = (sums.score || 0) + report.score;
      counts.score = (counts.score || 0) + 1;
    });

    const averages: PerformanceMetrics = {};
    Object.entries(sums).forEach(([key, sum]) => {
      const count = counts[key] || 1;
      averages[key] = Math.round(sum / count);
    });

    return averages;
  }

  clear(): void {
    this.reports = [];
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// Basic metric collection utilities
export function measurePerformance<T>(
  name: string,
  fn: () => T,
  onMeasure?: (duration: number) => void
): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (onMeasure) {
    onMeasure(duration);
  }

  return result;
}

export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  onMeasure?: (duration: number) => void
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (onMeasure) {
    onMeasure(duration);
  }

  return result;
}

export function getBasicWebVitals(): Partial<PerformanceReport['metrics']> {
  const metrics: Partial<PerformanceReport['metrics']> = {};

  // Get memory usage if available (Chrome-specific)
  const performanceWithMemory = performance as PerformanceWithMemory;
  if ('memory' in performance && performanceWithMemory.memory) {
    const memory = performanceWithMemory.memory;
    metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
  }

  // Get DOM node count
  metrics.domNodeCount = document.querySelectorAll('*').length;

  return metrics;
}

export function createBasicReport(
  metrics: Partial<PerformanceReport['metrics']> = {},
  recommendations: string[] = []
): PerformanceReport {
  const baseMetrics = getBasicWebVitals();
  const allMetrics = { ...baseMetrics, ...metrics };

  // Calculate a basic score based on metrics
  let score = 100;

  if (allMetrics.lcp && allMetrics.lcp > 2500) score -= 20;
  if (allMetrics.inp && allMetrics.inp > 200) score -= 20;
  if (allMetrics.cls && allMetrics.cls > 0.1) score -= 20;
  if (allMetrics.memoryUsage && allMetrics.memoryUsage > 50) score -= 10;
  if (allMetrics.domNodeCount && allMetrics.domNodeCount > 1500) score -= 10;

  return {
    timestamp: Date.now(),
    score: Math.max(0, score),
    metrics: allMetrics,
    recommendations,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}
