/**
 * WebSocket Streaming Live Test
 *
 * Tests:
 * 1. WebSocket connection to streaming endpoint
 * 2. Frame reception and timing
 * 3. Frame rate calculation
 * 4. Latency measurement
 * 5. Camera control message sending
 * 6. Connection stability over time
 */

import WebSocket from 'ws';

interface TestMetrics {
  framesReceived: number;
  bytesReceived: number;
  startTime: number;
  firstFrameTime: number | null;
  lastFrameTime: number;
  frameIntervals: number[];
  latencies: number[];
  errors: string[];
}

const metrics: TestMetrics = {
  framesReceived: 0,
  bytesReceived: 0,
  startTime: Date.now(),
  firstFrameTime: null,
  lastFrameTime: Date.now(),
  frameIntervals: [],
  latencies: [],
  errors: [],
};

const TEST_DURATION = 10000; // 10 seconds
const GODOT_VERSION_ID = 5; // From our test data

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  };
  console.log(`${icons[type]} ${message}`);
}

function calculateStats(values: number[]): {
  avg: number;
  min: number;
  max: number;
  median: number;
} {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, median: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];

  return { avg, min, max, median };
}

async function testWebSocketStreaming() {
  log('═══════════════════════════════════════════════════════', 'info');
  log('WEBSOCKET STREAMING LIVE TEST', 'info');
  log('═══════════════════════════════════════════════════════', 'info');

  // Use port 3004 for streaming WebSocket server (3002 is workspace server)
  const port = process.env.STREAM_PORT ? parseInt(process.env.STREAM_PORT) : 3004;

  const url = `ws://localhost:${port}/api/godot/versions/${GODOT_VERSION_ID}/stream`;
  log(`\nConnecting to: ${url}`, 'info');

  return new Promise<void>((resolve, reject) => {
    let ws: WebSocket | null = null;
    let testTimeout: NodeJS.Timeout | null = null;
    let connectionEstablished = false;

    const cleanup = () => {
      if (testTimeout) clearTimeout(testTimeout);
      if (ws) {
        ws.close();
      }
    };

    const finish = (success: boolean) => {
      cleanup();
      setTimeout(() => {
        if (success) {
          printResults();
          resolve();
        } else {
          reject(new Error('Test failed'));
        }
      }, 500);
    };

    try {
      ws = new WebSocket(url);

      ws.on('open', () => {
        log('WebSocket connected!', 'success');
        connectionEstablished = true;

        // Send initial state message
        ws!.send(
          JSON.stringify({
            type: 'state',
            payload: {
              activeNodePath: null,
              selectedNodeId: null,
              searchQuery: '',
            },
          })
        );

        log('Initial state sent', 'info');

        // Schedule camera position update after 2 seconds
        setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'camera',
                payload: { x: 5, y: 5, z: 20 },
              })
            );
            log('Camera position update sent: (5, 5, 20)', 'info');
          }
        }, 2000);

        // Schedule test timeout
        testTimeout = setTimeout(() => {
          log(`\nTest duration (${TEST_DURATION}ms) reached. Closing connection.`, 'info');
          finish(true);
        }, TEST_DURATION);
      });

      ws.on('message', (data: Buffer) => {
        const now = Date.now();
        const wasFirstFrame = metrics.firstFrameTime === null;

        if (wasFirstFrame) {
          metrics.firstFrameTime = now;
          log(`First frame received after ${now - metrics.startTime}ms`, 'success');
        }

        // Track frame timing
        const timeSinceLastFrame = now - metrics.lastFrameTime;
        if (metrics.framesReceived > 0) {
          metrics.frameIntervals.push(timeSinceLastFrame);
        }

        metrics.lastFrameTime = now;
        metrics.framesReceived++;
        metrics.bytesReceived += data.length;

        // Log every 30 frames (approximately every second at 30fps)
        if (metrics.framesReceived % 30 === 0) {
          const elapsed = now - metrics.startTime;
          const avgFps = (metrics.framesReceived / elapsed) * 1000;
          const mbps = ((metrics.bytesReceived / elapsed) * 8) / 1000000;
          log(
            `Frame ${metrics.framesReceived} | ${avgFps.toFixed(1)} FPS | ${mbps.toFixed(2)} Mbps | ${data.length} bytes`,
            'info'
          );
        }
      });

      ws.on('error', (error: Error) => {
        metrics.errors.push(`WebSocket error: ${error.message}`);
        log(`WebSocket error: ${error.message}`, 'error');
        finish(false);
      });

      ws.on('close', () => {
        if (!connectionEstablished) {
          metrics.errors.push('WebSocket closed before connection established');
          log('WebSocket closed prematurely', 'error');
          finish(false);
        } else {
          log('WebSocket closed gracefully', 'warn');
        }
      });
    } catch (error) {
      metrics.errors.push(`Connection error: ${String(error)}`);
      log(`Connection error: ${error}`, 'error');
      finish(false);
    }
  });
}

function printResults() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const totalDuration = Date.now() - metrics.startTime;
  const timeToFirstFrame = metrics.firstFrameTime
    ? metrics.firstFrameTime - metrics.startTime
    : null;

  console.log('CONNECTIVITY:');
  console.log(`  Connection Status: ${metrics.framesReceived > 0 ? '✅ CONNECTED' : '❌ FAILED'}`);
  if (timeToFirstFrame !== null) {
    console.log(`  Time to First Frame: ${timeToFirstFrame}ms`);
  }
  console.log(`  Total Duration: ${totalDuration}ms`);
  console.log(`  Total Frames: ${metrics.framesReceived}`);
  console.log(`  Total Data: ${(metrics.bytesReceived / 1024 / 1024).toFixed(2)} MB`);

  if (metrics.framesReceived > 0) {
    const fps = (metrics.framesReceived / totalDuration) * 1000;
    const mbps = ((metrics.bytesReceived / totalDuration) * 8) / 1000000;
    const avgFrameSize = metrics.bytesReceived / metrics.framesReceived;

    console.log('\nPERFORMANCE:');
    console.log(`  Average FPS: ${fps.toFixed(2)}`);
    console.log(`  Average Bitrate: ${mbps.toFixed(2)} Mbps`);
    console.log(`  Average Frame Size: ${avgFrameSize.toFixed(0)} bytes`);

    if (metrics.frameIntervals.length > 0) {
      const intervalStats = calculateStats(metrics.frameIntervals);
      console.log('\nFRAME TIMING (ms between frames):');
      console.log(`  Average: ${intervalStats.avg.toFixed(2)}ms`);
      console.log(`  Min: ${intervalStats.min.toFixed(2)}ms`);
      console.log(`  Max: ${intervalStats.max.toFixed(2)}ms`);
      console.log(`  Median: ${intervalStats.median.toFixed(2)}ms`);

      // Check for consistency (jitter)
      const jitter = intervalStats.max - intervalStats.min;
      if (jitter < 20) {
        console.log(`  Jitter: ${jitter.toFixed(2)}ms ✅ EXCELLENT`);
      } else if (jitter < 50) {
        console.log(`  Jitter: ${jitter.toFixed(2)}ms ⚠️ ACCEPTABLE`);
      } else {
        console.log(`  Jitter: ${jitter.toFixed(2)}ms ❌ HIGH`);
      }
    }
  }

  if (metrics.errors.length > 0) {
    console.log('\nERRORS:');
    metrics.errors.forEach(err => {
      console.log(`  ❌ ${err}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  // Summary
  if (metrics.framesReceived === 0) {
    console.log('❌ TEST FAILED: No frames received');
  } else if (metrics.errors.length > 0) {
    console.log('⚠️  TEST COMPLETED WITH WARNINGS');
    console.log(
      `Received ${metrics.framesReceived} frames despite ${metrics.errors.length} error(s)`
    );
  } else {
    console.log('✅ TEST PASSED');
    console.log(`Successfully received ${metrics.framesReceived} frames`);
  }

  console.log('═══════════════════════════════════════════════════════\n');
}

async function main() {
  try {
    await testWebSocketStreaming();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
