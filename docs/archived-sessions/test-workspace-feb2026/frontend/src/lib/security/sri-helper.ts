/**
 * Subresource Integrity (SRI) Helper
 * Provides integrity hashes for external CDN resources
 */

import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

// Known CDN resources with their integrity hashes
export const CDN_INTEGRITY = {
  // Three.js
  'https://unpkg.com/three@0.180.0/build/three.module.js': {
    integrity: 'sha384-GENERATE_THIS_HASH',
    crossOrigin: 'anonymous',
  },

  // Common libraries that might be used
  'https://cdn.jsdelivr.net/npm/react@19/umd/react.production.min.js': {
    integrity: 'sha384-GENERATE_THIS_HASH',
    crossOrigin: 'anonymous',
  },

  // Add more CDN resources as needed
} as const;

/**
 * Generate SRI hash for a resource
 */
export async function generateSRIHash(
  content: string | Buffer,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha384'
): Promise<string> {
  const hash = crypto.createHash(algorithm);
  hash.update(content);
  const digest = hash.digest('base64');
  return `${algorithm}-${digest}`;
}

/**
 * Verify SRI hash
 */
export function verifySRIHash(content: string | Buffer, expectedHash: string): boolean {
  const [algorithm, hash] = expectedHash.split('-');

  // Type guard: ensure algorithm is one of the valid hash algorithms
  if (algorithm !== 'sha256' && algorithm !== 'sha384' && algorithm !== 'sha512') {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  const actualHash = crypto.createHash(algorithm).update(content).digest('base64');

  return actualHash === hash;
}

/**
 * React component for loading external scripts with SRI
 */
export function ScriptWithSRI({
  src,
  integrity,
  crossOrigin = 'anonymous',
  async = true,
  defer = false,
  onLoad,
  onError,
}: {
  src: string;
  integrity?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  async?: boolean;
  defer?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}) {
  // Get integrity from known CDN resources if not provided
  const integrityHash = integrity || CDN_INTEGRITY[src as keyof typeof CDN_INTEGRITY]?.integrity;

  if (!integrityHash && process.env.NODE_ENV === 'production') {
    logger.warn(`No integrity hash for external script: ${src}`);
  }

  // This would be used in a Next.js Script component
  return {
    src,
    integrity: integrityHash,
    crossOrigin,
    async,
    defer,
    onLoad,
    onError,
  };
}

/**
 * Generate Content Security Policy with SRI requirements
 */
export function generateCSPWithSRI(nonce: string): string {
  const policies = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `require-sri-for script style`, // Require SRI for all scripts and styles
  ];

  return policies.join('; ');
}

/**
 * Middleware to add SRI enforcement headers
 */
export function addSRIHeaders(headers: Headers, nonce: string): void {
  // Add CSP header with SRI requirements
  const csp = generateCSPWithSRI(nonce);
  headers.set('Content-Security-Policy', csp);

  // Add additional security headers for SRI
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Validate all external resources have SRI
 */
export function validateExternalResources(html: string): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  // Check scripts
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/g;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    const fullTag = match[0];

    if (!src) continue;

    // Check if it's external
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      // Check if it has integrity attribute
      if (!fullTag.includes('integrity=')) {
        missing.push(src);
      }
    }
  }

  // Check stylesheets
  const linkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/g;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const fullTag = match[0];

    if (!href) continue;

    // Check if it's external
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      // Check if it has integrity attribute
      if (!fullTag.includes('integrity=')) {
        missing.push(href);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Generate SRI hash for local build artifacts
 */
export async function generateBuildSRI(buildPath: string): Promise<Record<string, string>> {
  const fs = await import('fs');
  const path = await import('path');
  const glob = await import('glob');

  const files = glob.sync('**/*.{js,css}', { cwd: buildPath });
  const hashes: Record<string, string> = {};

  for (const file of files) {
    const filePath = path.join(buildPath, file);
    const content = fs.readFileSync(filePath);
    const hash = await generateSRIHash(content);
    hashes[file] = hash;
  }

  return hashes;
}

export default {
  CDN_INTEGRITY,
  generateSRIHash,
  verifySRIHash,
  ScriptWithSRI,
  generateCSPWithSRI,
  addSRIHeaders,
  validateExternalResources,
  generateBuildSRI,
};
