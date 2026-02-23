#!/bin/bash

echo "🧹 Cleaning Next.js build cache..."
rm -rf .next

echo "🧹 Cleaning node_modules cache..."
rm -rf node_modules/.cache

echo "🧹 Killing any running dev servers..."
pkill -f "next dev" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "✅ All caches cleared!"
echo ""
echo "Now run: npm run dev"
echo ""
echo "📝 After the server starts:"
echo "   1. Open your browser"
echo "   2. Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to hard refresh"
echo "   3. Or open DevTools (F12) > Network tab > Check 'Disable cache'"
echo ""
