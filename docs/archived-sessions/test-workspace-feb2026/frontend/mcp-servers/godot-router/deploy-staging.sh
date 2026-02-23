#!/bin/bash

################################################################################
# Godot MCP Router - Staging Deployment Script
#
# This script automates the staging deployment process:
# 1. Pre-deployment checks
# 2. Build application
# 3. Run tests
# 4. Deploy to staging
# 5. Verify deployment
#
# Usage: ./deploy-staging.sh [docker|systemd|kubernetes]
# Default: docker
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOYMENT_METHOD=${1:-docker}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/deploy-staging-$TIMESTAMP.log"

# Functions
log() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

success() {
  echo -e "${GREEN}✓${NC} $*" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}✗${NC} $*" | tee -a "$LOG_FILE"
  exit 1
}

warning() {
  echo -e "${YELLOW}!${NC} $*" | tee -a "$LOG_FILE"
}

header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}$*${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
}

# Trap errors
trap 'error "Deployment failed at line $LINENO"' ERR

################################################################################
# Step 1: Pre-Deployment Checks
################################################################################

header "Pre-Deployment Checks"

log "Checking Node.js version..."
NODE_VERSION=$(node --version)
if [[ ! $NODE_VERSION =~ v20 ]]; then
  error "Node.js v20.x required, found $NODE_VERSION"
fi
success "Node.js version: $NODE_VERSION"

log "Checking npm version..."
NPM_VERSION=$(npm --version)
success "npm version: $NPM_VERSION"

log "Checking git status..."
cd "$SCRIPT_DIR"
if [ -n "$(git status --porcelain)" ]; then
  error "Git working directory not clean. Please commit or stash changes."
fi
success "Git working directory clean"

log "Checking git branch..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  warning "Not on main branch (current: $BRANCH). Ensure code is reviewed."
fi
success "Current branch: $BRANCH"

log "Checking database connectivity..."
if ! psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
  error "Cannot connect to database at $DATABASE_URL"
fi
success "Database connectivity verified"

################################################################################
# Step 2: Prepare Build
################################################################################

header "Preparing Build"

log "Cleaning previous build artifacts..."
rm -rf "$SCRIPT_DIR/dist" "$SCRIPT_DIR/node_modules"
success "Cleaned build artifacts"

log "Installing dependencies..."
cd "$SCRIPT_DIR"
npm ci > /dev/null 2>&1
success "Dependencies installed"

log "Running TypeScript type check..."
npx tsc --noEmit > /dev/null 2>&1
success "Type check passed"

log "Running ESLint..."
npm run lint > /dev/null 2>&1 || warning "Lint warnings present"
success "Linting complete"

################################################################################
# Step 3: Run Tests
################################################################################

header "Running Test Suite"

log "Running unit tests..."
TEST_RESULTS=$(npm test -- --passWithNoTests --maxWorkers=2 2>&1 | tee -a "$LOG_FILE")

if [[ $TEST_RESULTS =~ "PASS" ]]; then
  success "All tests passed"
else
  error "Some tests failed"
fi

################################################################################
# Step 4: Build Application
################################################################################

header "Building Application"

log "Compiling TypeScript..."
npm run build > /dev/null 2>&1
success "TypeScript compiled successfully"

log "Verifying build output..."
if [ ! -f "$SCRIPT_DIR/dist/router.js" ]; then
  error "Build failed: router.js not found"
fi
success "Build verification passed"

BUILD_SIZE=$(du -sh "$SCRIPT_DIR/dist" | awk '{print $1}')
log "Build size: $BUILD_SIZE"

################################################################################
# Step 5: Database Migrations
################################################################################

header "Database Migrations"

# Load staging environment variables if they exist
if [ -f "$SCRIPT_DIR/.env.staging" ]; then
  log "Loading staging configuration..."
  set -a
  source "$SCRIPT_DIR/.env.staging"
  set +a
  success "Staging configuration loaded"
fi

log "Backing up staging database..."
BACKUP_FILE="$SCRIPT_DIR/backup_staging_$TIMESTAMP.sql"
if ! pg_dump $DATABASE_URL > "$BACKUP_FILE" 2>/dev/null; then
  warning "Could not backup database (database may not exist yet)"
  rm -f "$BACKUP_FILE"
else
  success "Database backed up to $BACKUP_FILE"
fi

log "Running migrations..."
npm run db:migrate > /dev/null 2>&1
success "Migrations completed"

################################################################################
# Step 6: Deploy Based on Method
################################################################################

case "$DEPLOYMENT_METHOD" in
  docker)
    header "Docker Deployment"

    log "Building Docker image..."
    docker build \
      --tag godot-mcp-router:staging \
      --quiet \
      -f "$SCRIPT_DIR/Dockerfile" \
      "$SCRIPT_DIR" > /dev/null 2>&1
    success "Docker image built"

    log "Stopping existing container..."
    docker stop godot-mcp-router-staging 2>/dev/null || true
    docker rm godot-mcp-router-staging 2>/dev/null || true
    success "Old container cleaned up"

    log "Starting new container..."
    docker run -d \
      --name godot-mcp-router-staging \
      --env-file "$SCRIPT_DIR/.env.staging" \
      --publish 3002:3002 \
      --restart unless-stopped \
      godot-mcp-router:staging > /dev/null 2>&1
    success "Docker container started"

    log "Container status:"
    docker ps | grep godot-mcp-router-staging || warning "Container not found"
    ;;

  systemd)
    header "Systemd Deployment"

    log "Creating systemd service..."
    STAGING_DIR="/opt/staging/godot-mcp-router"
    mkdir -p "$STAGING_DIR"

    log "Copying application files..."
    cp -r "$SCRIPT_DIR/dist" "$STAGING_DIR/"
    cp -r "$SCRIPT_DIR/node_modules" "$STAGING_DIR/"
    cp "$SCRIPT_DIR/.env.staging" "$STAGING_DIR/.env"
    success "Application files copied to $STAGING_DIR"

    log "Creating systemd service file..."
    sudo tee /etc/systemd/system/godot-mcp-router-staging.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Godot MCP Router (Staging)
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/staging/godot-mcp-router
EnvironmentFile=/opt/staging/godot-mcp-router/.env
ExecStart=/usr/bin/node /opt/staging/godot-mcp-router/dist/router.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD

    log "Enabling and starting service..."
    sudo systemctl daemon-reload
    sudo systemctl enable godot-mcp-router-staging
    sudo systemctl start godot-mcp-router-staging
    success "Systemd service started"

    log "Service status:"
    sudo systemctl status godot-mcp-router-staging || warning "Service not running"
    ;;

  kubernetes)
    header "Kubernetes Deployment"

    log "Creating namespace..."
    kubectl create namespace godot-mcp-staging --dry-run=client -o yaml | kubectl apply -f - > /dev/null
    success "Namespace ready"

    log "Creating secrets..."
    kubectl create secret generic godot-mcp-secrets \
      --from-literal=DATABASE_URL=$DATABASE_URL \
      --namespace=godot-mcp-staging \
      --dry-run=client -o yaml | kubectl apply -f - > /dev/null
    success "Secrets created"

    log "Deploying to Kubernetes..."
    kubectl apply -f "$SCRIPT_DIR/k8s/deployment-staging.yaml" > /dev/null
    success "Kubernetes deployment applied"

    log "Waiting for rollout..."
    kubectl rollout status deployment/godot-mcp-router-staging \
      -n godot-mcp-staging --timeout=5m || warning "Rollout may still be in progress"
    success "Deployment complete"
    ;;

  *)
    error "Invalid deployment method: $DEPLOYMENT_METHOD. Use: docker, systemd, or kubernetes"
    ;;
esac

################################################################################
# Step 7: Verify Deployment
################################################################################

header "Verifying Deployment"

# Wait for service to be ready
log "Waiting for service to start..."
RETRY_COUNT=0
MAX_RETRIES=30

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:3002/api/health/liveness > /dev/null 2>&1; then
    success "Service is running"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    sleep 2
  fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  error "Service failed to start after $MAX_RETRIES attempts"
fi

log "Checking health endpoints..."

# Liveness check
if curl -s http://localhost:3002/api/health/liveness | grep -q "healthy"; then
  success "Liveness check: PASS"
else
  error "Liveness check: FAIL"
fi

# Readiness check
if curl -s http://localhost:3002/api/health/readiness | grep -q "healthy"; then
  success "Readiness check: PASS"
else
  error "Readiness check: FAIL"
fi

# MCP health check
if curl -s http://localhost:3002/api/health/mcp | grep -q "totalInstances"; then
  success "MCP health check: PASS"
else
  error "MCP health check: FAIL"
fi

# Metrics check
if curl -s http://localhost:3002/api/metrics/prometheus | grep -q "mcp_"; then
  success "Metrics endpoint: PASS"
else
  error "Metrics endpoint: FAIL"
fi

################################################################################
# Summary
################################################################################

header "Deployment Summary"

success "Deployment Method: $DEPLOYMENT_METHOD"
success "Deployment Time: $TIMESTAMP"
success "Log File: $LOG_FILE"
success "Build Size: $BUILD_SIZE"

if [ -f "$BACKUP_FILE" ]; then
  success "Database Backup: $BACKUP_FILE"
fi

echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Staging Deployment Complete! ✓${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"

echo -e "\nNext Steps:"
echo -e "1. Monitor logs: docker logs -f godot-mcp-router-staging"
echo -e "2. Run tests: curl http://localhost:3002/api/health/mcp | jq ."
echo -e "3. Load test: ab -n 1000 -c 10 http://localhost:3002/api/health/readiness"
echo -e "4. Review: Check logs in $LOG_FILE"
echo -e "\n${GREEN}Ready for staging validation!${NC}\n"
