# Backend Improvements for Individual User Revision Management

## Current State Analysis

The existing revision API at `/src/app/api/projects/[slug]/revisions/route.ts` already has solid productivity-focused features:

**Strengths:**

- Advanced filtering (date range, size changes, content search)
- Enhanced metadata (word counts, change categories, time differences)
- Productivity scoring for revision comparisons
- Smart pagination with total counts
- Efficient single-query architecture with joins
- Connection pooling integration

**Areas for Individual Productivity Enhancement:**

## 1. Enhanced Revision Querying and Filtering

### A. Semantic Search Capabilities

Add full-text search across revision content and summaries:

```typescript
// Add to GET method query parameters
const contentSearch = searchParams.get('contentSearch'); // FTS search
const semanticSearch = searchParams.get('semanticSearch'); // Boolean for content FTS

// Enhanced query with FTS virtual table
if (contentSearch) {
  whereConditions.push(`r.id IN (
    SELECT revision_id FROM wiki_revision_fts 
    WHERE wiki_revision_fts MATCH ?
  )`);
  queryParams.push(contentSearch);
}
```

### B. Smart Revision Grouping

Group related revisions by work sessions:

```typescript
// Detect work sessions (revisions within 2 hours of each other)
const sessionGap = searchParams.get('sessionGap') || '7200000'; // 2 hours in ms
const groupBySessions = searchParams.get('groupBySessions') === 'true';

// Add session grouping to the response
if (groupBySessions) {
  return {
    ...response,
    sessions: groupRevisionsBySessions(enhancedRevisions, parseInt(sessionGap)),
  };
}
```

### C. Advanced Change Pattern Detection

```typescript
// Detect revision patterns for productivity insights
const patterns = {
  rapid_iterations: detectRapidIterations(enhancedRevisions),
  focused_sections: detectFocusedEditing(enhancedRevisions),
  refactoring_sessions: detectRefactoringSessions(enhancedRevisions),
};
```

## 2. Enhanced Revision Metadata

### A. Content Analysis Metrics

```typescript
// Enhanced revision processing with content analysis
const enhancedRevision = {
  ...revision,
  content_metrics: {
    readability_score: calculateReadabilityScore(revision.content),
    structure_score: analyzeDocumentStructure(revision.content),
    complexity_change: calculateComplexityChange(revision, previousRevision),
    section_changes: detectSectionChanges(revision, previousRevision),
  },
};
```

### B. Productivity Heuristics

```typescript
// Add productivity insights to revision metadata
const productivityMetrics = {
  focus_score: calculateFocusScore(revision), // Based on change concentration
  efficiency_score: calculateEfficiencyScore(revision), // Changes per time unit
  quality_indicator: assessChangeQuality(revision), // Based on change patterns
  momentum_score: calculateMomentumScore(revisionHistory), // Writing momentum
};
```

## 3. Performance Improvements

### A. Intelligent Caching Strategy

```typescript
// Individual user-focused cache keys
const cacheKey = `revisions:${projectSlug}:${userId}:${cacheableParams}`;

// Cache with appropriate TTL based on revision frequency
const ttl = getAdaptiveTTL(projectSlug, userId); // Shorter TTL for active projects
```

### B. Optimized Database Queries

```typescript
// Prepared statement caching for frequent individual queries
const PREPARED_STATEMENTS = {
  userRecentRevisions: db.prepare(`
    SELECT r.*, u.username 
    FROM wiki_revisions r 
    JOIN users u ON r.author_id = u.id 
    WHERE r.author_id = ? AND r.revision_timestamp >= ?
    ORDER BY r.revision_timestamp DESC LIMIT ?
  `),

  projectRevisionStats: db.prepare(`
    SELECT 
      COUNT(*) as total,
      AVG(size_bytes) as avg_size,
      MAX(revision_timestamp) as last_update
    FROM wiki_revisions 
    WHERE page_id = ? AND author_id = ?
  `),
};
```

### C. Lazy Loading with Progressive Enhancement

```typescript
// Lightweight initial response, progressive enhancement via separate endpoints
export async function GET(request: NextRequest) {
  const mode = searchParams.get('mode') || 'full'; // 'light', 'full', 'enriched'

  switch (mode) {
    case 'light':
      return getRevisionSummaries(); // Minimal data for quick navigation
    case 'full':
      return getFullRevisions(); // Current implementation
    case 'enriched':
      return getEnrichedRevisions(); // Heavy analysis, async processing
  }
}
```

## 4. Better Search and Filtering

### A. Saved Search Presets

```typescript
// Personal productivity presets for individual users
const searchPresets = {
  'my-recent-work': { author_id: userId, days: 7 },
  'major-changes': { minSizeChange: 1000, significance: 'major' },
  'draft-revisions': { summary: 'draft', content: 'TODO|FIXME|XXX' },
  'writing-sessions': { groupBySessions: true, sessionGap: 3600000 },
};
```

### B. Contextual Search Suggestions

```typescript
// Smart suggestions based on revision patterns
const searchSuggestions = {
  recent_topics: extractRecentTopicsFromRevisions(userRevisions),
  frequently_edited_sections: getFrequentlyEditedSections(userRevisions),
  related_projects: findRelatedProjects(projectSlug, userId),
};
```

## 5. Enhanced API Responses for Better Individual UX

### A. Revision Navigation Helpers

```typescript
// Add navigation metadata for smooth individual workflow
const navigationHelpers = {
  next_significant_change: findNextSignificantRevision(currentRevisionId),
  previous_milestone: findPreviousMilestoneRevision(currentRevisionId),
  related_revisions: findRelatedRevisionsByContent(revision),
  quick_jump_points: identifyQuickJumpPoints(revisionHistory),
};
```

### B. Personal Progress Tracking

```typescript
// Individual progress insights
const personalInsights = {
  writing_velocity: calculateWritingVelocity(userRevisions),
  productivity_trends: analyzeProductivityTrends(userRevisions, timeframe),
  goal_progress: trackGoalProgress(userRevisions, personalGoals),
  streaks: calculateWritingStreaks(userRevisions),
};
```

## 6. Better Caching Strategies for Individual Patterns

### A. User-Specific Cache Warming

```typescript
// Pre-warm cache for likely individual user queries
const warmUserCache = async (userId: string, projectSlug: string) => {
  const commonQueries = [
    { limit: 20, author_id: userId },
    { dateFrom: getLastWeek(), author_id: userId },
    { minSizeChange: 100, author_id: userId },
  ];

  // Background cache warming
  Promise.all(commonQueries.map((params) => fetchRevisions(projectSlug, params)));
};
```

### B. Adaptive Cache TTL

```typescript
// Shorter TTL for active editing sessions
const getAdaptiveTTL = (projectSlug: string, userId: string) => {
  const recentActivity = getRecentActivityLevel(projectSlug, userId);

  if (recentActivity === 'high') return 300; // 5 minutes
  if (recentActivity === 'medium') return 1800; // 30 minutes
  return 3600; // 1 hour for inactive projects
};
```

## 7. Quality of Life Backend Improvements

### A. Revision Bookmarking

```typescript
// Simple personal bookmarking for important revisions
const bookmarkedRevisions = {
  major_milestones: getBookmarkedRevisions(userId, 'milestone'),
  interesting_changes: getBookmarkedRevisions(userId, 'interesting'),
  reference_points: getBookmarkedRevisions(userId, 'reference'),
};
```

### B. Smart Revision Summarization

```typescript
// Auto-generate meaningful summaries for revisions without summaries
const enhanceRevisionSummary = (revision: Revision) => {
  if (!revision.summary || revision.summary === 'No summary') {
    return {
      ...revision,
      auto_summary: generateSmartSummary(revision.content, revision.prev_content),
      summary_confidence: calculateSummaryConfidence(revision),
    };
  }
  return revision;
};
```

## Implementation Priority

**High Priority (Immediate Individual Productivity Impact):**

1. Intelligent caching with user patterns
2. Revision session grouping
3. Enhanced content search
4. Performance query optimizations

**Medium Priority (Quality of Life):** 5. Personal navigation helpers 6. Content analysis metrics 7. Productivity tracking 8. Smart summarization

**Low Priority (Nice to Have):** 9. Advanced pattern detection 10. Bookmarking system 11. Search presets 12. Cache warming strategies

## Technical Implementation Notes

- All improvements focus on single-user optimization
- Maintain existing connection pool architecture
- Use existing security middleware patterns
- Add new features as optional query parameters
- Preserve backward compatibility
- Focus on SQLite optimization for individual use patterns
- Leverage existing prepared statement architecture

This approach enhances the backend specifically for individual productivity without adding collaborative complexity or social features.
