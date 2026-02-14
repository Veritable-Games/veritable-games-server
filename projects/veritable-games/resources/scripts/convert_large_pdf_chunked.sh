#!/bin/bash
# Convert large PDFs by splitting into chunks, converting each, then merging
# Workaround for marker_single memory limitations
#
# Usage: convert_large_pdf_chunked.sh input.pdf output.md [chunk_size]
# Default chunk_size: 150 pages

set -e

INPUT_PDF="$1"
OUTPUT_MD="$2"
CHUNK_SIZE="${3:-150}"  # Pages per chunk

if [ -z "$INPUT_PDF" ] || [ -z "$OUTPUT_MD" ]; then
    echo "Usage: $0 input.pdf output.md [chunk_size]"
    echo "  chunk_size: pages per chunk (default: 150)"
    exit 1
fi

if [ ! -f "$INPUT_PDF" ]; then
    echo "Error: Input file not found: $INPUT_PDF"
    exit 1
fi

# Get PDF info
TOTAL_PAGES=$(pdfinfo "$INPUT_PDF" 2>/dev/null | grep "Pages:" | awk '{print $2}')
if [ -z "$TOTAL_PAGES" ] || [ "$TOTAL_PAGES" -eq 0 ]; then
    echo "Error: Could not determine page count"
    exit 1
fi

PDF_NAME=$(basename "$INPUT_PDF" .pdf)
TEMP_DIR=$(mktemp -d)
MARKER_SINGLE="$HOME/.local/bin/marker_single"

echo "=== Chunked PDF Conversion ==="
echo "Input: $INPUT_PDF"
echo "Output: $OUTPUT_MD"
echo "Total pages: $TOTAL_PAGES"
echo "Chunk size: $CHUNK_SIZE pages"
echo "Temp dir: $TEMP_DIR"
echo ""

# Calculate number of chunks
NUM_CHUNKS=$(( (TOTAL_PAGES + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "Will create $NUM_CHUNKS chunks"
echo ""

# PyTorch memory settings
export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True,max_split_size_mb:256,garbage_collection_threshold:0.7"
export TOKENIZERS_PARALLELISM=false
export OMP_NUM_THREADS=2
export LD_LIBRARY_PATH="$HOME/.local/share/pipx/venvs/marker-pdf/lib/python3.12/site-packages/nvidia/nccl/lib:${LD_LIBRARY_PATH:-}"

# Split and convert each chunk
CHUNK_NUM=0
START_PAGE=1

while [ $START_PAGE -le $TOTAL_PAGES ]; do
    CHUNK_NUM=$((CHUNK_NUM + 1))
    END_PAGE=$((START_PAGE + CHUNK_SIZE - 1))
    if [ $END_PAGE -gt $TOTAL_PAGES ]; then
        END_PAGE=$TOTAL_PAGES
    fi

    CHUNK_PDF="$TEMP_DIR/chunk_$(printf '%03d' $CHUNK_NUM).pdf"
    CHUNK_MD_DIR="$TEMP_DIR/output_$(printf '%03d' $CHUNK_NUM)"

    echo "[$CHUNK_NUM/$NUM_CHUNKS] Pages $START_PAGE-$END_PAGE..."

    # Extract chunk using pdftk
    pdftk "$INPUT_PDF" cat $START_PAGE-$END_PAGE output "$CHUNK_PDF" 2>/dev/null

    if [ ! -f "$CHUNK_PDF" ]; then
        echo "  Error: Failed to extract chunk"
        START_PAGE=$((END_PAGE + 1))
        continue
    fi

    # Convert chunk with marker_single
    mkdir -p "$CHUNK_MD_DIR"

    if timeout 1200 "$MARKER_SINGLE" "$CHUNK_PDF" \
        --output_dir "$CHUNK_MD_DIR" \
        --output_format markdown \
        --disable_multiprocessing \
        --layout_batch_size 2 \
        --detection_batch_size 2 \
        --recognition_batch_size 2 \
        > /dev/null 2>&1; then
        echo "  ✅ Converted"
    else
        echo "  ❌ Failed (will have gap in output)"
    fi

    # Cleanup chunk PDF to save space
    rm -f "$CHUNK_PDF"

    # Kill any orphaned processes
    pkill -9 -f "marker_single" 2>/dev/null || true
    sleep 1

    START_PAGE=$((END_PAGE + 1))
done

echo ""
echo "Merging chunks..."

# Merge all markdown files in order
> "$OUTPUT_MD"  # Clear/create output file

# Add header
echo "---" >> "$OUTPUT_MD"
echo "title: \"$PDF_NAME\"" >> "$OUTPUT_MD"
echo "conversion_method: chunked" >> "$OUTPUT_MD"
echo "chunk_size: $CHUNK_SIZE" >> "$OUTPUT_MD"
echo "total_pages: $TOTAL_PAGES" >> "$OUTPUT_MD"
echo "---" >> "$OUTPUT_MD"
echo "" >> "$OUTPUT_MD"

# Concatenate chunks
for chunk_dir in "$TEMP_DIR"/output_*/; do
    if [ -d "$chunk_dir" ]; then
        # Find the markdown file in the chunk output
        chunk_md=$(find "$chunk_dir" -name "*.md" -type f | head -1)
        if [ -n "$chunk_md" ] && [ -f "$chunk_md" ]; then
            cat "$chunk_md" >> "$OUTPUT_MD"
            echo "" >> "$OUTPUT_MD"
            echo "---" >> "$OUTPUT_MD"
            echo "" >> "$OUTPUT_MD"
        fi
    fi
done

# Cleanup
rm -rf "$TEMP_DIR"

# Final stats
OUTPUT_SIZE=$(wc -c < "$OUTPUT_MD")
OUTPUT_LINES=$(wc -l < "$OUTPUT_MD")

echo ""
echo "=== Complete ==="
echo "Output: $OUTPUT_MD"
echo "Size: $((OUTPUT_SIZE / 1024)) KB"
echo "Lines: $OUTPUT_LINES"
