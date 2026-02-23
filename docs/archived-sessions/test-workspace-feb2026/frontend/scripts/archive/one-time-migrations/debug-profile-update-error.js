#!/usr/bin/env node

/**
 * Debug Profile Update Error
 *
 * This script helps diagnose the "Failed to update profile" error by:
 * 1. Checking the unified_activity table schema
 * 2. Testing the updateUser method directly
 * 3. Capturing the actual error message
 */

const Database = require('better-sqlite3');
const path = require('path');

console.log('='.repeat(60));
console.log('DEBUG PROFILE UPDATE ERROR');
console.log('='.repeat(60));

// Connect to users.db
const dbPath = path.join(__dirname, '../data/users.db');
console.log(`\nConnecting to: ${dbPath}`);

const db = new Database(dbPath);

// 1. Check if unified_activity table exists
console.log('\n1. Checking unified_activity table...');
try {
  const tableInfo = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='unified_activity'
  `
    )
    .get();

  if (tableInfo) {
    console.log('✓ unified_activity table EXISTS');

    // Get schema
    const schema = db.prepare('PRAGMA table_info(unified_activity)').all();
    console.log('\n  Schema:');
    schema.forEach(col => {
      console.log(`    - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}`);
    });

    // Get row count
    const count = db.prepare('SELECT COUNT(*) as count FROM unified_activity').get();
    console.log(`\n  Row count: ${count.count}`);
  } else {
    console.log('✗ unified_activity table DOES NOT EXIST');
    console.log('\n  This is the likely cause of the error!');
  }
} catch (error) {
  console.log(`✗ Error checking table: ${error.message}`);
}

// 2. Check users table
console.log('\n2. Checking users table...');
try {
  const users = db.prepare('SELECT id, username, email, display_name FROM users LIMIT 5').all();
  console.log(`✓ Found ${users.length} users (showing first 5):`);
  users.forEach(user => {
    console.log(`  - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
  });
} catch (error) {
  console.log(`✗ Error querying users: ${error.message}`);
}

// 3. Simulate the updateUser operation
console.log('\n3. Simulating updateUser operation...');
try {
  // Get first user
  const testUser = db.prepare('SELECT id FROM users LIMIT 1').get();

  if (!testUser) {
    console.log('✗ No users found in database');
  } else {
    console.log(`  Testing update for user ID: ${testUser.id}`);

    // Try the update query
    const updateData = {
      bio: 'Test bio update',
    };

    const updates = [];
    const params = [];

    updates.push('bio = ?');
    params.push(updateData.bio);
    updates.push("updated_at = datetime('now')");
    params.push(testUser.id);

    const updateStmt = db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    console.log(`  SQL: UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
    console.log(`  Params:`, params);

    const result = updateStmt.run(...params);
    console.log(`✓ Update successful! Changed ${result.changes} row(s)`);

    // Try to log activity (this is where the error likely occurs)
    console.log('\n  Testing activity logging...');
    try {
      const activityStmt = db.prepare(`
        INSERT INTO unified_activity (
          user_id, activity_type, entity_id, entity_type, action, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      activityStmt.run(
        testUser.id,
        'user_updated',
        String(testUser.id),
        'user',
        'profile_updated',
        JSON.stringify({ updated_fields: ['bio'] })
      );

      console.log('  ✓ Activity logging successful');
    } catch (activityError) {
      console.log(`  ✗ Activity logging failed: ${activityError.message}`);
      console.log('  \n  THIS IS LIKELY THE ROOT CAUSE!');
      console.log(`  \n  Error details:`);
      console.log(`    Message: ${activityError.message}`);
      console.log(`    Code: ${activityError.code}`);
    }
  }
} catch (error) {
  console.log(`✗ Simulation failed: ${error.message}`);
  console.log(`\nFull error:`);
  console.log(error);
}

// 4. Check for missing indexes
console.log('\n4. Checking indexes...');
try {
  const indexes = db
    .prepare(
      `
    SELECT name, sql FROM sqlite_master
    WHERE type='index' AND tbl_name='unified_activity'
  `
    )
    .all();

  if (indexes.length > 0) {
    console.log(`✓ Found ${indexes.length} index(es):`);
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}`);
    });
  } else {
    console.log('  No indexes found (this may impact performance)');
  }
} catch (error) {
  console.log(`  Error checking indexes: ${error.message}`);
}

console.log('\n' + '='.repeat(60));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(60));

db.close();
