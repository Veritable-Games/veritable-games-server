/**
 * Image Optimization Analysis Tools
 * Comprehensive tools for analyzing and monitoring image performance
 */

import { logger } from '@/lib/utils/logger';

/**
 * Network Information API connection interface
 * https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */
interface NetworkInformation extends EventTarget {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

/**
 * Navigator with Network Information API support
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

export interface ImageOptimizationReport {
  overview: {
    totalImages: number;
    totalSize: number;
    optimizedSize: number;
    savings: number;
    savingsPercent: number;
  };
  formatAnalysis: {
    [format: string]: {
      count: number;
      size: number;
      avgSize: number;
      avgLoadTime: number;
      compression: number;
    };
  };
  performanceMetrics: {
    avgLoadTime: number;
    cacheHitRate: number;
    lazyLoadingRate: number;
    modernFormatUsage: number;
  };
  recommendations: Array<{
    type: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    implementation: string;
    estimatedSavings?: string;
  }>;
  technicalDetails: {
    browserSupport: {
      avif: number;
      webp: number;
      modernFormats: number;
    };
    networkAnalysis: {
      slowConnections: number;
      fastConnections: number;
      avgBandwidth: number;
    };
    deviceAnalysis: {
      desktop: number;
      mobile: number;
      tablet: number;
      highDPI: number;
    };
  };
}

export interface ImageAuditResult {
  url: string;
  currentFormat: string;
  currentSize: number;
  recommendedFormat: string;
  potentialSavings: number;
  issues: string[];
  optimizations: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Comprehensive image optimization analyzer
 */
export class ImageOptimizationAnalyzer {
  private metrics: any[] = [];
  private browserSupport: any = {};
  private networkInfo: any = {};

  constructor() {
    this.initializeBrowserDetection();
    this.initializeNetworkDetection();
  }

  /**
   * Initialize browser capability detection
   */
  private initializeBrowserDetection(): void {
    if (typeof window === 'undefined') return;

    // Detect format support
    this.detectFormatSupport().then(support => {
      this.browserSupport = support;
    });
  }

  /**
   * Initialize network detection
   */
  private initializeNetworkDetection(): void {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      this.networkInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };

      connection.addEventListener('change', () => {
        this.networkInfo = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        };
      });
    }
  }

  /**
   * Detect browser format support
   */
  private async detectFormatSupport(): Promise<{
    avif: boolean;
    webp: boolean;
    heif: boolean;
  }> {
    const support = {
      avif: false,
      webp: false,
      heif: false,
    };

    try {
      // Test AVIF
      support.avif = await this.testImageFormat(
        'avif',
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
      );

      // Test WebP
      support.webp = await this.testImageFormat(
        'webp',
        'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
      );

      // Test HEIF (iOS Safari)
      support.heif = await this.testImageFormat(
        'heif',
        'data:image/heif;base64,AAAAGGZ0eXBoZWljAAAAAG1pZjEAAAGwbWV0YQAAAAAAAAAmAAAAaGFuZGwAAAAAAAAAbWlmMWhlbGwAAQAAABZjb2xvchZlbmNkxgAAAAAAABZhcHJvcARSR0IA'
      );
    } catch (error) {
      logger.warn('Format detection failed:', error);
    }

    return support;
  }

  /**
   * Test specific image format support
   */
  private async testImageFormat(format: string, testData: string): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      const timeout = setTimeout(() => resolve(false), 1000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve(img.width > 0 && img.height > 0);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      img.src = testData;
    });
  }

  /**
   * Add performance metric
   */
  addMetric(metric: {
    url: string;
    loadTime: number;
    fileSize: number;
    format: string;
    cached: boolean;
    lazy: boolean;
    dimensions: { width: number; height: number };
  }): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
      networkInfo: { ...this.networkInfo },
      browserSupport: { ...this.browserSupport },
    });

    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  generateReport(): ImageOptimizationReport {
    if (this.metrics.length === 0) {
      return this.getEmptyReport();
    }

    const overview = this.calculateOverview();
    const formatAnalysis = this.analyzeFormats();
    const performanceMetrics = this.calculatePerformanceMetrics();
    const recommendations = this.generateRecommendations();
    const technicalDetails = this.analyzeTechnicalDetails();

    return {
      overview,
      formatAnalysis,
      performanceMetrics,
      recommendations,
      technicalDetails,
    };
  }

  /**
   * Calculate overview statistics
   */
  private calculateOverview(): ImageOptimizationReport['overview'] {
    const totalSize = this.metrics.reduce((sum, m) => sum + m.fileSize, 0);
    const avgJpegSize = this.getAverageFormatSize('jpeg');
    const estimatedOptimizedSize = this.estimateOptimizedSize();

    const savings = totalSize - estimatedOptimizedSize;
    const savingsPercent = totalSize > 0 ? (savings / totalSize) * 100 : 0;

    return {
      totalImages: this.metrics.length,
      totalSize,
      optimizedSize: estimatedOptimizedSize,
      savings,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
    };
  }

  /**
   * Analyze image formats
   */
  private analyzeFormats(): ImageOptimizationReport['formatAnalysis'] {
    const formatGroups = this.groupByFormat();
    const analysis: ImageOptimizationReport['formatAnalysis'] = {};

    for (const [format, metrics] of Object.entries(formatGroups)) {
      const totalSize = metrics.reduce((sum, m) => sum + m.fileSize, 0);
      const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;

      // Calculate compression ratio relative to JPEG
      const jpegBaseline = this.getAverageFormatSize('jpeg');
      const compression =
        jpegBaseline > 0 ? ((jpegBaseline - totalSize / metrics.length) / jpegBaseline) * 100 : 0;

      analysis[format] = {
        count: metrics.length,
        size: totalSize,
        avgSize: Math.round(totalSize / metrics.length),
        avgLoadTime: Math.round(avgLoadTime),
        compression: Math.round(compression * 100) / 100,
      };
    }

    return analysis;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(): ImageOptimizationReport['performanceMetrics'] {
    const avgLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / this.metrics.length;
    const cachedCount = this.metrics.filter(m => m.cached).length;
    const lazyCount = this.metrics.filter(m => m.lazy).length;
    const modernFormatCount = this.metrics.filter(
      m => m.format === 'avif' || m.format === 'webp'
    ).length;

    return {
      avgLoadTime: Math.round(avgLoadTime),
      cacheHitRate: Math.round((cachedCount / this.metrics.length) * 100),
      lazyLoadingRate: Math.round((lazyCount / this.metrics.length) * 100),
      modernFormatUsage: Math.round((modernFormatCount / this.metrics.length) * 100),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): ImageOptimizationReport['recommendations'] {
    const recommendations: ImageOptimizationReport['recommendations'] = [];

    // Check format modernization
    const modernFormatUsage = this.calculatePerformanceMetrics().modernFormatUsage;
    if (modernFormatUsage < 70) {
      recommendations.push({
        type: 'critical',
        title: 'Implement Modern Image Formats',
        description: `Only ${modernFormatUsage}% of images use modern formats (AVIF/WebP). Modern formats can reduce file sizes by 30-50%.`,
        impact: 'high',
        implementation:
          'Add AVIF and WebP support with proper fallbacks using Picture element or Next.js Image component.',
        estimatedSavings: '30-50% file size reduction',
      });
    }

    // Check lazy loading
    const lazyLoadingRate = this.calculatePerformanceMetrics().lazyLoadingRate;
    if (lazyLoadingRate < 80) {
      recommendations.push({
        type: 'warning',
        title: 'Increase Lazy Loading Usage',
        description: `Only ${lazyLoadingRate}% of images use lazy loading. This affects initial page load performance.`,
        impact: 'medium',
        implementation:
          'Implement lazy loading for below-the-fold images using loading="lazy" or Intersection Observer.',
        estimatedSavings: '20-40% faster initial page load',
      });
    }

    // Check cache efficiency
    const cacheHitRate = this.calculatePerformanceMetrics().cacheHitRate;
    if (cacheHitRate < 75) {
      recommendations.push({
        type: 'warning',
        title: 'Improve Image Caching',
        description: `Cache hit rate is only ${cacheHitRate}%. Better caching can significantly improve repeat visit performance.`,
        impact: 'medium',
        implementation: 'Implement proper cache headers and service worker caching strategies.',
        estimatedSavings: '50-70% faster repeat visits',
      });
    }

    // Check load times
    const avgLoadTime = this.calculatePerformanceMetrics().avgLoadTime;
    if (avgLoadTime > 1000) {
      recommendations.push({
        type: 'critical',
        title: 'Optimize Image Load Times',
        description: `Average image load time is ${avgLoadTime}ms. This negatively impacts user experience and Core Web Vitals.`,
        impact: 'high',
        implementation:
          'Reduce image sizes, implement progressive loading, and use CDN for image delivery.',
        estimatedSavings: '40-60% faster image loading',
      });
    }

    // Check AVIF support
    if (this.browserSupport.avif && this.getFormatUsage('avif') < 30) {
      recommendations.push({
        type: 'info',
        title: 'Leverage AVIF Format',
        description:
          'Your browser supports AVIF, which offers superior compression compared to WebP and JPEG.',
        impact: 'high',
        implementation: 'Implement AVIF format with WebP and JPEG fallbacks.',
        estimatedSavings: '40-60% smaller file sizes',
      });
    }

    return recommendations;
  }

  /**
   * Analyze technical details
   */
  private analyzeTechnicalDetails(): ImageOptimizationReport['technicalDetails'] {
    // Browser support analysis
    const browserSupportMetrics = this.metrics.filter(m => m.browserSupport);
    const avifSupport = browserSupportMetrics.filter(m => m.browserSupport.avif).length;
    const webpSupport = browserSupportMetrics.filter(m => m.browserSupport.webp).length;

    // Network analysis
    const networkMetrics = this.metrics.filter(m => m.networkInfo);
    const slowConnections = networkMetrics.filter(
      m => m.networkInfo.effectiveType === '2g' || m.networkInfo.effectiveType === 'slow-2g'
    ).length;

    // Device analysis (rough estimation based on viewport)
    const mobileCount = this.metrics.filter(m => m.dimensions.width <= 768).length;

    return {
      browserSupport: {
        avif:
          browserSupportMetrics.length > 0
            ? Math.round((avifSupport / browserSupportMetrics.length) * 100)
            : 0,
        webp:
          browserSupportMetrics.length > 0
            ? Math.round((webpSupport / browserSupportMetrics.length) * 100)
            : 0,
        modernFormats:
          browserSupportMetrics.length > 0
            ? Math.round(((avifSupport + webpSupport) / (browserSupportMetrics.length * 2)) * 100)
            : 0,
      },
      networkAnalysis: {
        slowConnections:
          networkMetrics.length > 0
            ? Math.round((slowConnections / networkMetrics.length) * 100)
            : 0,
        fastConnections:
          networkMetrics.length > 0
            ? Math.round(((networkMetrics.length - slowConnections) / networkMetrics.length) * 100)
            : 0,
        avgBandwidth:
          networkMetrics.length > 0
            ? Math.round(
                (networkMetrics.reduce((sum, m) => sum + (m.networkInfo.downlink || 0), 0) /
                  networkMetrics.length) *
                  100
              ) / 100
            : 0,
      },
      deviceAnalysis: {
        mobile: Math.round((mobileCount / this.metrics.length) * 100),
        desktop: Math.round(((this.metrics.length - mobileCount) / this.metrics.length) * 100),
        tablet: 0, // Simplified for now
        highDPI: 0, // Would need device pixel ratio data
      },
    };
  }

  /**
   * Audit specific images for optimization opportunities
   */
  auditImages(imageUrls: string[]): Promise<ImageAuditResult[]> {
    return Promise.all(imageUrls.map(url => this.auditSingleImage(url)));
  }

  /**
   * Audit single image
   */
  private async auditSingleImage(url: string): Promise<ImageAuditResult> {
    try {
      // Get image metadata
      const metadata = await this.getImageMetadata(url);
      const issues: string[] = [];
      const optimizations: string[] = [];

      // Check file size
      if (metadata.size > 500000) {
        // 500KB
        issues.push('Image file size is very large (>500KB)');
        optimizations.push('Compress image or use modern formats');
      }

      // Check format
      let recommendedFormat = metadata.format;
      if (this.browserSupport.avif && metadata.format !== 'avif') {
        recommendedFormat = 'avif';
        optimizations.push('Convert to AVIF format for better compression');
      } else if (this.browserSupport.webp && metadata.format === 'jpeg') {
        recommendedFormat = 'webp';
        optimizations.push('Convert to WebP format for better compression');
      }

      // Check dimensions
      if (metadata.width > 2048 || metadata.height > 2048) {
        issues.push('Image dimensions are very large');
        optimizations.push('Resize image to appropriate dimensions');
      }

      // Estimate potential savings
      const potentialSavings = this.estimateSavings(
        metadata.format,
        recommendedFormat,
        metadata.size
      );

      // Determine priority
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (metadata.size > 1000000 || potentialSavings > 50) priority = 'high';
      else if (metadata.size > 500000 || potentialSavings > 30) priority = 'medium';

      return {
        url,
        currentFormat: metadata.format,
        currentSize: metadata.size,
        recommendedFormat,
        potentialSavings,
        issues,
        optimizations,
        priority,
      };
    } catch (error) {
      return {
        url,
        currentFormat: 'unknown',
        currentSize: 0,
        recommendedFormat: 'unknown',
        potentialSavings: 0,
        issues: ['Unable to analyze image'],
        optimizations: [],
        priority: 'low',
      };
    }
  }

  /**
   * Get image metadata
   */
  private async getImageMetadata(url: string): Promise<{
    format: string;
    size: number;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          // Try to get file size from network
          const response = await fetch(url, { method: 'HEAD' });
          const size = parseInt(response.headers.get('content-length') || '0', 10);

          // Detect format from URL or content-type
          const contentType = response.headers.get('content-type') || '';
          let format = 'unknown';

          if (contentType.includes('avif')) format = 'avif';
          else if (contentType.includes('webp')) format = 'webp';
          else if (contentType.includes('jpeg')) format = 'jpeg';
          else if (contentType.includes('png')) format = 'png';
          else {
            // Fallback to URL extension
            const ext = url.split('.').pop()?.toLowerCase();
            format = ext || 'unknown';
          }

          resolve({
            format,
            size,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } catch (error) {
          resolve({
            format: 'unknown',
            size: 0,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  /**
   * Helper methods
   */
  private groupByFormat(): Record<string, any[]> {
    return this.metrics.reduce(
      (groups, metric) => {
        const format = metric.format || 'unknown';
        if (!groups[format]) groups[format] = [];
        groups[format].push(metric);
        return groups;
      },
      {} as Record<string, any[]>
    );
  }

  private getAverageFormatSize(format: string): number {
    const formatMetrics = this.metrics.filter(m => m.format === format);
    if (formatMetrics.length === 0) return 0;
    return formatMetrics.reduce((sum, m) => sum + m.fileSize, 0) / formatMetrics.length;
  }

  private getFormatUsage(format: string): number {
    const formatCount = this.metrics.filter(m => m.format === format).length;
    return this.metrics.length > 0 ? (formatCount / this.metrics.length) * 100 : 0;
  }

  private estimateOptimizedSize(): number {
    return this.metrics.reduce((sum, metric) => {
      const optimizedSize = this.estimateOptimalSize(metric.format, metric.fileSize);
      return sum + optimizedSize;
    }, 0);
  }

  private estimateOptimalSize(currentFormat: string, currentSize: number): number {
    // Estimation based on typical compression ratios
    const compressionRatios: Record<string, number> = {
      jpeg: 1.0, // baseline
      png: 0.7, // 30% savings possible
      webp: 0.65, // 35% savings vs JPEG
      avif: 0.5, // 50% savings vs JPEG
    };

    if (this.browserSupport.avif) {
      return currentSize * (compressionRatios.avif || 0.5);
    } else if (this.browserSupport.webp) {
      return currentSize * (compressionRatios.webp || 0.65);
    }

    return currentSize * (compressionRatios[currentFormat] || 1.0);
  }

  private estimateSavings(
    currentFormat: string,
    recommendedFormat: string,
    currentSize: number
  ): number {
    const currentOptimal = this.estimateOptimalSize(currentFormat, currentSize);
    const recommendedOptimal = this.estimateOptimalSize(recommendedFormat, currentSize);

    return Math.round(((currentOptimal - recommendedOptimal) / currentOptimal) * 100);
  }

  private getEmptyReport(): ImageOptimizationReport {
    return {
      overview: {
        totalImages: 0,
        totalSize: 0,
        optimizedSize: 0,
        savings: 0,
        savingsPercent: 0,
      },
      formatAnalysis: {},
      performanceMetrics: {
        avgLoadTime: 0,
        cacheHitRate: 0,
        lazyLoadingRate: 0,
        modernFormatUsage: 0,
      },
      recommendations: [
        {
          type: 'info',
          title: 'No Data Available',
          description: 'Start using optimized images to see analysis and recommendations.',
          impact: 'low',
          implementation: 'Use the OptimizedImage component to begin collecting metrics.',
        },
      ],
      technicalDetails: {
        browserSupport: { avif: 0, webp: 0, modernFormats: 0 },
        networkAnalysis: { slowConnections: 0, fastConnections: 0, avgBandwidth: 0 },
        deviceAnalysis: { desktop: 0, mobile: 0, tablet: 0, highDPI: 0 },
      },
    };
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics: this.metrics,
        browserSupport: this.browserSupport,
        networkInfo: this.networkInfo,
        report: this.generateReport(),
      },
      null,
      2
    );
  }

  /**
   * Clear collected metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const imageAnalyzer = new ImageOptimizationAnalyzer();
