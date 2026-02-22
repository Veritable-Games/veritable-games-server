# Database & Volume Architecture Options

**Status**: Architecture Decision Guide
**Date**: November 10, 2025
**Purpose**: Help decide how to organize databases and volumes for gallery, wiki, library, user uploads, and news

---

## Overview: What Needs Storage

Before choosing an architecture, understand what data each system stores:

### Gallery System
- **Metadata**: Project → References/Concept-Art/History/Videos relationships (stored in `content.gallery_items`, `content.albums`)
- **Files**: JPG/PNG images, MP4 videos (1.1GB total)
- **Location**: `/public/uploads/concept-art/{slug}/`, `/public/uploads/references/{slug}/`, etc.

### Wiki System
- **Metadata**: Wiki page content, revisions, full-text search (stored in `wiki.pages`, `wiki.revisions`)
- **Files**: Embedded images/diagrams in wiki markdown (relatively small, <100MB estimated)
- **Location**: `/public/uploads/wiki/` or `/data/wiki/`

### Library Systems
- **Anarchist Library**: 24,643 documents, 27 languages (stored in `anarchist.documents` schema)
  - Requires read-write access for curation, deduplication, and formatting work
- **Marxists.org**: 500K+ documents (stored in `marxist.documents` schema)
  - Requires read-write access for curation and deduplication
- **Location**: `/app/anarchist-library/` and `/app/marxists-library/` (as volumes)

### User Uploads
- **Forum Attachments**: Files attached to forum posts (stored in `forums.post_attachments`)
- **User Avatars**: Profile pictures (stored in `users.users` + files in `/data/uploads/avatars/`)
- **Profile Media**: User-uploaded content to profiles (stored in `users.user_media`)
- **Location**: `/data/uploads/avatars/`, `/data/uploads/forum-attachments/`

### News System
- **Metadata**: News articles (stored in `content.news` or similar)
- **Files**: Featured images, article media
- **Location**: `/public/uploads/news/` or `/data/uploads/news/`

---

## Architecture Option A: Monolithic (Single Shared Everything)

### Overview
One database table for all metadata, one Docker volume for all files.

### Structure

```
Database:
├── content.gallery_items         (Projects: concept-art, references, history, videos)
├── content.gallery_albums        (Gallery organization)
├── wiki.pages                    (Wiki content + embedded images)
├── wiki.revisions                (Wiki version history)
├── library.documents             (Anarchist + Marxists + User-uploaded docs)
├── forums.posts + post_attachments
├── users.users (avatars)
├── content.news                  (News articles + images)
└── [All other tables shared]

Docker Volumes:
├── veritable-uploads/            (ALL files: 1.1GB gallery + wiki + user uploads)
│   ├── gallery/concept-art/{project}/
│   ├── gallery/references/{project}/
│   ├── gallery/history/{project}/
│   ├── gallery/videos/{project}/
│   ├── wiki/images/
│   ├── avatars/
│   ├── forum-attachments/
│   └── news/
├── anarchist-library/            (24,643 Anarchist texts - read-write for curation)
└── marxists-library/             (500K+ Marxists texts - read-write for curation)

Container:
├── Single Veritable Games container
└── Mounts all 3 volumes
```

### Pros ✅
- **Simplest to manage**: One database, one volume for user uploads
- **Easiest to deploy**: Single Coolify application
- **Data relationships clear**: All metadata in single DB
- **Fastest queries**: No cross-database JOINs needed
- **Easy backups**: Single database backup, single volume backup
- **Low overhead**: Minimal container/resource requirements

### Cons ❌
- **Monolithic database**: Single point of failure for all features
- **Shared storage**: All files in one volume (harder to manage independently)
- **Scaling bottleneck**: Can't scale individual features
- **Permission complexity**: Same permissions for all file types (forum attachments, avatars, project files)
- **Hard to separate concerns**: Can't manage gallery independently from forums
- **Future flexibility**: Adding new features requires modifying central schema

### When to Use
- **Small to medium projects** (< 5GB total data)
- **Development/prototyping** phase
- **Single deployment model** (no plans to scale)
- **When simplicity is priority** over flexibility

### Cost/Complexity
- Database: 1 PostgreSQL instance
- Volumes: 3 (uploads + 2 libraries)
- Containers: 1 application container
- Backup complexity: Low (single backup routine)

---

## Architecture Option B: Feature-Separated (Separate Databases, Shared Upload Volume)

### Overview
Separate PostgreSQL database per major feature, but all files in one shared Docker volume.

### Structure

```
Databases:
├── veritable_content             (Gallery + News)
│   ├── gallery_items
│   ├── gallery_albums
│   ├── gallery_tags
│   ├── news
│   └── ...
├── veritable_wiki                (Wiki system)
│   ├── pages
│   ├── revisions
│   └── ...
├── veritable_forums              (Forums system)
│   ├── posts
│   ├── post_attachments
│   ├── topics
│   └── ...
├── veritable_users               (User profiles)
│   ├── users (with avatar paths)
│   ├── user_media
│   └── ...
├── veritable_library             (Anarchist + Marxists)
│   ├── documents
│   ├── document_index
│   └── ...
├── veritable_auth                (Auth + Sessions)
│   └── [standard]
└── veritable_system              (Config + shared)
    └── [configuration]

Docker Volumes:
├── veritable-uploads/            (Shared: ALL user-generated files)
│   ├── gallery/
│   ├── wiki/
│   ├── avatars/
│   ├── forum-attachments/
│   └── news/
├── anarchist-library/            (Archive, read-only)
└── marxists-library/             (Archive, read-only)

Container:
├── Single Veritable Games container
└── Connects to 7 PostgreSQL databases + mounts 3 volumes
```

### Pros ✅
- **Feature isolation**: Can manage gallery DB independently from forums DB
- **Easier scaling**: Can scale individual database if needed (e.g., library searches get heavy)
- **Clear boundaries**: Each feature owns its data
- **Shared file storage**: All uploads still in one volume (simpler backup)
- **Cleaner schema**: No unrelated tables in same database
- **Better security**: Can have different permissions per database
- **Archive separation**: Libraries completely separate from user-generated content

### Cons ❌
- **No cross-DB JOINs**: Need application-level logic to combine data (users + forum posts)
- **More connections**: Application needs connection pool for 7 databases
- **Backup complexity**: Need to backup 7 databases + 1 volume
- **Deployment complexity**: 7 separate database instances (or same server, different names)
- **More infrastructure**: Higher resource usage, more management
- **Connection pool size**: Need larger pool to handle 7 databases
- **Data consistency**: Harder to maintain consistency across databases

### When to Use
- **Medium to large projects** (5-50GB data)
- **When features have distinct scaling needs**
- **Team development** (teams own different features)
- **Long-term maintenance** (easier to isolate issues)
- **Archive systems** (Anarchist + Marxists clearly separate)

### Cost/Complexity
- Databases: 7 PostgreSQL databases
- Volumes: 3 (uploads + 2 libraries)
- Containers: 1 application container
- Backup complexity: Medium (7 databases + 1 volume)

---

## Architecture Option C: Container-Separated (Separate Containers, Separate Volumes)

### Overview
Completely separate containers/services for different systems. Maximum scalability and isolation.

### Structure

```
Container 1: Veritable Games Main (Core + Gallery + News + Wiki)
├── Database: veritable_core
│   ├── content (gallery, news, projects)
│   ├── wiki (pages, revisions)
│   ├── users (profiles, avatars)
│   ├── forums (posts, attachments)
│   └── auth (sessions, tokens)
└── Volumes:
    ├── veritable-uploads/ (gallery, wiki, avatars, forum-attachments, news)
    └── marxists-library/ (read-only, for searches from main app)

Container 2: Library Service (Anarchist + Marxists)
├── Database: veritable_library
│   ├── anarchist_library.documents
│   └── marxists_library.documents
└── Volumes:
    ├── anarchist-library/ (24,643 documents - read-only)
    └── marxists-library/ (500K+ documents - read-only)

Container 3: User Upload Service (Optional - for heavy file operations)
├── Lightweight Node/Python service
├── Database: Shared veritable_core (user & forum attachment records)
└── Volumes:
    ├── veritable-user-uploads/ (avatars + forum attachments)
    └── (read from marxists-library for indexing)

Shared Infrastructure:
├── PostgreSQL Cluster (7 total databases)
├── Redis Cache (shared)
└── S3-compatible storage (optional - offload large files)
```

### Pros ✅
- **Maximum scalability**: Each container can scale independently
- **Fault isolation**: Gallery goes down, forums still work
- **Technology flexibility**: Can use different tech for each service (Python for library indexing, Node for main app)
- **Independent deployment**: Update gallery without redeploying forums
- **Clear APIs**: Services communicate via HTTP
- **Advanced features**: Can add caching layers, API gateways, load balancers
- **Team scalability**: Different teams own different services

### Cons ❌
- **Architectural complexity**: Microservices require more infrastructure knowledge
- **Data consistency**: Distributed transactions are hard
- **Operational overhead**: More containers to manage, monitor, update
- **Network overhead**: Services talk via HTTP (slower than shared memory)
- **Deployment complexity**: Coolify needs to manage 3+ containers
- **Cost**: More resources (each container needs its own resources)
- **Debugging difficulty**: Cross-container issues are harder to debug
- **Database proliferation**: More PostgreSQL instances (or more databases on same instance)

### When to Use
- **Large projects** (100GB+ data)
- **High traffic applications** (millions of requests/day)
- **Team scale** (10+ developers)
- **Complex scaling requirements** (some services need more resources)
- **Advanced deployment** (Kubernetes, service mesh)
- **Future proofing** (planning for significant growth)

### Cost/Complexity
- Databases: 3 PostgreSQL databases (or 1 with 3 schemas)
- Volumes: 4-5 (uploads, anarchist, marxists, cache, optional S3)
- Containers: 3+ application containers
- Backup complexity: High (multiple containers + volumes + databases)

---

## Architecture Option D: Hybrid (Shared Core, Feature-Specific Uploads)

### Overview
Balanced approach: shared database for core data, separate upload volumes for different file types.

### Structure

```
Database:
├── veritable_core                (Single database, shared by all features)
│   ├── content (gallery, news, projects)
│   ├── wiki (pages, revisions)
│   ├── forums (posts, metadata)
│   ├── users (profiles, avatars)
│   ├── library (documents metadata)
│   └── auth (sessions)

Docker Volumes:
├── veritable-gallery/            (1.1GB - project galleries)
│   ├── concept-art/{project}/
│   ├── references/{project}/
│   ├── history/{project}/
│   └── videos/{project}/
├── veritable-user-uploads/       (Avatars + Forum attachments)
│   ├── avatars/
│   └── forum-attachments/
├── veritable-wiki/               (Wiki images)
│   └── images/
├── veritable-news/               (News media)
│   └── media/
├── anarchist-library/            (24,643 documents - read-only)
└── marxists-library/             (500K+ documents - read-only)

Container:
├── Single Veritable Games container
└── Mounts all 6 volumes
```

### Pros ✅
- **Balanced approach**: Simplicity of monolithic DB, flexibility of volume separation
- **Independent volume management**: Can backup gallery separately from user uploads
- **Clear organization**: Know exactly where each file type is stored
- **Easy scaling**: Can move individual volumes to different storage later
- **Performance flexibility**: Can optimize different volumes differently
- **Future migration path**: Easy to extract features into separate containers later
- **Backup granularity**: Can prioritize which volumes to backup (gallery > user uploads > archives)
- **Permission separation**: Each volume can have different access patterns (gallery read-heavy, user uploads read/write)

### Cons ❌
- **More volumes to manage**: 6 volumes instead of 1-3
- **Moderate complexity**: More than monolithic but simpler than microservices
- **Backup routing**: Need to backup multiple volumes (though still simpler than Option B/C)
- **Naming consistency**: Need clear naming convention for 6 volumes
- **Storage planning**: Need to calculate space needs per volume separately

### When to Use
- **Growing projects** (10-100GB data)
- **Clear file type separation** needed
- **Performance optimization** planned (different volumes on different storage)
- **Team scaling** (easier to manage separated concerns)
- **Future flexibility** (want path to microservices without rewriting)

### Cost/Complexity
- Database: 1 PostgreSQL instance
- Volumes: 6 (gallery, user-uploads, wiki, news, anarchist, marxists)
- Containers: 1 application container
- Backup complexity: Medium (6 volumes, 1 database)

---

## Comparison Matrix

| Aspect | Option A (Monolithic) | Option B (Feature-Sep DB) | Option C (Container-Sep) | Option D (Hybrid) |
|--------|-----|-----|-----|-----|
| **Complexity** | Low | Medium | High | Medium-Low |
| **Scalability** | Poor | Good | Excellent | Good |
| **Failure Isolation** | None | Partial | Complete | Partial |
| **Backup Complexity** | Low | Medium | High | Medium |
| **Development Speed** | Fast | Medium | Slow | Fast |
| **Query Performance** | Best | Good | Fair | Best |
| **Data Consistency** | Best | Good | Fair | Best |
| **File Organization** | Simple | Medium | Complex | Organized |
| **Future Migration** | Hard | Medium | Easy | Easy |
| **Number of DBs** | 1 | 7 | 3-7 | 1 |
| **Number of Volumes** | 3 | 3 | 4-5 | 6 |
| **Container Count** | 1 | 1 | 3+ | 1 |
| **Best For Size** | <5GB | 5-50GB | 100GB+ | 10-100GB |
| **Team Size** | 1-3 | 3-8 | 8+ | 3-8 |

---

## My Recommendation: Option D (Hybrid) for Your Project

### Why Option D

**Veritable Games fits the Hybrid model perfectly**:

1. **Current state**: You have 1.1GB+ uploads + 24K anarchist + 500K marxists
   - That's distributed file storage naturally → suggests separate volumes

2. **Growth trajectory**: Started monolithic, adding archives and libraries
   - Hybrid path allows natural evolution without rewriting

3. **Your team size**: Single developer (Claude Code sessions)
   - Don't need full microservices (Option C), but want organized structure (Option A is too loose)

4. **File independence**: Gallery files are fundamentally different from user avatars
   - Separate volumes let you prioritize (backup gallery first, user uploads second)

5. **Clear separation of concerns**: Archives (anarchist/marxists) should be isolated
   - Already have separate volumes planned

6. **Performance requirements**: Gallery reads are heavy, user uploads are moderate
   - Can optimize each volume independently later

### Option D Naming Convention

```
Databases:
└── veritable_core (PostgreSQL database)

Docker Volumes:
├── veritable-gallery              (Gallery: concept-art, references, history, videos)
├── veritable-user-uploads         (Users: avatars, forum attachments)
├── veritable-wiki                 (Wiki: embedded images, diagrams)
├── veritable-news                 (News: featured images, article media)
├── anarchist-library              (Archive: 24,643 Anarchist texts - read-write for curation)
└── marxists-library               (Archive: 500K+ Marxist texts - read-write for curation)

Container Mounts:
veritable-games container mounts:
  - /app/public/uploads → veritable-gallery
  - /app/data/uploads → veritable-user-uploads
  - /app/public/wiki-images → veritable-wiki
  - /app/public/news → veritable-news
  - /app/anarchist-library → anarchist-library
  - /app/marxists-library → marxists-library
```

### Implementation Timeline

**Phase 1-5** (This session): Fix gallery with `veritable-gallery` volume
```bash
docker volume create veritable-gallery
# Transfer 1.1GB uploads to veritable-gallery
# Mount at /app/public/uploads
```

**Phase 6** (Next): Create remaining volumes
```bash
docker volume create veritable-user-uploads
docker volume create veritable-wiki
docker volume create veritable-news
# Repurpose existing anarchist-library, marxists-library
```

**Phase 7** (Later): Implement file isolation
```typescript
// Update API routes to write to specific volumes
// gallery routes → /app/public/uploads (veritable-gallery)
// user avatars → /app/data/uploads (veritable-user-uploads)
// wiki images → /app/public/wiki-images (veritable-wiki)
// news images → /app/public/news (veritable-news)
```

---

## What About News?

**News Section Storage**:
- **Option A/B/C**: News images in shared locations or separate DB tables
- **Option D (Recommended)**: `veritable-news` volume for news-specific media

**Why separate news volume?**
- News media is less frequently accessed than gallery
- News updates are batch operations (schedule posts in advance)
- Easy to snapshot news volume for versioned releases
- Clear separation: "What media is part of current news?"

---

## Library Volume Curation Requirements

**Why Anarchist & Marxists Volumes Are Read-Write (Not Read-Only)**

Both library volumes require **read-write access** for extensive curation work:

### Curation Scope
- **Content Formatting**: Fix markdown syntax, encoding issues, broken headers
- **Metadata Normalization**: Standardize author names, dates, categories
- **Deduplication**: Detect and merge duplicates across 524,643 total documents
- **Tag Standardization**: Build consistent taxonomy across both archives
- **Quality Control**: Fix OCR errors, corrupted text, missing descriptions

### Estimated Effort
- **Anarchist Library**: 300-500 hours (24,643 documents)
- **Marxists Library**: 400-700 hours (500,000+ documents)
- **Total**: 700-1200 hours of curation work

### Curation Workflows Supported
1. **Web UI**: Edit documents via admin panel (recommended for ongoing work)
2. **Direct File Editing**: SSH access to volumes for bulk operations
3. **Hybrid**: Bulk edits via filesystem, incremental improvements via UI

### Duplicate Detection
Both archives have overlapping content (estimated 10-20% duplicates):
- Same texts in both Anarchist Library and Marxists.org
- Different editions/translations
- Minor content variations

**Solution**: Linked document groups in PostgreSQL allow:
- Preserving all versions
- Marking canonical version
- Enabling user choice between versions
- Aggregating view counts across linked documents

---

## Implementation Decision

**I recommend Option D because**:
1. ✅ Naturally fits your current architecture (already have library volumes)
2. ✅ Allows future splitting into Option C without rewriting
3. ✅ Simpler than Option B (no multi-database complexity)
4. ✅ More organized than Option A (clear file separation)
5. ✅ Perfect for single-developer team
6. ✅ Clear path forward for Marxists integration

**Shall I proceed with Option D?** If so, I'll update the 5-phase implementation plan to:
- Phase 1-5: Implement gallery with `veritable-gallery` volume (as planned)
- Include setup script that creates all 6 volumes at once
- Document how to migrate data to each volume as features expand

---

## Next: File Organization Standards

Once you approve Option D architecture, I'll create:
1. **Volume mount configuration** for Coolify
2. **File path conventions** for each feature
3. **API route migration guide** (which routes write to which volumes)
4. **Backup strategy** per volume (priority + frequency)
5. **Sync workflow** for each volume type

---

**Decision Point**:
- ✅ **Choose Option D** → Continue with implementation plan (5 phases to fix gallery, then expand to other volumes)
- ⚠️ **Choose different option** → I'll adjust implementation plan accordingly
- ❓ **Have questions** → Ask about any option and I'll clarify

