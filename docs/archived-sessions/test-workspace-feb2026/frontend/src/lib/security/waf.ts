import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

export interface WAFConfig {
  enabled: boolean;
  blockMode: boolean; // true = block, false = log only
  maxRequestSize: number; // bytes
  maxHeaderSize: number; // bytes
  maxQueryParams: number;
  maxCookieSize: number; // bytes
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  geoBlocking: {
    enabled: boolean;
    blockedCountries: string[];
    allowedCountries: string[];
  };
  customRules: WAFRule[];
}

export interface WAFRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  targets: ('url' | 'headers' | 'body' | 'cookies' | 'query')[];
  pattern: string | RegExp;
  action: 'block' | 'log' | 'redirect';
  redirectUrl?: string;
}

export interface WAFThreat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ruleId?: string;
  blocked: boolean;
  timestamp: string;
  request: {
    method: string;
    url: string;
    ip: string;
    userAgent: string;
    headers: Record<string, string>;
  };
}

const DEFAULT_WAF_CONFIG: WAFConfig = {
  enabled: true,
  blockMode: true,
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxHeaderSize: 8192, // 8KB
  maxQueryParams: 100,
  maxCookieSize: 4096, // 4KB
  rateLimiting: {
    enabled: true,
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  },
  geoBlocking: {
    enabled: false,
    blockedCountries: [],
    allowedCountries: [],
  },
  customRules: [],
};

// Built-in security rules
const BUILT_IN_RULES: WAFRule[] = [
  // SQL Injection Detection
  {
    id: 'sql-injection-1',
    name: 'SQL Injection - Basic Patterns',
    enabled: true,
    severity: 'high',
    targets: ['url', 'body', 'query'],
    pattern:
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|('(\s*or\s*'?\w*'?\s*=)|(\s*;\s*\w+)|(\s*--)|(\s*\/\*))/i,
    action: 'block',
  },
  {
    id: 'sql-injection-2',
    name: 'SQL Injection - Advanced Patterns',
    enabled: true,
    severity: 'high',
    targets: ['url', 'body', 'query'],
    pattern:
      /(sleep\(\d+\))|(waitfor\s+delay)|(benchmark\()|(\bload_file\b)|(\binto\s+outfile\b)|(\bunion\s+all\s+select)/i,
    action: 'block',
  },

  // XSS Detection
  {
    id: 'xss-1',
    name: 'Cross-Site Scripting - Script Tags',
    enabled: true,
    severity: 'high',
    targets: ['url', 'body', 'query'],
    pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i,
    action: 'block',
  },
  {
    id: 'xss-2',
    name: 'Cross-Site Scripting - Event Handlers',
    enabled: true,
    severity: 'high',
    targets: ['url', 'body', 'query'],
    pattern: /\bon\w+\s*=\s*["\']?[^"\']*["\']?/i,
    action: 'block',
  },
  {
    id: 'xss-3',
    name: 'Cross-Site Scripting - JavaScript URLs',
    enabled: true,
    severity: 'medium',
    targets: ['url', 'body', 'query'],
    pattern: /javascript\s*:/i,
    action: 'block',
  },

  // Command Injection Detection
  {
    id: 'cmd-injection-1',
    name: 'Command Injection - Basic',
    enabled: true,
    severity: 'critical',
    targets: ['url', 'body', 'query'],
    pattern: /(\||&|;|\$\(|\`|<\(|>\()/,
    action: 'block',
  },
  {
    id: 'cmd-injection-2',
    name: 'Command Injection - System Commands',
    enabled: true,
    severity: 'critical',
    targets: ['url', 'body', 'query'],
    pattern: /\b(nc|netcat|telnet|wget|curl|ping|nmap|cat|ls|ps|id|whoami|uname)\b/i,
    action: 'block',
  },

  // Path Traversal Detection
  {
    id: 'path-traversal-1',
    name: 'Path Traversal - Directory Traversal',
    enabled: true,
    severity: 'high',
    targets: ['url', 'query'],
    pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i,
    action: 'block',
  },
  {
    id: 'path-traversal-2',
    name: 'Path Traversal - Absolute Paths',
    enabled: true,
    severity: 'medium',
    targets: ['url', 'query'],
    pattern: /(\/etc\/|\/var\/|\/usr\/|\/bin\/|\/sbin\/|c:\\windows\\|c:\\users\\)/i,
    action: 'block',
  },

  // File Inclusion Detection
  {
    id: 'file-inclusion-1',
    name: 'Local File Inclusion',
    enabled: true,
    severity: 'high',
    targets: ['url', 'query'],
    pattern: /(file:\/\/|php:\/\/|data:\/\/|expect:\/\/|zip:\/\/)/i,
    action: 'block',
  },

  // LDAP Injection Detection
  {
    id: 'ldap-injection-1',
    name: 'LDAP Injection',
    enabled: true,
    severity: 'medium',
    targets: ['url', 'body', 'query'],
    pattern: /(\(\||\*\)|\)\(|\|\()/,
    action: 'block',
  },

  // HTTP Header Injection
  {
    id: 'header-injection-1',
    name: 'HTTP Header Injection',
    enabled: true,
    severity: 'medium',
    targets: ['headers'],
    pattern: /(\r\n|\n\r|\r|\n)/,
    action: 'block',
  },

  // Suspicious User Agents
  {
    id: 'suspicious-ua-1',
    name: 'Suspicious User Agents',
    enabled: true,
    severity: 'low',
    targets: ['headers'],
    pattern: /(sqlmap|nmap|nikto|w3af|whatweb|masscan|zap|burp|acunetix|nessus)/i,
    action: 'block',
  },

  // Server-Side Template Injection
  {
    id: 'ssti-1',
    name: 'Server-Side Template Injection',
    enabled: true,
    severity: 'high',
    targets: ['url', 'body', 'query'],
    pattern: /(\{\{|\}\}|\{%|%\}|\$\{|\})/,
    action: 'log',
  },
];

/**
 * Web Application Firewall (WAF) Implementation
 * Protects against common web attacks and malicious requests
 */
export class WebApplicationFirewall {
  private config: WAFConfig;
  private rateLimitStore: Map<string, { count: number; window: number }>;
  private threatLog: WAFThreat[];
  private maxThreatLogSize = 10000;

  constructor(config: Partial<WAFConfig> = {}) {
    this.config = { ...DEFAULT_WAF_CONFIG, ...config };
    this.config.customRules = [...BUILT_IN_RULES, ...(config.customRules || [])];
    this.rateLimitStore = new Map();
    this.threatLog = [];
  }

  /**
   * Main WAF inspection method
   */
  async inspectRequest(request: NextRequest): Promise<{
    allowed: boolean;
    threats: WAFThreat[];
    response?: NextResponse;
  }> {
    if (!this.config.enabled) {
      return { allowed: true, threats: [] };
    }

    const threats: WAFThreat[] = [];
    const clientIp = this.getClientIP(request);

    try {
      // Basic request validation
      const basicChecks = await this.performBasicChecks(request, clientIp);
      threats.push(...basicChecks);

      // Rate limiting check
      if (this.config.rateLimiting.enabled) {
        const rateLimitThreat = this.checkRateLimit(clientIp);
        if (rateLimitThreat) threats.push(rateLimitThreat);
      }

      // Geo-blocking check
      if (this.config.geoBlocking.enabled) {
        const geoThreat = await this.checkGeoBlocking(request, clientIp);
        if (geoThreat) threats.push(geoThreat);
      }

      // Rule-based inspection
      const ruleThreats = await this.inspectWithRules(request, clientIp);
      threats.push(...ruleThreats);

      // Log threats
      this.logThreats(threats);

      // Determine if request should be blocked
      const shouldBlock = this.config.blockMode && this.shouldBlockRequest(threats);

      if (shouldBlock) {
        const blockedThreat = threats.find(t => t.severity === 'critical') || threats[0];
        if (blockedThreat) {
          return {
            allowed: false,
            threats,
            response: this.createBlockResponse(blockedThreat),
          };
        }
      }

      return { allowed: true, threats };
    } catch (error) {
      logger.error('WAF inspection error:', error);
      // Fail open - allow request if WAF encounters an error
      return { allowed: true, threats: [] };
    }
  }

  /**
   * Perform basic request validation checks
   */
  private async performBasicChecks(request: NextRequest, clientIp: string): Promise<WAFThreat[]> {
    const threats: WAFThreat[] = [];
    const url = request.url;
    const method = request.method;

    // Check request size
    if (request.headers.get('content-length')) {
      const contentLength = parseInt(request.headers.get('content-length')!);
      if (contentLength > this.config.maxRequestSize) {
        threats.push({
          id: `size-${Date.now()}`,
          type: 'REQUEST_SIZE_EXCEEDED',
          severity: 'medium',
          description: `Request size ${contentLength} exceeds maximum ${this.config.maxRequestSize}`,
          blocked: true,
          timestamp: new Date().toISOString(),
          request: this.createRequestInfo(request, clientIp),
        });
      }
    }

    // Check header size
    let totalHeaderSize = 0;
    request.headers.forEach((value, key) => {
      totalHeaderSize += key.length + value.length;
    });

    if (totalHeaderSize > this.config.maxHeaderSize) {
      threats.push({
        id: `header-size-${Date.now()}`,
        type: 'HEADER_SIZE_EXCEEDED',
        severity: 'medium',
        description: `Header size ${totalHeaderSize} exceeds maximum ${this.config.maxHeaderSize}`,
        blocked: true,
        timestamp: new Date().toISOString(),
        request: this.createRequestInfo(request, clientIp),
      });
    }

    // Check query parameters count
    const urlObj = new URL(url);
    const paramCount = urlObj.searchParams.size;
    if (paramCount > this.config.maxQueryParams) {
      threats.push({
        id: `param-count-${Date.now()}`,
        type: 'TOO_MANY_PARAMETERS',
        severity: 'medium',
        description: `Query parameter count ${paramCount} exceeds maximum ${this.config.maxQueryParams}`,
        blocked: true,
        timestamp: new Date().toISOString(),
        request: this.createRequestInfo(request, clientIp),
      });
    }

    // Check cookie size
    const cookies = request.headers.get('cookie');
    if (cookies && cookies.length > this.config.maxCookieSize) {
      threats.push({
        id: `cookie-size-${Date.now()}`,
        type: 'COOKIE_SIZE_EXCEEDED',
        severity: 'low',
        description: `Cookie size ${cookies.length} exceeds maximum ${this.config.maxCookieSize}`,
        blocked: false,
        timestamp: new Date().toISOString(),
        request: this.createRequestInfo(request, clientIp),
      });
    }

    return threats;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(clientIp: string): WAFThreat | null {
    const now = Date.now();
    const windowStart = now - this.config.rateLimiting.windowMs;
    const key = `rate_limit_${clientIp}`;

    let record = this.rateLimitStore.get(key);

    if (!record || record.window < windowStart) {
      // Create new window
      record = { count: 1, window: now };
    } else {
      // Increment existing window
      record.count++;
    }

    this.rateLimitStore.set(key, record);

    if (record.count > this.config.rateLimiting.maxRequests) {
      return {
        id: `rate-limit-${now}`,
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'medium',
        description: `Rate limit exceeded: ${record.count} requests in window`,
        blocked: true,
        timestamp: new Date().toISOString(),
        request: {
          method: '',
          url: '',
          ip: clientIp,
          userAgent: '',
          headers: {},
        },
      };
    }

    return null;
  }

  /**
   * Check geo-blocking rules
   */
  private async checkGeoBlocking(
    request: NextRequest,
    clientIp: string
  ): Promise<WAFThreat | null> {
    // For demo purposes, we'll skip actual geo-IP lookup
    // In production, you'd integrate with a service like MaxMind GeoIP
    return null;
  }

  /**
   * Inspect request against security rules
   */
  private async inspectWithRules(request: NextRequest, clientIp: string): Promise<WAFThreat[]> {
    const threats: WAFThreat[] = [];
    const url = request.url;
    const urlObj = new URL(url);

    // Collect inspection targets
    const targets = {
      url: url,
      query: urlObj.search,
      headers: {} as Record<string, string>,
      cookies: request.headers.get('cookie') || '',
      body: '',
    };

    // Extract headers
    request.headers.forEach((value, key) => {
      targets.headers[key.toLowerCase()] = value;
    });

    // Extract body for POST/PUT requests (with size limit)
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const contentType = request.headers.get('content-type') || '';
        if (
          contentType.includes('application/json') ||
          contentType.includes('application/x-www-form-urlencoded')
        ) {
          // Clone request to avoid consuming the original body
          const clonedRequest = request.clone();
          targets.body = await clonedRequest.text();
        }
      } catch (error) {
        logger.warn('WAF: Failed to read request body', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Test each enabled rule
    for (const rule of this.config.customRules) {
      if (!rule.enabled) continue;

      for (const target of rule.targets) {
        const content = targets[target];
        if (!content || typeof content !== 'string') continue;

        let matched = false;
        if (rule.pattern instanceof RegExp) {
          matched = rule.pattern.test(content);
        } else if (typeof rule.pattern === 'string') {
          matched = content.toLowerCase().includes(rule.pattern.toLowerCase());
        }

        if (matched) {
          threats.push({
            id: `rule-${rule.id}-${Date.now()}`,
            type: 'RULE_VIOLATION',
            severity: rule.severity,
            description: `Rule '${rule.name}' triggered on ${target}`,
            ruleId: rule.id,
            blocked: rule.action === 'block',
            timestamp: new Date().toISOString(),
            request: this.createRequestInfo(request, clientIp),
          });
        }
      }
    }

    return threats;
  }

  /**
   * Determine if request should be blocked based on threats
   */
  private shouldBlockRequest(threats: WAFThreat[]): boolean {
    return threats.some(
      threat =>
        threat.blocked ||
        threat.severity === 'critical' ||
        (threat.severity === 'high' && this.config.blockMode)
    );
  }

  /**
   * Create blocked request response
   */
  private createBlockResponse(threat: WAFThreat): NextResponse {
    const response = NextResponse.json(
      {
        error: 'Request blocked by Web Application Firewall',
        threatId: threat.id,
        message: 'Your request has been identified as potentially malicious and has been blocked.',
      },
      {
        status: 403,
        headers: {
          'X-WAF-Block-Reason': threat.type,
          'X-WAF-Threat-ID': threat.id,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );

    return response;
  }

  /**
   * Log threats for monitoring and analysis
   */
  private logThreats(threats: WAFThreat[]): void {
    threats.forEach(threat => {
      logger.warn('WAF Threat Detected:', {
        id: threat.id,
        type: threat.type,
        severity: threat.severity,
        description: threat.description,
        blocked: threat.blocked,
        ip: threat.request.ip,
      });

      this.threatLog.push(threat);
    });

    // Maintain log size limit
    if (this.threatLog.length > this.maxThreatLogSize) {
      this.threatLog.splice(0, this.threatLog.length - this.maxThreatLogSize);
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    );
  }

  /**
   * Create request info object for logging
   */
  private createRequestInfo(request: NextRequest, clientIp: string) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      method: request.method,
      url: request.url,
      ip: clientIp,
      userAgent: request.headers.get('user-agent') || '',
      headers,
    };
  }

  /**
   * Get current threat statistics
   */
  getStats() {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentThreats = this.threatLog.filter(t => new Date(t.timestamp).getTime() > last24h);

    const stats = {
      totalThreats: this.threatLog.length,
      threatsLast24h: recentThreats.length,
      blockedRequests: recentThreats.filter(t => t.blocked).length,
      severityBreakdown: {
        critical: recentThreats.filter(t => t.severity === 'critical').length,
        high: recentThreats.filter(t => t.severity === 'high').length,
        medium: recentThreats.filter(t => t.severity === 'medium').length,
        low: recentThreats.filter(t => t.severity === 'low').length,
      },
      topThreatTypes: this.getTopThreatTypes(recentThreats),
      config: {
        enabled: this.config.enabled,
        blockMode: this.config.blockMode,
        rulesCount: this.config.customRules.filter(r => r.enabled).length,
      },
    };

    return stats;
  }

  /**
   * Get top threat types from recent threats
   */
  private getTopThreatTypes(threats: WAFThreat[]) {
    const typeCounts: Record<string, number> = {};
    threats.forEach(threat => {
      typeCounts[threat.type] = (typeCounts[threat.type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get recent threats (for admin dashboard)
   */
  getRecentThreats(limit: number = 100): WAFThreat[] {
    return this.threatLog.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Clear threat log (for maintenance)
   */
  clearThreatLog(): void {
    this.threatLog = [];
  }

  /**
   * Update WAF configuration
   */
  updateConfig(newConfig: Partial<WAFConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.customRules) {
      this.config.customRules = [...BUILT_IN_RULES, ...newConfig.customRules];
    }
  }
}

// Singleton instance
export const waf = new WebApplicationFirewall();

// Utility functions
export function createWAFMiddleware(config?: Partial<WAFConfig>) {
  const wafInstance = config ? new WebApplicationFirewall(config) : waf;

  return async (request: NextRequest) => {
    return await wafInstance.inspectRequest(request);
  };
}

export function getWAFStats() {
  return waf.getStats();
}

export function getRecentWAFThreats(limit?: number) {
  return waf.getRecentThreats(limit);
}
