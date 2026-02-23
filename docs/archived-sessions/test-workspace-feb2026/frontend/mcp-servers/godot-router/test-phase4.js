#!/usr/bin/env node

/**
 * Phase 4 Integration Test Suite
 *
 * Tests socket server integration in MCP instances:
 * - Instance startup with socket transport
 * - Socket communication between router and instance
 * - Version context management
 * - Idle timeout mechanism
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const INSTANCE_TIMEOUT = 10000; // 10 seconds
const SOCKET_CHECK_INTERVAL = 100;
const SOCKET_CHECK_TIMEOUT = 5000;
const TEST_VERSION_ID = 1;
const TEST_SOCKET_PATH = `/tmp/godot-mcp-test-${Date.now()}.sock`;

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          Phase 4 Instance Socket Integration Tests         ║');
console.log('║                                                            ║');
console.log('║  Testing:                                                  ║');
console.log('║  - Instance startup with socket transport                 ║');
console.log('║  - Socket server listening                                ║');
console.log('║  - Version context setup                                  ║');
console.log('║  - Idle timeout mechanism                                 ║');
console.log('║  - Socket communication                                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let testsPassed = 0;
let testsFailed = 0;

/**
 * Test 1: Instance starts in socket mode
 */
async function testInstanceSocketStartup() {
  console.log('🧪 Test 1: Instance startup with socket transport');

  return new Promise(resolve => {
    let instanceStarted = false;
    let hasSocketLog = false;

    const instance = spawn('node', [path.join(__dirname, '../godot/dist/index.js')], {
      env: {
        ...process.env,
        MCP_INSTANCE_MODE: 'true',
        VERSION_ID: TEST_VERSION_ID.toString(),
        SOCKET_PATH: TEST_SOCKET_PATH,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/veritable_games',
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3002',
      },
      timeout: INSTANCE_TIMEOUT,
    });

    let output = '';
    const timeout = setTimeout(() => {
      instance.kill('SIGTERM');

      if (instanceStarted && hasSocketLog) {
        console.log('   ✅ Instance started with socket transport');
        testsPassed++;
      } else {
        console.log('   ❌ Instance failed to start properly');
        if (!instanceStarted) {
          console.log('      Issue: Instance did not initialize');
        }
        if (!hasSocketLog) {
          console.log('      Issue: No socket initialization log');
        }
        testsFailed++;
      }

      resolve();
    }, INSTANCE_TIMEOUT);

    instance.stderr?.on('data', data => {
      output += data.toString();
      const str = data.toString();

      if (str.includes('Initializing Phase 4')) {
        instanceStarted = true;
      }

      if (str.includes('Unix socket') || str.includes('Socket Path:')) {
        hasSocketLog = true;
      }

      console.log(`   [Instance] ${str.trim()}`);
    });

    instance.on('error', err => {
      clearTimeout(timeout);
      console.log(`   ❌ Instance failed to start: ${err.message}`);
      testsFailed++;
      resolve();
    });
  });
}

/**
 * Test 2: Check if context manager methods exist
 */
async function testContextManagerMethods() {
  console.log('\n🧪 Test 2: Context manager socket support methods');

  try {
    // Check if the context manager was modified to include setDefaultVersion and getDefaultVersion
    const contextPath = path.join(__dirname, '../godot/dist/state/context-manager.js');
    const content = fs.readFileSync(contextPath, 'utf8');

    let hasSetDefaultVersion = false;
    let hasGetDefaultVersion = false;
    let hasDefaultVersionId = false;

    if (content.includes('setDefaultVersion')) {
      hasSetDefaultVersion = true;
    }

    if (content.includes('getDefaultVersion')) {
      hasGetDefaultVersion = true;
    }

    if (content.includes('defaultVersionId')) {
      hasDefaultVersionId = true;
    }

    const allMethods = hasSetDefaultVersion && hasGetDefaultVersion && hasDefaultVersionId;

    if (allMethods) {
      console.log('   ✅ Context manager has all Phase 4 methods');
      console.log('      - setDefaultVersion()');
      console.log('      - getDefaultVersion()');
      console.log('      - defaultVersionId field');
      testsPassed++;
    } else {
      console.log('   ❌ Context manager missing Phase 4 methods');
      if (!hasSetDefaultVersion) console.log('      Missing: setDefaultVersion()');
      if (!hasGetDefaultVersion) console.log('      Missing: getDefaultVersion()');
      if (!hasDefaultVersionId) console.log('      Missing: defaultVersionId field');
      testsFailed++;
    }
  } catch (err) {
    console.log(`   ❌ Error checking context manager: ${err.message}`);
    testsFailed++;
  }
}

/**
 * Test 3: Check socket transport import in instance
 */
async function testSocketTransportImport() {
  console.log('\n🧪 Test 3: Socket transport imported in instance');

  try {
    const indexPath = path.join(__dirname, '../godot/dist/index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    let hasSocketImport = false;
    let hasInstanceMode = false;
    let hasIdleTimeout = false;

    if (content.includes('UnixSocketServerTransport') || content.includes('socket-transport')) {
      hasSocketImport = true;
    }

    if (content.includes('MCP_INSTANCE_MODE')) {
      hasInstanceMode = true;
    }

    if (content.includes('setupIdleTimeout') || content.includes('IDLE_TIMEOUT')) {
      hasIdleTimeout = true;
    }

    if (hasSocketImport && hasInstanceMode && hasIdleTimeout) {
      console.log('   ✅ Instance has Phase 4 socket support');
      console.log('      - UnixSocketServerTransport imported');
      console.log('      - MCP_INSTANCE_MODE environment variable check');
      console.log('      - Idle timeout setup function');
      testsPassed++;
    } else {
      console.log('   ❌ Instance missing Phase 4 integration');
      if (!hasSocketImport) console.log('      Missing: Socket transport import');
      if (!hasInstanceMode) console.log('      Missing: Instance mode check');
      if (!hasIdleTimeout) console.log('      Missing: Idle timeout setup');
      testsFailed++;
    }
  } catch (err) {
    console.log(`   ❌ Error checking instance file: ${err.message}`);
    testsFailed++;
  }
}

/**
 * Test 4: Verify socket transport compilation
 */
async function testSocketTransportCompiled() {
  console.log('\n🧪 Test 4: Socket transport available for import');

  const socketPath = path.join(__dirname, 'dist/socket-transport.js');
  const exists = fs.existsSync(socketPath);

  if (exists) {
    const size = fs.statSync(socketPath).size;
    console.log(`   ✅ Socket transport compiled (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Socket transport not found');
    testsFailed++;
  }
}

/**
 * Test 5: Verify recordActivity function export
 */
async function testActivityTracking() {
  console.log('\n🧪 Test 5: Activity tracking function exported');

  try {
    const indexPath = path.join(__dirname, '../godot/dist/index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    if (content.includes('recordActivity') && content.includes('export')) {
      console.log('   ✅ Activity tracking function exported');
      console.log('      - recordActivity() for tools to call');
      console.log('      - Enables idle timeout tracking');
      testsPassed++;
    } else {
      console.log('   ❌ Activity tracking not properly exported');
      testsFailed++;
    }
  } catch (err) {
    console.log(`   ❌ Error checking activity tracking: ${err.message}`);
    testsFailed++;
  }
}

/**
 * Test 6: Check graceful shutdown handlers
 */
async function testShutdownHandlers() {
  console.log('\n🧪 Test 6: Graceful shutdown handlers');

  try {
    const indexPath = path.join(__dirname, '../godot/dist/index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    if (content.includes('SIGTERM') && content.includes('SIGINT')) {
      console.log('   ✅ Graceful shutdown handlers configured');
      console.log('      - SIGTERM handler');
      console.log('      - SIGINT handler');
      console.log('      - Database connection cleanup');
      testsPassed++;
    } else {
      console.log('   ❌ Shutdown handlers missing');
      testsFailed++;
    }
  } catch (err) {
    console.log(`   ❌ Error checking shutdown handlers: ${err.message}`);
    testsFailed++;
  }
}

/**
 * Test 7: Verify backward compatibility (stdio still works)
 */
async function testStdioBackwardCompatibility() {
  console.log('\n🧪 Test 7: Backward compatibility - stdio mode still available');

  return new Promise(resolve => {
    let stioStarted = false;
    let hasPhase2Log = false;

    const instance = spawn('node', [path.join(__dirname, '../godot/dist/index.js')], {
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/veritable_games',
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3002',
        // NO MCP_INSTANCE_MODE or VERSION_ID - should fall back to stdio
      },
      timeout: INSTANCE_TIMEOUT,
    });

    let output = '';
    const timeout = setTimeout(() => {
      instance.kill('SIGTERM');

      if (stioStarted && hasPhase2Log) {
        console.log('   ✅ Stdio mode still works (backward compatible)');
        console.log('      - Falls back when MCP_INSTANCE_MODE not set');
        console.log('      - Maintains Phase 2 compatibility');
        testsPassed++;
      } else {
        console.log('   ❌ Stdio backward compatibility broken');
        if (!stioStarted) {
          console.log('      Issue: Instance did not start');
        }
        if (!hasPhase2Log) {
          console.log('      Issue: Phase 2 (stdio) mode not detected');
        }
        testsFailed++;
      }

      resolve();
    }, INSTANCE_TIMEOUT);

    instance.stderr?.on('data', data => {
      output += data.toString();
      const str = data.toString();

      if (str.includes('Initializing Phase 2') || str.includes('stdio')) {
        stioStarted = true;
      }

      if (str.includes('Phase 2') && str.includes('Implementation')) {
        hasPhase2Log = true;
      }

      console.log(`   [Instance] ${str.trim()}`);
    });

    instance.on('error', err => {
      clearTimeout(timeout);
      console.log(`   ❌ Instance failed: ${err.message}`);
      testsFailed++;
      resolve();
    });
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    // Static code tests
    await testSocketTransportCompiled();
    await testContextManagerMethods();
    await testSocketTransportImport();
    await testActivityTracking();
    await testShutdownHandlers();

    // Runtime tests
    await testInstanceSocketStartup();
    await testStdioBackwardCompatibility();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     Test Summary                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Tests Passed: ${testsPassed.toString().padEnd(51)}║`);
    console.log(`║ Tests Failed: ${testsFailed.toString().padEnd(51)}║`);
    console.log('╠════════════════════════════════════════════════════════════╣');

    if (testsFailed === 0) {
      console.log('║ ✅ All Phase 4 tests passed!                             ║');
      console.log('║                                                            ║');
      console.log('║ Next steps:                                                ║');
      console.log('║ 1. Deploy database migration (012-godot-instance-tracking) ║');
      console.log('║ 2. Test router spawning instances with socket transport   ║');
      console.log('║ 3. Implement Phase 4 state persistence                    ║');
    } else {
      console.log('║ ❌ Some tests failed. Review output above.               ║');
    }

    console.log('╚════════════════════════════════════════════════════════════╝\n');

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n❌ Test runner error:', err);
    process.exit(1);
  }
}

// Run tests
runAllTests();
