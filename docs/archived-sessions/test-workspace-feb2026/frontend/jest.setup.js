// Jest Setup File
// Configure testing environment

require('@testing-library/jest-dom');

// Mock Canvas API for image optimization tests
require('jest-canvas-mock');

// Polyfill Node.js APIs required by PostgreSQL (pg package)
// The pg package uses TextEncoder/TextDecoder for SASL authentication
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill structuredClone for Jest environment (Node.js 17+ feature)
// Required by workspace Yjs operations
global.structuredClone =
  global.structuredClone ||
  function structuredClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

// Mock next/server module before anything else
jest.mock('next/server', () => ({
  NextRequest: class NextRequest extends Request {
    constructor(input, init = {}) {
      super(input, init);
      this.cookies = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      };
      this.nextUrl = new URL(this.url || 'http://localhost');
    }
  },
  NextResponse: {
    json: (data, init = {}) => {
      const body = JSON.stringify(data);
      const response = new Response(body, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers || {}),
        },
      });
      // Add cookies mock for CSRF support
      response.cookies = {
        set: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      };
      return response;
    },
    redirect: (url, init = {}) => {
      const response = new Response(null, {
        status: init.status || 302,
        headers: {
          Location: url.toString(),
          ...(init.headers || {}),
        },
      });
      // Add cookies mock for CSRF support
      response.cookies = {
        set: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      };
      return response;
    },
    next: jest.fn(() => {
      const response = new Response(null, { status: 200 });
      response.cookies = {
        set: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      };
      return response;
    }),
  },
}));

// Polyfill for Next.js Web APIs
global.Request =
  global.Request ||
  class Request {
    constructor(input, init = {}) {
      // Use Object.defineProperty to create a read-only url property
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false,
        enumerable: true,
        configurable: false,
      });
      this.method = init.method || 'GET';
      this.headers = new Headers(init.headers);
      this.body = init.body || null;
    }

    json() {
      if (typeof this.body === 'string') {
        return Promise.resolve(JSON.parse(this.body));
      }
      return Promise.resolve({});
    }

    text() {
      return Promise.resolve(this.body || '');
    }
  };

global.Response =
  global.Response ||
  class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Headers(init.headers);
    }

    json() {
      return Promise.resolve(JSON.parse(this.body));
    }

    text() {
      return Promise.resolve(this.body);
    }
  };

global.Headers =
  global.Headers ||
  class Headers {
    constructor(init = {}) {
      this._headers = {};
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers[key.toLowerCase()] = value;
        });
      }
    }

    get(name) {
      return this._headers[name.toLowerCase()];
    }

    set(name, value) {
      this._headers[name.toLowerCase()] = value;
    }
  };

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables (MUST be at least 32 characters for security checks)
process.env.SESSION_SECRET = 'test-secret-key-for-ci-minimum-32-chars-required';
process.env.CSRF_SECRET = 'test-csrf-secret-for-ci-minimum-32-chars-required';
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-ci-32-chars-required-here';
process.env.NODE_ENV = 'test';

// Mock database connection to prevent adapter initialization errors
// The adapter checks for POSTGRES_URL/DATABASE_URL and throws if missing
// Setting DATABASE_MODE='postgres' prevents SQLite initialization in tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.DATABASE_MODE = 'postgres'; // Use postgres mode (adapter will be mocked)

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render')) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test utilities
global.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mock DOMPurify for tests (both client and server versions)
jest.mock('dompurify', () => require('./src/lib/forums/__tests__/__mocks__/dompurify').default, {
  virtual: true,
});

jest.mock(
  'isomorphic-dompurify',
  () => ({
    default: require('./src/lib/forums/__tests__/__mocks__/dompurify').default,
  }),
  { virtual: true }
);

// Mock PerformanceObserver for tests (browser API not available in Node.js)
global.PerformanceObserver = class PerformanceObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {
    // Mock implementation - do nothing in tests
  }

  disconnect() {
    // Mock implementation
  }

  takeRecords() {
    return [];
  }
};
