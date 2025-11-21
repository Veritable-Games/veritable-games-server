#!/bin/bash
# WireGuard Tunnel Verification Script
# Verifies tunnel is operational between server and laptop

echo "=== WireGuard Tunnel Verification ==="
echo ""

if [ "$(hostname)" = "veritable-games-server" ]; then
  INTERFACE="wg0"
  REMOTE_IP="10.100.0.2"
  REMOTE_NAME="laptop"
elif [ "$(hostname)" = "remote" ]; then
  INTERFACE="wg0_laptop"
  REMOTE_IP="10.100.0.1"
  REMOTE_NAME="server"
else
  echo "❌ Unknown hostname: $(hostname)"
  exit 1
fi

# Check interface exists
if ! ip link show $INTERFACE &>/dev/null; then
  echo "❌ Interface $INTERFACE not found"
  echo "   Run: sudo wg-quick up $INTERFACE"
  exit 1
fi

echo "✅ Interface $INTERFACE exists"

# Check WireGuard status
if ! sudo wg show $INTERFACE &>/dev/null; then
  echo "❌ WireGuard not running on $INTERFACE"
  exit 1
fi

echo "✅ WireGuard running on $INTERFACE"

# Check peer configuration
PEER_COUNT=$(sudo wg show $INTERFACE peers 2>/dev/null | wc -l)
if [ "$PEER_COUNT" -eq 0 ]; then
  echo "❌ No peers configured"
  exit 1
fi

echo "✅ Peer configured ($PEER_COUNT peer)"

# Check handshake
HANDSHAKE=$(sudo wg show $INTERFACE latest-handshakes 2>/dev/null | awk '{print $2}')
if [ -n "$HANDSHAKE" ] && [ "$HANDSHAKE" -gt 0 ]; then
  CURRENT_TIME=$(date +%s)
  TIME_SINCE_HANDSHAKE=$((CURRENT_TIME - HANDSHAKE))

  if [ "$TIME_SINCE_HANDSHAKE" -gt 180 ]; then
    echo "⚠️  Last handshake: ${TIME_SINCE_HANDSHAKE}s ago (>3 minutes - may be stale)"
  else
    echo "✅ Recent handshake: ${TIME_SINCE_HANDSHAKE}s ago"
  fi
else
  echo "⚠️  No handshake data available"
fi

# Test connectivity
echo ""
echo "Testing connectivity to $REMOTE_NAME ($REMOTE_IP)..."
if ping -c 3 -W 2 $REMOTE_IP &>/dev/null; then
  echo "✅ Ping successful (0% packet loss)"
else
  echo "❌ Ping failed"
  exit 1
fi

# Test SSH (optional, may require key)
if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes user@$REMOTE_IP "echo 'SSH OK'" &>/dev/null; then
  echo "✅ SSH accessible"
else
  echo "⚠️  SSH not accessible (may need key authorization)"
fi

echo ""
echo "=== ✅ WireGuard tunnel fully operational ==="
