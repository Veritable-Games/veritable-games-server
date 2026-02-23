#!/bin/bash

# List of files that need logger import added
files=(
  "src/lib/optimization/analysis-tools.ts"
  "src/lib/optimization/font-optimizer.ts"
  "src/lib/optimization/format-detection.ts"
  "src/lib/profiles/index.ts"
  "src/lib/security/csp.ts"
  "src/lib/security/geolocation.ts"
  "src/lib/security/init.ts"
  "src/lib/stellar/performance/PerformanceValidator.ts"
  "src/lib/stellar/workers/WorkerManager.ts"
  "src/lib/utils/csrf.ts"
  "src/lib/utils/date-formatter.ts"
  "src/lib/utils/response-parser.ts"
  "src/lib/utils/safe-promise.ts"
  "src/lib/workspace/feature-flags.ts"
)

for file in "${files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Skipping $file - not found"
    continue
  fi
  
  # Check if already has logger import
  if grep -q "from '@/lib/utils/logger'" "$file"; then
    echo "Skipping $file - already has logger import"
    continue
  fi
  
  # Find where to insert: after first JSDoc comment or at start
  # Strategy: Find first non-comment, non-empty line and insert before it
  
  # Use awk to find the insertion point and add the import
  awk '
    BEGIN { inserted = 0; in_comment = 0; }
    /^\/\*\*/ { in_comment = 1; }
    in_comment && /\*\/$/ { in_comment = 0; print; next; }
    !inserted && !in_comment && /^[^\/\s]/ && !/^import / { 
      print "import { logger } from '\''@/lib/utils/logger'\'';\n"; 
      inserted = 1; 
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  echo "✓ Added logger import to $file"
done

echo "Done!"
