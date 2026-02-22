# BTCPay Server Research Report for Donation/Payment Processing

**Generated**: November 19, 2025
**Purpose**: Comprehensive analysis of BTCPay Server for cryptocurrency donation/payment processing on Veritable Games platform

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture & Features](#1-architecture--features)
3. [Implementation Requirements](#2-implementation-requirements)
4. [Integration with Next.js/React](#3-integration-with-nextjsreact)
5. [Transparency & Reporting](#4-transparency--reporting)
6. [Multi-Project Funding](#5-multi-project-funding)
7. [Pros & Cons](#6-pros--cons)
8. [Cost Analysis](#7-cost-analysis)
9. [Recommendations](#8-recommendations)

---

## Executive Summary

**BTCPay Server** is a self-hosted, open-source cryptocurrency payment processor that provides complete sovereignty over payment processing without fees, KYC requirements, or third-party dependencies. It's production-ready with over 1 million downloads and has proven scalable (processed 4,187 transactions in 8 hours at Bitcoin 2025 conference).

**Key Strengths**:
- Zero processing fees (only network fees)
- Complete privacy (no KYC/AML)
- Non-custodial (you control private keys)
- Robust API (GreenField RESTful API)
- Active development and community

**Key Challenges**:
- Technical complexity (requires Linux/Docker knowledge)
- Infrastructure overhead (VPS hosting, node maintenance)
- Bitcoin-focused (limited altcoin support)
- No fiat conversion (crypto-only)
- Lightning Network requires 24/7 uptime and liquidity management

**Best Fit For**: Projects prioritizing decentralization, privacy, and self-sovereignty over ease-of-use and fiat integration.

---

## 1. Architecture & Features

### How BTCPay Server Works

BTCPay Server is a **self-hosted payment processor** that runs on your own infrastructure (VPS or dedicated server). Unlike centralized processors (Stripe, PayPal), you maintain complete control over:

- **Private keys**: Funds go directly to your wallet
- **Payment data**: No third-party tracking
- **Server infrastructure**: Full control over hosting
- **Integration logic**: Customize everything via API

### Core Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    BTCPay Server Instance                    │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Bitcoin   │  │  Lightning  │  │  Greenfield API      │ │
│  │  Full Node │  │  Network    │  │  (RESTful)           │ │
│  │  (pruned)  │  │  Node       │  │                      │ │
│  └────────────┘  └─────────────┘  └──────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Built-in Apps:                                        │ │
│  │  • Point of Sale                                       │ │
│  │  • Crowdfunding                                        │ │
│  │  • Payment Buttons                                     │ │
│  │  • Invoice Management                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    (Webhooks & API)
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Your Next.js Application                        │
│  • Invoice creation via API                                 │
│  • Webhook handlers for payment notifications               │
│  • Custom donation tracking logic                           │
│  • Public transparency dashboards                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

#### 1. Cryptocurrency Support
- **Primary**: Bitcoin (BTC)
  - On-chain transactions (blockchain)
  - Lightning Network (instant, low-fee micropayments)
  - Liquid Network (sidechain for faster settlements)
- **Additional**: Litecoin, Ethereum, and others via plugins (less stable, may break in updates)
- **Stablecoins**: L-USDT support (Lightning USDT)

**Note**: BTCPay is Bitcoin-first. Altcoin integrations are community-maintained and may be deprecated.

#### 2. Payment Processing Capabilities
- **Invoicing**: Create invoices with amount, currency, expiry, metadata
- **Checkout**: Customizable payment pages with QR codes
- **Refunds**: Full or partial refund support via API
- **Hardware Wallet**: Integration with Ledger, Trezor, etc.
- **Multi-signature**: Enhanced security with multi-sig wallets

#### 3. Built-in Applications

**Point of Sale (PoS)**:
- Shopping cart functionality
- Product inventory management
- Tip options
- Three display modes: Static, Cart, Light (keypad)

**Crowdfunding App**:
- Self-hosted campaigns (Kickstarter-style)
- Contribution tiers/perks
- Public transparency (live donation stats)
- Optional inventory limits per tier
- Custom sounds on donation

**Payment Buttons**:
- Embeddable HTML/React components
- Customizable appearance
- One-click donation widgets

#### 4. API Capabilities

**GreenField API** (v1) - Modern RESTful API:
- **Authentication**: API key-based (scoped permissions)
- **Endpoints**:
  - `/api/v1/stores/{storeId}/invoices` - Create/manage invoices
  - `/api/v1/stores/{storeId}/webhooks` - Register webhooks
  - `/api/v1/stores/{storeId}/invoices/{invoiceId}/refund` - Process refunds
  - User management, store creation, API key provisioning
- **Webhook Events**:
  - `InvoiceCreated`
  - `InvoiceReceivedPayment`
  - `InvoicePaymentSettled`
  - `InvoiceProcessing`
  - `InvoiceExpired`
  - `InvoiceSettled`
  - `InvoiceInvalid`

**Bitpay Invoice API** (legacy):
- Compatibility layer for Bitpay migrations
- Not recommended for new projects

#### 5. Plugin System
- Modular architecture for extensions
- Community plugins available
- Public plugin builder (v2.2.0+)
- GiveWP plugin (WordPress integration for donations)

---

## 2. Implementation Requirements

### Infrastructure Requirements

#### Server Specifications

**Minimum Configuration** (Pruned Node):
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 80 GB NVMe SSD
  - Bitcoin blockchain (pruned): ~60 GB
  - BTCPay Server + OS: ~20 GB

**Recommended Configuration** (Full Node):
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 650+ GB NVMe SSD
  - Bitcoin blockchain (full): ~600 GB (growing)
  - Lightning Network data: ~10-20 GB
  - BTCPay Server + OS: ~20 GB

**Hardware Deployment Option**:
- BeeLink S12 Mini PC (~$300 one-time cost)
- Suitable for on-premises hosting

#### Network Requirements

**Required Ports**:
- `80` (HTTP) - Externally accessible
- `443` (HTTPS) - Externally accessible
- `9735` (Lightning Network - Bitcoin) - Externally accessible if running Lightning
- `9736` (Lightning Network - Litecoin) - If using LTC Lightning

**Domain**:
- Domain name with A record pointing to server IP
- SSL certificate (auto-configured via Let's Encrypt with Docker deployment)

**Uptime**:
- **On-chain only**: Can handle intermittent downtime
- **Lightning Network**: Requires 24/7 uptime (channels need constant monitoring)

**Note**: OpenVZ-based VPS providers are **not supported** (use KVM-based VPS).

### Installation & Setup Process

#### Docker Deployment (Recommended)

**Prerequisites**:
- Linux server (Ubuntu 20.04+ or Debian 11+)
- Docker and Docker Compose installed
- Root or sudo access
- Domain name configured

**Installation Steps**:

```bash
# 1. Clone BTCPay Docker repository
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker

# 2. Set environment variables
export BTCPAY_HOST="btcpay.yourdomain.com"
export NBITCOIN_NETWORK="mainnet"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_LIGHTNING="clightning"  # or "lnd"
export BTCPAY_ENABLE_SSH=true

# 3. Run setup script
. ./btcpay-setup.sh -i

# 4. Wait for initial sync (3-4 days for full node, 12-24 hours for pruned)
```

**Configuration Options**:
- **Pruning**: Set `BTCPAY_PRUNE=550` to limit blockchain storage to ~60 GB
- **Lightning**: Choose between c-lightning or LND implementations
- **Altcoins**: Enable via `export BTCPAYGEN_CRYPTO2="ltc"` (not recommended)

#### Manual Deployment

Alternative for advanced users. Requires manual configuration of:
- PostgreSQL database
- Bitcoin Core node
- NBXplorer (BTCPay's blockchain indexer)
- ASP.NET Core runtime
- Reverse proxy (Nginx)

**Not recommended** unless you have specific infrastructure requirements.

### Security Considerations

#### 1. Server Hardening
- **Firewall**: Configure UFW/iptables to block unnecessary ports
- **SSH**: Disable password auth, use SSH keys only
- **Updates**: Regular OS security patches (`apt update && apt upgrade`)
- **Fail2ban**: Protect against brute-force attacks

#### 2. BTCPay-Specific Security
- **API Keys**: Use scoped permissions (principle of least privilege)
- **2FA**: Enable two-factor authentication for admin accounts
- **Wallet Backups**: Regular encrypted backups of wallet seeds
- **Lightning Channels**: Hot wallet risk (funds stored online for instant payments)

#### 3. Vulnerability Management
- **Update Notifications**: BTCPay v1.0.5.7+ shows alerts for new versions
- **Security Patches**: Critical vulnerabilities addressed promptly (e.g., v1.0.7.1 patched critical issues)
- **Monitoring**: Subscribe to BTCPay blog/GitHub for security announcements

#### 4. "Tainted Funds" Risk
**IMPORTANT**: BTCPay has **no built-in tools** to detect or reject "tainted" Bitcoin (coins linked to illicit activities). This is entirely the merchant's responsibility. For platforms interacting with regulated financial systems, this poses a compliance risk.

**Mitigation Options**:
- Third-party chain analysis services (Chainalysis, Elliptic)
- Manual review of large transactions
- Accept risk as part of Bitcoin's permissionless nature

### Maintenance Overhead

#### Regular Maintenance Tasks

**Updates** (Monthly or as needed):
```bash
# Via command line
./btcpay-update.sh

# Or via UI: Server Settings → Maintenance → Update
```

**Backups** (Weekly recommended):
```bash
# Run as root
./btcpay-backup.sh

# Output: /var/lib/docker/volumes/backup_datadir/_data/backup.tar.gz
```

**⚠️ CRITICAL Lightning Warning**:
> Old Lightning channel state is TOXIC. Publishing outdated state can result in **total loss of all channel funds**. NEVER restore old Lightning backups. Back up channel state immediately before closing channels only.

**Blockchain Sync Monitoring**:
- Check sync status regularly (UI dashboard)
- Ensure sufficient disk space (blockchain grows ~60 GB/year)

**Lightning Channel Management** (if enabled):
- Monitor channel health and balance
- Rebalance channels to maintain liquidity
- Open new channels as needed for payment routing
- Force-close stuck channels (incurs on-chain fees)

#### Time Investment
- **Initial Setup**: 4-8 hours (configuration + sync wait time)
- **Monthly Maintenance**: 1-2 hours (updates, backups, monitoring)
- **Lightning Management**: 2-4 hours/month (channel rebalancing, liquidity)
- **Incident Response**: Variable (node crashes, channel issues, etc.)

---

## 3. Integration with Next.js/React

### Available SDKs & Libraries

#### 1. Official Node.js Client (Deprecated)
- **Package**: `btcpay` on npm
- **Status**: DEPRECATED (use GreenField API instead)
- **Reason**: BTCPay now exposes a more complete and easier-to-use API (GreenField)

#### 2. React BTCPay Pay Button
- **Package**: `react-btcpay-paybutton`
- **Status**: ACTIVE (recommended for React apps)
- **Installation**:
  ```bash
  npm install react-btcpay-paybutton
  ```

#### 3. Direct GreenField API Integration
- **Approach**: Use `fetch()` or `axios` for API calls
- **Authentication**: API key in Authorization header
- **No SDK required**: RESTful API with standard HTTP

### Example Integration Patterns

#### A. React Pay Button Component (Simplest)

```typescript
// components/DonateButton.tsx
import { ReactBtcPayButton } from 'react-btcpay-paybutton';

interface DonateButtonProps {
  projectId: string;
  projectName: string;
}

export default function DonateButton({ projectId, projectName }: DonateButtonProps) {
  return (
    <ReactBtcPayButton
      btcPayDomain="btcpay.yourdomain.com"
      storeId="YourStoreID"
      // Optional customization
      price={10}
      currency="USD"
      orderId={projectId}
      notificationUrl={`https://yourdomain.com/api/btcpay/webhook`}
      // Custom metadata for project tracking
      metadata={{
        projectId: projectId,
        projectName: projectName,
        category: 'donation'
      }}
    />
  );
}
```

**Pros**:
- Minimal code (2 required props: `btcPayDomain`, `storeId`)
- Full BTCPay UI embedded
- No backend API calls needed

**Cons**:
- Less control over checkout flow
- Limited customization of payment page

#### B. Custom Invoice Creation via API

```typescript
// lib/btcpay.ts
const BTCPAY_URL = process.env.BTCPAY_URL; // e.g., https://btcpay.yourdomain.com
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY;
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID;

export interface CreateInvoiceParams {
  amount: number;
  currency: string;
  orderId: string;
  buyerEmail?: string;
  metadata?: Record<string, any>;
  redirectUrl?: string;
  notificationUrl?: string;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const response = await fetch(
    `${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${BTCPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount.toString(),
        currency: params.currency,
        metadata: {
          orderId: params.orderId,
          buyerEmail: params.buyerEmail,
          // Custom project tracking
          ...params.metadata,
        },
        checkout: {
          redirectURL: params.redirectUrl || `${process.env.NEXT_PUBLIC_URL}/donation/success`,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`BTCPay API error: ${response.statusText}`);
  }

  const invoice = await response.json();
  return {
    invoiceId: invoice.id,
    checkoutLink: invoice.checkoutLink,
  };
}
```

**API Route** (`app/api/donations/create/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createInvoice } from '@/lib/btcpay';
import { dbPool } from '@/lib/database/pool';

export async function POST(request: NextRequest) {
  try {
    const { projectId, amount, email } = await request.json();

    // Validate input
    if (!projectId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Create invoice in BTCPay
    const invoice = await createInvoice({
      amount: amount,
      currency: 'USD',
      orderId: `project-${projectId}-${Date.now()}`,
      buyerEmail: email,
      metadata: {
        projectId: projectId,
        donationType: 'project_funding',
        timestamp: new Date().toISOString(),
      },
      notificationUrl: `${process.env.NEXT_PUBLIC_URL}/api/btcpay/webhook`,
    });

    // Store pending donation in your database
    const db = await dbPool.getConnection('content');
    await db.run(
      `INSERT INTO pending_donations
       (invoice_id, project_id, amount, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoice.invoiceId, projectId, amount, 'USD', 'pending', new Date().toISOString()]
    );

    return NextResponse.json({
      success: true,
      checkoutLink: invoice.checkoutLink,
      invoiceId: invoice.invoiceId,
    });

  } catch (error) {
    console.error('Error creating BTCPay invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
```

**Frontend Component** (`components/CustomDonateForm.tsx`):

```typescript
'use client';

import { useState } from 'react';

interface CustomDonateFormProps {
  projectId: string;
  projectName: string;
}

export default function CustomDonateForm({ projectId, projectName }: CustomDonateFormProps) {
  const [amount, setAmount] = useState(10);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDonate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/donations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, amount, email }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to BTCPay checkout
        window.location.href = data.checkoutLink;
      } else {
        alert('Error creating invoice');
      }
    } catch (error) {
      console.error(error);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="donate-form">
      <h3>Support {projectName}</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        min={1}
        placeholder="Amount (USD)"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
      />
      <button onClick={handleDonate} disabled={loading}>
        {loading ? 'Processing...' : `Donate $${amount}`}
      </button>
    </div>
  );
}
```

**Pros**:
- Full control over UX/UI
- Custom donation flow
- Rich metadata tracking
- Integration with your database

**Cons**:
- More code to maintain
- Requires backend API routes
- Manual webhook handling

#### C. Webhook Handler for Payment Notifications

```typescript
// app/api/btcpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbPool } from '@/lib/database/pool';

// Webhook signature validation
function validateWebhook(request: NextRequest, rawBody: string): boolean {
  const sig = request.headers.get('BTCPAY-SIG');
  const secret = process.env.BTCPAY_WEBHOOK_SECRET; // Set this in BTCPay webhook config

  if (!sig || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');

  return sig === `sha256=${digest}`;
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature validation
    const rawBody = await request.text();

    // Validate webhook signature
    if (!validateWebhook(request, rawBody)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { type, invoiceId, metadata } = event;

    console.log(`BTCPay webhook: ${type} for invoice ${invoiceId}`);

    // Get database connection
    const db = await dbPool.getConnection('content');

    switch (type) {
      case 'InvoiceSettled':
        // Payment confirmed and settled
        const projectId = metadata?.projectId;

        if (!projectId) {
          console.error('Missing projectId in webhook metadata');
          break;
        }

        // Update donation status
        await db.run(
          `UPDATE pending_donations
           SET status = ?, settled_at = ?
           WHERE invoice_id = ?`,
          ['settled', new Date().toISOString(), invoiceId]
        );

        // Record completed donation
        const donationData = await db.get(
          'SELECT * FROM pending_donations WHERE invoice_id = ?',
          [invoiceId]
        );

        if (donationData) {
          await db.run(
            `INSERT INTO project_donations
             (project_id, amount, currency, donor_email, transaction_id, donated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              projectId,
              donationData.amount,
              donationData.currency,
              donationData.email || 'anonymous',
              invoiceId,
              new Date().toISOString(),
            ]
          );

          // Update project funding total
          await db.run(
            `UPDATE projects
             SET total_donations = total_donations + ?
             WHERE id = ?`,
            [donationData.amount, projectId]
          );

          console.log(`✅ Donation settled for project ${projectId}: $${donationData.amount}`);
        }
        break;

      case 'InvoiceExpired':
        // Invoice expired without payment
        await db.run(
          `UPDATE pending_donations
           SET status = ?
           WHERE invoice_id = ?`,
          ['expired', invoiceId]
        );
        break;

      case 'InvoiceInvalid':
        // Invoice marked invalid
        await db.run(
          `UPDATE pending_donations
           SET status = ?
           WHERE invoice_id = ?`,
          ['invalid', invoiceId]
        );
        break;

      case 'InvoiceReceivedPayment':
        // Payment received but not yet confirmed
        await db.run(
          `UPDATE pending_donations
           SET status = ?
           WHERE invoice_id = ?`,
          ['processing', invoiceId]
        );
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Required for Next.js to provide raw body
export const config = {
  api: {
    bodyParser: false,
  },
};
```

**Database Schema for Tracking**:

```sql
-- Pending donations (waiting for payment)
CREATE TABLE pending_donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  email TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, settled, expired, invalid
  created_at TEXT NOT NULL,
  settled_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Completed donations
CREATE TABLE project_donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  donor_email TEXT DEFAULT 'anonymous',
  transaction_id TEXT UNIQUE NOT NULL, -- BTCPay invoice ID
  donated_at TEXT NOT NULL,
  blockchain_tx_id TEXT, -- Optional: actual Bitcoin txid
  is_public BOOLEAN DEFAULT 1, -- Show in public transparency reports
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Projects table (add donation tracking)
ALTER TABLE projects ADD COLUMN total_donations REAL DEFAULT 0;
ALTER TABLE projects ADD COLUMN donation_goal REAL;
```

#### D. Modal Checkout Implementation

For inline checkout without redirecting users:

```typescript
// components/ModalCheckout.tsx
'use client';

import { useEffect } from 'react';

interface ModalCheckoutProps {
  invoiceId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function ModalCheckout({ invoiceId, onSuccess, onClose }: ModalCheckoutProps) {
  useEffect(() => {
    // Load BTCPay modal script
    const script = document.createElement('script');
    script.src = `${process.env.NEXT_PUBLIC_BTCPAY_URL}/modal/btcpay.js`;
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // @ts-ignore - BTCPay global
      window.btcpay.showInvoice(invoiceId);

      // Listen for payment events
      window.addEventListener('message', (event) => {
        if (event.data === 'close') {
          onClose?.();
        } else if (event.data === 'paid') {
          onSuccess?.();
        }
      });
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [invoiceId]);

  return null; // BTCPay modal is injected into DOM
}
```

**Usage**:

```typescript
const [invoiceId, setInvoiceId] = useState<string | null>(null);

const handleDonate = async () => {
  const response = await fetch('/api/donations/create', { /* ... */ });
  const data = await response.json();
  setInvoiceId(data.invoiceId); // Trigger modal
};

return (
  <>
    <button onClick={handleDonate}>Donate</button>
    {invoiceId && (
      <ModalCheckout
        invoiceId={invoiceId}
        onSuccess={() => alert('Thank you for your donation!')}
        onClose={() => setInvoiceId(null)}
      />
    )}
  </>
);
```

### Integration Best Practices

1. **Environment Variables**:
   ```env
   BTCPAY_URL=https://btcpay.yourdomain.com
   BTCPAY_API_KEY=your_api_key_here
   BTCPAY_STORE_ID=your_store_id
   BTCPAY_WEBHOOK_SECRET=your_webhook_secret
   NEXT_PUBLIC_BTCPAY_URL=https://btcpay.yourdomain.com
   ```

2. **Error Handling**:
   - Catch API failures gracefully
   - Log errors for debugging
   - Show user-friendly error messages
   - Implement retry logic for transient failures

3. **Testing**:
   - Use BTCPay testnet mode for development
   - Test webhook handling with mock data
   - Verify signature validation works
   - Test edge cases (expired invoices, overpayments, etc.)

4. **Security**:
   - Never expose API keys in client-side code
   - Always validate webhook signatures
   - Use HTTPS for all BTCPay communication
   - Sanitize metadata to prevent injection attacks

---

## 4. Transparency & Reporting

### Built-in Reporting Capabilities

#### Invoice & Transaction Reports

**CSV Export**:
- Navigate to Invoices page in BTCPay UI
- Filter by date range, status, order ID, etc.
- Click "Export" → Download CSV with:
  - Invoice ID
  - Order ID
  - Amount
  - Currency
  - Status
  - Created date
  - Settled date
  - Buyer email (if provided)
  - Item description
  - Item code

**JSON Export**:
- Programmatic export via API
- Structured data for custom reporting tools

#### Enhanced Reporting (v2.2.0+)

- **Reporting button**: Quick access from invoice lists and wallet transaction views
- **Accounting features**: Designed for bookkeeping integration
- **Transaction categorization**: Filter by type, date, amount

#### API Endpoints for Transaction Data

**List Invoices**:
```typescript
GET /api/v1/stores/{storeId}/invoices

Query Parameters:
- orderId: Filter by order ID
- status: Filter by status (Settled, Expired, Invalid, etc.)
- startDate: Filter by creation date (ISO 8601)
- endDate: Filter by creation date
- skip: Pagination offset
- take: Number of results (max 100)
```

**Get Invoice Details**:
```typescript
GET /api/v1/stores/{storeId}/invoices/{invoiceId}

Response includes:
- amount, currency, status
- metadata (custom fields)
- payment methods used
- blockchain transaction IDs
- timestamps (created, settled, expired)
```

**Get Payment Details**:
```typescript
GET /api/v1/stores/{storeId}/invoices/{invoiceId}/payment-methods

Returns:
- Bitcoin address used
- Amount received
- Confirmation count
- Transaction ID (txid)
- Lightning payment hash (if Lightning used)
```

### Public Donation Display

#### Crowdfunding App Features

BTCPay's built-in Crowdfunding App provides:

1. **Live Contribution Stats**:
   - Total amount raised
   - Number of contributors
   - Progress toward goal
   - Time remaining (if deadline set)

2. **Public Transparency**:
   - All donations visible in real-time
   - Optional contributor names/messages
   - Transaction history available

3. **Custom Sounds**:
   - Play sound effects when donations received
   - Gamifies donation experience

4. **Embeddable Widget**:
   - Embed crowdfunding page on your website
   - Customize appearance to match site design

#### Custom Transparency Dashboard

**Example Implementation** (`app/transparency/page.tsx`):

```typescript
'use client';

import { useEffect, useState } from 'react';

interface Donation {
  id: string;
  projectName: string;
  amount: number;
  currency: string;
  donatedAt: string;
  donorName?: string;
}

interface ProjectFunding {
  projectId: string;
  projectName: string;
  totalRaised: number;
  goal: number;
  donationCount: number;
}

export default function TransparencyDashboard() {
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const [projectFunding, setProjectFunding] = useState<ProjectFunding[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<Record<string, number>>({});

  useEffect(() => {
    // Fetch transparency data
    fetch('/api/transparency/data')
      .then(res => res.json())
      .then(data => {
        setRecentDonations(data.recentDonations);
        setProjectFunding(data.projectFunding);
        setMonthlySummary(data.monthlySummary);
      });
  }, []);

  return (
    <div className="transparency-dashboard">
      <h1>Donation Transparency</h1>

      {/* Monthly Summary */}
      <section className="monthly-summary">
        <h2>Monthly Donations</h2>
        <div className="chart">
          {Object.entries(monthlySummary).map(([month, amount]) => (
            <div key={month} className="bar">
              <div className="label">{month}</div>
              <div className="value">${amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Project Funding */}
      <section className="project-funding">
        <h2>Project Funding Status</h2>
        {projectFunding.map(project => (
          <div key={project.projectId} className="project">
            <h3>{project.projectName}</h3>
            <div className="progress-bar">
              <div
                className="progress"
                style={{ width: `${(project.totalRaised / project.goal) * 100}%` }}
              />
            </div>
            <p>
              ${project.totalRaised.toFixed(2)} / ${project.goal.toFixed(2)}
              ({project.donationCount} donations)
            </p>
          </div>
        ))}
      </section>

      {/* Recent Donations */}
      <section className="recent-donations">
        <h2>Recent Donations</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Amount</th>
              <th>Donor</th>
            </tr>
          </thead>
          <tbody>
            {recentDonations.map(donation => (
              <tr key={donation.id}>
                <td>{new Date(donation.donatedAt).toLocaleDateString()}</td>
                <td>{donation.projectName}</td>
                <td>${donation.amount.toFixed(2)} {donation.currency}</td>
                <td>{donation.donorName || 'Anonymous'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Blockchain Verification */}
      <section className="blockchain-proof">
        <h2>Blockchain Verification</h2>
        <p>All donations are recorded on the Bitcoin blockchain and can be independently verified.</p>
        <a href="/api/transparency/export" download>
          Download Full Transaction Report (CSV)
        </a>
      </section>
    </div>
  );
}
```

**API Route** (`app/api/transparency/data/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/database/pool';

export async function GET() {
  const db = await dbPool.getConnection('content');

  // Recent donations (last 50)
  const recentDonations = await db.all(`
    SELECT
      pd.id,
      p.title as projectName,
      pd.amount,
      pd.currency,
      pd.donated_at as donatedAt,
      pd.donor_email as donorName
    FROM project_donations pd
    JOIN projects p ON pd.project_id = p.id
    WHERE pd.is_public = 1
    ORDER BY pd.donated_at DESC
    LIMIT 50
  `);

  // Project funding totals
  const projectFunding = await db.all(`
    SELECT
      p.id as projectId,
      p.title as projectName,
      COALESCE(SUM(pd.amount), 0) as totalRaised,
      p.donation_goal as goal,
      COUNT(pd.id) as donationCount
    FROM projects p
    LEFT JOIN project_donations pd ON p.id = pd.project_id
    WHERE p.accepts_donations = 1
    GROUP BY p.id
    ORDER BY totalRaised DESC
  `);

  // Monthly summary (last 12 months)
  const monthlySummary = await db.all(`
    SELECT
      strftime('%Y-%m', donated_at) as month,
      SUM(amount) as total
    FROM project_donations
    WHERE donated_at >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month DESC
  `);

  const monthlySummaryObj = Object.fromEntries(
    monthlySummary.map(row => [row.month, row.total])
  );

  return NextResponse.json({
    recentDonations,
    projectFunding,
    monthlySummary: monthlySummaryObj,
  });
}
```

**CSV Export Route** (`app/api/transparency/export/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/database/pool';

export async function GET() {
  const db = await dbPool.getConnection('content');

  const donations = await db.all(`
    SELECT
      pd.transaction_id as "Invoice ID",
      pd.blockchain_tx_id as "Bitcoin TX ID",
      p.title as "Project",
      pd.amount as "Amount",
      pd.currency as "Currency",
      pd.donated_at as "Date",
      pd.donor_email as "Donor"
    FROM project_donations pd
    JOIN projects p ON pd.project_id = p.id
    WHERE pd.is_public = 1
    ORDER BY pd.donated_at DESC
  `);

  // Generate CSV
  const headers = Object.keys(donations[0] || {});
  const csvRows = [
    headers.join(','),
    ...donations.map(row =>
      headers.map(header => JSON.stringify(row[header] || '')).join(',')
    ),
  ];

  const csv = csvRows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="donations.csv"',
    },
  });
}
```

### Monthly/Yearly Aggregation

**Aggregation Query Example**:

```sql
-- Monthly totals by project
SELECT
  strftime('%Y-%m', donated_at) as month,
  project_id,
  COUNT(*) as donation_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM project_donations
WHERE donated_at >= date('now', '-12 months')
GROUP BY month, project_id
ORDER BY month DESC, total_amount DESC;

-- Yearly totals across all projects
SELECT
  strftime('%Y', donated_at) as year,
  COUNT(*) as donation_count,
  SUM(amount) as total_amount,
  COUNT(DISTINCT project_id) as projects_funded
FROM project_donations
GROUP BY year
ORDER BY year DESC;
```

**Automated Monthly Reports**:
- Set up cron job to generate monthly reports
- Email reports to administrators
- Auto-publish to transparency page
- Archive historical data

---

## 5. Multi-Project Funding

### Can Users Designate Which Project to Fund?

**YES** - BTCPay Server supports this via invoice metadata.

#### Implementation Strategy

**Approach 1: Separate Stores per Project**
- Create a BTCPay store for each project
- Each store has unique wallet
- Funds go directly to project-specific wallet
- **Pros**: Complete financial separation, easy accounting
- **Cons**: More complex setup, more wallets to manage

**Approach 2: Single Store with Metadata (Recommended)**
- Use one BTCPay store for all projects
- Tag invoices with `projectId` in metadata
- Your application routes funds based on metadata
- **Pros**: Simpler BTCPay setup, centralized management
- **Cons**: Requires custom logic to distribute funds

#### Custom Metadata/Tagging for Donations

**Invoice Metadata Fields** (JSON structure):

```json
{
  "orderId": "donation-2025-11-19-12345",
  "projectId": "project-stellar-visualization",
  "projectName": "3D Stellar Visualization",
  "donationType": "one-time",
  "campaignSource": "homepage",
  "donorMessage": "Keep up the great work!",
  "isAnonymous": false,
  "taxReceiptRequested": true,
  "posData": {
    "cartItems": [
      {
        "name": "General Donation",
        "price": 50,
        "quantity": 1
      }
    ],
    "tip": 5,
    "total": 55
  },
  "receiptData": {
    "thankYouMessage": "Thank you for supporting the Stellar Visualization project!",
    "projectUrl": "https://veritablegames.com/projects/stellar-viz"
  }
}
```

**Creating Tagged Invoice**:

```typescript
const invoice = await createInvoice({
  amount: 50,
  currency: 'USD',
  orderId: `donation-${Date.now()}`,
  metadata: {
    projectId: 'stellar-viz',
    projectName: '3D Stellar Visualization',
    donationType: 'one-time',
    campaignSource: 'email-newsletter',
    donorTier: 'supporter', // e.g., supporter, patron, benefactor
  },
  notificationUrl: `${process.env.NEXT_PUBLIC_URL}/api/btcpay/webhook`,
});
```

**Webhook Processing with Project Routing**:

```typescript
// In webhook handler
const { metadata } = event;
const projectId = metadata?.projectId;

if (projectId) {
  // Record donation for specific project
  await db.run(
    `INSERT INTO project_donations (project_id, amount, ...) VALUES (?, ?, ...)`,
    [projectId, amount, ...]
  );

  // Update project totals
  await db.run(
    `UPDATE projects SET total_donations = total_donations + ? WHERE id = ?`,
    [amount, projectId]
  );

  // Trigger project-specific actions
  await notifyProjectOwner(projectId, amount);
  await updateProjectMilestones(projectId);
}
```

### Tracking Donations Per Project

#### Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  accepts_donations BOOLEAN DEFAULT 1,
  donation_goal REAL,
  total_donations REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Project donations
CREATE TABLE project_donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  donor_email TEXT,
  transaction_id TEXT UNIQUE NOT NULL, -- BTCPay invoice ID
  blockchain_tx_id TEXT, -- Actual Bitcoin txid
  donation_type TEXT, -- one-time, recurring, patron-tier
  campaign_source TEXT, -- homepage, email, social-media
  donor_message TEXT,
  is_public BOOLEAN DEFAULT 1,
  donated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Donation milestones (for gamification)
CREATE TABLE donation_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  milestone_amount REAL NOT NULL,
  milestone_name TEXT NOT NULL,
  milestone_description TEXT,
  reached_at TEXT, -- NULL if not reached yet
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Donor tiers (recurring donors, patrons)
CREATE TABLE donor_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_email TEXT NOT NULL,
  project_id TEXT NOT NULL,
  tier_name TEXT NOT NULL, -- supporter, patron, benefactor
  monthly_amount REAL NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT, -- NULL if still active
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

#### Querying Project Donations

**Total Raised per Project**:

```sql
SELECT
  p.id,
  p.title,
  p.donation_goal,
  COALESCE(SUM(pd.amount), 0) as total_raised,
  COUNT(pd.id) as donation_count,
  ROUND((COALESCE(SUM(pd.amount), 0) / p.donation_goal) * 100, 2) as percent_funded
FROM projects p
LEFT JOIN project_donations pd ON p.id = pd.project_id
WHERE p.accepts_donations = 1
GROUP BY p.id
ORDER BY total_raised DESC;
```

**Top Donors per Project**:

```sql
SELECT
  donor_email,
  SUM(amount) as total_donated,
  COUNT(*) as donation_count
FROM project_donations
WHERE project_id = ?
GROUP BY donor_email
ORDER BY total_donated DESC
LIMIT 10;
```

**Donation Timeline**:

```sql
SELECT
  DATE(donated_at) as date,
  COUNT(*) as donations,
  SUM(amount) as total
FROM project_donations
WHERE project_id = ?
GROUP BY DATE(donated_at)
ORDER BY date DESC;
```

#### Multi-Project Donation Form

**UI Component** (`components/MultiProjectDonateForm.tsx`):

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  title: string;
  goal: number;
  raised: number;
}

export default function MultiProjectDonateForm() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [amount, setAmount] = useState(10);
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetch('/api/projects/accepting-donations')
      .then(res => res.json())
      .then(data => setProjects(data.projects));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/donations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: selectedProject,
        amount,
        email,
      }),
    });

    const data = await response.json();
    if (data.success) {
      window.location.href = data.checkoutLink;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="multi-project-donate">
      <h2>Support a Project</h2>

      <div className="project-selector">
        <label>Choose a project:</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          required
        >
          <option value="">-- Select a project --</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.title} (${project.raised.toFixed(2)} / ${project.goal.toFixed(2)})
            </option>
          ))}
        </select>
      </div>

      <div className="amount-selector">
        <label>Donation amount (USD):</label>
        <div className="preset-amounts">
          {[5, 10, 25, 50, 100].map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={amount === preset ? 'selected' : ''}
            >
              ${preset}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={1}
          required
        />
      </div>

      <div className="email-input">
        <label>Email (optional):</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="For donation receipt"
        />
      </div>

      <button type="submit" className="donate-button">
        Donate ${amount} to {projects.find(p => p.id === selectedProject)?.title || 'project'}
      </button>
    </form>
  );
}
```

### Distribution of Funds

**If using single store approach**, you'll need to manually distribute funds:

**Option 1: Manual Distribution**
- Periodically review `project_donations` table
- Calculate amounts owed to each project
- Send Bitcoin from main wallet to project-specific wallets

**Option 2: Automated Distribution (Advanced)**
- Use BTCPay's refund API to send funds
- Set up automated transfers based on metadata
- Requires careful accounting to avoid errors

**Option 3: Hybrid Approach**
- Keep funds in BTCPay wallet
- Track allocations in database
- Distribute only when project needs funds (e.g., milestone reached)

**Example Distribution Query**:

```sql
SELECT
  project_id,
  SUM(amount) as total_owed,
  COUNT(*) as donation_count
FROM project_donations
WHERE distributed = 0  -- Not yet distributed
GROUP BY project_id;
```

---

## 6. Pros & Cons

### Benefits of BTCPay Server

#### 1. Financial Sovereignty
- **Non-custodial**: You control private keys, not a third party
- **Direct payments**: Funds go straight to your wallet
- **No freezing**: No risk of account suspension or fund holds
- **Permissionless**: No approval process to start accepting payments

#### 2. Zero Fees
- **No processing fees**: Unlike PayPal (2.9% + $0.30), Stripe (2.9% + $0.30)
- **No monthly fees**: Unlike some merchant processors
- **Only network fees**: Bitcoin on-chain fees (variable) or Lightning (near-zero)
- **Example**: $1,000 donation
  - PayPal: $970.70 after fees
  - Stripe: $970.70 after fees
  - BTCPay: $999+ (minus ~$1 network fee)

#### 3. Privacy
- **No KYC/AML**: No personal information required
- **No surveillance**: Third parties can't track your transactions
- **Donor privacy**: Contributors can donate pseudonymously
- **No data sharing**: You're not selling customer data to advertisers

#### 4. Transparency
- **Public blockchain**: All transactions verifiable on Bitcoin blockchain
- **Open source**: Code is auditable (no hidden backdoors)
- **No hidden fees**: What you see is what you get

#### 5. Censorship Resistance
- **No de-platforming**: Can't be banned like Patreon, PayPal, GoFundMe
- **No "acceptable use" policies**: Support any legal cause
- **Geographic freedom**: Works anywhere with internet

#### 6. Flexibility & Customization
- **Open API**: Build any integration you need
- **Plugin system**: Extend functionality
- **Self-hosted**: Deploy anywhere (VPS, bare metal, cloud)
- **White-label**: Fully customizable branding

#### 7. Lightning Network
- **Instant payments**: Settle in seconds vs. 10+ minutes on-chain
- **Micro-payments**: Accept donations as small as 1 satoshi (~$0.0001)
- **Low fees**: <$0.01 per transaction
- **Privacy**: Enhanced privacy vs. on-chain

#### 8. Global Reach
- **No currency conversion**: Bitcoin is universal
- **No cross-border fees**: Send/receive from anywhere
- **24/7 operation**: No banking hours or holidays

### Limitations and Challenges

#### 1. Technical Complexity
- **Steep learning curve**: Requires Linux, Docker, command-line knowledge
- **Not beginner-friendly**: Setup can take 4-8 hours for non-technical users
- **Maintenance burden**: Requires ongoing server management
- **Troubleshooting**: Complex issues (Lightning channels, blockchain sync, etc.)

**Mitigation**:
- Use managed hosting (Voltage, LunaNode) for $10-20/month
- Hire devops consultant for initial setup
- Join BTCPay community for support

#### 2. Infrastructure Overhead
- **Server costs**: $10-65/month for VPS hosting
- **Uptime requirements**: Lightning requires 24/7 availability
- **Backup responsibility**: You're responsible for wallet backups
- **Monitoring**: Need to watch node health, disk space, etc.

**Mitigation**:
- Use pruned node to reduce storage (80 GB vs. 600 GB)
- Start with on-chain only (no Lightning) to avoid uptime requirements
- Set up automated alerts for issues

#### 3. Bitcoin-Focused (Limited Altcoin Support)
- **Primary support**: Bitcoin only
- **Altcoins unstable**: Community plugins may break or be removed
- **No guarantees**: Non-Bitcoin support is best-effort
- **Example**: Zcash plugin was removed due to lack of maintenance

**Mitigation**:
- Accept Bitcoin as primary (95%+ of crypto users have it)
- Consider separate solutions for altcoins if needed
- Use stablecoins on Lightning (L-USDT) for price stability

#### 4. No Fiat Conversion
- **Crypto-only**: Cannot convert Bitcoin to USD/EUR automatically
- **Price volatility**: Bitcoin price fluctuates (risk of value loss)
- **Manual conversion**: Must sell Bitcoin on exchanges separately
- **Tax complexity**: Crypto donations may have tax implications

**Mitigation**:
- Use exchanges with API (Coinbase, Kraken) for auto-conversion
- Accept stablecoins (L-USDT) for price stability
- Consult tax professional for compliance

#### 5. "Tainted Funds" Risk
- **No screening**: BTCPay doesn't check if Bitcoin is "clean"
- **Compliance risk**: Receiving "dirty" Bitcoin could cause legal issues
- **Your responsibility**: Merchant must verify funds themselves
- **Expensive solutions**: Chain analysis services (Chainalysis, Elliptic) are costly

**Mitigation**:
- Accept the risk as part of Bitcoin's permissionless nature
- Use third-party analysis for large donations
- Legal consultation for high-risk jurisdictions

#### 6. Lightning Network Complexity
- **Channel management**: Opening, closing, rebalancing channels
- **Liquidity requirements**: Need inbound liquidity to receive payments
- **Hot wallet risk**: Lightning funds stored online (less secure)
- **Force-close costs**: On-chain fees if channels fail (~$5-50 per channel)

**Mitigation**:
- Start with on-chain only, add Lightning later
- Use Lightning Service Providers (LSPs) for managed channels
- Keep small amounts in Lightning, large amounts on-chain

#### 7. Breaking Changes in Updates
- **API changes**: Version 2.0 requires updating custom integrations
- **No rollback**: Updates are one-way (can't downgrade)
- **Plugin breakage**: Third-party plugins may stop working
- **Testing burden**: Must test integrations after updates

**Mitigation**:
- Read release notes before updating
- Test updates on staging server first
- Use stable/LTS versions, avoid bleeding-edge

#### 8. User Experience
- **Confusing for non-crypto users**: "What's a Bitcoin address?"
- **Wallet requirement**: Users must have Bitcoin wallet to pay
- **On-chain confirmation times**: 10-60 minutes for on-chain payments
- **No chargebacks**: Can't reverse payments (pro for merchants, con for users)

**Mitigation**:
- Provide clear instructions for first-time donors
- Offer Lightning option for instant payments
- Consider offering fiat option alongside crypto

#### 9. Regulatory Uncertainty
- **Legal gray area**: Crypto regulations vary by jurisdiction
- **Tax reporting**: May need to report crypto donations to IRS
- **AML/KYC exemptions**: Non-profit status may not exempt you
- **Changing laws**: Regulations evolving rapidly

**Mitigation**:
- Consult legal/tax professionals
- Stay informed on local regulations
- Document all transactions for compliance

### Suitability for Veritable Games Use Case

#### Good Fit If:
- **Values align**: You prioritize decentralization, privacy, sovereignty
- **Technical capacity**: You or a team member can manage Linux servers
- **Donor base**: Your community is crypto-savvy or willing to learn
- **Transparency goals**: You want publicly verifiable donation records
- **No fiat needed**: You can operate on Bitcoin directly or are willing to convert manually

#### Poor Fit If:
- **Non-technical**: No one on team has devops/Linux skills (or budget for hosting)
- **Fiat-dependent**: You need automatic USD payouts for expenses
- **Altcoin focus**: You want to accept many cryptocurrencies
- **User-friendly priority**: Your audience is non-technical and expects PayPal-like UX
- **Compliance-heavy**: You're in a jurisdiction with strict crypto regulations

---

## 7. Cost Analysis

### One-Time Setup Costs

| Item | Cost | Notes |
|------|------|-------|
| **Domain name** | $10-15/year | For btcpay.yourdomain.com |
| **SSL certificate** | $0 | Free with Let's Encrypt (auto-configured in Docker) |
| **Hardware (optional)** | $300 | BeeLink S12 Mini PC for on-premises hosting |
| **Professional setup** | $0-500 | DIY = free; hiring consultant = $50-100/hour × 5-10 hours |
| **Total** | **$10-815** | Typical DIY: ~$15; Fully managed: ~$500 |

### Recurring Monthly Costs

#### VPS Hosting Options

| Provider | Specs | Monthly Cost | Notes |
|----------|-------|--------------|-------|
| **LunaNode** | 2 CPU, 4 GB RAM, 80 GB SSD | $8-9 | Recommended by BTCPay docs |
| **Linode** | 2 CPU, 4 GB RAM, 80 GB SSD | $10 | Reliable, good support |
| **DigitalOcean** | 2 CPU, 4 GB RAM, 80 GB SSD | $12 | Popular choice |
| **Azure** (pruned) | 2 CPU, 4 GB RAM, 80 GB SSD | $20 | After initial sync |
| **Azure** (initial sync) | 4 CPU, 8 GB RAM, 200 GB SSD | $65 | Needed for faster sync |
| **time4vps** (budget) | 2 CPU, 4 GB RAM, 80 GB SSD | €4.49 | 2-year prepayment required |

**Recommendation**: **LunaNode** at $8-9/month for best value.

#### Additional Recurring Costs

| Item | Cost | Notes |
|------|------|-------|
| **VPS hosting** | $8-20/month | See table above |
| **Backups** | $2-5/month | Optional off-site backups (Backblaze B2, AWS S3) |
| **Monitoring** | $0-10/month | Uptime monitoring (UptimeRobot free tier, or paid) |
| **Total** | **$8-35/month** | Typical: ~$10/month (LunaNode + free monitoring) |

### Transaction Costs

| Payment Method | Cost per Transaction | Notes |
|----------------|---------------------|-------|
| **On-chain Bitcoin** | $1-50 | Variable based on network congestion |
| **Lightning Network** | <$0.01 | Near-zero fees |
| **Lightning (channel management)** | $5-50/channel | Opening/closing channels (infrequent) |

**Donation Size Recommendations**:
- **<$10**: Use Lightning Network only (on-chain fees would eat donation)
- **$10-100**: Lightning preferred, on-chain acceptable
- **>$100**: On-chain acceptable (fees are small % of total)

### Cost Comparison: BTCPay vs. Traditional Processors

**Example: $10,000 in monthly donations**

| Processor | Processing Fee | Monthly Cost | Annual Cost | 5-Year Cost |
|-----------|---------------|--------------|-------------|-------------|
| **PayPal** | 2.9% + $0.30 | $323 | $3,876 | $19,380 |
| **Stripe** | 2.9% + $0.30 | $323 | $3,876 | $19,380 |
| **BTCPay (on-chain)** | ~$0.10/tx (100 txs) | $10 + $10 hosting = $20 | $240 | $1,200 |
| **BTCPay (Lightning)** | <$0.01/tx | $1 + $10 hosting = $11 | $132 | $660 |

**Savings with BTCPay**:
- **vs. PayPal/Stripe**: $3,636/year saved ($18,180 over 5 years)
- **Break-even point**: ~30 days (hosting cost recovered by avoiding processing fees)

### Total Cost of Ownership (5 Years)

**Scenario 1: DIY Setup, LunaNode Hosting, On-Chain Only**
- Setup: $15 (domain)
- Monthly: $10 hosting + $20 network fees = $30/month
- **5-Year Total**: $15 + ($30 × 60 months) = **$1,815**

**Scenario 2: Professional Setup, DigitalOcean Hosting, Lightning Network**
- Setup: $500 (consultant)
- Monthly: $12 hosting + $10 Lightning management + $5 network fees = $27/month
- **5-Year Total**: $500 + ($27 × 60 months) = **$2,120**

**Scenario 3: PayPal (for comparison)**
- Setup: $0
- Monthly: $323 processing fees (on $10k donations)
- **5-Year Total**: ($323 × 60 months) = **$19,380**

**ROI**: BTCPay pays for itself in the first month if processing >$300/month in donations.

---

## 8. Recommendations

### For Veritable Games Platform

#### Recommendation: **PROCEED WITH BTCPAY SERVER** (with conditions)

BTCPay Server is a **strong fit** for Veritable Games if:

1. **You prioritize decentralization and transparency** (aligns with anarchist/libertarian values)
2. **You have technical capacity** (or budget to hire for initial setup)
3. **Your community is crypto-savvy** (or willing to learn)
4. **You can tolerate some UX friction** (in exchange for sovereignty)

#### Implementation Roadmap

**Phase 1: Proof of Concept (2-4 weeks)**

1. **Setup BTCPay testnet instance**
   - Deploy on cheap VPS (LunaNode $8/month)
   - Configure pruned Bitcoin node (testnet)
   - Create test store

2. **Build basic integration**
   - Implement invoice creation API
   - Set up webhook handler
   - Create simple donation form

3. **Test multi-project tracking**
   - Add metadata to invoices
   - Verify webhook processing
   - Test database schema

4. **Evaluate**
   - Assess technical complexity
   - Measure setup time
   - Identify pain points

**Phase 2: Mainnet Deployment (2-3 weeks)**

1. **Deploy production BTCPay**
   - Mainnet Bitcoin node (pruned)
   - SSL/domain configuration
   - Admin account setup

2. **Security hardening**
   - Enable 2FA
   - Configure firewall
   - Set up backups
   - Implement monitoring

3. **Integration development**
   - Build donation UI components
   - Implement transparency dashboard
   - Set up email notifications
   - Create admin tools

4. **Testing**
   - Small real-money tests
   - Verify webhook reliability
   - Test edge cases

**Phase 3: Lightning Network (Optional, 1-2 weeks)**

1. **Add Lightning node**
   - Choose c-lightning or LND
   - Open initial channels
   - Set up liquidity

2. **Update integration**
   - Support Lightning invoices
   - Update UI for instant payments

3. **Test micro-donations**
   - Verify <$1 donations work
   - Measure user experience

**Phase 4: Launch & Iterate (Ongoing)**

1. **Soft launch**
   - Announce to community
   - Gather feedback
   - Monitor for issues

2. **Marketing**
   - Create "How to Donate" guide
   - Promote transparency dashboard
   - Highlight zero-fee advantage

3. **Optimization**
   - Improve UX based on feedback
   - Add features (recurring donations, donor tiers)
   - Expand to more projects

#### Technical Architecture Recommendation

**Use Single Store with Metadata Approach**:
- One BTCPay store for all projects
- Tag invoices with `projectId` metadata
- Your Next.js app handles project-specific logic
- Simplifies BTCPay setup, centralizes management

**Database Schema**:
- `projects` table (donation goals, totals)
- `project_donations` table (individual donations)
- `pending_donations` table (awaiting settlement)
- `donation_milestones` table (gamification)

**API Routes**:
- `/api/donations/create` - Create BTCPay invoice
- `/api/btcpay/webhook` - Handle payment notifications
- `/api/transparency/data` - Fetch donation stats
- `/api/transparency/export` - CSV export

**UI Components**:
- `<MultiProjectDonateForm>` - Project selector + amount
- `<TransparencyDashboard>` - Public donation stats
- `<ProjectFundingCard>` - Individual project progress
- `<RecentDonations>` - Live donation feed

#### Hosting Recommendation

**Start with LunaNode ($8-9/month)**:
- Bitcoin-friendly (no card required, pay with BTC)
- Recommended by BTCPay docs
- Affordable for testing
- Easy to scale up later

**Upgrade to DigitalOcean ($12/month) if**:
- You need better support
- Higher uptime SLA required
- More flexible server configurations

#### Alternative: Hybrid Approach

If BTCPay seems too complex initially, consider:

1. **Start with simpler crypto solution**:
   - CoinGate (custodial, $0.99/tx fee)
   - Coinbase Commerce (custodial, 1% fee)
   - OpenNode (Lightning-focused, 1% fee)

2. **Transition to BTCPay later**:
   - Migrate once you have dev resources
   - Keep existing solution as fallback
   - Gradual transition reduces risk

#### Risk Mitigation

**Address key challenges**:

1. **Technical complexity**:
   - Budget 8-16 hours for learning/setup
   - Join BTCPay Slack/Matrix for support
   - Use managed hosting if needed

2. **User experience**:
   - Create detailed "How to Donate" guide
   - Offer fiat option alongside crypto (e.g., Stripe)
   - Provide support for first-time donors

3. **Regulatory compliance**:
   - Consult crypto-friendly accountant
   - Research local regulations
   - Document all transactions

4. **Volatility**:
   - Convert to fiat promptly if needed
   - Use stablecoins (L-USDT) for stability
   - Consider Lightning for instant settlement

### Final Verdict

**BTCPay Server is highly recommended for Veritable Games** given:

- ✅ Alignment with decentralization values
- ✅ Zero processing fees (significant savings)
- ✅ Perfect for multi-project funding (via metadata)
- ✅ Excellent transparency features
- ✅ Active development and community
- ✅ Reasonable costs ($10-20/month hosting)

**Proceed with caution on**:

- ⚠️ Technical complexity (plan for 8+ hour setup)
- ⚠️ Lightning Network (start without it, add later)
- ⚠️ User onboarding (provide clear instructions)
- ⚠️ Regulatory compliance (get legal advice)

**Timeline**: 4-8 weeks from start to production-ready implementation.

**Budget**: $500-1,000 initial (setup + first year hosting), $120-400/year ongoing.

---

## Additional Resources

### Official Documentation
- **BTCPay Server Docs**: https://docs.btcpayserver.org/
- **GreenField API Reference**: https://docs.btcpayserver.org/API/Greenfield/v1/
- **Deployment Guide**: https://docs.btcpayserver.org/Deployment/
- **GitHub Repository**: https://github.com/btcpayserver/btcpayserver

### Tutorials & Guides
- **Custom Integration Guide**: https://docs.btcpayserver.org/CustomIntegration/
- **Node.js Example**: https://docs.btcpayserver.org/Development/GreenFieldExample-NodeJS/
- **Backup & Restore**: https://docs.btcpayserver.org/Docker/backup-restore/

### Community
- **BTCPay Slack**: https://chat.btcpayserver.org/
- **GitHub Discussions**: https://github.com/btcpayserver/btcpayserver/discussions
- **Blog**: https://blog.btcpayserver.org/

### React Integration
- **react-btcpay-paybutton**: https://www.npmjs.com/package/react-btcpay-paybutton
- **Next.js Example**: https://github.com/truxxu/next-btcpay-poc

### Hosting Providers
- **LunaNode**: https://www.lunanode.com/
- **Voltage**: https://voltage.cloud/ (managed BTCPay hosting)
- **Bitcoin VPS List**: https://bitcoin-vps.com/

---

## Conclusion

BTCPay Server is a **mature, production-ready solution** for cryptocurrency payment processing that offers unparalleled sovereignty, transparency, and cost savings. While it requires technical expertise and ongoing maintenance, the benefits far outweigh the challenges for projects aligned with decentralization principles.

**For Veritable Games**: BTCPay Server is an **excellent fit** for multi-project donation tracking with full transparency. The combination of zero fees, complete control, and robust API makes it ideal for your use case.

**Next Steps**:
1. Set up testnet instance to evaluate (1-2 days)
2. Build proof-of-concept integration (1 week)
3. Decide on mainnet deployment (after testing)
4. Launch soft pilot with one project (1 week)
5. Scale to full platform (2-4 weeks)

**Total time to production**: 6-8 weeks with dedicated effort.

---

**Report compiled**: November 19, 2025
**Sources**: BTCPay Server official documentation, GitHub repositories, community forums, technical articles
**Research depth**: 40+ sources reviewed across architecture, implementation, costs, and real-world usage
