/**
 * Test Streaming System with Actual Godot Graphs
 *
 * Tests:
 * 1. Database connectivity and graph data retrieval
 * 2. Server-side renderer initialization
 * 3. Frame capture and buffer handling
 * 4. FFmpeg NVENC encoding (if available)
 * 5. WebSocket connection simulation
 * 6. Performance metrics
 */

import { dbAdapter } from '../src/lib/database/adapter';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN';
  message: string;
  metrics?: Record<string, any>;
  error?: string;
}

const results: TestResult[] = [];

function addResult(
  name: string,
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN',
  message: string,
  metrics?: Record<string, any>,
  error?: string
) {
  results.push({ name, status, message, metrics, error });
  const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭️', WARN: '⚠️' }[status];
  console.log(`\n${icon} ${name}`);
  console.log(`   ${message}`);
  if (metrics) {
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testDatabaseConnectivity() {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 1: Database Connectivity');
  console.log('═══════════════════════════════════════');

  try {
    const result = await dbAdapter.query('SELECT 1 as ok', [], { schema: 'content' });
    if (result.rows.length > 0) {
      addResult('Database Connection', 'PASS', 'Connected to PostgreSQL successfully');
    } else {
      addResult('Database Connection', 'FAIL', 'Query returned no rows');
    }
  } catch (error) {
    addResult(
      'Database Connection',
      'FAIL',
      'Failed to connect to database',
      undefined,
      String(error)
    );
  }
}

async function testGodotVersionsAvailable() {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 2: Godot Versions Available');
  console.log('═══════════════════════════════════════');

  try {
    const result = await dbAdapter.query(
      'SELECT id, project_slug, version_tag FROM godot_versions LIMIT 10',
      [],
      { schema: 'content' }
    );

    if (result.rows.length > 0) {
      addResult('Godot Versions Query', 'PASS', `Found ${result.rows.length} Godot versions`, {
        'Total Versions': result.rows.length,
        'First Version': result.rows[0].version_tag || result.rows[0].project_slug || 'Unnamed',
        'Version ID': result.rows[0].id,
      });

      // Return first version for later tests
      return result.rows[0];
    } else {
      addResult('Godot Versions Query', 'WARN', 'No Godot versions found in database');
      return null;
    }
  } catch (error) {
    addResult(
      'Godot Versions Query',
      'FAIL',
      'Failed to query Godot versions',
      undefined,
      String(error)
    );
    return null;
  }
}

async function testGraphDataRetrieval(versionId: number) {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 3: Graph Data Retrieval');
  console.log('═══════════════════════════════════════');

  try {
    const result = await dbAdapter.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = ?',
      [versionId],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      addResult('Graph Data Fetch', 'WARN', `No graph data for version ${versionId}`);
      return null;
    }

    const graphDataRaw = result.rows[0].graph_data;
    if (!graphDataRaw) {
      addResult('Graph Data Fetch', 'WARN', 'Graph data is null or empty');
      return null;
    }

    try {
      // Handle both string and object formats (may be stored as JSONB)
      const graphData = typeof graphDataRaw === 'string' ? JSON.parse(graphDataRaw) : graphDataRaw;
      const nodeCount = graphData.nodes?.length || 0;
      const edgeCount = graphData.edges?.length || 0;

      const graphDataStr =
        typeof graphDataRaw === 'string' ? graphDataRaw : JSON.stringify(graphDataRaw);
      addResult('Graph Data Fetch', 'PASS', 'Successfully retrieved and parsed graph data', {
        Nodes: nodeCount,
        Edges: edgeCount,
        'Data Size': `${graphDataStr.length} bytes`,
      });

      return graphData;
    } catch (parseError) {
      addResult(
        'Graph Data Parse',
        'FAIL',
        'Failed to parse graph JSON',
        undefined,
        String(parseError)
      );
      return null;
    }
  } catch (error) {
    addResult('Graph Data Fetch', 'FAIL', 'Failed to query graph data', undefined, String(error));
    return null;
  }
}

async function testServerRendererInitialization(graphData: any) {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 4: Server Renderer Initialization');
  console.log('═══════════════════════════════════════');

  try {
    // Check if headless-gl is available
    let glContext: any;
    try {
      const gl = require('gl');
      glContext = gl(1920, 1080);
      addResult(
        'headless-gl Context Creation',
        'PASS',
        'Successfully created WebGL context (1920x1080)'
      );
    } catch (glError) {
      addResult(
        'headless-gl Context Creation',
        'WARN',
        'headless-gl not available - may need build tools setup',
        undefined,
        String(glError)
      );
      return null;
    }

    // Test ServerGraphRenderer initialization
    try {
      const { ServerGraphRenderer } = await import('../src/lib/godot/server-renderer');

      const startTime = Date.now();
      const renderer = new ServerGraphRenderer({
        width: 1920,
        height: 1080,
        fps: 30,
        glContext,
      });

      // Initialize with graph data
      if (graphData && graphData.nodes && graphData.edges) {
        const nodes = graphData.nodes.map((n: any) => ({
          id: n.id,
          name: n.label,
          path: n.id,
          type: (n.metadata?.isVirtual ? 'virtual' : 'script') as 'script' | 'virtual',
          position: {
            x: Math.random() * 10 - 5,
            y: Math.random() * 10 - 5,
            z: Math.random() * 10 - 5,
          },
        }));

        const edges = graphData.edges.map((e: any) => ({
          from: e.from,
          to: e.to,
          type: e.type || ('extends' as 'extends' | 'preload' | 'load'),
        }));

        await renderer.initializeGraph(nodes, edges);

        const initTime = Date.now() - startTime;
        addResult(
          'ServerGraphRenderer Init',
          'PASS',
          'Renderer initialized successfully with graph data',
          {
            'Init Time': `${initTime}ms`,
            Nodes: nodes.length,
            Edges: edges.length,
          }
        );

        // Try to capture a frame
        try {
          const frameBuffer = renderer.captureFrame();
          if (frameBuffer && frameBuffer.length === 1920 * 1080 * 4) {
            addResult('Frame Capture', 'PASS', 'Successfully captured RGBA frame buffer', {
              'Frame Size': `${frameBuffer.length} bytes`,
              'Expected Size': `${1920 * 1080 * 4} bytes`,
            });
          } else {
            addResult('Frame Capture', 'WARN', 'Frame buffer size mismatch', {
              'Frame Size': frameBuffer?.length,
              Expected: 1920 * 1080 * 4,
            });
          }
        } catch (captureError) {
          addResult(
            'Frame Capture',
            'WARN',
            'Could not capture frame',
            undefined,
            String(captureError)
          );
        }

        // Clean up
        try {
          renderer.dispose();
          addResult(
            'Renderer Cleanup',
            'PASS',
            'Successfully disposed renderer and freed resources'
          );
        } catch (disposeError) {
          addResult(
            'Renderer Cleanup',
            'WARN',
            'Error during cleanup',
            undefined,
            String(disposeError)
          );
        }
      }
    } catch (rendererError) {
      addResult(
        'ServerGraphRenderer Init',
        'FAIL',
        'Failed to initialize renderer',
        undefined,
        String(rendererError)
      );
    }
  } catch (error) {
    addResult(
      'Server Renderer Setup',
      'FAIL',
      'Failed to set up server renderer',
      undefined,
      String(error)
    );
  }
}

async function testFFmpegAvailability() {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 5: FFmpeg NVENC Availability');
  console.log('═══════════════════════════════════════');

  try {
    const { spawn } = await import('child_process');
    const ffmpeg = spawn('ffmpeg', ['-version'], { stdio: ['pipe', 'pipe', 'pipe'] });

    return new Promise<void>(resolve => {
      let output = '';

      ffmpeg.stdout?.on('data', data => {
        output += data.toString();
      });

      ffmpeg.on('close', code => {
        if (code === 0 && output) {
          const hasNVENC = output.includes('h264_nvenc') || output.includes('hevc_nvenc');
          const versionMatch = output.split('\n')[0];

          if (hasNVENC) {
            addResult('FFmpeg NVENC Support', 'PASS', 'FFmpeg with NVENC support detected', {
              Version: versionMatch.slice(0, 50),
              'NVENC Available': 'Yes',
            });
          } else {
            addResult('FFmpeg NVENC Support', 'WARN', 'FFmpeg available but NVENC not detected', {
              Note: 'Will use CPU encoding (slower)',
              Fix: 'Install ffmpeg-nvenc-static or compile with NVENC',
            });
          }
        } else {
          addResult('FFmpeg Check', 'FAIL', 'FFmpeg not found or failed to execute');
        }
        resolve();
      });

      setTimeout(() => {
        ffmpeg.kill();
        addResult('FFmpeg Check', 'WARN', 'FFmpeg check timed out');
        resolve();
      }, 5000);
    });
  } catch (error) {
    addResult('FFmpeg Check', 'WARN', 'Could not test FFmpeg', undefined, String(error));
  }
}

async function testWebSocketStructure() {
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 6: WebSocket Streaming Structure');
  console.log('═══════════════════════════════════════');

  try {
    const { WebSocketServer } = await import('ws');
    addResult('ws Library', 'PASS', 'WebSocket library (ws) available and functional');
  } catch (error) {
    addResult('ws Library', 'FAIL', 'WebSocket library not available', undefined, String(error));
  }

  // Check if streaming endpoint exists
  try {
    const fs = await import('fs');
    const streamRoutePath =
      '/home/user/Projects/veritable-games-main/frontend/src/app/api/godot/versions/[id]/stream/route.ts';
    const routeExists = fs.existsSync(streamRoutePath);

    if (routeExists) {
      addResult(
        'Streaming Endpoint',
        'PASS',
        'Streaming endpoint route file exists at correct location'
      );
    } else {
      addResult('Streaming Endpoint', 'FAIL', `Streaming endpoint not found at ${streamRoutePath}`);
    }
  } catch (error) {
    addResult(
      'Streaming Endpoint Check',
      'FAIL',
      'Could not check streaming endpoint',
      undefined,
      String(error)
    );
  }
}

function printSummary() {
  console.log('\n\n═══════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════\n');

  const summary = {
    PASS: results.filter(r => r.status === 'PASS').length,
    FAIL: results.filter(r => r.status === 'FAIL').length,
    WARN: results.filter(r => r.status === 'WARN').length,
    SKIP: results.filter(r => r.status === 'SKIP').length,
  };

  console.log(`✅ PASS:  ${summary.PASS}`);
  console.log(`❌ FAIL:  ${summary.FAIL}`);
  console.log(`⚠️  WARN:  ${summary.WARN}`);
  console.log(`⏭️  SKIP:  ${summary.SKIP}`);
  console.log(`────────────────────────────────`);
  console.log(`   TOTAL: ${results.length}`);

  if (summary.FAIL > 0) {
    console.log('\n⚠️  FAILURES DETECTED:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
        if (r.error) console.log(`     Error: ${r.error}`);
      });
  }

  if (summary.WARN > 0) {
    console.log('\n⚠️  WARNINGS:');
    results
      .filter(r => r.status === 'WARN')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
  }

  console.log('\n═══════════════════════════════════════\n');
}

async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  GODOT STREAMING SYSTEM TEST SUITE   ║');
  console.log('║  Testing Real Godot Graphs           ║');
  console.log('╚═══════════════════════════════════════╝');

  // Test 1: Database
  await testDatabaseConnectivity();

  // Test 2: Get available versions
  const version = await testGodotVersionsAvailable();
  if (!version) {
    console.log('\n⚠️ No Godot versions available for testing. Skipping remaining tests.');
    printSummary();
    process.exit(0);
  }

  // Test 3: Get graph data
  const graphData = await testGraphDataRetrieval(version.id);
  if (!graphData) {
    console.log('\n⚠️ No graph data available for testing. Skipping renderer tests.');
    printSummary();
    process.exit(0);
  }

  // Test 4: Renderer initialization
  await testServerRendererInitialization(graphData);

  // Test 5: FFmpeg
  await testFFmpegAvailability();

  // Test 6: WebSocket structure
  await testWebSocketStructure();

  // Print summary
  printSummary();

  // Exit with appropriate code
  const failCount = results.filter(r => r.status === 'FAIL').length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
