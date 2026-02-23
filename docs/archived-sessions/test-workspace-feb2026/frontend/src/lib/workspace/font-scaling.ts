/**
 * Font Scaling Utility for Workspace Nodes
 *
 * Calculates optimal font size to fit text within a container using binary search.
 * This approach is more efficient and reliable than measuring scrollWidth/scrollHeight.
 */

/**
 * Simple LRU Cache implementation
 * Stores font size calculations to avoid expensive re-computations
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if already exists (to reinsert at end)
    this.cache.delete(key);

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if cache is full
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value as K;
      this.cache.delete(firstKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Global font size cache - stores up to 1000 calculations
 * Cache key format: "content_hash|width|height|padding|lineHeight|baseFontSize"
 */
const fontSizeCache = new LRUCache<string, number>(1000);

/**
 * Generate cache key for font size calculations
 */
function generateCacheKey(
  content: string,
  containerWidth: number,
  containerHeight: number,
  options: {
    padding: number;
    lineHeight: number;
    baseFontSize?: number;
  }
): string {
  // Use a simple hash of content to avoid huge keys
  // For performance, we'll use content length + first/last chars as a quick hash
  const contentHash =
    content.length > 0
      ? `${content.length}_${content.charCodeAt(0)}_${content.charCodeAt(content.length - 1)}`
      : '0';

  return `${contentHash}|${Math.round(containerWidth)}|${Math.round(containerHeight)}|${options.padding}|${options.lineHeight}|${options.baseFontSize || 16}`;
}

/**
 * Strip HTML tags from content to get plain text for measurement
 */
function stripHtmlTags(html: string): string {
  // Remove HTML tags but preserve line breaks
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
  const stripped = withBreaks.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  const doc = new DOMParser().parseFromString(stripped, 'text/html');
  return doc.documentElement.textContent || '';
}

/**
 * Measure text dimensions at a given font size using Canvas API
 * Handles text wrapping within a container width
 */
function measureTextDimensions(
  text: string,
  fontSize: number,
  fontFamily: string,
  lineHeight: number,
  containerWidth: number
): { width: number; height: number } {
  // Singleton canvas for efficient measurement
  if (!globalThis._measureCanvas) {
    globalThis._measureCanvas = document.createElement('canvas');
  }

  const canvas = globalThis._measureCanvas;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px ${fontFamily}`;

  // Split by newlines first
  const paragraphs = text.split('\n');
  let totalLines = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph || paragraph.trim() === '') {
      totalLines += 1; // Empty paragraph = 1 line
      continue;
    }

    // Word wrap the paragraph to fit container width
    const words = paragraph.split(' ');
    let currentLine = '';
    let lineCount = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > containerWidth && currentLine) {
        // Line is too long, start new line
        lineCount++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Don't forget the last line
    if (currentLine) {
      lineCount++;
    }

    totalLines += lineCount;
  }

  // Calculate height based on number of wrapped lines
  const height = totalLines * fontSize * lineHeight;

  return { width: containerWidth, height };
}

/**
 * Calculate optimal font size to fit text within container (Miro-style)
 * Text wraps to fill width first, then scales down only if height is exceeded
 * Uses binary search for O(log n) performance
 *
 * @param content - HTML content (will be stripped to plain text)
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @param options - Configuration options
 * @returns Optimal font size in pixels
 */
export function calculateOptimalFontSize(
  content: string,
  containerWidth: number,
  containerHeight: number,
  options: {
    minFontSize: number; // e.g., 8px
    maxFontSize: number; // e.g., 72px
    fontFamily: string; // e.g., 'Arial, sans-serif'
    padding: number; // e.g., 12px (total padding on one side)
    lineHeight: number; // e.g., 1.5
    baseFontSize?: number; // e.g., 16px (preferred font size, scales down only if needed)
  }
): number {
  const { minFontSize, maxFontSize, fontFamily, padding, lineHeight, baseFontSize = 16 } = options;

  // Check cache first
  const cacheKey = generateCacheKey(content, containerWidth, containerHeight, {
    padding,
    lineHeight,
    baseFontSize,
  });
  const cached = fontSizeCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Strip HTML tags to get plain text
  const plainText = stripHtmlTags(content);

  // Handle empty content - return base font size
  if (!plainText || plainText.trim() === '') {
    fontSizeCache.set(cacheKey, baseFontSize);
    return baseFontSize;
  }

  // Calculate available space (subtract padding on both sides)
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;

  // Guard against invalid dimensions
  if (availableWidth <= 0 || availableHeight <= 0) {
    return minFontSize;
  }

  // Miro-style: Start with base font size, only scale down if needed
  // First check if text fits at base font size
  const baseDimensions = measureTextDimensions(
    plainText,
    baseFontSize,
    fontFamily,
    lineHeight,
    availableWidth
  );

  if (baseDimensions.height <= availableHeight) {
    // Text fits at base size - use it!
    fontSizeCache.set(cacheKey, baseFontSize);
    return baseFontSize;
  }

  // Text doesn't fit at base size - binary search for largest size that fits
  let min = minFontSize;
  let max = Math.min(baseFontSize, maxFontSize); // Don't go larger than base size
  let optimalSize = minFontSize;

  // Binary search with 0.5px precision
  while (max - min > 0.5) {
    const mid = (min + max) / 2;
    const dimensions = measureTextDimensions(
      plainText,
      mid,
      fontFamily,
      lineHeight,
      availableWidth
    );

    // Check if wrapped text fits vertically
    if (dimensions.height <= availableHeight) {
      // Text fits - try larger
      optimalSize = mid;
      min = mid;
    } else {
      // Text doesn't fit - try smaller
      max = mid;
    }
  }

  // Round down for safety (ensures text always fits)
  const result = Math.floor(optimalSize);

  // Cache the result
  fontSizeCache.set(cacheKey, result);

  return result;
}

/**
 * Augment globalThis with canvas singleton
 */
declare global {
  var _measureCanvas: HTMLCanvasElement | undefined;
}
