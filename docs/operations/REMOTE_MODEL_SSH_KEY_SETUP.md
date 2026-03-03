# SSH Key Setup for Remote Model (Claude on Production Server)

**Date Created**: March 3, 2026
**Status**: ⏳ Setup Required
**Issue**: Claude Code (laptop) cannot SSH into remote production server - missing authorized public key

---

## Quick Summary

Claude Code on the laptop has a valid ED25519 SSH key but **the remote server doesn't have the public key in its `authorized_keys` file**. This doc explains how to fix it.

---

## The Problem

**When Claude Code tries to SSH into 10.100.0.1:**

```
ssh user@10.100.0.1 "command"
→ Permission denied (publickey)
```

**What's happening:**
1. ✅ VPN connection works (ping 10.100.0.1 succeeds, <1ms latency)
2. ✅ SSH handshake succeeds
3. ✅ Client sends ED25519 public key for authentication
4. ❌ Server rejects it - key not in `~/.ssh/authorized_keys`

---

## Solution: Add Claude's Public Key to authorized_keys

### Claude Code's Public Key

```
ED25519 Key ID (SHA256): vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY
User: christopher@corella.com
```

**Full Public Key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== christopher@corella.com
```

### Steps to Fix

**Option A: If you have SSH access to the server via another method:**

1. SSH into the server using whatever method works currently
2. Add the public key to `~/.ssh/authorized_keys`:

```bash
# Option 1: Append to existing file
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== christopher@corella.com" >> ~/.ssh/authorized_keys

# Option 2: Use a text editor
nano ~/.ssh/authorized_keys
# Paste the key on a new line, save with Ctrl+X, Y, Enter
```

3. Fix permissions (CRITICAL):
```bash
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

4. Verify it worked:
```bash
exit  # Leave the server
ssh user@10.100.0.1 "echo 'Success!'"  # Should work now
```

**Option B: If you have no SSH access:**

You'll need to add the key directly on the server console or through another method available to you.

---

## What Went Wrong

Claude Code has:
- ✅ Private key at `~/.ssh/id_ed25519` (permissions correct)
- ✅ Key in SSH agent
- ✅ Correct remote address (10.100.0.1 via WireGuard)
- ✅ Network connectivity (ping works, <1ms)
- ✅ SSH protocol support (server accepts ED25519)

**But missing:**
- ❌ Public key in server's `~/.ssh/authorized_keys`
- ❌ Or permissions issue on server side

---

## Verification Checklist

After adding the key, verify with:

```bash
# 1. Ping test (should already work)
ping -c 2 10.100.0.1

# 2. SSH test (should now work)
ssh user@10.100.0.1 "whoami"

# 3. Git operations test
ssh user@10.100.0.1 "cd /home/user && git status"

# 4. Docker access test
ssh user@10.100.0.1 "docker ps"
```

All four should succeed without asking for a password.

---

## Key Details for Reference

**SSH Key Information:**
- **Type**: ED25519 (modern, secure)
- **Generated**: November 2025
- **Location (laptop)**: `~/.ssh/id_ed25519`
- **Fingerprint**: `SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY`
- **Comment**: christopher@corella.com

**Server Details:**
- **Address**: 10.100.0.1 (via WireGuard VPN)
- **User**: user
- **Home**: /home/user
- **SSH config**: `/etc/ssh/sshd_config` (should allow ED25519 keys)

**SSH Agent (verified working):**
```
The SSH agent has the key loaded:
  256 SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY christopher@corella.com (ED25519)
```

---

## Troubleshooting

**If it still doesn't work after adding the key:**

1. **Verify key was added correctly:**
   ```bash
   ssh user@10.100.0.1 "grep christopher ~/.ssh/authorized_keys"
   # Should show: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== christopher@corella.com
   ```

2. **Check permissions:**
   ```bash
   ssh user@10.100.0.1 "ls -la ~/.ssh/authorized_keys"
   # Should show: -rw------- (600)
   ssh user@10.100.0.1 "ls -la ~/.ssh"
   # Should show: drwx------ (700)
   ```

3. **Check SSH server logs:**
   ```bash
   ssh user@10.100.0.1 "tail -20 /var/log/auth.log | grep sshd"
   # Look for why the key is being rejected
   ```

4. **Verify the key matches:**
   ```bash
   # On laptop:
   ssh-keygen -l -f ~/.ssh/id_ed25519.pub
   # Should show: 256 SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY

   # On server:
   ssh user@10.100.0.1 "ssh-keygen -l -f ~/.ssh/authorized_keys"
   # Should show the same fingerprint
   ```

---

## Next Steps

1. ✅ Add Claude's public key to `~/.ssh/authorized_keys` on the server
2. ✅ Fix permissions (600 for file, 700 for directory)
3. ✅ Test SSH connection
4. ✅ Push confirmation commit to git repo
5. ✅ Claude Code on laptop can then access the remote server

---

## Related Documentation

See also:
- `/home/user/CLAUDE.md` - Server-level guidance (section: Production Server Access)
- `docs/server/SSH_KEY_SETUP_FEBRUARY_2026.md` - Complete SSH key setup history
- `docs/operations/LAPTOP_SSH_RECOVERY_ATTEMPT_NOVEMBER_15_2025.md` - Previous SSH recovery

---

**Questions?** This doc was created by Claude Code after diagnosing SSH connectivity issues. The remote model should reference this when setting up access for Claude Code.
