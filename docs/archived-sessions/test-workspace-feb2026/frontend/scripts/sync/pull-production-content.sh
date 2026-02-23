#!/bin/bash
################################################################################
# Pull Production Content to Local
#
# This script pulls content added via web UI back to your local git repo
# so you can commit it and maintain git as source of truth.
#
# Usage:
#   ./scripts/sync/pull-production-content.sh
#
################################################################################

set -e

# Configuration
SERVER="user@192.168.1.15"
REMOTE_APP_DIR="/app"
LOCAL_DIR="$(cd "$(dirname "$0")/../.." && pwd)/frontend"

# Auto-detect container name (most recent veritable-games container)
echo "Detecting application container..."
CONTAINER_NAME=$(ssh "$SERVER" "docker ps --format '{{.Names}}' | grep 'm4s0kwo4kc4oooocck4sswc4' | head -1")

if [ -z "$CONTAINER_NAME" ]; then
    echo -e "${RED}❌ Error: Could not find application container${NC}"
    echo "   Looking for container matching: m4s0kwo4kc4oooocck4sswc4"
    exit 1
fi

echo "Found container: $CONTAINER_NAME"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Pulling Production Content to Local${NC}"
echo "================================================"

# 1. Check if uploads exist in container (skip if not - files are in git)
echo -e "\n${YELLOW}📁 Checking for uploaded files...${NC}"

UPLOADS_EXIST=$(ssh "$SERVER" "docker exec $CONTAINER_NAME test -d /app/public/uploads && echo 'yes' || echo 'no'")

if [ "$UPLOADS_EXIST" = "yes" ]; then
    echo "  → Found uploads in container, syncing..."

    # Create temp directory on server
    ssh "$SERVER" "docker exec $CONTAINER_NAME mkdir -p /tmp/sync"

    # Copy uploads from container to server
    ssh "$SERVER" "docker cp $CONTAINER_NAME:/app/public/uploads /tmp/sync/ 2>/dev/null || true"
    ssh "$SERVER" "docker cp $CONTAINER_NAME:/app/data/uploads /tmp/sync/data-uploads 2>/dev/null || true"

    # Rsync from server to local (only if exists)
    if ssh "$SERVER" "test -d /tmp/sync/uploads"; then
        echo "  → Syncing public/uploads..."
        rsync -av --progress "$SERVER:/tmp/sync/uploads/" "$LOCAL_DIR/public/uploads/" 2>/dev/null || echo "  ⚠️  No public/uploads to sync"
    fi

    if ssh "$SERVER" "test -d /tmp/sync/data-uploads"; then
        echo "  → Syncing data/uploads..."
        rsync -av --progress "$SERVER:/tmp/sync/data-uploads/" "$LOCAL_DIR/data/uploads/" 2>/dev/null || echo "  ⚠️  No data/uploads to sync"
    fi

    # Cleanup
    ssh "$SERVER" "rm -rf /tmp/sync"
else
    echo "  ℹ️  No uploads in container (files are in git) - skipping file sync"
fi

# 2. Export database to JSON (for version control)
echo -e "\n${YELLOW}💾 Exporting database content...${NC}"

# Export wiki pages
echo "  → Exporting wiki pages..."
ssh "$SERVER" "docker exec $CONTAINER_NAME node -e \"
const { pgPool } = require('./src/lib/database/pool-postgres');
(async () => {
  const result = await pgPool.query('SELECT * FROM wiki.wiki_pages ORDER BY id');
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
})();
\"" > "$LOCAL_DIR/data/exports/wiki-pages.json" 2>/dev/null || echo "  ⚠️  Wiki export failed (might be empty)"

# Export projects
echo "  → Exporting projects..."
ssh "$SERVER" "docker exec $CONTAINER_NAME node -e \"
const { pgPool } = require('./src/lib/database/pool-postgres');
(async () => {
  const result = await pgPool.query('SELECT * FROM content.projects ORDER BY id');
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
})();
\"" > "$LOCAL_DIR/data/exports/projects.json" 2>/dev/null || echo "  ⚠️  Projects export failed (might be empty)"

# Export gallery images metadata
echo "  → Exporting gallery metadata..."
ssh "$SERVER" "docker exec $CONTAINER_NAME node -e \"
const { pgPool } = require('./src/lib/database/pool-postgres');
(async () => {
  const result = await pgPool.query('SELECT * FROM content.project_gallery_images ORDER BY id');
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
})();
\"" > "$LOCAL_DIR/data/exports/gallery-images.json" 2>/dev/null || echo "  ⚠️  Gallery export failed (might be empty)"

# 3. Show what changed
echo -e "\n${GREEN}✅ Sync Complete!${NC}"
echo "================================================"
echo ""
echo "Changes pulled from production:"
cd "$LOCAL_DIR"
git status --short

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review changes: git diff"
echo "2. Commit to git: git add -A && git commit -m 'Pull production content'"
echo "3. Push to GitHub: git push"
echo ""
echo "🔐 Git is your backup. Server can die anytime."
