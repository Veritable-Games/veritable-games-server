import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '@/lib/utils/logger';

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

export interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (default: 1024 bytes)
  level?: number; // Compression level 1-9 (default: 6)
  enableBrotli?: boolean; // Enable Brotli compression (default: true)
  enableGzip?: boolean; // Enable Gzip compression (default: true)
  enableDeflate?: boolean; // Enable Deflate compression (default: true)
  mimeTypes?: string[]; // MIME types to compress (default: common text types)
}

export interface ETagOptions {
  weak?: boolean; // Use weak ETags (default: false)
  algorithm?: 'md5' | 'sha1' | 'sha256'; // Hash algorithm (default: 'sha256')
  includeHeaders?: string[]; // Additional headers to include in ETag generation
}

const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptions> = {
  threshold: 1024,
  level: 6,
  enableBrotli: true,
  enableGzip: true,
  enableDeflate: true,
  mimeTypes: [
    'text/html',
    'text/css',
    'text/javascript',
    'text/plain',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'image/svg+xml',
  ],
};

const DEFAULT_ETAG_OPTIONS: Required<ETagOptions> = {
  weak: false,
  algorithm: 'sha256',
  includeHeaders: ['content-type', 'cache-control'],
};

/**
 * Response compression middleware
 * Automatically compresses responses based on client capabilities and content type
 */
export class ResponseCompressor {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  }

  /**
   * Compress response data based on client Accept-Encoding header
   */
  async compressResponse(
    request: NextRequest,
    data: string | Buffer,
    contentType: string = 'application/json'
  ): Promise<{
    data: Buffer;
    encoding: string | null;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    const originalData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const originalSize = originalData.length;

    // Check if compression should be applied
    if (!this.shouldCompress(originalSize, contentType)) {
      return {
        data: originalData,
        encoding: null,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
      };
    }

    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const compressionMethod = this.selectCompressionMethod(acceptEncoding);

    if (!compressionMethod) {
      return {
        data: originalData,
        encoding: null,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
      };
    }

    try {
      let compressedData: Buffer;

      switch (compressionMethod) {
        case 'br':
          if (this.options.enableBrotli) {
            compressedData = await brotliCompress(originalData, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: originalSize,
              },
            });
          } else {
            throw new Error('Brotli compression disabled');
          }
          break;

        case 'gzip':
          if (this.options.enableGzip) {
            compressedData = await gzip(originalData, { level: this.options.level });
          } else {
            throw new Error('Gzip compression disabled');
          }
          break;

        case 'deflate':
          if (this.options.enableDeflate) {
            compressedData = await deflate(originalData, { level: this.options.level });
          } else {
            throw new Error('Deflate compression disabled');
          }
          break;

        default:
          throw new Error(`Unsupported compression method: ${compressionMethod}`);
      }

      const compressedSize = compressedData.length;
      const compressionRatio = originalSize / compressedSize;

      // Only use compression if it actually reduces size significantly
      if (compressionRatio < 1.1) {
        return {
          data: originalData,
          encoding: null,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
        };
      }

      return {
        data: compressedData,
        encoding: compressionMethod,
        originalSize,
        compressedSize,
        compressionRatio,
      };
    } catch (error) {
      logger.warn('Compression failed:', error);
      return {
        data: originalData,
        encoding: null,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
      };
    }
  }

  private shouldCompress(size: number, contentType: string): boolean {
    if (size < this.options.threshold) {
      return false;
    }

    // Check if content type is compressible
    return this.options.mimeTypes.some(mimeType =>
      contentType.toLowerCase().includes(mimeType.toLowerCase())
    );
  }

  private selectCompressionMethod(acceptEncoding: string): string | null {
    const encodings = acceptEncoding
      .toLowerCase()
      .split(',')
      .map(e => e.trim());

    // Priority order: Brotli > Gzip > Deflate
    if (this.options.enableBrotli && encodings.some(e => e.includes('br'))) {
      return 'br';
    }

    if (this.options.enableGzip && encodings.some(e => e.includes('gzip'))) {
      return 'gzip';
    }

    if (this.options.enableDeflate && encodings.some(e => e.includes('deflate'))) {
      return 'deflate';
    }

    return null;
  }
}

/**
 * ETag generator for response caching
 * Generates strong or weak ETags for cache validation
 */
export class ETagGenerator {
  private options: Required<ETagOptions>;

  constructor(options: ETagOptions = {}) {
    this.options = { ...DEFAULT_ETAG_OPTIONS, ...options };
  }

  /**
   * Generate ETag for response data
   */
  generateETag(
    data: string | Buffer,
    request?: NextRequest,
    additionalData?: Record<string, any>
  ): string {
    const hash = createHash(this.options.algorithm);

    // Add main content
    hash.update(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'));

    // Add request headers if specified
    if (request && this.options.includeHeaders.length > 0) {
      for (const headerName of this.options.includeHeaders) {
        const headerValue = request.headers.get(headerName);
        if (headerValue) {
          hash.update(`${headerName}:${headerValue}`);
        }
      }
    }

    // Add additional data
    if (additionalData) {
      hash.update(JSON.stringify(additionalData));
    }

    const etag = hash.digest('hex').substring(0, 16);
    return this.options.weak ? `W/"${etag}"` : `"${etag}"`;
  }

  /**
   * Check if request ETag matches current ETag
   */
  checkETag(request: NextRequest, currentETag: string): boolean {
    const ifNoneMatch = request.headers.get('if-none-match');

    if (!ifNoneMatch) {
      return false;
    }

    // Handle multiple ETags and weak/strong comparison
    const requestETags = ifNoneMatch.split(',').map(etag => etag.trim());

    return requestETags.some(requestETag => {
      // Handle wildcard
      if (requestETag === '*') {
        return true;
      }

      // Strong comparison (both must be strong)
      if (!requestETag.startsWith('W/') && !currentETag.startsWith('W/')) {
        return requestETag === currentETag;
      }

      // Weak comparison (at least one is weak)
      const requestValue = requestETag.startsWith('W/') ? requestETag.substring(2) : requestETag;
      const currentValue = currentETag.startsWith('W/') ? currentETag.substring(2) : currentETag;

      return requestValue === currentValue;
    });
  }
}

/**
 * Combined compression and ETag middleware
 */
export class ResponseOptimizer {
  private compressor: ResponseCompressor;
  private etagGenerator: ETagGenerator;

  constructor(compressionOptions: CompressionOptions = {}, etagOptions: ETagOptions = {}) {
    this.compressor = new ResponseCompressor(compressionOptions);
    this.etagGenerator = new ETagGenerator(etagOptions);
  }

  /**
   * Optimize response with compression and ETag
   */
  async optimizeResponse(
    request: NextRequest,
    data: any,
    options: {
      contentType?: string;
      maxAge?: number;
      staleWhileRevalidate?: number;
      additionalETagData?: Record<string, any>;
    } = {}
  ): Promise<NextResponse> {
    const {
      contentType = 'application/json',
      maxAge = 300, // 5 minutes default
      staleWhileRevalidate = 600, // 10 minutes default
      additionalETagData,
    } = options;

    // Serialize data
    const responseData = typeof data === 'string' ? data : JSON.stringify(data);

    // Generate ETag
    const etag = this.etagGenerator.generateETag(responseData, request, additionalETagData);

    // Check if client has cached version
    if (this.etagGenerator.checkETag(request, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': `max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
          Vary: 'Accept-Encoding',
        },
      });
    }

    // Compress response
    const compression = await this.compressor.compressResponse(request, responseData, contentType);

    // Build response headers
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      ETag: etag,
      'Cache-Control': `max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      Vary: 'Accept-Encoding',
      'X-Original-Size': compression.originalSize.toString(),
      'X-Compressed-Size': compression.compressedSize.toString(),
      'X-Compression-Ratio': compression.compressionRatio.toFixed(2),
    };

    if (compression.encoding) {
      headers['Content-Encoding'] = compression.encoding;
      headers['Content-Length'] = compression.compressedSize.toString();
    }

    return new NextResponse(compression.data as BodyInit, {
      status: 200,
      headers,
    });
  }

  /**
   * Create cache-friendly headers for static content
   */
  createStaticHeaders(
    data: string | Buffer,
    options: {
      maxAge?: number;
      immutable?: boolean;
      contentType?: string;
    } = {}
  ): Record<string, string> {
    const {
      maxAge = 31536000, // 1 year for static content
      immutable = true,
      contentType = 'application/octet-stream',
    } = options;

    const etag = this.etagGenerator.generateETag(data);

    const cacheControl = immutable ? `max-age=${maxAge}, immutable` : `max-age=${maxAge}`;

    return {
      'Content-Type': contentType,
      ETag: etag,
      'Cache-Control': cacheControl,
      Vary: 'Accept-Encoding',
    };
  }
}

// Singleton instances for common use cases
export const defaultOptimizer = new ResponseOptimizer();
export const apiOptimizer = new ResponseOptimizer(
  {
    threshold: 512,
    level: 4,
  },
  {
    weak: false,
  }
);
export const staticOptimizer = new ResponseOptimizer(
  {
    threshold: 256,
    level: 9,
  },
  {
    weak: false,
  }
);

// Utility functions
export function shouldUseCompression(request: NextRequest): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  return (
    acceptEncoding.includes('gzip') ||
    acceptEncoding.includes('deflate') ||
    acceptEncoding.includes('br')
  );
}

export function getCompressionStats(
  originalSize: number,
  compressedSize: number
): {
  savings: number;
  ratio: number;
  percentage: string;
} {
  const savings = originalSize - compressedSize;
  const ratio = originalSize / compressedSize;
  const percentage = ((savings / originalSize) * 100).toFixed(1) + '%';

  return { savings, ratio, percentage };
}
