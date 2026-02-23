import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, getSecurityHeaders } from './csp';
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// CSRF Protection (Double Submit Cookie Pattern)
// ============================================================================

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generates a cryptographically secure CSRF token
 */
function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validates CSRF token using double submit cookie pattern
 * @returns true if valid, false otherwise
 */
function validateCSRFToken(request: NextRequest): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS (safe methods)
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Get token from cookie and header
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // Both must exist and match
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Ensure both tokens are the same length before comparing
  // timingSafeEqual requires equal-length buffers
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  } catch (error) {
    logger.warn('CSRF token validation error:', error);
    return false;
  }
}

/**
 * Adds CSRF token to response cookie (readable by JavaScript for double submit pattern)
 * Security comes from SameSite=strict + token validation, not httpOnly
 */
function addCSRFCookie(response: NextResponse): NextResponse {
  const token = generateCSRFToken();
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be false for double submit cookie pattern
    // Hybrid approach: environment variable override or default based on NODE_ENV
    // Set COOKIE_SECURE_FLAG=false for HTTP-only deployments
    secure:
      process.env.COOKIE_SECURE_FLAG !== undefined
        ? process.env.COOKIE_SECURE_FLAG === 'true'
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}

// ============================================================================
// Rate Limiting (In-Memory LRU Cache)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for cache keys
}

export interface RateLimiter {
  check: (key: string) => Promise<{
    success: boolean;
    remainingRequests?: number;
    resetTime?: number;
    retryAfter?: number;
  }>;
}

class InMemoryRateLimiter implements RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private readonly maxEntries = 10000; // LRU eviction threshold

  constructor(private options: RateLimitOptions) {}

  async check(key: string): Promise<{
    success: boolean;
    remainingRequests?: number;
    resetTime?: number;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const cacheKey = this.options.keyPrefix ? `${this.options.keyPrefix}:${key}` : key;

    // Get or create entry
    let entry = this.cache.get(cacheKey);

    // Clean expired entries periodically
    if (this.cache.size > this.maxEntries) {
      this.evictExpiredEntries(now);
    }

    // If no entry or expired, create new window
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + this.options.windowMs,
      };
      this.cache.set(cacheKey, entry);

      return {
        success: true,
        remainingRequests: this.options.maxRequests - 1,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.options.maxRequests) {
      return {
        success: false,
        remainingRequests: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000), // seconds
      };
    }

    return {
      success: true,
      remainingRequests: this.options.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  private evictExpiredEntries(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Creates a rate limiter with the specified options
 */
export function createRateLimitMiddleware(options: RateLimitOptions): RateLimiter {
  return new InMemoryRateLimiter(options);
}

// Predefined rate limiters for common operations
export const rateLimiters = {
  // Topic creation: 5 per hour
  topicCreate: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'topic-create',
  }),

  // Reply creation: 30 per hour
  replyCreate: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'reply-create',
  }),

  // Search: 100 per minute
  search: createRateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'search',
  }),

  // Authentication: 10 per 15 minutes
  auth: createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'auth',
  }),

  // File uploads: 10 per hour
  fileUpload: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'file-upload',
  }),

  // Message sending: 20 per hour
  messageSend: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'message-send',
  }),

  // Wiki page creation: 10 per hour
  wikiCreate: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'wiki-create',
  }),
};

// ============================================================================
// Security Headers
// ============================================================================

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  const nonce = generateNonce();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const securityHeaders = getSecurityHeaders(isDevelopment, nonce);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// ============================================================================
// Rate Limiter Settings Check
// ============================================================================

/**
 * Check if a specific rate limiter is enabled in settings
 * Only called when rate limit is exceeded (lazy check for performance)
 * @returns true if enabled (or on error - fail secure), false if disabled
 */
async function isRateLimiterEnabled(
  limiterType:
    | 'topicCreate'
    | 'replyCreate'
    | 'search'
    | 'auth'
    | 'fileUpload'
    | 'messageSend'
    | 'wikiCreate'
): Promise<boolean> {
  try {
    const { settingsService } = await import('@/lib/settings/service');

    const settingsKeyMap = {
      topicCreate: 'rateLimitTopicCreateEnabled',
      replyCreate: 'rateLimitReplyCreateEnabled',
      search: 'rateLimitSearchEnabled',
      auth: 'rateLimitAuthEnabled',
      fileUpload: 'rateLimitFileUploadEnabled',
      messageSend: 'rateLimitMessageSendEnabled',
      wikiCreate: 'rateLimitWikiCreateEnabled',
    } as const;

    const settingKey = settingsKeyMap[limiterType];
    const isEnabled = await settingsService.getSetting(settingKey);

    return isEnabled;
  } catch (error) {
    // Fail secure: if settings unavailable, enforce rate limit
    logger.warn(`Failed to check ${limiterType} rate limit setting, enforcing limit`, error);
    return true;
  }
}

// ============================================================================
// Security Middleware
// ============================================================================

export interface SecurityOptions {
  enableCSRF?: boolean;
  rateLimiter?: RateLimiter;
  rateLimiterType?:
    | 'topicCreate'
    | 'replyCreate'
    | 'search'
    | 'auth'
    | 'fileUpload'
    | 'messageSend'
    | 'wikiCreate';
  rateLimitKey?: (request: NextRequest) => string;
  rateLimitWhitelist?: string[]; // IP addresses to skip rate limiting
}

export function withSecurity(handler: any, options: SecurityOptions = {}) {
  const {
    enableCSRF = true,
    rateLimiter,
    rateLimiterType,
    rateLimitKey = req => getClientIP(req),
    rateLimitWhitelist = [],
  } = options;

  return async function (request: NextRequest, context: any) {
    // 1. CSRF validation (for state-changing methods)
    if (enableCSRF && !validateCSRFToken(request)) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token',
        },
        { status: 403 }
      );
    }

    // 2. Rate limiting (if configured)
    if (rateLimiter) {
      const clientIP = getClientIP(request);
      const isWhitelisted = rateLimitWhitelist.includes(clientIP);

      // Skip rate limiting for whitelisted IPs
      if (!isWhitelisted) {
        const key = rateLimitKey(request);
        const result = await rateLimiter.check(key);

        if (!result.success) {
          // Rate limit exceeded - check if this limiter is disabled
          if (rateLimiterType) {
            const isEnabled = await isRateLimiterEnabled(rateLimiterType);
            if (!isEnabled) {
              // Limiter is disabled, bypass the rate limit
              logger.info(`Rate limit bypassed for ${rateLimiterType} (disabled in settings)`);
              const handlerResponse = await handler(request, context);
              const responseWithHeaders = addSecurityHeaders(handlerResponse);
              return addCSRFCookie(responseWithHeaders);
            }
          }

          // Rate limit is enabled, return 429
          const response = NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: 'Too many requests. Please try again later.',
              retryAfter: result.retryAfter,
            },
            { status: 429 }
          );

          if (result.retryAfter) {
            response.headers.set('Retry-After', result.retryAfter.toString());
          }
          if (result.resetTime) {
            response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
          }

          return addSecurityHeaders(response);
        }

        // Add rate limit headers to successful requests
        const handlerResponse = await handler(request, context);
        if (result.remainingRequests !== undefined) {
          handlerResponse.headers.set('X-RateLimit-Remaining', result.remainingRequests.toString());
        }
        if (result.resetTime) {
          handlerResponse.headers.set('X-RateLimit-Reset', result.resetTime.toString());
        }

        const responseWithHeaders = addSecurityHeaders(handlerResponse);
        return addCSRFCookie(responseWithHeaders);
      }

      // Whitelisted IP - skip rate limiting but still process the request
      const handlerResponse = await handler(request, context);
      const responseWithHeaders = addSecurityHeaders(handlerResponse);
      return addCSRFCookie(responseWithHeaders);
    }

    // 3. Execute handler and add security headers
    const response = await handler(request, context);
    const responseWithHeaders = addSecurityHeaders(response);
    return addCSRFCookie(responseWithHeaders);
  };
}

export function getClientIP(request: NextRequest): string {
  // Get client IP from various headers
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const xClientIP = request.headers.get('x-client-ip');

  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    const firstIP = xForwardedFor.split(',')[0]?.trim();
    if (firstIP) {
      return firstIP;
    }
  }

  if (xRealIP) {
    return xRealIP;
  }

  if (xClientIP) {
    return xClientIP;
  }

  // Fallback to localhost (NextRequest doesn't have .ip property)
  return '127.0.0.1';
}
