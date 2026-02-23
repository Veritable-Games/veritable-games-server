#!/bin/bash

# Import Anarchist Tags CLI Utility
#
# Usage:
#   ./import-anarchist-tags.sh import         # Import tag categories and tags
#   ./import-anarchist-tags.sh auto-tag       # Auto-tag documents
#   ./import-anarchist-tags.sh auto-tag 20    # Auto-tag with confidence threshold 20%
#   ./import-anarchist-tags.sh all            # Run both import and auto-tag
#
# This script requires the API to be running or use curl to call the endpoints

set -e

API_BASE="${API_BASE:-http://localhost:3000}"
COMMAND="${1:-help}"
CONFIDENCE="${2:-15}"

echo "🏴 Anarchist Tag Import Utility"
echo "================================"
echo ""

case "$COMMAND" in
  import)
    echo "📁 Importing anarchist tag categories and tags..."
    echo "Calling: POST $API_BASE/api/library/admin/tags/import"
    echo ""

    curl -X POST "$API_BASE/api/library/admin/tags/import" \
      -H "Content-Type: application/json" \
      -w "\n" | jq '.' 2>/dev/null || echo "Failed to call API. Is the server running?"
    ;;

  auto-tag)
    echo "🔖 Auto-tagging documents with confidence threshold: $CONFIDENCE%"
    echo "Calling: POST $API_BASE/api/library/admin/tags/auto-tag?confidence=$CONFIDENCE"
    echo ""

    curl -X POST "$API_BASE/api/library/admin/tags/auto-tag?confidence=$CONFIDENCE" \
      -H "Content-Type: application/json" \
      -w "\n" | jq '.' 2>/dev/null || echo "Failed to call API. Is the server running?"
    ;;

  all)
    echo "🏴 Running full anarchist tag import workflow..."
    echo ""

    echo "Step 1: Import categories and tags"
    curl -X POST "$API_BASE/api/library/admin/tags/import" \
      -H "Content-Type: application/json" \
      -w "\n" | jq '.statistics // .error' 2>/dev/null || echo "Failed"

    echo ""
    echo "Step 2: Auto-tag documents (confidence: $CONFIDENCE%)"
    curl -X POST "$API_BASE/api/library/admin/tags/auto-tag?confidence=$CONFIDENCE" \
      -H "Content-Type: application/json" \
      -w "\n" | jq '.statistics // .error' 2>/dev/null || echo "Failed"

    echo ""
    echo "✓ Workflow complete!"
    ;;

  *)
    echo "Usage: ./import-anarchist-tags.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  import              Import anarchist tag categories and tags"
    echo "  auto-tag [confidence] Auto-tag documents (default confidence: 15%)"
    echo "  all [confidence]    Run complete workflow (import + auto-tag)"
    echo ""
    echo "Examples:"
    echo "  ./import-anarchist-tags.sh import"
    echo "  ./import-anarchist-tags.sh auto-tag 20"
    echo "  ./import-anarchist-tags.sh all 25"
    echo ""
    echo "Requirements:"
    echo "  - Node.js API server running on localhost:3000 (or set API_BASE env var)"
    echo "  - curl and jq installed"
    ;;
esac
