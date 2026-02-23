import { dbAdapter } from '../../src/lib/database/adapter.js';

async function verify() {
  const result = await dbAdapter.query(
    'SELECT id, username, uuid FROM users.users ORDER BY id LIMIT 5',
    [],
    { schema: 'users' }
  );

  console.log('\n✅ UUID column exists. Sample users:');
  result.rows.forEach(row => {
    console.log(`   ID ${row.id} - ${row.username}`);
    console.log(`   UUID: ${row.uuid}\n`);
  });

  process.exit(0);
}

verify().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
