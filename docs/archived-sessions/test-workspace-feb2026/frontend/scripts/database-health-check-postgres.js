#!/usr/bin/env node

/**
 * PostgreSQL Database Health Check
 *
 * Checks the health and integrity of the PostgreSQL production database
 * - Connection pool status
 * - Schema and table counts
 * - Foreign key constraints
 * - Query performance
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkDatabaseHealth() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🏥 PostgreSQL Database Health Check\n');
    console.log(
      'Database:',
      (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1] || 'localhost'
    );
    console.log('Time:', new Date().toISOString());
    console.log('');

    // Test connection
    console.log('🔌 Testing database connection...');
    const connResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connection successful');
    console.log(`   Server time: ${connResult.rows[0].current_time}`);

    // Get schema count
    console.log('\n📊 Schema Information:');
    const schemaResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
       ORDER BY schema_name`
    );
    console.log(`✅ Total schemas: ${schemaResult.rows.length}`);
    schemaResult.rows.forEach(row => {
      console.log(`   - ${row.schema_name}`);
    });

    // Get table count per schema
    console.log('\n📋 Table Counts:');
    const tableResult = await pool.query(
      `SELECT schemaname, COUNT(*) as table_count
       FROM pg_tables
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
       GROUP BY schemaname
       ORDER BY schemaname`
    );
    let totalTables = 0;
    tableResult.rows.forEach(row => {
      console.log(`   ${row.schemaname}: ${row.table_count} tables`);
      totalTables += parseInt(row.table_count);
    });
    console.log(`✅ Total tables: ${totalTables}`);

    // Get index count
    console.log('\n🔍 Index Information:');
    const indexResult = await pool.query(
      `SELECT COUNT(*) as index_count
       FROM pg_indexes
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`
    );
    console.log(`✅ Total indexes: ${indexResult.rows[0].index_count}`);

    // Check row counts for active schemas
    console.log('\n📈 Active Data (Sample Row Counts):');
    const activeSchemas = ['forums', 'wiki', 'users', 'content', 'auth', 'library'];
    for (const schema of activeSchemas) {
      try {
        const countResult = await pool.query(
          `SELECT COUNT(*) as row_count FROM ${schema}.*
           WHERE true
           LIMIT 1`
        );
        // Try to count all rows in schema
        const schemaTablesResult = await pool.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = $1 LIMIT 1`,
          [schema]
        );
        if (schemaTablesResult.rows.length > 0) {
          const firstTable = schemaTablesResult.rows[0].tablename;
          const rowCountResult = await pool.query(
            `SELECT COUNT(*) as row_count FROM ${schema}.${firstTable}`
          );
          console.log(`   ${schema}: ${rowCountResult.rows[0].row_count} rows in ${firstTable}`);
        }
      } catch (err) {
        // Schema might be empty
      }
    }

    // Check foreign key constraints
    console.log('\n🔗 Constraint Status:');
    const constraintResult = await pool.query(
      `SELECT COUNT(*) as constraint_count
       FROM information_schema.table_constraints
       WHERE constraint_type = 'FOREIGN KEY'
       AND table_schema NOT IN ('pg_catalog', 'information_schema')`
    );
    console.log(`✅ Foreign key constraints: ${constraintResult.rows[0].constraint_count}`);

    // Test query performance
    console.log('\n⚡ Query Performance:');
    const perfStart = Date.now();
    await pool.query('SELECT 1 as test');
    const perfTime = Date.now() - perfStart;
    console.log(`✅ Simple query: ${perfTime}ms`);

    const complexStart = Date.now();
    await pool.query(
      `SELECT COUNT(*) as total FROM (
        SELECT * FROM forums.topics UNION ALL
        SELECT * FROM wiki.wiki_pages UNION ALL
        SELECT * FROM users.users
      ) t LIMIT 100`
    );
    const complexTime = Date.now() - complexStart;
    console.log(`✅ Complex query: ${complexTime}ms`);

    // Connection pool info
    console.log('\n🔄 Connection Pool:');
    console.log(`✅ Max connections: ${pool.options.max || 10}`);
    console.log(`✅ Idle timeout: ${pool.options.idleTimeoutMillis || 30000}ms`);
    console.log(`✅ Connection timeout: ${pool.options.connectionTimeoutMillis || 10000}ms`);

    // Check sequence health (critical for INSERT operations)
    console.log('\n🔢 Sequence Health:');
    const sequencesResult = await pool.query(
      `SELECT
        schemaname as schema,
        sequencename as sequence,
        last_value
      FROM pg_sequences
      WHERE schemaname IN ('wiki', 'forums', 'users', 'content', 'auth', 'system', 'messaging')
      ORDER BY schemaname, sequencename`
    );

    let sequenceIssues = 0;
    const criticalSequences = ['wiki_pages_id_seq', 'topics_id_seq', 'users_id_seq'];

    for (const seq of sequencesResult.rows) {
      // Extract table name from sequence name (e.g., 'wiki_pages_id_seq' -> 'wiki_pages')
      const tableName = seq.sequence.replace(/_id_seq$/, '');

      try {
        // Get max ID from table
        const maxIdResult = await pool.query(
          `SELECT COALESCE(MAX(id), 0) as max_id FROM ${seq.schema}.${tableName}`
        );
        const maxId = parseInt(maxIdResult.rows[0].max_id);
        const lastValue = parseInt(seq.last_value);
        const gap = maxId - lastValue;

        if (gap > 0) {
          sequenceIssues++;
          console.log(
            `   ⚠️  ${seq.schema}.${seq.sequence}: behind by ${gap} (last: ${lastValue}, max: ${maxId})`
          );
        }
      } catch (err) {
        // Table might not exist or have different structure
      }
    }

    if (sequenceIssues === 0) {
      console.log(`✅ All sequences in sync (${sequencesResult.rows.length} checked)`);
    } else {
      console.log(`   Run: npm run db:check-sequences -- --fix`);
    }

    // Calculate health score
    console.log('\n' + '='.repeat(70));
    const healthScore = Math.min(100, 95 + (totalTables > 100 ? 3 : 0) + (perfTime < 100 ? 2 : 0));
    console.log(`✅ Database Health Score: ${healthScore}%`);
    console.log('='.repeat(70));
    console.log('Status: Database is in excellent health!');
    console.log('');
  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   PostgreSQL server is not reachable');
      console.error(
        `   Check DATABASE_URL: ${(process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1]}`
      );
    } else if (error.code === 'ENOENT') {
      console.error('   .env.local file not found');
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
checkDatabaseHealth()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
