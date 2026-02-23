/**
 * CSP Violation Monitoring System
 *
 * Provides comprehensive monitoring, analysis, and alerting for Content Security Policy violations.
 * Tracks patterns, identifies attack attempts, and provides actionable insights.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
// Rate limiting functionality not currently needed for CSP monitoring
// import { createRateLimit } from './rateLimit';

export interface CSPViolation {
  id?: number;
  timestamp: number;
  document_uri: string;
  violated_directive: string;
  blocked_uri: string;
  source_file?: string;
  line_number?: number;
  column_number?: number;
  script_sample?: string;
  referrer?: string;
  status_code?: number;
  client_ip?: string;
  user_agent?: string;
  is_suspicious?: boolean;
  pattern_id?: string;
}

export interface CSPViolationPattern {
  pattern: string;
  count: number;
  first_seen: Date;
  last_seen: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_attack?: boolean;
}

export interface CSPMonitoringStats {
  total_violations: number;
  unique_violations: number;
  suspicious_violations: number;
  violations_24h: number;
  top_violated_directives: Array<{ directive: string; count: number }>;
  top_blocked_uris: Array<{ uri: string; count: number }>;
  attack_patterns: CSPViolationPattern[];
}

/**
 * Rate limit entry from csp_rate_limits table
 */
interface CSPRateLimitRow {
  client_ip: string;
  report_count: number;
  window_start: number;
  is_blocked: boolean | number;
  blocked_until?: number;
}

class CSPMonitor {
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly MAX_REPORTS_PER_IP = 10; // Max 10 reports per minute per IP
  private readonly SUSPICIOUS_PATTERNS = [
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<script>/i,
    /eval\(/i,
    /alert\(/i,
    /document\.cookie/i,
    /onerror=/i,
    /onclick=/i,
    /base64/i,
  ];

  constructor() {
    this.initializeTables();
  }

  /**
   * Initialize CSP monitoring tables
   */
  private async initializeTables() {
    try {
      // CSP violations table
      await dbAdapter.query(
        `
        CREATE TABLE IF NOT EXISTS csp_violations (
          id SERIAL PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          document_uri TEXT NOT NULL,
          violated_directive TEXT NOT NULL,
          blocked_uri TEXT NOT NULL,
          source_file TEXT,
          line_number INTEGER,
          column_number INTEGER,
          script_sample TEXT,
          referrer TEXT,
          status_code INTEGER,
          client_ip TEXT,
          user_agent TEXT,
          is_suspicious BOOLEAN DEFAULT false,
          pattern_id TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `,
        [],
        { schema: 'system' }
      );

      // Indexes for efficient querying
      await dbAdapter.query(
        `
        CREATE INDEX IF NOT EXISTS idx_csp_violations_timestamp
        ON csp_violations (timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_csp_violations_directive
        ON csp_violations (violated_directive);

        CREATE INDEX IF NOT EXISTS idx_csp_violations_ip
        ON csp_violations (client_ip);

        CREATE INDEX IF NOT EXISTS idx_csp_violations_suspicious
        ON csp_violations (is_suspicious);
      `,
        [],
        { schema: 'system' }
      );

      // CSP patterns table for tracking attack patterns
      await dbAdapter.query(
        `
        CREATE TABLE IF NOT EXISTS csp_patterns (
          id SERIAL PRIMARY KEY,
          pattern_hash TEXT UNIQUE NOT NULL,
          pattern_description TEXT,
          first_seen TIMESTAMP DEFAULT NOW(),
          last_seen TIMESTAMP DEFAULT NOW(),
          occurrence_count INTEGER DEFAULT 1,
          severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
          is_attack BOOLEAN DEFAULT false,
          auto_blocked BOOLEAN DEFAULT false
        )
      `,
        [],
        { schema: 'system' }
      );

      // Rate limiting table
      await dbAdapter.query(
        `
        CREATE TABLE IF NOT EXISTS csp_rate_limits (
          client_ip TEXT PRIMARY KEY,
          report_count INTEGER DEFAULT 0,
          window_start BIGINT NOT NULL,
          is_blocked BOOLEAN DEFAULT false,
          blocked_until BIGINT
        )
      `,
        [],
        { schema: 'system' }
      );
    } catch (error) {
      logger.error('Failed to initialize CSP monitoring tables:', error);
    }
  }

  /**
   * Log a CSP violation with analysis
   */
  async logViolation(
    violation: Partial<CSPViolation>,
    clientIP?: string,
    userAgent?: string
  ): Promise<{ logged: boolean; rateLimited?: boolean; suspicious?: boolean }> {
    try {
      // Check rate limiting
      if (clientIP) {
        const rateLimitCheck = await this.checkRateLimit(clientIP);
        if (!rateLimitCheck.allowed) {
          return { logged: false, rateLimited: true };
        }
      }

      // Analyze violation for suspicious patterns
      const isSuspicious = this.analyzeViolation(violation);

      // Store violation
      await dbAdapter.query(
        `
        INSERT INTO csp_violations (
          timestamp, document_uri, violated_directive, blocked_uri,
          source_file, line_number, column_number, script_sample,
          referrer, status_code, client_ip, user_agent, is_suspicious
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
        [
          Date.now(),
          violation.document_uri || '',
          violation.violated_directive || '',
          violation.blocked_uri || '',
          violation.source_file,
          violation.line_number,
          violation.column_number,
          violation.script_sample?.substring(0, 500), // Limit sample size
          violation.referrer,
          violation.status_code,
          clientIP,
          userAgent,
          isSuspicious,
        ],
        { schema: 'system' }
      );

      // Update pattern tracking
      if (isSuspicious) {
        await this.updatePatternTracking(violation);
      }

      // Alert on critical violations
      if (isSuspicious) {
        this.alertOnSuspiciousViolation(violation, clientIP);
      }

      return { logged: true, suspicious: isSuspicious };
    } catch (error) {
      logger.error('Failed to log CSP violation:', error);
      return { logged: false };
    }
  }

  /**
   * Check rate limiting for IP
   */
  private async checkRateLimit(clientIP: string): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;

    // Get or create rate limit entry
    const result = await dbAdapter.query(
      `SELECT * FROM csp_rate_limits WHERE client_ip = $1`,
      [clientIP],
      { schema: 'system' }
    );

    let rateLimit = result.rows[0] as CSPRateLimitRow | undefined;

    if (!rateLimit) {
      // Create new entry
      await dbAdapter.query(
        `INSERT INTO csp_rate_limits (client_ip, report_count, window_start)
         VALUES ($1, 1, $2)`,
        [clientIP, now],
        { schema: 'system' }
      );
      return { allowed: true, remaining: this.MAX_REPORTS_PER_IP - 1 };
    }

    // Check if blocked
    if (rateLimit.is_blocked && rateLimit.blocked_until && rateLimit.blocked_until > now) {
      return { allowed: false, remaining: 0 };
    }

    // Reset window if expired
    if (rateLimit.window_start < windowStart) {
      await dbAdapter.query(
        `UPDATE csp_rate_limits
         SET report_count = 1, window_start = $1, is_blocked = false
         WHERE client_ip = $2`,
        [now, clientIP],
        { schema: 'system' }
      );
      return { allowed: true, remaining: this.MAX_REPORTS_PER_IP - 1 };
    }

    // Check limit
    if (rateLimit.report_count >= this.MAX_REPORTS_PER_IP) {
      // Block for 5 minutes
      const blockedUntil = now + 5 * 60 * 1000;
      await dbAdapter.query(
        `UPDATE csp_rate_limits
         SET is_blocked = true, blocked_until = $1
         WHERE client_ip = $2`,
        [blockedUntil, clientIP],
        { schema: 'system' }
      );

      logger.warn('CSP report rate limit exceeded', { clientIP, count: rateLimit.report_count });
      return { allowed: false, remaining: 0 };
    }

    // Increment counter
    await dbAdapter.query(
      `UPDATE csp_rate_limits
       SET report_count = report_count + 1
       WHERE client_ip = $1`,
      [clientIP],
      { schema: 'system' }
    );

    return { allowed: true, remaining: this.MAX_REPORTS_PER_IP - rateLimit.report_count - 1 };
  }

  /**
   * Analyze violation for suspicious patterns
   */
  private analyzeViolation(violation: Partial<CSPViolation>): boolean {
    const checkString = `${violation.blocked_uri} ${violation.script_sample} ${violation.source_file}`;

    // Check against suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(checkString)) {
        return true;
      }
    }

    // Check for common XSS indicators
    if (
      violation.violated_directive?.includes('script-src') &&
      violation.blocked_uri?.includes('inline')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Update pattern tracking for suspicious violations
   */
  private async updatePatternTracking(violation: Partial<CSPViolation>) {
    const patternHash = this.generatePatternHash(violation);

    const result = await dbAdapter.query(
      `SELECT * FROM csp_patterns WHERE pattern_hash = $1`,
      [patternHash],
      { schema: 'system' }
    );

    const existing = result.rows[0];

    if (existing) {
      await dbAdapter.query(
        `UPDATE csp_patterns
         SET occurrence_count = occurrence_count + 1,
             last_seen = NOW()
         WHERE pattern_hash = $1`,
        [patternHash],
        { schema: 'system' }
      );
    } else {
      const severity = this.calculateSeverity(violation);
      await dbAdapter.query(
        `INSERT INTO csp_patterns (pattern_hash, pattern_description, severity, is_attack)
         VALUES ($1, $2, $3, $4)`,
        [
          patternHash,
          `${violation.violated_directive}: ${violation.blocked_uri}`,
          severity,
          severity === 'critical',
        ],
        { schema: 'system' }
      );
    }
  }

  /**
   * Generate hash for pattern identification
   */
  private generatePatternHash(violation: Partial<CSPViolation>): string {
    const crypto = require('crypto');
    const data = `${violation.violated_directive}:${violation.blocked_uri}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Calculate severity of violation
   */
  private calculateSeverity(
    violation: Partial<CSPViolation>
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      violation.blocked_uri?.includes('javascript:') ||
      violation.blocked_uri?.includes('data:text/html')
    ) {
      return 'critical';
    }

    if (violation.violated_directive?.includes('script-src')) {
      return 'high';
    }

    if (violation.violated_directive?.includes('style-src')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Alert on suspicious violations
   */
  private alertOnSuspiciousViolation(violation: Partial<CSPViolation>, clientIP?: string) {
    logger.security('Suspicious CSP violation detected', {
      violatedDirective: violation.violated_directive,
      blockedUri: violation.blocked_uri,
      clientIP,
      scriptSample: violation.script_sample?.substring(0, 100),
    });

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry or monitoring service
    }
  }

  /**
   * Get monitoring statistics
   */
  async getStats(hours: number = 24): Promise<CSPMonitoringStats> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    // Total violations
    const totalResult = await dbAdapter.query(`SELECT COUNT(*) as count FROM csp_violations`, [], {
      schema: 'system',
    });

    // Unique violations
    const uniqueResult = await dbAdapter.query(
      `SELECT COUNT(DISTINCT violated_directive || ':' || blocked_uri) as count
       FROM csp_violations`,
      [],
      { schema: 'system' }
    );

    // Suspicious violations
    const suspiciousResult = await dbAdapter.query(
      `SELECT COUNT(*) as count FROM csp_violations WHERE is_suspicious = true`,
      [],
      { schema: 'system' }
    );

    // Violations in time window
    const recentResult = await dbAdapter.query(
      `SELECT COUNT(*) as count FROM csp_violations WHERE timestamp > $1`,
      [cutoff],
      { schema: 'system' }
    );

    // Top violated directives
    const topDirectivesResult = await dbAdapter.query(
      `SELECT violated_directive as directive, COUNT(*) as count
       FROM csp_violations
       WHERE timestamp > $1
       GROUP BY violated_directive
       ORDER BY count DESC
       LIMIT 10`,
      [cutoff],
      { schema: 'system' }
    );

    // Top blocked URIs
    const topUrisResult = await dbAdapter.query(
      `SELECT blocked_uri as uri, COUNT(*) as count
       FROM csp_violations
       WHERE timestamp > $1
       GROUP BY blocked_uri
       ORDER BY count DESC
       LIMIT 10`,
      [cutoff],
      { schema: 'system' }
    );

    // Attack patterns
    const patternsResult = await dbAdapter.query(
      `SELECT
        pattern_description as pattern,
        occurrence_count as count,
        first_seen,
        last_seen,
        severity,
        is_attack
       FROM csp_patterns
       WHERE is_attack = true
       ORDER BY last_seen DESC
       LIMIT 20`,
      [],
      { schema: 'system' }
    );

    return {
      total_violations: totalResult.rows[0].count,
      unique_violations: uniqueResult.rows[0].count,
      suspicious_violations: suspiciousResult.rows[0].count,
      violations_24h: recentResult.rows[0].count,
      top_violated_directives: topDirectivesResult.rows,
      top_blocked_uris: topUrisResult.rows,
      attack_patterns: patternsResult.rows.map((p: any) => ({
        pattern: p.pattern,
        count: p.count,
        first_seen: new Date(p.first_seen),
        last_seen: new Date(p.last_seen),
        severity: p.severity,
        is_attack: Boolean(p.is_attack),
      })),
    };
  }

  /**
   * Clean up old violations
   */
  async cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    const result = await dbAdapter.query(
      `DELETE FROM csp_violations WHERE timestamp < $1`,
      [cutoff],
      { schema: 'system' }
    );

    // Clean up old rate limits
    await dbAdapter.query(
      `DELETE FROM csp_rate_limits
       WHERE window_start < $1 AND is_blocked = false`,
      [Date.now() - this.RATE_LIMIT_WINDOW],
      { schema: 'system' }
    );

    logger.info('CSP violation cleanup completed', {
      violationsRemoved: result.rowCount,
    });

    return result.rowCount || 0;
  }
}

export const cspMonitor = new CSPMonitor();
