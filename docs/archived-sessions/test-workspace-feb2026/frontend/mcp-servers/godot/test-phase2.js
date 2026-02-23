#!/usr/bin/env node

/**
 * Test Phase 2: All tools and resources implementation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/veritable_games';

console.log('\n🧪 Testing Godot MCP Server - Phase 2\n');
console.log('DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^@]+@/, ':***@'));
console.log('---\n');

const serverProcess = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let testsPassed = 0;
let testsFailed = 0;
const results = [];

serverProcess.stderr.on('data', data => {
  const message = data.toString();
  console.error(message);

  if (message.includes('Phase 2 - Full Implementation')) {
    console.log('\n✅ Phase 2 server started successfully\n');
    testsPassed++;

    // Test 1: Tools/list
    console.log('📤 Requesting tools/list...\n');
    serverProcess.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }) + '\n'
    );
  }
});

let responseBuffer = '';
serverProcess.stdout.on('data', data => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const response = JSON.parse(line);

        if (response.result && response.result.tools) {
          const toolCount = response.result.tools.length;
          console.log(`📥 tools/list: ${toolCount} tools`);
          console.log('   Tools:', response.result.tools.map(t => t.name).join(', '));

          if (toolCount === 15) {
            console.log('\n✅ All 15 tools registered');
            testsPassed++;
          } else {
            console.log(`\n❌ Expected 15 tools, got ${toolCount}`);
            testsFailed++;
          }

          // Test 2: Resources/list
          console.log('\n📤 Requesting resources/list...\n');
          serverProcess.stdin.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'resources/list',
              params: {},
            }) + '\n'
          );
        } else if (response.result && response.result.resources) {
          const resourceCount = response.result.resources.length;
          console.log(`📥 resources/list: ${resourceCount} resources`);
          console.log('   Resources:', response.result.resources.map(r => r.uri).join(', '));

          if (resourceCount === 8) {
            console.log('\n✅ All 8 resources registered');
            testsPassed++;
          } else {
            console.log(`\n❌ Expected 8 resources, got ${resourceCount}`);
            testsFailed++;
          }

          // Test 3: Ping tool
          console.log('\n📤 Testing ping tool...\n');
          serverProcess.stdin.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              method: 'tools/call',
              params: {
                name: 'ping',
                arguments: { message: 'Phase 2 Ready' },
              },
            }) + '\n'
          );
        } else if (
          response.result &&
          response.result.content &&
          Array.isArray(response.result.content)
        ) {
          // Handle tool responses (content is always an array)
          const content = response.result.content[0]?.text;

          if (!content) {
            continue;
          }

          // Try to parse as JSON (for get_projects response)
          try {
            const jsonData = JSON.parse(content);
            if (jsonData.projects !== undefined) {
              // This is get_projects response
              console.log(`📥 Database query: ${jsonData.projects.length} projects found`);
              console.log('\n✅ Database connectivity working');
              testsPassed++;

              // Schedule shutdown
              setTimeout(() => {
                console.log('\n🛑 Shutting down server...\n');
                serverProcess.kill();
              }, 500);
              continue;
            }
          } catch (parseErr) {
            // Not JSON, treat as plain text response
          }

          // Handle plain text responses (like ping)
          if (content.includes('Pong:') || content.includes('Phase 2 Ready')) {
            console.log(`📥 Tool response: ${content}`);
            console.log('\n✅ Tool execution working');
            testsPassed++;

            // Test 4: Try to list projects
            console.log('\n📤 Testing get_projects tool...\n');
            serverProcess.stdin.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: 4,
                method: 'tools/call',
                params: {
                  name: 'get_projects',
                  arguments: {},
                },
              }) + '\n'
            );
          }
        }
      } catch (e) {
        // Not valid JSON yet
      }
    }
  }

  responseBuffer = lines[lines.length - 1];
});

serverProcess.on('close', code => {
  console.log(`\n📊 Phase 2 Test Summary`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Exit code: ${code}\n`);

  if (testsFailed === 0 && testsPassed >= 4) {
    console.log('✨ Phase 2 Implementation Successful!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed\n');
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('\n❌ Test timeout - server did not respond\n');
  serverProcess.kill();
  process.exit(1);
}, 30000);
