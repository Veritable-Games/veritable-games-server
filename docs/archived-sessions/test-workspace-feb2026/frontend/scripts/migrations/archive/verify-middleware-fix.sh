#!/bin/bash

# Middleware Fix Verification Script
# Run this to verify authentication middleware is working correctly

set -e

echo "🔍 Verifying Middleware Authentication Fix"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify middleware.ts exists at root level
echo "1. Checking middleware file location..."
if [ -f "middleware.ts" ]; then
    echo -e "${GREEN}✅ middleware.ts found at root level${NC}"
else
    echo -e "${RED}❌ middleware.ts NOT found at root level${NC}"
    exit 1
fi

# Check 2: Verify middleware contains auth logic
echo ""
echo "2. Checking middleware contains authentication logic..."
if grep -q "hasSessionCookie" middleware.ts && grep -q "session_id" middleware.ts; then
    echo -e "${GREEN}✅ Middleware contains authentication logic${NC}"
else
    echo -e "${RED}❌ Middleware missing authentication logic${NC}"
    exit 1
fi

# Check 3: Verify PUBLIC_PATHS are defined
echo ""
echo "3. Checking public paths configuration..."
if grep -q "PUBLIC_PATHS" middleware.ts; then
    echo -e "${GREEN}✅ PUBLIC_PATHS configured${NC}"
    echo "   Public routes:"
    grep -A 8 "const PUBLIC_PATHS" middleware.ts | grep "'" | sed 's/^/   - /'
else
    echo -e "${RED}❌ PUBLIC_PATHS not found${NC}"
    exit 1
fi

# Check 4: Verify middleware exports config
echo ""
echo "4. Checking middleware exports configuration..."
if grep -q "export const config" middleware.ts; then
    echo -e "${GREEN}✅ Middleware exports config with matcher${NC}"
else
    echo -e "${RED}❌ Middleware config export not found${NC}"
    exit 1
fi

# Check 5: Verify old middleware is backed up
echo ""
echo "5. Checking old middleware backup..."
if [ -f "src/middleware.ts.backup" ]; then
    echo -e "${GREEN}✅ Old middleware backed up as src/middleware.ts.backup${NC}"
elif [ -f "src/middleware.ts" ]; then
    echo -e "${YELLOW}⚠️  Old middleware still exists at src/middleware.ts (will be ignored by Next.js)${NC}"
else
    echo -e "${GREEN}✅ No conflicting middleware files${NC}"
fi

# Check 6: TypeScript check
echo ""
echo "6. Running TypeScript check on middleware..."
if npx tsc --noEmit middleware.ts 2>&1 | grep -q "middleware.ts.*error"; then
    echo -e "${RED}❌ TypeScript errors in middleware.ts${NC}"
    npx tsc --noEmit middleware.ts 2>&1 | grep "middleware.ts"
    exit 1
else
    echo -e "${GREEN}✅ No TypeScript errors in middleware.ts${NC}"
fi

# Check 7: Verify documentation exists
echo ""
echo "7. Checking documentation..."
if [ -f "MIDDLEWARE_FIX_SUMMARY.md" ]; then
    echo -e "${GREEN}✅ MIDDLEWARE_FIX_SUMMARY.md exists${NC}"
else
    echo -e "${YELLOW}⚠️  MIDDLEWARE_FIX_SUMMARY.md not found${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart the development server:"
echo "     cd frontend && npm run dev"
echo ""
echo "  2. Test in incognito browser:"
echo "     - Visit http://localhost:3000"
echo "     - Expected: Redirect to /auth/login"
echo ""
echo "  3. Test authenticated access:"
echo "     - Login with valid credentials"
echo "     - Expected: Access to all pages"
echo ""
echo "See MIDDLEWARE_FIX_SUMMARY.md for complete testing instructions."
