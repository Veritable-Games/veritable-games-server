# BTCPay Wallet Backup Checklist
**Created**: November 22, 2025
**Purpose**: Ensure your Bitcoin and Lightning funds can ALWAYS be recovered

---

## 🎯 The Golden Rule

**Your funds are only as safe as your backups.**

Even if the server explodes, gets stolen, or is destroyed by a meteor - with proper backups, you can recover 100% of your funds on a new server in 2-4 hours.

---

## 🔑 What Needs to Be Backed Up

### 1. Bitcoin Wallet Seed Words (MOST CRITICAL)

**What it is**: 12 or 24 English words generated when you create the wallet

**Example**:
```
word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12
```

**Why critical**: These words ARE your Bitcoin wallet. Anyone with these words can spend your funds. You need them to recover funds if server dies.

**When you get it**: BTCPay shows these ONCE when you create a new wallet. You must write them down immediately.

**How to store** (you need AT LEAST 2 copies):

#### Primary Copy (Required)
- [ ] **Write on paper** with pen (not pencil, it fades)
- [ ] **Use index cards or notebook** (not sticky notes)
- [ ] **Number each word** (1-12 or 1-24)
- [ ] **Verify spelling** by reading back
- [ ] **Store in fireproof safe** or locked drawer

#### Backup Copy #1 (Required)
- [ ] **Encrypted digital file** on laptop:
  ```bash
  # Create encrypted file on laptop
  cd ~
  mkdir -p btcpay-critical-backup

  # Type your seed words in a file
  nano btcpay-critical-backup/bitcoin-seed-words.txt
  # (Type your 12 or 24 words, save, exit)

  # Encrypt it with strong password
  gpg -c btcpay-critical-backup/bitcoin-seed-words.txt

  # Delete unencrypted version
  shred -u btcpay-critical-backup/bitcoin-seed-words.txt

  # Keep only: bitcoin-seed-words.txt.gpg
  ```

  To decrypt later:
  ```bash
  gpg -d btcpay-critical-backup/bitcoin-seed-words.txt.gpg
  ```

- [ ] **Store encrypted file** in `~/btcpay-critical-backup/` on laptop
- [ ] **Password for GPG**: Store in password manager (Bitwarden, 1Password, KeePass)

#### Backup Copy #2 (Recommended)
- [ ] **Encrypted USB drive** kept offsite:
  - Format USB drive with LUKS encryption (Linux)
  - OR use VeraCrypt (cross-platform)
  - Copy `bitcoin-seed-words.txt.gpg` to encrypted drive
  - Store at trusted friend/family member's house or bank safety deposit box

#### Optional: Metal Backup (For Large Amounts >$10,000)
- [ ] **Stamp/engrave words on metal**:
  - Use Blockplate, CryptoSteel, or similar
  - Metal survives fire/water/corrosion
  - Store in safe or bank vault
  - Cost: $30-100

**NEVER**:
- ❌ Store seed words in cloud (Google Drive, Dropbox, iCloud)
- ❌ Store unencrypted on computer
- ❌ Take screenshots
- ❌ Email or text to yourself
- ❌ Store in password manager in plain text (use encrypted note if your password manager supports it)

---

### 2. Lightning hsm_secret (CRITICAL)

**What it is**: 32-byte binary file that IS your Lightning wallet

**Current seed (hex)**: `62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54`

**Where it is**:
- Server: `/var/lib/docker/volumes/generated_clightning_bitcoin_datadir/_data/bitcoin/hsm_secret`
- Backup: `/home/user/backups/btcpay/lightning-hsm_secret-*` (automatically backed up daily)

**How to back up**:

#### Automated Backup (Already Set Up ✅)
- [x] Daily backup script runs at 3:00 AM UTC
- [x] Saves to `/home/user/backups/btcpay/lightning-hsm_secret-YYYYMMDD-HHMMSS`
- [x] 30-day retention

#### Manual Offsite Copy (Do This Monthly)
```bash
# On server
ssh user@192.168.1.15

# Find latest backup
ls -lt /home/user/backups/btcpay/lightning-hsm_secret-* | head -1

# Copy to laptop
# From laptop:
scp user@192.168.1.15:/home/user/backups/btcpay/lightning-hsm_secret-<LATEST> ~/btcpay-critical-backup/

# OR copy the hex string and save encrypted:
ssh user@192.168.1.15 "cat /var/lib/docker/volumes/generated_clightning_bitcoin_datadir/_data/bitcoin/hsm_secret | xxd -p -c 64"
# Copy output, save to encrypted file on laptop
```

#### Encrypted Storage on Laptop
```bash
# On laptop
cd ~/btcpay-critical-backup

# Save hex seed to file
echo "62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54" > lightning-seed-hex.txt

# Encrypt it
gpg -c lightning-seed-hex.txt

# Delete unencrypted
shred -u lightning-seed-hex.txt

# Keep only: lightning-seed-hex.txt.gpg
```

**To recover Lightning wallet from hex**:
```bash
# Convert hex back to binary
echo -n "62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54" | xxd -r -p > hsm_secret

# Copy to Lightning container
docker cp hsm_secret btcpayserver_clightning_bitcoin:/root/.lightning/bitcoin/hsm_secret

# Set permissions
docker exec btcpayserver_clightning_bitcoin chmod 400 /root/.lightning/bitcoin/hsm_secret
```

---

### 3. Bitcoin wallet.dat File (Optional, Nice to Have)

**What it is**: SQLite file containing wallet keys and transaction history

**Where it is**: `/var/lib/docker/volumes/generated_bitcoin_wallet_datadir/_data/mainnet/wallet.dat`

**How to back up**:

#### Automated Backup (Daily)
- [x] Backup script runs at 3:00 AM UTC
- [x] Saves to `/home/user/backups/btcpay/bitcoin-wallet-YYYYMMDD-HHMMSS.dat`
- [x] 30-day retention

#### Manual Backup
```bash
# On server
docker exec btcpayserver_bitcoind bitcoin-cli backupwallet /tmp/wallet-backup.dat
docker cp btcpayserver_bitcoind:/tmp/wallet-backup.dat ~/backups/btcpay/bitcoin-wallet-manual-$(date +%Y%m%d).dat

# Copy to laptop
scp user@192.168.1.15:~/backups/btcpay/bitcoin-wallet-manual-*.dat ~/btcpay-critical-backup/
```

**Note**: You don't NEED this if you have seed words, but it makes recovery faster (no blockchain rescan needed).

---

### 4. BTCPay PostgreSQL Database (Optional, Nice to Have)

**What it is**: Store configuration, invoice history, webhooks, API keys

**Where it is**: `btcpayservermainnet` database in PostgreSQL

**How to back up**:

#### Automated Backup (Daily)
- [x] Backup script runs at 3:00 AM UTC
- [x] Saves to `/home/user/backups/btcpay/postgres-btcpay-YYYYMMDD-HHMMSS.sql.gz`
- [x] 30-day retention

#### Manual Backup
```bash
# On server
docker exec generated_postgres_1 pg_dump -U postgres btcpayservermainnet | gzip > ~/backups/btcpay/postgres-manual-$(date +%Y%m%d).sql.gz

# Copy to laptop
scp user@192.168.1.15:~/backups/btcpay/postgres-manual-*.sql.gz ~/btcpay-critical-backup/
```

**Note**: Losing this is inconvenient (need to recreate store/webhooks) but does NOT lose funds.

---

## 📋 Monthly Backup Verification Checklist

**Do this the first Saturday of each month:**

### On Server (5 minutes)

```bash
# SSH to server
ssh user@192.168.1.15

# 1. Check automated backups are running
ls -lht /home/user/backups/btcpay/ | head -10
# Should see files from last 7 days

# 2. Check backup script logs
tail -50 /home/user/backups/btcpay-backup.log
# Should show "SUCCESS" and no errors

# 3. Verify Lightning seed backup is current
ls -l /home/user/backups/btcpay/lightning-hsm_secret-* | tail -1
# Should be from last 24 hours

# 4. Test Bitcoin wallet is accessible
docker exec btcpayserver_bitcoind bitcoin-cli getwalletinfo
# Should show wallet info (not error)

# 5. Test Lightning wallet is accessible
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo
# Should show node ID: 02dbaf8e4afcd59b5373caf8774e6fb6590361c2514af48fd0e0f427dc2b806b29
```

### On Laptop (10 minutes)

- [ ] **Check encrypted files exist**:
  ```bash
  ls -l ~/btcpay-critical-backup/
  # Should show:
  # bitcoin-seed-words.txt.gpg
  # lightning-seed-hex.txt.gpg
  # bitcoin-wallet-*.dat (optional)
  # postgres-manual-*.sql.gz (optional)
  ```

- [ ] **Test decryption** (ensure you remember password):
  ```bash
  # Try to decrypt (DON'T save unencrypted file)
  gpg -d ~/btcpay-critical-backup/bitcoin-seed-words.txt.gpg
  # Should prompt for password, then show your 12/24 words
  ```

- [ ] **Verify seed words on paper** are readable and match digital backup

- [ ] **Check offsite backup** (USB drive at friend's house):
  - Retrieve USB drive quarterly
  - Verify encrypted volume mounts
  - Verify files are present
  - Update with latest backups if needed

---

## 🧪 Quarterly Recovery Test (CRITICAL)

**Do this every 3 months (March, June, September, December):**

This ensures your backups ACTUALLY work when you need them.

### Test on Laptop (No Risk)

1. **Set up test BTCPay environment**:
   ```bash
   # On laptop, use regtest (fake Bitcoin network)
   export BTCPAY_HOST="localhost"
   export NBITCOIN_NETWORK="regtest"

   # Install BTCPay in test mode
   # (follow BTCPay docs for regtest setup)
   ```

2. **Practice seed word recovery**:
   - Decrypt your seed words file
   - Enter them in test BTCPay instance
   - Verify wallet is created
   - Generate test address

3. **Practice Lightning recovery**:
   - Decrypt Lightning hex seed
   - Convert to binary
   - Copy to test Lightning node
   - Verify node ID matches

4. **Document any issues**:
   - Update this checklist
   - Fix problems in main backup procedures
   - Update recovery documentation

**If you can't recover in test environment, you WON'T be able to recover in real emergency!**

---

## 🚨 Emergency Recovery Priorities

If server dies RIGHT NOW, here's what you need:

### Priority 1 (MUST HAVE - Can't recover without these)
- [ ] Bitcoin seed words (paper or encrypted file)
- [ ] Lightning hsm_secret (hex string or binary file)

### Priority 2 (Nice to Have - Makes recovery faster)
- [ ] Bitcoin wallet.dat backup
- [ ] BTCPay PostgreSQL database backup

### Priority 3 (Convenience - Can be recreated)
- [ ] Store settings
- [ ] Webhook configurations
- [ ] API keys

**With just Priority 1, you can recover 100% of funds in 2-4 hours on new server.**

---

## 📍 Backup Storage Locations

**Document where YOUR backups are stored:**

### Server Backups (Automated Daily)
- **Location**: `/home/user/backups/btcpay/`
- **Disk**: `/dev/sdb` (931GB, separate from system disk)
- **Retention**: 30 days rolling
- **Cron schedule**: 3:00 AM UTC daily

### Laptop Backups (Manual Monthly)
- **Location**: `~/btcpay-critical-backup/`
- **Encryption**: GPG with password in Bitwarden
- **Files**:
  - `bitcoin-seed-words.txt.gpg` (encrypted seed words)
  - `lightning-seed-hex.txt.gpg` (encrypted Lightning seed)
  - `bitcoin-wallet-YYYYMMDD.dat` (optional wallet file)
  - `postgres-manual-YYYYMMDD.sql.gz` (optional database dump)

### Offsite Backup (Manual Quarterly)
- **Location**: Encrypted USB drive
- **Physical location**: [WRITE WHERE YOU KEEP IT]
- **Encryption**: LUKS or VeraCrypt
- **Update frequency**: Every 3 months
- **Last updated**: [WRITE DATE]

### Paper Backup
- **Bitcoin seed words**: [WRITE WHERE YOU KEEP PAPER]
- **Format**: Numbered 1-12 or 1-24
- **Last verified**: [WRITE DATE]

---

## 🔐 Security Best Practices

### For Seed Words
- ✅ Use strong unique password for GPG encryption
- ✅ Store password in password manager (not same file as encrypted seeds)
- ✅ Never store unencrypted seeds on any computer
- ✅ Never take photos of seed words
- ✅ Never type seed words on internet-connected computer (except BTCPay server you control)

### For Lightning hsm_secret
- ✅ Keep encrypted copies in multiple locations
- ✅ Verify hex string matches: `62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54`
- ✅ Test conversion from hex to binary quarterly

### For Laptop Backups
- ✅ Enable full disk encryption (LUKS, FileVault, BitLocker)
- ✅ Use strong laptop login password
- ✅ Don't leave laptop unattended with encrypted files accessible
- ✅ Backup laptop to external drive (encrypted)

### For Offsite Backups
- ✅ Use trusted location (family member, bank vault)
- ✅ Use tamper-evident seals on USB drive
- ✅ Check quarterly for physical damage
- ✅ Have plan to retrieve quickly in emergency

---

## ⏰ Backup Schedule Summary

| Task | Frequency | Automated | Time Required |
|------|-----------|-----------|---------------|
| Automated server backup | Daily (3:00 AM) | ✅ Yes | 0 min (automatic) |
| Copy to laptop | Monthly | ❌ Manual | 10 min |
| Update offsite USB | Quarterly | ❌ Manual | 15 min |
| Verify paper backup | Monthly | ❌ Manual | 2 min |
| Test decryption | Monthly | ❌ Manual | 5 min |
| Full recovery test | Quarterly | ❌ Manual | 60 min |

**Total time commitment**: ~30 minutes/month + 60 minutes/quarter

---

## 📞 Emergency Contacts

**If you lose access to backups:**

1. **Try to recover from**:
   - Paper backup (Bitcoin seed words)
   - Laptop encrypted files
   - Offsite USB drive
   - Server backups (if server is accessible)

2. **If all backups are lost AND server is dead**:
   - Funds are UNRECOVERABLE
   - This is why you MUST maintain multiple backup copies
   - Test your backups regularly!

---

## 📚 Related Documentation

- **Recovery procedures**: `/home/user/docs/server/BTCPAY_DISASTER_RECOVERY_GUIDE.md`
- **Backup script**: `/home/user/backups/scripts/backup-btcpay.sh`
- **Disk failure incident**: `/home/user/docs/server/BTCPAY_DISK_FAILURE_RECOVERY_NOV22_2025.md`

---

## ✅ Initial Setup Checklist

**When you first create your wallet, do ALL of these immediately:**

- [ ] Write down 12/24 seed words on paper
- [ ] Number each word
- [ ] Verify spelling by reading back
- [ ] Store paper in secure location
- [ ] Create encrypted digital backup on laptop
- [ ] Test decryption to ensure it works
- [ ] Save GPG password in password manager
- [ ] Copy Lightning hsm_secret to laptop
- [ ] Create encrypted USB drive for offsite backup
- [ ] Store USB at trusted offsite location
- [ ] Set calendar reminder for monthly verification
- [ ] Set calendar reminder for quarterly recovery test
- [ ] Update this checklist with YOUR storage locations

**DO NOT skip any steps! Your future self will thank you.**

---

**Last Updated**: November 22, 2025
**Server**: veritable-games-server (192.168.1.15)

**⚠️ Remember**: Cryptocurrency backups are YOUR responsibility. No one can help you if you lose your seed words and server dies. Test your backups regularly!
