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
    console.log('=== STEP 0: Check library_tags schema ===\n');
    const tagSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'library' 
        AND table_name = 'library_tags'
      ORDER BY ordinal_position
    `);
    console.log('library_tags columns:');
    tagSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    console.log('\n=== QUERY 1: Find NSD tags ===\n');
    const tags = await pool.query(`
      SELECT * 
      FROM library.library_tags 
      WHERE LOWER(name) LIKE '%nsd%'
    `);
    console.log(`Found ${tags.rows.length} tag(s):`);
    tags.rows.forEach(tag => {
      console.log('Tag:', JSON.stringify(tag, null, 2));
      console.log('');
    });

    if (tags.rows.length === 0) {
      console.log('No NSD tags found. Checking all tags to see if similar exists...\n');
      const allTags = await pool.query(`
        SELECT id, name 
        FROM library.library_tags 
        ORDER BY name
        LIMIT 50
      `);
      console.log('First 50 tags:');
      allTags.rows.forEach(tag => {
        console.log(`  - ${tag.name} (ID: ${tag.id})`);
      });
      await pool.end();
      return;
    }

    console.log('\n=== QUERY 2: Count NSD-tagged documents ===\n');
    const count = await pool.query(`
      SELECT COUNT(*) as total_nsd_documents 
      FROM library.library_documents d
      JOIN library.library_document_tags dt ON d.id = dt.document_id
      JOIN library.library_tags t ON dt.tag_id = t.id
      WHERE LOWER(t.name) LIKE '%nsd%'
    `);
    console.log(`Total NSD-tagged documents: ${count.rows[0].total_nsd_documents}\n`);

    console.log('\n=== QUERY 3: Sample NSD-tagged documents (first 20) ===\n');
    const docs = await pool.query(`
      SELECT d.id, d.title, d.slug, d.author
      FROM library.library_documents d
      JOIN library.library_document_tags dt ON d.id = dt.document_id
      JOIN library.library_tags t ON dt.tag_id = t.id
      WHERE LOWER(t.name) LIKE '%nsd%'
      ORDER BY d.id
      LIMIT 20
    `);
    console.log(`Sample documents (showing ${docs.rows.length}):`);
    docs.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id} | ${doc.title}`);
      console.log(`     Author: ${doc.author || 'Unknown'}`);
      console.log(`     Slug: ${doc.slug}`);
      console.log('');
    });

    console.log('\n=== QUERY 4: Check for NSD in metadata/notes ===\n');
    const metadata = await pool.query(`
      SELECT id, title, notes, source_url
      FROM library.library_documents
      WHERE notes ILIKE '%nsd%' OR source_url ILIKE '%nsd%'
      LIMIT 10
    `);
    console.log(`Documents with NSD in metadata: ${metadata.rows.length}`);
    metadata.rows.forEach((doc, i) => {
      console.log(`  ${i + 1}. ID: ${doc.id} | ${doc.title}`);
      if (doc.notes) console.log(`     Notes: ${doc.notes.substring(0, 100)}...`);
      if (doc.source_url) console.log(`     Source: ${doc.source_url}`);
      console.log('');
    });

    console.log('\n=== QUERY 5: Check for reconversion_status column ===\n');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'library' 
        AND table_name = 'library_documents'
        AND column_name LIKE '%reconversion%'
    `);
    if (columns.rows.length > 0) {
      console.log('Found reconversion columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('No reconversion_status column found in library_documents table.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

queryNSD();
