#!/usr/bin/env node

/**
 * Health check script for CI/CD pipeline
 * Verifies system dependencies and configurations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const checks = [];
let hasErrors = false;
let hasWarnings = false;

function logCheck(name, status, message = '') {
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
  const color = status === 'pass' ? '\x1b[32m' : status === 'warn' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}${message ? `: ${message}` : ''}`);
  checks.push({ name, status, message });
  if (status === 'fail') hasErrors = true;
  if (status === 'warn') hasWarnings = true;
}

function checkNodeVersion() {
  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (major >= 18) {
      logCheck('Node.js version', 'pass', nodeVersion);
    } else {
      logCheck('Node.js version', 'fail', `${nodeVersion} (requires >= 18)`);
    }
  } catch (error) {
    logCheck('Node.js version', 'fail', error.message);
  }
}

function checkPackageJson() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      logCheck('package.json', 'pass', `v${pkg.version}`);
    } else {
      logCheck('package.json', 'fail', 'Not found');
    }
  } catch (error) {
    logCheck('package.json', 'fail', error.message);
  }
}

function checkPackageLock() {
  try {
    const lockPath = path.join(process.cwd(), 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      const stats = fs.statSync(lockPath);
      const age = Date.now() - stats.mtimeMs;
      const days = Math.floor(age / (1000 * 60 * 60 * 24));
      if (days > 30) {
        logCheck('package-lock.json', 'warn', `${days} days old`);
      } else {
        logCheck('package-lock.json', 'pass', 'Found and recent');
      }
    } else {
      logCheck('package-lock.json', 'fail', 'Not found');
    }
  } catch (error) {
    logCheck('package-lock.json', 'fail', error.message);
  }
}

function checkDependencies() {
  try {
    execSync('npm ls --depth=0 --json', { stdio: 'pipe' });
    logCheck('Dependencies', 'pass', 'All installed');
  } catch (error) {
    // npm ls returns non-zero if there are issues
    const output = error.stdout?.toString() || '';
    if (output.includes('missing')) {
      logCheck('Dependencies', 'fail', 'Missing dependencies');
    } else if (output.includes('extraneous')) {
      logCheck('Dependencies', 'warn', 'Extraneous packages found');
    } else {
      logCheck('Dependencies', 'warn', 'Some issues detected');
    }
  }
}

function checkNextConfig() {
  try {
    const configPath = path.join(process.cwd(), 'next.config.js');
    if (fs.existsSync(configPath)) {
      logCheck('next.config.js', 'pass', 'Found');
    } else {
      logCheck('next.config.js', 'warn', 'Not found (using defaults)');
    }
  } catch (error) {
    logCheck('next.config.js', 'fail', error.message);
  }
}

function checkEnvironmentFiles() {
  const envFiles = ['.env', '.env.local', '.env.production'];
  let foundAny = false;

  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      foundAny = true;
      logCheck(`Environment: ${file}`, 'pass', 'Found');
    }
  }

  if (!foundAny) {
    logCheck('Environment files', 'warn', 'No .env files found');
  }
}

function checkDataDirectory() {
  try {
    const dataPath = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      logCheck('Data directory', 'pass', 'Created');
    } else {
      logCheck('Data directory', 'pass', 'Exists');
    }
  } catch (error) {
    logCheck('Data directory', 'fail', error.message);
  }
}

function checkBuildDirectory() {
  try {
    const buildPath = path.join(process.cwd(), '.next');
    if (fs.existsSync(buildPath)) {
      logCheck('Build directory', 'pass', '.next exists');
    } else {
      logCheck('Build directory', 'warn', 'No build found (run npm run build)');
    }
  } catch (error) {
    logCheck('Build directory', 'fail', error.message);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('Health Check Summary');
  console.log('='.repeat(50));

  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  console.log(`✓ Passed: ${passed}`);
  if (warned > 0) console.log(`⚠ Warnings: ${warned}`);
  if (failed > 0) console.log(`✗ Failed: ${failed}`);

  console.log('='.repeat(50));

  if (hasErrors) {
    console.log('\n\x1b[31mHealth check failed with errors\x1b[0m');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n\x1b[33mHealth check completed with warnings\x1b[0m');
    process.exit(0);
  } else {
    console.log('\n\x1b[32mHealth check passed\x1b[0m');
    process.exit(0);
  }
}

// Run checks
console.log('Running health checks...\n');
checkNodeVersion();
checkPackageJson();
checkPackageLock();
checkDependencies();
checkNextConfig();
checkEnvironmentFiles();
checkDataDirectory();
checkBuildDirectory();
printSummary();
