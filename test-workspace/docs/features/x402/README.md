# x402 Payment Protocol - Bot Monetization System

**Status:** Live in Production
**Deployed:** December 17, 2025
**Network:** Base Mainnet (USDC)

---

## Overview

The x402 payment protocol enables Veritable Games to monetize bot and AI agent access to its API while keeping human users free. When a bot or scraper accesses the API, it receives an HTTP 402 Payment Required response with instructions to pay in USDC on Base. After payment, the bot can access the requested resource.

**Key Benefits:**
- Human users browse freely - no impact on regular visitors
- Bots/AI agents pay for API access with USDC
- Self-hosted verification - no KYC required, no facilitator fees
- 100% of payments go directly to your wallet

---

## Quick Reference

| Item | Value |
|------|-------|
| Worker URL | `veritable-x402-proxy.cwcorella.workers.dev` |
| Route | `www.veritablegames.com/api/*` |
| Payment Wallet | `0x8301D3442E65Cc083dD5317CB656f73e427b51FE` |
| Network | Base Mainnet (Chain ID: 8453) |
| Asset | USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| Block Mode | Enabled (payments enforced) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Technical architecture, payment flow, bot detection |
| [Setup Guide](./SETUP_GUIDE.md) | Complete setup instructions for new deployments |
| [Operations Guide](./OPERATIONS.md) | Monitoring, troubleshooting, and maintenance |
| [Worker README](../../../frontend/mcp-servers/cloudflare-x402-proxy/README.md) | Cloudflare Worker source documentation |

---

## How It Works

```
Human Browser ──────────────────────────────────► Origin Server
                                                  (www.veritablegames.com)

Bot/AI Agent ───► Cloudflare Worker ───► Bot Detected?
                         │                    │
                         │              No    │ Yes
                         │                    ▼
                         │              402 Payment Required
                         │                    │
                         │              Bot sends USDC
                         │                    │
                         │              Retry with X-Payment header
                         │                    │
                         ▼                    ▼
                   Verify on-chain ◄──────────┘
                         │
                   Valid payment?
                         │
                   Yes   │   No
                         ▼
                   Proxy to Origin ──────────► Origin Server
```

---

## Pricing Structure

### High-Value Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/api/documents/unified?all=true` | $0.10 | Full document catalog (24,643 docs) |
| `/api/users/*/export` | $0.01 | User data export |

### Search Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/api/forums/search` | $0.005 | Forum full-text search |
| `/api/wiki/search` | $0.005 | Wiki full-text search |
| `/api/documents/unified?query=*` | $0.005 | Document search |

### Standard API Access

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/api/documents/unified` | $0.002 | Paginated document listing |
| `/api/library/*` | $0.002 | User library access |
| `/api/forums/topics` | $0.002 | Forum topic listing |
| `/api/wiki/pages` | $0.002 | Wiki page listing |
| Individual documents | $0.001 | Single document access |
| Other `/api/*` | $0.001 | Standard API access |

### Free Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Health check |
| `/api/auth/*` | Authentication endpoints |
| `/api/settings/maintenance` | Maintenance status |

---

## Bot Detection

The system uses multiple signals to detect bots:

| Signal | Weight | Examples |
|--------|--------|----------|
| AI Agent User-Agent | 45 | GPTBot, Claude-Web, Anthropic, OpenAI |
| Scraper User-Agent | 40 | python-requests, curl, scrapy, puppeteer |
| Empty/Missing UA | 35 | No User-Agent header |
| Generic bot patterns | 30 | "bot", "spider", "crawler" in UA |
| Missing browser headers | 20 | No Accept-Language, Sec-Fetch-* |
| API access pattern | 15 | JSON Accept + no session cookie |

**Detection threshold:** 40% confidence = classified as bot

### Allowlisted Bots (Free Access)

Search engine crawlers are free to ensure SEO:
- Googlebot
- Bingbot
- Applebot
- DuckDuckBot
- Yandex
- Baiduspider

---

## Testing

### Verify Bot Detection

```bash
# Should return 402 (bot detected)
curl -H "User-Agent: Claude-Web/1.0" \
     "https://www.veritablegames.com/api/documents/unified"

# Should return 200 (human browser)
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" \
     -H "Accept-Language: en-US,en;q=0.5" \
     "https://www.veritablegames.com/api/health"

# Should return 200 (search crawler - free)
curl -H "User-Agent: Googlebot/2.1 (+http://www.google.com/bot.html)" \
     "https://www.veritablegames.com/api/documents/unified"
```

### Payment Flow Test

```bash
# 1. Get payment requirements
curl -s -H "User-Agent: python-requests/2.28.0" \
     "https://www.veritablegames.com/api/documents/unified" | jq .

# 2. After sending USDC, retry with payment proof
curl -H "User-Agent: python-requests/2.28.0" \
     -H 'X-Payment: {"txHash": "0x...", "from": "0xYourWallet", "amount": "2000"}' \
     "https://www.veritablegames.com/api/documents/unified"
```

---

## Cloudflare Resources

| Resource | ID |
|----------|-----|
| KV Namespace (PAYMENT_CACHE) | `e21fead031304e2abe9dc1f2a454ab22` |
| D1 Database (PAYMENTS_DB) | `6eb222c9-ac92-418f-86cb-cd9b55887c46` |
| Worker Subdomain | `cwcorella.workers.dev` |

---

## Related Files

### Cloudflare Worker

```
frontend/mcp-servers/cloudflare-x402-proxy/
├── src/
│   ├── index.ts           # Main entry point
│   ├── bot-detection.ts   # Bot detection logic
│   ├── payment.ts         # USDC verification
│   ├── pricing.ts         # Endpoint pricing
│   └── types.ts           # TypeScript types
├── wrangler.toml          # Worker configuration
└── schema.sql             # D1 database schema
```

### Admin Dashboard

```
frontend/src/app/
├── api/admin/x402/
│   ├── route.ts           # Stats API
│   └── clients/route.ts   # Client management
└── admin/x402/
    ├── page.tsx           # Dashboard page
    └── X402DashboardClient.tsx
```

### Database Schema

```
frontend/scripts/migrations/
└── 009-add-x402-payments-schema.sql  # PostgreSQL schema
```

---

## External Resources

- [x402 Protocol Specification](https://www.x402.org)
- [Coinbase x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [Cloudflare Pay-Per-Crawl](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- [Base Network](https://base.org)
- [USDC on Base](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
