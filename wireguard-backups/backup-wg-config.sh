#!/bin/bash
# WireGuard Configuration Backup Script
# Backs up WireGuard configs and status

BACKUP_DIR="/home/user/wireguard-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== WireGuard Configuration Backup ==="
echo "Timestamp: $TIMESTAMP"
echo ""

# Server
if [ "$(hostname)" = "veritable-games-server" ]; then
  echo "Backing up SERVER configuration..."
  if [ -f /etc/wireguard/wg0.conf ]; then
    sudo cp /etc/wireguard/wg0.conf "$BACKUP_DIR/wg0.conf.$TIMESTAMP"
    echo "✅ Config: $BACKUP_DIR/wg0.conf.$TIMESTAMP"
  fi

  if sudo wg show wg0 &>/dev/null; then
    sudo wg show wg0 > "$BACKUP_DIR/wg0-status.$TIMESTAMP.txt"
    echo "✅ Status: $BACKUP_DIR/wg0-status.$TIMESTAMP.txt"
  fi
fi

# Laptop
if [ "$(hostname)" = "remote" ]; then
  echo "Backing up LAPTOP configuration..."
  if [ -f /etc/wireguard/wg0_laptop.conf ]; then
    sudo cp /etc/wireguard/wg0_laptop.conf "$BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP"
    echo "✅ Config: $BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP"
  elif [ -f /tmp/wg0_laptop.conf ]; then
    sudo cp /tmp/wg0_laptop.conf "$BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP"
    echo "✅ Config: $BACKUP_DIR/wg0_laptop.conf.$TIMESTAMP (from /tmp)"
  fi

  if sudo wg show wg0_laptop &>/dev/null; then
    sudo wg show wg0_laptop > "$BACKUP_DIR/wg0_laptop-status.$TIMESTAMP.txt"
    echo "✅ Status: $BACKUP_DIR/wg0_laptop-status.$TIMESTAMP.txt"
  fi
fi

echo ""
echo "✅ WireGuard config backed up to $BACKUP_DIR"
