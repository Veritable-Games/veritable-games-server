# Veritable Games Platform - Server Infrastructure Report

## Executive Summary

**Project**: Veritable Games Platform  
**Type**: Full-stack Next.js 15 community platform  
**Current Status**: Development server running (localhost:3000), Production deployed (192.168.1.15:3000)  
**Last Updated**: November 9, 2025

---

## 1. CURRENT DEVELOPMENT ENVIRONMENT (localhost)

### Server Status
- **Application Server**: ✅ Running on port 3000
- **Database Server**: ✅ PostgreSQL running on port 5432  
- **Server Type**: Next.js 15 development server with Turbopack
- **Process ID**: Multiple processes (628491-628718)
- **User**: `user` (non-root)
- **Uptime**: Since November 8

### Server Details

#### Frontend Server
```
Runtime: Node.js 20.18.2 (required)
Framework: Next.js 15.5.6 with App Router
UI: React 19.1.1 with Server Components
TypeScript: 5.7.2 (strict mode)
Port: 3000 (bound to 0.0.0.0 for network access)
Start Command: npm run dev --turbo -H 0.0.0.0
Location: /home/user/Projects/veritable-games-main/frontend/
```

#### Database Server
```
Type: PostgreSQL 15 (running in Docker container)
Port: 5432 (localhost)
Container: veritable-games-postgres (via docker-compose)
Database Name: veritable_games
Database User: postgres
Database Password: postgres
Data Directory: /var/lib/postgresql/data
WAL Mode: Enabled
Max Connections: 200
Shared Buffers: 256MB
Effective Cache Size: 1GB
```

---

## 2. DATABASE ARCHITECTURE

### Active Databases (10 Schemas)

The system uses PostgreSQL with 10 specialized schemas (previously SQLite databases):

| Schema Name | Purpose | Key Tables | Status |
|---|---|---|---|
| **forums** | Forum system | categories, topics, replies, forum_search_fts | ✅ Active |
| **wiki** | Wiki content | wiki_pages, wiki_revisions, wiki_search_fts | ✅ Active |
| **users** | User management | users, profiles, settings | ✅ Active |
| **auth** | Authentication | sessions, tokens | ✅ Active |
| **content** | CMS content | news, projects, team_members, project_revisions | ✅ Active |
| **library** | Document management | library_documents, library_search_fts, categories | ✅ Active |
| **messaging** | Private messages | messages, conversations | ✅ Active |
| **system** | Configuration | settings, feature_flags | ✅ Active |
| **cache** | Caching layer | Reserved for future use | 📋 Reserved |
| **main** | Legacy archive | (no new data) | 📦 Legacy |

### Migration Status
- **PostgreSQL Migration**: ✅ Complete (October 30, 2025)
- **Rows Migrated**: 50,646 (from SQLite to PostgreSQL)
- **Success Rate**: 99.99%
- **Tables**: 155 total
- **Indexes**: 273 total

### Connection Configuration

```env
# Development (localhost)
DATABASE_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_SSL=false
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=5000
```

---

## 3. ENVIRONMENT VARIABLES (ACTIVE CONFIG)

### Location
```
File: /home/user/Projects/veritable-games-main/frontend/.env.local
Type: Git-ignored (never committed)
```

### Current Active Variables

```env
# Database
DATABASE_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_SSL=false
POSTGRES_POOL_MAX=20
POSTGRES_POOL_MIN=2

# Application
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Security (generated with: openssl rand -hex 32)
SESSION_SECRET=<32-char-hex-string>
CSRF_SECRET=<32-char-hex-string>
ENCRYPTION_KEY=<32-char-hex-string>

# Cookie Security
COOKIE_SECURE_FLAG=false (HTTP-only, not HTTPS)
COOKIE_USE_SECURE_PREFIX=false (uses 'session_id' not '__Secure-session_id')

# Feature Flags
ENABLE_FORUMS=true
ENABLE_WIKI=true
ENABLE_LIBRARY=true
ENABLE_3D_VIEWER=true
ENABLE_WORKSPACE=true
ADMIN_ENABLED=false

# Logging
LOG_LEVEL=info
DEBUG_DATABASE_QUERIES=false
```

---

## 4. SERVER ACCESS & CONNECTIVITY

### Local Development Access

```
Web Application: http://localhost:3000
API Base URL: http://localhost:3000/api
WebSocket URL: http://localhost:3001 (configured but not active)
PostgreSQL: localhost:5432
```

### Network Binding
- **Address**: 0.0.0.0 (accessible from any network interface)
- **Protocol**: HTTP (not HTTPS in development)
- **Firewall**: Check local network firewall if accessing from other machines

### Testing Server Connectivity

```bash
# Test HTTP server
curl http://localhost:3000

# Test API
curl http://localhost:3000/api/forums/categories

# Test PostgreSQL
psql -h localhost -U postgres -d veritable_games
```

**Note**: Currently returning "Internal Server Error" due to build cache issues (see Issue section below)

---

## 5. DATABASE CONNECTION POOL

### Implementation Details

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/database/pool-postgres.ts`

```typescript
// Connection Pool Configuration
class PostgreSQLPool {
  - Singleton pattern (one instance per application)
  - Lazy initialization on first use
  - Automatic environment detection:
    - Serverless detection (Vercel, AWS Lambda)
    - Vercel Postgres auto-detection
  - Connection retry logic
  - Transaction support with automatic rollback
}

// Pool Settings
const poolConfig = {
  connectionString: process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL,
  max: process.env.POSTGRES_POOL_MAX || 20,  // Development
  min: process.env.POSTGRES_POOL_MIN || 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.POSTGRES_SSL === 'true',
}
```

### Database Access Pattern (REQUIRED)

```typescript
// ✅ CORRECT - Always use singleton pool
import { dbPool } from '@/lib/database/pool';
const db = dbPool.getConnection('users');
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ WRONG - Never create Database instances directly
import Database from 'better-sqlite3';
const db = new Database('path/to/db'); // Causes connection leaks!
```

---

## 6. PRODUCTION SERVER (192.168.1.15)

### Deployment Status
- **Status**: ✅ **LIVE IN PRODUCTION** (November 5, 2025)
- **Platform**: Coolify + Docker + Nixpacks
- **Server**: Ubuntu Server 22.04.5 LTS
- **IP Address**: 192.168.1.15
- **Local Access**: http://192.168.1.15:3000
- **Public URL**: https://www.veritablegames.com (via Cloudflare Tunnel)
- **Deployment Dashboard**: http://192.168.1.15:8000

### Production Infrastructure

```
Server Specs:
├── CPU: 2+ cores
├── RAM: 4GB
├── Storage: 50GB
├── OS: Ubuntu 22.04.5 LTS
├── Network: Static IP on local network
├── Database: PostgreSQL 15 (on server)
└── Container Runtime: Docker

Services:
├── Application: http://192.168.1.15:3000 (Next.js via Coolify)
├── Database: PostgreSQL on 5432
├── Coolify Dashboard: http://192.168.1.15:8000
└── Public URL: https://www.veritablegames.com
```

### Auto-Deployment

```
Trigger: GitHub push to main branch
Mechanism: Coolify GitHub App webhook
Build Time: ~3 minutes
Success Rate: ✅ Enabled and working
Last Deploy: November 5, 2025
```

---

## 7. DEVELOPMENT COMMANDS

### Server Management (from root directory)

```bash
# Start development server (daemonized)
./start-veritable-games.sh start

# Stop development server
./start-veritable-games.sh stop

# Check server status
./start-veritable-games.sh status

# View recent logs
./start-veritable-games.sh logs

# Restart server
./start-veritable-games.sh restart
```

### Development Commands (from frontend/ directory)

```bash
# Start with Turbopack (fast)
npm run dev

# Start without Turbopack (for debugging)
npm run dev:debug

# Production build
npm run build

# Start production server
npm run start

# Type checking (REQUIRED before commits)
npm run type-check

# Database health check
npm run db:health

# Database backup
npm run db:backup
```

---

## 8. MONITORING & HEALTH

### Process Management

```bash
# Check if Next.js dev server is running
pgrep -f "next dev"

# View all Node.js processes
ps aux | grep node

# Check listening ports
netstat -tuln | grep -E ":3000|:5432"
or
ss -tuln | grep -E ":3000|:5432"

# Monitor server logs
tail -f /home/user/Projects/veritable-games-main/logs/server.log
```

### Database Health

```bash
# From frontend/ directory
npm run db:health

# Manual PostgreSQL connection test
psql -h localhost -U postgres -d veritable_games -c "SELECT version();"

# Check connection pool status
curl http://localhost:3000/api/health
```

### Port Status

Current listening ports:
- **3000**: Next.js development server ✅
- **5432**: PostgreSQL database ✅
- **3001**: WebSocket (configured but not active)
- **8000**: Coolify dashboard (production server only)

---

## 9. CURRENT ISSUES & TROUBLESHOOTING

### Issue 1: Build Manifest Errors (Current)

**Symptoms**:
- Server returns "Internal Server Error" on some requests
- Logs show: `ENOENT: no such file or directory` for `.next/static/` files

**Root Cause**:
- Turbopack build cache corruption after extended development
- Temporary files left from interrupted builds

**Resolution**:
```bash
cd frontend

# Clear Next.js cache
npm run dev:clean
# OR manually:
rm -rf .next node_modules package-lock.json
npm install

# Rebuild
npm run build

# Restart
npm run dev
```

**Affected Files**:
- `/home/user/Projects/veritable-games-main/frontend/.next/` (build artifacts)

### Issue 2: Database Connection Issues (if they occur)

**Symptoms**:
- "FATAL: PostgreSQL connection not configured" error
- API calls fail with database errors

**Root Cause**:
- Missing POSTGRES_URL or DATABASE_URL environment variable
- PostgreSQL service not running
- Connection pool exhausted

**Resolution**:
```bash
# Verify environment variables
cat frontend/.env.local | grep POSTGRES

# Check PostgreSQL is running
docker ps | grep postgres
# OR
ps aux | grep postgres

# Check for connection limit issues
psql -h localhost -U postgres -c "SELECT count(*) as connections FROM pg_stat_activity;"
```

### Production Server Connection Issues

If experiencing problems accessing http://192.168.1.15:3000:

1. **SSH into production server**:
   ```bash
   ssh user@192.168.1.15
   ```

2. **Check Coolify dashboard**:
   ```
   http://192.168.1.15:8000
   ```

3. **View application logs**:
   ```bash
   # Via Coolify logs panel
   # OR access server and check Docker logs
   docker logs veritable-games-app
   ```

4. **Restart application via Coolify**:
   - Visit http://192.168.1.15:8000
   - Navigate to application settings
   - Click "Restart"

---

## 10. DIRECTORY STRUCTURE

```
/home/user/Projects/veritable-games-main/
├── frontend/                    # ⭐ ALL development work here
│   ├── .env.local              # Environment variables (git-ignored)
│   ├── package.json            # Dependencies
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── api/          # API routes
│   │   │   └── (routes)/     # Page components
│   │   ├── lib/              # Services & utilities
│   │   │   └── database/     # Database layer
│   │   │       ├── pool.ts   # Export point
│   │   │       ├── pool-postgres.ts  # PostgreSQL pool
│   │   │       └── adapter.ts        # Database adapter
│   │   ├── components/       # React components
│   │   └── types/            # TypeScript types
│   ├── data/                  # SQLite databases (development only)
│   ├── .next/                 # Build artifacts
│   └── node_modules/          # Dependencies
├── docker-compose.yml         # PostgreSQL + pgAdmin configuration
├── .env.local                 # Git-ignored (not in root, use frontend/.env.local)
├── logs/                      # Server logs
│   └── server.log
├── docs/                      # Documentation
│   ├── DEPLOYMENT_DOCUMENTATION_INDEX.md
│   ├── deployment/
│   └── operations/
└── start-veritable-games.sh  # Server control script
```

---

## 11. KEY DEPENDENCIES & VERSIONS

### Runtime
- Node.js: 20.18.2 (required)
- npm: ≥10.0.0

### Framework & UI
- Next.js: 15.5.6 (Turbopack enabled)
- React: 19.1.1 (Server Components default)
- TypeScript: 5.7.2 (strict mode)
- Tailwind CSS: 3.4.17

### Database
- PostgreSQL: 15 (production)
- better-sqlite3: 9.6.0 (legacy, not used in production)
- pg: Latest (connection pool)

### Key Libraries
- react-hook-form: 7.48.2 (forms)
- zod: 4.0.17 (validation)
- zustand: 5.0.8 (state management)
- three.js: 0.180.0 (3D graphics)
- react-markdown: 10.1.0 (markdown rendering)

---

## 12. SECURITY CONFIGURATION

### Current Setup

```
Authentication: Session-based (no JWT)
Password Hashing: bcryptjs (12 salt rounds)
Content Sanitization: DOMPurify 3.2.6
SQL Security: Prepared statements only
CSRF Protection: Enabled (double submit cookie)
Cookie Security: SameSite=strict, Secure=false (HTTP-only dev)
```

### Environment Variables to Secure

```
SESSION_SECRET        - 32-char hex (generated)
CSRF_SECRET          - 32-char hex (generated)
ENCRYPTION_KEY       - 32-char hex (generated)
DATABASE credentials - Never commit .env.local
```

**Generate secrets**:
```bash
openssl rand -hex 32  # Run 3 times for each secret
```

---

## 13. DOCUMENTATION REFERENCES

### Quick Links

| Document | Purpose | Location |
|---|---|---|
| **CLAUDE.md** | Main development guide | `/home/user/Projects/veritable-games-main/CLAUDE.md` |
| **README.md** | Overview & quick start | `/home/user/Projects/veritable-games-main/README.md` |
| **DEPLOYMENT_DOCUMENTATION_INDEX.md** | All deployment guides | `/docs/DEPLOYMENT_DOCUMENTATION_INDEX.md` |
| **COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md** | Real deployment record | `/docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md` |
| **DATABASE.md** | Database architecture | `/docs/DATABASE.md` |
| **PRODUCTION_OPERATIONS.md** | Production monitoring | `/docs/operations/PRODUCTION_OPERATIONS.md` |

---

## 14. DOCKER COMPOSE SETUP

**File**: `/home/user/Projects/veritable-games-main/docker-compose.yml`

```yaml
Services:
  postgres:          # PostgreSQL 15 Alpine
    Port: 5432
    Database: veritable_games
    User: postgres / Password: postgres
    
  pgadmin:           # Database management UI
    Port: 5050
    Email: admin@veritable-games.com
    Password: admin
```

**Start services**:
```bash
docker-compose up -d

# Verify
docker-compose ps
```

---

## 15. SUMMARY TABLE

| Component | Status | Details |
|---|---|---|
| **Development Server** | ✅ Running | localhost:3000 (Next.js + Turbopack) |
| **PostgreSQL** | ✅ Running | localhost:5432 (Docker container) |
| **Production Server** | ✅ Live | 192.168.1.15:3000 (Coolify) |
| **Auto-Deployment** | ✅ Enabled | GitHub → Coolify webhook |
| **Database Migration** | ✅ Complete | SQLite → PostgreSQL (Oct 30) |
| **SSL/TLS** | ❌ Disabled | HTTP-only (development) |
| **Build Status** | ⚠️ Issues | Build cache corruption (fixable) |
| **API Health** | ⚠️ Testing | Some endpoints returning errors |

---

## 16. QUICK REFERENCE CHECKLIST

### Before Starting Work
- [ ] Node.js 20.18.2 installed (`node --version`)
- [ ] npm >= 10.0.0 installed (`npm --version`)
- [ ] `.env.local` configured in `/frontend/`
- [ ] PostgreSQL running (`docker-compose up -d`)
- [ ] Dependencies installed (`cd frontend && npm install`)

### Starting Development
```bash
# From root directory
./start-veritable-games.sh start

# OR from frontend directory
cd frontend
npm run dev

# Server will be available at http://localhost:3000
```

### Before Committing Code
```bash
# From frontend directory
npm run type-check    # TypeScript validation (CRITICAL)
npm test              # Run tests
npm run format        # Prettier formatting
```

### Deploying to Production
```
1. Push to GitHub main branch
2. Coolify webhook triggered automatically
3. Build starts (~3 minutes)
4. Auto-deploy to 192.168.1.15:3000
5. Check http://192.168.1.15:8000 (Coolify dashboard)
```

---

## Support & Contact

For detailed guides and troubleshooting:
1. Check `/docs/` directory for comprehensive documentation
2. See `CLAUDE.md` for architecture details
3. See `README.md` for quick start
4. Production access guide: `/docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md`

---

**Document Generated**: November 9, 2025  
**Last Updated**: November 9, 2025  
**Status**: Ready for development
