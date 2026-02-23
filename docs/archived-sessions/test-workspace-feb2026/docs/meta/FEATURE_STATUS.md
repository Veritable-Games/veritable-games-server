# Feature Status Reference

**Last Updated**: November 6, 2025
**Purpose**: Single source of truth for all platform feature states

---

## Overview

This document tracks the status of all features in the Veritable Games platform. It provides a clear, authoritative reference for what's production-ready, in development, planned, or removed.

**Status Definitions**:
- ✅ **Production-Ready**: Fully functional, tested, deployed
- 🚧 **In Development**: Actively being built
- 📋 **Planned**: Designed but not yet started
- ❌ **Removed**: Previously existed, now removed
- ⏸️ **On Hold**: Started but paused indefinitely

---

## ✅ Production-Ready Features

### Forums System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- 17 API routes
- 6 services (TopicsService, RepliesService, CategoriesService, TagsService, SearchService, NotificationService)
- 21+ components
- Real-time SSE updates
- Optimistic UI with React 19's useOptimistic
- FTS5 full-text search

**Documentation**: [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](../forums/FORUMS_DOCUMENTATION_INDEX.md)

---

### Wiki System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Full revision history
- Auto-categorization
- Wikilinks support
- FTS5 full-text search
- Collaborative editing
- Category system

**Documentation**: [docs/features/WIKI_SYSTEM_SUMMARY.md](../features/WIKI_SYSTEM_SUMMARY.md)

---

### Library System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Document management (19+ documents)
- Tag system (4 categories: Topic, Format, Difficulty, Status)
- Collections for grouping
- Annotations support
- FTS5 full-text search
- Visibility control

**Documentation**: [docs/features/LIBRARY_FEATURE_DOCUMENTATION.md](../features/LIBRARY_FEATURE_DOCUMENTATION.md)

---

### Projects & Collaboration
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Standalone revision system (decoupled from Wiki)
- Gallery integration (references + concept-art)
- Team management
- Diff viewing
- Workspace canvas

**Documentation**: [docs/features/PROJECT_REFERENCES_ARCHITECTURE.md](../features/PROJECT_REFERENCES_ARCHITECTURE.md)

---

### Gallery System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Two gallery types (references, concept-art)
- Album support with drag-and-drop
- Lightbox viewer with keyboard shortcuts
- Tag filtering
- Batch upload
- Soft delete (30-day recovery window)

**Features**:
- Gallery Albums (Oct 25, 2025)
- Soft Delete Strategy (Oct 26, 2025)

**Documentation**:
- [docs/features/ALBUMS_FEATURE_DOCUMENTATION.md](../features/ALBUMS_FEATURE_DOCUMENTATION.md)
- [docs/features/GALLERY_DELETE_STRATEGY.md](../features/GALLERY_DELETE_STRATEGY.md)

---

### Video Upload & Transcoding
**Status**: ✅ Production-Ready (November 2025)
**Completion**: 100%

**Implementation**:
- MP4 upload support
- ffmpeg-based transcoding
- Automatic poster/thumbnail generation
- Duration tracking
- Gallery integration

**Documentation**: [docs/features/VIDEO_FEATURE_DOCUMENTATION.md](../features/VIDEO_FEATURE_DOCUMENTATION.md)

---

### File Upload System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Queue management
- Progress tracking
- Error recovery
- Chunked processing (memory-efficient)
- Upload processor utility

**Documentation**: See CLAUDE.md Pattern #4

---

### Private Messaging
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Private messages
- Conversation threading
- Read/unread status
- Message search

**Documentation**: Database architecture in [docs/DATABASE.md](../DATABASE.md)

---

### 3D Stellar Visualization
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Interactive Three.js viewer
- Keplerian physics simulation
- Web Workers for performance
- Realistic rendering

**Documentation**: [docs/homepage/HOME_PAGE_ARCHITECTURE.md](../homepage/HOME_PAGE_ARCHITECTURE.md)

---

### Invitation System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 95% (fully functional, minor enhancements possible)

**Implementation**:
- Cryptographic 64-character tokens
- Multi-use invitations with configurable limits
- Email-restricted invitations (optional)
- Soft revocation with audit trail
- Admin-only management UI
- 61 tests passing (25 unit + 28 integration + 8 E2E)

**Documentation**: [docs/features/INVITATION_SYSTEM.md](../features/INVITATION_SYSTEM.md)

---

### Authentication System
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- Email/password authentication
- bcrypt hashing (12 salt rounds)
- Session-based auth (NO JWT)
- "Remember me" functionality
- CSRF protection
- Rate limiting

**Notes**: Simplified October 2025 (removed TOTP, WebAuthn)

**Documentation**: [docs/api/authentication.md](../api/authentication.md)

---

### Security Hardening
**Status**: ✅ Production-Ready (October 2025)
**Completion**: 100%

**Implementation**:
- CSRF protection (49 API routes)
- Rate limiting (8 critical endpoints)
- CSP headers (Level 3 with nonces)
- Content sanitization (DOMPurify)
- Session management
- Prepared statements only (SQL injection prevention)

**Documentation**: [docs/security/SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md)

---

## 🚧 In Development Features

### Journals System
**Status**: 🚧 In Development (85% complete)
**Started**: October 2025

**Implementation**:
- Zim-like desktop wiki interface
- Hierarchical tree navigation (25% sidebar, 75% editor)
- Auto-save with 2-second debounce
- Conflict detection (revision timestamp checking)
- Rich text editing with Tiptap

**Known Issues**:
- URL-based selection may affect browser back button

**Documentation**: [docs/features/JOURNALS_SYSTEM.md](../features/JOURNALS_SYSTEM.md)

---

## 📋 Planned Features

Currently no features in active planning phase.

**Note**: New features are discussed and planned as needed. Check recent issues or project boards for upcoming work.

---

## ❌ Removed Features (October 2025)

### Admin Dashboard
**Removed**: October 2025
**Reason**: Simplified platform, reduced maintenance burden

**Previous Functionality**:
- Administrative functions
- Moderation tools
- System management
- 65 routes, 113 endpoints

**Impact**: Admin functions moved to command-line scripts or removed

---

### Monitoring Endpoints
**Removed**: October 2025
**Reason**: Simplified platform, reduced complexity

**Previous Functionality**:
- System health monitoring
- Performance metrics
- 8 routes, 11 endpoints

**Impact**: Basic health checks remain, advanced monitoring removed

---

### PWA Features
**Removed**: October 2025
**Reason**: Simplified deployment, reduced complexity

**Previous Functionality**:
- Service worker
- Web app manifest
- Offline functionality
- Install prompts

**Impact**: Platform remains fully functional as standard web app

---

### TOTP (Two-Factor Authentication)
**Removed**: October 2025
**Reason**: Simplified authentication, reduced complexity

**Previous Functionality**:
- Time-based One-Time Password
- Authenticator app integration
- Backup codes
- Setup/verify endpoints

**Impact**: Authentication simplified to email/password only

**Documentation**: [docs/api/authentication.md](../api/authentication.md) (historical)

---

### WebAuthn (Passwordless)
**Removed**: October 2025
**Reason**: Simplified authentication, reduced complexity

**Previous Functionality**:
- Hardware security keys
- Biometric authentication
- Passkey support
- Registration/authentication endpoints

**Impact**: Authentication simplified to email/password only

**Documentation**: [docs/api/authentication.md](../api/authentication.md) (historical)

---

### TanStack Query
**Removed**: October 2025
**Reason**: Fixed hydration errors, removed unused dependency

**Previous Functionality**:
- Client-side data fetching
- Cache management
- Query invalidation

**Why Removed**:
- 900+ lines of dead code (not used anywhere)
- 50KB added to bundle
- Caused hydration mismatches
- Architecture uses Server Components instead

**Impact**: No functional impact (was never actually used)

---

### ESLint
**Removed**: October 2025
**Reason**: Fixed hydration conflicts

**Previous Functionality**:
- Code linting
- Style enforcement

**Why Removed**:
- Conflicted with Prettier
- Caused hydration warnings
- TypeScript provides sufficient type checking

**Impact**: Code quality maintained with TypeScript strict mode + Prettier

---

## ⏸️ On Hold Features

Currently no features on hold.

---

## Migration & Deployment Status

### PostgreSQL Migration
**Status**: ✅ Complete (October 30, 2025)
**Data Migrated**: 50,646 rows
**Success Rate**: 99.99%
**Tables**: 155
**Databases**: All 10 databases migrated

**Documentation**: [docs/deployment/POSTGRESQL_MIGRATION_COMPLETE.md](../deployment/POSTGRESQL_MIGRATION_COMPLETE.md)

---

### Production Deployment
**Status**: ✅ Successfully Deployed (November 5, 2025)
**Platform**: Coolify + Docker + Nixpacks
**Server**: Ubuntu Server 22.04.5 LTS
**URL**: http://192.168.1.15:3000 (local) | https://www.veritablegames.com (public)
**Auto-Deploy**: Enabled via GitHub App webhook
**Build Time**: ~3 minutes from push to live

**Documentation**: [docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](../deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)

---

## Feature Metrics

### Active Production Features: 12
- Forums
- Wiki
- Library
- Projects
- Gallery System
- Video Upload
- File Upload
- Messaging
- 3D Visualization
- Invitations
- Authentication
- Security Hardening

### In Development: 1
- Journals System (85%)

### Planned: 0

### Removed: 7
- Admin Dashboard
- Monitoring Endpoints
- PWA Features
- TOTP
- WebAuthn
- TanStack Query
- ESLint

---

## Feature Decision History

### Why Features Were Removed (October 2025)

**Philosophy Shift**: Focus on core functionality, reduce maintenance burden, improve reliability

**Decision Criteria**:
1. Is it actively used? (many weren't)
2. Does it add maintenance complexity? (most did)
3. Does it cause bugs or conflicts? (several did)
4. Can we achieve goals without it? (yes for all)

**Result**: Platform is more stable, maintainable, and focused

---

## How to Use This Document

**For Developers**:
- Check feature status before starting work
- Avoid implementing removed features
- Reference documentation links for implementation details

**For Documentation**:
- Update this file when feature status changes
- Mark features as complete when deployed
- Document removal reasons clearly

**For Users**:
- See what's available and what's coming
- Understand why features were removed
- Know where to find feature documentation

---

## Maintenance

**Update Frequency**: As features change status
**Owner**: Development team
**Review**: Monthly or after major releases

**Update Process**:
1. Change feature status
2. Update "Last Updated" date
3. Add/update documentation links
4. Commit with message: "docs: Update feature status - [feature name]"

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Platform overview
- [docs/RECENT_CHANGES.md](../RECENT_CHANGES.md) - Recent updates
- [docs/features/](../features/) - Individual feature documentation
- [docs/api/README.md](../api/README.md) - API reference

---

**Last Updated**: November 6, 2025
**Status**: ✅ Complete and current
**Next Review**: December 2025
