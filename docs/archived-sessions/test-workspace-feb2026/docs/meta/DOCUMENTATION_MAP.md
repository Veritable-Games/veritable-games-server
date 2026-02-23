# Documentation Map

**Last Updated**: November 6, 2025
**Purpose**: Visual guide to navigate the Veritable Games documentation

---

## Overview

This map shows how all documentation files relate to each other, organized by audience and use case. Use this to quickly find the right documentation for your needs.

---

## Quick Navigation by Audience

### 🆕 New to the Codebase?
**Start Here** → [CLAUDE.md](../../CLAUDE.md) (5 minutes to understand critical patterns)
- Then → [docs/README.md](../README.md) (complete documentation index)
- Then → [docs/COMMON_PITFALLS.md](../COMMON_PITFALLS.md) (avoid 26 common mistakes)

### 🚀 Setting Up for Development?
**Start Here** → [CLAUDE.md](../../CLAUDE.md) (Quick Start section)
- Then → [docs/guides/COMMANDS_REFERENCE.md](../guides/COMMANDS_REFERENCE.md) (80+ npm scripts)
- Then → [docs/DATABASE.md](../DATABASE.md) (understand 10-database architecture)

### 🏗️ Building a Feature?
**Start Here** → [docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)
- Then → [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md) (React 19 + Next.js 15)
- Then → [docs/features/](../features/) (feature-specific documentation)

### 🔒 Security Review or Hardening?
**Start Here** → [docs/security/SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md)
- Then → [docs/architecture/SECURITY_ARCHITECTURE_ANALYSIS.md](../architecture/SECURITY_ARCHITECTURE_ANALYSIS.md)
- Then → [docs/guides/CSRF_RATE_LIMITING_GUIDE.md](../guides/CSRF_RATE_LIMITING_GUIDE.md)

### 📦 Deploying to Production?
**Start Here** → [docs/DEPLOYMENT_DOCUMENTATION_INDEX.md](../DEPLOYMENT_DOCUMENTATION_INDEX.md)
- Then → [docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](../deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)
- Then → [docs/operations/PRODUCTION_OPERATIONS.md](../operations/PRODUCTION_OPERATIONS.md)

### 🧪 Writing Tests?
**Start Here** → [docs/guides/TESTING.md](../guides/TESTING.md)
- Then → [docs/features/INVITATION_SYSTEM.md](../features/INVITATION_SYSTEM.md) (example: 61 tests)

### 🐛 Troubleshooting Issues?
**Start Here** → [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- Then → [docs/COMMON_PITFALLS.md](../COMMON_PITFALLS.md)
- Then → [docs/guides/DATABASE_MIGRATION_TROUBLESHOOTING.md](../guides/DATABASE_MIGRATION_TROUBLESHOOTING.md)

---

## Documentation Hierarchy

```mermaid
graph TB
    CLAUDE[CLAUDE.md<br/>Main Entry Point]
    README[docs/README.md<br/>Documentation Index]

    CLAUDE --> README
    CLAUDE --> CRITICAL[Critical Patterns]
    CLAUDE --> PITFALLS[Common Pitfalls]
    CLAUDE --> DEPLOY[Deployment Index]

    README --> ARCH[Architecture Docs]
    README --> FEATURES[Feature Docs]
    README --> GUIDES[Guides]
    README --> REPORTS[Reports]

    CRITICAL --> PATTERNS[CRITICAL_PATTERNS.md]
    CRITICAL --> BANNED[BANNED_PATTERNS.md]

    PITFALLS --> PITFALLS_DOC[COMMON_PITFALLS.md]
    PITFALLS --> TROUBLESHOOT[TROUBLESHOOTING.md]

    DEPLOY --> DEPLOY_DOCS[Deployment Guides]
    DEPLOY --> OPS[Production Operations]

    ARCH --> ARCH_DOCS[32 Architecture Files]
    FEATURES --> FEATURE_DOCS[15+ Feature Files]
    GUIDES --> GUIDE_DOCS[20+ Guide Files]
    REPORTS --> REPORT_DOCS[8 Report Files]

    style CLAUDE fill:#4CAF50,color:#fff
    style README fill:#2196F3,color:#fff
    style CRITICAL fill:#FF5722,color:#fff
    style DEPLOY fill:#9C27B0,color:#fff
```

---

## Document Relationships by Type

### Core Documentation Flow

```mermaid
graph LR
    START[New Developer] --> CLAUDE[CLAUDE.md]
    CLAUDE --> QUICKSTART[Quick Start]
    QUICKSTART --> DB_HEALTH[npm run db:health]
    QUICKSTART --> TYPE_CHECK[npm run type-check]
    QUICKSTART --> DEV_SERVER[npm run dev]

    CLAUDE --> PATTERNS[Critical Patterns]
    PATTERNS --> DB_PATTERN[Database Access]
    PATTERNS --> API_PATTERN[API Security]
    PATTERNS --> PARAMS_PATTERN[Async Params]
    PATTERNS --> UPLOAD_PATTERN[File Upload]

    CLAUDE --> AVOID[What to Avoid]
    AVOID --> PITFALLS[COMMON_PITFALLS.md]
    AVOID --> BANNED[BANNED_PATTERNS.md]

    style START fill:#FFC107,color:#000
    style CLAUDE fill:#4CAF50,color:#fff
    style PATTERNS fill:#FF5722,color:#fff
    style AVOID fill:#F44336,color:#fff
```

### Feature Documentation Structure

```mermaid
graph TB
    FEATURE_STATUS[meta/FEATURE_STATUS.md<br/>Single Source of Truth]

    FEATURE_STATUS --> PROD_READY[Production-Ready: 12]
    FEATURE_STATUS --> IN_DEV[In Development: 1]
    FEATURE_STATUS --> REMOVED[Removed: 7]

    PROD_READY --> FORUMS[Forums System]
    PROD_READY --> WIKI[Wiki System]
    PROD_READY --> LIBRARY[Library System]
    PROD_READY --> PROJECTS[Projects]
    PROD_READY --> GALLERY[Gallery System]
    PROD_READY --> VIDEO[Video Upload]
    PROD_READY --> MESSAGING[Private Messaging]

    FORUMS --> FORUMS_DOC[forums/FORUMS_DOCUMENTATION_INDEX.md]
    WIKI --> WIKI_DOC[features/WIKI_SYSTEM_SUMMARY.md]
    LIBRARY --> LIBRARY_DOC[features/LIBRARY_FEATURE_DOCUMENTATION.md]
    PROJECTS --> PROJECTS_DOC[features/PROJECT_REFERENCES_ARCHITECTURE.md]
    GALLERY --> GALLERY_DOC[features/ALBUMS_FEATURE_DOCUMENTATION.md]
    VIDEO --> VIDEO_DOC[features/VIDEO_FEATURE_DOCUMENTATION.md]

    style FEATURE_STATUS fill:#4CAF50,color:#fff
    style PROD_READY fill:#2196F3,color:#fff
    style IN_DEV fill:#FF9800,color:#fff
    style REMOVED fill:#9E9E9E,color:#fff
```

### Architecture Documentation Flow

```mermaid
graph TB
    ARCH_START[Architecture Question?]

    ARCH_START --> DB_ARCH{Database Related?}
    ARCH_START --> SEC_ARCH{Security Related?}
    ARCH_START --> PERF_ARCH{Performance Related?}
    ARCH_START --> PATTERN_ARCH{Pattern Related?}

    DB_ARCH -->|Yes| DATABASE[DATABASE.md]
    DATABASE --> DB_POOL[Connection Pooling]
    DATABASE --> DB_10[10 Database Structure]
    DATABASE --> PROFILE_AGG[ProfileAggregatorService]

    SEC_ARCH -->|Yes| SECURITY[security/SECURITY_HARDENING_PROGRESS.md]
    SECURITY --> CSRF_DOC[guides/CSRF_RATE_LIMITING_GUIDE.md]
    SECURITY --> SEC_ANALYSIS[architecture/SECURITY_ARCHITECTURE_ANALYSIS.md]

    PERF_ARCH -->|Yes| PERFORMANCE[reports/PERFORMANCE_OPTIMIZATION_REPORT.md]
    PERFORMANCE --> WIKI_PERF[reports/WIKI_PERFORMANCE_REPORT.md]
    PERFORMANCE --> REACT_PERF[REACT_PATTERNS.md]

    PATTERN_ARCH -->|Yes| CRITICAL_PATTERNS[architecture/CRITICAL_PATTERNS.md]
    CRITICAL_PATTERNS --> BANNED_PATTERNS[.claude/BANNED_PATTERNS.md]
    CRITICAL_PATTERNS --> REACT_PATTERNS[REACT_PATTERNS.md]

    style ARCH_START fill:#FFC107,color:#000
    style DATABASE fill:#4CAF50,color:#fff
    style SECURITY fill:#F44336,color:#fff
    style PERFORMANCE fill:#2196F3,color:#fff
    style CRITICAL_PATTERNS fill:#FF5722,color:#fff
```

### Deployment Documentation Flow

```mermaid
graph LR
    DEPLOY_START[Need to Deploy?]

    DEPLOY_START --> DEPLOY_INDEX[DEPLOYMENT_DOCUMENTATION_INDEX.md]

    DEPLOY_INDEX --> METHOD{Deployment Method?}

    METHOD -->|Self-Hosted| COOLIFY[deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md]
    METHOD -->|Docker| DOCKER[deployment/DOCKER_DEPLOYMENT_GUIDE.md]
    METHOD -->|PostgreSQL| POSTGRES[deployment/POSTGRESQL_MIGRATION_COMPLETE.md]

    COOLIFY --> PROD_ACCESS[deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md]
    COOLIFY --> PROD_OPS[operations/PRODUCTION_OPERATIONS.md]

    PROD_OPS --> MONITORING[Monitoring & Logs]
    PROD_OPS --> INCIDENT[Incident Response]
    PROD_OPS --> BACKUP[Backup & Recovery]

    style DEPLOY_START fill:#FFC107,color:#000
    style COOLIFY fill:#4CAF50,color:#fff
    style PROD_OPS fill:#2196F3,color:#fff
```

---

## Document Categories and Contents

### 1. Entry Points (Start Here)
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **CLAUDE.md** | Main entry point, critical patterns, quick start | Always start here |
| **docs/README.md** | Complete documentation index | Find specific documentation |
| **docs/RECENT_CHANGES.md** | What's new, current status | Catch up on recent work |

### 2. Critical Knowledge (Must Read)
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **docs/architecture/CRITICAL_PATTERNS.md** | 4 must-follow patterns (database, API, params, uploads) | Before writing any code |
| **docs/COMMON_PITFALLS.md** | 26 common mistakes to avoid | Before commits, troubleshooting |
| **docs/REACT_PATTERNS.md** | React 19 + Next.js 15 patterns | Building React components |
| **docs/DATABASE.md** | 10-database architecture | Database operations |
| **.claude/BANNED_PATTERNS.md** | Patterns NEVER to reintroduce | Architecture decisions |

### 3. Feature Documentation (15+ Files)
| Document | Feature | Status |
|----------|---------|--------|
| **docs/meta/FEATURE_STATUS.md** | All features status reference | ✅ Single source of truth |
| **docs/forums/FORUMS_DOCUMENTATION_INDEX.md** | Forums system (17 routes, 6 services) | ✅ Production |
| **docs/features/LIBRARY_FEATURE_DOCUMENTATION.md** | Library system (19+ documents) | ✅ Production |
| **docs/features/WIKI_SYSTEM_SUMMARY.md** | Wiki with revisions | ✅ Production |
| **docs/features/PROJECT_REFERENCES_ARCHITECTURE.md** | Projects & collaboration | ✅ Production |
| **docs/features/ALBUMS_FEATURE_DOCUMENTATION.md** | Gallery albums | ✅ Production |
| **docs/features/VIDEO_FEATURE_DOCUMENTATION.md** | Video upload & transcoding | ✅ Production |
| **docs/features/INVITATION_SYSTEM.md** | Invitation system (61 tests) | ✅ Production (95%) |
| **docs/features/JOURNALS_SYSTEM.md** | Zim-like journals | 🚧 In Development (85%) |

### 4. Architecture Documentation (32 Files)
| Document | Purpose | Audience |
|----------|---------|----------|
| **docs/architecture/CRITICAL_PATTERNS.md** | Must-follow patterns | All developers |
| **docs/architecture/SECURITY_ARCHITECTURE_ANALYSIS.md** | Security design | Security reviewers |
| **docs/architecture/BACKEND_ISSUES_DIAGNOSIS.md** | Backend architecture | Backend developers |
| **docs/architecture/FRONTEND_API_CONTRACT.md** | API contracts | Frontend developers |
| **docs/architecture/WIKI_ARCHITECTURE_ANALYSIS.md** | Wiki architecture | Wiki feature developers |

### 5. Guides (20+ Files)
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **docs/guides/COMMANDS_REFERENCE.md** | 80+ npm scripts | Running commands |
| **docs/guides/TESTING.md** | Complete testing guide | Writing tests |
| **docs/guides/MAINTENANCE.md** | Dependency updates | Monthly maintenance |
| **docs/guides/CSRF_RATE_LIMITING_GUIDE.md** | Security implementation | Adding security |
| **docs/guides/ADMIN_INVITATION_MANAGEMENT.md** | Managing invitations | Admin tasks |
| **docs/guides/DATABASE_MIGRATION_TROUBLESHOOTING.md** | Database issues | Troubleshooting |
| **docs/guides/GITHUB_MCP_SETUP.md** | GitHub MCP for Claude Code | CI/CD monitoring |

### 6. Deployment Documentation (8 Files)
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **docs/DEPLOYMENT_DOCUMENTATION_INDEX.md** | Deployment hub | Starting deployment |
| **docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md** | Actual deployment (Nov 5) | Current deployment |
| **docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md** | Self-hosting guide | Setting up Coolify |
| **docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md** | Production SSH & access | Working with production |
| **docs/deployment/POSTGRESQL_MIGRATION_COMPLETE.md** | PostgreSQL migration | Database migration |
| **docs/deployment/DOCKER_DEPLOYMENT_GUIDE.md** | Docker deployment | Docker setup |
| **docs/operations/PRODUCTION_OPERATIONS.md** | Operations & monitoring | Production management |

### 7. Reports & Analysis (8 Files)
| Document | Purpose | Date |
|----------|---------|------|
| **docs/reports/PERFORMANCE_OPTIMIZATION_REPORT.md** | Comprehensive perf analysis (60KB) | November 2025 |
| **docs/reports/WIKI_PERFORMANCE_REPORT.md** | Wiki-specific performance | October 2025 |
| **docs/reports/ACCESSIBILITY_IMPROVEMENTS_SUMMARY.md** | Accessibility overview | October 2025 |
| **docs/reports/ACCESSIBILITY_COMPLIANCE_REPORT.md** | Full accessibility audit | October 2025 |

### 8. Troubleshooting & Maintenance
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **docs/TROUBLESHOOTING.md** | Quick fixes for common issues | When stuck |
| **docs/COMMON_PITFALLS.md** | 26 mistakes to avoid | Prevention |
| **docs/guides/DATABASE_MIGRATION_TROUBLESHOOTING.md** | Database issues | Database problems |
| **docs/guides/MAINTENANCE.md** | Dependency updates | Monthly/quarterly |

### 9. API Documentation
| Document | Purpose | Audience |
|----------|---------|----------|
| **docs/api/README.md** | Complete API reference (249 endpoints) | API consumers |
| **docs/api/authentication.md** | Auth endpoints (simplified) | Auth developers |
| **docs/api/forums.md** | Forums API | Forums developers |

### 10. CI/CD Documentation
| Document | Purpose | When to Use |
|----------|---------|-------------|
| **docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md** | CI/CD hub | Setting up workflows |
| **docs/guides/GITHUB_MCP_SETUP.md** | GitHub MCP integration | CI monitoring from Claude |

---

## Cross-Document References

### Database-Related Documentation
```
DATABASE.md (architecture)
  ├── CRITICAL_PATTERNS.md (Pattern #1: Database Access)
  ├── COMMON_PITFALLS.md (Pitfall #1: Creating Database instances)
  ├── deployment/POSTGRESQL_MIGRATION_COMPLETE.md (migration status)
  └── guides/DATABASE_MIGRATION_TROUBLESHOOTING.md (troubleshooting)
```

### Security-Related Documentation
```
security/SECURITY_HARDENING_PROGRESS.md (implementation status)
  ├── CRITICAL_PATTERNS.md (Pattern #2: API Security)
  ├── architecture/SECURITY_ARCHITECTURE_ANALYSIS.md (design analysis)
  ├── guides/CSRF_RATE_LIMITING_GUIDE.md (implementation guide)
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
DEPLOYMENT_DOCUMENTATION_INDEX.md (hub)
  ├── deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md (current)
  ├── deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md (access)
  ├── operations/PRODUCTION_OPERATIONS.md (operations)
  └── deployment/POSTGRESQL_MIGRATION_COMPLETE.md (database)
```

---

## Documentation Update Workflow

```mermaid
graph TB
    CHANGE[Code Change]

    CHANGE --> TYPE{What Changed?}

    TYPE -->|New Feature| UPDATE_FEATURE[Update FEATURE_STATUS.md]
    TYPE -->|Architecture| UPDATE_ARCH[Update Architecture docs]
    TYPE -->|Bug Fix| UPDATE_TROUBLE[Update TROUBLESHOOTING.md]
    TYPE -->|Deployment| UPDATE_DEPLOY[Update Deployment docs]

    UPDATE_FEATURE --> CREATE_DOC[Create feature doc in docs/features/]
    UPDATE_FEATURE --> UPDATE_README[Update docs/README.md]
    UPDATE_FEATURE --> UPDATE_CLAUDE[Update CLAUDE.md if critical]

    UPDATE_ARCH --> UPDATE_CRITICAL[Update CRITICAL_PATTERNS.md if needed]
    UPDATE_ARCH --> UPDATE_BANNED[Update BANNED_PATTERNS.md if pattern banned]

    UPDATE_DEPLOY --> UPDATE_OPS[Update PRODUCTION_OPERATIONS.md]
    UPDATE_DEPLOY --> UPDATE_ACCESS[Update ACCESS_GUIDE.md if needed]

    UPDATE_README --> DATES[Update Last Updated dates]
    UPDATE_CLAUDE --> DATES
    UPDATE_TROUBLE --> DATES
    UPDATE_DEPLOY --> DATES

    style CHANGE fill:#FFC107,color:#000
    style DATES fill:#4CAF50,color:#fff
```

---

## Quick Reference: "Where Do I Find...?"

| Looking For... | Go To... |
|----------------|----------|
| **How to start dev server** | CLAUDE.md → Quick Start |
| **Critical patterns to follow** | docs/architecture/CRITICAL_PATTERNS.md |
| **Common mistakes to avoid** | docs/COMMON_PITFALLS.md |
| **All available npm commands** | docs/guides/COMMANDS_REFERENCE.md |
| **Database architecture** | docs/DATABASE.md |
| **Feature status (what's working)** | docs/meta/FEATURE_STATUS.md |
| **How to deploy** | docs/DEPLOYMENT_DOCUMENTATION_INDEX.md |
| **Production server access** | docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md |
| **API reference** | docs/api/README.md |
| **React 19 patterns** | docs/REACT_PATTERNS.md |
| **Security implementation** | docs/security/SECURITY_HARDENING_PROGRESS.md |
| **How to write tests** | docs/guides/TESTING.md |
| **Performance optimization** | docs/reports/PERFORMANCE_OPTIMIZATION_REPORT.md |
| **Troubleshooting** | docs/TROUBLESHOOTING.md |
| **CI/CD setup** | docs/ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md |
| **What NOT to do** | .claude/BANNED_PATTERNS.md |

---

## Documentation Statistics

**Total Documentation**:
- **Active Files**: 367 markdown files
- **Archived Files**: 23 files (historical reference)
- **Total Lines**: ~45,000 lines of documentation

**By Category**:
- Architecture: 32 files
- Features: 15+ files
- Guides: 20+ files
- Reports: 8 files
- Deployment: 8 files
- API: 3 files

**Documentation Quality**:
- ✅ All dates current (November 6, 2025)
- ✅ No contradictions
- ✅ All valuable docs linked from entry points
- ✅ Clear separation: active vs. archived

---

## How to Use This Map

**For Navigation**:
1. Start with "Quick Navigation by Audience" section above
2. Follow the Mermaid diagrams to understand relationships
3. Use "Quick Reference" table for specific topics

**For Understanding Structure**:
1. Review "Documentation Hierarchy" diagram
2. See "Document Categories and Contents" for detailed listings
3. Check "Cross-Document References" for related docs

**For Updates**:
1. Follow "Documentation Update Workflow" diagram
2. Update dates in modified files
3. Update this map if structure changes

---

## Maintenance

**Update This Map When**:
- New major documentation files added
- Documentation structure changes significantly
- New feature documentation created
- Deployment process changes

**Review Schedule**: Quarterly or after major releases

---

**Last Updated**: November 6, 2025
**Status**: ✅ Complete and current
**Next Review**: February 2026
