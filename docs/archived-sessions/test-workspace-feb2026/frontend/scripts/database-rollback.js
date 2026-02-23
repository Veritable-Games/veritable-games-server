#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('DATABASE ROLLBACK UTILITY');
console.log('='.repeat(80));

// Find latest backup
function findLatestBackup(dbName) {
  const backupDir = path.join(__dirname, '..', 'data', 'backups');

  if (!fs.existsSync(backupDir)) {
    console.error('❌ No backup directory found');
    return null;
  }

  const files = fs.readdirSync(backupDir);
  const backups = files.filter(f => f.startsWith(`${dbName}.backup.`));

  if (backups.length === 0) {
    console.error(`❌ No backups found for ${dbName}`);
    return null;
  }

  // Sort by timestamp (newest first)
  backups.sort().reverse();
  return path.join(backupDir, backups[0]);
}

// Rollback a database
function rollbackDatabase(dbName) {
  const backupPath = findLatestBackup(dbName);

  if (!backupPath) {
    return false;
  }

  const dbPath = path.join(__dirname, '..', 'data', dbName);

  try {
    // Create a copy of current state before rollback
    const currentBackup = `${dbPath}.before_rollback.${Date.now()}`;
    fs.copyFileSync(dbPath, currentBackup);
    console.log(`✅ Current state saved to: ${path.basename(currentBackup)}`);

    // Perform rollback
    fs.copyFileSync(backupPath, dbPath);
    console.log(`✅ Rolled back ${dbName} from: ${path.basename(backupPath)}`);

    return true;
  } catch (error) {
    console.error(`❌ Failed to rollback ${dbName}: ${error.message}`);
    return false;
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node database-rollback.js [database-name|all]

Examples:
  node database-rollback.js library.db    # Rollback only library.db
  node database-rollback.js all           # Rollback all databases

Available backups:
`);

  const backupDir = path.join(__dirname, '..', 'data', 'backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    ['auth.db', 'forums.db', 'wiki.db', 'library.db'].forEach(db => {
      const backups = files.filter(f => f.startsWith(`${db}.backup.`));
      if (backups.length > 0) {
        console.log(`  ${db}: ${backups.length} backup(s), latest: ${backups.sort().reverse()[0]}`);
      }
    });
  }
} else if (args[0] === 'all') {
  console.log('\nRolling back all databases...\n');

  ['auth.db', 'forums.db', 'wiki.db', 'library.db'].forEach(db => {
    console.log(`Processing ${db}...`);
    rollbackDatabase(db);
    console.log();
  });

  console.log('✅ Rollback complete');
} else {
  const dbName = args[0];
  console.log(`\nRolling back ${dbName}...\n`);

  if (rollbackDatabase(dbName)) {
    console.log('\n✅ Rollback complete');
  } else {
    console.log('\n❌ Rollback failed');
    process.exit(1);
  }
}

console.log('\n' + '='.repeat(80));
