# Collaborative Project API Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the comprehensive collaborative project versioning system that transforms your basic project API into a full collaborative platform.

## Implementation Steps

### Phase 1: Database Schema Setup

1. **Create the collaborative database tables**:

   ```bash
   cd /home/user/Projects/web/veritable-games-main/frontend
   node scripts/migration/create-collaborative-project-tables.js
   ```

2. **Verify the schema creation**:

   ```bash
   # Check that all tables were created
   sqlite3 data/forums.db ".tables" | grep -E "(project_|revision_|review_)"

   # Should show:
   # project_discussions
   # project_discussion_replies
   # revision_annotations
   # annotation_replies
   # project_collaborators
   # project_reviews
   # project_review_assignments
   # review_inline_comments
   # review_suggested_changes
   # project_presence
   # project_activities
   # project_notification_preferences
   # project_milestones
   # revision_diff_cache
   # project_templates
   ```

### Phase 2: Service Layer Integration

1. **The collaborative service is ready to use**:

   - Location: `/src/lib/projects/collaborativeService.ts`
   - Includes: Discussion management, annotations, reviews, presence, activity tracking
   - Uses connection pooling and caching for optimal performance

2. **Notification service integration**:
   - Location: `/src/lib/notifications/projectNotifications.ts`
   - Extends existing notification system with project-specific types
   - Respects user preferences and delivery methods

### Phase 3: API Routes Implementation

The following collaborative API routes are ready for use:

#### Discussion Management

- **GET** `/api/projects/[slug]/collaboration/discussions`

  - Fetch discussions for project/revision
  - Supports filtering by type, revision, pagination

- **POST** `/api/projects/[slug]/collaboration/discussions`
  - Create new discussion thread
  - Auto-notifies project collaborators

#### Inline Annotations

- **GET** `/api/projects/[slug]/collaboration/annotations`

  - Fetch annotations grouped by line ranges
  - Supports filtering by line range, type, status, author

- **POST** `/api/projects/[slug]/collaboration/annotations`
  - Add inline code annotations and suggestions
  - Supports different annotation types and severity levels

#### Real-time Presence

- **GET** `/api/projects/[slug]/collaboration/presence`

  - Get active collaborators and their current activity
  - Shows who's viewing/editing specific lines

- **POST** `/api/projects/[slug]/collaboration/presence`

  - Update user presence and activity status
  - High-frequency updates supported with generous rate limiting

- **DELETE** `/api/projects/[slug]/collaboration/presence`
  - Remove user presence (logout/disconnect)

#### Review Workflows

- **GET** `/api/projects/[slug]/collaboration/reviews`

  - Fetch review requests with detailed status
  - Includes reviewer assignments and progress

- **POST** `/api/projects/[slug]/collaboration/reviews`
  - Create formal review requests
  - Auto-assigns reviewers and sends notifications

### Phase 4: Frontend Integration

#### Example: Fetching Project Discussions

```typescript
// Frontend service function
export async function fetchProjectDiscussions(
  projectSlug: string,
  revisionId?: number,
  options: { limit?: number; offset?: number } = {}
) {
  const params = new URLSearchParams();
  if (revisionId) params.set('revision_id', revisionId.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());

  const response = await fetch(`/api/projects/${projectSlug}/collaboration/discussions?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch discussions');
  }

  return response.json();
}
```

#### Example: Creating an Annotation

```typescript
// Frontend function to add annotation
export async function addRevisionAnnotation(
  projectSlug: string,
  annotationData: {
    revision_id: number;
    start_line: number;
    end_line: number;
    annotation_text: string;
    annotation_type?: 'comment' | 'suggestion' | 'issue';
    is_suggestion?: boolean;
    suggested_content?: string;
  }
) {
  // Get CSRF token
  const csrfResponse = await fetch('/api/auth/csrf-token');
  const { token } = await csrfResponse.json();

  const response = await fetch(`/api/projects/${projectSlug}/collaboration/annotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    },
    body: JSON.stringify(annotationData),
  });

  if (!response.ok) {
    throw new Error('Failed to create annotation');
  }

  return response.json();
}
```

#### Example: Real-time Presence Updates

```typescript
// Real-time presence management
export class ProjectPresenceManager {
  private projectSlug: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(projectSlug: string) {
    this.projectSlug = projectSlug;
  }

  async startPresenceUpdates(currentLine?: number) {
    // Initial presence update
    await this.updatePresence('active', currentLine, 'editing');

    // Set up periodic updates every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updatePresence('active', currentLine, 'editing');
    }, 30000);

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      const status = document.hidden ? 'idle' : 'active';
      this.updatePresence(status, currentLine, 'viewing');
    });
  }

  async updatePresence(
    status: 'active' | 'idle' | 'offline',
    currentLine?: number,
    activityType?: string
  ) {
    try {
      const csrfResponse = await fetch('/api/auth/csrf-token');
      const { token } = await csrfResponse.json();

      await fetch(`/api/projects/${this.projectSlug}/collaboration/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          status,
          current_line: currentLine,
          activity_type: activityType,
        }),
      });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }

  async stopPresenceUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Set presence to offline
    await this.updatePresence('offline');
  }
}
```

### Phase 5: Security and Permissions

#### Project-Level Permissions

The collaborative system includes comprehensive permission management:

```typescript
// Check user permissions for project operations
export async function checkProjectPermissions(
  projectSlug: string,
  userId: number
): Promise<ProjectPermissions> {
  const response = await fetch(`/api/projects/${projectSlug}/permissions?user_id=${userId}`);

  return response.json();
}

// Use in components
const permissions = await checkProjectPermissions('my-project', currentUser.id);

if (permissions.can_create_discussions) {
  // Show discussion creation UI
}

if (permissions.can_review) {
  // Show review request UI
}
```

#### Rate Limiting Configuration

The system uses tiered rate limiting:

- **Presence Updates**: 120 requests/minute (generous for real-time)
- **Annotations**: 20 requests/minute
- **Discussions**: 10 requests/5 minutes
- **Reviews**: 5 requests/5 minutes
- **Standard API calls**: 60 requests/minute

### Phase 6: Real-time Features (Optional)

For full real-time collaboration, implement WebSocket support:

```typescript
// WebSocket integration for real-time updates
export class ProjectWebSocketManager {
  private ws: WebSocket | null = null;
  private projectSlug: string;

  constructor(projectSlug: string) {
    this.projectSlug = projectSlug;
  }

  connect() {
    this.ws = new WebSocket(`/api/projects/${this.projectSlug}/realtime`);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'presence_updated':
          this.handlePresenceUpdate(data.payload);
          break;
        case 'discussion_added':
          this.handleNewDiscussion(data.payload);
          break;
        case 'annotation_added':
          this.handleNewAnnotation(data.payload);
          break;
        case 'revision_updated':
          this.handleRevisionUpdate(data.payload);
          break;
      }
    };
  }

  private handlePresenceUpdate(data: any) {
    // Update UI to show collaborator presence
    const presenceIndicator = document.getElementById(`presence-${data.user_id}`);
    if (presenceIndicator) {
      presenceIndicator.textContent = `${data.username} is ${data.activity_type}`;
    }
  }

  private handleNewDiscussion(data: any) {
    // Add new discussion to UI
    const discussionList = document.getElementById('discussions-list');
    // Update discussion list...
  }

  private handleNewAnnotation(data: any) {
    // Add annotation indicator to code lines
    const lineElement = document.getElementById(`line-${data.line_number}`);
    if (lineElement) {
      lineElement.classList.add('has-annotation');
    }
  }
}
```

### Phase 7: Testing and Validation

#### API Testing Examples

```bash
# Test discussion creation
curl -X POST http://localhost:3000/api/projects/my-project/collaboration/discussions \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -d '{
    "revision_id": 123,
    "title": "Review needed for authentication changes",
    "content": "Please review the new authentication flow implementation.",
    "discussion_type": "code_review",
    "line_numbers": [45, 46, 47]
  }'

# Test annotation creation
curl -X POST http://localhost:3000/api/projects/my-project/collaboration/annotations \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -d '{
    "revision_id": 123,
    "start_line": 45,
    "end_line": 47,
    "annotation_text": "Consider using async/await here for better readability",
    "annotation_type": "suggestion",
    "is_suggestion": true,
    "suggested_content": "const result = await authenticateUser(credentials);"
  }'

# Test presence update
curl -X POST http://localhost:3000/api/projects/my-project/collaboration/presence \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -d '{
    "status": "active",
    "current_line": 45,
    "activity_type": "editing"
  }'

# Test review request
curl -X POST http://localhost:3000/api/projects/my-project/collaboration/reviews \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -d '{
    "revision_id": 123,
    "reviewers": [2, 3, 4],
    "review_type": "security",
    "title": "Security review for authentication changes",
    "description": "Please review for potential security vulnerabilities",
    "deadline": "2025-09-15T17:00:00Z"
  }'
```

#### Database Validation

```bash
# Check that data is being created correctly
sqlite3 data/forums.db "SELECT COUNT(*) FROM project_discussions;"
sqlite3 data/forums.db "SELECT COUNT(*) FROM revision_annotations;"
sqlite3 data/forums.db "SELECT COUNT(*) FROM project_reviews;"
sqlite3 data/forums.db "SELECT COUNT(*) FROM project_activities;"
```

### Phase 8: Performance Optimization

#### Caching Strategy

The system includes several caching layers:

1. **LRU Caches** for frequently accessed data:

   - Discussion cache (5 minutes)
   - Annotation cache (5 minutes)
   - Presence cache (1 minute)
   - Review cache (5 minutes)

2. **Database-level optimizations**:

   - Prepared statements for all queries
   - Composite indexes for common query patterns
   - Connection pooling to prevent resource exhaustion

3. **Diff caching** for expensive operations:
   - Cached semantic diffs with 24-hour expiration
   - Compressed storage for large diffs

#### Monitoring and Alerting

Add monitoring for collaborative features:

```typescript
// Monitor API performance
export function logCollaborativeAPIMetrics(endpoint: string, duration: number, success: boolean) {
  console.log(`Collaborative API: ${endpoint}, ${duration}ms, ${success ? 'SUCCESS' : 'ERROR'}`);

  // TODO: Send to monitoring service (Sentry, etc.)
}
```

## Integration with Existing Systems

### Forum Integration

The collaborative system seamlessly integrates with your existing forum infrastructure:

- **Shared user management**: Uses existing user authentication and authorization
- **Notification system**: Extends existing notification types with project-specific events
- **Activity feeds**: Project activities can be displayed in forum activity feeds
- **Permissions**: Leverages existing role-based permission system

### Wiki Integration

Project revisions are stored as wiki pages, maintaining full compatibility:

- **Revision history**: All collaborative features work with existing wiki revision system
- **Content processing**: Uses existing markdown processing and sanitization
- **Search integration**: Collaborative content is searchable through existing FTS5 system

### Security Integration

All collaborative APIs follow existing security patterns:

- **CSRF protection**: All state-changing operations require valid CSRF tokens
- **Rate limiting**: Appropriate limits for different operation types
- **Input validation**: Comprehensive Zod schemas for all inputs
- **Content sanitization**: All user content is sanitized using existing DOMPurify integration

## Troubleshooting

### Common Issues

1. **Database connection errors**:

   - Ensure connection pool is being used (`dbPool.getConnection()`)
   - Check that database migration completed successfully

2. **CSRF token errors**:

   - Verify that frontend is getting and sending CSRF tokens correctly
   - Check that session cookies are being set properly

3. **Rate limiting issues**:

   - Review rate limit configurations in middleware
   - Consider increasing limits for real-time operations

4. **Notification delivery issues**:
   - Check notification preferences in database
   - Verify that notification triggers are firing correctly

### Performance Issues

1. **Slow query performance**:

   - Check that all required indexes were created
   - Monitor connection pool usage
   - Consider increasing cache TTL for frequently accessed data

2. **Memory usage**:

   - Monitor LRU cache sizes
   - Implement cache eviction policies if needed

3. **Real-time update delays**:
   - Check WebSocket connection stability
   - Consider implementing heartbeat/ping mechanisms

## Next Steps

After implementing the basic collaborative features, consider these enhancements:

1. **Advanced diff algorithms**: Implement semantic code analysis for better diffs
2. **Conflict resolution**: Add three-way merge capabilities for concurrent edits
3. **AI-powered suggestions**: Integrate code analysis tools for intelligent suggestions
4. **Mobile support**: Optimize APIs for mobile collaborative editing
5. **Offline support**: Implement offline-first collaborative editing with sync

This comprehensive collaborative project versioning system transforms your basic project API into a full-featured collaborative platform while maintaining seamless integration with all existing systems.
