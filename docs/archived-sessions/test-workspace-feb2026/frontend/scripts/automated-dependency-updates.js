#!/usr/bin/env node

/**
 * Automated Dependency Updates with Security Scanning
 * Intelligent dependency management for continuous security and performance
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

class AutomatedDependencyUpdater {
  constructor(options = {}) {
    this.config = {
      // Update strategy
      updateStrategy: options.updateStrategy || 'security-first', // 'security-first', 'conservative', 'aggressive'

      // Update types
      allowPatchUpdates: options.allowPatchUpdates !== false,
      allowMinorUpdates: options.allowMinorUpdates !== false,
      allowMajorUpdates: options.allowMajorUpdates || false,

      // Security configuration
      securityOnly: options.securityOnly || false,
      vulnerabilitySeverityThreshold: options.vulnerabilitySeverityThreshold || 'moderate', // low, moderate, high, critical

      // Testing configuration
      runTestsAfterUpdate: options.runTestsAfterUpdate !== false,
      testTimeout: options.testTimeout || 600000, // 10 minutes

      // PR configuration
      createPullRequests: options.createPullRequests !== false,
      prBranch: options.prBranch || 'automated-dependency-updates',
      autoMergeStrategy: options.autoMergeStrategy || 'security-only', // 'none', 'security-only', 'patch-only', 'all'

      // Notification configuration
      slackWebhook: options.slackWebhook || process.env.SLACK_WEBHOOK_URL,
      notifyOnUpdates: options.notifyOnUpdates !== false,

      // Package exclusions
      excludePackages: options.excludePackages || [],
      includePackages: options.includePackages || [],

      // Rollback configuration
      enableRollback: options.enableRollback !== false,
      rollbackOnTestFailure: options.rollbackOnTestFailure !== false,
    };

    this.packageJsonPath = path.resolve(process.cwd(), 'package.json');
    this.lockfilePath = path.resolve(process.cwd(), 'package-lock.json');

    this.state = {
      updateId: `update-${Date.now()}`,
      startTime: Date.now(),
      updates: {
        security: [],
        patch: [],
        minor: [],
        major: [],
      },
      vulnerabilities: {
        fixed: [],
        remaining: [],
      },
      tests: {
        beforeUpdate: null,
        afterUpdate: null,
      },
      rollbacks: [],
    };

    console.log(`🔄 Automated Dependency Updater initialized`);
    console.log(`📋 Update ID: ${this.state.updateId}`);
    console.log(`🎯 Strategy: ${this.config.updateStrategy}`);
  }

  /**
   * Main update orchestration
   */
  async update() {
    try {
      console.log('\n🔍 Starting dependency update process...');

      // Phase 1: Analysis
      await this.analyzeCurrentState();
      await this.scanVulnerabilities();
      await this.identifyUpdates();

      // Phase 2: Pre-update validation
      if (this.config.runTestsAfterUpdate) {
        await this.runTests('before');
      }

      // Phase 3: Execute updates
      await this.executeUpdates();

      // Phase 4: Post-update validation
      if (this.config.runTestsAfterUpdate) {
        await this.runTests('after');
      }

      // Phase 5: Create PR or commit changes
      if (this.hasUpdates()) {
        if (this.config.createPullRequests) {
          await this.createPullRequest();
        } else {
          await this.commitChanges();
        }
      }

      // Phase 6: Notifications and reporting
      await this.sendNotifications();
      await this.generateReport();

      console.log('✅ Dependency update process completed successfully');
    } catch (error) {
      console.error(`❌ Update process failed: ${error.message}`);

      if (this.config.enableRollback) {
        await this.rollbackChanges();
      }

      await this.handleFailure(error);
      throw error;
    }
  }

  /**
   * Analyze current dependency state
   */
  async analyzeCurrentState() {
    console.log('\n📊 Analyzing current dependency state...');

    try {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      this.state.currentPackages = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
      };

      // Get installed versions
      const installedPackages = this.getInstalledPackages();
      this.state.installedVersions = installedPackages;

      // Analyze dependency tree
      const depTree = await this.analyzeDependencyTree();
      this.state.dependencyTree = depTree;

      console.log(
        `📦 Found ${Object.keys(this.state.currentPackages.dependencies).length} dependencies`
      );
      console.log(
        `🔧 Found ${Object.keys(this.state.currentPackages.devDependencies).length} dev dependencies`
      );
    } catch (error) {
      throw new Error(`Failed to analyze current state: ${error.message}`);
    }
  }

  /**
   * Scan for security vulnerabilities
   */
  async scanVulnerabilities() {
    console.log('\n🔒 Scanning for security vulnerabilities...');

    try {
      // Run npm audit
      const auditResult = await this.runNpmAudit();

      // Parse vulnerabilities
      this.state.vulnerabilities.current = this.parseAuditResults(auditResult);

      // Filter by severity threshold
      const filteredVulns = this.filterVulnerabilitiesBySeverity(
        this.state.vulnerabilities.current,
        this.config.vulnerabilitySeverityThreshold
      );

      console.log(`🚨 Found ${this.state.vulnerabilities.current.length} total vulnerabilities`);
      console.log(
        `⚡ ${filteredVulns.length} vulnerabilities meet severity threshold (${this.config.vulnerabilitySeverityThreshold}+)`
      );

      this.state.vulnerabilities.actionable = filteredVulns;

      // Additional security scanning with Snyk (if available)
      try {
        const snykResult = await this.runSnykScan();
        this.state.vulnerabilities.snyk = snykResult;
      } catch (error) {
        console.log('ℹ️  Snyk scan not available or failed:', error.message);
      }
    } catch (error) {
      console.warn('⚠️  Security scan failed:', error.message);
      this.state.vulnerabilities.scanError = error.message;
    }
  }

  /**
   * Identify available updates
   */
  async identifyUpdates() {
    console.log('\n🔍 Identifying available updates...');

    const allPackages = {
      ...this.state.currentPackages.dependencies,
      ...this.state.currentPackages.devDependencies,
    };

    for (const [packageName, currentVersion] of Object.entries(allPackages)) {
      if (this.config.excludePackages.includes(packageName)) {
        continue;
      }

      if (
        this.config.includePackages.length > 0 &&
        !this.config.includePackages.includes(packageName)
      ) {
        continue;
      }

      try {
        const availableVersions = await this.getAvailableVersions(packageName);
        const updateInfo = this.analyzeUpdateOptions(
          packageName,
          currentVersion,
          availableVersions
        );

        if (updateInfo) {
          this.categorizeUpdate(updateInfo);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to check updates for ${packageName}:`, error.message);
      }
    }

    const totalUpdates = Object.values(this.state.updates).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    console.log(`📦 Found ${totalUpdates} available updates`);
    console.log(`🔒 Security: ${this.state.updates.security.length}`);
    console.log(`🩹 Patch: ${this.state.updates.patch.length}`);
    console.log(`🔄 Minor: ${this.state.updates.minor.length}`);
    console.log(`🚀 Major: ${this.state.updates.major.length}`);
  }

  /**
   * Execute the identified updates
   */
  async executeUpdates() {
    console.log('\n⚡ Executing updates...');

    const updatesToExecute = this.selectUpdatesToExecute();

    if (updatesToExecute.length === 0) {
      console.log('ℹ️  No updates to execute based on current strategy');
      return;
    }

    console.log(`📦 Executing ${updatesToExecute.length} updates...`);

    // Backup current state
    await this.backupCurrentState();

    // Execute updates in order of priority
    const prioritizedUpdates = this.prioritizeUpdates(updatesToExecute);

    for (const update of prioritizedUpdates) {
      try {
        await this.executeUpdate(update);
        update.status = 'completed';
        console.log(
          `✅ Updated ${update.packageName} from ${update.currentVersion} to ${update.targetVersion}`
        );
      } catch (error) {
        update.status = 'failed';
        update.error = error.message;
        console.error(`❌ Failed to update ${update.packageName}: ${error.message}`);

        if (update.type === 'security' && this.config.updateStrategy === 'security-first') {
          // Continue with security updates even if one fails
          continue;
        } else {
          throw error;
        }
      }
    }

    // Update package.json and package-lock.json
    await this.updateLockfile();

    console.log('✅ All updates executed successfully');
  }

  /**
   * Select which updates to execute based on strategy
   */
  selectUpdatesToExecute() {
    let updates = [];

    switch (this.config.updateStrategy) {
      case 'security-first':
        updates = [...this.state.updates.security];
        if (!this.config.securityOnly) {
          updates.push(...this.state.updates.patch);
          if (this.config.allowMinorUpdates) {
            updates.push(...this.state.updates.minor);
          }
          if (this.config.allowMajorUpdates) {
            updates.push(...this.state.updates.major);
          }
        }
        break;

      case 'conservative':
        updates.push(...this.state.updates.security);
        if (this.config.allowPatchUpdates) {
          updates.push(...this.state.updates.patch);
        }
        break;

      case 'aggressive':
        updates = [
          ...this.state.updates.security,
          ...this.state.updates.patch,
          ...this.state.updates.minor,
          ...(this.config.allowMajorUpdates ? this.state.updates.major : []),
        ];
        break;

      default:
        updates = [...this.state.updates.security];
    }

    return updates;
  }

  /**
   * Prioritize updates for execution order
   */
  prioritizeUpdates(updates) {
    return updates.sort((a, b) => {
      // Security updates first
      if (a.type === 'security' && b.type !== 'security') return -1;
      if (b.type === 'security' && a.type !== 'security') return 1;

      // Then by severity
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
      const aSeverity = severityOrder[a.severity] || 5;
      const bSeverity = severityOrder[b.severity] || 5;

      if (aSeverity !== bSeverity) return aSeverity - bSeverity;

      // Then by update type
      const typeOrder = { patch: 0, minor: 1, major: 2 };
      return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
    });
  }

  /**
   * Execute individual update
   */
  async executeUpdate(update) {
    const packageSpec = `${update.packageName}@${update.targetVersion}`;
    const isDev = this.state.currentPackages.devDependencies[update.packageName];
    const saveFlag = isDev ? '--save-dev' : '--save';

    try {
      execSync(`npm install ${packageSpec} ${saveFlag}`, {
        stdio: 'pipe',
        timeout: 60000, // 1 minute timeout per package
      });
    } catch (error) {
      throw new Error(`npm install failed: ${error.message}`);
    }
  }

  /**
   * Run tests before/after updates
   */
  async runTests(phase) {
    console.log(`\n🧪 Running tests (${phase} update)...`);

    const testStart = Date.now();

    try {
      // Run different test suites
      const testResults = {
        unit: await this.runTestSuite('unit'),
        integration: await this.runTestSuite('integration'),
        security: await this.runTestSuite('security'),
      };

      const testDuration = Date.now() - testStart;
      const allPassed = Object.values(testResults).every(result => result.success);

      this.state.tests[`${phase}Update`] = {
        duration: testDuration,
        results: testResults,
        success: allPassed,
      };

      if (!allPassed) {
        const failedSuites = Object.entries(testResults)
          .filter(([_, result]) => !result.success)
          .map(([suite, _]) => suite);

        throw new Error(`Tests failed: ${failedSuites.join(', ')}`);
      }

      console.log(`✅ All tests passed (${testDuration}ms)`);
    } catch (error) {
      this.state.tests[`${phase}Update`] = {
        duration: Date.now() - testStart,
        success: false,
        error: error.message,
      };

      if (this.config.rollbackOnTestFailure && phase === 'after') {
        await this.rollbackChanges();
      }

      throw error;
    }
  }

  /**
   * Run specific test suite
   */
  async runTestSuite(suite) {
    try {
      const command = this.getTestCommand(suite);
      const output = execSync(command, {
        stdio: 'pipe',
        timeout: this.config.testTimeout,
        encoding: 'utf8',
      });

      return {
        success: true,
        suite,
        output,
      };
    } catch (error) {
      return {
        success: false,
        suite,
        error: error.message,
        output: error.output?.toString() || '',
      };
    }
  }

  /**
   * Get test command for suite
   */
  getTestCommand(suite) {
    switch (suite) {
      case 'unit':
        return 'npm test -- --testPathPattern="^((?!integration|e2e|security).)*$" --watchAll=false';
      case 'integration':
        return 'npm test -- --testPathPattern="integration" --watchAll=false';
      case 'security':
        return 'npm test -- --testPathPattern="security" --watchAll=false';
      case 'e2e':
        return 'npm run test:e2e';
      default:
        return 'npm test';
    }
  }

  /**
   * Create pull request with updates
   */
  async createPullRequest() {
    console.log('\n📝 Creating pull request...');

    try {
      // Create branch
      const branchName = `${this.config.prBranch}-${Date.now()}`;
      execSync(`git checkout -b ${branchName}`);

      // Stage and commit changes
      execSync('git add package.json package-lock.json');

      const commitMessage = this.generateCommitMessage();
      execSync(`git commit -m "${commitMessage}"`);

      // Push branch
      execSync(`git push -u origin ${branchName}`);

      // Create PR
      const prBody = this.generatePRDescription();
      const prTitle = this.generatePRTitle();

      execSync(
        `gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branchName}`
      );

      // Auto-merge if configured
      if (this.shouldAutoMerge()) {
        execSync(`gh pr merge --auto --squash`);
        console.log('🤖 PR set to auto-merge');
      }

      console.log(`✅ Pull request created: ${branchName}`);
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  /**
   * Determine if PR should be auto-merged
   */
  shouldAutoMerge() {
    switch (this.config.autoMergeStrategy) {
      case 'none':
        return false;

      case 'security-only':
        return (
          this.state.updates.security.length > 0 &&
          this.state.updates.minor.length === 0 &&
          this.state.updates.major.length === 0
        );

      case 'patch-only':
        return this.state.updates.major.length === 0 && this.state.updates.minor.length === 0;

      case 'all':
        return true;

      default:
        return false;
    }
  }

  /**
   * Generate commit message
   */
  generateCommitMessage() {
    const executedUpdates = this.getExecutedUpdates();
    const securityCount = executedUpdates.filter(u => u.type === 'security').length;
    const patchCount = executedUpdates.filter(u => u.type === 'patch').length;
    const minorCount = executedUpdates.filter(u => u.type === 'minor').length;
    const majorCount = executedUpdates.filter(u => u.type === 'major').length;

    let message = 'chore: automated dependency updates';

    const parts = [];
    if (securityCount > 0) parts.push(`${securityCount} security`);
    if (patchCount > 0) parts.push(`${patchCount} patch`);
    if (minorCount > 0) parts.push(`${minorCount} minor`);
    if (majorCount > 0) parts.push(`${majorCount} major`);

    if (parts.length > 0) {
      message += ` (${parts.join(', ')})`;
    }

    return message;
  }

  /**
   * Generate PR description
   */
  generatePRDescription() {
    const executedUpdates = this.getExecutedUpdates();
    const securityUpdates = executedUpdates.filter(u => u.type === 'security');

    let description = '## Automated Dependency Updates\n\n';
    description += `This PR contains automated dependency updates generated by the dependency updater.\n\n`;

    if (securityUpdates.length > 0) {
      description += '### 🔒 Security Updates\n\n';
      securityUpdates.forEach(update => {
        description += `- **${update.packageName}**: ${update.currentVersion} → ${update.targetVersion}\n`;
        if (update.vulnerabilities) {
          description += `  - Fixes: ${update.vulnerabilities.map(v => v.title).join(', ')}\n`;
        }
      });
      description += '\n';
    }

    const otherUpdates = executedUpdates.filter(u => u.type !== 'security');
    if (otherUpdates.length > 0) {
      description += '### 📦 Other Updates\n\n';
      otherUpdates.forEach(update => {
        description += `- **${update.packageName}**: ${update.currentVersion} → ${update.targetVersion} (${update.type})\n`;
      });
      description += '\n';
    }

    description += '### 🧪 Testing\n\n';
    if (this.state.tests.afterUpdate?.success) {
      description += '✅ All tests passed\n\n';
    } else {
      description += '❌ Some tests failed - manual review required\n\n';
    }

    description += `\n---\n*Generated by Automated Dependency Updater (${this.state.updateId})*`;

    return description;
  }

  /**
   * Send notifications about updates
   */
  async sendNotifications() {
    if (!this.config.notifyOnUpdates || !this.config.slackWebhook) {
      return;
    }

    console.log('\n📢 Sending notifications...');

    const executedUpdates = this.getExecutedUpdates();
    const securityCount = executedUpdates.filter(u => u.type === 'security').length;

    if (executedUpdates.length === 0) {
      return;
    }

    const message = {
      text: '🔄 Automated Dependency Updates',
      attachments: [
        {
          color: securityCount > 0 ? 'warning' : 'good',
          fields: [
            { title: 'Security Updates', value: securityCount.toString(), short: true },
            { title: 'Total Updates', value: executedUpdates.length.toString(), short: true },
            { title: 'Update ID', value: this.state.updateId, short: true },
            { title: 'Strategy', value: this.config.updateStrategy, short: true },
          ],
          footer: 'Veritable Games Dependency Updater',
          ts: Math.floor(this.state.startTime / 1000),
        },
      ],
    };

    try {
      await this.httpRequest(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      console.log('✅ Slack notification sent');
    } catch (error) {
      console.warn('⚠️  Failed to send Slack notification:', error.message);
    }
  }

  /**
   * Utility methods
   */

  getExecutedUpdates() {
    return Object.values(this.state.updates)
      .flat()
      .filter(update => update.status === 'completed');
  }

  hasUpdates() {
    return this.getExecutedUpdates().length > 0;
  }

  // Placeholder implementations for complex operations
  getInstalledPackages() {
    return {};
  }
  async analyzeDependencyTree() {
    return {};
  }
  async runNpmAudit() {
    return { vulnerabilities: [] };
  }
  parseAuditResults(audit) {
    return [];
  }
  filterVulnerabilitiesBySeverity(vulns, threshold) {
    return vulns;
  }
  async runSnykScan() {
    throw new Error('Snyk not available');
  }
  async getAvailableVersions(packageName) {
    return [];
  }
  analyzeUpdateOptions(name, current, available) {
    return null;
  }
  categorizeUpdate(update) {}
  async backupCurrentState() {}
  async updateLockfile() {}
  async rollbackChanges() {}
  async handleFailure(error) {}
  async commitChanges() {}
  generatePRTitle() {
    return 'chore: automated dependency updates';
  }
  async generateReport() {}

  async httpRequest(url, options = {}) {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.request(url, options, res => {
        resolve({ status: res.statusCode, headers: res.headers });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      options[key] = value === 'true' ? true : value === 'false' ? false : value;
    }
  }

  const updater = new AutomatedDependencyUpdater(options);
  updater.update().catch(console.error);
}

module.exports = AutomatedDependencyUpdater;
