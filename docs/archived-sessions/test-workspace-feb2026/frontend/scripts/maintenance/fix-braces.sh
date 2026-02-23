#!/bin/bash

# Fix incomplete withSecurity closing braces

files=(
  "src/app/api/library/documents/[slug]/tags/route.ts"
  "src/app/api/library/tag-categories/[id]/route.ts"
  "src/app/api/library/tag-categories/route.ts"
  "src/app/api/library/tags/[id]/category/route.ts"
  "src/app/api/settings/account/route.ts"
  "src/app/api/settings/profile/route.ts"
  "src/app/api/settings/privacy/route.ts"
  "src/app/api/notifications/route.ts"
  "src/app/api/messages/inbox/route.ts"
  "src/app/api/messages/send/route.ts"
  "src/app/api/messages/conversation/[userId]/route.ts"
  "src/app/api/messages/conversation/[userId]/messages/route.ts"
  "src/app/api/projects/[slug]/revisions/restore/route.ts"
  "src/app/api/wiki/auto-categorize/route.ts"
  "src/app/api/wiki/pages/[slug]/route.ts"
  "src/app/api/wiki/pages/[slug]/tags/route.ts"
  "src/app/api/wiki/pages/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Fixing: $file"
        # Fix patterns like "enableCSRF: true," or "enableCSRF: false," followed by a newline and export/end
        # Replace with "enableCSRF: true});" or "enableCSRF: false});"
        sed -i -E 's/(enableCSRF: (true|false)),\s*$/\1});/g' "$file"
    fi
done

echo "Done!"
