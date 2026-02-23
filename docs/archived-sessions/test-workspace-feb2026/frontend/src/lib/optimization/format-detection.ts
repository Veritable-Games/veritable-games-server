/**
 * Advanced Image Format Detection and Serving System
 * Implements browser capability detection and automatic format optimization
 */

import { logger } from '@/lib/utils/logger';

/**
 * Experimental Browser APIs (not yet in standard TypeScript types)
 */
interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener(type: string, listener: EventListener): void;
}

interface BatteryManager {
  level: number;
  charging: boolean;
}

interface NavigatorWithExperimentalAPIs extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  battery?: BatteryManager;
}

export interface FormatSupport {
  avif: boolean;
  webp: boolean;
  heif: boolean;
  webp2: boolean;
  jxl: boolean;
}

export interface OptimizedImageFormats {
  avif?: string;
  webp?: string;
  jpeg?: string;
  png?: string;
  fallback: string;
}

/**
 * Detect browser image format support using feature detection
 */
export class ImageFormatDetector {
  private static instance: ImageFormatDetector;
  private supportCache: FormatSupport | null = null;
  private detectionPromise: Promise<FormatSupport> | null = null;

  static getInstance(): ImageFormatDetector {
    if (!ImageFormatDetector.instance) {
      ImageFormatDetector.instance = new ImageFormatDetector();
    }
    return ImageFormatDetector.instance;
  }

  /**
   * Get browser format support with caching
   */
  async getFormatSupport(): Promise<FormatSupport> {
    // Return cached result if available
    if (this.supportCache) {
      return this.supportCache;
    }

    // Return ongoing detection promise if exists
    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    // Start new detection
    this.detectionPromise = this.detectFormats();
    this.supportCache = await this.detectionPromise;
    this.detectionPromise = null;

    return this.supportCache;
  }

  /**
   * Detect format support using canvas and fetch API
   */
  private async detectFormats(): Promise<FormatSupport> {
    const support: FormatSupport = {
      avif: false,
      webp: false,
      heif: false,
      webp2: false,
      jxl: false,
    };

    // Test AVIF support
    support.avif = await this.testFormat(
      'avif',
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
    );

    // Test WebP support
    support.webp = await this.testFormat(
      'webp',
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
    );

    // Test HEIF support (iOS Safari 11+)
    support.heif = await this.testFormat(
      'heif',
      'data:image/heif;base64,AAAAGGZ0eXBoZWljAAAAAG1pZjEAAAGwbWV0YQAAAAAAAAAmAAAAaGFuZGwAAAAAAAAAbWlmMWhlbGwAAQAAABZjb2xvchZlbmNkxgAAAAAAABZhcHJvcARSR0IA'
    );

    // Test WebP2 support (experimental)
    support.webp2 = await this.testFormat('webp2', '');

    // Test JPEG XL support (experimental)
    support.jxl = await this.testFormat('jxl', '');

    // Store in localStorage for faster subsequent loads
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(
          'imageFormatSupport',
          JSON.stringify({
            ...support,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        // LocalStorage not available or full
      }
    }

    return support;
  }

  /**
   * Test specific format support using canvas
   */
  private async testFormat(format: string, testImage: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Try canvas approach first
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      canvas.width = 1;
      canvas.height = 1;

      const dataURL = canvas.toDataURL(`image/${format}`, 0.5);
      return dataURL.indexOf(`data:image/${format}`) === 0;
    } catch (e) {
      // Canvas test failed, try fetch test if testImage provided
    }

    // Fallback to fetch test for specific formats
    if (testImage) {
      try {
        const img = new Image();
        return new Promise<boolean>(resolve => {
          const timeout = setTimeout(() => resolve(false), 1000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve(img.width > 0 && img.height > 0);
          };

          img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };

          img.src = testImage;
        });
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  /**
   * Get cached format support from localStorage
   */
  getCachedSupport(): FormatSupport | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;

    try {
      const cached = localStorage.getItem('imageFormatSupport');
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      // Cache valid for 7 days
      if (age > 7 * 24 * 60 * 60 * 1000) return null;

      return {
        avif: data.avif,
        webp: data.webp,
        heif: data.heif,
        webp2: data.webp2,
        jxl: data.jxl,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Initialize format detection on page load
   */
  initialize(): void {
    if (typeof window === 'undefined') return;

    // Try to get cached support first
    const cached = this.getCachedSupport();
    if (cached) {
      this.supportCache = cached;
    } else {
      // Detect asynchronously
      this.getFormatSupport().catch(err => logger.warn('Format detection failed', err));
    }
  }
}

/**
 * Smart image source selector based on browser capabilities
 */
export class SmartImageSourceSelector {
  private formatDetector: ImageFormatDetector;

  constructor() {
    this.formatDetector = ImageFormatDetector.getInstance();
  }

  /**
   * Select optimal image source based on browser support and preferences
   */
  async selectOptimalSource(
    sources: OptimizedImageFormats,
    preferences: {
      quality: 'low' | 'medium' | 'high';
      bandwidth: 'low' | 'medium' | 'high';
      preferSpeed: boolean;
    } = { quality: 'high', bandwidth: 'high', preferSpeed: false }
  ): Promise<string> {
    const support = await this.formatDetector.getFormatSupport();

    // Priority order based on compression efficiency and quality
    const formatPriority = this.getFormatPriority(support, preferences);

    for (const format of formatPriority) {
      if (sources[format as keyof OptimizedImageFormats]) {
        return sources[format as keyof OptimizedImageFormats]!;
      }
    }

    return sources.fallback;
  }

  /**
   * Get format priority based on support and preferences
   */
  private getFormatPriority(
    support: FormatSupport,
    preferences: {
      quality: 'low' | 'medium' | 'high';
      bandwidth: 'low' | 'medium' | 'high';
      preferSpeed: boolean;
    }
  ): string[] {
    const priority: string[] = [];

    // AVIF has best compression (30-50% smaller than JPEG)
    if (support.avif && preferences.quality !== 'low') {
      priority.push('avif');
    }

    // JPEG XL has excellent compression and features
    if (support.jxl && preferences.quality === 'high') {
      priority.push('jxl');
    }

    // WebP has good compression (25-35% smaller than JPEG)
    if (support.webp) {
      priority.push('webp');
    }

    // HEIF for Apple devices
    if (support.heif && preferences.quality !== 'low') {
      priority.push('heif');
    }

    // Fallback to traditional formats
    if (preferences.preferSpeed || preferences.bandwidth === 'low') {
      priority.push('jpeg', 'png');
    } else {
      priority.push('png', 'jpeg');
    }

    return priority;
  }

  /**
   * Generate picture element sources for responsive images
   */
  async generatePictureSources(
    baseUrl: string,
    sizes: number[] = [640, 768, 1024, 1280, 1600, 1920],
    formats: string[] = ['avif', 'webp', 'jpeg']
  ): Promise<Array<{ srcSet: string; type: string; media?: string }>> {
    const support = await this.formatDetector.getFormatSupport();
    const sources: Array<{ srcSet: string; type: string; media?: string }> = [];

    for (const format of formats) {
      // Skip unsupported formats
      if (!this.isFormatSupported(format, support)) continue;

      const srcSet = sizes
        .map(size => `${this.generateFormatUrl(baseUrl, format, size)} ${size}w`)
        .join(', ');

      sources.push({
        srcSet,
        type: `image/${format}`,
      });
    }

    return sources;
  }

  /**
   * Check if format is supported
   */
  private isFormatSupported(format: string, support: FormatSupport): boolean {
    switch (format) {
      case 'avif':
        return support.avif;
      case 'webp':
        return support.webp;
      case 'heif':
        return support.heif;
      case 'jxl':
        return support.jxl;
      case 'webp2':
        return support.webp2;
      default:
        return true; // jpeg, png always supported
    }
  }

  /**
   * Generate format-specific URL
   */
  private generateFormatUrl(baseUrl: string, format: string, width?: number): string {
    // For Next.js images
    if (baseUrl.startsWith('/_next/') || baseUrl.startsWith('/')) {
      const params = new URLSearchParams();
      if (width) params.set('w', width.toString());
      params.set('f', format);
      return `/_next/image?url=${encodeURIComponent(baseUrl)}&${params.toString()}`;
    }

    // For external URLs, add format parameters based on CDN
    try {
      const url = new URL(baseUrl);

      // Cloudinary
      if (url.hostname.includes('cloudinary')) {
        const pathParts = url.pathname.split('/');
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex !== -1) {
          pathParts.splice(uploadIndex + 1, 0, `f_${format}`, width ? `w_${width}` : '');
          url.pathname = pathParts.filter(Boolean).join('/');
        }
        return url.toString();
      }

      // Imgix
      if (url.hostname.includes('imgix')) {
        url.searchParams.set('fm', format);
        if (width) url.searchParams.set('w', width.toString());
        return url.toString();
      }

      // Generic CDN with query parameters
      url.searchParams.set('format', format);
      if (width) url.searchParams.set('width', width.toString());
      return url.toString();
    } catch (e) {
      return baseUrl;
    }
  }
}

/**
 * Network-aware image loading
 */
export class NetworkAwareImageLoader {
  private connection: NetworkInformation | undefined;
  private quality: 'low' | 'medium' | 'high' = 'high';

  constructor() {
    this.initializeNetworkDetection();
  }

  /**
   * Initialize network connection monitoring
   */
  private initializeNetworkDetection(): void {
    if (typeof window === 'undefined') return;

    // Modern Network Information API
    const nav = navigator as NavigatorWithExperimentalAPIs;
    this.connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (this.connection) {
      this.updateQualityBasedOnConnection();
      this.connection.addEventListener('change', () => {
        this.updateQualityBasedOnConnection();
      });
    }

    // Fallback: Monitor performance timing
    this.monitorNetworkPerformance();
  }

  /**
   * Update image quality based on connection
   */
  private updateQualityBasedOnConnection(): void {
    if (!this.connection) return;

    const effectiveType = this.connection.effectiveType;
    const downlink = this.connection.downlink;

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5) {
      this.quality = 'low';
    } else if (effectiveType === '3g' || downlink < 2) {
      this.quality = 'medium';
    } else {
      this.quality = 'high';
    }
  }

  /**
   * Monitor network performance using timing API
   */
  private monitorNetworkPerformance(): void {
    // Check for browser environment AND PerformanceObserver availability
    if (
      typeof window === 'undefined' ||
      !window.performance ||
      typeof PerformanceObserver === 'undefined'
    ) {
      return;
    }

    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            const connectionSpeed = this.calculateConnectionSpeed(navEntry);
            this.updateQualityBasedOnSpeed(connectionSpeed);
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      // Silently fail if PerformanceObserver is not supported
      // This can happen in older browsers or test environments
      logger.debug('PerformanceObserver not available:', error);
    }
  }

  /**
   * Calculate connection speed from performance timing
   */
  private calculateConnectionSpeed(entry: PerformanceNavigationTiming): number {
    const totalTime = entry.loadEventEnd - entry.fetchStart;
    const transferSize = entry.transferSize || 0;

    if (totalTime <= 0 || transferSize <= 0) return 0;

    // Speed in Mbps
    return (transferSize * 8) / (totalTime * 1000);
  }

  /**
   * Update quality based on calculated speed
   */
  private updateQualityBasedOnSpeed(speedMbps: number): void {
    if (speedMbps < 1) {
      this.quality = 'low';
    } else if (speedMbps < 5) {
      this.quality = 'medium';
    } else {
      this.quality = 'high';
    }
  }

  /**
   * Get current quality recommendation
   */
  getQualityRecommendation(): {
    quality: 'low' | 'medium' | 'high';
    bandwidth: 'low' | 'medium' | 'high';
    preferSpeed: boolean;
  } {
    return {
      quality: this.quality,
      bandwidth: this.quality,
      preferSpeed: this.quality === 'low',
    };
  }

  /**
   * Get data saver recommendation
   */
  isDataSaverEnabled(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for data saver APIs
    const nav = navigator as NavigatorWithExperimentalAPIs;
    const connection = nav.connection;
    if (connection && connection.saveData) {
      return true;
    }

    // Check for battery API (low battery = prefer data saving)
    const battery = nav.battery;
    if (battery && battery.level < 0.2 && !battery.charging) {
      return true;
    }

    return false;
  }
}

// Export singleton instances
export const formatDetector = ImageFormatDetector.getInstance();
export const smartSourceSelector = new SmartImageSourceSelector();
export const networkAwareLoader = new NetworkAwareImageLoader();

// Initialize format detection
if (typeof window !== 'undefined') {
  formatDetector.initialize();
}
