#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('[Test] Phase 2 Router - Backward Compatibility\n');

const router = spawn('node', ['dist/router-phase2.js'], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let testsPassed = 0;

router.stdout.on('data', data => {
  const output = data.toString();

  try {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('"jsonrpc"') && line.includes('"result"')) {
        const response = JSON.parse(line);
        if (response.result?.tools) {
          console.log(`[Test] ✅ Received tool list: ${response.result.tools.length} tools`);
          testsPassed++;
        }
      }
    }
  } catch (e) {}
});

router.stderr.on('data', data => {
  const msg = data.toString().trim();
  if (msg.includes('Phase 2 router')) console.log('[Router]', msg);
});

router.on('exit', () => {
  if (testsPassed > 0) {
    console.log('[Test] ✅ Phase 2 Router Test PASSED');
    process.exit(0);
  } else {
    console.log('[Test] ❌ Phase 2 Router Test FAILED');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('[Test] Sending tools/list request...');
  router.stdin.write('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n');
}, 1500);

setTimeout(() => {
  router.kill();
}, 12000);
