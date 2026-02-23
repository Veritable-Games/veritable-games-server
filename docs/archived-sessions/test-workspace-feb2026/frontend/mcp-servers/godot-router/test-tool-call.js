#!/usr/bin/env node

/**
 * Phase 1 Router - Real Tool Call Test
 * Verifies that actual tools work through the router
 */

import { spawn } from 'child_process';

console.log('[Test] Phase 1 Router - Real Tool Call Test\n');
console.log('Testing: get_projects tool\n');

const router = spawn('node', ['dist/router-simple.js'], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let testPassed = false;

router.stdout.on('data', data => {
  const output = data.toString();
  console.log('[Router Response]:', output.substring(0, 200));

  try {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim() && line.includes('"jsonrpc"') && line.includes('"result"')) {
        const response = JSON.parse(line);
        if (response.id === 1 && response.result && response.result.content) {
          console.log('\n[Test] ✅ Tool call succeeded!');
          console.log(`[Test] Received response with content`);
          console.log(`[Test] Content: ${response.result.content[0].text.substring(0, 100)}...`);
          testPassed = true;
        }
      }
    }
  } catch (e) {
    // Parse error, ignore
  }
});

router.stderr.on('data', data => {
  console.error('[Router Log]:', data.toString().trim());
});

router.on('exit', code => {
  console.log('\n[Test] Router exited with code', code);
  if (testPassed) {
    console.log('[Test] ✅ Tool Call Test PASSED\n');
    process.exit(0);
  } else {
    console.log('[Test] ❌ Tool Call Test FAILED\n');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('[Test] Sending tool call: get_projects\n');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'get_projects',
      arguments: {},
    },
  };
  router.stdin.write(JSON.stringify(request) + '\n');
}, 1500);

setTimeout(() => {
  router.kill();
}, 12000);
