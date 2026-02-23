#!/usr/bin/env node

/**
 * Apply critical fix for production database
 * 1. Drop NOT NULL constraint on content column
 * 2. Recreate missing all_documents view
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  console.error('Usage: DATABASE_URL="..." node apply-content-constraint-fix.js');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runFix() {
  const client = await pool.connect();

  try {
    console.log('🔧 Applying production fixes...\n');

    // Fix 1: Drop NOT NULL constraint on content
    console.log('Step 1: Dropping NOT NULL constraint on content column...');
    await client.query(`
      ALTER TABLE library.library_documents
        ALTER COLUMN content DROP NOT NULL
    `);
    console.log('✅ Content column is now nullable\n');

    // Fix 2: Recreate all_documents view
    console.log('Step 2: Recreating all_documents view...');
    await client.query(`DROP VIEW IF EXISTS library.all_documents`);
    await client.query(`
      CREATE VIEW library.all_documents AS
      SELECT
        id,
        slug,
        title,
        author,
        publication_date,
        document_type,
        COALESCE(notes, '') AS description,
        COALESCE(file_path, '') AS file_path_info,
        language,
        created_by,
        created_at,
        updated_at,
        view_count,
        translation_group_id,
        linked_document_group_id,
        is_public,
        content,
        notes
      FROM library.library_documents
    `);
    console.log('✅ all_documents view recreated\n');

    // Test 3: Verify by attempting document creation
    console.log('Step 3: Testing document creation...');
    const testSlug = `test-fix-${Date.now()}`;

    const testResult = await client.query(
      `
      INSERT INTO library.library_documents (
        slug,
        title,
        author,
        publication_date,
        document_type,
        notes,
        file_path,
        created_by,
        created_at,
        updated_at,
        view_count
      ) VALUES (
        $1,
        'Constraint Fix Test',
        'System',
        '2025-12-29',
        'document',
        'Test for constraint fix',
        '/data/library/documents/2025/12/test-fix.md',
        1,
        NOW(),
        NOW(),
        0
      ) RETURNING id, slug
    `,
      [testSlug]
    );

    const insertedDoc = testResult.rows[0];
    console.log(`✅ Document created successfully (id=${insertedDoc.id})\n`);

    // Clean up
    await client.query('DELETE FROM library.library_documents WHERE slug = $1', [testSlug]);
    console.log('🧹 Test document cleaned up\n');

    console.log('═'.repeat(60));
    console.log('✅ ALL FIXES APPLIED SUCCESSFULLY');
    console.log('═'.repeat(60));
    console.log(`
  Your production database is now fixed!

  What was fixed:
  1. ✅ content column is now nullable
  2. ✅ all_documents view recreated
  3. ✅ Document creation tested and working

  Next steps:
  1. Restart the Coolify application: coolify app restart
  2. Test document creation in the web UI
  3. If still failing, check application logs
    `);
  } catch (err) {
    console.log('═'.repeat(60));
    console.log('❌ FIX FAILED');
    console.log('═'.repeat(60));
    console.error(`\nError: ${err.message}`);
    console.error(`Code: ${err.code}`);

    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runFix();
