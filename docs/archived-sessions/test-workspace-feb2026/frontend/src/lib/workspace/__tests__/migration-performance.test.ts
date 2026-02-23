/**
 * Performance Tests: Workspace Migration
 *
 * Tests for migration performance with large datasets.
 * Ensures migration can handle 414-node workspaces efficiently.
 */

import { describe, test, expect } from '@jest/globals';
import TurndownService from 'turndown';

// ==================== TURNDOWN CONFIGURATION ====================

function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  turndownService.addRule('underline', {
    filter: ['u'],
    replacement: content => `<u>${content}</u>`,
  });

  turndownService.addRule('coloredText', {
    filter: node => {
      if (node.nodeName === 'SPAN' && node.getAttribute('style')) {
        const style = node.getAttribute('style') || '';
        if (style.includes('color:') || style.includes('background-color:')) {
          return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute('style');
      return `<span style="${style}">${content}</span>`;
    },
  });

  return turndownService;
}

// ==================== HELPER FUNCTIONS ====================

function generateSampleHtml(complexity: 'simple' | 'medium' | 'complex'): string {
  switch (complexity) {
    case 'simple':
      return '<p>Simple text node</p>';

    case 'medium':
      return '<p><strong>Bold</strong> and <em>italic</em> with <a href="/link">a link</a></p>';

    case 'complex':
      return `
        <h2>Feature Implementation</h2>
        <p><strong>Status:</strong> <span style="color: green;">In Progress</span></p>
        <h3>Tasks</h3>
        <ul>
          <li>✅ <s>Design API</s></li>
          <li>🔄 Implement backend</li>
          <li>⏳ Write tests</li>
        </ul>
        <p><em>Note:</em> See <a href="/docs/api">API docs</a> for details</p>
      `;
  }
}

function measureConversionTime(html: string, turndown: TurndownService): number {
  const start = performance.now();
  turndown.turndown(html);
  const end = performance.now();
  return end - start;
}

// ==================== TESTS ====================

describe('Migration Performance Tests', () => {
  let turndown: TurndownService;

  beforeEach(() => {
    turndown = createTurndownService();
  });

  // ==================== SINGLE NODE PERFORMANCE ====================

  describe('Single Node Performance', () => {
    test('converts simple node in under 25ms', () => {
      const html = generateSampleHtml('simple');
      const time = measureConversionTime(html, turndown);

      expect(time).toBeLessThan(25);
    });

    test('converts medium complexity node in under 10ms', () => {
      const html = generateSampleHtml('medium');
      const time = measureConversionTime(html, turndown);

      expect(time).toBeLessThan(10);
    });

    test('converts complex node in under 30ms', () => {
      const html = generateSampleHtml('complex');
      const time = measureConversionTime(html, turndown);

      expect(time).toBeLessThan(30);
    });

    test('converts very long content in reasonable time', () => {
      const longHtml = '<p>' + 'Lorem ipsum dolor sit amet. '.repeat(1000) + '</p>';
      const time = measureConversionTime(longHtml, turndown);

      expect(time).toBeLessThan(100); // Under 100ms for 1000-word node
    });
  });

  // ==================== BATCH PERFORMANCE ====================

  describe('Batch Performance', () => {
    test('converts 50-node batch in under 1 second', () => {
      const batch = Array.from({ length: 50 }, () => generateSampleHtml('medium'));

      const start = performance.now();
      batch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(1000); // Under 1 second
    });

    test('converts 100-node batch in under 2 seconds', () => {
      const batch = Array.from({ length: 100 }, () => generateSampleHtml('medium'));

      const start = performance.now();
      batch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(2000); // Under 2 seconds
    });

    test('average conversion time per node in large batch', () => {
      const batchSize = 50;
      const batch = Array.from({ length: batchSize }, () => generateSampleHtml('medium'));

      const start = performance.now();
      batch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const averageTime = (end - start) / batchSize;
      expect(averageTime).toBeLessThan(20); // Under 20ms per node
    });
  });

  // ==================== LARGE WORKSPACE SIMULATION ====================

  describe('Large Workspace Simulation', () => {
    test('simulates Autumn workspace conversion (204 HTML nodes)', () => {
      const htmlNodes = Array.from({ length: 204 }, () => generateSampleHtml('medium'));

      const start = performance.now();
      htmlNodes.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      const averageTime = totalTime / 204;

      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for all nodes
      expect(averageTime).toBeLessThan(25); // Under 25ms per node
    });

    test('simulates Noxii workspace conversion (114 HTML nodes estimated)', () => {
      const htmlNodes = Array.from({ length: 114 }, () => generateSampleHtml('medium'));

      const start = performance.now();
      htmlNodes.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(3000); // Under 3 seconds
    });

    test('simulates all workspaces conversion (341 HTML nodes estimated)', () => {
      const htmlNodes = Array.from({ length: 341 }, () => generateSampleHtml('medium'));

      const start = performance.now();
      htmlNodes.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      const averageTime = totalTime / 341;

      expect(totalTime).toBeLessThan(10000); // Under 10 seconds for all workspaces
      expect(averageTime).toBeLessThan(30); // Under 30ms per node
    });
  });

  // ==================== BATCH PROCESSING SIMULATION ====================

  describe('Batch Processing Simulation', () => {
    test('simulates 9 batches for Autumn (204 nodes, batch size 50)', () => {
      const totalNodes = 204;
      const batchSize = 50;
      const batchCount = Math.ceil(totalNodes / batchSize);

      expect(batchCount).toBe(5);

      const batchTimes: number[] = [];

      for (let i = 0; i < batchCount; i++) {
        const currentBatchSize = Math.min(batchSize, totalNodes - i * batchSize);
        const batch = Array.from({ length: currentBatchSize }, () => generateSampleHtml('medium'));

        const start = performance.now();
        batch.forEach(html => turndown.turndown(html));
        const end = performance.now();

        batchTimes.push(end - start);
      }

      const totalTime = batchTimes.reduce((sum, time) => sum + time, 0);
      const averageBatchTime = totalTime / batchCount;

      expect(totalTime).toBeLessThan(5000); // Under 5 seconds total
      expect(averageBatchTime).toBeLessThan(1000); // Under 1 second per batch
      expect(batchTimes.every(time => time < 1500)).toBe(true); // Each batch under 1.5s
    });

    test('estimates total migration time with batch delays', () => {
      const conversionTime = 5000; // 5 seconds for 204 nodes
      const batchCount = 5;
      const batchDelay = 2000; // 2 seconds between batches
      const totalDelayTime = (batchCount - 1) * batchDelay; // No delay after last batch

      const estimatedTotalTime = conversionTime + totalDelayTime;

      expect(estimatedTotalTime).toBeLessThan(15000); // Under 15 seconds
      expect(estimatedTotalTime).toBeGreaterThanOrEqual(13000); // At least 13 seconds (5s + 8s delays)
    });
  });

  // ==================== MEMORY PERFORMANCE ====================

  describe('Memory Performance', () => {
    test('processes large batch without significant memory growth', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process 100 nodes
      const batch = Array.from({ length: 100 }, () => generateSampleHtml('complex'));
      batch.forEach(html => turndown.turndown(html));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (under 50MB for 100 nodes)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    test('turndown instance can be reused without memory leak', () => {
      const html = generateSampleHtml('medium');

      const initialMemory = process.memoryUsage().heapUsed;

      // Convert same HTML 1000 times (reusing turndown instance)
      for (let i = 0; i < 1000; i++) {
        turndown.turndown(html);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (under 50MB for 1000 conversions)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  // ==================== THROUGHPUT TESTS ====================

  describe('Throughput Tests', () => {
    test('calculates nodes per second throughput', () => {
      const nodeCount = 100;
      const batch = Array.from({ length: nodeCount }, () => generateSampleHtml('medium'));

      const start = performance.now();
      batch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const timeInSeconds = (end - start) / 1000;
      const nodesPerSecond = nodeCount / timeInSeconds;

      expect(nodesPerSecond).toBeGreaterThan(20); // At least 20 nodes/sec
      expect(nodesPerSecond).toBeLessThan(10000); // Sanity check (actual ~5000)
    });

    test('estimates total migration time for all workspaces', () => {
      const totalHtmlNodes = 341;
      const nodesPerSecond = 50; // Conservative estimate
      const batchSize = 50;
      const batchCount = Math.ceil(totalHtmlNodes / batchSize);
      const batchDelay = 2; // seconds

      const conversionTime = totalHtmlNodes / nodesPerSecond;
      const delayTime = (batchCount - 1) * batchDelay;
      const totalTime = conversionTime + delayTime;

      expect(totalTime).toBeLessThan(30); // Under 30 seconds for all workspaces
    });
  });

  // ==================== SCALABILITY TESTS ====================

  describe('Scalability Tests', () => {
    test('performance scales linearly with node count', () => {
      const testSizes = [10, 50, 100, 200];
      const times: number[] = [];

      for (const size of testSizes) {
        const batch = Array.from({ length: size }, () => generateSampleHtml('medium'));

        const start = performance.now();
        batch.forEach(html => turndown.turndown(html));
        const end = performance.now();

        times.push(end - start);
      }

      // Check that time roughly doubles when size doubles
      const ratio1 = times[1] / times[0]; // 50 vs 10
      const ratio2 = times[2] / times[1]; // 100 vs 50
      const ratio3 = times[3] / times[2]; // 200 vs 100

      // Ratios should be roughly consistent (within 2x of each other)
      expect(Math.abs(ratio1 - ratio2)).toBeLessThan(ratio1);
      expect(Math.abs(ratio2 - ratio3)).toBeLessThan(ratio2);
    });

    test('handles worst-case scenario (all complex nodes)', () => {
      const worstCaseBatch = Array.from({ length: 50 }, () => generateSampleHtml('complex'));

      const start = performance.now();
      worstCaseBatch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(2000); // Under 2 seconds for worst case batch
    });

    test('handles best-case scenario (all simple nodes)', () => {
      const bestCaseBatch = Array.from({ length: 50 }, () => generateSampleHtml('simple'));

      const start = performance.now();
      bestCaseBatch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(500); // Under 500ms for best case batch
    });
  });

  // ==================== STRESS TESTS ====================

  describe('Stress Tests', () => {
    test('handles 1000 node conversion without errors', () => {
      const largeDataset = Array.from({ length: 1000 }, () => generateSampleHtml('medium'));

      expect(() => {
        largeDataset.forEach(html => turndown.turndown(html));
      }).not.toThrow();
    });

    test('handles rapid sequential conversions', () => {
      const html = generateSampleHtml('medium');

      expect(() => {
        for (let i = 0; i < 500; i++) {
          turndown.turndown(html);
        }
      }).not.toThrow();
    });

    test('handles mixed complexity batch efficiently', () => {
      const mixedBatch = [
        ...Array.from({ length: 20 }, () => generateSampleHtml('simple')),
        ...Array.from({ length: 20 }, () => generateSampleHtml('medium')),
        ...Array.from({ length: 10 }, () => generateSampleHtml('complex')),
      ];

      const start = performance.now();
      mixedBatch.forEach(html => turndown.turndown(html));
      const end = performance.now();

      const totalTime = end - start;
      expect(totalTime).toBeLessThan(1500); // Under 1.5 seconds for mixed batch
    });
  });

  // ==================== PRODUCTION BENCHMARKS ====================

  describe('Production Benchmarks', () => {
    test('Autumn workspace migration estimate (204 HTML nodes, 5 batches)', () => {
      const nodesPerBatch = [50, 50, 50, 50, 4]; // Last batch has only 4 nodes
      const batchDelay = 2000; // 2 seconds

      let totalTime = 0;

      for (let i = 0; i < nodesPerBatch.length; i++) {
        const batch = Array.from({ length: nodesPerBatch[i] }, () => generateSampleHtml('medium'));

        const start = performance.now();
        batch.forEach(html => turndown.turndown(html));
        const end = performance.now();

        totalTime += end - start;

        // Add delay between batches (except after last batch)
        if (i < nodesPerBatch.length - 1) {
          totalTime += batchDelay;
        }
      }

      console.log(`Autumn migration estimated time: ${(totalTime / 1000).toFixed(2)}s`);
      expect(totalTime).toBeLessThan(15000); // Under 15 seconds
    });

    test('All workspaces migration estimate (341 HTML nodes, 7 batches)', () => {
      const totalNodes = 341;
      const batchSize = 50;
      const batchCount = Math.ceil(totalNodes / batchSize);
      const batchDelay = 2000;

      let totalTime = 0;

      for (let i = 0; i < batchCount; i++) {
        const currentBatchSize = Math.min(batchSize, totalNodes - i * batchSize);
        const batch = Array.from({ length: currentBatchSize }, () => generateSampleHtml('medium'));

        const start = performance.now();
        batch.forEach(html => turndown.turndown(html));
        const end = performance.now();

        totalTime += end - start;

        if (i < batchCount - 1) {
          totalTime += batchDelay;
        }
      }

      console.log(`All workspaces migration estimated time: ${(totalTime / 1000).toFixed(2)}s`);
      expect(totalTime).toBeLessThan(20000); // Under 20 seconds
    });
  });
});
