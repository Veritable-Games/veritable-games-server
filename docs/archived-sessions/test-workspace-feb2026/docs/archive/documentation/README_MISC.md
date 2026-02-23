# Veritable Games Documentation

Complete reference documentation for the Veritable Games platform - deployment, architecture, operations, and features.

**Last Updated**: November 12, 2025
**Status**: 🟢 Well-organized and current

---

## 🚀 Quick Start (Choose Your Path)

### I'm a Developer
- **Start here**: [CLAUDE.md](../CLAUDE.md) - Project overview & critical patterns
- **Setup**: Run `npm run db:health` and `npm run type-check` from `frontend/`
- **Architecture**: [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) - 9 must-follow patterns
- **Database**: [docs/database/DATABASE.md](./database/DATABASE.md) - 10-database architecture
- **All commands**: [COMMANDS_REFERENCE.md](./guides/COMMANDS_REFERENCE.md) - 80+ npm scripts

### I'm doing DevOps/Deployment
- **Start here**: [deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md)
- **Production access**: [docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)
- **Current status**: Live on 192.168.1.15:3000 (Coolify + PostgreSQL, deployed November 5, 2025)
- **Operations**: [docs/operations/PRODUCTION_OPERATIONS.md](./operations/PRODUCTION_OPERATIONS.md)

### I'm working on CI/CD
- **Start here**: [docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md](./ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md)
- **Testing**: [docs/guides/TESTING.md](./guides/TESTING.md)

### I'm working on Forums
- **Start here**: [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](./forums/FORUMS_DOCUMENTATION_INDEX.md)
- **6 domain services**: ForumService, ForumModerationService, ForumSearchService, ForumStatsService, ForumCategoryService, ForumSectionService

### I'm working on Wiki
- **Start here**: [docs/wiki/README.md](./wiki/README.md)
- **Git workflow**: [docs/wiki/WIKI_GIT_WORKFLOW.md](./wiki/WIKI_GIT_WORKFLOW.md)
- **Current status**: 174 pages exported to markdown (November 9, 2025)

### I'm working on Journals
- **Start here**: [investigations/JOURNAL_OPERATIONS_INDEX.md](./investigations/JOURNAL_OPERATIONS_INDEX.md)
- **Troubleshooting**: [guides/JOURNAL_TROUBLESHOOTING.md](./guides/JOURNAL_TROUBLESHOOTING.md)

### I'm troubleshooting
- **Quick fixes**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Common mistakes**: [COMMON_PITFALLS.md](./COMMON_PITFALLS.md) - 26 pitfalls to avoid
- **Recent changes**: [RECENT_CHANGES.md](./RECENT_CHANGES.md)

---

## 📚 Documentation Structure

**The 5 Core Index Points**:

1. **[docs/README.md](./README.md)** ← You are here (General navigation hub)
2. **[docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md)** (Deployment hub)
3. **[docs/forums/FORUMS_DOCUMENTATION_INDEX.md](./forums/FORUMS_DOCUMENTATION_INDEX.md)** (Forums system)
4. **[docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md](./ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md)** (CI/CD hub)
5. **[docs/wiki/README.md](./wiki/README.md)** (Wiki system)

**Primary Entry Point**: [CLAUDE.md](../CLAUDE.md) is the PRIMARY guide for developers working on this project. It contains critical patterns, quick start, and essential knowledge.

**Navigation Hub**: This file (docs/README.md) is the NAVIGATION HUB for finding specific documentation across the entire project.

---

## 🗺️ Complete Documentation Map

### Essential Files (Read These First)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[CLAUDE.md](../CLAUDE.md)** | Primary developer guide | Always start here |
| **[docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md)** | 9 critical patterns (database, API, params, uploads, etc.) | Before writing any code |
| **[docs/COMMON_PITFALLS.md](./COMMON_PITFALLS.md)** | 26 common mistakes to avoid | Before commits, troubleshooting |
| **[docs/database/DATABASE.md](./database/DATABASE.md)** | Database architecture (10 databases, 155 tables) | Database operations |
| **[docs/REACT_PATTERNS.md](./REACT_PATTERNS.md)** | React 19 + Next.js 15 patterns | Building React components |

### Feature Documentation

| Feature | Status | Documentation |
|---------|--------|---------------|
| **Forums** | ✅ Production | [forums/FORUMS_DOCUMENTATION_INDEX.md](./forums/FORUMS_DOCUMENTATION_INDEX.md) · [features/FORUMS_DETAILED.md](./features/FORUMS_DETAILED.md) |
| **Wiki** | ✅ Production (174 pages) | [wiki/README.md](./wiki/README.md) |
| **Library** | ✅ Production | [features/LIBRARY_FEATURE_DOCUMENTATION.md](./features/LIBRARY_FEATURE_DOCUMENTATION.md) |
| **Anarchist Library** | ✅ Complete (24,643 texts) | [ANARCHIST_LIBRARY_ARCHITECTURE.md](./ANARCHIST_LIBRARY_ARCHITECTURE.md) |
| **Projects** | ✅ Production | [features/PROJECT_REFERENCES_ARCHITECTURE.md](./features/PROJECT_REFERENCES_ARCHITECTURE.md) |
| **Gallery** | ✅ Production | [features/ALBUMS_FEATURE_DOCUMENTATION.md](./features/ALBUMS_FEATURE_DOCUMENTATION.md) |
| **Video Upload** | ✅ Production | [features/VIDEO_FEATURE_DOCUMENTATION.md](./features/VIDEO_FEATURE_DOCUMENTATION.md) |
| **Workspaces** | ✅ Production | [features/WORKSPACE_SYSTEM.md](./features/WORKSPACE_SYSTEM.md) |
| **News Management** | ✅ Production | [features/NEWS_MANAGEMENT.md](./features/NEWS_MANAGEMENT.md) |
| **Notifications** | ✅ Production | [features/NOTIFICATION_SYSTEM.md](./features/NOTIFICATION_SYSTEM.md) |
| **Settings & User Management** | ✅ Production | [features/SETTINGS_USER_MANAGEMENT.md](./features/SETTINGS_USER_MANAGEMENT.md) |
| **Email System** | ✅ Production | [features/EMAIL_SYSTEM.md](./features/EMAIL_SYSTEM.md) |
| **GDPR Compliance** | ✅ Production (Data Export) | [features/GDPR_COMPLIANCE.md](./features/GDPR_COMPLIANCE.md) |
| **Messaging** | ✅ Production | API routes in `/api/messages/` |
| **Journals** | 🚧 In Development (40%) | [investigations/JOURNAL_OPERATIONS_INDEX.md](./investigations/JOURNAL_OPERATIONS_INDEX.md) |
| **Marxists.org** | ⏳ In Progress | [MARXISTS_INTEGRATION_PLAN.md](./MARXISTS_INTEGRATION_PLAN.md) |

See [meta/FEATURE_STATUS.md](./meta/FEATURE_STATUS.md) for complete feature status reference.

### Architecture Documentation (34 Files)

| Category | Key Documents |
|----------|---------------|
| **Critical Patterns** | [architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) |
| **Banned Patterns** | [.claude/BANNED_PATTERNS.md](../.claude/BANNED_PATTERNS.md) |
| **Security** | [architecture/SECURITY_PATTERNS.md](./architecture/SECURITY_PATTERNS.md) · [architecture/SECURITY_ARCHITECTURE_ANALYSIS.md](./architecture/SECURITY_ARCHITECTURE_ANALYSIS.md) |
| **Database Safety** | [architecture/DATABASE_SAFETY_GUARDS.md](./architecture/DATABASE_SAFETY_GUARDS.md) |
| **Backend** | [architecture/BACKEND_ISSUES_DIAGNOSIS.md](./architecture/BACKEND_ISSUES_DIAGNOSIS.md) |
| **Frontend** | [architecture/FRONTEND_API_CONTRACT.md](./architecture/FRONTEND_API_CONTRACT.md) |
| **Wiki** | [wiki/ARCHITECTURE.md](./wiki/ARCHITECTURE.md) |

Browse all: [docs/architecture/](./architecture/)

### Operations & Deployment

| Document | Purpose |
|----------|---------|
| **[deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md)** | Master deployment hub |
| **[deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** | What actually worked (Nov 5, 2025) |
| **[deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md](./deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md)** | Self-hosting guide |
| **[deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** | SSH access & operations |
| **[deployment/POSTGRESQL_MIGRATION_COMPLETE.md](./deployment/POSTGRESQL_MIGRATION_COMPLETE.md)** | Database migration (50,646 rows) |
| **[operations/PRODUCTION_OPERATIONS.md](./operations/PRODUCTION_OPERATIONS.md)** | Monitoring & incident response |

Browse all: [docs/deployment/](./deployment/)

### Guides (23+ Files)

| Document | Purpose |
|----------|---------|
| **[guides/COMPONENTS.md](./guides/COMPONENTS.md)** | React form & UI components |
| **[guides/FILE_HANDLING.md](./guides/FILE_HANDLING.md)** | File upload & media management |
| **[guides/STYLING.md](./guides/STYLING.md)** | Tailwind CSS & styling patterns |
| **[guides/COMMANDS_REFERENCE.md](./guides/COMMANDS_REFERENCE.md)** | All 80+ npm scripts |
| **[guides/TESTING.md](./guides/TESTING.md)** | Complete testing guide |
| **[guides/MAINTENANCE.md](./guides/MAINTENANCE.md)** | Dependency updates & maintenance |
| **[guides/ADMIN_INVITATION_MANAGEMENT.md](./guides/ADMIN_INVITATION_MANAGEMENT.md)** | Admin invitation workflow |
| **[guides/GITHUB_MCP_SETUP.md](./guides/GITHUB_MCP_SETUP.md)** | GitHub MCP for Claude Code |
| **[guides/JOURNAL_TROUBLESHOOTING.md](./guides/JOURNAL_TROUBLESHOOTING.md)** | Database troubleshooting |

Browse all: [docs/guides/](./guides/)

### Reports & Analysis (8 Files)

| Document | Purpose | Date |
|----------|---------|------|
| **[reports/PERFORMANCE_OPTIMIZATION_REPORT.md](./reports/PERFORMANCE_OPTIMIZATION_REPORT.md)** | Comprehensive perf analysis (60KB) | November 2025 |
| **[reports/WIKI_PERFORMANCE_REPORT.md](./reports/WIKI_PERFORMANCE_REPORT.md)** | Wiki-specific performance | October 2025 |
| **[reports/ACCESSIBILITY_IMPROVEMENTS_SUMMARY.md](./reports/ACCESSIBILITY_IMPROVEMENTS_SUMMARY.md)** | Accessibility overview | October 2025 |
| **[reports/ACCESSIBILITY_COMPLIANCE_REPORT.md](./reports/ACCESSIBILITY_COMPLIANCE_REPORT.md)** | Full accessibility audit | October 2025 |

Browse all: [docs/reports/](./reports/)

### API Documentation

| Document | Purpose |
|----------|---------|
| **[api/README.md](./api/README.md)** | Complete API reference (249 endpoints) |
| **[api/authentication.md](./api/authentication.md)** | Auth endpoints |
| **[api/README.md](./api/README.md)** | Complete API reference (249 endpoints) |

### Troubleshooting & Maintenance

| Document | Purpose |
|----------|---------|
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Quick fixes for common issues |
| **[COMMON_PITFALLS.md](./COMMON_PITFALLS.md)** | 26 mistakes to avoid |
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Database issues |
| **[guides/MAINTENANCE.md](./guides/MAINTENANCE.md)** | Dependency updates |

### Archive Integrations

| Integration | Status | Documentation |
|-------------|--------|---------------|
| **Anarchist Library** | ✅ Complete (24,643 texts, 27 languages) | [ANARCHIST_LIBRARY_ARCHITECTURE.md](./ANARCHIST_LIBRARY_ARCHITECTURE.md) |
| **Marxists.org** | ⏳ In Progress (500,000+ documents) | [MARXISTS_INTEGRATION_PLAN.md](./MARXISTS_INTEGRATION_PLAN.md) |

### Historical Documentation

Archived documentation (completed projects, resolved issues, deprecated guides):

- **[docs/archive/README.md](./archive/README.md)** - Archive index and navigation
- **[docs/archive/resolved-issues/](./archive/resolved-issues/)** - Historical issue documentation
- **[docs/archive/completed-projects/](./archive/completed-projects/)** - Completed project documentation

---

## 🎯 Quick Decision Tree

**Use this to quickly find the right documentation:**

```
Q: Where do I start?
→ New to codebase: Read CLAUDE.md (5 min)
  Working on feature: Check docs/features/ or system-specific index
  Deploying: Read deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md
  Troubleshooting: Read TROUBLESHOOTING.md

Q: SQLite or PostgreSQL?
→ Development (localhost): SQLite in frontend/data/*.db
  Production (192.168.1.15): PostgreSQL ONLY
  See: frontend/src/lib/utils/SAFETY_GUARDS_README.md

Q: Need to access a database?
→ Production: Use dbAdapter (auto-routes to PostgreSQL)
  Development: Use dbPool.getConnection() for SQLite
  NEVER create Database instances directly
  See: docs/architecture/CRITICAL_PATTERNS.md

Q: Creating an API route?
→ Use withSecurity() + inline validation + errorResponse() pattern
  See: docs/architecture/CRITICAL_PATTERNS.md (Pattern #2)

Q: Which database for my data?
→ forums (discussions), wiki (pages), content (projects/news/workspaces),
  users (profiles), auth (sessions), library (documents), messaging (messages)
  See: docs/database/DATABASE.md

Q: Running commands?
→ Git commands from ROOT, npm commands from frontend/
  See: docs/guides/COMMANDS_REFERENCE.md

Q: Ready to deploy?
→ Use Coolify self-hosted (recommended)
  See: docs/deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md

Q: Need to test file uploads?
→ Use FileQueueManager component with upload-processor utility
  See: docs/architecture/CRITICAL_PATTERNS.md (Pattern #4)
```

---

## 📊 Documentation Statistics

**Total Documentation**:
- **Active Files**: 370+ markdown files
- **Archived Files**: 23 files (historical reference)
- **Total Lines**: ~45,000 lines of documentation

**By Category**:
- Architecture: 32 files
- Features: 15+ files
- Guides: 20+ files
- Reports: 8 files
- Deployment: 8 files
- API: 3 files
- Forums: 4 files
- Wiki: 5 files

---

## 🏗️ Project Technology Stack

**Frontend**: Next.js 15.5.6 + React 19.1.1 + TypeScript 5.7.2
**Backend**: Next.js API routes (App Router)
**Database**: PostgreSQL 15 (production) | SQLite 3 (localhost dev)
**Build Tool**: Turbopack
**3D Visualization**: Three.js 0.180.0
**Testing**: Jest 29.7.0 + React Testing Library 16.0.1

**Current Status** (November 9, 2025):
- ✅ Production-ready (live on 192.168.1.15:3000)
- ✅ TypeScript 0 errors
- ✅ All core features operational
- ✅ Database migration complete (50,646 rows)
- ✅ Anarchist Library integration complete (24,643 texts)
- ⏳ Marxists.org scraper in progress (500,000+ documents)

---

## 🔗 Cross-References

### Database-Related Documentation
```
database/DATABASE.md (architecture)
  ├── CRITICAL_PATTERNS.md (Pattern #1: Database Access)
  ├── COMMON_PITFALLS.md (Pitfall #1: Creating Database instances)
  ├── deployment/POSTGRESQL_MIGRATION_COMPLETE.md (migration status)
  └── TROUBLESHOOTING.md (troubleshooting)
```

### Security-Related Documentation
```
security/SECURITY_HARDENING_PROGRESS.md (implementation status)
  ├── CRITICAL_PATTERNS.md (Pattern #2: API Security)
  ├── architecture/SECURITY_ARCHITECTURE_ANALYSIS.md (design analysis)
  └── api/authentication.md (auth endpoints)
```

### Feature Development Documentation
```
meta/FEATURE_STATUS.md (status reference)
  ├── features/[FEATURE]_DOCUMENTATION.md (implementation details)
  ├── CRITICAL_PATTERNS.md (patterns to follow)
  ├── REACT_PATTERNS.md (React 19 patterns)
  └── guides/TESTING.md (testing approach)
```

### Deployment-Related Documentation
```
deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md (hub)
  ├── deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md (current)
  ├── deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md (access)
  ├── operations/PRODUCTION_OPERATIONS.md (operations)
  └── deployment/POSTGRESQL_MIGRATION_COMPLETE.md (database)
```

---

## 📖 Learning Paths

### New Developer (First Day)
1. Read [CLAUDE.md](../CLAUDE.md) - Project overview (15 min)
2. Run Quick Start from CLAUDE.md (15 min)
3. Read [docs/architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) (20 min)
4. Scan [docs/COMMON_PITFALLS.md](./COMMON_PITFALLS.md) (15 min)
5. Review [docs/database/DATABASE.md](./database/DATABASE.md) (20 min)

**Total**: ~90 minutes to productive development

### DevOps Engineer (First Day)
1. Read [CLAUDE.md](../CLAUDE.md) (10 min)
2. Read [deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) (15 min)
3. Read [deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) (25 min)
4. Read [deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) (20 min)
5. Read [operations/PRODUCTION_OPERATIONS.md](./operations/PRODUCTION_OPERATIONS.md) (20 min)

**Total**: ~90 minutes to production operations

### Feature Developer (Ongoing)
1. Check feature status: [meta/FEATURE_STATUS.md](./meta/FEATURE_STATUS.md)
2. Review architecture: [architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md)
3. Read system-specific docs (forums, wiki, etc.)
4. Review React patterns: [REACT_PATTERNS.md](./REACT_PATTERNS.md)
5. Write tests: [guides/TESTING.md](./guides/TESTING.md)

---

## 🆘 Getting Help

### For Specific Topics

| Topic | Documentation |
|-------|---------------|
| **Critical patterns** | [architecture/CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) |
| **Common mistakes** | [COMMON_PITFALLS.md](./COMMON_PITFALLS.md) |
| **Troubleshooting** | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| **Database architecture** | [database/DATABASE.md](./database/DATABASE.md) |
| **React patterns** | [REACT_PATTERNS.md](./REACT_PATTERNS.md) |
| **API reference** | [api/README.md](./api/README.md) |
| **Deployment** | [deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md](./deployment/DEPLOYMENT_DOCUMENTATION_INDEX.md) |
| **Production access** | [deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) |

### For System-Specific Help

| System | Documentation Index |
|--------|---------------------|
| **Forums** | [forums/FORUMS_DOCUMENTATION_INDEX.md](./forums/FORUMS_DOCUMENTATION_INDEX.md) |
| **Wiki** | [wiki/README.md](./wiki/README.md) |
| **Journals** | [investigations/JOURNAL_OPERATIONS_INDEX.md](./investigations/JOURNAL_OPERATIONS_INDEX.md) |
| **CI/CD** | [ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md](./ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md) |

---

## 📝 Documentation Maintenance

**Update this index when**:
- New major documentation files are added
- Documentation structure changes
- New features are documented
- Systems are added or removed

**Review schedule**: After major releases or quarterly

---

**This is the master documentation index for Veritable Games.**
**Primary guide**: [CLAUDE.md](../CLAUDE.md)
**Navigation hub**: This file (docs/README.md)

**Last Updated**: November 12, 2025
