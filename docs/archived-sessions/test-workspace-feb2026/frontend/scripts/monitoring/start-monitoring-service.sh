#!/bin/bash

# Veritable Games Production Monitoring Service Starter
# This script starts the health monitoring service in the background

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Veritable Games - Production Monitoring Service Starter${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20.x${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js ${NC}$(node --version)"

# Create logs directory
mkdir -p logs
echo -e "${GREEN}✅ Logs directory: ${NC}logs/"

# Check if health-monitor.js exists
if [ ! -f "scripts/monitoring/health-monitor.js" ]; then
    echo -e "${RED}❌ health-monitor.js not found at scripts/monitoring/health-monitor.js${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Monitoring script found${NC}"
echo ""

# Check for running monitors
RUNNING=$(pgrep -f "health-monitor.js" || true)
if [ -n "$RUNNING" ]; then
    echo -e "${YELLOW}⚠️  Monitoring service already running (PID: $RUNNING)${NC}"
    echo -e "${YELLOW}Kill existing process? (y/n)${NC}"
    read -r response
    if [ "$response" = "y" ]; then
        kill $RUNNING
        sleep 1
        echo -e "${GREEN}✅ Killed previous process${NC}"
    else
        echo -e "${YELLOW}Keeping existing process running${NC}"
        exit 0
    fi
fi

# Check for environment variables
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo -e "Copy .env.monitoring.template to .env.local to configure alerts:"
    echo -e "  ${BLUE}cp .env.monitoring.template .env.local${NC}"
    echo -e ""
fi

# Run single health check to verify setup
echo -e "${BLUE}Running health check to verify configuration...${NC}"
echo ""

if ! npm run monitor:check 2>/dev/null; then
    echo -e "${RED}❌ Health check failed. Verify application is running.${NC}"
    echo -e "Check: ${BLUE}curl http://192.168.1.15:3000/api/health${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Starting monitoring service in background...${NC}"
echo ""

# Start monitoring in background
nohup npm run monitor:health > logs/monitor.log 2>&1 &
MONITOR_PID=$!

# Give it a moment to start
sleep 2

# Check if process is still running
if ! kill -0 $MONITOR_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start monitoring service${NC}"
    echo -e "Check logs: ${BLUE}tail logs/monitor.log${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Monitoring service started${NC}"
echo -e "${GREEN}✅ Process ID: ${NC}$MONITOR_PID"
echo -e "${GREEN}✅ Logs: ${NC}logs/monitor.log"
echo ""

# Test status endpoints
echo -e "${BLUE}Testing monitoring status endpoints...${NC}"
sleep 1

if curl -s http://localhost:3030/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Status server responding on http://localhost:3030${NC}"
    echo ""
    echo -e "${BLUE}Available monitoring endpoints:${NC}"
    echo -e "  ${YELLOW}Status:${NC}  curl -s http://localhost:3030/ | jq '.'"
    echo -e "  ${YELLOW}Metrics:${NC} curl -s http://localhost:3030/metrics | jq '.'"
    echo -e "  ${YELLOW}Alerts:${NC}  curl -s http://localhost:3030/alerts | jq '.'"
else
    echo -e "${YELLOW}⚠️  Status server not responding yet (may still be starting)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Monitoring service is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Configuration:"
echo -e "  ${BLUE}Script:${NC} scripts/monitoring/health-monitor.js"
echo -e "  ${BLUE}Log file:${NC} logs/monitor.log"
echo -e "  ${BLUE}Process ID:${NC} $MONITOR_PID"
echo -e "  ${BLUE}Status port:${NC} 3030"
echo ""
echo -e "Next steps:"
echo -e "  1. View status: ${BLUE}curl -s http://localhost:3030/ | jq '.'${NC}"
echo -e "  2. Monitor logs: ${BLUE}tail -f logs/monitor.log${NC}"
echo -e "  3. Stop service: ${BLUE}npm run monitor:stop${NC} (if available)"
echo -e "  4. Or kill: ${BLUE}kill $MONITOR_PID${NC}"
echo ""
echo -e "Documentation: ${BLUE}docs/operations/PRODUCTION_MONITORING_SETUP.md${NC}"
echo ""
