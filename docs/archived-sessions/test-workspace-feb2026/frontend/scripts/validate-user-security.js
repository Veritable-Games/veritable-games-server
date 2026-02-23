#!/usr/bin/env node

/**
 * Quick Security Validation Script
 * Checks for immediate security issues in user data
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

console.log('🔒 User Data Security Validation\n');
console.log('='.repeat(60));

// Check 1: Database Files Exist
console.log('\n📁 Checking database files...');
const databases = ['auth.db', 'forums.db', 'wiki.db', 'users.db'];
const fs = require('fs');

databases.forEach(dbFile => {
  const dbPath = path.join(DATA_DIR, dbFile);
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const permissions = (stats.mode & parseInt('777', 8)).toString(8);
    const sizeKB = Math.round(stats.size / 1024);

    // Check permissions (should be 640 or more restrictive)
    const isSecure = permissions <= '640';
    const securityIcon = isSecure ? '✅' : '⚠️';

    console.log(`  ${securityIcon} ${dbFile}: ${sizeKB}KB, permissions: ${permissions}`);
  } else {
    console.log(`  ❌ ${dbFile}: NOT FOUND`);
  }
});

// Check 2: User Count Comparison
console.log('\n👥 Analyzing user data consistency...');
try {
  const authDb = new Database(path.join(DATA_DIR, 'auth.db'), { readonly: true });
  const forumsDb = new Database(path.join(DATA_DIR, 'forums.db'), { readonly: true });
  const wikiDb = new Database(path.join(DATA_DIR, 'wiki.db'), { readonly: true });

  const authUsers = authDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const forumUsers = forumsDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const wikiUsers = wikiDb.prepare('SELECT COUNT(*) as count FROM users').get().count;

  console.log(`  auth.db: ${authUsers} users`);
  console.log(`  forums.db: ${forumUsers} users`);
  console.log(`  wiki.db: ${wikiUsers} users`);

  // Check 3: Password Hash Consistency
  console.log('\n🔑 Checking password consistency...');
  const authUserData = authDb.prepare('SELECT username, password_hash FROM users').all();
  const forumUserData = forumsDb.prepare('SELECT username, password_hash FROM users').all();

  const authUserMap = new Map(authUserData.map(u => [u.username, u.password_hash]));
  const forumUserMap = new Map(forumUserData.map(u => [u.username, u.password_hash]));

  let mismatches = 0;
  let matches = 0;

  for (const [username, authHash] of authUserMap) {
    if (forumUserMap.has(username)) {
      const forumHash = forumUserMap.get(username);
      if (authHash !== forumHash) {
        mismatches++;
        console.log(`  ⚠️  Password mismatch: ${username}`);
      } else {
        matches++;
      }
    }
  }

  console.log(`  ✅ ${matches} users with consistent passwords`);
  if (mismatches > 0) {
    console.log(`  ❌ ${mismatches} users with MISMATCHED passwords (CRITICAL)`);
  }

  // Check 4: Active Sessions
  console.log('\n🔐 Analyzing active sessions...');
  const authSessions = authDb
    .prepare("SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > datetime('now')")
    .get().count;
  const forumSessions = forumsDb
    .prepare("SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > datetime('now')")
    .get().count;

  console.log(`  auth.db: ${authSessions} active sessions`);
  console.log(`  forums.db: ${forumSessions} active sessions`);

  // Check 5: Orphaned Sessions
  console.log('\n⚠️  Checking for orphaned sessions...');
  const orphanedAuthSessions = authDb
    .prepare(
      `
    SELECT COUNT(*) as count FROM user_sessions s
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)
  `
    )
    .get().count;

  const orphanedForumSessions = forumsDb
    .prepare(
      `
    SELECT COUNT(*) as count FROM user_sessions s
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)
  `
    )
    .get().count;

  if (orphanedAuthSessions > 0) {
    console.log(`  ❌ auth.db: ${orphanedAuthSessions} orphaned sessions (security risk)`);
  } else {
    console.log(`  ✅ auth.db: No orphaned sessions`);
  }

  if (orphanedForumSessions > 0) {
    console.log(`  ❌ forums.db: ${orphanedForumSessions} orphaned sessions (security risk)`);
  } else {
    console.log(`  ✅ forums.db: No orphaned sessions`);
  }

  // Check 6: User Permissions
  console.log('\n🛡️  Checking user permissions...');
  const authPermissions = authDb
    .prepare('SELECT COUNT(*) as count FROM user_permissions')
    .get().count;
  const forumPermissions = forumsDb
    .prepare('SELECT COUNT(*) as count FROM user_permissions')
    .get().count;

  console.log(`  auth.db: ${authPermissions} permission entries`);
  console.log(`  forums.db: ${forumPermissions} permission entries`);

  // Check 7: Weak Password Hashes
  console.log('\n🔒 Checking password hash strength...');
  const weakHashes = authDb
    .prepare(
      `
    SELECT COUNT(*) as count FROM users
    WHERE password_hash NOT LIKE '$2a$12%'
    AND password_hash NOT LIKE '$2b$12%'
    AND password_hash NOT LIKE '$2a$13%'
    AND password_hash NOT LIKE '$2b$13%'
    AND password_hash NOT LIKE '$2a$14%'
    AND password_hash NOT LIKE '$2b$14%'
  `
    )
    .get().count;

  if (weakHashes > 0) {
    console.log(`  ⚠️  ${weakHashes} users with weak password hashes (< bcrypt cost 12)`);
  } else {
    console.log(`  ✅ All users have strong password hashes`);
  }

  // Security Score Calculation
  console.log('\n📊 Security Risk Assessment');
  console.log('='.repeat(60));

  const risks = [];

  if (mismatches > 0) {
    risks.push({
      level: 'CRITICAL',
      issue: `${mismatches} password mismatches`,
      impact: 'Authentication bypass possible',
    });
  }

  if (orphanedAuthSessions > 0 || orphanedForumSessions > 0) {
    risks.push({
      level: 'HIGH',
      issue: 'Orphaned sessions detected',
      impact: 'Potential unauthorized access',
    });
  }

  if (weakHashes > 0) {
    risks.push({
      level: 'MEDIUM',
      issue: 'Weak password hashes',
      impact: 'Vulnerable to brute force',
    });
  }

  if (authUsers !== forumUsers) {
    risks.push({
      level: 'HIGH',
      issue: 'User count mismatch',
      impact: 'Data integrity compromised',
    });
  }

  if (risks.length === 0) {
    console.log('  ✅ No critical security issues detected');
  } else {
    console.log('  ⚠️  SECURITY ISSUES DETECTED:\n');
    risks.forEach(risk => {
      const icon = risk.level === 'CRITICAL' ? '🔴' : risk.level === 'HIGH' ? '🟠' : '🟡';
      console.log(`  ${icon} [${risk.level}] ${risk.issue}`);
      console.log(`     Impact: ${risk.impact}`);
    });
  }

  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('='.repeat(60));

  if (risks.some(r => r.level === 'CRITICAL')) {
    console.log('  🚨 IMMEDIATE ACTION REQUIRED:');
    console.log('     1. Run migration script immediately:');
    console.log('        node scripts/secure-user-migration.js --dry-run');
    console.log('     2. Backup all databases before migration');
    console.log('     3. Consider disabling authentication temporarily');
  } else if (risks.length > 0) {
    console.log('  ⚠️  RECOMMENDED ACTIONS:');
    console.log('     1. Schedule migration within 24 hours');
    console.log('     2. Monitor authentication logs');
    console.log('     3. Review user permissions');
  } else {
    console.log('  ✅ System appears secure');
    console.log('     - Continue monitoring');
    console.log('     - Consider migration for better architecture');
  }

  // Close databases
  authDb.close();
  forumsDb.close();
  wikiDb.close();
} catch (error) {
  console.error('\n❌ Error during validation:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('Validation complete. Check results above for security status.');
console.log('='.repeat(60) + '\n');
