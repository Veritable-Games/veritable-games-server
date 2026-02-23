#!/usr/bin/env tsx
/**
 * Check PostgreSQL Sequence Health
 *
 * This script verifies that all PostgreSQL sequences are in sync with their tables.
 * A sequence that's behind the max ID will cause PRIMARY KEY violations on INSERT.
 *
 * Usage:
 *   npm run db:check-sequences          # Check all sequences
 *   npm run db:check-sequences --fix    # Auto-fix sequences that are out of sync
 */

import { dbAdapter } from '@/lib/database/adapter';
import { requirePostgres } from '@/lib/utils/require-postgres';

// Ensure we're using PostgreSQL
requirePostgres('Sequence health check');

interface SequenceCheck {
  schema: string;
  table: string;
  sequence: string;
  lastValue: number;
  maxId: number;
  gap: number;
  status: 'OK' | 'OUT_OF_SYNC' | 'ERROR';
}

/**
 * Get all sequences and their corresponding tables
 */
async function getAllSequences(): Promise<
  Array<{ schema: string; table: string; sequence: string }>
> {
  const result = await dbAdapter.query<{
    schema: string;
    table: string;
    sequence: string;
  }>(
    `
    SELECT
      schemaname as schema,
      tablename as table,
      sequencename as sequence
    FROM pg_sequences
    WHERE schemaname IN ('wiki', 'forums', 'users', 'content', 'auth', 'system', 'messaging')
    ORDER BY schemaname, tablename
  `,
    []
  );

  return result.rows;
}

/**
 * Check if a sequence is in sync with its table
 */
async function checkSequence(
  schema: string,
  table: string,
  sequence: string
): Promise<SequenceCheck> {
  try {
    // Get current sequence value
    const seqResult = await dbAdapter.query<{ last_value: number }>(
      `SELECT last_value FROM ${schema}.${sequence}`,
      []
    );

    const lastValue = seqResult.rows[0]?.last_value || 0;

    // Get max ID from table
    const maxResult = await dbAdapter.query<{ max_id: number }>(
      `SELECT COALESCE(MAX(id), 0) as max_id FROM ${schema}.${table}`,
      []
    );

    const maxId = maxResult.rows[0]?.max_id || 0;
    const gap = maxId - lastValue;

    const status = gap > 0 ? 'OUT_OF_SYNC' : 'OK';

    return {
      schema,
      table,
      sequence,
      lastValue,
      maxId,
      gap,
      status,
    };
  } catch (error: any) {
    return {
      schema,
      table,
      sequence,
      lastValue: -1,
      maxId: -1,
      gap: -1,
      status: 'ERROR',
    };
  }
}

/**
 * Fix a sequence by setting it to the max ID
 */
async function fixSequence(schema: string, sequence: string, maxId: number): Promise<void> {
  await dbAdapter.query(`SELECT setval('${schema}.${sequence}', $1)`, [maxId]);
}

/**
 * Main execution
 */
async function main() {
  const autoFix = process.argv.includes('--fix');

  console.log('🔍 Checking PostgreSQL sequence health...\n');

  const sequences = await getAllSequences();
  const checks: SequenceCheck[] = [];

  for (const seq of sequences) {
    const check = await checkSequence(seq.schema, seq.table, seq.sequence);
    checks.push(check);
  }

  // Print results
  const okCount = checks.filter(c => c.status === 'OK').length;
  const outOfSyncCount = checks.filter(c => c.status === 'OUT_OF_SYNC').length;
  const errorCount = checks.filter(c => c.status === 'ERROR').length;

  console.log('📊 Summary:');
  console.log(`   ✅ OK: ${okCount}`);
  console.log(`   ⚠️  Out of Sync: ${outOfSyncCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log();

  if (outOfSyncCount > 0) {
    console.log('⚠️  Sequences Out of Sync:\n');
    console.log(
      'Schema      | Table                | Sequence                   | Last Value | Max ID | Gap'
    );
    console.log(
      '-----------|----------------------|----------------------------|------------|--------|-----'
    );

    checks
      .filter(c => c.status === 'OUT_OF_SYNC')
      .forEach(c => {
        console.log(
          `${c.schema.padEnd(11)}| ${c.table.padEnd(20)} | ${c.sequence.padEnd(26)} | ${String(c.lastValue).padStart(10)} | ${String(c.maxId).padStart(6)} | ${c.gap}`
        );
      });

    console.log();

    if (autoFix) {
      console.log('🔧 Auto-fixing sequences...\n');

      for (const check of checks.filter(c => c.status === 'OUT_OF_SYNC')) {
        try {
          await fixSequence(check.schema, check.sequence, check.maxId);
          console.log(`   ✅ Fixed ${check.schema}.${check.sequence} → ${check.maxId}`);
        } catch (error: any) {
          console.error(`   ❌ Failed to fix ${check.schema}.${check.sequence}:`, error.message);
        }
      }

      console.log('\n✅ Sequence fixes completed!');
    } else {
      console.log('💡 To fix these sequences automatically, run:');
      console.log('   npm run db:check-sequences -- --fix');
    }
  } else if (errorCount > 0) {
    console.log('❌ Errors encountered:\n');

    checks
      .filter(c => c.status === 'ERROR')
      .forEach(c => {
        console.log(`   ${c.schema}.${c.table} (${c.sequence})`);
      });
  } else {
    console.log('✅ All sequences are in sync!');
  }

  process.exit(outOfSyncCount > 0 || errorCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Error checking sequences:', error);
  process.exit(1);
});
