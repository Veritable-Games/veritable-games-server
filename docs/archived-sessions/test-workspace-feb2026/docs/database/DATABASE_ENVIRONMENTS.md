# Database Environments

**Last Updated**: November 12, 2025

## Overview

Veritable Games uses different database systems in different environments:

| Environment | Database | Location | Purpose |
|-------------|----------|----------|---------|
| **Development (localhost:3000)** | SQLite 3 | `frontend/data/*.db` | Local development & testing |
| **Production (192.168.1.15:3000)** | PostgreSQL 15 | Docker container | Production deployment |

---

## Critical Understanding

**THREE different environments = THREE different databases = DIFFERENT PASSWORDS**

### Environment Details

#### 1. Localhost Development (localhost:3000)
- **Database**: SQLite (10 database files in `frontend/data/`)
- **User Data**: Local test accounts
- **Password Storage**: bcrypt hashes in `frontend/data/users.db`
- **Schema**: 10 separate database files

#### 2. Production Server (192.168.1.15:3000)
- **Database**: PostgreSQL 15 (13 schemas in single database)
- **User Data**: Production accounts
- **Password Storage**: bcrypt hashes in `users.users` table
- **Schema**: 13 PostgreSQL schemas (forums, wiki, users, auth, content, library, messaging, system, cache, main, anarchist, shared, documents)

#### 3. Published Domain (www.veritablegames.com)
- **Same as 192.168.1.15** (routes to same PostgreSQL instance)
- **Difference**: Cloudflare tunnel routing instead of direct IP access

---

## Password Syncing Between Environments

### Standard Development Passwords

**Keep these synced** between localhost and production for testing:

```
Admin:
  Username: admin
  Password: euZe3CTvcDqqsVz

Test User:
  Username: testuser
  Password: m8vBmxHEtq5MT6
```

### Why Passwords Don't Auto-Sync

- ✅ Changing password on localhost → Only affects SQLite (`frontend/data/users.db`)
- ❌ Does NOT sync to production PostgreSQL automatically
- ❌ You'll get "Invalid username or password" on 192.168.1.15:3000 if not synced

### How to Sync Passwords to Production

**When you get "Invalid username or password" on production:**

```bash
# Quick sync (copies and runs script on production)
scp frontend/scripts/user-management/sync-passwords-to-production.js user@192.168.1.15:/tmp/sync.js
ssh user@192.168.1.15 "docker cp /tmp/sync.js m4s0kwo4kc4oooocck4sswc4:/app/sync.js && docker exec m4s0kwo4kc4oooocck4sswc4 node sync.js && rm /tmp/sync.js"
```

This syncs the standard passwords from the script to production PostgreSQL.

---

## Database Adapter Pattern

The codebase uses an adapter pattern to automatically route between SQLite (development) and PostgreSQL (production):

**Development** (`NODE_ENV=development`):
```typescript
// Uses dbPool.getConnection('database-name')
// Routes to SQLite files in frontend/data/
const db = dbPool.getConnection('users');
```

**Production** (`NODE_ENV=production` + `DATABASE_URL` set):
```typescript
// Same code, but routes to PostgreSQL schemas
// Routes to PostgreSQL schema via DATABASE_URL
const db = dbPool.getConnection('users'); // → users schema in PostgreSQL
```

**Safety Guards**:
- `requirePostgres()` - Ensures PostgreSQL in production code
- `assertDevEnvironment()` - Guards development-only utilities
- Auto-detection via `DATABASE_URL` environment variable

---

## Environment Variables

### Development (localhost)
```bash
# .env.local in frontend/
SESSION_SECRET=your_session_secret
CSRF_SECRET=your_csrf_secret
ENCRYPTION_KEY=your_encryption_key

# Optional - SQLite is default
# DATABASE_URL not needed for development
```

### Production (192.168.1.15)
```bash
# Required for production
DATABASE_URL=postgresql://user:password@host:5432/database
# OR
POSTGRES_URL=postgresql://user:password@host:5432/database

SESSION_SECRET=production_session_secret
CSRF_SECRET=production_csrf_secret
ENCRYPTION_KEY=production_encryption_key
```

---

## Schema Differences

### SQLite (Development)
- 10 separate database files
- File-based storage
- FTS5 full-text search
- WAL mode enabled
- Simpler schema (some tables simplified for dev)

### PostgreSQL (Production)
- 13 schemas in single database
- Server-based storage
- GIN indexes with to_tsvector for full-text search
- Connection pooling required
- Full production schema with all constraints

---

## Migration Between Environments

### Development → Production
1. Test changes on localhost (SQLite)
2. Run migrations on production (PostgreSQL)
3. Sync passwords if needed
4. Verify schema compatibility

### Production → Development
1. Export data from PostgreSQL (if needed)
2. Import to SQLite (schema mapping required)
3. Run `npm run db:health` to verify

---

## Testing Across Environments

```bash
# Test localhost
npm run dev
# Visit http://localhost:3000
# Login with admin credentials

# Test production (local network)
# Visit http://192.168.1.15:3000
# Login with same admin credentials (if synced)

# Test published domain
# Visit https://www.veritablegames.com
# Same as 192.168.1.15 (routes to same server)
```

---

## Troubleshooting

### "Invalid username or password" on production
**Cause**: Passwords not synced between environments
**Fix**: Run password sync script (see above)

### "Database not found" error
**Cause**: Missing `DATABASE_URL` environment variable in production
**Fix**: Set `DATABASE_URL` in Coolify environment variables

### Schema mismatch errors
**Cause**: Development SQLite schema different from production PostgreSQL
**Fix**: Run database migrations on production

### Connection pooling errors
**Cause**: Too many PostgreSQL connections
**Fix**: Increase connection limits or optimize queries

---

## Related Documentation

- **[docs/database/DATABASE.md](./database/DATABASE.md)** - Complete database architecture
- **[docs/architecture/DATABASE_SAFETY_GUARDS.md](./architecture/DATABASE_SAFETY_GUARDS.md)** - Safety patterns
- **[docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production operations
- **[frontend/src/lib/database/pool.ts](../frontend/src/lib/database/pool.ts)** - Database adapter implementation

---

**Summary**: Development uses 10 SQLite files, production uses 13 PostgreSQL schemas. Passwords must be synced manually. Use `DATABASE_URL` for production, omit for development.
