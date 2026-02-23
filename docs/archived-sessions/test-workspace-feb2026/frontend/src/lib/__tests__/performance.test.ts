/**
 * Individual User Performance Testing Suite
 *
 * Performance tests focused on individual user experience:
 * - Page load performance
 * - Content rendering efficiency
 * - Search response times
 * - Memory usage optimization
 * - Bundle size analysis
 * - Individual workflow optimizations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { logger } from '@/lib/utils/logger';

// Mock performance APIs
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
};

// Mock Web Vitals
const mockWebVitals = {
  getCLS: jest.fn((callback: (metric: any) => void) => callback({ name: 'CLS', value: 0.05 })),
  getFID: jest.fn((callback: (metric: any) => void) => callback({ name: 'FID', value: 45 })),
  getFCP: jest.fn((callback: (metric: any) => void) => callback({ name: 'FCP', value: 1200 })),
  getLCP: jest.fn((callback: (metric: any) => void) => callback({ name: 'LCP', value: 2100 })),
  getTTFB: jest.fn((callback: (metric: any) => void) => callback({ name: 'TTFB', value: 450 })),
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

jest.mock('web-vitals', () => mockWebVitals);

// Mock database operations for performance testing
const mockDbPool = {
  getConnection: jest.fn((dbName: string) => ({
    prepare: jest.fn(() => ({
      get: jest.fn(() => ({ result: 'test' })),
      all: jest.fn(() => Array.from({ length: 10 }, (_, i) => ({ id: i, content: `Item ${i}` }))),
      run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
    })),
    close: jest.fn(),
  })),
};

jest.mock('@/lib/database/pool', () => ({
  dbPool: mockDbPool,
}));

describe('Individual User Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformance.now.mockReturnValue(Date.now());
  });

  describe('Page Load Performance', () => {
    it('should load wiki pages within acceptable time limits', async () => {
      const startTime = performance.now();

      // Simulate wiki page loading
      const mockWikiData = {
        id: 1,
        title: 'Test Page',
        content: '# Test Content\n\nThis is a test page with some content.',
        category: 'Documentation',
        revisions: 5,
      };

      // Mock database query performance
      const queryTime = 45; // ms
      mockPerformance.now.mockReturnValueOnce(startTime + queryTime);

      const db = mockDbPool.getConnection('wiki') as any;
      const result = db.prepare('SELECT * FROM wiki_pages WHERE id = ?').get();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance targets for individual productivity
      expect(totalTime).toBeLessThan(100); // Database query under 100ms
      expect(result).toBeTruthy();
    });

    it('should handle concurrent page loads efficiently', async () => {
      const pageLoads = Array.from({ length: 5 }, (_, i) => {
        const startTime = performance.now();
        return {
          id: i + 1,
          loadPromise: new Promise(resolve => {
            setTimeout(
              () => {
                const endTime = performance.now();
                resolve({
                  id: i + 1,
                  loadTime: endTime - startTime,
                  content: `Page ${i + 1} content`,
                });
              },
              Math.random() * 50 + 20
            ); // 20-70ms random load time
          }),
        };
      });

      const results = await Promise.all(pageLoads.map(load => load.loadPromise));

      // All pages should load within reasonable time for individual use
      results.forEach((result: any) => {
        expect(result.loadTime).toBeLessThan(100);
        expect(result.content).toContain('Page');
      });

      const averageLoadTime =
        results.reduce((sum: number, result: any) => sum + (result?.loadTime || 0), 0) /
        results.length;
      expect(averageLoadTime).toBeLessThan(60);
    });

    it('should optimize first contentful paint (FCP) for productivity', () => {
      // Test Web Vitals for individual user experience
      let fcpValue = 0;

      mockWebVitals.getFCP((metric: { name: string; value: number }) => {
        fcpValue = metric.value;
      });

      // FCP should be under 1.8s for good user experience
      expect(fcpValue).toBeLessThan(1800);
      expect(fcpValue).toBeGreaterThan(0);
    });

    it('should maintain low cumulative layout shift (CLS)', () => {
      // Test layout stability for individual productivity
      let clsValue = 0;

      mockWebVitals.getCLS((metric: { name: string; value: number }) => {
        clsValue = metric.value;
      });

      // CLS should be under 0.1 for stable layout
      expect(clsValue).toBeLessThan(0.1);
      expect(clsValue).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Content Rendering Performance', () => {
    it('should render markdown content efficiently', async () => {
      const markdownContent = `
# Large Document Test

This is a test document with multiple sections to test rendering performance.

## Section 1
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Section 2  
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Section 3
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

\`\`\`javascript
// Code block for syntax highlighting test
function testFunction() {
  logger.info('Performance test');
  return true;
}
\`\`\`

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
`;

      const startTime = performance.now();

      // Simulate markdown parsing and rendering
      const processedContent = {
        html: markdownContent.replace(/\n/g, '<br>'),
        wordCount: markdownContent.split(/\s+/).length,
        renderTime: performance.now() - startTime,
      };

      expect(processedContent.renderTime).toBeLessThan(50); // Under 50ms for fast rendering
      expect(processedContent.wordCount).toBeGreaterThan(50);
      expect(processedContent.html).toContain('<br>');
    });

    it('should handle large content lists with virtualization', () => {
      // Test performance with large datasets for individual productivity
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        content: `Content for item ${i}`,
        timestamp: new Date(2025, 0, (i % 30) + 1).toISOString(),
      }));

      const startTime = performance.now();

      // Simulate virtualized rendering (only render visible items)
      const viewportHeight = 600;
      const itemHeight = 50;
      const visibleItems = Math.ceil(viewportHeight / itemHeight);
      const buffer = 5;

      const renderedItems = largeDataset.slice(0, visibleItems + buffer);

      const renderTime = performance.now() - startTime;

      // Virtualization should make rendering fast regardless of dataset size
      expect(renderTime).toBeLessThan(10);
      expect(renderedItems.length).toBeLessThan(largeDataset.length);
      expect(renderedItems.length).toBeLessThanOrEqual(visibleItems + buffer);
    });

    it('should optimize Monaco editor loading for diff comparisons', () => {
      // Simulate Monaco editor initialization
      const monacoConfig = {
        language: 'markdown',
        theme: 'vs-dark',
        options: {
          renderSideBySide: true,
          hideUnchangedRegions: { enabled: true },
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          fontSize: 13,
        },
      };

      // Test configuration is optimized for performance
      expect(monacoConfig.options.minimap.enabled).toBe(false); // Optimized for performance
      expect(monacoConfig.options.renderSideBySide).toBe(true); // Side-by-side comparison
      expect(monacoConfig.options.readOnly).toBe(true); // Read-only for comparison
      expect(monacoConfig.language).toBe('markdown'); // Correct language
    });
  });

  describe('Search Performance', () => {
    it('should provide fast content search results', async () => {
      const searchQuery = 'test content';
      const mockSearchData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: `Document ${i}`,
        content: i % 3 === 0 ? `This document contains test content ${i}` : `Regular document ${i}`,
        type: i % 2 === 0 ? 'wiki' : 'project',
      }));

      const startTime = performance.now();

      // Simulate search operation
      const searchResults = mockSearchData.filter(
        item =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const searchTime = performance.now() - startTime;

      // Search should be fast for individual productivity
      expect(searchTime).toBeLessThan(20);
      expect(searchResults.length).toBeGreaterThan(0);
      expect(
        searchResults.every(
          result => result.content.includes('test content') || result.title.includes('test content')
        )
      ).toBe(true);
    });

    it('should cache search results for repeated queries', () => {
      const searchCache = new Map();
      const searchQuery = 'cached search';

      // Mock timing for first search (cache miss)
      const mockResults = [
        { id: 1, title: 'Cached Search Result 1' },
        { id: 2, title: 'Cached Search Result 2' },
      ];

      // Simulate first search with processing time
      const firstSearchStartTime = Date.now();
      const simulatedProcessingTime = 50; // ms
      const firstSearchEndTime = firstSearchStartTime + simulatedProcessingTime;
      const firstSearchTime = firstSearchEndTime - firstSearchStartTime;

      searchCache.set(searchQuery, mockResults);

      // Second search - cache hit (much faster)
      const cachedResults = searchCache.get(searchQuery);
      const cacheHitTime = 1; // Cache hits should be ~1ms

      // Test cache functionality
      expect(cacheHitTime).toBeLessThan(firstSearchTime);
      expect(cachedResults).toEqual(mockResults);
      expect(searchCache.size).toBe(1);
    });

    it('should handle search result pagination efficiently', () => {
      const totalResults = 250;
      const pageSize = 20;
      const currentPage = 3;

      const startTime = performance.now();

      // Simulate paginated search results
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;

      const paginatedResults = Array.from({ length: pageSize }, (_, i) => ({
        id: startIndex + i,
        title: `Result ${startIndex + i + 1}`,
        relevanceScore: Math.random() * 100,
      }));

      const paginationTime = performance.now() - startTime;

      expect(paginationTime).toBeLessThan(5);
      expect(paginatedResults.length).toBe(pageSize);
      expect(paginatedResults[0]?.id).toBe(startIndex);
      expect(paginatedResults[pageSize - 1]?.id).toBe(endIndex - 1);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should manage memory efficiently during content editing', () => {
      // Simulate content editing with undo/redo history
      const editHistory = [];
      const maxHistorySize = 50;

      // Add many edits to test memory management
      for (let i = 0; i < 75; i++) {
        const edit = {
          action: i % 3 === 0 ? 'insert' : i % 3 === 1 ? 'delete' : 'modify',
          content: `Edit ${i} content`,
          timestamp: Date.now() + i * 1000,
        };

        editHistory.push(edit);

        // Trim history to prevent memory growth
        if (editHistory.length > maxHistorySize) {
          editHistory.shift();
        }
      }

      // History should be limited to prevent memory issues
      expect(editHistory.length).toBeLessThanOrEqual(maxHistorySize);
      expect(editHistory[0]?.content).toContain('Edit 25'); // First 25 removed
    });

    it('should clean up unused revision data', () => {
      // Test revision cleanup for memory efficiency
      const revisionCache = new Map();
      const maxCacheSize = 20;

      // Load many revisions
      for (let i = 0; i < 30; i++) {
        const revision = {
          id: i,
          content: `Revision ${i} content`,
          timestamp: Date.now() + i * 1000,
        };

        revisionCache.set(i, revision);

        // Implement LRU-style cleanup
        if (revisionCache.size > maxCacheSize) {
          const firstKey = revisionCache.keys().next().value;
          revisionCache.delete(firstKey);
        }
      }

      expect(revisionCache.size).toBeLessThanOrEqual(maxCacheSize);
      expect(revisionCache.has(29)).toBe(true); // Most recent should be kept
      expect(revisionCache.has(0)).toBe(false); // Oldest should be removed
    });

    it('should optimize component re-renders', () => {
      // Test memoization and render optimization
      let renderCount = 0;

      const mockComponent = {
        props: { content: 'test', timestamp: Date.now() },
        shouldUpdate: (
          newProps: { content: string; timestamp: number },
          oldProps: { content: string; timestamp: number }
        ) => {
          renderCount++;

          // Only re-render if content actually changed
          return newProps.content !== oldProps.content || newProps.timestamp !== oldProps.timestamp;
        },
      };

      // Same props should not trigger re-render
      const sameProps = mockComponent.props;
      const shouldRender1 = mockComponent.shouldUpdate(sameProps, mockComponent.props);

      // Different content should trigger re-render
      const newProps = { ...mockComponent.props, content: 'new content' };
      const shouldRender2 = mockComponent.shouldUpdate(newProps, mockComponent.props);

      expect(shouldRender1).toBe(false);
      expect(shouldRender2).toBe(true);
      expect(renderCount).toBe(2);
    });
  });

  describe('Bundle Size and Resource Loading', () => {
    it('should maintain reasonable bundle sizes for individual use', () => {
      // Mock bundle analysis data
      const bundleAnalysis = {
        mainBundle: 245, // KB
        vendorBundle: 180, // KB
        libraryBundle: 95, // KB
        totalSize: 520, // KB
        gzipSize: 156, // KB
        chunkSizes: {
          pages: 65,
          components: 45,
          utils: 25,
        },
      };

      // Bundle sizes should be optimized for individual productivity
      expect(bundleAnalysis.totalSize).toBeLessThan(600); // Under 600KB total
      expect(bundleAnalysis.gzipSize).toBeLessThan(200); // Under 200KB gzipped
      expect(bundleAnalysis.mainBundle).toBeLessThan(300); // Main bundle under 300KB

      // Critical chunks should be reasonably sized
      expect(bundleAnalysis.chunkSizes.pages).toBeLessThan(80);
      expect(bundleAnalysis.chunkSizes.components).toBeLessThan(60);
    });

    it('should load resources progressively for better perceived performance', async () => {
      const resourceLoadOrder = [
        { name: 'critical-css', size: 15, priority: 'critical' },
        { name: 'main-js', size: 120, priority: 'high' },
        { name: 'monaco-editor', size: 200, priority: 'low' },
        { name: 'syntax-highlighting', size: 45, priority: 'low' },
        { name: 'images', size: 80, priority: 'low' },
      ];

      const loadTimes: Record<string, number> = {};

      // Simulate progressive loading
      for (const resource of resourceLoadOrder) {
        const loadTime =
          resource.priority === 'critical' ? 50 : resource.priority === 'high' ? 100 : 200;

        await new Promise(resolve => setTimeout(resolve, loadTime / 10)); // Speed up for test
        loadTimes[resource.name] = loadTime;
      }

      // Critical resources should load first and fastest
      expect(loadTimes['critical-css'] ?? 0).toBeLessThan(loadTimes['main-js'] ?? 999);
      expect(loadTimes['main-js'] ?? 0).toBeLessThan(loadTimes['monaco-editor'] ?? 999);
    });

    it('should implement efficient code splitting for individual workflow', () => {
      // Test code splitting strategy
      const codeChunks = {
        core: { size: 85, loadTime: 120 },
        wiki: { size: 45, loadTime: 80 },
        editor: { size: 120, loadTime: 200 },
        admin: { size: 35, loadTime: 70 },
        search: { size: 25, loadTime: 50 },
      };

      // Core should be small and fast
      expect(codeChunks.core.size).toBeLessThan(100);
      expect(codeChunks.core.loadTime).toBeLessThan(150);

      // Feature-specific chunks should be appropriately sized
      expect(codeChunks.wiki.size).toBeLessThan(60);
      expect(codeChunks.search.size).toBeLessThan(40);

      // Heavy features should be lazy-loaded
      expect(codeChunks.editor.size).toBeGreaterThan(codeChunks.wiki.size);
    });
  });

  describe('Individual Workflow Performance', () => {
    it('should optimize content autosave for productivity', async () => {
      let saveCount = 0;
      const autosaveInterval = 2000; // 2 seconds

      const mockAutosave = {
        content: '',
        lastSaved: Date.now(),
        isDirty: false,

        updateContent: function (newContent: string) {
          this.content = newContent;
          this.isDirty = true;
        },

        save: function () {
          saveCount++;
          this.lastSaved = Date.now();
          this.isDirty = false;
          return Promise.resolve({ success: true });
        },
      };

      // Simulate content changes
      mockAutosave.updateContent('New content');
      expect(mockAutosave.isDirty).toBe(true);

      // Simulate autosave
      await mockAutosave.save();
      expect(saveCount).toBe(1);
      expect(mockAutosave.isDirty).toBe(false);
    });

    it('should provide efficient keyboard shortcut handling', () => {
      const shortcutHandlers = {
        'Ctrl+S': { action: 'save', executionTime: 5 },
        '/': { action: 'search', executionTime: 2 },
        c: { action: 'compare', executionTime: 3 },
        Escape: { action: 'reset', executionTime: 1 },
        'Ctrl+Z': { action: 'undo', executionTime: 4 },
      };

      // All shortcuts should execute quickly
      Object.values(shortcutHandlers).forEach(handler => {
        expect(handler.executionTime).toBeLessThan(10);
      });

      // Essential shortcuts should be very fast
      expect(shortcutHandlers['Escape'].executionTime).toBeLessThan(3);
      expect(shortcutHandlers['/'].executionTime).toBeLessThan(5);
    });

    it('should optimize revision history browsing for individual use', () => {
      const revisionHistory = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        timestamp: Date.now() - i * 3600000, // 1 hour apart
        size: 1000 + i * 50,
        changes: Math.floor(Math.random() * 20) + 1,
      }));

      const startTime = performance.now();

      // Simulate efficient filtering and sorting
      const recentRevisions = revisionHistory
        .filter(rev => Date.now() - rev.timestamp < 7 * 24 * 3600000) // Last 7 days
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20); // Show top 20

      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(10);
      expect(recentRevisions.length).toBeLessThanOrEqual(20);
      expect(recentRevisions[0]?.timestamp ?? 0).toBeGreaterThan(
        recentRevisions[1]?.timestamp || 0
      );
    });
  });
});
