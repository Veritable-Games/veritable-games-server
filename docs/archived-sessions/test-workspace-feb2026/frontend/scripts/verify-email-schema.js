#!/usr/bin/env node

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifySchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔍 Verifying email schema...\n');

    // Check email columns in users table
    console.log('1️⃣  Email columns in users.users:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'users' AND table_name = 'users'
      AND column_name LIKE 'email%'
      ORDER BY column_name
    `);

    if (columnsResult.rows.length === 0) {
      console.log('   ✗ No email columns found!');
    } else {
      columnsResult.rows.forEach(col => {
        console.log(`   ✓ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check email_logs table
    console.log('\n2️⃣  Email logs table:');
    const tableResult = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'system' AND table_name = 'email_logs'
    `);

    if (tableResult.rows.length === 0) {
      console.log('   ✗ email_logs table not found!');
    } else {
      console.log(
        `   ✓ Table exists: ${tableResult.rows[0].table_schema}.${tableResult.rows[0].table_name}`
      );
    }

    // Check email_logs columns
    if (tableResult.rows.length > 0) {
      const logColumnsResult = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'system' AND table_name = 'email_logs'
        ORDER BY ordinal_position
      `);

      console.log('   Columns:');
      logColumnsResult.rows.forEach(col => {
        console.log(`     • ${col.column_name}: ${col.data_type}`);
      });
    }

    // Check indexes
    console.log('\n3️⃣  Indexes:');
    const indexResult = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname IN ('users', 'system')
      AND (tablename = 'users' OR tablename = 'email_logs')
      AND indexname LIKE '%email%'
      ORDER BY tablename, indexname
    `);

    if (indexResult.rows.length === 0) {
      console.log('   ✗ No email indexes found!');
    } else {
      indexResult.rows.forEach(idx => {
        console.log(`   ✓ ${idx.tablename}: ${idx.indexname}`);
      });
    }

    console.log('\n✓ Email schema verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error verifying schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySchema();
