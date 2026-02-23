#!/bin/bash
# Fix files with missing closing braces after enableCSRF

files=(
  "src/app/api/news/[slug]/route.ts"
  "src/app/api/news/route.ts"
  "src/app/api/wiki/categories/route.ts"
  "src/app/api/wiki/infoboxes/[id]/route.ts"
  "src/app/api/wiki/infoboxes/route.ts"
  "src/app/api/wiki/pages/validate/route.ts"
  "src/app/api/wiki/templates/[id]/route.ts"
  "src/app/api/wiki/templates/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        # Replace "enableCSRF: true," at end of line followed by blank line with "enableCSRF: true});"
        sed -i 's/enableCSRF: true,\s*$/enableCSRF: true});/g' "$file"
    fi
done
