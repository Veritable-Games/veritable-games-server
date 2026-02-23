/**
 * API Route: Populate anarchist document descriptions from content
 *
 * POST /api/library/admin/anarchist/populate-descriptions
 * Extracts the first paragraph from each anarchist document and populates the
 * notes field for use as preview text in the grid/list views.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const LIBRARY_BASE_PATH = process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library';

/**
 * Extract first meaningful content from markdown, handling all formatting
 */
function extractFirstParagraph(content: string): string | null {
  // Remove YAML frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Split into lines
  const lines = withoutFrontmatter.split('\n');

  let extractedText = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and pure whitespace
    if (!trimmed || trimmed === '') {
      continue;
    }

    // Skip section separators
    if (trimmed === '---' || trimmed.startsWith('---')) {
      continue;
    }

    // Handle markdown headers - extract the text content
    if (trimmed.startsWith('#')) {
      // Remove # symbols and get the text
      extractedText = trimmed.replace(/^#+\s*/, '').trim();
      if (extractedText) break;
      continue;
    }

    // Handle blockquotes - extract the text
    if (trimmed.startsWith('>')) {
      extractedText = trimmed.replace(/^>\s*/, '').trim();
      if (extractedText) break;
      continue;
    }

    // Handle bold/italic markdown - strip formatting and extract text
    if (trimmed.startsWith('*') || trimmed.startsWith('**') || trimmed.startsWith('_')) {
      extractedText = trimmed
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '') // ** bold **
        .replace(/^\*/, '')
        .replace(/\*$/, '') // * italic *
        .replace(/^__/, '')
        .replace(/__$/, '') // __ bold __
        .replace(/^_/, '')
        .replace(/_$/, '') // _ italic _
        .trim();
      if (extractedText) break;
      continue;
    }

    // Handle HTML tags - extract inner text
    if (trimmed.startsWith('<')) {
      extractedText = trimmed.replace(/<[^>]*>/g, '').trim();
      if (extractedText) break;
      continue;
    }

    // Plain text - use directly
    extractedText = trimmed;
    break;
  }

  if (!extractedText) {
    return null;
  }

  // Limit to ~200 characters
  if (extractedText.length > 200) {
    return extractedText.substring(0, 200).trim() + '...';
  }

  return extractedText;
}

/**
 * Read document content from filesystem
 */
async function getDocumentContent(filePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(LIBRARY_BASE_PATH, filePath);

    // Security check
    if (!fullPath.startsWith(LIBRARY_BASE_PATH)) {
      logger.warn(`Path traversal attempt: ${filePath}`);
      return null;
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    logger.error(`Failed to read ${filePath}:`, error);
    return null;
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    // Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Authorization check (admin only)
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Audit log
    logger.info(
      `[ADMIN] ${request.url} accessed by ${user.username} (${user.id}) at ${new Date().toISOString()}`
    );
    logger.info('📝 Starting anarchist document description population...');

    // Get all documents with NULL notes
    const docsResult = await dbAdapter.query(
      `SELECT id, slug, file_path FROM anarchist.documents WHERE notes IS NULL ORDER BY created_at DESC`,
      [],
      { schema: 'anarchist' }
    );

    const documents = docsResult.rows;
    logger.info(`Found ${documents.length} documents with empty descriptions`);

    if (documents.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'All documents already have descriptions',
          statistics: {
            documents_processed: 0,
            documents_updated: 0,
            documents_skipped: 0,
            documents_with_errors: 0,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    let updated = 0;
    let errors = 0;
    let skipped = 0;
    const sampleResults: any[] = [];

    // Process documents
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      try {
        // Read content
        const content = await getDocumentContent(doc.file_path);
        if (!content) {
          skipped++;
          continue;
        }

        // Extract description
        const description = extractFirstParagraph(content);
        if (!description) {
          skipped++;
          continue;
        }

        // Update database
        await dbAdapter.query(
          `UPDATE anarchist.documents SET notes = $1 WHERE id = $2`,
          [description, doc.id],
          { schema: 'anarchist' }
        );

        updated++;

        // Keep sample results
        if (sampleResults.length < 10) {
          sampleResults.push({
            id: doc.id,
            slug: doc.slug,
            description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
          });
        }

        // Log progress
        if ((i + 1) % 1000 === 0) {
          logger.info(
            `Processed ${i + 1}/${documents.length}: ${updated} updated, ${skipped} skipped`
          );
        }
      } catch (error) {
        errors++;
        if (errors <= 5) {
          logger.error(`Error processing ${doc.slug}:`, error);
        }
      }
    }

    logger.info(`\n✓ Population complete!`);
    logger.info(`  Updated: ${updated}`);
    logger.info(`  Skipped: ${skipped}`);
    logger.info(`  Errors: ${errors}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Anarchist document descriptions populated successfully',
        statistics: {
          documents_processed: documents.length,
          documents_updated: updated,
          documents_skipped: skipped,
          documents_with_errors: errors,
        },
        sample_results: sampleResults,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Fatal error during population:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to populate descriptions',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(POSTHandler);
