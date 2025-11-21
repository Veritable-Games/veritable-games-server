# Server-to-Laptop SSH Setup Troubleshooting

**Date:** 2025-11-12
**Status:** NOT WORKING - Issue documented
**Issue:** SSH public key authentication not working despite correct configuration

---

## What We Attempted

### Goal
Enable server (192.168.1.15) to SSH into laptop (192.168.1.175) for automated git patch transfers.

### Steps Completed

1. ✅ **Verified server has SSH keys**
   - Private key: `/home/user/.ssh/id_ed25519`
   - Public key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGuxVSTFJFIIEpVEx/IcuFlY7dHlqKqp/ZQ13q3m093S christopher@corella.com`

2. ✅ **Installed SSH server on laptop**
   ```bash
   sudo apt install openssh-server
   sudo systemctl start sshd
   sudo systemctl enable sshd
   ```

3. ✅ **Added server's public key to laptop's authorized_keys**
   - File: `/home/user/.ssh/authorized_keys` on laptop
   - Content: Single line, correct format
   - Permissions: 600 (correct)
   - Owner: user:user (correct)

4. ✅ **Configured SSH server on laptop**
   - Enabled: `PubkeyAuthentication yes` in `/etc/ssh/sshd_config`
   - Restarted: `sudo systemctl restart sshd`

5. ✅ **Created SSH config on server**
   - File: `/home/user/.ssh/config`
   - Alias: `laptop` → `user@192.168.1.175`
   - IdentityFile: `/home/user/.ssh/id_ed25519`

6. ✅ **Verified permissions**
   - Laptop `.ssh/` directory: 700 (correct)
   - Laptop `authorized_keys`: 600 (correct)
   - File size: 105 bytes (correct for ed25519 key)

### The Problem

**SSH logs on laptop show:**
```
Failed password for user from 192.168.1.15 port 38412 ssh2
Connection closed by authenticating user user 192.168.1.15 port 38412 [preauth]
```

**Analysis:**
- SSH is trying **password authentication**, not public key authentication
- The public key is never being attempted
- This happens despite `PubkeyAuthentication yes` being set
- The authorized_keys file is correct and readable

**Possible causes:**
1. SSH server configuration has additional restrictions we haven't checked
2. SELinux or AppArmor blocking access to authorized_keys
3. SSH server not recognizing the authorized_keys file location
4. Some other sshd_config directive overriding public key auth

---

## Current State

**Server → Laptop SSH:** ❌ NOT WORKING
- Command: `ssh laptop` fails with "Permission denied (publickey,password)"
- Cannot transfer files with `scp`

**Laptop → Server SSH:** ✅ WORKING
- User can already SSH from laptop to server
- This direction works fine

---

## Alternative Solutions

Since direct SSH isn't working, here are alternative approaches:

### Option 1: Manual Git Patch Transfer (RECOMMENDED - Simple)

**On server (after making changes):**
1. Create git patch:
   ```bash
   cd /home/user/veritable-games-migration/frontend
   git format-patch -1 HEAD -o /tmp/
   # Creates: /tmp/0001-your-commit-message.patch
   ```

2. Display patch content:
   ```bash
   cat /tmp/0001-*.patch
   ```

3. Copy the output

**On laptop:**
1. Save the patch:
   ```bash
   cd ~/Projects/veritable-games-main
   nano patch.patch
   # Paste content, save
   ```

2. Apply patch:
   ```bash
   git am patch.patch
   ```

3. Push to GitHub:
   ```bash
   git push
   ```

**Pros:** Simple, no SSH needed, always works
**Cons:** Manual copy-paste required

---

### Option 2: Use tmate for Reverse Access (ALTERNATIVE)

Since laptop → server already works, use **tmate** to create a reverse tunnel.

**On server, install tmate:**
```bash
sudo apt update
sudo apt install tmate
```

**Start tmate session on server:**
```bash
tmate
```

**Get SSH connection string:**
```bash
tmate show-messages
# Will show: ssh [session-id]@[tmate-server]
```

**On laptop, connect to tmate session:**
```bash
ssh [session-id]@[tmate-server]
```

Now you're in a shared terminal session on the server.

**Transfer files:**
- Can copy-paste between sessions
- Can run commands on server from laptop's tmate session

See: [REMOTE_ACCESS.md](REMOTE_ACCESS.md) for tmate documentation

**Pros:** Bidirectional access without SSH server
**Cons:** Requires external tmate server

---

### Option 3: Shared Network Location

**Set up a shared directory:**

**On laptop:**
```bash
# Create transfer directory
mkdir -p ~/git-patches-transfer

# Start simple HTTP server
cd ~/git-patches-transfer
python3 -m http.server 8080
```

**On server:**
```bash
# Upload patch
cd /home/user/veritable-games-migration/frontend
git format-patch -1 HEAD -o /tmp/

# Transfer via HTTP (if laptop allows)
curl -F "file=@/tmp/0001-*.patch" http://192.168.1.175:8080/upload
```

**Pros:** Simple file transfer
**Cons:** Requires HTTP server, less secure

---

### Option 4: Git Remote on Laptop (BEST LONG-TERM)

**On laptop, set up bare git repository:**
```bash
cd ~/Projects
git clone --bare veritable-games-main veritable-games-bare.git
```

**On server, add laptop as git remote:**
```bash
cd /home/user/veritable-games-migration/frontend
git remote add laptop user@192.168.1.175:~/Projects/veritable-games-bare.git

# Push changes (requires SSH to work)
git push laptop master
```

**Note:** This still requires SSH to work, so not viable until SSH issue is resolved.

---

## Recommended Workflow (Without SSH)

**Current best approach: Manual patch transfer**

### On Server (Claude Code instance):

1. Make code/database changes
2. Commit to local git:
   ```bash
   cd /home/user/veritable-games-migration/frontend
   git add .
   git commit -m "Your changes"
   ```

3. Create patch file:
   ```bash
   git format-patch -1 HEAD -o /tmp/
   ```

4. Display patch:
   ```bash
   cat /tmp/0001-*.patch
   ```

5. Tell user: "Patch created - please apply on your laptop"

### On Laptop (User):

1. Save patch:
   ```bash
   cd ~/Projects/veritable-games-main
   cat > patch.patch
   # Paste patch content from server
   # Press Ctrl+D to save
   ```

2. Apply patch:
   ```bash
   git am patch.patch
   ```

3. Verify:
   ```bash
   git log -1
   git status
   ```

4. Push to GitHub:
   ```bash
   git push
   ```

5. Coolify auto-deploys

---

## Future Debugging Steps

If we want to fix SSH in the future:

### Check SELinux/AppArmor

**On laptop:**
```bash
# Check if SELinux is enforcing
sestatus

# Check AppArmor
sudo aa-status | grep sshd
```

### Check full sshd_config

**On laptop:**
```bash
# View full config (uncommented lines only)
grep -v "^#" /etc/ssh/sshd_config | grep -v "^$"
```

### Enable verbose SSH logging

**On laptop:**
```bash
# Edit sshd_config
sudo nano /etc/ssh/sshd_config

# Change LogLevel
# LogLevel INFO → LogLevel DEBUG3

# Restart
sudo systemctl restart sshd
```

**Then on server, try connection and check laptop logs:**
```bash
# On laptop
sudo tail -100 /var/log/auth.log
```

### Test with different key type

**On server, generate RSA key:**
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_laptop
cat ~/.ssh/id_rsa_laptop.pub
# Add this to laptop's authorized_keys
```

---

## Network Information

**Server:**
- IP: 192.168.1.15
- User: user
- SSH key: ed25519

**Laptop:**
- IP: 192.168.1.175
- User: user
- SSH server: Running on port 22
- OS: Ubuntu/Pop!_OS 22.04 (Jammy)

---

## Documentation References

- [SERVER_TO_LAPTOP_SSH.md](SERVER_TO_LAPTOP_SSH.md) - Original setup instructions
- [REMOTE_ACCESS.md](REMOTE_ACCESS.md) - tmate setup guide
- [../guides/GIT_WORKFLOW.md](../guides/GIT_WORKFLOW.md) - Git patch workflow

---

## Summary

**Status:** SSH server-to-laptop is not working despite correct configuration.

**Root cause:** Unknown - SSH server on laptop is not attempting public key authentication.

**Current workaround:** Manual git patch transfer (copy-paste from server to laptop).

**Next steps if SSH is critical:**
1. Check SELinux/AppArmor restrictions
2. Enable DEBUG3 logging on SSH server
3. Try different key type (RSA instead of ed25519)
4. Check for additional sshd_config restrictions

**Recommendation:** Use manual patch transfer workflow for now. It's simple, reliable, and doesn't require debugging SSH further.
