#!/usr/bin/env node

/**
 * Comprehensive WAL Health Monitoring Script
 *
 * This script provides ongoing monitoring and management of WAL files
 * to prevent future production blockers.
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

class WALHealthMonitor {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.config = {
      maxWalSizeMB: 1,
      criticalWalSizeMB: 2,
      maxWalToDbRatio: 25,
      autoCheckpointPages: 500,
    };
  }

  async getWALStats(dbName = 'forums') {
    try {
      const dbPath = path.join(this.dataDir, `${dbName}.db`);
      const walPath = path.join(this.dataDir, `${dbName}.db-wal`);

      const [dbStat, walStat] = await Promise.all([
        fs.stat(dbPath).catch(() => null),
        fs.stat(walPath).catch(() => null),
      ]);

      if (!dbStat) {
        throw new Error(`Database file not found: ${dbName}.db`);
      }

      if (!walStat) {
        return {
          dbName,
          walExists: false,
          dbSizeMB: (dbStat.size / 1024 / 1024).toFixed(2),
          status: 'no_wal',
        };
      }

      const walSizeMB = walStat.size / 1024 / 1024;
      const dbSizeMB = dbStat.size / 1024 / 1024;
      const walToDbRatio = (walStat.size / dbStat.size) * 100;
      const ageMinutes = (Date.now() - walStat.mtime.getTime()) / (1000 * 60);

      let status = 'healthy';
      if (walSizeMB > this.config.criticalWalSizeMB || walToDbRatio > this.config.maxWalToDbRatio) {
        status = 'critical';
      } else if (walSizeMB > this.config.maxWalSizeMB) {
        status = 'warning';
      }

      return {
        dbName,
        walExists: true,
        walSizeMB: walSizeMB.toFixed(2),
        dbSizeMB: dbSizeMB.toFixed(2),
        walToDbRatio: walToDbRatio.toFixed(1),
        ageMinutes: ageMinutes.toFixed(1),
        lastModified: walStat.mtime.toISOString(),
        status,
      };
    } catch (error) {
      return {
        dbName,
        error: error.message,
        status: 'error',
      };
    }
  }

  async performCheckpoint(dbName = 'forums') {
    const dbPath = path.join(this.dataDir, `${dbName}.db`);

    let db;
    try {
      db = new Database(dbPath, { readonly: false });

      // Get initial stats
      const initialStats = await this.getWALStats(dbName);
      const initialWalSize = initialStats.walExists ? parseFloat(initialStats.walSizeMB) : 0;

      console.log(`\n🔧 Performing checkpoint for ${dbName}...`);
      console.log(`   Initial WAL size: ${initialWalSize.toFixed(2)}MB`);

      // Try TRUNCATE checkpoint for maximum effectiveness
      const result = db.pragma('wal_checkpoint(TRUNCATE)');
      const pagesCheckpointed = result[0]?.checkpointed || 0;

      // Get final stats
      const finalStats = await this.getWALStats(dbName);
      const finalWalSize = finalStats.walExists ? parseFloat(finalStats.walSizeMB) : 0;
      const reduction = initialWalSize - finalWalSize;

      console.log(`   ✅ Checkpoint complete: ${pagesCheckpointed} pages`);
      console.log(`   Final WAL size: ${finalWalSize.toFixed(2)}MB`);
      console.log(`   Size reduction: ${reduction.toFixed(2)}MB`);

      return {
        success: true,
        pagesCheckpointed,
        initialSizeMB: initialWalSize,
        finalSizeMB: finalWalSize,
        reductionMB: reduction,
      };
    } catch (error) {
      console.error(`   ❌ Checkpoint failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  async optimizeDatabase(dbName = 'forums') {
    const dbPath = path.join(this.dataDir, `${dbName}.db`);

    let db;
    try {
      db = new Database(dbPath, { readonly: false });

      console.log(`\n🛠️  Optimizing ${dbName} database...`);

      // Set optimal WAL configuration
      db.pragma(`wal_autocheckpoint = ${this.config.autoCheckpointPages}`);
      console.log(`   ✅ Auto-checkpoint set to ${this.config.autoCheckpointPages} pages`);

      // Verify integrity
      const integrityResult = db.pragma('integrity_check', { simple: true });
      if (integrityResult === 'ok') {
        console.log('   ✅ Database integrity verified');
      } else {
        console.error(`   ❌ Integrity issue: ${integrityResult}`);
        return { success: false, error: 'Database integrity issue' };
      }

      // Analyze database for optimization opportunities
      db.exec('ANALYZE');
      console.log('   ✅ Database statistics updated');

      return { success: true };
    } catch (error) {
      console.error(`   ❌ Optimization failed: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      if (db) {
        db.close();
      }
    }
  }

  async generateReport() {
    console.log('🔍 WAL Health Report');
    console.log('==================\n');

    const databases = ['forums']; // Add other databases as needed
    const report = {
      timestamp: new Date().toISOString(),
      databases: [],
      summary: {
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0,
        errors: 0,
      },
    };

    for (const dbName of databases) {
      const stats = await this.getWALStats(dbName);
      report.databases.push(stats);
      report.summary.total++;

      if (stats.status) {
        report.summary[stats.status]++;
      }

      // Print status
      const statusIcon = {
        healthy: '✅',
        warning: '⚠️ ',
        critical: '🚨',
        no_wal: '✅',
        error: '❌',
      };

      console.log(`${statusIcon[stats.status]} ${dbName.toUpperCase()}:`);

      if (stats.error) {
        console.log(`   Error: ${stats.error}`);
      } else if (stats.walExists) {
        console.log(
          `   WAL: ${stats.walSizeMB}MB (${stats.walToDbRatio}% of ${stats.dbSizeMB}MB DB)`
        );
        console.log(`   Age: ${stats.ageMinutes} minutes`);
        console.log(`   Last modified: ${stats.lastModified}`);

        if (stats.status === 'critical' || stats.status === 'warning') {
          console.log(`   🔧 Checkpoint recommended`);
        }
      } else {
        console.log(`   DB: ${stats.dbSizeMB}MB (no WAL file)`);
      }
      console.log();
    }

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   Total databases: ${report.summary.total}`);
    console.log(`   Healthy: ${report.summary.healthy + report.summary.no_wal}`);
    console.log(`   Warnings: ${report.summary.warning}`);
    console.log(`   Critical: ${report.summary.critical}`);
    console.log(`   Errors: ${report.summary.error}`);

    return report;
  }

  async runMaintenanceRoutine() {
    console.log('🔧 WAL Maintenance Routine');
    console.log('========================\n');

    const report = await this.generateReport();

    // Perform checkpoints for databases that need it
    for (const dbStats of report.databases) {
      if (dbStats.status === 'critical' || dbStats.status === 'warning') {
        await this.performCheckpoint(dbStats.dbName);
        await this.optimizeDatabase(dbStats.dbName);
      }
    }

    console.log('\n✅ Maintenance routine complete');

    // Final report
    console.log('\n📋 POST-MAINTENANCE REPORT:');
    await this.generateReport();
  }
}

// CLI Interface
async function main() {
  const monitor = new WALHealthMonitor();
  const command = process.argv[2] || 'report';

  switch (command) {
    case 'report':
      await monitor.generateReport();
      break;

    case 'checkpoint':
      const dbName = process.argv[3] || 'forums';
      await monitor.performCheckpoint(dbName);
      break;

    case 'optimize':
      const optimizeDbName = process.argv[3] || 'forums';
      await monitor.optimizeDatabase(optimizeDbName);
      break;

    case 'maintenance':
      await monitor.runMaintenanceRoutine();
      break;

    case 'help':
      console.log('WAL Health Monitor Commands:');
      console.log('  report                    - Generate health report (default)');
      console.log('  checkpoint [dbname]       - Force checkpoint for database');
      console.log('  optimize [dbname]         - Optimize database configuration');
      console.log('  maintenance               - Run full maintenance routine');
      console.log('  help                      - Show this help');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Use "help" for available commands');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { WALHealthMonitor };
