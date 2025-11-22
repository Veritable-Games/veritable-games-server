# Veritable Games Project Resources

Project-specific resources for the Veritable Games radical literature platform.

**Main Repository:** `/home/user/projects/veritable-games/site/`
**Production URL:** https://www.veritablegames.com
**Documentation:** `/home/user/docs/veritable-games/`

## Directory Structure

```
veritable-games/
├── data/               # Literature archives (4.9GB - updated Nov 2025)
│   ├── converted-markdown/  # 24,643 anarchist texts (1.3GB)
│   ├── library/             # 4,409 curated articles (571MB) ⭐ NEW
│   ├── transcripts/         # 65,386 YouTube transcripts (1.2GB) ⭐ NEW
│   ├── processing/          # Format conversion workspace (1.7GB)
│   └── scraping/            # Marxists.org scraper (236MB)
├── processing/         # Content processing area
│   └── unconverted-pdfs/    # 211 PDFs + converter script (2.6GB) ⭐ NEW
├── scripts/            # Python import scripts
├── sql/                # Database migrations
├── logs/               # Script execution logs
├── docker-compose.yml  # Local PostgreSQL setup
└── README.md           # This file
```

## Data Directory (4.9GB - Updated November 2025)

### converted-markdown/
**24,643 anarchist texts** across 27 languages with YAML frontmatter:
- anarchist_library_texts/ (English - largest collection)
- anarchist_library_texts_{lang}/ (26 other languages)

**Format:** Markdown with YAML frontmatter including title, author, date, topics, language, source_url

### library/ ⭐ NEW (November 2025)
**4,409 curated articles** across multiple topics:
- Political Theory, Fiction, Architecture, Education, Technology
- Economics, Environment, History, Art, Psychology, Reference
- Markdown format with category prefixes
- `tracking.csv` - 5,478 entries with metadata

**Migration:** November 14, 2025 from INDEX.tar.xz

### transcripts/ ⭐ NEW (November 2025)
**65,386 YouTube video transcripts** from 499 channels:
- Urbanism (Not Just Bikes, RMTransit, Adam Something)
- Tech/AI (Two Minute Papers, AI and Games)
- Politics (Andrewism, Alexandria Ocasio-Cortez, Alice Cappelle)
- Plus 490+ additional channels

**Format:** Markdown transcripts organized by channel
**Migration:** November 14, 2025 from MEDIA.tar.xz

### processing/
Format conversion tools and workspace:
- `anarchist-library/` - .muse to Markdown converter
- ZIP archives of source texts in 27 languages

### scraping/
**Marxists.org scraper** (currently running):
- `scrape_marxists_org.py` - Main scraper script
- `marxists_org_texts/` - Downloaded content (currently ~6,584 files, targeting 12,735)
- `scrape.log` - Current scraping progress
- `marxists_org_urls_progress.json` - Resume capability

**Status:** Active (check with `ps aux | grep scrape_marxists_org`)

## Processing Directory

### unconverted-pdfs/ ⭐ NEW (November 2025)
**211 PDF files** awaiting conversion to markdown:
- `batch_pdf_converter.sh` - Automated PDF → Markdown converter
- Converts PDFs with image extraction
- Outputs to Collections/ directory with conversion log

**Usage:**
```bash
cd /home/user/projects/veritable-games/resources/processing/unconverted-pdfs
./batch_pdf_converter.sh
```

**Migration:** November 14, 2025 from UNCONVERTED.tar.xz

## Scripts Directory

Python import and extraction scripts:
- `extract_and_import_anarchist_tags.py` - Tag extraction (4-tier hybrid strategy)
- `import_anarchist_documents_postgres.py` - Document import to PostgreSQL
- `simple_import.py` - Simplified import version
- `import_docs.sh` - Shell wrapper

**Usage:**
```bash
cd /home/user/projects/veritable-games/scripts
python3 import_anarchist_documents_postgres.py ../data/converted-markdown
```

## SQL Directory

Database schema migrations:
- `002-create-anarchist-schema.sql` - Anarchist schema creation
- `create_anarchist_tables.sql` - Table definitions

**Apply migrations:**
```bash
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games \
  < /home/user/projects/veritable-games/sql/002-create-anarchist-schema.sql
```

## Logs Directory

Execution logs from Python scripts:
- `tag_import.log` - Tag extraction logs
- `import.log` - Document import logs
- `extract.pid` - Process ID tracking
- `tag_import.pid` - Tag import process tracking

## Docker Compose

Local PostgreSQL development environment:
- PostgreSQL 15 Alpine container
- pgAdmin 4 interface
- Volume mounts for data persistence

**Usage:**
```bash
cd /home/user/projects/veritable-games
docker-compose up -d
```

Access pgAdmin: http://localhost:5050

## Database Schema

**Production database:** `veritable_games` on container `veritable-games-postgres`

**Schemas:**
- `anarchist` - Political literature archive (documents, document_tags)
- `shared` - Unified tag system (tags table with 19,952 tags)

**Tag System:**
- 194,664 tag associations for anarchist documents
- Automatic usage_count maintenance via triggers

## Common Operations

### Import New Literature
```bash
cd /home/user/projects/veritable-games
python3 scripts/import_anarchist_documents_postgres.py data/converted-markdown
```

### Check Scraper Status
```bash
ps aux | grep scrape_marxists_org
tail -f /home/user/projects/veritable-games/data/scraping/marxists-org/scrape.log
```

### Database Queries
```bash
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Check document count
SELECT COUNT(*) FROM anarchist.documents;

# Check tag count
SELECT COUNT(*) FROM shared.tags;
```

## Collection Statistics (November 2025)

### Total Content
- **Anarchist texts:** 24,643
- **Library articles:** 4,409
- **Video transcripts:** 65,386
- **Marxist texts:** ~6,584 (growing to 12,735)
- **PDFs to convert:** 211
- **Total items:** ~101,000+ pieces of content

### Storage
- **Anarchist:** 1.3GB
- **Library:** 571MB
- **Transcripts:** 1.2GB
- **Processing:** 1.7GB
- **Marxist scraper:** 236MB
- **Total:** 4.9GB

## See Also

- **Main repo:** `/home/user/projects/veritable-games/site/`
- **Content Collections Guide:** `/home/user/docs/veritable-games/CONTENT_COLLECTIONS.md` ⭐ NEW
- **Documentation:** `/home/user/docs/veritable-games/`
- **Server docs:** `/home/user/docs/server/`
- **Reference:** `/home/user/docs/reference/`
