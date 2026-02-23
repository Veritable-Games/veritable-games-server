#!/usr/bin/env node

/**
 * Comprehensive Wiki Activity Generator
 *
 * Creates demo pages and categories, then generates all 5 activity types:
 * - CREATE: New page creation
 * - UPDATE: Various types of edits (expansion, reduction, refactor, etc.)
 * - RECATEGORIZE: Moving pages between categories
 * - DELETE: Page deletion
 * - MIGRATE: Simulated legacy import
 *
 * Also tracks category creation/deletion in unified_activity.
 *
 * Usage:
 *   node generate-comprehensive-wiki-activity.js [--cleanup] [--verbose] [--count=N]
 */

const Database = require('better-sqlite3');
const path = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const CLEANUP_MODE = args.includes('--cleanup');
const VERBOSE = args.includes('--verbose');
const countArg = args.find(arg => arg.startsWith('--count='));
const DEMO_PAGE_COUNT = countArg ? parseInt(countArg.split('=')[1]) : 15;

const dbPath = path.join(__dirname, '../data/wiki.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Demo data prefixes for easy cleanup
const DEMO_PREFIX = 'DEMO_';
const TEST_CATEGORY_PREFIX = 'Test Category';

// Activity metadata generators
const activityMetadata = {
  create: (pageTitle, categoryName) =>
    JSON.stringify({
      summary: 'Initial page creation',
      categories: categoryName ? [categoryName] : [],
      word_count: Math.floor(Math.random() * 500) + 100,
    }),

  update: changeType => {
    const types = {
      expansion: {
        summary: 'Expanded content with additional sections',
        change_type: 'expansion',
        additions: Math.floor(Math.random() * 300) + 50,
        deletions: Math.floor(Math.random() * 20),
      },
      reduction: {
        summary: 'Removed outdated information',
        change_type: 'reduction',
        additions: Math.floor(Math.random() * 20),
        deletions: Math.floor(Math.random() * 200) + 50,
      },
      refactor: {
        summary: 'Reorganized content structure',
        change_type: 'refactor',
        additions: Math.floor(Math.random() * 100),
        deletions: Math.floor(Math.random() * 100),
      },
      title_change: {
        summary: 'Updated page title for clarity',
        change_type: 'title_change',
        old_title: 'Old Title',
        new_title: 'New Title',
      },
      metadata: {
        summary: 'Updated tags and categories',
        change_type: 'metadata_update',
        tags_added: ['new-tag', 'another-tag'],
        tags_removed: ['old-tag'],
      },
      minor: {
        summary: 'Fixed typo',
        change_type: 'minor_edit',
        is_minor: true,
      },
    };
    return JSON.stringify(types[changeType] || types.minor);
  },

  recategorize: (fromCategory, toCategory) =>
    JSON.stringify({
      summary: `Moved from ${fromCategory} to ${toCategory}`,
      from_category: fromCategory,
      to_category: toCategory,
      change_type: 'recategorize',
    }),

  delete: (pageTitle, pageSlug, categoryName, reason) =>
    JSON.stringify({
      summary: `Deleted: ${reason}`,
      page_title: pageTitle,
      page_slug: pageSlug,
      category_name: categoryName,
      reason: reason,
    }),

  migrate: source =>
    JSON.stringify({
      summary: 'Migrated from legacy system',
      source: source,
      import_date: new Date().toISOString(),
      change_type: 'migrate',
    }),

  categoryCreate: categoryName =>
    JSON.stringify({
      summary: `Created category: ${categoryName}`,
      category_name: categoryName,
      change_type: 'category_create',
    }),

  categoryDelete: (categoryName, movedTo) =>
    JSON.stringify({
      summary: `Deleted category: ${categoryName}`,
      category_name: categoryName,
      moved_to: movedTo,
      change_type: 'category_delete',
    }),
};

// Get or create test users
function getTestUsers() {
  const users = db
    .prepare('SELECT id, username FROM users WHERE role IN (?, ?, ?) LIMIT 5')
    .all('admin', 'moderator', 'user');

  if (users.length === 0) {
    console.log('⚠️  No users found. Creating default user...');
    db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'ActivityBot',
      'activitybot@example.com',
      '$2a$12$dummyhash',
      'admin'
    );

    return db.prepare('SELECT id, username FROM users WHERE username = ?').all('ActivityBot');
  }

  return users;
}

// Generate timestamp in past (within last 2 hours)
function randomTimestamp(minutesAgo) {
  const now = new Date();
  const offset = Math.floor(Math.random() * minutesAgo);
  const timestamp = new Date(now.getTime() - offset * 60 * 1000);
  return timestamp.toISOString().replace('T', ' ').substring(0, 19);
}

// CLEANUP MODE
if (CLEANUP_MODE) {
  console.log('🧹 CLEANUP MODE - Removing all demo data...\n');

  const transaction = db.transaction(() => {
    // Get demo page IDs
    const demoPages = db
      .prepare(`SELECT id FROM wiki_pages WHERE slug LIKE ?`)
      .all(`${DEMO_PREFIX}%`);
    const demoPageIds = demoPages.map(p => p.id);

    // Delete wiki revisions
    if (demoPageIds.length > 0) {
      const placeholders = demoPageIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM wiki_revisions WHERE page_id IN (${placeholders})`).run(
        ...demoPageIds
      );
      console.log(`✓ Deleted ${demoPageIds.length} demo page revisions`);
    }

    // Delete wiki pages
    const deletedPages = db
      .prepare(`DELETE FROM wiki_pages WHERE slug LIKE ?`)
      .run(`${DEMO_PREFIX}%`);
    console.log(`✓ Deleted ${deletedPages.changes} demo pages`);

    // Delete test categories (only if empty)
    const testCategories = db
      .prepare(`SELECT id, name FROM wiki_categories WHERE name LIKE ?`)
      .all(`${TEST_CATEGORY_PREFIX}%`);

    let deletedCategories = 0;
    for (const cat of testCategories) {
      const pageCount = db
        .prepare('SELECT COUNT(*) as count FROM wiki_pages WHERE category_id = ?')
        .get(cat.id).count;

      if (pageCount === 0) {
        db.prepare('DELETE FROM wiki_categories WHERE id = ?').run(cat.id);
        deletedCategories++;
        console.log(`✓ Deleted empty test category: ${cat.name}`);
      } else {
        console.log(`⚠️  Kept category "${cat.name}" (has ${pageCount} pages)`);
      }
    }

    // Delete activity entries for demo pages and test categories
    const deletedActivity = db
      .prepare(
        `
      DELETE FROM unified_activity
      WHERE (entity_type = 'page' AND entity_id IN (
        SELECT CAST(id AS TEXT) FROM wiki_pages WHERE slug LIKE ?
      ))
      OR (entity_type = 'category' AND metadata LIKE ?)
    `
      )
      .run(`${DEMO_PREFIX}%`, `%${TEST_CATEGORY_PREFIX}%`);

    console.log(`✓ Deleted ${deletedActivity.changes} activity entries\n`);
    console.log('✅ Cleanup complete!');
  });

  transaction();
  db.close();
  process.exit(0);
}

// GENERATION MODE
console.log(`🎬 Comprehensive Wiki Activity Generator`);
console.log(`   Generating ${DEMO_PAGE_COUNT} demo pages with all activity types...\n`);

const users = getTestUsers();
console.log(
  `👥 Using ${users.length} users for activity: ${users.map(u => u.username).join(', ')}\n`
);

// Random user helper
const randomUser = () => users[Math.floor(Math.random() * users.length)];

const transaction = db.transaction(() => {
  // PHASE 1: Create test categories
  console.log('📁 PHASE 1: Creating test categories...');

  const categories = [
    {
      name: `${TEST_CATEGORY_PREFIX} - Getting Started`,
      description: 'Demo category for tutorials',
    },
    {
      name: `${TEST_CATEGORY_PREFIX} - Advanced Topics`,
      description: 'Demo category for advanced content',
    },
    {
      name: `${TEST_CATEGORY_PREFIX} - Community`,
      description: 'Demo category for community content',
    },
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const existing = db.prepare('SELECT id FROM wiki_categories WHERE name = ?').get(cat.name);

    if (existing) {
      console.log(`  ⚠️  Category "${cat.name}" already exists, reusing...`);
      createdCategories.push(existing.id);
    } else {
      const categoryId = `test-cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      db.prepare(
        `
        INSERT INTO wiki_categories (id, name, description, created_at)
        VALUES (?, ?, ?, ?)
      `
      ).run(categoryId, cat.name, cat.description, randomTimestamp(120));

      createdCategories.push(categoryId);
      console.log(`  ✓ Created: ${cat.name}`);

      // Log category creation activity
      const user = randomUser();
      db.prepare(
        `
        INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        user.id,
        'wiki_edit',
        'category',
        categoryId,
        'create',
        activityMetadata.categoryCreate(cat.name),
        randomTimestamp(120)
      );
    }
  }

  console.log('');

  // PHASE 2: Create demo pages
  console.log(`📄 PHASE 2: Creating ${DEMO_PAGE_COUNT} demo pages...`);

  const demoPages = [];
  const changeTypes = ['expansion', 'reduction', 'refactor', 'title_change', 'metadata', 'minor'];

  for (let i = 1; i <= DEMO_PAGE_COUNT; i++) {
    const user = randomUser();
    const categoryId = createdCategories[i % createdCategories.length];
    const categoryName = categories[i % categories.length].name;

    const pageData = {
      title: `${DEMO_PREFIX}Page ${i}`,
      slug: `${DEMO_PREFIX.toLowerCase()}page-${i}`,
      content: `# ${DEMO_PREFIX}Page ${i}\n\nThis is demo content for page ${i}.\n\n## Section 1\nInitial content here.\n\n## Section 2\nMore content.`,
      author: user.id,
      category: categoryId,
      timestamp: randomTimestamp(115),
    };

    // Create page
    const pageResult = db
      .prepare(
        `
      INSERT INTO wiki_pages (title, slug, status, created_by, category_id, created_at, updated_at)
      VALUES (?, ?, 'published', ?, ?, ?, ?)
    `
      )
      .run(
        pageData.title,
        pageData.slug,
        pageData.author,
        pageData.category,
        pageData.timestamp,
        pageData.timestamp
      );

    const pageId = pageResult.lastInsertRowid;

    // Create initial revision
    db.prepare(
      `
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format, author_id, is_minor,
        size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      pageId,
      pageData.content,
      'Initial page creation',
      'markdown',
      pageData.author,
      0,
      Buffer.from(pageData.content).length,
      pageData.timestamp
    );

    demoPages.push({
      id: pageId,
      slug: pageData.slug,
      title: pageData.title,
      categoryId: pageData.category,
      categoryName,
    });

    // Log CREATE activity
    db.prepare(
      `
      INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      user.id,
      'wiki_edit',
      'page',
      String(pageId),
      'create',
      activityMetadata.create(pageData.title, categoryName),
      pageData.timestamp
    );

    if (VERBOSE) {
      console.log(`  ✓ Created: ${pageData.title} (ID: ${pageId})`);
    }
  }

  if (!VERBOSE) {
    console.log(`  ✓ Created ${demoPages.length} demo pages`);
  }
  console.log('');

  // PHASE 3: Generate UPDATE activities
  console.log('✏️  PHASE 3: Generating UPDATE activities...');

  const updateCount = 8;
  for (let i = 0; i < updateCount; i++) {
    const page = demoPages[i % demoPages.length];
    const user = randomUser();
    const changeType = changeTypes[i % changeTypes.length];
    const timestamp = randomTimestamp(90);

    // Update page timestamp
    db.prepare('UPDATE wiki_pages SET updated_at = ? WHERE id = ?').run(timestamp, page.id);

    // Create new revision
    const updatedContent = `${page.title}\n\nUpdated content (${changeType})\n\n## New Section\nAdditional information.`;
    db.prepare(
      `
      INSERT INTO wiki_revisions (
        page_id, content, summary, content_format, author_id, is_minor,
        size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      page.id,
      updatedContent,
      `Updated: ${changeType}`,
      'markdown',
      user.id,
      changeType === 'minor' ? 1 : 0,
      Buffer.from(updatedContent).length,
      timestamp
    );

    // Log UPDATE activity
    db.prepare(
      `
      INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      user.id,
      'wiki_edit',
      'page',
      String(page.id),
      'update',
      activityMetadata.update(changeType),
      timestamp
    );

    console.log(`  ✓ Updated: ${page.title} (${changeType})`);
  }
  console.log('');

  // PHASE 4: Generate RECATEGORIZE activities
  console.log('🏷️  PHASE 4: Generating RECATEGORIZE activities...');

  const recategorizeCount = 4;
  for (let i = 0; i < recategorizeCount; i++) {
    const page = demoPages[(updateCount + i) % demoPages.length];
    const user = randomUser();

    // Find current category index
    const currentCategoryIndex = createdCategories.indexOf(page.categoryId);
    const newCategoryIndex = (currentCategoryIndex + 1) % createdCategories.length;
    const newCategoryId = createdCategories[newCategoryIndex];
    const newCategoryName = categories[newCategoryIndex].name;
    const timestamp = randomTimestamp(60);

    // Update page category
    db.prepare('UPDATE wiki_pages SET category_id = ?, updated_at = ? WHERE id = ?').run(
      newCategoryId,
      timestamp,
      page.id
    );

    // Log RECATEGORIZE activity
    db.prepare(
      `
      INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      user.id,
      'wiki_edit',
      'page',
      String(page.id),
      'recategorize',
      activityMetadata.recategorize(page.categoryName, newCategoryName),
      timestamp
    );

    console.log(`  ✓ Recategorized: ${page.title} → ${newCategoryName}`);
    page.categoryId = newCategoryId;
    page.categoryName = newCategoryName;
  }
  console.log('');

  // PHASE 5: Generate DELETE activities
  console.log('🗑️  PHASE 5: Generating DELETE activities...');

  const deleteReasons = ['Duplicate content', 'Outdated information'];
  const deleteCount = 2;

  for (let i = 0; i < deleteCount; i++) {
    const page = demoPages.pop(); // Remove from end
    const user = randomUser();
    const reason = deleteReasons[i % deleteReasons.length];
    const timestamp = randomTimestamp(30);

    // Log DELETE activity BEFORE deleting
    db.prepare(
      `
      INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      user.id,
      'wiki_edit',
      'page',
      String(page.id),
      'delete',
      activityMetadata.delete(page.title, page.slug, page.categoryName, reason),
      timestamp
    );

    // Delete revisions
    db.prepare('DELETE FROM wiki_revisions WHERE page_id = ?').run(page.id);

    // Delete page
    db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(page.id);

    console.log(`  ✓ Deleted: ${page.title} (${reason})`);
  }
  console.log('');

  // PHASE 6: Generate MIGRATE activity
  console.log('🔄 PHASE 6: Generating MIGRATE activity...');

  const migratePage = demoPages[0];
  const user = randomUser();
  const timestamp = randomTimestamp(15);

  // Log MIGRATE activity
  db.prepare(
    `
    INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    user.id,
    'wiki_edit',
    'page',
    String(migratePage.id),
    'migrate',
    activityMetadata.migrate('Legacy Wiki System v1'),
    timestamp
  );

  console.log(`  ✓ Migrated: ${migratePage.title} (from legacy system)`);
  console.log('');
});

try {
  transaction();

  // Final stats
  const activityCount = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM unified_activity
    WHERE timestamp > datetime('now', '-2 hours')
  `
    )
    .get().count;

  const actionBreakdown = db
    .prepare(
      `
    SELECT action, COUNT(*) as count
    FROM unified_activity
    WHERE timestamp > datetime('now', '-2 hours')
    GROUP BY action
  `
    )
    .all();

  console.log('✅ Generation complete!\n');
  console.log('📊 Activity Summary (last 2 hours):');
  console.log(`   Total activities: ${activityCount}`);
  console.log('   Breakdown:');
  actionBreakdown.forEach(row => {
    console.log(`     - ${row.action}: ${row.count}`);
  });

  console.log('\n🌐 View activity at:');
  console.log('   http://localhost:3000/wiki (Recent Activity tab)\n');
  console.log('💡 To remove all demo data:');
  console.log('   node scripts/generate-comprehensive-wiki-activity.js --cleanup\n');
} catch (error) {
  console.error('❌ Error generating activity:', error);
  process.exit(1);
} finally {
  db.close();
}
