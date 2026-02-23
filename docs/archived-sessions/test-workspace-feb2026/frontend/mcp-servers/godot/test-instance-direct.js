#!/usr/bin/env node

/**
 * Direct Instance Server Test
 * Tests that the instance server itself works with stdio
 */

import { spawn } from 'child_process';

console.log('[Test] Starting direct instance server test...\n');

const instance = spawn('node', ['dist/index.js'], {
  env: {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let responseReceived = false;

instance.stdout.on('data', data => {
  const output = data.toString();
  console.log('[Instance Response]', output);
  if (output.includes('"tools"') || output.includes('"result"')) {
    responseReceived = true;
  }
});

instance.stderr.on('data', data => {
  console.error('[Instance Log]', data.toString());
});

instance.on('exit', code => {
  console.log('\n[Test] Instance exited with code', code);
  if (responseReceived) {
    console.log('[Test] ✅ Instance test PASSED - received response');
  } else {
    console.log('[Test] ❌ Instance test FAILED - no response received');
  }
});

// Send a test request
setTimeout(() => {
  console.log('[Test] Sending request: tools/list\n');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  };
  instance.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

// Exit after 10 seconds
setTimeout(() => {
  console.log('\n[Test] Timeout - exiting');
  instance.kill();
}, 10000);
