# Database Architecture

Complete documentation for the database layer, including schema, known issues, and cleanup procedures.

## Overview

The application uses PostgreSQL 15 with 8 specialized schemas with strict isolation. The database adapter (`/lib/database/adapter.ts`) handles all connections with automatic schema routing and connection pooling.

## Schema Names for dbAdapter.query()

- `forums` - Forum topics, replies, categories, forum_search_fts
- `wiki` - Wiki pages, revisions, categories, wiki_search
- `users` - User profiles, settings (NOT authentication - that's in auth schema)
- `system` - System configuration, settings, feature_flags
- `content` - Content management (news, projects, team_members, workspaces, project_revisions)
- `library` - Documents, annotations, tags, library_search_fts
- `auth` - Sessions, tokens, authentication data (NO user profiles)
- `messaging` - Private messages, conversations

**Note**: PostgreSQL schemas provide logical separation within a single database. Content schema includes workspace/canvas tables.

## Schema Table

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| forums | Forum system | categories, topics, replies, forum_search_fts |
| wiki | Wiki content | wiki_pages, wiki_revisions, wiki_search |
| users | User management | users, profiles, settings |
| system | Configuration | settings, feature_flags, resource_usage |
| content | CMS content | news, projects, team_members, workspaces, project_revisions, godot_* |
| library | Documents | library_documents, library_search_fts, library_categories |
| auth | Authentication | sessions, tokens |
| messaging | Messages | messages, conversations |

## Full-Text Search

Forums and Library schemas use PostgreSQL text search with automatic triggers to keep search indexes in sync.

**Configuration:**
- Search language: English with stemming
- Automatic index sync via database triggers
- GIN indexes for performance

**Performance:**
- Full-text queries: 5-30ms
- LIKE fallback: 50-200ms
- 10x performance improvement with full-text search

## Foreign Keys

Foreign key constraints are enforced across all schemas. Cross-schema references are avoided for maintainability.

## Database Adapter Details

- **Connection pooling**: Managed by PostgreSQL connection pool
- **Automatic schema selection**: Use `{ schema: 'schemaName' }` parameter
- **Query parameterization**: Prevents SQL injection
- **Transaction support**: Use dbAdapter.transaction() for multi-query operations
- **Build-time mock**: Returns mocks during Next.js builds

## ⚠️ Schema Isolation & Data Placement

### Schema Boundaries

Each schema has strict boundaries with no cross-schema JOINs allowed:

- **Forums**: Forum discussions only (categories, topics, replies)
- **Wiki**: Wiki content only (pages, revisions, search)
- **Content**: Projects, news, workspaces, Godot console data
- **Users**: User profiles and settings (NOT authentication)
- **Auth**: Sessions and tokens ONLY (NO user profiles)
- **Library**: Document library with annotations
- **Messaging**: Private messages between users
- **System**: Configuration, feature flags, resource monitoring

### Critical Data Placement Rules

- **User Profiles**: ALWAYS in `users` schema (users.users table)
- **Authentication**: ALWAYS in `auth` schema (auth.sessions table)
- **Resource Logs**: ALWAYS in `system` schema (system.resource_usage table)
- **Workspaces**: ALWAYS in `content` schema (content.workspaces table)
- **Project Revisions**: ALWAYS in `content` schema (content.project_revisions table)

### Cross-Schema Data Access

Use `ProfileAggregatorService` for aggregating data across schemas. Direct cross-schema JOINs are prohibited for maintainability and clear boundaries.

## Current Source of Truth (PostgreSQL Migration)

- **Projects**: `content` schema (content.projects table)
- **Project Revisions**: `content` schema (content.project_revisions table - standalone system)
- **Wiki Content**: `wiki` schema (wiki.wiki_pages, wiki.wiki_revisions)
- **Forums**: `forums` schema (forums.categories, forums.topics, forums.replies)
- **Users**: `users` schema (users.users) and `auth` schema (auth.sessions - split authentication vs profile data)
- **Library**: `library` schema (library.library_documents)
- **Workspaces**: `content` schema (content.workspaces, content.workspace_nodes)
- **Godot Console**: `content` schema (content.godot_* tables)

## Migration History

- **January 2026**: Migrated from SQLite to PostgreSQL 15 with schema-based architecture
- **October 2025**: Projects decoupled from wiki, moved to standalone content schema
- **October 2025**: Original content migrated from legacy main.db (8 projects, 206 KB total)
- **October 2025**: Project revision system created in content schema with trigger-based content updates

## Service Architecture

All services use `dbAdapter.query(sql, params, { schema: 'schemaName' })` for database access:

- **ProfileAggregatorService** (`/lib/profiles/aggregator-service.ts`): Cross-schema data aggregation
- **ForumService** (`/lib/forums/service.ts`): Forum operations (topics, replies, categories)
- **WikiService** (`/lib/wiki/service.ts`): Wiki page management and revisions
- **LibraryService** (`/lib/library/service.ts`): Document management with annotations
- **AuthService** (`/lib/auth/service.ts`): Authentication and session management
- **MessagingService** (`/lib/messaging/service.ts`): Private messaging between users
- **WorkspaceService** (`/lib/workspace/service.ts`): Workspace/canvas management

## Critical Rules

1. **ALWAYS use dbAdapter.query()** - Never create Database instances directly
2. **No cross-schema JOINs** - Architectural decision for maintainability, use ProfileAggregatorService instead
3. **Prepared statements only** - Prevent SQL injection, no string concatenation
4. **Schema parameter required** - Always specify `{ schema: 'schemaName' }` in query options
5. **Foreign keys enforced** - PostgreSQL enforces referential integrity within schemas

## Database Access Pattern

```typescript
// ✅ CORRECT - Use dbAdapter with schema parameter
import { dbAdapter } from '@/lib/database/adapter';

const result = await dbAdapter.query(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { schema: 'users' }
);
const user = result.rows[0];

// ❌ WRONG - NEVER create Database instances directly
import Database from 'better-sqlite3';
const db = new Database('path/to/db'); // Causes connection leaks!
```

## Why This Matters

- Creating Database instances directly causes **connection leaks** and **performance issues**
- The dbAdapter manages PostgreSQL connections and handles schema routing
- The dbAdapter automatically parameterizes queries to prevent SQL injection
- Build-time mocking is handled automatically by the adapter

## Commands

See [Commands Reference](.claude/commands.md) for all database-related npm scripts:
- `npm run db:health` - Check database health
- `npm run db:backup` - Backup all databases
- `npm run db:migrate` - Run migrations
- `npm run forums:ensure` - Initialize forum tables
