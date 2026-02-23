#!/bin/bash
################################################################################
# Automated Daily Backup Script
#
# Pulls content from production server and commits to git
# Designed to run via cron (daily at 2 AM)
#
# This script:
# 1. Pulls content from production (files + database exports)
# 2. Commits changes to git
# 3. Pushes to GitHub (your backup)
# 4. Logs all activity
#
################################################################################

# Exit on error
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_FILE="/tmp/auto-backup.log"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Logging function
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting automated backup"
log "=========================================="

# Check if pull script exists
PULL_SCRIPT="$SCRIPT_DIR/sync/pull-production-content.sh"
if [ ! -f "$PULL_SCRIPT" ]; then
    log "ERROR: Pull script not found at $PULL_SCRIPT"
    exit 1
fi

# Run pull script
log "Pulling content from production..."
if "$PULL_SCRIPT" >> "$LOG_FILE" 2>&1; then
    log "✅ Pull completed successfully"
else
    log "❌ Pull script failed with exit code $?"
    exit 1
fi

# Change to frontend directory for git operations
cd "$FRONTEND_DIR" || {
    log "ERROR: Failed to change to frontend directory: $FRONTEND_DIR"
    exit 1
}

log "Working directory: $(pwd)"

# Check if there are changes to commit
if ! git diff --quiet || ! git diff --staged --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    log "Changes detected, committing..."

    # Add all changes
    git add -A

    # Commit with timestamp
    COMMIT_MSG="Auto backup $DATE

Automated daily backup from production server.
Includes:
- Database exports (wiki, projects, gallery)
- Any new files uploaded via web UI

Generated at: $TIMESTAMP"

    if git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1; then
        log "✅ Committed changes"
    else
        log "❌ Git commit failed"
        exit 1
    fi

    # Push to GitHub
    log "Pushing to GitHub..."
    if git push >> "$LOG_FILE" 2>&1; then
        log "✅ Pushed to GitHub successfully"
    else
        log "❌ Git push failed"
        exit 1
    fi

    # Get commit hash
    COMMIT_HASH=$(git rev-parse --short HEAD)
    log "Backup complete! Commit: $COMMIT_HASH"
else
    log "No changes detected, nothing to commit"
fi

log "=========================================="
log "Backup completed successfully"
log "=========================================="

exit 0
