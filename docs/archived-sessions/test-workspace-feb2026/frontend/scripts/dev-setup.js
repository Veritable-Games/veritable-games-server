#!/usr/bin/env node

/**
 * Development Environment Setup Script
 *
 * Automates the setup of the development environment for new developers
 * or when switching between different development machines.
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

function execCommand(command, description) {
  try {
    log(`${colors.cyan}Running: ${command}${colors.reset}`);
    execSync(command, { stdio: 'inherit' });
    logSuccess(description);
    return true;
  } catch (error) {
    logError(`Failed: ${description}`);
    return false;
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    logSuccess(`${description} exists`);
    return true;
  } else {
    logWarning(`${description} missing`);
    return false;
  }
}

function generateSecret() {
  return require('crypto').randomBytes(32).toString('hex');
}

function setupEnvironmentFile() {
  const envPath = '.env.local';
  const envExamplePath = '.env.example';

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      log('Creating .env.local from .env.example...');
      let envContent = fs.readFileSync(envExamplePath, 'utf8');

      // Generate secrets
      const sessionSecret = generateSecret();
      const csrfSecret = generateSecret();
      const encryptionKey = generateSecret();
      const databaseMasterKey = generateSecret();

      // Replace placeholder values
      envContent = envContent
        .replace(/REPLACE_WITH_GENERATED_SECRET_USE_OPENSSL_RAND_HEX_32/g, sessionSecret)
        .replace(/REPLACE_WITH_GENERATED_KEY_USE_OPENSSL_RAND_HEX_32/g, encryptionKey)
        .replace(/REPLACE_WITH_DATABASE_MASTER_KEY_OPENSSL_RAND_HEX_32/g, databaseMasterKey)
        .replace(/REPLACE_WITH_GENERATED_MASTER_KEY_64_HEX_CHARS/g, databaseMasterKey);

      fs.writeFileSync(envPath, envContent);
      logSuccess('Generated .env.local with secure secrets');
    } else {
      logError('.env.example not found, cannot create .env.local');
      return false;
    }
  } else {
    logSuccess('.env.local already exists');
  }

  return true;
}

function setupDatabases() {
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logSuccess('Created data directory');
  }

  const databases = [
    'forums.db',
    'wiki.db',
    'users.db',
    'library.db',
    'system.db',
    'content.db',
    'auth.db',
    'messaging.db',
  ];

  for (const db of databases) {
    const dbPath = path.join(dataDir, db);
    if (!fs.existsSync(dbPath)) {
      // Create empty database file
      fs.writeFileSync(dbPath, '');
      log(`Created ${db}`);
    }
  }

  logSuccess('Database files verified');
  return true;
}

function setupGitHooks() {
  const huskyDir = '.husky';

  if (fs.existsSync(path.join(process.cwd(), '.git'))) {
    if (!fs.existsSync(huskyDir)) {
      return execCommand('npx husky install', 'Git hooks setup');
    } else {
      logSuccess('Git hooks already configured');
      return true;
    }
  } else {
    logWarning('Not a git repository, skipping git hooks setup');
    return true;
  }
}

function checkDependencies() {
  const dependencies = [
    { command: 'node --version', name: 'Node.js' },
    { command: 'npm --version', name: 'npm' },
  ];

  let allGood = true;

  for (const dep of dependencies) {
    try {
      const version = execSync(dep.command, { encoding: 'utf8' }).trim();
      logSuccess(`${dep.name} ${version}`);
    } catch (error) {
      logError(`${dep.name} not found`);
      allGood = false;
    }
  }

  return allGood;
}

function installPackages() {
  if (!fs.existsSync('node_modules')) {
    return execCommand('npm install', 'Dependencies installation');
  } else {
    logSuccess('Dependencies already installed');
    return true;
  }
}

function runInitialChecks() {
  const checks = [
    { fn: () => checkFileExists('package.json', 'package.json'), required: true },
    { fn: () => checkFileExists('tsconfig.json', 'TypeScript config'), required: true },
    { fn: () => checkFileExists('tailwind.config.js', 'Tailwind config'), required: true },
    { fn: () => checkFileExists('next.config.js', 'Next.js config'), required: true },
  ];

  for (const check of checks) {
    if (!check.fn() && check.required) {
      logError('Required file missing, cannot continue');
      process.exit(1);
    }
  }
}

async function main() {
  log(`${colors.bright}${colors.magenta}🚀 Veritable Games - Development Setup${colors.reset}`);
  log('Setting up your development environment...\n');

  try {
    logStep('1', 'Checking system dependencies');
    if (!checkDependencies()) {
      logError('Please install missing dependencies and try again');
      process.exit(1);
    }

    logStep('2', 'Verifying project files');
    runInitialChecks();

    logStep('3', 'Installing packages');
    installPackages();

    logStep('4', 'Setting up environment configuration');
    setupEnvironmentFile();

    logStep('5', 'Initializing databases');
    setupDatabases();
    execCommand('node scripts/create-monitoring-tables.js', 'Database tables creation');

    logStep('6', 'Configuring git hooks');
    setupGitHooks();

    logStep('7', 'Running initial build verification');
    execCommand('npm run type-check', 'TypeScript type checking');
    execCommand('npm run lint', 'Code linting');

    log(
      `\n${colors.bright}${colors.green}🎉 Development environment setup complete!${colors.reset}\n`
    );

    log(`${colors.bright}Next steps:${colors.reset}`);
    log(`${colors.cyan}  1. npm run dev          ${colors.reset}# Start development server`);
    log(`${colors.cyan}  2. npm test              ${colors.reset}# Run tests`);
    log(`${colors.cyan}  3. npm run build         ${colors.reset}# Build for production`);
    log(`${colors.cyan}  4. npm run analyze       ${colors.reset}# Analyze bundle size`);

    log(`\n${colors.bright}Development server will be available at:${colors.reset}`);
    log(`${colors.blue}  http://localhost:3000${colors.reset}`);

    log(`\n${colors.bright}Useful commands:${colors.reset}`);
    log(`${colors.cyan}  npm run dev              ${colors.reset}# Development server`);
    log(`${colors.cyan}  npm run type-check       ${colors.reset}# TypeScript checking`);
    log(`${colors.cyan}  npm run lint:fix         ${colors.reset}# Auto-fix linting issues`);
    log(`${colors.cyan}  npm run test:e2e         ${colors.reset}# Run E2E tests`);
    log(`${colors.cyan}  npm run deps:check       ${colors.reset}# Check for updates`);
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = {
  setupEnvironmentFile,
  setupDatabases,
  checkDependencies,
  generateSecret,
};
