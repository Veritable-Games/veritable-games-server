#!/bin/bash

# Extract Author and Date from Anarchist Documents
#
# Reads YAML frontmatter from all anarchist markdown files and extracts:
# - author field
# - date field (with normalization)
#
# Usage:
#   ./extract-anarchist-author-date.sh          # Live mode - updates database
#   ./extract-anarchist-author-date.sh dry-run  # Dry run - no database changes
#
# Environment:
#   API_BASE: API base URL (default: http://localhost:3000)

set -e

API_BASE="${API_BASE:-http://localhost:3000}"
DRYRUN="${1:-}"

if [ "$DRYRUN" = "dry-run" ] || [ "$DRYRUN" = "--dry-run" ]; then
  MODE="dry-run"
  URL_PARAM="?dryRun=true"
else
  MODE="live"
  URL_PARAM=""
fi

echo "🏴 Anarchist Library Author/Date Extraction"
echo "=============================================="
echo ""
echo "Mode: $MODE"
echo ""

echo "📝 Extracting author and date from document frontmatter..."
echo "Calling: POST $API_BASE/api/library/admin/anarchist/extract-author-date${URL_PARAM}"
echo ""

# Call the API and capture response
RESPONSE=$(curl -s -X POST "$API_BASE/api/library/admin/anarchist/extract-author-date${URL_PARAM}" \
  -H "Content-Type: application/json")

# Check if request was successful
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  # Extract the report from response
  REPORT=$(echo "$RESPONSE" | jq -r '.report')
  FILENAME=$(echo "$RESPONSE" | jq -r '.report_filename')
  STATS=$(echo "$RESPONSE" | jq '.statistics')

  # Save report to file
  echo "$REPORT" > "/tmp/$FILENAME"

  echo "✓ Extraction complete!"
  echo ""
  echo "Statistics:"
  echo "  Documents processed: $(echo "$STATS" | jq '.documents_processed')"
  echo "  Authors extracted: $(echo "$STATS" | jq '.authors_extracted')"
  echo "  Dates extracted: $(echo "$STATS" | jq '.dates_extracted')"
  echo "  Missing authors: $(echo "$STATS" | jq '.missing_authors')"
  echo "  Missing dates: $(echo "$STATS" | jq '.missing_dates')"
  echo "  Files not found: $(echo "$STATS" | jq '.files_not_found')"
  echo ""
  echo "Report saved to: /tmp/$FILENAME"
  echo ""
  echo "To view report:"
  echo "  cat /tmp/$FILENAME"
  echo ""

  if [ "$MODE" = "dry-run" ]; then
    echo "⚠️  DRY RUN - No database changes were made"
    echo "To apply changes, run: ./extract-anarchist-author-date.sh"
  else
    echo "✓ Database has been updated with extracted author/date information"
  fi
else
  echo "❌ API request failed!"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
