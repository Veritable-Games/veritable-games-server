/**
 * Mock DOMPurify for Jest tests
 *
 * Ensures sanitization tests run with proper XSS protection.
 * Simulates DOMPurify behavior for dangerous patterns.
 */

const mockDOMPurify = {
  sanitize: (content: string, config?: any) => {
    // Simple mock that removes dangerous patterns
    let sanitized = content;

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove style tags
    sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove dangerous protocols (CRITICAL for XSS prevention)
    sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');
    sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '');
    sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:[^"'\s>]*/gi, '');
    sanitized = sanitized.replace(/href\s*=\s*["']?\s*vbscript:[^"'\s>]*/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    return sanitized.trim();
  },
};

export default mockDOMPurify;
