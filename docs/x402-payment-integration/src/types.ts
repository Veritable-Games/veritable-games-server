/**
 * x402 Payment Protocol Types
 * For Veritable Games bot monetization
 */

// Cloudflare Worker environment bindings
export interface Env {
  // Environment variables
  ORIGIN_URL: string;
  PAYMENT_RECIPIENT: string;
  PAYMENT_NETWORK: string;
  BLOCK_MODE: string;
  DEBUG: string;
  BASE_RPC_URL?: string; // Optional custom RPC, defaults to public

  // KV namespace for payment caching
  PAYMENT_CACHE?: KVNamespace;

  // D1 database for payment tracking
  PAYMENTS_DB?: D1Database;
}

// Bot detection types
export interface BotSignal {
  type: string;
  value: string | number | string[];
  weight: number;
}

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  signals: BotSignal[];
  botType?: BotType;
  shouldCharge: boolean;
}

export type BotType =
  | 'ai_agent'
  | 'search_crawler'
  | 'scraper'
  | 'automation'
  | 'library_tool'
  | 'unknown';

// x402 payment types
export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeTypes: string[];
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  // Self-hosted verification info
  verificationMode: 'self-hosted';
  instructions: string;
}

// Simplified payment payload for self-hosted verification
// Bot sends USDC, then provides tx hash
export interface PaymentPayload {
  txHash: string; // The USDC transfer transaction hash
  from: string; // Sender address (for verification)
  amount: string; // Amount in USDC units (6 decimals)
  timestamp?: number; // When payment was made
}

export interface PaymentValidationResult {
  valid: boolean;
  reason?: string;
  txHash?: string;
  confirmedAmount?: string;
}

// Legacy x402 types (kept for reference/future Coinbase integration)
export interface LegacyPaymentAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

export interface LegacyPaymentPayload {
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: LegacyPaymentAuthorization;
  };
}

// Pricing configuration
export interface EndpointPricing {
  pattern: RegExp;
  priceUSD: number;
  description: string;
  rateLimit?: number;
}

// Payment record for storage
export interface PaymentRecord {
  id: string;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  amountUSD: number;
  amountUSDC: number;
  endpoint: string;
  userAgent?: string;
  clientIP?: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
}

// API response types
export interface ErrorResponse {
  error: string;
  message: string;
  paymentRequirements?: PaymentRequirements;
  documentation?: string;
}

// Cloudflare request extensions
export interface CFRequestInit {
  botManagement?: {
    score: number;
    verifiedBot: boolean;
    corporateProxy: boolean;
    staticResource: boolean;
    ja3Hash: string;
  };
  country?: string;
  asn?: number;
  asOrganization?: string;
}
