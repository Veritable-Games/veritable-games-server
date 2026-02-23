#!/usr/bin/env tsx

import { dbAdapter } from '../src/lib/database/adapter';

async function updateTestUserRole() {
  console.log('🔧 Updating testuser role to developer...');

  try {
    // Check current role
    const currentResult = await dbAdapter.query(
      'SELECT id, username, role FROM users WHERE username = ?',
      ['testuser'],
      { schema: 'users' }
    );

    if (!currentResult.rows.length) {
      console.error('❌ testuser not found');
      process.exit(1);
    }

    console.log('Current user:', currentResult.rows[0]);

    // Update to developer role
    await dbAdapter.query(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
      ['developer', 'testuser'],
      { schema: 'users' }
    );

    // Verify update
    const verifyResult = await dbAdapter.query(
      'SELECT id, username, role FROM users WHERE username = ?',
      ['testuser'],
      { schema: 'users' }
    );

    console.log('✅ Updated user:', verifyResult.rows[0]);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateTestUserRole();
