/**
 * HTTP Response Utilities
 * Helper functions for generating x402 responses
 */

import type { Env, ErrorResponse } from '../types.ts';
import { createPaymentRequirements } from '../payment.ts';

/**
 * Create HTTP 402 Payment Required response
 */
export function create402Response(priceUSD: number, env: Env, endpoint?: string): Response {
  const paymentRequirements = createPaymentRequirements(priceUSD, env);

  const body: ErrorResponse = {
    error: 'Payment Required',
    message:
      'This API endpoint requires payment for bot access. Human users can access this endpoint freely via a web browser.',
    paymentRequirements,
    documentation: 'https://www.x402.org',
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
      'X-Payment-Amount': priceUSD.toString(),
      'X-Payment-Currency': 'USD',
      'X-Payment-Network': env.PAYMENT_NETWORK,
      'X-Payment-Asset': 'USDC',
      'X-Payment-Verification': 'self-hosted',
      'X-Payment-Endpoint': endpoint || 'unknown',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers':
        'X-Payment-Required, X-Payment-Amount, X-Payment-Currency, X-Payment-Network, X-Payment-Asset, X-Payment-Verification',
    },
  });
}

/**
 * Create error response
 */
export function createErrorResponse(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Proxy request to origin server
 */
export async function proxyToOrigin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const originUrl = new URL(env.ORIGIN_URL);

  // Construct the origin URL
  const targetUrl = new URL(url.pathname + url.search, originUrl);

  // Clone the request with the new URL
  const headers = new Headers(request.headers);

  // Add headers to identify this came through the x402 proxy
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-x402-Proxy', 'true');

  // Preserve the original host for the origin
  headers.set('X-Forwarded-Host', url.host);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
    });

    // Clone response and add CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Origin proxy error:', error);
    return createErrorResponse(502, 'Bad Gateway', 'Failed to reach origin server');
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCORSPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Payment, X-API-Key, X-CSRF-Token',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Log request for analytics (only in debug mode)
 */
export function logRequest(
  request: Request,
  response: Response,
  startTime: number,
  env: Env
): void {
  if (env.DEBUG !== 'true') return;

  const duration = Date.now() - startTime;
  const url = new URL(request.url);

  console.log(
    JSON.stringify({
      event: 'request',
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration,
      userAgent: request.headers.get('User-Agent')?.substring(0, 50),
    })
  );
}
