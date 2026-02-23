#!/usr/bin/env node

/**
 * Comprehensive Security Audit for Veritable Games Platform
 * Performs deep security analysis with actionable remediation steps
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
  bold: '\x1b[1m',
};

class ComprehensiveSecurityAuditor {
  constructor() {
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
      passed: [],
    };
    this.stats = {
      totalFiles: 0,
      apiRoutes: 0,
      protectedRoutes: 0,
      unprotectedRoutes: 0,
      csrfProtected: 0,
      rateLimited: 0,
      authenticatedEndpoints: 0,
      sanitizedContent: 0,
      unsanitizedContent: 0,
      parameterizedQueries: 0,
      unsafeQueries: 0,
      securePasswords: 0,
      weakPasswords: 0,
      sessionSecure: 0,
      sessionInsecure: 0,
    };
    this.apiRoutes = [];
    this.componentFiles = [];
  }

  log(message, level = 'info') {
    const colorMap = {
      critical: colors.red + colors.bold,
      error: colors.red,
      warning: colors.yellow,
      success: colors.green,
      info: colors.cyan,
      dim: '\x1b[2m',
    };
    console.log(`${colorMap[level] || ''}${message}${colors.reset}`);
  }

  /**
   * 1. Authentication System Audit
   */
  auditAuthenticationSystem(filePath, content) {
    // Check session configuration
    if (filePath.includes('auth/utils') || filePath.includes('auth/service')) {
      // Check for secure session cookie settings
      if (
        content.includes('httpOnly: true') &&
        content.includes('secure: true') &&
        content.includes("sameSite: 'strict'")
      ) {
        this.stats.sessionSecure++;
        this.findings.passed.push({
          type: 'SECURE_SESSION',
          file: filePath,
          message: 'Session cookies properly configured with httpOnly, secure, and sameSite',
        });
      } else {
        this.stats.sessionInsecure++;
        this.findings.high.push({
          type: 'INSECURE_SESSION',
          file: filePath,
          message: 'Session cookies missing security attributes',
          remediation: "Ensure cookies have: httpOnly: true, secure: true, sameSite: 'strict'",
        });
      }

      // Check session expiry
      if (content.match(/maxAge:\s*(\d+)/)) {
        const maxAge = parseInt(RegExp.$1);
        if (maxAge > 30 * 24 * 60 * 60) {
          // More than 30 days
          this.findings.medium.push({
            type: 'LONG_SESSION',
            file: filePath,
            message: `Session timeout too long: ${maxAge / (24 * 60 * 60)} days`,
            remediation: 'Reduce session timeout to 30 days or less',
          });
        }
      }

      // Check for session regeneration
      if (!content.includes('regenerateSession')) {
        this.findings.medium.push({
          type: 'NO_SESSION_REGENERATION',
          file: filePath,
          message: 'Missing session regeneration on authentication state changes',
          remediation: 'Regenerate session ID after login/logout to prevent fixation attacks',
        });
      }
    }

    // Check for timing attack protection
    if (filePath.includes('timing-safe')) {
      if (content.includes('artificialDelay') && content.includes('getDummyHash')) {
        this.findings.passed.push({
          type: 'TIMING_ATTACK_PROTECTION',
          file: filePath,
          message: 'Timing attack protection properly implemented',
        });
      }
    }
  }

  /**
   * 2. API Route Security Coverage
   */
  auditAPIRoute(filePath, content) {
    this.stats.apiRoutes++;
    this.apiRoutes.push(filePath);

    // Check for withSecurity wrapper
    const hasWithSecurity = content.includes('withSecurity');
    const hasExportedHandlers =
      /export\s+(const|async\s+function|function)\s+(GET|POST|PUT|DELETE|PATCH)/g.test(content);

    if (hasExportedHandlers) {
      if (hasWithSecurity) {
        this.stats.protectedRoutes++;

        // Check CSRF configuration
        if (content.includes('csrfEnabled: false')) {
          this.findings.high.push({
            type: 'CSRF_DISABLED',
            file: filePath,
            message: 'CSRF protection explicitly disabled',
            remediation: 'Remove csrfEnabled: false or set to true',
          });
        } else {
          this.stats.csrfProtected++;
        }

        // Check rate limiting
        if (content.includes('rateLimitConfig') || content.includes('rateLimit')) {
          this.stats.rateLimited++;
        } else {
          this.findings.low.push({
            type: 'NO_RATE_LIMIT',
            file: filePath,
            message: 'No explicit rate limiting configured',
            remediation: "Add rateLimitConfig: 'api' or appropriate tier",
          });
        }

        // Check authentication requirement
        if (content.includes('requireAuth: true') || content.includes('requiredRole')) {
          this.stats.authenticatedEndpoints++;
        }
      } else {
        this.stats.unprotectedRoutes++;
        this.findings.critical.push({
          type: 'UNPROTECTED_API',
          file: filePath,
          message: 'API route missing withSecurity wrapper',
          remediation: 'Wrap all exported handlers with withSecurity()',
        });
      }
    }

    // Check for exposed sensitive data in responses
    if (content.includes('password') && !content.includes('password_hash')) {
      if (content.match(/password['"]\s*:\s*[^,}]+/)) {
        this.findings.critical.push({
          type: 'EXPOSED_PASSWORD',
          file: filePath,
          message: 'Potentially exposing password in API response',
          remediation: 'Never include passwords in API responses, even hashed ones',
        });
      }
    }

    // Check admin endpoints
    if (filePath.includes('/admin/')) {
      if (!content.includes("role === 'admin'") && !content.includes("requiredRole: 'admin'")) {
        this.findings.critical.push({
          type: 'UNPROTECTED_ADMIN',
          file: filePath,
          message: 'Admin endpoint without explicit admin role check',
          remediation: "Add requiredRole: 'admin' to withSecurity options",
        });
      }
    }
  }

  /**
   * 3. CSRF Protection Audit
   */
  auditCSRFProtection(filePath, content) {
    // Check CSRF token generation
    if (filePath.includes('csrf') && !filePath.includes('test')) {
      // Check for session binding
      if (content.includes('sessionId') && content.includes('binding')) {
        this.findings.passed.push({
          type: 'CSRF_SESSION_BINDING',
          file: filePath,
          message: 'CSRF tokens properly bound to sessions',
        });
      }

      // Check for token rotation
      if (content.includes('rotate') || content.includes('refresh')) {
        this.findings.passed.push({
          type: 'CSRF_TOKEN_ROTATION',
          file: filePath,
          message: 'CSRF token rotation implemented',
        });
      }
    }
  }

  /**
   * 4. Rate Limiting Audit
   */
  auditRateLimiting(filePath, content) {
    if (filePath.includes('rate-limit') || filePath.includes('rateLimit')) {
      // Check for emergency rate limits
      if (content.includes('EMERGENCY_RATE_LIMITS')) {
        this.findings.passed.push({
          type: 'EMERGENCY_RATE_LIMITS',
          file: filePath,
          message: 'Emergency rate limiting implemented for attack mitigation',
        });
      }

      // Check for role-based rate limits
      if (content.includes('role-based') || content.includes('contextual')) {
        this.findings.passed.push({
          type: 'ROLE_BASED_LIMITS',
          file: filePath,
          message: 'Role-based rate limiting implemented',
        });
      }

      // Check for monitoring
      if (content.includes('logViolation') || content.includes('monitor')) {
        this.findings.passed.push({
          type: 'RATE_LIMIT_MONITORING',
          file: filePath,
          message: 'Rate limit violation monitoring in place',
        });
      }
    }
  }

  /**
   * 5. Authorization and RBAC Audit
   */
  auditAuthorization(filePath, content) {
    // Check for proper role hierarchy
    if (content.includes('role') && (content.includes('admin') || content.includes('moderator'))) {
      // Check for role hierarchy implementation
      if (
        content.includes("['admin', 'moderator'].includes") ||
        content.includes("role === 'admin' || role === 'moderator'")
      ) {
        this.findings.passed.push({
          type: 'ROLE_HIERARCHY',
          file: filePath,
          message: 'Role hierarchy properly implemented',
        });
      }

      // Check for permission-based access
      if (content.includes('hasPermission') || content.includes('getUserPermissions')) {
        this.findings.passed.push({
          type: 'PERMISSION_BASED',
          file: filePath,
          message: 'Permission-based access control implemented',
        });
      }
    }
  }

  /**
   * 6. Content Sanitization Audit
   */
  auditContentSanitization(filePath, content) {
    // Skip test files and type definitions
    if (filePath.includes('.test.') || filePath.includes('.d.ts')) return;

    // Check for dangerous HTML handling
    if (content.includes('dangerouslySetInnerHTML')) {
      if (content.includes('DOMPurify') || content.includes('sanitize')) {
        this.stats.sanitizedContent++;
        this.findings.passed.push({
          type: 'SANITIZED_HTML',
          file: filePath,
          message: 'HTML content properly sanitized with DOMPurify',
        });
      } else {
        this.stats.unsanitizedContent++;
        this.findings.critical.push({
          type: 'UNSANITIZED_HTML',
          file: filePath,
          message: 'Using dangerouslySetInnerHTML without DOMPurify sanitization',
          remediation: 'Import and use DOMPurify.sanitize() before rendering HTML',
        });
      }
    }

    // Check for eval usage
    if (content.includes('eval(') || content.includes('new Function(')) {
      this.findings.critical.push({
        type: 'EVAL_USAGE',
        file: filePath,
        message: 'Using eval() or Function constructor - major XSS risk',
        remediation: 'Remove eval() and Function constructor usage',
      });
    }

    // Check for innerHTML usage
    if (content.includes('innerHTML =')) {
      this.findings.high.push({
        type: 'INNERHTML_USAGE',
        file: filePath,
        message: 'Direct innerHTML assignment detected',
        remediation: 'Use textContent or sanitized HTML rendering',
      });
    }
  }

  /**
   * 7. SQL Injection Audit
   */
  auditSQLInjection(filePath, content) {
    // Check for string concatenation in queries
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE'];
    const hasSQLQuery = sqlKeywords.some(keyword => content.includes(keyword));

    if (hasSQLQuery) {
      // Check for parameterized queries
      if (content.includes('.prepare(') && content.includes('?')) {
        this.stats.parameterizedQueries++;
      } else if (content.includes('.prepare(')) {
        // Check for dangerous patterns
        const dangerousPatterns = [
          /`[^`]*\$\{[^}]+\}[^`]*`/g, // Template literals in queries
          /['"][^'"]*\+[^'"]*['"]/g, // String concatenation
        ];

        dangerousPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            this.stats.unsafeQueries++;
            this.findings.critical.push({
              type: 'SQL_INJECTION_RISK',
              file: filePath,
              message: 'SQL query using string concatenation or template literals',
              remediation: 'Use parameterized queries with ? placeholders',
            });
          }
        });
      }

      // Check for raw exec usage
      if (content.includes('.exec(') && content.includes('${')) {
        this.findings.critical.push({
          type: 'UNSAFE_EXEC',
          file: filePath,
          message: 'Using exec() with dynamic SQL',
          remediation: 'Use prepare() with parameters instead of exec()',
        });
      }
    }
  }

  /**
   * 8. XSS Attack Vector Audit
   */
  auditXSSVectors(filePath, content) {
    // Check for URL parameter usage without validation
    if (content.includes('searchParams.get') || content.includes('query.')) {
      if (!content.includes('validate') && !content.includes('sanitize')) {
        this.findings.medium.push({
          type: 'UNVALIDATED_INPUT',
          file: filePath,
          message: 'Using URL parameters without validation',
          remediation: 'Validate and sanitize all user input',
        });
      }
    }

    // Check for document.cookie access
    if (content.includes('document.cookie')) {
      this.findings.high.push({
        type: 'COOKIE_ACCESS',
        file: filePath,
        message: 'Direct document.cookie access detected',
        remediation: 'Use httpOnly cookies and server-side session management',
      });
    }

    // Check for localStorage/sessionStorage of sensitive data
    if (
      (content.includes('localStorage.setItem') || content.includes('sessionStorage.setItem')) &&
      (content.includes('token') || content.includes('password') || content.includes('session'))
    ) {
      this.findings.high.push({
        type: 'SENSITIVE_STORAGE',
        file: filePath,
        message: 'Storing sensitive data in localStorage/sessionStorage',
        remediation: 'Never store sensitive data in browser storage',
      });
    }
  }

  /**
   * 9. Password Security Audit
   */
  auditPasswordSecurity(filePath, content) {
    // Check for bcrypt usage
    if (content.includes('bcrypt')) {
      // Check rounds
      const roundsMatch = content.match(/bcrypt\.hash\([^,]+,\s*(\d+)/);
      if (roundsMatch) {
        const rounds = parseInt(roundsMatch[1]);
        if (rounds < 12) {
          this.findings.medium.push({
            type: 'WEAK_BCRYPT',
            file: filePath,
            message: `Bcrypt using only ${rounds} rounds (minimum 12 recommended)`,
            remediation: 'Use at least 12 rounds for bcrypt hashing',
          });
        } else {
          this.stats.securePasswords++;
        }
      }
    }

    // Check password validation rules
    if (content.includes('validatePassword')) {
      const hasComplexity =
        content.includes('uppercase') &&
        content.includes('lowercase') &&
        content.includes('number') &&
        content.includes('special');

      const hasLength = content.match(/length\s*[<>]=?\s*(\d+)/);
      const minLength = hasLength ? parseInt(hasLength[1]) : 0;

      if (hasComplexity && minLength >= 12) {
        this.stats.securePasswords++;
        this.findings.passed.push({
          type: 'STRONG_PASSWORD_POLICY',
          file: filePath,
          message: 'Strong password policy enforced',
        });
      } else if (minLength < 12) {
        this.stats.weakPasswords++;
        this.findings.medium.push({
          type: 'WEAK_PASSWORD_POLICY',
          file: filePath,
          message: `Password minimum length only ${minLength} characters`,
          remediation: 'Require minimum 12 characters for passwords',
        });
      }
    }
  }

  /**
   * 10. Security Headers Audit
   */
  auditSecurityHeaders(filePath, content) {
    if (
      filePath.includes('csp') ||
      (filePath.includes('security') && filePath.includes('header'))
    ) {
      const headers = [
        { name: 'Content-Security-Policy', required: true },
        { name: 'X-Frame-Options', required: true },
        { name: 'X-Content-Type-Options', required: true },
        { name: 'Referrer-Policy', required: true },
        { name: 'Permissions-Policy', required: false },
      ];

      headers.forEach(header => {
        if (content.includes(header.name)) {
          this.findings.passed.push({
            type: 'SECURITY_HEADER',
            file: filePath,
            message: `${header.name} header configured`,
          });
        } else if (header.required) {
          this.findings.medium.push({
            type: 'MISSING_HEADER',
            file: filePath,
            message: `Missing ${header.name} header`,
            remediation: `Add ${header.name} to security headers`,
          });
        }
      });
    }
  }

  /**
   * Scan a single file
   */
  scanFile(filePath) {
    this.stats.totalFiles++;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Run appropriate audits based on file path and content
      if (filePath.includes('/api/')) {
        this.auditAPIRoute(filePath, content);
      }

      if (filePath.includes('auth')) {
        this.auditAuthenticationSystem(filePath, content);
      }

      if (filePath.includes('csrf')) {
        this.auditCSRFProtection(filePath, content);
      }

      if (filePath.includes('rate') && filePath.includes('limit')) {
        this.auditRateLimiting(filePath, content);
      }

      // Run general security checks on all files
      this.auditAuthorization(filePath, content);
      this.auditContentSanitization(filePath, content);
      this.auditSQLInjection(filePath, content);
      this.auditXSSVectors(filePath, content);
      this.auditPasswordSecurity(filePath, content);
      this.auditSecurityHeaders(filePath, content);
    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error.message);
    }
  }

  /**
   * Recursively scan directory
   */
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
        if (
          !item.includes('node_modules') &&
          !item.includes('.next') &&
          !item.includes('dist') &&
          !item.includes('__tests__')
        ) {
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

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const timestamp = new Date().toISOString();
    const totalIssues =
      this.findings.critical.length +
      this.findings.high.length +
      this.findings.medium.length +
      this.findings.low.length;

    // Calculate API coverage
    const apiCoverage =
      this.stats.apiRoutes > 0
        ? Math.round((this.stats.protectedRoutes / this.stats.apiRoutes) * 100)
        : 0;

    // Calculate security score
    const score = this.calculateSecurityScore();

    const report = {
      timestamp,
      summary: {
        score,
        totalFiles: this.stats.totalFiles,
        totalIssues,
        apiCoverage: `${apiCoverage}%`,
        criticalFindings: this.findings.critical.length,
        highFindings: this.findings.high.length,
        mediumFindings: this.findings.medium.length,
        lowFindings: this.findings.low.length,
        passed: this.findings.passed.length,
      },
      coverage: {
        apiRoutes: {
          total: this.stats.apiRoutes,
          protected: this.stats.protectedRoutes,
          unprotected: this.stats.unprotectedRoutes,
          coverage: `${apiCoverage}%`,
        },
        csrf: {
          protected: this.stats.csrfProtected,
          coverage: `${this.stats.apiRoutes > 0 ? Math.round((this.stats.csrfProtected / this.stats.apiRoutes) * 100) : 0}%`,
        },
        rateLimiting: {
          configured: this.stats.rateLimited,
          coverage: `${this.stats.apiRoutes > 0 ? Math.round((this.stats.rateLimited / this.stats.apiRoutes) * 100) : 0}%`,
        },
        authentication: {
          endpoints: this.stats.authenticatedEndpoints,
          coverage: `${this.stats.apiRoutes > 0 ? Math.round((this.stats.authenticatedEndpoints / this.stats.apiRoutes) * 100) : 0}%`,
        },
      },
      findings: this.findings,
      recommendations: this.generateRecommendations(),
    };

    // Save detailed report
    const reportPath = `comprehensive-security-audit-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore() {
    let score = 100;

    // Deduct points for issues
    score -= this.findings.critical.length * 20;
    score -= this.findings.high.length * 10;
    score -= this.findings.medium.length * 3;
    score -= this.findings.low.length * 1;

    // Add points for good practices
    score += Math.min(20, this.findings.passed.length);

    // API coverage bonus
    const apiCoverage =
      this.stats.apiRoutes > 0 ? this.stats.protectedRoutes / this.stats.apiRoutes : 0;
    score += apiCoverage * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate prioritized recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Critical recommendations
    if (this.stats.unprotectedRoutes > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Unprotected API Routes',
        count: this.stats.unprotectedRoutes,
        action: 'Wrap all API route handlers with withSecurity() middleware',
        impact: 'Prevents unauthorized access and CSRF attacks',
      });
    }

    if (this.stats.unsafeQueries > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'SQL Injection Vulnerabilities',
        count: this.stats.unsafeQueries,
        action: 'Replace string concatenation with parameterized queries using ? placeholders',
        impact: 'Prevents database compromise and data breaches',
      });
    }

    if (this.stats.unsanitizedContent > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'XSS Vulnerabilities',
        count: this.stats.unsanitizedContent,
        action: 'Sanitize all user-generated content with DOMPurify before rendering',
        impact: 'Prevents cross-site scripting attacks',
      });
    }

    // High priority recommendations
    const adminUnprotected = this.findings.critical.filter(
      f => f.type === 'UNPROTECTED_ADMIN'
    ).length;
    if (adminUnprotected > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Unprotected Admin Endpoints',
        count: adminUnprotected,
        action: "Add requiredRole: 'admin' to all admin API routes",
        impact: 'Prevents privilege escalation attacks',
      });
    }

    // Medium priority recommendations
    if (this.stats.weakPasswords > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Weak Password Policy',
        count: this.stats.weakPasswords,
        action: 'Enforce minimum 12 characters with complexity requirements',
        impact: 'Reduces account compromise risk',
      });
    }

    return recommendations;
  }

  /**
   * Print report summary
   */
  printReport(report) {
    console.log('\n' + '='.repeat(80));
    this.log('COMPREHENSIVE SECURITY AUDIT REPORT', 'info');
    console.log('='.repeat(80));

    // Security Score
    const scoreColor =
      report.summary.score >= 80 ? 'success' : report.summary.score >= 60 ? 'warning' : 'error';
    console.log('\n' + colors.bold + '📊 SECURITY SCORE' + colors.reset);
    this.log(`   Overall Score: ${report.summary.score}/100`, scoreColor);
    console.log(`   Files Scanned: ${report.summary.totalFiles}`);
    console.log(`   Total Issues: ${report.summary.totalIssues}`);
    console.log(`   Passed Checks: ${report.summary.passed}`);

    // Coverage Metrics
    console.log('\n' + colors.bold + '🛡️  SECURITY COVERAGE' + colors.reset);
    console.log(
      `   API Routes: ${report.coverage.apiRoutes.coverage} (${report.coverage.apiRoutes.protected}/${report.coverage.apiRoutes.total})`
    );
    console.log(`   CSRF Protection: ${report.coverage.csrf.coverage}`);
    console.log(`   Rate Limiting: ${report.coverage.rateLimiting.coverage}`);
    console.log(`   Authentication: ${report.coverage.authentication.coverage}`);

    // Findings Summary
    console.log('\n' + colors.bold + '🔍 FINDINGS SUMMARY' + colors.reset);
    if (report.summary.criticalFindings > 0) {
      this.log(`   🔴 Critical: ${report.summary.criticalFindings}`, 'critical');
    }
    if (report.summary.highFindings > 0) {
      this.log(`   🟠 High: ${report.summary.highFindings}`, 'error');
    }
    if (report.summary.mediumFindings > 0) {
      this.log(`   🟡 Medium: ${report.summary.mediumFindings}`, 'warning');
    }
    if (report.summary.lowFindings > 0) {
      this.log(`   🟢 Low: ${report.summary.lowFindings}`, 'success');
    }

    // Critical Issues Detail
    if (this.findings.critical.length > 0) {
      console.log(
        '\n' + colors.bold + '❌ CRITICAL ISSUES (Immediate Action Required)' + colors.reset
      );
      const grouped = {};
      this.findings.critical.forEach(finding => {
        if (!grouped[finding.type]) grouped[finding.type] = [];
        grouped[finding.type].push(finding);
      });

      Object.entries(grouped).forEach(([type, findings]) => {
        this.log(`\n   ${type} (${findings.length} instances)`, 'error');
        findings.slice(0, 3).forEach(f => {
          console.log(`      📁 ${f.file.replace(/^.*\/frontend\//, '')}`);
          if (f.remediation) {
            console.log(`      ✅ Fix: ${f.remediation}`);
          }
        });
        if (findings.length > 3) {
          console.log(`      ... and ${findings.length - 3} more`);
        }
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n' + colors.bold + '💡 PRIORITIZED RECOMMENDATIONS' + colors.reset);
      report.recommendations.forEach((rec, index) => {
        const priorityColor =
          rec.priority === 'CRITICAL' ? 'error' : rec.priority === 'HIGH' ? 'warning' : 'info';
        this.log(`\n   ${index + 1}. [${rec.priority}] ${rec.issue}`, priorityColor);
        console.log(`      Affected: ${rec.count} instances`);
        console.log(`      Action: ${rec.action}`);
        console.log(`      Impact: ${rec.impact}`);
      });
    }

    // Success Stories
    if (this.findings.passed.length > 0) {
      console.log('\n' + colors.bold + '✅ SECURITY STRENGTHS' + colors.reset);
      const strengths = {};
      this.findings.passed.forEach(finding => {
        if (!strengths[finding.type]) strengths[finding.type] = 0;
        strengths[finding.type]++;
      });

      Object.entries(strengths).forEach(([type, count]) => {
        this.log(`   ✓ ${type}: ${count} instances`, 'success');
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Full report saved to: comprehensive-security-audit-${Date.now()}.json`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Run the comprehensive audit
   */
  async run() {
    this.log('\n🔒 Starting Comprehensive Security Audit...', 'info');
    this.log('=' + '='.repeat(79), 'dim');

    // Scan all relevant directories
    const directories = [
      { path: 'src/app/api', name: 'API Routes' },
      { path: 'src/lib', name: 'Library Code' },
      { path: 'src/components', name: 'Components' },
      { path: 'src/hooks', name: 'Hooks' },
    ];

    directories.forEach(dir => {
      this.log(`\n📁 Scanning ${dir.name}...`, 'info');
      this.scanDirectory(dir.path);
    });

    // Generate and print report
    const report = this.generateReport();
    this.printReport(report);

    // Return exit code based on critical findings
    if (report.summary.criticalFindings > 0) {
      this.log('⛔ Audit failed: Critical security issues found', 'error');
      process.exit(1);
    } else if (report.summary.score < 60) {
      this.log('⚠️  Audit failed: Security score too low', 'warning');
      process.exit(1);
    } else {
      this.log('✅ Audit completed successfully', 'success');
      process.exit(0);
    }
  }
}

// Run the audit
const auditor = new ComprehensiveSecurityAuditor();
auditor.run().catch(error => {
  console.error('Audit failed:', error);
  process.exit(1);
});
