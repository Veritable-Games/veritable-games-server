# Resume PDF Conversions (Post-Crash Recovery)

## Crash Summary (2025-11-29 19:16-19:37)

**What Happened:**
- OOM (Out of Memory) crash from `marker_single` processes
- Each process consumed ~14-15GB RAM on 15GB system
- 3 OOM kills before final system crash

**Recovery Status:**
- ✅ System rebooted and stable
- ✅ All Docker containers healthy
- ✅ Progress file intact (1916 completed, 81 failed)

---

## Current Progress

| Metric | Count |
|--------|-------|
| Total PDFs | 2,626 |
| Completed | 1,916 |
| Failed | 81 |
| Remaining | **629** |
| Progress | **73.0%** |

**Last Successful:** State capitalism in Russia - Murray Bookchin.pdf (#1879)
**Last Attempted:** State Formation in Korea - Gina Barnes.pdf (#1880) - **INCOMPLETE**

---

## Safety Improvements Installed

### 1. Memory Monitor Script
**Location:** `/home/user/projects/veritable-games/resources/scripts/memory_monitor.sh`

- Real-time memory monitoring (checks every 5 seconds)
- Kills process if RAM usage exceeds 80%
- Logs all memory events

**Usage:**
```bash
# Monitor a running process
bash memory_monitor.sh <PID> [process_name]
```

### 2. Safe Marker Single Wrapper
**Location:** `/home/user/projects/veritable-games/resources/scripts/safe_marker_single.sh`

- Hard memory limit: 12GB maximum
- Automatic monitoring
- systemd-run integration for enforcement

**Usage:**
```bash
bash safe_marker_single.sh document.pdf \
  --output_dir output \
  --output_format markdown \
  --disable_multiprocessing
```

---

## How to Resume (SAFE METHOD)

### Option A: Resume Full Batch (Recommended)

The existing batch script already has protection, just ensure ONLY ONE runs:

```bash
cd /home/user/projects/veritable-games/resources/processing/reconversion-scripts

# Check no conversions are running
ps aux | grep marker_single

# If none running, start batch conversion
nohup bash phase2b_convert_pdfs_v3_fixed.sh > phase2b_resume.log 2>&1 &

# Monitor progress (shows every 100 PDFs)
tail -f ../logs/phase2b_conversion.log
```

**Built-in Protection:**
- ✅ Memory monitor (12GB limit)
- ✅ Resumable (skips completed PDFs)
- ✅ Timeout per PDF (10-30 min)
- ✅ Automatic retry tracking

### Option B: Manual Single PDF Conversion (Testing)

For testing or problematic PDFs:

```bash
cd /home/user/projects/veritable-games/resources/processing

# Test with safe wrapper
bash /home/user/projects/veritable-games/resources/scripts/safe_marker_single.sh \
  "reconversion-pdfs/State Formation in Korea - Gina Barnes.pdf" \
  --output_dir reconversion-output \
  --output_format markdown \
  --disable_multiprocessing

# Then cleanup
python3 ../scripts/cleanup_pdf_artifacts.py \
  --file "reconversion-output/State Formation in Korea - Gina Barnes/State Formation in Korea - Gina Barnes.md" \
  --skip-ocr \
  --output "reconversion-output-with-metadata/State Formation in Korea - Gina Barnes.md"
```

---

## Monitoring Commands

### Check System Resources
```bash
# Memory usage
free -h

# Swap usage
swapon --show

# Current memory percent
free | grep Mem | awk '{printf "%.1f%%\n", $3/$2 * 100}'
```

### Check Conversion Status
```bash
# Running conversions
ps aux | grep marker_single

# Memory usage of marker_single
ps aux | grep marker_single | awk '{print $6/1024 " MB"}'

# Progress stats
python3 -c "
import json
data = json.load(open('/home/user/projects/veritable-games/resources/processing/reconversion-scripts/phase2b_progress.json'))
print(f'Completed: {len(data.get(\"completed\", []))}')
print(f'Failed: {len(data.get(\"attempted_failed\", []))}')
print(f'Remaining: {2626 - len(data.get(\"completed\", [])) - len(data.get(\"attempted_failed\", []))}')
"
```

### Monitor Conversion Log
```bash
# Real-time log
tail -f /home/user/projects/veritable-games/resources/logs/phase2b_conversion.log

# Memory monitor log
tail -f /home/user/projects/veritable-games/resources/logs/memory_monitor.log
```

---

## Critical Rules

### ❌ DO NOT:
1. **Run multiple conversions simultaneously** - Will cause OOM crash
2. **Run PDF conversion + NSD cleanup together** - Will cause OOM crash
3. **Process large PDFs (>200 pages) without monitoring** - High risk
4. **Ignore swap usage warnings** - Indicates memory pressure

### ✅ DO:
1. **Run ONE conversion process at a time**
2. **Monitor memory usage** - Keep below 80%
3. **Check progress regularly** - Ensure it's advancing
4. **Let timeouts work** - They prevent infinite hangs

---

## Emergency Stop

If memory usage gets too high:

```bash
# Find marker_single processes
ps aux | grep marker_single

# Kill them (replace <PID> with actual process ID)
kill -9 <PID>

# Check memory recovered
free -h
```

---

## Expected Performance

- **Small PDFs (<10MB, <50 pages):** 1-3 minutes
- **Medium PDFs (10-50MB, 50-200 pages):** 3-10 minutes
- **Large PDFs (>50MB, >200 pages):** 10-30 minutes
- **Memory per PDF:** 8-15GB typical

**Estimate for 629 remaining:**
- Average: 5 minutes per PDF
- Total time: ~52 hours (2.2 days)
- Recommended: Run in `screen` or `tmux` session

---

## Verification After Completion

```bash
# Count outputs
find reconversion-output-with-metadata -name "*.md" | wc -l

# Should match: completed count in progress file
python3 -c "
import json
data = json.load(open('/home/user/projects/veritable-games/resources/processing/reconversion-scripts/phase2b_progress.json'))
print(f'Expected outputs: {len(data.get(\"completed\", []))}')
"
```

---

## Next Steps After Completion

1. Review failed PDFs (81 currently)
2. Attempt manual conversion of large/problematic PDFs
3. Proceed to Stage 2A: Metadata Extraction
4. See: `/home/user/projects/veritable-games/MASTER_WORKFLOW_TIMELINE.md`

---

**Created:** 2025-11-29
**Status:** Ready to resume
**Estimated Completion:** 2-3 days (if running continuously)
