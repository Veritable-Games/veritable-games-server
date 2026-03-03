# Veritable Games Server - Complete Project Inventory

**Last Updated:** March 1, 2026
**Scope:** All active projects, archives, and historical versions on the production server
**Total Server Data:** ~1.1 TB

---

## Executive Summary

The Veritable Games production server (192.168.1.15) contains **18 major project components** organized across Git repositories, game engine projects, archives, and historical versions:

- **3 Active Git Repositories** - Server config, VG site, BTCPayServer
- **3 Godot Game Projects** - 41 versioned releases total
- **1 Unity Game Project** - 7-year development history (499 GB)
- **60 Website Versions** - Company site archives (66 GB)
- **5 Archive Collections** - Literature, databases, server backups
- **~1.1 TB Total Data**

---

## I. ACTIVE DEVELOPMENT PROJECTS

### A. Veritable Games Server Repository

**Location:** `/home/user/`
**Git Remote:** `git@github.com:Veritable-Games/veritable-games-server.git`
**Type:** Server infrastructure (Git repository - Root)
**Status:** ✅ Active
**Size:** ~420 MB (excluding large archives via .gitignore)
**Last Commit:** February 28, 2026
**Key Features:**
- Infrastructure documentation and configuration
- Deployment procedures and scripts
- Server-level CLAUDE.md guidance
- Health monitoring scripts
- Complete server documentation

**Submodules:**
- `projects/veritable-games/site/` → VG application code
- `btcpayserver-docker/` → Bitcoin payment infrastructure

---

### B. Veritable Games Application (Next.js)

**Location:** `/home/user/projects/veritable-games/site/`
**Git Remote:** `git@github.com:Veritable-Games/veritable-games-site.git`
**Type:** Web application (Git submodule)
**Status:** ✅ Active Production
**Size:** 3.3 GB
**Last Commit:** February 24, 2026
**Technology Stack:**
- Next.js / React frontend
- TypeScript
- PostgreSQL database
- Node.js backend

**Components:**
```
site/
├── frontend/                          # Next.js application
│   ├── src/
│   │   ├── app/                      # Pages and routes
│   │   ├── components/               # React components
│   │   ├── lib/                      # Utilities and services
│   │   └── styles/
│   ├── public/                       # Static assets
│   ├── package.json
│   └── tsconfig.json
├── docs/                             # Project documentation
├── scripts/                          # Build and utility scripts
└── CLAUDE.md                         # Project-level guidance
```

**Key Features:**
- Library management system (Anarchist, Marxist, YouTube, User Library)
- Forums and wiki
- Document tagging and search
- User authentication
- Admin dashboard

---

### C. Veritable Games Resources & Data

**Location:** `/home/user/projects/veritable-games/resources/`
**Type:** Project resources (NOT in Git - gitignored)
**Status:** ✅ Active
**Size:** 102 GB
**Last Modified:** Ongoing (regularly updated)

**Subdirectories:**

```
resources/
├── data/                             # Literature archives (77 GB)
│   ├── anarchist/                    # Anarchist Library texts
│   ├── marxist/                      # Marxist Library texts
│   ├── youtube/                      # YouTube transcripts
│   ├── library/                      # User library documents
│   ├── library-pdfs/                 # PDF documents
│   │   ├── Personal/
│   │   ├── Public Domain/
│   │   ├── Comics/
│   │   ├── Fiction/
│   │   └── unconverted/              # Unprocessed PDFs
│   └── transcripts/                  # Raw transcripts
│
├── scripts/                          # Python processing scripts
│   ├── import_*.py                   # Import scripts for each source
│   ├── metadata_audit.py             # Metadata enrichment
│   ├── cleanup_pdf_artifacts.py      # PDF post-processing
│   └── [63 other utility scripts]
│
├── sql/                              # Database migrations
│   ├── anarchist_tables.sql
│   ├── youtube_tables.sql
│   ├── marxist_tables.sql
│   └── [migration files]
│
├── processing/                       # Data processing
│   ├── audit-scripts/                # Audit and fingerprinting
│   ├── reconversion-scripts/         # PDF reconversion utilities
│   └── [processing workflows]
│
├── logs/                             # Script execution logs
│   ├── import_*.log
│   ├── processing_*.log
│   └── [audit logs]
│
└── docker-compose.yml                # Local development environment
```

**Purpose:**
- Stores all imported literature and document data
- Contains processing scripts for data enrichment
- Manages document metadata, tags, and relationships
- Supports local development with docker-compose

**Database Content:**
- 24,643 Anarchist Library texts (27 languages)
- 12,728 Marxist Library documents
- 60,816 YouTube transcripts
- 7,500+ User library documents
- 2,561 Library collection documents

---

### D. BTCPayServer Infrastructure

**Location:** `/home/user/btcpayserver-docker/`
**Git Remote:** `https://github.com/btcpayserver/btcpayserver-docker.git`
**Type:** Infrastructure (Git submodule)
**Status:** ✅ Active (Payment processing)
**Size:** 2.6 MB
**Last Commit:** February 23, 2026

**Purpose:** Bitcoin payment processing infrastructure for monetization features.

---

### E. X402 Payment Integration

**Location:** `/home/user/docs/x402-payment-integration/`
**Type:** Payment protocol integration (TypeScript)
**Status:** 🔧 In Development
**Size:** 903 MB (includes node_modules)
**Last Modified:** February 20, 2026
**Technology:** Node.js / TypeScript

**Components:**
- X402 payment protocol client implementation
- Database schema for payment tracking
- Integration utilities for web applications

**Files:**
- `src/` - Integration source code
- `schema.sql` - Payment database schema
- `package.json` - Dependencies

---

## II. GAME PROJECTS

### F. NOXII-LEGACY (Godot Game - 28 Versions)

**Location:** `/data/projects/NOXII-LEGACY/`
**Engine:** Godot
**Type:** Game project (archived versions)
**Status:** 📦 Archive
**Total Size:** 29 GB
**Total Versions:** 28 (v0.01 through v0.28)
**Last Modified:** December 27, 2025
**Git Status:** NOT in Git

**Latest Version Details (v0.28):**
- 1,208 GDScript (.gd) files
- Complete dialogue system
- Color system
- Conversation analysis tools
- Comprehensive asset library
- Last modified: September 15, 2025

**Version Progression:**
- v0.01-v0.05: Initial development
- v0.06-v0.15: Core systems development
- v0.16-v0.27: Feature expansion
- v0.28: Latest comprehensive version

**Structure per Version:**
```
NOXII-LEGACY/vX.XX/
├── project.godot                # Godot project file
├── .godot/                       # Godot cache
├── addons/                       # Game addons
├── assets/                       # Game assets (art, audio, etc.)
├── autoload/                     # Autoload scripts
├── scenes/                       # Game scenes
├── scripts/                      # GDScript source files
└── docs/                         # Version documentation
```

---

### G. NOXII (Godot Game - 4 Versions)

**Location:** `/data/projects/NOXII/`
**Engine:** Godot
**Type:** Game project (released versions)
**Status:** 📦 Archive
**Total Size:** 5.9 GB
**Total Versions:** 4 (v0.01 through v0.04)
**Last Modified:** October 11, 2025
**Git Status:** NOT in Git

**Compiled Builds:**
- `noxii-0.01.tar.xz` (344 MB)
- `noxii-0.02.tar.xz` (344 MB)
- `noxii-0.03.tar.xz` (357 MB)
- `noxii-0.04.tar.xz` (314 MB)

**Purpose:** Released game builds with compiled executables for distribution.

---

### H. ENACT (Godot Game - 9 Versions)

**Location:** `/data/projects/ENACT/`
**Engine:** Godot
**Type:** Game project (multi-version development)
**Status:** 📦 Archive
**Total Size:** 16 GB
**Total Versions:** 9 (v0.01 through v0.09)
**Last Modified:** December 27, 2025
**Git Status:** NOT in Git

**Features:**
- Complete Godot project files (sources, assets, scenes)
- AI development guidelines
- Code quality assessments
- Dialogue architecture documentation

**Compiled Builds:**
- `enact-0.01.tar.xz` (363 MB)
- `enact-0.02.tar.xz` (370 MB)
- `enact-0.03.tar.xz` (505 MB)

**Structure per Version:**
```
ENACT/vX.XX/
├── project.godot
├── .godot/
├── scenes/
├── scripts/
├── assets/
├── docs/
│   ├── AI_DEVELOPMENT_GUIDELINES.md
│   ├── CODE_QUALITY_ASSESSMENT.md
│   └── DIALOGUE_ARCHITECTURE.md
└── exported_builds/
```

---

### I. DODEC (Unity Game - 7-Year Archive)

**Location:** `/data/unity-projects/DODEC/`
**Engine:** Unity
**Type:** Game project (multi-year development archive - LARGEST PROJECT)
**Status:** 📦 Archive
**Total Size:** 499 GB (largest single component on server)
**Development Span:** 2019 - 2025 (7 years)
**Git Status:** NOT in Git

**Version History by Year:**

| Year | Version | Date | Size | Status |
|------|---------|------|------|--------|
| 2019 | v1 | Oct 12, 2019 | ? | Archive |
| 2020 | v2 | Feb 11, 2021 | ? | Archive |
| 2021 | v3 | Dec 20, 2021 | ? | Archive |
| 2022 | v4 | Feb 24, 2023 | ? | Archive |
| 2023 | v5 | Dec 16, 2024 | ? | Archive |
| 2024 | v6 | Jan 8, 2025 | ? | Archive |
| 2025 | v7 | Sep 12, 2025 | 73.5 GB | Latest (7 builds) |

**2025 Builds (Latest Collection):**
```
dodec-v2.31-2022.3.60f1.zip (5.6 GB)
dodec-v2.30-2022.3.57f1.zip (12 GB)
dodec-v2.29-2022.3.50f1.zip (9.1 GB)
dodec-v2.28-2022.3.50f1.zip (9.6 GB)
dodec-v2.27-2022.3.50f1.zip (9.6 GB)
dodec-v2.26-2022.3.50f1.zip (9.0 GB)
dodec-v2.25-2022.3.50f1.zip (9.0 GB)
```

**Key Facts:**
- Represents 7 years of continuous game development
- Multiple major versions across years
- 2025 archive alone is 73.5 GB with 7 compiled versions
- Uses Unity 2022.3 LTS (as of latest versions)
- Comprehensive development and build history

---

## III. WEBSITE VERSIONS ARCHIVE

### J. Company Website Versions

**Location:** `/data/company-site/`
**Type:** Website archives (historical versions)
**Status:** 📦 Archive
**Total Size:** 66 GB
**Total Versions:** 60+ archived versions
**Format:** Compressed archives (.tar.xz)
**Git Status:** NOT in Git
**Last Modified:** Various dates (compressed archives)

**File Pattern:**
```
web-0.01.tar.xz
web-0.02.tar.xz
...
web-0.60.tar.xz
```

**Purpose:** Historical versions of company website, not currently active but preserved for reference and potential restoration.

---

## IV. DATA ARCHIVES & BACKUPS

### K. Veritable Games Literature Archives

**Location:** `/data/archives/veritable-games/`
**Type:** Literature and document archives
**Status:** 📦 Archive
**Total Size:** 122 GB
**Git Status:** NOT in Git

**Subdirectories:**

```
archives/veritable-games/
├── library/                          # Main library archives
│   ├── *.tar.xz                      # Compressed collections
│   └── ocr-backups/                  # OCR processing backups
│
├── library-pdfs/                     # PDF document archives
│   ├── Personal/
│   ├── Public Domain/
│   ├── Comics/
│   ├── Fiction/
│   └── unconverted/                  # Unprocessed PDFs (40+ GB)
│
├── transcripts/                      # YouTube transcripts
│   ├── channel-*.tar.xz              # Per-channel archives
│   └── metadata/
│
├── library-processing/               # Processing workflow backups
│   ├── metadata-enrichment/
│   ├── tag-extraction/
│   └── duplicate-detection/
│
└── processing-backups/               # Historical processing runs
    ├── 2025-*/
    ├── 2024-*/
    └── older/
```

**Purpose:**
- Backup of all literature archives
- OCR processing backups
- Transcript data
- Processing workflow histories

---

### L. Database Snapshots

**Location:** `/data/archives/database-snapshots/`
**Type:** PostgreSQL database backups
**Status:** 📦 Archive
**Total Size:** 2.2 GB
**Git Status:** NOT in Git

**Contents:**
```
database-snapshots/
├── pre-migration/                    # Pre-migration snapshots
│   ├── schema-*.sql
│   └── data-*.sql
│
├── pre-features/                     # Feature branch snapshots
│   ├── unified-tags/
│   ├── youtube-integration/
│   └── marxist-integration/
│
└── language-specific/                # Language-indexed snapshots
    ├── english/
    ├── german/
    └── [other languages]/
```

**Purpose:**
- Database state preservation
- Recovery points before major changes
- Feature-specific snapshots
- Language-specific dataset snapshots

---

### M. Server Configuration Backups

**Location:** `/data/archives/server-backups/`
**Type:** Server configuration and backups
**Status:** 📦 Archive
**Total Size:** 503 MB
**Git Status:** NOT in Git

**Purpose:** Historical server configurations, emergency backups, and recovery files.

---

## V. DOCUMENTATION & WORKSPACES

### N. Documentation

**Location:** `/home/user/docs/`
**Type:** Server and project documentation
**Status:** ✅ Active
**Total Size:** ~6 GB (excluding archived sessions)

**Subdirectories:**

```
docs/
├── README.md                         # Documentation index
├── reference/                        # Technical reference
│   ├── architecture.md               # System architecture
│   ├── troubleshooting.md            # Troubleshooting guide
│   ├── security-configuration.md     # Security details
│   ├── docker-build.md               # Docker build process
│   ├── scripts-guide.md              # Scripts reference (80+ scripts)
│   └── dual-machine-workflow.md      # Server/laptop workflow
│
├── server/                           # Server operations
│   ├── CONTAINER_PROTECTION_AND_RECOVERY.md
│   ├── CONTAINER_TO_GIT_AUTOMATION.md
│   ├── DRIVE_ARCHITECTURE.md
│   ├── REPOSITORY_ARCHITECTURE.md
│   ├── COOLIFY_DEPLOYMENT_FIX_PLAN.md
│   ├── HYBRID_STORAGE_ARCHITECTURE_PLAN.md
│   ├── SSH_KEY_SETUP_FEBRUARY_2026.md
│   ├── SSH_KEY_SECURITY_PLAN_2026.md
│   ├── MONITORING_AND_BACKUP_SYSTEM.md
│   ├── SERVER_PROJECT_INVENTORY.md  # ← THIS FILE
│   └── [other server docs]
│
├── veritable-games/                  # VG project documentation
│   ├── UNIFIED_TAG_SCHEMA_STATUS.md
│   ├── FORENSIC_ANALYSIS_REPORT.md
│   ├── SCHEMA_OVERRIDE_DIAGNOSIS.md
│   ├── MARXIST_AUDIT_MASTER_WORKFLOW.md
│   ├── MARXIST_AUDIT_SESSION_TRACKING.md
│   ├── YOUTUBE_MARXIST_INTEGRATION_SUMMARY.md
│   ├── TAG_EXTRACTION_YOUTUBE_MARXIST.md
│   └── [other VG docs]
│
├── archived-sessions/                # Previous workspace snapshots
│   └── test-workspace-feb2026/       # Complete snapshot (4 GB)
│
├── guides/                           # User guides
└── operations/                       # Operational runbooks
```

**Key Documentation:**
- CLAUDE.md (server-level guidance) - 70+ KB
- Project-specific CLAUDE.md files
- Architecture and deployment documentation
- Complete operational runbooks

---

### O. Archived Sessions & Workspace Backups

**Location:** `/home/user/docs/archived-sessions/`
**Type:** Complete workspace snapshots
**Status:** 📦 Archive
**Total Size:** 4 GB

**Contents:**
- `test-workspace-feb2026/` - Complete workspace snapshot with all projects, versions, and documentation from February 2026

---

### P. Frontend Directory (Migration Scripts)

**Location:** `/home/user/frontend/`
**Type:** Website installation/migration scripts
**Status:** 📦 Minimal (orphaned)
**Size:** < 100 MB
**Purpose:** Website migration and installation scripts

---

## VI. BUILD ARTIFACTS DIRECTORY

### Q. Build Artifacts

**Location:** `/data/builds/`
**Type:** Compiled game builds
**Status:** 📦 Archive
**Total Size:** 180 KB (metadata) + compressed archives in project dirs

**Organized by Game:**
```
builds/
├── noxii-legacy/                     # 28 NOXII-Legacy versions
├── noxii/                            # 4 NOXII versions
└── enact/                            # 9 ENACT versions
```

**Purpose:** Centralized reference to all compiled game builds (actual archives stored in project directories).

---

## VII. REFERENCE TOOLS & ARCHIVES

### R. Repository Archive (Development Tools)

**Location:** `/home/user/repository/`
**Type:** Development tools and reference materials
**Status:** 📦 Reference (5.6 GB)
**Last Updated:** November 14, 2025

**Contents:**
- AI/ML frameworks and tools (3.4 GB)
- Development tools (claude-code, notebooks, etc.)
- Web development frameworks
- Documentation and examples
- Language-specific tools

**See:** `/home/user/docs/server/REPOSITORY_ARCHITECTURE.md` for detailed breakdown

---

### S. Archives Directory (General Reference)

**Location:** `/home/user/archives/`
**Type:** General reference materials
**Status:** 📦 Reference
**Total Size:** 16 GB

**Contains:**
- AI/ML training data and reference materials
- Learning resources
- Game development tools
- Entertainment and media tools
- Hardware documentation

---

## SUMMARY TABLE

| # | Project | Location | Type | Status | Size | Git? | Last Modified |
|---|---------|----------|------|--------|------|------|----------------|
| A | VG Server Config | `/home/user/` | Git Repo | ✅ Active | 420 MB | Yes | Feb 28, 2026 |
| B | VG Site (Next.js) | `/home/user/projects/veritable-games/site/` | Web App | ✅ Active | 3.3 GB | Yes | Feb 24, 2026 |
| C | VG Resources | `/home/user/projects/veritable-games/resources/` | Data | ✅ Active | 102 GB | No | Ongoing |
| D | BTCPayServer | `/home/user/btcpayserver-docker/` | Infra | ✅ Active | 2.6 MB | Yes | Feb 23, 2026 |
| E | X402 Integration | `/home/user/docs/x402-payment-integration/` | TypeScript | 🔧 Dev | 903 MB | No | Feb 20, 2026 |
| F | NOXII-Legacy | `/data/projects/NOXII-LEGACY/` | Godot (28v) | 📦 Archive | 29 GB | No | Dec 27, 2025 |
| G | NOXII | `/data/projects/NOXII/` | Godot (4v) | 📦 Archive | 5.9 GB | No | Oct 11, 2025 |
| H | ENACT | `/data/projects/ENACT/` | Godot (9v) | 📦 Archive | 16 GB | No | Dec 27, 2025 |
| I | DODEC | `/data/unity-projects/DODEC/` | Unity (7yr) | 📦 Archive | **499 GB** | No | Sep 12, 2025 |
| J | Company Site | `/data/company-site/` | Website (60v) | 📦 Archive | 66 GB | No | Various |
| K | VG Archives | `/data/archives/veritable-games/` | Data | 📦 Archive | 122 GB | No | Various |
| L | DB Snapshots | `/data/archives/database-snapshots/` | Backups | 📦 Archive | 2.2 GB | No | Various |
| M | Server Backups | `/data/archives/server-backups/` | Backups | 📦 Archive | 503 MB | No | Various |
| N | Documentation | `/home/user/docs/` | Docs | ✅ Active | 6 GB | No | Feb 23, 2026 |
| O | Archived Sessions | `/home/user/docs/archived-sessions/` | Snapshots | 📦 Archive | 4 GB | No | Feb 2026 |
| P | Frontend Scripts | `/home/user/frontend/` | Scripts | 📦 Minimal | <100 MB | No | Feb 16, 2026 |
| Q | Build Artifacts | `/data/builds/` | Builds | 📦 Archive | 180 KB | No | Various |
| R | Repository Tools | `/home/user/repository/` | Tools | 📦 Reference | 5.6 GB | No | Nov 14, 2025 |
| S | Archives | `/home/user/archives/` | Reference | 📦 Reference | 16 GB | No | Various |

---

## VIII. STORAGE BREAKDOWN

### By Location

```
/home/user/                          ~140 GB
├── CLAUDE.md & documentation
├── projects/veritable-games/        ~105 GB
│   ├── site/                        3.3 GB
│   └── resources/                   102 GB
├── docs/                            6 GB
├── repository/                      5.6 GB
├── archives/                        16 GB
└── other                            ~4 GB

/data/                               ~960 GB
├── projects/                        ~51 GB
│   ├── NOXII-LEGACY/               29 GB
│   ├── NOXII/                      5.9 GB
│   └── ENACT/                      16 GB
│
├── unity-projects/                  ~499 GB
│   └── DODEC/                      499 GB
│
├── company-site/                    66 GB
└── archives/                        ~344 GB
    ├── veritable-games/            122 GB
    ├── database-snapshots/         2.2 GB
    └── server-backups/             503 MB

TOTAL: ~1.1 TB
```

### By Project Type

| Type | Count | Size | Status |
|------|-------|------|--------|
| Active Git Repos | 3 | 3.9 GB | ✅ In Use |
| Active Data/Resources | 2 | 103 GB | ✅ In Use |
| Godot Game Projects | 3 | 51 GB | 📦 Archive |
| Unity Game Projects | 1 | 499 GB | 📦 Archive |
| Website Versions | 1 | 66 GB | 📦 Archive |
| Archives & Backups | 4 | 344 GB | 📦 Archive |
| Reference Tools | 2 | 22 GB | 📦 Reference |
| Documentation | 2 | 10 GB | ✅ Active |
| Misc/Scripts | 2 | < 1 GB | 📦 Archive |
| **TOTAL** | **18** | **~1.1 TB** | |

---

## IX. CRITICAL NOTES

### For Future Documentation Updates

1. **DODEC Unity Project (499 GB)** - Largest single component, requires careful management
2. **Game Projects Not in Git** - All Godot and Unity projects are archived, not version-controlled
3. **Website Versions** - 60+ historical website versions preserved in `/data/company-site/`
4. **Data Volume Growing** - Veritable Games resources at 102 GB and growing with each archive import
5. **Archives for Disaster Recovery** - Multiple backup locations and database snapshots available

### Backup & Recovery

- All active code (A-E) is in Git or backed up
- All archives have backup copies in `/data/archives/`
- Database snapshots available for major feature milestones
- Server configuration backed up in `/data/archives/server-backups/`

### Next Review

Next comprehensive inventory update should note:
- New game versions or releases
- Website version count (already 60+)
- Archive growth (especially DODEC)
- New projects or migrations

---

## X. SEE ALSO

- **[/home/user/CLAUDE.md](/home/user/CLAUDE.md)** - Server-level guidance
- **[/home/user/projects/veritable-games/site/CLAUDE.md](/home/user/projects/veritable-games/site/CLAUDE.md)** - Project development guide
- **[/home/user/docs/server/DRIVE_ARCHITECTURE.md](/home/user/docs/server/DRIVE_ARCHITECTURE.md)** - Physical drive setup
- **[/home/user/docs/server/REPOSITORY_ARCHITECTURE.md](/home/user/docs/server/REPOSITORY_ARCHITECTURE.md)** - Development tools
- **[/home/user/docs/README.md](/home/user/docs/README.md)** - Complete documentation index

---

**Last Updated:** March 1, 2026
**Next Review:** Quarterly (June 2026)
**Maintained By:** Claude Code Agent System
