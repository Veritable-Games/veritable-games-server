# BTCPay Server Store Recreation Guide
**Date**: November 22, 2025
**Server**: btcpay.veritablegames.com
**Status**: Wallet intact, store configuration lost

---

## 🎯 Quick Summary

**What You Lost**: Store configuration, invoice history, webhooks
**What You Kept**: Bitcoin wallet, Lightning wallet, all funds ✅

**Your Wallet Info (SAFE)**:
- **Lightning Seed (hex)**: `62e866a5a63d86f33f9c8ae5bfd305900f8ff83d478773d39fb86dcc25308c54`
- **Lightning Node ID**: `02dbaf8e4afcd59b5373caf8774e6fb6590361c2514af48fd0e0f427dc2b806b29`
- **Lightning Alias**: `LOUDRAGE`
- **Bitcoin Wallet**: wallet.dat intact
- **Backups**: `/home/user/backups/btcpay/` (automated daily at 3:00 AM)

---

## ✅ Step 1: Create New Store

**You're at**: `https://btcpay.veritablegames.com/stores/create?skipWizard=true`

### Fill in the form:

1. **Store Name**: `Veritable Games`
2. **Store Website**: `https://www.veritablegames.com`
3. **Preferred price source**: `Binance` (default is fine)
4. **Default Currency**: `USD`

**Click "Create"**

---

## ✅ Step 2: Set Up Bitcoin Wallet

After creating the store, you'll be taken to wallet setup.

### Your Existing Wallet is Intact!

**Option A: Import Existing Wallet (Recommended)**

1. Click **"Set up a wallet"** for Bitcoin
2. Select **"Connect an existing wallet"**
3. Choose **"Import wallet file"**
4. The system should detect your existing `wallet.dat` automatically
5. Click **"Import"**

**Your wallet file location**: `/var/lib/docker/volumes/generated_bitcoin_wallet_datadir/_data/mainnet/wallet.dat`

### Check Bitcoin Sync Status

Your Bitcoin node is still syncing. Check progress:

**Current sync status**: Run this to check:
```bash
docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo | grep -E "blocks|headers|verificationprogress"
```

**When fully synced**, you can check your balance:
```bash
docker exec btcpayserver_bitcoind bitcoin-cli getbalance
```

---

## ✅ Step 3: Set Up Lightning Wallet

**Your Lightning Node is Running** with your seed intact!

### Configure Lightning in BTCPay:

1. Go to **Store Settings** → **Lightning**
2. Click **"Setup"** under Bitcoin Lightning
3. Select **"Use internal Lightning node"**
4. **Connection type**: `C-Lightning (Core Lightning)`
5. **Connection string** should auto-fill:
   ```
   type=clightning;server=unix://root/.lightning/bitcoin/lightning-rpc
   ```
6. Click **"Test connection"** → Should show ✅ Success
7. Click **"Save"**

### Your Lightning Node Info:

- **Node ID**: `02dbaf8e4afcd59b5373caf8774e6fb6590361c2514af48fd0e0f427dc2b806b29`
- **Alias**: `LOUDRAGE`
- **Public Address**:
  - IPv4: `104.21.35.154:9735`
  - Tor: `egp63puet2v4wml37v2sqbhtzuffwm5jzcrjennxohxar6lmuszoniid.onion:9735`
- **Current Channels**: 0 (you'll need to open channels for Lightning payments)
- **Current Balance**: 0 BTC

### Check Lightning Status:

```bash
# Check node info
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo

# Check funds/channels
docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds
```

---

## ✅ Step 4: Configure Payment Methods

### In Store Settings → Payment Methods:

**Bitcoin (On-Chain)**:
- ✅ **Enabled**: Yes
- **Derivation Scheme**: Should auto-populate from your wallet
- **Label**: `Bitcoin`
- **Payment method criteria**:
  - Minimum: `$5.00` (or your preference)
  - Maximum: Leave blank for unlimited

**Lightning Network**:
- ✅ **Enabled**: Yes
- **Connection**: Should show your C-Lightning node
- **Label**: `Bitcoin (Lightning)`
- **Payment method criteria**:
  - Minimum: `$0.01` (Lightning is great for small payments)
  - Maximum: `$100` (recommended for Lightning until you have more liquidity)

**Invoice Expiration**: `15 minutes` (default)

---

## ✅ Step 5: Set Up Webhook for Veritable Games

**This connects BTCPay payments to your website's database.**

### Create Webhook:

1. Go to **Store Settings** → **Webhooks**
2. Click **"Create Webhook"**

### Configuration:

**Payload URL**:
```
https://www.veritablegames.com/api/webhooks/btcpay
```

**Secret** (generate a random string):
```bash
# Run this on server to generate:
openssl rand -hex 32
```
**SAVE THIS SECRET** - You'll need it for Step 7!

**Events to Monitor** - Select these:
- ✅ `Invoice created`
- ✅ `Invoice received payment`
- ✅ `Invoice processing`
- ✅ `Invoice expired`
- ✅ `Invoice settled`
- ✅ `Invoice invalid`

**Automatic redelivery**: ✅ Enabled (recommended)

**Content Type**: `application/json`

**Click "Add webhook"**

### Verify Webhook:

The webhook endpoint already exists in your codebase:
- File: `frontend/src/app/api/webhooks/btcpay/route.ts`
- No CSRF protection (webhooks are exempt)
- Signature verification using `BTCPAY_WEBHOOK_SECRET`

---

## ✅ Step 6: Generate API Key

**For programmatic invoice creation from your website.**

### Create API Key:

1. Go to **Account** → **Manage Account** → **API Keys**
2. Click **"Generate Key"**

### Configuration:

**Label**: `Veritable Games Frontend`

**Permissions** - Select these:
- ✅ `btcpay.store.canmodifyinvoices` - Create and modify invoices
- ✅ `btcpay.store.canviewinvoices` - View invoice details
- ✅ `btcpay.store.webhooks.canmodifywebhooks` - (Optional) Manage webhooks programmatically

**Click "Generate"**

**⚠️ CRITICAL**: Copy the API key immediately! It will only be shown once.

**Format**: Looks like `BTCPay-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## ✅ Step 7: Add Environment Variables to Coolify

**These connect your website to BTCPay Server.**

### Required Variables:

```bash
BTCPAY_HOST=btcpay.veritablegames.com
BTCPAY_API_KEY=<your-api-key-from-step-6>
BTCPAY_WEBHOOK_SECRET=<your-webhook-secret-from-step-5>
BTCPAY_STORE_ID=<your-new-store-id>
```

### Get Your Store ID:

1. In BTCPay, go to **Store Settings**
2. Look at the URL: `https://btcpay.veritablegames.com/stores/YOUR_STORE_ID/settings`
3. Or look for **Store ID** in the settings page

**Store ID format**: Looks like `AgkrKHhe7sxnH9k8vAuSgxNJYffzMSEudx1SV4BSnmPP`

### Method 1: Add via Coolify Web UI (Easiest)

1. Open http://192.168.1.15:8000
2. Navigate to your application (Veritable Games)
3. Click **Environment Variables** tab
4. Click **Add**
5. For each variable:
   - Enter **Key** (e.g., `BTCPAY_HOST`)
   - Enter **Value**
   - ✅ Check **Is Runtime** (available when container runs)
   - ✅ Check **Is Build Time** (available during build)
   - Click **Save**
6. After adding all 4 variables, click **Redeploy**

### Method 2: Add via Coolify CLI (From Server or Laptop)

```bash
# Add BTCPAY_HOST
docker exec coolify php artisan tinker --execute="
\$app = \App\Models\Application::where('uuid', 'm4s0kwo4kc4oooocck4sswc4')->first();
if (\$app) {
    \App\Models\EnvironmentVariable::create([
        'key' => 'BTCPAY_HOST',
        'value' => 'btcpay.veritablegames.com',
        'is_buildtime' => true,
        'is_runtime' => true,
        'is_preview' => false,
        'resourceable_id' => \$app->id,
        'resourceable_type' => 'App\Models\Application',
    ]);
    echo 'SUCCESS: BTCPAY_HOST added' . PHP_EOL;
}
"

# Repeat for other variables (BTCPAY_API_KEY, BTCPAY_WEBHOOK_SECRET, BTCPAY_STORE_ID)
```

### Redeploy Application:

```bash
# From server or laptop
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# Wait 3-5 minutes for build to complete
```

### Verify Variables in Container:

```bash
# Check all environment variables
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep BTCPAY
```

Should show all 4 BTCPAY_* variables.

---

## ✅ Step 8: Test Your Setup

### Test 1: Create a Test Invoice in BTCPay

1. In BTCPay, go to **Invoices**
2. Click **"Create Invoice"**
3. **Amount**: `$5.00`
4. **Currency**: `USD`
5. **Order ID**: `test-001`
6. Click **"Create"**

**Expected Result**: You should see a payment page with:
- QR code for Bitcoin payment
- Lightning invoice option
- Timer counting down (15 minutes default)

### Test 2: Verify Webhook Fires

After creating the test invoice:

```bash
# Check your application logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep btcpay
```

**Expected**: Should see webhook received and processed

### Test 3: Check Bitcoin Wallet

```bash
# Check if Bitcoin is fully synced
docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo | grep blocks

# If synced, check balance
docker exec btcpayserver_bitcoind bitcoin-cli getbalance
```

### Test 4: Check Lightning Wallet

```bash
# Check Lightning node status
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo

# Check balance and channels
docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds
```

---

## 🔧 Next Steps (Optional but Recommended)

### 1. Fund Your Lightning Node

**Why**: Lightning Network requires channels with liquidity for instant payments.

**How to get Lightning liquidity**:

**Option A: Open channels to well-connected nodes**
```bash
# Connect to a peer
docker exec btcpayserver_clightning_bitcoin lightning-cli connect <node_id>@<ip>:<port>

# Fund a channel (amount in satoshis)
docker exec btcpayserver_clightning_bitcoin lightning-cli fundchannel <node_id> <amount_in_sats>
```

**Option B: Use a Lightning Service Provider (LSP)**
- Bitrefill, Lightning Loop, or similar services
- They open channels to you with inbound liquidity

**Option C: Use Lightning Pool** (rent channels)

**Recommended initial funding**: 0.01 BTC (~$500-900) across 2-3 channels

### 2. Customize Invoice Appearance

1. Go to **Store Settings** → **Checkout Appearance**
2. Upload logo (recommended: 200x200px PNG)
3. Set brand color
4. Customize checkout experience

### 3. Set Up Email Notifications (When Ready)

Configure email settings to notify you of new invoices:
1. Go to **Server Settings** → **Email**
2. Configure SMTP (Resend, SendGrid, etc.)
3. Enable notifications

### 4. Test a Real Donation

Create a small test invoice and pay it to verify full flow:
1. Create invoice in BTCPay
2. Pay with Lightning or on-chain
3. Verify webhook fires
4. Check database for donation record

---

## 🚨 Important Security Notes

### Protect Your API Key

**The API key you generated has full control over invoices!**

- ✅ Store in environment variables only
- ❌ Never commit to git
- ❌ Never expose in client-side code
- ✅ Use server-side only (API routes)

### Webhook Security

**The webhook secret prevents unauthorized invoice updates:**

- ✅ BTCPay signs webhooks with HMAC-SHA256
- ✅ Your code verifies signatures before processing
- ❌ Never disable signature verification
- ✅ Use strong random secret (32+ characters)

### Lightning Wallet Security

**Your Lightning node is a hot wallet** (always online):

- ✅ Keep low balance (treat like cash in your pocket)
- ✅ Use on-chain for large amounts
- ✅ Backup seed is stored at `/home/user/backups/btcpay/lightning-hsm_secret-*`
- ⚠️ If server is compromised, Lightning funds are at risk

**Recommendation**: Keep < $1000 in Lightning channels

---

## 📋 Quick Reference

### Your BTCPay Configuration:

- **BTCPay URL**: https://btcpay.veritablegames.com
- **Store Name**: Veritable Games
- **Webhook URL**: https://www.veritablegames.com/api/webhooks/btcpay
- **Bitcoin Wallet**: Native SegWit (bech32)
- **Lightning Node**: C-Lightning
- **Lightning Alias**: LOUDRAGE

### Wallet Backup Locations:

- **Lightning Seed**: `/home/user/backups/btcpay/lightning-hsm_secret-*`
- **Bitcoin Wallet**: `/home/user/backups/btcpay/bitcoin-wallet-*`
- **Emergency Recovery**: `/home/user/backups/btcpay/lightning-emergency-*`

### Server Commands:

```bash
# BTCPay container operations
cd /home/user/btcpayserver-docker
./btcpay-up.sh        # Start all containers
./btcpay-down.sh      # Stop all containers
./btcpay-restart.sh   # Restart

# Bitcoin commands
docker exec btcpayserver_bitcoind bitcoin-cli getblockchaininfo
docker exec btcpayserver_bitcoind bitcoin-cli getbalance

# Lightning commands
docker exec btcpayserver_clightning_bitcoin lightning-cli getinfo
docker exec btcpayserver_clightning_bitcoin lightning-cli listfunds

# Check BTCPay logs
docker logs generated_btcpayserver_1 --tail 50

# Backup manually
bash /home/user/backups/scripts/backup-btcpay.sh
```

### Coolify Deployment:

```bash
# Trigger deployment
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# Check application status
coolify app get m4s0kwo4kc4oooocck4sswc4

# View logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100
```

---

## 📚 Additional Documentation

**On Server**:
- Disk failure recovery: `/home/user/docs/server/BTCPAY_DISK_FAILURE_RECOVERY_NOV22_2025.md`
- Backup system: `/home/user/docs/server/MONITORING_AND_BACKUP_SYSTEM.md`
- Backup script: `/home/user/backups/scripts/backup-btcpay.sh`

**In Project Repository** (for development):
- BTCPay research: `frontend/docs/BTCPAY_SERVER_RESEARCH_REPORT.md`
- Cloudflare setup: `frontend/docs/donations/BTCPAY_CLOUDFLARE_TUNNEL_SETUP.md`
- Implementation status: `frontend/docs/donations/IMPLEMENTATION_STATUS.md`
- Webhook route: `frontend/src/app/api/webhooks/btcpay/route.ts`
- Service layer: `frontend/src/lib/donations/service.ts`

---

## ✅ Checklist

Use this to track your progress:

- [ ] Step 1: Create store ✅ (You're doing this now)
- [ ] Step 2: Set up Bitcoin wallet
- [ ] Step 3: Set up Lightning wallet
- [ ] Step 4: Configure payment methods
- [ ] Step 5: Create webhook
- [ ] Step 6: Generate API key
- [ ] Step 7: Add environment variables to Coolify
- [ ] Step 8: Redeploy application
- [ ] Test: Create test invoice
- [ ] Test: Verify webhook fires
- [ ] Test: Check Bitcoin sync status
- [ ] Test: Check Lightning node
- [ ] Optional: Fund Lightning channels
- [ ] Optional: Customize invoice appearance
- [ ] Optional: Test real donation

---

## 🎉 Summary

**What You're Recreating**:
- Store configuration
- Wallet connections (Bitcoin + Lightning)
- Webhook integration
- API access

**What You're Keeping**:
- Your Bitcoin funds (wallet.dat intact)
- Your Lightning seed (backed up)
- Your node identity

**Time Estimate**: 15-20 minutes to complete all steps

**Result**: Fully operational BTCPay Server integrated with Veritable Games donation system!

---

**Created**: November 22, 2025
**For**: Veritable Games BTCPay Server restoration
**Author**: Claude (Sonnet 4.5)
