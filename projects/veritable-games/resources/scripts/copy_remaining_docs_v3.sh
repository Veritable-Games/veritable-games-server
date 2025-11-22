#!/bin/bash

# Get list of documents without authors
echo "Getting list of documents without authors..."
docker exec veritable-games-postgres psql -U postgres -d veritable_games -t -A -F'|' -c "
SELECT id, slug, title
FROM library.library_documents 
WHERE created_by = 3 AND author IS NULL
ORDER BY id;
" > /tmp/remaining_docs.txt

TOTAL=$(wc -l < /tmp/remaining_docs.txt)
echo "Found $TOTAL documents without authors"

# Search in all markdown subdirectories
SEARCH_PATHS=(
  "/home/user/projects/veritable-games/resources/data/library"
  "/home/user/projects/veritable-games/resources/data/converted-markdown"
)

TEMP_DIR="/tmp/remaining_docs_temp"
mkdir -p "$TEMP_DIR"

echo "Finding markdown files across all data directories..."
FOUND=0
NOT_FOUND=0

while IFS='|' read -r id slug title; do
  FILE=""
  
  # Try to find file by slug across all search paths
  for SEARCH_PATH in "${SEARCH_PATHS[@]}"; do
    if [ -z "$FILE" ]; then
      # Try exact match first
      FILE=$(find "$SEARCH_PATH" -name "*${slug}.md" -type f 2>/dev/null | head -1)
    fi
    
    if [ -z "$FILE" ]; then
      # Try first 80 chars
      SLUG_PREFIX=$(echo "$slug" | cut -c1-80)
      FILE=$(find "$SEARCH_PATH" -name "*${SLUG_PREFIX}*.md" -type f 2>/dev/null | head -1)
    fi
    
    if [ -n "$FILE" ]; then
      break
    fi
  done
  
  if [ -n "$FILE" ]; then
    # Copy with unique name (use ID prefix to avoid duplicates)
    BASENAME=$(basename "$FILE")
    cp "$FILE" "$TEMP_DIR/${id}_${BASENAME}"
    ((FOUND++))
    if [ $((FOUND % 50)) -eq 0 ]; then
      echo "  Found and copied $FOUND files..."
    fi
  else
    ((NOT_FOUND++))
  fi
done < /tmp/remaining_docs.txt

echo ""
echo "Files copied to temp directory: $FOUND"
echo "Files not found: $NOT_FOUND"

if [ $FOUND -gt 0 ]; then
  echo ""
  echo "Transferring $FOUND files to laptop (this may take a few minutes)..."
  scp -r "$TEMP_DIR"/* user@10.100.0.2:~/Desktop/remaining-documents-analysis/markdown-files/
  
  echo ""
  echo "Verifying on laptop..."
  LAPTOP_COUNT=$(ssh user@10.100.0.2 "ls ~/Desktop/remaining-documents-analysis/markdown-files/ | wc -l")
  echo "Files on laptop: $LAPTOP_COUNT"
fi

# Cleanup
rm -rf "$TEMP_DIR"
rm /tmp/remaining_docs.txt

echo ""
echo "Done!"
