#!/bin/bash
# Auto-deploy script for Veritable Games
# Checks for new commits and triggers deployment via GitHub webhook

set -e

REPO_DIR="/home/user/projects/veritable-games/site"
WEBHOOK_URL="http://localhost:8000/webhooks/source/github/events/manual"
WEBHOOK_SECRET="b4c83d3d5afc536648c15df594685aee9991815e112def8e1c1f315da08a7953"
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
    
    # Get new commit info
    NEW_COMMIT=$(git rev-parse HEAD)
    COMMIT_MSG=$(git log -1 --pretty=%B | head -1 | tr '"' "'")
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    log "Triggering deployment for commit: ${NEW_COMMIT:0:7} - $COMMIT_MSG"

    # Create GitHub push webhook payload with required fields
    PAYLOAD="{\"ref\":\"refs/heads/main\",\"before\":\"$LOCAL_COMMIT\",\"after\":\"$NEW_COMMIT\",\"repository\":{\"id\":123456,\"full_name\":\"Veritable-Games/veritable-games-site\",\"name\":\"veritable-games-site\",\"default_branch\":\"main\",\"clone_url\":\"https://github.com/Veritable-Games/veritable-games-site.git\"},\"commits\":[{\"id\":\"$NEW_COMMIT\",\"message\":\"$COMMIT_MSG\",\"timestamp\":\"$TIMESTAMP\",\"author\":{\"name\":\"auto-deploy\",\"email\":\"deploy@veritablegames.com\"}}],\"head_commit\":{\"id\":\"$NEW_COMMIT\",\"message\":\"$COMMIT_MSG\"},\"pusher\":{\"name\":\"auto-deploy\",\"email\":\"deploy@veritablegames.com\"},\"sender\":{\"login\":\"auto-deploy\"}}"

    # Generate HMAC-SHA256 signature
    SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')"
    
    # Send webhook request
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "X-GitHub-Event: push" \
        -H "X-Hub-Signature-256: $SIGNATURE" \
        -d "$PAYLOAD" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
        log "Deployment triggered successfully (HTTP $HTTP_CODE): $BODY"
    else
        log "Deployment trigger failed (HTTP $HTTP_CODE): $BODY"
    fi

    echo "Deployed new commits"
else
    # Only log every hour to avoid spam
    MINUTE=$(date +%M)
    if [ "$MINUTE" == "00" ]; then
        log "No new commits (current: ${LOCAL_COMMIT:0:7})"
    fi
fi
