#!/bin/bash

# Populate Anarchist Document Descriptions CLI Utility
#
# Extracts the first paragraph from each anarchist document and populates
# the notes field for preview display in grid/list views.
#
# Usage:
#   ./populate-anarchist-descriptions.sh
#
# Environment:
#   API_BASE: API base URL (default: http://localhost:3000)

set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "🏴 Anarchist Document Description Population"
echo "=============================================="
echo ""

echo "📝 Populating descriptions from document content..."
echo "Calling: POST $API_BASE/api/library/admin/anarchist/populate-descriptions"
echo ""

curl -X POST "$API_BASE/api/library/admin/anarchist/populate-descriptions" \
  -H "Content-Type: application/json" \
  -w "\n" | jq '.' 2>/dev/null || echo "Failed to call API. Is the server running?"

echo ""
echo "✓ Done!"
