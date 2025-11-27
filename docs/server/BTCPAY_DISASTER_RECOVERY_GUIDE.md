# BTCPay Server Disaster Recovery Guide
**Created**: November 22, 2025
**Server**: btcpay.veritablegames.com
**Purpose**: Complete procedures for recovering BTCPay Server after catastrophic failure

---

## 🎯 Overview

This guide covers complete recovery procedures for BTCPay Server when:
- Server hardware fails (disk, motherboard, etc.)
- Server is lost/stolen/destroyed
- Docker containers are corrupted
- You need to migrate to new hardware
- PostgreSQL database is lost

**Critical principle**: With your seed words and Lightning hsm_secret, you can recover 100% of your Bitcoin and Lightning funds on ANY new server.

---

## 🔑 What You Need to Recover

### Essential Recovery Materials

**You MUST have at least ONE of these:**

1. **Bitcoin Seed Words** (12 or 24 words)
   - Written on paper during wallet creation
   - Example: `word1 word2 word3 ... word12`
   - This is THE master key to your Bitcoin funds
   - **Location**: See `BTCPAY_WALLET_BACKUP_CHECKLIST.md` for where you stored it

2. **Lightning hsm_secret** (32-byte hex string)
   - Backed up automatically at: `/home/user/backups/btcpay/lightning-hsm_secret-*`
   - Current seed: `62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54`
   - Also backed up at: `/home/user/archives/btcpay-critical/` (offsite copy)

**Optional (makes recovery easier but not required):**

3. **Bitcoin wallet.dat file backup**
   - Location: `/home/user/backups/btcpay/bitcoin-wallet-*.dat`
   - Can recreate from seed words if missing

4. **BTCPay PostgreSQL database backup**
   - Location: `/home/user/backups/btcpay/postgres-btcpay-*.sql.gz`
   - Contains store config, invoice history, webhooks
   - Nice to have but can be recreated

---

## 🚨 Recovery Scenarios

### Scenario 1: Server Disk Failure (Most Common)

**What happened**: Disk died, but server is still accessible

**Recovery time**: 30-60 minutes

**Steps**:

1. **Check if backups are accessible**:
   ```bash
   ssh user@192.168.1.15
   ls -lh /home/user/backups/btcpay/
   ```

   If backups are on the failed disk → Skip to Scenario 2

2. **Restore Lightning wallet**:
   ```bash
   # Stop Lightning container
   cd /home/user/btcpayserver-docker
   docker stop btcpayserver_clightning_bitcoin

   # Find latest backup
   LATEST_HSM=$(ls -t /home/user/backups/btcpay/lightning-hsm_secret-* | head -1)

   # Restore seed
   docker cp $LATEST_HSM btcpayserver_clightning_bitcoin:/root/.lightning/bitcoin/hsm_secret

   # Fix permissions
   docker exec btcpayserver_clightning_bitcoin chmod 400 /root/.lightning/bitcoin/hsm_secret

   # Start Lightning
   docker start btcpayserver_clightning_bitcoin

   # Verify
   docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo
   ```

3. **Restore Bitcoin wallet**:

   **Option A: If you have wallet.dat backup**:
   ```bash
   # Find latest backup
   LATEST_WALLET=$(ls -t /home/user/backups/btcpay/bitcoin-wallet-* | head -1)

   # Copy to container
   docker cp $LATEST_WALLET btcpayserver_bitcoind:/tmp/wallet-restore.dat

   # Restore wallet
   docker exec btcpayserver_bitcoind bitcoin-cli restorewallet "" /tmp/wallet-restore.dat

   # Verify
   docker exec btcpayserver_bitcoind bitcoin-cli getwalletinfo
   ```

   **Option B: If you only have seed words** (see "Recover from Seed Words" below)

4. **Restore BTCPay database** (optional - for invoice history):
   ```bash
   # Find latest backup
   LATEST_DB=$(ls -t /home/user/backups/btcpay/postgres-btcpay-*.sql.gz | head -1)

   # Stop BTCPay
   cd /home/user/btcpayserver-docker
   ./btcpay-down.sh

   # Restore database
   gunzip -c $LATEST_DB | docker exec -i generated_postgres_1 psql -U postgres -d btcpayservermainnet

   # Start BTCPay
   ./btcpay-up.sh
   ```

5. **Verify everything works**:
   ```bash
   # Check Bitcoin
   docker exec btcpayserver_bitcoind bitcoin-cli getbalance

   # Check Lightning
   docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds

   # Access BTCPay
   curl -I https://btcpay.veritablegames.com
   ```

---

### Scenario 2: Complete Server Loss (Hardware Gone)

**What happened**: Server stolen, destroyed, or completely inaccessible

**Recovery time**: 2-4 hours

**What you need**:
- Bitcoin seed words (12 or 24 words on paper)
- Lightning hsm_secret (from offsite backup)
- New server or VPS

**Steps**:

#### Part 1: Set Up New BTCPay Server

1. **Install BTCPay Server on new hardware**:
   ```bash
   # On new server
   sudo su -

   # Download BTCPay installer
   cd /tmp
   git clone https://github.com/btcpayserver/btcpayserver-docker
   cd btcpayserver-docker

   # Set environment variables
   export BTCPAY_HOST="btcpay.veritablegames.com"
   export NBITCOIN_NETWORK="mainnet"
   export BTCPAYGEN_CRYPTO1="btc"
   export BTCPAYGEN_LIGHTNING="clightning"
   export BTCPAY_ENABLE_SSH=true

   # Run installer
   . ./btcpay-setup.sh -i

   # Wait 5-10 minutes for containers to start
   docker ps
   ```

2. **Wait for Bitcoin to sync** (or use pruned mode):
   ```bash
   # Check sync status
   docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo | grep progress

   # This will take 12-48 hours for full sync
   # OR use pruned mode (set in .env: BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-save-storage")
   ```

#### Part 2: Recover Bitcoin Wallet from Seed Words

1. **Access BTCPay web interface**: https://btcpay.veritablegames.com

2. **Create new user account** (if database wasn't restored)

3. **Create new store**: Name it "Veritable Games"

4. **Navigate to wallet setup**: Store Settings → Wallets → Bitcoin

5. **Choose "Enter wallet seed"** or "Import wallet" → "Recovery seed"

6. **Type your 12 or 24 seed words** (in order, from your paper backup):
   ```
   word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12
   ```

7. **Click "Import"**

8. **Wait for BTCPay to scan for transactions** (this can take 30-60 minutes)

9. **Verify your balance appears**

#### Part 3: Recover Lightning Wallet

1. **Stop Lightning container**:
   ```bash
   docker stop btcpayserver_clightning_bitcoin
   ```

2. **Get your Lightning hsm_secret from offsite backup**:
   - Check encrypted USB drive
   - OR check laptop backup at: `~/btcpay-critical-backup/lightning-hsm_secret`
   - OR use the hex string: `62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54`

3. **Create the seed file**:
   ```bash
   # Replace with your actual hex seed
   echo -n "62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54" | xxd -r -p > /tmp/hsm_secret

   # Copy to Lightning container
   docker cp /tmp/hsm_secret btcpayserver_clightning_bitcoin:/root/.lightning/bitcoin/hsm_secret

   # Set permissions
   docker exec btcpayserver_clightning_bitcoin chmod 400 /root/.lightning/bitcoin/hsm_secret

   # Remove temp file
   rm /tmp/hsm_secret
   ```

4. **Start Lightning**:
   ```bash
   docker start btcpayserver_clightning_bitcoin

   # Wait 30 seconds
   sleep 30

   # Verify node ID matches
   docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo | grep id
   # Should show: 02dbaf8e4afcd59b5373caf8774e6fb6590361c2514af48fd0e0f427dc2b806b29
   ```

5. **Connect Lightning to BTCPay store**:
   - Store Settings → Lightning
   - Choose "Use internal Lightning node"
   - Connection string: `type=clightning;server=unix://root/.lightning/bitcoin/lightning-rpc`
   - Test connection
   - Save

#### Part 4: Recreate Store Configuration

**If you don't have database backup, you need to recreate**:

1. **Webhooks**:
   - Store Settings → Webhooks → Create Webhook
   - URL: `https://www.veritablegames.com/api/webhooks/btcpay`
   - Secret: Generate new one (`openssl rand -hex 32`)
   - Events: All invoice events
   - Save and update Coolify environment variable

2. **API Keys**:
   - Account → API Keys → Generate Key
   - Permissions: `btcpay.store.canmodifyinvoices`, `btcpay.store.canviewinvoices`
   - Save and update Coolify environment variable

3. **Environment variables in Coolify**:
   ```
   BTCPAY_HOST=btcpay.veritablegames.com
   BTCPAY_API_KEY=<new-api-key>
   BTCPAY_WEBHOOK_SECRET=<new-webhook-secret>
   BTCPAY_STORE_ID=<new-store-id>
   ```

---

### Scenario 3: Docker Container Corruption

**What happened**: BTCPay containers won't start, but server is accessible

**Recovery time**: 15-30 minutes

**Steps**:

1. **Stop all containers**:
   ```bash
   cd /home/user/btcpayserver-docker
   ./btcpay-down.sh
   ```

2. **Rebuild containers** (keeps volumes intact):
   ```bash
   ./btcpay-update.sh
   ./btcpay-up.sh
   ```

3. **If that fails, nuclear option**:
   ```bash
   # ONLY do this if you have backups!
   docker-compose -f Generated/docker-compose.generated.yml down
   docker-compose -f Generated/docker-compose.generated.yml up -d
   ```

4. **Verify wallets are intact**:
   ```bash
   # Bitcoin
   docker exec btcpayserver_bitcoind bitcoin-cli getwalletinfo

   # Lightning
   docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo
   ```

---

### Scenario 4: PostgreSQL Database Corruption

**What happened**: BTCPay database is corrupted, but wallets are fine

**Recovery time**: 10-20 minutes

**Impact**: Lose invoice history, store settings, webhooks (but NOT funds)

**Steps**:

1. **Try to restore from backup first**:
   ```bash
   cd /home/user/btcpayserver-docker
   ./btcpay-down.sh

   # Restore latest backup
   LATEST_DB=$(ls -t /home/user/backups/btcpay/postgres-btcpay-*.sql.gz | head -1)
   gunzip -c $LATEST_DB | docker exec -i generated_postgres_1 psql -U postgres -d btcpayservermainnet

   ./btcpay-up.sh
   ```

2. **If backup fails, reset database**:
   ```bash
   # Stop BTCPay
   ./btcpay-down.sh

   # Reset database (⚠️ LOSES ALL STORE CONFIG)
   docker exec generated_postgres_1 psql -U postgres -c "DROP DATABASE btcpayservermainnet;"
   docker exec generated_postgres_1 psql -U postgres -c "CREATE DATABASE btcpayservermainnet;"

   # Start BTCPay (will auto-migrate)
   ./btcpay-up.sh
   ```

3. **Recreate store** (see Scenario 2, Part 4)

---

## 📝 Recovery Verification Checklist

After ANY recovery, verify these:

- [ ] Bitcoin wallet loads: `docker exec btcpayserver_bitcoind bitcoin-cli getwalletinfo`
- [ ] Bitcoin balance correct: `docker exec btcpayserver_bitcoind bitcoin-cli getbalance`
- [ ] Lightning node ID matches: Should be `02dbaf8e4afcd59b5373caf8774e6fb6590361c2514af48fd0e0f427dc2b806b29`
- [ ] Lightning funds correct: `docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds`
- [ ] BTCPay web interface accessible: https://btcpay.veritablegames.com
- [ ] Can create test invoice
- [ ] Webhook fires (check application logs)
- [ ] Can generate new receiving address

---

## 🧪 Testing Your Recovery Plan (CRITICAL)

**You MUST test recovery procedures BEFORE you need them!**

### Safe Recovery Test (No Risk)

**Do this monthly or quarterly:**

1. **Spin up test BTCPay instance** (on different port or test server)
2. **Practice recovering Bitcoin wallet from seed words**
3. **Practice recovering Lightning wallet from hsm_secret**
4. **Verify funds appear**
5. **Document any issues**
6. **Update this guide**

**Test environment setup**:
```bash
# On laptop or separate test environment
# Use regtest or testnet, NOT mainnet!
export BTCPAY_HOST="localhost"
export NBITCOIN_NETWORK="regtest"
export BTCPAYGEN_CRYPTO1="btc"

# Follow BTCPay installation, then practice recovery
```

---

## 🚨 Emergency Contact Information

**If you're stuck during recovery:**

1. **BTCPay Server Community**:
   - Chat: https://chat.btcpayserver.org/
   - Support: #support channel
   - Response time: Usually < 2 hours

2. **Documentation**:
   - Official docs: https://docs.btcpayserver.org/
   - Recovery guides: https://docs.btcpayserver.org/Docker/backup-restore/

3. **Critical Information for Support**:
   - BTCPay version: Check with `docker logs generated_btcpayserver_1 | head`
   - Bitcoin version: `docker exec btcpayserver_bitcoind bitcoin-cli --version`
   - Lightning version: `docker exec btcpayserver_clightning_bitcoin lightning-cli --version`
   - Error messages: Always copy full error logs

---

## 🔐 Security Reminders

**During recovery:**

- ✅ NEVER enter seed words on a website or online form
- ✅ NEVER share seed words in chat/email/screenshots
- ✅ NEVER store seed words in cloud services (Dropbox, Google Drive, etc.)
- ✅ Only enter seed words in BTCPay self-hosted instance YOU control
- ✅ Verify you're on YOUR server URL before entering seeds
- ✅ Use encrypted communication when transferring hsm_secret

**After recovery:**

- ✅ Create new backups immediately
- ✅ Update backup documentation with new locations
- ✅ Test backups within 24 hours

---

## 📚 Related Documentation

- **Backup procedures**: `/home/user/docs/server/BTCPAY_WALLET_BACKUP_CHECKLIST.md`
- **Backup script**: `/home/user/backups/scripts/backup-btcpay.sh`
- **Disk failure report**: `/home/user/docs/server/BTCPAY_DISK_FAILURE_RECOVERY_NOV22_2025.md`

---

## 🎯 Quick Reference Commands

### Check Status
```bash
# Bitcoin sync
docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo | grep progress

# Bitcoin balance
docker exec btcpayserver_bitcoind bitcoin-cli getbalance

# Lightning info
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo

# Lightning funds
docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds

# Container status
docker ps | grep btcpay
```

### Restart Services
```bash
cd /home/user/btcpayserver-docker

# Restart all
./btcpay-restart.sh

# Or individually
docker restart btcpayserver_bitcoind
docker restart btcpayserver_clightning_bitcoin
docker restart generated_btcpayserver_1
```

### View Logs
```bash
# BTCPay Server
docker logs generated_btcpayserver_1 --tail 50

# Bitcoin
docker logs btcpayserver_bitcoind --tail 50

# Lightning
docker logs btcpayserver_clightning_bitcoin --tail 50

# NBXplorer
docker logs generated_nbxplorer_1 --tail 50
```

---

**Last Updated**: November 22, 2025
**Server**: veritable-games-server (192.168.1.15)
**BTCPay URL**: https://btcpay.veritablegames.com

**⚠️ CRITICAL**: Keep this document synced with actual recovery materials. Update whenever backup locations change!
