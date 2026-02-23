/**
 * API Response Compression Middleware
 * Implements gzip/brotli compression for API responses to reduce bandwidth usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { gzip as gzipCompress, brotliCompress } from 'zlib';
import { promisify } from 'util';
import { logger } from '@/lib/utils/logger';

const gzip = promisify(gzipCompress);
const brotli = promisify(brotliCompress);

export interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (default: 1KB)
  level?: number; // Compression level 1-9 (default: 6)
  mimeTypes?: string[]; // MIME types to compress
}

const DEFAULT_OPTIONS: CompressionOptions = {
  threshold: 1024, // 1KB
  level: 6, // Balanced compression
  mimeTypes: [
    'application/json',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/xml',
    'text/xml',
    'text/csv',
    'image/svg+xml',
    'application/ld+json',
  ],
};

/**
 * Check if the client accepts compression
 */
function acceptsCompression(request: NextRequest): string | null {
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  // Prefer brotli over gzip if both are supported
  if (acceptEncoding.includes('br')) {
    return 'br';
  }
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }

  return null;
}

/**
 * Check if response should be compressed based on content type
 */
function shouldCompress(contentType: string | null, mimeTypes: string[]): boolean {
  if (!contentType) return false;

  return mimeTypes.some(type => contentType.includes(type));
}

/**
 * Compress response body
 */
async function compressBody(
  body: string | Buffer,
  encoding: string,
  level: number
): Promise<Buffer> {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

  if (encoding === 'br') {
    // Brotli compression with quality level (0-11, higher = better compression)
    const brotliQuality = Math.min(11, Math.max(0, level + 2));
    return await brotli(buffer, {
      params: {
        [require('zlib').constants.BROTLI_PARAM_QUALITY]: brotliQuality,
        [require('zlib').constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    });
  }

  if (encoding === 'gzip') {
    return await gzip(buffer, { level });
  }

  throw new Error(`Unsupported compression encoding: ${encoding}`);
}

/**
 * Add compression headers to response
 */
export function addCompressionHeaders(response: NextResponse): NextResponse {
  // Enable compression hints
  response.headers.set('Vary', 'Accept-Encoding');

  return response;
}

/**
 * Compression middleware for API routes
 */
export async function compressionMiddleware(
  request: NextRequest,
  response: NextResponse,
  options: CompressionOptions = {}
): Promise<NextResponse> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Check if client accepts compression
  const encoding = acceptsCompression(request);
  if (!encoding) {
    return addCompressionHeaders(response);
  }

  // Check content type
  const contentType = response.headers.get('content-type');
  if (!shouldCompress(contentType, config.mimeTypes!)) {
    return addCompressionHeaders(response);
  }

  // Get response body
  const body = await response.text();

  // Check size threshold
  if (body.length < config.threshold!) {
    return addCompressionHeaders(response);
  }

  try {
    // Compress the body
    const compressed = await compressBody(body, encoding, config.level!);

    // Create new response with compressed body
    const compressedResponse = new NextResponse(compressed as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Set compression headers
    compressedResponse.headers.set('Content-Encoding', encoding);
    compressedResponse.headers.set('Content-Length', compressed.length.toString());

    // Add original size for debugging
    compressedResponse.headers.set('X-Original-Size', body.length.toString());
    compressedResponse.headers.set(
      'X-Compression-Ratio',
      ((1 - compressed.length / body.length) * 100).toFixed(2) + '%'
    );

    return addCompressionHeaders(compressedResponse);
  } catch (error) {
    logger.error('Compression error:', error);
    // Return original response if compression fails
    return addCompressionHeaders(response);
  }
}

/**
 * Wrap API handler with compression
 */
export function withCompression<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: CompressionOptions
): T {
  return (async (...args: Parameters<T>) => {
    const [request] = args;
    const response = await handler(...args);

    // Only compress successful responses
    if (response.status >= 200 && response.status < 300) {
      return compressionMiddleware(request as NextRequest, response, options);
    }

    return response;
  }) as T;
}

/**
 * Express-style compression middleware for Next.js
 */
export function createCompressionMiddleware(options?: CompressionOptions) {
  return async (request: NextRequest, next: () => Promise<NextResponse>) => {
    const response = await next();

    // Skip compression for non-2xx responses
    if (response.status < 200 || response.status >= 300) {
      return response;
    }

    return compressionMiddleware(request, response, options);
  };
}
