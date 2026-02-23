/**
 * Library Document File Service
 * Handles reading and writing markdown files for library documents
 * Based on anarchist service implementation with enhancements
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/utils/logger';

export class LibraryFileService {
  // Base path for library documents
  // In Docker: /app/library-documents (mounted volume)
  // In development: frontend/data/library/documents
  private readonly LIBRARY_BASE_PATH =
    process.env.LIBRARY_DOCUMENTS_PATH || path.join(process.cwd(), 'data/library/documents');

  /**
   * Parse YAML frontmatter from markdown content
   * Returns both frontmatter object and content without frontmatter
   */
  parseFrontmatter(content: string): {
    frontmatter: Record<string, any>;
    contentWithoutFrontmatter: string;
  } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch || !frontmatterMatch[1] || !frontmatterMatch[2]) {
      return {
        frontmatter: {},
        contentWithoutFrontmatter: content,
      };
    }

    const frontmatterText = frontmatterMatch[1];
    const mainContent = frontmatterMatch[2];
    const frontmatter: Record<string, any> = {};

    // Parse YAML key-value pairs
    frontmatterText.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (key) {
        // Remove quotes from value if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        frontmatter[key] = cleanValue;
      }
    });

    return {
      frontmatter,
      contentWithoutFrontmatter: mainContent.trim(),
    };
  }

  /**
   * Read document content from filesystem
   * Security: Prevents path traversal attacks
   */
  async getDocumentContent(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.LIBRARY_BASE_PATH, filePath);

      // Security: Ensure path is within library directory
      if (!fullPath.startsWith(this.LIBRARY_BASE_PATH)) {
        logger.warn('Path traversal attempt detected', { filePath, fullPath });
        return null;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        logger.warn('Document file not found', { filePath });
      } else {
        logger.error('Failed to read document file', { filePath, error });
      }
      return null;
    }
  }

  /**
   * Write document content to filesystem
   * Used during document creation/update
   */
  async writeDocumentContent(
    filePath: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const fullPath = path.join(this.LIBRARY_BASE_PATH, filePath);

      // Security check
      if (!fullPath.startsWith(this.LIBRARY_BASE_PATH)) {
        logger.warn('Path traversal attempt detected', { filePath });
        return false;
      }

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Generate YAML frontmatter
      const frontmatterLines = ['---'];

      for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === undefined) continue;

        // Format value appropriately
        let formattedValue: string;
        if (typeof value === 'string') {
          // Quote strings that contain special characters
          if (value.includes(':') || value.includes('#') || value.includes('"')) {
            formattedValue = JSON.stringify(value);
          } else {
            formattedValue = value;
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          formattedValue = String(value);
        } else {
          formattedValue = JSON.stringify(value);
        }

        frontmatterLines.push(`${key}: ${formattedValue}`);
      }

      frontmatterLines.push('---', '');

      const fileContent = frontmatterLines.join('\n') + content;

      // Write file atomically (write to temp, then rename)
      const tempPath = fullPath + '.tmp';
      await fs.writeFile(tempPath, fileContent, 'utf-8');
      await fs.rename(tempPath, fullPath);

      return true;
    } catch (error) {
      logger.error('Failed to write document file', { filePath, error });
      return false;
    }
  }

  /**
   * Delete document file from filesystem
   */
  async deleteDocumentFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.LIBRARY_BASE_PATH, filePath);

      // Security check
      if (!fullPath.startsWith(this.LIBRARY_BASE_PATH)) {
        logger.warn('Path traversal attempt detected', { filePath });
        return false;
      }

      await fs.unlink(fullPath);
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        logger.warn('File already deleted or not found', { filePath });
        return true; // Not an error if file doesn't exist
      }
      logger.error('Failed to delete document file', { filePath, error });
      return false;
    }
  }

  /**
   * Generate file path for new document
   * Format: YYYY/MM/slug.md
   */
  generateFilePath(slug: string, date?: Date): string {
    const now = date || new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}/${slug}.md`;
  }

  /**
   * Calculate word count from markdown content
   * Removes frontmatter and markdown syntax before counting
   */
  calculateWordCount(content: string): number {
    if (!content) return 0;

    // Remove YAML frontmatter
    const { contentWithoutFrontmatter } = this.parseFrontmatter(content);

    // Remove markdown syntax
    const plainText = contentWithoutFrontmatter
      .replace(/```[\s\S]*?```/g, '') // code blocks
      .replace(/`[^`]*`/g, '') // inline code
      .replace(/#{1,6}\s/g, '') // headers
      .replace(/[*_~]/g, '') // emphasis
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/\n+/g, ' ') // newlines
      .trim();

    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate estimated reading time in minutes
   * Based on 250 words per minute average reading speed
   */
  calculateReadingTime(wordCount: number): number {
    const WORDS_PER_MINUTE = 250;
    return Math.ceil(wordCount / WORDS_PER_MINUTE);
  }

  /**
   * Get base path for library documents
   * Useful for debugging and testing
   */
  getBasePath(): string {
    return this.LIBRARY_BASE_PATH;
  }
}

// Export singleton instance
export const libraryFileService = new LibraryFileService();
