# Scripts Directory

**Comprehensive Database Administration Toolkit** for the Veritable Games wiki and content system. All scripts require access to the SQLite database at `./data/forums.db`.

## Directory Structure

### **Core Database Operations**

- **`/analysis/`** - Wiki content analysis and verification scripts
- **`/create/`** - Content creation scripts for wiki pages
- **`/data-import/`** - Import external documents into wiki database
- **`/debug/`** - Debugging utilities for wiki and database issues
- **`/fixes/`** - Scripts to fix wiki content, links, and formatting
- **`/migration/`** - Database migration and content migration scripts
- **`/misc/`** - Miscellaneous database-dependent utilities
- **`/wiki-management/`** - Wiki administration and maintenance scripts (consolidated)

### **Administration & Testing**

- **`/forum-admin/`** - Forum administration and audit scripts (consolidated from utility-scripts)
- **`/testing/`** - **Comprehensive testing framework** - Organized testing, validation, debugging, and health check scripts
  - `/health/` - System health and monitoring scripts
  - `/security/` - Security testing and validation
  - `/integration/` - API and system integration tests
  - `/validation/` - Data validation and schema checks
  - `/debug/` - Debugging utilities and diagnostic scripts
  - `/data/` - Domain-specific validation (wiki, library, forums)
  - `/automation/` - Test data creation and automation tools
  - `/performance/` - Performance testing and benchmarking
- **`/shell/`** - Shell scripts for build and maintenance tasks
- **`/output/`** - Generated analysis files and reports

## Major Reorganization (2025-08-27)

**Consolidated from utility-scripts:**

- Forum management scripts → `/forum-admin/`
- Wiki management scripts → `/wiki-management/` (merged)
- Analysis outputs → `/output/`
- Testing files → `/tests/` (merged)
- Shell scripts → `/shell/`
- Empty utility-scripts directory removed

**Config files relocated to project root:**

- `next.config.optimized.js`, `tailwind.config.optimized.js`, `jest.config.optimized.js`, `jest.setup.optimized.js`

**Pure file processors moved to utilities:**

- Document comparison scripts → `/utilities/document-processing/`

## Usage

All scripts run from the frontend directory root:

```bash
# Database operations
node scripts/wiki-management/update-wiki-pages.js
node scripts/forum-admin/audit-forum-data.js
node scripts/analysis/analyze-wiki-links.js

# Shell scripts
./scripts/shell/fix-typescript-errors.sh
```

## Key Features

- **240+ specialized scripts** for content management
- **Database-first design** - all operations use SQLite
- **Consolidated functionality** - no duplicate tools
- **Organized by purpose** - clear separation of concerns
- **Output management** - generated files in dedicated directory

## Important Notes

- **Database Dependency**: All scripts require `./data/forums.db` access
- **Working Directory**: Run from frontend root directory
- **Backup First**: Always backup database before running migration/fix scripts
- **Test Environment**: Scripts designed for development/maintenance use
- **Analysis Results**: Check `/output/` directory for generated reports
