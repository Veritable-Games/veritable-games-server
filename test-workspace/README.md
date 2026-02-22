# Veritable Games Platform

A production-ready full-stack community platform built with Next.js 15, React 19, and TypeScript, featuring forums, wiki, document library, project collaboration, and interactive 3D stellar visualization.

## Overview

Veritable Games is a modern community platform that combines robust architecture with advanced web technologies. The platform uses a microservice-style database architecture with 10 specialized schemas (SQLite for local development, PostgreSQL 15 for production), connection pooling, and strict service boundaries for security and scalability.

**Documentation**: [CLAUDE.md](CLAUDE.md) | **Architecture**: Next.js 15 App Router + React 19 Server Components

## Key Features

### Core Platform
- **Forums System**: Production-ready forums with 17 API routes, 6 services, real-time SSE updates, and optimistic UI
- **Wiki System**: Full-featured wiki with revision history, auto-categorization, wikilinks, and collaborative editing
- **Document Library**: Document management with annotations, collections, categories, and full-text search
- **Project Collaboration**: Workspaces with revision tracking, diff viewing, team management, and gallery system
- **Gallery System**: Tag-based image galleries (references/concept-art) with albums, batch upload, and masonry grid
- **Private Messaging**: Secure messaging system with conversation threading
- **3D Visualization**: Interactive Three.js stellar system with realistic physics simulation

### Technical Highlights
- **Modern Stack**: Next.js 15.5.6 + React 19.1.1 + TypeScript 5.7.2 with strict mode
- **Database Architecture**: 10 specialized schemas (SQLite localhost-only / PostgreSQL production) with connection pooling
- **Security**: Multi-tier protection with CSP headers, content sanitization, session-based auth
- **Performance**: WAL mode, multi-tier caching with LRU, FTS5 search (5-30ms queries)
- **Type Safety**: Branded TypeScript types with Result pattern error handling
- **Optimistic UI**: React 19's `useOptimistic` for instant feedback on mutations

## Tech Stack

### Frontend
- **Framework**: Next.js 15.5.6 with App Router and Turbopack
- **UI Library**: React 19.1.1 with Server Components (default) and Client Components
- **Language**: TypeScript 5.7.2 with strict mode
- **Styling**: Tailwind CSS 3.4.17
- **3D Graphics**: Three.js 0.180.0
- **State Management**: Zustand 5.0.8
- **Forms**: React Hook Form 7.48.2 with Zod 4.0.17 validation
- **Markdown**: react-markdown 10.1.0 + marked 15.0.12

### Backend
- **Runtime**: Node.js 20.18.2+ (required for dependencies)
- **Database (Development)**: SQLite 3 with better-sqlite3 9.6.0
- **Database (Production)**: PostgreSQL 15
- **Architecture**: 10 schemas with connection pooling, 155 tables, 273 indexes
- **Security**: bcryptjs 3.0.2, DOMPurify 3.2.6, session-based auth (no JWT)
- **Caching**: Multi-tier LRU Cache 10.4.3 with 81+ invalidation points
- **Search**: SQLite FTS5 (dev) / PostgreSQL full-text search (production)

### Infrastructure
- **Build**: Next.js Turbopack for fast development (Webpack fallback available)
- **Testing**: Jest 29.7.0 + Testing Library
- **Deployment**: PM2, Docker, NGINX
- **Monitoring**: Health checks, database monitoring

## Quick Start

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd veritable-games-main

# Navigate to frontend directory (ALL development work happens here)
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local and generate 3 secrets:
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET (legacy, kept for compatibility)
openssl rand -hex 32  # ENCRYPTION_KEY

# Start development server (from frontend/)
npm run dev
# OR from root directory using wrapper script:
cd ..
./start-veritable-games.sh start
```

The application will be available at `http://localhost:3000` (binds to 0.0.0.0 for network access)

### Required Environment Variables

```env
# Authentication (Required)
SESSION_SECRET=<32-char-hex-string>
CSRF_SECRET=<32-char-hex-string>  # Legacy, kept for compatibility
ENCRYPTION_KEY=<32-char-hex-string>

# Database Paths (Optional - defaults provided)
DB_PATH=./data/forums.db
USERS_DATABASE_PATH=data/users.db
WIKI_DATABASE_PATH=data/wiki.db
LIBRARY_DATABASE_PATH=data/library.db
MESSAGING_DATABASE_PATH=data/messaging.db
CONTENT_DATABASE_PATH=data/content.db
AUTH_DATABASE_PATH=data/auth.db
SYSTEM_DATABASE_PATH=data/system.db

# Feature Flags (Optional)
ENABLE_FORUMS=true
ENABLE_WIKI=true
ENABLE_LIBRARY=true
ENABLE_3D_VIEWER=true
```

## Development

### Repository Structure

This is a **monorepo**:
```
veritable-games-main/        # Root (git operations here)
├── frontend/                # ALL development work here
│   ├── package.json        # Application dependencies
│   ├── src/                # Source code
│   ├── data/               # 10 SQLite databases
│   └── scripts/            # Utility scripts
├── package.json            # Root-level wrapper scripts only
├── CLAUDE.md               # Architecture documentation
└── README.md               # This file
```

**Critical**: Git commands run from root, npm commands run from `frontend/` directory.

### Available Scripts

```bash
# From frontend/ directory:

# Development
npm run dev          # Start development server (Turbopack)
npm run dev:debug    # Start without Turbopack (for debugging)
npm run build        # Production build (Turbopack)
npm run start        # Start production server

# Code Quality (CRITICAL before committing)
npm run type-check   # TypeScript validation (REQUIRED)
npm run format       # Prettier formatting
npm test             # Run Jest tests

# Database
npm run db:health    # Check database health
npm run db:backup    # Backup all databases
npm run workspace:check # Verify workspace tables exist

# Gallery Management
npm run gallery:audit              # Comprehensive gallery integrity check
npm run gallery:audit:simple       # Quick gallery file count check
npm run gallery:cleanup:dry-run    # Preview deleted images cleanup (30+ days)
npm run gallery:cleanup            # Remove soft-deleted images (30+ days)

# User Management
npm run user:reset-admin-password  # Reset admin password (emergency access)

# Debug Tools
npm run debug:auth:sync            # Check auth.db vs users.db sync
npm run debug:library:health       # Check library.db health
npm run debug:gallery:schema       # Verify gallery schema
npm run debug:gallery:paths        # Debug gallery file paths
npm run debug:api:json-errors      # Find API endpoints returning non-JSON

# From root directory:
./start-veritable-games.sh start          # Start dev server (daemonized, survives terminal exit)
./start-veritable-games.sh stop           # Stop dev server
./start-veritable-games.sh restart        # Restart dev server
./start-veritable-games.sh status         # Check server status
./start-veritable-games.sh logs           # Show recent logs
```

### Development Workflow

1. **Work in `frontend/` directory** - All npm commands and development work
2. **Git operations from root** - All git commands (add, commit, push)
3. **Run type-check before committing** - `npm run type-check` (CRITICAL)
4. **Use `./start-veritable-games.sh` script for server management** - Properly daemonizes server

## Project Structure

```
frontend/                    # Main application (ALL work here)
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/           # RESTful API endpoints
│   │   │   ├── auth/      # Authentication
│   │   │   ├── forums/    # Forum APIs
│   │   │   ├── wiki/      # Wiki APIs
│   │   │   ├── library/   # Library APIs
│   │   │   ├── projects/  # Project APIs
│   │   │   ├── messages/  # Messaging
│   │   │   └── ...
│   │   └── (routes)       # Page components
│   ├── components/        # React components
│   │   ├── forums/        # Forum components (18 components)
│   │   ├── wiki/          # Wiki components
│   │   ├── library/       # Library components
│   │   └── ...
│   ├── lib/              # Core services
│   │   ├── database/     # Connection pool (pool.ts)
│   │   ├── forums/       # Forum services (5 services)
│   │   ├── wiki/         # Wiki services
│   │   ├── library/      # Library services
│   │   ├── auth/         # Authentication
│   │   ├── security/     # Security middleware
│   │   ├── profiles/     # Profile aggregation
│   │   └── ...
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   └── types/            # TypeScript types
├── data/                  # 10 SQLite databases (localhost development ONLY)
├── public/               # Static assets
├── scripts/              # Utility scripts
└── __tests__/            # Test suites
```

## Database Architecture

The platform uses a **10-schema database architecture** with strict isolation:

### Development (localhost:3000)
SQLite databases in `/frontend/data/` directory:

### Production (192.168.1.15, deployed Nov 5, 2025)
PostgreSQL 15 with 10 schemas (shown below as schema names):

**Active Databases (8)**:
| Database | Purpose | Key Tables |
|----------|---------|------------|
| forums.db | Forum system | categories, topics, replies, forum_search_fts |
| wiki.db | Wiki content | wiki_pages, wiki_revisions, wiki_search |
| users.db | User management | users, profiles, settings |
| system.db | Configuration | settings, feature_flags |
| content.db | CMS content | news, projects, team_members, project_revisions |
| library.db | Documents | library_documents, library_search_fts, library_categories |
| auth.db | Authentication | sessions, tokens |
| messaging.db | Messages | messages, conversations |

**Optional/Legacy (2)**:
- `cache.db` - Reserved for future caching layer
- `main.db` - Legacy archive (DO NOT add new data)

**Architecture Details**:
- Singleton connection pool with max 50 connections
- WAL mode enabled for better concurrency
- No cross-database JOINs (use ProfileAggregatorService)
- FTS5 full-text search in forums and library
- Foreign keys enabled (except messaging.db)

## Critical Architecture Patterns

### 1. Database Access (MUST FOLLOW)
```typescript
// ✅ CORRECT - Always use singleton pool
import { dbPool } from '@/lib/database/pool';
const db = dbPool.getConnection('users');
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ WRONG - NEVER create Database instances
import Database from 'better-sqlite3';
const db = new Database('path/to/db'); // Causes connection leaks
```

### 2. API Route Pattern
```typescript
import { safeParseRequest, CreateTopicDTOSchema } from '@/lib/forums/validation-schemas';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { withSecurity } from '@/lib/security/middleware';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    const bodyResult = await safeParseRequest(request, CreateTopicDTOSchema);
    if (bodyResult.isErr()) {
      throw new ValidationError(bodyResult.error.message);
    }

    const result = await forumServices.topics.createTopic(bodyResult.value, user.id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
});
```

### 3. Next.js 15 Async Params
```typescript
// ✅ CORRECT - Await params
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  const slug = params.slug;
}

// ❌ WRONG - Direct access (Next.js 14 pattern)
const projectId = params.slug; // ERROR in Next.js 15
```

## Security Implementation

- **Session Management**: Custom server-side sessions in SQLite (NO JWT tokens)
- **Password Security**: bcryptjs with 12 salt rounds
- **Content Security**: DOMPurify for all user-generated content
- **SQL Security**: Prepared statements only (no string concatenation)
- **Headers**: CSP with dynamic nonce, X-Frame-Options, HSTS, etc.
- **CSRF Protection**: Enabled (double submit cookie pattern with sameSite: 'strict')

## Performance

- **Build Time**: ~30-40 seconds with Turbopack
- **Database**: WAL mode with connection pooling
- **Cache**: Multi-tier LRU with 81+ invalidation points
- **Search**: FTS5 full-text search (5-30ms queries)
- **UI**: Optimistic updates with React 19's `useOptimistic`

## Testing

```bash
# Unit Tests
npm test                    # Run all tests
npm test -- --coverage     # With coverage
npm test auth.test.ts      # Specific test
```

## Production Deployment

### Self-Hosted with Coolify (Production Deployment)

**Status**: ✅ Successfully deployed to production (November 5, 2025)

**Current Production Configuration**:
- **Server**: Ubuntu Server 22.04.5 LTS at 192.168.1.15
- **Platform**: Coolify + Docker + Nixpacks
- **Database**: PostgreSQL 15 (50,646 rows migrated, 99.99% success rate)
- **Application**: http://192.168.1.15:3000 (local) | https://www.veritablegames.com (public)
- **Coolify Dashboard**: http://192.168.1.15:8000
- **Auto-Deploy**: ✅ Enabled via GitHub App webhook
- **Build Time**: ~3 minutes from push to live
- **Deployment Date**: November 5, 2025 at 02:52 UTC

**Benefits**:
- **Zero Monthly Costs**: Electricity only (~$5-15/month)
- **Full Control**: Complete infrastructure ownership
- **Local Database**: PostgreSQL with instant latency
- **Auto-Deployment**: Push to GitHub → automatic rebuild

**Accessing the Server**:

**Local Network** (Current):
```bash
Application: http://192.168.1.15:3000
Coolify Dashboard: http://192.168.1.15:8000
SSH Access: ssh user@192.168.1.15
```

**Public Internet Access** (Setup Options):

**Option 1: Cloudflare Tunnel (Recommended - Free, Secure)**
- No port forwarding needed
- Free SSL certificates
- Works from anywhere
- Setup: See docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md

**Option 2: Port Forwarding**
- Configure router to forward ports 80/443 → 3000
- Access via public IP
- Requires dynamic DNS for changing IPs

**Option 3: Tailscale (Private VPN)**
- Private network access
- No public exposure
- Access from any device on Tailscale network

**Complete Access Guide**: [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)

**Quick Deploy**:
1. Follow [docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md](./docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md)
2. Install Coolify on Ubuntu 22.04/24.04 LTS
3. Connect GitHub repository
4. Configure environment variables
5. Deploy!

**Complete Guide**:
- [COOLIFY_LOCAL_HOSTING_GUIDE.md](./docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md) - Complete self-hosted deployment guide
- [docs/DEPLOYMENT_DOCUMENTATION_INDEX.md](./docs/DEPLOYMENT_DOCUMENTATION_INDEX.md) - Master deployment documentation

**Requirements**:
- Ubuntu 22.04/24.04 LTS server
- 2 CPU cores, 4GB RAM, 50GB storage
- Static IP or dynamic DNS (for public access)

### Alternative: Cloud Deployment (Archived)

**Note**: Cloud-specific documentation has been archived. See [docs/deployment/archive/vercel-neon-deployment/](./docs/deployment/archive/vercel-neon-deployment/) for cloud deployment guides.

### Alternative: Self-Hosted with PM2

```bash
cd frontend
npm run build
pm2 start npm --name "veritable-games" -- start
pm2 save
pm2 startup
```

### Alternative: Docker

```bash
docker build -t veritable-games .
docker run -d -p 3000:3000 veritable-games
```

### Manual Deployment

1. Set production environment variables
2. Build: `npm run build` (from frontend/)
3. Configure reverse proxy (NGINX/Apache)
4. Set up SSL certificates
5. Configure monitoring and backups
6. Start: `npm run start` (from frontend/)

See [docs/DEPLOYMENT_DOCUMENTATION_INDEX.md](./docs/DEPLOYMENT_DOCUMENTATION_INDEX.md) for complete deployment guides.

## Documentation

**🎯 Start Here**: [docs/README.md](docs/README.md) - Complete documentation navigation hub with role-based quick start guides

### By Role

**For Developers**:
- **[CLAUDE.md](CLAUDE.md)** - Main development guide (critical patterns, setup, database architecture)
- **[docs/architecture/CRITICAL_PATTERNS.md](docs/architecture/CRITICAL_PATTERNS.md)** - 9 must-follow patterns
- **[docs/COMMON_PITFALLS.md](docs/COMMON_PITFALLS.md)** - 26 common mistakes to avoid
- **[docs/DATABASE.md](docs/DATABASE.md)** - Database architecture (155 tables, 10 schemas)

**For DevOps/Operations**:
- **[docs/DEPLOYMENT_DOCUMENTATION_INDEX.md](docs/DEPLOYMENT_DOCUMENTATION_INDEX.md)** - Master deployment documentation
- **[docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production server access
- **[docs/operations/PRODUCTION_OPERATIONS.md](docs/operations/PRODUCTION_OPERATIONS.md)** - Production monitoring & incident response

**For Testing/CI-CD**:
- **[docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md](docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md)** - CI/CD hub
- **[docs/guides/TESTING.md](docs/guides/TESTING.md)** - Complete testing guide

**For Troubleshooting**:
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common fixes and debugging
- **[docs/guides/COMMANDS_REFERENCE.md](docs/guides/COMMANDS_REFERENCE.md)** - All npm scripts (80+ commands)

### Feature Documentation

- **[docs/forums/FORUMS_DOCUMENTATION_INDEX.md](docs/forums/FORUMS_DOCUMENTATION_INDEX.md)** - Forums system (17 routes, 6 services)
- **[docs/wiki/](docs/wiki/)** - Wiki system (git-based versioning, revisions)
- **[docs/features/](docs/features/)** - Gallery albums, projects, library, messaging systems

### All Documentation

Complete documentation centralized at **[docs/](docs/)**:
- [architecture/](docs/architecture/) - System architecture & design patterns
- [forums/](docs/forums/) - Forums system documentation
- [features/](docs/features/) - Feature specifications & implementations
- [deployment/](docs/deployment/) - Deployment guides (Coolify, Docker, etc.)
- [wiki/](docs/wiki/) - Wiki system & git-based versioning
- [security/](docs/security/) - Security hardening & compliance
- [guides/](docs/guides/) - How-to guides & references
- [api/](docs/api/) - API documentation (249+ endpoints)
- [operations/](docs/operations/) - Production operations
- [archive/](docs/archive/) - Historical documentation

## Getting Help

**First time here?** Start with [docs/README.md](docs/README.md) for role-based guides.

**Quick question?** Try [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) or [docs/COMMON_PITFALLS.md](docs/COMMON_PITFALLS.md).

**Need to find something specific?** Use [docs/README.md](docs/README.md) navigation hub or search the docs directory.

**Developer patterns?** See [docs/architecture/CRITICAL_PATTERNS.md](docs/architecture/CRITICAL_PATTERNS.md) and [CLAUDE.md](CLAUDE.md).

---

## Common Pitfalls

1. ❌ Creating Database instances directly → Use `dbPool.getConnection()`
2. ❌ Cross-database JOINs → Use ProfileAggregatorService
3. ❌ Working in root directory → Work in `frontend/`
4. ❌ Not awaiting params → Next.js 15 requires `await params`
5. ❌ Skipping type-check → Run `npm run type-check` before committing
6. ❌ Using WikiService for projects → Use ProjectRevisionsService
7. ❌ Adding data to main.db → Use specific databases (content, wiki, etc.)

## Recent Changes (October-November 2025)

**Major Simplifications**:
- ✅ Admin dashboard removed (all `/api/admin/*` endpoints)
- ✅ Monitoring endpoints removed (leaves stub hooks)
- ✅ PWA features removed (service worker, manifests)
- ✅ TOTP/WebAuthn removed (basic email/password only)
- ✅ TanStack Query removed (fixes hydration errors)
- ✅ ESLint removed (fixes hydration conflicts)
- ✅ Projects decoupled from Wiki (standalone revision system)

**Active Features**:
- ✅ Forums (Production-ready: 17 API routes, 6 services, 21+ components, real-time SSE updates)
- ✅ Wiki (revisions, categories, search, auto-categorization)
- ✅ Library (documents, annotations, collections, full-text search)
- ✅ Projects (standalone revision system, gallery with albums)
- ✅ Gallery System (references/concept-art, tag filtering, batch upload, soft delete)
- ✅ Messaging (private messages, conversation threading)
- ✅ Authentication (email/password with bcrypt, session-based)

## Support

For architecture details and development guidelines, see [CLAUDE.md](CLAUDE.md).

## License

Private repository - All rights reserved.

---

**Last Updated**: November 9, 2025
**PostgreSQL Migration**: ✅ Complete (October 30, 2025)
**Production Deployment**: ✅ Live on Coolify (November 5, 2025)
**Server**: http://192.168.1.15:3000 (local network) | https://www.veritablegames.com (public)
**Primary Deployment**: Self-hosted with Coolify

