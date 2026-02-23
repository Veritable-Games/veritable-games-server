#!/bin/bash

echo "🔧 Fixing styled-jsx runtime errors - Comprehensive Solution"
echo "==========================================================="

# Stop any running processes
echo "1. Stopping any running Next.js processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true

# Clear all caches
echo "2. Clearing all caches..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules/.babel-cache 2>/dev/null || true
rm -rf node_modules/styled-jsx 2>/dev/null || true

# Clear package manager caches
echo "3. Clearing package manager caches..."
npm cache clean --force 2>/dev/null || true
yarn cache clean 2>/dev/null || true

# Reinstall dependencies to ensure polyfill is used
echo "4. Reinstalling dependencies with styled-jsx polyfill..."
npm install

# Verify styled-jsx is replaced with our polyfill
echo "5. Verifying styled-jsx replacement..."
if [ -f "node_modules/styled-jsx/package.json" ]; then
    echo "⚠️  Warning: styled-jsx still exists in node_modules"
    echo "   Attempting to remove and replace with polyfill..."
    rm -rf node_modules/styled-jsx
    mkdir -p node_modules/styled-jsx
    cp src/lib/polyfills/styled-jsx-noop.js node_modules/styled-jsx/index.js
    cp src/lib/polyfills/package.json node_modules/styled-jsx/package.json
    echo "✅ Replaced styled-jsx with polyfill"
else
    echo "✅ styled-jsx successfully excluded from node_modules"
fi

# Check for any remaining styled-jsx references
echo "6. Checking for styled-jsx references in bundle..."
STYLED_JSX_REFS=$(find node_modules -name "*.js" -type f -exec grep -l "styled-jsx" {} \; 2>/dev/null | head -5)
if [ ! -z "$STYLED_JSX_REFS" ]; then
    echo "⚠️  Found styled-jsx references in:"
    echo "$STYLED_JSX_REFS"
    echo "   These may need manual patching if errors persist"
else
    echo "✅ No styled-jsx references found in dependencies"
fi

echo ""
echo "🎉 styled-jsx fix complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Check browser console for any remaining styled-jsx errors"
echo "3. If errors persist, try 'npm run build' to test production build"
echo ""
echo "Changes made:"
echo "- Created styled-jsx no-op polyfill at src/lib/polyfills/styled-jsx-noop.js"
echo "- Updated next.config.js with comprehensive styled-jsx removal"
echo "- Added package.json overrides to prevent styled-jsx installation"
echo "- Cleared all caches and reinstalled dependencies"