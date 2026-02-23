#!/usr/bin/env node

/**
 * Read Replica Setup Script
 *
 * Automates the setup and configuration of read replicas for the
 * Veritable Games database architecture.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, description) {
  log(`\n${colors.bright}${colors.blue}[${step}]${colors.reset} ${description}`);
}

function logSuccess(message) {
  log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logWarning(message) {
  log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logError(message) {
  log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

class ReadReplicaSetup {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.replicaDir = path.join(this.dataDir, 'replicas');
    this.databases = [
      'forums',
      'wiki',
      'users',
      'library',
      'system',
      'content',
      'auth',
      'messaging',
    ];
    this.config = {
      defaultSyncInterval: 30000,
      defaultPriority: 1,
      healthCheckInterval: 30000,
      maxReplicationLag: 1000,
    };
  }

  async run() {
    log(
      `${colors.bright}${colors.magenta}🔄 Read Replica Setup for Veritable Games${colors.reset}`
    );
    log('Setting up database read replicas for horizontal scaling...\n');

    try {
      logStep('1', 'Checking system requirements');
      await this.checkRequirements();

      logStep('2', 'Setting up replica directories');
      await this.setupDirectories();

      logStep('3', 'Verifying database files');
      await this.verifyDatabases();

      logStep('4', 'Installing replica dependencies');
      await this.installDependencies();

      logStep('5', 'Configuring environment variables');
      await this.configureEnvironment();

      logStep('6', 'Creating initial replica configuration');
      await this.createReplicaConfig();

      logStep('7', 'Testing replica system');
      await this.testReplicaSystem();

      log(`\n${colors.bright}${colors.green}🎉 Read replica setup complete!${colors.reset}\n`);

      this.printUsageInstructions();
    } catch (error) {
      logError(`Setup failed: ${error.message}`);
      process.exit(1);
    }
  }

  async checkRequirements() {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }
    logSuccess(`Node.js ${nodeVersion} (compatible)`);

    // Check if we're in the correct directory
    if (!fs.existsSync('package.json')) {
      throw new Error('Must be run from the project root directory');
    }
    logSuccess('Project root directory confirmed');

    // Check for required files
    const requiredFiles = [
      'src/lib/database/replica-pool.ts',
      'src/lib/services/BaseServiceWithReplicas.ts',
      'src/app/api/admin/database/replicas/route.ts',
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    logSuccess('All required replica system files found');

    // Check for sqlite3-rsync or similar tools
    try {
      execSync('which sqlite3', { stdio: 'pipe' });
      logSuccess('SQLite3 command line tool available');
    } catch (error) {
      logWarning('SQLite3 CLI not found - some replica features may be limited');
    }
  }

  async setupDirectories() {
    // Create replica directory structure
    if (!fs.existsSync(this.replicaDir)) {
      fs.mkdirSync(this.replicaDir, { recursive: true, mode: 0o755 });
      logSuccess('Created replica directory');
    } else {
      logSuccess('Replica directory already exists');
    }

    // Create subdirectories for each database
    for (const db of this.databases) {
      const dbReplicaDir = path.join(this.replicaDir, db);
      if (!fs.existsSync(dbReplicaDir)) {
        fs.mkdirSync(dbReplicaDir, { recursive: true, mode: 0o755 });
        log(`Created replica directory for ${db}`);
      }
    }

    // Create logs directory
    const logsDir = path.join(this.replicaDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });
      logSuccess('Created replica logs directory');
    }

    // Set proper permissions
    execSync(`chmod 755 ${this.replicaDir}`);
    logSuccess('Set proper directory permissions');
  }

  async verifyDatabases() {
    if (!fs.existsSync(this.dataDir)) {
      throw new Error(`Data directory not found: ${this.dataDir}`);
    }

    let foundDatabases = 0;
    for (const db of this.databases) {
      const dbPath = path.join(this.dataDir, `${db}.db`);
      if (fs.existsSync(dbPath)) {
        foundDatabases++;
        log(`Found ${db}.db (${this.formatFileSize(fs.statSync(dbPath).size)})`);
      } else {
        logWarning(`Database not found: ${db}.db`);
      }
    }

    if (foundDatabases === 0) {
      throw new Error('No database files found. Run database initialization first.');
    }

    logSuccess(`Verified ${foundDatabases}/${this.databases.length} database files`);
  }

  async installDependencies() {
    // Check if better-sqlite3 is installed
    try {
      require.resolve('better-sqlite3');
      logSuccess('better-sqlite3 already installed');
    } catch (error) {
      logInfo('Installing better-sqlite3...');
      execSync('npm install better-sqlite3', { stdio: 'inherit' });
      logSuccess('Installed better-sqlite3');
    }

    // Check for optional dependencies
    const optionalDeps = [{ name: 'sqlite3', description: 'SQLite CLI tools' }];

    for (const dep of optionalDeps) {
      try {
        require.resolve(dep.name);
        logSuccess(`${dep.name} available (${dep.description})`);
      } catch (error) {
        logInfo(`Optional: ${dep.name} not found (${dep.description})`);
      }
    }
  }

  async configureEnvironment() {
    const envPath = '.env.local';
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const replicaConfig = `
# ===== READ REPLICA CONFIGURATION =====
# Enable read replica functionality
READ_REPLICAS_ENABLED=true

# Default sync interval (milliseconds)
REPLICA_SYNC_INTERVAL=${this.config.defaultSyncInterval}

# Health check interval (milliseconds)
REPLICA_HEALTH_CHECK_INTERVAL=${this.config.healthCheckInterval}

# Maximum acceptable replication lag (milliseconds)
MAX_REPLICATION_LAG=${this.config.maxReplicationLag}

# Replica directory path
REPLICA_DATA_PATH=data/replicas

# Enable replica performance monitoring
REPLICA_MONITORING_ENABLED=true

# Automatic failover to primary on replica failure
REPLICA_AUTO_FAILOVER=true

# Log replica operations (development only)
REPLICA_DEBUG_LOGGING=${process.env.NODE_ENV === 'development' ? 'true' : 'false'}
`;

    // Check if replica config already exists
    if (envContent.includes('READ_REPLICAS_ENABLED')) {
      logSuccess('Read replica configuration already present in .env.local');
    } else {
      // Append replica configuration
      const updatedContent = envContent + replicaConfig;
      fs.writeFileSync(envPath, updatedContent);
      logSuccess('Added read replica configuration to .env.local');
    }
  }

  async createReplicaConfig() {
    const configPath = path.join(this.replicaDir, 'replica-config.json');

    const replicaConfig = {
      version: '1.0.0',
      created: new Date().toISOString(),
      databases: this.databases.map(db => ({
        name: db,
        enabled: true,
        replicas: [],
        maxReplicas: 3,
        syncInterval: this.config.defaultSyncInterval,
        priority: this.config.defaultPriority,
      })),
      global: {
        healthCheckInterval: this.config.healthCheckInterval,
        maxReplicationLag: this.config.maxReplicationLag,
        autoFailover: true,
        monitoring: true,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(replicaConfig, null, 2));
    logSuccess('Created replica configuration file');

    // Create sample replica for forums (most likely to need scaling)
    await this.createSampleReplica();
  }

  async createSampleReplica() {
    const forumsDbPath = path.join(this.dataDir, 'forums.db');

    if (!fs.existsSync(forumsDbPath)) {
      logWarning('Forums database not found, skipping sample replica creation');
      return;
    }

    const sampleReplicaPath = path.join(this.replicaDir, 'forums', 'forums_sample.db');

    try {
      // Create a sample replica by copying the forums database
      fs.copyFileSync(forumsDbPath, sampleReplicaPath);

      // Set read-only permissions
      fs.chmodSync(sampleReplicaPath, 0o444);

      logSuccess('Created sample replica for forums database');
      logInfo('This replica is for testing only and is not automatically synchronized');
    } catch (error) {
      logWarning(`Failed to create sample replica: ${error.message}`);
    }
  }

  async testReplicaSystem() {
    logInfo('Testing replica system components...');

    try {
      // Test that replica pool can be imported
      const { enhancedDbPool } = require('../src/lib/database/replica-pool');
      logSuccess('Enhanced database pool loaded successfully');

      // Test BaseServiceWithReplicas
      const { BaseServiceWithReplicas } = require('../src/lib/services/BaseServiceWithReplicas');
      logSuccess('BaseServiceWithReplicas loaded successfully');

      // Test configuration loading
      const stats = enhancedDbPool.getStats();
      logSuccess(`Database pool initialized: ${stats.connections.total} total connections`);
    } catch (error) {
      logError(`Component test failed: ${error.message}`);
      throw error;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  printUsageInstructions() {
    log(`${colors.bright}Next Steps:${colors.reset}`);
    log(`${colors.cyan}  1. Restart your development server: npm run dev${colors.reset}`);
    log(`${colors.cyan}  2. Access admin dashboard: http://localhost:3000/admin${colors.reset}`);
    log(`${colors.cyan}  3. Navigate to Database Replicas section${colors.reset}`);
    log(`${colors.cyan}  4. Add your first production replica using the dashboard${colors.reset}`);

    log(`\n${colors.bright}Available Commands:${colors.reset}`);
    log(`${colors.cyan}  npm run replica:status    ${colors.reset}# Check replica health`);
    log(`${colors.cyan}  npm run replica:add       ${colors.reset}# Add new replica interactively`);
    log(`${colors.cyan}  npm run replica:remove    ${colors.reset}# Remove replica interactively`);
    log(`${colors.cyan}  npm run replica:sync      ${colors.reset}# Force sync all replicas`);

    log(`\n${colors.bright}Configuration Files:${colors.reset}`);
    log(`${colors.yellow}  .env.local                ${colors.reset}# Environment configuration`);
    log(`${colors.yellow}  data/replicas/replica-config.json ${colors.reset}# Replica settings`);
    log(`${colors.yellow}  data/replicas/logs/       ${colors.reset}# Replica operation logs`);

    log(`\n${colors.bright}Important Notes:${colors.reset}`);
    log(
      `${colors.yellow}  • Read replicas increase read capacity but not write capacity${colors.reset}`
    );
    log(`${colors.yellow}  • Start with forums database (highest read load)${colors.reset}`);
    log(`${colors.yellow}  • Monitor replication lag to ensure data consistency${colors.reset}`);
    log(`${colors.yellow}  • Use health dashboard to track replica performance${colors.reset}`);

    log(`\n${colors.bright}Production Considerations:${colors.reset}`);
    log(`${colors.red}  • Use sqlite3-rsync for production replication${colors.reset}`);
    log(`${colors.red}  • Set up monitoring alerts for replica failures${colors.reset}`);
    log(`${colors.red}  • Test failover procedures regularly${colors.reset}`);
    log(`${colors.red}  • Consider geographic distribution for global users${colors.reset}`);
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new ReadReplicaSetup();
  setup.run().catch(console.error);
}

module.exports = ReadReplicaSetup;
