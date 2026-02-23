# Veritable Games x402 Payment Proxy

Cloudflare Worker implementing the x402 payment protocol with **self-hosted USDC
verification** on Base. No KYC required - direct on-chain payment verification.

## Status: LIVE IN PRODUCTION

| Item             | Value                                        |
| ---------------- | -------------------------------------------- |
| Worker URL       | `veritable-x402-proxy.cwcorella.workers.dev` |
| Production Route | `www.veritablegames.com/api/*`               |
| Payment Wallet   | `0x8301D3442E65Cc083dD5317CB656f73e427b51FE` |
| Network          | Base Mainnet (Chain ID: 8453)                |
| Block Mode       | Enabled (payments enforced)                  |
| Deployed         | December 17, 2025                            |

**Full Documentation:**
[docs/features/x402/README.md](../docs/features/x402/README.md)

---

## Payment Flow

```
1. Bot requests API endpoint
       ↓
2. Worker detects bot, returns HTTP 402:
   {
     "paymentRequirements": {
       "payTo": "0xYourWallet",
       "maxAmountRequired": "100000",  // $0.10 in USDC (6 decimals)
       "asset": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
       "verificationMode": "self-hosted"
     }
   }
       ↓
3. Bot sends USDC to your wallet on Base (bot pays gas)
       ↓
4. Bot retries request with X-Payment header:
   {"txHash": "0x...", "from": "0xBotWallet", "amount": "100000"}
       ↓
5. Worker verifies transfer on Base via RPC
       ↓
6. Valid → Request proxied to origin
```

---

## Key Features

- **No KYC/Business Registration** - Direct on-chain verification
- **No Facilitator Fees** - You receive 100% of payments
- **Self-Custodial** - Payments go directly to your wallet
- **Replay Protection** - Transactions can only be used once (KV storage)
- **Testnet Support** - Base Sepolia for testing

---

## What's Been Built

### Cloudflare Worker (`src/`)

| File                | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `index.ts`          | Main entry point - request routing, payment flow |
| `bot-detection.ts`  | Multi-signal bot detection (40% threshold)       |
| `payment.ts`        | **Self-hosted USDC verification via RPC**        |
| `pricing.ts`        | Per-endpoint pricing configuration               |
| `types.ts`          | TypeScript interfaces                            |
| `utils/response.ts` | HTTP response helpers (402, proxy, CORS)         |

### Admin Dashboard (Next.js)

| File                                                  | Purpose               |
| ----------------------------------------------------- | --------------------- |
| `frontend/src/app/api/admin/x402/route.ts`            | Dashboard stats API   |
| `frontend/src/app/api/admin/x402/clients/route.ts`    | Client management API |
| `frontend/src/app/admin/x402/page.tsx`                | Dashboard page        |
| `frontend/src/app/admin/x402/X402DashboardClient.tsx` | Dashboard UI          |

### Database Schemas

**Cloudflare D1** (`schema.sql`):

- `payments` - Transaction records at the edge
- `api_keys` - Aggregated billing clients

**PostgreSQL** (`x402_payments` schema - already migrated):

- `transactions` - Synced from D1
- `bot_clients` - Client management with API keys
- `daily_aggregates` - Analytics rollups

---

## Cloudflare Resources Created

```
Account: Logged in via wrangler login

KV Namespace: PAYMENT_CACHE
ID: e21fead031304e2abe9dc1f2a454ab22

D1 Database: x402-payments
ID: 6eb222c9-ac92-418f-86cb-cd9b55887c46
Region: WNAM
```

---

## Bot Detection

### Signals & Weights

| Signal                    | Weight | Description                                        |
| ------------------------- | ------ | -------------------------------------------------- |
| Cloudflare bot score < 30 | 50     | Most reliable (requires CF Pro)                    |
| Known AI agent UA         | 45     | GPTBot, Claude-Web, Anthropic, OpenAI, Perplexity  |
| Scraper UA patterns       | 40     | python-requests, curl, scrapy, puppeteer, selenium |
| Generic bot patterns      | 30     | "bot", "spider", "crawler" in UA                   |
| Empty/suspicious UA       | 35     | Missing browser identifiers                        |
| Missing browser headers   | 20     | Accept-Language, Sec-Fetch-\* headers              |
| API pattern               | 15     | JSON Accept + no session cookie                    |
| Payment header present    | 50     | Self-identified paying bot                         |

**Threshold:** 40% confidence = classified as bot

**Allowlisted (free access):** Googlebot, Bingbot, Applebot, DuckDuckBot,
Yandex, Baiduspider

### Pricing Configuration

| Endpoint                          | Price  | Rationale                 |
| --------------------------------- | ------ | ------------------------- |
| `/api/documents/unified?all=true` | $0.10  | Full 24,643 document dump |
| `/api/documents/anarchist/[slug]` | $0.001 | Individual document       |
| `/api/*/search`                   | $0.005 | Compute-intensive FTS     |
| `/api/library/*`                  | $0.002 | User library access       |
| All other `/api/*`                | $0.001 | Standard API access       |
| `/api/health`, `/api/auth/*`      | Free   | Infrastructure/auth       |

---

## Deployment Steps

```bash
cd /home/user/Projects/veritable-games-main/cloudflare-x402-proxy

# 1. Verify logged in
wrangler whoami

# 2. Initialize D1 database schema
wrangler d1 execute x402-payments --remote --file=schema.sql

# 3. Set your wallet address
wrangler secret put PAYMENT_RECIPIENT --env=""
# Enter your Base wallet address (e.g., 0x123...)

# 4. Deploy to staging (Base Sepolia testnet)
npm run deploy:staging

# 5. Test bot detection
curl -H "User-Agent: python-requests/2.28.0" \
     https://veritable-x402-proxy.YOUR-SUBDOMAIN.workers.dev/api/documents/unified

# Should return 402 Payment Required with instructions

# 6. When ready for production
npm run deploy:production
```

---

## Testing Payments (Testnet)

1. Get testnet USDC on Base Sepolia from a faucet
2. Send USDC to your PAYMENT_RECIPIENT address
3. Use the tx hash in X-Payment header:

```bash
curl -H "User-Agent: python-requests/2.28.0" \
     -H 'X-Payment: {"txHash": "0xYourTxHash", "from": "0xYourWallet", "amount": "1000"}' \
     https://veritable-x402-proxy.YOUR-SUBDOMAIN.workers.dev/api/documents/unified
```

---

## How Self-Hosted Verification Works

Instead of using Coinbase's facilitator (which requires KYC), we verify payments
directly on-chain:

```typescript
// Worker calls Base RPC to get transaction receipt
const receipt = await fetch(rpcUrl, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getTransactionReceipt',
    params: [txHash],
  }),
});

// Verify:
// 1. Transaction exists and succeeded (status: 0x1)
// 2. Contains USDC Transfer event (event signature match)
// 3. Transfer is to our wallet (recipient check)
// 4. Amount is sufficient (compare to required)
// 5. Transaction hasn't been used before (KV replay check)
```

**Advantages:**

- No KYC/business registration
- No facilitator fees (100% goes to you)
- Fully self-custodial
- Works with any Base wallet

**Trade-offs:**

- Bot pays gas (vs facilitator paying in standard x402)
- Bot must wait for tx confirmation before retrying
- Relies on public RPC (can use custom RPC for reliability)

---

## Architecture

```
Human Browser ──────────────────────────────────────┐
                                                    │
Bot/AI Agent ─── Cloudflare Worker ─── Bot Check ───┼─── Free ─── Origin (192.168.1.15:3000)
                       │                            │
                       │ Bot Detected               │
                       ▼                            │
                 402 Payment Required               │
                       │                            │
                       │ Bot sends USDC             │
                       │ Provides tx hash           │
                       ▼                            │
                 Worker verifies on-chain ──────────┘
                 (direct RPC call to Base)
```

---

## File Structure

```
cloudflare-x402-proxy/
├── wrangler.toml          # Worker config (KV ID, D1 ID)
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── schema.sql             # D1 database schema
├── src/
│   ├── index.ts           # Main entry point
│   ├── bot-detection.ts   # Bot detection logic
│   ├── payment.ts         # Self-hosted USDC verification
│   ├── pricing.ts         # Endpoint pricing
│   ├── types.ts           # TypeScript types
│   └── utils/
│       └── response.ts    # HTTP helpers
└── README.md              # This file

frontend/
├── src/app/api/admin/x402/
│   ├── route.ts           # Dashboard stats API
│   └── clients/route.ts   # Client management API
├── src/app/admin/x402/
│   ├── page.tsx           # Dashboard page
│   └── X402DashboardClient.tsx  # Dashboard UI
└── scripts/migrations/
    └── 009-add-x402-payments-schema.sql  # PostgreSQL (APPLIED)
```

---

## Configuration

### Environment Variables (wrangler.toml)

| Variable          | Description                | Default                    |
| ----------------- | -------------------------- | -------------------------- |
| `ORIGIN_URL`      | Backend server URL         | `http://192.168.1.15:3000` |
| `PAYMENT_NETWORK` | `base` or `base-sepolia`   | `base-sepolia`             |
| `BLOCK_MODE`      | `true` to enforce payments | `false`                    |
| `DEBUG`           | `true` for verbose logging | `true`                     |
| `BASE_RPC_URL`    | Custom RPC endpoint        | Public Base RPC            |

### Secrets (set via `wrangler secret put`)

| Secret              | Description                                 |
| ------------------- | ------------------------------------------- |
| `PAYMENT_RECIPIENT` | Your Base wallet address for receiving USDC |

---

## Commands

```bash
# Type checking
npm run type-check

# Local development
npm run dev

# Deploy staging (Base Sepolia)
npm run deploy:staging

# Deploy production (Base mainnet)
npm run deploy:production

# View logs
npm run tail
```

---

## USDC Contract Addresses

| Network      | Address                                      |
| ------------ | -------------------------------------------- |
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## Resources

- [x402 Protocol](https://www.x402.org) - Protocol specification
- [Base Network](https://base.org) - L2 for USDC payments
- [USDC on Base](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) -
  Token contract
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - Worker
  platform

---

## Implementation Timeline

- **Started:** December 2025
- **Infrastructure complete:** Yes
- **Verification mode:** Self-hosted (no KYC required)
- **Status:** Ready for deployment
