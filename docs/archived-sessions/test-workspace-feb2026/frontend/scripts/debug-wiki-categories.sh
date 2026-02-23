#!/bin/bash
# Temporary debug script for wiki category issue
# Run this in one terminal while server runs in another
# Delete this file when done debugging

echo "=========================================="
echo "Wiki Category Debug Logger"
echo "=========================================="
echo ""
echo "This script monitors server logs for wiki category debug messages."
echo "In another terminal, run: npm run dev"
echo "Then create a wiki page and select a category."
echo ""
echo "Watching for debug logs..."
echo "------------------------------------------"
echo ""

# Color codes for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Monitor the development server process output
# This filters for our specific debug tags
tail -f <(pgrep -f "next dev" | xargs -I {} tail -f /proc/{}/fd/1 2>/dev/null) 2>/dev/null | grep --line-buffered -E "\[Wiki API\]|\[WikiPageService\]" | while read -r line; do
    if [[ $line == *"[Wiki API]"* ]]; then
        echo -e "${GREEN}$line${NC}"
    elif [[ $line == *"WikiPageService"* ]]; then
        if [[ $line == *"Resolved categoryId"* ]]; then
            if [[ $line == *"uncategorized"* ]]; then
                echo -e "${RED}$line${NC}"
            else
                echo -e "${BLUE}$line${NC}"
            fi
        else
            echo -e "${YELLOW}$line${NC}"
        fi
    else
        echo "$line"
    fi
done

# If the above doesn't work (process monitoring might fail), fallback message
if [ $? -ne 0 ]; then
    echo ""
    echo "=========================================="
    echo "Automatic monitoring failed."
    echo "Manual alternative:"
    echo "=========================================="
    echo ""
    echo "In the terminal where 'npm run dev' is running, look for these lines:"
    echo ""
    echo "  [Wiki API] Creating page: ..."
    echo "  [WikiPageService] createPage data: ..."
    echo "  [WikiPageService] Resolved categoryId: ..."
    echo ""
    echo "Copy those lines and share them."
    echo ""
fi
