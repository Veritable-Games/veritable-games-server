/**
 * Veritable Games x402 Proxy Worker
 *
 * Edge proxy that implements the x402 payment protocol for monetizing bot access.
 * Human users get free access; bots pay via USDC on Base.
 *
 * @see https://docs.x402.org
 * @see https://developers.cloudflare.com/agents/x402/
 */

import type { Env } from './types.ts';
import { detectBot, logBotDetection } from './bot-detection.ts';
import { getEndpointPrice, isEndpointFree } from './pricing.ts';
import { validatePayment, parsePaymentHeader, recordPayment, validateApiKey } from './payment.ts';
import {
  create402Response,
  createErrorResponse,
  proxyToOrigin,
  handleCORSPreflight,
  logRequest,
} from './utils/response.ts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight();
    }

    // Skip non-API paths (let static assets, pages through)
    if (!url.pathname.startsWith('/api/')) {
      return proxyToOrigin(request, env);
    }

    // Check if endpoint is free (health checks, auth, etc.)
    if (isEndpointFree(url.pathname)) {
      return proxyToOrigin(request, env);
    }

    // Detect if this is a bot request
    const botResult = await detectBot(request, env);
    logBotDetection(botResult, request, env);

    // Human users get free access
    if (!botResult.shouldCharge) {
      const response = await proxyToOrigin(request, env);
      logRequest(request, response, startTime, env);
      return response;
    }

    // Bot detected - check for payment or API key
    const priceUSD = getEndpointPrice(url.pathname, url.search);

    // Option 1: Check for X-API-Key (aggregated billing)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
      const apiKeyResult = await validateApiKey(apiKey, env);
      if (apiKeyResult.valid) {
        // Valid API key - proxy request and record usage
        const response = await proxyToOrigin(request, env);
        // TODO: Record usage for monthly billing
        logRequest(request, response, startTime, env);
        return response;
      }
      // Invalid API key - return error
      return createErrorResponse(401, 'Unauthorized', apiKeyResult.reason || 'Invalid API key');
    }

    // Option 2: Check for X-Payment header (instant USDC payment)
    const paymentHeader = request.headers.get('X-Payment');
    if (!paymentHeader) {
      // No payment provided - return 402 with payment instructions
      const response = create402Response(priceUSD, env, url.pathname);

      // In non-blocking mode, just log and allow through
      if (env.BLOCK_MODE === 'false') {
        if (env.DEBUG === 'true') {
          console.log('BLOCK_MODE=false: Would have returned 402, allowing request');
        }
        const proxiedResponse = await proxyToOrigin(request, env);
        logRequest(request, proxiedResponse, startTime, env);
        return proxiedResponse;
      }

      logRequest(request, response, startTime, env);
      return response;
    }

    // Parse and validate payment
    const payment = parsePaymentHeader(paymentHeader);
    if (!payment) {
      return createErrorResponse(400, 'Bad Request', 'Invalid X-Payment header format');
    }

    const validationResult = await validatePayment(payment, priceUSD, env);
    if (!validationResult.valid) {
      return createErrorResponse(
        402,
        'Payment Failed',
        validationResult.reason || 'Payment validation failed'
      );
    }

    // Payment valid - record and proxy request
    ctx.waitUntil(
      recordPayment(payment, url.pathname, priceUSD, validationResult.txHash, request, env)
    );

    const response = await proxyToOrigin(request, env);

    // Add payment confirmation header
    const responseWithHeaders = new Response(response.body, response);
    responseWithHeaders.headers.set('X-Payment-Status', 'success');
    if (validationResult.txHash) {
      responseWithHeaders.headers.set('X-Payment-TxHash', validationResult.txHash);
    }

    logRequest(request, responseWithHeaders, startTime, env);
    return responseWithHeaders;
  },
};

/**
 * Scheduled handler for daily billing aggregation
 * Run via Cloudflare Cron Triggers
 */
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_controller, env, _ctx) => {
  console.log('Running scheduled billing aggregation...');

  if (!env.PAYMENTS_DB) {
    console.log('No D1 database configured, skipping');
    return;
  }

  // Aggregate yesterday's usage for billing
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  try {
    // Get all payments from yesterday grouped by client
    const result = await env.PAYMENTS_DB.prepare(
      `SELECT
        from_address,
        COUNT(*) as request_count,
        SUM(amount_usd) as total_usd,
        endpoint
      FROM payments
      WHERE date(datetime(timestamp, 'unixepoch')) = ?
      GROUP BY from_address, endpoint`
    )
      .bind(dateStr)
      .all();

    console.log(`Aggregated ${result.results?.length || 0} billing records for ${dateStr}`);

    // TODO: Generate invoices for aggregated billing clients
    // TODO: Send billing notifications
    // TODO: Sync to PostgreSQL for admin dashboard
  } catch (error) {
    console.error('Billing aggregation error:', error);
  }
};
