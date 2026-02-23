module.exports = {
  ci: {
    collect: {
      // URLs to audit
      url: [
        'http://localhost:3000',
        'http://localhost:3000/library',
        'http://localhost:3000/forums',
        'http://localhost:3000/wiki',
        'http://localhost:3000/projects',
      ],

      // Collection settings
      numberOfRuns: 3, // Run each URL 3 times for more consistent results
      startServerCommand: 'npm start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 30000,

      // Chrome settings
      settings: {
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],

        // Lighthouse configuration
        preset: 'desktop', // or 'mobile'
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },

        // Only run performance, accessibility, best-practices, SEO audits
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],

        // Skip certain audits that might be flaky in CI
        skipAudits: [
          'screenshot-thumbnails',
          'final-screenshot',
          'largest-contentful-paint-element',
          'layout-shift-elements',
        ],
      },
    },

    assert: {
      // Performance budgets (scores out of 100)
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // 1.8s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s
        'first-input-delay': ['error', { maxNumericValue: 100 }], // 100ms
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // 0.1
        'speed-index': ['warn', { maxNumericValue: 3000 }], // 3.0s
        interactive: ['warn', { maxNumericValue: 5000 }], // 5.0s

        // Other performance metrics
        'server-response-time': ['warn', { maxNumericValue: 600 }], // 600ms
        'render-blocking-resources': ['warn', { maxNumericValue: 500 }], // 500ms
        'unused-javascript': ['warn', { maxNumericValue: 200000 }], // 200KB
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }], // 50KB
        'unminified-css': ['error', { maxNumericValue: 0 }],
        'unminified-javascript': ['error', { maxNumericValue: 0 }],

        // Lighthouse scores
        'categories:performance': ['error', { minScore: 0.85 }], // 85/100
        'categories:accessibility': ['error', { minScore: 0.9 }], // 90/100
        'categories:best-practices': ['warn', { minScore: 0.85 }], // 85/100
        'categories:seo': ['warn', { minScore: 0.9 }], // 90/100

        // Resource counts and sizes
        'dom-size': ['warn', { maxNumericValue: 1500 }], // 1500 nodes
        'total-byte-weight': ['warn', { maxNumericValue: 2000000 }], // 2MB
        'uses-optimized-images': ['warn'],
        'modern-image-formats': ['warn'],
        'uses-webp-images': ['warn'],
        'efficient-animated-content': ['warn'],

        // Best practices
        'uses-https': ['error'],
        'uses-http2': ['warn'],
        'no-vulnerable-libraries': ['error'],
        'csp-xss': ['warn'],

        // Accessibility
        'color-contrast': ['error'],
        'image-alt': ['error'],
        label: ['error'],
        'link-name': ['error'],
        'button-name': ['error'],
      },

      // Matrix of URL patterns and assertions
      matrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }], // Lower threshold for all pages
          },
        },
        {
          matchingUrlPattern: 'http://localhost:3000/$', // Homepage gets stricter requirements
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
          },
        },
      ],
    },

    upload: {
      // Upload results to Lighthouse CI server (if you have one)
      target: 'lhci',
      serverBaseUrl: process.env.LHCI_SERVER_BASE_URL,
      token: process.env.LHCI_TOKEN,

      // Alternative: Upload to filesystem
      // target: 'filesystem',
      // outputDir: './lhci_reports',

      // Alternative: Upload to temporary public storage
      // target: 'temporary-public-storage',
    },

    server: {
      // If running your own LHCI server
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lhci.db',
      },
    },

    wizard: {
      // Configuration for the setup wizard
    },
  },

  // Custom configuration for different environments
  ...(process.env.NODE_ENV === 'production' && {
    ci: {
      collect: {
        // More realistic throttling for production testing
        settings: {
          throttling: {
            rttMs: 150,
            throughputKbps: 1638.4,
            cpuSlowdownMultiplier: 4,
          },
        },
      },
    },
  }),

  ...(process.env.CI && {
    ci: {
      collect: {
        // CI-specific settings
        numberOfRuns: 2, // Fewer runs in CI to save time
        settings: {
          chromeFlags: [
            '--headless',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--no-zygote',
            '--single-process', // Helps with memory constraints in CI
          ],
        },
      },
      assert: {
        // Slightly more lenient thresholds for CI environment
        assertions: {
          'categories:performance': ['error', { minScore: 0.8 }],
          'categories:accessibility': ['error', { minScore: 0.85 }],
          'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
          'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        },
      },
    },
  }),
};
