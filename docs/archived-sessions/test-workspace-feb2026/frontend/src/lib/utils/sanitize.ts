/**
 * Server-side text sanitization utilities
 *
 * These utilities provide simple, build-safe sanitization for API routes
 * using pure regex patterns - no jsdom or DOMPurify dependencies required.
 *
 * This avoids ESM compatibility issues with jsdom/parse5.
 */

/**
 * Strip all HTML tags from a string, returning plain text
 *
 * @param str - Input string that may contain HTML
 * @returns Plain text with all HTML tags removed
 *
 * @example
 * stripHtmlTags('<p>Hello <strong>World</strong></p>')
 * // Returns: 'Hello World'
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitize a plain text title
 * Strips HTML and trims whitespace
 *
 * @param title - User-provided title
 * @returns Sanitized plain text title
 */
export function sanitizeTitle(title: string): string {
  return stripHtmlTags(title);
}

/**
 * Sanitize plain text content
 * For now, just strips HTML tags. Can be extended for more complex sanitization.
 *
 * @param content - User-provided content
 * @returns Sanitized plain text content
 */
export function sanitizePlainText(content: string): string {
  return stripHtmlTags(content);
}

/**
 * Sanitize HTML content by removing dangerous elements and attributes
 *
 * Uses regex-based sanitization to:
 * - Remove script, style, and iframe tags
 * - Remove event handler attributes (onclick, onload, etc.)
 * - Neutralize dangerous URL protocols (javascript:, data:, vbscript:)
 *
 * This is the same pattern used in ContentSanitizer.basicSanitize() and
 * the forums validation module - battle-tested throughout the codebase.
 *
 * @param html - User-provided HTML content
 * @param options - Optional configuration (ALLOWED_TAGS, ALLOWED_ATTR)
 * @returns Sanitized HTML with dangerous content removed
 */
export function sanitizeHtml(
  html: string,
  options?: {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
  }
): string {
  // Use regex-based sanitization (no jsdom dependency)
  let sanitized = html
    // Remove script tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe tags and their contents
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove event handler attributes (onclick, onload, onerror, etc.)
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Neutralize javascript: protocol in href
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="#"')
    // Neutralize javascript: protocol in src
    .replace(/src\s*=\s*["']?\s*javascript:/gi, 'src="#"')
    // Neutralize data: protocol in href (can be used for XSS)
    .replace(/href\s*=\s*["']?\s*data:/gi, 'href="#"')
    // Neutralize vbscript: protocol
    .replace(/href\s*=\s*["']?\s*vbscript:/gi, 'href="#"');

  // If ALLOWED_TAGS is explicitly empty, strip all HTML tags
  if (options?.ALLOWED_TAGS?.length === 0) {
    return stripHtmlTags(sanitized);
  }

  return sanitized.trim();
}
