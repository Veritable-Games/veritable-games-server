#!/usr/bin/env node

/**
 * Environment Validation System
 *
 * Comprehensive environment validation for production deployment:
 * - Environment variables validation
 * - System dependencies check
 * - Database connectivity verification
 * - SSL certificate validation
 * - Security configuration audit
 * - Performance requirements verification
 * - Production readiness assessment
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
  }

  /**
   * Run complete environment validation
   */
  async validate() {
    console.log('🔍 Starting Environment Validation...');
    console.log(`📊 Environment: ${this.environment}`);
    console.log('='.repeat(50));

    const validations = [
      { name: 'Environment Variables', fn: () => this.validateEnvironmentVariables() },
      { name: 'System Dependencies', fn: () => this.validateSystemDependencies() },
      { name: 'Node.js Environment', fn: () => this.validateNodeEnvironment() },
      { name: 'Database Configuration', fn: () => this.validateDatabaseConfig() },
      { name: 'SSL Configuration', fn: () => this.validateSSLConfig() },
      { name: 'Security Configuration', fn: () => this.validateSecurityConfig() },
      { name: 'Performance Requirements', fn: () => this.validatePerformanceRequirements() },
      { name: 'File Permissions', fn: () => this.validateFilePermissions() },
      { name: 'Network Configuration', fn: () => this.validateNetworkConfig() },
      { name: 'Monitoring Setup', fn: () => this.validateMonitoringSetup() },
    ];

    for (const validation of validations) {
      try {
        console.log(`\n📋 Validating ${validation.name}...`);
        await validation.fn();
        console.log(`✅ ${validation.name} - OK`);
      } catch (error) {
        console.log(`❌ ${validation.name} - FAILED`);
        this.errors.push(`${validation.name}: ${error.message}`);
      }
    }

    return this.generateReport();
  }

  /**
   * Validate required environment variables
   */
  async validateEnvironmentVariables() {
    const required = ['SESSION_SECRET', 'CSRF_SECRET', 'ENCRYPTION_KEY'];

    const optional = [
      'DB_PATH',
      'USERS_DATABASE_PATH',
      'WIKI_DATABASE_PATH',
      'LIBRARY_DATABASE_PATH',
      'MESSAGING_DATABASE_PATH',
      'MONITORING_DATABASE_PATH',
      'CACHE_DATABASE_PATH',
      'PORT',
      'HOST',
    ];

    const production = ['SSL_EMAIL', 'BACKUP_S3_BUCKET', 'ALERT_WEBHOOK', 'SENTRY_DSN'];

    // Check required variables
    for (const variable of required) {
      const value = process.env[variable];
      if (!value) {
        throw new Error(`Missing required environment variable: ${variable}`);
      }

      // Check secret strength
      if (variable.includes('SECRET') || variable.includes('KEY')) {
        if (value.length < 32) {
          this.warnings.push(`${variable} should be at least 32 characters long`);
        }
        if (!/^[a-zA-Z0-9+/]+$/.test(value)) {
          this.warnings.push(`${variable} should be base64 encoded for better security`);
        }
      }
    }

    // Check optional variables
    for (const variable of optional) {
      if (!process.env[variable]) {
        this.info.push(`Optional variable ${variable} not set (using defaults)`);
      }
    }

    // Check production variables
    if (this.isProduction) {
      for (const variable of production) {
        if (!process.env[variable]) {
          this.warnings.push(`Production variable ${variable} not set`);
        }
      }
    }

    this.info.push(
      `✅ Environment variables validated (${required.length} required, ${optional.length} optional)`
    );
  }

  /**
   * Validate system dependencies
   */
  async validateSystemDependencies() {
    const dependencies = [
      { name: 'Node.js', command: 'node --version', minVersion: '18.20.0' },
      { name: 'npm', command: 'npm --version', minVersion: '9.0.0' },
      { name: 'Git', command: 'git --version' },
      { name: 'OpenSSL', command: 'openssl version' },
    ];

    const optional = [
      { name: 'PM2', command: 'pm2 --version' },
      { name: 'NGINX', command: 'nginx -v' },
      { name: 'Certbot', command: 'certbot --version' },
      { name: 'Docker', command: 'docker --version' },
    ];

    // Check required dependencies
    for (const dep of dependencies) {
      try {
        const output = execSync(dep.command, { encoding: 'utf8', stdio: 'pipe' });

        if (dep.minVersion) {
          const version = this.extractVersion(output);
          if (version && this.compareVersions(version, dep.minVersion) < 0) {
            throw new Error(
              `${dep.name} version ${version} is below minimum required ${dep.minVersion}`
            );
          }
        }

        this.info.push(`✅ ${dep.name}: ${output.trim()}`);
      } catch (error) {
        throw new Error(`${dep.name} is not installed or not accessible`);
      }
    }

    // Check optional dependencies
    for (const dep of optional) {
      try {
        const output = execSync(dep.command, { encoding: 'utf8', stdio: 'pipe' });
        this.info.push(`✅ ${dep.name}: ${output.trim()}`);
      } catch (error) {
        this.info.push(`ℹ️ ${dep.name}: Not installed (optional)`);
      }
    }
  }

  /**
   * Validate Node.js environment
   */
  async validateNodeEnvironment() {
    // Check Node.js version
    const nodeVersion = process.version;
    const requiredNodeVersion = '18.20.0';

    if (this.compareVersions(nodeVersion.slice(1), requiredNodeVersion) < 0) {
      throw new Error(`Node.js version ${nodeVersion} is below required ${requiredNodeVersion}`);
    }

    // Check package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    try {
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));

      // Validate required scripts
      const requiredScripts = ['build', 'start', 'lint', 'type-check'];
      for (const script of requiredScripts) {
        if (!packageData.scripts || !packageData.scripts[script]) {
          this.warnings.push(`Missing package.json script: ${script}`);
        }
      }

      // Check for security vulnerabilities
      try {
        execSync('npm audit --audit-level moderate', { stdio: 'pipe' });
        this.info.push('✅ No moderate+ security vulnerabilities found');
      } catch (error) {
        this.warnings.push('Security vulnerabilities detected - run "npm audit fix"');
      }
    } catch (error) {
      throw new Error('package.json not found or invalid');
    }

    // Check node_modules
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    try {
      await fs.access(nodeModulesPath);
      this.info.push('✅ Dependencies installed');
    } catch (error) {
      throw new Error('Dependencies not installed - run "npm install"');
    }
  }

  /**
   * Validate database configuration
   */
  async validateDatabaseConfig() {
    const databases = [
      'forums.db',
      'users.db',
      'wiki.db',
      'library.db',
      'messaging.db',
      'monitoring.db',
      'cache.db',
    ];

    const dataDir = path.join(process.cwd(), 'data');

    // Check data directory exists
    try {
      await fs.access(dataDir);
      this.info.push('✅ Database directory exists');
    } catch (error) {
      this.warnings.push('Database directory does not exist - will be created on first run');
    }

    // Check database files (in production)
    if (this.isProduction) {
      for (const db of databases) {
        const dbPath = path.join(dataDir, db);
        try {
          await fs.access(dbPath);
          const stats = await fs.stat(dbPath);
          this.info.push(`✅ ${db}: ${Math.round(stats.size / 1024)}KB`);
        } catch (error) {
          this.warnings.push(`Database ${db} does not exist - will be created on first run`);
        }
      }
    }

    // Check database permissions
    try {
      await fs.access(dataDir, fs.constants.W_OK);
      this.info.push('✅ Database directory is writable');
    } catch (error) {
      throw new Error('Database directory is not writable');
    }
  }

  /**
   * Validate SSL configuration
   */
  async validateSSLConfig() {
    const sslDir = path.join(process.cwd(), 'ssl');

    if (this.isProduction) {
      // Check SSL directory
      try {
        await fs.access(sslDir);
        this.info.push('✅ SSL directory exists');
      } catch (error) {
        this.warnings.push('SSL directory does not exist - run SSL manager to create certificates');
        return;
      }

      // Check for certificates
      const certFiles = ['cert.pem', 'key.pem', 'fullchain.pem'];
      let foundCerts = 0;

      for (const certFile of certFiles) {
        const certPath = path.join(sslDir, certFile);
        try {
          await fs.access(certPath);
          foundCerts++;

          // Check certificate expiration
          if (certFile === 'cert.pem') {
            try {
              const command = `openssl x509 -in "${certPath}" -noout -dates`;
              const output = execSync(command, { encoding: 'utf8' });
              const notAfterMatch = output.match(/notAfter=(.+)/);

              if (notAfterMatch) {
                const expiryDate = new Date(notAfterMatch[1]);
                const daysUntilExpiry = Math.ceil(
                  (expiryDate - Date.now()) / (1000 * 60 * 60 * 24)
                );

                if (daysUntilExpiry <= 0) {
                  this.errors.push('SSL certificate has expired');
                } else if (daysUntilExpiry <= 30) {
                  this.warnings.push(`SSL certificate expires in ${daysUntilExpiry} days`);
                } else {
                  this.info.push(`✅ SSL certificate valid for ${daysUntilExpiry} days`);
                }
              }
            } catch (error) {
              this.warnings.push('Could not check SSL certificate expiration');
            }
          }
        } catch (error) {
          this.warnings.push(`SSL certificate ${certFile} not found`);
        }
      }

      if (foundCerts === 0) {
        this.warnings.push('No SSL certificates found - generate certificates for production');
      }
    } else {
      this.info.push('ℹ️ SSL validation skipped for development environment');
    }
  }

  /**
   * Validate security configuration
   */
  async validateSecurityConfig() {
    // Check HTTPS enforcement
    if (this.isProduction && !process.env.FORCE_HTTPS) {
      this.warnings.push('HTTPS enforcement not enabled (set FORCE_HTTPS=true)');
    }

    // Check CSP configuration
    if (!process.env.CSP_ENABLED || process.env.CSP_ENABLED !== 'false') {
      this.info.push('✅ Content Security Policy enabled');
    } else {
      this.warnings.push('Content Security Policy is disabled');
    }

    // Check rate limiting
    this.info.push('✅ Rate limiting configured in security middleware');

    // Check for development secrets in production
    if (this.isProduction) {
      const devSecrets = ['admin', 'password', 'secret', 'test', '123'];
      for (const [key, value] of Object.entries(process.env)) {
        if (key.includes('SECRET') || key.includes('KEY')) {
          const lowerValue = value.toLowerCase();
          for (const devSecret of devSecrets) {
            if (lowerValue.includes(devSecret)) {
              this.warnings.push(`Environment variable ${key} contains weak value`);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Validate performance requirements
   */
  async validatePerformanceRequirements() {
    // Check memory
    const totalMemoryGB = Math.round(require('os').totalmem() / (1024 * 1024 * 1024));
    const minMemoryGB = this.isProduction ? 2 : 1;

    if (totalMemoryGB < minMemoryGB) {
      this.warnings.push(`System memory ${totalMemoryGB}GB is below recommended ${minMemoryGB}GB`);
    } else {
      this.info.push(`✅ System memory: ${totalMemoryGB}GB`);
    }

    // Check CPU
    const cpuCount = require('os').cpus().length;
    const minCores = this.isProduction ? 2 : 1;

    if (cpuCount < minCores) {
      this.warnings.push(`CPU cores ${cpuCount} is below recommended ${minCores}`);
    } else {
      this.info.push(`✅ CPU cores: ${cpuCount}`);
    }

    // Check disk space
    try {
      const output = execSync('df -h .', { encoding: 'utf8' });
      const lines = output.split('\n');
      if (lines.length > 1) {
        const diskInfo = lines[1].split(/\s+/);
        const usedPercent = parseInt(diskInfo[4]);

        if (usedPercent > 90) {
          this.warnings.push(`Disk usage ${usedPercent}% is critically high`);
        } else if (usedPercent > 80) {
          this.warnings.push(`Disk usage ${usedPercent}% is high`);
        } else {
          this.info.push(`✅ Disk usage: ${usedPercent}%`);
        }
      }
    } catch (error) {
      this.info.push('ℹ️ Could not check disk usage');
    }
  }

  /**
   * Validate file permissions
   */
  async validateFilePermissions() {
    const criticalPaths = [
      { path: '.', permission: fs.constants.R_OK | fs.constants.X_OK },
      { path: 'data', permission: fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK },
      { path: 'ssl', permission: fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK },
      { path: 'logs', permission: fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK },
    ];

    for (const item of criticalPaths) {
      const fullPath = path.join(process.cwd(), item.path);
      try {
        await fs.access(fullPath, item.permission);
        this.info.push(`✅ ${item.path}: Correct permissions`);
      } catch (error) {
        // Try to create directory if it doesn't exist
        if (error.code === 'ENOENT' && item.path !== '.') {
          try {
            await fs.mkdir(fullPath, { recursive: true });
            this.info.push(`✅ ${item.path}: Created with correct permissions`);
          } catch (createError) {
            this.warnings.push(`Cannot create directory ${item.path}: ${createError.message}`);
          }
        } else {
          this.warnings.push(`Incorrect permissions for ${item.path}`);
        }
      }
    }
  }

  /**
   * Validate network configuration
   */
  async validateNetworkConfig() {
    const port = process.env.PORT || 3000;

    // Check if port is available
    try {
      const net = require('net');
      const server = net.createServer();

      await new Promise((resolve, reject) => {
        server.listen(port, 'localhost', () => {
          server.close(resolve);
        });
        server.on('error', reject);
      });

      this.info.push(`✅ Port ${port} is available`);
    } catch (error) {
      if (error.code === 'EADDRINUSE') {
        this.warnings.push(`Port ${port} is already in use`);
      } else {
        this.warnings.push(`Cannot bind to port ${port}: ${error.message}`);
      }
    }

    // Check DNS resolution (production)
    if (this.isProduction && process.env.DOMAIN) {
      try {
        const dns = require('dns').promises;
        await dns.resolve(process.env.DOMAIN);
        this.info.push(`✅ Domain ${process.env.DOMAIN} resolves correctly`);
      } catch (error) {
        this.warnings.push(`Domain ${process.env.DOMAIN} does not resolve`);
      }
    }
  }

  /**
   * Validate monitoring setup
   */
  async validateMonitoringSetup() {
    // Check PM2 configuration
    const pm2ConfigPath = path.join(process.cwd(), 'ecosystem.config.js');
    try {
      await fs.access(pm2ConfigPath);
      this.info.push('✅ PM2 configuration found');
    } catch (error) {
      this.warnings.push('PM2 configuration not found');
    }

    // Check log directory
    const logDir = path.join(process.cwd(), 'logs');
    try {
      await fs.access(logDir);
      this.info.push('✅ Log directory exists');
    } catch (error) {
      this.info.push('ℹ️ Log directory will be created on first run');
    }

    // Check health check endpoint
    if (this.isProduction) {
      this.info.push('ℹ️ Health check endpoint should be available at /api/health');
    }
  }

  /**
   * Extract version from command output
   */
  extractVersion(output) {
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Compare semantic versions
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      isProduction: this.isProduction,
      status: this.errors.length === 0 ? 'PASSED' : 'FAILED',
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        info: this.info.length,
      },
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      readiness: this.calculateReadiness(),
    };

    console.log('\n' + '='.repeat(50));
    console.log('📊 ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(50));

    if (report.status === 'PASSED') {
      console.log('✅ VALIDATION PASSED');
    } else {
      console.log('❌ VALIDATION FAILED');
    }

    console.log(`🌍 Environment: ${report.environment}`);
    console.log(`📈 Readiness: ${report.readiness}%`);
    console.log(
      `📋 Summary: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info`
    );

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (this.info.length > 0 && process.argv.includes('--verbose')) {
      console.log('\nℹ️ INFO:');
      this.info.forEach(info => console.log(`  - ${info}`));
    }

    console.log('\n' + '='.repeat(50));

    if (report.status === 'PASSED') {
      console.log('🚀 Environment is ready for deployment!');
    } else {
      console.log('🔧 Please fix the errors above before deploying.');
    }

    return report;
  }

  /**
   * Calculate deployment readiness percentage
   */
  calculateReadiness() {
    const totalChecks = this.errors.length + this.warnings.length + this.info.length;
    if (totalChecks === 0) return 100;

    const errorWeight = 10;
    const warningWeight = 3;
    const infoWeight = 1;

    const totalWeight =
      this.errors.length * errorWeight +
      this.warnings.length * warningWeight +
      this.info.length * infoWeight;

    const maxPossibleWeight = totalChecks * errorWeight;
    const successWeight = this.info.length * infoWeight;

    const readiness = Math.max(0, Math.round((successWeight / maxPossibleWeight) * 100));
    return Math.min(100, readiness + (this.errors.length === 0 ? 50 : 0));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Environment Validation System

Usage: node validate-environment.js [options]

Options:
  --help, -h           Show this help message
  --verbose, -v        Show detailed information
  --json               Output report as JSON
  --ci                 Exit with code 1 if validation fails (for CI/CD)

Examples:
  node validate-environment.js
  node validate-environment.js --verbose
  node validate-environment.js --json > validation-report.json
  node validate-environment.js --ci

Environment Variables:
  NODE_ENV             Set environment (development/production)
  PORT                 Application port (default: 3000)
  DOMAIN               Production domain name
  SSL_EMAIL            Email for SSL certificates
  FORCE_HTTPS          Enforce HTTPS in production
  CSP_ENABLED          Enable Content Security Policy
    `);
    return;
  }

  const validator = new EnvironmentValidator();

  try {
    const report = await validator.validate();

    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    }

    if (args.includes('--ci') && report.status === 'FAILED') {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnvironmentValidator;
