# Metadata Audit & Duplicate Detection System

**Status**: Phase 1 Implementation (Metadata Audit) - READY FOR DEPLOYMENT
**Created**: February 23, 2026
**Location**: `/home/user/projects/veritable-games/resources/processing/audit-scripts/`

## Overview

This is a comprehensive system for auditing, cleaning, and deduplicating the Veritable Games document library. It consists of three phases that run sequentially:

1. **Phase 1: Metadata Audit** - Quality assessment and metadata fixes (THIS PHASE)
2. **Phase 2: Content Cleanup** - Remove artifacts and fix formatting (In Development)
3. **Phase 3: Duplicate Detection** - Cross-source deduplication (In Development)

## Phase 1: Metadata Audit System

### What It Does

The metadata audit system:
- Scans all documents in a collection
- Calculates a quality score (0-100) based on metadata completeness
- Identifies specific issues (missing author, invalid date, etc.)
- Tracks formatting artifacts (page markers, images, code blocks)
- Maintains a persistent audit log in the database
- Provides a CLI for reviewing and marking documents as fixed

### Quick Start

#### 1. Create Database Schema

```bash
# Apply the migration
cd /home/user/projects/veritable-games
docker exec veritable-games-postgres psql -U postgres -d veritable_games < \
  resources/sql/007-create-metadata-audit-and-duplicate-detection-schema.sql
```

#### 2. Initialize Audit

```bash
cd /home/user/projects/veritable-games/resources/processing/audit-scripts

# Set database URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games"

# Initialize audit for library collection (scans ~2,561 documents, 10-15 min)
python3 metadata_audit.py init --schema library
```

#### 3. Get Status

```bash
python3 metadata_audit.py status
```

#### 4. Review Documents

```bash
# Get next 10 documents with lowest quality scores
python3 metadata_audit.py next --count 10

# Get next 20 CRITICAL documents (score 0-39)
python3 metadata_audit.py next --count 20 --max-score 39
```

#### 5. Mark as Fixed

```bash
# After fixing metadata in database, mark as fixed
python3 metadata_audit.py mark-fixed 123 --notes "Added author and publication year"

# Or mark as reviewed (no changes needed)
python3 metadata_audit.py mark-reviewed 456 --notes "Metadata already good"

# Or skip (can't find metadata)
python3 metadata_audit.py mark-skipped 789 --reason "Author unknown, could not verify"
```

#### 6. Save Progress

```bash
# After reviewing batch, finalize the round
python3 metadata_audit.py finalize-round --name "Library_Round_1" --notes "Reviewed 50 CRITICAL documents"
```

### Quality Score Breakdown

**Score = 100 points base**
- Author field: 40 points
  - Missing: -40
  - Placeholder (Unknown, Anonymous, etc.): -40
  - Truncated/Initials only: -15 to -25
- Publication date: 30 points
  - Missing: -30
  - Invalid format: -30
  - Future date: -25
  - Placeholder (2025): -20
- Title quality: 20 points
  - Missing: -20
  - Wikipedia suffix: -10
  - Truncated: -10
  - Too long: -5
- Content: 10 points
  - Missing: -10
  - Too short: -10

### Priority Categories

- **CRITICAL (0-39)**: ~1,193 Library documents - IMMEDIATE REVIEW NEEDED
- **POOR (40-59)**: ~527 documents - Gaps in metadata
- **GOOD (60-79)**: ~468 documents - Minor fixes needed
- **EXCELLENT (80-100)**: ~373 documents - Review only

### Database Queries

#### See Critical Documents

```sql
SELECT id, schema_name, document_slug, quality_score, issues_count
FROM library.metadata_audit_log
WHERE quality_score <= 39 AND audit_status = 'pending'
ORDER BY quality_score ASC
LIMIT 20;
```

#### See Review Progress

```sql
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN audit_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN audit_status = 'reviewed' THEN 1 END) as reviewed,
    COUNT(CASE WHEN audit_status = 'fixed' THEN 1 END) as fixed,
    AVG(quality_score)::INT as avg_score
FROM library.metadata_audit_log;
```

#### See Issues by Type

```sql
SELECT
    issues_detected ->> 'type' as issue_type,
    COUNT(*) as count
FROM library.metadata_audit_log,
     jsonb_array_elements(issues_detected) as issues_detected
GROUP BY issues_detected ->> 'type'
ORDER BY count DESC;
```

### Detected Issue Types

| Issue Type | Severity | Deduction | Example |
|-----------|----------|-----------|---------|
| `missing_author` | CRITICAL | -40 | Author field empty |
| `placeholder_author` | CRITICAL | -40 | Author = "Unknown" |
| `truncated_author` | HIGH | -25 | Author = "S T" (too short) |
| `initials_only_author` | MEDIUM | -15 | Author = "J. K." |
| `missing_publication_date` | CRITICAL | -30 | Date field empty |
| `invalid_date_format` | CRITICAL | -30 | Date = "sometime" |
| `future_publication_date` | HIGH | -25 | Year > 2026 |
| `impossible_publication_date` | HIGH | -25 | Year < 1440 |
| `placeholder_publication_date` | HIGH | -20 | Date = "2025" |
| `missing_title` | CRITICAL | -20 | Title field empty |
| `wiki_suffix_in_title` | MEDIUM | -10 | Title ends with "(Wikipedia)" |
| `author_in_title` | MEDIUM | -8 | Title = "Author, The Book" |
| `truncated_title` | MEDIUM | -10 | Title ends with "..." |
| `excessively_long_title` | LOW | -5 | Title > 200 chars |
| `no_content` | CRITICAL | -10 | Content field empty |
| `insufficient_content` | HIGH | -10 | Content < 100 words |

### Formatting Artifacts (Tracked Separately)

Artifacts don't affect quality score but are tracked for Phase 2 cleanup:
- `page_markers`: "## Page N" headers (~1,385 documents)
- `image_references`: "![alt](images/...)" (~994 documents)
- `prose_in_code_block`: Prose wrapped in ``` (~170 documents)
- `html_anchors`: `<span id="...">` elements
- `excessive_blank_lines`: Multiple consecutive blank lines

### Workflow Tips

**Reviewing Documents**:
1. Run `next --count 10` to get batch
2. For each document, look up in database and fix metadata if possible
3. Run `mark-fixed` if you fixed issues
4. Run `mark-reviewed` if metadata is already correct
5. Run `mark-skipped` if you can't find correct metadata

**Focusing on High-Impact**:
```bash
# Start with most critical
python3 metadata_audit.py next --count 50 --max-score 39

# Then poor quality
python3 metadata_audit.py next --count 50 --max-score 59

# Then good (just missing one field)
python3 metadata_audit.py next --count 50 --max-score 79
```

**Batch Processing**:
```bash
# Mark 10 documents as reviewed
for id in {1..10}; do
    python3 metadata_audit.py mark-reviewed $id
done

# Finalize the round
python3 metadata_audit.py finalize-round --name "Round_$(date +%Y%m%d_%H%M%S)"
```

### Resumability & Data Safety

**Checkpointing**:
- `audit_progress.json`: JSON checkpoint of current progress
- `audit_checkpoints` table: Versioned snapshots of each round
- All changes are in database (persistent)
- Safe to interrupt: Just resume with `next` command

**Rollback**:
- Each checkpoint stores full statistics
- Can query historical progress
- No data is deleted, only audit status changed

### Architecture

**Components**:
- `metadata_audit.py` - CLI tool + main logic
- `issue_detectors.py` - Issue detection algorithms
- Database tables: `library.metadata_audit_log`, `library.audit_checkpoints`
- Log files: `/home/user/projects/veritable-games/resources/logs/metadata_audit.log`

**Database Schema**:
```
library.metadata_audit_log:
  - id (PK)
  - schema_name (library, anarchist, youtube, marxist)
  - document_id (FK)
  - document_slug
  - audit_status (pending, in_review, reviewed, fixed, skipped)
  - quality_score (0-100)
  - issues_detected (JSON array)
  - issues_count (denormalized)
  - audited_by
  - audited_at
  - notes
  - created_at, updated_at

library.audit_checkpoints:
  - round_number (sequential)
  - round_name
  - total_documents
  - pending/reviewed/fixed/skipped counts
  - average_quality_score
  - checkpoint_data (full JSON)
```

## Phase 2: Content Cleanup (In Development)

See `IMPLEMENTATION_PLAN.md` for 3-tier cleanup architecture.

**Expected**: Tier 1 structural cleanup on all documents, Tier 2 formatting on ~30%, Tier 3 manual review on flagged documents.

## Phase 3: Duplicate Detection (In Development)

See `IMPLEMENTATION_PLAN.md` for 3-layer detection (exact match, fuzzy match, near-duplicate).

**Expected**: ~1,200-1,900 duplicate clusters found, ~3-5% corpus reduction after merging.

## Timeline

- **Phase 1**: 2-3 weeks (metadata review and fixes)
- **Phase 2**: 1-2 weeks (cleanup + formatting fixes)
- **Phase 3**: 1 week (duplicate detection + merging)
- **Total**: 3-4 weeks

## Troubleshooting

### Error: "DATABASE_URL environment variable not set"

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games"
```

### Error: "relation 'library.metadata_audit_log' does not exist"

Apply the migration:
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games < \
  /home/user/projects/veritable-games/resources/sql/007-create-metadata-audit-and-duplicate-detection-schema.sql
```

### Documents not showing issues

Run `init` again to recalculate:
```bash
python3 metadata_audit.py init --schema library
```

### Want to start over

```sql
-- Reset audit log
DELETE FROM library.metadata_audit_log;

-- Reset progress
rm /home/user/projects/veritable-games/resources/logs/audit_progress.json
```

## Integration with Existing Tools

**From PDF Reconversion Pipeline**:
- JSON checkpoint patterns
- Batch processing approach
- Resumable-from-interruption design

**From cleanup_pdf_artifacts.py**:
- Artifact detection patterns
- Content normalization
- Database integration

**From tag schema**:
- Reuses `shared.tags` infrastructure
- Tag association preservation during merges

## Future Enhancements

- [ ] Admin UI for audit review (read-only dashboard)
- [ ] Batch metadata import from external sources
- [ ] Smart metadata inference (author from content, date from references)
- [ ] Fuzzy matching to detect if document exists under different name
- [ ] Export audit reports (CSV, JSON)
- [ ] Integrate with cleanup_pdf_artifacts.py for automated Tier 2 cleanup

## Contact & Maintenance

**Created by**: Claude Code AI
**Last Updated**: February 23, 2026
**Logs**: `/home/user/projects/veritable-games/resources/logs/metadata_audit.log`
**Documentation**: This file + `IMPLEMENTATION_PLAN.md`
