#!/bin/bash
# Veritable Games - Unified Control Script
# Single tool for all server operations

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOGS_DIR="$PROJECT_DIR/logs"
PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
check_port() {
    # Use curl with a reasonable timeout
    # Next.js dev server might take a moment to respond, especially during initial compilation
    local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 15 http://localhost:$PORT 2>/dev/null)
    # Accept any 2xx or 3xx response (server is responding)
    # 200 = OK, 304 = Not Modified, 307 = Redirect (normal for auth)
    [[ "$response" =~ ^[23] ]]
}

# More reliable process check - looks for the actual Next.js process
check_next_process() {
    # Check if there's a node process running "next dev"
    pgrep -f "next dev" >/dev/null 2>&1
}

show_help() {
    echo -e "${BLUE}Veritable Games Control${NC}"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Server Commands:"
    echo "  start       - Start the development server"
    echo "  stop        - Stop the server gracefully"
    echo "  restart     - Restart the server"
    echo "  status      - Check server status"
    echo ""
    echo "Utility Commands:"
    echo "  kill        - Force kill all processes (nuclear option)"
    echo "  ports       - Clear stuck ports"
    echo "  cache       - Clear browser cache and Next.js cache"
    echo "  backup      - Run backup (databases only)"
    echo "  logs        - Show recent server logs"
}

# Server functions
start_server() {
    if check_port; then
        echo -e "${YELLOW}Server already running on port $PORT${NC}"
        return 0
    fi

    echo -e "${GREEN}Starting Veritable Games server...${NC}"
    echo ""

    # Verify prerequisites
    echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

    # Check Node.js
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    if ! nvm use 20.18.2 >/dev/null 2>&1; then
        echo -e "${RED}  ✗ Failed to load Node.js 20.18.2${NC}"
        echo -e "${YELLOW}  Install with: nvm install 20.18.2${NC}"
        return 1
    fi

    local node_version=$(node --version)
    echo -e "${GREEN}  ✓ Node.js: $node_version${NC}"

    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "${RED}  ✗ Frontend directory not found: $FRONTEND_DIR${NC}"
        return 1
    fi
    echo -e "${GREEN}  ✓ Frontend directory exists${NC}"

    # Check if package.json exists
    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        echo -e "${RED}  ✗ package.json not found${NC}"
        return 1
    fi
    echo -e "${GREEN}  ✓ package.json found${NC}"

    # Check if node_modules exists
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}  ⚠ node_modules not found - run: cd frontend && npm install${NC}"
        return 1
    fi
    echo -e "${GREEN}  ✓ node_modules exists${NC}"

    # Check environment file
    if [ ! -f "$FRONTEND_DIR/.env.local" ] && [ ! -f "$FRONTEND_DIR/.env" ]; then
        echo -e "${YELLOW}  ⚠ No .env.local or .env file found${NC}"
        echo -e "${YELLOW}    Copy .env.example to .env.local and configure secrets${NC}"
    else
        echo -e "${GREEN}  ✓ Environment file exists${NC}"
    fi

    # Clean up any stuck processes
    echo ""
    echo -e "${BLUE}[2/5] Cleaning up stuck processes...${NC}"
    fuser -k $PORT/tcp 2>/dev/null && echo -e "${GREEN}  ✓ Cleared port $PORT${NC}" || echo -e "${GREEN}  ✓ Port $PORT is clear${NC}"
    sleep 1

    # Prepare logging
    echo ""
    echo -e "${BLUE}[3/5] Preparing logs...${NC}"
    mkdir -p "$LOGS_DIR"
    rm -f "$LOGS_DIR/server.pid"

    # Archive old log if it's large
    if [ -f "$LOGS_DIR/server.log" ]; then
        local log_size=$(stat -f%z "$LOGS_DIR/server.log" 2>/dev/null || stat -c%s "$LOGS_DIR/server.log" 2>/dev/null)
        if [ "$log_size" -gt 1048576 ]; then  # 1MB
            mv "$LOGS_DIR/server.log" "$LOGS_DIR/server.log.old"
            echo -e "${GREEN}  ✓ Archived old log (${log_size} bytes)${NC}"
        fi
    fi

    echo -e "${GREEN}  ✓ Log file: $LOGS_DIR/server.log${NC}"

    # Start the server
    echo ""
    echo -e "${BLUE}[4/5] Starting server process...${NC}"
    cd "$FRONTEND_DIR" && \
        nohup npm run dev >> "$LOGS_DIR/server.log" 2>&1 &

    # Save PID
    SERVER_PID=$!
    echo $SERVER_PID > "$LOGS_DIR/server.pid"
    echo -e "${GREEN}  ✓ Process started with PID: $SERVER_PID${NC}"

    # Fully detach from shell
    disown

    # Wait for startup with detailed monitoring
    echo ""
    echo -e "${BLUE}[5/5] Waiting for server to respond...${NC}"
    echo -e "${BLUE}  (Next.js may take 5-10s for initial compilation)${NC}"
    echo -n "  "

    local startup_checks=45  # Increased to 45s for initial compilation
    local check_interval=1
    local server_ready=false

    for i in $(seq 1 $startup_checks); do
        sleep $check_interval
        echo -n "."

        # Check if process is still running
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo ""
            echo ""
            echo -e "${RED}✗ Server process crashed immediately!${NC}"
            echo ""
            echo -e "${YELLOW}=== Recent Log Output (last 30 lines) ===${NC}"
            tail -30 "$LOGS_DIR/server.log" 2>/dev/null || echo "No log output yet"
            echo ""
            echo -e "${YELLOW}=== Full Logs ===${NC}"
            echo -e "${BLUE}  tail -f $LOGS_DIR/server.log${NC}"
            return 1
        fi

        # After 5 seconds, start checking if Next.js process is running
        if [ $i -ge 5 ] && check_next_process; then
            if [ "$server_ready" = false ]; then
                echo -n " [Next.js detected]"
                server_ready=true
            fi
        fi

        # Check if server is responding on the port
        if check_port; then
            echo ""
            echo ""
            echo -e "${GREEN}✓ Server started successfully!${NC}"
            echo ""
            echo -e "${GREEN}  URL: http://localhost:$PORT${NC}"
            echo -e "${GREEN}  PID: $SERVER_PID${NC}"
            echo -e "${BLUE}  Logs: tail -f $LOGS_DIR/server.log${NC}"
            echo ""
            echo -e "${BLUE}  Note: First page load may take 5-10s for compilation${NC}"
            return 0
        fi

        # Show periodic updates
        if [ $((i % 5)) -eq 0 ]; then
            echo -n " [${i}s]"
        fi
    done

    # Startup timeout - show detailed diagnostics
    echo ""
    echo ""
    echo -e "${RED}✗ Server failed to respond within ${startup_checks} seconds${NC}"
    echo ""

    # Check if Next.js process is running
    if check_next_process; then
        echo -e "${GREEN}✓ Next.js process is running${NC}"

        # Try one more time to check the port
        sleep 2
        if check_port; then
            echo -e "${GREEN}✓ Server is now responding!${NC}"
            echo ""
            echo -e "${GREEN}  URL: http://localhost:$PORT${NC}"
            echo -e "${GREEN}  PID: $SERVER_PID${NC}"
            echo -e "${BLUE}  Logs: tail -f $LOGS_DIR/server.log${NC}"
            return 0
        fi

        echo -e "${YELLOW}⚠ Server is running but not responding to HTTP requests yet${NC}"
        echo -e "${YELLOW}  This is unusual but the server may still be initializing${NC}"
        echo -e "${YELLOW}  Try accessing: http://localhost:$PORT${NC}"
    elif kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${YELLOW}⚠ Process is still starting (PID: $SERVER_PID)${NC}"
        echo -e "${YELLOW}  The server may still be initializing...${NC}"
    else
        echo -e "${RED}⚠ Process has crashed (PID: $SERVER_PID)${NC}"
    fi

    echo ""
    echo -e "${YELLOW}=== Diagnostics ===${NC}"

    # Check for Next.js processes specifically
    local next_pids=$(pgrep -f "next dev" 2>/dev/null)
    if [ -n "$next_pids" ]; then
        echo -e "${GREEN}  Next.js processes found:${NC}"
        ps -p $next_pids -o pid,ppid,etime,cmd 2>/dev/null | head -10
    else
        echo -e "${YELLOW}  No Next.js processes found${NC}"
    fi

    echo ""
    # Check what's listening on the port (use ss/netstat, not lsof)
    local port_info=$(ss -tlnp 2>/dev/null | grep ":$PORT " || netstat -tlnp 2>/dev/null | grep ":$PORT ")
    if [ -n "$port_info" ]; then
        echo -e "${GREEN}  Process listening on port $PORT:${NC}"
        echo "  $port_info"
    else
        echo -e "${YELLOW}  No process listening on port $PORT${NC}"
    fi

    echo ""
    echo -e "${YELLOW}=== Recent Log Output (last 40 lines) ===${NC}"
    if [ -f "$LOGS_DIR/server.log" ]; then
        tail -40 "$LOGS_DIR/server.log"
    else
        echo "No log file found"
    fi

    echo ""
    echo -e "${YELLOW}=== Common Issues ===${NC}"
    echo -e "${BLUE}  1. Port already in use:${NC} ./start-veritable-games.sh ports"
    echo -e "${BLUE}  2. Missing dependencies:${NC} cd frontend && npm install"
    echo -e "${BLUE}  3. TypeScript errors:${NC} cd frontend && npm run type-check"
    echo -e "${BLUE}  4. Cached issues:${NC} ./start-veritable-games.sh cache"
    echo ""
    echo -e "${YELLOW}=== Next Steps ===${NC}"
    if check_next_process; then
        echo -e "${GREEN}  Server appears to be running - try accessing:${NC}"
        echo -e "${BLUE}    http://localhost:$PORT${NC}"
        echo -e ""
        echo -e "${BLUE}  Monitor logs:${NC}"
        echo -e "${BLUE}    tail -f $LOGS_DIR/server.log${NC}"
        echo -e ""
        echo -e "${BLUE}  Check status:${NC}"
        echo -e "${BLUE}    ./start-veritable-games.sh status${NC}"
    else
        echo -e "${BLUE}  View logs:${NC}"
        echo -e "${BLUE}    tail -f $LOGS_DIR/server.log${NC}"
        echo -e ""
        echo -e "${BLUE}  Try restarting:${NC}"
        echo -e "${BLUE}    ./start-veritable-games.sh restart${NC}"
    fi

    # Return success if Next.js is running (false negative health check)
    if check_next_process; then
        return 0
    fi

    return 1
}

stop_server() {
    if ! check_port; then
        echo -e "${YELLOW}Server not running${NC}"
        # Clean up PID file if it exists
        rm -f "$LOGS_DIR/server.pid"
        return 0
    fi

    echo -e "${YELLOW}Stopping server...${NC}"

    # Try to kill using PID file first
    if [ -f "$LOGS_DIR/server.pid" ]; then
        PID=$(cat "$LOGS_DIR/server.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            echo "  Sent SIGTERM to PID $PID"
        fi
        rm -f "$LOGS_DIR/server.pid"
    fi

    # Kill processes on port (backup method)
    fuser -k $PORT/tcp 2>/dev/null
    pkill -f "next dev" 2>/dev/null

    sleep 2

    # Verify stopped
    if check_port; then
        echo -e "${RED}✗ Server still running, force killing...${NC}"
        fuser -k -9 $PORT/tcp 2>/dev/null
        pkill -9 -f "next dev" 2>/dev/null
        sleep 1
    fi

    echo -e "${GREEN}✓ Server stopped${NC}"
}

restart_server() {
    stop_server
    sleep 1
    start_server
}

check_status() {
    if check_port; then
        echo -e "${GREEN}● Server is running${NC}"
        echo -e "  URL: http://localhost:$PORT"

        # Show process info using ss/netstat
        local port_info=$(ss -tlnp 2>/dev/null | grep ":$PORT " || netstat -tlnp 2>/dev/null | grep ":$PORT ")
        if [ -n "$port_info" ]; then
            local pid=$(echo "$port_info" | grep -oP 'pid=\K[0-9]+' | head -1)
            if [ -n "$pid" ]; then
                echo -e "  PID: $pid"
                echo -e "  Uptime: $(ps -p $pid -o etime= 2>/dev/null | tr -d ' ')"
            fi
        fi

        # Show PID file info
        if [ -f "$LOGS_DIR/server.pid" ]; then
            local saved_pid=$(cat "$LOGS_DIR/server.pid")
            echo -e "  Saved PID: $saved_pid"
        fi

        echo -e "  Logs: tail -f $LOGS_DIR/server.log"
    else
        echo -e "${RED}● Server is not running${NC}"

        # Check if PID file exists but process is dead
        if [ -f "$LOGS_DIR/server.pid" ]; then
            local saved_pid=$(cat "$LOGS_DIR/server.pid")
            echo -e "  ${YELLOW}⚠ Stale PID file found: $saved_pid${NC}"
            echo -e "  ${YELLOW}  Run './start-veritable-games.sh start' to restart${NC}"
        fi
    fi
}

# Utility functions
kill_all() {
    echo -e "${RED}🔴 Killing ALL processes...${NC}"

    # Kill Python overlays
    pkill -9 -f "veritable-games-overlay" 2>/dev/null
    pkill -9 -f "python.*overlay" 2>/dev/null

    # Kill Node/npm
    ps aux | grep -E "node|npm" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

    # Kill anything on ports
    for port in {3000..3010}; do
        fuser -k $port/tcp 2>/dev/null
    done

    pkill -9 -f "next dev" 2>/dev/null
    killall node 2>/dev/null

    sleep 1
    echo -e "${GREEN}✓ All processes killed${NC}"
}

clear_ports() {
    echo -e "${YELLOW}Clearing ports...${NC}"

    for port in {3000..3010}; do
        # Use ss or netstat to check if port is in use
        if ss -tln 2>/dev/null | grep -q ":$port " || netstat -tln 2>/dev/null | grep -q ":$port "; then
            echo "  Clearing port $port..."
            fuser -k $port/tcp 2>/dev/null
        fi
    done

    echo -e "${GREEN}✓ Ports cleared${NC}"
}

clear_cache() {
    echo -e "${YELLOW}Clearing cache...${NC}"

    # Clear Next.js cache
    if [ -d "$FRONTEND_DIR/.next" ]; then
        rm -rf "$FRONTEND_DIR/.next"
        echo "  ✓ Next.js cache cleared"
    fi

    # Clear node_modules cache
    if [ -d "$FRONTEND_DIR/node_modules/.cache" ]; then
        rm -rf "$FRONTEND_DIR/node_modules/.cache"
        echo "  ✓ Node modules cache cleared"
    fi

    echo -e "${GREEN}✓ Cache cleared${NC}"
}

run_backup() {
    echo -e "${BLUE}Running backup...${NC}"

    if [ -f "$PROJECT_DIR/safe-backup.sh" ]; then
        "$PROJECT_DIR/safe-backup.sh"
    else
        # Simple backup if script doesn't exist
        BACKUP_DIR="$HOME/CRITICAL_BACKUPS/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r "$FRONTEND_DIR/data" "$BACKUP_DIR/"
        echo -e "${GREEN}✓ Backup saved to $BACKUP_DIR${NC}"
    fi
}

show_logs() {
    echo -e "${BLUE}Recent server logs:${NC}"
    echo "---"

    if [ -f "$LOGS_DIR/server.log" ]; then
        tail -50 "$LOGS_DIR/server.log"
    else
        echo "No log file found at $LOGS_DIR/server.log"
    fi
}

# Main command handler
case "${1:-help}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_status
        ;;
    kill)
        kill_all
        ;;
    ports)
        clear_ports
        ;;
    cache)
        clear_cache
        ;;
    backup)
        run_backup
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac