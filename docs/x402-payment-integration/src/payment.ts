/**
 * Self-Hosted USDC Payment Verification
 * Direct on-chain verification without Coinbase facilitator
 *
 * Flow:
 * 1. Bot receives 402 with payment requirements (recipient, amount, asset)
 * 2. Bot sends USDC to our wallet (standard ERC20 transfer, bot pays gas)
 * 3. Bot retries request with X-Payment header: {"txHash": "0x...", "from": "0x...", "amount": "100000"}
 * 4. Worker verifies transfer on Base via RPC
 */

import type {
  Env,
  PaymentPayload,
  PaymentValidationResult,
  PaymentRequirements,
  PaymentRecord,
} from './types.ts';
import { usdToUSDCUnits } from './pricing.ts';

// USDC contract addresses
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_SEPOLIA_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// ERC20 Transfer event signature: Transfer(address,address,uint256)
const TRANSFER_EVENT_SIGNATURE =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Default RPC endpoints
const BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_SEPOLIA_RPC_URL = 'https://sepolia.base.org';

/**
 * Generate payment requirements for 402 response
 */
export function createPaymentRequirements(priceUSD: number, env: Env): PaymentRequirements {
  const isTestnet = env.PAYMENT_NETWORK === 'base-sepolia';
  const networkId = isTestnet ? 'eip155:84532' : 'eip155:8453';
  const usdcAddress = isTestnet ? BASE_SEPOLIA_USDC_ADDRESS : BASE_USDC_ADDRESS;
  const recipient = env.PAYMENT_RECIPIENT || '0x0000000000000000000000000000000000000000';

  return {
    scheme: 'exact',
    network: networkId,
    maxAmountRequired: usdToUSDCUnits(priceUSD),
    resource: recipient,
    description: 'API access payment for Veritable Games',
    mimeTypes: ['application/json'],
    payTo: recipient,
    maxTimeoutSeconds: 300,
    asset: `${networkId}/erc20:${usdcAddress}`,
    verificationMode: 'self-hosted',
    instructions: `Send USDC to ${recipient} on ${isTestnet ? 'Base Sepolia' : 'Base'}, then include X-Payment header with {"txHash": "0x...", "from": "your-address", "amount": "${usdToUSDCUnits(priceUSD)}"}`,
  };
}

/**
 * Parse X-Payment header into PaymentPayload
 */
export function parsePaymentHeader(header: string): PaymentPayload | null {
  try {
    // The header can be base64-encoded JSON or raw JSON
    let decoded: string;
    try {
      decoded = atob(header);
    } catch {
      decoded = header;
    }

    const parsed = JSON.parse(decoded);

    // Validate required fields
    if (!parsed.txHash || !parsed.from || !parsed.amount) {
      console.error('Missing required payment fields: txHash, from, amount');
      return null;
    }

    // Validate txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(parsed.txHash)) {
      console.error('Invalid txHash format');
      return null;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(parsed.from)) {
      console.error('Invalid from address format');
      return null;
    }

    return {
      txHash: parsed.txHash.toLowerCase(),
      from: parsed.from.toLowerCase(),
      amount: parsed.amount.toString(),
      timestamp: parsed.timestamp,
    };
  } catch (error) {
    console.error('Failed to parse payment header:', error);
    return null;
  }
}

/**
 * Validate a payment by verifying the USDC transfer on-chain
 */
export async function validatePayment(
  payment: PaymentPayload,
  priceUSD: number,
  env: Env
): Promise<PaymentValidationResult> {
  const requiredAmount = BigInt(usdToUSDCUnits(priceUSD));
  const providedAmount = BigInt(payment.amount);

  // 1. Check claimed amount is sufficient
  if (providedAmount < requiredAmount) {
    return {
      valid: false,
      reason: `Insufficient payment: required ${requiredAmount}, claimed ${providedAmount}`,
    };
  }

  // 2. Check for replay (if KV is available)
  if (env.PAYMENT_CACHE) {
    const existing = await env.PAYMENT_CACHE.get(`tx:${payment.txHash}`);
    if (existing) {
      return { valid: false, reason: 'Transaction already used (replay detected)' };
    }
  }

  // 3. Verify the transaction on-chain
  const verificationResult = await verifyUSDCTransfer(payment, env);
  if (!verificationResult.valid) {
    return verificationResult;
  }

  // 4. Verify the on-chain amount matches or exceeds required
  if (verificationResult.confirmedAmount) {
    const confirmedBigInt = BigInt(verificationResult.confirmedAmount);
    if (confirmedBigInt < requiredAmount) {
      return {
        valid: false,
        reason: `On-chain amount insufficient: required ${requiredAmount}, found ${confirmedBigInt}`,
      };
    }
  }

  // 5. Mark transaction as used
  if (env.PAYMENT_CACHE) {
    await env.PAYMENT_CACHE.put(
      `tx:${payment.txHash}`,
      JSON.stringify({
        timestamp: Date.now(),
        amount: verificationResult.confirmedAmount || payment.amount,
        from: payment.from,
      }),
      { expirationTtl: 86400 * 30 } // 30 day TTL
    );
  }

  return {
    valid: true,
    txHash: payment.txHash,
    confirmedAmount: verificationResult.confirmedAmount,
  };
}

/**
 * Verify USDC transfer on Base via RPC
 */
async function verifyUSDCTransfer(
  payment: PaymentPayload,
  env: Env
): Promise<PaymentValidationResult> {
  const isTestnet = env.PAYMENT_NETWORK === 'base-sepolia';
  const rpcUrl = env.BASE_RPC_URL || (isTestnet ? BASE_SEPOLIA_RPC_URL : BASE_RPC_URL);
  const usdcAddress = isTestnet ? BASE_SEPOLIA_USDC_ADDRESS : BASE_USDC_ADDRESS;
  const recipient = env.PAYMENT_RECIPIENT?.toLowerCase();

  if (!recipient) {
    return { valid: false, reason: 'Payment recipient not configured' };
  }

  // In debug mode with blocking disabled, skip actual verification
  if (env.DEBUG === 'true' && env.BLOCK_MODE === 'false') {
    console.log('DEBUG: Skipping on-chain verification (debug mode)');
    return { valid: true, txHash: payment.txHash, confirmedAmount: payment.amount };
  }

  try {
    // Get transaction receipt
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [payment.txHash],
      }),
    });

    const receiptData = (await receiptResponse.json()) as {
      result?: {
        status: string;
        logs: Array<{
          address: string;
          topics: string[];
          data: string;
        }>;
      };
      error?: { message: string };
    };

    if (receiptData.error) {
      return { valid: false, reason: `RPC error: ${receiptData.error.message}` };
    }

    if (!receiptData.result) {
      return { valid: false, reason: 'Transaction not found or not yet confirmed' };
    }

    const receipt = receiptData.result;

    // Check transaction succeeded
    if (receipt.status !== '0x1') {
      return { valid: false, reason: 'Transaction failed on-chain' };
    }

    // Find USDC Transfer event to our address
    for (const log of receipt.logs) {
      // Check it's from USDC contract
      if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) {
        continue;
      }

      // Check it's a Transfer event
      if (log.topics[0] !== TRANSFER_EVENT_SIGNATURE) {
        continue;
      }

      // Transfer event: topics[1] = from, topics[2] = to
      // Addresses in topics are 32 bytes (padded), extract last 20 bytes
      const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
      const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();

      // Check recipient matches our payment address
      if (toAddress !== recipient) {
        continue;
      }

      // Check sender matches claimed sender (optional, but good for accounting)
      if (fromAddress !== payment.from.toLowerCase()) {
        continue;
      }

      // Extract amount from data field (uint256)
      const amount = BigInt(log.data);

      return {
        valid: true,
        txHash: payment.txHash,
        confirmedAmount: amount.toString(),
      };
    }

    return {
      valid: false,
      reason: `No USDC transfer found to ${recipient} from ${payment.from}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('On-chain verification failed:', error);
    return { valid: false, reason: `Verification failed: ${message}` };
  }
}

/**
 * Record a payment to D1 database
 */
export async function recordPayment(
  payment: PaymentPayload,
  endpoint: string,
  priceUSD: number,
  txHash: string | undefined,
  request: Request,
  env: Env
): Promise<void> {
  if (!env.PAYMENTS_DB) {
    console.log('No D1 database configured, skipping payment recording');
    return;
  }

  const record: PaymentRecord = {
    id: `tx:${payment.txHash}`,
    timestamp: Math.floor(Date.now() / 1000),
    fromAddress: payment.from,
    toAddress: env.PAYMENT_RECIPIENT || '',
    amountUSD: priceUSD,
    amountUSDC: parseInt(payment.amount),
    endpoint,
    userAgent: request.headers.get('User-Agent') || undefined,
    clientIP: request.headers.get('CF-Connecting-IP') || undefined,
    txHash: txHash || payment.txHash,
    status: 'completed',
  };

  try {
    await env.PAYMENTS_DB.prepare(
      `INSERT INTO payments (id, timestamp, from_address, amount_usd, endpoint, tx_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        record.id,
        record.timestamp,
        record.fromAddress,
        record.amountUSD,
        record.endpoint,
        record.txHash || null,
        record.status
      )
      .run();
  } catch (error) {
    console.error('Failed to record payment:', error);
  }
}

/**
 * Validate API key for aggregated billing clients
 */
export async function validateApiKey(
  apiKey: string,
  env: Env
): Promise<{ valid: boolean; clientId?: string; reason?: string }> {
  if (!env.PAYMENTS_DB) {
    return { valid: false, reason: 'API key validation not available' };
  }

  try {
    // Hash the API key for comparison
    const keyHash = await hashApiKey(apiKey);

    const result = await env.PAYMENTS_DB.prepare(
      `SELECT id, name, monthly_limit_usd, current_month_usage_usd
       FROM api_keys
       WHERE key_hash = ? AND is_active = 1`
    )
      .bind(keyHash)
      .first<{
        id: string;
        name: string;
        monthly_limit_usd: number;
        current_month_usage_usd: number;
      }>();

    if (!result) {
      return { valid: false, reason: 'Invalid API key' };
    }

    // Check monthly limit
    if (result.current_month_usage_usd >= result.monthly_limit_usd) {
      return { valid: false, reason: 'Monthly usage limit exceeded' };
    }

    return { valid: true, clientId: result.id };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, reason: 'Validation error' };
  }
}

/**
 * Hash API key for storage/comparison
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
