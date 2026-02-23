# Frontend API Contract (Immutable)

**Last Updated**: 2025-10-08
**Purpose**: This document defines the EXACT API contract that the forums frontend depends on. The UI/UX must remain unchanged, so this contract is IMMUTABLE for any backend migration.

---

## Table of Contents

1. [Authentication Contract](#authentication-contract)
2. [Topic Endpoints](#topic-endpoints)
3. [Reply Endpoints](#reply-endpoints)
4. [Category Endpoints](#category-endpoints)
5. [Search Endpoints](#search-endpoints)
6. [Moderation Endpoints](#moderation-endpoints)
7. [Stats Endpoints](#stats-endpoints)
8. [Data Models](#data-models)
9. [Error Handling](#error-handling)
10. [Critical Frontend Behaviors](#critical-frontend-behaviors)

---

## Authentication Contract

### Session Management
- **Cookie Name**: `session_id` (development) or `__Secure-session_id` (production)
- **Cookie Attributes**:
  - `httpOnly: true`
  - `secure: true` (HTTPS required)
  - `sameSite: 'strict'`
  - `maxAge: 2592000` (30 days)
  - `path: /`

### Authentication Check
Frontend checks authentication via `getCurrentUser()` which:
1. Reads session cookie from request
2. Validates session in auth.db
3. Returns `User | null`

### User Object Structure
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  role: 'admin' | 'moderator' | 'user';
  // Additional fields from users table
}
```

### Authentication Headers
All authenticated requests MUST include:
```
credentials: 'include'  // Ensures cookies are sent
```

---

## Topic Endpoints

### 1. GET /api/forums/topics
**Purpose**: List topics with filters
**Authentication**: Optional (public read)

**Query Parameters** (all optional):
```typescript
{
  query?: string;           // Search term (min 2 chars)
  category_id?: string;     // Category ID or slug
  category_slug?: string;   // Category slug filter
  user_id?: number;         // Filter by author
  status?: 'open' | 'closed' | 'locked';
  limit?: number;           // Default: 20, Max: 100
  offset?: number;          // Default: 0
  sort?: 'recent' | 'popular' | 'oldest' | 'replies'; // Default: 'recent'
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    topics: ForumTopic[]
  }
}
```

**Error Response (400)**:
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: string,
    details?: { field: string, message: string }[]
  }
}
```

### 2. POST /api/forums/topics
**Purpose**: Create a new topic
**Authentication**: Required

**Request Body**:
```typescript
{
  category_id: number | string;  // Category ID or slug
  title: string;                 // Min: 3, Max: 200 chars
  content: string;               // Min: 10, Max: 50000 chars
  status?: 'open' | 'closed' | 'locked';  // Default: 'open'
  is_pinned?: boolean;           // Default: false
  tags?: number[];               // Max 10 tag IDs
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    topic: ForumTopic
  }
}
```

**Error Responses**:
- `401`: Authentication required
- `400`: Validation error (see error format below)

### 3. GET /api/forums/topics/[id]
**Purpose**: Get specific topic with replies
**Authentication**: Optional (public read)

**Path Parameters**:
- `id`: Topic ID (integer)

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    topic: ForumTopic,
    replies: ForumReply[]  // Nested structure preserved
  }
}
```

**Error Responses**:
- `400`: Invalid topic ID
- `404`: Topic not found

### 4. PATCH /api/forums/topics/[id]
**Purpose**: Update topic title/content
**Authentication**: Required (author or admin)

**Path Parameters**:
- `id`: Topic ID (integer)

**Request Body** (at least one field required):
```typescript
{
  title?: string;        // Min: 3, Max: 200 chars
  content?: string;      // Min: 10, Max: 50000 chars
  status?: 'open' | 'closed' | 'locked';
  is_pinned?: boolean;
  is_solved?: boolean;
  tags?: number[];       // Max 10 tag IDs
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    topic: ForumTopic
  }
}
```

**Critical Behavior**:
- If `is_solved`, `status`, or `is_pinned` changes, server calls `revalidatePath()` for:
  - `/forums/topic/${id}`
  - `/forums`

### 5. DELETE /api/forums/topics/[id]
**Purpose**: Delete a topic
**Authentication**: Required (author or admin)

**Path Parameters**:
- `id`: Topic ID (integer)

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    message: 'Topic deleted successfully'
  }
}
```

---

## Reply Endpoints

### 1. POST /api/forums/replies
**Purpose**: Create a new reply (including nested)
**Authentication**: Required

**Request Body**:
```typescript
{
  topic_id: number;
  content: string;       // Min: 1, Max: 50000 chars
  parent_id?: number;    // For nested replies (optional)
  is_solution?: boolean; // Default: false
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    reply: ForumReply
  }
}
```

**Error Responses**:
- `401`: Authentication required
- `400`: Validation error
- `403`: Topic is locked
- `404`: Topic not found

**Locked Topic Check**:
Frontend checks: `if (topic.status === 'locked' || topic.is_locked)`

### 2. PATCH /api/forums/replies/[id]
**Purpose**: Update reply content
**Authentication**: Required (author or admin)

**Path Parameters**:
- `id`: Reply ID (integer)

**Request Body**:
```typescript
{
  content: string;       // Min: 1, Max: 50000 chars
  is_solution?: boolean;
}
```

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    reply: ForumReply
  }
}
```

**Frontend Optimistic Update**:
- Updates `optimisticContent` state immediately
- Calls `router.refresh()` on success
- Reverts on error

### 3. DELETE /api/forums/replies/[id]
**Purpose**: Soft or hard delete reply
**Authentication**: Required (author or admin)

**Path Parameters**:
- `id`: Reply ID (integer)

**Query Parameters**:
- `permanent=true`: Hard delete (requires confirmation)

**Soft Delete Response (200)**:
```typescript
{
  success: true,
  data: {
    message: 'Reply deleted'
  }
}
```

**Hard Delete Response (200)**:
```typescript
{
  success: true,
  data: {
    message: 'Reply permanently deleted'
  }
}
```

**Frontend Behavior**:
- First delete: Soft delete (sets `is_deleted: true`)
- Second delete: Shows confirmation, then hard deletes
- Hard delete reparents child replies to parent

---

## Category Endpoints

### GET /api/forums/categories
**Purpose**: Get all forum categories
**Authentication**: Optional (public read)

**Success Response (200)**:
```typescript
{
  success: true,
  data: ForumCategory[]
}
```

**ForumCategory Structure**:
```typescript
{
  id: number | string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  section: string;
  topic_count: number;
  post_count: number;
  last_activity_at?: string;
  created_at: string;
}
```

---

## Search Endpoints

### GET /api/forums/search
**Purpose**: Search topics and replies
**Authentication**: Optional (public)

**Query Parameters**:
```typescript
{
  q?: string;            // Search query
  query?: string;        // Alternative param name
  type?: 'topic' | 'reply' | 'all';  // Default: 'all'
  category_id?: string;
  author_id?: number;
  limit?: number;        // Default: 20
  sort?: 'relevance' | 'date';  // Default: 'relevance'
  suggestions?: boolean; // If true, returns suggestions only
}
```

**Search Response (200)**:
```typescript
{
  success: true,
  results: ForumSearchResult[],
  query: string,
  total: number,
  filters: {
    type: string,
    category_id?: string,
    author_id?: number,
    sort: string
  }
}
```

**Suggestions Response (200)**:
```typescript
{
  success: true,
  suggestions: string[],
  query: string
}
```

**ForumSearchResult Structure**:
```typescript
{
  id: number;
  type: 'topic' | 'reply';
  title?: string;
  content: string;
  highlighted_content?: string;  // HTML with <mark> tags
  highlighted_title?: string;    // HTML with <mark> tags
  author_username: string;
  author_display_name?: string;
  category_name?: string;
  category_id?: number;
  created_at: string;
  topic_id?: number;  // For replies
  score: number;
}
```

**Search Highlighting**:
- Matches wrapped in: `<mark class="bg-yellow-200 dark:bg-yellow-800">term</mark>`
- Snippet max length: 300 chars
- Suggestions max: 5 results

---

## Moderation Endpoints

### 1. POST/DELETE /api/forums/topics/[id]/pin
**Purpose**: Pin/unpin topic to top
**Authentication**: Required (admin only)

**POST (Pin)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Topic pinned successfully'
  }
}
```

**DELETE (Unpin)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Topic unpinned successfully'
  }
}
```

**Error Responses**:
- `403`: Admin privileges required
- `404`: Topic not found

### 2. POST/DELETE /api/forums/topics/[id]/lock
**Purpose**: Lock/unlock topic
**Authentication**: Required (admin only)

**POST (Lock)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Topic locked successfully'
  }
}
```

**DELETE (Unlock)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Topic unlocked successfully'
  }
}
```

### 3. POST/DELETE /api/forums/replies/[id]/solution
**Purpose**: Mark/unmark reply as solution
**Authentication**: Required (topic author or admin)

**POST (Mark)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Reply marked as solution'
  }
}
```

**DELETE (Unmark)**:
```typescript
// Success Response (200)
{
  success: true,
  data: {
    message: 'Reply unmarked as solution'
  }
}
```

**Critical Behavior**:
- Only ONE solution per topic
- Marking new solution clears previous one
- Calls `revalidatePath()` on success:
  - `/forums/topic/${topic_id}`
  - `/forums`

---

## Stats Endpoints

### GET /api/forums/stats
**Purpose**: Get forum statistics
**Authentication**: Optional (public)

**Success Response (200)**:
```typescript
{
  success: true,
  data: {
    total_topics: number,
    total_replies: number,
    total_users: number,
    active_users_today: number,
    recent_topics: ForumTopic[],
    popular_categories: ForumCategory[]
  }
}
```

---

## Data Models

### ForumTopic
```typescript
{
  id: number;
  category_id: number | string;
  title: string;
  content: string;
  status: 'open' | 'solved' | 'pinned' | 'locked';
  is_pinned: boolean;
  view_count: number;
  reply_count: number;
  user_id: number;
  username?: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  last_reply_at?: string;
  last_reply_user_id?: number;
  last_reply_username?: string;

  // Category info (joined)
  category_name?: string;
  category_color?: string;
  category_slug?: string;

  // Display fields
  is_locked?: boolean;
  is_solved?: boolean;
  last_edited_at?: string;
  last_edited_by?: number;
}
```

### ForumReply
```typescript
{
  id: number;
  topic_id: number;
  content: string;
  is_solution: boolean;
  is_deleted?: boolean;
  parent_id?: number;  // For nested replies
  user_id: number;
  username?: string;
  display_name?: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  replies?: ForumReply[];  // Nested structure

  // Metadata (from DB triggers)
  conversation_id?: string;
  reply_depth?: number;  // For indentation
  thread_root_id?: number;
  participant_hash?: string;
}
```

### ForumCategory
```typescript
{
  id: number | string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  section: string;
  topic_count: number;
  post_count: number;
  last_activity_at?: string;
  created_at: string;
}
```

### ForumTag
```typescript
{
  id: number;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  usage_count: number;
  created_at: string;
}
```

---

## Error Handling

### Standard Error Response Format
```typescript
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `PERMISSION_DENIED` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Validation Error Details
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: {
      title: ['Title must be at least 3 characters'],
      content: ['Content must be at least 10 characters']
    }
  }
}
```

### Frontend Error Handling
1. **Optimistic UI**: Update UI immediately, revert on error
2. **Router Refresh**: Call `router.refresh()` on success to sync server state
3. **User Feedback**: Display error messages from `error.message`
4. **Confirmation Dialogs**: For destructive actions (delete, permanent delete)

---

## Critical Frontend Behaviors

### 1. Optimistic UI Updates

#### Reply Creation (ReplyList.tsx)
```typescript
// 1. Create optimistic reply with temporary ID
const optimisticReply = {
  id: Date.now(),
  topic_id: topicId,
  user_id: user.id,
  username: user.username,
  content: trimmedContent,
  created_at: new Date().toISOString(),
  // ... other fields
};

// 2. Update UI immediately (0ms latency)
addOptimisticReply(optimisticReply);
setNewReplyContent('');

// 3. Send API request in background
const response = await fetch('/api/forums/replies', {
  method: 'POST',
  body: JSON.stringify({ topic_id, content })
});

// 4. Sync with server (replaces optimistic with real)
if (response.ok) {
  router.refresh();
} else {
  router.refresh(); // Reverts on error
}
```

#### Reply Editing (ReplyView.tsx)
```typescript
// 1. Optimistically update content
setOptimisticContent(newContent);
setIsEditing(false);

// 2. Send PATCH request
const response = await fetch(`/api/forums/replies/${id}`, {
  method: 'PATCH',
  body: JSON.stringify({ content: newContent })
});

// 3. Sync or rollback
if (response.ok) {
  router.refresh();
} else {
  setOptimisticContent(previousContent); // Rollback
  setEditContent(previousContent);
  setIsEditing(true);
}
```

#### Solution Marking
```typescript
// 1. Optimistically toggle solution state
setOptimisticIsSolution(!optimisticIsSolution);

// 2. Send POST or DELETE based on current state
const response = await fetch(`/api/forums/replies/${id}/solution`, {
  method: previousState ? 'DELETE' : 'POST'
});

// 3. Sync or rollback
if (response.ok) {
  router.refresh(); // Updates reply.is_solution prop
} else {
  setOptimisticIsSolution(previousState); // Rollback
}
```

### 2. Nested Reply Structure

Replies MUST support recursive nesting:
```typescript
interface ForumReply {
  id: number;
  parent_id?: number;
  replies?: ForumReply[];  // Recursive children
  reply_depth?: number;    // For indentation
}
```

**Rendering**:
- Max depth: 5 levels
- Indentation classes: `ml-6`, `ml-12`, `ml-16`, `ml-20`, `ml-24`
- Border indicators: `border-l-2 border-gray-700`

### 3. Real-time Updates

**Server Component Revalidation**:
- `router.refresh()` triggers Server Component re-render
- Fetches latest data from server
- Updates optimistic state with server truth

**Paths Revalidated**:
- Topic changes: `/forums/topic/${id}` + `/forums`
- Solution changes: `/forums/topic/${topic_id}` + `/forums`

### 4. Authentication State

**Client-side Check** (via AuthContext):
```typescript
const { user } = useAuth();

// Permission checks
const canEdit = user && (user.id === topic.user_id || user.role === 'admin');
const isAdmin = user && user.role === 'admin';
const isTopicAuthor = user && user.id === topicAuthorId;
const canMarkSolution = isAdmin || isTopicAuthor;
```

**Server-side Check** (via getCurrentUser):
```typescript
const user = await getCurrentUser(request);
if (!user) {
  throw new AuthenticationError();
}
```

### 5. Locked Topic Behavior

**Frontend Checks**:
```typescript
// In POST /api/forums/replies check
if (topic.status === 'locked' || topic.is_locked) {
  throw new PermissionError('This topic is locked');
}

// In UI
{user && !isTopicLocked && (
  <button onClick={handleReply}>Reply</button>
)}

{isTopicLocked && (
  <div>Topic is locked - No new replies can be posted</div>
)}
```

### 6. Soft vs Hard Delete

**First Delete** (Soft):
- Sets `is_deleted: true`
- Preserves record in database
- Shows "[Reply Removed]" in UI
- No confirmation required

**Second Delete** (Hard):
- Requires `?permanent=true` query param
- Confirms with user: "Permanently delete? Cannot be undone"
- Removes record from database
- Reparents child replies to parent

**UI Indicators**:
```typescript
{reply.is_deleted ? (
  <button onClick={hardDelete} className="text-red-500">
    Permanently Delete
  </button>
) : (
  <button onClick={softDelete} className="text-gray-500">
    Delete
  </button>
)}
```

### 7. Solution Badge Display

**Condition**: `if (!!optimisticIsSolution)`

**Badge HTML**:
```html
<div class="bg-emerald-900/20 border-b border-emerald-700/50">
  <svg class="w-4 h-4 text-emerald-400"><!-- checkmark icon --></svg>
  <span class="text-xs font-semibold text-emerald-400 uppercase">
    Accepted Solution
  </span>
</div>
```

**Critical**: Only ONE solution per topic (backend enforces)

### 8. Search Result Highlighting

**Highlight Format**:
```html
<mark class="bg-yellow-200 dark:bg-yellow-800">searchTerm</mark>
```

**Applied To**:
- `highlighted_title` (if topic)
- `highlighted_content` (snippet)

**Snippet Logic**:
- Max length: 300 chars
- Centered around first match
- Adds "..." prefix/suffix if truncated

### 9. Session Cookie Requirements

**Critical Cookie Attributes** (MUST match):
```typescript
{
  httpOnly: true,
  secure: true,  // HTTPS required
  sameSite: 'strict',
  maxAge: 2592000,  // 30 days
  path: '/'
}
```

**Cookie Name**:
- Development: `session_id`
- Production: `__Secure-session_id`

### 10. Topic Edit Revalidation

**When these fields change**:
- `is_solved`
- `status`
- `is_pinned`

**Server MUST call**:
```typescript
revalidatePath(`/forums/topic/${topicId}`);
revalidatePath('/forums');
```

This ensures Server Components re-fetch data.

---

## Migration Checklist

When migrating to a new backend, verify:

- [ ] All 15 endpoints respond with exact response formats
- [ ] Error codes match standardized format
- [ ] Authentication uses session cookies with correct attributes
- [ ] Optimistic UI works with `router.refresh()` sync
- [ ] Nested reply structure preserved (recursive `replies` array)
- [ ] Solution marking clears previous solution
- [ ] Soft/hard delete behaves as specified
- [ ] Search returns highlighted results with `<mark>` tags
- [ ] Revalidation paths called on state changes
- [ ] All validation rules match Zod schemas
- [ ] Permission checks work for admin/author/topic-author
- [ ] Locked topics prevent new replies
- [ ] Category joins include name/color/slug
- [ ] User fetches cross database boundaries correctly
- [ ] Max nesting depth: 5 levels
- [ ] Session expiry: 30 days

---

## Appendix: Validation Schemas

### CreateTopicDTO
```typescript
{
  category_id: number | string,
  title: string (min: 3, max: 200),
  content: string (min: 10, max: 50000),
  status?: 'open' | 'closed' | 'locked' (default: 'open'),
  is_pinned?: boolean (default: false),
  tags?: number[] (max: 10)
}
```

### UpdateTopicDTO
```typescript
{
  title?: string (min: 3, max: 200),
  content?: string (min: 10, max: 50000),
  status?: 'open' | 'closed' | 'locked',
  is_pinned?: boolean,
  is_solved?: boolean,
  tags?: number[] (max: 10)
}
// At least one field required
```

### CreateReplyDTO
```typescript
{
  topic_id: number,
  content: string (min: 1, max: 50000),
  parent_id?: number,
  is_solution?: boolean (default: false)
}
```

### UpdateReplyDTO
```typescript
{
  content?: string (min: 1, max: 50000),
  is_solution?: boolean
}
// At least one field required
```

### SearchTopicsDTO
```typescript
{
  query?: string (min: 2, max: 200),
  category_id?: number | string,
  category_slug?: string,
  user_id?: number,
  status?: 'open' | 'closed' | 'locked',
  limit?: number (max: 100, default: 20),
  offset?: number (default: 0),
  sort?: 'recent' | 'popular' | 'oldest' | 'replies' (default: 'recent')
}
```

---

## Notes for Backend Implementation

1. **Database Isolation**: Frontend expects separate databases (forums.db, users.db). No cross-database JOINs. Fetch user data separately and map results.

2. **Branded Types**: TypeScript uses branded types (`TopicId`, `ReplyId`, etc.) but they're just numbers/strings at runtime.

3. **FTS5 Search**: Original uses SQLite FTS5 full-text search. New backend should provide equivalent functionality with:
   - Porter stemming
   - Stop word filtering
   - Relevance scoring
   - Snippet extraction

4. **Session Storage**: Sessions stored in auth.db, NOT JWT tokens. Validate via `session_id` cookie lookup.

5. **Security Headers**: All responses should include security headers via `withSecurity()` wrapper (CSP, X-Frame-Options, etc.).

6. **No CSRF Protection**: CSRF middleware was removed in October 2025. Backend should implement own protection if needed.

7. **Rate Limiting**: Frontend expects no rate limiting (removed). Backend may add but should return 429 with `retryAfter` in details.

8. **Reply Tree Construction**: Backend MUST return nested reply structure. Use recursive query or post-process flat list.

9. **Revalidation**: Frontend uses Next.js `revalidatePath()` to trigger Server Component refresh. Backend must support cache invalidation on state changes.

10. **Optimistic Concurrency**: Frontend assumes last-write-wins. No version/ETag checks. Backend should handle concurrent updates gracefully.

---

**END OF CONTRACT**

This document represents the complete, immutable API contract for the forums frontend. Any deviation will break the UI/UX.
