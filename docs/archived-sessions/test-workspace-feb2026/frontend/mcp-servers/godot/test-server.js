#!/usr/bin/env node

/**
 * Simple test to verify MCP server can start and respond to basic requests
 * Tests: Database connectivity, server startup, tool execution
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up environment
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/veritable_games';

console.log('\n🧪 Testing Godot MCP Server (Phase 1)\n');
console.log('DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^@]+@/, ':***@'));
console.log('---\n');

// Start server
const serverProcess = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let output = '';
let startupComplete = false;
let testsPassed = 0;
let testsFailed = 0;

// Capture stderr (where MCP server logs)
serverProcess.stderr.on('data', data => {
  output += data.toString();
  console.error(data.toString());

  if (output.includes('Server running via stdio')) {
    startupComplete = true;
    console.log('\n✅ Server started successfully\n');
    testsPassed++;

    // Send JSON-RPC ping request
    console.log('📤 Sending JSON-RPC tools/list request...\n');
    const pingRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };

    serverProcess.stdin.write(JSON.stringify(pingRequest) + '\n');
  }
});

// Handle stdout (JSON-RPC responses)
let responseBuffer = '';
serverProcess.stdout.on('data', data => {
  responseBuffer += data.toString();

  // Try to parse complete JSON responses
  const lines = responseBuffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const response = JSON.parse(line);
        console.log('📥 Received response:');
        console.log(JSON.stringify(response, null, 2));

        if (response.result && response.result.tools) {
          console.log('\n✅ Tools listed successfully');
          console.log(
            `   Found ${response.result.tools.length} tools: ${response.result.tools.map(t => t.name).join(', ')}\n`
          );
          testsPassed++;

          // Test basic tool
          console.log('📤 Testing tool execution: ping\n');
          const toolRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'ping',
              arguments: { message: 'Hello MCP' },
            },
          };

          serverProcess.stdin.write(JSON.stringify(toolRequest) + '\n');
        } else if (response.result && response.result.content) {
          console.log('✅ Tool executed successfully');
          const content = response.result.content[0];
          console.log(`   Response: ${content.text}\n`);
          testsPassed++;

          // Test resources
          console.log('📤 Testing resources/list\n');
          const resourcesRequest = {
            jsonrpc: '2.0',
            id: 3,
            method: 'resources/list',
            params: {},
          };

          serverProcess.stdin.write(JSON.stringify(resourcesRequest) + '\n');
        } else if (response.result && response.result.resources) {
          console.log('✅ Resources listed successfully');
          console.log(`   Found ${response.result.resources.length} resources:`);
          response.result.resources.forEach(r => {
            console.log(`   - ${r.uri}: ${r.description}`);
          });
          console.log('');
          testsPassed++;

          // Schedule shutdown
          setTimeout(() => {
            console.log('🛑 Shutting down server...\n');
            serverProcess.kill();
          }, 1000);
        }
      } catch (e) {
        // Not a complete JSON response yet
      }
    }
  }

  // Keep last incomplete line
  responseBuffer = lines[lines.length - 1];
});

// Handle errors
serverProcess.on('error', error => {
  console.error('❌ Server error:', error);
  testsFailed++;
});

serverProcess.on('close', code => {
  console.log(`\n📊 Test Summary`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Exit code: ${code}\n`);

  if (testsFailed === 0) {
    console.log('✨ All Phase 1 tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed\n');
    process.exit(1);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n❌ Test timeout - server did not respond\n');
  serverProcess.kill();
  process.exit(1);
}, 30000);
