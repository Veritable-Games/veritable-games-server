# Production Operations Guide

## Executive Summary

The Veritable Games platform is a production-ready Next.js 15 application with enterprise-grade monitoring, security, and operational capabilities. This document provides comprehensive guidance for production deployment, monitoring, maintenance, and incident response.

**Platform Overview:**

- **Architecture**: Next.js 15 with Server Components, SQLite with WAL mode
- **Security**: Multi-layered with CSRF, CSP, rate limiting, and content sanitization
- **Monitoring**: Sentry integration, custom performance tracking, system health monitoring
- **Database**: Connection pooling, optimized indices, 84% size optimization achieved
- **Scalability**: Service-oriented architecture, prepared for horizontal scaling

---

## Quick Server Reference

### Current Status Overview

| Component | Port | Status | Access |
|-----------|------|--------|--------|
| **Next.js App (Dev)** | 3000 | ✅ Running | http://localhost:3000 |
| **PostgreSQL** | 5432 | ✅ Running | localhost (docker) |
| **Next.js App (Production)** | 3000 | ✅ Live | http://192.168.1.15:3000 |
| **Production Coolify** | 8000 | ✅ Live | http://192.168.1.15:8000 |

### Server Quick Start

**Development Server:**
```bash
# Option A: Using control script (Recommended)
cd /home/user/Projects/veritable-games-main
./start-veritable-games.sh start
./start-veritable-games.sh stop
./start-veritable-games.sh status
./start-veritable-games.sh logs

# Option B: Direct npm command
cd frontend
npm run dev
```

**Database Connection:**
```
Type: PostgreSQL
Host: localhost
Port: 5432
Database: veritable_games
User: postgres
Password: postgres
10 Schemas: forums, wiki, users, auth, content, library, messaging, system, cache, main
```

**Production Server:**
```
Application: http://192.168.1.15:3000
Coolify Dashboard: http://192.168.1.15:8000
SSH: ssh user@192.168.1.15
Domain: https://www.veritablegames.com (via Cloudflare Tunnel)
```

### Common Tasks

**Update code and deploy to production:**
```bash
git add .
git commit -m "feat: description"
git push
# Coolify webhook auto-triggers deployment (~3 minutes)
```

**Database operations:**
```bash
# Connect to database
psql -h localhost -U postgres -d veritable_games

# Or from frontend directory
npm run db:health
```

**Server troubleshooting:**
```bash
# Check if port 3000 is in use
lsof -i :3000
# or
ss -tuln | grep 3000

# Kill stuck process
pkill -f "next dev"

# Clean and restart
cd frontend
npm run dev:clean
npm install
npm run dev
```

**View logs:**
```bash
# Development server logs
tail -f ./logs/server.log

# Production logs
ssh user@192.168.1.15
docker logs veritable-games-app
```

---

## Production Deployment Architecture

### Infrastructure Requirements

#### Minimum Production Specifications

```yaml
Server Requirements:
  - CPU: 4 cores (recommended 8+ for high traffic)
  - Memory: 8GB RAM (recommend 16GB+ for production)
  - Storage: 100GB SSD (with expansion capability)
  - Network: 1Gbps connection with CDN integration
  - OS: Ubuntu 20.04+ LTS or similar Linux distribution

Node.js Environment:
  - Version: Node.js v18.20.8 (mandatory via NVM)
  - Runtime: Next.js 15 production build
  - Process Manager: PM2 or systemd for production
```

#### Production Build Process

```bash
# Production build steps
cd /path/to/veritable-games-main/frontend

# 1. Ensure correct Node.js version
nvm use v18.20.8

# 2. Install dependencies
npm ci --production=false

# 3. Type checking and linting
npm run type-check
npm run lint

# 4. Production build
npm run build

# 5. Start production server
npm start
```

### Environment Configuration

#### Critical Environment Variables

```bash
# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Security Configuration
CSRF_SECRET=your-128-bit-secret
SESSION_SECRET=your-256-bit-secret
SECURITY_HEADERS_ENABLED=true

# Sentry Monitoring (Optional but Recommended)
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn
SENTRY_ORG=your-organization
SENTRY_PROJECT=your-project

# Database Configuration
DATABASE_PATH=/path/to/production/data
SQLITE_WAL_MODE=true
CONNECTION_POOL_SIZE=5

# Rate Limiting Configuration
RATE_LIMIT_REDIS_URL=redis://localhost:6379  # Optional: Use Redis for distributed rate limiting
```

---

## Monitoring & Observability

### Sentry Integration

The platform includes comprehensive Sentry monitoring with privacy-first configuration:

#### Client-Side Monitoring (`sentry.client.config.ts`)

```typescript
Features:
- 10% sampling rate in production (configurable)
- Session replay with privacy protection (masked text/media)
- Console error capture
- Performance monitoring
- Privacy-first data filtering
```

#### Server-Side Monitoring (`sentry.server.config.ts`)

```typescript
Features:
- 10% trace sampling (production)
- Profile sampling for performance analysis
- Sensitive data filtering (auth headers, cookies)
- Database error filtering (prevents noise)
- Console integration for error capture
```

#### Monitoring Configuration

```bash
# Enable Sentry in production
SENTRY_DSN=your-server-dsn
NEXT_PUBLIC_SENTRY_DSN=your-client-dsn

# Sampling rates (adjust based on volume)
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Health Check System

#### Built-in Health Endpoints

```bash
# Primary health check
GET /api/health
Response: {
  "status": "healthy|starting|unhealthy",
  "timestamp": "ISO-8601",
  "uptime": "seconds",
  "service": {
    "name": "veritable-games-main",
    "version": "1.0.0",
    "environment": "production"
  },
  "database": {
    "status": "connected|error",
    "notebookCount": 0
  },
  "memory": {
    "used": "MB",
    "total": "MB"
  }
}

# Comprehensive health check script
node scripts/health-check.js

Features:
- Server connectivity validation
- Database file integrity checks
- API endpoint testing
- Security feature verification
- Forum and wiki system health
- Performance monitoring
```

### System Monitoring

#### Performance Monitoring (`src/lib/monitoring/performance.ts`)

```typescript
Features:
- Core Web Vitals tracking (LCP, FID, CLS)
- Time to First Byte (TTFB) measurement
- First Contentful Paint (FCP) tracking
- Database query performance monitoring
- Slow query detection and alerting
```

#### Comprehensive System Monitor (`src/lib/monitoring/SystemMonitor.ts`)

```typescript
Capabilities:
- Real-time resource usage (CPU, memory, disk)
- Database performance metrics
- Security audit logging
- Admin activity tracking
- Automated alerting system
- Performance bottleneck detection

Thresholds (Configurable):
- Memory: 85% warning, 95% critical
- CPU: 80% warning, 95% critical
- Disk: 90% warning, 95% critical
- Query Performance: >1000ms slow query
```

---

## Security Monitoring & Incident Response

### Multi-Layered Security Architecture

#### Security Middleware (`src/lib/security/middleware.ts`)

```typescript
Protection Layers:
1. CSRF Protection: Token-based with HMAC-SHA256
2. Rate Limiting: Tiered (auth: 5/15min, api: 60/min, page: 100/min)
3. Content Security Policy: Dynamic nonce generation
4. Input Validation: Comprehensive Zod schemas
5. Content Sanitization: DOMPurify for all user content

Rate Limiting Configuration:
- Authentication: 5 attempts per 15 minutes
- API Endpoints: 60 requests per minute
- Admin/Security: 10 requests per minute (strict)
- Page Requests: 100 requests per minute (generous)
```

#### Security Event Logging

```typescript
// Automatic security event logging
SystemMonitor.logSecurityEvent(
  eventType: 'authentication' | 'authorization' | 'data_access',
  severity: 'low' | 'medium' | 'high' | 'critical',
  action: string,
  userId?: number,
  ipAddress?: string,
  details?: Record<string, any>
);
```

### Incident Response Procedures

#### Security Incident Response

1. **Detection**: Automated alerts via SystemMonitor
2. **Assessment**: Review security audit logs
3. **Containment**: Rate limiting escalation, IP blocking
4. **Investigation**: Full audit trail analysis
5. **Recovery**: System restoration from backups
6. **Documentation**: Incident post-mortem and improvements

#### Performance Incident Response

1. **Alert Triggers**: Resource threshold breaches
2. **Immediate Actions**: Scale resources, restart services
3. **Root Cause Analysis**: Database performance, memory leaks
4. **Resolution**: Code optimization, infrastructure scaling
5. **Prevention**: Performance budgets, monitoring improvements

---

## Database Operations & Maintenance

### Connection Pool Management

#### Database Pool Architecture (`src/lib/database/pool.ts`)

```typescript
Critical Features:
- Singleton connection pool (max 5 connections)
- WAL mode for optimal concurrency
- Automatic connection lifecycle management
- Graceful shutdown with connection cleanup
- Performance optimization pragmas
- Foreign key constraint enforcement

Configuration:
- Journal Mode: WAL (Write-Ahead Logging)
- Busy Timeout: 5000ms
- Cache Size: 10,000 pages
- Synchronous: NORMAL (performance/safety balance)
```

#### Database Optimization Results

```
Optimization Achievements (2025-09-05 to 2025-09-06):
- Database size: 34.22MB → 5.39MB (84% reduction)
- Removed: 14 orphaned tables, 22+ unused indexes
- Space reclaimed: 28.83MB
- Performance improvement: Faster queries, reduced overhead
- All data safely backed up to CRITICAL_BACKUPS/
```

### Maintenance Procedures

#### Database Maintenance Scripts

```bash
# Core database operations
node scripts/populate-forums.js     # Initialize forum structure
node scripts/populate-wiki.js       # Initialize wiki (127+ pages)
node scripts/health-check.js        # Comprehensive health check
node scripts/init-settings.js       # System configuration

# Analysis and monitoring (25+ analysis scripts)
node scripts/analysis/              # Content analysis and verification
node scripts/debug/                 # Debugging and diagnostic utilities
node scripts/migration/             # Database migrations
node scripts/wiki-management/       # Wiki administration tools
```

#### Automated Database Maintenance

```bash
# Daily maintenance tasks
- Vacuum database: VACUUM; (weekly)
- Update statistics: ANALYZE; (daily)
- Check integrity: PRAGMA integrity_check; (daily)
- Monitor WAL size: PRAGMA wal_checkpoint(TRUNCATE); (hourly)
- Clean old performance data: Via SystemMonitor retention
```

---

## Backup & Disaster Recovery

### Automated Backup System

#### Safe Backup Script (`safe-backup.sh`)

```bash
Backup Strategy:
- Hourly: Last 24 backups retained
- Daily: Last 7 backups retained
- Weekly: Last 4 backups retained
- Location: /home/user/CRITICAL_BACKUPS/

Components Backed Up:
- Complete source code (excluding node_modules, .next, .git)
- Database files (including WAL/SHM files)
- Configuration files (package.json, tsconfig.json, etc.)
- Public assets (excluding large static files)
- Documentation and scripts

Backup Verification:
- File integrity checks
- Backup size validation
- Restore testing procedures
```

#### Disaster Recovery Procedures

**Data Loss Scenarios:**

1. **Database Corruption**

   ```bash
   # Stop application
   ./start-veritable-games.sh stop

   # Restore from latest backup
   LATEST_BACKUP=$(ls -t /home/user/CRITICAL_BACKUPS/hourly/ | head -1)
   cp "/home/user/CRITICAL_BACKUPS/hourly/$LATEST_BACKUP/database/*" ./data/

   # Verify integrity
   node scripts/health-check.js

   # Restart application
   ./start-veritable-games.sh start
   ```

2. **Complete System Failure**

   ```bash
   # Full system restoration
   LATEST_BACKUP=$(ls -t /home/user/CRITICAL_BACKUPS/hourly/ | head -1)
   cp -r "/home/user/CRITICAL_BACKUPS/hourly/$LATEST_BACKUP/*" ./

   # Reinstall dependencies
   npm install

   # Rebuild application
   npm run build

   # Restore and restart
   ./start-veritable-games.sh restart
   ```

### Recovery Time Objectives (RTO) & Recovery Point Objectives (RPO)

- **RTO Target**: 15 minutes (standard), 5 minutes (critical)
- **RPO Target**: 1 hour (hourly backups)
- **Data Retention**: 30 days full backups, 1 year archives

---

## Performance Optimization

### Performance Monitoring Strategy

#### Core Web Vitals Tracking

```typescript
Tracked Metrics:
- Largest Contentful Paint (LCP): <2.5s target
- First Input Delay (FID): <100ms target
- Cumulative Layout Shift (CLS): <0.1 target
- First Contentful Paint (FCP): <1.8s target
- Time to First Byte (TTFB): <800ms target
```

#### Database Performance Optimization

```typescript
Query Performance Standards:
- Standard queries: <100ms
- Complex queries: <500ms
- Slow query threshold: >1000ms (automatic logging)
- Connection pool utilization: <80%
- Database size: Monitor growth trends
```

### Scaling Strategies

#### Horizontal Scaling Preparation

```typescript
Ready for Scaling:
- Stateless application architecture
- Connection pooling supports multiple instances
- Session management via database (not memory)
- Asset optimization with CDN integration
- Database connection limits configurable
```

#### Vertical Scaling Guidelines

```yaml
Scaling Thresholds:
  CPU Usage > 70%: Consider CPU upgrade
  Memory Usage > 80%: Add more RAM
  Disk Usage > 85%: Increase storage
  Database Connections > 80%: Increase pool size
  Response Time > 1000ms: Investigate bottlenecks
```

---

## Operational Runbooks

### Server Management

#### Service Control (`start-veritable-games.sh`)

```bash
# Service management commands
./start-veritable-games.sh start    # Start server with health checks
./start-veritable-games.sh stop     # Graceful shutdown
./start-veritable-games.sh restart  # Full restart with cleanup
./start-veritable-games.sh status   # Service status check

Features:
- Automatic port cleanup (3000)
- Multiple process detection methods
- Progressive startup verification (IPv4/IPv6)
- Comprehensive logging system
- Lock file management
- Node.js version enforcement (v18.20.8)
```

#### Log Management

```bash
Log Locations:
- Startup logs: /path/startup.log
- Server logs: /path/server.log
- Error logs: /path/server-error.log
- Health checks: Via scripts/health-check.js

Log Rotation Strategy:
- Size-based rotation: 100MB per file
- Time-based rotation: Daily
- Retention: 30 days production logs
- Compression: gzip for archived logs
```

### Maintenance Windows

#### Scheduled Maintenance Procedures

```bash
# Pre-maintenance checklist
1. Notify users of maintenance window
2. Create backup: ./safe-backup.sh
3. Stop services: ./start-veritable-games.sh stop
4. Perform maintenance tasks
5. Test services: node scripts/health-check.js
6. Start services: ./start-veritable-games.sh start
7. Verify functionality: Full health check
8. Monitor for 30 minutes post-restart
```

#### Emergency Maintenance

```bash
# Critical issue response
1. Immediate assessment: Check health endpoints
2. Service restart: ./start-veritable-games.sh restart
3. If unsuccessful: Restore from backup
4. Monitor system: scripts/health-check.js
5. Investigate root cause: Review error logs
6. Implement permanent fix
7. Document incident and resolution
```

---

## Infrastructure Automation Opportunities

### Recommended Automation Tools

#### Container Orchestration

```dockerfile
# Docker configuration recommendations
FROM node:18.20.8-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### CI/CD Pipeline Integration

```yaml
# GitHub Actions example
name: Production Deployment
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18.20.8'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: node scripts/health-check.js
```

#### Infrastructure as Code

```yaml
# Terraform/CloudFormation recommendations
- Load balancer configuration
- Auto-scaling groups
- Database cluster management
- Monitoring and alerting setup
- Backup automation
- SSL certificate management
```

### Monitoring Automation

#### Alert Management

```typescript
Automated Alerting:
- Resource threshold breaches → Immediate notification
- Security events → Security team notification
- Performance degradation → DevOps team notification
- Service downtime → Escalation procedures
- Backup failures → Operations team notification
```

#### Self-Healing Capabilities

```bash
Implemented:
- Automatic service restarts via systemd/PM2
- Database connection pool recovery
- Rate limiting self-adjustment
- Memory usage monitoring with alerts

Recommended:
- Auto-scaling based on resource usage
- Automatic failover to backup instances
- Self-healing deployment rollbacks
- Predictive scaling based on traffic patterns
```

---

## Capacity Planning & Resource Management

### Current Resource Utilization

#### Database Optimization Results

```
Database Performance (Post-Optimization):
- Database size: 5.39MB (84% reduction achieved)
- Connection pool: Max 5 connections
- Query performance: <100ms average
- WAL file management: Automatic checkpointing
- Index efficiency: 22+ unused indexes removed
```

#### Memory Management

```typescript
Memory Usage Patterns:
- Base application: ~50-100MB
- Per connection: ~5-10MB
- Peak usage: Monitor for >1GB
- Garbage collection: Automatic
- Memory leaks: Monitored via SystemMonitor
```

### Growth Planning

#### Traffic Scaling Projections

```yaml
Current Capacity:
  - Concurrent users: 100-200
  - Requests per minute: 1000-2000
  - Database connections: 5 (pooled)
  - Memory usage: <1GB

Scaling Thresholds:
  - 500 concurrent users: Add horizontal scaling
  - 5000 requests/minute: Add load balancing
  - Database connections >80%: Increase pool size
  - Memory >4GB: Vertical scaling required
```

#### Infrastructure Scaling Strategy

```yaml
Phase 1 (Current): Single server deployment
  - Vertical scaling for immediate needs
  - Database optimization and connection pooling
  - CDN integration for static assets

Phase 2 (Growth): Multi-server deployment
  - Load balancer implementation
  - Database clustering or managed service
  - Redis for session and cache management
  - Microservices architecture consideration

Phase 3 (Enterprise): Full cloud-native
  - Kubernetes orchestration
  - Auto-scaling based on metrics
  - Multi-region deployment
  - Advanced monitoring and observability
```

---

## Operational Excellence Recommendations

### Performance Optimization Priority List

1. **Database Performance**

   - Connection pool monitoring and tuning
   - Query optimization and index management
   - Database clustering for read replicas
   - Cache layer implementation (Redis)

2. **Application Performance**

   - Bundle size optimization and code splitting
   - Image optimization and CDN integration
   - Server-side caching strategies
   - Performance budget enforcement

3. **Infrastructure Scaling**
   - Load balancer implementation
   - Auto-scaling configuration
   - Container orchestration setup
   - Multi-region deployment planning

### Security Enhancement Roadmap

1. **Enhanced Authentication**

   - Multi-factor authentication implementation
   - OAuth2/OIDC provider integration
   - Session management improvements
   - Password policy enforcement

2. **Advanced Security Monitoring**

   - Real-time threat detection
   - Automated incident response
   - Security audit automation
   - Vulnerability scanning integration

3. **Compliance & Governance**
   - Data privacy compliance (GDPR/CCPA)
   - Security audit trail enhancement
   - Access control refinement
   - Compliance reporting automation

### Operational Improvements

1. **Monitoring & Alerting**

   - Custom dashboard creation
   - Predictive alerting based on trends
   - Integration with external monitoring tools
   - Business metrics tracking

2. **Automation & DevOps**

   - Complete CI/CD pipeline implementation
   - Infrastructure as Code deployment
   - Automated testing and deployment
   - Disaster recovery testing automation

3. **Documentation & Process**
   - Runbook automation and testing
   - Incident response plan refinement
   - Change management process implementation
   - Knowledge base maintenance

---

## Conclusion

The Veritable Games platform demonstrates production-ready architecture with comprehensive monitoring, security, and operational capabilities. The recent optimization efforts (84% database size reduction, connection pool implementation, security hardening) have established a solid foundation for production deployment.

**Key Production Readiness Indicators:**

- ✅ Multi-layered security implementation
- ✅ Comprehensive monitoring and alerting
- ✅ Automated backup and disaster recovery
- ✅ Performance optimization and monitoring
- ✅ Operational runbooks and procedures
- ✅ Scalability planning and resource management

**Next Steps for Production:**

1. Complete environment configuration and testing
2. Implement final infrastructure automation
3. Conduct disaster recovery testing
4. Establish monitoring dashboards and alerting
5. Execute production deployment with gradual rollout
6. Monitor and optimize based on production metrics

This operations guide provides the foundation for reliable, secure, and scalable production deployment of the Veritable Games platform.
