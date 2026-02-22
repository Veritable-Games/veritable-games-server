/**
 * Bot Detection Module
 * Multi-signal bot detection for x402 payment enforcement
 */

import type { Env, BotSignal, BotDetectionResult, BotType, CFRequestInit } from './types.ts';

// Known AI agent and bot User-Agent patterns
const AI_AGENT_PATTERNS = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /Claude-Web/i,
  /Anthropic/i,
  /OpenAI/i,
  /Perplexity/i,
  /Google-Extended/i,
  /CCBot/i,
  /Cohere-ai/i,
  /Diffbot/i,
  /Bytespider/i,
  /FacebookBot/i,
  /meta-externalagent/i,
];

const SCRAPER_PATTERNS = [
  /python-requests/i,
  /python-urllib/i,
  /axios/i,
  /node-fetch/i,
  /got\//i,
  /curl/i,
  /wget/i,
  /httpie/i,
  /scrapy/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /headless/i,
  /PhantomJS/i,
];

const GENERIC_BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawler/i,
  /scraper/i,
  /slurp/i,
  /fetch/i,
  /archive/i,
];

// Search engine bots that get free access (for SEO)
const ALLOWLISTED_BOTS = [
  'Googlebot',
  'Googlebot-Image',
  'Googlebot-News',
  'Googlebot-Video',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'Yandex',
  'Baiduspider',
];

// Browser headers that bots typically omit
const BROWSER_HEADERS = [
  'Accept-Language',
  'Sec-Fetch-Mode',
  'Sec-Fetch-Site',
  'Sec-Fetch-Dest',
  'Sec-Ch-Ua',
];

// Confidence threshold for bot classification
const BOT_CONFIDENCE_THRESHOLD = 40;

/**
 * Detect if a request is from a bot and whether it should be charged
 */
export async function detectBot(request: Request, _env: Env): Promise<BotDetectionResult> {
  const signals: BotSignal[] = [];
  const ua = request.headers.get('User-Agent') || '';
  const url = new URL(request.url);

  // Check if this is an allowlisted search engine bot
  if (isAllowlistedBot(ua)) {
    return {
      isBot: true,
      confidence: 100,
      signals: [{ type: 'allowlisted_bot', value: ua, weight: 0 }],
      botType: 'search_crawler',
      shouldCharge: false, // Free access for SEO
    };
  }

  // Signal 1: Cloudflare Bot Score (most reliable)
  const cfData = request.cf as CFRequestInit | undefined;
  if (cfData?.botManagement?.score !== undefined) {
    const botScore = cfData.botManagement.score;
    if (botScore < 30) {
      signals.push({
        type: 'cf_bot_score',
        value: botScore,
        weight: 50,
      });
    } else if (botScore < 50) {
      signals.push({
        type: 'cf_bot_score_medium',
        value: botScore,
        weight: 25,
      });
    }
  }

  // Signal 2: Known AI Agent User-Agent
  for (const pattern of AI_AGENT_PATTERNS) {
    if (pattern.test(ua)) {
      signals.push({
        type: 'ai_agent_ua',
        value: pattern.source,
        weight: 45,
      });
      break;
    }
  }

  // Signal 3: Known Scraper User-Agent
  for (const pattern of SCRAPER_PATTERNS) {
    if (pattern.test(ua)) {
      signals.push({
        type: 'scraper_ua',
        value: pattern.source,
        weight: 40,
      });
      break;
    }
  }

  // Signal 4: Generic Bot Patterns
  for (const pattern of GENERIC_BOT_PATTERNS) {
    if (pattern.test(ua)) {
      // Only add if we haven't already detected a specific bot type
      if (!signals.some(s => s.type.includes('_ua'))) {
        signals.push({
          type: 'generic_bot_ua',
          value: pattern.source,
          weight: 30,
        });
      }
      break;
    }
  }

  // Signal 5: Empty or suspicious User-Agent
  if (!ua || ua.length < 10) {
    signals.push({
      type: 'suspicious_ua',
      value: 'empty_or_short',
      weight: 35,
    });
  } else if (!/Mozilla|Chrome|Safari|Firefox|Edge/.test(ua)) {
    // Missing typical browser identifiers
    signals.push({
      type: 'suspicious_ua',
      value: 'no_browser_id',
      weight: 25,
    });
  }

  // Signal 6: Missing browser headers
  const missingHeaders = BROWSER_HEADERS.filter(h => !request.headers.get(h));
  if (missingHeaders.length >= 3) {
    signals.push({
      type: 'missing_headers',
      value: missingHeaders,
      weight: 20,
    });
  }

  // Signal 7: API-only request pattern (JSON + no cookie + API endpoint)
  const isApiEndpoint = url.pathname.startsWith('/api/');
  const acceptsJson = request.headers.get('Accept')?.includes('application/json');
  const hasCookie = request.headers.has('Cookie');
  const cookieHeader = request.headers.get('Cookie') || '';
  const hasSessionCookie =
    cookieHeader.includes('session_id=') || cookieHeader.includes('__Secure-session_id=');

  if (isApiEndpoint && acceptsJson && !hasCookie && !hasSessionCookie) {
    signals.push({
      type: 'api_pattern',
      value: 'json_no_session',
      weight: 15,
    });
  }

  // Signal 8: x402 payment header present (self-identified as paying bot)
  if (request.headers.has('X-Payment') || request.headers.has('X-API-Key')) {
    signals.push({
      type: 'payment_header',
      value: 'present',
      weight: 50, // High confidence this is a bot that wants to pay
    });
  }

  // Calculate total confidence
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const confidence = Math.min(totalWeight, 100);
  const isBot = confidence >= BOT_CONFIDENCE_THRESHOLD;

  return {
    isBot,
    confidence,
    signals,
    botType: determineBotType(signals, ua),
    shouldCharge: isBot, // Charge all detected bots (except allowlisted)
  };
}

/**
 * Check if User-Agent matches an allowlisted search engine
 */
function isAllowlistedBot(ua: string): boolean {
  return ALLOWLISTED_BOTS.some(bot => ua.toLowerCase().includes(bot.toLowerCase()));
}

/**
 * Determine the type of bot based on signals
 */
function determineBotType(signals: BotSignal[], ua: string): BotType {
  // Check for specific bot types in signals
  if (signals.some(s => s.type === 'ai_agent_ua')) {
    return 'ai_agent';
  }
  if (signals.some(s => s.type === 'scraper_ua')) {
    return 'scraper';
  }
  if (signals.some(s => s.type === 'generic_bot_ua')) {
    // Try to determine more specifically
    if (/crawler|spider|slurp/i.test(ua)) {
      return 'search_crawler';
    }
    return 'automation';
  }
  if (signals.some(s => s.type === 'payment_header')) {
    return 'ai_agent'; // Likely an AI agent with x402 support
  }

  return 'unknown';
}

/**
 * Log bot detection for debugging (only in debug mode)
 */
export function logBotDetection(result: BotDetectionResult, request: Request, env: Env): void {
  if (env.DEBUG !== 'true') return;

  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      event: 'bot_detection',
      path: url.pathname,
      isBot: result.isBot,
      confidence: result.confidence,
      botType: result.botType,
      shouldCharge: result.shouldCharge,
      signals: result.signals.map(s => ({
        type: s.type,
        weight: s.weight,
      })),
      userAgent: request.headers.get('User-Agent')?.substring(0, 100),
    })
  );
}
