#!/bin/bash

# Get list of slugs from database
echo "Getting list of documents without authors..."
docker exec veritable-games-postgres psql -U postgres -d veritable_games -t -c "
SELECT slug 
FROM library.library_documents 
WHERE created_by = 3 AND author IS NULL
ORDER BY slug;
" | sed 's/^ *//' | grep -v '^$' > /tmp/remaining_slugs.txt

TOTAL=$(wc -l < /tmp/remaining_slugs.txt)
echo "Found $TOTAL documents without authors"

# Find and copy files
MARKDOWN_DIR="/home/user/projects/veritable-games/resources/data/library"
TEMP_DIR="/tmp/remaining_docs_temp"
mkdir -p "$TEMP_DIR"

echo "Finding markdown files..."
FOUND=0
NOT_FOUND=0

while read slug; do
  # Find file with this slug (handle category prefix)
  FILE=$(find "$MARKDOWN_DIR" -name "*${slug}.md" -type f | head -1)
  
  if [ -n "$FILE" ]; then
    cp "$FILE" "$TEMP_DIR/"
    ((FOUND++))
    if [ $((FOUND % 50)) -eq 0 ]; then
      echo "  Copied $FOUND files..."
    fi
  else
    ((NOT_FOUND++))
  fi
done < /tmp/remaining_slugs.txt

echo ""
echo "Files copied to temp directory: $FOUND"
echo "Files not found: $NOT_FOUND"
echo ""
echo "Transferring to laptop..."

# Transfer to laptop
scp -r "$TEMP_DIR"/* user@10.100.0.2:~/Desktop/remaining-documents-analysis/markdown-files/

echo ""
echo "Verifying on laptop..."
ssh user@10.100.0.2 "ls ~/Desktop/remaining-documents-analysis/markdown-files/ | wc -l"

# Cleanup
rm -rf "$TEMP_DIR"
rm /tmp/remaining_slugs.txt

echo "Done!"
