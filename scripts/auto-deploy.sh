#!/bin/bash
# Auto-deploy script for Veritable Games
# Checks for new commits and triggers deployment if needed

set -e

REPO_DIR="/home/user/projects/veritable-games/site"
APP_UUID="m4s0kwo4kc4oooocck4sswc4"
LOG_FILE="/home/user/logs/auto-deploy.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

cd "$REPO_DIR"

# Fetch latest from remote
git fetch origin main --quiet

# Get current and remote commit
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    log "New commits detected: $LOCAL_COMMIT -> $REMOTE_COMMIT"

    # Pull changes
    git pull origin main --quiet

    # Trigger deployment
    log "Triggering deployment..."
    DEPLOY_OUTPUT=$(coolify deploy uuid "$APP_UUID" 2>&1)
    log "Deploy triggered: $DEPLOY_OUTPUT"

    echo "Deployed new commits"
else
    # Only log every hour to avoid spam
    MINUTE=$(date +%M)
    if [ "$MINUTE" == "00" ]; then
        log "No new commits (current: ${LOCAL_COMMIT:0:7})"
    fi
fi
