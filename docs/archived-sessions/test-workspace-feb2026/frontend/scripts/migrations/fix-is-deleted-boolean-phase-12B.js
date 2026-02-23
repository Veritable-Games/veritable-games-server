#!/usr/bin/env node

/**
 * Migration: Fix is_deleted column type from integer to boolean
 *
 * Phase 12B introduced boolean comparisons (= false) but the column
 * is still integer type in PostgreSQL. This migration fixes that.
 *
 * CRITICAL: This must be run before Phase 12B code changes work correctly
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString:
      process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔍 Checking PostgreSQL connection...');
    const checkResult = await pool.query('SELECT current_database(), current_user');
    console.log(
      `✅ Connected to: ${checkResult.rows[0].current_database} as ${checkResult.rows[0].current_user}`
    );

    console.log('\n📊 Checking current column type...');
    const columnCheck = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'content'
        AND table_name = 'project_reference_images'
        AND column_name = 'is_deleted'
    `);

    if (columnCheck.rows.length === 0) {
      console.error('❌ Column is_deleted not found in content.project_reference_images');
      process.exit(1);
    }

    const currentType = columnCheck.rows[0].data_type;
    console.log(`Current type: ${currentType}`);

    if (currentType === 'boolean') {
      console.log('✅ Column is already boolean type. No migration needed.');
      return;
    }

    if (currentType !== 'integer') {
      console.error(`❌ Unexpected column type: ${currentType}. Expected integer or boolean.`);
      process.exit(1);
    }

    console.log('\n🔄 Starting migration...');
    console.log('Step 1: Checking current values...');

    const valueCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_deleted = 0) as zeros,
        COUNT(*) FILTER (WHERE is_deleted = 1) as ones,
        COUNT(*) FILTER (WHERE is_deleted NOT IN (0, 1)) as invalid
      FROM content.project_reference_images
    `);

    const stats = valueCheck.rows[0];
    console.log(`  Total rows: ${stats.total}`);
    console.log(`  is_deleted = 0: ${stats.zeros}`);
    console.log(`  is_deleted = 1: ${stats.ones}`);
    console.log(`  Invalid values: ${stats.invalid}`);

    if (parseInt(stats.invalid) > 0) {
      console.error('❌ Found invalid values (not 0 or 1). Cannot proceed.');
      process.exit(1);
    }

    console.log('\nStep 2: Dropping default value...');
    console.log(
      '  SQL: ALTER TABLE content.project_reference_images ALTER COLUMN is_deleted DROP DEFAULT'
    );

    await pool.query(`
      ALTER TABLE content.project_reference_images
      ALTER COLUMN is_deleted DROP DEFAULT
    `);

    console.log('✅ Default value dropped');

    console.log('\nStep 3: Converting integer to boolean...');
    console.log(
      '  SQL: ALTER TABLE content.project_reference_images ALTER COLUMN is_deleted TYPE boolean USING (is_deleted::integer::boolean)'
    );

    await pool.query(`
      ALTER TABLE content.project_reference_images
      ALTER COLUMN is_deleted TYPE boolean USING (is_deleted::integer::boolean)
    `);

    console.log('✅ Column type converted successfully');

    console.log('\nStep 4: Setting new boolean default...');
    console.log(
      '  SQL: ALTER TABLE content.project_reference_images ALTER COLUMN is_deleted SET DEFAULT false'
    );

    await pool.query(`
      ALTER TABLE content.project_reference_images
      ALTER COLUMN is_deleted SET DEFAULT false
    `);

    console.log('✅ New default value set');

    console.log('\nStep 5: Verifying conversion...');
    const verifyResult = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'content'
        AND table_name = 'project_reference_images'
        AND column_name = 'is_deleted'
    `);

    console.log(`New type: ${verifyResult.rows[0].data_type}`);

    const newValueCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_deleted = false) as falses,
        COUNT(*) FILTER (WHERE is_deleted = true) as trues
      FROM content.project_reference_images
    `);

    const newStats = newValueCheck.rows[0];
    console.log(`\n📊 New value distribution:`);
    console.log(`  Total rows: ${newStats.total}`);
    console.log(`  is_deleted = false: ${newStats.falses}`);
    console.log(`  is_deleted = true: ${newStats.trues}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('Gallery queries with "= false" will now work correctly.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
console.log('🚀 Phase 12B Migration: Fix is_deleted boolean type');
console.log('===================================================\n');

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
