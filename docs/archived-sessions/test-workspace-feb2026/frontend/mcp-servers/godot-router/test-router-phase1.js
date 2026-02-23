#!/usr/bin/env node

/**
 * Phase 1 Router Test
 * Tests basic pass-through routing without auto-detection
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[Test] Starting Phase 1 Router Test...');
console.log('[Test] This test verifies that:');
console.log('  1. Router can start successfully');
console.log('  2. Router can spawn instance server');
console.log('  3. Router can forward tools/list requests');
console.log('  4. Router returns proper responses\n');

// Start the router (using router-simple.js for Phase 1)
const router = spawn('node', [path.join(__dirname, 'dist/router-simple.js')], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdoutBuffer = '';
let stderrBuffer = '';
let testComplete = false;

// Capture stdout from router
router.stdout.on('data', data => {
  const output = data.toString();
  stdoutBuffer += output;
  console.error(`[Router Stdout] ${output.substring(0, 100)}...`);

  // Look for the response to our test request (NDJSON format - newline delimited)
  const lines = stdoutBuffer.split('\n');
  for (const line of lines) {
    if (line.trim() && line.includes('"jsonrpc"')) {
      try {
        const response = JSON.parse(line);
        if (response.id === 1 && response.result && response.result.tools) {
          console.log('[Test] ✅ SUCCESS: Router returned tools list!');
          console.log(`[Test] Tools count: ${response.result.tools.length}`);
          testComplete = true;
          router.kill();
        }
      } catch (e) {
        console.error('[Test] Failed to parse response:', e, line.substring(0, 100));
      }
    }
  }
});

// Capture stderr from router
router.stderr.on('data', data => {
  const output = data.toString();
  stderrBuffer += output;
  console.error(`[Router Log] ${output}`);
});

// Handle router exit
router.on('exit', (code, signal) => {
  console.log(`[Test] Router exited with code ${code}, signal ${signal}`);

  if (testComplete) {
    console.log('\n[Test] ✅ Phase 1 Router Test PASSED');
    process.exit(0);
  } else {
    console.log('\n[Test] ❌ Phase 1 Router Test FAILED');
    console.log(`[Test] Stdout buffer: ${stdoutBuffer}`);
    console.log(`[Test] Stderr buffer: ${stderrBuffer}`);
    process.exit(1);
  }
});

// Send a test request after a delay to let router initialize
setTimeout(() => {
  console.log('[Test] Sending test request: tools/list');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  };

  router.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

// Timeout after 15 seconds
setTimeout(() => {
  if (!testComplete) {
    console.log('[Test] ❌ Test timeout - no response received');
    router.kill();
    process.exit(1);
  }
}, 15000);
