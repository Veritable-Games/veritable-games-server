# Architecture Reference

## Hybrid Storage Model

- **Metadata** stored in PostgreSQL for fast search/filtering
- **Content** stored as Markdown files on filesystem (Docker volumes)
- PostgreSQL `file_path` field references content location
- Avoids DB bloat while maintaining query performance

## Schema Organization

### public schema
Main Veritable Games application tables

### anarchist schema
Separate schema for political literature archive
- `anarchist.documents` table with metadata + file_path reference
- Clean separation prevents naming conflicts

### shared schema
Unified resources shared across multiple collections (Nov 2025)
- `shared.tags` - Unified tag system for both User Library and Anarchist Library
- Automatic usage_count maintenance via database triggers
- Prevents tag duplication across collections

### Other schemas
- `auth` - Authentication and user management
- `wiki` - Wiki pages and revisions
- `library` - User library documents
- `forums` - Forum posts and discussions

## Database Migration Strategy

The project transitioned from SQLite to PostgreSQL:

1. **SQLite** - Local development databases (auth.db, wiki.db, forums.db, library.db, etc.)
2. **Dual-write mode** - Validation phase (configurable via DATABASE_MODE env var)
3. **PostgreSQL** - Production target with performance tuning

### Environment Configuration

Key database environment variables (see .env.example):
- `DATABASE_MODE` - Options: "sqlite", "postgres", "dual-write"
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_URL` - Alternative PostgreSQL connection string
- Support for Neon, Supabase, Railway cloud providers
- Connection pooling for serverless deployments

### Current Production Setting
`DATABASE_MODE=postgres`

### Migration Scripts Available
- `migrate-schema-to-postgres.js` - Migrate SQLite → PostgreSQL
- `migrate-data-to-postgres.js` - Migrate data between databases
- `verify-migration.js` - Validate migration completeness

## Data Pipeline Flow

### Anarchist Library (COMPLETED)
```
.muse archives
  → convert_anarchist_muse_to_markdown.py
  → Markdown + YAML frontmatter
  → import_anarchist_documents_postgres.py
  → PostgreSQL
```

### Marxists.org (IN PROGRESS)
```
HTML pages
  → scrape_marxists_org.py (2-phase: URL discovery + download)
  → Markdown files
  → (import pending)
```

## Content Preservation

- Original source URLs preserved in metadata
- Multiple format support (.muse, HTML, Markdown)
- Language-aware organization (27 languages for Anarchist Library)
- Full-text search via PostgreSQL GIN indexes
- YAML frontmatter includes: title, author, date, topics, language, source_url

## Deployment Infrastructure

### Coolify
Self-hosted deployment platform
- Manages application containers and deployments
- Configures environment variables for production
- Handles automatic deployments via git commits
- Web interface at: http://192.168.1.15:8000

### Traefik
Reverse proxy and load balancer
- Routes traffic from domain to application containers
- Handles SSL/TLS termination
- Manages routing rules for multiple services

### Docker Containers

**Application:**
- Next.js app running in Node container
- Built with Nixpacks
- Container ID: `m4s0kwo4kc4oooocck4sswc4`

**PostgreSQL:**
- Two database containers (postgres:15-alpine)
  - `veritable-games-postgres` - Main database (port 5432 exposed)
  - `veritable-games-postgres-new` - Secondary/migration database

**Support Services:**
- `pgAdmin` - Database management UI (port 5050)
- Coolify Services: coolify, coolify-db, coolify-redis, coolify-realtime, coolify-proxy
