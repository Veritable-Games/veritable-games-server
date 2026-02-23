#!/usr/bin/env node
/**
 * Seed Wiki Categories Script
 *
 * Populates the wiki.wiki_categories table in PostgreSQL with initial category data.
 * Safe to run multiple times (uses ON CONFLICT DO UPDATE).
 *
 * Usage:
 *   node scripts/wiki/seed-categories.js
 *
 * Or via npm:
 *   npm run wiki:seed-categories
 */

const { Pool } = require('pg');

// PostgreSQL connection (supports both DATABASE_URL and POSTGRES_URL)
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL or POSTGRES_URL environment variable not set');
  console.error('   Please configure PostgreSQL connection string');
  process.exit(1);
}

const pool = new Pool({ connectionString });

// Category definitions (matched to existing markdown directory structure)
const categories = [
  {
    id: 'archive',
    name: 'Archive',
    description: 'Archived wiki pages and historical content',
    color: '#9CA3AF',
    icon: '📦',
    sort_order: 100,
    is_public: true,
  },
  {
    id: 'autumn',
    name: 'AUTUMN',
    description: 'Documentation and development guides for Project Autumn',
    color: '#F59E0B',
    icon: '🍂',
    sort_order: 20,
    is_public: true,
  },
  {
    id: 'cosmic-knights',
    name: 'COSMIC KNIGHTS',
    description: 'Cosmic Knights project documentation and lore',
    color: '#8B5CF6',
    icon: '⭐',
    sort_order: 30,
    is_public: true,
  },
  {
    id: 'dodec',
    name: 'DODEC',
    description: 'Dodecahedron project wiki and geometric explorations',
    color: '#10B981',
    icon: '🔷',
    sort_order: 40,
    is_public: true,
  },
  {
    id: 'journals',
    name: 'Journals',
    description: 'Personal user journals (private, user-specific)',
    color: '#EF4444',
    icon: '📓',
    sort_order: 90,
    is_public: false, // Private namespace
  },
  {
    id: 'noxii',
    name: 'NOXII',
    description: 'Noxii civilization documentation and world-building',
    color: '#6366F1',
    icon: '🌌',
    sort_order: 50,
    is_public: true,
  },
  {
    id: 'on-command',
    name: 'ON COMMAND',
    description: 'On-Command project documentation',
    color: '#EC4899',
    icon: '⚡',
    sort_order: 60,
    is_public: true,
  },
  {
    id: 'systems',
    name: 'Systems',
    description: 'System architecture, infrastructure, and technical documentation',
    color: '#3B82F6',
    icon: '⚙️',
    sort_order: 70,
    is_public: true,
  },
  {
    id: 'tutorials',
    name: 'Tutorials',
    description: 'How-to guides, tutorials, and learning resources',
    color: '#14B8A6',
    icon: '📚',
    sort_order: 10,
    is_public: true,
  },
  {
    id: 'uncategorized',
    name: 'Uncategorized',
    description: 'Pages without a specific category assignment',
    color: '#6B7280',
    icon: null,
    sort_order: 999,
    is_public: true,
  },
];

async function seedCategories() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding Wiki Categories to PostgreSQL\n');
    console.log(`   Database: ${connectionString.split('@')[1] || 'configured'}`);
    console.log(`   Schema: wiki`);
    console.log(`   Table: wiki_categories\n`);

    // Begin transaction
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO wiki.wiki_categories (id, name, description, color, icon, sort_order, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           color = EXCLUDED.color,
           icon = EXCLUDED.icon,
           sort_order = EXCLUDED.sort_order,
           is_public = EXCLUDED.is_public
         RETURNING (xmax = 0) AS inserted`,
        [cat.id, cat.name, cat.description, cat.color, cat.icon, cat.sort_order, cat.is_public]
      );

      if (result.rows[0].inserted) {
        console.log(`   ✅ Inserted: ${cat.id.padEnd(18)} (${cat.name})`);
        inserted++;
      } else {
        console.log(`   ♻️  Updated:  ${cat.id.padEnd(18)} (${cat.name})`);
        updated++;
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log(`\n✅ Seed Complete!`);
    console.log(`   Inserted: ${inserted} categories`);
    console.log(`   Updated:  ${updated} categories`);
    console.log(`   Total:    ${categories.length} categories\n`);

    // Verify category usage from wiki_pages
    console.log('📊 Verifying Category Usage:\n');

    const usage = await client.query(`
      SELECT
        p.category_id,
        c.name as category_name,
        COUNT(p.id) as page_count
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      WHERE p.category_id IS NOT NULL
      GROUP BY p.category_id, c.name
      ORDER BY page_count DESC
    `);

    if (usage.rows.length === 0) {
      console.log('   (No pages found with category assignments)');
    } else {
      let totalPages = 0;
      usage.rows.forEach(row => {
        const status = row.category_name ? '✅' : '⚠️';
        const name = row.category_name || 'NOT IN wiki_categories';
        console.log(
          `   ${status} ${row.category_id.padEnd(18)} - ${row.page_count.toString().padStart(3)} pages - ${name}`
        );
        totalPages += parseInt(row.page_count);
      });
      console.log(`\n   Total Pages: ${totalPages}`);
    }

    // Check for orphaned references
    const orphaned = await client.query(`
      SELECT DISTINCT p.category_id, COUNT(*) as page_count
      FROM wiki.wiki_pages p
      LEFT JOIN wiki.wiki_categories c ON p.category_id = c.id
      WHERE p.category_id IS NOT NULL
        AND c.id IS NULL
      GROUP BY p.category_id
    `);

    if (orphaned.rows.length > 0) {
      console.log('\n⚠️  Warning: Found orphaned category references:');
      orphaned.rows.forEach(row => {
        console.log(
          `   ⚠️  "${row.category_id}" - ${row.page_count} pages reference non-existent category`
        );
      });
      console.log('\n   These categories may need to be created or pages reassigned.\n');
    } else {
      console.log('\n✅ All category references are valid!\n');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedCategories()
  .then(() => {
    console.log('✅ Wiki categories seeded successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
