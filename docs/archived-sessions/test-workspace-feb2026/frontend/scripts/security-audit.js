#!/usr/bin/env node

/**
 * Comprehensive Security Audit Script
 * Performs automated security checks on the Veritable Games platform
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Security audit configuration
const AUDIT_CONFIG = {
  apiRoutesPath: 'src/app/api',
  libPath: 'src/lib',
  componentsPath: 'src/components',
  envPath: '.env.local',
  envExamplePath: '.env.example',
};

class SecurityAuditor {
  constructor() {
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };
    this.stats = {
      filesScanned: 0,
      apisWithSecurity: 0,
      apisWithoutSecurity: 0,
      sqlInjectionRisks: 0,
      xssRisks: 0,
      hardcodedSecrets: 0,
      insecureImports: 0,
    };
  }

  log(message, level = 'info') {
    const colorMap = {
      error: colors.red,
      warning: colors.yellow,
      success: colors.green,
      info: colors.cyan,
    };
    console.log(`${colorMap[level] || ''}${message}${colors.reset}`);
  }

  // Check if API routes have security middleware
  checkAPIRouteSecurity(filePath, content) {
    const hasWithSecurity = content.includes('withSecurity');
    const hasExport =
      /export\s+(const|async\s+function|function)\s+(GET|POST|PUT|DELETE|PATCH)/g.test(content);

    if (hasExport && !hasWithSecurity) {
      this.stats.apisWithoutSecurity++;
      this.findings.critical.push({
        type: 'MISSING_SECURITY_MIDDLEWARE',
        file: filePath,
        message: 'API route missing withSecurity wrapper',
        severity: 'critical',
      });
    } else if (hasExport) {
      this.stats.apisWithSecurity++;

      // Check for disabled CSRF
      if (content.includes('csrfEnabled: false')) {
        this.findings.medium.push({
          type: 'CSRF_DISABLED',
          file: filePath,
          message: 'CSRF protection is disabled',
          severity: 'medium',
        });
      }

      // Check for missing rate limiting
      if (!content.includes('rateLimitConfig') && !content.includes('rateLimit')) {
        this.findings.low.push({
          type: 'NO_RATE_LIMIT',
          file: filePath,
          message: 'No explicit rate limiting configured',
          severity: 'low',
        });
      }
    }
  }

  // Check for SQL injection vulnerabilities
  checkSQLInjection(filePath, content) {
    const dangerousPatterns = [
      // String concatenation in SQL
      /prepare\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/g,
      /prepare\s*\(\s*.*\+.*\)/g,
      // Direct exec without prepare
      /\.exec\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/g,
      // String interpolation in queries
      /`\s*SELECT.*\$\{.*\}.*FROM/gi,
      /`\s*INSERT.*\$\{.*\}.*INTO/gi,
      /`\s*UPDATE.*\$\{.*\}.*SET/gi,
      /`\s*DELETE.*\$\{.*\}.*FROM/gi,
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        this.stats.sqlInjectionRisks++;
        this.findings.critical.push({
          type: 'SQL_INJECTION_RISK',
          file: filePath,
          message: 'Potential SQL injection vulnerability detected',
          severity: 'critical',
          pattern: pattern.toString(),
        });
      }
    });

    // Check for proper parameterized queries
    if (content.includes('.prepare(') && !content.includes('?')) {
      this.findings.medium.push({
        type: 'NO_PARAMETERIZED_QUERY',
        file: filePath,
        message: 'Prepared statement without parameters',
        severity: 'medium',
      });
    }
  }

  // Check for XSS vulnerabilities
  checkXSS(filePath, content) {
    const xssPatterns = [
      // dangerouslySetInnerHTML without sanitization
      /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*[^}]+\}\s*\}/g,
      // Direct HTML injection
      /innerHTML\s*=/g,
      // eval usage
      /\beval\s*\(/g,
      // Function constructor
      /new\s+Function\s*\(/g,
      // document.write
      /document\.write/g,
    ];

    xssPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        // Check if DOMPurify is imported and used
        const hasDOMPurify = content.includes('DOMPurify') || content.includes('sanitize');

        if (!hasDOMPurify) {
          this.stats.xssRisks++;
          this.findings.high.push({
            type: 'XSS_RISK',
            file: filePath,
            message: 'Potential XSS vulnerability - unsafe HTML handling',
            severity: 'high',
            pattern: pattern.toString(),
          });
        } else {
          this.findings.low.push({
            type: 'XSS_CHECK',
            file: filePath,
            message: 'HTML handling detected - verify sanitization',
            severity: 'low',
          });
        }
      }
    });
  }

  // Check for hardcoded secrets
  checkHardcodedSecrets(filePath, content) {
    const secretPatterns = [
      // API keys and tokens
      /['"][a-zA-Z0-9]{32,}['"]/g,
      // JWT secrets
      /secret\s*[:=]\s*['"][^'"]{16,}['"]/gi,
      // Passwords
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      // Private keys
      /-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----/g,
    ];

    // Skip env files
    if (filePath.includes('.env')) return;

    secretPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        // Filter out common false positives
        if (
          !match.includes('process.env') &&
          !match.includes('REPLACE_WITH') &&
          !match.includes('YOUR_') &&
          !match.includes('example') &&
          !match.includes('test') &&
          !match.includes('mock')
        ) {
          this.stats.hardcodedSecrets++;
          this.findings.critical.push({
            type: 'HARDCODED_SECRET',
            file: filePath,
            message: 'Potential hardcoded secret detected',
            severity: 'critical',
            match: match.substring(0, 50) + '...',
          });
        }
      });
    });
  }

  // Check for insecure dependencies and imports
  checkInsecureImports(filePath, content) {
    const insecurePatterns = [
      // Insecure random
      {
        pattern: /Math\.random\(\)/g,
        message: 'Using Math.random() for security-sensitive operations',
      },
      // Weak crypto
      { pattern: /crypto\.createHash\(['"]md5['"]\)/g, message: 'Using MD5 hash (weak algorithm)' },
      {
        pattern: /crypto\.createHash\(['"]sha1['"]\)/g,
        message: 'Using SHA1 hash (weak algorithm)',
      },
      // Unsafe regex
      { pattern: /new RegExp\([^,)]+\)/g, message: 'Dynamic regex construction (potential ReDoS)' },
    ];

    insecurePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        this.stats.insecureImports++;
        this.findings.medium.push({
          type: 'INSECURE_PRACTICE',
          file: filePath,
          message,
          severity: 'medium',
        });
      }
    });
  }

  // Check authentication and authorization
  checkAuthPatterns(filePath, content) {
    // Check for missing auth checks
    if (filePath.includes('/api/') && !filePath.includes('/auth/')) {
      const hasAuthCheck =
        content.includes('getCurrentUser') ||
        content.includes('requireAuth') ||
        content.includes('validateSession');

      if (!hasAuthCheck && (content.includes('DELETE') || content.includes('PUT'))) {
        this.findings.high.push({
          type: 'MISSING_AUTH',
          file: filePath,
          message: 'State-changing endpoint may lack authentication',
          severity: 'high',
        });
      }
    }

    // Check for role-based access control
    if (content.includes('admin') || content.includes('moderator')) {
      const hasRoleCheck = content.includes('requiredRole') || content.includes('hasRole');
      if (!hasRoleCheck) {
        this.findings.medium.push({
          type: 'MISSING_RBAC',
          file: filePath,
          message: 'Admin/moderator functionality without explicit role check',
          severity: 'medium',
        });
      }
    }
  }

  // Check environment configuration
  checkEnvironmentConfig() {
    // Check if .env.local exists
    if (!fs.existsSync(AUDIT_CONFIG.envPath)) {
      this.findings.critical.push({
        type: 'MISSING_ENV',
        file: AUDIT_CONFIG.envPath,
        message: 'Missing .env.local file',
        severity: 'critical',
      });
      return;
    }

    const envContent = fs.readFileSync(AUDIT_CONFIG.envPath, 'utf-8');
    const lines = envContent.split('\n');

    // Check for weak or default secrets
    const secretKeys = ['SESSION_SECRET', 'CSRF_SECRET', 'ENCRYPTION_KEY'];

    lines.forEach(line => {
      const [key, value] = line.split('=');

      if (!key || !value) return;

      // Check secret strength
      if (secretKeys.includes(key.trim())) {
        if (value.includes('REPLACE_WITH') || value.includes('CHANGE_ME')) {
          this.findings.critical.push({
            type: 'DEFAULT_SECRET',
            file: AUDIT_CONFIG.envPath,
            message: `Default/placeholder value for ${key}`,
            severity: 'critical',
          });
        } else if (value.trim().length < 32) {
          this.findings.high.push({
            type: 'WEAK_SECRET',
            file: AUDIT_CONFIG.envPath,
            message: `${key} is too short (< 32 characters)`,
            severity: 'high',
          });
        }
      }

      // Check for development settings in production
      if (key.trim() === 'NODE_ENV' && value.trim() === 'development') {
        this.findings.info.push({
          type: 'DEV_MODE',
          file: AUDIT_CONFIG.envPath,
          message: 'Running in development mode',
          severity: 'info',
        });
      }
    });
  }

  // Scan a file for security issues
  scanFile(filePath) {
    this.stats.filesScanned++;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Run different checks based on file type and location
      if (filePath.includes('/api/')) {
        this.checkAPIRouteSecurity(filePath, content);
      }

      // Run general security checks
      this.checkSQLInjection(filePath, content);
      this.checkXSS(filePath, content);
      this.checkHardcodedSecrets(filePath, content);
      this.checkInsecureImports(filePath, content);
      this.checkAuthPatterns(filePath, content);
    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error.message);
    }
  }

  // Recursively scan directory
  scanDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
    if (!fs.existsSync(dirPath)) {
      this.log(`Directory not found: ${dirPath}`, 'warning');
      return;
    }

    const items = fs.readdirSync(dirPath);

    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and build directories
        if (!item.includes('node_modules') && !item.includes('.next') && !item.includes('dist')) {
          this.scanDirectory(fullPath, extensions);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          this.scanFile(fullPath);
        }
      }
    });
  }

  // Generate security report
  generateReport() {
    const timestamp = new Date().toISOString();
    const totalFindings =
      this.findings.critical.length +
      this.findings.high.length +
      this.findings.medium.length +
      this.findings.low.length;

    const report = {
      timestamp,
      summary: {
        totalFilesScanned: this.stats.filesScanned,
        totalFindings,
        criticalFindings: this.findings.critical.length,
        highFindings: this.findings.high.length,
        mediumFindings: this.findings.medium.length,
        lowFindings: this.findings.low.length,
        infoFindings: this.findings.info.length,
      },
      statistics: this.stats,
      findings: this.findings,
      score: this.calculateSecurityScore(),
    };

    // Save report to file
    const reportPath = `security-audit-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  // Calculate security score
  calculateSecurityScore() {
    const weights = {
      critical: -25,
      high: -15,
      medium: -5,
      low: -2,
    };

    let score = 100;

    score += this.findings.critical.length * weights.critical;
    score += this.findings.high.length * weights.high;
    score += this.findings.medium.length * weights.medium;
    score += this.findings.low.length * weights.low;

    // Bonus points for security features
    const coverageRatio =
      this.stats.apisWithSecurity /
      (this.stats.apisWithSecurity + this.stats.apisWithoutSecurity || 1);
    score += coverageRatio * 10;

    return Math.max(0, Math.min(100, score));
  }

  // Print summary
  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    this.log('SECURITY AUDIT REPORT', 'info');
    console.log('='.repeat(60));

    console.log('\n📊 SUMMARY:');
    console.log(`  Files Scanned: ${report.summary.totalFilesScanned}`);
    console.log(`  Total Findings: ${report.summary.totalFindings}`);

    if (report.summary.criticalFindings > 0) {
      this.log(`  🔴 Critical: ${report.summary.criticalFindings}`, 'error');
    }
    if (report.summary.highFindings > 0) {
      this.log(`  🟠 High: ${report.summary.highFindings}`, 'error');
    }
    if (report.summary.mediumFindings > 0) {
      this.log(`  🟡 Medium: ${report.summary.mediumFindings}`, 'warning');
    }
    if (report.summary.lowFindings > 0) {
      this.log(`  🟢 Low: ${report.summary.lowFindings}`, 'success');
    }
    if (report.summary.infoFindings > 0) {
      this.log(`  ℹ️  Info: ${report.summary.infoFindings}`, 'info');
    }

    console.log('\n📈 STATISTICS:');
    console.log(`  APIs with Security: ${this.stats.apisWithSecurity}`);
    console.log(`  APIs without Security: ${this.stats.apisWithoutSecurity}`);
    console.log(`  SQL Injection Risks: ${this.stats.sqlInjectionRisks}`);
    console.log(`  XSS Risks: ${this.stats.xssRisks}`);
    console.log(`  Hardcoded Secrets: ${this.stats.hardcodedSecrets}`);
    console.log(`  Insecure Practices: ${this.stats.insecureImports}`);

    const scoreColor = report.score >= 80 ? 'success' : report.score >= 60 ? 'warning' : 'error';

    console.log('\n');
    this.log(`🛡️  SECURITY SCORE: ${report.score}/100`, scoreColor);

    // Print critical findings
    if (this.findings.critical.length > 0) {
      console.log('\n❌ CRITICAL FINDINGS:');
      this.findings.critical.slice(0, 5).forEach(finding => {
        console.log(`  - ${finding.message} (${finding.file})`);
      });
      if (this.findings.critical.length > 5) {
        console.log(`  ... and ${this.findings.critical.length - 5} more`);
      }
    }

    // Print recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.stats.apisWithoutSecurity > 0) {
      console.log('  1. Add withSecurity wrapper to all API routes');
    }
    if (this.stats.sqlInjectionRisks > 0) {
      console.log('  2. Use parameterized queries for all database operations');
    }
    if (this.stats.xssRisks > 0) {
      console.log('  3. Sanitize all user input with DOMPurify');
    }
    if (this.stats.hardcodedSecrets > 0) {
      console.log('  4. Move all secrets to environment variables');
    }
    if (report.score < 80) {
      console.log('  5. Address all critical and high severity findings immediately');
    }

    console.log('\n' + '='.repeat(60));
  }

  // Run the audit
  async run() {
    this.log('\n🔍 Starting security audit...', 'info');

    // Check environment configuration
    this.log('\nChecking environment configuration...', 'info');
    this.checkEnvironmentConfig();

    // Scan API routes
    this.log('\nScanning API routes...', 'info');
    this.scanDirectory(AUDIT_CONFIG.apiRoutesPath);

    // Scan library code
    this.log('\nScanning library code...', 'info');
    this.scanDirectory(AUDIT_CONFIG.libPath);

    // Scan components
    this.log('\nScanning components...', 'info');
    this.scanDirectory(AUDIT_CONFIG.componentsPath);

    // Generate and print report
    const report = this.generateReport();
    this.printSummary(report);

    // Exit with appropriate code
    if (report.summary.criticalFindings > 0) {
      process.exit(1); // Fail CI/CD if critical issues found
    } else if (report.score < 60) {
      process.exit(1); // Fail if score too low
    } else {
      process.exit(0);
    }
  }
}

// Run the audit
const auditor = new SecurityAuditor();
auditor.run().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
