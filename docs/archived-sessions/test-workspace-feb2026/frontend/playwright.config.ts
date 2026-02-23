/**
 * Playwright E2E Test Configuration
 *
 * End-to-end testing for critical user flows and real-world scenarios
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const PORT = process.env.PORT || 3000;
const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  (process.env.USE_LOCALHOST_TESTING === 'true'
    ? `http://localhost:${PORT}`
    : 'https://www.veritablegames.com');

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test match pattern
  testMatch: '**/*.spec.ts',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Maximum time entire test suite can run
  globalTimeout: 60 * 60 * 1000, // 1 hour

  // Number of failures before stopping
  maxFailures: process.env.CI ? 10 : undefined,

  // Parallel execution
  // IMPORTANT: Sequential execution to prevent connection pool exhaustion
  // With 6 browser projects (chromium, firefox, webkit, mobile-chrome, mobile-safari, accessibility)
  // and fullyParallel=true, we can hit 20+ concurrent connections quickly
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    process.env.CI ? ['github'] : null,
    ['json', { outputFile: 'test-results/results.json' }],
  ].filter(Boolean) as any,

  // Global test configuration
  use: {
    // Base URL for all tests
    baseURL,

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    // Accessibility testing
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Enable accessibility testing
        colorScheme: 'dark',
        // reducedMotion: 'reduce', // Not available in this Playwright version
      },
    },
  ],

  // Web server configuration
  // Only start dev server when testing localhost
  webServer:
    process.env.CI || !baseURL.includes('localhost')
      ? undefined
      : {
          command: 'npm run dev',
          url: baseURL,
          timeout: 120 * 1000,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            NODE_ENV: 'test',
            NEXT_PUBLIC_API_URL: baseURL,
            API_BASE_URL: baseURL, // Required for configuration validation
            // Database configuration for E2E tests
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
            POSTGRES_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
            POSTGRES_SSL: 'false',
            DATABASE_MODE: 'postgres',
            // Increase connection pool for test environment
            POSTGRES_POOL_MAX: '50', // Up from default 20
            POSTGRES_POOL_MIN: '5', // Up from default 2
            POSTGRES_CONNECTION_TIMEOUT: '30000', // 30s instead of 10s
          },
        },

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Global setup
  globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),

  // Global teardown
  globalTeardown: path.join(__dirname, 'e2e/global-teardown.ts'),

  // Expect configuration
  expect: {
    // Maximum time expect() should wait
    timeout: 5000,

    // Default assertions
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
