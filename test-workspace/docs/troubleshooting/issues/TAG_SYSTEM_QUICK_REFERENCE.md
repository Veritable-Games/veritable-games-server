# Tag System Quick Reference

## Overview

The application has **3 independent tag systems**:

```
┌─────────────────────────────────────────────────────────────┐
│                    TAG SYSTEMS OVERVIEW                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  LIBRARY TAGS          FORUM TAGS         REFERENCE TAGS     │
│  ─────────────         ──────────         ──────────────     │
│  └─ library schema     └─ forums schema    └─ main database  │
│  └─ Documents          └─ Topics           └─ Images/Videos  │
│  └─ Type: string       └─ Flat structure   └─ Categorized    │
│  └─ Categories: 5      └─ No categories    └─ Display order  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

```
LIBRARY (TagFilterSidebar)
├─ Expandable categories
├─ Drag-drop reordering (admin)
├─ Inline tag creation
└─ Category management

REFERENCES (TagFilters)
├─ Simple selection
├─ Quick tag creation
├─ Sort controls
└─ Uses Zustand store

FORUM (TagDisplay/TagSelector)
├─ Flat tag list
├─ Color support
└─ Slug-based URLs
```

## Anarchist Categories (8 Total)

```
1. Political Theory      #FF6B6B   Keywords: anarchism, politics, revolution
2. Economics             #4ECDC4   Keywords: labor, capitalism, cooperative
3. Social Justice        #95E1D3   Keywords: justice, feminism, racism
4. Technology & Science  #A8E6CF   Keywords: technology, digital, AI
5. History               #FFD3B6   Keywords: history, movement, era
6. Education & Culture   #FFAAA5   Keywords: pedagogy, philosophy, art
7. Environment & Ecology #76C7AD   Keywords: ecology, climate, permaculture
8. Community & Org       #FFDDC1   Keywords: collective, consensus, solidarity
```

## Database Schema Comparison

| Feature | Library | Forum | References |
|---------|---------|-------|-----------|
| **ID Type** | INT | INT | TEXT |
| **Categories** | Type string | None | ID reference |
| **Colors** | No | Yes | Yes |
| **Usage Count** | Manual | Auto (trigger) | None |
| **Display Order** | No | No | Yes |
| **Visibility** | No | No | Yes |

## API Endpoints

**Library:**
- `GET /api/library/tags` → Tags grouped by category
- `POST /api/library/tags` → Create tag
- `DELETE /api/library/tags/[id]` → Delete tag

**References:**
- `GET /api/projects/[slug]/references/tags`
- `POST /api/projects/[slug]/references/tags`
- `DELETE /api/projects/[slug]/references/tags/[id]`

## File Locations

**Components:**
- Library: `/frontend/src/components/library/TagFilterSidebar.tsx`
- References: `/frontend/src/components/references/TagFilters.tsx`
- Forum: `/frontend/src/components/forums/TagDisplay.tsx`

**Types:**
- Library: `/frontend/src/lib/library/types.ts`
- References: `/frontend/src/types/project-references.ts`

**Scripts:**
- Mapping: `/frontend/src/scripts/map-anarchist-tags.ts`
- Import: `/frontend/src/scripts/import-anarchist-tags.ts`

## Usage Patterns

**Library Tag Selection:**
```typescript
const isSelected = selectedTags.includes(tag.name);
onChange={() => onTagToggle(tag.name)}
```

**Reference Tag Selection (Zustand):**
```typescript
const { selectedTags, toggleTag, allTags } = useReferencesStore();

// Filter: img.tags.some(t => selectedTags.includes(t.id))
```

**Keyboard Shortcuts:**
- `Escape` - Clear all selections
- `Delete` - Delete tags (admin) or clear (user)

## Tag Categorization Algorithm

```
Input: Tag name (e.g., "anarchism")
  ↓
Check keyword match:
  • Exact match → High confidence
  • Contains keyword → Medium confidence
  • No match → Low confidence
  ↓
Output: (category, color, confidence, reason)
```

## Current Limitations

1. **Multiple Systems** - No cross-system unification
2. **Inconsistent Schemas** - Different patterns for categories
3. **Library Categories** - Uses string type (not flexible)
4. **No Auto Usage Count** - Must be computed manually
5. **Anarchist Integration** - Scripts exist but not automated

## Next Steps for Implementation

1. Unify database schema
2. Create admin dashboard
3. Integrate anarchist categories
4. Implement bulk operations
5. Add tag search/autocomplete

---

*For detailed information, see TAG_SYSTEM_ARCHITECTURE.md*
