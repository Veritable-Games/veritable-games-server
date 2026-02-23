#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function setRandomPasswords() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get all non-admin/non-developer users (keep admin and rothus767 unchanged)
    const result = await pool.query(`
      SELECT id, username, email, role
      FROM users.users
      WHERE role NOT IN ('admin', 'developer')
      ORDER BY id
    `);

    const passwords = [
      'fPo9h3PuiR1k2JU',
      'vJRBV6DyZ7tzqx7',
      'Zmr5hR5BlKOyhaH',
      'G18EK3DU4kjbnt3',
      '1bKKIJTUw1AUKsq',
      'MEHJ1xWsy0XoA1f',
      'q7Y4QNPWZWwN6IQ',
      '6P19KIaS5s7VoJC',
      'qpw5NUPwZO3bxpJ',
      'aW2fngYwN5R8zRU',
    ];

    console.log('\n🔐 Setting random passwords for non-admin users...\n');

    for (let i = 0; i < result.rows.length; i++) {
      const user = result.rows[i];
      const password = passwords[i];
      const passwordHash = await bcrypt.hash(password, 12);

      await pool.query(`UPDATE users.users SET password_hash = $1 WHERE id = $2`, [
        passwordHash,
        user.id,
      ]);

      console.log(`✅ ${user.username} (${user.email})`);
      console.log(`   Password: ${password}\n`);
    }

    console.log('✅ All passwords updated successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

setRandomPasswords();
