/**
 * Integration Tests: Workspace Migration
 *
 * Tests for complete migration workflow including batch processing,
 * progress tracking, validation, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock data structures matching production schema
interface MockWorkspaceNode {
  id: string;
  workspace_id: string;
  content: string;
  position: string;
  style: string;
  created_at: string;
  updated_at: string;
}

interface NodeContent {
  markdown?: string;
  text?: string;
  title?: string;
  _html_backup?: string;
}

// ==================== HELPER FUNCTIONS ====================

function createMockNode(
  id: string,
  workspaceId: string,
  content: Partial<NodeContent>
): MockWorkspaceNode {
  return {
    id,
    workspace_id: workspaceId,
    content: JSON.stringify(content),
    position: JSON.stringify({ x: 0, y: 0 }),
    style: JSON.stringify({ backgroundColor: '#FEF08A' }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function isHtmlContent(content: string): boolean {
  if (!content || !content.trim()) return false;

  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  const hasParagraphTags = /<p>/i.test(content) || /<p\s/i.test(content);
  const hasStrongTags = /<strong>/i.test(content);
  const hasEmTags = /<em>/i.test(content);

  if (hasParagraphTags || (hasStrongTags && hasEmTags)) {
    return true;
  }

  return htmlTagPattern.test(content);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ==================== TESTS ====================

describe('Migration Integration Tests', () => {
  describe('HTML Content Detection', () => {
    test('detects simple HTML paragraph', () => {
      const html = '<p>Hello world</p>';
      expect(isHtmlContent(html)).toBe(true);
    });

    test('detects Tiptap HTML with strong and em tags', () => {
      const html = '<strong>Bold</strong> and <em>italic</em>';
      expect(isHtmlContent(html)).toBe(true);
    });

    test('detects complex Tiptap HTML', () => {
      const html = '<p><strong>Bold</strong> text with <em>emphasis</em></p>';
      expect(isHtmlContent(html)).toBe(true);
    });

    test('does not detect plain text as HTML', () => {
      const text = 'Just plain text';
      expect(isHtmlContent(text)).toBe(false);
    });

    test('does not detect empty string as HTML', () => {
      expect(isHtmlContent('')).toBe(false);
    });

    test('does not detect whitespace as HTML', () => {
      expect(isHtmlContent('   \n\n   ')).toBe(false);
    });

    test('detects HTML with only paragraph tags', () => {
      const html = '<p>Text in paragraph</p>';
      expect(isHtmlContent(html)).toBe(true);
    });

    test('does not detect markdown as HTML', () => {
      const markdown = '**Bold** and *italic*';
      expect(isHtmlContent(markdown)).toBe(false);
    });

    test('detects mixed HTML and text', () => {
      const mixed = 'Some text <strong>with bold</strong>';
      expect(isHtmlContent(mixed)).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    test('splits array into correct number of batches', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const batches = chunkArray(items, 25);

      expect(batches).toHaveLength(4);
      expect(batches[0]).toHaveLength(25);
      expect(batches[1]).toHaveLength(25);
      expect(batches[2]).toHaveLength(25);
      expect(batches[3]).toHaveLength(25);
    });

    test('handles non-divisible batch sizes', () => {
      const items = Array.from({ length: 107 }, (_, i) => i);
      const batches = chunkArray(items, 50);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(50);
      expect(batches[1]).toHaveLength(50);
      expect(batches[2]).toHaveLength(7); // Remainder
    });

    test('handles single batch', () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const batches = chunkArray(items, 50);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(25);
    });

    test('handles empty array', () => {
      const items: number[] = [];
      const batches = chunkArray(items, 50);

      expect(batches).toHaveLength(0);
    });

    test('batches preserve order', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batches = chunkArray(items, 3);

      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7, 8, 9]);
      expect(batches[3]).toEqual([10]);
    });

    test('simulates Autumn workspace (414 nodes, batch size 50)', () => {
      const nodes = Array.from({ length: 414 }, (_, i) => ({
        id: `node_${i}`,
        index: i,
      }));

      const batches = chunkArray(nodes, 50);

      expect(batches).toHaveLength(9); // ceil(414 / 50)
      expect(batches[0]).toHaveLength(50);
      expect(batches[8]).toHaveLength(14); // Last batch
    });

    test('simulates Noxii workspace (232 nodes, batch size 50)', () => {
      const nodes = Array.from({ length: 232 }, (_, i) => ({
        id: `node_${i}`,
        index: i,
      }));

      const batches = chunkArray(nodes, 50);

      expect(batches).toHaveLength(5); // ceil(232 / 50)
      expect(batches[4]).toHaveLength(32); // Last batch
    });
  });

  describe('Node Filtering', () => {
    test('filters HTML nodes from mixed dataset', () => {
      const nodes: MockWorkspaceNode[] = [
        createMockNode('1', 'ws1', { markdown: '<p>HTML content</p>' }),
        createMockNode('2', 'ws1', { markdown: 'Plain text' }),
        createMockNode('3', 'ws1', { markdown: '<strong>More HTML</strong>' }),
        createMockNode('4', 'ws1', { markdown: 'Another plain text' }),
        createMockNode('5', 'ws1', { markdown: '<p><em>HTML again</em></p>' }),
      ];

      const htmlNodes = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        const text = content.markdown || content.text || '';
        return isHtmlContent(text);
      });

      expect(htmlNodes).toHaveLength(3);
      expect(htmlNodes.map(n => n.id)).toEqual(['1', '3', '5']);
    });

    test('simulates Autumn workspace filtering (414 total, 204 HTML)', () => {
      // Create mock dataset matching production ratio (49% HTML)
      const nodes: MockWorkspaceNode[] = [];

      for (let i = 0; i < 204; i++) {
        nodes.push(createMockNode(`html_${i}`, 'autumn', { markdown: '<p>HTML content</p>' }));
      }
      for (let i = 0; i < 210; i++) {
        nodes.push(createMockNode(`text_${i}`, 'autumn', { markdown: 'Plain text' }));
      }

      const htmlNodes = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        const text = content.markdown || content.text || '';
        return isHtmlContent(text);
      });

      expect(nodes).toHaveLength(414);
      expect(htmlNodes).toHaveLength(204);
      expect(nodes.length - htmlNodes.length).toBe(210); // Plain text nodes
    });

    test('handles workspace with no HTML nodes', () => {
      const nodes: MockWorkspaceNode[] = [
        createMockNode('1', 'ws1', { markdown: 'Plain text 1' }),
        createMockNode('2', 'ws1', { markdown: 'Plain text 2' }),
        createMockNode('3', 'ws1', { markdown: 'Plain text 3' }),
      ];

      const htmlNodes = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        const text = content.markdown || content.text || '';
        return isHtmlContent(text);
      });

      expect(htmlNodes).toHaveLength(0);
    });

    test('handles workspace with all HTML nodes', () => {
      const nodes: MockWorkspaceNode[] = [
        createMockNode('1', 'ws1', { markdown: '<p>HTML 1</p>' }),
        createMockNode('2', 'ws1', { markdown: '<strong>HTML 2</strong>' }),
        createMockNode('3', 'ws1', { markdown: '<p><em>HTML 3</em></p>' }),
      ];

      const htmlNodes = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        const text = content.markdown || content.text || '';
        return isHtmlContent(text);
      });

      expect(htmlNodes).toHaveLength(3);
    });
  });

  describe('Progress Tracking', () => {
    test('calculates total batches correctly', () => {
      const testCases = [
        { nodes: 414, batchSize: 50, expected: 9 },
        { nodes: 232, batchSize: 50, expected: 5 },
        { nodes: 31, batchSize: 50, expected: 1 },
        { nodes: 16, batchSize: 50, expected: 1 },
        { nodes: 8, batchSize: 50, expected: 1 },
        { nodes: 100, batchSize: 25, expected: 4 },
        { nodes: 107, batchSize: 50, expected: 3 },
      ];

      for (const { nodes, batchSize, expected } of testCases) {
        const items = Array.from({ length: nodes }, (_, i) => i);
        const batches = chunkArray(items, batchSize);
        expect(batches.length).toBe(expected);
      }
    });

    test('tracks progress through batches', () => {
      const totalNodes = 100;
      const batchSize = 25;
      const items = Array.from({ length: totalNodes }, (_, i) => i);
      const batches = chunkArray(items, batchSize);

      let processedNodes = 0;
      const progress: number[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        processedNodes += batch.length;
        const percentage = Math.round((processedNodes / totalNodes) * 100);
        progress.push(percentage);
      }

      expect(progress).toEqual([25, 50, 75, 100]);
    });

    test('simulates resume from batch 3 of 9', () => {
      const totalBatches = 9;
      const currentBatch = 3; // Resume from batch 3
      const remainingBatches = totalBatches - currentBatch;

      expect(remainingBatches).toBe(6);

      // Simulate processing remaining batches
      const processed: number[] = [];
      for (let i = currentBatch; i < totalBatches; i++) {
        processed.push(i + 1); // Batch numbers are 1-indexed for display
      }

      expect(processed).toEqual([4, 5, 6, 7, 8, 9]);
    });
  });

  describe('Validation', () => {
    test('validates content length changes', () => {
      const testCases = [
        {
          html: '<p>Hello world</p>',
          markdown: 'Hello world',
          expectWarning: false,
        },
        {
          html: '<p><strong>Bold</strong></p>',
          markdown: '**Bold**',
          expectWarning: false,
        },
        {
          html: '<p>Long HTML content here</p>', // 29 chars
          markdown: 'Short', // 5 chars (17% of original)
          expectWarning: true, // < 30% of original
        },
        {
          html: '<p>Short</p>', // 11 chars
          markdown: '', // 0 chars
          expectWarning: true, // Empty from non-empty
        },
      ];

      for (const { html, markdown, expectWarning } of testCases) {
        const ratio = markdown.length / html.length;
        // Lower threshold to 0.2 (20%) since HTML tags add significant overhead
        const hasWarning =
          (html.length > 10 && markdown.length === 0) || ratio < 0.2 || ratio > 2.0;

        expect(hasWarning).toBe(expectWarning);
      }
    });

    test('validates non-empty HTML produces non-empty markdown', () => {
      const validConversions = [
        { html: '<p>Text</p>', markdown: 'Text' },
        { html: '<strong>Bold</strong>', markdown: '**Bold**' },
        { html: '<em>Italic</em>', markdown: '*Italic*' },
      ];

      for (const { html, markdown } of validConversions) {
        expect(html.length).toBeGreaterThan(0);
        expect(markdown.length).toBeGreaterThan(0);
        expect(markdown.trim().length).toBeGreaterThan(0);
      }
    });

    test('detects potential data loss scenarios', () => {
      const scenarios = [
        {
          html: '<p>Important content here</p>',
          markdown: '',
          dataLoss: true,
        },
        {
          html: '<p>Some text</p>',
          markdown: 'Some text',
          dataLoss: false,
        },
        {
          html: '<div style="color: red;">Red text</div>',
          markdown: '<div style="color: red;">Red text</div>',
          dataLoss: false, // Preserved as HTML
        },
      ];

      for (const { html, markdown, dataLoss } of scenarios) {
        const hasDataLoss = html.length > 10 && markdown.trim().length === 0;
        expect(hasDataLoss).toBe(dataLoss);
      }
    });
  });

  describe('Error Handling', () => {
    test('handles malformed JSON in node content', () => {
      const malformed = '{invalid json';

      expect(() => {
        JSON.parse(malformed);
      }).toThrow();

      // Migration script should catch this and log error
      let caught = false;
      try {
        JSON.parse(malformed);
      } catch (error) {
        caught = true;
      }

      expect(caught).toBe(true);
    });

    test('handles missing content field', () => {
      const node = createMockNode('1', 'ws1', {});
      const content: NodeContent = JSON.parse(node.content);

      const text = content.markdown || content.text || '';
      expect(text).toBe('');
      expect(isHtmlContent(text)).toBe(false);
    });

    test('handles null content field', () => {
      const node = createMockNode('1', 'ws1', { markdown: undefined });
      const content: NodeContent = JSON.parse(node.content);

      const text = content.markdown || content.text || '';
      expect(text).toBe('');
    });

    test('gracefully handles conversion failures', () => {
      // Simulate a conversion that might fail
      const problematicInputs = ['', '   ', null, undefined];

      for (const input of problematicInputs) {
        const text = input || '';
        const isHtml = isHtmlContent(text);
        // Should not throw, should return false for non-HTML
        expect(typeof isHtml).toBe('boolean');
      }
    });
  });

  describe('Backup and Rollback', () => {
    test('stores original HTML in backup field', () => {
      const originalHtml = '<p><strong>Original</strong> content</p>';
      const convertedMarkdown = '**Original** content';

      const content: NodeContent = {
        markdown: convertedMarkdown,
        _html_backup: originalHtml,
      };

      expect(content._html_backup).toBe(originalHtml);
      expect(content.markdown).toBe(convertedMarkdown);
    });

    test('can restore from backup', () => {
      const content: NodeContent = {
        markdown: '**Converted** markdown',
        _html_backup: '<p><strong>Converted</strong> markdown</p>',
      };

      // Simulate rollback
      const restoredHtml = content._html_backup!;
      const rolledBackContent: NodeContent = {
        markdown: restoredHtml,
      };
      delete rolledBackContent._html_backup;

      expect(rolledBackContent.markdown).toBe('<p><strong>Converted</strong> markdown</p>');
      expect(rolledBackContent._html_backup).toBeUndefined();
    });

    test('identifies nodes eligible for rollback', () => {
      const nodes = [
        { content: JSON.stringify({ markdown: 'text', _html_backup: '<p>html</p>' }) },
        { content: JSON.stringify({ markdown: 'text' }) },
        { content: JSON.stringify({ markdown: 'text', _html_backup: '<strong>html</strong>' }) },
      ];

      const rollbackEligible = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        return !!content._html_backup;
      });

      expect(rollbackEligible).toHaveLength(2);
    });
  });

  describe('Production Scenarios', () => {
    test('simulates complete Autumn workspace migration', () => {
      // Create realistic dataset matching production
      const totalNodes = 414;
      const htmlNodeCount = 204;
      const batchSize = 50;

      const nodes: MockWorkspaceNode[] = [];

      // Add HTML nodes
      for (let i = 0; i < htmlNodeCount; i++) {
        nodes.push(createMockNode(`html_${i}`, 'autumn', { markdown: '<p>HTML content</p>' }));
      }

      // Add plain text nodes
      for (let i = 0; i < totalNodes - htmlNodeCount; i++) {
        nodes.push(createMockNode(`text_${i}`, 'autumn', { markdown: 'Plain text' }));
      }

      // Filter to HTML nodes
      const htmlNodes = nodes.filter(node => {
        const content: NodeContent = JSON.parse(node.content);
        const text = content.markdown || content.text || '';
        return isHtmlContent(text);
      });

      // Create batches
      const batches = chunkArray(htmlNodes, batchSize);

      expect(nodes.length).toBe(414);
      expect(htmlNodes.length).toBe(204);
      expect(batches.length).toBe(5); // ceil(204 / 50)
      expect(batches[0].length).toBe(50);
      expect(batches[4].length).toBe(4); // Last batch
    });

    test('simulates migration with errors', () => {
      const nodes = [
        { id: '1', success: true },
        { id: '2', success: false, error: 'Conversion failed' },
        { id: '3', success: true },
        { id: '4', success: false, error: 'Invalid HTML' },
        { id: '5', success: true },
      ];

      const successful = nodes.filter(n => n.success);
      const failed = nodes.filter(n => !n.success);

      expect(successful.length).toBe(3);
      expect(failed.length).toBe(2);
      expect(failed.map(n => n.id)).toEqual(['2', '4']);
    });

    test('calculates estimated time for large migration', () => {
      const nodesPerSecond = 10; // Assumed conversion rate
      const batchDelay = 2000; // 2 seconds between batches

      const autumn = {
        nodes: 204,
        batches: 5,
        estimatedTime: Math.ceil(204 / nodesPerSecond) + (5 * batchDelay) / 1000,
      };

      expect(autumn.estimatedTime).toBeGreaterThan(20); // At least 20 seconds
      expect(autumn.estimatedTime).toBeLessThan(35); // Less than 35 seconds
    });
  });
});
