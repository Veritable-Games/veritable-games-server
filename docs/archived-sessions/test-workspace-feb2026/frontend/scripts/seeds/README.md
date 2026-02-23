# Database Seed Scripts

This directory contains schema definitions and seed data for initializing the
Veritable Games database system.

## Directory Structure

```
seeds/
├── schemas/          # Database schemas (DDL)
│   ├── auth.sql      # Authentication & sessions
│   ├── forums.sql    # Forum discussions
│   ├── wiki.sql      # Wiki pages & revisions
│   ├── users.sql     # User profiles
│   ├── content.sql   # Projects, news, workspaces
│   ├── library.sql   # Documents & annotations
│   ├── messaging.sql # Private messages
│   ├── system.sql    # System configuration
│   ├── cache.sql     # Application cache
│   └── main.sql      # Legacy (archive)
│
└── data/             # Seed data (DML)
    ├── admin-user.sql         # Default admin account
    ├── system-settings.sql    # System configuration
    └── forum-structure.sql    # Default forum sections/categories
```

## Database Overview

**Total: 10 databases, 195 tables**

| Database     | Tables | Purpose                               |
| ------------ | ------ | ------------------------------------- |
| auth.db      | 10     | Sessions, tokens, invitations         |
| forums.db    | 10     | Forum topics, replies, search         |
| wiki.db      | 33     | Wiki pages, revisions, categories     |
| users.db     | 12     | User profiles, settings               |
| content.db   | 32     | Projects, news, workspaces, galleries |
| library.db   | 9      | Documents, annotations, tags          |
| messaging.db | 4      | Private messaging                     |
| system.db    | 19     | Settings, feature flags, logs         |
| cache.db     | 8      | Application caching                   |
| main.db      | 58     | Legacy archive (DO NOT USE)           |

## Usage

### Initialize All Databases

Creates all databases from schemas and applies seed data:

```bash
npm run db:init
```

### Force Recreate

Deletes existing databases and recreates from scratch:

```bash
npm run db:init -- --force
```

**⚠️ WARNING**: `--force` will delete all existing data!

### Verify Initialization

Check database health after initialization:

```bash
npm run db:health
```

## What Gets Seeded

### Minimal Seed Data

The initialization script applies **minimal seed data** only:

1. **Admin User** (`admin-user.sql`)
   - Username: `admin`
   - Email: `admin@veritablegames.com`
   - Password: (set from existing database)
   - Role: admin

2. **System Settings** (`system-settings.sql`)
   - Registration enabled/disabled
   - Site configuration
   - Feature flags

3. **Forum Structure** (`forum-structure.sql`)
   - 5 default sections
   - 7 default categories
   - No topics or replies

### What's NOT Seeded

- User-generated content (topics, replies, wiki pages)
- Uploaded files or images
- Historical data
- User profiles (except admin)
- Session data

## Schema Export

Schemas are exported from production databases using:

```bash
node scripts/export-schemas.js
```

This generates SQL files in `seeds/schemas/` with:

- Table definitions
- Indexes
- Triggers
- Views
- Foreign key constraints

## Seed Data Export

Seed data is exported using:

```bash
node scripts/export-seed-data.js
```

This extracts:

- Admin user credentials
- System configuration
- Default forum structure
- Feature flags

## PostgreSQL Migration

These SQLite schemas will be converted to PostgreSQL in Phase 4.

### Key Differences to Handle

| SQLite                              | PostgreSQL           |
| ----------------------------------- | -------------------- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `DATETIME`                          | `TIMESTAMP`          |
| `TEXT`                              | `VARCHAR` / `TEXT`   |
| `CURRENT_TIMESTAMP`                 | `NOW()`              |
| No schemas                          | Multiple schemas     |

### Migration Strategy

1. **Schema Conversion** (Week 1-2)
   - Convert SQL syntax
   - Add schemas (auth, forums, wiki, etc.)
   - Handle type differences

2. **Connection Pool** (Week 2)
   - Replace better-sqlite3 with node-postgres
   - Implement connection pooling
   - Update dbPool interface

3. **Data Migration** (Week 3)
   - Export data from SQLite
   - Transform to PostgreSQL format
   - Import with validation

4. **Testing** (Week 4)
   - Test all 100+ API routes
   - Verify data integrity
   - Performance benchmarking

## Maintenance

### Updating Schemas

When database schemas change:

1. Run export script:

   ```bash
   node scripts/export-schemas.js
   ```

2. Commit updated schema files
3. Team members run `npm run db:init --force` to update

### Adding New Seed Data

1. Create new SQL file in `seeds/data/`
2. Update `init-databases.js` to include it
3. Test with `npm run db:init --force`

## Troubleshooting

### "Database already exists"

Use `--force` to recreate:

```bash
npm run db:init -- --force
```

### "Schema file not found"

Ensure schemas were exported:

```bash
ls -l scripts/seeds/schemas/
```

Should show 10 .sql files.

### "Seed data failed"

Check seed file syntax:

```bash
node -e "require('fs').readFileSync('scripts/seeds/data/admin-user.sql', 'utf8')"
```

### Tables missing after initialization

Verify schema file contains all tables:

```bash
grep "CREATE TABLE" scripts/seeds/schemas/forums.sql | wc -l
```

## Development Workflow

### New Developer Setup

```bash
# 1. Clone repository
git clone https://github.com/Veritable-Games/veritable-games-site.git
cd veritable-games-site/frontend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local

# 4. Generate secrets
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY

# 5. Initialize databases
npm run db:init

# 6. Verify health
npm run db:health

# 7. Start development server
npm run dev
```

### Resetting Development Environment

```bash
# Backup important data first!
npm run db:backup

# Reset all databases
npm run db:init -- --force

# Restart server
npm run dev
```

## Git Workflow

**Databases are NO LONGER tracked in git.**

- ✅ **Tracked**: Schema files (`*.sql` in `seeds/`)
- ❌ **Ignored**: Database files (`*.db`)
- ✅ **Tracked**: Seed data SQL
- ❌ **Ignored**: Backups, WAL files

This ensures:

- Smaller repository size
- No merge conflicts on database files
- Clean separation of code vs. data
- Easy reset to known state

## Security Notes

### Admin User

The seed admin user should have its password changed immediately after
initialization:

```bash
# Login as admin
# Navigate to /settings/security
# Change password
```

### Seed Passwords

**Never commit production passwords to seed files.**

Seed files should use:

- Placeholder passwords (to be changed)
- Environment variable references
- Secure generation on first run

### Sensitive Data

Do not include in seed files:

- Real user emails
- API keys
- Private tokens
- Production credentials

## Future: PostgreSQL Seeds

When migrating to PostgreSQL, these files will be converted to:

```
seeds/
├── postgresql/
│   ├── schemas/
│   │   ├── 01_auth_schema.sql
│   │   ├── 02_forums_schema.sql
│   │   └── ...
│   ├── data/
│   │   ├── 01_admin_user.sql
│   │   └── ...
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── ...
└── sqlite/  (archived)
```

---

**Generated**: October 28, 2025 **Last Updated**: Phase 3 - Git Configuration &
Repository Cleanup
