#!/usr/bin/env node

/**
 * Setup Gallery Cleanup Cron Job
 *
 * This script helps set up automatic nightly cleanup of soft-deleted gallery images.
 *
 * Usage:
 *   node setup-gallery-cleanup-cron.js [days]
 *
 * Examples:
 *   node setup-gallery-cleanup-cron.js          # Setup with 30-day threshold
 *   node setup-gallery-cleanup-cron.js 7        # Setup with 7-day threshold
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const days = Math.max(1, parseInt(args[0]) || 30);
const projectRoot = path.resolve(__dirname, '..');

console.log('================================================================================');
console.log('Gallery Cleanup Cron Job Setup');
console.log('================================================================================');
console.log('');

// 1. Show current setup
console.log('📋 Current Configuration:');
console.log(`  Days threshold: ${days} days`);
console.log(`  Project root: ${projectRoot}`);
console.log('');

// 2. Show cron entry
const cronEntry = `0 2 * * * cd ${projectRoot} && node scripts/migrations/cleanup-old-deleted-images.js --execute --days ${days} >> logs/gallery-cleanup.log 2>&1`;
console.log('📝 Cron Entry to Add:');
console.log('');
console.log('  ' + cronEntry);
console.log('');

// 3. Show what it does
console.log('⏰ Schedule: Every day at 2:00 AM');
console.log('');

console.log('📋 What It Does:');
console.log(`  • Finds images soft-deleted more than ${days} days ago`);
console.log('  • Removes files from disk');
console.log('  • Removes database records');
console.log('  • Frees disk space');
console.log('  • Logs results to logs/gallery-cleanup.log');
console.log('');

// 4. Show setup instructions
console.log('🔧 Setup Instructions:');
console.log('');
console.log('Option 1: Using crontab (Linux/macOS)');
console.log('  1. Open crontab editor:');
console.log('     crontab -e');
console.log('');
console.log('  2. Paste this line at the end:');
console.log('     ' + cronEntry);
console.log('');
console.log('  3. Save and exit (Ctrl+O, Enter, Ctrl+X for nano)');
console.log('');

console.log('Option 2: Using systemd timer (Linux)');
console.log('  See docs/guides/DELETE_UI_PATTERNS.md for detailed instructions');
console.log('');

console.log('Option 3: Using node-schedule (Node.js)');
console.log('  Add to your server startup code:');
console.log('    const schedule = require("node-schedule");');
console.log(`    schedule.scheduleJob("0 2 * * *", () => {`);
console.log(`      require("child_process").execSync(\`npm run gallery:cleanup\`);`);
console.log('    });');
console.log('');

// 5. Show test commands
console.log('✅ Test Commands:');
console.log('');
console.log('  Preview cleanup (dry-run):');
console.log('    npm run gallery:cleanup:dry-run');
console.log('');
console.log('  Execute cleanup (30 days):');
console.log('    npm run gallery:cleanup');
console.log('');
console.log('  Aggressive cleanup (7 days):');
console.log('    npm run gallery:cleanup:aggressive');
console.log('');

// 6. Create logs directory if it doesn't exist
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`📁 Created logs directory: ${logsDir}`);
  console.log('');
}

// 7. Show verification
console.log('✨ After Setup:');
console.log('');
console.log('  Verify cron was added:');
console.log('    crontab -l | grep gallery');
console.log('');
console.log('  Monitor logs:');
console.log('    tail -f logs/gallery-cleanup.log');
console.log('');
console.log('  Check cron job status (systemctl):');
console.log('    systemctl status cron');
console.log('');

console.log('================================================================================');
console.log('ℹ️  For more information, see:');
console.log('  • docs/features/GALLERY_DELETE_STRATEGY.md');
console.log('  • docs/guides/DELETE_UI_PATTERNS.md');
console.log('================================================================================');
console.log('');
