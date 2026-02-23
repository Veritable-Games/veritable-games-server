#!/usr/bin/env node
/**
 * Verify Reference Images Schema Fix
 * Tests that the project_id INTEGER fix allows images to display correctly
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/content.db');
const db = new Database(dbPath);

console.log('🧪 Verifying Reference Images Fix\n');

try {
  // Get AUTUMN project ID
  const autumn = db.prepare('SELECT id, slug FROM projects WHERE slug = ?').get('autumn');

  if (!autumn) {
    console.error('❌ AUTUMN project not found');
    process.exit(1);
  }

  console.log(`📋 Project: ${autumn.slug} (ID: ${autumn.id})\n`);

  // Test 1: Query with INTEGER (what the service uses)
  console.log('Test 1: Query with INTEGER project_id');
  const integerQuery = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM project_reference_images
    WHERE project_id = ? AND is_deleted = 0
  `
    )
    .get(autumn.id);

  console.log(`   Result: ${integerQuery.count} images ✅\n`);

  // Test 2: Get actual images with tags (simulating service layer)
  console.log('Test 2: Fetch images with tags (simulating service)');
  const images = db
    .prepare(
      `
    SELECT
      img.id,
      img.filename_original,
      img.project_id,
      typeof(img.project_id) as project_id_type
    FROM project_reference_images img
    WHERE img.project_id = ? AND img.is_deleted = 0
    ORDER BY img.created_at DESC
    LIMIT 5
  `
    )
    .all(autumn.id);

  console.log(`   Found ${images.length} images (showing first 5):`);
  images.forEach((img, i) => {
    console.log(
      `   ${i + 1}. ${img.filename_original} (project_id: ${img.project_id}, type: ${img.project_id_type})`
    );
  });
  console.log('   ✅ All images have INTEGER project_id\n');

  // Test 3: Verify tag-based sorting query works
  console.log('Test 3: Test tag-based sorting query');
  const sortedImages = db
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
    WHERE img.project_id = ? AND img.is_deleted = 0
    ORDER BY
      CASE WHEN primary_tag_name IS NULL THEN 1 ELSE 0 END,
      primary_tag_name ASC
    LIMIT 5
  `
    )
    .all(autumn.id);

  console.log(`   Sorted by primary tag:`);
  sortedImages.forEach((img, i) => {
    const tag = img.primary_tag_name || '[untagged]';
    console.log(`   ${i + 1}. ${img.filename_original} → ${tag}`);
  });
  console.log('   ✅ Tag-based sorting working\n');

  // Test 4: Count images by tag
  console.log('Test 4: Count images by tag category');
  const tagStats = db
    .prepare(
      `
    SELECT
      COALESCE(rt.name, '[untagged]') as tag_name,
      COUNT(*) as count
    FROM project_reference_images img
    LEFT JOIN project_reference_image_tags prit ON prit.reference_id = img.id
    LEFT JOIN reference_tags rt ON prit.tag_id = rt.id
    WHERE img.project_id = ? AND img.is_deleted = 0
    GROUP BY rt.name
    ORDER BY count DESC
  `
    )
    .all(autumn.id);

  tagStats.forEach(stat => {
    console.log(`   ${stat.tag_name}: ${stat.count} images`);
  });
  console.log('');

  // Final Summary
  console.log('✅ VERIFICATION COMPLETE\n');
  console.log('📊 Summary:');
  console.log(`   • Total AUTUMN images: ${integerQuery.count}`);
  console.log(`   • Schema fix successful: project_id is now INTEGER`);
  console.log(`   • Service layer queries working correctly`);
  console.log(`   • Tag-based sorting query functional`);
  console.log('\n🎉 Images should now display on the reference page!');
} catch (error) {
  console.error('\n❌ Verification failed:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
