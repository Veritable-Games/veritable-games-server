#!/bin/bash
# Temporary debug capture script for wiki category issue
# DELETE THIS FILE when debugging is complete

echo "=========================================="
echo "Wiki Category Debug Capture Tool"
echo "=========================================="
echo ""
echo "INSTRUCTIONS:"
echo "1. Run your dev server with: npm run dev 2>&1 | tee server.log"
echo "2. Create a wiki page with a category selected"
echo "3. Press Ctrl+C to stop the server"
echo "4. Run this script again to extract the debug logs"
echo ""
echo "OR run this NOW to monitor in real-time:"
echo "   npm run dev 2>&1 | ./capture-wiki-debug.sh"
echo ""
echo "=========================================="
echo ""

# If being piped to (real-time monitoring)
if [ -p /dev/stdin ]; then
    echo "📡 Monitoring server output for wiki debug messages..."
    echo ""
    grep --line-buffered --color=always -E "\[Wiki API\]|\[WikiPageService\]" | while read -r line; do
        echo "$(date '+%H:%M:%S') | $line"
    done
# If running standalone (extract from log file)
elif [ -f "server.log" ]; then
    echo "📋 Extracting wiki debug messages from server.log..."
    echo ""
    grep -E "\[Wiki API\]|\[WikiPageService\]" server.log | tail -20
    echo ""
    echo "=========================================="
    echo "If you see the logs above, copy them."
    echo "If not, the server.log might not exist yet."
    echo "=========================================="
else
    echo "⚠️  No input detected."
    echo ""
    echo "Usage Option 1 (Real-time monitoring):"
    echo "  cd frontend"
    echo "  npm run dev 2>&1 | ../capture-wiki-debug.sh"
    echo ""
    echo "Usage Option 2 (Capture to file first):"
    echo "  cd frontend"
    echo "  npm run dev 2>&1 | tee ../server.log"
    echo "  # Create a wiki page, then Ctrl+C"
    echo "  cd .."
    echo "  ./capture-wiki-debug.sh"
    echo ""
fi
