#!/usr/bin/env tsx

/**
 * Fix: Create auth.login_history table
 * This migration was not being tracked properly, causing E2E test failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { dbAdapter } from '../src/lib/database/adapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createLoginHistoryTable() {
  console.log('🔧 Creating auth.login_history table...');

  try {
    // Read the migration SQL
    const migrationPath = join(__dirname, 'migrations', 'create-session-tracking.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await dbAdapter.query(sql, [], { schema: 'auth' });

    console.log('✅ auth.login_history table created successfully');

    // Verify the table exists
    const checkResult = await dbAdapter.query(
      `SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'login_history'
      )`,
      [],
      { schema: 'auth' }
    );

    if (checkResult.rows[0].exists) {
      console.log('✅ Verified: auth.login_history table exists');
    } else {
      console.error('❌ Table creation failed - table does not exist');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createLoginHistoryTable();
