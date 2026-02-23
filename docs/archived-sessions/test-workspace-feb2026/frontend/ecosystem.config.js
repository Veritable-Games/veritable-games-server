/**
 * PM2 Configuration for Production Deployment
 *
 * This configuration manages the Next.js application with clustering,
 * auto-restart, and monitoring capabilities.
 *
 * Note: WebSocket server configuration removed - not implemented
 */

module.exports = {
  apps: [
    {
      // Main Next.js Application
      name: 'veritablegames-web',
      script: 'npm',
      args: 'start',
      cwd: process.env.APP_DIR || '/home/deploy/platform/frontend',

      // Clustering
      instances: process.env.WEB_INSTANCES || 2,
      exec_mode: 'cluster',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        NODE_OPTIONS: '--max-old-space-size=2048',
      },

      // Logging
      error_file: '/var/log/pm2/veritablegames-error.log',
      out_file: '/var/log/pm2/veritablegames-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Memory management
      max_memory_restart: process.env.WEB_MAX_MEMORY || '1G',

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Health check
      cron_restart: '0 4 * * *', // Daily restart at 4 AM
    },

    {
      // Optional: Database Backup Cron Job
      name: 'veritablegames-backup',
      script: '/home/deploy/scripts/backup.sh',
      cwd: process.env.APP_DIR || '/home/deploy/platform/frontend',

      // Cron configuration
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 2 * * *', // Daily at 2 AM
      autorestart: false,

      // Logging
      error_file: '/var/log/pm2/veritablegames-backup-error.log',
      out_file: '/var/log/pm2/veritablegames-backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      // Optional: Health Check Monitor
      name: 'veritablegames-monitor',
      script: 'node',
      args: 'scripts/health-monitor.js',
      cwd: process.env.APP_DIR || '/home/deploy/platform/frontend',

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
        HEALTH_CHECK_URL: 'http://localhost:3000/api/health',
        ALERT_WEBHOOK: process.env.ALERT_WEBHOOK || '',
      },

      // Logging
      error_file: '/var/log/pm2/veritablegames-monitor-error.log',
      out_file: '/var/log/pm2/veritablegames-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Auto-restart on failure
      autorestart: true,
      max_memory_restart: '100M',
    },
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: process.env.DEPLOY_HOST || 'yourdomain.com',
      ref: 'origin/main',
      repo: 'git@github.com:veritablegames/platform.git',
      path: '/home/deploy/platform',
      'pre-deploy-local': '',
      'post-deploy':
        'cd frontend && npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },

    staging: {
      user: 'deploy',
      host: process.env.STAGING_HOST || 'staging.yourdomain.com',
      ref: 'origin/develop',
      repo: 'git@github.com:veritablegames/platform.git',
      path: '/home/deploy/platform-staging',
      'post-deploy':
        'cd frontend && npm ci && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};
