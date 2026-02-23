/**
 * API Route: Extract title, author and date from anarchist document frontmatter
 *
 * POST /api/library/admin/anarchist/extract-author-date
 *
 * Reads YAML frontmatter from all anarchist markdown files and extracts:
 * - title field (clean title without author name)
 * - author field
 * - date field (with normalization)
 *
 * Updates anarchist.documents with extracted values and generates a report
 * listing any documents with missing or unparseable data.
 *
 * Query params:
 * - dryRun=true: Don't update database, just report what would be extracted
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

interface FrontmatterData {
  author?: string;
  date?: string;
  pubdate?: string;
  title?: string;
  [key: string]: any;
}

interface ExtractionResult {
  document_id: number;
  slug: string;
  title: string;
  title_extracted: string | null;
  title_status: 'found' | 'missing' | 'unchanged';
  author_extracted: string | null;
  author_status: 'found' | 'missing' | 'empty';
  date_extracted: string | null;
  date_status: 'found' | 'normalized' | 'missing' | 'unparseable';
  date_raw: string | null;
  error?: string;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): FrontmatterData {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch || !frontmatterMatch[1]) return {};

  const frontmatterText = frontmatterMatch[1];
  const frontmatter: FrontmatterData = {};

  // Simple YAML parser for basic key-value pairs
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes if present
    value = value.replace(/^["']|["']$/g, '');

    // Handle YAML arrays (just take first item for now)
    if (value.startsWith('[')) {
      // Skip arrays for simple parser
      return;
    }

    if (key && value) {
      frontmatter[key] = value;
    }
  });

  return frontmatter;
}

/**
 * Normalize date to YYYY-MM-DD or YYYY format
 */
function normalizeDate(dateStr: string | undefined): {
  normalized: string | null;
  status: 'found' | 'normalized' | 'unparseable';
} {
  if (!dateStr || dateStr.trim() === '') {
    return { normalized: null, status: 'unparseable' };
  }

  const trimmed = dateStr.trim();

  // ISO 8601 date format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { normalized: trimmed.substring(0, 10), status: 'found' };
  }

  // ISO 8601 datetime (YYYY-MM-DDTHH:MM:SS) - extract date part
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return { normalized: trimmed.substring(0, 10), status: 'normalized' };
  }

  // Year only (YYYY)
  if (/^\d{4}$/.test(trimmed)) {
    return { normalized: trimmed, status: 'found' };
  }

  // Text month with year (aprile 2008, maggio 2013, etc.)
  // Italian months
  const italianMonths: Record<string, string> = {
    gennaio: '01',
    febbraio: '02',
    marzo: '03',
    aprile: '04',
    maggio: '05',
    giugno: '06',
    luglio: '07',
    agosto: '08',
    settembre: '09',
    ottobre: '10',
    novembre: '11',
    dicembre: '12',
  };

  // English months
  const englishMonths: Record<string, string> = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  };

  // French months
  const frenchMonths: Record<string, string> = {
    janvier: '01',
    février: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    août: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    décembre: '12',
  };

  const allMonths = { ...italianMonths, ...englishMonths, ...frenchMonths };

  for (const [monthName, monthNum] of Object.entries(allMonths)) {
    const regex = new RegExp(`\\b${monthName}\\b.*?(\\d{4})`, 'i');
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return { normalized: match[1], status: 'normalized' };
    }
  }

  // Try to extract any 4-digit year from the string
  const yearMatch = trimmed.match(/\d{4}/);
  if (yearMatch) {
    return { normalized: yearMatch[0], status: 'normalized' };
  }

  // Could not parse
  return { normalized: null, status: 'unparseable' };
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

    // Check for dry-run mode
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';

    // Audit log
    logger.info(
      `[ADMIN] ${request.url} accessed by ${user.username} (${user.id}) at ${new Date().toISOString()}`
    );
    logger.info(`📚 Starting title/author/date extraction (dryRun=${dryRun})...`);

    // Get all documents
    const docsResult = await dbAdapter.query(
      `SELECT id, slug, title, file_path, author, publication_date
       FROM anarchist.documents
       ORDER BY id`,
      [],
      { schema: 'anarchist' }
    );

    const documents = docsResult.rows;
    logger.info(`Found ${documents.length} anarchist documents`);

    const results: ExtractionResult[] = [];
    let titlesUpdated = 0;
    let authorsUpdated = 0;
    let datesUpdated = 0;
    let skipped = 0;
    let errors = 0;

    // Process each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      try {
        // Read content
        const content = await getDocumentContent(doc.file_path);
        if (!content) {
          results.push({
            document_id: doc.id,
            slug: doc.slug,
            title: doc.title,
            title_extracted: null,
            title_status: 'missing',
            author_extracted: null,
            author_status: 'missing',
            date_extracted: null,
            date_status: 'missing',
            date_raw: null,
            error: 'Could not read file',
          });
          errors++;
          continue;
        }

        // Parse frontmatter
        const frontmatter = parseFrontmatter(content);

        // Extract title
        const titleRaw = frontmatter.title?.trim();
        const title = titleRaw || null;
        const titleStatus = title ? (title !== doc.title ? 'found' : 'unchanged') : 'missing';

        // Extract author
        const authorRaw = frontmatter.author?.trim();
        const author = authorRaw || null;
        const authorStatus = author ? 'found' : doc.author ? 'found' : 'missing';

        // Extract and normalize date
        const dateRaw = frontmatter.date;
        const { normalized: dateNormalized, status: dateStatus } = normalizeDate(dateRaw);

        // Determine if we should update
        const shouldUpdateTitle = title && title !== doc.title;
        const shouldUpdateAuthor = author && !doc.author;
        const shouldUpdateDate = dateNormalized && !doc.publication_date;

        if (!dryRun) {
          if (shouldUpdateTitle || shouldUpdateAuthor || shouldUpdateDate) {
            const updates: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (shouldUpdateTitle) {
              updates.push(`title = $${paramIndex++}`);
              params.push(title);
              titlesUpdated++;
            }

            if (shouldUpdateAuthor) {
              updates.push(`author = $${paramIndex++}`);
              params.push(author);
              authorsUpdated++;
            }

            if (shouldUpdateDate) {
              updates.push(`publication_date = $${paramIndex++}`);
              params.push(dateNormalized);
              datesUpdated++;
            }

            if (updates.length > 0) {
              params.push(doc.id);
              await dbAdapter.query(
                `UPDATE anarchist.documents SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                params,
                { schema: 'anarchist' }
              );
            }
          }
        } else {
          // Dry run: just count what would be updated
          if (shouldUpdateTitle) titlesUpdated++;
          if (shouldUpdateAuthor) authorsUpdated++;
          if (shouldUpdateDate) datesUpdated++;
        }

        results.push({
          document_id: doc.id,
          slug: doc.slug,
          title: doc.title,
          title_extracted: title,
          title_status: titleStatus,
          author_extracted: author,
          author_status: authorStatus,
          date_extracted: dateNormalized,
          date_status: dateStatus,
          date_raw: dateRaw || null,
        });

        // Log progress
        if ((i + 1) % 5000 === 0) {
          logger.info(
            `Processed ${i + 1}/${documents.length}: titles=${titlesUpdated}, authors=${authorsUpdated}, dates=${datesUpdated}`
          );
        }
      } catch (error) {
        errors++;
        logger.error(`Error processing ${doc.slug}:`, error);

        results.push({
          document_id: doc.id,
          slug: doc.slug,
          title: doc.title,
          title_extracted: null,
          title_status: 'missing',
          author_extracted: null,
          author_status: 'missing',
          date_extracted: null,
          date_status: 'missing',
          date_raw: null,
          error: String(error),
        });
      }
    }

    // Generate report of problematic documents
    const missingAuthors = results.filter(r => r.author_status === 'missing');
    const missingDates = results.filter(
      r => r.date_status === 'missing' || r.date_status === 'unparseable'
    );
    const filesNotFound = results.filter(r => r.error?.includes('Could not read file'));
    const otherErrors = results.filter(r => r.error && !r.error.includes('Could not read file'));

    // Generate markdown report
    let reportContent = `# Anarchist Library Title/Author/Date Extraction Report

**Generated**: ${new Date().toISOString()}
**Mode**: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (database updated)'}

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Documents | ${documents.length} |
| Titles Updated | ${titlesUpdated} |
| Authors Updated | ${authorsUpdated} |
| Dates Updated | ${datesUpdated} |
| Documents with Missing Authors | ${missingAuthors.length} |
| Documents with Missing/Unparseable Dates | ${missingDates.length} |
| Files Not Found | ${filesNotFound.length} |
| Other Errors | ${otherErrors.length} |

## Documents with Missing Authors (${missingAuthors.length})

${missingAuthors.length > 0 ? '| ID | Slug | Title |\n|----|----|-------|\n' + missingAuthors.map(r => `| ${r.document_id} | \`${r.slug}\` | ${r.title || '(no title)'} |`).join('\n') : 'None - all documents have authors extracted or already in database.'}

## Documents with Missing/Unparseable Dates (${missingDates.length})

${missingDates.length > 0 ? '| ID | Slug | Title | Raw Date |\n|----|----|-------|----------|\n' + missingDates.map(r => `| ${r.document_id} | \`${r.slug}\` | ${r.title || '(no title)'} | \`${r.date_raw || '(empty)'}\` |`).join('\n') : 'None - all dates extracted or already in database.'}

## Files Not Found (${filesNotFound.length})

These documents have database records but files cannot be read from filesystem:

${
  filesNotFound.length > 0
    ? '| ID | Slug | Title | File Path |\n|----|----|-------|----------|\n' +
      filesNotFound
        .map(r => {
          const doc = documents.find(d => d.id === r.document_id);
          return `| ${r.document_id} | \`${r.slug}\` | ${r.title || '(no title)'} | \`${doc?.file_path || '?'}\` |`;
        })
        .join('\n')
    : 'None - all files found.'
}

## Other Errors (${otherErrors.length})

${otherErrors.length > 0 ? '| ID | Slug | Error |\n|----|-----|-------|\n' + otherErrors.map(r => `| ${r.document_id} | \`${r.slug}\` | ${r.error} |`).join('\n') : 'None.'}

## Action Items

### For Missing Authors (${missingAuthors.length} documents)
These documents should be reviewed and either:
1. Manually edited to add author information
2. Re-downloaded from anarchist library if available
3. Removed from database if no author can be found

### For Missing/Unparseable Dates (${missingDates.length} documents)
These documents should be reviewed and either:
1. Manually edited to add publication date
2. Researched and date added from external sources
3. Removed if date cannot be determined

### For Files Not Found (${filesNotFound.length} documents)
These database records point to missing files:
1. Check if files exist in Docker volume
2. Re-download from anarchist library if available
3. Remove database records for permanently missing files

---

**Note**: This report was generated by the author/date extraction endpoint.
Database was ${dryRun ? 'NOT' : ''} updated during this run.
`;

    // Save report to file (for later download)
    const timestamp = new Date().toISOString().split('T')[0];
    const reportFileName = `anarchist-extraction-report-${timestamp}.md`;

    logger.info(`\n✓ Extraction complete!`);
    logger.info(`  Documents processed: ${documents.length}`);
    logger.info(`  Titles updated: ${titlesUpdated}`);
    logger.info(`  Authors extracted: ${authorsUpdated}`);
    logger.info(`  Dates extracted: ${datesUpdated}`);
    logger.info(`  Missing authors: ${missingAuthors.length}`);
    logger.info(`  Missing dates: ${missingDates.length}`);
    logger.info(`  File errors: ${filesNotFound.length}`);

    return NextResponse.json(
      {
        success: true,
        message: dryRun
          ? 'Dry run complete - no database changes'
          : 'Title/author/date extraction completed successfully',
        dryRun,
        statistics: {
          documents_processed: documents.length,
          titles_updated: titlesUpdated,
          authors_extracted: authorsUpdated,
          dates_extracted: datesUpdated,
          missing_authors: missingAuthors.length,
          missing_dates: missingDates.length,
          files_not_found: filesNotFound.length,
          other_errors: otherErrors.length,
        },
        report: reportContent,
        report_filename: reportFileName,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Fatal error during extraction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to extract title/author/date information',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(POSTHandler);
