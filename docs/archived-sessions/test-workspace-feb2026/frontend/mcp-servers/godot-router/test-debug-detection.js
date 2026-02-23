#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('[Test] debug_detection Tool\n');

const testCases = [
  {
    pwd: process.cwd(),
    name: 'Current directory',
  },
];

const router = spawn('node', ['dist/router-phase2.js'], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
    PWD: testCases[0].pwd,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let responseReceived = false;

router.stdout.on('data', data => {
  const output = data.toString();

  try {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('"jsonrpc"') && line.includes('"result"')) {
        const response = JSON.parse(line);
        if (response.id === 1) {
          responseReceived = true;
          const text = response.result.content?.[0]?.text || '';
          console.log('[Debug Detection Response]:');
          console.log(text);
        }
      }
    }
  } catch (e) {}
});

router.stderr.on('data', data => {
  const msg = data.toString().trim();
  if (msg.includes('[Router]') && msg.includes('Tool called')) {
    console.log('[Router]', msg);
  }
});

router.on('exit', () => {
  if (responseReceived) {
    console.log('\n[Test] ✅ debug_detection Tool Test PASSED');
    process.exit(0);
  } else {
    console.log('\n[Test] ❌ debug_detection Tool Test FAILED');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log(`[Test] Testing with PWD: ${testCases[0].pwd}\n`);
  console.log('[Test] Calling debug_detection tool...\n');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'debug_detection',
      arguments: {},
    },
  };
  router.stdin.write(JSON.stringify(request) + '\n');
}, 1500);

setTimeout(() => {
  router.kill();
}, 12000);
