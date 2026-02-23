#!/usr/bin/env node

/**
 * Development Environment Doctor
 *
 * Diagnoses common development environment issues and provides
 * actionable recommendations for fixes.
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
  log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function execCommand(command, silent = true) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    }).trim();
  } catch (error) {
    return null;
  }
}

class DevDoctor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
  }

  addIssue(message, fix) {
    this.issues.push({ message, fix });
  }

  addWarning(message, suggestion) {
    this.warnings.push({ message, suggestion });
  }

  addRecommendation(message) {
    this.recommendations.push(message);
  }

  checkNodeVersion() {
    log('\n📋 Checking Node.js environment...');

    const nodeVersion = execCommand('node --version');
    if (nodeVersion) {
      const version = nodeVersion.replace('v', '');
      const [major, minor] = version.split('.').map(Number);

      if (major >= 20) {
        logSuccess(`Node.js ${nodeVersion} (compatible)`);
      } else {
        this.addIssue(
          `Node.js ${nodeVersion} is outdated`,
          'Update to Node.js 20+ using nvm: nvm install 20 && nvm use 20'
        );
      }
    } else {
      this.addIssue('Node.js not found', 'Install Node.js from https://nodejs.org/');
    }

    const npmVersion = execCommand('npm --version');
    if (npmVersion) {
      logSuccess(`npm ${npmVersion}`);
    } else {
      this.addIssue('npm not found', 'npm should be included with Node.js installation');
    }
  }

  checkProjectStructure() {
    log('\n📁 Checking project structure...');

    const requiredFiles = [
      { file: 'package.json', critical: true },
      { file: 'tsconfig.json', critical: true },
      { file: 'next.config.js', critical: true },
      { file: 'tailwind.config.js', critical: true },
      { file: '.env.example', critical: false },
      { file: '.gitignore', critical: false },
    ];

    for (const { file, critical } of requiredFiles) {
      if (fs.existsSync(file)) {
        logSuccess(`${file} exists`);
      } else if (critical) {
        this.addIssue(`Missing ${file}`, `This is a critical file for the project`);
      } else {
        this.addWarning(`Missing ${file}`, `Consider adding this file for better project setup`);
      }
    }

    // Check directory structure
    const requiredDirs = ['src', 'src/app', 'src/components', 'src/lib', 'data'];
    for (const dir of requiredDirs) {
      if (fs.existsSync(dir)) {
        logSuccess(`${dir}/ directory exists`);
      } else {
        this.addWarning(`Missing ${dir}/ directory`, `This directory may be needed`);
      }
    }
  }

  checkEnvironmentSetup() {
    log('\n🔧 Checking environment configuration...');

    if (fs.existsSync('.env.local')) {
      logSuccess('.env.local exists');

      // Check for placeholder values
      const envContent = fs.readFileSync('.env.local', 'utf8');
      const placeholders = ['REPLACE_WITH_', 'CHANGE_ME', 'YOUR_SECRET_HERE', 'PLACEHOLDER'];

      const hasPlaceholders = placeholders.some(placeholder => envContent.includes(placeholder));

      if (hasPlaceholders) {
        this.addWarning(
          'Environment file contains placeholder values',
          'Run: npm run dev:setup to generate proper secrets'
        );
      } else {
        logSuccess('Environment variables configured');
      }
    } else {
      this.addIssue('Missing .env.local file', 'Run: npm run dev:setup to create environment file');
    }
  }

  checkDependencies() {
    log('\n📦 Checking dependencies...');

    if (fs.existsSync('node_modules')) {
      logSuccess('Dependencies installed');

      // Check for security vulnerabilities
      const auditResult = execCommand('npm audit --audit-level=moderate');
      if (auditResult && auditResult.includes('vulnerabilities')) {
        this.addWarning('Security vulnerabilities found', 'Run: npm audit fix to address issues');
      } else {
        logSuccess('No security vulnerabilities found');
      }

      // Check for outdated packages
      const outdatedResult = execCommand('npm outdated');
      if (outdatedResult && outdatedResult.trim()) {
        this.addWarning('Outdated packages found', 'Run: npm run deps:check to see updates');
      } else {
        logSuccess('Dependencies are up to date');
      }
    } else {
      this.addIssue('Dependencies not installed', 'Run: npm install');
    }
  }

  checkDatabaseSetup() {
    log('\n🗄️  Checking database setup...');

    const dataDir = 'data';
    if (fs.existsSync(dataDir)) {
      logSuccess('Data directory exists');

      const expectedDatabases = [
        'forums.db',
        'wiki.db',
        'users.db',
        'library.db',
        'system.db',
        'content.db',
        'auth.db',
        'messaging.db',
      ];

      let missingDbs = [];
      for (const db of expectedDatabases) {
        const dbPath = path.join(dataDir, db);
        if (fs.existsSync(dbPath)) {
          logSuccess(`${db} exists`);
        } else {
          missingDbs.push(db);
        }
      }

      if (missingDbs.length > 0) {
        this.addWarning(
          `Missing database files: ${missingDbs.join(', ')}`,
          'Run: node scripts/create-monitoring-tables.js'
        );
      }
    } else {
      this.addIssue(
        'Data directory missing',
        'Run: npm run dev:setup to create database structure'
      );
    }
  }

  checkGitSetup() {
    log('\n🔄 Checking Git configuration...');

    if (fs.existsSync('.git')) {
      logSuccess('Git repository initialized');

      if (fs.existsSync('.husky')) {
        logSuccess('Git hooks configured');
      } else {
        this.addWarning('Git hooks not configured', 'Run: npm run git:hooks');
      }

      // Check for staged changes
      const staged = execCommand('git diff --cached --name-only');
      if (staged) {
        logInfo(`${staged.split('\n').length} files staged for commit`);
      }

      // Check for unstaged changes
      const unstaged = execCommand('git diff --name-only');
      if (unstaged) {
        logInfo(`${unstaged.split('\n').length} files with unstaged changes`);
      }
    } else {
      this.addWarning('Not a Git repository', 'Initialize with: git init');
    }
  }

  checkBuildTools() {
    log('\n🔨 Checking build tools...');

    // TypeScript check
    const tscResult = execCommand('npm run type-check');
    if (tscResult !== null) {
      logSuccess('TypeScript compilation successful');
    } else {
      this.addIssue('TypeScript compilation failed', 'Run: npm run type-check for details');
    }

    // Linting check
    const lintResult = execCommand('npm run lint');
    if (lintResult !== null) {
      logSuccess('Linting passed');
    } else {
      this.addWarning('Linting issues found', 'Run: npm run lint:fix to auto-fix issues');
    }

    // Check if build works
    try {
      execCommand('npm run build', false);
      logSuccess('Production build successful');
    } catch (error) {
      this.addIssue('Production build failed', 'Run: npm run build for details');
    }
  }

  checkPerformance() {
    log('\n⚡ Checking performance setup...');

    if (fs.existsSync('.next')) {
      const nextDir = '.next';
      const buildInfo = path.join(nextDir, 'build-manifest.json');

      if (fs.existsSync(buildInfo)) {
        logSuccess('Next.js build info available');

        // Check bundle size
        const bundleAnalyzer = execCommand('npm list webpack-bundle-analyzer');
        if (bundleAnalyzer) {
          logSuccess('Bundle analyzer available');
          this.addRecommendation('Run: npm run analyze to check bundle size');
        }
      }
    }

    // Check for performance monitoring
    const perfMonitorPath = 'src/lib/monitoring';
    if (fs.existsSync(perfMonitorPath)) {
      logSuccess('Performance monitoring setup detected');
    }
  }

  generateReport() {
    log(
      `\n${colors.bright}${colors.magenta}🏥 Development Environment Health Report${colors.reset}\n`
    );

    if (this.issues.length === 0 && this.warnings.length === 0) {
      log(
        `${colors.bright}${colors.green}🎉 All checks passed! Your development environment is healthy.${colors.reset}\n`
      );
    } else {
      if (this.issues.length > 0) {
        log(`${colors.bright}${colors.red}Critical Issues (${this.issues.length}):${colors.reset}`);
        this.issues.forEach((issue, index) => {
          logError(`${index + 1}. ${issue.message}`);
          log(`   Fix: ${issue.fix}\n`);
        });
      }

      if (this.warnings.length > 0) {
        log(`${colors.bright}${colors.yellow}Warnings (${this.warnings.length}):${colors.reset}`);
        this.warnings.forEach((warning, index) => {
          logWarning(`${index + 1}. ${warning.message}`);
          log(`   Suggestion: ${warning.suggestion}\n`);
        });
      }
    }

    if (this.recommendations.length > 0) {
      log(`${colors.bright}${colors.blue}Recommendations:${colors.reset}`);
      this.recommendations.forEach((rec, index) => {
        logInfo(`${index + 1}. ${rec}`);
      });
    }

    log(`\n${colors.bright}Quick fixes:${colors.reset}`);
    log(`${colors.cyan}  npm run dev:setup       ${colors.reset}# Complete environment setup`);
    log(`${colors.cyan}  npm run dev:clean       ${colors.reset}# Clean and reinstall everything`);
    log(`${colors.cyan}  npm run quality:full    ${colors.reset}# Run all quality checks`);
    log(`${colors.cyan}  npm run db:health       ${colors.reset}# Check database health`);
  }

  async run() {
    log(
      `${colors.bright}${colors.blue}🩺 Running development environment diagnosis...${colors.reset}`
    );

    this.checkNodeVersion();
    this.checkProjectStructure();
    this.checkEnvironmentSetup();
    this.checkDependencies();
    this.checkDatabaseSetup();
    this.checkGitSetup();
    this.checkBuildTools();
    this.checkPerformance();

    this.generateReport();
  }
}

// Run doctor if called directly
if (require.main === module) {
  const doctor = new DevDoctor();
  doctor.run().catch(console.error);
}

module.exports = DevDoctor;
