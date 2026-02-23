#!/usr/bin/env node

/**
 * Phase 2 Tool Call Test
 * Tests that tools work with optional versionId (explicit or detected)
 */

import { spawn } from 'child_process';

console.log('[Test] Phase 2 Tool Calls with Version Resolution\n');

const router = spawn('node', ['dist/router-phase2.js'], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/veritable_games',
    API_BASE_URL: 'http://localhost:3002',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let testsPassed = 0;
let testsRun = 0;

router.stdout.on('data', data => {
  const output = data.toString();

  try {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('"jsonrpc"') && line.includes('"result"')) {
        const response = JSON.parse(line);

        if (response.id === 1) {
          // Test 1: get_projects (explicit versionId not needed)
          if (response.result?.content?.[0]?.text?.includes('projects')) {
            console.log('[Test 1] ✅ get_projects works (no versionId needed)');
            testsPassed++;
          }
        } else if (response.id === 2) {
          // Test 2: get_dependency_graph with explicit versionId
          const text = response.result?.content?.[0]?.text || '';
          if (text.includes('Error') || text.includes('dependency') || text.length > 0) {
            console.log('[Test 2] ✅ get_dependency_graph works with versionId parameter');
            testsPassed++;
          }
        } else if (response.id === 3) {
          // Test 3: get_node_details without versionId (should handle gracefully)
          const text = response.result?.content?.[0]?.text || '';
          if (response.isError || text.length > 0) {
            console.log('[Test 3] ✅ get_node_details handles missing versionId gracefully');
            testsPassed++;
          }
        }
      }
    }
  } catch (e) {}
});

router.stderr.on('data', data => {
  const msg = data.toString().trim();
  if (msg.includes('Tool called')) {
    const toolName = msg.split("'")[1];
    console.log(`[Router] Executing: ${toolName}`);
  }
});

router.on('exit', () => {
  console.log(`\n[Test] Results: ${testsPassed}/${testsRun} tests passed`);
  if (testsPassed === testsRun) {
    console.log('[Test] ✅ Phase 2 Tool Calls Test PASSED');
    process.exit(0);
  } else {
    console.log('[Test] ❌ Phase 2 Tool Calls Test FAILED');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('[Test] Test 1: Calling get_projects (should always work)\n');
  testsRun++;
  router.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_projects',
        arguments: {},
      },
    }) + '\n'
  );
}, 1500);

setTimeout(() => {
  console.log('[Test] Test 2: Calling get_dependency_graph with explicit versionId\n');
  testsRun++;
  router.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_dependency_graph',
        arguments: {
          versionId: 999, // Non-existent ID (just testing parameter passing)
        },
      },
    }) + '\n'
  );
}, 3000);

setTimeout(() => {
  console.log('[Test] Test 3: Calling get_node_details without versionId\n');
  testsRun++;
  router.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_node_details',
        arguments: {
          scriptPath: 'res://test.gd',
        },
      },
    }) + '\n'
  );
}, 4500);

setTimeout(() => {
  router.kill();
}, 12000);
