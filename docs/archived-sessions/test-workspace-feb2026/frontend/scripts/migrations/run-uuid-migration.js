import { dbAdapter } from '../../src/lib/database/adapter.js';

async function runMigration() {
  try {
    console.log('Starting UUID migration...');

    // Step 1: Add column
    console.log('Step 1: Adding uuid column...');
    await dbAdapter.query(
      `ALTER TABLE users.users ADD COLUMN uuid UUID DEFAULT gen_random_uuid() NOT NULL`,
      [],
      { schema: 'users' }
    );
    console.log('✓ Column added');

    // Step 2: Create index
    console.log('Step 2: Creating unique index...');
    await dbAdapter.query(`CREATE UNIQUE INDEX idx_users_uuid ON users.users(uuid)`, [], {
      schema: 'users',
    });
    console.log('✓ Index created');

    // Step 3: Verify
    console.log('\nStep 3: Verifying...');
    const result = await dbAdapter.query(`SELECT username, uuid FROM users.users LIMIT 5`, [], {
      schema: 'users',
    });

    console.log('\n✅ Migration complete! Sample users:');
    result.rows.forEach(row => {
      console.log(`   ${row.username}: ${row.uuid}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
