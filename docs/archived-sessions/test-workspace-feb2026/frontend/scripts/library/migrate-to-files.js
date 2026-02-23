#!/usr/bin/env node
/**
 * Library Documents Migration Script
 * Migrates user library documents from PostgreSQL content column to filesystem
 *
 * This script:
 * 1. Fetches all documents WITHOUT file_path from database
 * 2. Writes content to markdown files with YAML frontmatter
 * 3. Updates database file_path column
 * 4. Handles errors gracefully and logs progress
 *
 * Usage: node scripts/library/migrate-to-files.js
 */

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

// Configuration
const BATCH_SIZE = 100;
const BASE_PATH =
  process.env.LIBRARY_DOCUMENTS_PATH ||
  path.join(__dirname, '../../frontend/data/library/documents');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

/**
 * Generate file path for document
 * Format: YYYY/MM/slug.md
 */
function generateFilePath(slug, date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${slug}.md`;
}

/**
 * Write document content to filesystem with YAML frontmatter
 */
async function writeDocumentFile(filePath, content, metadata) {
  try {
    const fullPath = path.join(BASE_PATH, filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Generate YAML frontmatter
    const frontmatterLines = ['---'];

    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) continue;

      // Format value appropriately
      let formattedValue;
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

    const fileContent = frontmatterLines.join('\n') + (content || '');

    // Write file atomically
    const tempPath = fullPath + '.tmp';
    await fs.writeFile(tempPath, fileContent, 'utf-8');
    await fs.rename(tempPath, fullPath);

    return true;
  } catch (error) {
    console.error(`Failed to write file ${filePath}:`, error);
    return false;
  }
}

/**
 * Migrate documents in batches
 */
async function migrateDocuments() {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('USER LIBRARY DOCUMENT MIGRATION TO FILESYSTEM');
  console.log('='.repeat(80));
  console.log(`Base path: ${BASE_PATH}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  try {
    // Count unmigrated documents (after schema migration, status column is gone)
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM library.library_documents
      WHERE file_path IS NULL
        AND content IS NOT NULL
    `);

    const totalDocuments = parseInt(countResult.rows[0].total);
    console.log(`Found ${totalDocuments} documents to migrate\n`);

    if (totalDocuments === 0) {
      console.log('✓ No documents to migrate. All done!');
      return;
    }

    // Fetch all unmigrated documents
    // Note: description and abstract columns have been removed in schema migration
    // Using notes column instead, which replaces description
    const docsResult = await pool.query(`
      SELECT
        id,
        slug,
        title,
        author,
        publication_date,
        document_type,
        language,
        notes,
        content,
        created_at,
        created_by
      FROM library.library_documents
      WHERE file_path IS NULL
        AND content IS NOT NULL
      ORDER BY id
    `);

    const documents = docsResult.rows;
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

      console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);

      for (const doc of batch) {
        try {
          // Skip if no content
          if (!doc.content || doc.content.trim().length === 0) {
            console.log(`  ⊘ Skipped ${doc.id}: ${doc.title} (no content)`);
            skippedCount++;
            continue;
          }

          // Generate file path
          const createdDate = doc.created_at ? new Date(doc.created_at) : new Date();
          const filePath = generateFilePath(doc.slug, createdDate);

          // Prepare metadata for frontmatter
          // Note: Using notes instead of description (schema change)
          const metadata = {
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            author: doc.author || '',
            publication_date: doc.publication_date || '',
            document_type: doc.document_type || 'document',
            language: doc.language || 'en',
            notes: doc.notes || '',
            created_at: doc.created_at?.toISOString() || new Date().toISOString(),
            created_by: doc.created_by || null,
          };

          // Write file
          const success = await writeDocumentFile(filePath, doc.content, metadata);

          if (!success) {
            console.log(`  ✗ Failed ${doc.id}: ${doc.title}`);
            failCount++;
            continue;
          }

          // Update database with file_path
          await pool.query(
            `
            UPDATE library.library_documents
            SET file_path = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [filePath, doc.id]
          );

          console.log(`  ✓ Migrated ${doc.id}: ${doc.title} → ${filePath}`);
          successCount++;
        } catch (error) {
          console.error(`  ✗ Error migrating document ${doc.id}:`, error.message);
          failCount++;
        }
      }

      // Progress update
      const percentComplete = (((i + batch.length) / documents.length) * 100).toFixed(1);
      console.log(`  Progress: ${i + batch.length}/${documents.length} (${percentComplete}%)`);
    }

    // Final summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total documents: ${totalDocuments}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped (no content): ${skippedCount}`);
    console.log(`Duration: ${duration}s`);
    console.log('');

    // Verification
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as remaining
      FROM library.library_documents
      WHERE file_path IS NULL
        AND content IS NOT NULL
    `);

    const remaining = parseInt(verifyResult.rows[0].remaining);

    if (remaining === 0) {
      console.log('✓ Verification: All documents successfully migrated!');
    } else {
      console.log(`⚠ Verification: ${remaining} documents still need migration`);
    }
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrateDocuments()
    .then(() => {
      console.log('\nMigration script completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nMigration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateDocuments, generateFilePath, writeDocumentFile };
