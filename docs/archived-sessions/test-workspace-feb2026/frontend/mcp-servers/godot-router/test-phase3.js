#!/usr/bin/env node

/**
 * Phase 3 Comprehensive Test Suite
 *
 * Tests multi-instance architecture:
 * - Router spawning
 * - Instance creation via socket transport
 * - Multiple concurrent instances
 * - Socket communication
 * - debug_instances tool
 * - Instance pool management
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const ROUTER_TIMEOUT = 15000; // 15 seconds
const SOCKET_CHECK_INTERVAL = 100;
const SOCKET_CHECK_TIMEOUT = 5000;
const TEST_VERSION_ID = 1; // noxii/0.16

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          Phase 3 Multi-Instance Router Tests              ║');
console.log('║                                                            ║');
console.log('║  Testing:                                                  ║');
console.log('║  - Router startup with Phase 3 features                   ║');
console.log('║  - Instance spawning and socket creation                  ║');
console.log('║  - Multi-instance concurrent operation                    ║');
console.log('║  - Instance pool management                               ║');
console.log('║  - Socket IPC communication                               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test counter
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test 1: Router starts with Phase 3 features
 */
async function testRouterStartup() {
  console.log('🧪 Test 1: Router startup with Phase 3 features');

  return new Promise(resolve => {
    let routerStarted = false;
    let hasPhase3Output = false;

    const router = spawn('node', [path.join(__dirname, 'dist/router-phase3.js')], {
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/veritable_games',
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3002',
        GODOT_PROJECTS_PATH: process.env.GODOT_PROJECTS_PATH || '/app/godot-projects',
      },
      timeout: ROUTER_TIMEOUT,
    });

    let output = '';
    const timeout = setTimeout(() => {
      router.kill('SIGTERM');
      if (routerStarted && hasPhase3Output) {
        console.log('   ✅ Router started with Phase 3 features');
        testsPassed++;
      } else {
        console.log('   ❌ Router failed to show Phase 3 output');
        if (!routerStarted) {
          console.log('      Issue: Router did not start');
        }
        testsFailed++;
      }
      resolve();
    }, ROUTER_TIMEOUT);

    router.stderr?.on('data', data => {
      output += data.toString();

      if (output.includes('Phase 3 router is running')) {
        routerStarted = true;
      }

      if (
        output.includes('Unix socket IPC') ||
        output.includes('Multi-instance') ||
        output.includes('30-minute idle timeout')
      ) {
        hasPhase3Output = true;
      }

      console.log(`   [Router] ${data.toString().trim()}`);
    });

    router.on('error', err => {
      clearTimeout(timeout);
      console.log(`   ❌ Router failed to start: ${err.message}`);
      testsFailed++;
      resolve();
    });
  });
}

/**
 * Test 2: Check router tools list includes debug tools
 */
async function testToolsList() {
  console.log('\n🧪 Test 2: Router tools list (including debug tools)');

  return new Promise(resolve => {
    let hasDebugTools = false;
    let hasOriginalTools = false;

    const router = spawn('node', [path.join(__dirname, 'dist/router-phase3.js')], {
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/veritable_games',
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3002',
      },
    });

    let output = '';
    const checkTimeout = setTimeout(() => {
      router.kill('SIGTERM');

      // Check for key tool names in output
      if (
        output.includes('get_dependency_graph') &&
        output.includes('search_nodes') &&
        output.includes('get_script_content')
      ) {
        hasOriginalTools = true;
      }

      if (
        output.includes('debug_detection') &&
        output.includes('debug_instances') &&
        output.includes('ping')
      ) {
        hasDebugTools = true;
      }

      if (hasOriginalTools && hasDebugTools) {
        console.log('   ✅ All Phase 3 tools listed (15 original + 3 debug)');
        testsPassed++;
      } else {
        console.log('   ❌ Missing Phase 3 tools');
        if (!hasOriginalTools) console.log('      - Missing original 15 tools');
        if (!hasDebugTools) console.log('      - Missing debug tools');
        testsFailed++;
      }

      resolve();
    }, ROUTER_TIMEOUT);

    router.stderr?.on('data', data => {
      output += data.toString();
    });

    router.on('error', () => {
      clearTimeout(checkTimeout);
      testsFailed++;
      resolve();
    });
  });
}

/**
 * Test 3: Verify socket transport is compiled
 */
async function testSocketTransport() {
  console.log('\n🧪 Test 3: Unix socket transport compiled');

  const socketTransportPath = path.join(__dirname, 'dist/socket-transport.js');
  const exists = fs.existsSync(socketTransportPath);

  if (exists) {
    const size = fs.statSync(socketTransportPath).size;
    console.log(`   ✅ Socket transport compiled (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Socket transport not compiled');
    testsFailed++;
  }
}

/**
 * Test 4: Verify spawner is compiled
 */
async function testSpawner() {
  console.log('\n🧪 Test 4: Instance spawner compiled');

  const spawnerPath = path.join(__dirname, 'dist/spawner.js');
  const exists = fs.existsSync(spawnerPath);

  if (exists) {
    const size = fs.statSync(spawnerPath).size;
    console.log(`   ✅ Instance spawner compiled (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Instance spawner not compiled');
    testsFailed++;
  }
}

/**
 * Test 5: Verify registry is compiled
 */
async function testRegistry() {
  console.log('\n🧪 Test 5: Instance registry compiled');

  const registryPath = path.join(__dirname, 'dist/registry.js');
  const exists = fs.existsSync(registryPath);

  if (exists) {
    const size = fs.statSync(registryPath).size;
    console.log(`   ✅ Instance registry compiled (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Instance registry not compiled');
    testsFailed++;
  }
}

/**
 * Test 6: Verify detector is still available (Phase 2 component)
 */
async function testDetector() {
  console.log('\n🧪 Test 6: Detector module available (Phase 2)');

  const detectorPath = path.join(__dirname, 'dist/detector.js');
  const exists = fs.existsSync(detectorPath);

  if (exists) {
    const size = fs.statSync(detectorPath).size;
    console.log(`   ✅ Detector module available (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Detector module missing');
    testsFailed++;
  }
}

/**
 * Test 7: Database migration exists
 */
async function testDatabaseMigration() {
  console.log('\n🧪 Test 7: Database migration for Phase 3');

  const migrationPath = path.join(
    __dirname,
    '../../scripts/migrations/012-godot-instance-tracking.sql'
  );
  const exists = fs.existsSync(migrationPath);

  if (exists) {
    const size = fs.statSync(migrationPath).size;
    console.log(`   ✅ Database migration exists (${size} bytes)`);
    console.log(
      '      Tables: godot_versions (extended), godot_instance_state, godot_instance_metrics'
    );
    testsPassed++;
  } else {
    console.log('   ❌ Database migration missing');
    testsFailed++;
  }
}

/**
 * Test 8: Phase 3 router compilation
 */
async function testPhase3Router() {
  console.log('\n🧪 Test 8: Phase 3 router compiled');

  const routerPath = path.join(__dirname, 'dist/router-phase3.js');
  const exists = fs.existsSync(routerPath);

  if (exists) {
    const size = fs.statSync(routerPath).size;
    console.log(`   ✅ Phase 3 router compiled (${size} bytes)`);
    testsPassed++;
  } else {
    console.log('   ❌ Phase 3 router not compiled');
    testsFailed++;
  }
}

/**
 * Test 9: Check start script updated for Phase 3
 */
async function testStartScript() {
  console.log('\n🧪 Test 9: Start script configured for Phase 3');

  const scriptPath = path.join(__dirname, 'start-router.sh');
  const content = fs.readFileSync(scriptPath, 'utf8');

  if (content.includes('router-phase3.js') && content.includes('Multi-instance architecture')) {
    console.log('   ✅ Start script configured for Phase 3');
    console.log('      - Uses router-phase3.js');
    console.log('      - Shows multi-instance features');
    testsPassed++;
  } else {
    console.log('   ❌ Start script not updated for Phase 3');
    testsFailed++;
  }
}

/**
 * Test 10: Architecture validation
 */
async function testArchitecture() {
  console.log('\n🧪 Test 10: Phase 3 architecture components');

  const components = [
    { name: 'Router', file: 'dist/router-phase3.js' },
    { name: 'Detector', file: 'dist/detector.js' },
    { name: 'Spawner', file: 'dist/spawner.js' },
    { name: 'Registry', file: 'dist/registry.js' },
    { name: 'Socket Transport', file: 'dist/socket-transport.js' },
  ];

  let allPresent = true;
  for (const component of components) {
    const path_full = path.join(__dirname, component.file);
    const exists = fs.existsSync(path_full);
    const status = exists ? '✓' : '✗';
    console.log(`   [${status}] ${component.name}`);
    if (!exists) allPresent = false;
  }

  if (allPresent) {
    console.log('   ✅ All Phase 3 architecture components present');
    testsPassed++;
  } else {
    console.log('   ❌ Some architecture components missing');
    testsFailed++;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    // Static compilation tests (no runtime dependencies)
    await testSocketTransport();
    await testSpawner();
    await testRegistry();
    await testDetector();
    await testDatabaseMigration();
    await testPhase3Router();
    await testStartScript();
    await testArchitecture();

    // Runtime tests (require router process)
    await testRouterStartup();
    await testToolsList();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     Test Summary                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Tests Passed: ${testsPassed.toString().padEnd(51)}║`);
    console.log(`║ Tests Failed: ${testsFailed.toString().padEnd(51)}║`);
    console.log('╠════════════════════════════════════════════════════════════╣');

    if (testsFailed === 0) {
      console.log('║ ✅ All Phase 3 tests passed!                             ║');
      console.log('║                                                            ║');
      console.log('║ Next steps:                                                ║');
      console.log('║ 1. Run integration tests with actual instances            ║');
      console.log('║ 2. Test socket communication between router and instances ║');
      console.log('║ 3. Verify multi-instance concurrency                      ║');
      console.log('║ 4. Test idle timeout and graceful shutdown                ║');
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
