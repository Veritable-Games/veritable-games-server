#!/bin/bash
################################################################################
# Safe Marker Single - PDF Conversion with Memory Protection
# Wraps marker_single with memory limits and monitoring
################################################################################

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
MONITOR_SCRIPT="$SCRIPT_DIR/memory_monitor.sh"
MEMORY_LIMIT_GB=12  # Maximum 12GB (leaves 3GB for system)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if marker_single is available
if ! command -v marker_single &> /dev/null; then
    echo -e "${RED}Error: marker_single not found${NC}"
    exit 1
fi

# Usage
if [ $# -lt 1 ]; then
    cat << EOF
Usage: $0 <pdf_file> [marker_single_args...]

Safe wrapper for marker_single with:
  - Memory limit: ${MEMORY_LIMIT_GB}GB max
  - Active monitoring: Kills if >80% RAM
  - Resource tracking: CPU and memory logs

Example:
  $0 document.pdf --output_dir output --output_format markdown --disable_multiprocessing

EOF
    exit 1
fi

PDF_FILE="$1"
shift  # Remove first argument, keep the rest

# Check PDF exists
if [ ! -f "$PDF_FILE" ]; then
    echo -e "${RED}Error: PDF file not found: $PDF_FILE${NC}"
    exit 1
fi

# Get PDF info
PDF_NAME=$(basename "$PDF_FILE")
PDF_SIZE=$(du -h "$PDF_FILE" | cut -f1)
PDF_PAGES=$(pdfinfo "$PDF_FILE" 2>/dev/null | grep "Pages:" | awk '{print $2}' || echo "Unknown")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Safe Marker Single - Memory Protected PDF Conversion${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "PDF File:     ${GREEN}$PDF_NAME${NC}"
echo -e "Size:         $PDF_SIZE"
echo -e "Pages:        $PDF_PAGES"
echo -e "Memory Limit: ${YELLOW}${MEMORY_LIMIT_GB}GB${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Start marker_single with memory limit using systemd-run
echo -e "${GREEN}Starting marker_single with ${MEMORY_LIMIT_GB}GB memory limit...${NC}"

# Run with systemd-run for memory limits + start monitoring in background
systemd-run \
    --user \
    --scope \
    -p MemoryMax=${MEMORY_LIMIT_GB}G \
    -p MemoryHigh=$((MEMORY_LIMIT_GB - 1))G \
    marker_single "$PDF_FILE" "$@" &

MARKER_PID=$!

# Wait a moment for process to start
sleep 2

# Find the actual marker_single process (systemd-run spawns a child)
ACTUAL_PID=$(pgrep -P $MARKER_PID marker_single || echo $MARKER_PID)

echo -e "${YELLOW}Process ID: $ACTUAL_PID${NC}"
echo -e "${YELLOW}Starting memory monitor...${NC}"
echo

# Start memory monitor in background
if [ -x "$MONITOR_SCRIPT" ]; then
    "$MONITOR_SCRIPT" "$ACTUAL_PID" "marker_single" &
    MONITOR_PID=$!
else
    echo -e "${YELLOW}Warning: Memory monitor not found, running without monitoring${NC}"
    MONITOR_PID=""
fi

# Wait for marker_single to complete
wait $MARKER_PID
EXIT_CODE=$?

# Stop monitor if running
if [ -n "$MONITOR_PID" ]; then
    kill $MONITOR_PID 2>/dev/null
fi

# Report result
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Conversion completed successfully${NC}"
else
    echo -e "${RED}✗ Conversion failed (exit code: $EXIT_CODE)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit $EXIT_CODE
