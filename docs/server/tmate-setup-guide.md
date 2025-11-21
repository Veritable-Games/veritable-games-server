# tmate Terminal Sharing Setup Guide

**tmate** enables secure, real-time terminal sharing over public networks.
Installed on: Server (192.168.1.15)
Date: November 10, 2025

---

## Quick Start (30 seconds)

```bash
# On server - Start a shareable session
tmate -F &

# Get the sharing URLs
tmate show-messages

# Copy the URLs and share them with others
```

---

## How It Works

1. **Server runs tmate** - Creates a shared terminal session
2. **tmate generates URLs** - Unique SSH links for sharing
3. **Remote connects via SSH** - No firewall/VPN needed
4. **Secure streaming** - All traffic encrypted via SSH

---

## Usage Examples

### Example 1: Simple Session Sharing

**On Server:**
```bash
# Start tmate (will output sharing URLs)
tmate

# You'll see:
# SSH session read only:  ssh ro-abc123xyz@tmate.io
# SSH session:            ssh abc123xyz@tmate.io
#
# Press q or Ctrl+C to continue working
```

**On Local Machine:**
```bash
# Connect to watch (read-only - safe)
ssh ro-abc123xyz@tmate.io

# You'll see the server's terminal in real-time
# Press Ctrl+C to disconnect
```

### Example 2: Background Sharing (Recommended)

**On Server:**
```bash
# Start tmate in background
tmate -F &

# Get the URLs
tmate show-messages

# You can now work normally - session is being shared
cd /path/to/project
npm run dev
# etc.

# To stop sharing when done
killall tmate
```

### Example 3: Share Only Specific Commands

**On Server:**
```bash
# Open one terminal window
terminal1$ tmate -F &
terminal1$ tmate show-messages

# Open second terminal window
terminal2$ mkdir -p /tmp/work
terminal2$ cd /tmp/work
terminal2$ npm run build

# Share the URL from terminal1 - viewers see terminal2's output
```

---

## Access Levels

### Read-Only Access (ro-)
- **What they see**: Everything typed and output
- **What they can do**: Nothing (view-only)
- **Security**: Safe for public sharing, demos, monitoring
- **URL format**: `ssh ro-XXXXXX@tmate.io`

### Read-Write Access
- **What they see**: Everything typed and output
- **What they can do**: Type commands, control terminal
- **Security**: Only share with trusted people
- **URL format**: `ssh XXXXXX@tmate.io`

---

## Keyboard Shortcuts (tmate/tmux)

### Window Management
```
Ctrl+B, then C       Create new window
Ctrl+B, then N       Next window
Ctrl+B, then P       Previous window
Ctrl+B, then W       List windows
Ctrl+B, then <num>   Jump to window N
```

### Pane Splitting
```
Ctrl+B, then %       Split vertically
Ctrl+B, then "       Split horizontally
Ctrl+B, then Arrow   Move between panes
```

### Session Management
```
Ctrl+B, then D       Detach from session
Ctrl+B, then [       Enter copy mode (scroll)
Ctrl+B, then ]       Paste
```

### Useful tmate Commands
```
tmate show-messages  Show sharing URLs again
tmate kill-session   Kill current session
```

---

## Real-World Usage Scenarios

### Scenario 1: Live Debugging
**Server**: Running build with errors
**Share**: Read-only URL with team
**Benefit**: Realtime troubleshooting without VPN

```bash
# Server
tmate -F &
tmate show-messages  # Share the ro- URL
npm run dev          # Team watches the output
```

### Scenario 2: Deployment Monitoring
**Server**: Running deployment scripts
**Share**: Read-only URL with stakeholders
**Benefit**: Full transparency of deployment progress

```bash
# Server
tmate -F &
tmate show-messages
./deploy.sh  # Stakeholders see real-time progress
```

### Scenario 3: Collaborative Problem Solving
**Server**: Complex issue investigation
**Share**: Read-write URL with expert
**Benefit**: Expert can help directly without SSH keys

```bash
# Server
tmate  # Start (shows read-write URL)
# Expert connects via read-write URL and helps
```

---

## Security Best Practices

### ✅ DO
- Use **read-only** (ro-) links for general sharing
- **Share URLs via secure channels** (Signal, encrypted email)
- **Check who's connected**: `tmate list-clients`
- **Kill session when done**: `killall tmate`
- **Set a time limit** for long-running sessions

### ❌ DON'T
- Share read-write URLs publicly
- Type passwords/secrets while sharing read-write access
- Leave sessions running indefinitely
- Share URLs in plain chat/email
- Use for sensitive operations without review

---

## Troubleshooting

### "Command not found: tmate"
```bash
# Verify installation
which tmate

# If not found, reinstall
sudo apt install -y tmate
```

### "Failed to connect to tmate.io"
```bash
# Check internet connectivity
ping google.com

# Check DNS
nslookup tmate.io

# Try SSH connectivity
ssh -v ro-XXXXX@tmate.io
```

### "Can't see terminal output"
```bash
# Make sure session is still running
ps aux | grep tmate

# Try attaching to the session directly
tmate attach-session -t $(tmux list-sessions -F '#{session_name}' | head -1)
```

### "Multiple tmate processes"
```bash
# Kill all tmate sessions
killall tmate

# Verify
ps aux | grep tmate
```

---

## Advanced: Custom Configuration

### Create .tmate.conf
```bash
cat > ~/.tmate.conf << 'EOF'
# Set key binding
set -g prefix C-Space

# Copy mode with vi keys
setw -g mode-keys vi

# Mouse support
set -g mouse on
EOF

# Then start tmate
tmate -F
```

---

## Comparison: When to Use Which

| Need | Tool | Command |
|------|------|---------|
| Quick demo | tmate read-only | `tmate -F` then share `ro-` URL |
| Collaborative work | tmate read-write | `tmate` then share regular URL |
| Recording session | asciinema | `asciinema rec` |
| Local network only | tmux + SSH | `tmux attach-session` |
| Web-based | ttyd | `ttyd bash` |

---

## Getting Help

```bash
# tmate manual
man tmate

# tmux manual (tmate is built on tmux)
man tmux

# Show this guide
cat ~/tmate-setup-guide.md
```

---

**Created**: November 10, 2025
**Version**: tmate 2.4.0
**Maintained by**: Claude Code
