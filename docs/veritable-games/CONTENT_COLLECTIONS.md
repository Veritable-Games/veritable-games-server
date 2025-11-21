# Veritable Games Content Collections

**Last Updated:** November 14, 2025
**Migration Date:** November 14, 2025

## Overview

Veritable Games hosts multiple distinct content collections for radical literature and multimedia archival. This document describes all collections, their purposes, sizes, and organization.

---

## Content Collections

### 1. Anarchist Library (converted-markdown/)
**Location:** `/home/user/projects/veritable-games/resources/data/converted-markdown/`
**Size:** 1.3GB
**Files:** 24,643 texts

**Description:**
Complete anarchist library archive across 27 languages with YAML frontmatter metadata.

**Languages:**
- English (largest collection)
- Spanish, French, German, Polish, Portuguese
- Plus 21 additional languages

**Format:**
- Markdown with YAML frontmatter
- Title, author, date, topics, language, source_url metadata
- Organized by language subdirectories

**Status:** COMPLETE - Fully imported to PostgreSQL database

**Database Schema:** `anarchist.documents`, `anarchist.document_tags`

---

### 2. Marxist Archive (scraping/marxists-org/)
**Location:** `/home/user/projects/veritable-games/resources/data/scraping/marxists-org/`
**Size:** 236MB
**Files:** ~6,584 texts (targeting 12,735 total)

**Description:**
Marxists.org scraper collecting Marxist theoretical texts, historical documents, and reference materials.

**Status:** IN PROGRESS
- Scraper actively running
- Target: 12,735 total texts
- Currently: ~6,584 downloaded (52%)

**Contents:**
- Downloaded texts: `marxists_org_texts/`
- Scraper script: `scrape_marxists_org.py`
- Progress tracking: `marxists_org_urls_progress.json`
- Logs: `scrape.log`

**Database Schema:** TBD - Not yet imported

---

### 3. Library Collection (library/) ⭐ NEW
**Location:** `/home/user/projects/veritable-games/resources/data/library/`
**Size:** 571MB
**Files:** 4,409 markdown articles

**Description:**
Curated collection of traditional literature including political theory, fiction, architecture, education, technology, economics, environment, history, art, psychology, and reference materials.

**Migration:** November 14, 2025 from INDEX.tar.xz

**Categories (from filename prefixes):**
- `01_Political_Theory_` - Primary category (majority of content)
- `02_Game_` - Game design and theory
- `03_Research_` - Academic research papers
- `04_Education_` - Educational resources
- `05_Architecture_` - Urban planning and architecture
- `06_Technology_` - Technology and AI
- `07_Psychology_` - Psychology and emotion
- `08_Economics_` - Economic theory and social analysis
- `09_Environment_` - Environmental and ecological topics
- `10_Historical_` - Historical documents and analysis
- `11_Art_` - Art and culture
- `12_Reference_` - Reference materials
- `13_Fiction_` - Fiction books and storytelling

**Metadata:**
- `tracking.csv` - 5,478 entries
- Fields: Title, Author, Publication Date, Page Count, Topic, INDEX status, Image status, Source, Notes

**Format:**
- Markdown files with article/book content
- Converted from various sources (PDFs, web pages, etc.)
- Filenames include category prefix and descriptive title

**Status:** MIGRATED - Ready for import to database

**Database Schema:** TBD - To be determined (may use `library.documents` or merge with existing schemas)

---

### 4. Video Transcripts (transcripts/) ⭐ NEW
**Location:** `/home/user/projects/veritable-games/resources/data/transcripts/`
**Size:** 1.2GB
**Files:** 65,386 YouTube video transcripts

**Description:**
Massive archive of YouTube video transcripts from 499 channels covering urbanism, technology, politics, gaming, philosophy, and more.

**Migration:** November 14, 2025 from MEDIA.tar.xz

**Content Type:** DISTINCT from traditional literature
- Spoken-word content (not written articles)
- Conversational tone
- Multimedia context (references visual elements)
- YouTube-specific format

**Organization:**
- 499 channel folders
- Each video = 1 markdown file: `[VideoID].en.md`
- Metadata embedded in filenames and content

**Sample Channels:**
- **Urbanism:** Not Just Bikes, RMTransit, Adam Something, CityNerd
- **Tech/AI:** Two Minute Papers, AI and Games
- **Politics:** Andrewism, Alexandria Ocasio-Cortez, Alice Cappelle
- **Gaming:** Adam Millard - The Architect of Games
- **Philosophy:** Acid Horizon
- Plus 490+ additional channels

**Use Cases:**
- Searchable spoken content
- Video reference library
- Accessibility (text version of videos)
- Research and analysis of YouTube discourse
- Cross-referencing with literature

**Status:** MIGRATED - Ready for import to database

**Database Schema:** TBD - Should be separate from literature (distinct content type)
- Possible schema: `transcripts.videos` or `media.transcripts`
- Metadata: channel, video_id, title, upload_date, category

---

### 5. Unconverted PDFs (processing/unconverted-pdfs/) ⭐ NEW
**Location:** `/home/user/projects/veritable-games/resources/processing/unconverted-pdfs/`
**Size:** 2.6GB
**Files:** 211 PDF files + conversion script

**Description:**
Queue of PDF documents awaiting conversion to markdown format. These will eventually be added to the library collection once processed.

**Migration:** November 14, 2025 from UNCONVERTED.tar.xz

**Contents:**
- 211 PDF files (books, articles, pamphlets)
- `batch_pdf_converter.sh` - Automated PDF → Markdown converter

**Conversion Process:**
```bash
cd /home/user/projects/veritable-games/resources/processing/unconverted-pdfs
./batch_pdf_converter.sh
# Converts PDFs to markdown with images
# Outputs to Collections/ directory
# Creates conversion log
```

**Status:** READY FOR PROCESSING

**Next Steps:**
1. Run batch converter (requires `marker-pdf` or similar tool)
2. Review converted markdown
3. Add metadata and categorization
4. Move to library/ collection
5. Import to database

---

## Collection Statistics

### Total Content
- **Anarchist texts:** 24,643
- **Marxist texts:** ~6,584 (growing to 12,735)
- **Library articles:** 4,409
- **Video transcripts:** 65,386
- **PDFs to convert:** 211
- **Total items:** ~101,000+ pieces of content

### Storage
- **Anarchist:** 1.3GB
- **Marxist:** 236MB
- **Library:** 571MB
- **Transcripts:** 1.2GB
- **Processing:** 1.7GB (mostly unconverted PDFs)
- **Total:** 4.9GB

### Growth Projections
- **Marxist archive:** +6,151 texts when scraper completes (+~120MB)
- **Unconverted PDFs:** +211 articles when processed (+~100MB markdown)
- **Future collections:** Ongoing additions as new content is curated
- **Expected 1-year total:** ~6-7GB

---

## Database Import Strategy

### Completed
- ✅ Anarchist Library (24,643 texts)
  - Schema: `anarchist.documents`
  - Tags: `shared.tags`, `anarchist.document_tags`
  - Status: Fully searchable in production

### Pending
- ⏳ Marxist Archive (~6,584 texts, growing)
  - Proposed schema: `marxist.documents` or `library.documents`
  - Import when scraper completes or reaches critical mass

- ⏳ Library Collection (4,409 articles)
  - Proposed schema: `library.documents`
  - Unified tag system: `shared.tags`
  - Import priority: High (ready to go)

- ⏳ Video Transcripts (65,386 transcripts)
  - Proposed schema: `transcripts.videos` or `media.transcripts`
  - Separate from literature (different content type)
  - Import priority: Medium (requires schema design)

- ⏳ Unconverted PDFs (211 files)
  - Process → convert → add to library
  - Import priority: Low (requires processing first)

---

## Content Workflows

### Adding Traditional Literature (Books/Articles)
1. Convert to markdown (if PDF)
2. Add YAML frontmatter (title, author, date, topics)
3. Add to appropriate collection folder
4. Update tracking.csv
5. Import to PostgreSQL
6. Tag with unified tag system

### Adding Video Transcripts
1. Download transcript via YouTube API or web scraping
2. Format as markdown with metadata
3. Organize by channel
4. Add to `transcripts/` collection
5. Import to database with video metadata

### Processing Unconverted PDFs
1. Run `batch_pdf_converter.sh`
2. Review converted markdown
3. Add metadata and categorization
4. Move to `library/` collection
5. Follow traditional literature workflow

---

## Future Collections (Proposed)

### Images Library
- Purpose: Visual content from converted texts
- Format: Extracted images from PDFs
- Organization: By source document
- Status: Not yet implemented
- Note: IMAGES.tar.xz exists on external drive (2.7GB) but not migrated

### Audio/Podcasts
- Purpose: Podcast transcripts and audio archives
- Format: Similar to video transcripts
- Organization: By show/channel
- Status: Not yet implemented

### News/Articles
- Purpose: Current events and news articles
- Format: Markdown with publication metadata
- Organization: By date or source
- Status: Not yet implemented

---

## Maintenance

### Regular Tasks
- **Daily:** Monitor Marxist scraper progress
- **Weekly:** Review new additions to library
- **Monthly:** Process batch of unconverted PDFs
- **Quarterly:** Audit metadata quality and completeness

### Cleanup
- **Remove duplicates** across collections
- **Verify file integrity** (check for corrupted files)
- **Update metadata** (fill in missing fields in tracking.csv)
- **Optimize storage** (compress rarely-accessed content)

### Backups
- **Critical:** Anarchist library (complete, irreplaceable)
- **Important:** Library collection, transcripts
- **Moderate:** Marxist archive (can re-scrape if lost)
- **Low:** Unconverted PDFs (often available from original sources)

---

## Related Documentation

- **Main resources guide:** `/home/user/projects/veritable-games/resources/README.md`
- **Database schemas:** `/home/user/projects/veritable-games/site/docs/`
- **Tag system:** `/home/user/docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md`
- **Scraper docs:** `/home/user/projects/veritable-games/resources/data/scraping/marxists-org/MARXISTS_ORG_SCRAPER.md`

---

**Last Updated:** November 14, 2025
**Next Review:** December 2025
**Migration Status:** Complete
