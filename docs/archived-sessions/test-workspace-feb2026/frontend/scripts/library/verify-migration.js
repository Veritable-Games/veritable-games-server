#!/usr/bin/env node
/**
 * Library Migration Verification Script
 *
 * Verifies that all library documents have been successfully migrated
 * from database to markdown files with correct metadata preservation.
 *
 * Checks:
 * 1. All documents have file_path populated
 * 2. All files exist on disk
 * 3. All files are readable
 * 4. All frontmatter parses correctly
 * 5. Content length matches (within tolerance)
 * 6. Deep sample verification (100 random documents)
 *
 * Usage:
 *   node scripts/library/verify-migration.js [options]
 *
 * Options:
 *   --sample N    Deep verify N random documents (default: 100)
 *   --all         Deep verify ALL documents (slow)
 */

const { dbAdapter } = require('../../src/lib/database/adapter');
const { libraryFileService } = require('../../src/lib/library/file-service');
const fs = require('fs/promises');

// Parse command line arguments
const args = process.argv.slice(2);
const SAMPLE_SIZE = args.includes('--sample') ? parseInt(args[args.indexOf('--sample') + 1]) : 100;
const VERIFY_ALL = args.includes('--all');

// Verification statistics
const stats = {
  total: 0,
  withFilePath: 0,
  withoutFilePath: 0,
  filesExist: 0,
  filesReadable: 0,
  frontmatterValid: 0,
  contentLengthMatch: 0,
  deepVerified: 0,
  warnings: [],
  errors: [],
};

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    const fullPath = `${libraryFileService.getBasePath()}/${filePath}`;
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Basic verification for a document
 */
async function verifyDocument(doc) {
  const issues = [];

  // Check 1: Has file_path
  if (!doc.file_path) {
    issues.push('Missing file_path in database');
    return { valid: false, issues };
  }

  stats.withFilePath++;

  // Check 2: File exists
  const exists = await fileExists(doc.file_path);
  if (!exists) {
    issues.push(`File not found: ${doc.file_path}`);
    return { valid: false, issues };
  }

  stats.filesExist++;

  // Check 3: File is readable
  let content;
  try {
    content = await libraryFileService.getDocumentContent(doc.file_path);
    if (!content) {
      issues.push('File exists but getDocumentContent returned null');
      return { valid: false, issues };
    }
  } catch (error) {
    issues.push(`File not readable: ${error.message}`);
    return { valid: false, issues };
  }

  stats.filesReadable++;

  // Check 4: Frontmatter parses correctly
  let frontmatter, contentWithoutFrontmatter;
  try {
    const parsed = libraryFileService.parseFrontmatter(content);
    frontmatter = parsed.frontmatter;
    contentWithoutFrontmatter = parsed.contentWithoutFrontmatter;

    // Verify required frontmatter fields
    if (!frontmatter.id || !frontmatter.slug || !frontmatter.title) {
      issues.push('Missing required frontmatter fields (id, slug, or title)');
      return { valid: false, issues };
    }

    // Verify frontmatter matches database
    if (frontmatter.id !== doc.id) {
      issues.push(`Frontmatter ID mismatch: DB=${doc.id}, File=${frontmatter.id}`);
    }

    if (frontmatter.slug !== doc.slug) {
      issues.push(`Frontmatter slug mismatch: DB=${doc.slug}, File=${frontmatter.slug}`);
    }
  } catch (error) {
    issues.push(`Frontmatter parsing error: ${error.message}`);
    return { valid: false, issues };
  }

  stats.frontmatterValid++;

  // Check 5: Content length (allow 10% variance for cleanup)
  const dbLength = (doc.content || '').length;
  const fileLength = contentWithoutFrontmatter.length;
  const variance = dbLength > 0 ? Math.abs(dbLength - fileLength) / dbLength : 0;

  if (variance > 0.1) {
    stats.warnings.push({
      documentId: doc.id,
      slug: doc.slug,
      issue: `Content length variance: ${(variance * 100).toFixed(1)}% (DB: ${dbLength} chars, File: ${fileLength} chars)`,
    });
  } else {
    stats.contentLengthMatch++;
  }

  return { valid: true, issues: [], frontmatter, contentWithoutFrontmatter };
}

/**
 * Deep verification with full content comparison
 */
async function deepVerifyDocument(doc) {
  const result = await verifyDocument(doc);
  if (!result.valid) {
    return result;
  }

  const { frontmatter, contentWithoutFrontmatter } = result;
  const issues = [];

  // Deep metadata checks
  if (doc.author && frontmatter.author !== doc.author) {
    issues.push(`Author mismatch: DB="${doc.author}", File="${frontmatter.author}"`);
  }

  if (doc.publication_date && frontmatter.publication_date !== doc.publication_date) {
    issues.push(
      `Publication date mismatch: DB="${doc.publication_date}", File="${frontmatter.publication_date}"`
    );
  }

  if (doc.language && frontmatter.language !== doc.language) {
    issues.push(`Language mismatch: DB="${doc.language}", File="${frontmatter.language}"`);
  }

  // Content similarity check (first 500 chars)
  if (doc.content) {
    const dbPreview = doc.content.substring(0, 500).trim();
    const filePreview = contentWithoutFrontmatter.substring(0, 500).trim();

    // Normalize whitespace for comparison
    const normalize = text => text.replace(/\s+/g, ' ').trim();

    if (normalize(dbPreview) !== normalize(filePreview)) {
      issues.push('Content mismatch in first 500 characters (after normalization)');
    }
  }

  if (issues.length > 0) {
    stats.warnings.push({
      documentId: doc.id,
      slug: doc.slug,
      issue: issues.join('; '),
    });
  } else {
    stats.deepVerified++;
  }

  return { valid: true, issues };
}

/**
 * Main verification function
 */
async function verify() {
  console.log('==========================================');
  console.log('  Library Migration Verification');
  console.log('==========================================\n');

  try {
    const conn = dbAdapter.getConnection('library');

    // Get all documents
    console.log('Querying documents...\n');
    const documents = await conn.all('SELECT * FROM library_documents ORDER BY id ASC');

    stats.total = documents.length;
    stats.withoutFilePath = documents.filter(d => !d.file_path).length;

    console.log(`Total documents: ${stats.total}`);
    console.log(`Documents without file_path: ${stats.withoutFilePath}\n`);

    if (stats.withoutFilePath > 0) {
      console.log('⚠️  Some documents have not been migrated yet!\n');
    }

    // Basic verification for all documents
    console.log('Running basic verification...\n');

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      if (!doc.file_path) {
        stats.errors.push({
          documentId: doc.id,
          slug: doc.slug,
          error: 'No file_path in database',
        });
        continue;
      }

      const result = await verifyDocument(doc);
      if (!result.valid) {
        stats.errors.push({
          documentId: doc.id,
          slug: doc.slug,
          error: result.issues.join('; '),
        });
      }

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`  Checked ${i + 1}/${documents.length} documents...`);
      }
    }

    console.log(`✓ Basic verification complete\n`);

    // Deep verification on sample
    const toDeepVerify = VERIFY_ALL ? documents.filter(d => d.file_path) : [];

    if (!VERIFY_ALL && stats.withFilePath > 0) {
      // Random sample
      const eligible = documents.filter(d => d.file_path);
      const sampleSize = Math.min(SAMPLE_SIZE, eligible.length);

      for (let i = 0; i < sampleSize; i++) {
        const randomIndex = Math.floor(Math.random() * eligible.length);
        toDeepVerify.push(eligible[randomIndex]);
        eligible.splice(randomIndex, 1);
      }
    }

    if (toDeepVerify.length > 0) {
      console.log(`Running deep verification on ${toDeepVerify.length} documents...\n`);

      for (let i = 0; i < toDeepVerify.length; i++) {
        const doc = toDeepVerify[i];
        await deepVerifyDocument(doc);

        if ((i + 1) % 10 === 0) {
          console.log(`  Deep verified ${i + 1}/${toDeepVerify.length} documents...`);
        }
      }

      console.log(`✓ Deep verification complete\n`);
    }

    // Report
    console.log('==========================================');
    console.log('  Verification Report');
    console.log('==========================================\n');
    console.log(`Documents checked: ${stats.total}`);
    console.log(
      `Documents with file_path: ${stats.withFilePath} (${((stats.withFilePath / stats.total) * 100).toFixed(1)}%)`
    );
    console.log(
      `Files exist: ${stats.filesExist} (${((stats.filesExist / stats.total) * 100).toFixed(1)}%)`
    );
    console.log(
      `Files readable: ${stats.filesReadable} (${((stats.filesReadable / stats.total) * 100).toFixed(1)}%)`
    );
    console.log(
      `Frontmatter valid: ${stats.frontmatterValid} (${((stats.frontmatterValid / stats.total) * 100).toFixed(1)}%)`
    );
    console.log(
      `Content length match: ${stats.contentLengthMatch} (${((stats.contentLengthMatch / stats.total) * 100).toFixed(1)}%)`
    );
    console.log(`Deep verified: ${stats.deepVerified} / ${toDeepVerify.length}\n`);

    if (stats.warnings.length > 0) {
      console.log(`⚠️  Warnings (${stats.warnings.length}):\n`);
      stats.warnings.slice(0, 20).forEach(w => {
        console.log(`  Document ${w.documentId} (${w.slug}): ${w.issue}`);
      });

      if (stats.warnings.length > 20) {
        console.log(`  ... and ${stats.warnings.length - 20} more warnings\n`);
      }
    }

    if (stats.errors.length > 0) {
      console.log(`\n✗ Errors (${stats.errors.length}):\n`);
      stats.errors.forEach(e => {
        console.log(`  Document ${e.documentId} (${e.slug}): ${e.error}`);
      });
    }

    // Summary
    console.log('\n==========================================');
    if (stats.errors.length === 0 && stats.warnings.length === 0) {
      console.log('✓ VERIFICATION PASSED - No issues found!');
    } else if (stats.errors.length === 0) {
      console.log('⚠️  VERIFICATION PASSED WITH WARNINGS');
    } else {
      console.log('✗ VERIFICATION FAILED - Errors found');
    }
    console.log('==========================================\n');
  } catch (error) {
    console.error('\n✗ Verification failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run verification
verify()
  .then(() => {
    const exitCode = stats.errors.length > 0 ? 1 : 0;
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('\n✗ Verification script failed:', error);
    process.exit(1);
  });
