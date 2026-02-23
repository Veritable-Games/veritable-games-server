#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function queryNSD() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      'postgresql://postgres:postgres@192.168.1.15:5432/veritable_games',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('=== Searching for NSD in library.library_documents ===\n');

    console.log('=== QUERY 1: Documents with NSD in title ===\n');
    const titleSearch = await pool.query(`
      SELECT id, title, author, slug, language, document_type
      FROM library.library_documents
      WHERE title ILIKE '%nsd%'
      LIMIT 50
    `);
    console.log(`Found ${titleSearch.rows.length} document(s) with NSD in title:`);
    titleSearch.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id}`);
      console.log(`     Title: ${doc.title}`);
      console.log(`     Author: ${doc.author || 'Unknown'}`);
      console.log(`     Language: ${doc.language || 'N/A'}`);
      console.log(`     Type: ${doc.document_type || 'N/A'}`);
      console.log('');
    });

    console.log('\n=== QUERY 2: Documents with NSD in description ===\n');
    const descSearch = await pool.query(`
      SELECT id, title, description
      FROM library.library_documents
      WHERE description ILIKE '%nsd%'
      LIMIT 50
    `);
    console.log(`Found ${descSearch.rows.length} document(s) with NSD in description:`);
    descSearch.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id}`);
      console.log(`     Title: ${doc.title}`);
      console.log(
        `     Description: ${doc.description ? doc.description.substring(0, 200) : 'N/A'}`
      );
      console.log('');
    });

    console.log('\n=== QUERY 3: Documents with NSD in content (first 100 chars) ===\n');
    const contentSearch = await pool.query(`
      SELECT id, title, content
      FROM library.library_documents
      WHERE content ILIKE '%nsd%'
      LIMIT 20
    `);
    console.log(`Found ${contentSearch.rows.length} document(s) with NSD in content:`);
    contentSearch.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id}`);
      console.log(`     Title: ${doc.title}`);
      console.log(
        `     Content (first 100): ${doc.content ? doc.content.substring(0, 100) : 'N/A'}`
      );
      console.log('');
    });

    console.log('\n=== QUERY 4: Documents with NSD in author ===\n');
    const authorSearch = await pool.query(`
      SELECT id, title, author
      FROM library.library_documents
      WHERE author ILIKE '%nsd%'
      LIMIT 50
    `);
    console.log(`Found ${authorSearch.rows.length} document(s) with NSD in author:`);
    authorSearch.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id}`);
      console.log(`     Title: ${doc.title}`);
      console.log(`     Author: ${doc.author}`);
      console.log('');
    });

    console.log('\n=== QUERY 5: Documents with NSD anywhere (combined count) ===\n');
    const combinedSearch = await pool.query(`
      SELECT COUNT(*) as total
      FROM library.library_documents
      WHERE title ILIKE '%nsd%' 
         OR description ILIKE '%nsd%'
         OR content ILIKE '%nsd%'
         OR author ILIKE '%nsd%'
         OR abstract ILIKE '%nsd%'
    `);
    console.log(`Total documents with NSD anywhere: ${combinedSearch.rows[0].total}`);

    console.log('\n=== QUERY 6: Check for metadata/annotations tables ===\n');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'library' 
        AND table_name LIKE '%annotation%' 
         OR table_name LIKE '%metadata%'
         OR table_name LIKE '%note%'
      ORDER BY table_name
    `);
    console.log(`Related tables found: ${tables.rows.length}`);
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

queryNSD();
