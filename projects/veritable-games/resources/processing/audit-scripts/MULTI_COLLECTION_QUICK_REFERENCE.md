# Multi-Collection Audit System - Quick Reference

**Status**: Expanded plan for all 4 collections
**Last Updated**: February 23, 2026
**Files**: EXPANDED_MULTI_COLLECTION_PLAN.md (full details)

---

## TL;DR - The Vision

Transform all 4 document collections from **varying quality** (40-88/100 avg) to **unified high quality** (85+ avg) with collection-specific strategies.

**Timeline**: 4-6 weeks for full implementation (5-6 hours/week effort)

---

## Collections Overview

| Collection | Size | Avg Quality | Main Issues | Key Fix |
|-----------|------|-------------|-----------|---------|
| **Library** | 2,561 | 52 | Missing authors (46%), dates (99.9%) | Metadata audit |
| **YouTube** | 60,816 | 45 | Wall-of-text, no speakers | Transcript formatting |
| **Marxist** | 12,728 | 40 | No metadata (97.3%), duplicates | Enrichment from marxists.org |
| **Anarchist** | 24,643 | 88 | Minor inconsistencies, broken links | Validation only |
| **TOTAL** | **~100,748** | **~55** | Various | Targeted fixes |

---

## Quick Start for Each Collection

### 1. Library (2-3 weeks)
```bash
# Phase 1A: Initialize audit
python3 metadata_audit.py init --schema library

# Phase 1B: Review and fix metadata
python3 metadata_audit.py next --count 10 --max-score 39
# ... manually fix metadata ...
python3 metadata_audit.py mark-fixed 123

# Expected: Author 95%, Dates 80%
```

**Key Strategies**:
- Priority queue: Worst-first (1,193 CRITICAL docs)
- Metadata enrichment: Manual + automated
- Tier 1 cleanup: Remove page markers, images
- Source tracking: Find docs from other sources

---

### 2. YouTube (1-2 weeks, Parallel)
```bash
# Phase 2A: Initialize YouTube audit
from collection_specific_detectors import YouTubeIssueDetector
detector = YouTubeIssueDetector()

# Phase 2B: Format transcripts
from collection_specific_detectors import YouTubeTranscriptFormatter
formatter = YouTubeTranscriptFormatter()

formatted = formatter.smart_paragraph_separation(transcript)
speakers = formatter.identify_speakers(formatted)
normalized = formatter.normalize_timestamps(formatted)

# Phase 2C: Find channel aliases
deduplicator = YouTubeChannelDeduplicator()
duplicates = deduplicator.find_channel_variations()

# Expected: Paragraph separation 95%, Speakers 85%, Quality 80+
```

**Key Strategies**:
- Smart paragraph separation (break wall-of-text)
- Speaker identification (recognize "Speaker: text" format)
- Timestamp normalization
- Incomplete transcript detection
- Channel alias detection

---

### 3. Marxist (1-2 weeks, Parallel)
```bash
# Phase 3A: Initialize Marxist audit
from collection_specific_detectors import MarxistIssueDetector
detector = MarxistIssueDetector()

# Phase 3B: Enrich metadata
from collection_specific_detectors import MarxistMetadataEnricher
enricher = MarxistMetadataEnricher()

metadata = enricher.extract_from_marxists_org(doc_url)
author = enricher.auto_detect_author_from_content(content)
category = enricher.categorize_by_marxist_section(url)

# Phase 3C: Find cross-source duplicates
from collection_specific_detectors import CrossSourceDeduplicator
dedup = CrossSourceDeduplicator()
duplicates = dedup.find_cross_source_duplicates()

# Expected: Author extraction 70%, Category 90%, Quality 75+
```

**Key Strategies**:
- Extract metadata from marxists.org URL structure
- Auto-detect authors from content
- Categorize by marxists.org section
- Find Wikipedia artifacts (common in imports)
- Compare against Anarchist Library
- Find duplicates with Anarchist Library (high overlap expected)

---

### 4. Anarchist (3-5 days, Final Phase)
```bash
# Phase 5: Validate consistency
from collection_specific_detectors import AnarchistIssueDetector
detector = AnarchistIssueDetector()

# Check language consistency
detector.check_language_consistency(declared_lang, content)

# Check category consistency
detector.check_category_consistency(categories, content)

# Check formatting
detector.check_formatting_consistency(content)

# Expected: Language accuracy 99.5%, Links 99.9%, Quality 92+
```

**Key Strategies**:
- Validate language tags match content
- Check categories appear in content
- Validate Markdown formatting
- Find broken internal links
- Verify author pages exist
- Light audit only (already high quality)

---

## Implementation Phases

### Week 1: Infrastructure & Setup
- ✅ Collection-specific detectors (DONE)
- ✅ Database schema expansion
- ✅ Quality scoring by collection
- ⏳ Metadata extraction modules
- ⏳ Cross-source deduplication setup

### Weeks 2-3: Library + YouTube + Marxist (Parallel)
- **Library**: Review 1,193 CRITICAL (80-120h)
- **YouTube**: Format 60,816 transcripts (40h)
- **Marxist**: Enrich metadata 12,728 docs (60h)

### Week 4: Cross-Source Deduplication
- Generate fingerprints for all 97,000 docs
- Detect duplicates (expected: 5,000-8,000)
- Manual review of high-confidence matches
- Merge with tag preservation

### Week 5: Anarchist Validation + Final Merges
- Validate 24,643 Anarchist documents
- Fix broken links
- Complete merges
- Generate final reports

---

## Collection-Specific Metrics

### Library → Target
- Authors: 53.4% → 95%
- Dates: 0.1% → 80%
- Quality: 52 → 85+

### YouTube → Target
- Paragraph separation: Poor → 95%
- Speaker ID: Minimal → 85%
- Quality: 45 → 80+

### Marxist → Target
- Author extraction: 2.7% → 70%
- Categories: 0% → 90%
- Quality: 40 → 75+

### Anarchist → Target
- Language accuracy: 95% → 99.5%
- Links valid: 99.5% → 99.9%
- Quality: 88 → 92+

### All Collections Combined → Target
- Total documents: 100,748 → 95,000-98,000 (after dedup)
- Avg quality: 55 → 85+
- Metadata completeness: 40% → 90%
- Duplicates identified: 5,000-8,000
- Corpus reduction: 3-5%

---

## Usage Examples

### Using Collection-Specific Detectors

```python
from collection_specific_detectors import (
    get_detector_for_collection,
    YouTubeIssueDetector,
    MarxistIssueDetector,
    AnarchistIssueDetector
)

# Method 1: Get detector by collection name
detector = get_detector_for_collection('youtube')
result = detector.analyze_youtube_transcript(doc)

# Method 2: Use specific detector directly
youtube_det = YouTubeIssueDetector()
youtube_det.check_paragraph_separation(content)
youtube_det.check_speaker_identification(content)

marxist_det = MarxistIssueDetector()
marxist_det.check_marxist_author(author)
marxist_det.detect_wikipedia_artifacts(content)

anarchist_det = AnarchistIssueDetector()
anarchist_det.check_language_consistency(lang, content)
anarchist_det.check_category_consistency(cats, content)
```

### Batch Processing by Collection

```python
from metadata_audit import MetadataAudit

# Initialize audit for each collection
for collection in ['library', 'youtube', 'marxist', 'anarchist']:
    audit = MetadataAudit()
    audit.init(schema=collection)

    # Process batches
    while True:
        docs = audit.next(count=50)
        if not docs:
            break

        # Process with collection-specific logic
        for doc in docs:
            if collection == 'library':
                # Library-specific
                pass
            elif collection == 'youtube':
                # YouTube-specific
                pass
            # etc.
```

---

## Files & Organization

```
audit-scripts/
├── Core System (Phase 1)
│   ├── metadata_audit.py              # Main CLI
│   ├── issue_detectors.py             # Base detector
│   ├── generate_document_fingerprints.py
│   ├── detect_duplicates.py
│   └── merge_duplicates.py
│
├── Multi-Collection (Phase 2+)
│   ├── collection_specific_detectors.py  # ← NEW
│   │   ├── YouTubeIssueDetector
│   │   ├── MarxistIssueDetector
│   │   ├── AnarchistIssueDetector
│   │   └── LibraryIssueDetector
│   ├── youtube_formatter.py              # ← NEW
│   ├── marxist_enricher.py               # ← NEW
│   └── cross_source_deduplicator.py      # ← NEW
│
└── Documentation
    ├── README.md
    ├── GETTING_STARTED.md
    ├── IMPLEMENTATION_PLAN.md
    ├── EXPANDED_MULTI_COLLECTION_PLAN.md  # ← NEW (45KB)
    ├── INDEX.md
    ├── PROJECT_SUMMARY.md
    └── MULTI_COLLECTION_QUICK_REFERENCE.md # ← NEW (this file)
```

---

## Quick Decision Tree

```
┌─ What collection do you want to improve?
│
├─ Library (2,561 docs)
│  └─ Missing metadata (author, dates)
│     └─ Use: metadata_audit.py + LibraryIssueDetector
│
├─ YouTube (60,816 transcripts)
│  └─ Poor formatting, no speakers
│     └─ Use: YouTubeIssueDetector + YouTubeTranscriptFormatter
│
├─ Marxist (12,728 docs)
│  └─ No metadata, Wikipedia artifacts
│     └─ Use: MarxistIssueDetector + MarxistMetadataEnricher
│
├─ Anarchist (24,643 docs)
│  └─ Validate consistency, find broken links
│     └─ Use: AnarchistIssueDetector (light audit)
│
└─ All Collections
   └─ Find duplicates across sources
      └─ Use: generate_document_fingerprints + detect_duplicates
```

---

## Key Improvements per Collection

### Library Improvements
```
Before:
  - 1,191 documents with no author
  - 2,560 documents with no publication date
  - Low readability (page markers, images)

After:
  - 2,433+ documents with author (95%+)
  - 2,049+ documents with publication date (80%+)
  - Clean, readable documents (Tier 1 cleanup)

Expected Impact:
  - Quality increase: 52 → 85+ points
  - Metadata completion: 27% → 90%
  - Searchability: Dramatically improved
```

### YouTube Improvements
```
Before:
  - Wall-of-text transcripts (lines 200+ chars avg)
  - No speaker identification
  - Incomplete/corrupted transcripts
  - Minimal metadata

After:
  - Properly separated paragraphs (95%+)
  - Speaker identification (85%+)
  - Incomplete transcripts flagged
  - Channel + date extracted

Expected Impact:
  - Quality increase: 45 → 80+ points
  - Readability: Massively improved (80%+)
  - Usability: Much better for users
```

### Marxist Improvements
```
Before:
  - 12,728 docs with minimal metadata
  - Author extraction: 2.7%
  - Categories: 0%
  - Wikipedia artifacts mixed in

After:
  - Author extraction: 70%+
  - Categories: 90%
  - Wikipedia artifacts flagged
  - Cross-source duplicates identified

Expected Impact:
  - Quality increase: 40 → 75+ points
  - Metadata completion: 2.7% → 70%
  - Organization: Much improved
```

### Anarchist Improvements
```
Before:
  - Already high quality (88 avg)
  - Minor issues: language mismatches, broken links

After:
  - Language accuracy: 99.5%
  - Link validity: 99.9%
  - Perfect consistency

Expected Impact:
  - Quality maintenance: 88 → 92+
  - Reliability: Near-perfect
```

---

## Success Criteria Checklist

- [ ] Library metadata audit initialized
- [ ] 1,193 CRITICAL documents reviewed
- [ ] Author completion: 95%+
- [ ] Publication date completion: 80%+
- [ ] YouTube transcripts formatted (paragraph separation)
- [ ] Speaker identification working
- [ ] Marxist metadata extraction: 70%+
- [ ] Marxist categories assigned: 90%+
- [ ] Wikipedia artifacts detected and flagged
- [ ] Cross-source duplicates found (5,000-8,000)
- [ ] High-confidence duplicates merged
- [ ] Tags preserved: 100%
- [ ] Anarchist validation: 99.5%+ language accuracy
- [ ] Broken links: <0.1%
- [ ] All quality scores increased 30+ points on average

---

## Next Steps

1. **Read** EXPANDED_MULTI_COLLECTION_PLAN.md (full 45KB document)
2. **Start** with Library collection (known entity)
3. **Parallel** YouTube + Marxist work (weeks 2-3)
4. **Merge** duplicates (week 4)
5. **Validate** Anarchist (week 5)
6. **Report** final metrics and improvements

---

## Questions?

- **How do I use the collection detectors?** → See "Using Collection-Specific Detectors" above
- **What's the timeline?** → See "Implementation Phases" (4-6 weeks)
- **What files do I need?** → See "Files & Organization"
- **What are the expected results?** → See "Collection-Specific Metrics"
- **Full details?** → Read EXPANDED_MULTI_COLLECTION_PLAN.md

---

**Created by**: Claude Code AI
**Status**: Ready for implementation
**Last Updated**: February 23, 2026
