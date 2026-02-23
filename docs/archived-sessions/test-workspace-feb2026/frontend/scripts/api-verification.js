#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Verification Script
 * Tests all remaining API endpoints to ensure they respond correctly
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_DIR = './src/app/api';

// Test results tracking
const results = {
  endpoints: [],
  totalEndpoints: 0,
  workingEndpoints: 0,
  brokenEndpoints: 0,
  categories: {},
};

/**
 * Find all API route files
 */
function findApiEndpoints(dir, basePath = '') {
  const endpoints = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      // Handle dynamic routes like [id], [slug], etc.
      const dirName = item.name;
      const isDynamic = dirName.startsWith('[') && dirName.endsWith(']');
      const routePath = isDynamic ? dirName : dirName;

      endpoints.push(...findApiEndpoints(path.join(dir, item.name), basePath + '/' + routePath));
    } else if (item.name === 'route.ts') {
      endpoints.push(basePath);
    }
  }

  return endpoints;
}

/**
 * Test an individual endpoint
 */
async function testEndpoint(endpoint, method = 'GET') {
  const url = `${BASE_URL}/api${endpoint}`;
  const testPath = endpoint.replace(/\/\[[\w\-]+\]/g, '/test-id'); // Replace dynamic segments
  const actualUrl = `${BASE_URL}/api${testPath}`;

  try {
    const response = await fetch(actualUrl, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const status = response.status;
    const isSuccess = status >= 200 && status < 400;
    const isAuthError = status === 401 || status === 403;
    const isNotFound = status === 404;
    const isValid = isSuccess || isAuthError; // Auth errors are expected for protected endpoints

    return {
      endpoint,
      method,
      url: actualUrl,
      status,
      isSuccess,
      isAuthError,
      isNotFound,
      isValid,
      message: getStatusMessage(status),
    };
  } catch (error) {
    return {
      endpoint,
      method,
      url: actualUrl,
      status: 'ERROR',
      isSuccess: false,
      isAuthError: false,
      isNotFound: false,
      isValid: false,
      message: `Connection error: ${error.message}`,
    };
  }
}

/**
 * Get human readable status message
 */
function getStatusMessage(status) {
  if (typeof status === 'string') return status;

  const messages = {
    200: 'OK',
    201: 'Created',
    400: 'Bad Request',
    401: 'Unauthorized (expected for protected endpoints)',
    403: 'Forbidden (expected for admin endpoints)',
    404: 'Not Found',
    405: 'Method Not Allowed',
    429: 'Rate Limited',
    500: 'Server Error',
  };

  return messages[status] || `HTTP ${status}`;
}

/**
 * Categorize endpoint by domain
 */
function categorizeEndpoint(endpoint) {
  const segments = endpoint.split('/').filter(s => s);
  if (segments.length === 0) return 'root';
  return segments[0];
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log('\n=== API VERIFICATION REPORT ===\n');

  console.log(`📊 SUMMARY:`);
  console.log(`   Total Endpoints: ${results.totalEndpoints}`);
  console.log(
    `   Working/Valid: ${results.workingEndpoints} (${Math.round((results.workingEndpoints / results.totalEndpoints) * 100)}%)`
  );
  console.log(
    `   Broken/Invalid: ${results.brokenEndpoints} (${Math.round((results.brokenEndpoints / results.totalEndpoints) * 100)}%)`
  );

  console.log(`\n📈 BY CATEGORY:`);
  Object.entries(results.categories).forEach(([category, data]) => {
    console.log(`   ${category}: ${data.working}/${data.total} working`);
  });

  console.log(`\n✅ WORKING ENDPOINTS:`);
  results.endpoints
    .filter(e => e.isValid)
    .forEach(e => {
      console.log(`   ${e.method} ${e.endpoint} - ${e.message}`);
    });

  if (results.brokenEndpoints > 0) {
    console.log(`\n❌ BROKEN ENDPOINTS:`);
    results.endpoints
      .filter(e => !e.isValid)
      .forEach(e => {
        console.log(`   ${e.method} ${e.endpoint} - ${e.message}`);
      });
  }
}

/**
 * Test all GET endpoints
 */
async function testAllEndpoints() {
  console.log('🔍 Discovering API endpoints...');

  const endpoints = findApiEndpoints(API_DIR);
  results.totalEndpoints = endpoints.length;

  console.log(`Found ${endpoints.length} API endpoints\n`);

  console.log('🧪 Testing endpoints...\n');

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint, 'GET');
    results.endpoints.push(result);

    // Categorize
    const category = categorizeEndpoint(endpoint);
    if (!results.categories[category]) {
      results.categories[category] = { total: 0, working: 0 };
    }
    results.categories[category].total++;

    if (result.isValid) {
      results.workingEndpoints++;
      results.categories[category].working++;
    } else {
      results.brokenEndpoints++;
    }

    // Progress indicator
    const status = result.isValid ? '✅' : '❌';
    console.log(`${status} ${endpoint} - ${result.message}`);
  }

  generateReport();
  return results;
}

/**
 * Test specific endpoint categories
 */
async function testCategory(category) {
  console.log(`🎯 Testing ${category} endpoints...`);

  const endpoints = findApiEndpoints(API_DIR).filter(ep => categorizeEndpoint(ep) === category);

  if (endpoints.length === 0) {
    console.log(`No endpoints found in category: ${category}`);
    return;
  }

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint, 'GET');
    const status = result.isValid ? '✅' : '❌';
    console.log(`${status} ${endpoint} - ${result.message}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Test all endpoints
    await testAllEndpoints();
  } else if (args[0] === '--category' && args[1]) {
    // Test specific category
    await testCategory(args[1]);
  } else {
    console.log('Usage:');
    console.log('  node scripts/api-verification.js                    # Test all endpoints');
    console.log('  node scripts/api-verification.js --category forums  # Test specific category');
    console.log('');
    console.log('Available categories: forums, auth, wiki, library, projects, admin, users, etc.');
  }
}

// Export for testing
module.exports = { testEndpoint, findApiEndpoints, categorizeEndpoint };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
