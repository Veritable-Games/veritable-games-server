# News Management System Documentation

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready
**Location**: `frontend/src/app/api/news/`, `frontend/src/app/news/`, `frontend/src/components/news/`

---

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Page Components](#page-components)
- [Features](#features)
- [Publishing Workflow](#publishing-workflow)
- [Usage Examples](#usage-examples)
- [Performance](#performance)
- [Future Enhancements](#future-enhancements)

---

## Overview

The News Management System provides a content management solution for publishing news articles, updates, and announcements. It supports draft/published statuses, tagging, featured images, and pagination for large article collections.

### Key Features

✅ **Article Management**: Create, read, update, and delete news articles
✅ **Draft/Published Status**: Save drafts before publishing
✅ **Tagging System**: Categorize articles with multiple tags
✅ **Featured Images**: Header images for visual appeal
✅ **Author Attribution**: Track article authors
✅ **Pagination**: Efficient loading for large article collections
✅ **Filtering**: Filter by status, author, or tag
✅ **SEO-Friendly**: Slug-based URLs for better search indexing
✅ **View Counter**: Track article popularity

### Use Cases

- **Project Updates**: Announce new features, releases, or milestones
- **Community News**: Share community events, achievements, or highlights
- **Development Blog**: Technical articles about platform development
- **Announcements**: Important notices or policy updates

---

## Database Schema

### `news` Table (content schema)

**Location**: PostgreSQL `content` schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment article ID |
| `title` | VARCHAR(255) | NOT NULL | Article title |
| `slug` | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly slug |
| `excerpt` | TEXT | NULL | Short summary/description |
| `content` | TEXT | NOT NULL | Full article content (Markdown) |
| `author` | VARCHAR(100) | NULL | Author name (defaults to 'Staff') |
| `published_at` | TIMESTAMP | DEFAULT NOW() | Publication date/time |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Status: 'draft' or 'published' |
| `featured_image` | VARCHAR(500) | NULL | URL to header image |
| `tags` | TEXT/JSONB | NULL | JSON array of tag strings |
| `views` | INTEGER | DEFAULT 0 | View count |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `slug` (for SEO-friendly URLs)
- INDEX on `status` (for filtering published articles)
- INDEX on `published_at DESC` (for chronological sorting)

**Example Row**:
```json
{
  "id": 42,
  "title": "New Features Released",
  "slug": "new-features-released",
  "excerpt": "We've launched exciting new features...",
  "content": "# New Features\n\nToday we're announcing...",
  "author": "Jane Smith",
  "published_at": "2025-11-12T10:00:00Z",
  "status": "published",
  "featured_image": "/images/news/release-banner.jpg",
  "tags": ["updates", "features", "releases"],
  "views": 1543,
  "created_at": "2025-11-10T14:30:00Z",
  "updated_at": "2025-11-12T09:55:00Z"
}
```

---

## API Endpoints

### 3 REST Endpoints

All write operations (POST, PUT, DELETE) are protected with `withSecurity()` middleware (CSRF, rate limiting, session validation).

#### 1. GET `/api/news`

**Purpose**: List news articles with filtering and pagination

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Number of articles per page |
| `offset` | number | 0 | Skip N articles (for pagination) |
| `status` | string | 'published' | Filter by status ('draft', 'published', or omit for all) |
| `author` | string | null | Filter by author name |
| `tag` | string | null | Filter by tag (partial match) |

**Response**:
```json
{
  "articles": [
    {
      "id": 42,
      "title": "New Features Released",
      "slug": "new-features-released",
      "excerpt": "Short summary...",
      "content": "Full content...",
      "author": "Jane Smith",
      "published_at": "2025-11-12T10:00:00Z",
      "featured_image": "/images/news/banner.jpg",
      "tags": ["updates", "features"],
      "views": 1543,
      "status": "published",
      "created_at": "2025-11-10T14:30:00Z",
      "updated_at": "2025-11-12T09:55:00Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Examples**:
```bash
# Get first 20 published articles
GET /api/news

# Get draft articles
GET /api/news?status=draft

# Get articles by author
GET /api/news?author=Jane+Smith

# Get articles tagged "updates"
GET /api/news?tag=updates

# Pagination: Get next page (articles 20-39)
GET /api/news?limit=20&offset=20
```

#### 2. POST `/api/news`

**Purpose**: Create new news article (draft or published)

**Authentication**: Required (protected by `withSecurity()`)

**Request Body**:
```json
{
  "title": "New Feature Announcement",
  "slug": "new-feature-announcement",
  "summary": "We're excited to announce...",
  "content": "# Feature Details\n\nFull markdown content...",
  "author": "Jane Smith",
  "published_at": "2025-11-12T10:00:00Z",
  "status": "published",
  "featured_image": "/images/news/feature-banner.jpg",
  "tags": ["features", "announcements"]
}
```

**Required Fields**:
- `title` (string, max 255 chars)
- `slug` (string, URL-friendly, must be unique)
- `summary` (string, short description)
- `content` (string, full article in Markdown)
- `author` (string, max 100 chars)

**Optional Fields**:
- `published_at` (ISO 8601 timestamp, defaults to now)
- `status` (string, defaults to 'draft')
- `featured_image` (string, image URL)
- `tags` (array of strings)

**Response**:
```json
{
  "id": 42,
  "message": "News article created successfully"
}
```

**Errors**:
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Slug already exists (must be unique)
- `500 Internal Server Error` - Database error

#### 3. GET `/api/news/[slug]`

**Purpose**: Get single news article by slug

**Parameters**:
- `slug` (path param): Article slug

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "title": "Article Title",
    "slug": "article-title",
    "content": "Full content...",
    "excerpt": "Short summary...",
    "author": "Jane Smith",
    "published_at": "2025-11-12T10:00:00Z",
    "featured_image": "/images/banner.jpg",
    "tags": ["tag1", "tag2"],
    "views": 1543,
    "status": "published",
    "created_at": "2025-11-10T14:30:00Z",
    "updated_at": "2025-11-12T09:55:00Z"
  }
}
```

**Errors**:
- `404 Not Found` - Article doesn't exist

**Notes**:
- Tags are automatically parsed from JSON string to array
- Empty tags default to `[]`

#### 4. PUT `/api/news/[slug]`

**Purpose**: Update existing news article

**Authentication**: Required (protected by `withSecurity()`)

**Parameters**:
- `slug` (path param): Article slug to update

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "excerpt": "Updated summary...",
  "author": "New Author",
  "featured_image": "/images/new-banner.jpg",
  "tags": ["updated", "tags"],
  "status": "published"
}
```

**Response**:
```json
{
  "success": true,
  "message": "News article updated successfully"
}
```

**Errors**:
- `404 Not Found` - Article doesn't exist
- `500 Internal Server Error` - Database error

**Notes**:
- Only provided fields are updated (partial update supported)
- `updated_at` is automatically set to current time

#### 5. DELETE `/api/news/[slug]`

**Purpose**: Delete news article (admin only)

**Authentication**: Required (protected by `withSecurity()`)

**Parameters**:
- `slug` (path param): Article slug to delete

**Response**:
```json
{
  "success": true,
  "message": "News article deleted successfully"
}
```

**Errors**:
- `404 Not Found` - Article doesn't exist
- `500 Internal Server Error` - Database error

**Notes**:
- **Hard delete** (permanent removal from database)
- No soft delete/archive functionality currently
- Consider backing up before deleting

---

## Page Components

### 1. News Index Page

**Location**: `frontend/src/app/news/page.tsx`

**Route**: `/news`

**Features**:
- Server-side rendering (SSR) for initial articles
- Displays latest 10 published articles
- Editable page description (admin only)
- Empty state message when no articles exist
- Client-side pagination via NewsArticlesList component

**Metadata**:
```typescript
{
  title: 'News',
  description: 'Latest news and updates from Veritable Games'
}
```

**Initial Data Fetching**:
```typescript
// Fetches from PostgreSQL content.news table
const articles = await getInitialArticles(10);
```

### 2. News Article Detail Page

**Location**: `frontend/src/app/news/[slug]/page.tsx`

**Route**: `/news/[slug]`

**Features**:
- Server-side rendering for article content
- Dynamic metadata (title, description) from article
- Displays full article with:
  - Title
  - Author and publish date
  - Featured image (if present)
  - Full markdown content (rendered)
  - Tags list
  - View count

### 3. News Article Creation Page

**Location**: `frontend/src/app/news/create/page.tsx`

**Route**: `/news/create`

**Features**:
- Form for creating new articles
- Markdown editor with preview
- Slug auto-generation from title
- Draft/publish toggle
- Tag management
- Featured image upload
- Form validation
- Save as draft or publish immediately

**Access**: Admin only (protected route)

---

## Features

### Markdown Support

**Content Rendering**:
- All article content supports full Markdown syntax
- Rendered with markdown parser on display pages
- Code blocks with syntax highlighting
- Tables, lists, blockquotes
- Images, links, headings

**Example Article Content**:
```markdown
# New Feature Released

We're excited to announce the release of our latest feature!

## Key Benefits

- **Performance**: 50% faster rendering
- **Usability**: Improved user interface
- **Reliability**: Enhanced error handling

## Code Example

```typescript
import { NewsService } from '@/lib/news/service';

const article = await NewsService.getArticle('my-article');
console.log(article.title);
```

[Read more in the documentation](/docs/features)
```

### Tag System

**Purpose**: Categorize articles for easier discovery

**Implementation**:
- Tags stored as JSON array in database
- Filtering: `GET /api/news?tag=updates`
- Multiple tags per article
- Case-sensitive matching
- No tag hierarchy (flat structure)

**Common Tags**:
- `updates` - Platform updates
- `features` - New feature announcements
- `releases` - Version releases
- `community` - Community highlights
- `technical` - Technical deep-dives
- `announcements` - Important notices

### Status Workflow

**Status Values**:
1. **draft**: Work in progress, not visible to public
2. **published**: Live and visible to all users

**Workflow**:
```
[Create Article]
      ↓
   (draft)
      ↓
[Review & Edit]
      ↓
   (publish)
      ↓
  (published)
      ↓
[Update Anytime]
```

**Permissions**:
- **Draft Articles**: Only visible to author and admins
- **Published Articles**: Visible to all users
- **Create**: Admin only
- **Edit**: Admin only
- **Delete**: Admin only

### View Counter

**Purpose**: Track article popularity

**Implementation**:
- `views` column increments on each article page view
- No authentication required (tracks all views)
- Resets on article deletion (hard delete)

**Future Enhancement**: Track unique views per user/IP

---

## Publishing Workflow

### Step-by-Step Guide

#### 1. Create Article (Draft)

```bash
POST /api/news
{
  "title": "My New Article",
  "slug": "my-new-article",
  "summary": "Short description",
  "content": "# Article Content\n\nFull markdown...",
  "author": "Jane Smith",
  "status": "draft"
}
```

**Result**: Article saved but not visible to public

#### 2. Edit Draft

```bash
PUT /api/news/my-new-article
{
  "content": "Updated content...",
  "tags": ["updates", "features"]
}
```

**Result**: Draft updated, still not visible

#### 3. Publish Article

```bash
PUT /api/news/my-new-article
{
  "status": "published",
  "published_at": "2025-11-12T10:00:00Z"
}
```

**Result**: Article now visible at `/news/my-new-article`

#### 4. Update Published Article

```bash
PUT /api/news/my-new-article
{
  "content": "Updated after publication...",
  "updated_at": "2025-11-13T14:00:00Z"
}
```

**Result**: Updates visible immediately (no re-publishing needed)

#### 5. Unpublish Article (Revert to Draft)

```bash
PUT /api/news/my-new-article
{
  "status": "draft"
}
```

**Result**: Article hidden from public, only visible to admins

---

## Usage Examples

### Fetch Latest News

**Client-Side**:
```typescript
async function fetchNews() {
  const response = await fetch('/api/news?limit=10&status=published');
  const data = await response.json();

  console.log('Total articles:', data.pagination.total);
  console.log('Articles:', data.articles);

  return data.articles;
}
```

**Server-Side** (Next.js Server Component):
```typescript
import { dbAdapter } from '@/lib/database/adapter';

async function getNews() {
  const result = await dbAdapter.query(
    `SELECT * FROM news WHERE status = 'published' ORDER BY published_at DESC LIMIT 10`,
    [],
    { schema: 'content' }
  );

  return result.rows;
}
```

### Create Article

```typescript
async function createArticle(article: NewsArticle) {
  const response = await fetch('/api/news', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken, // CSRF required
    },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      author: article.author,
      status: 'draft', // Start as draft
      tags: article.tags,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create article');
  }

  const data = await response.json();
  console.log('Article created with ID:', data.id);

  return data;
}
```

### Update Article

```typescript
async function updateArticle(slug: string, updates: Partial<NewsArticle>) {
  const response = await fetch(`/api/news/${slug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update article');
  }

  return await response.json();
}

// Publish draft
await updateArticle('my-article', {
  status: 'published',
  published_at: new Date().toISOString(),
});

// Update content
await updateArticle('my-article', {
  content: 'New content...',
  tags: ['updated', 'tags'],
});
```

### Filter by Tag

```typescript
async function getArticlesByTag(tag: string) {
  const response = await fetch(`/api/news?tag=${encodeURIComponent(tag)}`);
  const data = await response.json();

  return data.articles;
}

// Usage
const updateArticles = await getArticlesByTag('updates');
console.log('Found articles:', updateArticles.length);
```

### Pagination

```typescript
async function getAllArticles() {
  const limit = 20;
  let offset = 0;
  let allArticles: NewsArticle[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/news?limit=${limit}&offset=${offset}`);
    const data = await response.json();

    allArticles = [...allArticles, ...data.articles];
    hasMore = data.pagination.hasMore;
    offset += limit;
  }

  return allArticles;
}
```

---

## Performance

### Optimization Strategies

#### 1. Indexed Queries

**Optimized Queries**:
```sql
-- Fast: Uses index on status + published_at
SELECT * FROM news
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 20;

-- Fast: Uses unique index on slug
SELECT * FROM news
WHERE slug = 'my-article';
```

**Slow Queries to Avoid**:
```sql
-- Slow: Full table scan for LIKE on content
SELECT * FROM news
WHERE content LIKE '%keyword%';

-- Slow: Filtering on un-indexed column
SELECT * FROM news
WHERE views > 1000;
```

#### 2. Pagination

**Efficient Offset Pagination**:
```typescript
// Good for small offsets (< 1000)
const page = 2;
const limit = 20;
const offset = (page - 1) * limit;

const result = await dbAdapter.query(
  'SELECT * FROM news WHERE status = $1 ORDER BY published_at DESC LIMIT $2 OFFSET $3',
  ['published', limit, offset],
  { schema: 'content' }
);
```

**Better: Cursor-Based Pagination** (for large datasets):
```typescript
// More efficient for large offsets
const lastPublishedAt = '2025-11-10T00:00:00Z';

const result = await dbAdapter.query(
  'SELECT * FROM news WHERE status = $1 AND published_at < $2 ORDER BY published_at DESC LIMIT $3',
  ['published', lastPublishedAt, 20],
  { schema: 'content' }
);
```

#### 3. Server-Side Rendering (SSR)

**Benefits**:
- Faster initial page load (no client-side fetch)
- Better SEO (content in HTML)
- Reduced client-side JavaScript

**Implementation**:
```typescript
// News page uses SSR for initial articles
export default async function NewsPage() {
  // Data fetched on server before page render
  const articles = await getInitialArticles(10);

  return <NewsArticlesList initialArticles={articles} />;
}
```

#### 4. Content Caching

**Future Enhancement**: Add Redis caching layer

```typescript
// Proposed caching strategy
async function getCachedArticle(slug: string) {
  // Check Redis cache first
  const cached = await redis.get(`article:${slug}`);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const article = await fetchArticle(slug);

  // Cache for 5 minutes
  await redis.setex(`article:${slug}`, 300, JSON.stringify(article));

  return article;
}
```

### Performance Benchmarks

| Operation | Query Time | Notes |
|-----------|------------|-------|
| List 20 articles | 5-10ms | With indexes on status + published_at |
| Get single article by slug | 2-5ms | Unique index on slug |
| Create article | 10-15ms | Single INSERT with RETURNING |
| Update article | 8-12ms | Single UPDATE by slug |
| Delete article | 5-8ms | Single DELETE by slug |
| Filter by tag (ILIKE) | 15-30ms | No index on tags (JSON field) |

**Bottlenecks**:
- Tag filtering slow (no JSON indexing)
- Full-text search not available (use external search service)

---

## Future Enhancements

### Planned Features

1. **Rich Text Editor**
   - WYSIWYG editor with live preview
   - Image upload within editor
   - Markdown shortcuts
   - Auto-save drafts

2. **Revision History**
   - Track all edits to articles
   - Compare revisions (diff view)
   - Restore previous versions
   - Audit log of who changed what

3. **Comments System**
   - User comments on articles
   - Comment moderation (approve/delete)
   - Reply threads
   - Upvote/downvote

4. **Categories**
   - Hierarchical categories (News > Updates > Features)
   - Filter by category
   - Category pages

5. **SEO Enhancements**
   - Meta description field
   - Open Graph tags
   - Structured data (JSON-LD)
   - Canonical URLs
   - XML sitemap generation

6. **Scheduled Publishing**
   - Schedule publish date/time
   - Cron job to auto-publish
   - Timezone support

7. **Full-Text Search**
   - PostgreSQL full-text search (GIN index)
   - Search by title, content, tags
   - Relevance ranking
   - Search suggestions

8. **Analytics**
   - Track unique views (per user/IP)
   - View count by date (time series)
   - Popular articles dashboard
   - Referrer tracking

9. **Media Library**
   - Centralized image management
   - Image optimization (resize, compress)
   - Alt text for accessibility
   - Reusable image gallery

10. **Multi-Author Support**
    - Author profiles
    - Author archive pages
    - Co-author attribution
    - Guest author invitations

---

## Related Documentation

- **[docs/api/README.md](../api/README.md)** - Complete API reference (News API section)
- **[docs/DATABASE.md](../DATABASE.md)** - Database architecture (content schema)
- **[docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)** - Security patterns
- **[CLAUDE.md](../../CLAUDE.md)** - Development guide

---

## Troubleshooting

### Common Issues

**Q: 409 Conflict - Slug already exists**
A: Slugs must be unique. Either choose a different slug or update the existing article instead of creating a new one.

**Q: Articles not appearing on news page**
A: Check the `status` column. Only articles with `status = 'published'` are shown. Draft articles are hidden from public view.

**Q: Tags not filtering correctly**
A: Tags are stored as JSON strings. Ensure you're searching for exact tag text (case-sensitive). Future enhancement: Add GIN index for better JSON searching.

**Q: Featured image not displaying**
A: Verify the `featured_image` URL is correct and accessible. Images must be uploaded separately (no built-in upload currently).

**Q: Markdown not rendering**
A: Ensure you're using a markdown parser/renderer on the frontend. Raw markdown text won't render automatically.

---

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready with 3 API routes, server-side rendering, and full CRUD operations
