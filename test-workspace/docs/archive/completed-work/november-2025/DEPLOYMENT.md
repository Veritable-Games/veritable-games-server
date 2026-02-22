# Deployment Guide - Veritable Games Platform

_Production-Ready Next.js 15 Application_

## Quick Start Deployment

### Prerequisites

- **Node.js**: v18.20.8+ (LTS)
- **npm**: v9+
- **Git**: v2.30+
- **Docker**: v20+ (for containerized deployment)

### Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd veritable-games-main/frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
PORT=3000

# Security
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
CSRF_SECRET=your-csrf-secret-key

# Database
DATABASE_PATH=./data/forums.db

# Optional: Monitoring
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn
```

## Deployment Methods

### 1. Docker Deployment (Recommended)

#### Using Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  veritable-games:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - CSRF_SECRET=${CSRF_SECRET}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/public/uploads
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  data:
  uploads:
```

#### Build and Deploy

```bash
# Build production image
docker build -t veritable-games:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Traditional Server Deployment

#### Build for Production

```bash
# Install production dependencies
npm ci --only=production

# Build the application
npm run build

# Start production server
npm start
```

#### Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'veritable-games',
    script: 'npm',
    args: 'start',
    cwd: './frontend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Vercel Deployment (Serverless)

#### Prerequisites

```bash
npm install -g vercel
```

#### Deploy

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod

# Configure environment variables in Vercel dashboard
# Settings > Environment Variables
```

#### Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

### 4. Railway Deployment

#### One-Click Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

#### Railway Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "always"

[[services]]
name = "veritable-games"
```

## Production Optimizations

### 1. Next.js Production Configuration

```javascript
// next.config.js (production optimizations)
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: false,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Bundle optimization
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      // Bundle analyzer in production
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: 8888,
            openAnalyzer: true,
          })
        );
      }

      // Optimize chunks
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 2. Database Optimization for Production

```bash
# Optimize SQLite for production
node scripts/production-db-optimize.js
```

```javascript
// scripts/production-db-optimize.js
const Database = require('better-sqlite3');

const optimizeDatabase = (dbPath) => {
  const db = new Database(dbPath);

  // Production PRAGMA settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');
  db.pragma('temp_store = memory');
  db.pragma('mmap_size = 268435456'); // 256MB

  // Analyze for query optimization
  db.exec('ANALYZE');

  // Vacuum to optimize file
  db.exec('VACUUM');

  db.close();
  console.log('Database optimized for production');
};

optimizeDatabase('./data/forums.db');
```

### 3. Caching Strategy

```nginx
# nginx.conf (reverse proxy + caching)
upstream nextjs_upstream {
  server 127.0.0.1:3000;
}

server {
  listen 80;
  server_name your-domain.com;

  # Security headers
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # Static assets caching
  location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    proxy_pass http://nextjs_upstream;
  }

  # API routes
  location /api/ {
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  # All other requests
  location / {
    proxy_pass http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Health Monitoring

### 1. Health Check Endpoints

The application provides several health check endpoints:

- `/api/health` - Basic health status
- `/api/health/detailed` - Comprehensive system metrics
- `/api/health/wal` - Database health

### 2. Monitoring Setup

```bash
# Using curl for basic monitoring
curl -f http://localhost:3000/api/health || exit 1

# Using a more comprehensive check
curl -f http://localhost:3000/api/health/detailed | jq '.status' | grep -q "healthy"
```

### 3. Log Monitoring

```bash
# Monitor application logs
tail -f logs/combined.log

# Monitor for errors
tail -f logs/err.log | grep "ERROR"

# Monitor database connections
grep "database" logs/combined.log | tail -20
```

## SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Using Cloudflare (Recommended for Veritable Games)

1. Add your domain to Cloudflare
2. Update DNS records to point to your server
3. Enable "Full (strict)" SSL mode
4. Enable "Always Use HTTPS"
5. Configure Page Rules for caching

## Performance Optimization

### 1. Enable Compression

```bash
# Ensure gzip is enabled in nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### 2. Database Connection Pooling

The application uses connection pooling by default. Monitor connection usage:

```bash
# Check active connections
curl http://localhost:3000/api/admin/system/metrics | jq '.database.activeConnections'
```

### 3. Memory Management

```bash
# Monitor memory usage
free -h
htop

# PM2 memory monitoring
pm2 monit
```

## Backup Strategy

### 1. Database Backups

```bash
# Daily database backup
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp data/forums.db "backups/forums_${DATE}.db"
gzip "backups/forums_${DATE}.db"

# Keep only last 30 days
find backups/ -name "forums_*.db.gz" -mtime +30 -delete
```

### 2. Full Application Backup

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/full_${DATE}"

mkdir -p ${BACKUP_DIR}
cp -r data ${BACKUP_DIR}/
cp -r public/uploads ${BACKUP_DIR}/
cp .env.local ${BACKUP_DIR}/
tar -czf "${BACKUP_DIR}.tar.gz" ${BACKUP_DIR}
rm -rf ${BACKUP_DIR}
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### 2. Database Connection Issues

```bash
# Check database permissions
ls -la data/forums.db
# Should be readable/writable by the app user

# Check database integrity
sqlite3 data/forums.db "PRAGMA integrity_check;"
```

#### 3. Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max_old_space_size=4096" npm start
```

#### 4. Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Error Logs

```bash
# Application logs
tail -f logs/combined.log

# System logs
journalctl -u your-app-service -f

# Docker logs
docker logs -f container-name
```

## Security Considerations

### 1. Environment Variables Security

```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use secure secrets
openssl rand -base64 32  # Generate secure JWT_SECRET
```

### 2. Database Security

```bash
# Set proper file permissions
chmod 600 data/forums.db
chown app:app data/forums.db
```

### 3. Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

## Performance Benchmarks

### Expected Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Cumulative Layout Shift**: < 0.1

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:3000
```

This deployment guide ensures a robust, scalable, and secure production deployment of the Veritable Games platform.
