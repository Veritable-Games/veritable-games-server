#!/usr/bin/env tsx
/**
 * Apply Yjs Snapshots Migration
 *
 * Creates the workspace_yjs_snapshots table in PostgreSQL for WebSocket server
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { dbAdapter } from '../src/lib/database/adapter';

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, 'migrations', 'postgres-workspace-yjs-snapshots.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying migration to content schema...');

    // Split by statement (PostgreSQL allows multiple statements)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        await dbAdapter.query(statement, [], { schema: 'content' });
      }
    }

    console.log('✅ Migration applied successfully!');

    // Verify table exists
    const result = await dbAdapter.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'content' AND table_name = 'workspace_yjs_snapshots'`,
      [],
      { schema: 'content' }
    );

    if (result.rows.length > 0) {
      console.log('✅ Table workspace_yjs_snapshots verified');

      // Show table structure
      const columns = await dbAdapter.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'content' AND table_name = 'workspace_yjs_snapshots'
         ORDER BY ordinal_position`,
        [],
        { schema: 'content' }
      );

      console.log('\n📋 Table structure:');
      columns.rows.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Table verification failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

applyMigration();
