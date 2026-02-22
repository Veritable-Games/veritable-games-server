# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> **Date Context**: Always check `<env>Today's date: ...</env>` before updating timestamps. Claude often assumes wrong years.

---

## 🚀 Quick Start (First 5 Minutes)

**New to this codebase? Start here:**

1. ✅ **Directory**: Work in `frontend/` for npm commands, root for git commands
2. ✅ **Environment**: Copy `.env.example` to `.env.local` and generate 3 secrets:
   ```bash
   openssl rand -hex 32  # SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY
   ```
3. ✅ **Verify Setup**: `npm run db:health` (from frontend/)
4. ✅ **Type Check**: `npm run type-check` (from frontend/) - REQUIRED before commit
5. ✅ **Start Dev**: `./start-veritable-games.sh start` (from root)

**Before ANY commit:**
```bash
cd frontend
npm run type-check  # MUST pass
npm run format
npm test

# If commit includes database schema changes:
npm run db:validate-schema  # Verify schema matches code
```

---

## 🔑 Production Server Access (CLAUDE HAS ACCESS!)

**🤖 CLAUDE CODE CAN ACCESS PRODUCTION SERVER** - WireGuard VPN is usually already connected!

### ✅ YOU CAN RUN PRODUCTION COMMANDS DIRECTLY

**First, verify connectivity** (WireGuard is likely already up):
```bash
# Check if production server is reachable
ping -c 1 10.100.0.1

# If successful, you can SSH directly:
ssh user@10.100.0.1 "docker ps"
```

**If ping fails**, check which WireGuard interface is active and switch if needed (see below).

### Quick SSH Reference
```bash
# Remote access via WireGuard VPN (PREFERRED - works from anywhere)
ssh user@10.100.0.1

# Local network (only works if on same LAN as server)
ssh user@192.168.1.15
```

**💡 Pro Tip**: ALWAYS try `ssh user@10.100.0.1` FIRST. WireGuard is usually already connected!

### ⚠️ WireGuard VPN: Two Interfaces (IMPORTANT)

**The system uses TWO WireGuard interfaces** - you must use the correct one:

| Interface | Use When | Endpoint | Check Command |
|-----------|----------|----------|---------------|
| **wg0-home** | On home network (192.168.1.x) | 192.168.1.15:51820 | `nmcli con show --active \| grep wg0` |
| **wg0-away** | On public/other networks | wg.veritablegames.com:51820 | `ping -c 2 10.100.0.1` |

**Common Issue**: If VPN is UP but has no connectivity, you're probably using the wrong interface!

```bash
# Check which interface is active
nmcli connection show --active | grep wg0

# If on PUBLIC network but wg0-home is active → SWITCH:
nmcli connection down wg0-home && nmcli connection up wg0-away

# If on HOME network but wg0-away is active → SWITCH:
nmcli connection down wg0-away && nmcli connection up wg0-home

# Verify connectivity
ping -c 3 10.100.0.1
```

**Why Two Interfaces?**
- `wg0-home`: Fast direct LAN connection (MTU 1420, <1ms latency)
- `wg0-away`: Encrypted internet tunnel (MTU 1280, ~50ms latency)
- **Auto-switch**: Installed at `/etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch`

**Troubleshooting**: See [docs/server/wireguard/WIREGUARD_PUBLIC_NETWORK_FIX_FEB_2026.md](./docs/server/wireguard/WIREGUARD_PUBLIC_NETWORK_FIX_FEB_2026.md)

### Access Points
| Service | Local Network | WireGuard VPN | Public |
|---------|---------------|---------------|--------|
| **Site** | http://192.168.1.15:3000 | http://10.100.0.1:3000 | https://www.veritablegames.com |
| **Coolify** | http://192.168.1.15:8000 | http://10.100.0.1:8000 | N/A |
| **PostgreSQL** | 192.168.1.15:5432 | 10.100.0.1:5432 | N/A |

### Coolify API Access

**CRITICAL**: Claude Code has API access to Coolify! Use programmatic API calls instead of UI.

**API Tokens Available**:
1. **claude-deployment**: `2|i2FAjhTjM0Y33OanJ23cjH2vhog348YACSZsQPNt0590e8fa`
   - Permissions: deploy, read, write
   - Use for: Environment variables, deployments, configuration

2. **claude-server-cli**: Token available (check Coolify UI)
   - Permissions: deploy, read, write
   - Use for: Server management

**Usage**:
```bash
# Set up Coolify CLI (one-time)
export COOLIFY_API_TOKEN="2|i2FAjhTjM0Y33OanJ23cjH2vhog348YACSZsQPNt0590e8fa"
export COOLIFY_API_URL="http://10.100.0.1:8000"

# Or use direct API calls
curl -H "Authorization: Bearer 2|i2FAjhTjM0Y33OanJ23cjH2vhog348YACSZsQPNt0590e8fa" \
  http://10.100.0.1:8000/api/v1/applications
```

**⚠️ IMPORTANT**:
- ALWAYS use API calls for Coolify operations
- DO NOT use Playwright for Coolify administration
- DO NOT ask user to manually add environment variables when API is available

### Common Production Commands
```bash
# Check container health
ssh user@192.168.1.15 "docker ps --format '{{.Names}}\t{{.Status}}'"

# View application logs
ssh user@192.168.1.15 "docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50"

# Restart container
ssh user@192.168.1.15 "docker restart m4s0kwo4kc4oooocck4sswc4"
```

---

## 🏗️ Architecture Overview

**Tech Stack**: Next.js 15.5.6 + React 19.1.1 + TypeScript 5.7.2 + PostgreSQL 15 (production) / SQLite 3 (dev only)

**Database**: 8 PostgreSQL schemas (forums, wiki, users, auth, library, content, messaging, system)

**Key Directories**:
- `frontend/src/app/api/` - API routes (~40+ endpoints)
- `frontend/src/lib/` - Business logic (60+ directories)
- `frontend/src/components/` - React components (50+ components)
- `frontend/data/` - SQLite databases (development only)

**⚠️ CRITICAL INFRASTRUCTURE WARNING**
- **WireGuard**: NEVER modify wg0-home/wg0-away interfaces, configs, or 10.100.0.0/24 routes
  - See [docs/server/wireguard/WIREGUARD_PROTECTION_AND_RECOVERY.md](./docs/server/wireguard/WIREGUARD_PROTECTION_AND_RECOVERY.md)
  - Switching interfaces is OK, modifying configs is NOT
- **Machine Identity**: See [docs/guides/MACHINE_IDENTIFICATION.md](./docs/guides/MACHINE_IDENTIFICATION.md)

---

## ⚠️ CRITICAL PATTERNS (MUST FOLLOW)

### 1. Database Access
```typescript
// ✅ CORRECT
import { dbAdapter } from '@/lib/database/adapter';
const result = await dbAdapter.query(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { schema: 'users' }
);

// ❌ WRONG - Creates connection leaks
import Database from 'better-sqlite3';
const db = new Database('path/to/db');
```

### 2. API Routes with Error Handling
```typescript
// ✅ CORRECT - Use withSecurity, custom errors, and errorResponse
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, ValidationError, NotFoundError } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Validate input
    if (!body.email) throw new ValidationError('Email required');

    // Query database
    const result = await dbAdapter.query(..., { schema: 'users' });
    if (!result.rows.length) throw new NotFoundError('User', body.email);

    // Return response
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return errorResponse(error); // Converts errors to proper HTTP responses
  }
});
```

**Key**: All API routes MUST use error classes (ValidationError, NotFoundError, AuthenticationError, PermissionError, etc.)

### 3. Next.js 15 Async Params
```typescript
// ✅ CORRECT - Must await
const params = await context.params;
const id = params.id;

// ❌ WRONG - Fails in Next.js 15
const id = params.id;
```

**See full patterns**: [docs/architecture/CRITICAL_PATTERNS.md](./docs/architecture/CRITICAL_PATTERNS.md)

### 4. Password Generation (MANDATORY)

⚠️ **Claude Code MUST ALWAYS use the cryptographic password protocol:**

```bash
# Generate password for ANY use case
npm run security:generate-password          # 15-char password
npm run security:generate-password -- 20    # 20-char (recommended for admin)
```

**CRITICAL RULES:**
- ❌ **NEVER** use weak passwords like "TestPassword123!", "AdminPassword123", etc.
- ❌ **NEVER** use simple patterns or dictionary words
- ✅ **ALWAYS** use `npm run security:generate-password` for password generation
- ✅ **ALWAYS** use 15+ characters (20+ for admin/service accounts)
- ✅ **ALWAYS** save to password manager immediately

**Documentation:** [docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](./docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md)

**Recent Incident:** Using weak passwords caused production authentication failure ([2026-02-16 incident](./docs/incidents/2026-02-16-login-failure-corrupted-passwords.md))

### 5. Coolify Environment Variables (CRITICAL)

⚠️ **Environment variables load during DEPLOYMENT, not restart:**

```bash
# ❌ WRONG - Adding variable then restarting container
# Container restart does NOT reload variables from database

# ✅ CORRECT - Adding variable then triggering deployment
git commit --allow-empty -m "chore: load new environment variables"
git push origin main
# Wait for Coolify deployment to complete (~3-5 minutes)
```

**CRITICAL RULES:**
- ❌ **NEVER** expect variables to load after container restart
- ❌ **NEVER** assume variable is loaded just because it's in database
- ✅ **ALWAYS** trigger deployment after adding/changing production variables
- ✅ **ALWAYS** verify: `docker exec <container> env | grep VARNAME`
- ✅ **CHECK timing**: Was variable added AFTER last deployment?

**Documentation:** [docs/deployment/COOLIFY_ENVIRONMENT_VARIABLES_GUIDE.md](./docs/deployment/COOLIFY_ENVIRONMENT_VARIABLES_GUIDE.md)

**Recent Incident:** STRIPE_WEBHOOK_SECRET in database but not loading ([2026-02-16 incident](./docs/incidents/2026-02-16-stripe-webhook-secret-not-loading.md))

---

## 📋 Essential Commands

### Quick Daily Commands
```bash
# From frontend/
npm run dev              # Start dev server
npm run type-check      # TypeScript check (REQUIRED before commit)
npm run format          # Auto-format code
npm run build           # Production build
npm test                # Run tests

# From root/
./start-veritable-games.sh start    # Start server (background)
./start-veritable-games.sh stop     # Stop server
./start-veritable-games.sh logs     # View logs
```

### Database
```bash
npm run db:health              # Verify database health
npm run db:migrate             # Run migrations
npm run user:reset-admin-password  # Emergency admin access
```

### Testing
```bash
npm test                      # Unit tests (Jest)
npm run test:e2e             # E2E tests (Playwright) - defaults to production
npm run test:e2e:ui          # Playwright UI mode (production)
npm run test:e2e:debug       # Playwright debug mode (production)
npm run test:e2e:codegen     # Generate Playwright tests
npm test -- --testNamePattern="name"  # Run specific test
```

**E2E Testing Modes**:

By default, E2E tests run against **production** (https://www.veritablegames.com) for stability:

```bash
# Production testing (default)
npm run test:e2e              # All tests against production
npm run test:e2e:ui           # Interactive UI mode (production)
npm run test:e2e:forums       # Forum tests only (production)

# Local testing (opt-in for development)
npm run test:e2e:local        # All tests against localhost
npm run test:e2e:local:ui     # Interactive UI mode (localhost)
npm run test:e2e:local:debug  # Debug mode (localhost)
npm run test:e2e:forums:local # Forum tests only (localhost)
```

**Why Production by Default?**
- ✅ Stable infrastructure (Coolify + PostgreSQL)
- ✅ No localhost 500 errors or crashes
- ✅ Tests real production environment
- ✅ Faster (no dev server startup)

**When to Use Local Testing:**
- 🔧 Debugging specific code changes
- 🔧 Testing features not yet deployed
- 🔧 Developing new tests

**⚠️ E2E Test Authentication (IMPORTANT)**

E2E tests use a dedicated test account defined in `.claude-credentials`:

```bash
# .claude-credentials (in project root)
CLAUDE_TEST_USERNAME=claude
CLAUDE_TEST_EMAIL=claude@veritablegames.com
CLAUDE_TEST_PASSWORD=<secure-generated-password>
CLAUDE_TEST_ROLE=user
```

**Security Rules**:
- ✅ **DO**: Use `.claude-credentials` for test authentication
- ✅ **DO**: Keep test user role as 'user' (NOT admin) for safety
- ❌ **NEVER**: Hardcode passwords in test files
- ❌ **NEVER**: Use admin account for testing
- ❌ **NEVER**: Reset production admin password via test scripts

**Test Fixtures**:
- `loginViaAPI(page)` - Uses Claude credentials by default
- `loginViaUI(page)` - UI-based login with Claude credentials
- See `frontend/e2e/fixtures/auth-fixtures.ts` for details

**Troubleshooting**:
- If tests fail with "invalid credentials", check `.claude-credentials` exists in project root
- If tests fail with "permission denied", verify Claude user exists in production database
- Never modify `scripts/user-management/ensure-test-admin.js` (disabled for security)

### WebSocket Servers
```bash
npm run ws:server    # Start WebSocket server (collaboration)
npm run stream:server # Start stream server (real-time updates)
npm run ws:dev       # Start both dev server + WebSocket
npm run ws:prod      # Production WebSocket server
```

### Godot Developer Console
```bash
npm run godot:reindex-all       # Reindex all Godot projects
npm run godot:reindex-project   # Reindex specific project
npm run godot:check-stale       # Check for stale versions
```

**MCP Server**: The Godot MCP server provides script analysis, dependency graphs, and version management.
See [docs/features/godot/README.md](./docs/features/godot/README.md)

### Donations System (✅ PRODUCTION-READY)

**Status**: ✅ Deployed and functional in production (as of Feb 15, 2026)

```bash
npm run donate:add-test  # Add test donation (development only)
```

**Production Access**: https://www.veritablegames.com/donate

**Payment Processors**:
- ✅ Stripe (credit cards) - Live keys configured
- ✅ BTCPay Server (Bitcoin/Lightning) - Fully configured

**Documentation**:
- Setup Guide: [docs/features/DONATIONS_SETUP_COMPLETE.md](./docs/features/DONATIONS_SETUP_COMPLETE.md)
- BTCPay Config: [docs/features/BTCPAY_PRODUCTION_SETUP.md](./docs/features/BTCPAY_PRODUCTION_SETUP.md)
- Deployment Audit: [docs/sessions/2026-02-15-donation-system-audit.md](./docs/sessions/2026-02-15-donation-system-audit.md)

### Full Reference
See [docs/guides/COMMANDS_REFERENCE.md](./docs/guides/COMMANDS_REFERENCE.md) for all 80+ commands

---

## 🗄️ Database Architecture

**Development** (localhost:3000): SQLite files in `frontend/data/` (via better-sqlite3)
**Production** (192.168.1.15): PostgreSQL 15 with 8 schemas (REQUIRED)

**Database Selection**:
- `forums` → Forum discussions
- `wiki` → Wiki pages & revisions
- `users` → User profiles (NOT `auth.users` - that's sessions only!)
- `auth` → Sessions/tokens
- `library` → Documents
- `content` → Projects, galleries, news
- `messaging` → Private messages
- `system` → Settings

**Critical Rule**: NO cross-database JOINs. Use ProfileAggregatorService for cross-schema access.

**⚠️ CRITICAL: Schema Migration Discipline**:
- **NEVER deploy code that references new database columns before applying migrations**
- **Always apply migrations to production BEFORE deploying code**
- See [Pre-Deployment Checklist](./docs/deployment/PRE_DEPLOYMENT_CHECKLIST.md)
- Track migrations in [Migration Tracking](./docs/database/MIGRATION_TRACKING.md)
- **Recent Incident**: 2026-02-12 - Journals disappeared due to missing columns ([details](./docs/incidents/2026-02-12-journals-missing-columns.md))

See [docs/database/README.md](./docs/database/README.md) for complete schema details.

---

## 🎯 Quick Decision Tree

```
Q: Creating an API endpoint?
→ Use: withSecurity() + errorResponse() + dbAdapter.query()

Q: Working with database?
→ ALWAYS use dbAdapter.query() - NEVER new Database()

Q: Adding new database columns/tables?
→ 1. Create migration file in scripts/migrations/
  2. Apply to production FIRST: npm run db:migrate:production
  3. Verify migration succeeded
  4. THEN deploy code that uses new columns

Q: Async params in Next.js 15?
→ MUST await: const params = await context.params

Q: VPN connected but can't reach server?
→ Check interface: nmcli con show --active | grep wg0
→ Wrong interface? Switch: nmcli con down wg0-home && nmcli con up wg0-away
→ See: docs/server/wireguard/WIREGUARD_PUBLIC_NETWORK_FIX_FEB_2026.md

Q: Rate limiters blocking E2E tests?
→ Admin > Settings > Rate Limiting > Disable specific limiters
→ See: docs/features/RATE_LIMITING.md

Q: Need to generate a password?
→ Use: npm run security:generate-password
→ NEVER use weak passwords like "TestPassword123!"
→ See: docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md

Q: Need help with patterns?
→ See: docs/architecture/CRITICAL_PATTERNS.md

Q: Common mistakes?
→ See: docs/COMMON_PITFALLS.md

Q: Full commands reference?
→ See: docs/guides/COMMANDS_REFERENCE.md

Q: Ready to deploy?
→ 1. npm run quality:full (type-check + test + build)
  2. git push origin main
  3. Wait 2-5 minutes for Coolify auto-deploy
```

---

## 📚 Documentation Navigation

**Essential Reading** (before writing code):
- [docs/README.md](./docs/README.md) - Main documentation hub
- [docs/architecture/CRITICAL_PATTERNS.md](./docs/architecture/CRITICAL_PATTERNS.md) - 9 must-follow patterns
- [docs/COMMON_PITFALLS.md](./docs/COMMON_PITFALLS.md) - 26 common mistakes to avoid

**By Topic**:
- **🔐 Password Generation (MANDATORY)**: [docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](./docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md) - Cryptographic password protocol
- **Commands**: [docs/guides/COMMANDS_REFERENCE.md](./docs/guides/COMMANDS_REFERENCE.md) - All npm scripts
- **Database**: [docs/database/README.md](./docs/database/README.md) - Architecture, queries, migration
- **Patterns**: [docs/REACT_PATTERNS.md](./docs/REACT_PATTERNS.md) - React 19 + Next.js 15 patterns
- **Testing**: [docs/guides/TESTING.md](./docs/guides/TESTING.md) - Jest, E2E, coverage
- **Deployment**: [docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) - Coolify, Docker
- **Forums**: [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](./docs/forums/FORUMS_DOCUMENTATION_INDEX.md) - 17 routes, 6 services
- **Features**: [docs/features/](./docs/features/) - Gallery, Library, Projects, Workspace

---

## ⚠️ Known Status & Limitations

**Workspace System (Infinite Canvas)**:
- ✅ Single-user: Fully functional, production-ready
- ❌ Multi-user: NOT READY - WebSocket server not deployed, sync not working
- **Critical Issues**: 47 console.log statements, node resizing not persisted, no undo/redo
- **See**: [docs/features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md](./docs/features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md)

---

## 💡 Useful Tips

- **Console Output**: Use `logger` utility instead of `console.log`
- **SQL Queries**: Always use parameterized queries (never string concatenation)
- **Browser Debugging**: `npm run dev:browser` (use sparingly - adds overhead)
- **Testing**: Jest config in `frontend/jest.config.js` - SWC for fast compilation
- **Formatting**: Prettier config enforces style - run `npm run format` before commit
- **Build**: Uses Turbopack (fast) - fallback: `npm run build:webpack`
- **Playwright MCP**: ⚠️ **ONLY USE WHEN EXPLICITLY REQUESTED BY USER**
  - **DO NOT** use Playwright proactively for administrative tasks
  - **DO NOT** use Playwright for configuration changes (Coolify, databases, etc.)
  - **ONLY USE** when user explicitly asks to "check the page", "test in browser", "take screenshot", etc.
  - When used, ALWAYS use `filename` parameter to save outputs to files (saves 95-99% tokens)
  - ✅ `browser_snapshot({ filename: "page.md" })` - Saves ~5,000 tokens
  - ✅ `browser_console_messages({ level: "info", filename: "console.txt" })` - Saves ~1,000 tokens
  - ✅ `browser_network_requests({ includeStatic: false, filename: "network.txt" })` - Saves ~2,000 tokens
  - ✅ `browser_take_screenshot({ type: "png", filename: "page.png" })` - Saves ~10,000 tokens
  - See [docs/guides/PLAYWRIGHT_MCP_BEST_PRACTICES.md](./docs/guides/PLAYWRIGHT_MCP_BEST_PRACTICES.md) for details

---

## 🚀 Production Deployment

**Status**: ✅ Live at 192.168.1.15:3000 (Coolify + PostgreSQL)

**Deploy Workflow**:
1. Ensure all tests pass: `npm run quality:full`
2. Push to main: `git push origin main`
3. Coolify auto-deploys in 2-5 minutes

**Access**:
- Local network: http://192.168.1.15:3000
- Public: https://www.veritablegames.com (via Cloudflare Tunnel)

See [docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) for complete deployment guide.

**Infrastructure Deep Dive**: [SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md](./docs/deployment/SYSTEM_ARCHITECTURE_AND_DEPLOYMENT_WORKFLOW.md) - Complete system architecture, auto-deploy monitoring, Docker volumes, disaster recovery

---

## ⚡ Common Operations

### Add New API Endpoint
1. Create `src/app/api/[feature]/route.ts`
2. Wrap with `withSecurity()`, use `dbAdapter.query()`, return `errorResponse()` on error

### Add Database Table
1. Create migration in `scripts/migrations/`
2. Run: `npm run db:migrate` (dev) or `npm run db:migrate:production` (prod)

### Check Database Health
```bash
npm run db:health              # Verify all schemas exist
npm run pg:test                # Test PostgreSQL connection
npm run db:check-sequences     # Check sequence status
```

### Debug Issues
- **Type errors**: `npm run type-check`
- **Tests failing**: `npm test -- --testNamePattern="name"`
- **API issues**: Check Network tab or use `npm run debug:api:json-errors`
- **Database issues**: `npm run db:health` and `npm run debug:*` commands

---

## 📖 Top References

| Need | See |
|------|-----|
| **🔑 Production server access** | **[docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** |
| Setup & dev guide | [CLAUDE.md](./CLAUDE.md) (this file) |
| Architecture patterns | [docs/architecture/CRITICAL_PATTERNS.md](./docs/architecture/CRITICAL_PATTERNS.md) |
| Common mistakes | [docs/COMMON_PITFALLS.md](./docs/COMMON_PITFALLS.md) |
| All npm commands | [docs/guides/COMMANDS_REFERENCE.md](./docs/guides/COMMANDS_REFERENCE.md) |
| Database schema | [docs/database/README.md](./docs/database/README.md) |
| Deployment | [docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) |
| React patterns | [docs/REACT_PATTERNS.md](./docs/REACT_PATTERNS.md) |
| Testing | [docs/guides/TESTING.md](./docs/guides/TESTING.md) |
| **Playwright MCP (token optimization)** | **[docs/guides/PLAYWRIGHT_MCP_BEST_PRACTICES.md](./docs/guides/PLAYWRIGHT_MCP_BEST_PRACTICES.md)** |
| **Godot console & MCP** | [docs/features/godot/README.md](./docs/features/godot/README.md) (index) |
| Godot architecture | [docs/features/godot/GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./docs/features/godot/GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) |

---

**Last Updated**: February 15, 2026
**Status**: ✅ Production-ready on Coolify + PostgreSQL
**Recent Updates**: Added Stripe webhook handler, WebSocket servers, E2E testing, Godot console commands, and BTCPay donations (production-ready)
