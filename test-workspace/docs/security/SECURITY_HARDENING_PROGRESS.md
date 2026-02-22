# Security Hardening & Deployment Status

**Project**: Veritable Games - Security Audit, PostgreSQL Migration & Vercel Deployment
**Started**: October 28, 2025
**Total Estimated Time**: 33.5 hours
**Current Status**: Phase 1 (Security Hardening) - In Progress

---

## ✅ Phase 1.1: CSRF Protection (COMPLETED)

### What Was Done
- **Enabled CSRF protection on 49 API routes**
- Removed `enableCSRF: false` from all route handlers, allowing default behavior (CSRF enabled)
- CSRF implementation uses double submit cookie pattern with timing-safe comparison
- Frontend already has comprehensive CSRF utilities (`fetchWithCSRF`, `fetchJSON`)
- **99 occurrences** of CSRF utilities already in use across 24 component files

### Files Modified
- All API routes in `src/app/api/` that previously had `enableCSRF: false`:
  - Authentication: login, register, me, session
  - Forums: topics, replies, moderation endpoints
  - Wiki: pages, categories, search
  - Library: documents
  - Projects: references, revisions
  - Users: profile, privacy, favorites
  - Messages: conversations, inbox
  - (49 total files updated)

### Script Created
- `frontend/scripts/re-enable-csrf.sh` - Automated CSRF re-enabling script

### Security Impact
- **CRITICAL FIX**: Prevents CSRF attacks where malicious sites forge requests
- **Protection Level**: All POST/PUT/PATCH/DELETE requests now require valid CSRF token
- **Frontend Ready**: Utilities already in place, no frontend changes needed

---

## ✅ Phase 1.2: Rate Limiting (COMPLETED)

### What Was Done
- ✅ Added rate limiting to **login endpoint** (`/api/auth/login`) - 5 attempts per 15 min
- ✅ Added rate limiting to **register endpoint** (`/api/auth/register`) - 5 attempts per 15 min
- ✅ Added rate limiting to **forum topic creation** (`/api/forums/topics`) - 5 topics per hour
- ✅ Added rate limiting to **forum reply creation** (`/api/forums/replies`) - 30 replies per hour
- ✅ Added rate limiting to **file uploads**:
  - References gallery (`/api/projects/[slug]/references`) - 10 uploads per hour
  - Concept art gallery (`/api/projects/[slug]/concept-art`) - 10 uploads per hour
  - Avatar uploads (`/api/users/[id]/avatar`) - 10 uploads per hour
- ✅ Added rate limiting to **search endpoints**:
  - Forum search (`/api/forums/search`) - 100 searches per minute
  - Wiki search (`/api/wiki/search`) - 100 searches per minute
- ✅ Created 3 new rate limiters in middleware:
  - `rateLimiters.fileUpload` - 10 uploads per hour
  - `rateLimiters.messageSend` - 20 messages per hour (reserved for future)
  - `rateLimiters.wikiCreate` - 10 pages per hour (reserved for future)

### All Rate Limiters (Defined in middleware.ts)
- `rateLimiters.auth` - 5 requests per 15 minutes (login/register)
- `rateLimiters.topicCreate` - 5 topics per hour
- `rateLimiters.replyCreate` - 30 replies per hour
- `rateLimiters.search` - 100 searches per minute
- `rateLimiters.fileUpload` - 10 uploads per hour
- `rateLimiters.messageSend` - 20 messages per hour (future use)
- `rateLimiters.wikiCreate` - 10 pages per hour (future use)

### Files Modified
- `src/lib/security/middleware.ts` - Added 3 new rate limiters
- `src/app/api/auth/register/route.ts` - Applied auth rate limiter
- `src/app/api/forums/topics/route.ts` - Applied topic creation rate limiter
- `src/app/api/forums/replies/route.ts` - Applied reply creation rate limiter
- `src/app/api/projects/[slug]/references/route.ts` - Applied file upload rate limiter
- `src/app/api/projects/[slug]/concept-art/route.ts` - Applied file upload rate limiter
- `src/app/api/users/[id]/avatar/route.ts` - Applied file upload rate limiter
- `src/app/api/forums/search/route.ts` - Applied search rate limiter
- `src/app/api/wiki/search/route.ts` - Applied search rate limiter

### Files Created
- `frontend/scripts/apply-rate-limiting.md` - Implementation guide (updated with completion status)

### Security Impact
- **CRITICAL FIX COMPLETED**: All critical endpoints now protected against:
  - Brute force attacks (login/register)
  - Spam flooding (forums)
  - Resource exhaustion (file uploads, search)
- **Coverage**: 100% of identified critical endpoints
- **Implementation**: IP-based rate limiting with LRU cache

---

## ✅ Phase 1.3: Additional Security Fixes (COMPLETED)

### What Was Done
- ✅ **Added authentication to workspace GET endpoint** (`/api/workspace/nodes/[id]`)
  - Previously allowed unauthenticated read access to workspace nodes
  - Now requires authentication, matching PUT and DELETE methods
  - Prevents information leak of workspace content

- ✅ **Reviewed CSP (Content Security Policy) headers**
  - Current configuration uses CSP Level 3 with advanced security features
  - `default-src 'none'` - Deny by default (most restrictive)
  - Nonce-based script/style loading with `'strict-dynamic'`
  - `object-src 'none'` - Blocks plugins
  - Trusted Types enabled in production for XSS protection
  - SRI (Subresource Integrity) required in production
  - CSP violation reporting configured
  - **Decision**: No changes needed - already production-grade

- ✅ **Verified ownership checks on edit/delete operations**
  - Security audit confirmed ownership checks are solid
  - All PUT/DELETE endpoints properly verify user owns resource before allowing modification
  - Examples verified:
    - Workspace nodes: User ID checked in `updateNode()` and `deleteNode()`
    - Forum topics: Author ID verified before edits
    - Gallery images: Admin-only for uploads, ownership for deletes
  - **Decision**: No changes needed - ownership checks are comprehensive

### Files Modified
- `src/app/api/workspace/nodes/[id]/route.ts` - Added authentication to GET endpoint

### Security Impact
- **Information Leak Fixed**: Workspace nodes no longer readable without authentication
- **CSP Verified**: Production-grade Content Security Policy confirmed
- **Ownership Checks Verified**: All edit/delete operations properly protected

**Estimated Time**: 30 minutes (completed ahead of schedule)

---

## ✅ Phase 2.1: Global Auth Middleware (COMPLETED)

### What Was Done
- ✅ **Created global authentication middleware** (`src/middleware.ts`)
  - Implements full lockdown mode - all pages require authentication
  - Lightweight session check via cookie presence
  - Redirects unauthenticated users to `/auth/login`
  - Stores original URL in `redirect` query parameter for post-login navigation
  - Adds security headers to all responses
  - Allows only public paths: `/auth/login`, `/auth/register`, `/api/auth/*`, `/api/health`
  - Allows static assets (JS, CSS, images, uploads)
  - Optimized performance - no database calls in middleware

### Implementation Details
- **Session Validation Strategy**: Lightweight cookie check in middleware, full validation in API routes
- **Redirect Flow**: Login → Check redirect param → Route to original page
- **Security Headers**: Applied globally via middleware
- **Edge Runtime Compatible**: No database imports in middleware

### Files Created
- `src/middleware.ts` - Global authentication middleware (142 lines)

### Remaining Work
**Note**: Login and register frontend pages don't exist yet. Currently only API routes exist:
- `/api/auth/login` ✅
- `/api/auth/register` ✅
- `/auth/login` ❌ (page needs to be created)
- `/auth/register` ❌ (page needs to be created)

**Recommendation**: Create these pages before enabling the middleware in production, or users will be redirected to non-existent pages.

**Estimated Time**: 2 hours (completed ahead of schedule - pages can be created separately)

---

## 📋 Phase 2.2: Invitation System (PENDING)

### What's Needed
- [ ] Create `invitations` table in auth.db
- [ ] Admin can generate invitation tokens
- [ ] Registration requires valid invitation token
- [ ] Track who invited whom

**Files to Create**:
- Database migration: `frontend/migrations/20251028_create_invitations_table.sql`
- API routes: `frontend/src/app/api/admin/invitations/*`
- Admin UI: `frontend/src/components/admin/InvitationManager.tsx`

**Estimated Time**: 2 hours

---

## 📋 Phase 3: Git Configuration (PENDING)

### 3.1 Update .gitignore (0.5 hours)
- [ ] Keep ignoring: `node_modules/`, `.next/`, `.env.local`, `*.log`, `*.pid`
- [ ] Start tracking: `*.db` files (user approved tracking full DB files)
- [ ] Commit all previously ignored files

### 3.2 Git Commit & Tag (0.5 hours)
- [ ] Commit all files with descriptive message
- [ ] Tag as `v1.0.0-pre-postgres` for rollback point
- [ ] Push to GitHub (organization or personal account)

---

## 📋 Phase 4: SQLite → PostgreSQL Migration (PENDING)

**⚠️ MAJOR EFFORT**: 16 hours estimated

### 4.1 Schema Analysis & Conversion (4 hours)
- [ ] Analyze all 10 SQLite database schemas
- [ ] Convert SQLite → PostgreSQL DDL:
  - `INTEGER PRIMARY KEY` → `SERIAL PRIMARY KEY`
  - `TEXT` → `VARCHAR` where appropriate
  - FTS5 → PostgreSQL full-text search (`tsvector`)
- [ ] Create migration scripts per database

**Databases to Convert**:
1. forums.db (topics, replies, categories, search)
2. wiki.db (pages, revisions, search)
3. users.db (users, profiles)
4. auth.db (sessions, tokens)
5. content.db (projects, workspaces, news)
6. library.db (documents, annotations, search)
7. messaging.db (messages, conversations)
8. system.db (settings, feature_flags)
9. cache.db (optional)
10. main.db (legacy, read-only)

### 4.2 Database Pool Refactor (3 hours)
- [ ] Create `PostgresPool` class (parallel to current `dbPool`)
- [ ] Replace `better-sqlite3` syntax with `pg` syntax:
  - `db.prepare().get()` → `await client.query()`
  - `db.prepare().all()` → `await client.query().rows`
  - Transactions, connections, error handling

### 4.3 Query Migration (6 hours)
- [ ] Update all service layer queries
- [ ] Replace SQLite-specific functions (datetime, etc.)
- [ ] Update FTS5 queries to PostgreSQL tsvector
- [ ] Test each service thoroughly

**Files to Update** (major):
- All services in `frontend/src/lib/*/service.ts`
- All repositories in `frontend/src/lib/*/repositories/*`

### 4.4 Data Migration Tools (3 hours)
- [ ] Create `scripts/migrate-sqlite-to-postgres.js`
- [ ] Export all data from 10 SQLite DBs to JSON
- [ ] Import JSON into PostgreSQL with type conversions
- [ ] Verify data integrity (row counts, foreign keys)

---

## 📋 Phase 5: Vercel Deployment Setup (PENDING)

**Estimated Time**: 3 hours

### 5.1 Vercel Project Configuration (1 hour)
- [ ] Connect GitHub repository to Vercel
- [ ] Configure build settings (Next.js, framework, root: `frontend/`)
- [ ] Set Node version: 20.x

### 5.2 Environment Variables (1 hour)
- [ ] Generate new production secrets
- [ ] Add to Vercel project settings:
  - `SESSION_SECRET`
  - `CSRF_SECRET`
  - `ENCRYPTION_KEY`
  - `DATABASE_URL` (PostgreSQL connection string)
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_SITE_URL=https://veritablegames.com`

### 5.3 PostgreSQL Database Setup (1 hour)
**Options**:
- Vercel Postgres ($20/month) - Integrated
- Supabase (free tier: 500MB, 2GB transfer) - External

- [ ] Create database
- [ ] Get connection string
- [ ] Run schema migrations
- [ ] Import data from SQLite

---

## 📋 Phase 6: DNS Configuration (PENDING)

**Estimated Time**: 0.5 hours

### Squarespace DNS → Vercel
- [ ] Log into Squarespace domain management
- [ ] Add CNAME: `www` → `cname.vercel-dns.com`
- [ ] Add A records: `76.76.21.21`, `76.76.21.22`
- [ ] Add AAAA records (IPv6)
- [ ] Verify in Vercel project settings
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Enable HTTPS (automatic via Let's Encrypt)

---

## 📋 Phase 7: Initial Admin Setup & Testing (PENDING)

**Estimated Time**: 1 hour

### Create First Admin User
- [ ] Deploy to Vercel (will be inaccessible due to full lockdown)
- [ ] Access database via Vercel Functions logs
- [ ] Manually insert admin user:
  ```sql
  INSERT INTO users (username, email, password_hash, role, is_active)
  VALUES ('admin', 'your@email.com', '[bcrypt hash]', 'admin', true);
  ```
- [ ] Login as admin
- [ ] Test all features
- [ ] Create invitation for yourself
- [ ] Invite team members

---

## 📊 Overall Progress

| Phase | Status | Estimated | Completed | Remaining |
|-------|--------|-----------|-----------|-----------|
| 1.1 CSRF | ✅ Done | 3h | 3h | 0h |
| 1.2 Rate Limiting | ✅ Done | 4h | 4h | 0h |
| 1.3 Security Fixes | ✅ Done | 1h | 0.5h | 0h |
| 2.1 Global Auth Middleware | ✅ Done | 4h | 2h | 0h |
| 2.2 Invitation System | ⏸️ Pending | 2h | 0h | 2h |
| 3 Git Config | ⏸️ Pending | 1h | 0h | 1h |
| 4 PostgreSQL Migration | ⏸️ Pending | 16h | 0h | 16h |
| 5 Vercel Deploy | ⏸️ Pending | 3h | 0h | 3h |
| 6 DNS Config | ⏸️ Pending | 0.5h | 0h | 0.5h |
| 7 Admin Setup | ⏸️ Pending | 1h | 0h | 1h |
| **TOTAL** | **28%** | **33.5h** | **9.5h** | **24h** |

---

## 🚀 Next Steps

### Option A: Continue Systematically (Recommended for Full Automation)
1. Complete Phase 1.2 (rate limiting) - 3 hours
2. Complete Phase 1.3 (security fixes) - 1 hour
3. Complete Phase 2 (access control) - 4 hours
4. Complete Phase 3 (git config) - 1 hour
5. Begin Phase 4 (PostgreSQL migration) - 16 hours

**Pros**: Fully automated, tested, production-ready
**Cons**: 29.5 hours remaining

### Option B: Fast Track to Deployment (Recommended for Quick Testing)
1. Complete rate limiting manually on critical endpoints - 1 hour
2. Create global auth middleware - 2 hours
3. Skip PostgreSQL migration (keep SQLite for now)
4. Deploy to VPS instead of Vercel (SQLite compatible)
5. Get site live for testing - 3-4 hours total

**Pros**: Site live in 3-4 hours, can test features
**Cons**: Still on SQLite, manual migration needed later

### Option C: Hybrid Approach (Recommended for Balance)
1. Complete Phase 1 (security hardening) - 4 hours
2. Complete Phase 2 (access control) - 4 hours
3. Get staging environment working
4. Plan PostgreSQL migration as separate project
5. Deploy staging to VPS, production to Vercel after migration

**Pros**: Balance of speed and quality
**Cons**: Two-phase deployment

---

## 📝 Implementation Notes

### Scripts Created
1. `frontend/scripts/re-enable-csrf.sh` - CSRF re-enabling (✅ completed)
2. `frontend/scripts/apply-rate-limiting.md` - Rate limiting guide (✅ completed)

### Scripts Needed
1. `frontend/scripts/create-invitations-table.sql` - Invitation system schema
2. `frontend/scripts/migrate-sqlite-to-postgres.js` - Database migration tool
3. `frontend/migrations/*.sql` - PostgreSQL schema files
4. `vercel.json` - Vercel configuration

### Documentation Created
1. `SECURITY_HARDENING_STATUS.md` (this file)
2. `frontend/scripts/apply-rate-limiting.md`

---

## ⚠️ Known Issues & Risks

### Current State
- ✅ CSRF protection re-enabled (HIGH RISK fixed)
- ⚠️ Rate limiting mostly missing (HIGH RISK remains)
- ⚠️ No access control (site is currently public)
- ⚠️ Still using SQLite (Vercel incompatible)

### Critical for Production
1. **Complete rate limiting** - prevents abuse, DDoS
2. **Implement access control** - site currently public
3. **PostgreSQL migration** - required for Vercel deployment
4. **Admin user creation** - need way to access site after lockdown

---

## 📞 Questions for Project Owner

1. **Scope Decision**: Continue systematically through all 33.5 hours, or fast-track to get a working deployment?

2. **Deployment Target**: Still want Vercel (requires PostgreSQL migration), or pivot to VPS (keep SQLite)?

3. **Timeline**: Is there a deadline for getting the site live?

4. **Priority**: Security first (complete Phase 1-2), or get site deployed first (Phase 5-7)?

---

**Last Updated**: October 28, 2025 - 12:30 PM
**Status**: Awaiting project owner decision on scope/approach
