#!/bin/bash
################################################################################
# Restore All Database Content from JSON Exports
#
# Master script to restore all database content after disaster recovery
# Runs all import scripts in sequence
#
# Usage:
#   ./scripts/import/restore-all.sh
#
# Prerequisites:
#   - Fresh deployment from git (files already deployed)
#   - PostgreSQL container running
#   - Environment variables configured
#   - JSON exports exist in data/exports/
#
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  🚨 DISASTER RECOVERY: Restore All Database Content  ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$FRONTEND_DIR"

# Check if exports exist
EXPORTS_DIR="$FRONTEND_DIR/data/exports"

if [ ! -d "$EXPORTS_DIR" ]; then
    echo -e "${RED}❌ Error: Exports directory not found at $EXPORTS_DIR${NC}"
    echo -e "${YELLOW}   Make sure you're running this from the frontend directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📂 Checking for export files...${NC}"
echo ""

WIKI_EXPORT="$EXPORTS_DIR/wiki-pages.json"
PROJECTS_EXPORT="$EXPORTS_DIR/projects.json"
GALLERY_EXPORT="$EXPORTS_DIR/gallery-images.json"

# Track what we'll import
IMPORTS_TO_RUN=()

if [ -f "$WIKI_EXPORT" ]; then
    WIKI_COUNT=$(jq 'length' "$WIKI_EXPORT" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✅ Wiki pages export found${NC} ($WIKI_COUNT pages)"
    IMPORTS_TO_RUN+=("wiki")
else
    echo -e "  ${YELLOW}⚠️  Wiki pages export not found${NC} (will skip)"
fi

if [ -f "$PROJECTS_EXPORT" ]; then
    PROJECTS_COUNT=$(jq 'length' "$PROJECTS_EXPORT" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✅ Projects export found${NC} ($PROJECTS_COUNT projects)"
    IMPORTS_TO_RUN+=("projects")
else
    echo -e "  ${YELLOW}⚠️  Projects export not found${NC} (will skip)"
fi

if [ -f "$GALLERY_EXPORT" ]; then
    GALLERY_COUNT=$(jq 'length' "$GALLERY_EXPORT" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✅ Gallery images export found${NC} ($GALLERY_COUNT images)"
    IMPORTS_TO_RUN+=("gallery")
else
    echo -e "  ${YELLOW}⚠️  Gallery images export not found${NC} (will skip)"
fi

echo ""

if [ ${#IMPORTS_TO_RUN[@]} -eq 0 ]; then
    echo -e "${RED}❌ No export files found. Nothing to import.${NC}"
    echo -e "${YELLOW}   Run ./scripts/sync/pull-production-content.sh first to create exports.${NC}"
    exit 1
fi

echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Ready to import ${#IMPORTS_TO_RUN[@]} type(s) of content${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""

read -p "Continue with import? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo ""

# Run imports
TOTAL_SUCCESS=0
TOTAL_FAILED=0

for import_type in "${IMPORTS_TO_RUN[@]}"; do
    case $import_type in
        wiki)
            echo -e "${CYAN}📚 Importing Wiki Pages...${NC}"
            if node "$SCRIPT_DIR/import-wiki-from-json.js" "$WIKI_EXPORT"; then
                ((TOTAL_SUCCESS++))
            else
                ((TOTAL_FAILED++))
                echo -e "${RED}❌ Wiki import failed${NC}"
            fi
            echo ""
            ;;
        projects)
            echo -e "${CYAN}🎮 Importing Projects...${NC}"
            if node "$SCRIPT_DIR/import-projects-from-json.js" "$PROJECTS_EXPORT"; then
                ((TOTAL_SUCCESS++))
            else
                ((TOTAL_FAILED++))
                echo -e "${RED}❌ Projects import failed${NC}"
            fi
            echo ""
            ;;
        gallery)
            echo -e "${CYAN}🖼️  Importing Gallery Images...${NC}"
            if node "$SCRIPT_DIR/import-gallery-from-json.js" "$GALLERY_EXPORT"; then
                ((TOTAL_SUCCESS++))
            else
                ((TOTAL_FAILED++))
                echo -e "${RED}❌ Gallery import failed${NC}"
            fi
            echo ""
            ;;
    esac
done

# Final summary
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  RECOVERY COMPLETE                    ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Successful imports: $TOTAL_SUCCESS${NC}"
if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed imports: $TOTAL_FAILED${NC}"
fi
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All database content restored successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Verify application is running"
    echo "  2. Check content is visible on site"
    echo "  3. Test creating new content"
    echo ""
else
    echo -e "${YELLOW}⚠️  Some imports failed. Check errors above.${NC}"
    echo -e "${YELLOW}   You may need to manually fix these.${NC}"
    echo ""
fi
