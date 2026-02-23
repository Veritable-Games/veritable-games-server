// Use Web Crypto API for Edge Runtime compatibility
// import { logger } from '../utils/logger';

/**
 * Content Security Policy (CSP) Level 3 Management
 *
 * This module provides utilities for managing Content Security Policy headers
 * with support for CSP Level 3 features including nonces, hashes, strict-dynamic,
 * trusted types, and advanced security directives. Designed to provide maximum
 * XSS protection while maintaining application functionality.
 */

/**
 * CSP Report-Only mode for testing new policies
 */
import { logger } from '@/lib/utils/logger';

export interface CSPReportOnlyConfig extends CSPConfig {
  reportOnly: boolean;
}

export interface CSPConfig {
  // Script sources with CSP Level 3 support
  scriptSrc: string[];
  scriptSrcElem?: string[];
  scriptSrcAttr?: string[];

  // Style sources with Level 3 support
  styleSrc: string[];
  styleSrcElem?: string[];
  styleSrcAttr?: string[];

  // Image sources
  imgSrc: string[];

  // Font sources
  fontSrc: string[];

  // Connect sources (fetch, XHR)
  connectSrc: string[];

  // Object sources (plugins)
  objectSrc: string[];

  // Media sources (video, audio)
  mediaSrc: string[];

  // Frame sources
  frameSrc: string[];

  // Child sources (workers, frames)
  childSrc: string[];

  // Worker sources
  workerSrc: string[];

  // Manifest sources
  manifestSrc: string[];

  // Default sources (fallback)
  defaultSrc: string[];

  // Base URI restrictions
  baseUri: string[];

  // Form action restrictions
  formAction: string[];

  // Frame ancestors (clickjacking protection)
  frameAncestors: string[];

  // Navigate-to (CSP Level 3)
  navigateTo?: string[];

  // Prefetch-src (CSP Level 3)
  prefetchSrc?: string[];

  // Upgrade insecure requests
  upgradeInsecureRequests: boolean;

  // Block mixed content
  blockAllMixedContent: boolean;

  // Require trusted types (CSP Level 3)
  requireTrustedTypes?: boolean;

  // Trusted types policy names (CSP Level 3)
  trustedTypes?: string[];

  // Sandbox directive
  sandbox?: string[];

  // Require SRI for scripts and styles
  requireSriFor?: string[];

  // Report URI for violations (legacy)
  reportUri?: string;

  // Report to (newer reporting API)
  reportTo?: string;

  // CSP Level 3 violation reporting
  reportSample?: number;
}

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export function generateNonce(): string {
  // Use Web Crypto API for Edge Runtime compatibility
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // Fallback for environments without Web Crypto API
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate content hash for CSP
 * Uses Web Crypto API for Edge Runtime compatibility
 */
export async function generateContentHash(
  content: string,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'
): Promise<string> {
  // Use Web Crypto API for Edge Runtime compatibility
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest(algorithm.toUpperCase(), data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashString = btoa(String.fromCharCode(...hashArray));
    return `'${algorithm}-${hashString}'`;
  }

  // Fallback for environments without Web Crypto API - return empty hash
  return `'${algorithm}-fallback'`;
}

/**
 * Get environment-specific CSP Level 3 configuration
 */
export function getCSPConfig(isDevelopment: boolean, nonce?: string): CSPConfig {
  const baseConfig: CSPConfig = {
    defaultSrc: ["'none'"], // More restrictive default

    // Script sources with CSP Level 3 strict-dynamic
    scriptSrc: [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
      // Fallback for older browsers that don't support strict-dynamic
      ...(nonce ? [] : ['https://cdn.jsdelivr.net', 'https://unpkg.com']),
      // Development needs
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
      // Next.js 15 requires inline scripts for client-side hydration
      "'unsafe-inline'",
      // WebAssembly support
      "'wasm-unsafe-eval'",
    ],

    // Script elements with stricter control
    scriptSrcElem: [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      // CDN sources only if no nonce available
      ...(nonce ? [] : ['https://cdn.jsdelivr.net', 'https://unpkg.com']),
    ],

    // Script attributes (inline event handlers) - block by default
    scriptSrcAttr: isDevelopment ? ["'unsafe-inline'"] : ["'none'"],

    // Style sources with nonce support
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Monaco editor and dynamic styles
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      // Font and style CDNs
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net',
    ],

    // Style elements
    styleSrcElem: [
      "'self'",
      "'unsafe-inline'", // Required for Monaco editor and dynamic styles
      ...(nonce ? [`'nonce-${nonce}'`] : []),
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net',
    ],

    // Style attributes (inline styles)
    styleSrcAttr: ["'unsafe-inline'"],

    // Image sources - comprehensive but secure
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https:', // Allow any HTTPS image for flexibility
    ],

    // Font sources
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],

    // Connect sources - API calls and WebSocket connections
    connectSrc: [
      "'self'",
      // WebSocket connections for real-time collaboration
      ...(isDevelopment ? ['ws://localhost:3002', 'ws://127.0.0.1:3002'] : []),
      ...(!isDevelopment
        ? [
            'wss://www.veritablegames.com:3002',
            'wss://veritablegames.com:3002',
            'ws://192.168.1.15:3002', // Internal network fallback
          ]
        : []),
      // Production monitoring and analytics
      ...(!isDevelopment ? ['https://*.sentry.io', 'https://vitals.vercel-analytics.com'] : []),
    ],

    // Object sources - completely blocked for security
    objectSrc: ["'none'"],

    // Media sources
    mediaSrc: ["'self'", 'data:', 'blob:'],

    // Frame sources - restrict to same origin
    frameSrc: ["'self'"],

    // Child sources - for workers and frames
    childSrc: ["'self'", 'blob:', 'https://cdn.jsdelivr.net'],

    // Worker sources - for Web Workers (includes Monaco editor CDN)
    workerSrc: ["'self'", 'blob:', 'https://cdn.jsdelivr.net'],

    // Manifest sources
    manifestSrc: ["'self'"],

    // Base URI restrictions - prevent base tag injection
    baseUri: ["'self'"],

    // Form action restrictions - prevent form hijacking
    formAction: ["'self'"],

    // Frame ancestors - prevent clickjacking
    frameAncestors: ["'self'"],

    // Navigate-to directive (CSP Level 3) - control navigation
    navigateTo: isDevelopment ? undefined : ["'self'", 'https:'],

    // Prefetch-src (CSP Level 3) - control resource prefetching
    prefetchSrc: ["'self'", 'https:'],

    // Security enhancements
    upgradeInsecureRequests: !isDevelopment,
    blockAllMixedContent: !isDevelopment,

    // Trusted Types (CSP Level 3) - enable in production for XSS protection
    requireTrustedTypes: !isDevelopment,
    trustedTypes: ['default', 'nextjs', 'react'],

    // Sandbox restrictions for enhanced security
    sandbox: isDevelopment
      ? undefined
      : [
          'allow-forms',
          'allow-scripts',
          'allow-same-origin',
          'allow-popups',
          'allow-popups-to-escape-sandbox',
          'allow-downloads',
        ],

    // Require SRI for external scripts and styles
    requireSriFor: isDevelopment ? undefined : ['script', 'style'],

    // CSP violation reporting
    reportUri: '/api/security/csp-violation',
    reportTo: 'csp-endpoint',
    reportSample: 0.1, // Report 10% of violations to avoid spam
  };

  return baseConfig;
}

/**
 * Convert CSP config to header string with CSP Level 3 support
 */
export function buildCSPHeader(config: CSPConfig): string {
  const directives: string[] = [];

  // Add all configured directives
  if (config.defaultSrc.length > 0) {
    directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  }

  if (config.scriptSrc.length > 0) {
    directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  }

  if (config.scriptSrcElem && config.scriptSrcElem.length > 0) {
    directives.push(`script-src-elem ${config.scriptSrcElem.join(' ')}`);
  }

  if (config.scriptSrcAttr && config.scriptSrcAttr.length > 0) {
    directives.push(`script-src-attr ${config.scriptSrcAttr.join(' ')}`);
  }

  if (config.styleSrc.length > 0) {
    directives.push(`style-src ${config.styleSrc.join(' ')}`);
  }

  if (config.styleSrcElem && config.styleSrcElem.length > 0) {
    directives.push(`style-src-elem ${config.styleSrcElem.join(' ')}`);
  }

  if (config.styleSrcAttr && config.styleSrcAttr.length > 0) {
    directives.push(`style-src-attr ${config.styleSrcAttr.join(' ')}`);
  }

  if (config.imgSrc.length > 0) {
    directives.push(`img-src ${config.imgSrc.join(' ')}`);
  }

  if (config.fontSrc.length > 0) {
    directives.push(`font-src ${config.fontSrc.join(' ')}`);
  }

  if (config.connectSrc.length > 0) {
    directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  }

  if (config.objectSrc.length > 0) {
    directives.push(`object-src ${config.objectSrc.join(' ')}`);
  }

  if (config.mediaSrc.length > 0) {
    directives.push(`media-src ${config.mediaSrc.join(' ')}`);
  }

  if (config.frameSrc.length > 0) {
    directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  }

  if (config.childSrc.length > 0) {
    directives.push(`child-src ${config.childSrc.join(' ')}`);
  }

  if (config.workerSrc.length > 0) {
    directives.push(`worker-src ${config.workerSrc.join(' ')}`);
  }

  if (config.manifestSrc.length > 0) {
    directives.push(`manifest-src ${config.manifestSrc.join(' ')}`);
  }

  if (config.baseUri.length > 0) {
    directives.push(`base-uri ${config.baseUri.join(' ')}`);
  }

  if (config.formAction.length > 0) {
    directives.push(`form-action ${config.formAction.join(' ')}`);
  }

  if (config.frameAncestors.length > 0) {
    directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
  }

  // CSP Level 3 directives
  if (config.navigateTo && config.navigateTo.length > 0) {
    directives.push(`navigate-to ${config.navigateTo.join(' ')}`);
  }

  if (config.prefetchSrc && config.prefetchSrc.length > 0) {
    directives.push(`prefetch-src ${config.prefetchSrc.join(' ')}`);
  }

  // Sandbox directive
  if (config.sandbox && config.sandbox.length > 0) {
    directives.push(`sandbox ${config.sandbox.join(' ')}`);
  }

  // Require SRI
  if (config.requireSriFor && config.requireSriFor.length > 0) {
    directives.push(`require-sri-for ${config.requireSriFor.join(' ')}`);
  }

  // Security enhancements
  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  if (config.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }

  if (config.requireTrustedTypes) {
    directives.push("require-trusted-types-for 'script'");
  }

  if (config.trustedTypes && config.trustedTypes.length > 0) {
    directives.push(`trusted-types ${config.trustedTypes.join(' ')}`);
  }

  // Violation reporting
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  if (config.reportTo) {
    directives.push(`report-to ${config.reportTo}`);
  }

  return directives.join('; ');
}

/**
 * Create a complete CSP header with nonce
 */

/**
 * Create CSP header with optional report-only mode
 */
export function createCSPHeaderWithReportOnly(
  isDevelopment: boolean,
  nonce?: string,
  reportOnly: boolean = false
): { header: string; value: string } {
  const config = getCSPConfig(isDevelopment, nonce);
  const headerValue = buildCSPHeader(config);
  const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  return { header: headerName, value: headerValue };
}

export function createCSPHeader(isDevelopment: boolean, nonce?: string): string {
  const config = getCSPConfig(isDevelopment, nonce);
  return buildCSPHeader(config);
}

/**
 * Get all security headers including CSP
 */
export function getSecurityHeaders(
  isDevelopment: boolean,
  nonce?: string,
  reportOnly: boolean = false
): Record<string, string> {
  return {
    // Content Security Policy
    // Content Security Policy (with report-only support)
    ...(() => {
      const csp = createCSPHeaderWithReportOnly(isDevelopment, nonce, reportOnly);
      return { [csp.header]: csp.value };
    })(),

    // Prevent external clickjacking, allow same-origin for stellar iframe
    'X-Frame-Options': 'SAMEORIGIN',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS protection (legacy, CSP is preferred)
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy (feature policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),

    // Strict Transport Security (HTTPS only in production)
    ...(isDevelopment
      ? {}
      : {
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        }),
  };
}

/**
 * CSP violation reporting endpoint data structure
 */
export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    referrer: string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    disposition: string;
    'blocked-uri': string;
    'line-number': number;
    'column-number': number;
    'source-file': string;
    'status-code': number;
    'script-sample': string;
  };
}

/**
 * Log CSP violations for analysis
 */
export function logCSPViolation(report: CSPViolationReport, clientIP?: string): void {
  const violation = report['csp-report'];

  // Log to console for now - avoid external dependencies for Edge Runtime compatibility
  logger.warn('CSP Violation Report:', {
    timestamp: new Date().toISOString(),
    clientIP,
    documentUri: violation['document-uri'],
    violatedDirective: violation['violated-directive'],
    blockedUri: violation['blocked-uri'],
    sourceFile: violation['source-file'],
    lineNumber: violation['line-number'],
    columnNumber: violation['column-number'],
    scriptSample: violation['script-sample']?.substring(0, 100), // Limit sample size
  });

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to monitoring/logging service
  }
}
