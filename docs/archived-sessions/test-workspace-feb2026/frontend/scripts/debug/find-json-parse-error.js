#!/usr/bin/env node

/**
 * Find JSON Parse Error - Browser Simulation
 *
 * This simulates what happens when the browser loads the auth/login page
 * and traces which API call is causing the JSON.parse error.
 */

const http = require('http');

const PORTS = [3000, 3001];
let activePort = null;

// Find active port
async function findActivePort() {
  for (const port of PORTS) {
    try {
      await testPort(port);
      activePort = port;
      console.log(`✅ Found active server on port ${port}\n`);
      return port;
    } catch (error) {
      // Port not available, try next
    }
  }
  throw new Error('No active server found on ports 3000 or 3001');
}

function testPort(port) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: port,
        path: '/api/health',
        method: 'GET',
        timeout: 1000,
      },
      res => {
        resolve(port);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise(resolve => {
    const options = {
      hostname: 'localhost',
      port: activePort,
      path: path,
      method: method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/128.0',
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          path,
          method,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          body: data,
          headers: res.headers,
        });
      });
    });

    req.on('error', error => {
      resolve({ path, method, error: error.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, method, error: 'Timeout' });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function analyzeResponse(result) {
  const { path, method, statusCode, contentType, body, error } = result;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📍 ${method} ${path}`);
  console.log(`${'─'.repeat(70)}`);

  if (error) {
    console.log(`❌ ERROR: ${error}`);
    return { hasIssue: true, type: 'network_error', detail: error };
  }

  console.log(`   Status: ${statusCode}`);
  console.log(`   Content-Type: ${contentType || 'NOT SET'}`);
  console.log(`   Response Length: ${body.length} bytes`);

  // Check for empty response
  if (!body || body.trim().length === 0) {
    console.log(`   ❌ EMPTY RESPONSE - This will cause JSON.parse error!`);
    return { hasIssue: true, type: 'empty_response' };
  }

  // Check for HTML response
  const trimmed = body.trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<!doctype')
  ) {
    console.log(`   ❌ HTML RESPONSE - This will cause JSON.parse error!`);
    console.log(`\n   First 300 characters:`);
    console.log(`   ${trimmed.substring(0, 300).replace(/\n/g, '\n   ')}`);
    return { hasIssue: true, type: 'html_response', detail: trimmed.substring(0, 500) };
  }

  // Try to parse JSON
  try {
    const parsed = JSON.parse(body);
    console.log(`   ✅ Valid JSON`);

    if (parsed.success === false) {
      console.log(`   ⚠️  API returned error: ${parsed.error || 'Unknown error'}`);
    }

    // Show structure
    const preview = JSON.stringify(parsed).substring(0, 150);
    console.log(`   Response: ${preview}${preview.length >= 150 ? '...' : ''}`);

    return { hasIssue: false, parsed };
  } catch (parseError) {
    console.log(`   ❌ INVALID JSON - This is the JSON.parse error!`);
    console.log(`   Parse Error: ${parseError.message}`);
    console.log(`\n   First character: '${trimmed[0]}' (code: ${trimmed.charCodeAt(0)})`);
    console.log(`   First 300 characters:`);
    console.log(`   ${trimmed.substring(0, 300).replace(/\n/g, '\n   ')}`);

    return {
      hasIssue: true,
      type: 'invalid_json',
      detail: parseError.message,
      body: trimmed.substring(0, 500),
    };
  }
}

async function runTrace() {
  console.log('🔍 JSON Parse Error Tracer - Browser Simulation\n');

  try {
    await findActivePort();
  } catch (error) {
    console.error('❌', error.message);
    console.log('\n📋 Start the dev server first:');
    console.log('   npm run dev');
    process.exit(1);
  }

  console.log('🌐 Simulating browser page load sequence...\n');

  // Simulate what happens when you visit /auth/login page
  const tests = [
    // Initial page load checks
    { path: '/api/auth/me', method: 'GET', desc: 'Check current user (LoginPage.tsx:25)' },
    { path: '/api/auth/session', method: 'GET', desc: 'Session validation' },

    // Login attempt simulation
    {
      path: '/api/auth/login',
      method: 'POST',
      body: { username: 'admin', password: 'test123' },
      desc: 'Login attempt (LoginForm.tsx:27)',
    },

    // Health check
    { path: '/api/health', method: 'GET', desc: 'Server health check' },
  ];

  const issues = [];

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.desc}`);
    const result = await makeRequest(test.path, test.method, test.body);
    const analysis = analyzeResponse(result);

    if (analysis.hasIssue) {
      issues.push({ ...test, ...result, ...analysis });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 TRACE SUMMARY');
  console.log(`${'='.repeat(70)}\n`);

  if (issues.length === 0) {
    console.log('✅ No JSON parse errors found in tested endpoints!');
    console.log('\n📋 The error may be:');
    console.log('   1. Coming from a different endpoint');
    console.log('   2. Only occurring under specific conditions');
    console.log('   3. Client-side code parsing something incorrectly');
    console.log('\n💡 Check browser DevTools:');
    console.log('   1. Open DevTools (F12)');
    console.log('   2. Go to Console tab');
    console.log('   3. Look for the error and expand the stack trace');
    console.log('   4. Go to Network tab');
    console.log('   5. Find the failed request (red)');
    console.log('   6. Check the Response tab');
  } else {
    console.log(`❌ Found ${issues.length} endpoint(s) with issues:\n`);

    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.method} ${issue.path}`);
      console.log(`   Issue: ${issue.type}`);

      if (issue.type === 'html_response') {
        console.log(`   🔧 FIX: This endpoint is returning HTML instead of JSON`);
        console.log(`   Likely cause: Error page or middleware redirect`);
      } else if (issue.type === 'empty_response') {
        console.log(`   🔧 FIX: This endpoint returns empty response`);
        console.log(`   Likely cause: Missing return statement or early exit`);
      } else if (issue.type === 'invalid_json') {
        console.log(`   🔧 FIX: Response is not valid JSON`);
        console.log(`   Detail: ${issue.detail}`);
      }

      console.log('');
    });

    console.log('📋 Recommended fixes:');
    console.log('   1. Add try-catch to all API routes');
    console.log('   2. Always return NextResponse.json() in catch blocks');
    console.log('   3. Check middleware for HTML redirects');
    console.log('   4. Verify withSecurity() wrapper is used correctly');
  }

  console.log('');
}

runTrace().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
