#!/usr/bin/env node

/**
 * Phase 2 Detection Test
 * Tests CWD-based version detection
 */

import { spawn } from 'child_process';

console.log('[Test] Phase 2 Detection Test\n');
console.log('Testing debug_detection tool with different working directories\n');

// Test detection with different PWD values
const testCases = [
  {
    name: 'Valid project directory',
    pwd: '/home/user/mnt/godot-projects/noxii/0.16/scripts',
    expectDetection: true,
  },
  {
    name: 'Valid project root',
    pwd: '/home/user/mnt/godot-projects/noxii/0.16',
    expectDetection: true,
  },
  {
    name: 'Project slug level',
    pwd: '/home/user/mnt/godot-projects/noxii',
    expectDetection: false, // Too shallow
  },
  {
    name: 'Outside project directory',
    pwd: '/home/user/Documents',
    expectDetection: false,
  },
];

let currentTestIndex = 0;
let passedTests = 0;
let failedTests = 0;

function runNextTest() {
  if (currentTestIndex >= testCases.length) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`Results: ✅ ${passedTests} passed, ❌ ${failedTests} failed`);
    process.exit(failedTests > 0 ? 1 : 0);
    return;
  }

  const testCase = testCases[currentTestIndex];
  currentTestIndex++;

  console.log(`\n[Test ${currentTestIndex}/${testCases.length}] ${testCase.name}`);
  console.log(`  PWD: ${testCase.pwd}`);
  console.log(`  Expected: ${testCase.expectDetection ? 'detection' : 'no detection'}`);

  const router = spawn('node', ['dist/router-phase2.js'], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
      API_BASE_URL: 'http://localhost:3002',
      PWD: testCase.pwd,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let responseReceived = false;
  let detectionSucceeded = false;

  router.stdout.on('data', data => {
    const output = data.toString();

    try {
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim() && line.includes('"jsonrpc"') && line.includes('"result"')) {
          const response = JSON.parse(line);
          if (response.id === 1) {
            responseReceived = true;
            const text = response.result.content[0]?.text || '';

            // Check if detection was successful
            const hasVersionId = text.includes('versionId=');
            const confidence =
              text.includes('Confidence: HIGH') || text.includes('Confidence: MEDIUM');

            if (hasVersionId && confidence) {
              detectionSucceeded = true;
            }
          }
        }
      }
    } catch (e) {
      // Parse error, ignore
    }
  });

  router.stderr.on('data', data => {
    const msg = data.toString().trim();
    if (msg.includes('[Router]')) {
      console.error(`  Log: ${msg}`);
    }
  });

  router.on('exit', () => {
    const success =
      (testCase.expectDetection && detectionSucceeded) ||
      (!testCase.expectDetection && !detectionSucceeded);

    if (success) {
      console.log(`  Result: ✅ PASSED`);
      passedTests++;
    } else {
      console.log(
        `  Result: ❌ FAILED (got ${detectionSucceeded}, expected ${testCase.expectDetection})`
      );
      failedTests++;
    }

    setTimeout(runNextTest, 500);
  });

  // Send debug_detection request
  setTimeout(() => {
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

  // Timeout after 10 seconds
  setTimeout(() => {
    if (!responseReceived) {
      console.log(`  Result: ❌ TIMEOUT`);
      failedTests++;
      router.kill();
      setTimeout(runNextTest, 500);
    }
  }, 10000);
}

runNextTest();
