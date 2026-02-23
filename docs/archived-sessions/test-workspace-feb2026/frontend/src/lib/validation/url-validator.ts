/**
 * URL Validation for Author Portfolio Links
 *
 * Security-first validation that blocks malicious URLs while
 * allowing artists to use any legitimate portfolio platform.
 */

export interface UrlValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
  warnings?: string[];
}

/**
 * Common artist portfolio platforms (for helpful suggestions, NOT blocking)
 */
export const COMMON_PORTFOLIO_PLATFORMS = [
  'artstation.com',
  'behance.net',
  'deviantart.com',
  'dribbble.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'mastodon.social',
  'bsky.app', // Bluesky
  'pixiv.net',
  'tumblr.com',
  'linkedin.com',
  'github.com',
  'patreon.com',
  'ko-fi.com',
  'gumroad.com',
  'itch.io',
  'newgrounds.com',
  'furaffinity.net',
  'cara.app',
] as const;

export class PortfolioUrlValidator {
  /**
   * Validate and sanitize a portfolio URL
   */
  static validate(url: string | null | undefined): UrlValidationResult {
    // Allow null/empty for anonymous references
    if (!url || url.trim() === '') {
      return { valid: true, sanitized: '' };
    }

    const trimmed = url.trim();
    const warnings: string[] = [];

    // Length validation
    if (trimmed.length > 500) {
      return {
        valid: false,
        sanitized: '',
        error: 'URL must be less than 500 characters',
      };
    }

    // Protocol validation
    const lower = trimmed.toLowerCase();

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:', 'blob:'];

    for (const protocol of dangerousProtocols) {
      if (lower.startsWith(protocol)) {
        return {
          valid: false,
          sanitized: '',
          error: `Protocol "${protocol}" is not allowed for security reasons`,
        };
      }
    }

    // Check for script tags in URL (defense in depth)
    if (lower.includes('<script') || lower.includes('javascript:')) {
      return {
        valid: false,
        sanitized: '',
        error: 'URL contains potentially malicious content',
      };
    }

    // Parse URL
    let parsed: URL;
    try {
      // Try parsing as absolute URL
      parsed = new URL(trimmed);
    } catch {
      // If fails, might be relative or missing protocol
      try {
        // Assume https:// if missing
        parsed = new URL(`https://${trimmed}`);
        warnings.push('Added https:// protocol to URL');
      } catch {
        return {
          valid: false,
          sanitized: '',
          error: 'Invalid URL format',
        };
      }
    }

    // Require HTTPS (except localhost for dev)
    if (parsed.protocol === 'http:' && !parsed.hostname.includes('localhost')) {
      return {
        valid: false,
        sanitized: '',
        error: 'Only HTTPS URLs are allowed (except localhost for development)',
      };
    }

    // Validate protocol is http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        sanitized: '',
        error: `Protocol "${parsed.protocol}" is not allowed. Only HTTP/HTTPS are supported.`,
      };
    }

    // Block localhost/internal IPs (prevent SSRF)
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];

    if (
      blockedHosts.includes(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return {
        valid: false,
        sanitized: '',
        error: 'Internal/private IP addresses are not allowed for portfolio URLs',
      };
    }

    // Get the sanitized URL
    const sanitized = parsed.toString();

    // Check if URL is a known portfolio platform (informational)
    const isKnownPlatform = COMMON_PORTFOLIO_PLATFORMS.some(platform =>
      parsed.hostname.includes(platform)
    );

    if (!isKnownPlatform) {
      // This is NOT an error, just informational
      warnings.push('URL is from a custom domain (not a known portfolio platform)');
    }

    return {
      valid: true,
      sanitized: sanitized,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate and throw on error (for use in API routes)
   */
  static validateOrThrow(url: string | null | undefined): string {
    const result = this.validate(url);
    if (!result.valid) {
      throw new Error(result.error || 'Invalid portfolio URL');
    }
    return result.sanitized;
  }

  /**
   * Extract domain from URL for display
   */
  static extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}
