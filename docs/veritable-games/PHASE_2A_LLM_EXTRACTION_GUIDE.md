# Phase 2A: LLM-Based Metadata Extraction Guide

**Date**: November 20, 2025
**Status**: Ready for pilot test

---

## Overview

Phase 2A uses Claude 3.5 Haiku to extract author and publication date metadata from library documents using contextual understanding and intelligent inference.

**Goals**:
- Target: 3,353 documents without metadata
- Expected success: 75-85%
- Estimated cost: ~$21 for full run
- Processing time: ~2 hours automated

---

## Prerequisites

### 1. Set Anthropic API Key

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

**Get API key**: https://console.anthropic.com/settings/keys

### 2. Install Anthropic Python Library

```bash
pip3 install anthropic
```

### 3. Verify Database Connection

```bash
# Check PostgreSQL is accessible
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM library.library_documents WHERE created_by = 3 AND (author IS NULL OR author = '' OR publication_date IS NULL OR publication_date = '');"
```

Should show ~3,353 documents needing metadata.

---

## Pilot Test (Recommended First Step)

**Purpose**: Test extraction quality on 50 documents before full run.

### Step 1: Dry Run (No Database Changes)

```bash
cd /home/user/projects/veritable-games/resources/scripts

python3 extract_library_metadata_llm.py --pilot --dry-run
```

**What this does**:
- Processes first 50 documents
- Shows extracted metadata
- No database updates
- Estimates cost/quality

**Expected output**:
```
[    1/50] Processing: Document Title Here
          File: 01_Category_Type_slug.md
          ✓ Author: Jane Doe (conf: 95%)
          ✓ Date: 1995 (conf: 85%)
          Notes: Date inferred from historical context...
```

### Step 2: Real Pilot Run (Updates Database)

```bash
python3 extract_library_metadata_llm.py --pilot
```

**What this does**:
- Processes first 50 documents
- Updates database with high-confidence metadata
- Creates checkpoint: `checkpoints/batch_0001.json`
- Shows cost and success metrics

**Expected cost**: ~$0.30 for 50 documents

### Step 3: Evaluate Results

```bash
# Check updated documents
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT id, title, author, publication_date
FROM library.library_documents
WHERE created_by = 3
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY id
LIMIT 20;
"
```

**Success criteria**:
- ≥75% extraction rate (≥38 of 50 documents updated)
- ≥90% accuracy on manual spot-check (review 10 random samples)
- No obvious false positives (wrong authors, conversion dates as publication dates)

---

## Full Extraction (After Successful Pilot)

### Option 1: Full Run (All Remaining Documents)

```bash
python3 extract_library_metadata_llm.py --confidence-threshold 70
```

**What this does**:
- Processes all 3,353 documents without metadata
- Creates checkpoints every 50 documents
- Estimated cost: ~$21
- Estimated time: ~2 hours

**Checkpoints saved to**: `checkpoints/batch_NNNN.json`

### Option 2: Resume from Checkpoint (If Interrupted)

```bash
python3 extract_library_metadata_llm.py --resume checkpoints/batch_0042.json
```

**Use this if**:
- Process was interrupted
- You want to continue from where you left off
- API rate limits hit

### Option 3: Custom Batch Processing

```bash
# Process in smaller chunks
python3 extract_library_metadata_llm.py --limit 500

# Then resume
python3 extract_library_metadata_llm.py --resume checkpoints/batch_0010.json --limit 500
```

---

## Configuration Options

### Confidence Threshold

```bash
# More conservative (higher quality, fewer results)
python3 extract_library_metadata_llm.py --confidence-threshold 85

# More aggressive (more results, lower quality)
python3 extract_library_metadata_llm.py --confidence-threshold 60
```

**Default**: 70 (good balance)

### Batch Size

```bash
# Smaller batches (more frequent checkpoints)
python3 extract_library_metadata_llm.py --batch-size 25

# Larger batches (fewer checkpoints)
python3 extract_library_metadata_llm.py --batch-size 100
```

**Default**: 50 (recommended)

---

## Monitoring Progress

### Real-Time Progress

The script displays:
- Document being processed
- Extracted metadata
- Confidence scores
- Checkpoint saves
- Running cost

Example output:
```
[  127/3353] Processing: The Conquest of Bread
          File: 01_Political_Theory_Book_the-conquest-of-bread.md
          ✓ Author: Peter Kropotkin (conf: 98%)
          ✓ Date: 1892 (conf: 95%)
          Notes: Explicitly stated in document header
          ✓ Database updated

          💾 Checkpoint saved: batch_0003.json
          Progress: 150/3353 (4%)
          Cost so far: $0.9243
```

### Check Database Progress

```bash
# Count documents with metadata
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT
  COUNT(*) as total,
  COUNT(author) as with_author,
  COUNT(publication_date) as with_date,
  COUNT(CASE WHEN author IS NOT NULL AND publication_date IS NOT NULL THEN 1 END) as with_both
FROM library.library_documents
WHERE created_by = 3;
"
```

### Review Checkpoint

```bash
cat checkpoints/batch_0010.json | jq '.stats'
```

Shows:
- Documents processed
- Confidence distribution
- API errors
- Total cost

---

## Quality Assurance

### Spot-Check High-Confidence Extractions (5%)

```bash
# Get 20 random high-confidence extractions
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT id, title, author, publication_date
FROM library.library_documents
WHERE created_by = 3
  AND updated_at > NOW() - INTERVAL '1 day'
  AND author IS NOT NULL
ORDER BY RANDOM()
LIMIT 20;
" > /tmp/spot_check_high.txt

# Manually review these
```

**Check for**:
- Author names look reasonable
- Dates in valid range (1800-2024)
- No conversion timestamps as publication dates
- No document titles extracted as authors

### Review Medium-Confidence Extractions (20%)

Medium confidence (70-89%) should be reviewed more thoroughly.

```bash
# Export for review
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
COPY (
  SELECT id, title, author, publication_date, slug
  FROM library.library_documents
  WHERE created_by = 3
    AND updated_at > NOW() - INTERVAL '1 day'
  ORDER BY id
) TO STDOUT WITH CSV HEADER
" > /tmp/phase2a_results.csv
```

Review in spreadsheet or text editor.

---

## Troubleshooting

### API Key Error

```
ERROR: ANTHROPIC_API_KEY environment variable not set
```

**Fix**:
```bash
export ANTHROPIC_API_KEY='your-key-here'
```

Make permanent by adding to `~/.bashrc`:
```bash
echo "export ANTHROPIC_API_KEY='your-key-here'" >> ~/.bashrc
source ~/.bashrc
```

### API Rate Limit Hit

```
API Error: rate_limit_error
```

**Fix**: Script has built-in 1-second delay between requests. If still hitting limits, use smaller batches:
```bash
python3 extract_library_metadata_llm.py --batch-size 25
```

Or wait and resume:
```bash
# Wait 1 minute, then resume
python3 extract_library_metadata_llm.py --resume checkpoints/batch_NNNN.json
```

### Low Extraction Rate

If <75% of documents getting metadata:

1. **Check confidence threshold** (may be too high):
   ```bash
   python3 extract_library_metadata_llm.py --confidence-threshold 60
   ```

2. **Review failed extractions** in logs
3. **Consider Phase 2B** (deep analysis with more content)

### Validation Failures

```
⚠️  Validation failed: Date confidence 65 below threshold 70
```

**This is normal** - script is being conservative to ensure quality. Documents with low confidence are skipped, not updated with poor-quality data.

---

## Expected Results

### Success Metrics

| Metric | Target | Calculation |
|--------|--------|-------------|
| **Extraction rate** | 75-85% | Documents updated / Documents processed |
| **High confidence** | 60-70% | Confidence ≥90% |
| **Medium confidence** | 15-25% | Confidence 70-89% |
| **Accuracy** | ≥90% | Spot-check validation |

### Cost Breakdown

| Phase | Documents | Est. Cost |
|-------|-----------|-----------|
| Pilot test | 50 | $0.30 |
| Full run | 3,353 | $21.00 |
| **Total** | **3,403** | **~$21.30** |

*Based on Haiku pricing: $0.25/MTok input, $1.25/MTok output*

### Expected Coverage After Phase 2A

| Metric | Before Phase 2A | After Phase 2A | Improvement |
|--------|-----------------|----------------|-------------|
| Documents with metadata | 527 (13.6%) | 3,027-3,377 (78-87%) | +2,500-2,850 |
| Documents with author | 468 (12.1%) | 2,900-3,300 (75-85%) | +2,432-2,832 |
| Documents with date | 527 (13.6%) | 2,900-3,300 (75-85%) | +2,373-2,773 |

---

## Next Steps After Phase 2A

1. **Generate quality report**
   - Review checkpoints
   - Analyze confidence distribution
   - Calculate actual success rate

2. **Human review** (based on confidence)
   - High confidence (≥90%): Spot-check 5%
   - Medium confidence (70-89%): Review 20-100%
   - Correct any errors found

3. **Decide on Phase 2B** (optional)
   - If success rate <75%, consider Phase 2B
   - Phase 2B: Deep analysis (5000 words, $19)
   - Target: Low-confidence and failed documents

4. **Frontend verification**
   - Check grid view displays authors
   - Check list view shows dates
   - Verify search/filter functionality

---

## Files and Locations

| File | Location |
|------|----------|
| **Extraction script** | `/home/user/projects/veritable-games/resources/scripts/extract_library_metadata_llm.py` |
| **Checkpoints** | `/home/user/projects/veritable-games/resources/scripts/checkpoints/batch_NNNN.json` |
| **This guide** | `/home/user/docs/veritable-games/PHASE_2A_LLM_EXTRACTION_GUIDE.md` |
| **Phase 1 report** | `/home/user/docs/veritable-games/LIBRARY_METADATA_EXTRACTION_REPORT.md` |
| **Library data** | `/home/user/projects/veritable-games/resources/data/library/*.md` |

---

## Quick Command Reference

```bash
# Set API key (required)
export ANTHROPIC_API_KEY='your-key-here'

# Pilot test (dry run)
python3 extract_library_metadata_llm.py --pilot --dry-run

# Pilot test (real)
python3 extract_library_metadata_llm.py --pilot

# Full run
python3 extract_library_metadata_llm.py

# Resume from checkpoint
python3 extract_library_metadata_llm.py --resume checkpoints/batch_0042.json

# Check progress
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM library.library_documents WHERE created_by = 3 AND author IS NOT NULL AND publication_date IS NOT NULL;"
```

---

**Last Updated**: November 20, 2025
**Next**: Run pilot test and evaluate results
