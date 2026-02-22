# x402 Payment Protocol - Setup Guide

Complete instructions for deploying the x402 bot monetization system.

---

## Prerequisites

- Node.js 20.x or later
- Cloudflare account (Free tier works, Pro recommended for bot analytics)
- Base wallet for receiving USDC payments
- Domain configured with Cloudflare DNS

---

## Step 1: Cloudflare Account Setup

### 1.1 Install Wrangler CLI

```bash
# Install globally (recommended)
npm install -g wrangler

# Or use npx
npx wrangler --version
```

### 1.2 Authenticate with Cloudflare

```bash
wrangler login
# Browser opens for OAuth authentication
```

Verify login:
```bash
wrangler whoami
```

### 1.3 Register Workers Subdomain

If this is your first Worker, register a subdomain:

1. Go to Cloudflare Dashboard > Workers & Pages
2. Click "Set up" to choose your subdomain
3. Example: `yourname.workers.dev`

---

## Step 2: Create Cloudflare Resources

### 2.1 Create KV Namespace

```bash
wrangler kv namespace create PAYMENT_CACHE

# Output:
# Add the following to your wrangler.toml:
# [[kv_namespaces]]
# binding = "PAYMENT_CACHE"
# id = "YOUR_KV_ID"
```

Save the ID for later.

### 2.2 Create D1 Database

```bash
wrangler d1 create x402-payments

# Output:
# Created D1 database 'x402-payments'
# database_id = "YOUR_D1_ID"
```

Save the database ID.

### 2.3 Initialize Database Schema

```bash
cd frontend/mcp-servers/cloudflare-x402-proxy
wrangler d1 execute x402-payments --remote --file=schema.sql
```

---

## Step 3: Configure Worker

### 3.1 Update wrangler.toml

Edit `frontend/mcp-servers/cloudflare-x402-proxy/wrangler.toml`:

```toml
name = "veritable-x402-proxy"
main = "src/index.ts"
compatibility_date = "2025-12-16"
compatibility_flags = ["nodejs_compat"]

# Routes - intercept API traffic on your domain
routes = [
  { pattern = "www.yourdomain.com/api/*", zone_name = "yourdomain.com" }
]

# Environment variables
[vars]
ORIGIN_URL = "https://www.yourdomain.com"
PAYMENT_NETWORK = "base-sepolia"  # Use "base" for production
BLOCK_MODE = "false"              # Start with soft launch
DEBUG = "true"

# KV namespace (replace with your ID)
[[kv_namespaces]]
binding = "PAYMENT_CACHE"
id = "YOUR_KV_ID_HERE"

# D1 database (replace with your ID)
[[d1_databases]]
binding = "PAYMENTS_DB"
database_name = "x402-payments"
database_id = "YOUR_D1_ID_HERE"
```

### 3.2 Set Payment Recipient Secret

```bash
wrangler secret put PAYMENT_RECIPIENT
# Enter your Base wallet address (e.g., 0x123...)
```

**IMPORTANT:** Use your wallet's **public address**, never the private key.

---

## Step 4: Deploy

### 4.1 Deploy to Staging (Testnet)

```bash
cd frontend/mcp-servers/cloudflare-x402-proxy
npm install
npm run deploy:staging
```

### 4.2 Test Bot Detection

```bash
# Should return 402 (but allowed through in soft launch mode)
curl -H "User-Agent: python-requests/2.28.0" \
     "https://your-worker.workers.dev/api/documents/unified"
```

### 4.3 Enable Payment Blocking

When ready to enforce payments, update `wrangler.toml`:

```toml
[vars]
BLOCK_MODE = "true"
```

Redeploy:
```bash
npm run deploy:staging
```

### 4.4 Deploy to Production

When testing is complete:

```bash
# Update network to mainnet
# In wrangler.toml: PAYMENT_NETWORK = "base"

npm run deploy:production
```

---

## Step 5: Configure Cloudflare Settings

### 5.1 Disable AI Bot Blocking

The x402 system handles bot monetization - Cloudflare's built-in bot blocking will prevent bots from reaching the payment flow.

1. Go to Cloudflare Dashboard > Security > Bots
2. Find "Block AI Bots" and set to **"Do not block"**
3. Ensure "Bot Fight Mode" is **OFF**
4. Ensure "AI Labyrinth" is **OFF**

### 5.2 Verify Route Configuration

1. Go to Workers & Pages > your worker
2. Click "Triggers" tab
3. Verify route shows: `yourdomain.com/api/*`

---

## Step 6: Verify Deployment

### Test Human Access (Should Pass)

```bash
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" \
     -H "Accept-Language: en-US,en;q=0.5" \
     "https://www.yourdomain.com/api/health"

# Should return health check JSON
```

### Test Bot Detection (Should Return 402)

```bash
curl -H "User-Agent: Claude-Web/1.0" \
     "https://www.yourdomain.com/api/documents/unified"

# Should return 402 Payment Required
```

### Test Search Crawler (Should Pass Free)

```bash
curl -H "User-Agent: Googlebot/2.1" \
     "https://www.yourdomain.com/api/documents/unified"

# Should return documents (free for SEO)
```

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ORIGIN_URL` | Backend server URL | - | Yes |
| `PAYMENT_NETWORK` | `base` or `base-sepolia` | `base-sepolia` | Yes |
| `BLOCK_MODE` | Enforce payments (`true`/`false`) | `false` | No |
| `DEBUG` | Verbose logging (`true`/`false`) | `true` | No |
| `BASE_RPC_URL` | Custom RPC endpoint | Public RPC | No |

### Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `PAYMENT_RECIPIENT` | Your Base wallet address | Yes |

### Staging vs Production

| Setting | Staging | Production |
|---------|---------|------------|
| `PAYMENT_NETWORK` | `base-sepolia` | `base` |
| `BLOCK_MODE` | `false` | `true` |
| `DEBUG` | `true` | `false` |

---

## PostgreSQL Migration (Optional)

For admin dashboard analytics, run the migration on your PostgreSQL database:

```bash
cd frontend
npm run db:migrate
```

Or manually:

```sql
-- Create x402_payments schema
CREATE SCHEMA IF NOT EXISTS x402_payments;

CREATE TABLE x402_payments.transactions (
  id SERIAL PRIMARY KEY,
  payment_id TEXT UNIQUE,
  from_address TEXT,
  amount_usd DECIMAL(10,4),
  endpoint TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE x402_payments.bot_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  wallet_address TEXT,
  api_key_hash TEXT UNIQUE,
  billing_type TEXT DEFAULT 'instant',
  monthly_limit_usd DECIMAL(10,2) DEFAULT 100.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE x402_payments.daily_aggregates (
  date DATE,
  endpoint TEXT,
  request_count INTEGER,
  total_revenue_usd DECIMAL(10,4),
  PRIMARY KEY (date, endpoint)
);
```

---

## Troubleshooting

### "workers.dev subdomain not registered"

Register a subdomain in Cloudflare Dashboard > Workers & Pages.

### "Direct IP access not allowed"

Your `ORIGIN_URL` is using a private IP. Use your public domain instead.

### Bot requests not returning 402

1. Check Cloudflare bot blocking settings (should be disabled)
2. Verify `BLOCK_MODE = "true"`
3. Check Worker logs: `wrangler tail`

### Payment verification failing

1. Ensure `PAYMENT_RECIPIENT` secret is set correctly
2. Verify transaction is on the correct network (Base vs Base Sepolia)
3. Check transaction is confirmed (not pending)

### Origin unreachable

1. Verify `ORIGIN_URL` is accessible from the internet
2. Check for firewall rules blocking Cloudflare IPs
3. Test origin directly: `curl $ORIGIN_URL/api/health`

---

## Commands Reference

```bash
# Type checking
npm run type-check

# Local development
npm run dev

# Deploy staging
npm run deploy:staging

# Deploy production
npm run deploy:production

# View live logs
npm run tail

# Set secret
wrangler secret put SECRET_NAME

# Execute D1 query
wrangler d1 execute x402-payments --remote --command "SELECT * FROM payments"
```

---

## Next Steps

1. Monitor initial traffic in soft launch mode
2. Review bot detection accuracy in logs
3. Enable payment blocking when confident
4. Set up admin dashboard for analytics
5. Consider aggregated billing for enterprise clients
