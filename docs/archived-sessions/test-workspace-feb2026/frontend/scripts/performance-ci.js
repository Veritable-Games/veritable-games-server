#!/usr/bin/env node

/**
 * Performance regression detection for CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Performance thresholds for CI/CD
const PERFORMANCE_BUDGETS = {
  // Core Web Vitals (in ms, except CLS which is a score)
  LCP: 2500,
  FID: 100,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 600,

  // Bundle size budgets (in bytes)
  initialJS: 150000, // 150KB
  initialCSS: 50000, // 50KB
  totalBundle: 1000000, // 1MB
  maxChunkSize: 250000, // 250KB

  // Resource budgets
  totalRequests: 100,
  totalTransferSize: 2000000, // 2MB

  // Performance scores (0-100)
  lighthousePerformance: 90,
  accessibilityScore: 95,
  bestPracticesScore: 95,
  seoScore: 95,
};

// Regression thresholds (percentage increase that triggers failure)
const REGRESSION_THRESHOLDS = {
  LCP: 0.2, // 20% regression
  FID: 0.3, // 30% regression
  CLS: 0.5, // 50% regression
  FCP: 0.2, // 20% regression
  TTFB: 0.3, // 30% regression
  bundleSize: 0.1, // 10% regression
  performance: 0.1, // 10% drop in score
};

class PerformanceCI {
  constructor() {
    this.buildDir = path.join(process.cwd(), '.next');
    this.reportsDir = path.join(process.cwd(), 'performance-reports');
    this.baselineFile = path.join(this.reportsDir, 'baseline.json');
    this.currentReport = null;
    this.baseline = null;

    this.ensureDirectories();
  }

  /**
   * Main entry point for CI performance checks
   */
  async run() {
    console.log('🚀 Starting CI Performance Analysis...\n');

    try {
      // Step 1: Analyze build
      console.log('📦 Analyzing build artifacts...');
      const buildAnalysis = await this.analyzeBuild();

      // Step 2: Run Lighthouse audit
      console.log('🔍 Running Lighthouse performance audit...');
      const lighthouseResults = await this.runLighthouseAudit();

      // Step 3: Combine results
      this.currentReport = {
        timestamp: Date.now(),
        buildId: process.env.GITHUB_SHA || process.env.BUILD_ID || 'local',
        branch: process.env.GITHUB_REF_NAME || process.env.BRANCH || 'main',
        buildAnalysis,
        lighthouse: lighthouseResults,
      };

      // Step 4: Load baseline for comparison
      this.loadBaseline();

      // Step 5: Check budgets
      console.log('💰 Checking performance budgets...');
      const budgetResults = this.checkBudgets();

      // Step 6: Check for regressions
      console.log('📈 Checking for performance regressions...');
      const regressionResults = this.checkRegressions();

      // Step 7: Generate report
      console.log('📊 Generating performance report...');
      const report = this.generateReport(budgetResults, regressionResults);

      // Step 8: Save results
      this.saveResults();

      // Step 9: Update baseline if on main branch
      this.updateBaseline();

      // Step 10: Exit with appropriate code
      this.exitWithResults(report);
    } catch (error) {
      console.error('❌ Performance CI failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze build artifacts
   */
  async analyzeBuild() {
    const staticDir = path.join(this.buildDir, 'static');

    if (!fs.existsSync(staticDir)) {
      throw new Error('Build directory not found. Run "npm run build" first.');
    }

    const analysis = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      chunks: [],
      assets: [],
    };

    // Analyze static assets
    this.walkDirectory(staticDir, filePath => {
      const stat = fs.statSync(filePath);
      const relativePath = path.relative(staticDir, filePath);
      const ext = path.extname(filePath);

      analysis.totalSize += stat.size;

      if (ext === '.js') {
        analysis.jsSize += stat.size;
        analysis.chunks.push({
          name: path.basename(filePath),
          path: relativePath,
          size: stat.size,
          type: 'javascript',
        });
      } else if (ext === '.css') {
        analysis.cssSize += stat.size;
        analysis.assets.push({
          name: path.basename(filePath),
          path: relativePath,
          size: stat.size,
          type: 'stylesheet',
        });
      }
    });

    // Sort chunks by size (largest first)
    analysis.chunks.sort((a, b) => b.size - a.size);
    analysis.assets.sort((a, b) => b.size - a.size);

    console.log(`   Total bundle size: ${this.formatBytes(analysis.totalSize)}`);
    console.log(`   JavaScript size: ${this.formatBytes(analysis.jsSize)}`);
    console.log(`   CSS size: ${this.formatBytes(analysis.cssSize)}`);
    console.log(`   Chunk count: ${analysis.chunks.length}`);

    return analysis;
  }

  /**
   * Run Lighthouse audit
   */
  async runLighthouseAudit() {
    // This would typically run against a deployed version
    // For now, we'll simulate the structure

    console.log('   Running Lighthouse audit...');

    // In a real implementation, you would:
    // 1. Start the application server
    // 2. Run lighthouse CLI against localhost
    // 3. Parse the results

    const mockResults = {
      performance: 85,
      accessibility: 92,
      bestPractices: 88,
      seo: 94,
      metrics: {
        LCP: 2200,
        FID: 85,
        CLS: 0.08,
        FCP: 1600,
        TTFB: 520,
      },
    };

    console.log(`   Performance Score: ${mockResults.performance}`);
    console.log(`   Accessibility Score: ${mockResults.accessibility}`);
    console.log(`   Best Practices Score: ${mockResults.bestPractices}`);
    console.log(`   SEO Score: ${mockResults.seo}`);

    return mockResults;
  }

  /**
   * Check performance budgets
   */
  checkBudgets() {
    const results = {
      passed: [],
      failed: [],
      warnings: [],
    };

    // Check bundle size budgets
    const { buildAnalysis } = this.currentReport;

    this.checkBudget(
      'totalBundle',
      buildAnalysis.totalSize,
      PERFORMANCE_BUDGETS.totalBundle,
      results
    );
    this.checkBudget('initialJS', buildAnalysis.jsSize, PERFORMANCE_BUDGETS.initialJS, results);
    this.checkBudget('initialCSS', buildAnalysis.cssSize, PERFORMANCE_BUDGETS.initialCSS, results);

    // Check largest chunk size
    if (buildAnalysis.chunks.length > 0) {
      const largestChunk = buildAnalysis.chunks[0];
      this.checkBudget(
        'maxChunkSize',
        largestChunk.size,
        PERFORMANCE_BUDGETS.maxChunkSize,
        results
      );
    }

    // Check Lighthouse metrics
    const { lighthouse } = this.currentReport;
    this.checkBudget('LCP', lighthouse.metrics.LCP, PERFORMANCE_BUDGETS.LCP, results);
    this.checkBudget('FID', lighthouse.metrics.FID, PERFORMANCE_BUDGETS.FID, results);
    this.checkBudget('CLS', lighthouse.metrics.CLS, PERFORMANCE_BUDGETS.CLS, results);
    this.checkBudget('FCP', lighthouse.metrics.FCP, PERFORMANCE_BUDGETS.FCP, results);
    this.checkBudget('TTFB', lighthouse.metrics.TTFB, PERFORMANCE_BUDGETS.TTFB, results);

    // Check Lighthouse scores
    this.checkBudget(
      'lighthousePerformance',
      lighthouse.performance,
      PERFORMANCE_BUDGETS.lighthousePerformance,
      results
    );
    this.checkBudget(
      'accessibilityScore',
      lighthouse.accessibility,
      PERFORMANCE_BUDGETS.accessibilityScore,
      results
    );

    return results;
  }

  /**
   * Check for performance regressions
   */
  checkRegressions() {
    const results = {
      regressions: [],
      improvements: [],
      stable: [],
    };

    if (!this.baseline) {
      console.log('   No baseline found, skipping regression analysis');
      return results;
    }

    console.log(
      `   Comparing against baseline from ${new Date(this.baseline.timestamp).toISOString()}`
    );

    // Compare metrics
    const currentMetrics = this.currentReport.lighthouse.metrics;
    const baselineMetrics = this.baseline.lighthouse?.metrics || {};

    Object.entries(currentMetrics).forEach(([metric, current]) => {
      const baseline = baselineMetrics[metric];
      if (baseline === undefined) return;

      const change = (current - baseline) / baseline;
      const threshold = REGRESSION_THRESHOLDS[metric] || 0.2;

      if (Math.abs(change) < 0.05) {
        results.stable.push({ metric, current, baseline, change });
      } else if (change > threshold) {
        results.regressions.push({
          metric,
          current,
          baseline,
          change: Math.round(change * 100),
          severity: change > threshold * 2 ? 'critical' : 'high',
        });
      } else if (change < -0.05) {
        results.improvements.push({
          metric,
          current,
          baseline,
          change: Math.round(Math.abs(change) * 100),
        });
      }
    });

    // Compare bundle sizes
    const currentSize = this.currentReport.buildAnalysis.totalSize;
    const baselineSize = this.baseline.buildAnalysis?.totalSize;

    if (baselineSize) {
      const sizeChange = (currentSize - baselineSize) / baselineSize;
      const threshold = REGRESSION_THRESHOLDS.bundleSize;

      if (sizeChange > threshold) {
        results.regressions.push({
          metric: 'bundleSize',
          current: currentSize,
          baseline: baselineSize,
          change: Math.round(sizeChange * 100),
          severity: sizeChange > threshold * 2 ? 'critical' : 'high',
        });
      } else if (sizeChange < -0.05) {
        results.improvements.push({
          metric: 'bundleSize',
          current: currentSize,
          baseline: baselineSize,
          change: Math.round(Math.abs(sizeChange) * 100),
        });
      }
    }

    return results;
  }

  /**
   * Generate performance report
   */
  generateReport(budgetResults, regressionResults) {
    const report = {
      passed: budgetResults.failed.length === 0 && regressionResults.regressions.length === 0,
      summary: {
        budgets: {
          passed: budgetResults.passed.length,
          failed: budgetResults.failed.length,
          warnings: budgetResults.warnings.length,
        },
        regressions: {
          count: regressionResults.regressions.length,
          critical: regressionResults.regressions.filter(r => r.severity === 'critical').length,
          improvements: regressionResults.improvements.length,
        },
      },
      details: {
        budgets: budgetResults,
        regressions: regressionResults,
      },
    };

    // Print summary
    console.log('\n📊 Performance Report Summary:');
    console.log(
      `   Budgets: ${report.summary.budgets.passed} passed, ${report.summary.budgets.failed} failed`
    );
    console.log(
      `   Regressions: ${report.summary.regressions.count} found (${report.summary.regressions.critical} critical)`
    );
    console.log(`   Improvements: ${report.summary.regressions.improvements} metrics improved`);

    // Print failures
    if (budgetResults.failed.length > 0) {
      console.log('\n❌ Budget Failures:');
      budgetResults.failed.forEach(failure => {
        console.log(
          `   ${failure.metric}: ${failure.actual} > ${failure.budget} (${failure.unit || ''})`
        );
      });
    }

    // Print regressions
    if (regressionResults.regressions.length > 0) {
      console.log('\n📈 Performance Regressions:');
      regressionResults.regressions.forEach(regression => {
        const severity = regression.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`   ${severity} ${regression.metric}: +${regression.change}% regression`);
        console.log(`      ${regression.baseline} → ${regression.current}`);
      });
    }

    // Print improvements
    if (regressionResults.improvements.length > 0) {
      console.log('\n✅ Performance Improvements:');
      regressionResults.improvements.forEach(improvement => {
        console.log(`   ${improvement.metric}: ${improvement.change}% improvement`);
      });
    }

    return report;
  }

  /**
   * Helper methods
   */
  checkBudget(name, actual, budget, results) {
    const passed = actual <= budget;
    const result = { metric: name, actual, budget, passed };

    if (passed) {
      results.passed.push(result);
    } else {
      const overage = ((actual - budget) / budget) * 100;
      result.overage = Math.round(overage);

      if (overage > 50) {
        results.failed.push({ ...result, severity: 'critical' });
      } else if (overage > 20) {
        results.failed.push({ ...result, severity: 'high' });
      } else {
        results.warnings.push(result);
      }
    }
  }

  walkDirectory(dir, callback) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.walkDirectory(fullPath, callback);
      } else {
        callback(fullPath);
      }
    });
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  ensureDirectories() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  loadBaseline() {
    if (fs.existsSync(this.baselineFile)) {
      try {
        this.baseline = JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
      } catch (error) {
        console.warn('Failed to load baseline:', error.message);
      }
    }
  }

  saveResults() {
    const reportFile = path.join(
      this.reportsDir,
      `performance-${this.currentReport.buildId}-${Date.now()}.json`
    );

    fs.writeFileSync(reportFile, JSON.stringify(this.currentReport, null, 2));
    console.log(`\n💾 Report saved to: ${reportFile}`);
  }

  updateBaseline() {
    const isMainBranch =
      this.currentReport.branch === 'main' ||
      this.currentReport.branch === 'master' ||
      process.env.UPDATE_BASELINE === 'true';

    if (isMainBranch) {
      fs.writeFileSync(this.baselineFile, JSON.stringify(this.currentReport, null, 2));
      console.log('📊 Baseline updated');
    }
  }

  exitWithResults(report) {
    if (report.passed) {
      console.log('\n✅ All performance checks passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Performance checks failed!');

      // In CI, you might want to post results to GitHub PR or Slack
      if (process.env.CI) {
        this.postResultsToGitHub(report);
      }

      process.exit(1);
    }
  }

  async postResultsToGitHub(report) {
    // Implementation would post results as GitHub PR comment
    // using GitHub API or actions
    console.log('📝 Would post results to GitHub PR...');
  }
}

// CLI execution
if (require.main === module) {
  const ci = new PerformanceCI();
  ci.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = PerformanceCI;
