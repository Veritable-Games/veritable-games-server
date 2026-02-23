#!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'library'
        AND table_name = 'library_documents'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Actual Production Schema:\n');
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      console.log(`  ${row.column_name}: ${row.data_type} ${nullable}`);
    });

    console.log('\n✅ Copy the columns above to create the correct view\n');

    // Also show a template for the view
    console.log('View Template:');
    console.log('```sql');
    console.log('CREATE VIEW library.all_documents AS');
    console.log('SELECT');
    result.rows.forEach((row, idx) => {
      const comma = idx < result.rows.length - 1 ? ',' : '';
      console.log(`  ${row.column_name}${comma}`);
    });
    console.log('FROM library.library_documents;');
    console.log('```\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
