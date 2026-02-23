#!/bin/bash

# Veritable Games - Deploy Production Monitoring Service
# This script should be run on the production server (192.168.1.15)
# Run from the root of the veritable-games-main repository

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Veritable Games - Deploy Production Monitoring Service${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if running on production server
HOSTNAME=$(hostname)
if [[ "$HOSTNAME" != *"production"* ]] && [[ "$HOSTNAME" != *"veritable"* ]]; then
    echo -e "${YELLOW}⚠️  Warning: Not detected as production server${NC}"
    echo "Hostname: $HOSTNAME"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled deployment"
        exit 1
    fi
fi

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js ${NC}$(node --version)"

# npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm ${NC}$(npm --version)"

# git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ git installed${NC}"

# Check if we're in the right directory
if [ ! -f "CLAUDE.md" ] && [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Not in veritable-games-main directory${NC}"
    echo "Current: $(pwd)"
    exit 1
fi
echo -e "${GREEN}✅ In veritable-games-main directory${NC}"
echo ""

# Step 1: Pull latest code
echo -e "${BLUE}Step 1: Pulling latest code from GitHub...${NC}"
git pull origin main || {
    echo -e "${RED}❌ Failed to pull from GitHub${NC}"
    exit 1
}
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# Step 2: Navigate to frontend
echo -e "${BLUE}Step 2: Navigating to frontend directory...${NC}"
cd frontend || {
    echo -e "${RED}❌ frontend directory not found${NC}"
    exit 1
}
echo -e "${GREEN}✅ In frontend directory${NC}"
echo ""

# Step 3: Check if monitoring script exists
echo -e "${BLUE}Step 3: Verifying monitoring scripts...${NC}"
if [ ! -f "scripts/monitoring/health-monitor.js" ]; then
    echo -e "${RED}❌ health-monitor.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ health-monitor.js found${NC}"

if [ ! -f "scripts/monitoring/start-monitoring-service.sh" ]; then
    echo -e "${RED}❌ start-monitoring-service.sh not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ start-monitoring-service.sh found${NC}"
echo ""

# Step 4: Check if application is running
echo -e "${BLUE}Step 4: Checking if application is running...${NC}"
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Application health endpoint not responding${NC}"
    echo "Is the application running on port 3000?"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Application responding at http://localhost:3000/api/health${NC}"
fi
echo ""

# Step 5: Check if monitoring is already running
echo -e "${BLUE}Step 5: Checking for existing monitoring service...${NC}"
RUNNING=$(pgrep -f "health-monitor.js" || true)
if [ -n "$RUNNING" ]; then
    echo -e "${YELLOW}⚠️  Monitoring service already running (PID: $RUNNING)${NC}"
    read -p "Stop existing service and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing monitoring service..."
        bash scripts/monitoring/stop-monitoring-service.sh
        sleep 2
    else
        echo -e "${GREEN}✅ Keeping existing service running${NC}"
        exit 0
    fi
fi
echo ""

# Step 6: Configure monitoring (optional)
echo -e "${BLUE}Step 6: Monitoring configuration...${NC}"
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local from template..."
    cp .env.monitoring.template .env.local
    echo -e "${YELLOW}⚠️  Created .env.local - edit to add Slack webhook (optional)${NC}"
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi
echo ""

# Step 7: Create logs directory
echo -e "${BLUE}Step 7: Setting up logs directory...${NC}"
mkdir -p logs
chmod 755 logs
echo -e "${GREEN}✅ Logs directory ready${NC}"
echo ""

# Step 8: Install dependencies (if needed)
echo -e "${BLUE}Step 8: Checking dependencies...${NC}"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.installed" ]; then
    echo "Installing npm dependencies..."
    npm install --no-save || {
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    }
    touch node_modules/.installed
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 9: Run health check
echo -e "${BLUE}Step 9: Running health check...${NC}"
if npm run monitor:check > /tmp/health-check.log 2>&1; then
    echo -e "${GREEN}✅ Health check successful${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    tail -20 /tmp/health-check.log
    exit 1
fi
echo ""

# Step 10: Start monitoring service
echo -e "${BLUE}Step 10: Starting monitoring service...${NC}"
if bash scripts/monitoring/start-monitoring-service.sh; then
    echo -e "${GREEN}✅ Monitoring service started${NC}"
else
    echo -e "${RED}❌ Failed to start monitoring service${NC}"
    exit 1
fi
echo ""

# Step 11: Verify service is running
echo -e "${BLUE}Step 11: Verifying service...${NC}"
sleep 3

MONITOR_PID=$(pgrep -f "health-monitor.js" || true)
if [ -z "$MONITOR_PID" ]; then
    echo -e "${RED}❌ Monitoring service not running${NC}"
    tail -30 logs/monitor.log
    exit 1
fi
echo -e "${GREEN}✅ Monitoring service running (PID: $MONITOR_PID)${NC}"

# Check status endpoint
if curl -s http://localhost:3030/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Status server responding on http://localhost:3030${NC}"
else
    echo -e "${RED}❌ Status server not responding${NC}"
    exit 1
fi
echo ""

# Final summary
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ PRODUCTION MONITORING DEPLOYED SUCCESSFULLY${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Service Status:${NC}"
echo -e "  ${GREEN}✅${NC} Process ID: $MONITOR_PID"
echo -e "  ${GREEN}✅${NC} Logs: $(pwd)/logs/monitor.log"
echo -e "  ${GREEN}✅${NC} Status server: http://localhost:3030"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Monitor logs: tail -f logs/monitor.log"
echo -e "  2. View status: curl http://localhost:3030/ | jq '.'"
echo -e "  3. View alerts: curl http://localhost:3030/alerts | jq '.'"
echo ""

echo -e "${BLUE}Configure Alerts (Optional):${NC}"
echo -e "  1. Edit .env.local"
echo -e "  2. Add SLACK_WEBHOOK_URL"
echo -e "  3. Restart service: npm run monitor:stop && npm run monitor:start"
echo ""

echo -e "${BLUE}Documentation:${NC}"
echo -e "  Setup: docs/operations/PRODUCTION_MONITORING_SETUP.md"
echo -e "  Alerts: docs/operations/MONITORING_ALERTS_REFERENCE.md"
echo ""

# Create deployment record
DEPLOY_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat >> logs/deployment-record.log <<EOF
[${DEPLOY_TIMESTAMP}] Monitoring service deployed to production
  - Commit: $(git rev-parse --short HEAD)
  - Process ID: $MONITOR_PID
  - Status: ✅ Running
  - Application: $(curl -s http://localhost:3000/api/health | jq -r '.service.name' 2>/dev/null || echo "unknown")
EOF

echo -e "${GREEN}Deployment recorded in logs/deployment-record.log${NC}"
echo ""
echo -e "${GREEN}✨ Monitoring system is now operational!${NC}"
