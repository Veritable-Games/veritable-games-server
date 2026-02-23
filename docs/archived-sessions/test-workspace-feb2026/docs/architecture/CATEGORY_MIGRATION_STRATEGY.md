# Category System Migration Strategy

## Current Problem

The wiki system has **two parallel categorization systems**:

1. **Direct Column**: `wiki_pages.category_id` (legacy, single category)
2. **Junction Table**: `wiki_page_categories` (modern, multiple categories)

This dual system causes inconsistencies when:
- CREATE operations use only the direct column
- READ operations check both systems
- COUNT operations may check only one system

## Immediate Fix Applied

- ✅ Updated `WikiCategoryService.getAllCategories()` to count from both systems using UNION
- ✅ Created `CategoryQueryHelper` for centralized query logic
- ✅ Added documentation to prevent future drift

## Long-term Migration Plan

### Phase 1: Stabilization (Current)
- [x] Fix count discrepancies with UNION queries
- [x] Create centralized query helper
- [x] Document the dual system clearly
- [ ] Add tests to prevent regression

### Phase 2: Junction Table Migration (Future)
- [ ] Create migration script to populate junction table from direct column
- [ ] Update all CREATE/UPDATE operations to use junction table
- [ ] Add foreign key constraints
- [ ] Update UI to support multiple categories

### Phase 3: Legacy Column Deprecation (Future)
- [ ] Update all queries to use only junction table
- [ ] Remove direct `category_id` column
- [ ] Clean up migration code

## Developer Guidelines

### ⚠️ CRITICAL: When working with categories, always:

1. **Count Operations**: Use UNION to count from both systems
   ```sql
   SELECT COUNT(DISTINCT page_id) FROM (
     SELECT p.id as page_id FROM wiki_pages p WHERE p.category_id = ?
     UNION
     SELECT wp.id as page_id FROM wiki_page_categories wpc
     JOIN wiki_pages wp ON wpc.page_id = wp.id WHERE wpc.category_id = ?
   )
   ```

2. **Filter Operations**: Check both category sources
   ```sql
   WHERE (p.category_id = ? OR wpc.category_id = ?)
   ```

3. **Display Operations**: Prefer junction table over direct column
   ```sql
   LEFT JOIN wiki_categories c ON p.category_id = c.id
   LEFT JOIN wiki_page_categories wpc ON p.id = wpc.page_id
   LEFT JOIN wiki_categories wpc_c ON wpc.category_id = wpc_c.id
   SELECT COALESCE(c.name, wpc_c.name) as category_name
   ```

### Files to Keep in Sync

When modifying category logic, ensure these files remain consistent:

- `WikiCategoryService.ts` - Category counting and listing
- `WikiPageService.ts` - Page filtering and display
- `CategoryQueryHelper.ts` - Centralized query logic
- API routes that aggregate category data

### Testing Checklist

Before deploying category-related changes:

- [ ] Main wiki page category counts match individual category pages
- [ ] Category filtering returns same results regardless of categorization method
- [ ] New pages appear in correct category immediately after creation
- [ ] Category reassignment updates all relevant counts

## Migration Script Template

```typescript
// Future migration to junction table
async function migrateCategoryData() {
  const db = dbPool.getConnection('forums');

  // 1. Populate junction table from direct column
  const pages = db.prepare('SELECT id, category_id FROM wiki_pages WHERE category_id IS NOT NULL').all();
  const insertJunction = db.prepare('INSERT OR IGNORE INTO wiki_page_categories (page_id, category_id) VALUES (?, ?)');

  for (const page of pages) {
    insertJunction.run(page.id, page.category_id);
  }

  // 2. Verify counts match
  // 3. Update application code to use junction table
  // 4. Remove direct column (in separate migration)
}
```

This migration strategy ensures data integrity while allowing gradual modernization of the categorization system.