#!/usr/bin/env node
/**
 * Minimal test script to verify unified_activity INSERT operations
 * Tests if logActivity() method works in isolation without the service layer
 */

const Database = require('better-sqlite3');
const path = require('path');

// Use absolute path to users.db
const dbPath = path.join(__dirname, '../data/users.db');

console.log('🔍 Testing unified_activity INSERT...');
console.log('📁 Database path:', dbPath);

const db = new Database(dbPath);

try {
  // First, verify the table exists and check its schema
  console.log('\n1️⃣ Checking table schema...');
  const tableInfo = db.prepare(`PRAGMA table_info(unified_activity)`).all();

  if (tableInfo.length === 0) {
    console.error('❌ Table "unified_activity" does not exist!');
    process.exit(1);
  }

  console.log('✅ Table exists with columns:');
  tableInfo.forEach(col => {
    console.log(
      `   - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.pk ? 'PRIMARY KEY' : ''}`
    );
  });

  // Check current row count
  console.log('\n2️⃣ Checking current row count...');
  const countBefore = db.prepare('SELECT COUNT(*) as count FROM unified_activity').get();
  console.log(`   Current rows: ${countBefore.count}`);

  // Attempt the INSERT with exact values from logActivity()
  console.log('\n3️⃣ Attempting INSERT...');
  const stmt = db.prepare(`
    INSERT INTO unified_activity (
      user_id, activity_type, entity_id, entity_type, action, metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const testData = {
    user_id: 1,
    activity_type: 'user_updated',
    entity_id: '1', // String (as used in logActivity)
    entity_type: 'user',
    action: 'profile_updated',
    metadata: '{}',
  };

  console.log('   Test data:', testData);

  const result = stmt.run(
    testData.user_id,
    testData.activity_type,
    testData.entity_id,
    testData.entity_type,
    testData.action,
    testData.metadata
  );

  console.log('✅ INSERT successful!');
  console.log('   Changes:', result.changes);
  console.log('   Last Insert ID:', result.lastInsertRowid);

  // Verify the row was actually inserted
  console.log('\n4️⃣ Verifying inserted row...');
  const countAfter = db.prepare('SELECT COUNT(*) as count FROM unified_activity').get();
  console.log(`   New row count: ${countAfter.count}`);

  if (countAfter.count > countBefore.count) {
    console.log('✅ Row successfully added to database');

    // Fetch and display the inserted row
    const insertedRow = db
      .prepare(
        `
      SELECT * FROM unified_activity
      WHERE id = ?
    `
      )
      .get(result.lastInsertRowid);

    console.log('\n   Inserted row:');
    console.log('   ', JSON.stringify(insertedRow, null, 2));
  } else {
    console.log('⚠️  Row count did not increase - INSERT may have been rolled back');
  }

  // Test with different data types for entity_id
  console.log('\n5️⃣ Testing with numeric entity_id...');
  const result2 = stmt.run(
    2, // user_id
    'user_updated', // activity_type
    123, // entity_id (numeric)
    'user', // entity_type
    'profile_updated', // action
    '{"test": true}' // metadata
  );
  console.log('✅ Numeric entity_id INSERT successful');
  console.log('   Last Insert ID:', result2.lastInsertRowid);

  console.log('\n✨ All tests passed!');
} catch (error) {
  console.error('\n❌ Test failed!');
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  console.error('Full error:', error);
  process.exit(1);
} finally {
  db.close();
  console.log('\n🔒 Database connection closed');
}
