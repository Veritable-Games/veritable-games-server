# Profile System Overview

**Last Updated**: February 15, 2026
**Status**: Post-Phase 1 Cleanup - Functional with planned enhancements

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Functional Features](#functional-features)
3. [Removed Features](#removed-features)
4. [Unused Infrastructure](#unused-infrastructure)
5. [Planned Features](#planned-features)
6. [Critical File Reference](#critical-file-reference)
7. [Migration History](#migration-history)

---

## System Architecture

### Overview

The profile system uses a sophisticated aggregation architecture that coordinates data from multiple service domains while maintaining proper separation of concerns and comprehensive error handling.

### Core Components

**ProfileAggregatorService**
- **Purpose**: Coordinates cross-schema data aggregation
- **Pattern**: Service adapter pattern with dependency injection
- **Features**: Circuit breaker, caching, privacy filtering, error handling
- **File**: `frontend/src/lib/profiles/profile-aggregator-service.ts` (642 lines)

**ProfileService (Legacy)**
- **Purpose**: Legacy profile service for backward compatibility
- **Status**: Being phased out in favor of ProfileAggregatorService
- **File**: `frontend/src/lib/profiles/service.ts` (1300+ lines)

**Service Adapters**
- **ProfileServiceAdapter**: Core user profile data
- **ForumServiceAdapter**: Forum activity statistics
- **WikiServiceAdapter**: Wiki contribution statistics
- **MessageServiceAdapter**: Messaging statistics (currently minimal)
- **File**: `frontend/src/lib/profiles/service-adapters.ts`

### Database Schemas

The profile system interacts with 4 separate PostgreSQL schemas:

1. **`users` schema**: User profiles, privacy settings, badges, activities
2. **`forums` schema**: Forum topics, replies, solutions, voting (planned)
3. **`wiki` schema**: Wiki pages, revisions, contributions
4. **`messaging` schema**: Private messages, conversations

**Critical**: NO cross-database JOINs. ProfileAggregatorService coordinates across schemas via service adapters.

### Type System

**Branded Types** for domain safety:
- `UserId`, `TopicId`, `ReplyId`, `WikiPageId`, `WikiRevisionId`
- `ConversationId`, `MessageId`

**Core Interfaces**:
- `CoreUserProfile`: Base user profile data
- `UserStatsSummary`: Aggregated statistics
- `UserActivitySummary`: Recent activity feed
- `UserPrivacySettings`: Privacy configuration (10 fields)

**File**: `frontend/src/types/profile-aggregation.ts` (642 lines)

---

## Functional Features

### ✅ Badge System
**Status**: Fully working, production-ready

**Features**:
- Three badge types: Supporter, Achievement, Special
- Auto-granting for donations (Pioneer $5+, Navigator $25+, Voyager $100+, Commander $500+, Admiral $1000+)
- Display preferences (shown/hidden on profile)
- Badge CRUD operations for admins

**Files**:
- Service: `frontend/src/lib/badges/service.ts` (495 lines)
- API: `frontend/src/app/api/admin/badges/route.ts`
- API: `frontend/src/app/api/users/[id]/badges/route.ts`
- Component: `frontend/src/components/profiles/BadgeGrantManager.tsx`

**Database Tables**:
- `badges`: Badge definitions
- `user_badges`: Badge assignments with display preferences

### ✅ Privacy Settings
**Status**: Fully working, 10 granular controls

**Settings**:
1. `profile_visibility`: public | members | private
2. `activity_visibility`: public | members | private
3. `email_visibility`: public | members | admin | private
4. `show_online_status`: boolean
5. `show_last_active`: boolean
6. `allow_messages`: boolean
7. `show_reputation_details`: boolean
8. `show_forum_activity`: boolean
9. `show_wiki_activity`: boolean
10. `show_messaging_activity`: boolean

**Files**:
- API: `frontend/src/app/api/users/[id]/privacy/route.ts`
- Component: `frontend/src/components/settings/PrivacySettingsForm.tsx`
- Service: Privacy methods in `frontend/src/lib/profiles/service.ts`

**Database Table**: `user_privacy_settings`

### ✅ Solutions System
**Status**: Fully working but NOT connected to reputation

**Features**:
- Mark forum replies as solutions
- Unmark solutions
- Display solution status on forum topics

**Gap**: Solutions do NOT award reputation points (see [Planned Features](#planned-features))

**Files**:
- API: `frontend/src/app/api/forums/replies/[id]/solution/route.ts:94-102` (POST)
- API: `frontend/src/app/api/forums/replies/[id]/solution/route.ts:181-192` (DELETE)
- Component: Solution marking UI in forum components

**Database**: `forum_replies.is_solution` field, `forum_topics.solution_reply_id` field

### ✅ Wiki Contributions Tracking
**Status**: Fully working, displayed on profiles

**Features**:
- Tracks wiki page creations
- Tracks wiki edits
- Displays contribution count on profile

**Files**:
- Component: `frontend/src/components/profiles/WikiContributions.tsx`
- Service: WikiServiceAdapter in service-adapters.ts

**Database**: `wiki_pages`, `wiki_revisions` tables

### ✅ Forum Contributions Tracking
**Status**: Partially working, needs completion

**Features**:
- Tracks forum topics created
- Tracks forum replies posted
- Displays contribution count on profile

**Issues**: Activity tracking integration incomplete

**Files**:
- Component: `frontend/src/components/profiles/ForumContributions.tsx`
- Service: ForumServiceAdapter in service-adapters.ts

**Database**: `forum_topics`, `forum_replies` tables

---

## Removed Features

### ❌ Favorites System
**Status**: Completely removed (Phase 1 cleanup, Feb 2026)

**Reason**: System was purged due to feature overload, planned for future rebuild

**Removed**:
- Component: `ProfileFavorites.tsx` (216 lines) - DELETED
- API: `/api/users/[id]/favorites` (182 lines) - DELETED
- Service: `getUserFavorites()`, `addToFavorites()`, `removeFromFavorites()` - DELETED
- Type: `UserFavorite` interface - DELETED

**Database Migration**:
- Migration 023 (Feb 2026): `DROP TABLE user_favorites CASCADE`
- **CRITICAL**: Migration must be applied to production BEFORE deploying removal

**Future**: See `docs/features/profiles/research/FAVORITES_REBUILD_PLAN.md` for rebuild design

**Commits**:
- Removal: Feb 15, 2026 (Phase 1 cleanup)
- Original purge: Earlier (see git blame)

### ❌ Messaging Activity Component
**Status**: Removed (Phase 1 cleanup, Feb 2026)

**Reason**: User explicitly requested "messaging activity needs to be stripped"

**Removed**:
- Component: `MessagingActivity.tsx` (123 lines) - DELETED

**Retained**:
- Privacy setting: `show_messaging_activity` (harmless, kept for compatibility)
- Messaging stats: Still tracked in MessageServiceAdapter (not displayed)

**Commits**:
- Removal: Feb 15, 2026 (Phase 1 cleanup)

### ❌ Duplicate User Endpoint
**Status**: Removed (Phase 1 cleanup, Feb 2026)

**Reason**: Dead code, never used, superseded by main endpoint

**Removed**:
- Endpoint: `/api/users/profile/[id]` (212 lines) - DELETED
- Directory: `frontend/src/app/api/users/profile/` - DELETED

**Kept**:
- Main endpoint: `/api/users/[id]` (fully functional, widely used)

**Analysis**: See `/home/user/.claude/findings/duplicate-user-endpoint-analysis.md`

**Commits**:
- Removal: Feb 15, 2026 (Phase 1 cleanup)

---

## Unused Infrastructure

### Reputation Breakdown (Fake Estimates)
**Status**: ⚠️ Working but using hardcoded estimates

**Current Implementation** (`frontend/src/lib/profiles/service.ts:960-1002`):
```typescript
// CURRENT - HARDCODED ESTIMATES
const reputation = Number(user?.reputation || 0);
const forumPostsRep = Math.floor(reputation * 0.6);  // 60% forum
const wikiEditsRep = Math.floor(reputation * 0.3);   // 30% wiki

breakdown: {
  forum_posts: Number(forumPostsRep),
  wiki_edits: Number(wikiEditsRep),
  helpful_votes: 0,  // TODO: Implement voting
  solutions: 0,      // TODO: Implement solution rep
}
```

**Issue**: Reputation breakdown is reverse-engineered from total, not actually tracked

**Plan**: See Phase 3 in planning document for full ReputationService implementation

### Extended Profile Fields (Unused)
**Status**: ⚠️ Database table exists with 7 unused fields

**Database Table**: `user_profiles`

**Unused Fields**:
- `headline` - Profile tagline (max 100 chars)
- `interests` - Comma-separated tags
- `skills` - Structured skill system with proficiency levels
- `languages` - Spoken languages with proficiency
- `timezone` - Standard timezone picker
- `theme_preference` - Curated theme options (NO custom CSS)
- `notification_preferences` - Separate system exists, field redundant

**Status**: Database ready, zero implementation

**Plan**: See Phase 5 in planning document for implementation priority

### Activity Summary Cache
**Status**: ⚠️ Table exists but completely unused

**Database Table**: `user_activity_summary_cache`

**Issue**: Intended for performance optimization, never implemented

**Recommendation**: Drop table in future cleanup or implement caching strategy

### Friends/Following System
**Status**: ⚠️ Privacy field exists but no implementation

**Privacy Field**: `allow_friend_requests` (boolean in user_privacy_settings)

**Status**: Field exists, completely unused, no friends table, no features

**Blockers**:
1. WebSocket infrastructure not deployed
2. No multiplayer games exist yet
3. Estimated 104-148 hours implementation

**Decision**: Deferred until Q4 2026 when multiplayer infrastructure ready

**Plan**: See `docs/features/profiles/research/FRIENDS_SYSTEM_RESEARCH.md`

### Voting System
**Status**: ⚠️ TODO comments everywhere but no implementation

**Evidence**:
- `frontend/src/lib/profiles/service.ts`: `helpful_votes: 0, // TODO: Implement voting`
- No `forum_votes` table exists
- No voting API endpoints exist
- No voting UI exists

**Plan**: See Phase 3 for forum voting implementation

---

## Planned Features

### Phase 3: Reputation & Gamification (Weeks 5-8)

**Quick Win** (2 weeks):
- Connect solutions to reputation (+25 points for solution marked)
- Create `ReputationService.awardPoints()` method
- Update `reputation_breakdown.solutions` field

**Full System**:
- `reputation_changes` table to track all point changes
- `forum_votes` table for upvote/downvote system
- Vote API endpoints
- Anti-gaming measures (rate limiting, self-vote prevention, pattern detection)

**Point Values** (proposed):
- Solution marked: +25
- Upvote received: +3
- Downvote received: -2
- Wiki page created: +50
- Wiki page edited: +10
- Mod uploaded: +100 (future)

**Achievement Badges**:
- Forum: "First Post", "Helper" (10 solutions), "Problem Solver" (50 solutions), "Conversation Starter" (100 topics)
- Wiki: "Archivist", "Contributor" (25 edits), "Chronicler" (100 edits), "Loremaster" (500 edits)
- Library: "Curious Reader", "Bookworm", "Scholar" (future)
- Modding: "Modder", "Prolific Modder", "Community Favorite" (future)

**Social Metrics** (private tracking):
- Private messages sent (+1 point each)
- Conversations participated (+2 points)
- Help requests answered (+5 points)
- **Privacy**: Contributes to total reputation, NEVER shown in breakdown

### Phase 4: Library Reading Progress (Weeks 9-12)

**System Name**: "Library Journey" (recommended) or "Reading History"

**Features**:
1. Reading session tracking (start/end times)
2. Progress tracking (% complete per document)
3. Reading goals and challenges
4. Reading streaks
5. Bookmarks and annotations
6. Achievement badges

**Database Tables** (new):
- `library_reading_sessions`
- `library_reading_progress`
- `library_reading_goals`
- `library_reading_streaks`
- `library_bookmarks`

**Privacy Controls** (new):
- `show_library_activity`
- `show_reading_goals`
- `show_reading_streaks`
- `show_completed_documents`

**Gamification**:
- Reading challenges ("30-Day Reading Challenge", "Documentary Marathon", "Deep Dive")
- Streak bonuses (7-day: +10 rep, 30-day: +50 rep, 100-day: +200 rep + badge)
- Progress visualization (bars, statistics, graphs)

**Plan**: See `docs/features/profiles/research/LIBRARY_READING_PROGRESS.md`

### Phase 5: Extended Profile Fields (Weeks 13-14)

**Priority Order**:

**Tier 1** (Week 13 - Quick Wins):
1. **Headline** (1 day) - Profile tagline, max 100 chars
2. **Interests** (2 days) - Tag pills, searchable/filterable

**Tier 2** (Week 13 - Utility):
3. **Timezone** (1 day) - Helps with collaboration

**Tier 3** (Week 14 - Advanced):
4. **Skills** (2 days) - Proficiency levels (Beginner, Intermediate, Expert)
5. **Languages** (1 day) - Spoken languages with proficiency

**Tier 4** (Deferred - Security Review):
6. **Theme Preferences** (future) - NO custom CSS, curated options only

**Plan**: See `docs/features/profiles/research/EXTENDED_PROFILE_FIELDS.md`

### Phase 6: Friends/Following System (Deferred)

**Status**: Deferred until Q4 2026 (multiplayer infrastructure ready)

**Prerequisites**:
- WebSocket server deployed
- Multiplayer game infrastructure
- Presence tracking system
- Notification system expansion

**Pattern**: Mutual friends model (Steam/Discord style)

**Plan**: See `docs/features/profiles/research/FRIENDS_SYSTEM_RESEARCH.md`

### Phase 7: Favorites Rebuild (Future)

**Status**: Research complete, deferred to future

**Scope**: Comprehensive bookmark system for wiki, forum posts, library documents

**Plan**: See `docs/features/profiles/research/FAVORITES_REBUILD_PLAN.md`

---

## Critical File Reference

### Core Services

**ProfileAggregatorService** (modern approach)
- `frontend/src/lib/profiles/profile-aggregator-service.ts` (642 lines)
- `frontend/src/lib/profiles/aggregator-service.ts`
- `frontend/src/lib/profiles/aggregator-factory.ts`

**ProfileService** (legacy)
- `frontend/src/lib/profiles/service.ts` (1300+ lines)
- Contains legacy methods, being phased out
- Line 960-1002: Fake reputation breakdown
- Line 433-619: Removed favorites methods (Phase 1 cleanup)

**Service Adapters**
- `frontend/src/lib/profiles/service-adapters.ts`
- Wraps existing services with unified interfaces

**Error Handling**
- `frontend/src/lib/profiles/error-handling.ts`
- Circuit breaker, retry logic, error classification

**Types**
- `frontend/src/types/profile-aggregation.ts` (642 lines)
- Comprehensive type system with branded types

### Components

**Working**:
- `frontend/src/components/profiles/ProfileHeader.tsx` - Main profile header
- `frontend/src/components/profiles/WikiContributions.tsx` - Wiki stats
- `frontend/src/components/profiles/ForumContributions.tsx` - Forum stats (partial)
- `frontend/src/components/profiles/SocialLinks.tsx` - Social media links
- `frontend/src/components/profiles/BadgeGrantManager.tsx` - Badge management UI

**Removed** (Phase 1 cleanup):
- ~~`ProfileFavorites.tsx`~~ (216 lines) - DELETED
- ~~`MessagingActivity.tsx`~~ (123 lines) - DELETED

**Unused** (evaluate for removal):
- `frontend/src/components/profiles/ActivityStats.tsx` - Not imported anywhere

### API Routes

**User Profile**:
- `frontend/src/app/api/users/[id]/route.ts` - Main user profile endpoint (GET/PUT)
- ~~`/api/users/profile/[id]`~~ (212 lines) - DELETED (Phase 1 cleanup)

**Privacy**:
- `frontend/src/app/api/users/[id]/privacy/route.ts` - Privacy settings (GET/PUT)

**Badges**:
- `frontend/src/app/api/admin/badges/route.ts` - Badge management
- `frontend/src/app/api/users/[id]/badges/route.ts` - User badges (GET/POST)
- `frontend/src/app/api/users/[id]/badges/[badgeId]/route.ts` - Badge operations (DELETE/PATCH)

**Favorites** (removed):
- ~~`/api/users/[id]/favorites`~~ (182 lines) - DELETED (Phase 1 cleanup)

**Solutions** (needs reputation integration):
- `frontend/src/app/api/forums/replies/[id]/solution/route.ts:94-102` - Mark solution (POST)
- `frontend/src/app/api/forums/replies/[id]/solution/route.ts:181-192` - Unmark solution (DELETE)

### Settings Forms

**Working**:
- `frontend/src/components/settings/PrivacySettingsForm.tsx` - Privacy controls
- `frontend/src/components/settings/ProfileSettingsForm.tsx` - Profile editing
- `frontend/src/components/settings/AccountSettingsForm.tsx` - Account settings
- `frontend/src/components/settings/SecuritySettingsForm.tsx` - Security settings

### Database

**Schema Documentation**:
- `frontend/scripts/seeds/schemas/users.sql` - Users schema definition

**Critical Tables**:
- `users` - Core user data
- `user_profiles` - Extended profile fields (7 unused)
- `user_privacy_settings` - Privacy configuration (10 fields)
- `badges` - Badge definitions
- `user_badges` - Badge assignments
- ~~`user_favorites`~~ - DROPPED (Migration 023, Feb 2026)
- `user_activity_summary_cache` - UNUSED (consider dropping)

**Migration Files**:
- `scripts/migrations/023-drop-user-favorites-table.sql` - Favorites removal (Feb 2026)

---

## Migration History

### February 2026: Phase 1 Cleanup

**Migration 023**: Drop user_favorites table
```sql
DROP TABLE IF EXISTS user_favorites CASCADE;
```

**Code Removals**:
- Favorites infrastructure (~450 lines)
- MessagingActivity component (123 lines)
- Duplicate user endpoint (212 lines)

**Total Impact**: ~785 lines of dead code removed, 1 database table dropped

**Files Modified**: 6 files
**Files Deleted**: 3 files
**Commits**: Phase 1 cleanup (Feb 15, 2026)

### Earlier History

**Supporter Badge Auto-Granting**: Connected donation system to badge auto-granting
**Privacy Settings**: Expanded from 3 to 10 fields
**PostgreSQL Migration** (Phase 9): Converted from SQLite to PostgreSQL
**Profile Aggregator Architecture**: Introduced service adapter pattern

---

## Development Guidelines

### When Working on Profiles

1. **Use ProfileAggregatorService** for new features (not legacy ProfileService)
2. **Never cross-database JOIN** - use service adapters for cross-schema data
3. **Respect privacy settings** - filter data based on viewer permissions
4. **Use branded types** - leverage UserId, TopicId, etc. for type safety
5. **Document changes** - update this file when modifying profile features

### Common Patterns

**Fetching a profile**:
```typescript
import { profileAggregatorService } from '@/lib/profiles/aggregator-factory';

const result = await profileAggregatorService.getAggregatedProfile(
  userId as UserId,
  viewerId as UserId
);

if (result.isOk()) {
  const profile = result.value;
  // Use profile data
}
```

**Updating privacy settings**:
```typescript
import { fetchJSON } from '@/lib/utils/csrf';

await fetchJSON(`/api/users/${userId}/privacy`, {
  method: 'PUT',
  body: { show_online_status: true }
});
```

**Granting a badge**:
```typescript
import { badgeService } from '@/lib/badges/service';

await badgeService.grantBadge(userId, badgeId, grantedByUserId);
```

---

## Related Documentation

- [Favorites Rebuild Plan](./research/FAVORITES_REBUILD_PLAN.md)
- [Library Reading Progress](./research/LIBRARY_READING_PROGRESS.md)
- [Reputation & Gamification](./research/REPUTATION_GAMIFICATION.md)
- [Extended Profile Fields](./research/EXTENDED_PROFILE_FIELDS.md)
- [Friends System Research](./research/FRIENDS_SYSTEM_RESEARCH.md)
- [Implementation Plan](/home/user/.claude/plans/linear-purring-cocoa.md)
- [Duplicate Endpoint Analysis](/home/user/.claude/findings/duplicate-user-endpoint-analysis.md)

---

**Status**: ✅ Functional - Post-Phase 1 Cleanup
**Next Phase**: Phase 3 - Reputation & Gamification (connect solutions to reputation)
**Long-term**: Multi-phase expansion of profile features (16-week roadmap)
