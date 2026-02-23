/**
 * Optimized Image Component
 * Implements lazy loading, responsive sizing, and modern format support
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  className?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
}

/**
 * Generate responsive sizes string based on common breakpoints
 */
function generateSizes(defaultSize = '100vw'): string {
  return `
    (max-width: 640px) 100vw,
    (max-width: 1024px) 75vw,
    (max-width: 1280px) 50vw,
    ${defaultSize}
  `.trim();
}

/**
 * Generate blur placeholder for images
 */
function generateBlurPlaceholder(width = 10, height = 10): string {
  // Simple gradient placeholder
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return '';

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#2a2a2a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL();
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  quality = 85,
  placeholder = 'blur',
  blurDataURL,
  className,
  objectFit = 'cover',
  sizes,
  loading = 'lazy',
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.png',
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate blur placeholder if not provided
  const blurData = blurDataURL || (placeholder === 'blur' ? generateBlurPlaceholder() : undefined);

  // Generate responsive sizes if not provided
  const responsiveSizes = sizes || generateSizes();

  useEffect(() => {
    setImgSrc(src);
    setIsError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsError(true);
    setIsLoading(false);

    // Try fallback image
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }

    onError?.();
  };

  // Use Next.js Image for optimization
  if (!isError && typeof width === 'number' && typeof height === 'number') {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        {isLoading && placeholder === 'blur' && blurData && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              backgroundImage: `url(${blurData})`,
              backgroundSize: 'cover',
              filter: 'blur(20px)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        <Image
          ref={imgRef as React.Ref<HTMLImageElement>}
          src={imgSrc}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          quality={quality}
          placeholder={placeholder}
          blurDataURL={blurData}
          sizes={responsiveSizes}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          style={{ objectFit }}
        />
      </div>
    );
  }

  // Fallback to native img for dynamic dimensions
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-gray-800" />}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          'h-full w-full',
          className
        )}
        style={{ objectFit }}
      />
    </div>
  );
}

/**
 * Picture component for art-directed responsive images
 */
export function ResponsivePicture({
  sources,
  alt,
  className,
  fallbackSrc,
}: {
  sources: Array<{
    srcSet: string;
    media?: string;
    type?: string;
  }>;
  alt: string;
  className?: string;
  fallbackSrc: string;
}) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <picture className={cn('block', className)}>
      {sources.map((source, index) => (
        <source key={index} srcSet={source.srcSet} media={source.media} type={source.type} />
      ))}
      <img
        src={fallbackSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        className={cn('transition-opacity duration-300', isLoading ? 'opacity-0' : 'opacity-100')}
      />
    </picture>
  );
}

/**
 * Background image component with lazy loading
 */
export function LazyBackgroundImage({
  src,
  className,
  children,
  threshold = 0.1,
}: {
  src: string;
  className?: string;
  children?: React.ReactNode;
  threshold?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [threshold]);

  useEffect(() => {
    if (!isVisible) return;

    const img = new window.Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [isVisible, src]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-gray-900',
        isLoaded && 'bg-cover bg-center bg-no-repeat',
        className
      )}
      style={isLoaded ? { backgroundImage: `url(${src})` } : undefined}
    >
      {!isLoaded && <div className="absolute inset-0 animate-pulse bg-gray-800" />}
      {children}
    </div>
  );
}

/**
 * Hook for preloading images
 */
export function useImagePreloader(urls: string[]): {
  loaded: boolean;
  errors: string[];
} {
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (urls.length === 0) {
      setLoaded(true);
      return;
    }

    let loadedCount = 0;
    const errorList: string[] = [];

    const checkComplete = () => {
      if (loadedCount + errorList.length === urls.length) {
        setErrors(errorList);
        setLoaded(true);
      }
    };

    urls.forEach(url => {
      const img = new window.Image();
      img.src = url;
      img.onload = () => {
        loadedCount++;
        checkComplete();
      };
      img.onerror = () => {
        errorList.push(url);
        checkComplete();
      };
    });
  }, [urls]);

  return { loaded, errors };
}

// Components and functions are exported directly above

export default OptimizedImage;
