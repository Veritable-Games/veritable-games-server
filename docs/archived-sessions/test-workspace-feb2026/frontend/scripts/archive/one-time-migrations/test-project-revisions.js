/**
 * Test script for project revisions system
 * Verifies that ProjectRevisionsService works correctly
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/content.db');

async function testProjectRevisions() {
  console.log('🧪 Testing Project Revisions System\n');

  const db = new Database(DB_PATH);

  try {
    // 1. Verify table exists
    console.log('1️⃣  Checking project_revisions table...');
    const tableCheck = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='project_revisions'
    `
      )
      .get();

    if (!tableCheck) {
      console.error('❌ project_revisions table not found!');
      process.exit(1);
    }
    console.log('✅ Table exists\n');

    // 2. Verify triggers exist
    console.log('2️⃣  Checking triggers...');
    const triggers = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='trigger' AND tbl_name='project_revisions'
    `
      )
      .all();

    if (triggers.length === 0) {
      console.error('❌ No triggers found!');
      process.exit(1);
    }
    console.log(`✅ Found ${triggers.length} trigger(s):`);
    triggers.forEach(t => console.log(`   - ${t.name}`));
    console.log('');

    // 3. Verify indexes exist
    console.log('3️⃣  Checking indexes...');
    const indexes = db.prepare(`PRAGMA index_list(project_revisions)`).all();

    if (indexes.length === 0) {
      console.error('❌ No indexes found!');
      process.exit(1);
    }
    console.log(`✅ Found ${indexes.length} index(es):`);
    indexes.forEach(idx => console.log(`   - ${idx.name}`));
    console.log('');

    // 4. Check if projects exist
    console.log('4️⃣  Checking existing projects...');
    const projects = db.prepare(`SELECT slug FROM projects LIMIT 5`).all();

    if (projects.length === 0) {
      console.log('⚠️  No projects found in database');
    } else {
      console.log(`✅ Found ${projects.length} project(s):`);
      projects.forEach(p => console.log(`   - ${p.slug}`));
    }
    console.log('');

    // 5. Create a test revision
    console.log('5️⃣  Creating test revision...');
    const testSlug = projects.length > 0 ? projects[0].slug : 'test-project';

    // First, ensure project exists
    const projectExists = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(testSlug);
    if (!projectExists) {
      console.log(`   Creating test project: ${testSlug}`);
      db.prepare(
        `
        INSERT INTO projects (slug, title, description, category, status, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(
        testSlug,
        'Test Project',
        'Test project for revision system',
        'Test',
        'Concept',
        '# Test Project\n\nInitial content'
      );
    }

    const testContent =
      '# Test Project\n\nThis is a test revision created by the test script.\n\nTimestamp: ' +
      new Date().toISOString();
    const testSummary = 'Test revision from automated test';

    const result = db
      .prepare(
        `
      INSERT INTO project_revisions (
        project_slug, content, summary, author_id, author_name,
        size_bytes, revision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
      )
      .run(
        testSlug,
        testContent,
        testSummary,
        null,
        'Test System',
        Buffer.byteLength(testContent, 'utf8')
      );

    if (result.changes > 0) {
      console.log(`✅ Created revision ID: ${result.lastInsertRowid}`);
    } else {
      console.error('❌ Failed to create revision');
      process.exit(1);
    }
    console.log('');

    // 6. Verify trigger updated projects table
    console.log('6️⃣  Verifying trigger updated projects table...');
    const updatedProject = db.prepare(`SELECT content FROM projects WHERE slug = ?`).get(testSlug);

    if (updatedProject && updatedProject.content === testContent) {
      console.log('✅ Trigger correctly updated projects.content');
    } else {
      console.error('❌ Trigger did not update projects.content');
      console.error('Expected:', testContent.substring(0, 50) + '...');
      console.error('Got:', (updatedProject?.content || '').substring(0, 50) + '...');
      process.exit(1);
    }
    console.log('');

    // 7. Query revisions
    console.log('7️⃣  Querying revisions...');
    const revisions = db
      .prepare(
        `
      SELECT id, summary, author_name, revision_timestamp, size_bytes
      FROM project_revisions
      WHERE project_slug = ?
      ORDER BY revision_timestamp DESC
      LIMIT 3
    `
      )
      .all(testSlug);

    if (revisions.length > 0) {
      console.log(`✅ Found ${revisions.length} revision(s) for ${testSlug}:`);
      revisions.forEach(r => {
        console.log(`   - ID ${r.id}: ${r.summary || 'No summary'} (${r.size_bytes} bytes)`);
        console.log(`     Author: ${r.author_name}, Time: ${r.revision_timestamp}`);
      });
    } else {
      console.error('❌ No revisions found');
      process.exit(1);
    }
    console.log('');

    // 8. Cleanup test data
    console.log('8️⃣  Cleaning up test data...');
    db.prepare(`DELETE FROM project_revisions WHERE author_name = 'Test System'`).run();
    console.log('✅ Cleanup complete\n');

    console.log('✨ All tests passed! Project revision system is working correctly.\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run tests
testProjectRevisions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
