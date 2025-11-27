#!/bin/bash

# Import anarchist documents from markdown files into PostgreSQL

CONVERTED_DIR=~/converted-markdown
IMPORTED=0
SKIPPED=0
TOTAL=0

echo "Found  markdown files"
echo "Starting import..."

find "" -name '*.md' -print0 | while IFS= read -r -d '' md_file; do
  ((IMPORTED++))
  
  # Extract relative path for database storage
  REL_PATH=${md_file#/}
  SLUG=$(basename "" .md)
  
  # Extract title from first line after frontmatter
  TITLE=$(python3 -c "
import yaml, sys
with open('', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()
    import re
    match = re.match(r'^---\\n(.*?)\\n---', content, re.DOTALL)
    if match:
        meta = yaml.safe_load(match.group(1)) or {}
        print(meta.get('title', ''))
    else:
        print('')
" 2>/dev/null || echo "")
  
  # Get language from directory
  LANG=$(echo "" | grep -o 'anarchist_library_texts_[^/]*' | sed 's/anarchist_library_texts_//')
  [ -z "$LANG" ] && LANG='en'
  
  # Insert record (simplified - title only)
  docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
    INSERT INTO anarchist.documents (slug, title, language, file_path, category)
    VALUES ('', '', 'en_US.UTF-8', '', 'anarchist-en_US.UTF-8')
    ON CONFLICT (slug) DO NOTHING;
  " 2>/dev/null
  
  if [ 0 -eq 0 ]; then
    PCT=$((IMPORTED * 100 / TOTAL))
    echo "[/] % imported"
  fi
done

echo "Import complete:  documents"
