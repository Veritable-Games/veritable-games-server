# Forums Feature Reference

**Last Updated:** 2025-10-06
**Target Audience:** End users, product managers, trainers, UX designers

This document provides a complete inventory of all user-facing features in the Veritable Games forum system. Features are organized by category with status indicators.

---

## Table of Contents

1. [Core Features](#core-features)
2. [Topic Management](#topic-management)
3. [Reply System](#reply-system)
4. [User Features](#user-features)
5. [Search & Discovery](#search--discovery)
6. [Moderation & Administration](#moderation--administration)
7. [Organization & Navigation](#organization--navigation)
8. [UI/UX Features](#uiux-features)
9. [Content Features](#content-features)
10. [Performance Features](#performance-features)

---

## Feature Status Legend

- ✅ **Available** - Feature is fully implemented and working
- 🚧 **Partial** - Feature is partially implemented or has limitations
- ❌ **Not Available** - Feature is not implemented
- 🔒 **Admin Only** - Feature requires administrator permissions

---

## Core Features

### Topic Creation & Editing

| Feature | Status | Description |
|---------|--------|-------------|
| Create new topics | ✅ Available | Any authenticated user can create topics in any category |
| Edit own topics | ✅ Available | Topic authors can edit title and content of their own topics |
| Delete own topics | ✅ Available | Topic authors can delete their own topics |
| Real-time preview | ✅ Available | Markdown preview while editing topics |
| Title validation | ✅ Available | Minimum 3 characters, maximum 255 characters |
| Content validation | ✅ Available | Minimum 10 characters required |
| Content sanitization | ✅ Available | All user content is sanitized with DOMPurify |
| Draft saving | ❌ Not Available | Topics must be completed in one session |

### Reply System

| Feature | Status | Description |
|---------|--------|-------------|
| Reply to topics | ✅ Available | Any authenticated user can reply to open topics |
| Reply to replies | ✅ Available | Full nested reply support (up to 5 levels deep) |
| Edit own replies | ✅ Available | Reply authors can edit their own replies |
| Delete own replies | ✅ Available | Two-stage deletion: soft delete (1st click), hard delete (2nd click) |
| Inline reply forms | ✅ Available | Reply to any reply directly below it without scrolling |
| Real-time preview | ✅ Available | Markdown preview while composing replies |
| Instant feedback | ✅ Available | Optimistic UI updates with React 19's `useOptimistic` |
| Thread visualization | ✅ Available | Visual indentation and borders show reply hierarchy |

---

## Topic Management

### Topic Status Controls

| Feature | Status | Access Level | Description |
|---------|--------|--------------|-------------|
| Pin topics | ✅ Available | 🔒 Admin Only | Pin topics to top of category/forum |
| Unpin topics | ✅ Available | 🔒 Admin Only | Remove pin status from topics |
| Lock topics | ✅ Available | 🔒 Admin Only | Prevent new replies (existing replies remain visible) |
| Unlock topics | ✅ Available | 🔒 Admin Only | Re-enable replies on locked topics |
| Mark as solved | ✅ Available | 🔒 Admin Only | Mark entire topic as solved |
| Unmark as solved | ✅ Available | 🔒 Admin Only | Remove solved status from topic |
| Archive topics | ❌ Not Available | N/A | No archiving system currently |

### Topic Status Indicators

| Feature | Status | Description |
|---------|--------|-------------|
| Pinned badge | ✅ Available | Amber bookmark icon on pinned topics |
| Locked badge | ✅ Available | Red padlock icon on locked topics |
| Solved badge | ✅ Available | Green checkmark icon on solved topics |
| Status visibility | ✅ Available | Badges shown in topic lists and topic view |
| Visual hierarchy | ✅ Available | Pinned topics appear first, then regular topics |
| Last edited indicator | ✅ Available | Shows "(edited)" timestamp when topics are modified |

### Reply Status Features

| Feature | Status | Access Level | Description |
|---------|--------|--------------|-------------|
| Mark reply as solution | ✅ Available | Topic author or admin | Designate a specific reply as the accepted solution |
| Unmark solution | ✅ Available | Topic author or admin | Remove solution designation |
| Solution badge | ✅ Available | All users | Prominent green banner on solution replies |
| Solution visibility | ✅ Available | All users | Solution replies are visually highlighted |
| Topic auto-solve | ✅ Available | Automatic | Marking a reply as solution automatically marks topic as solved |
| Single solution | ✅ Available | Enforced | Only one reply can be marked as solution per topic |

---

## User Features

### Authentication & Permissions

| Feature | Status | Description |
|---------|--------|-------------|
| Guest viewing | ✅ Available | Anyone can view topics and replies without logging in |
| Login required for posting | ✅ Available | Must be authenticated to create topics or replies |
| Edit own content | ✅ Available | Users can edit/delete their own topics and replies |
| Admin moderation | ✅ Available | Admins can edit/delete any content and manage topic status |
| Role-based permissions | ✅ Available | Different permissions for guests, members, and admins |
| Registration required | ✅ Available | Email/password registration system |

### User Profiles & Identity

| Feature | Status | Description |
|---------|--------|-------------|
| Username display | ✅ Available | Usernames shown on all topics and replies |
| Display name support | ✅ Available | Optional display names override usernames |
| User avatars | ✅ Available | Avatar images shown next to all posts |
| Profile links | ✅ Available | Click username to view full user profile |
| Author attribution | ✅ Available | Clear author info with timestamps on all content |
| Last activity tracking | ✅ Available | Shows most recent reply timestamp on topics |

### User Interaction

| Feature | Status | Description |
|---------|--------|-------------|
| View user profile | ✅ Available | Click any username to see their profile |
| View user topics | ✅ Available | See all topics created by a user (on profile page) |
| View user replies | ✅ Available | See all replies by a user (on profile page) |
| User statistics | 🚧 Partial | Basic stats available (topic count, reply count) |
| Follow users | ❌ Not Available | No user following system |
| Private messaging | ❌ Not Available | Separate messaging system exists outside forums |

---

## Search & Discovery

### Full-Text Search (FTS5)

| Feature | Status | Description |
|---------|--------|-------------|
| Topic search | ✅ Available | Search topic titles and content using SQLite FTS5 |
| Reply search | ✅ Available | Search reply content using SQLite FTS5 |
| Combined search | ✅ Available | Search both topics and replies simultaneously |
| Relevance ranking | ✅ Available | Results sorted by BM25 relevance algorithm |
| Search snippets | ✅ Available | Contextual snippets show matching text with `<mark>` tags |
| Search performance | ✅ Available | 5-30ms query performance with 115+ indexed items |
| Fallback search | ✅ Available | Falls back to LIKE search if FTS5 unavailable |

### Search Filters & Options

| Feature | Status | Description |
|---------|--------|-------------|
| Filter by category | ✅ Available | Search within specific categories |
| Filter by user | ✅ Available | Search content by specific author |
| Filter by status | ✅ Available | Filter by open, locked, solved topics |
| Filter by tags | 🚧 Partial | Tag filtering available via API (UI incomplete) |
| Date range filter | ❌ Not Available | Cannot filter by date created/modified |
| Sort options | ✅ Available | Sort by recent, popular, oldest, reply count |

### Search Suggestions

| Feature | Status | Description |
|---------|--------|-------------|
| Autocomplete suggestions | ✅ Available | Shows matching topic titles as you type (2+ chars) |
| Suggestion limit | ✅ Available | Shows top 5 suggestions by default |
| Recent searches | ❌ Not Available | No search history tracking |
| Popular searches | ❌ Not Available | No popular search tracking |

---

## Organization & Navigation

### Category System

| Feature | Status | Description |
|---------|--------|-------------|
| Category browsing | ✅ Available | Browse topics by category |
| Category list view | ✅ Available | See all categories with stats (topic count, post count) |
| Category sections | ✅ Available | Categories grouped by section (Social Contract, Noxii Game, etc.) |
| Category descriptions | ✅ Available | Each category has descriptive text |
| Category icons | ✅ Available | Custom icons for categories |
| Category colors | ✅ Available | Color-coded categories |
| Last activity timestamp | ✅ Available | Shows most recent activity per category |
| Subcategories | ❌ Not Available | No hierarchical category structure |

### Topic Browsing & Sorting

| Feature | Status | Description |
|---------|--------|-------------|
| Browse all topics | ✅ Available | View all topics across all categories |
| Browse by category | ✅ Available | View topics within a specific category |
| Sort by recent | ✅ Available | Sort by last activity timestamp (default) |
| Sort by popular | ✅ Available | Sort by reply count + view count |
| Sort by replies | ✅ Available | Sort by number of replies |
| Sort by views | ✅ Available | Sort by view count |
| Sort by oldest | ✅ Available | Sort by creation date (oldest first) |
| Pagination | ✅ Available | Limit/offset pagination (default 20 per page) |

### Navigation Features

| Feature | Status | Description |
|---------|--------|-------------|
| Breadcrumb navigation | ✅ Available | Shows current location (Forums > Category > Topic) |
| Back to forums link | ✅ Available | Easy navigation back to main forum page |
| Category links | ✅ Available | Click category name to browse that category |
| Topic links | ✅ Available | Click topic title to view full topic |
| User profile links | ✅ Available | Click username to view profile |

---

## Moderation & Administration

### Admin Moderation Controls

| Feature | Status | Access | Description |
|---------|--------|--------|-------------|
| Moderation dropdown | ✅ Available | 🔒 Admin Only | Centralized moderation menu on every topic |
| Lock/unlock topics | ✅ Available | 🔒 Admin Only | Prevent/allow replies |
| Pin/unpin topics | ✅ Available | 🔒 Admin Only | Feature topics at top of lists |
| Mark solved/unsolved | ✅ Available | 🔒 Admin Only | Manage topic solution status |
| Delete any topic | ✅ Available | 🔒 Admin Only | Permanently delete topics (CASCADE deletes replies) |
| Delete any reply | ✅ Available | 🔒 Admin Only | Soft or hard delete any reply |
| Edit any content | ✅ Available | 🔒 Admin Only | Admins can edit any topic or reply |
| Confirmation prompts | ✅ Available | 🔒 Admin Only | All destructive actions require confirmation |

### Content Moderation

| Feature | Status | Description |
|---------|--------|-------------|
| Soft delete replies | ✅ Available | First delete hides content, shows "[Reply Removed]" |
| Hard delete replies | ✅ Available | Second delete permanently removes reply |
| Cascade deletion | ✅ Available | Deleting topic permanently deletes all replies |
| Reply reparenting | ✅ Available | Hard delete reparents child replies to grandparent |
| Content restoration | ❌ Not Available | Soft-deleted content cannot be restored via UI |
| Moderation log | ❌ Not Available | No audit trail of moderation actions |

### Spam & Abuse Prevention

| Feature | Status | Description |
|---------|--------|-------------|
| Content sanitization | ✅ Available | All HTML sanitized with DOMPurify |
| SQL injection prevention | ✅ Available | All queries use prepared statements |
| XSS prevention | ✅ Available | Content sanitization prevents XSS attacks |
| Rate limiting | ❌ Not Available | No rate limiting on post creation |
| Spam detection | ❌ Not Available | No automated spam detection |
| User reporting | ❌ Not Available | No user reporting system |
| IP blocking | ❌ Not Available | No IP-based blocking |

---

## UI/UX Features

### Optimistic UI Updates

| Feature | Status | Description |
|---------|--------|-------------|
| Instant reply posting | ✅ Available | Replies appear immediately using `useOptimistic` |
| Instant reply editing | ✅ Available | Edit updates show immediately |
| Instant solution marking | ✅ Available | Solution badge appears/disappears immediately |
| Automatic rollback | ✅ Available | Failed operations automatically revert to previous state |
| Server sync | ✅ Available | All optimistic updates sync with server via router.refresh() |
| Sub-16ms latency | ✅ Available | Zero perceived latency for user actions |

### Visual Feedback

| Feature | Status | Description |
|---------|--------|-------------|
| Loading indicators | ✅ Available | Spinner shown during async operations |
| Hover effects | ✅ Available | Visual feedback on all interactive elements |
| Button states | ✅ Available | Disabled state for invalid actions |
| Success messages | ✅ Available | Toast notifications for successful actions |
| Error messages | ✅ Available | Clear error messages for failed operations |
| Confirmation dialogs | ✅ Available | Confirm before destructive actions |

### Responsive Design

| Feature | Status | Description |
|---------|--------|-------------|
| Mobile-friendly | ✅ Available | Fully responsive layout |
| Touch-friendly | ✅ Available | Appropriate tap targets on mobile |
| Desktop optimization | ✅ Available | Multi-column layout on larger screens |
| Grid-based layout | ✅ Available | 12-column responsive grid for topic lists |
| Flexible typography | ✅ Available | Readable text across all screen sizes |

### Accessibility

| Feature | Status | Description |
|---------|--------|-------------|
| Keyboard navigation | 🚧 Partial | Basic keyboard support (needs improvement) |
| Screen reader support | 🚧 Partial | ARIA labels on some elements (incomplete) |
| Focus indicators | ✅ Available | Visible focus states on interactive elements |
| Color contrast | ✅ Available | WCAG AA compliant color contrast |
| Alt text | 🚧 Partial | Avatar images have alt text (needs audit) |

### Layout & Organization

| Feature | Status | Description |
|---------|--------|-------------|
| Compact topic rows | ✅ Available | Space-efficient topic list layout |
| Reply indentation | ✅ Available | Visual hierarchy for nested replies (5 levels max) |
| Thread borders | ✅ Available | Colored borders show reply relationships |
| Sticky headers | ❌ Not Available | Headers scroll with content |
| Collapsible threads | ❌ Not Available | Cannot collapse reply threads |
| Infinite scroll | ❌ Not Available | Uses traditional pagination |

---

## Content Features

### Markdown Support

| Feature | Status | Description |
|---------|--------|-------------|
| Basic formatting | ✅ Available | Bold, italic, strikethrough, inline code |
| Headers | ✅ Available | H1-H6 headers supported |
| Lists | ✅ Available | Ordered and unordered lists |
| Links | ✅ Available | Hyperlinks with title attributes |
| Code blocks | ✅ Available | Fenced code blocks with syntax highlighting |
| Blockquotes | ✅ Available | Quote formatting |
| Tables | ✅ Available | Markdown table support |
| Images | ✅ Available | Inline image embedding (via URL) |
| Horizontal rules | ✅ Available | HR elements supported |

### Rich Text Editing

| Feature | Status | Description |
|---------|--------|-------------|
| Hybrid Markdown editor | ✅ Available | Custom editor with toolbar and preview |
| Live preview | ✅ Available | Real-time markdown preview |
| Toolbar buttons | ✅ Available | Common formatting actions (bold, italic, etc.) |
| Keyboard shortcuts | ✅ Available | Standard markdown shortcuts |
| Syntax highlighting | ✅ Available | Code block syntax highlighting |
| Editor themes | ❌ Not Available | Single editor theme |
| WYSIWYG mode | ❌ Not Available | Markdown-only editing |

### Content Sanitization

| Feature | Status | Description |
|---------|--------|-------------|
| HTML sanitization | ✅ Available | DOMPurify sanitizes all user HTML |
| Script tag blocking | ✅ Available | All `<script>` tags removed |
| Event handler blocking | ✅ Available | All `onclick` etc. handlers removed |
| Iframe blocking | ✅ Available | Iframes not allowed |
| Safe link handling | ✅ Available | External links sanitized |
| Allowed tags config | ✅ Available | Whitelist of safe HTML tags |

### Tagging System

| Feature | Status | Description |
|---------|--------|-------------|
| Add tags to topics | ✅ Available | Tag topics with multiple tags (max 10) |
| Tag autocomplete | ✅ Available | Suggestions appear after 2 characters |
| Create new tags | 🚧 Partial | Can create tags via API (UI permission unclear) |
| Tag usage count | ✅ Available | Shows how many topics use each tag |
| Tag colors | ✅ Available | Visual tag colors (configurable) |
| Tag browsing | 🚧 Partial | API supports tag browsing (UI incomplete) |
| Tag management | 🔒 Admin Only | Tag CRUD operations restricted |
| Tag search | ✅ Available | Search suggestions based on tags |

---

## Performance Features

### Caching & Optimization

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-tier caching | ✅ Available | Reply Tree Cache + LRU Cache |
| Cache invalidation | ✅ Available | 81+ invalidation points for cache consistency |
| Reply tree caching | ✅ Available | Nested reply structures cached for fast loading |
| Search result caching | ✅ Available | FTS5 results cached (15 min TTL) |
| Category caching | ✅ Available | Category lists cached for performance |
| Database connection pool | ✅ Available | Max 50 connections, LRU eviction |
| WAL mode enabled | ✅ Available | Better concurrent read/write performance |

### Performance Metrics

| Feature | Status | Description |
|---------|--------|-------------|
| FTS5 search speed | ✅ Available | 5-30ms query performance |
| Cache hit rate | ✅ Available | High cache hit rate for nested replies |
| Optimistic UI latency | ✅ Available | <16ms perceived latency for user actions |
| Page load optimization | ✅ Available | Server-side rendering for initial load |
| Component memoization | ✅ Available | React.memo on ReplyView and CategoryRow |

### Scalability

| Feature | Status | Description |
|---------|--------|-------------|
| Indexed database | ✅ Available | FTS5 indexes + composite indexes |
| Pagination support | ✅ Available | Limit/offset for large result sets |
| Lazy loading | 🚧 Partial | Server Components reduce client bundle |
| Database sharding | ❌ Not Available | Single database per domain |
| Read replicas | ❌ Not Available | No read replica support |

---

## Statistics & Analytics

### Topic Statistics

| Feature | Status | Description |
|---------|--------|-------------|
| View count | ✅ Available | Increments on each topic view |
| Reply count | ✅ Available | Tracks total replies per topic |
| Last activity timestamp | ✅ Available | Updates when topic or reply is created/edited |
| Last reply author | ✅ Available | Shows username of most recent reply |
| Creation timestamp | ✅ Available | Shows when topic was created |

### Category Statistics

| Feature | Status | Description |
|---------|--------|-------------|
| Topic count | ✅ Available | Total topics per category |
| Post count | ✅ Available | Total posts (topics + replies) per category |
| Last activity | ✅ Available | Most recent activity timestamp |
| Active users | ❌ Not Available | No active user tracking per category |

### Forum-Wide Statistics

| Feature | Status | Description |
|---------|--------|-------------|
| Total topics | ✅ Available | Count of all topics |
| Total replies | ✅ Available | Count of all replies |
| Total users | ✅ Available | Count of registered users |
| Active today | 🚧 Partial | Calculated client-side (not real-time) |
| Recent topics | ✅ Available | Count of topics from last 7 days |
| Total views | 🚧 Partial | Aggregated from topic view counts |

---

## Known Limitations

### Current Restrictions

1. **Nesting Depth**: Reply threads limited to 5 levels to prevent excessive indentation
2. **Tag Limit**: Maximum 10 tags per topic
3. **Character Limits**:
   - Topic title: 3-255 characters
   - Topic/reply content: Minimum 10 characters
4. **No Drafts**: Topics/replies must be completed in one session
5. **Single Solution**: Only one reply can be marked as solution per topic
6. **Hard Delete**: Deleted topics cascade delete all replies (no recovery)
7. **No Soft Delete UI**: Soft-deleted content cannot be restored via UI

### Features Not Implemented

1. **Notifications**: No push notifications for replies or mentions
2. **Mentions**: No @username mention system (service exists but unused)
3. **Reactions**: No emoji reactions or upvotes/downvotes
4. **Bookmarks**: Cannot save/bookmark topics
5. **Subscriptions**: Cannot subscribe to topics or categories
6. **User Blocking**: Cannot block other users
7. **Private Messages**: Separate system (not integrated with forums)
8. **Attachments**: Cannot upload files or images to posts
9. **Polls**: No poll creation feature
10. **Topic Templates**: No templates for common topic types

---

## Technical Capabilities (User-Visible)

### Real-Time Features

| Feature | Status | Description |
|---------|--------|-------------|
| Optimistic updates | ✅ Available | Instant UI feedback on all mutations |
| Server synchronization | ✅ Available | All changes sync with server immediately |
| Auto-refresh | 🚧 Partial | Uses router.refresh() (requires manual refresh) |
| Live updates | ❌ Not Available | No WebSocket or SSE for live updates |

### Data Persistence

| Feature | Status | Description |
|---------|--------|-------------|
| SQLite storage | ✅ Available | All data stored in forums.db |
| Transaction safety | ✅ Available | ACID-compliant database transactions |
| Foreign key constraints | ✅ Available | Data integrity enforced at DB level |
| Automatic timestamps | ✅ Available | created_at and updated_at tracked automatically |

### Security Features (User-Visible)

| Feature | Status | Description |
|---------|--------|-------------|
| HTTPS enforced | ✅ Available | All traffic encrypted (production) |
| Session-based auth | ✅ Available | Server-side sessions in SQLite |
| Password hashing | ✅ Available | bcrypt with 12 salt rounds |
| Content sanitization | ✅ Available | XSS prevention via DOMPurify |
| SQL injection prevention | ✅ Available | Prepared statements only |
| CSRF protection | ❌ Not Available | CSRF middleware removed (Oct 2025) |

---

## Comparison with Other Forum Systems

### Feature Parity

| Feature | Veritable Games | Discourse | phpBB | Reddit |
|---------|----------------|-----------|-------|--------|
| Nested replies | ✅ (5 levels) | ✅ (Unlimited) | ❌ | ✅ (10 levels) |
| Optimistic UI | ✅ | ❌ | ❌ | ✅ |
| FTS5 search | ✅ | ✅ | 🚧 | ✅ |
| Markdown support | ✅ | ✅ | 🚧 | ✅ |
| User reactions | ❌ | ✅ | ✅ | ✅ |
| Notifications | ❌ | ✅ | ✅ | ✅ |
| Private messages | 🚧 (Separate) | ✅ | ✅ | ✅ |
| Mobile app | ❌ | ✅ | 🚧 | ✅ |
| Polls | ❌ | ✅ | ✅ | ✅ |
| Attachments | ❌ | ✅ | ✅ | ✅ |

---

## Roadmap Suggestions

Based on this feature inventory, here are potential future enhancements:

### High Priority
1. User notifications for replies and mentions
2. Topic subscriptions and email alerts
3. File/image upload support
4. User reputation/karma system
5. Topic bookmarking/favorites

### Medium Priority
6. Poll creation and voting
7. User @mentions with autocomplete
8. Emoji reactions to posts
9. Infinite scroll for topics
10. Advanced search filters (date range, etc.)

### Low Priority
11. Topic templates
12. Private sub-forums
13. User badges and achievements
14. Forum themes/customization
15. API rate limiting

---

## Getting Help

### For End Users
- **Forum Home**: Visit `/forums` to browse all categories
- **Search**: Use the search box at the top of any forum page
- **Help Topics**: Look for pinned topics in the "Social Contract" category

### For Administrators
- **Moderation**: Click "Moderate" button on any topic (admin only)
- **Category Management**: Contact system administrator
- **Technical Issues**: See `docs/FORUMS.md` for technical documentation

### For Developers
- **Architecture**: See `docs/FORUMS.md` for service layer details
- **API Documentation**: Review `/app/api/forums/**/*.ts` files
- **Type System**: See `/lib/forums/types.ts` for TypeScript types

---

## Changelog

### Version 1.0 (October 2025)
- Initial feature inventory completed
- 5 specialized services implemented
- 18 UI components (~4,208 LOC)
- FTS5 search with 115+ indexed items
- Optimistic UI with React 19
- Multi-tier caching with 81+ invalidation points

---

**Document Version:** 1.0
**Total Features Documented:** 150+
**Last Review Date:** 2025-10-06
