#!/bin/bash

# Batch convert console statements to logger in all files

echo "Finding all TypeScript/JavaScript files with console statements..."

FILES=$(grep -r "console\." src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude="*logger*" -l | sort)

TOTAL=$(echo "$FILES" | wc -l)
CURRENT=0

echo "Found $TOTAL files to process"
echo ""

for file in $FILES; do
  ((CURRENT++))
  echo "[$CURRENT/$TOTAL] Processing: $file"
  node scripts/convert-console-to-logger.js "$file" 2>&1 | grep -E "(Converted|Remaining)"
done

echo ""
echo "✓ Batch conversion complete!"
echo ""
echo "Checking remaining console statements..."
REMAINING=$(grep -r "console\." src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude="*logger*" | wc -l)
echo "Remaining console statements: $REMAINING"
