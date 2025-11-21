#!/bin/bash

cd /home/user/projects/veritable-games/resources/data/library

found=0
not_found=0

echo "Searching for markdown files..."

# Get list of remaining document titles
docker exec veritable-games-postgres psql -U postgres -d veritable_games -t -c "SELECT id, title FROM library.library_documents WHERE created_by = 3 AND author IS NULL ORDER BY id;" | while IFS='|' read -r id title; do
    # Clean up
    id=$(echo "$id" | tr -d ' ')
    title=$(echo "$title" | sed 's/^ *//; s/ *$//')
    
    if [ -z "$id" ] || [ "$id" = "id" ] || [ "$id" = "-" ]; then
        continue
    fi
    
    echo "[$id] Searching for: $title"
    
    # Try different search strategies
    # 1. Search by exact title match in filename
    found_file=$(find . -name "*.md" -type f -exec grep -l "^# ${title}$" {} \; 2>/dev/null | head -1)
    
    # 2. If not found, search for title in content
    if [ -z "$found_file" ]; then
        # Use first 30 chars of title as search term
        search_term=$(echo "$title" | head -c 30)
        if [ -n "$search_term" ] && [ ${#search_term} -gt 5 ]; then
            found_file=$(grep -rl "$search_term" . --include="*.md" 2>/dev/null | head -1)
        fi
    fi
    
    if [ -n "$found_file" ]; then
        filename=$(basename "$found_file")
        echo "  ✓ Found: $filename"
        cp "$found_file" "/tmp/remaining_38_markdown_files/${id}_${filename}"
        ((found++))
    else
        echo "  ✗ Not found"
        ((not_found++))
    fi
done

echo ""
echo "============================================"
echo "Results:"
echo "  Found: $found files"
echo "  Not found: $not_found files"
echo "============================================"
