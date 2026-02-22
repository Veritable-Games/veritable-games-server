# Option D Implementation Specifications

**Status**: Detailed implementation guide
**Architecture**: Hybrid (Shared Core DB, Feature-Specific Upload Volumes)
**Date**: November 10, 2025

---

## Executive Summary

**Option D selected** for Veritable Games. This document provides:
1. Complete volume mount configuration
2. File path organization standards
3. API route mapping to volumes
4. Container initialization sequence
5. Backup and sync strategies per volume

---

## Part 1: Docker Volume Configuration

### Volume Creation

Create all 6 volumes:

```bash
ssh user@192.168.1.15

# Core upload volumes
docker volume create veritable-gallery
docker volume create veritable-user-uploads
docker volume create veritable-wiki
docker volume create veritable-news

# Archive volumes (should already exist, verify)
docker volume create anarchist-library
docker volume create marxists-library

# Verify
docker volume ls | grep veritable
```

### Coolify Configuration

**Application**: Veritable Games

**Volume Mounts** (in Coolify dashboard):

| Volume Source | Mount Path | Mode | Purpose |
|---------------|-----------|------|---------|
| `veritable-gallery` | `/app/public/uploads` | Read/Write | Gallery: concept-art, references, history, videos |
| `veritable-user-uploads` | `/app/data/uploads` | Read/Write | Avatars, forum attachments |
| `veritable-wiki` | `/app/public/wiki-images` | Read/Write | Wiki embedded images |
| `veritable-news` | `/app/public/news` | Read/Write | News featured images |
| `anarchist-library` | `/app/anarchist-library` | Read/Write | Anarchist Library (24,643 texts - curation enabled) |
| `marxists-library` | `/app/marxists-library` | Read/Write | Marxists Library (500K+ texts - curation enabled) |

**Docker Compose Example** (if manual setup):

```yaml
version: '3.8'

services:
  veritable-games:
    image: veritable-games:latest
    container_name: m4s0kwo4kc4oooocck4sswc4

    volumes:
      # Feature-specific upload volumes
      - veritable-gallery:/app/public/uploads
      - veritable-user-uploads:/app/data/uploads
      - veritable-wiki:/app/public/wiki-images
      - veritable-news:/app/public/news

      # Archive volumes (read-write for curation)
      - anarchist-library:/app/anarchist-library
      - marxists-library:/app/marxists-library

      # Database
      - veritable-db:/var/lib/postgresql/data

    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/veritable_core
      NODE_ENV: production

    ports:
      - "3000:3000"

    networks:
      - coolify

volumes:
  veritable-gallery:
    driver: local
  veritable-user-uploads:
    driver: local
  veritable-wiki:
    driver: local
  veritable-news:
    driver: local
  anarchist-library:
    driver: local
  marxists-library:
    driver: local
  veritable-db:
    driver: local

networks:
  coolify:
    driver: bridge
```

---

## Part 2: File Organization Standards

### Volume 1: Gallery (1.1GB - Primary)

**Mount**: `/app/public/uploads`
**Purpose**: Project gallery media (concept-art, references, evolution, videos)

**Directory Structure**:
```
/app/public/uploads/
├── concept-art/                 (1.1GB total across all)
│   ├── {project-slug}/
│   │   ├── file-1.jpg
│   │   ├── file-2.png
│   │   └── file-3.jpg
│   ├── noxii-project/
│   ├── dodec-project/
│   └── ... (other projects)
│
├── references/
│   ├── {project-slug}/
│   │   ├── reference-1.jpg
│   │   └── reference-2.png
│   └── ... (other projects)
│
├── history/                     (Evolution/timeline images)
│   ├── {project-slug}/
│   │   └── evolution-1.jpg
│   └── ... (other projects)
│
└── videos/                      (Project demo/walkthrough videos)
    ├── {project-slug}/
    │   ├── demo.mp4
    │   └── walkthrough.mp4
    └── ... (other projects)
```

**API Routes** (These write to this volume):
- `POST /api/projects/[slug]/concept-art` → `/app/public/uploads/concept-art/{slug}/`
- `POST /api/projects/[slug]/references` → `/app/public/uploads/references/{slug}/`
- `POST /api/projects/[slug]/history` → `/app/public/uploads/history/{slug}/`
- `POST /api/projects/[slug]/concept-art/videos/upload` → `/app/public/uploads/videos/{slug}/`

**Characteristics**:
- **Size**: 1.1GB (150+ files)
- **Access pattern**: Read-heavy (galleries viewed frequently)
- **Update frequency**: Low (uploads rare)
- **Backup priority**: CRITICAL (user content)

---

### Volume 2: User Uploads (Avatars + Forum Attachments)

**Mount**: `/app/data/uploads`
**Purpose**: User-generated content (profile pictures, forum attachments)

**Directory Structure**:
```
/app/data/uploads/
├── avatars/                     (User profile pictures)
│   ├── user-id-1.jpg
│   ├── user-id-2.png
│   ├── user-id-3.jpg
│   └── ... (one per active user)
│
└── forum-attachments/           (Forum post attachments)
    ├── post-id-1/
    │   ├── attachment-1.pdf
    │   └── attachment-2.jpg
    ├── post-id-2/
    │   └── image.png
    └── ... (organized by post)
```

**API Routes** (These write to this volume):
- `POST /api/users/[id]/avatar` → `/app/data/uploads/avatars/`
- `POST /api/forums/posts/[postId]/attachments` → `/app/data/uploads/forum-attachments/{postId}/`

**Characteristics**:
- **Size**: < 500MB estimated (1000s of files)
- **Access pattern**: Read-heavy (avatars loaded on every page)
- **Update frequency**: Medium (new users, forum posts)
- **Backup priority**: HIGH (user profiles)

---

### Volume 3: Wiki Images (Optional - For Future)

**Mount**: `/app/public/wiki-images`
**Purpose**: Wiki page embedded images and diagrams

**Directory Structure**:
```
/app/public/wiki-images/
├── {category}/                  (archive, cosmic-knights, etc.)
│   ├── {page-slug}/
│   │   ├── diagram-1.png
│   │   ├── screenshot-1.jpg
│   │   └── illustration.svg
│   └── ... (other pages in category)
└── shared/                      (Reusable diagrams)
    ├── system-diagram.png
    └── architecture.svg
```

**API Routes** (If images uploaded via web UI):
- `POST /api/wiki/pages/[slug]/upload-image` → `/app/public/wiki-images/{category}/{slug}/`

**Characteristics**:
- **Size**: < 100MB estimated (mostly PNGs, SVGs)
- **Access pattern**: Read-heavy (wiki pages viewed frequently)
- **Update frequency**: Low (wiki content stable)
- **Backup priority**: MEDIUM (content versioned in git markdown)
- **Current Status**: Not urgent, can implement later

---

### Volume 4: News Media (Optional - For Future)

**Mount**: `/app/public/news`
**Purpose**: News article featured images and media

**Directory Structure**:
```
/app/public/news/
├── {year}/
│   ├── {month}/
│   │   ├── article-slug-1/
│   │   │   ├── featured-image.jpg
│   │   │   └── hero-image.jpg
│   │   └── article-slug-2/
│   │       └── featured-image.png
│   └── ... (other months)
└── archived/                    (Old articles)
    └── ...
```

**API Routes** (If news has image uploads):
- `POST /api/news/articles/[id]/upload-image` → `/app/public/news/{year}/{month}/{slug}/`

**Characteristics**:
- **Size**: < 200MB estimated
- **Access pattern**: Read-heavy (news homepage)
- **Update frequency**: Low (news posted occasionally)
- **Backup priority**: LOW (can rebuild from database)
- **Current Status**: Not urgent, can implement later

---

### Volume 5: Anarchist Library (24,643 texts - Read-Write for Curation)

**Mount**: `/app/anarchist-library`
**Purpose**: Anarchist Library Network Archive (24,643 documents, 27 languages)

**Directory Structure**:
```
/app/anarchist-library/
├── en/                          (English: ~8,000 documents)
│   ├── bakunin-god-state.md
│   ├── kropotkin-mutual-aid.md
│   └── ... (alphabetically organized)
├── es/                          (Spanish: ~2,500 documents)
├── fr/                          (French: ~3,000 documents)
├── de/                          (German, Italian, Russian, etc.)
└── ... (27 languages total)

Each document file (markdown with YAML frontmatter):
---
id: "bakunin-god-state-en-1882"
title: "God and the State"
authors:
  - "Mikhail Bakunin"
language: "en"
year: 1882
url: "..."
---

# Content here...
```

**Access Pattern**:
- Read-write mount (curation enabled)
- Metadata read via `/api/library/search?q=query&source=anarchist`
- Database stores metadata + full-text search index
- Files edited directly (web UI or SSH) and metadata re-indexed

**Characteristics**:
- **Size**: 20-50GB (24,643 files)
- **Access pattern**: Read/write (search queries + curation)
- **Update frequency**: Ongoing (content formatting, metadata normalization)
- **Backup priority**: CRITICAL (irreplaceable historical content)
- **Curation scope**: 300-500 hours of formatting, deduplication, taxonomy work

---

### Volume 6: Marxists Library (500K+ texts - Read-Write for Curation)

**Mount**: `/app/marxists-library`
**Purpose**: Marxists Internet Archive (500,000+ documents)

**Directory Structure**:
```
/app/marxists-library/
├── authors/
│   ├── marx/
│   │   ├── capital-volume-1.md
│   │   └── ...
│   ├── engels/
│   ├── lenin/
│   └── ... (100+ authors)
├── categories/
│   ├── theory/
│   ├── history/
│   └── contemporary/
└── chronological/
    ├── 1800-1850/
    ├── 1850-1900/
    └── ...
```

**Access Pattern**:
- Read-write mount (curation enabled)
- Metadata read via `/api/library/search?q=query&source=marxists`
- Database stores metadata + full-text search index
- Scraper running on server continuously adds new documents
- Files edited for curation, metadata re-indexed

**Characteristics**:
- **Size**: 100-200GB (500K+ files)
- **Access pattern**: Read/write (search queries + curation + scraper writes)
- **Update frequency**: Continuous (scraper adds documents, curation normalizes content)
- **Backup priority**: HIGH (expensive to re-scrape)
- **Curation scope**: 400-700 hours of formatting, deduplication, taxonomy work

---

## Part 3: API Route Mapping

### Gallery Routes → `veritable-gallery` Volume

```typescript
// These routes ALREADY map to veritable-gallery when mounted at /app/public/uploads

// frontend/src/app/api/projects/[slug]/concept-art/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'concept-art', slug);
// Maps to: /app/public/uploads/concept-art/{slug}
// On volume: veritable-gallery/concept-art/{slug}

// frontend/src/app/api/projects/[slug]/references/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'references', slug);
// Maps to: /app/public/uploads/references/{slug}
// On volume: veritable-gallery/references/{slug}

// frontend/src/app/api/projects/[slug]/history/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'history', slug);
// Maps to: /app/public/uploads/history/{slug}
// On volume: veritable-gallery/history/{slug}

// frontend/src/app/api/projects/[slug]/concept-art/videos/upload/route.ts
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', slug);
// Maps to: /app/public/uploads/videos/{slug}
// On volume: veritable-gallery/videos/{slug}
```

**Status**: ✅ NO CODE CHANGES NEEDED - Already correct

---

### User Upload Routes → `veritable-user-uploads` Volume

```typescript
// These routes ALREADY map to veritable-user-uploads when mounted at /app/data/uploads

// frontend/src/app/api/users/[id]/avatar/route.ts
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
// Maps to: /app/data/uploads/avatars
// On volume: veritable-user-uploads/avatars

// frontend/src/app/api/forums/posts/[postId]/attachments/route.ts (if exists)
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'forum-attachments');
// Maps to: /app/data/uploads/forum-attachments
// On volume: veritable-user-uploads/forum-attachments
```

**Status**: ✅ NO CODE CHANGES NEEDED - Already correct

---

### Archive Routes → Anarchist/Marxists Volumes (Read-Write for Curation)

```typescript
// These routes READ from anarchist and marxists volumes

// frontend/src/lib/anarchist/service.ts
const LIBRARY_BASE_PATH = process.env.ANARCHIST_LIBRARY_PATH || '/app/anarchist-library';

// When source='anarchist':
const documents = await fs.readdir(LIBRARY_BASE_PATH + '/' + language);
// Mounts to: anarchist-library:/app/anarchist-library

// frontend/src/lib/marxist/service.ts (when implemented)
const LIBRARY_BASE_PATH = process.env.MARXIST_LIBRARY_PATH || '/app/marxists-library';

// When source='marxists':
const documents = await fs.readdir(LIBRARY_BASE_PATH + '/' + category);
// Mounts to: marxists-library:/app/marxists-library
```

**Status**: ✅ NO CODE CHANGES NEEDED - Paths already use environment variables with correct defaults
- Code uses `ANARCHIST_LIBRARY_PATH` env var (defaults to `/app/anarchist-library`)
- Will implement `MARXIST_LIBRARY_PATH` env var similarly

---

## Part 4: Container Initialization Sequence

### Step 1: Create Volumes
```bash
ssh user@192.168.1.15

# Create all 6 volumes
docker volume create veritable-gallery
docker volume create veritable-user-uploads
docker volume create veritable-wiki
docker volume create veritable-news
docker volume create anarchist-library    # Verify exists
docker volume create marxists-library      # Verify exists

# Verify
docker volume ls
```

### Step 2: Populate Gallery Volume
```bash
# Transfer 1.1GB from localhost
# (Use rsync method from EXTERNALIZED_FILES_IMPLEMENTATION_PLAN.md Phase 2)

rsync -avz --progress \
  frontend/public/uploads/ \
  user@192.168.1.15:/tmp/uploads-staging/

# On server: Move to volume
docker run --rm \
  -v veritable-gallery:/mnt/uploads \
  -v /tmp/uploads-staging:/mnt/staging \
  alpine cp -r /mnt/staging/* /mnt/uploads/

# Cleanup
ssh user@192.168.1.15 "rm -rf /tmp/uploads-staging"
```

### Step 3: Populate User Uploads Volume
```bash
# Currently empty (no migration needed)
# Will populate automatically as users upload avatars and forum attachments

# Verify volume is ready
docker run --rm -v veritable-user-uploads:/mnt/uploads alpine ls /mnt/uploads/
# (Should show empty directory)
```

### Step 4: Configure Coolify
```
Coolify Dashboard → Veritable Games Application

Add Volume Mounts:
1. veritable-gallery → /app/public/uploads (Read/Write)
2. veritable-user-uploads → /app/data/uploads (Read/Write)
3. veritable-wiki → /app/public/wiki-images (Read/Write)
4. veritable-news → /app/public/news (Read/Write)
5. anarchist-library → /app/anarchist-library (Read/Write for curation)
6. marxists-library → /app/marxists-library (Read/Write for curation)

Save and trigger redeploy
```

### Step 5: Verify Mounts
```bash
# After deployment completes
ssh user@192.168.1.15

# Check all 6 volumes are mounted
docker inspect m4s0kwo4kc4oooocck4sswc4 | grep -A 50 Mounts

# Should show 6 mount points:
#   /app/public/uploads → veritable-gallery
#   /app/data/uploads → veritable-user-uploads
#   /app/public/wiki-images → veritable-wiki
#   /app/public/news → veritable-news
#   /app/anarchist-library → anarchist-library
#   /app/marxists-library → marxists-library

# Test files exist in container
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/public/uploads/
# Should list: concept-art/, references/, history/, videos/
```

---

## Part 5: Backup & Sync Strategy Per Volume

### Volume Backup Priority & Frequency

| Volume | Priority | Frequency | Size | Command |
|--------|----------|-----------|------|---------|
| `veritable-gallery` | 🔴 CRITICAL | Daily | 1.1GB | `docker volume create backup-gallery-YYYY-MM-DD; docker run --rm -v veritable-gallery:/src -v backup-gallery-YYYY-MM-DD:/dst alpine cp -r /src/* /dst/` |
| `veritable-user-uploads` | 🟠 HIGH | Daily | <500MB | `docker volume create backup-user-uploads-YYYY-MM-DD; ...` |
| `veritable-wiki` | 🟡 MEDIUM | Weekly | <100MB | (Same pattern) |
| `veritable-news` | 🟡 MEDIUM | Weekly | <200MB | (Same pattern) |
| `anarchist-library` | 🔴 CRITICAL | Monthly | 20-50GB | (Same pattern, or rsync to S3) |
| `marxists-library` | 🟠 HIGH | Monthly | 100-200GB | (Same pattern, or rsync to S3) |

### Sync Workflow (Localhost ↔ Server)

#### Gallery Sync (veritable-gallery)
```bash
# PUSH: Localhost → Server
npm run sync:gallery:push

# Runs rsync:
# frontend/public/uploads/ → user@192.168.1.15:/tmp/gallery-sync/

# On server:
# docker run --rm -v veritable-gallery:/mnt/uploads -v /tmp/gallery-sync:/mnt/incoming \
#   alpine cp -r /mnt/incoming/* /mnt/uploads/

# PULL: Server → Localhost
npm run sync:gallery:pull

# Runs rsync:
# user@192.168.1.15:/var/backups/gallery/ → frontend/public/uploads/

# BACKUP: Create timestamped backup
npm run sync:gallery:backup
```

#### User Uploads Sync (veritable-user-uploads)
```bash
# Only for manual backup or development
npm run sync:user-uploads:push
npm run sync:user-uploads:pull
npm run sync:user-uploads:backup
```

#### Archives (Read-Only - Backup Only)
```bash
# Anarchist Library
npm run sync:anarchist:backup

# Marxists Library
npm run sync:marxists:backup

# These are read-only, so no push/pull
```

---

## Part 6: Future Migration Path

### Phase 6: Implement Wiki Images (When Needed)
1. Update wiki editor to save images to `/app/public/wiki-images/`
2. Verify `veritable-wiki` volume mounted
3. Create sync script for wiki images

### Phase 7: Implement News Media (When Needed)
1. Create news admin panel for image uploads
2. Save to `/app/public/news/`
3. Verify `veritable-news` volume mounted
4. Create sync script for news

### Phase 8: Expand Anarchist Library (2-4 Weeks)
1. Obtain 24,643 documents
2. Transfer to `anarchist-library` volume
3. Build database index
4. Implement search API

### Phase 9: Expand Marxists Library (4-8 Weeks)
1. Complete scraper (currently running)
2. Transfer 500K+ documents to `marxists-library` volume
3. Build database index
4. Implement search and browsing API

---

## Summary: Option D Implementation

**Total Volumes**: 6 Docker volumes
**Total Database**: 1 PostgreSQL database (`veritable_core`)
**Total Containers**: 1 Veritable Games container

**Immediate (This Session)**:
- Phase 1-5: Fix gallery with `veritable-gallery` volume

**Short-term (Next 2-4 Weeks)**:
- Phase 6: User uploads properly isolated
- Wiki/news volumes created (ready for future use)

**Long-term (2-8 Months)**:
- Anarchist Library fully integrated
- Marxists Library integrated
- Separate containers if scaling needed

---

**Implementation Status**: Ready for Phase 1-5 execution

**Next**: Execute 5-phase implementation plan with Option D architecture

