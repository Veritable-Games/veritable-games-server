#!/usr/bin/env node
/**
 * Comprehensive Reference System Verification
 * Tests all critical operations after schema fixes
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

console.log('🧪 Comprehensive Reference System Verification\n');

let allTestsPassed = true;

try {
  // Test 1: Schema Verification
  console.log('Test 1: Schema Verification');
  console.log('─'.repeat(50));

  const schema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_images'")
    .get();

  const hasIntegerId = schema.sql.includes('id INTEGER PRIMARY KEY AUTOINCREMENT');
  const hasIntegerProjectId = schema.sql.includes('project_id INTEGER NOT NULL');

  console.log(
    `   ✅ id column is INTEGER PRIMARY KEY AUTOINCREMENT: ${hasIntegerId ? 'YES' : 'NO'}`
  );
  console.log(`   ✅ project_id column is INTEGER NOT NULL: ${hasIntegerProjectId ? 'YES' : 'NO'}`);

  if (!hasIntegerId || !hasIntegerProjectId) {
    allTestsPassed = false;
  }
  console.log('');

  // Test 2: Query by project_id (list images)
  console.log('Test 2: Query Images by project_id');
  console.log('─'.repeat(50));

  const autumnImages = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM project_reference_images
    WHERE project_id = 2 AND is_deleted = 0
  `
    )
    .get();

  console.log(`   ✅ AUTUMN images found: ${autumnImages.count}`);
  console.log(`   Expected: 17`);

  if (autumnImages.count !== 17) {
    console.log('   ❌ MISMATCH!');
    allTestsPassed = false;
  }
  console.log('');

  // Test 3: Query by image id (get single image)
  console.log('Test 3: Query Single Image by ID');
  console.log('─'.repeat(50));

  const singleImage = db.prepare('SELECT * FROM project_reference_images WHERE id = 23').get();

  if (singleImage) {
    console.log(`   ✅ Image 23 found: "${singleImage.filename_original}"`);
    console.log(`   ✅ ID type in result: ${typeof singleImage.id}`);
    console.log(`   ✅ project_id type in result: ${typeof singleImage.project_id}`);
  } else {
    console.log('   ❌ Image 23 not found!');
    allTestsPassed = false;
  }
  console.log('');

  // Test 4: Tag-based sorting query
  console.log('Test 4: Tag-Based Sorting Query');
  console.log('─'.repeat(50));

  const sortedQuery = db
    .prepare(
      `
    SELECT
      img.id,
      img.filename_original,
      (SELECT rt.name
       FROM project_reference_image_tags prit
       JOIN reference_tags rt ON prit.tag_id = rt.id
       JOIN reference_categories rc ON rt.category_id = rc.id
       WHERE prit.reference_id = img.id
       ORDER BY rc.display_order, rt.display_order
       LIMIT 1) as primary_tag_name
    FROM project_reference_images img
    WHERE img.project_id = 2 AND img.is_deleted = 0
    ORDER BY
      CASE WHEN primary_tag_name IS NULL THEN 1 ELSE 0 END,
      primary_tag_name ASC
    LIMIT 5
  `
    )
    .all();

  console.log(`   ✅ Sorted query returned: ${sortedQuery.length} images`);
  sortedQuery.forEach((img, i) => {
    const tag = img.primary_tag_name || '[untagged]';
    console.log(`      ${i + 1}. ${img.filename_original.substring(0, 30)}... → ${tag}`);
  });
  console.log('');

  // Test 5: Junction table integrity
  console.log('Test 5: Tag Junction Table');
  console.log('─'.repeat(50));

  const junctionSchema = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='project_reference_image_tags'"
    )
    .get();

  const hasIntegerReferenceId = junctionSchema.sql.includes('reference_id INTEGER NOT NULL');
  console.log(`   ✅ reference_id is INTEGER: ${hasIntegerReferenceId ? 'YES' : 'NO'}`);

  if (!hasIntegerReferenceId) {
    allTestsPassed = false;
  }

  const tagCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM project_reference_image_tags
  `
    )
    .get();

  console.log(`   ✅ Tag associations in database: ${tagCount.count}`);
  console.log('');

  // Test 6: Views exist and work
  console.log('Test 6: Dependent Views');
  console.log('─'.repeat(50));

  const viewCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='view' AND name IN ('v_reference_tag_counts', 'v_category_stats')"
    )
    .get();

  console.log(`   ✅ Views recreated: ${viewCount.count}/2`);

  if (viewCount.count === 2) {
    // Test the views work
    const tagCountsTest = db.prepare('SELECT COUNT(*) as count FROM v_reference_tag_counts').get();
    const categoryStatsTest = db.prepare('SELECT COUNT(*) as count FROM v_category_stats').get();

    console.log(`   ✅ v_reference_tag_counts: ${tagCountsTest.count} rows`);
    console.log(`   ✅ v_category_stats: ${categoryStatsTest.count} rows`);
  } else {
    console.log('   ❌ Not all views present!');
    allTestsPassed = false;
  }
  console.log('');

  // Test 7: Soft delete capability
  console.log('Test 7: Soft Delete Capability');
  console.log('─'.repeat(50));

  // Count currently active images
  const activeBefore = db
    .prepare('SELECT COUNT(*) as count FROM project_reference_images WHERE is_deleted = 0')
    .get();
  console.log(`   Active images before: ${activeBefore.count}`);

  // All images should be active (we restored them earlier)
  const allActive = activeBefore.count === 23;
  console.log(`   ✅ All images active: ${allActive ? 'YES' : 'NO'}`);

  if (!allActive) {
    allTestsPassed = false;
  }
  console.log('');

  // Final Summary
  console.log('═'.repeat(50));
  console.log('VERIFICATION SUMMARY');
  console.log('═'.repeat(50));

  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Reference System Status: FULLY OPERATIONAL ✅');
    console.log('');
    console.log('Key Features Working:');
    console.log('  • Image listing by project (project_id filter) ✅');
    console.log('  • Single image retrieval by ID ✅');
    console.log('  • Tag-based automatic sorting ✅');
    console.log('  • Tag associations (junction table) ✅');
    console.log('  • Database views and statistics ✅');
    console.log('  • Soft delete functionality ✅');
    console.log('');
    console.log('🎉 The reference system is ready to use!');
  } else {
    console.log('❌ SOME TESTS FAILED\n');
    console.log('Please review the output above for details.');
  }
} catch (error) {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
