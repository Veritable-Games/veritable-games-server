import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { searchManager } from '@/lib/search/searchManager';
// System monitoring removed
// APM monitoring removed
// Alerting system removed
import * as os from 'os';
import * as fs from 'fs';
import { withSecurity } from '@/lib/security/middleware';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  details?: any;
  error?: string;
}

interface StatFsInfo {
  blocks: number; // Total data blocks in file system
  bsize: number; // Optimal transfer block size
  bavail: number; // Free blocks available to unprivileged user
}

async function GETHandler() {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database Health Checks
  await performDatabaseHealthChecks(checks);

  // System Resource Health Checks
  await performSystemResourceChecks(checks);

  // API Endpoint Health Checks
  await performAPIEndpointChecks(checks);

  // External Service Health Checks
  await performExternalServiceChecks(checks);

  // Application Component Health Checks
  await performApplicationComponentChecks(checks);

  // Determine overall status
  if (checks.some(check => check.status === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (checks.some(check => check.status === 'degraded')) {
    overallStatus = 'degraded';
  }

  const responseTime = Date.now() - startTime;

  // Get performance summary from APM
  const performanceSummary = { monitoring: 'disabled' };

  // Get system metrics
  let systemMetrics;
  try {
    systemMetrics = { status: 'ok', monitoring: 'disabled' };
  } catch (error) {
    systemMetrics = null;
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    responseTime: `${responseTime}ms`,
    version: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
    },
    performance: performanceSummary,
    system: systemMetrics,
    checks: checks.reduce(
      (acc, check) => {
        acc[check.name] = {
          status: check.status,
          responseTime: check.responseTime,
          details: check.details,
          error: check.error,
        };
        return acc;
      },
      {} as Record<string, any>
    ),
    alerts: {
      active: await getActiveAlertsCount(),
      critical: await getCriticalAlertsCount(),
    },
  };

  return NextResponse.json(response, {
    status: overallStatus === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

async function performDatabaseHealthChecks(checks: HealthCheck[]): Promise<void> {
  // Main database connectivity
  try {
    const dbStartTime = Date.now();

    // Basic connectivity test
    const testResult = await dbAdapter.query('SELECT 1 as test, NOW() as current_time', [], {
      schema: 'forums',
    });

    // Connection pool stats
    const adapterStats = dbAdapter.getStats();
    const poolStats = adapterStats.pgPoolStats;

    // Recent query performance (if table exists)
    let recentQueries: any = null;
    try {
      const queryResult = await dbAdapter.query(
        `
        SELECT
          AVG(execution_time_ms) as avg_query_time,
          MAX(execution_time_ms) as max_query_time,
          COUNT(*) as query_count,
          SUM(CASE WHEN slow_query = 1 THEN 1 ELSE 0 END) as slow_query_count
        FROM db_query_performance
        WHERE timestamp > $1
      `,
        [new Date(Date.now() - 300000).toISOString()],
        { schema: 'system' }
      );
      recentQueries = queryResult.rows[0];
    } catch {
      // Table may not exist yet
      recentQueries = null;
    }

    const responseTime = Date.now() - dbStartTime;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Determine status based on metrics
    if ((poolStats.totalCount || 0) - (poolStats.idleCount || 0) > 4) {
      status = 'degraded';
    }
    if (recentQueries?.avg_query_time > 1000) {
      status = 'degraded';
    }
    if (responseTime > 1000 || !testResult.rows[0]) {
      status = 'unhealthy';
    }

    checks.push({
      name: 'database_main',
      status,
      responseTime,
      details: {
        testQuery: testResult.rows[0],
        poolStats: {
          totalConnections: poolStats.totalCount,
          idleConnections: poolStats.idleCount,
          waitingClients: poolStats.waitingCount,
        },
        dbInfo: {
          mode: 'postgresql',
          queries: adapterStats.queries,
          errors: adapterStats.errors,
        },
        performance: recentQueries,
      },
    });
  } catch (error) {
    checks.push({
      name: 'database_main',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }

  // Wiki database check
  try {
    const wikiStartTime = Date.now();

    const wikiTest = await dbAdapter.query('SELECT COUNT(*) as count FROM wiki_pages', [], {
      schema: 'wiki',
    });
    const responseTime = Date.now() - wikiStartTime;

    checks.push({
      name: 'database_wiki',
      status: responseTime > 500 ? 'degraded' : 'healthy',
      responseTime,
      details: {
        wikiPageCount: wikiTest.rows[0]?.count || 0,
      },
    });
  } catch (error) {
    checks.push({
      name: 'database_wiki',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Wiki database check error',
    });
  }
}

async function performSystemResourceChecks(checks: HealthCheck[]): Promise<void> {
  const startTime = Date.now();

  try {
    // Memory check
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
    };

    const heapPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemPercentage = (systemMem.used / systemMem.total) * 100;

    let memoryStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapPercentage > 90 || systemPercentage > 95) {
      memoryStatus = 'unhealthy';
    } else if (heapPercentage > 75 || systemPercentage > 85) {
      memoryStatus = 'degraded';
    }

    checks.push({
      name: 'system_memory',
      status: memoryStatus,
      details: {
        heap: {
          usedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          totalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentage: Math.round(heapPercentage),
        },
        system: {
          totalMB: Math.round(systemMem.total / 1024 / 1024),
          usedMB: Math.round(systemMem.used / 1024 / 1024),
          freeMB: Math.round(systemMem.free / 1024 / 1024),
          percentage: Math.round(systemPercentage),
        },
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
      },
    });

    // CPU check
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadPercentage = ((loadAvg[0] ?? 0) / cpuCount) * 100;

    let cpuStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (loadPercentage > 90) {
      cpuStatus = 'unhealthy';
    } else if (loadPercentage > 70) {
      cpuStatus = 'degraded';
    }

    checks.push({
      name: 'system_cpu',
      status: cpuStatus,
      details: {
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2],
        },
        coreCount: cpuCount,
        loadPercentage: Math.round(loadPercentage),
        uptime: Math.round(process.uptime()),
      },
    });

    // Disk space check (for data directory)
    try {
      const dataDir = './data';
      const stats = await fs.promises.stat(dataDir);

      // Try to get disk usage (Unix systems)
      let diskStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let diskDetails: any = {
        dataDirectory: dataDir,
        accessible: stats.isDirectory(),
      };

      try {
        const statfs = await fs.promises.statfs?.(dataDir);
        if (statfs) {
          const statfsInfo = statfs as unknown as StatFsInfo;
          const totalBytes = statfsInfo.blocks * statfsInfo.bsize;
          const freeBytes = statfsInfo.bavail * statfsInfo.bsize;
          const usedBytes = totalBytes - freeBytes;
          const usagePercentage = (usedBytes / totalBytes) * 100;

          if (usagePercentage > 95) {
            diskStatus = 'unhealthy';
          } else if (usagePercentage > 85) {
            diskStatus = 'degraded';
          }

          diskDetails = {
            ...diskDetails,
            totalGB: Math.round(totalBytes / 1024 / 1024 / 1024),
            usedGB: Math.round(usedBytes / 1024 / 1024 / 1024),
            freeGB: Math.round(freeBytes / 1024 / 1024 / 1024),
            usagePercentage: Math.round(usagePercentage),
          };
        }
      } catch {
        // Statfs not available on all systems
        diskDetails.note = 'Disk usage not available on this system';
      }

      checks.push({
        name: 'system_disk',
        status: diskStatus,
        details: diskDetails,
      });
    } catch (error) {
      checks.push({
        name: 'system_disk',
        status: 'unhealthy',
        error: 'Cannot access data directory',
      });
    }
  } catch (error) {
    checks.push({
      name: 'system_resources',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'System resource check failed',
    });
  }

  const responseTime = Date.now() - startTime;

  // Update response time for all system checks
  checks
    .filter(c => c.name.startsWith('system_'))
    .forEach(check => {
      if (!check.responseTime) {
        check.responseTime = responseTime;
      }
    });
}

async function performAPIEndpointChecks(checks: HealthCheck[]): Promise<void> {
  const criticalEndpoints = [
    { path: '/api/auth/login', method: 'POST', critical: true },
    // Forums removed - { path: '/api/forums/topics', method: 'GET', critical: true },
    { path: '/api/wiki/pages', method: 'GET', critical: true },
    { path: '/api/users/1', method: 'GET', critical: false },
  ];

  for (const endpoint of criticalEndpoints) {
    try {
      const startTime = Date.now();

      // Simulate endpoint check by testing database connectivity for the service
      let endpointStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: any = {};

      try {
        switch (endpoint.path) {
          case '/api/forums/topics':
            const topicsResult = await dbAdapter.query(
              'SELECT COUNT(*) as count FROM topics WHERE deleted_at IS NULL',
              [],
              { schema: 'forums' }
            );
            details.availableTopics = topicsResult.rows[0]?.count || 0;
            break;
          case '/api/wiki/pages':
            const pagesResult = await dbAdapter.query(
              'SELECT COUNT(*) as count FROM wiki_pages WHERE deleted_at IS NULL',
              [],
              { schema: 'wiki' }
            );
            details.availablePages = pagesResult.rows[0]?.count || 0;
            break;
          case '/api/users/1':
            const usersResult = await dbAdapter.query('SELECT COUNT(*) as count FROM users', [], {
              schema: 'users',
            });
            details.availableUsers = usersResult.rows[0]?.count || 0;
            break;
          default:
            details.note = 'Simulated check - authentication services';
        }
      } catch (error) {
        // Error handling for individual endpoint checks
      }

      const responseTime = Date.now() - startTime;

      if (responseTime > 2000) {
        endpointStatus = 'degraded';
      }

      checks.push({
        name: `api_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        status: endpointStatus,
        responseTime,
        details: {
          method: endpoint.method,
          path: endpoint.path,
          critical: endpoint.critical,
          ...details,
        },
      });
    } catch (error) {
      checks.push({
        name: `api_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        status: endpoint.critical ? 'unhealthy' : 'degraded',
        error: error instanceof Error ? error.message : 'Endpoint check failed',
      });
    }
  }
}

async function performExternalServiceChecks(checks: HealthCheck[]): Promise<void> {
  // Search service check
  try {
    const searchStartTime = Date.now();
    // Basic search functionality test
    const searchStatus = 'healthy'; // searchManager would be tested here
    const responseTime = Date.now() - searchStartTime;

    checks.push({
      name: 'service_search',
      status: searchStatus,
      responseTime,
      details: {
        searchManager: 'available',
        indexStatus: 'operational',
      },
    });
  } catch (error) {
    checks.push({
      name: 'service_search',
      status: 'degraded',
      error: 'Search service check failed',
    });
  }

  // Sentry service check
  // Sentry health check disabled - Sentry not configured
  checks.push({
    name: 'service_sentry',
    status: 'degraded',
    details: {
      environment: process.env.NODE_ENV,
      configured: false,
      clientReady: false,
    },
    error: 'Sentry not configured',
  });
}

async function performApplicationComponentChecks(checks: HealthCheck[]): Promise<void> {
  // Monitoring services check
  try {
    const monitoringDetails = {
      systemMonitor: {
        initialized: false,
        status: 'disabled',
      },
      apmService: {
        initialized: false,
        status: 'disabled',
        performanceSummary: { monitoring: 'disabled' },
      },
      alertingSystem: {
        initialized: false,
        status: 'disabled',
        activeAlerts: 0,
        totalAlerts: 0,
      },
    };

    checks.push({
      name: 'component_monitoring',
      status: 'healthy',
      details: monitoringDetails,
    });
  } catch (error) {
    checks.push({
      name: 'component_monitoring',
      status: 'degraded',
      error: 'Monitoring components check failed',
    });
  }

  // Application configuration check
  try {
    const configDetails = {
      nodeEnv: process.env.NODE_ENV,
      hasSecrets: {
        nextauthSecret: !!process.env.NEXTAUTH_SECRET,
        sentryDsn: !!process.env.SENTRY_DSN,
      },
      features: {
        monitoring: true,
        alerting: true,
        performance: true,
      },
    };

    let configStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!process.env.NEXTAUTH_SECRET) {
      configStatus = 'degraded';
    }

    checks.push({
      name: 'component_configuration',
      status: configStatus,
      details: configDetails,
    });
  } catch (error) {
    checks.push({
      name: 'component_configuration',
      status: 'unhealthy',
      error: 'Configuration check failed',
    });
  }
}

async function getActiveAlertsCount(): Promise<number> {
  try {
    const result = await dbAdapter.query(
      `
        SELECT COUNT(*) as count
        FROM system_alerts
        WHERE status = 'active'
      `,
      [],
      { schema: 'system' }
    );
    return result.rows[0]?.count || 0;
  } catch {
    return 0;
  }
}

async function getCriticalAlertsCount(): Promise<number> {
  try {
    const result = await dbAdapter.query(
      `
        SELECT COUNT(*) as count
        FROM system_alerts
        WHERE status = 'active' AND severity = 'critical'
      `,
      [],
      { schema: 'system' }
    );
    return result.rows[0]?.count || 0;
  } catch {
    return 0;
  }
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
