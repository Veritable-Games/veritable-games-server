#!/bin/bash
#
# WireGuard Private Network Routing Setup Script
# Location: /path/to/repo/wireguard-configs/setup-wireguard.sh
#
# This script sets up secure VPN access to your home network from anywhere
# Includes:
# - WireGuard configuration for home and away networks
# - NetworkManager auto-switching
# - Server-side IP forwarding and NAT (optional)
#
# Usage:
#   ./setup-wireguard.sh [--laptop | --server | --all]
#
# Examples:
#   ./setup-wireguard.sh --laptop    # Setup only laptop configs
#   ./setup-wireguard.sh --server    # Setup only server configs
#   ./setup-wireguard.sh --all       # Setup both laptop and server
#   ./setup-wireguard.sh             # Interactive menu
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WG_HOME_CONF="wg0_home.conf"
WG_AWAY_CONF="wg0_away.conf"
WG_DISPATCHER="99-wireguard-auto-switch"
DISPATCHER_PATH="/etc/NetworkManager/dispatcher.d/"

function print_header() {
  echo -e "\n${COLOR_BLUE}=== $1 ===${NC}\n"
}

function print_success() {
  echo -e "${COLOR_GREEN}✓ $1${NC}"
}

function print_error() {
  echo -e "${COLOR_RED}✗ $1${NC}"
}

function print_warning() {
  echo -e "${COLOR_YELLOW}⚠ $1${NC}"
}

function check_root() {
  if [ "$EUID" -ne 0 ]; then 
    print_error "This script must be run as root (use sudo)"
    exit 1
  fi
}

function check_wireguard() {
  if ! command -v wg &> /dev/null; then
    print_error "WireGuard not installed"
    echo "Install it with: sudo apt-get install wireguard wireguard-tools"
    exit 1
  fi
  print_success "WireGuard is installed"
}

function check_networkmanager() {
  if ! command -v nmcli &> /dev/null; then
    print_error "NetworkManager not installed"
    echo "Install it with: sudo apt-get install network-manager"
    exit 1
  fi
  print_success "NetworkManager is installed"
}

function setup_laptop_configs() {
  print_header "Setting up Laptop WireGuard Configurations"

  # Create WireGuard config directory if it doesn't exist
  if [ ! -d /etc/wireguard ]; then
    print_warning "Creating /etc/wireguard directory"
    mkdir -p /etc/wireguard
  fi

  # Copy home config
  print_warning "Installing wg0_home.conf to /etc/wireguard/"
  cp "$SCRIPT_DIR/$WG_HOME_CONF" /etc/wireguard/wg0_home.conf
  chmod 600 /etc/wireguard/wg0_home.conf
  print_success "Installed /etc/wireguard/wg0_home.conf"

  # Copy away config
  print_warning "Installing wg0_away.conf to /etc/wireguard/"
  cp "$SCRIPT_DIR/$WG_AWAY_CONF" /etc/wireguard/wg0_away.conf
  chmod 600 /etc/wireguard/wg0_away.conf
  print_success "Installed /etc/wireguard/wg0_away.conf"

  # Import into NetworkManager
  print_warning "Importing configs into NetworkManager..."
  
  nmcli connection delete wg0-home 2>/dev/null || true
  nmcli connection import type wireguard file /etc/wireguard/wg0_home.conf
  print_success "Imported wg0-home config to NetworkManager"

  nmcli connection delete wg0-away 2>/dev/null || true
  nmcli connection import type wireguard file /etc/wireguard/wg0_away.conf
  print_success "Imported wg0-away config to NetworkManager"

  # Setup dispatcher script
  print_warning "Installing auto-switch dispatcher script..."
  mkdir -p $DISPATCHER_PATH
  cp "$SCRIPT_DIR/$WG_DISPATCHER" "$DISPATCHER_PATH/$WG_DISPATCHER"
  chmod +x "$DISPATCHER_PATH/$WG_DISPATCHER"
  print_success "Installed $DISPATCHER_PATH$WG_DISPATCHER"

  print_success "Laptop configuration complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Test the configs:"
  echo "     sudo wg-quick down wg0_away 2>/dev/null || true"
  echo "     sudo wg-quick up wg0_home"
  echo "     ping 192.168.1.15"
  echo ""
  echo "  2. Test auto-switch:"
  echo "     nmcli connection show"
  echo "     # Switch networks and monitor:"
  echo "     sudo journalctl -u NetworkManager -f | grep wireguard"
}

function setup_server_ip_forward() {
  print_header "Setting up Server IP Forwarding"

  # Check IP forwarding status
  IPFORWARD=$(cat /proc/sys/net/ipv4/ip_forward)
  
  if [ "$IPFORWARD" = "1" ]; then
    print_success "IP forwarding already enabled"
  else
    print_warning "Enabling IP forwarding..."
    sysctl -w net.ipv4.ip_forward=1
    echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/99-wg-forward.conf
    sysctl -p
    print_success "IP forwarding enabled"
  fi
}

function setup_server_nat() {
  print_header "Setting up Server NAT (optional - for routing between networks)"

  # Check if iptables rules already exist
  if iptables -t nat -C POSTROUTING -o eth0 -j MASQUERADE 2>/dev/null; then
    print_success "NAT rules already installed"
    return
  fi

  print_warning "Installing NAT rules..."
  iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
  iptables -A FORWARD -i wg0 -j ACCEPT
  iptables -A FORWARD -o wg0 -j ACCEPT
  
  # Try to persist (iptables-persistent)
  if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
    print_success "NAT rules saved with netfilter-persistent"
  else
    print_warning "iptables-persistent not installed - rules won't persist on reboot"
    echo "Install with: sudo apt-get install iptables-persistent"
  fi
}

function setup_server_firewall() {
  print_header "Setting up Server Firewall (ufw)"

  if ! command -v ufw &> /dev/null; then
    print_warning "ufw not installed - skipping"
    return
  fi

  if ufw status | grep -q "Status: inactive"; then
    print_warning "ufw is not active - skipping"
    return
  fi

  # Allow WireGuard port
  if ufw status | grep -q "51820"; then
    print_success "WireGuard port 51820 already allowed"
  else
    print_warning "Allowing WireGuard port 51820..."
    ufw allow 51820/udp
    print_success "WireGuard port 51820 allowed"
  fi
}

function test_laptop_connectivity() {
  print_header "Testing Laptop Connectivity"

  echo "Testing WireGuard tunnel to server..."
  echo ""

  # Check if tunnel is up
  if ! ip link show wg0_home &>/dev/null && ! ip link show wg0_away &>/dev/null; then
    print_warning "No WireGuard interface active - starting wg0_home..."
    wg-quick up wg0_home
  fi

  # Get active interface
  if ip link show wg0_home &>/dev/null; then
    WG_IF="wg0_home"
  else
    WG_IF="wg0_away"
  fi

  # Test ping
  echo "Pinging server (192.168.1.15) through $WG_IF..."
  if ping -c 3 192.168.1.15 &>/dev/null; then
    print_success "Connectivity test passed!"
    echo ""
    wg show $WG_IF | grep "peer\|endpoint\|allowed\|latest"
  else
    print_error "Connectivity test failed!"
    echo "Troubleshooting:"
    echo "  1. Check WireGuard status: sudo wg show"
    echo "  2. Check routes: ip route | grep wg"
    echo "  3. Check firewall: sudo ufw status"
    echo "  4. Check server WireGuard: ssh user@192.168.1.15 'sudo wg show wg0'"
  fi
}

function test_server_wireguard() {
  print_header "Testing Server WireGuard Configuration"

  echo "Checking WireGuard interface on server..."
  sudo wg show wg0 | head -10

  echo ""
  echo "Checking if port 51820 is open..."
  if netstat -tulpn 2>/dev/null | grep -q 51820; then
    print_success "Port 51820 is listening"
  else
    print_error "Port 51820 is not listening"
  fi
}

function show_menu() {
  echo -e "\n${COLOR_BLUE}WireGuard Private Network Routing Setup${NC}\n"
  echo "1) Setup Laptop (home/away configs + auto-switch)"
  echo "2) Setup Server (IP forwarding + NAT)"
  echo "3) Setup Both Laptop and Server"
  echo "4) Test Connectivity (Laptop)"
  echo "5) Test Server WireGuard"
  echo "6) Exit"
  echo ""
  read -p "Select option (1-6): " choice
}

function main() {
  if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
      show_menu
      case $choice in
        1)
          check_root
          check_wireguard
          check_networkmanager
          setup_laptop_configs
          ;;
        2)
          check_root
          check_wireguard
          setup_server_ip_forward
          setup_server_nat
          setup_server_firewall
          ;;
        3)
          check_root
          check_wireguard
          check_networkmanager
          setup_laptop_configs
          setup_server_ip_forward
          setup_server_nat
          setup_server_firewall
          ;;
        4)
          check_wireguard
          test_laptop_connectivity
          ;;
        5)
          check_wireguard
          test_server_wireguard
          ;;
        6)
          echo "Exiting..."
          exit 0
          ;;
        *)
          print_error "Invalid option"
          ;;
      esac
    done
  else
    # Command-line mode
    check_root
    check_wireguard
    
    case $1 in
      --laptop)
        check_networkmanager
        setup_laptop_configs
        ;;
      --server)
        setup_server_ip_forward
        setup_server_nat
        setup_server_firewall
        ;;
      --all)
        check_networkmanager
        setup_laptop_configs
        setup_server_ip_forward
        setup_server_nat
        setup_server_firewall
        ;;
      --test-laptop)
        test_laptop_connectivity
        ;;
      --test-server)
        test_server_wireguard
        ;;
      *)
        print_error "Unknown option: $1"
        echo "Usage: $0 [--laptop | --server | --all | --test-laptop | --test-server]"
        exit 1
        ;;
    esac
  fi

  print_success "Setup complete!"
}

main "$@"
