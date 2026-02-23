#!/usr/bin/env node

/**
 * Simple Phase 1 Router Test
 * Tests direct request forwarding
 */

import { spawn } from 'child_process';

console.log('[Test] Simple Phase 1 Router Test...\n');

const router = spawn('node', ['dist/router-simple.js'], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
});

let received = false;

router.stdout.on('data', data => {
  const output = data.toString();
  console.log('[Router Response]:', output.substring(0, 200));
  if (output.includes('"tools"') || output.includes('"result"')) {
    received = true;
  }
});

router.stderr.on('data', data => {
  console.error('[Log]:', data.toString().trim());
});

router.on('exit', code => {
  console.log('\n[Test] Router exited:', code);
  if (received) {
    console.log('[Test] ✅ PASSED');
    process.exit(0);
  } else {
    console.log('[Test] ❌ FAILED');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('[Test] Sending: tools/list\n');
  router.stdin.write('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n');
}, 1500);

setTimeout(() => {
  console.log('\n[Test] Timeout');
  router.kill();
}, 10000);
