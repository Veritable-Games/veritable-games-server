# x402 Payment Protocol - Technical Architecture

This document describes the technical architecture of the x402 bot monetization system.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    x402 Payment Worker                               │    │
│  │                                                                      │    │
│  │   Request ──► Bot Detection ──► Human? ──► Proxy to Origin          │    │
│  │                    │                                                 │    │
│  │                    │ Bot Detected                                    │    │
│  │                    ▼                                                 │    │
│  │              Has X-Payment? ──► No ──► Return 402                   │    │
│  │                    │                                                 │    │
│  │                    │ Yes                                             │    │
│  │                    ▼                                                 │    │
│  │              Validate Payment                                        │    │
│  │                    │                                                 │    │
│  │         ┌─────────┴──────────┐                                      │    │
│  │         ▼                    ▼                                      │    │
│  │   Check KV Cache      Query Base RPC                                │    │
│  │   (replay check)      (on-chain verify)                             │    │
│  │         │                    │                                      │    │
│  │         └─────────┬──────────┘                                      │    │
│  │                   ▼                                                 │    │
│  │              Valid? ──► Yes ──► Mark Used in KV ──► Proxy to Origin │    │
│  │                   │                                                 │    │
│  │                   │ No                                              │    │
│  │                   ▼                                                 │    │
│  │              Return 402 (Payment Failed)                            │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────┐    ┌────────────────────┐                           │
│  │   KV Namespace     │    │   D1 Database      │                           │
│  │   PAYMENT_CACHE    │    │   PAYMENTS_DB      │                           │
│  │                    │    │                    │                           │
│  │   tx:0x123... → {} │    │   payments table   │                           │
│  │   tx:0x456... → {} │    │   api_keys table   │                           │
│  └────────────────────┘    └────────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Proxy
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORIGIN SERVER                                      │
│                     www.veritablegames.com                                   │
│                                                                              │
│                    Next.js Application (Coolify)                             │
│                    PostgreSQL Database                                       │
│                                                                              │
│  ┌────────────────────────────────────────┐                                 │
│  │   x402_payments schema                  │                                 │
│  │   - transactions (synced from D1)      │                                 │
│  │   - bot_clients (management)           │                                 │
│  │   - daily_aggregates (analytics)       │                                 │
│  └────────────────────────────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Payment Verification Flow

### Self-Hosted USDC Verification

Unlike standard x402 which uses Coinbase's facilitator service, we use self-hosted on-chain verification. This eliminates KYC requirements and facilitator fees.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT VERIFICATION                               │
│                                                                          │
│  1. Parse X-Payment Header                                               │
│     {"txHash": "0x...", "from": "0x...", "amount": "2000"}             │
│                                                                          │
│  2. Validate Format                                                      │
│     - txHash: 66 char hex (0x + 64)                                     │
│     - from: 42 char hex (0x + 40)                                       │
│     - amount: numeric string                                             │
│                                                                          │
│  3. Check Claimed Amount                                                 │
│     providedAmount >= requiredAmount                                     │
│                                                                          │
│  4. Replay Check (KV Cache)                                              │
│     if (PAYMENT_CACHE.get(`tx:${txHash}`)) → REJECT                     │
│                                                                          │
│  5. On-Chain Verification (Base RPC)                                     │
│     POST https://mainnet.base.org                                        │
│     {"method": "eth_getTransactionReceipt", "params": [txHash]}         │
│                                                                          │
│     Verify:                                                              │
│     - receipt.status === '0x1' (success)                                │
│     - logs contain Transfer event from USDC contract                     │
│     - Transfer.to === PAYMENT_RECIPIENT                                  │
│     - Transfer.from === claimed sender                                   │
│     - Transfer.amount >= required amount                                 │
│                                                                          │
│  6. Mark Transaction Used                                                │
│     PAYMENT_CACHE.put(`tx:${txHash}`, {...}, {ttl: 30 days})           │
│                                                                          │
│  7. Record Payment (D1)                                                  │
│     INSERT INTO payments (...)                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### ERC20 Transfer Event Parsing

USDC transfers emit a standard ERC20 Transfer event:

```
Event: Transfer(address indexed from, address indexed to, uint256 value)
Signature: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef

Log Structure:
- topics[0]: Event signature (0xddf252ad...)
- topics[1]: from address (32 bytes, padded)
- topics[2]: to address (32 bytes, padded)
- data: amount (uint256)
```

---

## Bot Detection Algorithm

### Signal Weights

```typescript
const BOT_SIGNALS = {
  // Cloudflare bot management (requires Pro plan)
  CF_BOT_SCORE_LOW: 50,      // cf.bot_management.score < 30

  // Known AI agent user agents
  AI_AGENT_UA: 45,           // GPTBot, Claude-Web, Anthropic, OpenAI, Perplexity

  // Scraper/automation tools
  SCRAPER_UA: 40,            // python-requests, curl, scrapy, puppeteer, selenium

  // Suspicious user agent
  EMPTY_UA: 35,              // Empty or missing User-Agent
  GENERIC_BOT: 30,           // Contains "bot", "spider", "crawler"

  // Missing browser fingerprint
  NO_ACCEPT_LANGUAGE: 10,    // Missing Accept-Language header
  NO_SEC_FETCH: 10,          // Missing Sec-Fetch-* headers

  // API access pattern
  JSON_NO_COOKIE: 15,        // JSON Accept + no session cookie

  // Self-identified paying bot
  HAS_PAYMENT_HEADER: 50,    // X-Payment header present
};

const BOT_THRESHOLD = 40;    // 40% confidence = bot
```

### Detection Logic

```typescript
async function detectBot(request: Request, env: Env): Promise<BotDetectionResult> {
  let totalWeight = 0;
  let maxPossibleWeight = 0;
  const signals: BotSignal[] = [];

  // Check each signal and accumulate weight
  for (const [signal, weight] of Object.entries(BOT_SIGNALS)) {
    maxPossibleWeight += weight;

    if (signalPresent(signal, request)) {
      totalWeight += weight;
      signals.push({ type: signal, weight });
    }
  }

  const confidence = (totalWeight / maxPossibleWeight) * 100;
  const isBot = confidence >= BOT_THRESHOLD;

  // Check allowlist (search crawlers)
  if (isAllowlistedBot(request)) {
    return { isBot: true, shouldCharge: false, confidence, signals };
  }

  return { isBot, shouldCharge: isBot, confidence, signals };
}
```

### Allowlisted Bots

Search engine crawlers are detected but not charged:

```typescript
const ALLOWLISTED_BOTS = [
  'googlebot',
  'bingbot',
  'applebot',
  'duckduckbot',
  'yandex',
  'baiduspider',
  'slurp',           // Yahoo
  'facebookexternalhit',
];
```

---

## Data Storage

### Cloudflare KV (Edge Cache)

Purpose: Replay protection and fast lookups

```
Key Pattern: tx:{transactionHash}
Value: {
  timestamp: number,
  amount: string,
  from: string,
}
TTL: 30 days
```

### Cloudflare D1 (Edge Database)

Purpose: Payment records and API key storage

```sql
-- Payment transactions
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  amount_usd REAL NOT NULL,
  endpoint TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'completed',
  user_agent TEXT,
  ip_country TEXT
);

-- API keys for aggregated billing
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  monthly_limit_usd REAL DEFAULT 100.00,
  current_month_usage_usd REAL DEFAULT 0.00,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### PostgreSQL (Origin Database)

Purpose: Admin dashboard and analytics

```sql
-- Schema: x402_payments

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  payment_id TEXT UNIQUE,
  from_address TEXT,
  amount_usd DECIMAL(10,4),
  endpoint TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bot_clients (
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

CREATE TABLE daily_aggregates (
  date DATE,
  endpoint TEXT,
  request_count INTEGER,
  total_revenue_usd DECIMAL(10,4),
  PRIMARY KEY (date, endpoint)
);
```

---

## Network Configuration

### USDC Contract Addresses

| Network | Chain ID | USDC Address |
|---------|----------|--------------|
| Base Mainnet | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### RPC Endpoints

| Network | Default RPC |
|---------|-------------|
| Base Mainnet | `https://mainnet.base.org` |
| Base Sepolia | `https://sepolia.base.org` |

Custom RPC can be set via `BASE_RPC_URL` environment variable.

---

## Request Flow

### 402 Response Format

```json
{
  "error": "Payment Required",
  "message": "This API endpoint requires payment for bot access...",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "eip155:8453",
    "maxAmountRequired": "2000",
    "resource": "0x8301D3442E65Cc083dD5317CB656f73e427b51FE",
    "description": "API access payment for Veritable Games",
    "mimeTypes": ["application/json"],
    "payTo": "0x8301D3442E65Cc083dD5317CB656f73e427b51FE",
    "maxTimeoutSeconds": 300,
    "asset": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "verificationMode": "self-hosted",
    "instructions": "Send USDC to 0x... on Base, then include X-Payment header..."
  },
  "documentation": "https://www.x402.org"
}
```

### X-Payment Header Format

```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "from": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": "2000",
  "timestamp": 1702809600
}
```

Can be sent as:
- Raw JSON: `X-Payment: {"txHash": "0x...", ...}`
- Base64 encoded: `X-Payment: eyJ0eEhhc2giOiAiMHguLi4iLCAuLi59`

---

## Security Considerations

### Replay Protection

Each transaction hash can only be used once:
1. Check KV cache before verification
2. Store used transactions with 30-day TTL
3. Even if KV fails, D1 provides secondary check

### Verification Integrity

- Direct RPC calls to Base network
- Parse transaction receipts, not just status
- Verify sender, recipient, and amount match
- Check USDC contract address (not arbitrary token)

### Rate Limiting

Even paying bots are rate-limited per endpoint to prevent DoS:
- Configured per endpoint in `pricing.ts`
- Rate limit headers returned in response

### Origin Protection

- Origin server IP not exposed publicly
- Worker validates all requests before proxying
- X-x402-Proxy header added to proxied requests
