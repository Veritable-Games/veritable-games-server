/**
 * Document Preview Generator
 *
 * Intelligently generates preview text from documents by:
 * 1. Using description/notes if available and meaningful
 * 2. Extracting text from document content (skipping YAML frontmatter)
 * 3. Taking the first meaningful paragraph(s)
 * 4. Truncating to appropriate length
 *
 * Handles both library (DB) and anarchist (filesystem) documents
 */

export interface DocumentForPreview {
  title: string;
  description?: string;
  notes?: string;
  abstract?: string;
  content?: string;
  content_preview?: string; // Partial content loaded for preview generation
  document_type?: string;
}

/**
 * Strip markdown formatting from text
 * Removes bold, italic, links, code blocks, headers, etc.
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove bold: **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Remove italic: *text* or _text_
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove images: ![alt](url) -> alt
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      // Remove inline code: `code` -> (remove entirely)
      .replace(/`[^`]+`/g, '')
      // Remove headers: # Header -> (remove entirely)
      .replace(/^#+\s+/gm, '')
      // Remove list markers: - item or * item
      .replace(/^[-*]\s+/gm, '')
      // Remove HTML comments
      .replace(/<!--.*?-->/gs, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
  );
}

/**
 * Extract meaningful preview text from a document
 * Returns up to 200 characters of preview text
 */
export function generateDocumentPreview(doc: DocumentForPreview): string {
  const MAX_LENGTH = 200;

  // 1. Try description first (preferred for library docs)
  if (doc.description) {
    const cleaned = stripMarkdown(doc.description.trim());
    if (isValidPreviewText(cleaned)) {
      return truncateText(cleaned, MAX_LENGTH);
    }
  }

  // 2. Try notes (anarchist documents often have good notes)
  if (doc.notes) {
    const cleaned = stripMarkdown(doc.notes.trim());
    if (isValidPreviewText(cleaned)) {
      return truncateText(cleaned, MAX_LENGTH);
    }
  }

  // 3. Try abstract
  if (doc.abstract) {
    const cleaned = stripMarkdown(doc.abstract.trim());
    if (isValidPreviewText(cleaned)) {
      return truncateText(cleaned, MAX_LENGTH);
    }
  }

  // 4. Extract from partial content if available (for list view)
  if (doc.content_preview) {
    const extracted = extractPreviewFromContent(doc.content_preview);
    if (extracted) {
      return truncateText(extracted, MAX_LENGTH);
    }
  }

  // 5. Extract from full content if available (for detail view)
  if (doc.content) {
    const extracted = extractPreviewFromContent(doc.content);
    if (extracted) {
      return truncateText(extracted, MAX_LENGTH);
    }
  }

  // 6. Fallback: empty string (no preview available)
  return '';
}

/**
 * Check if text is a valid preview (not just metadata/empty)
 */
function isValidPreviewText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (trimmed.length < 10) return false;

  // Reject pure metadata patterns
  if (/^(title|author|date|pubdate|language|source):/i.test(trimmed)) {
    return false;
  }

  // Reject if it's just URLs or links
  if (/^(https?:\/\/|ftp:\/\/)/.test(trimmed)) {
    return false;
  }

  // Reject if it's just a single word/marker
  if (trimmed.split(/\s+/).length < 3) {
    return false;
  }

  return true;
}

/**
 * Extract meaningful preview text from markdown/HTML content
 * Strips YAML frontmatter and takes first meaningful paragraph
 */
function extractPreviewFromContent(content: string): string {
  if (!content || typeof content !== 'string') return '';

  // Strip YAML frontmatter (---\n...\n---)
  let text = content.replace(/^---\n[\s\S]*?\n---\n*/m, '');

  // Strip HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Strip code blocks (```...```)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Strip inline code
  text = text.replace(/`[^`]+`/g, '');

  // Remove markdown headers (# Title, ## Subtitle, etc.)
  text = text.replace(/^#+\s+.+$/gm, '');

  // Remove markdown formatting
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
    .replace(/__([^_]+)__/g, '$1') // __bold__
    .replace(/\*([^*]+)\*/g, '$1') // *italic*
    .replace(/_([^_]+)_/g, '$1') // _italic_
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [link](url)
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1'); // ![alt](image)

  // Remove markdown list markers
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Split into lines and get first non-empty lines
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Combine first few meaningful lines
  let preview = '';
  for (const line of lines) {
    if (preview.length + line.length > 500) break; // Don't grab too much
    if (line.length > 10) {
      // Skip very short lines
      preview += (preview ? ' ' : '') + line;
    }
  }

  return preview;
}

/**
 * Truncate text to maximum length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  // Find last space before max length to avoid cutting words
  let truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    // If we found a space reasonably close, use it
    return truncated.substring(0, lastSpace) + '...';
  }

  // Otherwise just truncate and add ellipsis
  return truncated + '...';
}

/**
 * Get a secondary preview (different from main preview)
 * Useful for showing supplementary information
 */
export function generateSecondaryPreview(doc: DocumentForPreview): string {
  // If we have a good description, don't generate secondary
  if (doc.description && isValidPreviewText(doc.description)) {
    return '';
  }

  // Try to show notes as secondary preview for library docs
  if (doc.notes && isValidPreviewText(doc.notes)) {
    return truncateText(doc.notes, 150);
  }

  return '';
}
