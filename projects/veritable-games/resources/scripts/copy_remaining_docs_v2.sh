#!/bin/bash

# Get list of slugs and titles from database
echo "Getting list of documents without authors..."
docker exec veritable-games-postgres psql -U postgres -d veritable_games -t -A -F'|' -c "
SELECT id, slug, title
FROM library.library_documents 
WHERE created_by = 3 AND author IS NULL
ORDER BY id;
" > /tmp/remaining_docs.txt

TOTAL=$(wc -l < /tmp/remaining_docs.txt)
echo "Found $TOTAL documents without authors"

# Find and copy files
MARKDOWN_DIR="/home/user/projects/veritable-games/resources/data/library"
TEMP_DIR="/tmp/remaining_docs_temp"
mkdir -p "$TEMP_DIR"

echo "Finding markdown files..."
FOUND=0
NOT_FOUND=0

while IFS='|' read -r id slug title; do
  # Try multiple matching strategies
  FILE=""
  
  # Strategy 1: Exact slug match with wildcard prefix
  FILE=$(find "$MARKDOWN_DIR" -name "*_${slug}.md" -type f 2>/dev/null | head -1)
  
  # Strategy 2: First 80 chars of slug (filenames are truncated)
  if [ -z "$FILE" ]; then
    SLUG_PREFIX=$(echo "$slug" | cut -c1-80)
    FILE=$(find "$MARKDOWN_DIR" -name "*_${SLUG_PREFIX}*.md" -type f 2>/dev/null | head -1)
  fi
  
  # Strategy 3: First 60 chars of slug (more truncated)
  if [ -z "$FILE" ]; then
    SLUG_PREFIX=$(echo "$slug" | cut -c1-60)
    FILE=$(find "$MARKDOWN_DIR" -name "*${SLUG_PREFIX}*.md" -type f 2>/dev/null | head -1)
  fi
  
  if [ -n "$FILE" ]; then
    cp "$FILE" "$TEMP_DIR/"
    ((FOUND++))
    if [ $((FOUND % 50)) -eq 0 ]; then
      echo "  Found and copied $FOUND files..."
    fi
  else
    ((NOT_FOUND++))
    if [ $NOT_FOUND -le 10 ]; then
      echo "  NOT FOUND: $id - $slug" >&2
    fi
  fi
done < /tmp/remaining_docs.txt

echo ""
echo "Files copied to temp directory: $FOUND"
echo "Files not found: $NOT_FOUND"

if [ $FOUND -gt 0 ]; then
  echo ""
  echo "Transferring $FOUND files to laptop..."
  scp -r "$TEMP_DIR"/* user@10.100.0.2:~/Desktop/remaining-documents-analysis/markdown-files/
  
  echo ""
  echo "Verifying on laptop..."
  LAPTOP_COUNT=$(ssh user@10.100.0.2 "ls ~/Desktop/remaining-documents-analysis/markdown-files/ | wc -l")
  echo "Files on laptop: $LAPTOP_COUNT"
fi

# Cleanup
rm -rf "$TEMP_DIR"
rm /tmp/remaining_docs.txt

echo "Done!"
