#!/bin/bash
################################################################################
# Memory Monitor for PDF Conversion
# Prevents OOM crashes by monitoring memory usage in real-time
################################################################################

# Configuration
MEMORY_THRESHOLD_PERCENT=80  # Kill process if RAM usage exceeds this
MEMORY_CHECK_INTERVAL=5       # Check every N seconds
LOG_FILE="/home/user/projects/veritable-games/resources/logs/memory_monitor.log"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Get total memory in KB
TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
THRESHOLD_KB=$((TOTAL_MEM * MEMORY_THRESHOLD_PERCENT / 100))

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

get_memory_usage() {
    # Returns used memory in KB
    local used=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    echo $((TOTAL_MEM - used))
}

get_memory_percent() {
    local used=$(get_memory_usage)
    echo $((used * 100 / TOTAL_MEM))
}

check_process_memory() {
    local pid=$1
    if [ -z "$pid" ]; then
        return 0
    fi

    # Check if process exists
    if ! kill -0 "$pid" 2>/dev/null; then
        return 1
    fi

    # Get memory usage
    local mem_percent=$(get_memory_percent)

    if [ "$mem_percent" -ge "$MEMORY_THRESHOLD_PERCENT" ]; then
        log_message "${RED}⚠ CRITICAL: Memory usage at ${mem_percent}% - Killing process $pid${NC}"
        kill -9 "$pid" 2>/dev/null
        return 2
    elif [ "$mem_percent" -ge 70 ]; then
        log_message "${YELLOW}⚠ WARNING: Memory usage at ${mem_percent}%${NC}"
    else
        log_message "${GREEN}✓ Memory OK: ${mem_percent}%${NC}"
    fi

    return 0
}

# Main monitoring function
monitor_process() {
    local pid=$1
    local process_name=${2:-"marker_single"}

    log_message "========================================="
    log_message "Starting memory monitor for PID: $pid ($process_name)"
    log_message "Memory threshold: ${MEMORY_THRESHOLD_PERCENT}%"
    log_message "Total memory: $((TOTAL_MEM / 1024)) MB"
    log_message "========================================="

    while true; do
        check_process_memory "$pid"
        local status=$?

        if [ $status -eq 1 ]; then
            log_message "Process $pid has terminated normally"
            break
        elif [ $status -eq 2 ]; then
            log_message "Process $pid was killed due to high memory usage"
            break
        fi

        sleep "$MEMORY_CHECK_INTERVAL"
    done
}

# Usage information
if [ $# -eq 0 ]; then
    cat << EOF
Usage: $0 <PID> [process_name]

Monitors memory usage and kills the process if it exceeds ${MEMORY_THRESHOLD_PERCENT}%

Example:
  $0 12345 marker_single

Options:
  PID           Process ID to monitor (required)
  process_name  Name of process for logging (optional)

Current memory: $(get_memory_percent)%
EOF
    exit 1
fi

# Start monitoring
monitor_process "$1" "$2"
