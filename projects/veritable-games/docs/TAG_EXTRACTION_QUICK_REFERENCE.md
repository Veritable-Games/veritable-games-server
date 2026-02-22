# Tag Extraction: Quick Reference Guide

**For**: YouTube & Marxist Collections
**Reference Doc**: `/home/user/projects/veritable-games/docs/TAG_EXTRACTION_YOUTUBE_MARXIST.md`
**Date**: February 22, 2026

---

## Current Status at a Glance

| Metric | YouTube | Marxist | Anarchist | Library | Total |
|--------|---------|---------|-----------|---------|-------|
| Documents | 60,816 | 342 | 24,597 | 2,561 | ~88,000 |
| Tag Associations | 215,702 | 3,262 | 117,665 | 10,316 | ~347,000 |
| Avg Tags/Doc | 3.5 | 9.5 | 4.8 | 4.0 | ~4.0 |
| Unique Tags | Subset | Subset | 19,952 | Subset | 11,986 |
| Status | Complete | Incomplete (2.7%) | Complete | Complete | Active |

---

## YouTube: 3-Tier Tag Extraction

### Tier 1: Channel Tags (5 predefined channels)
```
Isaac Arthur  → futurism, space, megastructures, colonization
Kurzgesagt    → science, education, animation, biology
CrashCourse   → education, history, science, philosophy
Vsauce        → science, physics, mathematics, philosophy
TED-Ed        → education, science, history, philosophy
```

### Tier 2: Content Pattern Matching (13 categories)
- science, space, technology, futurism, physics, biology, astronomy
- history, philosophy, mathematics, megastructures, colonization, intelligence, civilization

### Tier 3: Always Added
- Channel slug tag (e.g., 'isaac-arthur')
- 'education' tag

### Top Tags
| Tag | Count |
|-----|-------|
| education | 61,027 |
| futurism | 42,907 |
| history | 28,307 |
| mathematics | 27,099 |
| technology | 19,230 |

### Source
`/home/user/projects/veritable-games/resources/scripts/import_youtube_transcripts.py`

---

## Marxist: 4-Tier Tag Extraction

### Tier 1: Author Tags (9 theorists)
```
Lenin       → lenin, bolshevism, vanguard-party, soviet
Marx        → marx, capital, materialism
Engels      → engels, marxism, german-ideology
Trotsky     → trotsky, permanent-revolution, trotskyism
Luxemburg   → luxemburg, rosa, spontaneity
Stalin      → stalin, soviet, socialism-in-one-country
Gramsci     → gramsci, hegemony, cultural-marxism
Lukacs      → lukacs, reification, consciousness
Mao         → mao, maoism, peasant-revolution
```

### Tier 2: Category Tags from URL (11 categories)
- lenin, marx, trotsky, stalin, engels, luxemburg
- french-left, italian-left, german-left, soviet, chinese

### Tier 3: Content Thematic Analysis (15 keywords)
- marxism, socialism, communism, class-struggle, dialectics, imperialism
- colonialism, revolution, labor, political-economy, capitalism, nationalism
- democracy, history, philosophy

### Tier 4: Always Added
- 'marxism'
- 'political-economy'

### Top Tags
| Tag | Count |
|-----|-------|
| marxism | 632 |
| revolution | 809 |
| capitalism | 691 |
| labor | 482 |
| socialism | 482 |

### Source
`/home/user/projects/veritable-games/resources/scripts/import_marxist_documents.py`

### Status
⚠️ **INCOMPLETE**: Only 342/12,728 documents imported (2.7%)
- Import running in background as of Feb 20, 2026
- Expected completion: Variable (depends on import script status)

---

## Unified Tag Storage

### Central Table: `shared.tags`
```sql
CREATE TABLE shared.tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Junction Tables (per collection)
```
youtube.transcript_tags     (transcript_id → tag_id)
marxist.document_tags       (document_id → tag_id)
anarchist.document_tags     (document_id → tag_id)
library.library_document_tags (library_id → tag_id)
```

### Total Tags
**11,986 unique tags** shared across all 4 collections

---

## Tag Comparison

| Aspect | YouTube | Marxist |
|--------|---------|---------|
| **Extraction** | 3-tier | 4-tier |
| **Primary Driver** | Channel | Author/Category |
| **Content Analysis** | Keyword patterns | Thematic + keyword |
| **Documents** | 60,816 (100%) | 342 (2.7%) |
| **Tags/Doc** | 3.5 avg | 9.5 avg |
| **Specificity** | Medium (general audience) | High (domain-specific) |
| **User Type** | Broad educational | Specialized/academic |

---

## Key Findings

### YouTube Insights
✅ Complete import (60,816 transcripts)
✅ Consistent 3.5 tags per transcript
✅ Broad educational categorization
✅ 499 channels represented
⚠️ Only 5 channels have predefined tags (1% coverage)

### Marxist Insights
✅ Rich tag density (9.5 tags per doc)
✅ Author-specific categorization
✅ Ideologically precise tags
❌ Incomplete import (2.7%)
❌ Needs immediate completion

### Unified Tags Insights
✅ Single shared.tags table working correctly
✅ Automatic usage count tracking via triggers
✅ Cross-collection tag discovery enabled
⚠️ Polysemy: Same tag means different things in different collections
   (e.g., 'history' in YouTube vs Marxist vs Anarchist)

---

## Gaps & Issues Summary

### YouTube
- [ ] Upload dates not captured
- [ ] Channel coverage only 5/499 (1%)
- [ ] No language field populated

### Marxist
- [ ] **Incomplete import** - must complete 12,386 remaining documents
- [ ] Author extraction only works for 9 major authors
- [ ] Fallback category 'marxist-theory' is too generic

### Cross-Collection
- [ ] Tag name normalization inconsistencies
- [ ] Polysemy: Generic tags across collections need context
- [ ] Granularity mismatch between collections

---

## Recommendations (Priority Order)

### P0 - Critical
1. **Complete Marxist import** - Only 2.7% done
   - Monitor: `/home/user/projects/veritable-games/resources/logs/marxist-import-*.log`

### P1 - High Value
2. **Expand YouTube channel mappings** - Increase from 5 to 50 channels
3. **Improve Marxist author tagging** - Map document author field
4. **Add contextual tag descriptions** - Explain polysemy for generic tags

### P2 - Nice to Have
5. **Upload date extraction** for YouTube (temporal filtering)
6. **Topic modeling** for unsupervised tag discovery
7. **Tag analytics dashboard** - Cross-collection insights

---

## Data Source Locations

```
YouTube:
  Source Files:   /home/user/projects/veritable-games/resources/data/transcripts.OLD/
  Import Script:  /home/user/projects/veritable-games/resources/scripts/import_youtube_transcripts.py
  Log:            /home/user/projects/veritable-games/resources/logs/youtube-import-20260220.log

Marxist:
  Source Files:   /home/user/projects/veritable-games/resources/data/scraping/marxists-org/marxists_org_texts/
  Import Script:  /home/user/projects/veritable-games/resources/scripts/import_marxist_documents.py
  Log:            /home/user/projects/veritable-games/resources/logs/marxist-import-20260220.log

Database:
  Schema:         shared.tags (all collections)
  YouTube Table:  youtube.transcripts + youtube.transcript_tags
  Marxist Table:  marxist.documents + marxist.document_tags
```

---

## Query Examples

### Check import progress
```sql
-- YouTube
SELECT COUNT(*) FROM youtube.transcripts;  -- Should be 60,816

-- Marxist
SELECT COUNT(*) FROM marxist.documents;    -- Should be 12,731 when complete
```

### Check tags
```sql
-- Top tags
SELECT name, usage_count FROM shared.tags ORDER BY usage_count DESC LIMIT 20;

-- Marxist-only tags
SELECT name, usage_count FROM shared.tags
WHERE id IN (SELECT DISTINCT tag_id FROM marxist.document_tags)
ORDER BY usage_count DESC;
```

### Check associations
```sql
-- YouTube: transcripts with many tags
SELECT slug, title, COUNT(*) as tag_count
FROM youtube.transcripts t
JOIN youtube.transcript_tags tt ON t.id = tt.transcript_id
GROUP BY t.id
ORDER BY tag_count DESC LIMIT 10;
```

---

## For More Details

📖 **Full Documentation**: `/home/user/projects/veritable-games/docs/TAG_EXTRACTION_YOUTUBE_MARXIST.md`

Includes:
- Complete architecture diagrams and descriptions
- Full tag hierarchies with all patterns
- Database schema details
- Import process flow
- Gaps and recommendations
- Verification results

---

**Last Updated**: February 22, 2026
**Research**: Documentation only - no code changes
