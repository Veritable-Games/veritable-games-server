# Future Features Roadmap

**Created**: February 10, 2026
**Last Updated**: February 10, 2026
**Purpose**: Track planned features marked with TODO comments in codebase

This document tracks 25 TODO comments that represent planned future features and enhancements. These are intentional placeholders for features that require design, planning, and implementation work.

---

## 🎯 High Priority Features

### 1. Reputation & Gamification System

**Status**: 🔴 Not Started
**Effort**: ~80-120 hours
**Dependencies**: User activity tracking, voting system

**Description**: Comprehensive reputation system with points, badges, and user progression tracking.

**TODO Locations**:
- `src/lib/users/service.ts:102` - `forum_reputation: 0`
- `src/lib/profiles/profile-aggregator-service.ts:320` - `total: 0`
- `src/lib/profiles/profile-aggregator-service.ts:328` - `joinedDaysAgo: 0`
- `src/lib/profiles/profile-aggregator-service.ts:329` - `averageDailyActivity: 0`
- `src/lib/profiles/service.ts:985` - `helpful_votes: 0`
- `src/lib/profiles/service.ts:986` - `solutions: 0`

**Features to Implement**:
- Forum reputation points (posts, helpful votes, solutions)
- User activity metrics (join date, daily activity, streaks)
- Reputation leaderboard
- Achievement badges
- User level progression

**Related Documentation**: None yet - needs design document

---

### 2. Donation & Payment Processing

**Status**: 🟡 Partially Complete (structure exists)
**Effort**: ~40-60 hours
**Dependencies**: BTCPay Server / Stripe integration

**Description**: Complete donation system with payment processing, user tracking, and analytics.

**TODO Locations**:
- `src/app/api/donations/route.ts:47` - Get user ID from session
- `src/app/api/donations/route.ts:53` - Initiate payment with processor
- `src/app/api/donations/route.ts:97` - Implement filtered query
- `src/app/api/donations/route.ts:107` - Get actual count

**Features to Implement**:
- Authenticated user donations (track donor)
- BTCPay Server integration (cryptocurrency)
- Stripe integration (credit card)
- Donation history and receipts
- Anonymous donations
- Recurring donation support
- Donation filtering and search

**Related Documentation**: `docs/features/DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md`

---

## 🔧 Infrastructure & Tools

### 3. Analytics & Monitoring Integration

**Status**: 🔴 Not Started
**Effort**: ~20-30 hours
**Dependencies**: Analytics service account (Plausible/Fathom), Sentry account

**Description**: External analytics and error monitoring for production insights.

**TODO Locations**:
- `src/lib/analytics/donation-tracking.ts:44` - Send to analytics service
- `src/lib/security/csp-monitor.ts:414` - Send to Sentry
- `src/lib/security/csp.ts:535` - Send to monitoring service

**Features to Implement**:
- Plausible or Fathom analytics integration
- Sentry error tracking
- CSP violation monitoring dashboard
- Performance metrics tracking
- User behavior analytics (privacy-respecting)

**Related Documentation**: None yet

---

### 4. Advanced Caching System

**Status**: 🔴 Not Started
**Effort**: ~15-20 hours
**Dependencies**: None (in-memory to start, Redis later)

**Description**: Sophisticated caching layer with TTL, tags, and invalidation strategies.

**TODO Locations**:
- `src/lib/cache/CacheHelper.ts:40` - Custom TTL and tags
- `src/lib/profiles/profile-aggregator-service.ts:194` - Cache invalidation

**Features to Implement**:
- Cache entry TTL (time-to-live)
- Cache tags for grouped invalidation
- Cache invalidation strategies (manual, event-based, time-based)
- Cache statistics and monitoring
- Redis integration for distributed caching

**Related Documentation**: None yet

---

## 🎨 User Experience Enhancements

### 5. Secure Syntax Highlighting

**Status**: 🔴 Not Started
**Effort**: ~10-15 hours
**Dependencies**: Research secure alternatives (Prism, Shiki)

**Description**: Add syntax highlighting for code blocks in markdown content without XSS risks.

**TODO Locations**:
- `src/components/ui/HybridMarkdownRenderer.tsx:9` - Implement secure alternative

**Features to Implement**:
- Research and select secure library (Shiki recommended)
- Implement syntax highlighting for common languages
- Support for inline code and code blocks
- Copy button for code blocks
- Line numbers for long code samples

**Security Considerations**: Must sanitize all inputs, use allowlist for languages, avoid `eval()` or `dangerouslySetInnerHTML`

**Related Documentation**: None yet

---

### 6. Gallery Album Management

**Status**: 🟡 Partially Complete
**Effort**: ~5-8 hours
**Dependencies**: Gallery system (exists)

**Description**: Enhance album creation to handle remaining images after initial album.

**TODO Locations**:
- `src/components/references/MasonryGrid.tsx:194` - Add remaining images

**Features to Implement**:
- Multi-select image addition to existing albums
- Drag-and-drop images to albums
- Auto-create albums from selection
- Album ordering and sorting

**Related Documentation**: `docs/features/ALBUMS_FEATURE_DOCUMENTATION.md`

---

### 7. Profile Favorites System

**Status**: 🔴 Not Started (legacy placeholder)
**Effort**: ~20-30 hours
**Dependencies**: None

**Description**: Allow users to favorite content (topics, wiki pages, documents).

**TODO Locations**:
- `src/app/profile/[slug]/page.tsx:94` - Get favorites

**Features to Implement**:
- Favorite topics, wiki pages, library documents
- Favorites list on profile page
- Favorite count badges
- Quick access to favorites
- Favorite search and filtering

**Related Documentation**: None yet

---

## 📺 Media & Streaming

### 8. H.264 Video Streaming

**Status**: 🔴 Not Started
**Effort**: ~40-60 hours
**Dependencies**: ffmpeg, codec licenses, hardware acceleration

**Description**: Production-ready H.264 video streaming for Godot project videos.

**TODO Locations**:
- `src/components/godot/StreamingVideoPlayer.tsx:22` - Production H.264 support
- `src/components/godot/StreamingVideoPlayer.tsx:93` - Implement H.264 decoding

**Features to Implement**:
- H.264 codec integration (ffmpeg)
- Hardware acceleration (GPU decoding)
- Adaptive bitrate streaming
- Video quality selection (360p, 720p, 1080p)
- Thumbnail generation
- Video seek optimization

**Technical Notes**:
- Current: WebM/VP9 (open source, but larger files)
- Target: H.264/MP4 (better compression, wider support)
- Licensing considerations for codec usage

**Related Documentation**: `docs/features/godot/GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md`

---

### 9. Godot GL Context

**Status**: 🔴 Not Started
**Effort**: ~15-25 hours
**Dependencies**: `gl` npm package, headless GL context

**Description**: Proper GL context initialization for Godot rendering in Node.js.

**TODO Locations**:
- `src/app/api/godot/versions/[id]/stream/route.ts:147` - Initialize GL context

**Features to Implement**:
- Headless GL context for server-side Godot rendering
- WebGL compatibility layer
- Offscreen rendering to texture
- Frame capture for streaming

**Related Documentation**: `docs/features/godot/`

---

## 📚 Wiki & Content

### 10. Wiki Advanced Permissions

**Status**: 🔴 Not Started
**Effort**: ~20-30 hours
**Dependencies**: Permission system redesign

**Description**: Granular permission system for wiki pages (edit, move, delete, admin).

**TODO Locations**:
- `src/app/api/wiki/pages/[slug]/revisions/restore/route.ts:64` - Granular permissions

**Features to Implement**:
- Page-level permissions (view, edit, move, delete)
- Category-level permissions
- User role permissions (viewer, editor, moderator, admin)
- Permission inheritance
- Permission groups

**Related Documentation**: `docs/wiki/`

---

### 11. Wiki Category Management

**Status**: 🟡 Partially Complete (disabled)
**Effort**: ~10-15 hours
**Dependencies**: Database verification (PostgreSQL)

**Description**: Re-enable wiki category features after PostgreSQL migration verification.

**TODO Locations**:
- `src/lib/wiki/services/WikiCategoryService.ts:272` - Re-enable after verification
- `src/lib/wiki/services/WikiCategoryService.ts:328` - Re-enable after verification

**Status**: Features exist but disabled pending database testing in production.

**Action Required**: Test on production PostgreSQL, re-enable if working correctly.

**Related Documentation**: `docs/wiki/`

---

## 📊 Implementation Priority Matrix

| Feature | Priority | Effort | Impact | Status |
|---------|----------|--------|--------|--------|
| Reputation System | HIGH | 80-120h | HIGH | 🔴 Not Started |
| Donations/Payments | HIGH | 40-60h | MEDIUM | 🟡 In Progress |
| H.264 Streaming | MEDIUM | 40-60h | MEDIUM | 🔴 Not Started |
| Analytics Integration | MEDIUM | 20-30h | MEDIUM | 🔴 Not Started |
| Wiki Permissions | MEDIUM | 20-30h | LOW | 🔴 Not Started |
| Profile Favorites | MEDIUM | 20-30h | LOW | 🔴 Not Started |
| Caching System | LOW | 15-20h | MEDIUM | 🔴 Not Started |
| Godot GL Context | LOW | 15-25h | LOW | 🔴 Not Started |
| Syntax Highlighting | LOW | 10-15h | LOW | 🔴 Not Started |
| Wiki Categories | LOW | 10-15h | LOW | 🟡 Disabled |
| Album Management | LOW | 5-8h | LOW | 🟡 Partial |

---

## 🗺️ Feature Roadmap

### Phase 1: Core Engagement (Q1-Q2 2026)
- ✅ Reputation System (HIGH priority)
- ✅ Donations/Payments completion (HIGH priority)
- Analytics Integration

### Phase 2: Content Enhancement (Q2-Q3 2026)
- H.264 Video Streaming
- Wiki Advanced Permissions
- Syntax Highlighting
- Profile Favorites

### Phase 3: Infrastructure (Q3-Q4 2026)
- Advanced Caching System
- Godot GL Context
- Wiki Category Re-enable
- Album Management Polish

---

## 📋 TODO Comment Removal Policy

**When to Remove TODOs**:
1. ✅ Feature is fully implemented and tested
2. ✅ Feature is documented (if complex)
3. ✅ Code has been reviewed
4. ✅ Changes are deployed to production

**When to Update TODOs**:
- Feature work has started (add WIP note)
- Dependencies change
- Priority changes
- Design decisions made

**Tracking**:
- All 25 TODOs tracked in this document
- Create GitHub issues for high-priority items
- Link issues to this roadmap document

---

## 📝 Related Documentation

- [CRITICAL_PATTERNS.md](./architecture/CRITICAL_PATTERNS.md) - Required patterns for implementation
- [COMMON_PITFALLS.md](./COMMON_PITFALLS.md) - Mistakes to avoid
- [DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md](./features/DONATIONS_PHASE_2_IMPLEMENTATION_PLAN.md) - Donation system plan
- [WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md](./features/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md) - Workspace features

---

**Last Reviewed**: February 10, 2026
**Next Review**: March 1, 2026
