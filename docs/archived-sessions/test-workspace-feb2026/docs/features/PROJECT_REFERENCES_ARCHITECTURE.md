# Project Gallery System - Complete Architecture

**Last Updated:** October 24, 2025
**Status:** ✅ Production Ready
**Gallery Types:** References (`/projects/[slug]/references`), Concept Art (`/projects/[slug]/concept-art`)

## Gallery Type System

This documentation covers the **Project Gallery System**, a unified architecture that supports multiple gallery types:
- **References**: General reference images, screenshots, inspiration (10MB max, standard formats)
- **Concept Art**: Original artwork, iterations, WIP (50MB max, includes PSD support)

Both gallery types share the same codebase but maintain **separate data** and can have **different configurations**.

## Table of Contents

- [Executive Summary](#executive-summary)
- [System Overview](#system-overview)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow Architecture](#data-flow-architecture)
- [Database Architecture](#database-architecture)
- [API Routes](#api-routes)
- [State Management](#state-management)
- [Service Layer](#service-layer)
- [Key Features](#key-features)
- [Performance Optimizations](#performance-optimizations)
- [Security Measures](#security-measures)
- [Testing Strategy](#testing-strategy)
- [Troubleshooting](#troubleshooting)

---

## Executive Summary

The Project References Gallery is a sophisticated image management system for collaborative projects. It features:

- **Server-side rendering** with optimized database queries
- **Client-side state management** via Zustand for responsive UI
- **Advanced filtering** with tag-based AND/OR logic
- **Multi-file upload** with batch tagging and progress tracking
- **Responsive masonry grid** with lazy loading
- **Lightbox viewer** with zoom/pan and inline tag management
- **Admin-only features** for image/tag management

### Quick Stats

- **17 Components** (11 main + 6 tag components)
- **5 API Endpoints** (3 for images, 2 for tags)
- **4 Database Tables** (images, tags, categories, junction)
- **1 Service Class** (ProjectReferenceImagesService, 400+ LOC)
- **1 Zustand Store** (referencesStore, 400+ LOC)

---

## System Overview

### Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript 5.7
- **State**: Zustand 5.0.8 for client state
- **Database**: SQLite (content.db) with better-sqlite3 9.6.0
- **Upload**: FormData + multipart/form-data
- **Validation**: Custom image validation with MIME sniffing
- **Layout**: Pure CSS masonry grid (no external libraries)

### File Locations

```
frontend/
├── src/app/projects/[slug]/references/
│   ├── page.tsx                     # Server Component
│   └── ReferencesClient.tsx         # Client wrapper
├── src/components/references/
│   ├── MasonryGrid.tsx
│   ├── ImageCard.tsx
│   ├── ImageLightbox.tsx
│   ├── UploadZone.tsx
│   ├── FileQueueManager.tsx
│   ├── TagFilters.tsx
│   └── tags/                        # Tag-specific components
├── src/lib/projects/
│   └── reference-images-service.ts
├── src/lib/stores/
│   └── referencesStore.ts
└── src/app/api/projects/[slug]/references/
    ├── route.ts                     # Images CRUD
    ├── [imageId]/route.ts
    └── tags/                        # Tags CRUD
```

---

## Component Hierarchy

### Page Structure

```
references/page.tsx (Server Component)
├── getProjectData(slug)           - Fetch project
├── getInitialReferences()         - Initial images (100 limit)
├── getAllTags()                   - All project tags
└── <ReferencesClient />           - Client wrapper
    ├── <UploadZone />             - Drag-drop (admin only)
    ├── <FileQueueManager />       - Upload queue
    │   ├── <FileQueueItem />      - Individual file
    │   ├── <BatchTaggingPanel />  - Batch tag assignment
    │   └── UploadProcessor        - Handles uploads
    ├── <TagFilters />             - Tag selection
    │   ├── <SortControl />        - Sort dropdown
    │   └── Tag buttons            - Clickable tags
    ├── <MasonryGrid />            - Responsive layout
    │   └── <ImageCard />          - Individual image
    │       ├── <ImageSkeleton />  - Loading state
    │       └── Delete button      - Admin only
    ├── <ImageLightbox />          - Modal viewer
    │   ├── <ImageLightboxZoomControls />
    │   ├── <LightboxTagSystem />  - Tag management
    │   │   ├── <TagStrip />
    │   │   └── <useTagMutations /> - Hook
    │   └── Navigation controls
    └── <DeleteImageDialog />      - Confirmation modal
```

### Component Responsibilities

| Component | Type | Responsibility |
|-----------|------|----------------|
| `page.tsx` | Server | Fetch initial data, render client component |
| `ReferencesClient` | Client | Manage state, orchestrate sub-components |
| `UploadZone` | Client | Drag-drop interface, file validation |
| `FileQueueManager` | Client | Upload queue management, progress tracking |
| `TagFilters` | Client | Tag selection, filter UI, tag creation |
| `MasonryGrid` | Client | Responsive grid layout, lazy loading |
| `ImageCard` | Client | Image display, delete action |
| `ImageLightbox` | Client | Full-size viewer, zoom/pan, navigation |
| `LightboxTagSystem` | Client | In-lightbox tag add/remove |

---

## Data Flow Architecture

### 1. Page Load (Server → Client)

```
┌─────────────────────────────────────┐
│ 1. User navigates to references     │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ 2. Server Component (page.tsx)      │
│    ├─ getProjectData(slug)          │
│    │  └─ Query: content.db projects │
│    ├─ getInitialReferences()        │
│    │  └─ Query: 100 images sorted   │
│    └─ getAllTags(projectId)         │
│       └─ Query: All project tags    │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ 3. Props to ReferencesClient        │
│    {                                 │
│      projectSlug,                   │
│      projectTitle,                  │
│      initialImages: Image[100],     │
│      initialTags: Tag[],            │
│      totalCount: number             │
│    }                                 │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ 4. Zustand Store Initialization     │
│    ├─ setImages(initialImages)      │
│    ├─ setAllTags(initialTags)       │
│    └─ selectedTags = []              │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ 5. Initial Render                   │
│    ├─ TagFilters (all tags)         │
│    └─ MasonryGrid (100 images)      │
└─────────────────────────────────────┘
```

### 2. Tag Filter Flow (Client-Side)

```
┌─────────────────────────────────────┐
│ User clicks tag button              │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Zustand: toggleTag(tagId)           │
│ └─ selectedTags.push(tagId)         │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Computed: filteredImages()          │
│ └─ Filter: images with ALL tags     │
│    (AND logic)                       │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Re-render MasonryGrid               │
│ └─ Display filtered results         │
└─────────────────────────────────────┘
```

**Note**: Tag filtering is **client-side** with AND logic. Selecting tag A + tag B shows only images with BOTH tags.

### 3. Sort Flow (Backend-Driven)

```
┌─────────────────────────────────────┐
│ User changes sort option            │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Zustand: setSortBy(value)           │
│ └─ sortBy = 'file_size'             │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ useEffect triggers fetchImages()    │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ GET /api/projects/[slug]/references │
│ ?sort_by=file_size&sort_order=desc  │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Backend: Query with ORDER BY        │
│ └─ Returns sorted images            │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Zustand: setImages(sortedImages)    │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Re-render with new sort order       │
└─────────────────────────────────────┘
```

**Sort Options**:
- `primary_tag` - Group by tag, then alphabetical
- `file_size` - Largest/smallest first
- `created_at` - Newest/oldest first
- `pixel_count` - Highest/lowest resolution first

### 4. Upload Flow

```
┌─────────────────────────────────────┐
│ User drops files into UploadZone    │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ FileQueueManager.addFilesToQueue()  │
│ ├─ Generate unique IDs              │
│ ├─ Create File objects              │
│ ├─ Generate preview URLs            │
│ └─ Status: pending                  │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ UploadProcessor (class)             │
│ ├─ Validate: MIME, size, dimensions │
│ ├─ Upload: Max 3 concurrent         │
│ ├─ Track progress per file          │
│ └─ Status callbacks to store        │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ POST /api/.../references            │
│ ├─ FormData with files[]            │
│ ├─ Write to /public/uploads/...     │
│ ├─ Create DB record                 │
│ ├─ Add tag assignments              │
│ └─ Return imageId                   │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ GET /api/.../[imageId]              │
│ └─ Fetch full image data with tags  │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ Zustand: addImages([newImage])      │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│ MasonryGrid re-renders              │
│ └─ New image appears instantly      │
└─────────────────────────────────────┘
```

**Upload States**: `pending` → `validating` → `uploading` → `processing` → `success`/`error`

---

## Database Architecture

### Database: `content.db`

### Table Schemas

#### `project_reference_images`

```sql
CREATE TABLE project_reference_images (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id          INTEGER NOT NULL,
  filename_storage    TEXT NOT NULL,
  file_path           TEXT NOT NULL,         -- /uploads/references/[slug]/filename
  file_size           INTEGER NOT NULL,
  mime_type           TEXT NOT NULL,
  width               INTEGER,
  height              INTEGER,
  aspect_ratio        REAL,                  -- width / height
  uploaded_by         INTEGER NOT NULL,      -- FK users.id
  sort_order          INTEGER DEFAULT 0,
  is_deleted          INTEGER DEFAULT 0,     -- Soft delete flag
  deleted_at          TIMESTAMP,
  deleted_by          INTEGER,               -- FK users.id
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

**Key Points**:
- Soft deletes via `is_deleted` flag
- Aspect ratio calculated on upload
- File path for direct access
- Sort order for manual ordering (future feature)

#### `reference_tags`

```sql
CREATE TABLE reference_tags (
  id                TEXT PRIMARY KEY,           -- Hex UUID
  project_id        INTEGER,                    -- FK projects.id
  category_id       TEXT NOT NULL,              -- FK reference_categories.id
  name              TEXT NOT NULL,
  color             TEXT DEFAULT '#6B7280',     -- Hex color
  display_order     INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES reference_categories(id),
  UNIQUE(project_id, name)
);
```

**Key Points**:
- Project-scoped (tags isolated per project)
- UNIQUE constraint prevents duplicate names
- Hex UUIDs for distributed ID generation
- Color for visual categorization

#### `reference_categories`

```sql
CREATE TABLE reference_categories (
  id                TEXT PRIMARY KEY,           -- Hex UUID
  name              TEXT NOT NULL,
  description       TEXT,
  visibility        TEXT DEFAULT 'public',      -- public | private
  display_order     INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Default Category**: "General" - Auto-created when first tag is added.

#### `project_reference_image_tags` (Junction Table)

```sql
CREATE TABLE project_reference_image_tags (
  reference_id      INTEGER NOT NULL,           -- FK project_reference_images.id
  tag_id            TEXT NOT NULL,              -- FK reference_tags.id
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reference_id, tag_id),
  FOREIGN KEY (reference_id) REFERENCES project_reference_images(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES reference_tags(id) ON DELETE CASCADE
);
```

**Relationships**: Many-to-many between images and tags.

### Complex Queries

#### Get Images with Filtering & Sorting

```sql
SELECT img.*,
  (COALESCE(img.width, 0) * COALESCE(img.height, 0)) as pixel_count,
  (SELECT rt.name
   FROM project_reference_image_tags prit
   JOIN reference_tags rt ON prit.tag_id = rt.id
   JOIN reference_categories rc ON rt.category_id = rc.id
   WHERE prit.reference_id = img.id
   ORDER BY rc.display_order, rt.display_order LIMIT 1) as primary_tag_name
FROM project_reference_images img
WHERE img.project_id = ?
  AND img.is_deleted = 0
  AND (SELECT COUNT(DISTINCT tag_id)
       FROM project_reference_image_tags
       WHERE reference_id = img.id
       AND tag_id IN (?)) = ?  -- Tag AND logic
ORDER BY
  CASE WHEN primary_tag_name IS NULL THEN 1 ELSE 0 END,
  primary_tag_name ASC,
  img.sort_order ASC
LIMIT ? OFFSET ?
```

**Explanation**:
- **Subquery**: Calculates `primary_tag_name` (first tag by display_order)
- **Tag Filter**: COUNT ensures image has ALL selected tags (AND logic)
- **Sort**: Untagged images last, then by tag name, then sort_order
- **Pagination**: LIMIT/OFFSET for performance

#### Get All Tags for Project

```sql
SELECT rt.id, rt.name, rt.color, rt.display_order,
       rc.id as category_id, rc.name as category_name
FROM reference_tags rt
JOIN reference_categories rc ON rt.category_id = rc.id
WHERE rt.project_id = ?
ORDER BY rc.display_order, rt.display_order
```

**Used By**: TagFilters component on page load.

---

## API Routes

### Image Endpoints

#### `GET /api/projects/[slug]/references`

**Purpose**: Fetch filtered and sorted images

**Query Params**:
- `tags` (optional): Comma-separated tag IDs for filtering
- `sort_by` (optional): `primary_tag` | `file_size` | `created_at` | `pixel_count`
- `sort_order` (optional): `asc` | `desc`
- `limit` (optional): Max results (default 100)
- `page` (optional): Page number (default 1)

**Response**:
```json
{
  "images": [
    {
      "id": 1,
      "project_id": 5,
      "filename_storage": "image.jpg",
      "file_path": "/uploads/references/my-project/image.jpg",
      "file_size": 524288,
      "mime_type": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "aspect_ratio": 1.777,
      "tags": [
        {
          "id": "abc123",
          "name": "Character",
          "color": "#3B82F6",
          "category_id": "xyz789",
          "category_name": "General"
        }
      ],
      "uploader": {
        "id": 1,
        "username": "admin",
        "display_name": "Admin User"
      },
      "created_at": "2025-10-24T12:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 100,
  "has_more": false
}
```

#### `POST /api/projects/[slug]/references` (Admin Only)

**Purpose**: Upload new images

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `files[]`: Array of File objects
- `tag_ids` (optional): Array of tag IDs to apply

**Validation**:
- Max file size: 10MB
- Allowed MIME types: JPG, PNG, GIF, WebP, AVIF
- MIME type verification via binary sniffing
- Dimension extraction

**File Storage**: `/public/uploads/references/[slug]/[filename]`

**Response**:
```json
{
  "success": true,
  "message": "3 images uploaded successfully",
  "results": [
    {
      "success": true,
      "imageId": 1,
      "filename": "image.jpg"
    }
  ]
}
```

#### `GET /api/projects/[slug]/references/[imageId]`

**Purpose**: Fetch single image with full tag data

**Response**: Single `ReferenceImage` object (same structure as above)

#### `PATCH /api/projects/[slug]/references/[imageId]` (Admin Only)

**Purpose**: Update image metadata

**Body**:
```json
{
  "sort_order": 10,
  "tag_ids": ["abc123", "def456"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Image updated successfully",
  "image": { /* Full image object */ }
}
```

**Transaction**: Updates both image record and tag assignments atomically.

#### `DELETE /api/projects/[slug]/references/[imageId]` (Admin Only)

**Purpose**: Soft delete image

**Response**:
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Database Action**: `UPDATE is_deleted=1, deleted_at=CURRENT_TIMESTAMP, deleted_by=userId`

### Tag Endpoints

#### `GET /api/projects/[slug]/references/tags`

**Purpose**: Get all tags for project

**Response**:
```json
{
  "tags": [
    {
      "id": "abc123",
      "name": "Character",
      "color": "#3B82F6",
      "category_id": "xyz789",
      "category_name": "General",
      "display_order": 0
    }
  ]
}
```

#### `POST /api/projects/[slug]/references/tags` (Admin Only)

**Purpose**: Create new tag

**Body**:
```json
{
  "name": "Environment"
}
```

**Auto-Creation**: If "General" category doesn't exist, it's created automatically.

**Response**:
```json
{
  "success": true,
  "tag_id": "abc123"
}
```

**Error Handling**: Returns 400 if tag name already exists (UNIQUE constraint).

#### `DELETE /api/projects/[slug]/references/tags/[tagId]` (Admin Only)

**Purpose**: Delete tag

**Transaction**:
1. Delete all image-tag assignments (`project_reference_image_tags`)
2. Delete tag record (`reference_tags`)

**Response**:
```json
{
  "success": true,
  "message": "Tag deleted successfully"
}
```

---

## State Management

### Zustand Store: `referencesStore.ts`

**Location**: `/lib/stores/referencesStore.ts`

### Store Structure

```typescript
interface ReferenceGalleryState {
  // DATA
  images: ReferenceImage[]
  allTags: ReferenceTag[]

  // FILTERS
  selectedTags: ReferenceTagId[]

  // SORTING
  sortBy: 'primary_tag' | 'file_size' | 'created_at' | 'pixel_count'
  sortOrder: 'asc' | 'desc'

  // LIGHTBOX
  isLightboxOpen: boolean
  selectedImageIndex: number | null

  // UPLOAD QUEUE
  uploadQueue: QueuedFile[]
  batchTags: ReferenceTagId[]
  maxConcurrentUploads: number

  // ACTIONS (20+ methods)
  setImages(images: ReferenceImage[]): void
  addImages(images: ReferenceImage[]): void
  removeImage(imageId: ReferenceImageId): void
  updateImage(imageId: ReferenceImageId, updates: Partial<ReferenceImage>): void

  toggleTag(tagId: ReferenceTagId): void
  clearTags(): void

  setSortBy(sortBy: string): void
  setSortOrder(order: 'asc' | 'desc'): void

  openLightbox(index: number): void
  closeLightbox(): void
  nextImage(): void
  previousImage(): void

  // ... upload queue methods

  // COMPUTED
  filteredImages: () => ReferenceImage[]
  activeUploads: () => QueuedFile[]
  pendingUploads: () => QueuedFile[]
  completedUploads: () => QueuedFile[]
  failedUploads: () => QueuedFile[]
}
```

### Key Store Features

#### 1. Tag Filtering (AND Logic)

```typescript
filteredImages: () => {
  const { images, selectedTags } = get();

  if (selectedTags.length === 0) {
    return images;
  }

  return images.filter(image => {
    const imageTags = image.tags.map(tag => tag.id);
    // Image must have ALL selected tags
    return selectedTags.every(selectedTag =>
      imageTags.includes(selectedTag)
    );
  });
}
```

**Behavior**: Selecting multiple tags narrows results (intersection, not union).

#### 2. Lightbox Navigation

```typescript
nextImage: () => {
  const { selectedImageIndex, filteredImages } = get();
  if (selectedImageIndex === null) return;

  const images = filteredImages();
  const nextIndex = (selectedImageIndex + 1) % images.length;
  set({ selectedImageIndex: nextIndex });
}
```

**Circular Navigation**: Last image wraps to first.

#### 3. Upload Queue Management

```typescript
addFilesToQueue: (files: File[]) => {
  const queuedFiles = files.map(file => ({
    id: generateId(),
    file,
    preview: URL.createObjectURL(file),
    status: 'pending' as const,
    progress: 0,
    tags: get().batchTags
  }));

  set(state => ({
    uploadQueue: [...state.uploadQueue, ...queuedFiles]
  }));
}
```

**Auto-Apply Batch Tags**: New files inherit current batch tag selection.

---

## Service Layer

### `ProjectReferenceImagesService`

**Location**: `/lib/projects/reference-images-service.ts`

**Pattern**: Result type for error handling

### Key Methods

#### `getProjectImages(filters: GetImagesFilters)`

**Parameters**:
```typescript
interface GetImagesFilters {
  projectId: ProjectId
  tagIds?: ReferenceTagId[]
  categoryIds?: ReferenceCategoryId[]
  sortBy?: 'primary_tag' | 'file_size' | 'created_at' | 'pixel_count'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

**Returns**: `Result<{ images: ReferenceImage[], total: number }>`

**Features**:
- Tag AND/OR filtering
- Batch user lookup (avoids N+1)
- Dynamic primary_tag calculation
- Pagination support

#### `createImage(input: CreateReferenceImageInput, userId: UserId)`

**Parameters**:
```typescript
interface CreateReferenceImageInput {
  project_id: ProjectId
  filename_storage: string
  file_path: string
  file_size: number
  mime_type: string
  width?: number
  height?: number
  tag_ids?: ReferenceTagId[]
}
```

**Transaction**:
1. Insert image record
2. Add tag assignments
3. Return image ID

#### `updateImage(imageId: ReferenceImageId, input: UpdateReferenceImageInput, userId: UserId)`

**Supports**: `sort_order`, `tag_ids` updates

**Transaction**: Updates image + replaces tag assignments atomically

#### `deleteImage(imageId: ReferenceImageId, userId: UserId)`

**Action**: Soft delete (sets `is_deleted=1`, `deleted_at`, `deleted_by`)

**Preservation**: File remains on disk, data retained for recovery

#### `getAllTags(projectId?: ProjectId)`

**Returns**: All tags, ordered by category and display_order

**Used By**: Initial page load, tag filter rendering

#### `createTag(input: CreateReferenceTagInput)`

**Auto-Creation**: Creates "General" category if it doesn't exist

**Error Handling**: Returns error if tag name already exists

---

## Key Features

### 1. Masonry Grid Layout

**Implementation**: Pure CSS (no JavaScript library)

```css
.masonry-grid {
  column-count: 1;
  column-gap: 1rem;

  @media (min-width: 640px) { column-count: 2; }
  @media (min-width: 1024px) { column-count: 3; }
  @media (min-width: 1536px) { column-count: 4; }
}

.masonry-grid-item {
  break-inside: avoid;
  display: inline-block;
  width: 100%;
  margin-bottom: 1rem;
}
```

**Benefits**:
- No external dependencies
- Fully responsive
- Performant (browser-native)
- Accessibility-friendly

### 2. Lazy Loading

**Implementation**: Intersection Observer API

```typescript
const isVisible = useIntersectionObserver(ref, {
  threshold: 0.1,
  rootMargin: '200px',    // Preload 200px before visible
  triggerOnce: true
});
```

**Behavior**:
- Images load 200px before scrolling into view
- Once loaded, observer disconnects
- Smooth user experience with no loading delay

### 3. Tag Filtering System

**AND Logic**: Selecting multiple tags shows images with ALL selected tags (intersection).

**Example**:
- Image A: `[Character, Male]`
- Image B: `[Character, Female]`
- Image C: `[Character, Male, Hero]`

**User selects**: `[Character, Male]`
**Results**: Image A, Image C (both have both tags)

### 4. Admin Keyboard Shortcuts

**Implemented in TagFilters.tsx**

| Key | Action |
|-----|--------|
| `Delete` | Delete all selected tags (with animation) |
| `Escape` | Deselect all tags |

**Animation**: Tags fade out (opacity-0 scale-75), removed after 300ms.

### 5. Image Upload Validation

**Flow**: Client → `validateImageUpload()` → Server

**Validation Steps**:
1. **MIME Type**: Check against whitelist (JPG, PNG, GIF, WebP, AVIF)
2. **File Size**: Max 10MB
3. **Dimensions**: Extract width/height
4. **Filename**: Sanitize (remove special characters)
5. **MIME Sniffing**: Verify actual file type (not client-provided)

**Security**: Prevents file upload attacks by verifying actual file content.

### 6. Lightbox Viewer

**Zoom Controls**:
- `+` / `-` keys: Zoom in/out (1x to 4x)
- `0` key: Reset zoom
- Mouse wheel + Ctrl: Zoom

**Navigation**:
- Arrow keys: Navigate images (or pan when zoomed)
- `Alt` + Arrow: Force image navigation
- `Escape`: Close lightbox (or reset zoom if zoomed)

**Tag Management**:
- Add/remove tags inline
- Uses `useTagMutations` hook
- Optimistic UI updates

### 7. Upload Progress Tracking

**Status Flow**: `pending` → `validating` → `uploading` → `processing` → `success`/`error`

**Features**:
- Per-file progress bars
- Concurrent uploads (max 3)
- Total progress aggregate
- Retry failed uploads

### 8. Batch Tagging

**Feature**: Apply same tags to all pending uploads

**Usage**:
1. Add files to queue
2. Select tags in BatchTaggingPanel
3. Tags auto-apply to all pending files
4. New files added later inherit batch tags

---

## Performance Optimizations

| Optimization | Implementation | Impact |
|--------------|----------------|--------|
| **Batch User Lookups** | `getUsersByIds()` in service | 1 query instead of N |
| **Lazy Loading** | Intersection Observer with 200px margin | Images load before scrolling |
| **Aspect Ratio** | Stored in DB, set on container | No layout shift on load |
| **Progressive Enhancement** | CSS masonry without JS | Works without JavaScript |
| **Backend Sorting** | SQL ORDER BY instead of client-side | Don't re-sort 100+ images |
| **Pagination** | 100 items per page default | Limit memory/DOM nodes |
| **Concurrent Uploads** | Max 3 simultaneous | Balance speed vs server load |
| **Soft Deletes** | Mark instead of remove | No cascade deletes, fast recovery |
| **Computed Selectors** | Zustand computed values | Re-render only when needed |

### Performance Metrics

**Target Metrics**:
- Initial page load: < 1s
- Image lazy load: < 100ms
- Tag filter update: < 50ms
- Upload start: < 200ms per file

---

## Security Measures

| Layer | Implementation |
|-------|----------------|
| **File Validation** | `validateImageUpload()` - MIME sniffing, dimensions |
| **Admin Authorization** | All mutations check `user.role === 'admin'` |
| **SQL Injection** | Prepared statements with parameterized queries |
| **Path Traversal** | `sanitizeFilename()` removes special characters |
| **CSRF Protection** | `withSecurity()` middleware (legacy, deprecated Oct 2025) |
| **Soft Deletes** | Prevents accidental permanent data loss |
| **Transaction Safety** | Multi-step operations wrapped in `db.transaction()` |

### File Upload Security

```typescript
const validation = await validateImageUpload(file, {
  maxSizeBytes: 10 * 1024 * 1024,          // 10MB
  allowedMimeTypes: ['image/jpeg', ...],    // Whitelist
  requireDimensionValidation: true          // Extract dimensions
});

// MIME sniffing (actual file content)
const detectedMimeType = detectMimeType(fileBuffer);
if (!allowedMimeTypes.includes(detectedMimeType)) {
  throw new ValidationError('Invalid file type');
}
```

---

## Testing Strategy

### Unit Tests

**Store Tests** (referencesStore.test.ts):
- `filteredImages()` with various tag combinations
- `toggleTag()` add/remove behavior
- `nextImage()`/`previousImage()` circular navigation
- `addFilesToQueue()` batch tag inheritance

**Service Tests** (reference-images-service.test.ts):
- `getProjectImages()` with filters
- `createImage()` transaction integrity
- `updateImage()` tag replacement
- `deleteImage()` soft delete verification

### Integration Tests

**Upload Flow**:
1. Add files to queue
2. Apply batch tags
3. Upload files
4. Verify database records
5. Check images appear in gallery

**Tag Management**:
1. Create new tag
2. Apply to image
3. Filter by tag
4. Delete tag
5. Verify assignments removed

### E2E Tests (Playwright)

**Critical Paths**:
1. **Full Upload Workflow**
   - Navigate to references page
   - Drag-drop files
   - Apply batch tags
   - Wait for upload complete
   - Verify images visible

2. **Tag Filtering**
   - Load page with images
   - Click multiple tags
   - Verify filtered results
   - Clear filters
   - Verify all images visible

3. **Lightbox Navigation**
   - Open lightbox
   - Navigate with arrow keys
   - Zoom in/out
   - Add/remove tags inline
   - Close lightbox

4. **Responsive Design**
   - Test masonry at different viewport sizes
   - Verify mobile upload works
   - Check touch controls in lightbox

---

## Troubleshooting

### Common Issues

#### Images Not Appearing After Upload

**Symptoms**: Upload succeeds but images don't appear in gallery.

**Causes**:
1. File path incorrect (missing `/public` prefix)
2. Image added to store but filtered out by tags
3. Sort order placing image off-screen

**Solutions**:
1. Check `file_path` in database starts with `/uploads/references/`
2. Clear tag filters to see all images
3. Change sort order to "Newest First"

#### Tag Filter Showing No Results

**Symptoms**: Selecting tags shows empty gallery.

**Causes**:
1. AND logic: No image has ALL selected tags
2. Tags selected from different categories

**Solutions**:
1. Deselect one tag at a time to find matching images
2. Check tag assignments in database
3. Use OR logic (future feature)

#### Upload Stuck in "Processing" State

**Symptoms**: File queue shows permanent "processing" status.

**Causes**:
1. API request failed but error not caught
2. Network timeout
3. File too large (>10MB)

**Solutions**:
1. Check browser console for errors
2. Retry upload with smaller file
3. Check backend logs for API errors

#### Masonry Grid Not Rendering

**Symptoms**: Images stacked vertically in single column.

**Causes**:
1. CSS not loaded
2. `data-masonry-grid` attribute missing
3. Browser doesn't support CSS columns

**Solutions**:
1. Check for CSS errors in console
2. Verify `<div data-masonry-grid>` exists
3. Use modern browser (Chrome, Firefox, Safari)

### Debug Commands

**Check database state**:
```bash
cd frontend
npm run db:query content "SELECT * FROM project_reference_images WHERE project_id = 1"
npm run db:query content "SELECT * FROM reference_tags WHERE project_id = 1"
```

**Check uploaded files**:
```bash
ls -lh frontend/public/uploads/references/[slug]/
```

**Monitor API requests**:
```bash
# In browser DevTools
Network tab → Filter by "references"
```

---

## Future Enhancements

### Planned Features

1. **Bulk Operations**
   - Multi-select images
   - Batch tag update
   - Batch delete

2. **Advanced Filtering**
   - Date range filter
   - File size filter
   - Uploader filter
   - Search by filename

3. **Image Reordering**
   - Drag-drop to reorder
   - Update `sort_order` column
   - Persist custom order

4. **Category Management UI**
   - Create/edit/delete categories
   - Assign tags to categories
   - Category-based filtering

5. **Export/Download**
   - Bulk download as ZIP
   - Export metadata as JSON
   - Generate image gallery HTML

6. **Visual Tag Groups**
   - Section headers in masonry grid
   - "Characters (12)" above character images
   - Collapsible sections

### Known Limitations

| Limitation | Workaround | Future Plan |
|------------|------------|-------------|
| Tag filter is AND only | Deselect tags to widen results | Add OR filter option |
| No hard delete | Soft deletes only | Add "Permanently Delete" admin action |
| No image editing | Replace image | Add crop/resize tools |
| No duplicate detection | Manual check | Add image hash comparison |
| Max 10MB upload | Split large files | Add chunked upload for >10MB |

---

## Related Documentation

- **[REFERENCE_HEALTH_CHECK.md](./REFERENCE_HEALTH_CHECK.md)** - Health check from Oct 5, 2025 (outdated)
- **[../DATABASE.md](../DATABASE.md)** - Database architecture
- **[../REACT_PATTERNS.md](../REACT_PATTERNS.md)** - React/Next.js patterns
- **[../CLAUDE.md](../CLAUDE.md)** - Main development guide

---

**Document Version:** 1.0
**Author:** System Documentation
**Last Review:** October 24, 2025
