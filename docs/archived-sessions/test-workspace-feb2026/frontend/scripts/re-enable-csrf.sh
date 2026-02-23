#!/bin/bash
# Script to re-enable CSRF protection across all API routes
# Removes enableCSRF: false, letting it default to true

set -e

echo "Re-enabling CSRF protection on all API routes..."
echo

# Counter
updated=0

# Find all TypeScript files in src/app/api with enableCSRF: false
files=$(find src/app/api -name "*.ts" -type f -exec grep -l "enableCSRF.*false" {} \;)

for file in $files; do
  echo "Processing: $file"

  # Remove lines with enableCSRF: false
  # This handles both patterns:
  # 1. { enableCSRF: false }  → { }
  # 2. { enableCSRF: false, other: value } → { other: value }

  # Use sed to remove enableCSRF: false and clean up formatting
  sed -i.bak \
    -e 's/enableCSRF[[:space:]]*:[[:space:]]*false[[:space:]]*,//g' \
    -e 's/enableCSRF[[:space:]]*:[[:space:]]*false//g' \
    -e 's/{[[:space:]]*,/{/g' \
    -e 's/,[[:space:]]*}/}/g' \
    -e 's/{[[:space:]]*}/{}/' \
    "$file"

  # Remove backup file
  rm "${file}.bak"

  updated=$((updated + 1))
done

echo
echo "✓ Re-enabled CSRF protection on $updated files"
echo "✓ CSRF validation will now be active for all POST/PUT/PATCH/DELETE requests"
echo
echo "Next steps:"
echo "1. Test that CSRF tokens are being generated"
echo "2. Update frontend to include CSRF tokens in API calls"
echo "3. Run: npm run type-check"
