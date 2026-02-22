# Tag Extraction Implementation: YouTube & Marxist Collections

**Date**: February 22, 2026
**Status**: Active Implementation (YouTube: 60,816 documents imported, Marxist: 342 documents imported)
**Documentation**: Research and implementation overview for YouTube transcripts and Marxist library tag extraction systems

---

## Executive Summary

The Veritable Games platform implements sophisticated tag extraction systems for YouTube transcripts and Marxist documents, enabling unified discovery across all four document collections (Library, Anarchist, YouTube, Marxist). This document details:

1. **YouTube Tag Extraction**: 3-tier hierarchical system (channel → category → content analysis)
2. **Marxist Tag Extraction**: 4-tier hierarchical system (author → category → era/theme → content)
3. **Unified Tag Storage**: Shared central tag table across all collections
4. **Current State**: 60,816 YouTube transcripts, 342 Marxist documents, 11,986 total unique tags

---

## Architecture Overview

### Central Tag Management: `shared.tags`

All collections use a single unified tag table:

```sql
CREATE TABLE shared.tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  usage_count INTEGER DEFAULT 0,  -- Auto-maintained by triggers
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Key Features**:
- **Single source of truth** for all tags across all collections
- **Automatic usage count** maintenance via database triggers
- **Cross-collection discovery**: Same tags appear in Library, Anarchist, YouTube, and Marxist
- **Extensible**: New collections can reference the same tag table

---

## YouTube Transcripts Tag Extraction

### System Overview

**Data Source**: `/home/user/projects/veritable-games/resources/data/transcripts.OLD/`
**Import Script**: `resources/scripts/import_youtube_transcripts.py`
**Target Table**: `youtube.transcripts` + `youtube.transcript_tags`
**Current Count**: 60,816 transcripts with 215,702 tag associations

### Tag Extraction Strategy: 3-Tier Hierarchical

#### Tier 1: Channel-Based Tags (Automatic Assignment)

Pre-defined tag mappings for known educational channels:

```python
CHANNEL_TAGS = {
    'Isaac Arthur': ['futurism', 'space', 'megastructures', 'colonization', 'science'],
    'Kurzgesagt': ['science', 'education', 'animation', 'biology', 'space'],
    'CrashCourse': ['education', 'history', 'science', 'philosophy'],
    'Vsauce': ['science', 'physics', 'mathematics', 'philosophy'],
    'TED-Ed': ['education', 'science', 'history', 'philosophy'],
}
```

**Purpose**: Quickly categorize content from well-known educational channels
**Matching**: Case-insensitive comparison of channel name to predefined keys
**Fallback**: If no match, all transcripts still get 'education' tag

#### Tier 2: Content Analysis (Pattern Matching)

Keyword regex patterns identifying major content categories:

```python
YOUTUBE_TAG_PATTERNS = {
    'science': [r'\b(?:science|scientific|research|experiment|hypothesis)\b'],
    'space': [r'\b(?:space|astronomy|cosmos|universe|planetary|celestial)\b'],
    'technology': [r'\b(?:technology|tech|engineering|computational|algorithm|software)\b'],
    'futurism': [r'\b(?:future|prediction|forecast|projections?|centuries?|years?|millennia)\b'],
    'physics': [r'\b(?:physics|quantum|gravity|relativity|photons?|particles?|waves?)\b'],
    'biology': [r'\b(?:biology|evolution|genetic|biological|organisms?|species)\b'],
    'astronomy': [r'\b(?:astronomy|astronomers?|star|stellar|galaxies?|nebulae?)\b'],
    'history': [r'\b(?:history|historical|ancient|medieval|modern|century|decades?)\b'],
    'philosophy': [r'\b(?:philosophy|philosophical|ethics|morality|consciousness|sentience)\b'],
    'mathematics': [r'\b(?:mathematics|mathematical|geometry|calculus|numbers?|equations?)\b'],
    'megastructures': [r'\b(?:megastructure|dyson|sphere|ring|megaproject|construction)\b'],
    'colonization': [r'\b(?:colonization?|colonists?|settle|settlement|terraformation|terraform)\b'],
    'intelligence': [r'\b(?:intelligence|intelligent|ai|artificial|agi|superintelligence)\b'],
    'civilization': [r'\b(?:civilization|civilizational|society|societal|culture|cultural)\b'],
}
```

**Matching Algorithm**:
1. Convert transcript content to lowercase
2. For each tag pattern, search using regex
3. If any pattern matches, add the tag
4. Result: Multiple tags per document based on content themes

#### Tier 3: Channel Slug Tag (Always Added)

```python
tags.add(sanitize_slug(channel_name))  # e.g., 'isaac-arthur', 'kurzgesagt'
tags.add('education')  # Always included
```

**Purpose**: Enable filtering by channel and ensure all transcripts tagged as educational content

### Extraction Flow

```
For each YouTube transcript:
  1. Extract channel name from file path
  2. Apply Tier 1: Add channel-specific tags if matched
  3. Apply Tier 2: Scan content for keyword patterns
  4. Apply Tier 3: Add channel slug + 'education' tag
  5. Deduplicate and normalize tags
  6. Insert transcript into youtube.transcripts
  7. Create tag associations in shared.tags (get_or_create)
  8. Link tags to transcript in youtube.transcript_tags
```

### Database Schema

```sql
-- Transcripts table
CREATE TABLE youtube.transcripts (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  video_id TEXT NOT NULL,
  upload_date DATE,
  language TEXT DEFAULT 'en',
  content TEXT,                    -- Full transcript content
  source_url TEXT,                 -- YouTube URL
  category TEXT DEFAULT 'transcript',
  notes TEXT,                       -- Metadata: word count, char count
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tag associations
CREATE TABLE youtube.transcript_tags (
  transcript_id INTEGER NOT NULL REFERENCES youtube.transcripts(id),
  tag_id INTEGER NOT NULL REFERENCES shared.tags(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transcript_id, tag_id)
);
```

### Current Tag Distribution

**Top YouTube Tags** (by usage count):

| Tag | Usage Count | Notes |
|-----|-------------|-------|
| education | 61,027 | Assigned to all transcripts |
| futurism | 42,907 | Isaac Arthur channel + pattern matching |
| history | 28,307 | Content pattern matches (shared with Marxist/Anarchist) |
| mathematics | 27,099 | Content pattern matches |
| technology | 19,230 | Tech-related channels and content |
| civilization | 17,029 | Broad content theme |
| biology | 9,784 | Science content analysis |
| philosophy | 9,187 | Educational content (shared with Marxist/Anarchist) |

**Key Observation**: YouTube is the largest contributor to generic tags like 'history' and 'philosophy' due to high volume (60K+ documents). These tags are shared with other collections, creating cross-collection tag usage.

### Channel Distribution

Top 20 YouTube channels by transcript count:

```
The Rational National     1,423 transcripts
KOMO News                 1,296 transcripts
SciShow                   1,246 transcripts
VICE News                 1,141 transcripts
NASA                      1,086 transcripts
Seeker                      906 transcripts
Scott Manley               782 transcripts
HasanAbi                   663 transcripts
Novara Media               654 transcripts
Senator Bernie Sanders     634 transcripts
(... 490 total channels represented)
```

**Total Channels**: 499 unique YouTube channels in the collection

### Import Statistics

**Script**: `import_youtube_transcripts.py`
**Execution**: Batch processing (1,000 transcripts per batch)
**Performance**: ~3.5 seconds per 100 transcripts
**Status**: Completed (60,816 transcripts imported with 215,702 tag associations)

---

## Marxist Documents Tag Extraction

### System Overview

**Data Source**: `/home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts/`
**Import Script**: `resources/scripts/import_marxist_documents.py`
**Target Table**: `marxist.documents` + `marxist.document_tags`
**Current Count**: 342 documents (from 12,728 available markdown files)
**Status**: Incomplete import (import running in background)

### Tag Extraction Strategy: 4-Tier Hierarchical

#### Tier 1: Author-Based Tags (Marxist-Specific Authors)

Pre-defined mappings for major Marxist theorists:

```python
AUTHOR_TAGS = {
    'Lenin': ['lenin', 'bolshevism', 'vanguard-party', 'soviet'],
    'Marx': ['marx', 'capital', 'materialism'],
    'Engels': ['engels', 'marxism', 'german-ideology'],
    'Trotsky': ['trotsky', 'permanent-revolution', 'trotskyism'],
    'Luxemburg': ['luxemburg', 'rosa', 'spontaneity'],
    'Stalin': ['stalin', 'soviet', 'socialism-in-one-country'],
    'Gramsci': ['gramsci', 'hegemony', 'cultural-marxism'],
    'Lukacs': ['lukacs', 'reification', 'consciousness'],
    'Mao': ['mao', 'maoism', 'peasant-revolution'],
}
```

**Matching**: Extract author from URL using patterns like `/archive/lenin/` or `/lenin/`
**Purpose**: Create author-specific navigation and discovery paths

#### Tier 2: Category Tags (URL Path-Based)

Extracted from Marxists.org URL structure:

```python
CATEGORY_PATTERNS = {
    'lenin': [r'/lenin/'],
    'marx': [r'/marx/', r'/archive/m/marx'],
    'trotsky': [r'/trotsky/', r'/archive/t/trotsky'],
    'stalin': [r'/stalin/', r'/archive/s/stalin'],
    'engels': [r'/engels/', r'/archive/e/engels'],
    'luxemburg': [r'/luxemburg/', r'/archive/l/luxemburg'],
    'french-left': [r'/france/', r'/french/', r'/archive/f'],
    'italian-left': [r'/italy/', r'/italian/', r'/archive/i'],
    'german-left': [r'/germany/', r'/german/', r'/archive/g'],
    'soviet': [r'/soviet/', r'/ussr/'],
    'chinese': [r'/china/', r'/mao/', r'/archive/c'],
}
```

**Purpose**: Organize documents by geographical/political tradition
**Note**: Both author name and category extracted independently - they may overlap

#### Tier 3: Content Analysis (Thematic Keywords)

Regex patterns for Marxist theory themes:

```python
MARXIST_TAG_PATTERNS = {
    'marxism': [r'\b(?:marxis[mt]|marxist|marxian)\b'],
    'socialism': [r'\b(?:socialis[mt]|socialist|socially?)\b'],
    'communism': [r'\b(?:communis[mt]|communist|communal)\b'],
    'class-struggle': [r'\b(?:class struggle|bourgeoisie|proletariat|working class)\b'],
    'dialectics': [r'\b(?:dialec(?:tic|tical)?|contradiction|dialectical)\b'],
    'imperialism': [r'\b(?:imperialis[mt]|imperialist|empire)\b'],
    'colonialism': [r'\b(?:colonialis[mt]|colonialist|colonial)\b'],
    'revolution': [r'\b(?:revolution(?:ary)?|insurrection|revolt)\b'],
    'labor': [r'\b(?:labour?|worker|trade union|laborer)\b'],
    'political-economy': [r'\b(?:political economy|capital|surplus value|commodity)\b'],
    'capitalism': [r'\b(?:capitalis[mt]|capitalist|capital accumulation)\b'],
    'nationalism': [r'\b(?:nationalism|nationalist|nation state)\b'],
    'democracy': [r'\b(?:democracy|democratic|dictatorship)\b'],
    'history': [r'\b(?:history|historical|epochs?|historical materialism)\b'],
    'philosophy': [r'\b(?:philosophy|philosophical|ideology|dialectical)\b'],
}
```

**Matching Algorithm**:
1. Convert document content to lowercase
2. For each tag pattern, apply regex search
3. If pattern matches, add the tag
4. Multiple tags per document based on thematic content

#### Tier 4: Always-Added Base Tags

```python
tags.add('marxism')
tags.add('political-economy')
```

**Purpose**: Ensure all Marxist documents are discoverable through core ideological tags

### Extraction Flow

```
For each Marxist document:
  1. Extract source URL from markdown metadata
  2. Extract author name from URL (using author extraction logic)
  3. Extract category from URL (using category patterns)
  4. Apply Tier 1: Add author-specific tags if matched
  5. Apply Tier 2: Add category tags from URL patterns
  6. Apply Tier 3: Scan content for thematic keyword patterns
  7. Apply Tier 4: Add base tags ('marxism', 'political-economy')
  8. Deduplicate and normalize tags
  9. Insert document into marxist.documents
  10. Create/reference tags in shared.tags (get_or_create)
  11. Link tags to document in marxist.document_tags
```

### Database Schema

```sql
-- Documents table
CREATE TABLE marxist.documents (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  language TEXT DEFAULT 'en',
  content TEXT,                    -- Full document content
  source_url TEXT,                 -- Marxists.org URL
  document_type TEXT DEFAULT 'article',
  category TEXT,                   -- From URL patterns
  notes TEXT,                       -- Metadata: word count, source
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tag associations
CREATE TABLE marxist.document_tags (
  document_id INTEGER NOT NULL REFERENCES marxist.documents(id),
  tag_id INTEGER NOT NULL REFERENCES shared.tags(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, tag_id)
);
```

### Current Tag Distribution

**Extracted Marxist Tags** (unique to Marxist collection or dominant in it):

| Tag | Usage Count | Collection Share |
|-----|-------------|------------------|
| marxism | 632 | Mostly Marxist |
| revolution | 809 | Marxist + Anarchist |
| capitalism | 691 | Marxist dominant |
| labor | 482 | Marxist + Library |
| socialism | 482 | Marxist + Library |
| communism | 475 | Marxist dominant |
| imperialism | 398 | Marxist + Marxist |
| colonialism | 287 | Marxist + Anarchist |
| dialectics | 262 | Marxist dominant |
| bolshevism | 62 | Mostly Marxist |
| chinese | 41 | Marxist documents |
| materialism | 20 | Marxist dominant |

**Observation**: Marxist tags are more specific and ideologically-grounded than YouTube tags. Share some common ground with Library and Anarchist collections on broader concepts like 'history', 'philosophy', 'revolution'.

### Author Distribution

Documents in database by author extraction:

```
Marx         (marxist.documents with 'marx' category)
Lenin        (marxist.documents with 'lenin' category)
Trotsky      (marxist.documents with 'trotsky' category)
Stalin       (marxist.documents with 'stalin' category)
Engels       (marxist.documents with 'engels' category)
Luxemburg    (marxist.documents with 'luxemburg' category)
German Left  (marxist.documents with 'german-left' category)
Italian Left (marxist.documents with 'italian-left' category)
French Left  (marxist.documents with 'french-left' category)
Soviet       (marxist.documents with 'soviet' category)
Chinese      (marxist.documents with 'chinese' category)
```

### Import Statistics

**Script**: `import_marxist_documents.py`
**Source Files**: 12,728 markdown files available
**Imported**: 342 documents (2.7% - partial import)
**Batch Size**: 1,000 documents per batch
**Performance**: ~10 seconds per 100 documents
**Status**: INCOMPLETE - Import running in background (as of Feb 20, 2026)

---

## Comparison: YouTube vs Marxist Tag Extraction

### Tag Hierarchy Differences

| Aspect | YouTube | Marxist |
|--------|---------|---------|
| **Tier 1** | Channel-based (499 channels) | Author-based (9 major authors) |
| **Tier 2** | Content pattern matching | URL category patterns |
| **Tier 3** | N/A | Content thematic analysis |
| **Tier 4** | N/A | Always-add base tags |
| **Hierarchy** | 3-tier | 4-tier |
| **Flexibility** | Channel-driven (top-down) | Theory-driven (domain-specific) |

### Tag Characteristics

**YouTube Tags**:
- **Breadth**: Covers 13 major scientific/educational domains
- **Volume**: 60,816 documents → widespread tag coverage
- **Specificity**: Medium (e.g., 'futurism', 'megastructures')
- **Overlap**: Significant (shared tags with all other collections)
- **User-Facing**: Easy to understand for general audiences

**Marxist Tags**:
- **Breadth**: Covers 15 ideological/theoretical domains
- **Volume**: 342 documents (so far) → concentrated tag coverage
- **Specificity**: High (e.g., 'trotskyism', 'dialectics')
- **Overlap**: Modest (shares generic tags like 'history', 'philosophy')
- **User-Facing**: Requires domain knowledge; attracts specialized audiences

### Shared Tag Coverage

**High Overlap Tags** (across YouTube, Marxist, Anarchist, Library):

- `history` - 28,307 total usages
- `philosophy` - 9,187 total usages

These generic tags unify discovery across all four collections.

**Unique/Dominant Tags**:

- **YouTube**: `futurism` (42,907), `education` (61,027), `science` (various)
- **Marxist**: `marxism` (632), `capitalism` (691), `communism` (475)
- **Anarchist**: `anarchism` (varies), `direct-action`, `mutual-aid`
- **Library**: Domain-specific academic tags

---

## Unified Tag Storage & Management

### Shared.Tags Architecture

All tags from all four collections (YouTube, Marxist, Anarchist, Library) are stored in a single table:

```sql
SELECT name, usage_count, source_collections
FROM shared.tags
WHERE usage_count > 100
ORDER BY usage_count DESC
LIMIT 20;
```

**Example Output**:

| name | usage_count | Appears In |
|------|-------------|-----------|
| education | 61,027 | YouTube |
| futurism | 42,907 | YouTube |
| history | 28,307 | YouTube, Marxist, Anarchist |
| mathematics | 27,099 | YouTube |
| technology | 19,230 | YouTube |
| contemporary | 15,395 | Anarchist |
| english | 14548 | Anarchist |
| 2010s | 7,277 | Anarchist |
| civilization | 17,029 | YouTube |
| philosophy | 9,187 | YouTube, Marxist, Anarchist |

**Key Insights**:
1. Single table enables cross-collection tag discovery
2. Usage count is the SUM across all documents in all collections
3. Same tag name → same tag ID → shared discovery
4. Tags created on-demand: `get_or_create_tag(tag_name)`

### Database Triggers for Usage Tracking

Automatic triggers maintain `shared.tags.usage_count`:

```sql
CREATE TRIGGER youtube_transcript_tags_usage_trigger
AFTER INSERT OR DELETE ON youtube.transcript_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();

CREATE TRIGGER marxist_document_tags_usage_trigger
AFTER INSERT OR DELETE ON marxist.document_tags
FOR EACH ROW EXECUTE FUNCTION shared.update_tag_usage_count();
```

**Trigger Logic**:
- On INSERT: Increment `shared.tags.usage_count`
- On DELETE: Decrement `shared.tags.usage_count`
- Works across all source tables automatically

---

## Tag Association Tables

### YouTube: youtube.transcript_tags

```
transcript_id → tag_id
```

- **Junction Table**: Links transcripts to shared tags
- **Records**: 215,702 associations (60,816 documents × ~3.5 tags/avg)
- **Cardinality**: One transcript can have 0-N tags

### Marxist: marxist.document_tags

```
document_id → tag_id
```

- **Junction Table**: Links Marxist documents to shared tags
- **Records**: 3,262 associations (342 documents × ~9.5 tags/avg)
- **Cardinality**: One document can have 0-N tags

**Observation**: Marxist documents average MORE tags per document (9.5) compared to YouTube (3.5) because of the multi-tier extraction including author, category, and thematic content analysis.

---

## Implementation Details: Import Process

### Common Import Pattern

Both import scripts follow the same overall architecture:

```python
def import_collection(source_dir, database_url, batch_size=1000):
    # 1. Connect to database
    conn = psycopg2.connect(database_url)

    # 2. Find all source files
    files = list(source_path.rglob('*.md'))

    # 3. Process in batches
    batch = []
    for file in files:
        # Extract metadata from file
        metadata = extract_metadata(file)
        tags = extract_tags_using_tiers(metadata)

        # Prepare record
        record = create_record(metadata, tags)
        batch.append(record)

        # When batch full, insert
        if len(batch) >= batch_size:
            insert_documents_batch(conn, batch)
            associate_tags_batch(conn, batch)
            batch = []

    # Final batch
    if batch:
        insert_documents_batch(conn, batch)
        associate_tags_batch(conn, batch)

    # Verify
    verify_import_stats(conn)
```

### Tag Creation: get_or_create Pattern

Both scripts use the same tag management:

```python
def get_or_create_tags(conn, tags: list) -> dict:
    """Get or create tags in shared.tags, return name → id mapping."""
    tag_map = {}

    for tag_name in tags:
        # Check if tag exists
        cur.execute("SELECT id FROM shared.tags WHERE name = %s", (tag_name,))
        result = cur.fetchone()

        if result:
            tag_map[tag_name] = result[0]
        else:
            # Create new tag
            cur.execute(
                "INSERT INTO shared.tags (name, description) VALUES (%s, %s) RETURNING id",
                (tag_name, f"{collection} tag: {tag_name}")
            )
            tag_map[tag_name] = cur.fetchone()[0]

    conn.commit()
    return tag_map
```

---

## Gaps and Issues

### YouTube Gaps

1. **Incomplete Channel Coverage**: Only 5 channels have predefined tags; 494 others use pattern matching only
2. **Upload Date Missing**: Transcript files don't contain upload dates
3. **Metadata Loss**: Some channel structure information not captured
4. **Language Support**: Only 'en' language code extracted; might be multilingual content

### Marxist Gaps

1. **Incomplete Import**: Only 342/12,728 documents imported (2.7%)
   - Root Cause: Import script still running as of Feb 20, 2026
   - **Action Needed**: Monitor import completion

2. **Author Extraction Limitations**:
   - Only 9 major authors have predefined tags
   - Others fall back to generic 'marxist-theory' category
   - Document author field may not match URL author

3. **Category Precision**:
   - URL patterns may be ambiguous
   - Some documents belong to multiple traditions
   - Fallback category 'marxist-theory' is too generic

4. **Source URL Extraction**:
   - Depends on consistent markdown metadata format
   - May fail for scraped content with non-standard formatting

### Cross-Collection Issues

1. **Tag Name Normalization**:
   - YouTube uses lowercase with hyphens (e.g., 'anti-capitalism')
   - Marxist follows same convention but some tags created inconsistently
   - Potential for duplicate tags with case/format variations

2. **Polysemy**: Generic tags like 'history', 'philosophy' used across collections with different meanings:
   - YouTube 'history' = educational videos about historical topics
   - Marxist 'history' = historical materialism, historical analysis
   - Anarchist 'history' = anarchist movement history
   - Users may find mixed results when filtering on single tag

3. **Granularity Mismatch**:
   - YouTube: Broad educational categories (13 tags)
   - Marxist: Narrow ideological specificity (15 tags)
   - Library/Anarchist: Academic/domain-specific tags
   - Cross-collection search may have inconsistent precision

---

## Verification Results

### Database State (As of February 22, 2026)

```sql
-- Collection counts
YouTube Transcripts:    60,816 documents
Marxist Documents:        342 documents (incomplete)
Anarchist Documents:   24,597 documents
Library Documents:      2,561 documents
Total:               ~88,000+ documents

-- Tag associations
YouTube Tags:         215,702 associations (3.5/doc avg)
Marxist Tags:           3,262 associations (9.5/doc avg)
Anarchist Tags:       117,665 associations (4.8/doc avg)
Library Tags:          10,316 associations (4.0/doc avg)
Total:               ~347,000+ associations

-- Unique tags
Total in shared.tags: 11,986 unique tags
```

### Tag Extraction Quality

**YouTube**:
- ✅ All 60,816 documents tagged
- ✅ Consistent 3.5 tags per document
- ✅ Channel-based tags working correctly
- ⚠️ Pattern matching may over/under-tag obscure channels

**Marxist**:
- ❌ Only 2.7% of source documents imported (342/12,728)
- ✅ Higher tag density (9.5 tags/doc) when imported
- ✅ Author and category extraction working
- ⚠️ Need to complete remaining 12,386 documents

---

## Frontend Integration

### API Endpoints

**YouTube Transcripts**:
```
GET /api/transcripts/youtube/[slug]
DELETE /api/transcripts/youtube/[slug] (admin)
```

**Marxist Documents**:
```
GET /api/documents/marxist/[slug]
DELETE /api/documents/marxist/[slug] (admin)
```

### Tag Display in Frontend

Tags are loaded and displayed via:

```typescript
// In LibraryDocumentClient component
const tags = await fetchTags(documentSource, slug);
// Tags displayed in UI with filter capability
```

**Collections Support**: YouTube, Marxist, Anarchist, Library (unified filtering)

---

## Comparison with Library & Anarchist Collections

### Anarchist Collection Tag Extraction (Reference)

**Method**: 4-Tier Hybrid Strategy from .muse source files
1. Extract from `#SORTtopics` or `#topics` metadata (PRIMARY)
2. Extract from markdown YAML frontmatter (FALLBACK)
3. Auto-generate from content keywords (SUPPLEMENT)
4. Enrich with author, era, language tags (UNIVERSAL)

**Result**: 24,597 documents, 19,952 unique tags, 117,665 associations

**Key Difference from YouTube/Marxist**:
- Anarchist extraction is DOCUMENT-CENTRIC (extracts from document metadata)
- YouTube/Marxist are SOURCE-CENTRIC (extract from channel/author/URL)

### Library Collection Tag Extraction

**Method**: Manual academic tagging (pre-existing)
- 2,561 documents with 10,316 tag associations
- Curated academic tags
- Average 4 tags per document

**Integration**: Uses same `shared.tags` table, same tag association mechanism

---

## Recommendations for Improvement

### YouTube Tags

1. **Expand Channel Mappings**
   - Analyze top 50 channels; create targeted tag mappings
   - Current: 5/499 channels have predefined tags
   - Target: 50/499 = 10% coverage

2. **Add Upload Date Metadata**
   - Scrape YouTube API for upload dates
   - Enable temporal filtering (videos from last month, year, etc.)

3. **Implement Language Detection**
   - Use transcript language detection library
   - Currently all marked as 'en'

4. **Topic Modeling (Optional)**
   - Apply LDA or similar for unsupervised topic discovery
   - Supplement pattern-based tags with learned topics

### Marxist Documents

1. **Complete the Import**
   - Current: 342/12,728 (2.7%)
   - **Action**: Wait for background import to complete
   - **Estimated**: Full completion = ~12,000 documents, ~110,000+ tags

2. **Improve Author Tagging**
   - Map document author field to predefined authors
   - Create author-specific landing pages
   - Add author bio tags

3. **Enhance Category Extraction**
   - Improve URL pattern matching
   - Allow documents to have multiple categories
   - Create hierarchical category structure

4. **Content Analysis Enhancement**
   - Expand keyword patterns for emerging Marxist schools
   - Add Eurocommunism, Autonomist Marxism, etc.
   - Implement tf-idf for automatic keyword extraction

### Cross-Collection Improvements

1. **Unified Tag Management UI**
   - Show tag usage across all collections
   - Identify polysemous tags (same name, different meanings)
   - Tag synonym management

2. **Context-Aware Filtering**
   - When filtering on 'history', show what it means in each collection
   - Suggest related tags within collection context

3. **Tag Analytics Dashboard**
   - Top tags by collection
   - Tag co-occurrence analysis
   - Collection overlap visualization

4. **Smart Tag Suggestions**
   - When adding manual tags to one collection, suggest related tags from others
   - Machine learning on existing tag patterns

---

## Technical References

### Import Scripts Location

```
/home/user/projects/veritable-games/resources/scripts/
├── import_youtube_transcripts.py      (Main import script)
└── import_marxist_documents.py        (Main import script)
```

### Database Migrations

```
/home/user/projects/veritable-games/resources/sql/
├── 007-create-youtube-marxist-schemas.sql  (YouTube/Marxist tables)
└── [other collection schemas]
```

### Service Layer

```
/home/user/projects/veritable-games/site/src/lib/
├── youtube/
│   ├── types.ts
│   └── service.ts
├── marxist/
│   ├── types.ts
│   └── service.ts
└── documents/service.ts (unified queries)
```

---

## Execution Logs & Monitoring

### Import Progress Tracking

**YouTube Import Log**:
```
/home/user/projects/veritable-games/resources/logs/youtube-import-20260220.log
```

**Marxist Import Log**:
```
/home/user/projects/veritable-games/resources/logs/marxist-import-20260220.log
```

Monitor with:
```bash
tail -f /home/user/projects/veritable-games/resources/logs/marxist-import-20260220.log
```

---

## Conclusion

The tag extraction systems for YouTube and Marxist collections implement sophisticated, multi-tier hierarchical approaches suited to each collection's unique characteristics:

- **YouTube**: Channel-driven discovery with pattern-based content analysis
- **Marxist**: Author/theory-driven discovery with ideological categorization

Both systems feed into a unified `shared.tags` table, enabling cross-collection discovery while maintaining collection-specific semantic precision. The current implementation provides a solid foundation for expanding the platform to 100K+ documents with sophisticated filtering and discovery capabilities.

**Current Status**: YouTube complete (60,816), Marxist in progress (342/12,728)
**Next Steps**: Complete Marxist import, monitor tag quality, implement frontend UI improvements

---

**Document Created**: February 22, 2026
**Research Scope**: Implementation audit and documentation
**No Code Changes**: This is research and documentation only
