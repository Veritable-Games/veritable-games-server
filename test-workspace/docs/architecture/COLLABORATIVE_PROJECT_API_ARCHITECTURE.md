# Comprehensive Collaborative Project Versioning API Architecture

## Overview

This document outlines a comprehensive API architecture for transforming the basic project versioning system into a full collaborative platform. The architecture integrates seamlessly with existing forum/messaging/notification systems while maintaining all security patterns and performance optimizations.

## 1. API Architecture Overview

### Core API Domains

- **Project Collaboration** (`/api/projects/[slug]/collaboration/`)
- **Real-time Updates** (`/api/projects/[slug]/realtime/`)
- **Advanced Diff & Annotations** (`/api/projects/[slug]/diff/`)
- **Approval Workflows** (`/api/projects/[slug]/workflows/`)
- **Activity Integration** (`/api/projects/[slug]/activity/`)
- **Notification Integration** (extends existing `/api/notifications/`)

### Integration Points

- Forum system for discussion threads
- User social graph for collaboration permissions
- Notification system for real-time updates
- Messaging system for direct collaboration
- Activity feed for project events

## 2. Collaborative Discussion APIs

### 2.1 Revision-Linked Discussions

```typescript
// /api/projects/[slug]/revisions/[id]/discussions/route.ts
import { withSecurity } from '@/lib/security/middleware';
import { dbPool } from '@/lib/database/pool';

// GET - Fetch discussions for a revision
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) => {
  const db = dbPool.getConnection('forums');

  const discussions = db
    .prepare(
      `
    SELECT 
      pd.*,
      u.username, u.display_name, u.avatar_url,
      COUNT(pdr.id) as reply_count,
      MAX(pdr.created_at) as last_activity
    FROM project_discussions pd
    LEFT JOIN users u ON pd.author_id = u.id
    LEFT JOIN project_discussion_replies pdr ON pd.id = pdr.discussion_id
    WHERE pd.project_slug = ? AND pd.revision_id = ?
      AND pd.status = 'active'
    GROUP BY pd.id
    ORDER BY pd.is_pinned DESC, pd.created_at DESC
  `
    )
    .all(slug, revisionId);

  return NextResponse.json({
    discussions,
    metadata: {
      total: discussions.length,
      project_slug: slug,
      revision_id: revisionId,
    },
  });
};

// POST - Create new discussion thread for revision
export const POST = withSecurity(
  async (request, { params }) => {
    const db = dbPool.getConnection('forums');
    const { title, content, discussion_type, line_numbers } = await request.json();

    const discussionId = db.transaction(() => {
      // Create discussion thread
      const discussion = db
        .prepare(
          `
      INSERT INTO project_discussions (
        project_slug, revision_id, author_id, title, content,
        discussion_type, line_numbers, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `
        )
        .run(
          slug,
          revisionId,
          userId,
          title,
          content,
          discussion_type,
          JSON.stringify(line_numbers)
        );

      // Create notification for project collaborators
      const collaborators = getProjectCollaborators(slug);
      collaborators.forEach((collaborator) => {
        if (collaborator.id !== userId) {
          createNotification({
            user_id: collaborator.id,
            type: 'project_discussion',
            title: `New discussion: ${title}`,
            message: `${username} started a discussion about revision ${revisionId}`,
            entity_type: 'project_discussion',
            entity_id: discussion.lastInsertRowid,
            metadata: {
              project_slug: slug,
              revision_id: revisionId,
              discussion_type,
            },
          });
        }
      });

      return discussion.lastInsertRowid;
    })();

    return NextResponse.json({
      success: true,
      discussion_id: discussionId,
      message: 'Discussion created successfully',
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);
```

### 2.2 Inline Code Annotations

```typescript
// /api/projects/[slug]/revisions/[id]/annotations/route.ts

// POST - Add inline annotation to specific lines
export const POST = withSecurity(
  async (request, { params }) => {
    const db = dbPool.getConnection('forums');
    const {
      start_line,
      end_line,
      annotation_text,
      annotation_type = 'comment',
      is_suggestion = false,
      suggested_content,
    } = await request.json();

    const annotationId = db.transaction(() => {
      const annotation = db
        .prepare(
          `
      INSERT INTO revision_annotations (
        revision_id, author_id, start_line, end_line,
        annotation_text, annotation_type, is_suggestion,
        suggested_content, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `
        )
        .run(
          revisionId,
          userId,
          start_line,
          end_line,
          annotation_text,
          annotation_type,
          is_suggestion,
          suggested_content
        );

      // Track annotation activity
      logProjectActivity(slug, userId, 'annotation_added', {
        revision_id: revisionId,
        annotation_id: annotation.lastInsertRowid,
        lines: `${start_line}-${end_line}`,
        type: annotation_type,
      });

      return annotation.lastInsertRowid;
    })();

    return NextResponse.json({
      success: true,
      annotation_id: annotationId,
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);

// GET - Fetch annotations for revision with line grouping
export const GET = async (request, { params }) => {
  const db = dbPool.getConnection('forums');

  const annotations = db
    .prepare(
      `
    SELECT 
      ra.*,
      u.username, u.display_name, u.avatar_url,
      COUNT(rar.id) as reply_count
    FROM revision_annotations ra
    LEFT JOIN users u ON ra.author_id = u.id
    LEFT JOIN annotation_replies rar ON ra.id = rar.annotation_id
    WHERE ra.revision_id = ? AND ra.status = 'active'
    GROUP BY ra.id
    ORDER BY ra.start_line ASC, ra.created_at ASC
  `
    )
    .all(revisionId);

  // Group annotations by line ranges
  const groupedAnnotations = annotations.reduce((acc, annotation) => {
    const key = `${annotation.start_line}-${annotation.end_line}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(annotation);
    return acc;
  }, {});

  return NextResponse.json({
    annotations: groupedAnnotations,
    metadata: { revision_id: revisionId, total: annotations.length },
  });
};
```

## 3. Real-time Collaboration APIs

### 3.1 WebSocket Integration for Live Updates

```typescript
// /api/projects/[slug]/realtime/route.ts

export const GET = withSecurity(
  async (request, { params }) => {
    const { searchParams } = new URL(request.url);
    const revisionId = searchParams.get('revision_id');

    // Upgrade to WebSocket connection
    if (request.headers.get('upgrade') === 'websocket') {
      return handleWebSocketUpgrade(request, {
        project_slug: slug,
        revision_id: revisionId,
        user_id: userId,
      });
    }

    // Fallback to Server-Sent Events for real-time updates
    return new Response(
      new ReadableStream({
        start(controller) {
          const eventSource = createProjectEventSource(slug, revisionId, userId);

          eventSource.on('revision_updated', (data) => {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'revision_updated',
                payload: data,
              })}\n\n`
            );
          });

          eventSource.on('discussion_added', (data) => {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'discussion_added',
                payload: data,
              })}\n\n`
            );
          });

          eventSource.on('annotation_added', (data) => {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'annotation_added',
                payload: data,
              })}\n\n`
            );
          });
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );
  },
  {
    requireAuth: true,
    csrfEnabled: false,
    rateLimitConfig: 'generous',
  }
);
```

### 3.2 Collaborative Editing Presence

```typescript
// /api/projects/[slug]/presence/route.ts

// POST - Update user presence in project
export const POST = withSecurity(
  async (request, { params }) => {
    const db = dbPool.getConnection('forums');
    const { status, current_line, activity_type } = await request.json();

    const presenceId = db
      .prepare(
        `
    INSERT OR REPLACE INTO project_presence (
      project_slug, user_id, status, current_line,
      activity_type, last_seen, expires_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 
              datetime('now', '+5 minutes'))
  `
      )
      .run(slug, userId, status, current_line, activity_type).lastInsertRowid;

    // Broadcast presence update to other collaborators
    broadcastToProject(slug, {
      type: 'presence_updated',
      user_id: userId,
      username: currentUser.username,
      status,
      current_line,
      activity_type,
    });

    return NextResponse.json({ success: true });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'generous',
  }
);

// GET - Get active collaborators presence
export const GET = async (request, { params }) => {
  const db = dbPool.getConnection('forums');

  const activePresence = db
    .prepare(
      `
    SELECT 
      pp.*,
      u.username, u.display_name, u.avatar_url
    FROM project_presence pp
    JOIN users u ON pp.user_id = u.id
    WHERE pp.project_slug = ? 
      AND pp.expires_at > CURRENT_TIMESTAMP
      AND pp.status != 'offline'
    ORDER BY pp.last_seen DESC
  `
    )
    .all(slug);

  return NextResponse.json({
    active_collaborators: activePresence,
    total: activePresence.length,
  });
};
```

## 4. Advanced Diff and Annotation System

### 4.1 Enhanced Diff API with Semantic Analysis

```typescript
// /api/projects/[slug]/diff/semantic/route.ts

export const POST = withSecurity(
  async (request, { params }) => {
    const { from_revision_id, to_revision_id, diff_options = {} } = await request.json();

    const db = dbPool.getConnection('forums');

    // Get revision contents
    const [fromRevision, toRevision] = await Promise.all([
      getRevisionContent(from_revision_id),
      getRevisionContent(to_revision_id),
    ]);

    // Advanced diff with semantic understanding
    const semanticDiff = await generateSemanticDiff(fromRevision.content, toRevision.content, {
      language: detectLanguage(toRevision.content),
      showWordDiff: diff_options.word_level || false,
      ignoreWhitespace: diff_options.ignore_whitespace || false,
      contextLines: diff_options.context_lines || 3,
    });

    // Analyze diff for significant changes
    const changeAnalysis = analyzeChanges(semanticDiff);

    // Get existing annotations for both revisions
    const annotations = db
      .prepare(
        `
    SELECT * FROM revision_annotations
    WHERE revision_id IN (?, ?) AND status = 'active'
    ORDER BY start_line ASC
  `
      )
      .all(from_revision_id, to_revision_id);

    return NextResponse.json({
      project_slug: slug,
      from_revision: {
        id: from_revision_id,
        timestamp: fromRevision.revision_timestamp,
        summary: fromRevision.summary,
      },
      to_revision: {
        id: to_revision_id,
        timestamp: toRevision.revision_timestamp,
        summary: toRevision.summary,
      },
      diff: {
        hunks: semanticDiff.hunks,
        stats: semanticDiff.stats,
        semantic_changes: changeAnalysis.semantic_changes,
        breaking_changes: changeAnalysis.breaking_changes,
        complexity_delta: changeAnalysis.complexity_delta,
      },
      annotations: groupAnnotationsByLine(annotations),
      metadata: {
        language: semanticDiff.language,
        options: diff_options,
        generated_at: new Date().toISOString(),
      },
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);
```

### 4.2 Visual Diff with Conflict Resolution

```typescript
// /api/projects/[slug]/diff/visual/route.ts

export const POST = withSecurity(
  async (request, { params }) => {
    const {
      base_revision_id,
      compare_revisions = [],
      merge_conflicts = false,
    } = await request.json();

    const db = dbPool.getConnection('forums');

    if (merge_conflicts && compare_revisions.length > 1) {
      // Three-way merge analysis for multiple revisions
      const mergeAnalysis = await performThreeWayMerge(base_revision_id, compare_revisions);

      return NextResponse.json({
        merge_analysis: mergeAnalysis,
        conflicts: mergeAnalysis.conflicts,
        auto_merge_possible: mergeAnalysis.auto_merge_possible,
        suggested_resolution: mergeAnalysis.suggested_resolution,
      });
    }

    // Standard visual diff
    const visualDiff = await generateVisualDiff(base_revision_id, compare_revisions[0]);

    return NextResponse.json({
      visual_diff: visualDiff,
      side_by_side: true,
      inline_available: true,
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);
```

## 5. Approval and Review Workflow APIs

### 5.1 Review Request System

```typescript
// /api/projects/[slug]/reviews/route.ts

// POST - Create review request
export const POST = withSecurity(
  async (request, { params }) => {
    const db = dbPool.getConnection('forums');
    const {
      revision_id,
      reviewers = [],
      review_type = 'standard',
      deadline,
      description,
    } = await request.json();

    const reviewId = db.transaction(() => {
      // Create review request
      const review = db
        .prepare(
          `
      INSERT INTO project_reviews (
        project_slug, revision_id, author_id, review_type,
        description, deadline, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `
        )
        .run(slug, revision_id, userId, review_type, description, deadline);

      // Add reviewers
      const reviewId = review.lastInsertRowid;
      reviewers.forEach((reviewerId) => {
        db.prepare(
          `
        INSERT INTO project_review_assignments (
          review_id, reviewer_id, status, assigned_at
        ) VALUES (?, ?, 'assigned', CURRENT_TIMESTAMP)
      `
        ).run(reviewId, reviewerId);

        // Create notification for reviewer
        createNotification({
          user_id: reviewerId,
          type: 'review_request',
          title: 'Review Request',
          message: `${currentUser.username} requested your review for ${slug}`,
          entity_type: 'project_review',
          entity_id: reviewId,
          priority: deadline ? 'high' : 'normal',
          metadata: {
            project_slug: slug,
            revision_id: revision_id,
            deadline: deadline,
          },
        });
      });

      // Log activity
      logProjectActivity(slug, userId, 'review_requested', {
        review_id: reviewId,
        revision_id: revision_id,
        reviewers: reviewers.length,
      });

      return reviewId;
    })();

    return NextResponse.json({
      success: true,
      review_id: reviewId,
      message: 'Review request created successfully',
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);

// GET - Get review requests for project
export const GET = async (request, { params }) => {
  const db = dbPool.getConnection('forums');
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const reviewer_id = searchParams.get('reviewer_id');

  let whereClause = 'WHERE pr.project_slug = ?';
  const queryParams = [slug];

  if (status !== 'all') {
    whereClause += ' AND pr.status = ?';
    queryParams.push(status);
  }

  if (reviewer_id) {
    whereClause +=
      ' AND EXISTS (SELECT 1 FROM project_review_assignments pra WHERE pra.review_id = pr.id AND pra.reviewer_id = ?)';
    queryParams.push(reviewer_id);
  }

  const reviews = db
    .prepare(
      `
    SELECT 
      pr.*,
      u.username as author_username,
      u.display_name as author_display_name,
      wr.summary as revision_summary,
      COUNT(DISTINCT pra.reviewer_id) as reviewer_count,
      COUNT(DISTINCT CASE WHEN pra.status = 'completed' THEN pra.reviewer_id END) as completed_reviews,
      COUNT(DISTINCT CASE WHEN pra.status = 'approved' THEN pra.reviewer_id END) as approved_reviews
    FROM project_reviews pr
    LEFT JOIN users u ON pr.author_id = u.id
    LEFT JOIN wiki_revisions wr ON pr.revision_id = wr.id
    LEFT JOIN project_review_assignments pra ON pr.id = pra.review_id
    ${whereClause}
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `
    )
    .all(...queryParams);

  return NextResponse.json({
    reviews,
    metadata: { project_slug: slug, filters: { status, reviewer_id } },
  });
};
```

### 5.2 Review Submission and Approval

```typescript
// /api/projects/[slug]/reviews/[id]/submit/route.ts

export const POST = withSecurity(
  async (request, { params }) => {
    const db = dbPool.getConnection('forums');
    const {
      decision, // 'approved', 'needs_changes', 'rejected'
      comments,
      inline_comments = [],
      suggested_changes = [],
    } = await request.json();

    const reviewId = params.id;

    const submissionId = db.transaction(() => {
      // Update review assignment
      db.prepare(
        `
      UPDATE project_review_assignments 
      SET status = ?, decision = ?, comments = ?, 
          submitted_at = CURRENT_TIMESTAMP
      WHERE review_id = ? AND reviewer_id = ?
    `
      ).run('completed', decision, comments, reviewId, userId);

      // Add inline comments
      inline_comments.forEach((comment) => {
        db.prepare(
          `
        INSERT INTO review_inline_comments (
          review_id, reviewer_id, line_number, comment_text,
          severity, created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
        ).run(reviewId, userId, comment.line_number, comment.text, comment.severity || 'info');
      });

      // Add suggested changes
      suggested_changes.forEach((change) => {
        db.prepare(
          `
        INSERT INTO review_suggested_changes (
          review_id, reviewer_id, start_line, end_line,
          original_content, suggested_content, reason,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
        ).run(
          reviewId,
          userId,
          change.start_line,
          change.end_line,
          change.original,
          change.suggested,
          change.reason
        );
      });

      // Check if all reviews are complete
      const reviewStatus = checkReviewCompletionStatus(reviewId);

      if (reviewStatus.all_complete) {
        // Update main review status
        db.prepare(
          `
        UPDATE project_reviews 
        SET status = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
        ).run(reviewStatus.final_decision, reviewId);

        // Notify author of review completion
        const review = db.prepare('SELECT * FROM project_reviews WHERE id = ?').get(reviewId);
        createNotification({
          user_id: review.author_id,
          type: 'review_completed',
          title: 'Review Completed',
          message: `Your review request has been ${reviewStatus.final_decision}`,
          entity_type: 'project_review',
          entity_id: reviewId,
          metadata: {
            project_slug: slug,
            decision: reviewStatus.final_decision,
            approved_count: reviewStatus.approved_count,
            total_reviewers: reviewStatus.total_reviewers,
          },
        });
      }

      return { reviewStatus, submissionId: Date.now() };
    })();

    return NextResponse.json({
      success: true,
      review_submitted: true,
      review_status: submissionId.reviewStatus,
    });
  },
  {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitConfig: 'api',
  }
);
```

## 6. Activity Feed Integration

### 6.1 Project Activity Stream

```typescript
// /api/projects/[slug]/activity/route.ts

export const GET = async (request, { params }) => {
  const db = dbPool.getConnection('forums');
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const activity_type = searchParams.get('type');
  const since = searchParams.get('since');

  let whereClause = 'WHERE pa.project_slug = ?';
  const queryParams = [slug];

  if (activity_type) {
    whereClause += ' AND pa.activity_type = ?';
    queryParams.push(activity_type);
  }

  if (since) {
    whereClause += ' AND pa.created_at > ?';
    queryParams.push(since);
  }

  const activities = db
    .prepare(
      `
    SELECT 
      pa.*,
      u.username, u.display_name, u.avatar_url,
      -- Get related object details based on activity type
      CASE 
        WHEN pa.activity_type LIKE '%revision%' THEN (
          SELECT json_object(
            'id', wr.id,
            'summary', wr.summary,
            'timestamp', wr.revision_timestamp
          ) FROM wiki_revisions wr WHERE wr.id = json_extract(pa.metadata, '$.revision_id')
        )
        WHEN pa.activity_type LIKE '%discussion%' THEN (
          SELECT json_object(
            'id', pd.id,
            'title', pd.title,
            'type', pd.discussion_type
          ) FROM project_discussions pd WHERE pd.id = json_extract(pa.metadata, '$.discussion_id')
        )
        WHEN pa.activity_type LIKE '%review%' THEN (
          SELECT json_object(
            'id', pr.id,
            'type', pr.review_type,
            'status', pr.status
          ) FROM project_reviews pr WHERE pr.id = json_extract(pa.metadata, '$.review_id')
        )
        ELSE NULL
      END as related_object
    FROM project_activities pa
    LEFT JOIN users u ON pa.user_id = u.id
    ${whereClause}
    ORDER BY pa.created_at DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(...queryParams, limit, offset);

  // Process activities to include parsed metadata and related objects
  const processedActivities = activities.map((activity) => ({
    ...activity,
    metadata: JSON.parse(activity.metadata || '{}'),
    related_object: activity.related_object ? JSON.parse(activity.related_object) : null,
  }));

  return NextResponse.json({
    activities: processedActivities,
    pagination: {
      limit,
      offset,
      hasMore: activities.length === limit,
    },
    metadata: {
      project_slug: slug,
      filters: { activity_type, since },
    },
  });
};
```

## 7. Notification Integration Enhancements

### 7.1 Project-Specific Notifications

```typescript
// Extend existing /api/notifications/route.ts with project-specific logic

// Add project notification preferences
export const projectNotificationTypes = [
  'project_revision_added',
  'project_discussion_created',
  'project_discussion_reply',
  'project_annotation_added',
  'project_review_requested',
  'project_review_completed',
  'project_collaborator_added',
  'project_milestone_reached',
];

// Enhanced notification creation for projects
export function createProjectNotification({
  project_slug,
  recipient_ids,
  type,
  title,
  message,
  entity_type,
  entity_id,
  actor_id,
  priority = 'normal',
  metadata = {},
}) {
  const db = dbPool.getConnection('forums');

  // Check notification preferences for each recipient
  const notifications = recipient_ids
    .map((recipient_id) => {
      const preferences = getUserNotificationPreferences(recipient_id);

      if (!preferences[type]?.enabled) {
        return null; // Skip if notifications disabled for this type
      }

      return {
        user_id: recipient_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        priority,
        metadata: {
          ...metadata,
          project_slug,
          actor_id,
        },
      };
    })
    .filter(Boolean);

  // Batch insert notifications
  if (notifications.length > 0) {
    const transaction = db.transaction(() => {
      notifications.forEach((notification) => {
        db.prepare(
          `
          INSERT INTO notifications (
            user_id, type, title, message, entity_type, entity_id,
            priority, metadata, created_at, read_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, FALSE)
        `
        ).run(
          notification.user_id,
          notification.type,
          notification.title,
          notification.message,
          notification.entity_type,
          notification.entity_id,
          notification.priority,
          JSON.stringify(notification.metadata)
        );
      });
    });

    transaction();
  }

  return notifications.length;
}
```

## 8. Security Patterns for Collaborative Access

### 8.1 Project-Level Permissions

```typescript
// /lib/projects/permissions.ts

export interface ProjectPermissions {
  can_view: boolean;
  can_edit: boolean;
  can_review: boolean;
  can_manage_collaborators: boolean;
  can_delete: boolean;
  can_create_discussions: boolean;
  can_moderate_discussions: boolean;
}

export async function getProjectPermissions(
  project_slug: string,
  user_id: number
): Promise<ProjectPermissions> {
  const db = dbPool.getConnection('forums');

  // Get project and user role
  const projectInfo = db
    .prepare(
      `
    SELECT 
      p.*,
      pc.role as collaboration_role,
      u.role as user_role
    FROM projects p
    LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = ?
    LEFT JOIN users u ON u.id = ?
    WHERE p.slug = ?
  `
    )
    .get(user_id, user_id, project_slug);

  if (!projectInfo) {
    return defaultDenyPermissions();
  }

  // Permission matrix based on project visibility and user role
  const permissions: ProjectPermissions = {
    can_view: checkViewPermission(projectInfo),
    can_edit: checkEditPermission(projectInfo),
    can_review: checkReviewPermission(projectInfo),
    can_manage_collaborators: checkManagePermission(projectInfo),
    can_delete: checkDeletePermission(projectInfo),
    can_create_discussions: checkDiscussionPermission(projectInfo),
    can_moderate_discussions: checkModerationPermission(projectInfo),
  };

  return permissions;
}

// Permission middleware for project routes
export function withProjectPermissions(requiredPermission: keyof ProjectPermissions) {
  return withSecurity(
    async (request, context) => {
      const { slug } = await context.params;
      const authResult = await requireAuth(request);

      if (authResult.response) {
        return authResult.response;
      }

      const permissions = await getProjectPermissions(slug, authResult.user.id);

      if (!permissions[requiredPermission]) {
        return NextResponse.json(
          {
            error: 'Insufficient permissions',
            required_permission: requiredPermission,
            user_permissions: permissions,
          },
          { status: 403 }
        );
      }

      // Add permissions to request context
      request.projectPermissions = permissions;
      return NextResponse.next();
    },
    {
      requireAuth: true,
      csrfEnabled: true,
      rateLimitConfig: 'api',
    }
  );
}
```

## 9. Performance Optimization Strategies

### 9.1 Caching and Query Optimization

```typescript
// /lib/projects/cache.ts

import { createLRUCache } from '@/lib/cache/lru';

// Project-specific caches
const projectMetadataCache = createLRUCache<string, ProjectMetadata>(100, 300000); // 5 min
const revisionDiffCache = createLRUCache<string, DiffResult>(50, 600000); // 10 min
const collaboratorCache = createLRUCache<string, ProjectCollaborator[]>(100, 180000); // 3 min

// Cached project operations
export class CachedProjectService {
  async getProjectWithCache(slug: string): Promise<ProjectMetadata | null> {
    const cached = projectMetadataCache.get(slug);
    if (cached) return cached;

    const project = await this.getProjectMetadata(slug);
    if (project) {
      projectMetadataCache.set(slug, project);
    }

    return project;
  }

  async getDiffWithCache(
    revisionA: string,
    revisionB: string,
    options: DiffOptions = {}
  ): Promise<DiffResult> {
    const cacheKey = `${revisionA}:${revisionB}:${JSON.stringify(options)}`;
    const cached = revisionDiffCache.get(cacheKey);
    if (cached) return cached;

    const diff = await this.generateDiff(revisionA, revisionB, options);
    revisionDiffCache.set(cacheKey, diff);

    return diff;
  }

  async getCollaboratorsWithCache(slug: string): Promise<ProjectCollaborator[]> {
    const cached = collaboratorCache.get(slug);
    if (cached) return cached;

    const collaborators = await this.getProjectCollaborators(slug);
    collaboratorCache.set(slug, collaborators);

    return collaborators;
  }
}

// Database query optimization
export const optimizedQueries = {
  // Use prepared statements with proper indexes
  getRevisionsWithDiff: db.prepare(`
    SELECT 
      wr1.id, wr1.summary, wr1.revision_timestamp,
      wr1.content_hash, wr1.size_bytes,
      u.username, u.display_name,
      -- Calculate diff stats without loading full content
      CASE WHEN wr2.id IS NOT NULL THEN
        json_object(
          'lines_added', (wr1.size_bytes - wr2.size_bytes) / 50,
          'estimated_changes', abs(wr1.size_bytes - wr2.size_bytes) / 20
        )
      ELSE NULL END as diff_stats
    FROM wiki_revisions wr1
    LEFT JOIN wiki_revisions wr2 ON wr2.id = (
      SELECT id FROM wiki_revisions 
      WHERE wiki_page_id = wr1.wiki_page_id 
        AND id < wr1.id 
      ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN users u ON wr1.author_id = u.id
    WHERE wr1.wiki_page_id = ?
    ORDER BY wr1.revision_timestamp DESC
    LIMIT ? OFFSET ?
  `),

  // Efficiently get discussion counts
  getDiscussionSummary: db.prepare(`
    SELECT 
      COUNT(*) as total_discussions,
      COUNT(CASE WHEN pd.status = 'active' THEN 1 END) as active_discussions,
      COUNT(CASE WHEN pd.created_at > datetime('now', '-7 days') THEN 1 END) as recent_discussions
    FROM project_discussions pd
    WHERE pd.project_slug = ?
  `),
};
```

### 9.2 Rate Limiting for Collaborative Operations

```typescript
// Enhanced rate limiting configurations for collaborative features
export const collaborativeRateLimits = {
  revision_creation: {
    windowMs: 60000, // 1 minute
    maxRequests: 5, // Max 5 revisions per minute
    message: 'Too many revisions created. Please wait before creating another.',
  },

  discussion_creation: {
    windowMs: 300000, // 5 minutes
    maxRequests: 10, // Max 10 discussions per 5 minutes
    message: 'Discussion creation rate limit exceeded.',
  },

  annotation_creation: {
    windowMs: 60000, // 1 minute
    maxRequests: 20, // Max 20 annotations per minute
    message: 'Annotation rate limit exceeded.',
  },

  review_submission: {
    windowMs: 300000, // 5 minutes
    maxRequests: 5, // Max 5 review submissions per 5 minutes
    message: 'Review submission rate limit exceeded.',
  },

  real_time_updates: {
    windowMs: 60000, // 1 minute
    maxRequests: 120, // Max 120 presence updates per minute (2 per second)
    message: 'Real-time update rate limit exceeded.',
  },
};
```

## 10. API Versioning and Backward Compatibility

### 10.1 Versioned API Structure

```typescript
// /api/v2/projects/[slug]/collaboration/route.ts
// New collaborative endpoints with version prefix

// Maintain backward compatibility
// /api/projects/[slug]/revisions - Original API (unchanged)
// /api/v2/projects/[slug]/revisions - Enhanced API with collaboration features

export const apiVersionConfig = {
  v1: {
    features: ['basic_revisions', 'simple_diff'],
    deprecated_date: '2025-12-01',
    sunset_date: '2026-06-01',
  },
  v2: {
    features: [
      'collaborative_discussions',
      'real_time_updates',
      'advanced_diff',
      'approval_workflows',
      'activity_feeds',
      'semantic_analysis',
    ],
    default: true,
  },
};

// Version detection middleware
export function withAPIVersioning(handler: Function) {
  return async (request: NextRequest, context: any) => {
    const version = detectAPIVersion(request);
    const config = apiVersionConfig[version];

    if (!config) {
      return NextResponse.json({ error: 'Unsupported API version' }, { status: 400 });
    }

    if (config.deprecated_date && new Date() > new Date(config.deprecated_date)) {
      // Add deprecation headers
      const response = await handler(request, context);
      response.headers.set('API-Version', version);
      response.headers.set('API-Deprecated', 'true');
      response.headers.set('API-Sunset-Date', config.sunset_date);
      return response;
    }

    return handler(request, context);
  };
}
```

## 11. Error Handling and Resilience

### 11.1 Comprehensive Error Handling

```typescript
// /lib/projects/errorHandling.ts

export class ProjectAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: any
  ) {
    super(message);
    this.name = 'ProjectAPIError';
  }
}

export const projectErrorCodes = {
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  REVISION_NOT_FOUND: 'REVISION_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  REVIEW_ALREADY_SUBMITTED: 'REVIEW_ALREADY_SUBMITTED',
  DISCUSSION_LOCKED: 'DISCUSSION_LOCKED',
  MERGE_CONFLICT: 'MERGE_CONFLICT',
  DIFF_TOO_LARGE: 'DIFF_TOO_LARGE',
  REAL_TIME_CONNECTION_FAILED: 'REAL_TIME_CONNECTION_FAILED',
};

// Global error handler for project APIs
export function withProjectErrorHandling(handler: Function) {
  return async (request: NextRequest, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('Project API Error:', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof ProjectAPIError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            metadata: error.metadata,
          },
          { status: error.statusCode }
        );
      }

      // Database connection errors
      if (error.message.includes('database')) {
        return NextResponse.json(
          {
            error: 'Database temporarily unavailable',
            code: 'DATABASE_ERROR',
            retry_after: 30,
          },
          { status: 503 }
        );
      }

      // Generic error
      return NextResponse.json(
        {
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      );
    }
  };
}
```

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

1. Database schema additions for collaborative features
2. Basic discussion threads for revisions
3. Enhanced diff API with semantic analysis
4. Permission system implementation

### Phase 2: Real-time Features (Week 3-4)

1. WebSocket/SSE integration for live updates
2. Presence indicators and collaborative editing
3. Real-time notifications for project activities

### Phase 3: Advanced Collaboration (Week 5-6)

1. Annotation and inline comment system
2. Review and approval workflows
3. Activity feed integration
4. Advanced conflict resolution

### Phase 4: Optimization & Polish (Week 7-8)

1. Performance optimizations and caching
2. Comprehensive error handling
3. API versioning implementation
4. Security auditing and testing

This comprehensive API architecture transforms your basic project versioning into a full collaborative platform while maintaining seamless integration with your existing forum, messaging, and notification systems. All endpoints follow your established security patterns using `withSecurity()` middleware, connection pooling with `dbPool`, and consistent error handling.
