#!/bin/sh
set -e

echo "🚀 Starting Veritable Games production servers..."

# Function to handle shutdown signals
cleanup() {
  echo "📡 Received shutdown signal, stopping servers..."
  if [ ! -z "$WS_PID" ]; then
    kill -TERM "$WS_PID" 2>/dev/null || true
  fi
  if [ ! -z "$STREAM_PID" ]; then
    kill -TERM "$STREAM_PID" 2>/dev/null || true
  fi
  if [ ! -z "$NEXT_PID" ]; then
    kill -TERM "$NEXT_PID" 2>/dev/null || true
  fi
  exit 0
}

# Set up signal handlers
trap cleanup TERM INT QUIT

# WebSocket server for real-time multi-user collaboration (Phase 6)
# Enabled: January 2026
echo "🔌 Starting Workspace WebSocket server on port ${WS_PORT:-3002}..."
node ./node_modules/.bin/tsx ./server/websocket-server.ts &
WS_PID=$!
echo "✅ Workspace WebSocket server started (PID: $WS_PID)"

# Godot Streaming WebSocket server for dependency graph visualization
# Enabled: January 2026
echo "🎮 Starting Godot Streaming server on port ${STREAM_PORT:-3004}..."
node ./node_modules/.bin/tsx ./server/websocket-stream-server.ts &
STREAM_PID=$!
echo "✅ Godot Streaming server started (PID: $STREAM_PID)"

# Start Next.js server in foreground
echo "🌐 Starting Next.js server on port ${PORT:-3000}..."
node server.js &
NEXT_PID=$!
echo "✅ Next.js server started (PID: $NEXT_PID)"

echo "🎉 Servers running!"
echo "   - Next.js: http://localhost:${PORT:-3000}"
echo "   - Workspace WebSocket: ws://localhost:${WS_PORT:-3002}"
echo "   - Godot Streaming: ws://localhost:${STREAM_PORT:-3004}"

# Wait for all processes
wait $WS_PID $STREAM_PID $NEXT_PID
