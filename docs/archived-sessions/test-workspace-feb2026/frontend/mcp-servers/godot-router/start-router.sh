#!/bin/bash

# Start Godot MCP Router with environment setup
# Phase 1: Simple pass-through router
# Usage: ./start-router.sh [database_url] [api_base_url]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default environment variables
DATABASE_URL="${1:-postgresql://postgres:postgres@localhost:5432/veritable_games}"
API_BASE_URL="${2:-http://localhost:3002}"

# Check if router built
if [ ! -d "$SCRIPT_DIR/dist" ]; then
  echo "🔨 Building MCP Router..."
  cd "$SCRIPT_DIR"
  npm run build
fi

echo ""
echo "🚀 Starting Godot MCP Router (Phase 3)"
echo "   Database: ${DATABASE_URL//:[^@]*@/:***@}"
echo "   API Base: $API_BASE_URL"
echo ""
echo "📋 Phase 3 Features:"
echo "   - Multi-instance architecture (one instance per Godot version)"
echo "   - Unix socket IPC for inter-process communication"
echo "   - CWD-based version auto-detection"
echo "   - Instance health monitoring and auto-restart"
echo "   - 30-minute idle timeout with auto-termination"
echo "   - Optional versionId parameters (uses auto-detection by default)"
echo "   - All 15 tools available"
echo ""
echo "🔄 Architecture:"
echo "   Claude Code (stdio) → Router → Instance Pool (Unix Sockets)"
echo "                                 ├─ Instance 1 (version A)"
echo "                                 ├─ Instance 2 (version B)"
echo "                                 └─ Instance N (...)"
echo ""
echo "🛠️  Debug Tools:"
echo "   - debug_detection: Show detected version from current directory"
echo "   - debug_instances: Show all running instances with status/uptime"
echo ""

export DATABASE_URL
export API_BASE_URL

# Start the router (using router-phase3.js with multi-instance support)
# Features:
# - CWD-based version auto-detection (Phase 2 + Phase 3)
# - Multi-instance spawning and management (Phase 3)
# - Unix socket IPC for fast inter-process communication (Phase 3)
# - Instance health monitoring and idle timeout (Phase 3)
# - Optional versionId parameters with auto-detection fallback
node "$SCRIPT_DIR/dist/router-phase3.js"
