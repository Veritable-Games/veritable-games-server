import { marked } from 'marked';
import { logger } from '@/lib/utils/logger';

// DOMPurify initialization with proper async handling
let DOMPurify: any = null;
let domPurifyLoading = false;
let domPurifyPromise: Promise<any> | null = null;

// Initialize DOMPurify with proper loading state management
async function initializeDOMPurify(): Promise<any> {
  if (DOMPurify) {
    return DOMPurify;
  }

  if (domPurifyPromise) {
    return domPurifyPromise;
  }

  if (typeof window === 'undefined') {
    // Server-side: use isomorphic-dompurify directly
    try {
      const { default: isomorphicDOMPurify } = await import('isomorphic-dompurify');
      DOMPurify = isomorphicDOMPurify;
      return DOMPurify;
    } catch (error) {
      logger.error('Failed to load isomorphic DOMPurify:', error);
      throw error;
    }
  }

  // Client-side: dynamic import with proper error handling
  domPurifyLoading = true;
  domPurifyPromise = import('dompurify')
    .then(module => {
      DOMPurify = module.default;
      domPurifyLoading = false;
      return DOMPurify;
    })
    .catch(error => {
      domPurifyLoading = false;
      domPurifyPromise = null;
      logger.error('Failed to load DOMPurify:', error);
      throw error;
    });

  return domPurifyPromise;
}

// Create custom extension for underline support
const underlineExtension = {
  name: 'underline',
  level: 'inline' as const,
  start(src: string) {
    return src.indexOf('__');
  },
  tokenizer(src: string) {
    const match = src.match(/^__([^_]+)__/);
    if (match) {
      return {
        type: 'underline',
        raw: match[0],
        text: match[1],
      };
    }
    return undefined;
  },
  renderer(token: any) {
    return `<u>${token.text}</u>`;
  },
};

// Configure marked with security-focused options
marked.use({ extensions: [underlineExtension] });

marked.setOptions({
  gfm: true, // GitHub Flavored Markdown (includes strikethrough with ~~text~~)
  breaks: true, // Convert line breaks to <br>
  // Note: sanitize and xhtml options removed in newer versions
  // We use DOMPurify for sanitization
});

// Security configuration for DOMPurify
const SAFE_HTML_CONFIG = {
  // Allow basic formatting tags
  ALLOWED_TAGS: [
    // Text formatting
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sup',
    'sub',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Lists
    'ul',
    'ol',
    'li',
    // Links (with restrictions)
    'a',
    // Code
    'code',
    'pre',
    // Quotes and definitions
    'blockquote',
    'cite',
    'q',
    // Tables
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Horizontal rule
    'hr',
    // Divs with limited attributes
    'div',
    'span',
  ],

  ALLOWED_ATTR: [
    // Link attributes (restricted)
    'href',
    // Code language specification
    'class',
    // Table attributes
    'colspan',
    'rowspan',
    // General attributes
    'id',
    'title',
    // Accessibility
    'aria-label',
    'aria-describedby',
  ],

  // URL schemes allowed in href
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

  // Don't allow data URIs
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],

  // Remove scripts and handlers
  KEEP_CONTENT: false,

  // Use HTML5 parser
  USE_PROFILES: { html: true },
};

// More restrictive config for user-generated content like comments
const STRICT_HTML_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'code', 'blockquote', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^https?:/,
  KEEP_CONTENT: false,
};

// Very restrictive config for plain text with minimal formatting
const MINIMAL_HTML_CONFIG = {
  ALLOWED_TAGS: ['strong', 'em', 'code'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: false,
};

export interface ContentSanitizationOptions {
  level: 'minimal' | 'strict' | 'safe';
  stripHtml?: boolean;
  maxLength?: number;
  allowMarkdown?: boolean;
}

export class ContentSanitizer {
  /**
   * Sanitize HTML content with DOMPurify (async version)
   */
  static async sanitizeHtmlAsync(
    html: string,
    level: 'minimal' | 'strict' | 'safe' = 'safe'
  ): Promise<string> {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      // Ensure DOMPurify is loaded
      await initializeDOMPurify();

      let config;
      switch (level) {
        case 'minimal':
          config = MINIMAL_HTML_CONFIG;
          break;
        case 'strict':
          config = STRICT_HTML_CONFIG;
          break;
        default:
          config = SAFE_HTML_CONFIG;
      }

      // Sanitize with DOMPurify
      const clean = DOMPurify.sanitize(html, config);

      // Additional cleanup
      return this.postProcessHtml(clean);
    } catch (error) {
      logger.error('Error sanitizing HTML with DOMPurify:', error);
      return this.basicTextCleanup(html);
    }
  }

  /**
   * Sanitize HTML content with DOMPurify (sync version with fallback)
   */
  static sanitizeHtml(html: string, level: 'minimal' | 'strict' | 'safe' = 'safe'): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // If DOMPurify is available, use it synchronously
    if (DOMPurify) {
      let config;
      switch (level) {
        case 'minimal':
          config = MINIMAL_HTML_CONFIG;
          break;
        case 'strict':
          config = STRICT_HTML_CONFIG;
          break;
        default:
          config = SAFE_HTML_CONFIG;
      }

      try {
        // Sanitize with DOMPurify
        const clean = DOMPurify.sanitize(html, config);
        // Additional cleanup
        return this.postProcessHtml(clean);
      } catch (error) {
        logger.error('Error sanitizing HTML with DOMPurify:', error);
        return this.basicTextCleanup(html);
      }
    }

    // If DOMPurify is loading or not available, use basic cleanup with warning
    if (domPurifyLoading) {
      logger.warn(
        'DOMPurify is still loading, using basic text cleanup. Consider using sanitizeHtmlAsync for better security.'
      );
    }

    return this.basicTextCleanup(html);
  }

  /**
   * Convert Markdown to safe HTML (async version)
   */
  static async markdownToHtmlAsync(
    markdown: string,
    level: 'minimal' | 'strict' | 'safe' = 'safe'
  ): Promise<string> {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      // Convert markdown to HTML (use parse method for synchronous operation)
      const html = marked.parse(markdown) as string;

      // Sanitize the resulting HTML with async sanitization
      return this.sanitizeHtmlAsync(html, level);
    } catch (error) {
      logger.error('Error converting markdown to HTML:', error);
      // Fallback to plain text
      return this.sanitizeHtmlAsync(markdown, 'minimal');
    }
  }

  /**
   * Convert Markdown to safe HTML (sync version with fallback)
   */
  static markdownToHtml(markdown: string, level: 'minimal' | 'strict' | 'safe' = 'safe'): string {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      // Convert markdown to HTML (use parse method for synchronous operation)
      const html = marked.parse(markdown) as string;

      // Sanitize the resulting HTML
      return this.sanitizeHtml(html, level);
    } catch (error) {
      logger.error('Error converting markdown to HTML:', error);
      // Fallback to plain text
      return this.sanitizeHtml(markdown, 'minimal');
    }
  }

  /**
   * Sanitize content based on options
   */
  static sanitizeContent(
    content: string,
    options: ContentSanitizationOptions = { level: 'safe' }
  ): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    let processed = content;

    // Apply length limit first if specified
    if (options.maxLength && processed.length > options.maxLength) {
      processed = processed.substring(0, options.maxLength);
    }

    // Process markdown if enabled
    if (options.allowMarkdown) {
      processed = this.markdownToHtml(processed, options.level);
    } else {
      processed = this.sanitizeHtml(processed, options.level);
    }

    // Strip all HTML if requested
    if (options.stripHtml) {
      processed = this.stripHtml(processed);
    }

    return processed.trim();
  }

  /**
   * Strip all HTML tags and return plain text
   */
  static stripHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // If DOMPurify is not available, use basic regex stripping
    if (!DOMPurify) {
      return this.basicHtmlStrip(html);
    }

    try {
      // Use DOMPurify to strip all HTML
      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });

      // Clean up extra whitespace but preserve line breaks (both LF and CRLF)
      return clean.replace(/[^\S\r\n]+/g, ' ').trim();
    } catch (error) {
      logger.error('Error stripping HTML with DOMPurify:', error);
      return this.basicHtmlStrip(html);
    }
  }

  /**
   * Sanitize a URL to prevent XSS
   */
  static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove dangerous protocols
    const cleaned = url.trim().toLowerCase();

    if (
      cleaned.startsWith('javascript:') ||
      cleaned.startsWith('data:') ||
      cleaned.startsWith('vbscript:') ||
      cleaned.startsWith('file:') ||
      cleaned.includes('<script') ||
      cleaned.includes('javascript:')
    ) {
      return '';
    }

    // Allow relative URLs, http, https, mailto, tel
    if (
      cleaned.startsWith('/') ||
      cleaned.startsWith('./') ||
      cleaned.startsWith('../') ||
      cleaned.startsWith('http://') ||
      cleaned.startsWith('https://') ||
      cleaned.startsWith('mailto:') ||
      cleaned.startsWith('tel:')
    ) {
      return url.trim();
    }

    // Default to treating as relative URL
    return url.trim();
  }

  /**
   * Extract plain text for search indexing
   */
  static extractSearchText(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Strip HTML and normalize whitespace
    const text = this.stripHtml(content);

    // Remove extra whitespace and normalize but preserve line structure
    return text
      .replace(/[^\S\r\n]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Generate a safe excerpt from content
   */
  static generateExcerpt(content: string, maxLength: number = 200): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const plainText = this.stripHtml(content);

    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Find the last complete word within the limit
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Validate that content is safe
   */
  static validateContent(
    content: string,
    options: ContentSanitizationOptions = { level: 'safe' }
  ): {
    isValid: boolean;
    errors: string[];
    sanitized: string;
  } {
    const errors: string[] = [];

    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        errors: ['Content must be a non-empty string'],
        sanitized: '',
      };
    }

    // Check length
    if (options.maxLength && content.length > options.maxLength) {
      errors.push(`Content exceeds maximum length of ${options.maxLength} characters`);
    }

    // Sanitize content
    const sanitized = this.sanitizeContent(content, options);

    // Check if sanitization removed too much content
    const originalLength = this.stripHtml(content).length;
    const sanitizedLength = this.stripHtml(sanitized).length;

    if (originalLength > 0 && sanitizedLength < originalLength * 0.5) {
      errors.push('Content contains too much invalid markup');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Post-process sanitized HTML for additional cleanup
   */
  private static postProcessHtml(html: string): string {
    if (!html) return '';

    return (
      html
        // Remove empty paragraphs
        .replace(/<p>\s*<\/p>/g, '')
        // Remove empty divs
        .replace(/<div>\s*<\/div>/g, '')
        // Clean up multiple line breaks
        .replace(/(<br\s*\/?>){3,}/g, '<br><br>')
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Basic text cleanup when DOMPurify is not available
   */
  private static basicTextCleanup(text: string): string {
    if (!text) return '';

    // Basic HTML entity decoding and cleanup
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();
  }

  /**
   * Basic HTML tag stripping when DOMPurify is not available
   */
  private static basicHtmlStrip(html: string): string {
    if (!html) return '';

    // Basic regex to strip HTML tags (not as secure as DOMPurify)
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();
  }
}

// Convenience functions for common use cases (async versions)
export const sanitizeWikiContentAsync = async (content: string): Promise<string> => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'safe',
    allowMarkdown: true,
  });
};

export const sanitizeForumContentAsync = async (content: string): Promise<string> => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'safe',
    allowMarkdown: true,
  });
};

export const markdownToSafeHtmlAsync = async (markdown: string): Promise<string> => {
  return ContentSanitizer.markdownToHtmlAsync(markdown, 'safe');
};

// Convenience functions for common use cases (sync versions with fallback)
export const sanitizeWikiContent = (content: string): string => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'safe',
    allowMarkdown: true,
  });
};

export const sanitizeForumContent = (content: string): string => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'safe',
    allowMarkdown: true,
  });
};

export const sanitizeUserComment = (content: string): string => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'strict',
    allowMarkdown: true,
    maxLength: 1000,
  });
};

export const sanitizeUserBio = (content: string): string => {
  return ContentSanitizer.sanitizeContent(content, {
    level: 'minimal',
    allowMarkdown: false,
    maxLength: 500,
  });
};

export const markdownToSafeHtml = (markdown: string): string => {
  return ContentSanitizer.markdownToHtml(markdown, 'safe');
};

export const stripToPlainText = (content: string): string => {
  return ContentSanitizer.stripHtml(content);
};

export const generateSafeExcerpt = (content: string, length?: number): string => {
  return ContentSanitizer.generateExcerpt(content, length);
};

// Export the main class as default
export default ContentSanitizer;
