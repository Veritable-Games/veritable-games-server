#!/bin/bash

# Start Godot MCP Server with environment setup
# Usage: ./start.sh [database_url] [api_base_url]

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default environment variables
DATABASE_URL="${1:-postgresql://postgres:postgres@localhost:5432/veritable_games}"
API_BASE_URL="${2:-http://localhost:3002}"

# Check if built
if [ ! -d "$SCRIPT_DIR/dist" ]; then
  echo "🔨 Building MCP server..."
  npm run build
fi

echo ""
echo "🚀 Starting Godot MCP Server"
echo "   Database: ${DATABASE_URL//:[^@]*@/:***@}"
echo "   API Base: $API_BASE_URL"
echo ""
echo "📋 Available features:"
echo "   - 15 Tools (dependency analysis, build triggers, script reading)"
echo "   - 8 Resources (projects, versions, graphs, scripts, build status)"
echo "   - Real-time runtime event streaming"
echo "   - Temperature-based activation tracking"
echo ""
echo "💬 Use with Claude Code:"
echo "   - Configure ~/.claude/settings.local.json with MCP server path"
echo "   - Ask: 'Which scripts are most active?'"
echo "   - Ask: 'Show me Player.gd dependencies'"
echo "   - Ask: 'What's the build status?'"
echo ""

export DATABASE_URL
export API_BASE_URL

# Start the server
node "$SCRIPT_DIR/dist/index.js"
