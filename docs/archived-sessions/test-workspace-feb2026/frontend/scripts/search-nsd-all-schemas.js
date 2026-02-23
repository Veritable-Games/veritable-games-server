#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function searchAllSchemas() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      'postgresql://postgres:postgres@192.168.1.15:5432/veritable_games',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('=== Searching for NSD across ALL schemas ===\n');

    // Get all schemas
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    console.log(`Searching ${schemas.rows.length} schemas...\n`);

    for (const schema of schemas.rows) {
      const schemaName = schema.schema_name;
      console.log(`\n=== Schema: ${schemaName} ===`);

      // Get all tables in this schema
      const tables = await pool.query(
        `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
        [schemaName]
      );

      for (const table of tables.rows) {
        const tableName = table.table_name;

        // Get text columns
        const columns = await pool.query(
          `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = $1 
            AND table_name = $2 
            AND data_type IN ('text', 'character varying', 'character')
        `,
          [schemaName, tableName]
        );

        if (columns.rows.length === 0) continue;

        // Build search query
        const conditions = columns.rows
          .map((col, i) => `${col.column_name} ILIKE '%nsd%'`)
          .join(' OR ');

        const searchQuery = `
          SELECT COUNT(*) as count
          FROM ${schemaName}.${tableName}
          WHERE ${conditions}
        `;

        try {
          const result = await pool.query(searchQuery);
          const count = parseInt(result.rows[0].count);

          if (count > 0) {
            console.log(`  ✅ ${tableName}: Found ${count} row(s) with NSD`);

            // Get sample data
            const sampleQuery = `
              SELECT *
              FROM ${schemaName}.${tableName}
              WHERE ${conditions}
              LIMIT 5
            `;
            const samples = await pool.query(sampleQuery);
            samples.rows.forEach((row, i) => {
              console.log(`     Sample ${i + 1}:`, JSON.stringify(row, null, 2));
            });
          }
        } catch (err) {
          // Skip tables with errors (permissions, etc.)
        }
      }
    }

    console.log('\n=== Search complete ===');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

searchAllSchemas();
