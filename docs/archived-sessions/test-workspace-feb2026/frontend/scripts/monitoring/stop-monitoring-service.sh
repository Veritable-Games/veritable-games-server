#!/bin/bash

# Stop the health monitoring service

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Veritable Games Monitoring Service...${NC}"

# Find and kill monitoring process
PIDS=$(pgrep -f "health-monitor.js" || true)

if [ -z "$PIDS" ]; then
    echo -e "${YELLOW}⚠️  No monitoring service running${NC}"
    exit 0
fi

echo "Found monitoring processes: $PIDS"

for PID in $PIDS; do
    echo -n "Stopping process $PID... "
    if kill $PID 2>/dev/null; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌ Failed to kill$NC"
    fi
done

# Wait for processes to die
sleep 2

# Check if any are still running
REMAINING=$(pgrep -f "health-monitor.js" || true)
if [ -n "$REMAINING" ]; then
    echo -e "${RED}❌ Some processes still running, forcing kill...${NC}"
    pkill -9 -f "health-monitor.js"
fi

echo -e "${GREEN}✅ Monitoring service stopped${NC}"
