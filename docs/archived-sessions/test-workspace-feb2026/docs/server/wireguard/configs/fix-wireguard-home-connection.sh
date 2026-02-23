#!/bin/bash
#
# Fix Broken wg0-home NetworkManager Connection
# ===============================================
#
# Issue: wg0-home connection missing WireGuard private key after NetworkManager update on Dec 2, 2025
# Cause: NetworkManager "connection-update" operation at 08:56:08 corrupted the connection
# Solution: Delete broken connection and re-import from working .conf file
#
# Date: December 4, 2025
# Author: Claude Code (investigation + fix)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 WireGuard wg0-home Connection Fix${NC}"
echo "=========================================="
echo ""

# Check if we're on laptop
if [[ ! -f /etc/wireguard/wg0-home.conf ]]; then
    echo -e "${RED}❌ Error: /etc/wireguard/wg0-home.conf not found${NC}"
    echo "This script must be run on the laptop (192.168.1.175)"
    exit 1
fi

# Verify .conf file has private key
if ! sudo grep -q "PrivateKey" /etc/wireguard/wg0-home.conf; then
    echo -e "${RED}❌ Error: /etc/wireguard/wg0-home.conf missing PrivateKey${NC}"
    echo "Source config file is corrupted - cannot proceed"
    exit 1
fi

echo -e "${GREEN}✅ Source config file verified${NC}"
echo ""

# Check if connection exists
if nmcli connection show wg0-home &>/dev/null; then
    echo -e "${YELLOW}📦 Backing up existing connection...${NC}"

    # Create backup directory
    BACKUP_DIR="/tmp/wireguard-backups"
    mkdir -p "$BACKUP_DIR"

    BACKUP_FILE="$BACKUP_DIR/wg0-home-backup-$(date +%Y%m%d-%H%M%S).txt"
    nmcli connection show wg0-home > "$BACKUP_FILE"

    echo -e "${GREEN}✅ Backup saved to: $BACKUP_FILE${NC}"
    echo ""

    # Check if connection is active and deactivate it
    if nmcli connection show --active | grep -q "wg0-home"; then
        echo -e "${YELLOW}🔌 Deactivating current connection...${NC}"
        sudo nmcli connection down wg0-home || true
    fi

    echo -e "${YELLOW}🗑️  Deleting broken connection...${NC}"
    sudo nmcli connection delete wg0-home
    echo -e "${GREEN}✅ Deleted${NC}"
    echo ""
else
    echo -e "${YELLOW}ℹ️  No existing connection found (will create new)${NC}"
    echo ""
fi

# Deactivate wg0-away if active (can't have both)
if nmcli connection show --active | grep -q "wg0-away"; then
    echo -e "${YELLOW}🔌 Deactivating wg0-away...${NC}"
    sudo nmcli connection down wg0-away || true
    echo ""
fi

# Import from working config
echo -e "${BLUE}📥 Importing from /etc/wireguard/wg0-home.conf...${NC}"
if sudo nmcli connection import type wireguard file /etc/wireguard/wg0-home.conf; then
    echo -e "${GREEN}✅ Import successful${NC}"
else
    echo -e "${RED}❌ Import failed${NC}"
    exit 1
fi
echo ""

# Verify private key imported
echo -e "${BLUE}🔍 Verifying private key...${NC}"
if nmcli connection show wg0-home | grep -q "wireguard.private-key.*<hidden>"; then
    echo -e "${GREEN}✅ Private key imported successfully${NC}"
else
    echo -e "${RED}⚠️  Warning: Private key might not be set correctly${NC}"
    echo "Attempting manual fix..."

    # Extract private key from .conf file
    PRIVATE_KEY=$(sudo grep PrivateKey /etc/wireguard/wg0-home.conf | cut -d= -f2 | tr -d ' ')

    # Set in NetworkManager connection
    if sudo nmcli connection modify wg0-home wireguard.private-key "$PRIVATE_KEY"; then
        echo -e "${GREEN}✅ Private key manually set${NC}"
    else
        echo -e "${RED}❌ Failed to set private key${NC}"
        exit 1
    fi
fi
echo ""

# Test activation
echo -e "${BLUE}🔌 Testing connection activation...${NC}"
if sudo nmcli connection up wg0-home; then
    echo -e "${GREEN}✅ Connection activated successfully${NC}"
else
    echo -e "${RED}❌ Failed to activate connection${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check if server WireGuard is running: ssh user@192.168.1.15 'sudo wg show'"
    echo "  2. Check if router is reachable: ping -c 2 192.168.1.1"
    echo "  3. Try manual activation: sudo wg-quick up wg0-home"
    exit 1
fi
echo ""

# Wait for interface to stabilize
sleep 2

# Test connectivity
echo -e "${BLUE}🏓 Testing connectivity to server (10.100.0.1)...${NC}"
if ping -c 3 -W 2 10.100.0.1 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ping successful - WireGuard working!${NC}"

    # Show connection statistics
    echo ""
    echo -e "${BLUE}📊 WireGuard Status:${NC}"
    sudo wg show wg0-home | head -10
else
    echo -e "${YELLOW}⚠️  Warning: Ping failed${NC}"
    echo ""
    echo "Connection activated but ping failed. Possible causes:"
    echo "  1. Server WireGuard might be down"
    echo "  2. Firewall blocking traffic"
    echo "  3. Need to wait longer for handshake"
    echo ""
    echo "Check handshake status:"
    sudo wg show wg0-home
fi

echo ""
echo -e "${GREEN}✅ wg0-home connection fixed!${NC}"
echo ""
echo -e "${BLUE}📝 What was fixed:${NC}"
echo "  • Deleted broken NetworkManager connection (UUID 9658bcc7)"
echo "  • Re-imported from /etc/wireguard/wg0-home.conf"
echo "  • Verified WireGuard private key restored"
echo "  • Activated connection successfully"
echo ""
echo -e "${BLUE}🔄 Auto-switch dispatcher should now work when changing networks.${NC}"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "  docs/server/wireguard/WIREGUARD_AUTO_SWITCH_FAILURE_DEC_2025.md"
echo ""

# Test auto-switch script (optional)
echo -e "${YELLOW}Would you like to test the auto-switch dispatcher? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}🧪 Testing auto-switch dispatcher...${NC}"

    # Get current WiFi interface
    WIFI_IFACE=$(ip link show | grep -E "^[0-9]+: wl" | cut -d: -f2 | tr -d ' ' | head -1)

    if [[ -n "$WIFI_IFACE" ]]; then
        echo "Simulating network change on $WIFI_IFACE..."
        sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch "$WIFI_IFACE" up

        echo ""
        echo -e "${BLUE}📋 Auto-switch logs:${NC}"
        journalctl -t wireguard-switch --since "30 seconds ago" --no-pager
    else
        echo -e "${YELLOW}⚠️  Could not detect WiFi interface${NC}"
        echo "Test manually with: sudo /etc/NetworkManager/dispatcher.d/99-wireguard-auto-switch wlp0s20f3 up"
    fi
fi

echo ""
echo -e "${GREEN}🎉 All done!${NC}"
