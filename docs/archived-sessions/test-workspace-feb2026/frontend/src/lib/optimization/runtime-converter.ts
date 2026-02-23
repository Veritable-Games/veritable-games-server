/**
 * Runtime Image Conversion System
 * Handles real-time image optimization for user uploads and dynamic content
 */

import sharp, { type ChannelStats as SharpChannelStats } from 'sharp';
import { formatDetector, smartSourceSelector, networkAwareLoader } from './format-detection';
import { logger } from '@/lib/utils/logger';

/**
 * Extended channel statistics that includes entropy
 */
interface ChannelStats extends SharpChannelStats {
  entropy?: number;
}

export interface ConversionOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'avif' | 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  background?: string;
  progressive?: boolean;
  lossless?: boolean;
  generateLQIP?: boolean;
  generateMultipleSizes?: boolean;
  watermark?: {
    image: Buffer;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number;
  };
}

export interface ConvertedImageResult {
  data: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  quality: number;
  lqip?: string;
  multipleSizes?: {
    [key: string]: {
      data: Buffer;
      width: number;
      height: number;
      size: number;
    };
  };
}

export interface UploadProcessingResult {
  original: ConvertedImageResult;
  optimized: {
    avif?: ConvertedImageResult;
    webp?: ConvertedImageResult;
    jpeg?: ConvertedImageResult;
  };
  thumbnail: ConvertedImageResult;
  lqip: string;
  metadata: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    dimensions: { width: number; height: number };
    hasAlpha: boolean;
    colorSpace: string;
    density?: number;
  };
}

/**
 * Runtime image converter with intelligent optimization
 */
export class RuntimeImageConverter {
  private sharpInstance: typeof sharp;
  private defaultOptions: ConversionOptions;

  constructor(options: Partial<ConversionOptions> = {}) {
    this.sharpInstance = sharp;
    this.defaultOptions = {
      quality: 85,
      format: 'auto',
      fit: 'inside',
      progressive: true,
      lossless: false,
      generateLQIP: true,
      generateMultipleSizes: false,
      ...options,
    };

    // Configure sharp for better performance
    this.configureSharp();
  }

  /**
   * Configure sharp for optimal performance
   */
  private configureSharp(): void {
    // Set concurrency based on CPU cores
    const cores = require('os').cpus().length;
    this.sharpInstance.concurrency(Math.max(1, cores - 1));

    // Configure cache
    this.sharpInstance.cache({
      memory: 100, // 100MB memory cache
      files: 20, // 20 files cache
      items: 200, // 200 items cache
    });

    // Disable SIMD if needed for compatibility
    // sharp.simd(false);
  }

  /**
   * Convert image buffer to optimized formats
   */
  async convertImage(
    inputBuffer: Buffer,
    options: Partial<ConversionOptions> = {}
  ): Promise<ConvertedImageResult> {
    const finalOptions = { ...this.defaultOptions, ...options };

    try {
      // Create sharp instance
      let image = this.sharpInstance(inputBuffer);

      // Get input metadata
      const metadata = await image.metadata();

      // Apply transformations
      image = await this.applyTransformations(image, finalOptions, metadata);

      // Convert to specified format
      const { data, info } = await this.convertToFormat(image, finalOptions);

      // Generate LQIP if requested
      let lqip: string | undefined;
      if (finalOptions.generateLQIP) {
        lqip = await this.generateLQIP(inputBuffer);
      }

      // Generate multiple sizes if requested
      let multipleSizes: ConvertedImageResult['multipleSizes'];
      if (finalOptions.generateMultipleSizes) {
        multipleSizes = await this.generateMultipleSizes(inputBuffer, finalOptions);
      }

      return {
        data,
        format: info.format,
        width: info.width,
        height: info.height,
        size: info.size,
        quality: finalOptions.quality || 85,
        lqip,
        multipleSizes,
      };
    } catch (error) {
      throw new Error(`Image conversion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process uploaded image with comprehensive optimization
   */
  async processUpload(
    inputBuffer: Buffer,
    options: {
      generateThumbnail?: boolean;
      thumbnailSize?: number;
      targetFormats?: string[];
      maxWidth?: number;
      maxHeight?: number;
    } = {}
  ): Promise<UploadProcessingResult> {
    const {
      generateThumbnail = true,
      thumbnailSize = 300,
      targetFormats = ['avif', 'webp', 'jpeg'],
      maxWidth = 2048,
      maxHeight = 2048,
    } = options;

    try {
      // Get original metadata
      const originalMeta = await this.sharpInstance(inputBuffer).metadata();
      const originalSize = inputBuffer.length;

      // Determine optimal dimensions
      const { width, height } = this.calculateOptimalDimensions(
        originalMeta.width || 0,
        originalMeta.height || 0,
        maxWidth,
        maxHeight
      );

      // Process original with size constraints
      const original = await this.convertImage(inputBuffer, {
        width,
        height,
        fit: 'inside',
        generateLQIP: true,
      });

      // Generate optimized versions in different formats
      const optimized: UploadProcessingResult['optimized'] = {};

      for (const format of targetFormats) {
        if (format === 'avif' || format === 'webp' || format === 'jpeg') {
          optimized[format] = await this.convertImage(inputBuffer, {
            width,
            height,
            format: format as 'avif' | 'webp' | 'jpeg',
            fit: 'inside',
            quality: this.getOptimalQuality(format),
          });
        }
      }

      // Generate thumbnail
      let thumbnail: ConvertedImageResult;
      if (generateThumbnail) {
        thumbnail = await this.convertImage(inputBuffer, {
          width: thumbnailSize,
          height: thumbnailSize,
          fit: 'cover',
          format: 'webp',
          quality: 80,
        });
      } else {
        thumbnail = original;
      }

      // Generate LQIP
      const lqip = await this.generateLQIP(inputBuffer);

      // Calculate compression statistics
      const optimizedSizes = Object.values(optimized).map(img => img.size);
      const totalOptimizedSize = optimizedSizes.reduce((sum, size) => sum + size, 0);
      const avgOptimizedSize = totalOptimizedSize / optimizedSizes.length || original.size;

      return {
        original,
        optimized,
        thumbnail,
        lqip,
        metadata: {
          originalSize,
          optimizedSize: avgOptimizedSize,
          compressionRatio: originalSize / avgOptimizedSize,
          dimensions: { width: original.width, height: original.height },
          hasAlpha: originalMeta.hasAlpha || false,
          colorSpace: originalMeta.space || 'srgb',
          density: originalMeta.density,
        },
      };
    } catch (error) {
      throw new Error(`Upload processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Apply transformations to image
   */
  private async applyTransformations(
    image: sharp.Sharp,
    options: ConversionOptions,
    metadata: sharp.Metadata
  ): Promise<sharp.Sharp> {
    // Resize if dimensions specified
    if (options.width || options.height) {
      image = image.resize({
        width: options.width,
        height: options.height,
        fit: options.fit || 'inside',
        background: options.background || { r: 255, g: 255, b: 255, alpha: 0 },
        withoutEnlargement: true,
      });
    }

    // Apply watermark if specified
    if (options.watermark) {
      image = await this.applyWatermark(image, options.watermark);
    }

    // Rotate based on EXIF orientation
    image = image.rotate();

    // Remove metadata to reduce file size (keep ICC profile for color accuracy)
    const metadataOptions: { exif: Record<string, never>; icc?: string } = {
      exif: {},
    };
    if (metadata.icc) {
      metadataOptions.icc = metadata.icc.toString('base64');
    }
    image = image.withMetadata(metadataOptions);

    return image;
  }

  /**
   * Apply watermark to image
   */
  private async applyWatermark(
    image: sharp.Sharp,
    watermark: NonNullable<ConversionOptions['watermark']>
  ): Promise<sharp.Sharp> {
    const imageMeta = await image.metadata();
    const watermarkSharp = this.sharpInstance(watermark.image);
    const watermarkMeta = await watermarkSharp.metadata();

    if (!imageMeta.width || !imageMeta.height || !watermarkMeta.width || !watermarkMeta.height) {
      return image;
    }

    // Calculate watermark position
    const position = this.calculateWatermarkPosition(
      { width: imageMeta.width || 0, height: imageMeta.height || 0 },
      { width: watermarkMeta.width, height: watermarkMeta.height },
      watermark.position
    );

    // Apply opacity to watermark
    const processedWatermark = await watermarkSharp
      .ensureAlpha()
      .modulate({ brightness: watermark.opacity })
      .toBuffer();

    return image.composite([
      {
        input: processedWatermark,
        left: position.left,
        top: position.top,
        blend: 'over',
      },
    ]);
  }

  /**
   * Calculate watermark position
   */
  private calculateWatermarkPosition(
    imageSize: { width: number; height: number },
    watermarkSize: { width: number; height: number },
    position: NonNullable<ConversionOptions['watermark']>['position']
  ): { left: number; top: number } {
    const margin = 20; // 20px margin from edges

    switch (position) {
      case 'top-left':
        return { left: margin, top: margin };
      case 'top-right':
        return {
          left: imageSize.width - watermarkSize.width - margin,
          top: margin,
        };
      case 'bottom-left':
        return {
          left: margin,
          top: imageSize.height - watermarkSize.height - margin,
        };
      case 'bottom-right':
        return {
          left: imageSize.width - watermarkSize.width - margin,
          top: imageSize.height - watermarkSize.height - margin,
        };
      case 'center':
      default:
        return {
          left: Math.round((imageSize.width - watermarkSize.width) / 2),
          top: Math.round((imageSize.height - watermarkSize.height) / 2),
        };
    }
  }

  /**
   * Convert image to specified format
   */
  private async convertToFormat(
    image: sharp.Sharp,
    options: ConversionOptions
  ): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    const format = options.format === 'auto' ? 'webp' : options.format || 'webp';
    const quality = options.quality || 85;

    switch (format) {
      case 'avif':
        return image
          .avif({
            quality: Math.min(quality, 60), // AVIF can use lower quality
            effort: 6, // Maximum compression effort
            chromaSubsampling: '4:2:0',
            lossless: options.lossless,
          })
          .toBuffer({ resolveWithObject: true });

      case 'webp':
        return image
          .webp({
            quality,
            effort: 6, // Maximum compression effort
            smartSubsample: true,
            lossless: options.lossless,
          })
          .toBuffer({ resolveWithObject: true });

      case 'jpeg':
        return image
          .jpeg({
            quality,
            progressive: options.progressive,
            mozjpeg: true, // Use mozjpeg encoder for better compression
            trellisQuantisation: true,
            overshootDeringing: true,
            optimiseScans: true,
          })
          .toBuffer({ resolveWithObject: true });

      case 'png':
        return image
          .png({
            compressionLevel: 9, // Maximum compression
            progressive: options.progressive,
            palette: true, // Use palette when possible
          })
          .toBuffer({ resolveWithObject: true });

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate Low Quality Image Placeholder
   */
  private async generateLQIP(inputBuffer: Buffer): Promise<string> {
    try {
      const lqipBuffer = await this.sharpInstance(inputBuffer)
        .resize(40, 40, { fit: 'inside' })
        .blur(2)
        .webp({ quality: 10 })
        .toBuffer();

      return `data:image/webp;base64,${lqipBuffer.toString('base64')}`;
    } catch (error) {
      logger.warn('Failed to generate LQIP:', (error as Error).message);
      return '';
    }
  }

  /**
   * Generate multiple sizes for responsive images
   */
  private async generateMultipleSizes(
    inputBuffer: Buffer,
    options: ConversionOptions
  ): Promise<ConvertedImageResult['multipleSizes']> {
    const sizes = [640, 768, 1024, 1280, 1600, 1920];
    const multipleSizes: ConvertedImageResult['multipleSizes'] = {};

    for (const size of sizes) {
      try {
        const { data, info } = await this.sharpInstance(inputBuffer)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: options.quality || 85 })
          .toBuffer({ resolveWithObject: true });

        multipleSizes[`${size}w`] = {
          data,
          width: info.width,
          height: info.height,
          size: info.size,
        };
      } catch (error) {
        logger.warn(`Failed to generate ${size}w size:`, (error as Error).message);
      }
    }

    return multipleSizes;
  }

  /**
   * Calculate optimal dimensions respecting max constraints
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      // Landscape
      const width = Math.min(originalWidth, maxWidth);
      const height = Math.round(width / aspectRatio);

      if (height > maxHeight) {
        return {
          width: Math.round(maxHeight * aspectRatio),
          height: maxHeight,
        };
      }

      return { width, height };
    } else {
      // Portrait or square
      const height = Math.min(originalHeight, maxHeight);
      const width = Math.round(height * aspectRatio);

      if (width > maxWidth) {
        return {
          width: maxWidth,
          height: Math.round(maxWidth / aspectRatio),
        };
      }

      return { width, height };
    }
  }

  /**
   * Get optimal quality for format
   */
  private getOptimalQuality(format: string): number {
    switch (format) {
      case 'avif':
        return 50; // AVIF has better compression
      case 'webp':
        return 75; // Standard WebP quality
      case 'jpeg':
        return 85; // Standard JPEG quality
      case 'png':
        return 90; // PNG quality for images with transparency
      default:
        return 75;
    }
  }

  /**
   * Validate image buffer
   */
  async validateImage(buffer: Buffer): Promise<{
    isValid: boolean;
    format?: string;
    width?: number;
    height?: number;
    error?: string;
  }> {
    try {
      const metadata = await this.sharpInstance(buffer).metadata();

      // Check for supported formats
      const supportedFormats = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'];
      if (!metadata.format || !supportedFormats.includes(metadata.format)) {
        return {
          isValid: false,
          error: `Unsupported format: ${metadata.format}`,
        };
      }

      // Check dimensions
      if (!metadata.width || !metadata.height) {
        return {
          isValid: false,
          error: 'Invalid image dimensions',
        };
      }

      // Check file size (max 50MB)
      if (buffer.length > 50 * 1024 * 1024) {
        return {
          isValid: false,
          error: 'File too large (max 50MB)',
        };
      }

      return {
        isValid: true,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      return {
        isValid: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Batch process multiple images
   */
  async batchProcess(
    images: Array<{ buffer: Buffer; name: string; options?: Partial<ConversionOptions> }>,
    concurrency = 5
  ): Promise<Array<{ name: string; result?: ConvertedImageResult; error?: string }>> {
    const results: Array<{ name: string; result?: ConvertedImageResult; error?: string }> = [];

    // Process in batches to avoid memory issues
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ buffer, name, options }) => {
          const result = await this.convertImage(buffer, options);
          return { name, result };
        })
      );

      batchResults.forEach((result, index) => {
        const originalIndex = i + index;
        if (result.status === 'fulfilled') {
          results[originalIndex] = result.value;
        } else {
          const image = images[originalIndex];
          results[originalIndex] = {
            name: image?.name || 'unknown',
            error: result.reason?.message || 'Unknown error',
          };
        }
      });
    }

    return results;
  }

  /**
   * Cleanup and release resources
   */
  dispose(): void {
    // Clear sharp cache
    this.sharpInstance.cache(false);
  }
}

/**
 * Utility functions for image optimization
 */
export const ImageUtils = {
  /**
   * Calculate file size savings
   */
  calculateSavings(
    originalSize: number,
    optimizedSize: number
  ): {
    savings: number;
    percentage: number;
  } {
    const savings = originalSize - optimizedSize;
    const percentage = (savings / originalSize) * 100;

    return { savings: Math.max(0, savings), percentage: Math.max(0, percentage) };
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Detect optimal format based on image content
   */
  async detectOptimalFormat(buffer: Buffer): Promise<'avif' | 'webp' | 'jpeg' | 'png'> {
    try {
      const metadata = await sharp(buffer).metadata();

      // PNG for images with transparency
      if (metadata.hasAlpha) {
        return 'png';
      }

      // Check if AVIF is supported by client
      const browserSupport = await formatDetector.getFormatSupport();

      if (browserSupport.avif) {
        return 'avif';
      } else if (browserSupport.webp) {
        return 'webp';
      } else {
        return 'jpeg';
      }
    } catch (error) {
      return 'jpeg'; // Fallback
    }
  },

  /**
   * Calculate image quality based on content analysis
   */
  async analyzeImageContent(buffer: Buffer): Promise<{
    recommendedQuality: number;
    hasText: boolean;
    complexity: 'low' | 'medium' | 'high';
  }> {
    try {
      const image = sharp(buffer);
      const stats = await image.stats();

      // Analyze image statistics to determine complexity
      const channels = stats.channels as ChannelStats[];
      const entropy =
        channels.reduce((sum, channel) => sum + (channel.entropy || 0), 0) / channels.length;

      let complexity: 'low' | 'medium' | 'high' = 'medium';
      let recommendedQuality = 75;

      if (entropy < 6) {
        complexity = 'low';
        recommendedQuality = 65; // Lower quality for simple images
      } else if (entropy > 7.5) {
        complexity = 'high';
        recommendedQuality = 85; // Higher quality for complex images
      }

      // Detect potential text (high contrast edges)
      const hasText =
        entropy > 7 && channels.some(channel => (channel.max || 0) - (channel.min || 0) > 200);

      if (hasText) {
        recommendedQuality = Math.max(recommendedQuality, 80);
      }

      return { recommendedQuality, hasText, complexity };
    } catch (error) {
      return { recommendedQuality: 75, hasText: false, complexity: 'medium' };
    }
  },
};

// Export singleton instance
export const runtimeImageConverter = new RuntimeImageConverter();
