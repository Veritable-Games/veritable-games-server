const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function cleanup() {
  try {
    // Check if any archive/* pages exist
    const result = await pool.query(`
      SELECT id, slug, title
      FROM wiki.wiki_pages
      WHERE slug LIKE 'archive/%'
      ORDER BY id
    `);

    if (result.rows.length > 0) {
      console.log(`\nFound ${result.rows.length} existing archive pages:`);
      result.rows.forEach(row => {
        console.log(`  - ID ${row.id}: ${row.slug} (${row.title})`);
      });

      // Delete them
      await pool.query(`DELETE FROM wiki.wiki_pages WHERE slug LIKE 'archive/%'`);
      console.log(`\n✓ Deleted ${result.rows.length} archive pages\n`);
    } else {
      console.log('\n✓ No existing archive pages found\n');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

cleanup();
