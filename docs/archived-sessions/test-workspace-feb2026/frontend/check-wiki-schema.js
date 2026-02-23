const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function checkSchema() {
  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'wiki'
      AND table_name = 'wiki_revisions'
    ORDER BY ordinal_position
  `);

  console.log('\n=== wiki.wiki_revisions columns ===');
  result.rows.forEach(row => {
    console.log(`${row.column_name}: ${row.data_type}`);
  });

  await pool.end();
}

checkSchema().catch(console.error);
