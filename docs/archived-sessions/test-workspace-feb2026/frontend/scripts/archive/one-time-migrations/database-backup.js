#!/usr/bin/env node

/**
 * Database Backup Strategy
 * Automated backup system for SQLite databases with rotation and compression
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Configuration
const CONFIG = {
  databases: [
    {
      name: 'forums',
      path: path.join(__dirname, '../data/forums.db'),
    },
    {
      name: 'library',
      path: path.join(__dirname, '../data/library.db'),
    },
    {
      name: 'wiki',
      path: path.join(__dirname, '../data/wiki.db'),
    },
    {
      name: 'users',
      path: path.join(__dirname, '../data/users.db'),
    },
    {
      name: 'auth',
      path: path.join(__dirname, '../data/auth.db'),
    },
    {
      name: 'messaging',
      path: path.join(__dirname, '../data/messaging.db'),
    },
    {
      name: 'system',
      path: path.join(__dirname, '../data/system.db'),
    },
    {
      name: 'content',
      path: path.join(__dirname, '../data/content.db'),
    },
  ],
  backupDir: path.join(__dirname, '../backups'),
  maxBackups: 30, // Keep last 30 backups
  dailyBackups: 7, // Keep daily backups for 7 days
  weeklyBackups: 4, // Keep weekly backups for 4 weeks
  monthlyBackups: 12, // Keep monthly backups for 12 months
  compress: true, // Compress backups with gzip
  encrypt: process.env.BACKUP_ENCRYPTION_KEY ? true : false,
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
};

class DatabaseBackup {
  constructor() {
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDirectory() {
    if (!fs.existsSync(CONFIG.backupDir)) {
      fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    }

    // Create subdirectories for different retention periods
    ['daily', 'weekly', 'monthly', 'manual'].forEach(dir => {
      const dirPath = path.join(CONFIG.backupDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * Create backup for all databases
   */
  async createBackup(type = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = [];

    for (const db of CONFIG.databases) {
      try {
        const result = await this.backupDatabase(db, timestamp, type);
        results.push(result);
      } catch (error) {
        console.error(`Failed to backup ${db.name}:`, error);
        results.push({
          database: db.name,
          success: false,
          error: error.message,
        });
      }
    }

    // Clean up old backups
    await this.rotateBackups();

    return results;
  }

  /**
   * Backup a single database
   */
  async backupDatabase(db, timestamp, type) {
    if (!fs.existsSync(db.path)) {
      throw new Error(`Database not found: ${db.path}`);
    }

    const backupName = `${db.name}_${timestamp}`;
    const backupPath = path.join(CONFIG.backupDir, type, backupName + '.db');

    console.log(`Creating backup: ${backupName}`);

    // Use SQLite backup command for consistency
    try {
      execSync(`sqlite3 "${db.path}" ".backup '${backupPath}'"`);
    } catch (error) {
      // Fallback to file copy if sqlite3 command not available
      fs.copyFileSync(db.path, backupPath);
    }

    // Verify backup integrity
    const originalSize = fs.statSync(db.path).size;
    const backupSize = fs.statSync(backupPath).size;

    if (backupSize === 0) {
      throw new Error('Backup file is empty');
    }

    // Generate checksum
    const checksum = await this.generateChecksum(backupPath);

    // Compress if enabled
    let finalPath = backupPath;
    if (CONFIG.compress) {
      finalPath = await this.compressBackup(backupPath);
    }

    // Encrypt if enabled
    if (CONFIG.encrypt) {
      finalPath = await this.encryptBackup(finalPath);
    }

    // Create metadata file
    const metadata = {
      database: db.name,
      timestamp,
      originalSize,
      backupSize,
      compressedSize: fs.statSync(finalPath).size,
      checksum,
      compressed: CONFIG.compress,
      encrypted: CONFIG.encrypt,
      type,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(finalPath + '.meta.json', JSON.stringify(metadata, null, 2));

    console.log(`Backup completed: ${path.basename(finalPath)}`);

    return {
      database: db.name,
      success: true,
      path: finalPath,
      metadata,
    };
  }

  /**
   * Compress backup file
   */
  async compressBackup(filePath) {
    const compressedPath = filePath + '.gz';
    const input = fs.readFileSync(filePath);
    const compressed = await gzip(input, { level: 9 });

    fs.writeFileSync(compressedPath, compressed);
    fs.unlinkSync(filePath); // Remove uncompressed file

    return compressedPath;
  }

  /**
   * Encrypt backup file
   */
  async encryptBackup(filePath) {
    if (!CONFIG.encryptionKey) {
      console.warn('Encryption key not set, skipping encryption');
      return filePath;
    }

    const encryptedPath = filePath + '.enc';
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(CONFIG.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(encryptedPath);

    // Write IV to the beginning of the file
    output.write(iv);

    input.pipe(cipher).pipe(output);

    await new Promise((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });

    const authTag = cipher.getAuthTag();
    fs.appendFileSync(encryptedPath, authTag);

    fs.unlinkSync(filePath); // Remove unencrypted file

    return encryptedPath;
  }

  /**
   * Generate checksum for backup verification
   */
  async generateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    await new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    return hash.digest('hex');
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupPath, targetDb) {
    console.log(`Restoring backup: ${backupPath}`);

    // Read metadata
    const metadataPath = backupPath + '.meta.json';
    let metadata = {};

    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    let workingPath = backupPath;

    // Decrypt if needed
    if (metadata.encrypted || backupPath.endsWith('.enc')) {
      workingPath = await this.decryptBackup(workingPath);
    }

    // Decompress if needed
    if (metadata.compressed || workingPath.endsWith('.gz')) {
      workingPath = await this.decompressBackup(workingPath);
    }

    // Verify checksum if available
    if (metadata.checksum) {
      const currentChecksum = await this.generateChecksum(workingPath);
      if (currentChecksum !== metadata.checksum) {
        throw new Error('Checksum verification failed');
      }
    }

    // Create backup of current database
    const currentBackupPath = targetDb + '.restore-backup';
    fs.copyFileSync(targetDb, currentBackupPath);

    try {
      // Restore the backup
      fs.copyFileSync(workingPath, targetDb);
      console.log('Backup restored successfully');

      // Clean up temporary files
      if (workingPath !== backupPath) {
        fs.unlinkSync(workingPath);
      }

      return { success: true, previousBackup: currentBackupPath };
    } catch (error) {
      // Restore original on failure
      fs.copyFileSync(currentBackupPath, targetDb);
      throw error;
    }
  }

  /**
   * Decompress backup file
   */
  async decompressBackup(filePath) {
    const decompressedPath = filePath.replace('.gz', '');
    const compressed = fs.readFileSync(filePath);
    const decompressed = await gunzip(compressed);

    fs.writeFileSync(decompressedPath, decompressed);
    return decompressedPath;
  }

  /**
   * Decrypt backup file
   */
  async decryptBackup(filePath) {
    if (!CONFIG.encryptionKey) {
      throw new Error('Encryption key required for decryption');
    }

    const decryptedPath = filePath.replace('.enc', '');
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(CONFIG.encryptionKey, 'salt', 32);

    const encrypted = fs.readFileSync(filePath);
    const iv = encrypted.slice(0, 16);
    const authTag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(16, -16);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    fs.writeFileSync(decryptedPath, decrypted);
    return decryptedPath;
  }

  /**
   * Rotate backups based on retention policy
   */
  async rotateBackups() {
    const now = new Date();

    // Process each retention directory
    for (const type of ['daily', 'weekly', 'monthly']) {
      const dirPath = path.join(CONFIG.backupDir, type);
      const files = fs
        .readdirSync(dirPath)
        .filter(f => !f.endsWith('.meta.json'))
        .map(f => ({
          name: f,
          path: path.join(dirPath, f),
          stats: fs.statSync(path.join(dirPath, f)),
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime);

      // Determine how many to keep
      let keepCount = CONFIG.maxBackups;
      if (type === 'daily') keepCount = CONFIG.dailyBackups;
      if (type === 'weekly') keepCount = CONFIG.weeklyBackups;
      if (type === 'monthly') keepCount = CONFIG.monthlyBackups;

      // Remove old backups
      files.slice(keepCount).forEach(file => {
        console.log(`Removing old backup: ${file.name}`);
        fs.unlinkSync(file.path);

        // Remove metadata file
        const metaPath = file.path + '.meta.json';
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      });
    }
  }

  /**
   * List all available backups
   */
  listBackups() {
    const backups = [];

    for (const type of ['daily', 'weekly', 'monthly', 'manual']) {
      const dirPath = path.join(CONFIG.backupDir, type);

      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => !f.endsWith('.meta.json'));

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        const metaPath = filePath + '.meta.json';

        let metadata = {};
        if (fs.existsSync(metaPath)) {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }

        backups.push({
          file,
          path: filePath,
          type,
          size: stats.size,
          created: stats.mtime,
          metadata,
        });
      });
    }

    return backups.sort((a, b) => b.created - a.created);
  }

  /**
   * Run scheduled backup (for cron)
   */
  async runScheduledBackup() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    let type = 'daily';

    // Weekly backup on Sundays
    if (dayOfWeek === 0) {
      type = 'weekly';
    }

    // Monthly backup on the 1st
    if (dayOfMonth === 1) {
      type = 'monthly';
    }

    console.log(`Running ${type} backup...`);
    return await this.createBackup(type);
  }
}

// CLI interface
if (require.main === module) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];

  switch (command) {
    case 'backup':
      backup
        .createBackup('manual')
        .then(results => {
          console.log('Backup results:', results);
          process.exit(0);
        })
        .catch(error => {
          console.error('Backup failed:', error);
          process.exit(1);
        });
      break;

    case 'scheduled':
      backup
        .runScheduledBackup()
        .then(results => {
          console.log('Scheduled backup results:', results);
          process.exit(0);
        })
        .catch(error => {
          console.error('Scheduled backup failed:', error);
          process.exit(1);
        });
      break;

    case 'list':
      const backups = backup.listBackups();
      console.log('Available backups:');
      backups.forEach(b => {
        console.log(`  ${b.type}/${b.file} (${(b.size / 1024 / 1024).toFixed(2)} MB)`);
      });
      break;

    case 'restore':
      const backupFile = process.argv[3];
      const targetDb = process.argv[4];

      if (!backupFile || !targetDb) {
        console.error('Usage: node database-backup.js restore <backup-file> <target-db>');
        process.exit(1);
      }

      backup
        .restoreBackup(backupFile, targetDb)
        .then(result => {
          console.log('Restore completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Restore failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  node database-backup.js backup     - Create manual backup');
      console.log('  node database-backup.js scheduled  - Run scheduled backup');
      console.log('  node database-backup.js list       - List available backups');
      console.log('  node database-backup.js restore <backup> <target> - Restore backup');
      process.exit(0);
  }
}

module.exports = DatabaseBackup;
