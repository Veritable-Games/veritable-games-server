/** @type {import('next').NextConfig} */
const { execSync } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Get git commit hash at build time
let gitCommitHash = 'unknown';
try {
  gitCommitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git commit hash:', e.message);
}

const nextConfig = {
  // CRITICAL: Enable standalone output for Docker deployments
  // This generates .next/standalone which the Dockerfile copies to the runner stage
  output: 'standalone',

  // Monorepo configuration - set frontend/ as the correct root
  outputFileTracingRoot: require('path').join(__dirname),

  // React optimizations
  reactStrictMode: true,

  // Compiler optimizations
  compiler: {
    // Note: styled-jsx disabled via Turbopack resolveAlias instead
    removeConsole: isProd,
  },

  experimental: {
    // Basic optimizations
    optimizePackageImports: [
      'lodash',
      '@heroicons/react',
      'react-markdown',
      'zustand',
      'lru-cache',
      'three',
      '@tanstack/react-query',
      'react-hook-form',
      'zod',
      'dompurify',
      'marked',
    ],

    // Server actions support
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // External packages for server-side
  serverExternalPackages: ['better-sqlite3', 'sharp', 'bcrypt', 'jsdom', 'isomorphic-dompurify'],

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Build-time environment variables
  // Note: MAINTENANCE_MODE moved to NEXT_PUBLIC_MAINTENANCE_MODE in .env.local
  // to work with Edge Runtime middleware (NEXT_PUBLIC_ vars are available everywhere)
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: gitCommitHash,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    ENABLE_FORUMS: process.env.ENABLE_FORUMS || 'true',
    ENABLE_WIKI: process.env.ENABLE_WIKI || 'true',
    ENABLE_LIBRARY: process.env.ENABLE_LIBRARY || 'true',
    ENABLE_3D_VIEWER: process.env.ENABLE_3D_VIEWER || 'true',
  },

  // Enable compression
  compress: true,

  // Production optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  generateEtags: true,

  // TypeScript settings
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },

  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack overrides for large directories and production stubs
  webpack: (config, { isServer }) => {
    // Exclude godot projects and builds from webpack analysis
    config.watchOptions = config.watchOptions || {};
    const existingIgnored = config.watchOptions.ignored;
    const newPatterns = [/godot-projects/, /godot-builds/];
    // Handle both array and non-array ignored configurations
    if (Array.isArray(existingIgnored)) {
      config.watchOptions.ignored = [...existingIgnored, ...newPatterns];
    } else if (existingIgnored) {
      config.watchOptions.ignored = [existingIgnored, ...newPatterns];
    } else {
      config.watchOptions.ignored = newPatterns;
    }

    // Replace better-sqlite3 with no-op stub in production server builds
    // Production uses PostgreSQL only - native SQLite bindings not built in Docker
    if (isServer && isProd) {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['better-sqlite3'] = require('path').join(
        __dirname,
        'src/lib/polyfills/better-sqlite3-noop.js'
      );
    }

    return config;
  },

  // Turbopack configuration
  turbopack: {
    // Path aliases (CRITICAL - used throughout codebase)
    resolveAlias: {
      '@': './src',
      '~': './src',
      // Replace styled-jsx with no-op to prevent HMR chunk loading conflicts
      // This is the Turbopack equivalent of webpack's NormalModuleReplacementPlugin
      // NOTE: Must use relative paths - Turbopack doesn't support absolute paths yet
      'styled-jsx': './src/lib/polyfills/styled-jsx-noop.js',
      'styled-jsx/style': './src/lib/polyfills/styled-jsx-noop.js',
      'styled-jsx/css': './src/lib/polyfills/styled-jsx-noop.js',
      // Replace better-sqlite3 with no-op in production builds
      // Production uses PostgreSQL only - native SQLite bindings not built in Docker
      // This prevents "Could not locate the bindings file" runtime errors
      ...(isProd
        ? {
            'better-sqlite3': './src/lib/polyfills/better-sqlite3-noop.js',
          }
        : {}),
    },
    // File extensions (optional - Turbopack has sensible defaults)
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  // Basic headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Cache static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
