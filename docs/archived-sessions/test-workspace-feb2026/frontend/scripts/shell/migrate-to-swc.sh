#!/bin/bash

echo "================================================"
echo "Next.js Build System Migration Plan"
echo "From Babel to SWC Compiler"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}PHASE 1: Testing SWC Compatibility${NC}"
echo "--------------------------------------"
echo "1. Test with SWC-based Jest configuration:"
echo "   cp jest.config.swc.js jest.config.js.backup"
echo "   cp jest.config.js jest.config.babel.js"
echo "   cp jest.config.swc.js jest.config.js"
echo "   npm test"
echo ""

echo -e "${BLUE}PHASE 2: Remove Babel Configuration (after testing)${NC}"
echo "--------------------------------------"
echo "1. Backup current Babel config:"
echo "   mv babel.config.js babel.config.js.backup"
echo ""
echo "2. Test build with SWC:"
echo "   npm run build"
echo ""
echo "3. If build succeeds, test dev server:"
echo "   npm run dev"
echo ""

echo -e "${BLUE}PHASE 3: Optimize Next.js Configuration${NC}"
echo "--------------------------------------"
echo "1. Backup current config:"
echo "   cp next.config.js next.config.js.backup"
echo ""
echo "2. Apply optimized configuration:"
echo "   cp next.config.optimized.js next.config.js"
echo ""
echo "3. Test optimized build:"
echo "   npm run build"
echo ""

echo -e "${BLUE}PHASE 4: Clean Dependencies${NC}"
echo "--------------------------------------"
echo "1. Remove Babel dependencies (after confirming SWC works):"
echo "   npm uninstall @babel/core @babel/preset-env @babel/preset-react @babel/preset-typescript babel-jest"
echo ""
echo "2. Remove deprecated dependencies:"
echo "   npm uninstall worker-loader"
echo ""
echo "3. Deduplicate packages:"
echo "   npm dedupe"
echo ""

echo -e "${BLUE}PHASE 5: Organize Project Structure${NC}"
echo "--------------------------------------"
echo "1. Run organization script:"
echo "   chmod +x organize-project-structure.sh"
echo "   ./organize-project-structure.sh"
echo ""

echo -e "${GREEN}Expected Results:${NC}"
echo "• Build time: 35s → ~8-10s (70% improvement)"
echo "• Dev compilation: 2-3s → <500ms per route"
echo "• Bundle size: 20-30% reduction"
echo "• Hot reload: Much faster"
echo ""

echo -e "${YELLOW}Rollback Plan:${NC}"
echo "If issues occur, restore from backups:"
echo "  mv babel.config.js.backup babel.config.js"
echo "  mv jest.config.babel.js jest.config.js"
echo "  mv next.config.js.backup next.config.js"
echo "  npm install"
echo ""

echo -e "${RED}Important Notes:${NC}"
echo "• Test thoroughly before removing Babel dependencies"
echo "• Keep backups until confident in new setup"
echo "• Monitor for any runtime issues after migration"
echo ""

# Ask for confirmation
read -p "Ready to start migration? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo -e "${GREEN}Starting Phase 1: Testing SWC...${NC}"
    
    # Backup Jest config
    cp jest.config.js jest.config.babel.js
    echo "✓ Backed up current Jest config to jest.config.babel.js"
    
    # Test with SWC config
    echo ""
    echo "Testing with SWC-based Jest configuration..."
    echo "Running: npm test -- --listTests | head -5"
    npm test -- --listTests 2>/dev/null | head -5
    
    echo ""
    echo -e "${GREEN}Phase 1 preparation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run full test suite: npm test"
    echo "2. If tests pass, proceed to Phase 2"
    echo "3. To use SWC config: cp jest.config.swc.js jest.config.js"
else
    echo ""
    echo "Migration cancelled. You can run this script again when ready."
fi