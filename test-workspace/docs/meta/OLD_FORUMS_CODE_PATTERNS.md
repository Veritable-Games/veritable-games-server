# OLD FORUMS v0.36 - CODE PATTERNS & EXAMPLES

## 1. SERVICE USAGE PATTERNS

### Creating Topics
```typescript
import { forumServices } from '@/lib/forums/services';

const newTopic = await forumServices.topics.createTopic(
  {
    category_id: 'general',
    title: 'My Question',
    content: 'Detailed content here',
    is_pinned: false,
    status: 'open'
  },
  userId // Current user ID
);
```

### Getting Topics with Filters
```typescript
const topics = await forumServices.topics.getTopics({
  category_id: 'general',
  sort: 'recent',
  limit: 20,
  offset: 0
});

// Alternative with category slug
const topicsBySlug = await forumServices.topics.getTopics({
  category_slug: 'general-discussion',
  sort: 'popular',
  limit: 10
});
```

### Nested Reply Tree
```typescript
const allReplies = await forumServices.replies.getRepliesByTopicId(topicId);

// Returns nested structure:
// [
//   { id: 1, content: '...', replies: [
//       { id: 2, content: '...', replies: [...] },
//       { id: 3, content: '...', replies: [...] }
//     ]
//   },
//   { id: 4, content: '...', replies: [] }
// ]
```

### Category Operations
```typescript
// Get all categories with aggregated stats
const categories = await forumServices.categories.getCategories();

// Get single category by slug
const category = await forumServices.categories.getCategoryById('general');

// Get by numeric ID
const categoryById = await forumServices.categories.getCategoryById(1);

// Get categories by section
const socialContract = await forumServices.categories.getCategoriesBySection('Social Contract');

// Get active categories with recent activity
const active = await forumServices.categories.getActiveCategoriesWithRecentActivity(10);
```

### Solution Marking
```typescript
// Mark reply as solution
await forumServices.replies.markAsSolution(replyId, topicId);

// Unmark solution
await forumServices.replies.unmarkAsSolution(replyId, topicId);

// Updates topic's is_solved flag automatically
```

### Search Operations
```typescript
// Full-text search across forums
const results = await forumServices.search.searchTopics('authentication', {
  category_id: 'technical',
  limit: 20
});

// Search with tags filter
const taggedResults = await forumServices.search.searchTopics('api', {
  tag_ids: [1, 2, 3],
  sort: 'recent'
});
```

### Analytics
```typescript
// Global forum statistics
const stats = await forumServices.analytics.getForumStats();
// Returns: {
//   total_topics: 23,
//   total_replies: 90,
//   total_users: 15,
//   active_users_today: 8,
//   recent_topics: [...],
//   popular_categories: [...]
// }

// User-specific stats
const userStats = await forumServices.analytics.getUserForumStats(userId);
// Returns: {
//   total_topics: 3,
//   total_replies: 15,
//   recent_topics: [...]
// }

// Top contributors
const topContributors = await forumServices.analytics.getTopContributors(5);

// Category activity
const activity = await forumServices.analytics.getCategoryActivity();
```

---

## 2. API ROUTE PATTERNS

### Standard Create Route
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { forumServices } from '@/lib/forums/services';
import { withSecurity } from '@/lib/security/middleware';
import { safeParseRequest, CreateTopicDTOSchema } from '@/lib/forums/validation-schemas';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // 1. Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      throw new AuthenticationError();
    }

    // 2. Validate request body
    const bodyResult = await safeParseRequest(request, CreateTopicDTOSchema);
    if (bodyResult.isErr()) {
      throw new ValidationError(
        bodyResult.error.message,
        { fields: bodyResult.error.details }
      );
    }

    // 3. Business logic
    const { category_id, title, content, is_pinned, tags } = bodyResult.value;
    const topic = await forumServices.topics.createTopic(
      { category_id, title, content, is_pinned },
      user.id
    );

    // 4. Add tags if provided
    if (tags && tags.length > 0) {
      await forumTagService.addTopicTags(topic.id, tags);
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: { topic }
    });
  } catch (error) {
    return errorResponse(error);
  }
});
```

### Standard Get Route with Pagination
```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    
    // Parse and validate search params
    const paramsResult = safeParseSearchParams(
      searchParams,
      SearchTopicsDTOSchema
    );

    if (paramsResult.isErr()) {
      throw new ValidationError(
        paramsResult.error.message,
        { fields: paramsResult.error.details }
      );
    }

    // Get data
    const topics = await forumServices.topics.getTopics(paramsResult.value);

    return NextResponse.json({
      success: true,
      data: { topics }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

### Route with Permission Check
```typescript
export const DELETE = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    // Get topic to check ownership
    const topicId = parseInt(params.id);
    const topic = await forumServices.topics.getTopicById(topicId, false);
    
    if (!topic) {
      throw new NotFoundError('Topic', topicId);
    }

    // Check permissions
    const isAdmin = user.role === 'admin';
    if (topic.user_id !== user.id && !isAdmin) {
      throw new PermissionError('Only topic owner or admins can delete');
    }

    // Proceed with deletion
    const success = await forumServices.topics.deleteTopic(topicId, user.id);
    
    return NextResponse.json({
      success: true,
      data: { deleted: success }
    });
  } catch (error) {
    return errorResponse(error);
  }
});
```

---

## 3. COMPONENT PATTERNS

### Category Display Component
```typescript
'use client';

import { ForumCategory } from '@/lib/forums/types';
import Link from 'next/link';

interface ForumCategoryListProps {
  categories: ForumCategory[];
}

export function ForumCategoryList({ categories }: ForumCategoryListProps) {
  // Group by section
  const grouped = categories.reduce((acc, cat) => {
    const section = cat.section || 'Miscellaneous';
    if (!acc[section]) acc[section] = [];
    acc[section].push(cat);
    return acc;
  }, {} as Record<string, ForumCategory[]>);

  // Render with section header
  return (
    <div className="space-y-4">
      {['Social Contract', 'Noxii Game', 'Autumn Project', 'Miscellaneous'].map((section) => {
        const sectionCats = grouped[section];
        if (!sectionCats?.length) return null;

        return (
          <div key={section} className="bg-gray-900/30 border border-gray-700 rounded">
            <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
              <h2 className="font-semibold text-white">{section}</h2>
              <p className="text-xs text-gray-400">
                {sectionCats.reduce((a, c) => a + (c.topic_count || 0), 0)} topics •
                {sectionCats.reduce((a, c) => a + (c.post_count || 0), 0)} posts
              </p>
            </div>

            <div className="divide-y divide-gray-700">
              {sectionCats.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/forums/category/${cat.slug}`}
                  className="block p-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <h3 className="font-medium text-white">{cat.name}</h3>
                      <p className="text-xs text-gray-400">{cat.description}</p>
                    </div>
                    <div className="col-span-2 text-center text-blue-400">
                      {cat.topic_count || 0}
                    </div>
                    <div className="col-span-2 text-center text-green-400">
                      {cat.post_count || 0}
                    </div>
                    <div className="col-span-2 text-right text-xs text-gray-500">
                      {cat.last_activity_at
                        ? new Date(cat.last_activity_at).toLocaleDateString()
                        : 'No activity'
                      }
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Topic Row Component
```typescript
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface TopicRowProps {
  topic: {
    id: number;
    title: string;
    username: string;
    created_at: string;
    reply_count: number;
    view_count: number;
    is_pinned?: boolean;
    is_locked?: boolean;
    is_solved?: boolean;
    last_reply_at?: string;
    last_reply_username?: string;
  };
}

export function TopicRow({ topic }: TopicRowProps) {
  return (
    <Link href={`/forums/topic/${topic.id}`}>
      <div className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-800/30 transition-colors">
        {/* Title with badges */}
        <div className="col-span-6 flex items-center gap-2">
          <span>
            {topic.is_pinned && '📌'}
            {topic.is_solved && '✓'}
            {topic.is_locked && '🔒'}
          </span>
          <div>
            <h4 className="font-medium text-white hover:text-blue-400">
              {topic.title}
            </h4>
            <p className="text-xs text-gray-500">
              by {topic.username} • {formatDistanceToNow(new Date(topic.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="col-span-2 text-center text-gray-200">
          {topic.reply_count}
        </div>
        <div className="col-span-2 text-center text-gray-200">
          {topic.view_count}
        </div>

        {/* Last Activity */}
        <div className="col-span-2 text-right text-xs text-gray-500">
          {topic.last_reply_at ? (
            <>
              <div>{formatDistanceToNow(new Date(topic.last_reply_at), { addSuffix: true })}</div>
              <div>by {topic.last_reply_username}</div>
            </>
          ) : (
            'No replies'
          )}
        </div>
      </div>
    </Link>
  );
}
```

---

## 4. DATABASE QUERY PATTERNS

### Getting Categories with Stats (Aggregation)
```sql
SELECT
  fc.id,
  fc.name,
  fc.slug,
  fc.description,
  COUNT(DISTINCT ft.id) as topic_count,
  COUNT(DISTINCT fr.id) as post_count,
  MAX(COALESCE(fr.updated_at, ft.updated_at, ft.created_at)) as last_activity_at
FROM forum_categories fc
LEFT JOIN forum_topics ft ON fc.id = ft.category_id
LEFT JOIN forum_replies fr ON ft.id = fr.topic_id
GROUP BY fc.id
ORDER BY
  CASE fc.section
    WHEN 'Social Contract' THEN 1
    WHEN 'Noxii Game' THEN 2
    WHEN 'Autumn Project' THEN 3
    WHEN 'Miscellaneous' THEN 4
    ELSE 5
  END,
  fc.sort_order, fc.name
```

### Building Nested Reply Tree (Recursive CTE)
```sql
WITH RECURSIVE reply_tree AS (
  -- Base case: top-level replies
  SELECT
    fr.*,
    PRINTF('%08d', fr.id) as sort_path,
    0 as depth,
    fr.created_at as thread_start
  FROM forum_replies fr
  WHERE fr.topic_id = ?
    AND (fr.parent_id IS NULL OR fr.parent_id = 0)

  UNION ALL

  -- Recursive case: child replies
  SELECT
    fr.*,
    rt.sort_path || '.' || PRINTF('%08d', fr.id) as sort_path,
    rt.depth + 1 as depth,
    rt.thread_start
  FROM forum_replies fr
  INNER JOIN reply_tree rt ON fr.parent_id = rt.id
  WHERE fr.topic_id = ?
)
SELECT * FROM reply_tree
ORDER BY thread_start, sort_path
```

### Searching with Dynamic SQL
```typescript
let sql = `
  SELECT ft.*, fc.name as category_name, fc.color as category_color
  FROM forum_topics ft
  LEFT JOIN forum_categories fc ON ft.category_id = fc.id
  WHERE 1=1
`;
const params = [];

if (categoryId) {
  sql += ' AND ft.category_id = ?';
  params.push(categoryId);
}

if (query) {
  sql += ' AND (ft.title LIKE ? OR ft.content LIKE ?)';
  params.push(`%${query}%`, `%${query}%`);
}

if (status) {
  sql += ' AND ft.status = ?';
  params.push(status);
}

// Add sorting
switch (sort) {
  case 'recent':
    sql += ' ORDER BY ft.is_pinned DESC, ft.updated_at DESC';
    break;
  case 'popular':
    sql += ' ORDER BY ft.is_pinned DESC, ft.reply_count DESC, ft.view_count DESC';
    break;
  case 'replies':
    sql += ' ORDER BY ft.is_pinned DESC, ft.reply_count DESC';
    break;
}

sql += ' LIMIT ? OFFSET ?';
params.push(limit, offset);

const stmt = db.prepare(sql);
const results = stmt.all(...params);
```

---

## 5. VALIDATION PATTERNS

### Zod Schema Usage
```typescript
import { z } from 'zod';

const CreateTopicSchema = z.object({
  category_id: z.union([z.string(), z.number()]),
  title: z.string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  content: z.string()
    .trim()
    .min(10, 'Content must be at least 10 characters')
    .max(50000, 'Content cannot exceed 50,000 characters'),
  is_pinned: z.boolean().optional().default(false),
  tags: z.array(z.number().int().positive()).max(10).optional()
});

// Usage
const result = CreateTopicSchema.safeParse(data);
if (!result.success) {
  console.log(result.error.issues);
  // [{ path: ['title'], message: 'Title must be at least 3 characters', ... }]
}
```

### Safe Request Parsing
```typescript
const bodyResult = await safeParseRequest(request, CreateTopicDTOSchema);

if (bodyResult.isErr()) {
  // Handle error
  const error = bodyResult.error;
  // { message: '...', details: [...] }
  throw new ValidationError(error.message, { fields: error.details });
}

const validated = bodyResult.value;
// Now has type safety and is validated
```

---

## 6. CACHING PATTERNS

### Manual Cache Management
```typescript
import { cache } from '@/lib/cache';

// Get or set
const categories = await cache.cache(
  ['forum', 'categories'],
  async () => {
    return forumServices.categories.getCategories();
  },
  'content',  // cache destination
  'forums'    // invalidation key
);

// Manual invalidation
cache.delete(['forum', 'topics']);
cache.delete(['forum', 'category', categoryId.toString()]);
```

### Reply Tree Cache
```typescript
import { replyTreeCache } from '@/lib/cache/replyTreeCache';

// Check cache first
const cached = replyTreeCache.get(topicId);
if (cached) {
  return cached;
}

// Fetch from database
const replies = await db.prepare(...).all(topicId);

// Cache for next time
replyTreeCache.set(topicId, replies, rawReplies);

// Invalidate when topic updated
replyTreeCache.invalidate(topicId);
```

---

## 7. ERROR HANDLING PATTERNS

### Custom Error Classes
```typescript
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  PermissionError,
  ConflictError
} from '@/lib/utils/api-errors';

// Usage
if (!user) {
  throw new AuthenticationError('User not logged in');
}

if (!topic) {
  throw new NotFoundError('Topic', topicId);
}

if (topic.user_id !== userId && !isAdmin) {
  throw new PermissionError('Only owner can delete');
}

const result = schema.safeParse(data);
if (!result.success) {
  throw new ValidationError('Invalid topic data', {
    fields: result.error.issues
  });
}

// Returns appropriate HTTP status codes automatically
return errorResponse(error);
```

---

## 8. TYPE SAFETY PATTERNS

### Branded Types
```typescript
// Types are branded to prevent misuse
export type TopicId = number & { readonly __brand: 'TopicId' };
export type ReplyId = number & { readonly __brand: 'ReplyId' };
export type CategoryId = string & { readonly __brand: 'CategoryId' };

// Constructor functions ensure type safety
export const toTopicId = (id: number): TopicId => id as TopicId;
export const toReplyId = (id: number): ReplyId => id as ReplyId;
export const toCategoryId = (id: string): CategoryId => id as CategoryId;

// Usage prevents accidents
const topicId: TopicId = toTopicId(123);
const topic = await forumServices.topics.getTopicById(topicId);

// This would be type error:
// const topic = await forumServices.topics.getTopicById(categoryId); // ✗
```

---

## SUMMARY OF PATTERNS

1. **Services**: Always use singleton factory (forumServices), avoid creating new instances
2. **API Routes**: withSecurity wrapper → authenticate → validate → execute → errorResponse
3. **Validation**: Use Zod schemas + safeParseRequest for type safety
4. **Database**: Avoid cross-DB joins, materialize fields, use CTEs for recursion
5. **Caching**: Invalidate strategically on mutations
6. **Error Handling**: Use custom error classes, they map to HTTP status codes
7. **Types**: Use branded types for compile-time safety
8. **Components**: Memoize for performance, separate concerns

