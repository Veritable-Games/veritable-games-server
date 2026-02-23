/**
 * Advanced Image Optimization Pipeline
 * Uses Next.js built-in image optimization
 */

import type { ImageProps } from 'next/image';

interface OptimizationConfig {
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  blur?: boolean;
  progressive?: boolean;
  sizes?: string;
}

interface ImageOptimizationParams {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: string;
  sharpen?: number;
  blur?: number;
  background?: string;
  rotate?: number;
}

/**
 * Generate optimized image URL using Next.js default optimization
 */
export function getOptimizedImageUrl(src: string, params: ImageOptimizationParams = {}): string {
  // For local images, use Next.js optimization
  if (!src.startsWith('http')) {
    const queryParams = new URLSearchParams();
    if (params.width) queryParams.append('w', params.width.toString());
    if (params.quality) queryParams.append('q', params.quality.toString());
    return `/_next/image?url=${encodeURIComponent(src)}&${queryParams.toString()}`;
  }

  // For external images, return as-is
  return src;
}

/**
 * Optimized Image Loader for Next.js (using default loader)
 */
export function defaultImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Use Next.js default image optimization
  if (!src.startsWith('http')) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
  }

  return src;
}

/**
 * Generate responsive image sizes based on viewport
 */
export function generateImageSizes(type: 'hero' | 'card' | 'thumbnail' | 'full'): string {
  const sizes: Record<'hero' | 'card' | 'thumbnail' | 'full', string> = {
    hero: '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1280px',
    card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    thumbnail: '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px',
    full: '100vw',
  };

  return sizes[type];
}

/**
 * Get optimized image props for Next.js Image component
 */
export function getOptimizedImageProps(
  src: string,
  alt: string,
  config: OptimizationConfig = {}
): Partial<ImageProps> {
  const { quality = 75, format = 'auto', blur = true, progressive = true, sizes } = config;

  return {
    src,
    alt,
    quality,
    sizes: sizes ?? generateImageSizes('full'),
    loading: 'lazy' as const,
    placeholder: (blur ? 'blur' : 'empty') as 'blur' | 'empty',
    // Use default Next.js loader
  };
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, options: ImageOptimizationParams = {}): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getOptimizedImageUrl(src, options);

  // Add format hint for better browser optimization
  if (options.format) {
    link.setAttribute('type', `image/${options.format}`);
  }

  document.head.appendChild(link);
}

/**
 * Lazy load images with Intersection Observer
 */
export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private imageMap = new Map<Element, string>();

  constructor(rootMargin = '50px') {
    if (typeof window === 'undefined') return;

    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );
  }

  observe(element: Element, src: string): void {
    if (!this.observer) return;

    this.imageMap.set(element, src);
    this.observer.observe(element);
  }

  private loadImage(element: Element): void {
    const src = this.imageMap.get(element);
    if (!src) return;

    if (element instanceof HTMLImageElement) {
      element.src = src;
      element.classList.add('loaded');
    } else {
      element.setAttribute('style', `background-image: url(${src})`);
      element.classList.add('loaded');
    }

    this.observer?.unobserve(element);
    this.imageMap.delete(element);
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.imageMap.clear();
  }
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  src: string,
  widths: number[] = [640, 768, 1024, 1280, 1600, 1920]
): string {
  return widths
    .map(width => {
      const url = getOptimizedImageUrl(src, { width, format: 'auto' });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Calculate aspect ratio for image containers
 */
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}/${height / divisor}`;
}

/**
 * Progressive image loading with blur-up effect
 */
export class ProgressiveImageLoader {
  private placeholder: string;
  private source: string;

  constructor(source: string, placeholder?: string) {
    this.source = source;
    this.placeholder = placeholder || this.generatePlaceholder(source);
  }

  private generatePlaceholder(src: string): string {
    // Generate a low-quality placeholder URL
    return getOptimizedImageUrl(src, {
      width: 40,
      quality: 10,
      blur: 5,
      format: 'webp',
    });
  }

  async load(element: HTMLImageElement): Promise<void> {
    // Load placeholder first
    element.src = this.placeholder;
    element.classList.add('blur-up');

    // Load full image
    const img = new Image();
    img.src = this.source;

    return new Promise((resolve, reject) => {
      img.onload = () => {
        element.src = this.source;
        element.classList.remove('blur-up');
        element.classList.add('loaded');
        resolve();
      };

      img.onerror = reject;
    });
  }
}

/**
 * Image optimization middleware for API routes
 */
export async function optimizeImageMiddleware(
  imageBuffer: Buffer,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  } = {}
): Promise<Buffer> {
  // This would use sharp in a real implementation
  // For now, we'll return the original buffer
  // In production, you'd import and use sharp here

  // Example with sharp (requires sharp installation):
  // const sharp = require('sharp');
  // return sharp(imageBuffer)
  //   .resize(options.width, options.height)
  //   .toFormat(options.format || 'webp', { quality: options.quality || 85 })
  //   .toBuffer();

  return imageBuffer;
}

// Export default configuration
export const imageOptimizationConfig = {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 768, 1024, 1280, 1600, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
};

// Export old function names for compatibility
export const getCloudFlareImageUrl = getOptimizedImageUrl;
export const cloudflareImageLoader = defaultImageLoader;
