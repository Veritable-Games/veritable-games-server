# Tag System Architecture & Anarchist Categorization

**Date:** 2025-11-09  
**Scope:** Complete analysis of current tag systems, categorization approach, and integration points  
**Status:** Ready for implementation planning

---

## Executive Summary

The codebase contains **three independent tag systems** with different schemas and no cross-system unification:

1. **Library Tag System** - For document management (SQLite)
2. **Forum Tag System** - For topic categorization
3. **Reference Tag System** - For project image/video organization

An **existing anarchist tag categorization framework** is partially implemented with:
- 8 predefined political/social categories
- Keyword-based auto-categorization (high/medium/low confidence)
- Scripts for mapping and importing tags

This document provides a complete technical reference for implementing unified tag management with anarchist tag integration.

---

## 1. DATABASE SCHEMAS

### 1.1 Library Tag System

Located in: `library` schema  
Purpose: Text document management and categorization

#### Tables

**library_tag_categories** - Category groupings
```sql
CREATE TABLE library_tag_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,           -- 'source', 'theme', 'method', 'time', 'geography'
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_library_tag_categories_type ON library_tag_categories(type);
```

**library_tags** - Individual tags
```sql
CREATE TABLE library_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES library_tag_categories(id)
);

CREATE INDEX idx_library_tags_category ON library_tags(category_id);
```

**library_document_tags** - Junction table (many-to-many)
```sql
CREATE TABLE library_document_tags (
  document_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  added_by INTEGER,
  added_at DATETIME,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES library_tags(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_library_document_tags_document ON library_document_tags(document_id);
CREATE INDEX idx_library_document_tags_tag ON library_document_tags(tag_id);
CREATE INDEX idx_library_document_tags_user ON library_document_tags(added_by);
```

**Key Characteristics:**
- Tags are unique by name only
- Categories use `type` enum string (not normalized)
- Junction table tracks who added tags and when
- No explicit visibility controls at tag level
- Usage counts not auto-maintained (must be computed)

---

### 1.2 Forum Tag System

Located in: `forums` schema  
Purpose: Topic categorization and discussion organization

#### Tables

**tags** - Forum tags
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,                    -- Hex color code
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);
```

**topic_tags** - Junction table (many-to-many)
```sql
CREATE TABLE topic_tags (
  topic_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_topic_tags_tag_id ON topic_tags(tag_id);
CREATE INDEX idx_topic_tags_topic_id ON topic_tags(topic_id);
```

**Triggers** - Automatic usage count management
```sql
-- Auto-increment usage count on tag assignment
CREATE TRIGGER trg_topic_tags_insert_update_usage
AFTER INSERT ON topic_tags
BEGIN
  UPDATE tags
  SET usage_count = (SELECT COUNT(*) FROM topic_tags WHERE tag_id = NEW.tag_id)
  WHERE id = NEW.tag_id;
END;

-- Auto-decrement usage count on tag removal
CREATE TRIGGER trg_topic_tags_delete_update_usage
AFTER DELETE ON topic_tags
BEGIN
  UPDATE tags
  SET usage_count = (SELECT COUNT(*) FROM topic_tags WHERE tag_id = OLD.tag_id)
  WHERE id = OLD.tag_id;
END;
```

**Seed Data** - 10 default tags
```
question, discussion, bug, feature-request, help, tutorial, 
announcement, feedback, showcase, meta
```

**Key Characteristics:**
- Tags have slug for URL-friendly references
- Usage counts auto-maintained by triggers
- Optional color for UI styling
- No category grouping (flat structure)
- Timestamps track creation and updates

---

### 1.3 Reference/Project Tag System

Located in: Main database (project_references)  
Purpose: Image/video tagging within projects

#### Tables

**reference_categories** - Tag categories for organization
```sql
CREATE TABLE reference_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'public',    -- 'public' | 'private'
  display_order INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**reference_tags** - Individual reference tags
```sql
CREATE TABLE reference_tags (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  display_order INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES reference_categories(id)
);
```

**project_reference_tags** - Junction table (many-to-many)
```sql
CREATE TABLE project_reference_tags (
  reference_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (reference_id, tag_id),
  FOREIGN KEY (reference_id) REFERENCES project_reference_images(id),
  FOREIGN KEY (tag_id) REFERENCES reference_tags(id)
);
```

**Key Characteristics:**
- String IDs (branded types: ReferenceTagId, ReferenceCategoryId)
- Normalized categories with ID references (unlike library)
- Display order for UI positioning
- Visibility controls at category level
- No usage count tracking
- Project-scoped tags (separate per project)

---

## 2. TYPE DEFINITIONS

### 2.1 Library Tag Types

**File:** `/frontend/src/lib/library/types.ts`

```typescript
export interface LibraryTag {
  id: number;
  name: string;
  category_id: number | null;
  description: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface LibraryTagCategory {
  id: number;
  name: string;
  type: string;  // 'source', 'theme', 'method', 'time', 'geography'
  description: string | null;
  created_at: string;
  updated_at: string;
}

// UI grouping for display
export interface LibraryTagGroup {
  id?: number;           // Category ID for API operations
  type: string;          // Category type identifier
  name: string;          // Category display name
  tags: Array<{
    id: number;
    name: string;
    usage_count: number;
  }>;
}

export interface LibraryDocumentWithMetadata extends LibraryDocument {
  category_name?: string;
  category_code?: string;
  tags?: Array<{
    id: number;
    name: string;
    type: string;        // Category type
  }>;
  uploaded_by_username?: string;
  uploaded_by_display_name?: string;
  is_public?: boolean;
}
```

**Key Points:**
- `LibraryTagGroup` is the main UI type for displaying grouped tags
- `type` field is used for categorization (not ID)
- Includes usage count for popularity displays
- Tags are grouped by category type for sidebar display

---

### 2.2 Reference Tag Types

**File:** `/frontend/src/types/project-references.ts`

```typescript
export interface ReferenceTag {
  id: ReferenceTagId;
  name: string;
  color: string;
  category: {
    id: ReferenceCategoryId;
    name: string;
  };
  display_order?: number;
}

export interface ReferenceCategory {
  id: ReferenceCategoryId;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  display_order: number;
  tag_count?: number;
}

export interface ReferenceImage {
  id: ReferenceImageId;
  // ... other fields ...
  tags: ReferenceTag[];  // Resolved relationship
  // ... other fields ...
}
```

**Key Points:**
- Uses branded ID types for type safety
- Category is nested object in tag
- Display order for UI sorting
- Visibility at category level
- Tags resolved in ReferenceImage

---

### 2.3 Forum Tag Types

**File:** `/frontend/src/lib/database/schema-types.ts`

```typescript
export interface ForumTagRecord {
  id: number;
  name: string;
  slug: string;
  color?: string;
  usage_count: number;
  created_at: string;
}

export interface ForumTopicTagRecord {
  topic_id: TopicId;
  tag_id: number;
  created_at: string;
}
```

**Key Points:**
- Simple record types matching database schema
- No category structure
- Slug for URL compatibility
- Usage count maintained by triggers

---

## 3. COMPONENTS & USAGE

### 3.1 TagFilterSidebar Component

**File:** `/frontend/src/components/library/TagFilterSidebar.tsx`  
**Usage:** Library document filtering

**Props:**
```typescript
interface TagFilterSidebarProps {
  tagGroups: LibraryTagGroup[];          // Tags grouped by category
  selectedTags: string[];                 // Selected tag names
  onTagToggle: (tagName: string) => void; // Toggle selection
  onClearFilters: () => void;             // Clear all selections
  user?: { id: number; role: string } | null;
  onRefreshTags?: () => void;
}
```

**Features:**
- Expandable category sections
- Drag-and-drop reordering (admin only)
- Inline tag creation (admin only)
- Category creation (admin only)
- Keyboard shortcuts:
  - `Escape` - Clear all filters
  - `Delete` - Delete selected tags (admin) or clear filters (user)
- Mobile responsive toggle
- Delete confirmation modal
- Smooth CSS animations

**Key Code Patterns:**

Tag selection:
```typescript
const isSelected = selectedTags.includes(tag.name);
onChange={() => onTagToggle(tag.name)}
```

Drag-and-drop:
```typescript
const handleDragStart = (e: React.DragEvent, tag: { id: number; name: string }, categoryType: string) => {
  if (!isAdmin) return;
  setDraggedTag({ id: tag.id, name: tag.name, categoryType });
  e.dataTransfer.effectAllowed = 'move';
};
```

Admin operations:
```typescript
const handleDeleteTags = async () => {
  await Promise.all(
    tagsToDeletePermanently.map(tag =>
      fetchJSON(`/api/library/tags/${tag.id}`, { method: 'DELETE' })
    )
  );
  onRefreshTags?.();
};
```

**Animation Details:**
- 300ms transition for smooth removal
- Scale/opacity transforms on delete
- Drop target highlight with ring effect

---

### 3.2 TagFilters Component (References)

**File:** `/frontend/src/components/references/TagFilters.tsx`  
**Usage:** Reference image filtering

**Props:**
```typescript
interface TagFiltersProps {
  projectSlug: string;
  isAdmin: boolean;
}
```

**Features:**
- Global tag selection (all projects)
- Tag creation (admin inline button)
- Tag deletion with animation
- Sort by default or dimensions
- Keyboard shortcuts identical to library version

**State Management:**
Uses Zustand store:
```typescript
const { 
  selectedTags,      // ReferenceTagId[]
  toggleTag,         // (tagId: ReferenceTagId) => void
  clearTags,         // () => void
  setAllTags,        // (tags: ReferenceTag[]) => void
  allTags,           // ReferenceTag[]
  config,            // Project config
  sortBy,            // 'default' | 'dimensions'
  setSortBy          // (sort: string) => void
} = useReferencesStore();
```

---

### 3.3 Other Components

**Forum Tags:**
- `TagDisplay.tsx` - Render tag with styling
- `TagSelector.tsx` - Multi-select tag picker
- Seed data: 10 default tags (question, discussion, bug, etc.)

**Reference Tags:**
- `BatchTaggingPanel.tsx` - Apply tags to multiple images
- `TagChip.tsx` - Individual tag chip display
- `TagList.tsx` - List of tags
- `TagActions.tsx` - Tag operations (add, remove, edit)
- `LightboxTagSystem.tsx` - In-lightbox tagging

---

## 4. API ROUTES & ENDPOINTS

### 4.1 Library Tag API

**Base:** `/api/library/`

**GET /tags**
```
Response: {
  success: boolean,
  tags: Record<categoryType, Array<{ id, name, usage_count }>>,
  categories: LibraryTagCategory[]
}
```

**POST /tags**
```
Body: { name: string, category_type: string, description?: string }
Response: { success: boolean, tag_id?: number, error?: string }
```

**DELETE /tags/[id]**
```
Response: { success: boolean, error?: string }
```

**PUT /tags/[id]/category**
```
Body: { categoryId: number }
Response: { success: boolean, error?: string }
```

**GET /tag-categories**
```
Response: LibraryTagCategory[]
```

**POST /tag-categories**
```
Body: { name: string, type: string }
Response: { success: boolean, category_id?: number, error?: string }
```

---

### 4.2 Reference Tag API

**Base:** `/api/projects/[slug]/references/`

**GET /tags**
- Returns all tags grouped by category

**POST /tags**
- Creates new tag in project

**DELETE /tags/[tagId]**
- Deletes tag from project

---

## 5. ANARCHIST TAG CATEGORIZATION FRAMEWORK

### 5.1 Existing Implementation

**Scripts:**
1. `map-anarchist-tags.ts` - Maps tags to categories
2. `import-anarchist-tags.ts` - Imports to database

**Process:**
1. Extract unique tags from documents
2. Auto-categorize using keyword matching
3. Generate CSV for manual review
4. Import approved tags to database

---

### 5.2 Predefined Categories (8 Total)

#### 1. Political Theory
**Color:** #FF6B6B (Red)  
**Keywords:**
- anarchism, anarchist, anarcho
- politics, political, theory
- socialism, communism, marxism
- libertarian, authority, state
- revolution, resistance, rebellion
- oppression, liberation

**Example Tags:**
- Anarchism, Anarcho-communism, Anarcho-syndicalism
- Political authority, State critique
- Revolutionary theory, Resistance movements

#### 2. Economics
**Color:** #4ECDC4 (Teal)  
**Keywords:**
- economics, economy, capitalism
- labor, work, wage, trade
- business, market, money, currency, finance, wealth
- cooperative, mutual, aid

**Example Tags:**
- Labor movement, Wage labor
- Mutual aid economics, Cooperative systems
- Anti-capitalism, Economic justice

#### 3. Social Justice
**Color:** #95E1D3 (Light Teal)  
**Keywords:**
- justice, equality, rights
- discrimination, racism, sexism
- gender, identity, queer, lgbtq
- feminist, feminism
- disability, class, intersectional
- oppression

**Example Tags:**
- Feminism, Gender liberation
- Anti-racism, Racial justice
- Disability justice, Queer liberation

#### 4. Technology & Science
**Color:** #A8E6CF (Mint)  
**Keywords:**
- technology, tech, science
- computing, digital, artificial
- intelligence, internet, algorithm
- data, cyber, software

**Example Tags:**
- Digital resistance, Technology critique
- AI ethics, Surveillance
- Cybernetics, Digital commons

#### 5. History
**Color:** #FFD3B6 (Peach)  
**Keywords:**
- history, historical, past
- century, war, revolution
- movement, struggle, labor
- civil, rights, era, period

**Example Tags:**
- Labor history, Civil rights movement
- Revolutionary periods, Historical analysis
- Resistance history, Social movements

#### 6. Education & Culture
**Color:** #FFAAA5 (Light Coral)  
**Keywords:**
- education, pedagogy, learning
- school, culture, art
- literature, philosophy, religion
- spiritual, knowledge, consciousness
- society

**Example Tags:**
- Critical pedagogy, Consciousness raising
- Cultural criticism, Radical education
- Philosophy, Art and culture

#### 7. Environment & Ecology
**Color:** #76C7AD (Green)  
**Keywords:**
- environment, ecology, ecological
- nature, climate, land, green
- sustainable, conservation
- permaculture, indigenous
- forest, water, soil, animal

**Example Tags:**
- Ecological socialism, Environmental justice
- Permaculture, Bioregionalism
- Indigenous knowledge, Environmental activism

#### 8. Community & Organization
**Color:** #FFDDC1 (Light Peach)  
**Keywords:**
- community, organization, collective
- group, network, assembly
- direct, action, consensus
- structure, power, hierarchy
- cooperation, solidarity

**Example Tags:**
- Direct action, Consensus building
- Community organizing, Mutual aid networks
- Horizontal organization, Collective action

---

### 5.3 Categorization Algorithm

**Confidence Levels:**

1. **High Confidence** - Exact keyword match
   - Tag name exactly matches a category keyword
   - Example: "anarchism" → Political Theory (high)

2. **Medium Confidence** - Contains keyword
   - Tag contains a category keyword
   - Example: "anarcho-communism" → Political Theory (medium)

3. **Low Confidence** - No match found
   - Tag doesn't match any keywords
   - Defaults to "Political Theory"
   - Requires manual review

**Implementation:**
```typescript
function categorizeTag(tagName: string): {
  category: string;
  color: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const lowerTag = tagName.toLowerCase();
  
  // Check each category's keywords
  for (const category of LIBRARY_CATEGORIES) {
    if (category.keywords.some(keyword => lowerTag.includes(keyword))) {
      const exactMatch = category.keywords.some(keyword => keyword === lowerTag);
      return {
        category: category.name,
        color: category.color,
        confidence: exactMatch ? 'high' : 'medium',
        reason: exactMatch 
          ? 'Exact keyword match' 
          : 'Contains category keyword',
      };
    }
  }
  
  // Default fallback
  return {
    category: 'Political Theory',
    color: '#FF6B6B',
    confidence: 'low',
    reason: 'No keyword match - requires manual review',
  };
}
```

---

### 5.4 Integration Workflow

**Step 1: Map Tags**
```bash
npx ts-node src/scripts/map-anarchist-tags.ts
```
- Reads anarchist_documents table
- Categorizes all unique tags
- Generates `anarchist-tags-review.csv`
- Shows confidence breakdown

**Step 2: Manual Review**
- Edit CSV to adjust categories if needed
- Mark irrelevant tags with "Skip"
- Delete rows for excluded tags

**Step 3: Import Tags**
```bash
npx ts-node src/scripts/import-anarchist-tags.ts
```
- Creates tag categories if needed
- Inserts new tags
- Skips existing tags
- Reports success/failure

---

## 6. STORAGE & RETRIEVAL PATTERNS

### 6.1 Library Documents - Tag Storage

**Pattern:** Many-to-many with junction table

**Storage:**
- Tag definitions in `library_tags`
- Categories in `library_tag_categories`
- Assignments in `library_document_tags`

**Retrieval:**
```sql
-- Get document with all tags
SELECT d.*, t.id, t.name, tc.type
FROM library_documents d
LEFT JOIN library_document_tags dt ON d.id = dt.document_id
LEFT JOIN library_tags t ON dt.tag_id = t.id
LEFT JOIN library_tag_categories tc ON t.category_id = tc.id
WHERE d.id = $1
ORDER BY tc.type, t.name;
```

**Query by Tags:**
```sql
-- Get documents with specific tags
SELECT DISTINCT d.*
FROM library_documents d
INNER JOIN library_document_tags dt ON d.id = dt.document_id
INNER JOIN library_tags t ON dt.tag_id = t.id
WHERE t.name = ANY($1::text[])
GROUP BY d.id
HAVING COUNT(DISTINCT t.id) = array_length($1::text[], 1);
```

---

### 6.2 Reference Images - Tag Storage

**Pattern:** Branded ID types with categorized tags

**Storage:**
- Tag definitions in `reference_tags`
- Categories in `reference_categories`
- Assignments in `project_reference_tags`

**Retrieval (Zustand Store):**
```typescript
// Get all tags grouped by category
const tags = await fetchTags(projectSlug);
const groupedByCategory = groupBy(tags, t => t.category.id);
```

---

### 6.3 Forum Topics - Tag Storage

**Pattern:** Many-to-many with trigger-maintained counts

**Storage:**
- Tag definitions in `tags` (flat structure)
- Assignments in `topic_tags`
- Triggers auto-update `tags.usage_count`

**Retrieval:**
```sql
-- Most used tags
SELECT * FROM tags
ORDER BY usage_count DESC
LIMIT 10;

-- Get topics by tag
SELECT t.* FROM forum_topics t
INNER JOIN topic_tags tt ON t.id = tt.topic_id
WHERE tt.tag_id = $1;
```

---

## 7. STATE MANAGEMENT

### 7.1 References Store (Zustand)

**File:** Should be in `src/lib/stores/referencesStore.ts`

**State:**
```typescript
interface ReferencesStore {
  // Selection state
  selectedTags: ReferenceTagId[];
  selectedImageIndex: number | null;
  
  // UI state
  isLightboxOpen: boolean;
  isUploading: boolean;
  uploadProgress: number;
  
  // Data
  images: ReferenceImage[];
  allTags: ReferenceTag[];
  
  // Config
  config: ProjectConfig | null;
  sortBy: 'default' | 'dimensions';
  
  // Actions
  toggleTag: (tagId: ReferenceTagId) => void;
  clearTags: () => void;
  setAllTags: (tags: ReferenceTag[]) => void;
  setSortBy: (sort: 'default' | 'dimensions') => void;
  // ... other actions
}
```

**Usage Pattern:**
```typescript
const { 
  selectedTags, 
  toggleTag, 
  clearTags, 
  allTags, 
  setAllTags 
} = useReferencesStore();

// Filter images based on selected tags
const filteredImages = images.filter(img =>
  selectedTags.length === 0 ||
  img.tags.some(t => selectedTags.includes(t.id))
);
```

---

### 7.2 Library Tags - Query-Based State

**Pattern:** Fetch tags from API on component mount

**Pattern:**
```typescript
const [tagGroups, setTagGroups] = useState<LibraryTagGroup[]>([]);
const [selectedTags, setSelectedTags] = useState<string[]>([]);

useEffect(() => {
  // Fetch tags grouped by category
  const response = await fetch('/api/library/tags');
  const data = await response.json();
  
  // Transform API response to UI format
  const groups = Object.entries(data.tags).map(([type, tags]) => ({
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    tags: tags as Array<{ id: number; name: string; usage_count: number }>
  }));
  
  setTagGroups(groups);
}, []);
```

---

## 8. KEY ARCHITECTURAL PATTERNS

### 8.1 Component Hierarchies

**Library Document Display:**
```
LibraryPage
├── TagFilterSidebar
│   ├── Category (expandable)
│   │   ├── Tag Checkbox
│   │   └── Tag Creation Form (admin)
│   └── Category Creation Form (admin)
└── DocumentList
    └── Document Card
        └── Tag Display
```

**Reference Gallery:**
```
GalleryPage
├── TagFilters
│   ├── Tag Selection Buttons
│   ├── Tag Creation (admin)
│   └── Sort Selector
├── MasonryGrid
│   └── ImageCard
│       └── Image + Tags
└── ImageLightbox
    └── LightboxTagSystem
```

---

### 8.2 API Request/Response Pattern

**Create Tag:**
```typescript
// UI initiates request
const response = await fetchJSON(`${apiPath}/tags`, {
  method: 'POST',
  body: { name: newTagName.trim() },
});

// Optimistic update (immediate UI feedback)
if (response.tag_id) {
  const newTag = {
    id: response.tag_id as ReferenceTagId,
    name: newTagName.trim(),
    color: '#808080',
    category: { id: 'general' as any, name: 'General' },
    display_order: allTags.length,
  };
  setAllTags([...allTags, newTag]);
}

// Reset form
setNewTagName('');
setIsCreating(false);
```

---

### 8.3 Delete Operation Pattern

**Pattern: Smooth animation with async deletion**

```typescript
// 1. Mark for deletion (visual feedback)
setRemovingTags(prev => {
  const next = new Set(prev);
  tagsToDelete.forEach(tag => next.add(tag.id));
  return next;
});

// 2. Clear selections immediately
clearTags();

// 3. Wait for animation
setTimeout(() => {
  // 4. Remove from DOM after 300ms
  const newTags = allTags.filter(t => !tagsToDelete.some(dt => dt.id === t.id));
  setAllTags(newTags);
}, 300);

// 5. Send delete requests in background (parallel)
const deletePromises = tagsToDelete.map(tag =>
  fetchJSON(`${apiPath}/tags/${tag.id}`, { method: 'DELETE' })
);
await Promise.all(deletePromises);
```

---

### 8.4 Keyboard Shortcut Pattern

**Pattern: Context-aware behavior**

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  // Escape: Always clear selections
  if (e.key === 'Escape' && selectedTags.length > 0) {
    e.preventDefault();
    clearTags();
    return;
  }
  
  // Delete: Different behavior for admin vs user
  if (e.key === 'Delete' && selectedTags.length > 0) {
    e.preventDefault();
    
    if (isAdmin) {
      // Admin: Permanent delete with confirmation
      setTagsToDeletePermanently(selectedTags.map(...));
      setShowDeleteConfirmation(true);
    } else {
      // User: Just clear selections
      handleClear();
    }
  }
};
```

---

## 9. CURRENT SYSTEM LIMITATIONS

### 9.1 Schema Inconsistencies

| Aspect | Library | Forum | References |
|--------|---------|-------|------------|
| Category ID Type | `category_id` (INT) | None | `category_id` (TEXT) |
| Category Ref | Type enum string | N/A | Normalized ID |
| Tag Uniqueness | By name only | By name/slug | By ID (no constraint) |
| Usage Tracking | Manual compute | Auto via triggers | None |
| Color Support | No | Yes | Yes |
| Display Order | No | No | Yes |
| Visibility | No | No | Yes (category level) |

### 9.2 Lack of Cross-System Unification

**Problem:**
- Three independent tag systems
- No shared taxonomy
- Duplicate tag definitions possible
- Inconsistent types and schemas

**Impact:**
- Difficult to implement unified admin interface
- Inconsistent user experience across features
- Complex migration/consolidation scenarios

### 9.3 Library Tag Limitations

**Type Enum Approach:**
- Categories use string `type` field (not normalized ID)
- Limits flexibility for user-created categories
- Not comparable to Reference system's ID-based approach

**Missing Features:**
- No trigger-based usage count maintenance
- No color/styling support
- No display ordering

### 9.4 Anarchist Tag Integration

**Current Status:**
- Scripts exist but not integrated into normal workflows
- Requires manual CSV processing
- Dependencies on `anarchist_documents` table (may not exist)
- No automated syncing with document tags

**Missing Integration Points:**
- No scheduled job for tag categorization
- No UI for reviewing/approving categorized tags
- No automatic re-categorization on new documents

---

## 10. RECOMMENDED MIGRATION STRATEGY

### Phase 1: Unify Schema

1. Create unified `tags` table with all features
2. Create `tag_categories` with normalized IDs
3. Create separate junction tables per feature

**Benefits:**
- Single source of truth
- Consistent behavior across systems
- Easier maintenance

### Phase 2: Implement Admin Interface

1. Create unified tag management dashboard
2. Move anarchist tags into unified system
3. Support bulk operations (import, categorize, merge)

### Phase 3: Integrate Anarchist Categories

1. Expose category framework in tag creation
2. Add keyword-based auto-suggestion
3. Implement confidence scoring display

---

## 11. FILE LOCATIONS REFERENCE

### Core Components
```
/frontend/src/components/
├── library/TagFilterSidebar.tsx
├── references/
│   ├── TagFilters.tsx
│   └── tags/
│       ├── TagChip.tsx
│       ├── TagList.tsx
│       ├── TagActions.tsx
│       ├── TagStrip.tsx
│       ├── LightboxTagSystem.tsx
│       └── hooks/useTagMutations.ts
└── forums/
    ├── TagDisplay.tsx
    └── TagSelector.tsx
```

### Type Definitions
```
/frontend/src/
├── lib/library/types.ts
├── types/project-references.ts
├── lib/database/schema-types.ts
└── lib/types/database.ts
```

### API Routes
```
/frontend/src/app/api/
├── library/
│   ├── tags/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── category/route.ts
│   └── tag-categories/
│       ├── route.ts
│       └── [id]/route.ts
└── projects/[slug]/references/tags/
    ├── route.ts
    └── [tagId]/route.ts
```

### Scripts
```
/frontend/src/scripts/
├── map-anarchist-tags.ts
└── import-anarchist-tags.ts
```

### Database Schemas
```
/frontend/scripts/seeds/
├── schemas/library.sql
└── schemas/forums.sql
```

---

## 12. Implementation Checklist

For implementing unified tag system with anarchist categorization:

- [ ] Audit all tag usage in current system
- [ ] Design unified schema migration plan
- [ ] Implement unified `tags` table
- [ ] Create tag category management API
- [ ] Build admin tag dashboard
- [ ] Migrate existing library tags
- [ ] Migrate existing forum tags
- [ ] Migrate existing reference tags
- [ ] Implement anarchist category framework
- [ ] Build tag suggestion UI
- [ ] Create bulk categorization tools
- [ ] Test tag filtering across all features
- [ ] Document new tag system for admins
- [ ] Implement tag search/autocomplete
- [ ] Build tag analytics/dashboard

---

## 13. References

### Key Files Analyzed
- `/frontend/src/components/library/TagFilterSidebar.tsx` - Main library tag UI
- `/frontend/src/lib/library/types.ts` - Library type definitions
- `/frontend/src/types/project-references.ts` - Reference type definitions
- `/frontend/scripts/seeds/schemas/library.sql` - Library schema
- `/frontend/scripts/migrations/add-forum-tags.sql` - Forum schema
- `/frontend/src/scripts/map-anarchist-tags.ts` - Anarchist categorization
- `/frontend/src/scripts/import-anarchist-tags.ts` - Tag import utility

### Related Documentation
- Schema files in `/scripts/seeds/schemas/`
- API routes in `/src/app/api/`
- Component tests in respective component directories

---

**Document Status:** Ready for development  
**Last Updated:** 2025-11-09  
**Prepared for:** Tag system implementation and anarchist category integration

