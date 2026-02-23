#!/bin/bash

echo "=========================================="
echo "MONITORING API LOGS FOR PROFILE UPDATES"
echo "=========================================="
echo ""
echo "This script will monitor the dev server logs in real-time."
echo "Please attempt to update your profile in the browser now."
echo ""
echo "Watching for errors..."
echo "=========================================="
echo ""

# Try multiple log locations
if [ -f "dev-server.log" ]; then
  tail -f dev-server.log | grep --line-buffered -E "(Update user error|Failed to update|error|Error|ERROR)" &
  PID1=$!
fi

if [ -f "dev.log" ]; then
  tail -f dev.log | grep --line-buffered -E "(Update user error|Failed to update|error|Error|ERROR)" &
  PID2=$!
fi

# Also monitor stderr from running Next.js process
echo "Looking for Next.js dev server process..."
NEXT_PID=$(ps aux | grep "next dev" | grep -v grep | head -1 | awk '{print $2}')

if [ -n "$NEXT_PID" ]; then
  echo "Found Next.js process: $NEXT_PID"
  echo "Monitoring output... (Press Ctrl+C to stop)"
  echo ""

  # Use strace to capture output (requires permissions)
  # Fallback to just monitoring the log files
  sleep infinity
else
  echo "Next.js dev server not found. Please start it first."
  exit 1
fi

# Cleanup on exit
trap "kill $PID1 $PID2 2>/dev/null" EXIT
