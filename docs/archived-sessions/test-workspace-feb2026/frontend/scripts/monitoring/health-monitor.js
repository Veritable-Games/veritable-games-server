#!/usr/bin/env node

/**
 * Production Health Monitoring System
 * Monitors critical metrics and sends alerts when thresholds are exceeded
 *
 * Usage: npm run monitor:health
 * Runs continuously with configurable interval
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Server endpoints
  healthEndpoint: 'http://192.168.1.15:3000/api/health',
  domainEndpoint: 'https://www.veritablegames.com',

  // Check intervals (in seconds)
  checkInterval: 300, // 5 minutes

  // Alert thresholds
  thresholds: {
    responseTime: 1000, // ms
    memoryUsage: 150, // MB
    memoryPercent: 85, // %
    containerRestarts: 1, // Number of restarts
    apiErrorRate: 5, // %
    databaseLatency: 500, // ms
  },

  // Alert configuration
  alerts: {
    enabled: true,
    email: process.env.ALERT_EMAIL || 'admin@veritablegames.com',
    logFile: process.env.MONITOR_LOG_FILE || path.join(process.cwd(), 'logs/monitor.log'),
  },

  // Feature flags
  features: {
    emailAlerts: false, // Requires mail server setup
    fileLogging: true,
    consoleLogging: true,
  },
};

// Monitoring state
const state = {
  lastChecks: {},
  alertHistory: [],
  metrics: [],
  isRunning: false,
};

// Utilities
const logger = {
  info: msg => log('INFO', msg),
  warn: msg => log('WARN', msg),
  error: msg => log('ERROR', msg),
  success: msg => log('✅', msg),
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${level}: ${message}`;

  if (CONFIG.features.consoleLogging) {
    console.log(logMessage);
  }

  if (CONFIG.features.fileLogging) {
    try {
      const logDir = path.dirname(CONFIG.alerts.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(CONFIG.alerts.logFile, logMessage + '\n');
    } catch (e) {
      console.error(`Failed to write to log file: ${e.message}`);
    }
  }
}

// HTTP request helper
function httpRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    req.on('error', reject);
  });
}

// Health checks
async function checkApplicationHealth() {
  try {
    const startTime = Date.now();
    const response = await httpRequest(CONFIG.healthEndpoint, 3000);
    const responseTime = Date.now() - startTime;

    if (response.status !== 200) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        responseTime,
      };
    }

    const health = JSON.parse(response.data);

    return {
      success: true,
      health,
      responseTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: Date.now(),
    };
  }
}

async function checkDomainHealth() {
  try {
    const startTime = Date.now();
    const response = await httpRequest(CONFIG.domainEndpoint, 5000);
    const responseTime = Date.now() - startTime;

    // Domain should redirect (307) or be accessible (200)
    const isHealthy = response.status === 307 || response.status === 200;

    return {
      success: isHealthy,
      status: response.status,
      responseTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: Date.now(),
    };
  }
}

// Alert system
async function sendAlert(alertType, severity, message, details = {}) {
  const alert = {
    timestamp: new Date().toISOString(),
    type: alertType,
    severity, // 'critical', 'warning', 'info'
    message,
    details,
  };

  state.alertHistory.push(alert);

  const alertMessage = `[${severity.toUpperCase()}] ${alertType}: ${message}`;

  if (severity === 'critical' || severity === 'warning') {
    logger.warn(alertMessage);

    if (CONFIG.features.emailAlerts) {
      await sendEmailAlert(alert);
    }
  } else {
    logger.info(alertMessage);
  }
}

// Monitoring checks
async function runHealthChecks() {
  logger.info('Running health checks...');

  const checks = {
    application: await checkApplicationHealth(),
    domain: await checkDomainHealth(),
  };

  // Store metrics
  state.lastChecks = { ...checks, timestamp: new Date().toISOString() };
  state.metrics.push(state.lastChecks);

  // Keep only last 1000 metrics
  if (state.metrics.length > 1000) {
    state.metrics.shift();
  }

  // Check thresholds
  await checkThresholds(checks);

  return checks;
}

async function checkThresholds(checks) {
  // Application health
  if (!checks.application.success) {
    await sendAlert(
      'Application Health',
      'critical',
      'Application health endpoint not responding',
      checks.application
    );
  } else {
    const health = checks.application.health;

    // Response time
    if (checks.application.responseTime > CONFIG.thresholds.responseTime) {
      await sendAlert(
        'Response Time',
        'warning',
        `API response slow: ${checks.application.responseTime}ms`,
        { responseTime: checks.application.responseTime, threshold: CONFIG.thresholds.responseTime }
      );
    }

    // Memory usage
    if (health.memory && health.memory.used > CONFIG.thresholds.memoryUsage) {
      await sendAlert(
        'Memory Usage',
        'warning',
        `High memory usage: ${health.memory.used}MB`,
        health.memory
      );
    }

    // Database connection
    if (health.database && health.database.status !== 'connected') {
      await sendAlert('Database Connection', 'critical', 'Database not connected', health.database);
    }
  }

  // Domain health
  if (!checks.domain.success) {
    await sendAlert('Domain Availability', 'critical', 'Domain not responding', checks.domain);
  } else if (checks.domain.responseTime > 5000) {
    await sendAlert(
      'Domain Latency',
      'warning',
      `Domain response slow: ${checks.domain.responseTime}ms`,
      { responseTime: checks.domain.responseTime }
    );
  }
}

// Dashboard/Status endpoint
function createStatusServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url === '/') {
      res.end(
        JSON.stringify(
          {
            status: 'running',
            uptime: process.uptime(),
            lastChecks: state.lastChecks,
            recentAlerts: state.alertHistory.slice(-10),
            config: {
              checkInterval: CONFIG.checkInterval,
              thresholds: CONFIG.thresholds,
            },
          },
          null,
          2
        )
      );
    } else if (req.url === '/metrics') {
      res.end(
        JSON.stringify(
          {
            metrics: state.metrics.slice(-100),
            count: state.metrics.length,
          },
          null,
          2
        )
      );
    } else if (req.url === '/alerts') {
      res.end(
        JSON.stringify(
          {
            alerts: state.alertHistory,
            count: state.alertHistory.length,
          },
          null,
          2
        )
      );
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  return server;
}

// Main monitoring loop
async function startMonitoring() {
  if (state.isRunning) {
    logger.warn('Monitoring already running');
    return;
  }

  state.isRunning = true;
  logger.success('Starting production health monitoring');
  logger.info(`Check interval: ${CONFIG.checkInterval}s`);
  logger.info(`Response time threshold: ${CONFIG.thresholds.responseTime}ms`);
  logger.info(`Memory threshold: ${CONFIG.thresholds.memoryUsage}MB`);

  // Start status server on port 3030
  const statusServer = createStatusServer();
  statusServer.listen(3030, '0.0.0.0', () => {
    logger.info('Status server listening on http://0.0.0.0:3030');
  });

  // Initial check
  await runHealthChecks();

  // Schedule recurring checks
  setInterval(async () => {
    try {
      await runHealthChecks();
    } catch (error) {
      logger.error(`Health check failed: ${error.message}`);
    }
  }, CONFIG.checkInterval * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down monitoring...');
    state.isRunning = false;
    statusServer.close();
    process.exit(0);
  });
}

// CLI
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      startMonitoring().catch(logger.error);
      break;
    case 'check':
      runHealthChecks()
        .then(checks => {
          console.log(JSON.stringify(checks, null, 2));
          process.exit(0);
        })
        .catch(e => {
          console.error(e);
          process.exit(1);
        });
      break;
    default:
      console.log(`
Production Health Monitor

Usage:
  node health-monitor.js start    Start monitoring (runs indefinitely)
  node health-monitor.js check    Run a single health check

Environment Variables:
  ALERT_EMAIL=admin@example.com           Email for alerts
  SLACK_WEBHOOK_URL=https://...           Slack webhook for alerts

Status Server (when running):
  http://localhost:3030/                  Current status
  http://localhost:3030/metrics           Last 100 metrics
  http://localhost:3030/alerts            Alert history
      `);
  }
}

module.exports = { startMonitoring, runHealthChecks };
