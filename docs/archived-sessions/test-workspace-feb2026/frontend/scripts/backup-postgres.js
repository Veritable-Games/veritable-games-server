#!/usr/bin/env node

/**
 * PostgreSQL Database Backup Script
 *
 * Creates a backup of the PostgreSQL production database using pg_dump
 * - Full database backup
 * - Compressed format for storage efficiency
 * - Schema-specific backups available
 */

require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function createPostgresBackup() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL or POSTGRES_URL not configured');
    console.error('   Set these in .env.local or environment variables');
    process.exit(1);
  }

  console.log('💾 PostgreSQL Database Backup Tool\n');
  console.log('Database:', databaseUrl.split('@')[1] || 'localhost');
  console.log('');

  // Create backup directory
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    console.log('📁 Creating backups directory...');
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✅ Directory created: ${backupDir}`);
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(backupDir, `veritable-games-backup-${timestamp}.sql.gz`);

  try {
    console.log('\n🔄 Starting backup...');
    console.log(`📝 Output file: ${backupFile}`);

    // Use pg_dump to backup the database
    // Note: PASSWORD can be provided via PGPASSWORD environment variable
    const command = `pg_dump --dbname "${databaseUrl}" --compress=9 --file="${backupFile}" --verbose`;

    // Show progress
    console.log('\n⏳ Backing up database (this may take a moment)...');
    const startTime = Date.now();

    execSync(command, {
      stdio: 'inherit',
      env: process.env,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = fs.statSync(backupFile);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Backup completed successfully!');
    console.log('='.repeat(70));
    console.log(`\n📊 Backup Statistics:`);
    console.log(`   File: ${path.basename(backupFile)}`);
    console.log(`   Size: ${sizeInMB} MB (compressed)`);
    console.log(`   Duration: ${duration} seconds`);
    console.log(`   Location: ${backupDir}`);

    // List recent backups
    console.log('\n📋 Recent Backups:');
    const files = fs
      .readdirSync(backupDir)
      .filter(f => f.startsWith('veritable-games-backup-'))
      .sort()
      .reverse()
      .slice(0, 5);

    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   - ${file} (${sizeInMB} MB)`);
    });

    console.log('\n💡 To restore this backup:');
    console.log(`   gunzip -c "${backupFile}" | psql --dbname "<database>" --username <user>`);
    console.log('');
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);

    if (error.message.includes('pg_dump: command not found')) {
      console.error('   PostgreSQL client tools (pg_dump) not installed');
      console.error('   Install with: apt-get install postgresql-client (Ubuntu/Debian)');
      console.error('   or: brew install postgresql (macOS)');
    } else if (error.message.includes('authentication failed')) {
      console.error('   Authentication failed - check DATABASE_URL credentials');
    } else if (error.message.includes('could not connect')) {
      console.error('   Could not connect to database server');
      console.error('   Check DATABASE_URL and network connectivity');
    }

    process.exit(1);
  }
}

// Run the script
createPostgresBackup();
