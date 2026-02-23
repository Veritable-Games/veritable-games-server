#!/usr/bin/env node

/**
 * Health Monitoring Script
 *
 * Continuously monitors application health and sends alerts when issues are detected
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:3000/api/health',
  wsHealthCheckUrl: process.env.WS_HEALTH_CHECK_URL || 'http://localhost:3001/health',
  checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '300000'), // 5 minutes
  alertWebhook: process.env.ALERT_WEBHOOK,
  maxFailures: parseInt(process.env.MAX_FAILURES || '3'),
  diskThreshold: parseInt(process.env.DISK_THRESHOLD || '90'), // percentage
  memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '90'), // percentage
  cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'), // percentage
};

// State
let consecutiveFailures = {
  web: 0,
  ws: 0,
  database: 0,
};

let lastAlertTime = {
  web: 0,
  ws: 0,
  database: 0,
  resources: 0,
};

const ALERT_COOLDOWN = 3600000; // 1 hour

/**
 * Check HTTP endpoint health
 */
async function checkHttpHealth(url, name) {
  return new Promise(resolve => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, { timeout: 10000 }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === 'healthy' || json.success) {
              consecutiveFailures[name] = 0;
              resolve({ success: true, message: `${name} is healthy` });
            } else {
              handleFailure(name, `Unhealthy response: ${json.message || 'Unknown'}`);
              resolve({ success: false, message: json.message });
            }
          } catch (e) {
            consecutiveFailures[name] = 0;
            resolve({ success: true, message: `${name} responded (non-JSON)` });
          }
        } else {
          handleFailure(name, `HTTP ${res.statusCode}`);
          resolve({ success: false, message: `HTTP ${res.statusCode}` });
        }
      });
    });

    request.on('error', err => {
      handleFailure(name, err.message);
      resolve({ success: false, message: err.message });
    });

    request.on('timeout', () => {
      request.destroy();
      handleFailure(name, 'Timeout');
      resolve({ success: false, message: 'Request timeout' });
    });
  });
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');

    const dbPath = path.join(process.cwd(), 'data', 'forums.db');
    const db = new Database(dbPath, { readonly: true });

    // Test query
    const result = db.prepare('SELECT COUNT(*) as count FROM sqlite_master').get();
    db.close();

    if (result) {
      consecutiveFailures.database = 0;
      return { success: true, message: 'Database is healthy' };
    } else {
      throw new Error('No result from database');
    }
  } catch (error) {
    handleFailure('database', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Check system resources
 */
async function checkSystemResources() {
  const alerts = [];

  try {
    // Check disk usage
    const { stdout: diskOutput } = await execAsync(
      "df -h / | awk 'NR==2 {print $5}' | sed 's/%//'"
    );
    const diskUsage = parseInt(diskOutput.trim());

    if (diskUsage > CONFIG.diskThreshold) {
      alerts.push(`Disk usage high: ${diskUsage}%`);
    }

    // Check memory usage
    const { stdout: memOutput } = await execAsync(
      "free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d. -f1"
    );
    const memUsage = parseInt(memOutput.trim());

    if (memUsage > CONFIG.memoryThreshold) {
      alerts.push(`Memory usage high: ${memUsage}%`);
    }

    // Check CPU load
    const { stdout: cpuOutput } = await execAsync(
      "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}' | cut -d. -f1"
    );
    const cpuUsage = parseInt(cpuOutput.trim());

    if (cpuUsage > CONFIG.cpuThreshold) {
      alerts.push(`CPU usage high: ${cpuUsage}%`);
    }

    // Check PM2 processes
    const { stdout: pm2Output } = await execAsync('pm2 jlist');
    const processes = JSON.parse(pm2Output);

    for (const proc of processes) {
      if (proc.name.startsWith('veritablegames')) {
        if (proc.pm2_env.status !== 'online') {
          alerts.push(`Process ${proc.name} is ${proc.pm2_env.status}`);
        }
        if (proc.pm2_env.restart_time > 10) {
          alerts.push(`Process ${proc.name} restarted ${proc.pm2_env.restart_time} times`);
        }
      }
    }

    if (alerts.length > 0) {
      const now = Date.now();
      if (now - lastAlertTime.resources > ALERT_COOLDOWN) {
        await sendAlert('System Resources', alerts.join('\n'));
        lastAlertTime.resources = now;
      }
    }

    return {
      success: alerts.length === 0,
      message: alerts.length > 0 ? alerts.join(', ') : 'Resources normal',
      details: {
        disk: `${diskUsage}%`,
        memory: `${memUsage}%`,
        cpu: `${cpuUsage}%`,
      },
    };
  } catch (error) {
    console.error('Resource check error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Handle service failure
 */
function handleFailure(service, error) {
  consecutiveFailures[service]++;
  console.error(`[${new Date().toISOString()}] ${service} health check failed:`, error);

  if (consecutiveFailures[service] >= CONFIG.maxFailures) {
    const now = Date.now();
    if (now - lastAlertTime[service] > ALERT_COOLDOWN) {
      sendAlert(
        `${service} Service Down`,
        `Service ${service} has failed ${consecutiveFailures[service]} consecutive checks.\nError: ${error}`
      );
      lastAlertTime[service] = now;
      attemptRecovery(service);
    }
  }
}

/**
 * Attempt to recover failed service
 */
async function attemptRecovery(service) {
  console.log(`Attempting to recover ${service}...`);

  try {
    let command;
    switch (service) {
      case 'web':
        command = 'pm2 restart veritablegames-web';
        break;
      case 'ws':
        command = 'pm2 restart veritablegames-ws';
        break;
      case 'database':
        // Database issues might need manual intervention
        console.log('Database recovery requires manual intervention');
        return;
      default:
        return;
    }

    const { stdout, stderr } = await execAsync(command);
    console.log(`Recovery command executed: ${command}`);
    if (stdout) console.log('Output:', stdout);
    if (stderr) console.error('Error:', stderr);

    // Reset failure counter after recovery attempt
    consecutiveFailures[service] = 0;
  } catch (error) {
    console.error(`Recovery failed for ${service}:`, error);
  }
}

/**
 * Send alert notification
 */
async function sendAlert(title, message) {
  const alertMessage = `🚨 **${title}**\n\n${message}\n\nHost: ${require('os').hostname()}\nTime: ${new Date().toISOString()}`;

  console.error(alertMessage);

  // Send to webhook if configured
  if (CONFIG.alertWebhook) {
    try {
      const url = new URL(CONFIG.alertWebhook);
      const data = JSON.stringify({
        text: alertMessage,
        username: 'Health Monitor',
        icon_emoji: ':warning:',
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options);
      req.write(data);
      req.end();
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  // Log to file
  const fs = require('fs');
  const logFile = '/var/log/veritablegames-alerts.log';
  fs.appendFileSync(logFile, `\n${alertMessage}\n`, { flag: 'a' });
}

/**
 * Main health check loop
 */
async function runHealthChecks() {
  console.log(`[${new Date().toISOString()}] Running health checks...`);

  const results = await Promise.all([
    checkHttpHealth(CONFIG.healthCheckUrl, 'web'),
    checkHttpHealth(CONFIG.wsHealthCheckUrl, 'ws'),
    checkDatabaseHealth(),
    checkSystemResources(),
  ]);

  const summary = {
    timestamp: new Date().toISOString(),
    web: results[0],
    websocket: results[1],
    database: results[2],
    resources: results[3],
    healthy: results.every(r => r.success),
  };

  // Log summary
  if (!summary.healthy) {
    console.log('Health check summary:', JSON.stringify(summary, null, 2));
  } else {
    console.log(`[${summary.timestamp}] All systems healthy`);
  }

  // Write to health status file
  const fs = require('fs');
  const statusFile = '/tmp/veritablegames-health.json';
  fs.writeFileSync(statusFile, JSON.stringify(summary, null, 2));

  return summary;
}

/**
 * Graceful shutdown
 */
function handleShutdown() {
  console.log('Shutting down health monitor...');
  clearInterval(intervalId);
  process.exit(0);
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Start monitoring
console.log('Starting health monitor...');
console.log('Configuration:', CONFIG);

// Run initial check
runHealthChecks();

// Schedule regular checks
const intervalId = setInterval(runHealthChecks, CONFIG.checkInterval);

// Keep process alive
process.stdin.resume();
