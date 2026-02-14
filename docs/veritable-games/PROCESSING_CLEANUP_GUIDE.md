# Processing Directory Cleanup Guide

**Created:** February 14, 2026
**Purpose:** Safe cleanup of processing directories after reconversion completion

---

## Directory Status Summary

| Directory | Size | Status | Action |
|-----------|------|--------|--------|
| `reconversion-output-final/` | 265M | **KEEP** | Final markdown output |
| `reconversion-scripts/` | 3.8M | **KEEP** | All phase scripts |
| `reconversion-backups/` | 3.6M | **KEEP** | Metadata CSV backups |
| `nsd-final-archive/` | 856K | **KEEP** | NSD document archive |
| `library-cleaned/` | 4.8M | **KEEP** | Cleaned library files |
| `laptop-library-transfer/` | 15G | **ARCHIVE** | Move to /data/archives |
| `reconversion-output/` | 1.5G | **DELETE** | Intermediate (raw marker) |
| `reconversion-output-with-metadata/` | 1011M | **DELETE** | Intermediate (pre-final) |
| `reconversion-output-phase2c/` | 571M | **DELETE** | Phase 2c intermediate |
| `unconverted-pdfs.OLD/` | 20G | **DELETE** | Old backup (empty dirs) |
| `*-queue/` directories | ~4M | **DELETE** | Conversion queues |
| `temp-chunks/` | varies | **DELETE** | Temporary chunking |
| `nsd-sourcing-temp/` | 1.9M | **DELETE** | Temporary sourcing |

---

## Future Reconversion Workflow

To reconvert new PDFs in the future:

### 1. Source PDFs
Place new PDFs in: `/data/archives/veritable-games/library-pdfs/`

### 2. Run Pipeline
```bash
cd /home/user/projects/veritable-games/resources/processing/reconversion-scripts

# Phase 1: Export metadata & create backups
python3 phase1a_export_metadata.py
python3 phase1b_protect_nsd_documents.py
bash phase1c_backup_database.sh

# Phase 2a: Prepare batch
python3 phase2a_prepare_pdf_batch.py

# Phase 2b: Convert PDFs (GPU)
nohup bash phase2b_convert_pdfs_v3_fixed.sh > ../logs/conversion.log 2>&1 &

# Monitor progress
bash monitor_progress.sh

# Phase 3: Inject metadata
python3 phase3_inject_metadata.py

# Phase 4: Update database
python3 phase4_generate_update_sql.py           # Dry run
python3 phase4_generate_update_sql.py --execute # Execute

# Phase 5: Verify
python3 phase5_verify_metadata.py

# Phase 6: Cleanup
python3 phase6_cleanup_and_report.py
```

### 3. Alternative: Single PDF Conversion
```bash
# Convert single PDF
marker_single "document.pdf" \
  --output_dir "output" \
  --output_format markdown \
  --disable_multiprocessing

# Clean artifacts
python3 /home/user/projects/veritable-games/resources/scripts/cleanup_pdf_artifacts.py \
  --file "output/document.md" \
  --skip-ocr \
  --output "document-CLEANED.md"
```

---

## Safe Cleanup Commands

### Step 1: Archive laptop PDFs first
```bash
# Move laptop PDFs to permanent archive
mv /home/user/projects/veritable-games/resources/processing/laptop-library-transfer/* \
   /data/archives/veritable-games/library-pdfs/

# Remove empty directory
rmdir /home/user/projects/veritable-games/resources/processing/laptop-library-transfer/
```

### Step 2: Remove intermediate outputs
```bash
cd /home/user/projects/veritable-games/resources/processing

# Remove intermediate output directories
rm -rf reconversion-output/
rm -rf reconversion-output-with-metadata/
rm -rf reconversion-output-phase2c/

# Remove queue directories
rm -rf small-queue/
rm -rf medium-queue/
rm -rf large-queue/
rm -rf xlarge-queue/
rm -rf unconverted-queue/

# Remove temp directories
rm -rf temp-chunks/
rm -rf nsd-sourcing-temp/

# Remove old backup (contains only empty dirs)
rm -rf unconverted-pdfs.OLD/
```

### Step 3: Verify critical directories preserved
```bash
# These should still exist:
ls -la reconversion-output-final/     # Final markdown
ls -la reconversion-scripts/          # Phase scripts
ls -la reconversion-backups/          # Metadata CSVs
ls -la nsd-final-archive/             # NSD archive
ls -la library-cleaned/               # Cleaned library
```

---

## Key Scripts Reference

| Script | Purpose |
|--------|---------|
| `phase0_link_laptop_metadata.py` | Link PDFs to archived metadata |
| `phase1a_export_metadata.py` | Export all metadata |
| `phase1b_protect_nsd_documents.py` | Install NSD protection trigger |
| `phase1c_backup_database.sh` | Full database backup |
| `phase2a_prepare_pdf_batch.py` | Create PDF symlinks |
| `phase2b_convert_pdfs_v3_fixed.sh` | GPU conversion (production) |
| `phase3_inject_metadata.py` | Inject YAML frontmatter |
| `phase4_generate_update_sql.py` | Database import |
| `phase5_verify_metadata.py` | Verification |
| `phase6_cleanup_and_report.py` | Final cleanup |
| `fix_remaining_docs.py` | Fuzzy match remaining docs |
| `import_converted_docs.py` | Import via title matching |
| `restore_nsd_tags.py` | Restore tag associations |

---

## Documentation References

- **Complete Workflow:** `reconversion-scripts/README_COMPLETE_WORKFLOW.md`
- **Autonomous Operation:** `reconversion-scripts/README_AUTONOMOUS_OPERATION.md`
- **PDF Conversion:** `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`
- **Laptop Reconversion:** `/home/user/docs/veritable-games/LAPTOP_PDF_RECONVERSION_DECEMBER_2025.md`

---

## Space Recovery Summary

After cleanup:
- **Freed:** ~37.5 GB (20G old backup + 15G laptop PDFs moved + 2.5G intermediate)
- **Preserved:** ~280 MB (final output + scripts + backups)
