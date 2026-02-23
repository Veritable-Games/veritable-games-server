#!/bin/bash

# Sync gallery uploads from localhost to production server
# Syncs from frontend/public/uploads to veritable-gallery Docker volume
# Usage: ./push-uploads-to-server.sh
# For automation: Add to crontab with: 0 */6 * * * /path/to/push-uploads-to-server.sh

set -e

REMOTE_USER="user"
REMOTE_HOST="192.168.1.15"
LOCAL_UPLOADS="$(dirname "$0")/../../public/uploads"
LOG_DIR="$(dirname "$0")/../../.logs"
LOG_FILE="${LOG_DIR}/upload-sync.log"

# Create log directory
mkdir -p "$LOG_DIR"

# Log function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting gallery upload sync..."
log "=========================================="

# Check if local uploads directory exists
if [ ! -d "$LOCAL_UPLOADS" ]; then
  log "⚠️  No uploads directory found at: $LOCAL_UPLOADS"
  log "✓ Sync skipped (nothing to sync)"
  exit 0
fi

# Get size of uploads
SIZE=$(du -sh "$LOCAL_UPLOADS" 2>/dev/null | cut -f1 || echo "0B")
FILE_COUNT=$(find "$LOCAL_UPLOADS" -type f 2>/dev/null | wc -l || echo "0")

log "📦 Syncing $FILE_COUNT files ($SIZE)..."
log "   Source: $LOCAL_UPLOADS/"
log "   Target: user@$REMOTE_HOST:/tmp/uploads-sync/"

# Create staging directory on remote server
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p /tmp/uploads-sync" 2>&1 | grep -v "^$" || true

# Sync files to server staging area
if rsync -avz --delete \
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
  --exclude '.git*' \
  "$LOCAL_UPLOADS/" \
  "${REMOTE_USER}@${REMOTE_HOST}:/tmp/uploads-sync/" \
  >> "$LOG_FILE" 2>&1; then

  log "✓ rsync completed successfully"

  # Copy from staging to Docker volume on remote server
  log "📋 Copying files to Docker volume..."

  if ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'EOSSH'
docker run --rm \
  -v veritable-gallery:/mnt/uploads \
  -v /tmp/uploads-sync:/mnt/incoming \
  alpine sh -c 'cp -rv /mnt/incoming/* /mnt/uploads/ 2>/dev/null && rm -rf /mnt/incoming/*' && \
echo "Docker copy successful" || echo "Docker copy failed"
EOSSH
  then
    log "✓ Files copied to Docker volume"
    log "✓ Staging directory cleaned"
    log "✅ Sync completed successfully"
  else
    log "❌ Failed to copy files to Docker volume"
    log "   Note: Files are available in /tmp/uploads-sync/ on server"
    exit 1
  fi
else
  log "❌ rsync failed"
  log "   Check SSH access: ssh ${REMOTE_USER}@${REMOTE_HOST} echo OK"
  exit 1
fi

log "=========================================="
log "Sync finished at $(date)"
log "=========================================="
