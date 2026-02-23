# Forum v0.36 UI Restoration Guide

**Complete Analysis of v0.36 Forums UI Implementation**

Date: 2025-10-13
Source: `~/Projects/web/web-0.36/veritable-games-main/frontend`
Target: Current v0.37 codebase restoration

---

## Executive Summary

The v0.36 forums system features a **highly polished, compact UI** with:
- **21 total components** (5 pages + 16 UI components)
- **Consistent design language** across all pages
- **Compact header pattern** (action bar + stats bar)
- **Advanced features**: Tag system, search, browse view, optimistic UI
- **Server/Client split pattern** for optimal performance
- **Extracted sub-components** for maintainability

**Key Differences from v0.37:**
- v0.36 has **8 additional components** that were removed in v0.37
- More polished UI with consistent styling patterns
- Complete tag system with TagDisplay + TagSelector
- Browse page with unified search interface
- Extracted TopicHeader, TopicFooter, TopicStatusBadges, TopicEditForm

---

## Page Components (5 Files)

### 1. `/src/app/forums/page.tsx` - Main Forums Index

**Type:** Server Component
**Purpose:** Main forum landing page with categories and recent topics

#### Data Fetching
```typescript
async function getForumData() {
  const forumService = new ForumService();
  const [categories, stats] = await Promise.all([
    forumService.getCategories(),
    forumService.getForumStats(),
  ]);
  return { categories, stats };
}
```

#### Layout Structure
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-6">
  {/* 1. Compact Header */}
  <div className="flex-shrink-0 mb-4">
    {/* Title + Icon + Description */}
    <div className="flex items-center justify-between mb-3">
      <div>
        <h1>Community Forums</h1>
        <p>Discussion boards for all game projects...</p>
      </div>
      <ForumHeaderActions />
    </div>

    {/* 2. Action Bar - Very compact, single row */}
    <div className="flex items-center gap-2 py-1 px-1.5 bg-gray-900/20 border border-gray-700/40 rounded">
      <ForumSearch />
      <NewTopicButton />
      <Link href="/forums/browse">Browse</Link>
    </div>

    {/* 3. Stats Bar */}
    <div className="mt-3 flex items-center justify-between text-sm bg-gray-900/30 border border-gray-700/60 rounded px-4 py-2">
      <div className="flex items-center space-x-6">
        <span className="text-blue-400">{stats.total_topics} topics</span>
        <span className="text-green-400">{stats.total_replies} replies</span>
        <span className="text-purple-400">{stats.total_users} members</span>
      </div>
      <div>
        <span className="text-orange-400">{stats.active_users_today} active today</span>
      </div>
    </div>
  </div>

  {/* 4. Scrollable Content */}
  <div className="flex-1 overflow-y-auto pr-4 space-y-4">
    <ForumCategoryList categories={categories} />
    {stats?.recent_topics && (
      <TopicList topics={stats.recent_topics} title="Latest Discussions" />
    )}
  </div>
</div>
```

#### Key Features
- **Compact header pattern**: Title + action bar + stats (3 sections)
- **Search integrated**: Inline search in action bar
- **Stats display**: Color-coded metrics with icons
- **Icon usage**: SVG icons inline in JSX (not separate components)
- **Scrollable content**: Categories + recent topics
- **Max width**: 6xl container (max-w-6xl)

#### Components Used
- `ForumCategoryList` - Category listing with sections
- `TopicList` (from TopicRow.tsx) - Recent topics table
- `NewTopicButton` - Create topic button
- `ForumSearch` - Inline search widget
- `ForumHeaderActions` - Login widget + user list link

---

### 2. `/src/app/forums/category/[slug]/page.tsx` - Category View

**Type:** Client Component
**Purpose:** Display all topics in a specific category

#### State Management
```typescript
const [category, setCategory] = useState<any>(null);
const [topics, setTopics] = useState<any[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [sortBy, setSortBy] = useState<SortOption>('recent');
const [filteredTopics, setFilteredTopics] = useState<any[]>([]);
```

#### Data Fetching (Client-side)
```typescript
const [categoryResponse, topicsResponse] = await Promise.all([
  fetch(`/api/forums/categories/${categorySlug}`),
  fetch(`/api/forums/topics?category_slug=${categorySlug}&limit=50`)
]);
```

#### Layout Structure
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-6">
  {/* Header */}
  <div className="flex-shrink-0 mb-4">
    {/* Breadcrumb */}
    <nav className="flex items-baseline gap-2 text-xs text-gray-400 mb-1">
      <Link href="/forums">Forums</Link>
      <span>›</span>
      <span>{category.name}</span>
    </nav>

    {/* Category Header + Login Widget */}
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <h1>{category.name}</h1>
        <p>{category.description}</p>
      </div>
      <LoginWidget />
    </div>

    {/* Action Bar - matches main forums */}
    <div className="flex items-center gap-2 py-1 px-1.5 bg-gray-900/20 border border-gray-700/40 rounded">
      <input type="text" placeholder="Search topics..." />
      <select value={sortBy}>
        <option value="recent">Most Recent</option>
        <option value="popular">Most Popular</option>
        <option value="replies">Most Replies</option>
        <option value="views">Most Views</option>
      </select>
      <Link href={`/forums/create?category=${category.slug}`}>+ New Topic</Link>
      <Link href="/forums">← Back</Link>
    </div>

    {/* Stats Bar */}
    <div className="mt-3 flex items-center justify-between text-sm bg-gray-900/30 border border-gray-700/60 rounded px-4 py-2">
      <div className="flex items-center space-x-6">
        <span>{filteredTopics.length} topics</span>
        <span>{totalReplies} replies</span>
      </div>
      <div>
        <span>{totalViews} views</span>
        {searchQuery && <span>{filteredTopics.length} of {topics.length} shown</span>}
      </div>
    </div>
  </div>

  {/* Scrollable Content */}
  <div className="flex-1 overflow-y-auto pr-4 space-y-4">
    {/* Topics with pinned/regular separation */}
    <div className="bg-gray-900/70 border border-gray-700 rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-4 py-2">
        <div className="grid grid-cols-12 gap-4 text-xs">
          <div className="col-span-6">Topic</div>
          <div className="col-span-2 text-center">Replies</div>
          <div className="col-span-2 text-center">Views</div>
          <div className="col-span-2 text-right">Activity</div>
        </div>
      </div>

      {/* Pinned Topics */}
      {filteredTopics.filter(t => t.is_pinned).map(topic => (
        <TopicRow key={topic.id} topic={topic} />
      ))}

      {/* Separator */}
      <div className="border-t-2 border-gray-600 my-1 relative">
        <div className="absolute -top-2 left-4 px-2 bg-gray-800 text-[10px]">
          Regular Topics
        </div>
      </div>

      {/* Regular Topics */}
      {filteredTopics.filter(t => !t.is_pinned).map(topic => (
        <TopicRow key={topic.id} topic={topic} />
      ))}
    </div>
  </div>
</div>
```

#### Key Features
- **Client-side filtering**: Real-time search and sort
- **Breadcrumb navigation**: Forums > Category
- **Sort options**: Recent, popular, replies, views
- **Pinned/regular separation**: Visual divider between sections
- **Empty state**: Helpful message with CTA
- **LoginWidget**: Top-right corner for consistent placement

#### Sorting Logic
```typescript
switch (sortBy) {
  case 'popular':
    return (b.view_count || 0) - (a.view_count || 0);
  case 'replies':
    return (b.reply_count || 0) - (a.reply_count || 0);
  case 'views':
    return (b.view_count || 0) - (a.view_count || 0);
  case 'recent':
  default:
    return new Date(b.updated_at || b.created_at).getTime() -
           new Date(a.updated_at || a.created_at).getTime();
}
```

---

### 3. `/src/app/forums/topic/[id]/page.tsx` - Topic Detail View

**Type:** Server Component (force-dynamic)
**Purpose:** Display single topic with nested replies

#### Configuration
```typescript
export const dynamic = 'force-dynamic';
```

#### Data Fetching
```typescript
async function getTopicData(topicId: string) {
  const forumService = new ForumService();
  const topicWithReplies = await forumService.getTopicWithReplies(numericId, true);
  const category = await forumService.getCategoryById(topicWithReplies.category_id);
  const tags = await forumTagService.getTopicTags(numericId);

  return { topic: topicWithReplies, category, tags };
}
```

#### Layout Structure
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-6">
  {/* Header */}
  <div className="flex-shrink-0 mb-6">
    {/* Breadcrumb */}
    <nav className="flex items-baseline gap-2 text-xs text-gray-400 mb-1">
      <Link href="/forums">Forums</Link>
      <span>›</span>
      <Link href={`/forums/category/${category.slug}`}>{category.name}</Link>
      <span>›</span>
      <span>{topic.title}</span>
    </nav>

    {/* Topic Header with Login Integration */}
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-white mb-2 break-words">
          {topic.title}
        </h1>
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span>by {topic.username || 'Unknown'}</span>
          <span>•</span>
          <span>{new Date(topic.created_at).toLocaleDateString()}</span>
          <span>•</span>
          <span>{topic.view_count} views</span>
          <span>•</span>
          <span>{topic.reply_count} replies</span>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">
        <LoginWidget />
      </div>
    </div>
  </div>

  {/* Scrollable Content Area */}
  <div className="flex-1 overflow-y-auto">
    <div className="space-y-6 pr-4">
      <TopicView topic={topic} tags={tags} />
      <ReplyList
        replies={topic.replies}
        topicId={topic.id}
        topicTitle={topic.title}
        topicAuthorId={topic.user_id}
        isTopicLocked={topic.is_locked}
      />
    </div>
  </div>
</div>
```

#### Key Features
- **Three-level breadcrumb**: Forums > Category > Topic
- **Topic metadata**: Author, date, views, replies
- **LoginWidget placement**: Top-right, consistent with other pages
- **Tags display**: Below topic content
- **Nested replies**: Handled by ReplyList component
- **Dynamic route**: Forces fresh data on every load

---

### 4. `/src/app/forums/create/page.tsx` - Create Topic Page

**Type:** Client Component (with Suspense wrapper)
**Purpose:** Create new forum topic

#### State Management
```typescript
const [title, setTitle] = useState('');
const [content, setContent] = useState('');
const [categoryId, setCategoryId] = useState<number | null>(null);
const [categories, setCategories] = useState<ForumCategory[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
```

#### Layout Structure
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-4xl mx-auto px-6 py-4">
  {/* Header */}
  <div className="flex-shrink-0 mb-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <Link href="/forums">← Back to Forums</Link>
        <h1>Create New Topic</h1>
        <p>Start a new discussion in the community forums</p>
      </div>
      <LoginWidget />
    </div>

    {error && (
      <div className="bg-red-900/20 border border-red-700/50 rounded p-3 mb-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )}
  </div>

  {/* Form */}
  <div className="flex-1 overflow-y-auto pr-4">
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category Select with optgroup */}
      <select value={categoryId || ''}>
        <option value="">Select a category...</option>
        {Object.entries(groupedCategories).map(([section, cats]) => (
          <optgroup key={section} label={section}>
            {cats.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Title Input with character counter */}
      <input
        type="text"
        value={title}
        maxLength={200}
      />
      <p className="text-xs text-gray-500">{title.length}/200 characters</p>

      {/* Content Editor */}
      <HybridMarkdownEditor
        content={content}
        onChange={setContent}
        placeholder="Write your topic content here... Markdown is supported."
        rows={15}
        onSubmit={handleSubmit}
        submitLabel="Create Topic"
        submitDisabled={!title.trim() || !content.trim() || !categoryId || loading}
      />

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
        <Link href="/forums">Cancel</Link>
        <button type="submit" disabled={!title.trim() || !content.trim()}>
          {loading ? 'Creating...' : 'Create Topic'}
        </button>
      </div>
    </form>
  </div>
</div>
```

#### Key Features
- **Max width**: 4xl (narrower than main forums for readability)
- **Category grouping**: Organized by section with optgroup
- **Character counter**: Shows 200 character limit for title
- **HybridMarkdownEditor**: Full-featured markdown editor
- **Form validation**: Client-side validation before submit
- **Error display**: Prominent error banner
- **Loading states**: Button text changes during submit
- **Redirect on login**: Non-logged-in users redirected to /forums
- **URL parameter**: Pre-selects category from ?category= param
- **Suspense wrapper**: Loading fallback during hydration

#### Submit Handler
```typescript
const handleSubmit = async (e?: React.FormEvent) => {
  if (e) e.preventDefault();

  const response = await fetch('/api/forums/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title: title.trim(),
      content: content.trim(),
      category_id: categoryId,
    }),
  });

  if (response.ok && data.success) {
    router.push(`/forums/topic/${data.data.topic.id}`);
  }
};
```

---

### 5. `/src/app/forums/search/page.tsx` - Search Results

**Type:** Server Component wrapper + Client Component
**Purpose:** Search topics and replies with filters

#### Architecture Pattern
```typescript
// search/page.tsx (Server Component)
export default function ForumSearchPage() {
  return (
    <ForumSearchServer>
      {(categories) => (
        <Suspense fallback={<LoadingState />}>
          <ForumSearchClient initialCategories={categories} />
        </Suspense>
      )}
    </ForumSearchServer>
  );
}

// ForumSearchServer.tsx (Data fetcher)
export async function ForumSearchServer({ children }) {
  const categories = await getCategories(); // Direct DB query
  return <>{children(categories)}</>;
}

// ForumSearchClient.tsx (Interactive UI)
export function ForumSearchClient({ initialCategories }) {
  // Search logic, filters, display
}
```

#### ForumSearchClient Layout
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-2">
  <UnifiedSearchHeader
    title="Forum Search"
    description="Search topics, replies, and community discussions"
    breadcrumbs={[{ label: 'Forums', href: '/forums' }, { label: 'Search' }]}
    searchPlaceholder="Search forums..."
    searchValue={query}
    onSearchChange={setQuery}
    onSearchSubmit={handleSearch}
    filterElements={
      <>
        <select value={filters.type}>
          <option value="all">All</option>
          <option value="topic">Topics</option>
          <option value="reply">Replies</option>
        </select>
        <select value={filters.category_id || ''}>
          <option value="">All Categories</option>
          {initialCategories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select value={filters.sort}>
          <option value="relevance">Relevance</option>
          <option value="date">Date</option>
        </select>
      </>
    }
    actionButtons={
      <>
        <Link href="/forums/create">Create</Link>
        <Link href="/forums">← Back to Forums</Link>
      </>
    }
    resultCount={total}
    resultType="results"
    loginWidget={<LoginWidget />}
  />

  <div className="flex-1 overflow-y-auto">
    <SearchResultTable
      items={unifiedResults}
      type="forum"
      showRelevanceScore={true}
      loading={loading}
    />
  </div>
</div>
```

#### Search Features
- **Real-time search**: Updates as filters change
- **Type filter**: All, Topics, Replies
- **Category filter**: Dropdown with all categories
- **Sort options**: Relevance or Date
- **Unified header**: Reusable UnifiedSearchHeader component
- **SearchResultTable**: Shared table component with forum type
- **Relevance scores**: Shows match quality
- **Empty state**: Helpful message when no query entered
- **URL sync**: Search params synced with URL
- **Server/client split**: Categories fetched server-side, search client-side

---

### 6. `/src/app/forums/browse/page.tsx` - Browse All Topics

**Type:** Client Component
**Purpose:** Browse and filter all topics across categories

#### Layout Structure
```typescript
<div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-4">
  <UnifiedSearchHeader
    title="Browse All Topics"
    description="Discussion boards for all game projects and community topics"
    breadcrumbs={[{ label: 'Forums', href: '/forums' }, { label: 'Browse All Topics' }]}
    searchPlaceholder="Search topics, content, or authors..."
    searchValue={searchQuery}
    onSearchChange={setSearchQuery}
    actionButtons={
      <>
        <Link href="/forums/create">Create</Link>
        <Link href="/forums">← Back to Forums</Link>
      </>
    }
    resultCount={filteredTopics.length}
    resultType={filteredTopics.length === 1 ? 'topic found' : 'topics found'}
    loginWidget={<LoginWidget />}
  />

  <div className="flex-1 overflow-y-auto">
    <SearchResultTable
      items={unifiedTopics}
      type="forum"
      loading={loading}
    />
  </div>
</div>
```

#### Key Features
- **All topics**: Fetches all topics from all categories (limit 100)
- **Client-side search**: Filter by title, content, or author
- **UnifiedSearchHeader**: Same header as search page
- **SearchResultTable**: Reusable table component
- **Real-time filtering**: Updates as you type
- **Stats calculation**: Computes totals from loaded topics
- **Category names**: Included via JOIN in API
- **Empty states**: Different messages for no topics vs no search results

---

## UI Components (16 Files)

### Core Components

#### 1. `ForumCategoryList.tsx` - Category Listing
```typescript
// Memoized for performance
export const ForumCategoryList = memo<ForumCategoryListProps>(({ categories }) => {
  // Group by section
  const groupedCategories = useMemo(() => {
    const grouped = categories.reduce((acc, category) => {
      const section = category.section || 'Miscellaneous';
      if (!acc[section]) acc[section] = [];
      acc[section].push(category);
      return acc;
    }, {} as Record<string, ForumCategory[]>);

    const order = ['Social Contract', 'Noxii Game', 'Autumn Project', 'Miscellaneous'];
    return { groupedCategories: grouped, sectionOrder: order };
  }, [categories]);

  return (
    <div className="space-y-4">
      {sectionOrder.map(sectionName => (
        <CategorySection
          key={sectionName}
          sectionName={sectionName}
          sectionCategories={groupedCategories[sectionName]}
        />
      ))}
    </div>
  );
});

// Nested CategorySection component
const CategorySection = memo<{ sectionName: string; sectionCategories: ForumCategory[] }>(
  ({ sectionName, sectionCategories }) => (
    <div className="bg-gray-900/30 border border-gray-700 rounded overflow-hidden mb-4">
      {/* Section Header */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{sectionName}</h2>
          <div className="text-xs text-gray-400">
            {sectionCategories.reduce((acc, cat) => acc + (cat.topic_count || 0), 0)} topics •
            {sectionCategories.reduce((acc, cat) => acc + (cat.post_count || 0), 0)} posts
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-1.5">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
          <div className="col-span-6">Forum</div>
          <div className="col-span-2 text-center">Topics</div>
          <div className="col-span-2 text-center">Posts</div>
          <div className="col-span-2 text-right">Last Activity</div>
        </div>
      </div>

      {/* Category Rows */}
      <div className="divide-y divide-gray-700">
        {sectionCategories.map(category => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
    </div>
  )
);

// Nested CategoryRow component
const CategoryRow = memo<{ category: ForumCategory }>(({ category }) => (
  <Link href={`/forums/category/${category.slug}`} className="block hover:bg-gray-800/30">
    <div className="px-4 py-2.5 min-h-[40px] flex items-center">
      <div className="grid grid-cols-12 gap-4 w-full items-center">
        <div className="col-span-6">
          <h3 className="text-sm font-medium text-white truncate">{category.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{category.description}</p>
        </div>
        <div className="col-span-2 text-center">
          <div className="text-sm font-medium text-blue-400">{category.topic_count || 0}</div>
        </div>
        <div className="col-span-2 text-center">
          <div className="text-sm font-medium text-green-400">{category.post_count || 0}</div>
        </div>
        <div className="col-span-2 text-right">
          {category.last_activity_at ? (
            <div>
              <div className="text-xs text-gray-300">
                {new Date(category.last_activity_at).toLocaleDateString()}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(category.last_activity_at).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No activity</div>
          )}
        </div>
      </div>
    </div>
  </Link>
));
```

**Features:**
- **Memo optimization**: All sub-components memoized
- **Section grouping**: Categories organized by section
- **Section stats**: Total topics/posts per section
- **12-column grid**: Consistent layout
- **Hover effects**: Subtle background change
- **Date formatting**: Smart date/time display
- **Empty state**: Message when no categories

---

#### 2. `TopicRow.tsx` - Topic List Item
```typescript
export function TopicRow({ topic, categoryId }: TopicRowProps) {
  // Smart date formatting
  const formatDate = (dateString: string, showFullDate = false) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (showFullDate) {
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    // Less than 1 minute
    if (diffSeconds < 60) return 'just now';
    // Less than 1 hour
    if (diffMinutes < 60) return `${diffMinutes} mins ago`;
    // Less than 24 hours
    if (diffHours < 24) return `${diffHours} hours ago`;
    // Yesterday
    if (diffDays === 1) return 'yesterday';
    // Less than 7 days
    if (diffDays < 7) return `${diffDays} days ago`;
    // Less than 4 weeks
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    // 3+ months - show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="block hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={handleTopicClick}>
      <div className="px-4 py-2 min-h-[40px]">
        <div className="grid grid-cols-12 gap-4 w-full items-center">
          {/* Topic Title & Author */}
          <div className="col-span-6">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-white truncate">{topic.title}</h4>
              {topic.is_pinned && <PinnedIcon />}
              {topic.is_solved && <SolvedIcon />}
              {topic.is_locked && <LockedIcon />}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              by <UserLink userId={topic.user_id} username={topic.username} /> •
              <time dateTime={topic.created_at} title={formatDate(topic.created_at, true)}>
                {formatDate(topic.created_at)}
              </time>
            </div>
          </div>

          {/* Reply Count */}
          <div className="col-span-2">
            <div className="flex flex-col items-center">
              <div className="text-sm font-medium text-gray-200">{topic.reply_count || 0}</div>
              <div className="text-xs text-gray-500">
                {topic.reply_count === 1 ? 'reply' : 'replies'}
              </div>
            </div>
          </div>

          {/* View Count */}
          <div className="col-span-2">
            <div className="flex flex-col items-center">
              <div className="text-sm font-medium text-gray-200">{topic.view_count || 0}</div>
              <div className="text-xs text-gray-500">views</div>
            </div>
          </div>

          {/* Last Activity */}
          <div className="col-span-2 text-right">
            <div className="text-xs text-gray-300">
              <time dateTime={topic.last_reply_at} title={formatDate(topic.last_reply_at, true)}>
                {formatDate(topic.last_reply_at)}
              </time>
            </div>
            <div className="text-xs text-gray-500">
              by <UserLink userId={topic.last_reply_user_id} username={topic.last_reply_username} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Companion TopicList component
export function TopicList({ topics, categoryId, title = 'Recent Topics' }: TopicListProps) {
  return (
    <div className="bg-gray-900/30 border border-gray-700 rounded overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
      </div>

      {/* Column Headers */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-1.5">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-400">
          <div className="col-span-6">Topic</div>
          <div className="col-span-2 text-center">Replies</div>
          <div className="col-span-2 text-center">Views</div>
          <div className="col-span-2 text-right">Activity</div>
        </div>
      </div>

      {/* Pinned Topics */}
      <div className="divide-y divide-gray-700">
        {topics.filter(t => t.is_pinned).map(topic => (
          <TopicRow key={topic.id} topic={topic} />
        ))}
      </div>

      {/* Separator */}
      {topics.filter(t => t.is_pinned).length > 0 && topics.filter(t => !t.is_pinned).length > 0 && (
        <div className="border-t-2 border-gray-600 my-1 relative">
          <div className="absolute -top-2 left-4 px-2 bg-gray-900/30 text-[10px] text-gray-500">
            Recent Topics
          </div>
        </div>
      )}

      {/* Regular Topics */}
      <div className="divide-y divide-gray-700">
        {topics.filter(t => !t.is_pinned).map(topic => (
          <TopicRow key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  );
}
```

**Features:**
- **Smart date formatting**: Relative dates with full date tooltip
- **Status badges**: Inline icons for pinned/solved/locked
- **User links**: Clickable author names
- **12-column grid**: Matches category layout
- **Pinned/regular separation**: Visual divider
- **Click handling**: Smart click detection (avoids user link clicks)
- **Hover effects**: Subtle highlighting

---

#### 3. `TopicView.tsx` - Topic Display Card
```typescript
export function TopicView({ topic, tags = [] }: TopicViewProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(topic.content);
  const [editTitle, setEditTitle] = useState(topic.title);

  const canEdit = user && (user.id === topic.user_id || user.role === 'admin');
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="bg-gray-900/30 border border-gray-700 rounded-lg overflow-hidden">
      {/* Topic Header */}
      <TopicHeader
        topic={topic}
        topicAuthor={topicAuthor}
        canEdit={canEdit}
        isAdmin={isAdmin}
        isEditing={isEditing}
        loading={loading}
        onEditClick={() => setIsEditing(true)}
        onAdminAction={handleAdminAction}
      />

      {/* Topic Content */}
      <div className="p-3">
        {isEditing ? (
          <TopicEditForm
            title={editTitle}
            content={editContent}
            error={editError}
            loading={editLoading}
            onTitleChange={setEditTitle}
            onContentChange={setEditContent}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        ) : (
          <HybridMarkdownRenderer content={topic.content} />
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <TagDisplay tags={tags} size="sm" linkable={true} />
          </div>
        )}
      </div>

      {/* Topic Footer */}
      <TopicFooter
        user={user}
        topic={topic}
        isAdmin={isAdmin}
        onScrollToReplyEditor={scrollToReplyEditor}
        onDelete={() => handleAdminAction('delete')}
      />
    </div>
  );
}
```

**Extracted Sub-Components:**

##### TopicHeader.tsx
```typescript
export function TopicHeader({
  topic,
  topicAuthor,
  canEdit,
  isAdmin,
  isEditing,
  loading,
  onEditClick,
  onAdminAction
}: TopicHeaderProps) {
  return (
    <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Avatar user={topicAuthor || {...}} size="lg" />
          <div>
            <UserLink userId={topic.user_id} username={topic.username} />
            <div className="text-xs text-gray-400">
              {new Date(topic.created_at).toLocaleString()}
              {topic.created_at !== topic.updated_at && <span>(edited)</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <TopicStatusBadges isPinned={topic.is_pinned} isSolved={topic.is_solved} isLocked={topic.status === 'locked'} />
          {canEdit && !isEditing && <button onClick={onEditClick}>Edit</button>}
          {isAdmin && <TopicModerationDropdown topic={topic} loading={loading} onAction={onAdminAction} />}
        </div>
      </div>
    </div>
  );
}
```

##### TopicStatusBadges.tsx
```typescript
export function TopicStatusBadges({ isPinned, isSolved, isLocked }: TopicStatusBadgesProps) {
  const badges = [];

  if (isPinned) {
    badges.push(
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-600/50">
        <svg className="w-3 h-3">...</svg>
        Pinned
      </span>
    );
  }

  if (isSolved) {
    badges.push(
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-600/50">
        <svg className="w-3 h-3">...</svg>
        Solved
      </span>
    );
  }

  if (isLocked) {
    badges.push(
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-900/30 text-red-400 border border-red-600/50">
        <svg className="w-3 h-3">...</svg>
        Locked
      </span>
    );
  }

  return <div className="flex items-center space-x-2">{badges}</div>;
}
```

##### TopicModerationDropdown.tsx
```typescript
export function TopicModerationDropdown({ topic, loading, onAction }: TopicModerationDropdownProps) {
  const [showAdminActions, setShowAdminActions] = useState(false);

  return (
    <div className="relative" ref={adminDropdownRef}>
      <button onClick={() => setShowAdminActions(!showAdminActions)}>
        <svg>...</svg>
        Moderate
      </button>

      {showAdminActions && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border rounded-lg shadow-xl z-50">
          <button onClick={() => handleActionClick(topic.is_locked ? 'unlock' : 'lock')}>
            {topic.is_locked ? 'Unlock Topic' : 'Lock Topic'}
          </button>
          <button onClick={() => handleActionClick(topic.is_pinned ? 'unpin' : 'pin')}>
            {topic.is_pinned ? 'Unpin Topic' : 'Pin Topic'}
          </button>
          <button onClick={() => handleActionClick(topic.is_solved ? 'unmark_solved' : 'mark_solved')}>
            {topic.is_solved ? 'Unmark as Solved' : 'Mark as Solved'}
          </button>
          <hr />
          <button onClick={() => handleActionClick('delete')}>Delete Topic</button>
        </div>
      )}
    </div>
  );
}
```

##### TopicEditForm.tsx
```typescript
export function TopicEditForm({
  title,
  content,
  error,
  loading,
  onTitleChange,
  onContentChange,
  onSave,
  onCancel
}: TopicEditFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label>Topic Title</label>
        <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </div>

      <div>
        <label>Topic Content</label>
        <HybridMarkdownEditor content={content} onChange={onContentChange} rows={12} />
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-md">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
```

##### TopicFooter.tsx
```typescript
export function TopicFooter({
  user,
  topic,
  isAdmin,
  onScrollToReplyEditor,
  onDelete
}: TopicFooterProps) {
  return (
    <div className="bg-gray-800/30 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!user && <span className="text-sm text-gray-500">Login to reply</span>}
          {user && !topic.is_locked && (
            <button onClick={onScrollToReplyEditor}>Reply to Topic</button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {(isAdmin || (user && user.id === topic.user_id)) && (
            <button onClick={onDelete}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

#### 4. `ReplyList.tsx` - Nested Reply System (700+ lines)
```typescript
// Main ReplyList component
export const ReplyList: React.FC<ReplyListProps> = ({
  replies,
  topicId,
  topicTitle,
  topicAuthorId,
  isTopicLocked
}) => {
  const { user } = useAuth();
  const [newReplyContent, setNewReplyContent] = useState('');
  const router = useRouter();

  // Optimistic UI state
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    replies,
    (currentReplies, newReply: ForumReply) => [...currentReplies, newReply]
  );

  const handleSubmitNewReply = useCallback(async () => {
    if (!newReplyContent.trim() || !user) return;

    // Create optimistic reply
    const optimisticReply: ForumReply = {
      id: Date.now() as any,
      topic_id: topicId as any,
      user_id: user.id as any,
      username: user.username,
      content: newReplyContent.trim(),
      parent_id: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      is_solution: false,
      replies: [],
    };

    // Optimistically add reply
    addOptimisticReply(optimisticReply);
    setNewReplyContent('');

    // Submit to server
    const response = await fetch('/api/forums/replies', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        topic_id: topicId,
        content: newReplyContent.trim(),
      }),
    });

    if (response.ok) {
      router.refresh(); // Sync with server
    } else {
      alert('Failed to post reply');
      router.refresh(); // Revert optimistic update
    }
  }, [newReplyContent, topicId, router, user, addOptimisticReply]);

  return (
    <div className="space-y-6">
      {/* Replies */}
      <div className="space-y-0">
        {optimisticReplies.map(reply => (
          <ReplyView
            key={reply.id}
            reply={reply}
            level={0}
            topicId={topicId}
            topicAuthorId={topicAuthorId}
            isTopicLocked={isTopicLocked}
          />
        ))}
      </div>

      {/* New Reply Form */}
      {user && !isTopicLocked && (
        <div id="reply-editor">
          <h3>Reply to "{topicTitle}"</h3>
          <HybridMarkdownEditor
            content={newReplyContent}
            onChange={setNewReplyContent}
            placeholder="Write your reply..."
            rows={8}
            onSubmit={handleSubmitNewReply}
            submitLabel="Post Reply"
            submitDisabled={!newReplyContent.trim()}
          />
        </div>
      )}
    </div>
  );
};

// ReplyView component (memoized)
const ReplyView = memo<ReplyViewProps>(
  ({ reply, level = 0, topicId, topicAuthorId, isTopicLocked }) => {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');

    // Optimistic UI state
    const [optimisticContent, setOptimisticContent] = useOptimistic(
      reply.content,
      (currentContent, newContent: string) => newContent
    );
    const [optimisticIsSolution, setOptimisticIsSolution] = useState(reply.is_solution);

    const canEdit = user && (user.id === reply.user_id || user.role === 'admin');
    const isAdmin = user && user.role === 'admin';
    const isTopicAuthor = user && topicAuthorId && user.id === topicAuthorId;
    const canMarkSolution = isAdmin || isTopicAuthor;
    const indentLevel = Math.min(reply.reply_depth ?? level, 5);

    // Indent classes for nesting
    const indentClasses = [
      '', // level 0
      'ml-6 border-l-2 border-gray-700 pl-4', // level 1
      'ml-12 border-l-2 border-gray-700 pl-4', // level 2
      'ml-16 border-l-2 border-gray-700 pl-4', // level 3
      'ml-20 border-l-2 border-gray-600 pl-4', // level 4
      'ml-24 border-l-2 border-gray-500 pl-4', // level 5
    ];

    return (
      <>
        <div className={indentLevel > 0 ? indentClasses[indentLevel] : ''}>
          <div className="bg-gray-900/30 border border-gray-700 rounded mb-2 overflow-hidden">
            {/* Solution Badge */}
            {optimisticIsSolution && (
              <div className="bg-emerald-900/20 border-b border-emerald-700/50 px-4 py-2">
                <svg className="w-4 h-4 text-emerald-400">...</svg>
                <span className="text-xs font-semibold text-emerald-400">Accepted Solution</span>
              </div>
            )}

            {/* Reply Header */}
            <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Avatar user={replyAuthor} size="md" />
                  <div>
                    <UserLink userId={reply.user_id} username={reply.username} />
                    <div className="text-xs text-gray-400">
                      {new Date(reply.created_at).toLocaleString()}
                      {reply.created_at !== reply.updated_at && <span>(edited)</span>}
                    </div>
                  </div>
                </div>
                <div>
                  {canEdit && !isEditing && <button onClick={() => setIsEditing(true)}>Edit</button>}
                </div>
              </div>
            </div>

            {/* Reply Content */}
            <div className="p-3">
              {isEditing ? (
                <HybridMarkdownEditor content={editContent} onChange={setEditContent} rows={10} />
              ) : reply.is_deleted ? (
                <div className="text-gray-500 italic">[Reply Removed]</div>
              ) : (
                <HybridMarkdownRenderer content={optimisticContent} />
              )}
            </div>

            {/* Reply Actions Footer */}
            <div className="bg-gray-800/30 border-t border-gray-700 px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  {user && !isTopicLocked && !reply.is_deleted && (
                    <button onClick={() => setShowReplyForm(!showReplyForm)}>Reply</button>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {canMarkSolution && !reply.is_deleted && (
                    <button onClick={handleMarkSolution}>
                      {optimisticIsSolution ? 'Unmark as Solution' : 'Mark as Solution'}
                    </button>
                  )}
                  {(canEdit || isAdmin) && (
                    <button onClick={() => handleAdminAction('delete')}>
                      {reply.is_deleted ? 'Permanently Delete' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inline Reply Form */}
            {showReplyForm && user && !isTopicLocked && (
              <div className="border-t border-gray-700 p-4 bg-gray-800/30">
                <HybridMarkdownEditor
                  content={replyContent}
                  onChange={setReplyContent}
                  placeholder="Write your reply..."
                  rows={7}
                />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setShowReplyForm(false)}>Cancel</button>
                  <button onClick={handleSubmitReply}>Post Reply</button>
                </div>
              </div>
            )}
          </div>

          {/* Nested Replies */}
          {reply.replies && reply.replies.length > 0 && (
            <div className="space-y-0">
              {reply.replies.map(nestedReply => (
                <ReplyView
                  key={nestedReply.id}
                  reply={nestedReply}
                  level={level + 1}
                  topicId={topicId}
                  topicAuthorId={topicAuthorId}
                  isTopicLocked={isTopicLocked}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  },
  // Custom memo comparison
  (prevProps, nextProps) => {
    return (
      prevProps.reply.id === nextProps.reply.id &&
      prevProps.reply.updated_at === nextProps.reply.updated_at &&
      prevProps.reply.is_deleted === nextProps.reply.is_deleted &&
      prevProps.reply.is_solution === nextProps.reply.is_solution &&
      prevProps.level === nextProps.level &&
      prevProps.isTopicLocked === nextProps.isTopicLocked
    );
  }
);
```

**Key Features:**
- **React 19 useOptimistic**: Instant UI feedback for new replies, edits, solution marking
- **Nested threading**: Up to 5 levels with visual indentation
- **Memo optimization**: Custom comparison function for performance
- **Inline editing**: Edit mode within reply card
- **Inline replies**: Reply form appears below parent reply
- **Solution marking**: Admin and topic author can mark solutions
- **Soft delete**: First delete is soft, second is permanent
- **Smart permissions**: Author + admin can edit/delete
- **Visual nesting**: Progressive indentation with border
- **Solution banner**: Green banner for accepted solutions

---

#### 5. `TagDisplay.tsx` - Tag Rendering
```typescript
export function TagDisplay({
  tags,
  size = 'md',
  showUsageCount = false,
  linkable = true,
  maxTags,
  className = '',
}: TagDisplayProps) {
  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const hiddenCount = maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const TagComponent = ({ tag, children }: { tag: ForumTag; children: React.ReactNode }) => {
    if (linkable) {
      return <Link href={`/forums/tag/${tag.slug}`}>{children}</Link>;
    }
    return <span>{children}</span>;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {displayTags.map(tag => (
        <TagComponent key={tag.id} tag={tag}>
          <span
            className={`inline-flex items-center font-medium rounded-full border ${sizeClasses[size]}`}
            style={{
              backgroundColor: `${tag.color}15`,
              borderColor: `${tag.color}40`,
              color: tag.color,
            }}
          >
            {tag.name}
            {showUsageCount && (
              <span className="ml-1.5 text-xs" style={{ color: `${tag.color}80` }}>
                {tag.usage_count}
              </span>
            )}
          </span>
        </TagComponent>
      ))}
      {hiddenCount > 0 && <span className="text-gray-400">+{hiddenCount} more</span>}
    </div>
  );
}

// Companion components
export function PopularTags({ limit = 20 }: PopularTagsProps) {
  const [tags, setTags] = useState<ForumTag[]>([]);

  useEffect(() => {
    fetch(`/api/forums/tags?action=popular&limit=${limit}`)
      .then(res => res.json())
      .then(data => setTags(data.tags));
  }, [limit]);

  return <TagDisplay tags={tags} size="sm" showUsageCount={true} linkable={true} />;
}

export function TrendingTags({ limit = 10 }: TrendingTagsProps) {
  const [tags, setTags] = useState<ForumTag[]>([]);

  useEffect(() => {
    fetch(`/api/forums/tags?action=trending&limit=${limit}`)
      .then(res => res.json())
      .then(data => setTags(data.tags));
  }, [limit]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-orange-400">...</svg>
        <span className="text-sm font-medium text-orange-400">Trending</span>
      </div>
      <TagDisplay tags={tags} size="sm" linkable={true} />
    </div>
  );
}
```

**Features:**
- **Dynamic colors**: Tag color from database
- **Size variants**: sm, md, lg
- **Usage counts**: Optional display
- **Linkable**: Can link to tag pages or display static
- **Max tags**: Truncate with "+N more" indicator
- **Popular/Trending**: Separate components for different views
- **Loading states**: Skeleton placeholders

---

#### 6. `TagSelector.tsx` - Tag Input Widget
```typescript
export function TagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 10,
  placeholder = 'Add tags...',
  className = '',
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      const response = await fetch(
        `/api/forums/tags?action=search&q=${encodeURIComponent(inputValue)}&limit=10`
      );
      const data = await response.json();

      // Filter out already selected tags
      const filteredSuggestions = data.suggestions.filter(
        (suggestion: TagSuggestion) => !selectedTags.some(tag => tag.id === suggestion.id)
      );

      setSuggestions(filteredSuggestions);
      setIsDropdownOpen(filteredSuggestions.length > 0);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, selectedTags]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim() && suggestions.length === 0) {
        createNewTag(inputValue.trim());
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected tags and input */}
      <div className="flex flex-wrap items-center gap-2 p-3 border border-gray-700 rounded-lg bg-gray-800 focus-within:border-blue-500">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-gray-700"
            style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color }}
          >
            <span style={{ color: tag.color }}>{tag.name}</span>
            <button onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}

        {selectedTags.length < maxTags && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent text-white outline-none"
          />
        )}
      </div>

      {/* Tag limit indicator */}
      {selectedTags.length >= maxTags && (
        <div className="text-xs text-gray-400 mt-1">Maximum {maxTags} tags allowed</div>
      )}

      {/* Suggestions dropdown */}
      {isDropdownOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => selectTag(suggestion)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-700 ${
                index === highlightedIndex ? 'bg-gray-700' : ''
              }`}
            >
              <div className="text-white font-medium">{suggestion.name}</div>
              <div className="text-xs text-gray-400">Used in {suggestion.usage_count} topics</div>
            </button>
          ))}
        </div>
      )}

      {/* No suggestions but can create */}
      {isDropdownOpen && suggestions.length === 0 && inputValue.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border rounded-lg">
          <div className="px-4 py-3 text-gray-400">
            No tags found. Press Enter to create "{inputValue.trim()}"
          </div>
        </div>
      )}
    </div>
  );
}
```

**Features:**
- **Debounced search**: 300ms delay for API calls
- **Keyboard navigation**: Arrow keys, Enter, Escape, Backspace
- **Tag creation**: Create new tags on-the-fly
- **Max limit**: Configurable max tags
- **Usage counts**: Shows how often tag is used
- **Relevance scoring**: Exact matches highlighted
- **Click outside**: Close dropdown when clicking away
- **Visual feedback**: Highlighted suggestion, selected tags with color
- **Filtering**: Excludes already selected tags

---

#### 7. `ForumSearch.tsx` - Search Widget
```typescript
export default function ForumSearch() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Use startTransition for non-blocking navigation
    startTransition(() => {
      const searchParams = new URLSearchParams({ q: query.trim() });
      router.push(`/forums/search?${searchParams.toString()}`);
    });
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search forums..."
        className="w-full h-8 px-3 pl-9 bg-gray-800 border border-gray-600 rounded text-sm"
        disabled={isPending}
      />
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-gray-400">...</svg>
      </div>
      {isPending && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
        </div>
      )}
    </form>
  );
}
```

**Features:**
- **Compact design**: Height matches action bar (h-8)
- **Icon placement**: Search icon on left
- **Loading state**: Spinner on right when searching
- **React 18 useTransition**: Non-blocking navigation
- **Form submit**: Enter key triggers search
- **Disabled state**: Prevents interaction during search

---

#### 8. `NewTopicButton.tsx` - Create Topic Button
```typescript
export function NewTopicButton({
  categories,
  defaultCategoryId,
  categoryId
}: NewTopicButtonProps) {
  const { user } = useAuth();

  const handleClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      alert('Please log in to create a new topic');
      return;
    }
  };

  const targetCategoryId = categoryId || defaultCategoryId;
  const createUrl = targetCategoryId
    ? `/forums/create?category=${targetCategoryId}`
    : '/forums/create';

  return (
    <Link
      href={createUrl}
      onClick={handleClick}
      className="px-3 h-8 flex items-center text-sm text-blue-400 hover:text-blue-300 bg-gray-800/40 hover:bg-gray-700/60 rounded border border-blue-500/50 hover:border-blue-400/70 transition-colors"
    >
      Create
    </Link>
  );
}
```

**Features:**
- **Auth check**: Alert if not logged in
- **Category pre-select**: URL parameter for default category
- **Compact size**: Matches action bar height
- **Hover effects**: Color transitions

---

#### 9. `ForumHeaderActions.tsx` - Header Widget
```typescript
export function ForumHeaderActions() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="flex items-center space-x-2">
      <LoginWidget />
      {user && (
        <Link
          href="/users"
          className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 border border-blue-600 rounded"
        >
          User List
        </Link>
      )}
    </div>
  );
}
```

**Features:**
- **Conditional rendering**: Shows different content based on auth state
- **User list link**: Only shown to logged-in users
- **Compact layout**: Horizontal flex layout

---

#### 10. `LoginWidget.tsx` - Auth Widget
```typescript
export function LoginWidget({ compact = false }: LoginWidgetProps) {
  return <UnifiedLoginWidget compact={compact} />;
}
```

**Note**: This is a wrapper for the unified login widget from `@/components/auth/UnifiedLoginWidget`. The actual implementation is in the shared auth components.

---

#### 11. `UserLink.tsx` - User Profile Link
```typescript
export function UserLink({
  userId,
  username,
  displayName,
  className = '',
  showAvatar = false,
  avatarSize = 'md',
  children,
  showHoverCard = true,
  disableLink = false,
}: UserLinkProps) {
  const displayText = displayName || username;

  // If no userId, render as plain text
  if (!userId) {
    return <span className={className}>{children || displayText}</span>;
  }

  const content = children || (showAvatar ? (
    <div className="flex items-center space-x-2">
      <div className={`${avatarSizeClasses[avatarSize]} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full`}>
        {displayText[0]?.toUpperCase() || 'U'}
      </div>
      <span>{displayText}</span>
    </div>
  ) : (
    <span>{displayText}</span>
  ));

  if (disableLink) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={`/profile/${userId}`} className={`hover:text-blue-400 transition-colors ${className}`}>
      {content}
    </Link>
  );
}

export function UserAvatar({
  userId,
  username,
  displayName,
  size = 'md',
  showUploadedAvatar = false,
}: UserAvatarProps) {
  const [userData, setUserData] = useState<any>(null);

  // Fetch user data for uploaded avatar
  useEffect(() => {
    if (showUploadedAvatar && userId) {
      fetch(`/api/users/${userId}?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setUserData(data.data);
          }
        });
    }
  }, [userId, showUploadedAvatar]);

  const avatarContent = userData?.avatar_url ? (
    <div className="rounded-full overflow-hidden ring-2 ring-gray-700 hover:ring-blue-500">
      <img
        src={userData.avatar_url}
        alt={displayText}
        style={{
          transform: `scale(${userData.avatar_scale / 100})`,
          objectPosition: `${userData.avatar_position_x}% ${userData.avatar_position_y}%`,
        }}
      />
    </div>
  ) : (
    <div className={`bg-gradient-to-br ${gradient} rounded-full ring-2 ring-gray-700`}>
      {displayText?.[0]?.toUpperCase() || 'U'}
    </div>
  );

  return userId ? (
    <Link href={`/profile/${userId}`}>{avatarContent}</Link>
  ) : (
    avatarContent
  );
}
```

**Features:**
- **Fallback handling**: Graceful degradation when userId missing
- **Avatar support**: Optional avatar display
- **Gradient avatars**: Color-coded by user ID
- **Uploaded avatars**: Shows custom user avatars
- **Hover states**: Color transitions
- **Disable link**: Optional non-clickable mode
- **Custom children**: Flexible content rendering

---

#### 12. `UserIndexFilters.tsx` - User List Filters
```typescript
export default function UserIndexFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      updateFilters({ q: value });
    }, 300),
    []
  );

  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    params.delete('page'); // Reset to page 1
    router.push(`/users?${params.toString()}`);
  }, [searchParams, router]);

  return (
    <div className="bg-gray-900/30 border border-gray-700 rounded p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Search Users
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              debouncedSearch(e.target.value);
            }}
            placeholder="Username or display name..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded"
          />
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
          <select value={sortBy} onChange={(e) => {
            setSortBy(e.target.value);
            updateFilters({ sort: e.target.value });
          }}>
            <option value="recent">Recently Active</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="newest">Newest Users</option>
            <option value="posts">Most Active</option>
          </select>
        </div>

        {/* Role Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
          <select value={roleFilter} onChange={(e) => {
            setRoleFilter(e.target.value);
            updateFilters({ role: e.target.value });
          }}>
            <option value="">All Users</option>
            <option value="admin">Administrators</option>
            <option value="moderator">Moderators</option>
            <option value="user">Regular Users</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```

**Features:**
- **Debounced search**: 300ms delay
- **URL sync**: All filters sync with URL params
- **Grid layout**: Responsive 3-column layout
- **Multiple filters**: Search, sort, role
- **Page reset**: Resets to page 1 on filter change

---

#### 13-16. Extracted Sub-Components (Already Documented)

See **TopicView.tsx** section above for:
- **TopicHeader.tsx** - Author info and status
- **TopicStatusBadges.tsx** - Visual status indicators
- **TopicModerationDropdown.tsx** - Admin moderation menu
- **TopicEditForm.tsx** - Inline edit form
- **TopicFooter.tsx** - Reply button and actions

---

## UI/UX Patterns

### 1. Compact Header Pattern
```
┌─────────────────────────────────────────────┐
│ Icon + Title + Description    LoginWidget  │
├─────────────────────────────────────────────┤
│ [Search] [Button] [Button] [Link]          │ ← Action Bar (h-8, compact)
├─────────────────────────────────────────────┤
│ 123 topics • 456 replies • 78 members      │ ← Stats Bar
└─────────────────────────────────────────────┘
```

**Key Characteristics:**
- **Single-row action bar**: All controls on one line (py-1, h-8)
- **Inline search**: Search integrated into action bar
- **Stats below**: Separate stats bar with colored metrics
- **Consistent spacing**: gap-2, px-1.5 for action bar
- **Background layering**: bg-gray-900/20 action bar, bg-gray-900/30 stats bar

### 2. 12-Column Grid System
```typescript
// Used in ForumCategoryList, TopicRow
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-6">Topic/Forum Name</div>
  <div className="col-span-2 text-center">Topics/Replies</div>
  <div className="col-span-2 text-center">Posts/Views</div>
  <div className="col-span-2 text-right">Activity</div>
</div>
```

**Benefits:**
- **Consistent alignment** across all list views
- **Responsive design** (can adjust col-span for mobile)
- **Easy to maintain** (same grid everywhere)

### 3. Visual Hierarchy

**Border Styles:**
```typescript
// Section container
className="bg-gray-900/30 border border-gray-700 rounded"

// Section header
className="bg-gray-800/30 border-b border-gray-700"

// Table header
className="bg-gray-800/30 border-b border-gray-700"

// Rows
className="hover:bg-gray-800/30 border-b border-gray-700 last:border-b-0"
```

**Color Coding:**
- **Blue** (#3B82F6): Topics count, primary actions, links
- **Green** (#10B981): Replies count, success states
- **Purple** (#8B5CF6): Members count
- **Orange** (#F97316): Active users
- **Amber** (#F59E0B): Pinned topics
- **Emerald** (#10B981): Solved topics
- **Red** (#EF4444): Locked topics, delete actions

### 4. Inline Icons

All icons are inline SVGs (not separate components):
```typescript
<svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
  <path fillRule="evenodd" d="..." clipRule="evenodd" />
</svg>
```

**Sizes:**
- **w-3 h-3**: Status badges (pinned/solved/locked)
- **w-4 h-4**: Inline icons (search, dropdown arrows)
- **w-6 h-6**: Section headers

### 5. Nesting Indentation

ReplyList uses static classes for indentation (not dynamic):
```typescript
const indentClasses = [
  '', // level 0
  'ml-6 border-l-2 border-gray-700 pl-4', // level 1
  'ml-12 border-l-2 border-gray-700 pl-4', // level 2
  'ml-16 border-l-2 border-gray-700 pl-4', // level 3
  'ml-20 border-l-2 border-gray-600 pl-4', // level 4
  'ml-24 border-l-2 border-gray-500 pl-4', // level 5
];
```

**Visual Effect:**
- **Progressive indentation**: 6, 12, 16, 20, 24 (ml-X)
- **Lighter borders**: Deeper levels have lighter borders
- **Max depth**: 5 levels

---

## Styling Guidelines

### Tailwind Classes

**Buttons:**
```typescript
// Primary action
className="px-3 h-8 flex items-center text-sm text-blue-400 hover:text-blue-300 bg-gray-800/40 hover:bg-gray-700/60 rounded border border-blue-500/50 hover:border-blue-400/70 transition-colors"

// Secondary action
className="px-3 h-8 flex items-center text-sm text-gray-300 hover:text-white bg-gray-800/40 hover:bg-gray-700/60 rounded border border-gray-600/40 hover:border-gray-500/60 transition-colors"

// Danger action
className="text-xs text-gray-500 hover:text-red-400 transition-colors"
```

**Inputs:**
```typescript
// Text input
className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"

// Select
className="px-3 h-8 bg-gray-800/40 hover:bg-gray-700/60 rounded border border-gray-600/40 hover:border-gray-500/60 text-gray-300 text-sm focus:outline-none focus:border-blue-500 transition-colors"
```

**Cards:**
```typescript
// Main card
className="bg-gray-900/30 border border-gray-700 rounded-lg overflow-hidden"

// Card header
className="bg-gray-800/30 border-b border-gray-700 px-4 py-2"

// Card body
className="p-3" // or "p-4" for more padding

// Card footer
className="bg-gray-800/30 border-t border-gray-700 px-4 py-2"
```

**Text:**
```typescript
// Heading
className="text-xl font-bold text-white"

// Subheading
className="text-sm text-gray-400"

// Body text
className="text-gray-200 text-sm leading-relaxed"

// Muted text
className="text-xs text-gray-500"
```

### Color Palette

**Grays:**
```
text-white        #FFFFFF
text-gray-200     #E5E7EB
text-gray-300     #D1D5DB
text-gray-400     #9CA3AF
text-gray-500     #6B7280
text-gray-600     #4B5563

bg-gray-800       #1F2937
bg-gray-900       #111827
border-gray-600   #4B5563
border-gray-700   #374151
```

**Accent Colors:**
```
text-blue-400     #60A5FA
text-green-400    #4ADE80
text-purple-400   #A78BFA
text-orange-400   #FB923C
text-amber-400    #FBBF24
text-emerald-400  #34D399
text-red-400      #F87171
```

---

## Data Flow Patterns

### Server Component Data Fetching
```typescript
// forums/page.tsx
async function getForumData() {
  const forumService = new ForumService();
  const [categories, stats] = await Promise.all([
    forumService.getCategories(),
    forumService.getForumStats(),
  ]);
  return { categories, stats };
}

export default async function ForumsPage() {
  const { categories, stats } = await getForumData();
  return <div>...</div>;
}
```

### Client Component API Calls
```typescript
// forums/category/[slug]/page.tsx
'use client';

export default function CategoryPage() {
  const [topics, setTopics] = useState<any[]>([]);

  useEffect(() => {
    async function loadTopics() {
      const response = await fetch(`/api/forums/topics?category_slug=${slug}&limit=50`);
      const data = await response.json();
      setTopics(data.data.topics);
    }
    loadTopics();
  }, [slug]);

  return <div>...</div>;
}
```

### Server/Client Split Pattern
```typescript
// forums/search/page.tsx (Server Component)
export default function ForumSearchPage() {
  return (
    <ForumSearchServer>
      {(categories) => (
        <Suspense fallback={<LoadingState />}>
          <ForumSearchClient initialCategories={categories} />
        </Suspense>
      )}
    </ForumSearchServer>
  );
}

// ForumSearchServer.tsx (Server Component)
export async function ForumSearchServer({ children }) {
  const db = dbPool.getConnection('forums');
  const categories = db.prepare('SELECT * FROM forum_categories').all();
  return <>{children(categories)}</>;
}

// ForumSearchClient.tsx (Client Component)
'use client';
export function ForumSearchClient({ initialCategories }) {
  const [results, setResults] = useState([]);
  // Interactive search logic
  return <div>...</div>;
}
```

**Benefits:**
- **Initial data** loaded server-side (fast, SEO-friendly)
- **Interactive features** handled client-side (search, filters)
- **Type safety** maintained across boundary
- **Suspense** for loading states

---

## Restoration Checklist

### Missing Components (v0.36 → v0.37)

✅ **Already Exist in v0.37:**
1. ForumCategoryList.tsx
2. TopicRow.tsx (exports TopicList)
3. ReplyList.tsx
4. SearchBox.tsx (renamed from ForumSearch.tsx)
5. TopicView.tsx
6. TopicModerationDropdown.tsx
7. UserLink.tsx
8. UserIndexFilters.tsx

❌ **Missing in v0.37 (Need Restoration):**
1. **ForumHeaderActions.tsx** - Login widget + user list link
2. **LoginWidget.tsx** - Auth widget wrapper
3. **NewTopicButton.tsx** - Create topic button
4. **TagDisplay.tsx** - Tag rendering with colors
5. **TagSelector.tsx** - Tag input widget
6. **TopicHeader.tsx** - Extracted header component
7. **TopicFooter.tsx** - Extracted footer component
8. **TopicStatusBadges.tsx** - Status badge component
9. **TopicEditForm.tsx** - Extracted edit form
10. **ForumSearchClient.tsx** - Client search component
11. **ForumSearchServer.tsx** - Server search wrapper

### Missing Pages (v0.36 → v0.37)

❌ **Missing in v0.37:**
1. **/forums/browse/page.tsx** - Browse all topics page

✅ **Already Exist:**
1. /forums/page.tsx
2. /forums/category/[slug]/page.tsx
3. /forums/topic/[id]/page.tsx
4. /forums/create/page.tsx
5. /forums/search/page.tsx

### Missing Features

1. **Complete tag system** (TagDisplay + TagSelector)
2. **Browse page** with unified search interface
3. **Compact header pattern** consistency
4. **Extracted sub-components** for TopicView
5. **Server/client split** for search page

---

## Implementation Priority

### Phase 1: Core UI Components (High Priority)
1. **TopicHeader.tsx** - Extract from TopicView
2. **TopicFooter.tsx** - Extract from TopicView
3. **TopicStatusBadges.tsx** - Extract from TopicView
4. **TopicEditForm.tsx** - Extract from TopicView
5. **NewTopicButton.tsx** - Restore create button
6. **ForumHeaderActions.tsx** - Restore header widget
7. **LoginWidget.tsx** - Restore auth wrapper

### Phase 2: Tag System (Medium Priority)
1. **TagDisplay.tsx** - Tag rendering component
2. **TagSelector.tsx** - Tag input widget
3. Update TopicView to use TagDisplay
4. Update create page to use TagSelector

### Phase 3: Browse & Search (Medium Priority)
1. **ForumSearchServer.tsx** - Server wrapper
2. **ForumSearchClient.tsx** - Client search UI
3. **/forums/browse/page.tsx** - Browse page
4. Update search page to use server/client split

### Phase 4: Polish & Refinement (Low Priority)
1. Ensure compact header pattern consistency
2. Verify 12-column grid alignment
3. Check color coding consistency
4. Test nesting indentation
5. Verify all hover states

---

## File Size Reference

**Largest Components:**
- ReplyList.tsx: ~700 lines (complex nested UI + optimistic updates)
- TopicRow.tsx: ~350 lines (includes TopicList)
- TagSelector.tsx: ~270 lines (autocomplete + keyboard nav)
- ForumSearchClient.tsx: ~240 lines (search UI + filters)
- ForumCategoryList.tsx: ~160 lines (memoized sections)
- TagDisplay.tsx: ~200 lines (includes PopularTags, TrendingTags)
- UserLink.tsx: ~250 lines (includes UserAvatar)

**Smallest Components:**
- LoginWidget.tsx: ~15 lines (wrapper)
- ForumHeaderActions.tsx: ~32 lines (simple layout)
- NewTopicButton.tsx: ~52 lines (button logic)
- ForumSearch.tsx: ~69 lines (search input)
- TopicStatusBadges.tsx: ~67 lines (badge display)
- TopicFooter.tsx: ~63 lines (footer actions)

---

## Key Takeaways

### v0.36 Strengths
1. **Extracted sub-components** improve maintainability
2. **Consistent design language** across all pages
3. **Compact UI** maximizes content density
4. **12-column grid** ensures alignment
5. **Optimistic UI** provides instant feedback
6. **Server/client split** optimizes performance
7. **Complete tag system** adds metadata
8. **Browse page** provides overview

### v0.37 Missing Elements
1. **8 components removed** (tag system, extracted sub-components)
2. **1 page removed** (browse)
3. **Tag system** completely removed
4. **Extracted components** merged back into TopicView
5. **Server/client split** simplified (lost performance optimization)

### Restoration Benefits
1. **Improved maintainability** - Smaller components
2. **Better performance** - Server/client split
3. **Enhanced features** - Tag system
4. **Consistent UI** - Extracted sub-components
5. **Better UX** - Browse page, optimistic updates

---

## End of Analysis

This document provides a complete reference for restoring v0.36 UI features to v0.37. All component implementations, styling patterns, and architectural decisions have been documented with exact code examples.
