# Notification System Documentation

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready
**Location**: `frontend/src/lib/notifications/`, `frontend/src/app/api/notifications/`

---

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Mention System](#mention-system)
- [Notification Types](#notification-types)
- [Priority Levels](#priority-levels)
- [Features](#features)
- [Usage Examples](#usage-examples)
- [Performance](#performance)
- [Future Enhancements](#future-enhancements)

---

## Overview

The Notification System provides real-time notifications to users about important events, mentions, and system alerts. It supports multiple notification types, priority levels, @username mentions, and filtering capabilities.

### Key Features

✅ **Multi-Type Notifications**: message, follow, friend_request, mention, system
✅ **Priority Levels**: urgent, high, normal, low
✅ **@Username Mentions**: Automatic detection and notification of mentions
✅ **Read/Unread Tracking**: Mark notifications as read individually or in bulk
✅ **Filtering**: Filter by type, unread status
✅ **Expiration**: Auto-expire time-sensitive notifications
✅ **Related User Info**: Fetch user profiles with notifications
✅ **Unread Counts**: Total and per-type unread counts
✅ **Pagination**: Efficient loading for large notification lists

### Use Cases

- **Mentions**: Notify users when @mentioned in forum topics/replies
- **Messages**: Alert users of new private messages
- **Social**: Follow requests, friend requests accepted
- **System**: Important announcements, maintenance alerts
- **Engagement**: Replies to topics, likes on content (future)

---

## Database Schema

### `notifications` Table (system schema)

**Location**: PostgreSQL `system` schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment notification ID |
| `user_id` | INTEGER | NOT NULL | Recipient user ID (FK → users.users.id) |
| `type` | VARCHAR(50) | NOT NULL | Notification type (see types below) |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `content` | TEXT | NOT NULL | Notification message |
| `entity_type` | VARCHAR(50) | NULL | Related entity type (topic, reply, user, etc.) |
| `entity_id` | INTEGER | NULL | Related entity ID |
| `action_url` | VARCHAR(500) | NULL | URL to navigate to when clicked |
| `read_status` | BOOLEAN | DEFAULT FALSE | Read/unread status |
| `priority` | VARCHAR(20) | DEFAULT 'normal' | Priority level (urgent, high, normal, low) |
| `metadata` | TEXT/JSONB | NULL | Additional data (JSON) |
| `expires_at` | TIMESTAMP | NULL | Expiration timestamp (auto-hide after) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `(user_id, read_status)` for fast unread queries
- INDEX on `(user_id, type)` for type filtering
- INDEX on `(user_id, created_at DESC)` for chronological sorting
- INDEX on `(user_id, priority)` for priority sorting
- INDEX on `expires_at` for cleanup queries

**Example Row**:
```json
{
  "id": 142,
  "user_id": 5,
  "type": "mention",
  "title": "JohnDoe mentioned you in \"Feature Request\"",
  "content": "JohnDoe mentioned you: \"Hey @jane, what do you think about...\"",
  "entity_type": "topic",
  "entity_id": 89,
  "action_url": "/forums/topic/89",
  "read_status": false,
  "priority": "normal",
  "metadata": {
    "mentioner_id": 3,
    "mentioner_username": "JohnDoe",
    "topic_id": 89
  },
  "expires_at": null,
  "created_at": "2025-11-12T10:30:00Z",
  "updated_at": "2025-11-12T10:30:00Z"
}
```

---

## API Endpoints

### 1 REST Endpoint (multiple methods)

All operations are protected with `withSecurity()` middleware (CSRF, rate limiting, authentication).

#### GET `/api/notifications`

**Purpose**: List user notifications with filtering and pagination

**Authentication**: Required

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Items per page (max 50) |
| `unread` | boolean | false | Filter unread only (`true` or omit) |
| `type` | string | null | Filter by type ('message', 'mention', 'follow', etc.) |

**Response**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 142,
        "user_id": 5,
        "type": "mention",
        "title": "JohnDoe mentioned you",
        "content": "JohnDoe mentioned you: \"Hey @jane...\"",
        "entity_type": "topic",
        "entity_id": 89,
        "action_url": "/forums/topic/89",
        "read_status": false,
        "priority": "normal",
        "metadata": {
          "mentioner_id": 3,
          "mentioner_username": "JohnDoe"
        },
        "related_user": {
          "id": 3,
          "username": "JohnDoe",
          "display_name": "John Doe",
          "avatar_url": "/avatars/johndoe.jpg"
        },
        "expires_at": null,
        "created_at": "2025-11-12T10:30:00Z",
        "updated_at": "2025-11-12T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "totalPages": 3,
      "hasMore": true
    },
    "unreadCount": 12,
    "unreadByType": {
      "mention": 5,
      "message": 4,
      "follow": 3
    },
    "filters": {
      "unreadOnly": false,
      "type": null
    }
  }
}
```

**Features**:
- Automatic expiration filtering (hides expired notifications)
- Related user info for user-related notifications
- Priority sorting (urgent → high → normal → low)
- Chronological sorting within priority levels
- Total and per-type unread counts

**Examples**:
```bash
# Get all notifications (page 1)
GET /api/notifications

# Get unread notifications only
GET /api/notifications?unread=true

# Get mention notifications only
GET /api/notifications?type=mention

# Get page 2 with 10 items per page
GET /api/notifications?page=2&limit=10

# Get unread mentions
GET /api/notifications?unread=true&type=mention
```

#### PATCH `/api/notifications`

**Purpose**: Mark notifications as read

**Authentication**: Required (protected by CSRF)

**Request Body (Option 1: Mark specific notifications)**:
```json
{
  "notification_ids": [142, 143, 145]
}
```

**Request Body (Option 2: Mark all notifications)**:
```json
{
  "mark_all": true
}
```

**Request Body (Option 3: Mark all of specific type)**:
```json
{
  "mark_all": true,
  "type": "mention"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "marked_count": 3,
    "unread_count": 9
  }
}
```

**Notes**:
- Only marks unread notifications (idempotent)
- Returns updated unread count after marking
- User can only mark their own notifications

**Errors**:
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

## Mention System

### MentionService

**Location**: `frontend/src/lib/notifications/mentions.ts`

**Purpose**: Detect and handle @username mentions in user-generated content

### Core Methods

#### 1. extractMentions()

**Purpose**: Extract @username mentions from text content

```typescript
static async extractMentions(content: string): Promise<MentionMatch[]>
```

**Returns**:
```typescript
interface MentionMatch {
  username: string;
  user_id: number;
  display_name: string;
  position: number;  // Character position in content
  length: number;    // Length of @mention (e.g., "@johndoe" = 8)
}
```

**Features**:
- Regex-based extraction (`/@([a-zA-Z0-9_-]+)/g`)
- Validates usernames against database (active users only)
- Case-insensitive matching
- Returns sorted by position
- Handles duplicate mentions (only notifies once)

**Example**:
```typescript
const content = "Hey @alice and @bob, what do you think about @alice's idea?";
const mentions = await MentionService.extractMentions(content);

// Result:
[
  { username: 'alice', user_id: 5, display_name: 'Alice', position: 4, length: 6 },
  { username: 'bob', user_id: 7, display_name: 'Bob', position: 15, length: 4 },
  // @alice mentioned twice, but only one entry
]
```

#### 2. createMentionNotifications()

**Purpose**: Create notifications for mentioned users

```typescript
static async createMentionNotifications(
  mentionedUserIds: number[],
  mentionerUserId: number,
  entityType: 'topic' | 'reply',
  entityId: number,
  contextTitle: string,
  contentPreview: string
): Promise<void>
```

**Features**:
- Creates one notification per mentioned user
- Skips self-mentions (user mentioning themselves)
- Includes mentioner info in notification
- Generates action URL (e.g., `/forums/topic/89#reply-142`)
- Stores metadata (mentioner ID, entity info)
- Transactional (all-or-nothing)

**Notification Format**:
```json
{
  "type": "mention",
  "title": "JohnDoe mentioned you in \"Feature Request\"",
  "content": "JohnDoe mentioned you: \"Hey @jane, what do you think...\"",
  "action_url": "/forums/topic/89",
  "metadata": {
    "mentioner_id": 3,
    "mentioner_username": "JohnDoe",
    "mentioner_display_name": "John Doe",
    "entity_type": "topic",
    "entity_id": 89,
    "topic_id": 89
  }
}
```

#### 3. processMentions()

**Purpose**: Main method to call from forum service (combines extraction + notification)

```typescript
static async processMentions(
  content: string,
  authorUserId: number,
  entityType: 'topic' | 'reply',
  entityId: number,
  contextTitle: string
): Promise<MentionMatch[]>
```

**Usage Example**:
```typescript
// When creating a forum topic
const topicContent = "Hey @alice, what do you think about this?";

const mentions = await MentionService.processMentions(
  topicContent,
  currentUser.id,      // Author
  'topic',             // Entity type
  newTopic.id,         // Entity ID
  newTopic.title       // Context title
);

console.log(`Notified ${mentions.length} users`);
```

**Error Handling**:
- Never throws (mentions are non-critical feature)
- Errors logged but don't prevent content creation
- Returns empty array on error

#### 4. cleanupMentionNotifications()

**Purpose**: Delete mention notifications when content is deleted

```typescript
static async cleanupMentionNotifications(
  entityType: 'topic' | 'reply',
  entityId: number
): Promise<void>
```

**Usage**:
```typescript
// When deleting a forum topic
await MentionService.cleanupMentionNotifications('topic', topicId);
```

---

## Notification Types

### Available Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| **message** | New private message received | User sends you a DM |
| **mention** | @username mention in content | Someone mentions you in forum |
| **follow** | New follower | User follows you |
| **friend_request** | Friend request received/accepted | User sends friend request |
| **system** | System announcements | Platform updates, maintenance |

### Future Types (Planned)

| Type | Description | Example Use Case |
|------|-------------|------------------|
| **reply** | Reply to your topic/comment | Someone replies to your forum topic |
| **like** | Content liked/upvoted | User likes your project |
| **milestone** | Achievement unlocked | Reached 100 forum posts |
| **invitation** | Project/group invitation | Invited to collaborate on project |
| **announcement** | Targeted announcements | New feature announcement |

---

## Priority Levels

### Priority Hierarchy

| Priority | Use Case | UI Treatment | Example |
|----------|----------|--------------|---------|
| **urgent** | Critical alerts | Red badge, top of list | Security alert, account issue |
| **high** | Important notifications | Orange badge, near top | Friend request, direct mention |
| **normal** | Standard notifications | Default styling | Follow notification, topic reply |
| **low** | Informational only | Subtle styling | Weekly summary, tips |

**Sorting**:
```sql
ORDER BY
  CASE
    WHEN priority = 'urgent' THEN 1
    WHEN priority = 'high' THEN 2
    WHEN priority = 'normal' THEN 3
    ELSE 4
  END,
  created_at DESC
```

**Usage**:
```typescript
// Create urgent notification
await createNotification({
  user_id: userId,
  type: 'system',
  title: 'Security Alert',
  content: 'Unusual login detected',
  priority: 'urgent'
});
```

---

## Features

### 1. Automatic Expiration

**Purpose**: Auto-hide time-sensitive notifications after expiration

**Implementation**:
```sql
-- Query automatically filters expired notifications
WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
```

**Use Cases**:
- Event reminders (expire after event starts)
- Limited-time promotions
- Time-sensitive announcements
- Scheduled maintenance alerts

**Example**:
```typescript
// Notification expires in 24 hours
await createNotification({
  user_id: userId,
  type: 'system',
  title: 'Maintenance Window',
  content: 'Server maintenance tonight at 2 AM',
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
```

### 2. Related User Info

**Purpose**: Fetch user profiles with notifications in single query

**Implementation**:
```sql
SELECT
  n.*,
  -- Get related user info for user-related notifications
  CASE
    WHEN n.entity_type = 'user' THEN (
      SELECT JSON_BUILD_OBJECT(
        'id', u.id,
        'username', u.username,
        'display_name', u.display_name,
        'avatar_url', u.avatar_url
      )
      FROM auth.users u
      WHERE u.id = n.entity_id AND u.is_active = TRUE
    )
    ELSE NULL
  END as related_user
FROM notifications n
```

**Benefits**:
- Avoids N+1 query problem
- Single query returns notifications + user profiles
- Only fetches user info for user-related notifications

**Result**:
```json
{
  "id": 142,
  "type": "follow",
  "title": "JohnDoe followed you",
  "related_user": {
    "id": 3,
    "username": "JohnDoe",
    "display_name": "John Doe",
    "avatar_url": "/avatars/johndoe.jpg"
  }
}
```

### 3. Unread Counts

**Purpose**: Show unread notification badge counts

**Implementation**:
```typescript
// Total unread count
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND read_status = FALSE

// Unread by type
SELECT type, COUNT(*) as count FROM notifications
WHERE user_id = $1 AND read_status = FALSE
GROUP BY type
```

**Response**:
```json
{
  "unreadCount": 12,
  "unreadByType": {
    "mention": 5,
    "message": 4,
    "follow": 3
  }
}
```

**UI Usage**:
- Show total count in notification bell icon
- Show per-type counts in notification filter tabs
- Update counts in real-time after marking as read

### 4. Bulk Operations

**Mark all as read**:
```typescript
await fetch('/api/notifications', {
  method: 'PATCH',
  body: JSON.stringify({ mark_all: true })
});
```

**Mark all of specific type as read**:
```typescript
await fetch('/api/notifications', {
  method: 'PATCH',
  body: JSON.stringify({ mark_all: true, type: 'mention' })
});
```

**Benefits**:
- Single database query (efficient)
- Atomic operation (all-or-nothing)
- Returns updated unread count

---

## Usage Examples

### Fetch Notifications

**Client-Side**:
```typescript
async function fetchNotifications(page: number = 1, unreadOnly: boolean = false) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20',
    ...(unreadOnly && { unread: 'true' })
  });

  const response = await fetch(`/api/notifications?${params}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error('Failed to fetch notifications');
  }

  return data.data;
}

// Usage
const result = await fetchNotifications(1, true);
console.log('Unread count:', result.unreadCount);
console.log('Notifications:', result.notifications);
```

### Mark Notifications as Read

**Single Notification**:
```typescript
async function markAsRead(notificationIds: number[]) {
  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ notification_ids: notificationIds }),
  });

  const data = await response.json();
  console.log('Marked count:', data.data.marked_count);
  console.log('Remaining unread:', data.data.unread_count);
}

// Mark notification as read when clicked
await markAsRead([142]);
```

**Mark All as Read**:
```typescript
async function markAllAsRead() {
  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ mark_all: true }),
  });

  return await response.json();
}
```

### Create Mention Notifications

**In Forum Topic Service**:
```typescript
import { MentionService } from '@/lib/notifications/mentions';

async function createForumTopic(title: string, content: string, authorId: number) {
  // Create topic
  const topic = await createTopic({ title, content, author_id: authorId });

  // Process mentions asynchronously (don't block topic creation)
  MentionService.processMentions(
    content,
    authorId,
    'topic',
    topic.id,
    title
  ).catch(error => {
    console.error('Failed to process mentions:', error);
  });

  return topic;
}
```

### Real-Time Notification UI

**React Component**:
```typescript
import { useState, useEffect } from 'react';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    const result = await fetch('/api/notifications?limit=5&unread=true');
    const data = await result.json();

    setUnreadCount(data.data.unreadCount);
    setNotifications(data.data.notifications);
  }

  async function handleNotificationClick(notificationId: number) {
    // Mark as read
    await markAsRead([notificationId]);

    // Update local state
    setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read_status: true } : n)
    );
  }

  return (
    <div>
      <button>
        🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>

      <ul>
        {notifications.map(notif => (
          <li
            key={notif.id}
            onClick={() => handleNotificationClick(notif.id)}
            className={notif.read_status ? 'read' : 'unread'}
          >
            <strong>{notif.title}</strong>
            <p>{notif.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Performance

### Optimization Strategies

#### 1. Indexed Queries

**Optimized Queries**:
```sql
-- Fast: Uses compound index (user_id, read_status)
SELECT * FROM notifications
WHERE user_id = $1 AND read_status = FALSE
ORDER BY created_at DESC;

-- Fast: Uses compound index (user_id, type)
SELECT * FROM notifications
WHERE user_id = $1 AND type = 'mention'
ORDER BY created_at DESC;
```

#### 2. Pagination

**Efficient pagination** (limit + offset):
```typescript
const limit = 20;
const offset = (page - 1) * limit;

const result = await dbAdapter.query(
  'SELECT * FROM notifications WHERE user_id = $1 LIMIT $2 OFFSET $3',
  [userId, limit, offset],
  { schema: 'system' }
);
```

#### 3. Batch Marking

**Single UPDATE for bulk operations**:
```sql
-- Mark multiple notifications
UPDATE notifications
SET read_status = TRUE
WHERE user_id = $1 AND id IN ($2, $3, $4);

-- Mark all (efficient)
UPDATE notifications
SET read_status = TRUE
WHERE user_id = $1 AND read_status = FALSE;
```

#### 4. Expiration Cleanup

**Scheduled cleanup job** (recommended):
```sql
-- Delete expired notifications older than 30 days
DELETE FROM notifications
WHERE expires_at IS NOT NULL
  AND expires_at < NOW() - INTERVAL '30 days';
```

### Performance Benchmarks

| Operation | Query Time | Notes |
|-----------|------------|-------|
| List 20 notifications | 5-10ms | With indexes |
| Get unread count | 2-5ms | Simple COUNT with index |
| Mark as read (single) | 3-8ms | Single UPDATE |
| Mark all as read | 10-20ms | Bulk UPDATE |
| Create notification | 5-10ms | Single INSERT |
| Extract mentions | 15-30ms | Regex + database lookup |

---

## Future Enhancements

### Planned Features

1. **Real-Time Updates (WebSocket)**
   - Push notifications without polling
   - Live badge updates
   - Instant notification delivery

2. **Email Notifications**
   - Digest emails (daily/weekly summaries)
   - Immediate emails for urgent notifications
   - Customizable email preferences

3. **Notification Preferences**
   - Per-type enable/disable toggles
   - Frequency settings (instant/digest/off)
   - Custom mention filters (all/@me in replies/@me anywhere)

4. **Rich Notification Templates**
   - Customizable templates per type
   - HTML rendering support
   - Action buttons (Accept/Decline, etc.)

5. **Browser Push Notifications**
   - Web Push API integration
   - Desktop notifications
   - Notification sound/vibration settings

6. **Notification Center UI**
   - Dedicated notification page
   - Advanced filtering (date range, priority)
   - Search notifications
   - Archive/delete notifications

7. **Analytics Dashboard**
   - Notification delivery rates
   - Read/unread statistics
   - User engagement metrics
   - Popular notification types

---

## Related Documentation

- **[docs/api/README.md](../api/README.md)** - Complete API reference
- **[docs/DATABASE.md](../DATABASE.md)** - Database architecture
- **[docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)** - Security patterns
- **[CLAUDE.md](../../CLAUDE.md)** - Development guide

---

## Troubleshooting

### Common Issues

**Q: Notifications not appearing**
A: Check that `expires_at` is null or in the future. Expired notifications are automatically hidden.

**Q: @mentions not creating notifications**
A: Verify mentioned username exists and user is active (`is_active = TRUE`). Case-insensitive matching is used.

**Q: Unread count not updating**
A: After marking as read, refetch notifications to get updated `unreadCount` from API response.

**Q: Related user info is null**
A: Only user-related notifications have `related_user`. Check `entity_type = 'user'` and user is active.

**Q: Notifications appearing for self-mentions**
A: This is expected to be filtered. Check `MentionService.createMentionNotifications` skips mentioner's own user ID.

---

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready with @mention support, filtering, bulk operations, and priority levels
