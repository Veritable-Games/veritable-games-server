#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function findReconversionDocs() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      'postgresql://postgres:postgres@192.168.1.15:5432/veritable_games',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('=== Searching for reconversion_status in library.library_documents ===\n');

    // Check if column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'library' 
        AND table_name = 'library_documents'
        AND column_name LIKE '%reconversion%'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('❌ No reconversion_status column found in library.library_documents');
      console.log('\nAvailable columns:');
      const allColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'library' 
          AND table_name = 'library_documents'
        ORDER BY ordinal_position
      `);
      allColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('✅ Found reconversion_status column:');
      columnCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });

      console.log('\n=== Documents with reconversion_status ===\n');
      const docs = await pool.query(`
        SELECT id, title, author, reconversion_status, status
        FROM library.library_documents
        WHERE reconversion_status IS NOT NULL
        ORDER BY id
        LIMIT 50
      `);

      console.log(`Found ${docs.rows.length} documents with reconversion_status:\n`);

      // Group by status
      const byStatus = {};
      docs.rows.forEach(doc => {
        const status = doc.reconversion_status;
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(doc);
      });

      Object.keys(byStatus).forEach(status => {
        console.log(`\n${status}: ${byStatus[status].length} documents`);
        byStatus[status].slice(0, 10).forEach((doc, i) => {
          console.log(`  ${i + 1}. ID: ${doc.id} | ${doc.title}`);
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

findReconversionDocs();
