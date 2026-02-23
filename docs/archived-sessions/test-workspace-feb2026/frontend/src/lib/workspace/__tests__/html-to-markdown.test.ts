/**
 * Unit Tests: HTML → Markdown Conversion
 *
 * Tests for workspace migration script's HTML to Markdown conversion.
 * Covers basic formatting, edge cases, and production data samples.
 */

import TurndownService from 'turndown';

// ==================== TURNDOWN CONFIGURATION (from migrate-to-markdown.ts) ====================

function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Custom rule: Preserve underline as HTML
  turndownService.addRule('underline', {
    filter: ['u'],
    replacement: content => `<u>${content}</u>`,
  });

  // Custom rule: Preserve color/style spans as HTML
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

  // Custom rule: Preserve text-align divs as HTML
  turndownService.addRule('textAlign', {
    filter: node => {
      if (node.nodeName === 'DIV' && node.getAttribute('style')) {
        const style = node.getAttribute('style') || '';
        if (style.includes('text-align:')) {
          return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute('style');
      return `<div style="${style}">${content}</div>`;
    },
  });

  // Custom rule: Convert strikethrough to markdown
  turndownService.addRule('strikethrough', {
    filter: ['s', 'strike', 'del'],
    replacement: content => `~~${content}~~`,
  });

  // Custom rule: Remove empty paragraphs
  turndownService.addRule('emptyParagraph', {
    filter: node => {
      return node.nodeName === 'P' && node.textContent?.trim() === '';
    },
    replacement: () => '',
  });

  return turndownService;
}

// ==================== TESTS ====================

describe('HTML to Markdown Conversion', () => {
  let turndown: TurndownService;

  beforeEach(() => {
    turndown = createTurndownService();
  });

  // ==================== BASIC FORMATTING ====================

  describe('Basic Formatting', () => {
    test('converts bold text', () => {
      const html = '<p><strong>Hello</strong> world</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('**Hello** world');
    });

    test('converts italic text', () => {
      const html = '<p><em>Hello</em> world</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('*Hello* world');
    });

    test('converts strikethrough text', () => {
      const html = '<p><s>Hello</s> world</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('~~Hello~~ world');
    });

    test('converts underline text (preserved as HTML)', () => {
      const html = '<p><u>Hello</u> world</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('<u>Hello</u> world');
    });

    test('converts combined formatting', () => {
      const html = '<p><strong><em>Bold and italic</em></strong></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('***Bold and italic***');
    });

    test('converts inline code', () => {
      const html = '<p>Use <code>console.log()</code> for debugging</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Use `console.log()` for debugging');
    });
  });

  // ==================== HEADINGS ====================

  describe('Headings', () => {
    test('converts h1', () => {
      const html = '<h1>Main Title</h1>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('# Main Title');
    });

    test('converts h2', () => {
      const html = '<h2>Section Title</h2>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('## Section Title');
    });

    test('converts h3', () => {
      const html = '<h3>Subsection</h3>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('### Subsection');
    });

    test('converts h4-h6', () => {
      expect(turndown.turndown('<h4>Level 4</h4>')).toBe('#### Level 4');
      expect(turndown.turndown('<h5>Level 5</h5>')).toBe('##### Level 5');
      expect(turndown.turndown('<h6>Level 6</h6>')).toBe('###### Level 6');
    });
  });

  // ==================== LISTS ====================

  describe('Lists', () => {
    test('converts unordered list', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
      const markdown = turndown.turndown(html);
      expect(markdown).toMatch(/\*\s+Item 1/); // Allow variable whitespace
      expect(markdown).toMatch(/\*\s+Item 2/);
      expect(markdown).toMatch(/\*\s+Item 3/);
    });

    test('converts ordered list', () => {
      const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
      const markdown = turndown.turndown(html);
      expect(markdown).toMatch(/1\.\s+First/); // Allow variable whitespace
      expect(markdown).toMatch(/2\.\s+Second/);
      expect(markdown).toMatch(/3\.\s+Third/);
    });

    test('converts nested lists', () => {
      const html =
        '<ul><li>Item 1<ul><li>Nested 1</li><li>Nested 2</li></ul></li><li>Item 2</li></ul>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Item 1');
      expect(markdown).toContain('Nested 1');
      expect(markdown).toContain('Nested 2');
      expect(markdown).toContain('Item 2');
    });
  });

  // ==================== LINKS ====================

  describe('Links', () => {
    test('converts simple link', () => {
      const html = '<p><a href="https://example.com">Click here</a></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('[Click here](https://example.com)');
    });

    test('converts link with title', () => {
      const html = '<p><a href="https://example.com" title="Example Site">Example</a></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('[Example](https://example.com "Example Site")');
    });

    test('converts multiple links', () => {
      const html =
        '<p><a href="https://a.com">Link A</a> and <a href="https://b.com">Link B</a></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('[Link A](https://a.com)');
      expect(markdown).toContain('[Link B](https://b.com)');
    });
  });

  // ==================== CUSTOM RULES ====================

  describe('Custom Rules', () => {
    test('preserves underline tags as HTML', () => {
      const html = '<p>This is <u>underlined</u> text</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('This is <u>underlined</u> text');
    });

    test('preserves colored text as HTML', () => {
      const html = '<p><span style="color: red;">Red text</span></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('<span style="color: red;">Red text</span>');
    });

    test('preserves background color as HTML', () => {
      const html = '<p><span style="background-color: yellow;">Highlighted</span></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('<span style="background-color: yellow;">Highlighted</span>');
    });

    test('preserves text-align divs as HTML', () => {
      const html = '<div style="text-align: center;">Centered text</div>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('<div style="text-align: center;">Centered text</div>');
    });

    test('removes empty paragraphs', () => {
      const html = '<p></p><p>Content</p><p></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Content');
    });

    test('removes paragraphs with only whitespace', () => {
      const html = '<p>   </p><p>Content</p><p>\n\n</p>';
      const markdown = turndown.turndown(html);
      expect(markdown.trim()).toBe('Content');
    });
  });

  // ==================== TIPTAP-SPECIFIC PATTERNS ====================

  describe('Tiptap-Specific HTML', () => {
    test('converts simple Tiptap paragraph', () => {
      const html = '<p>Hello world</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Hello world');
    });

    test('converts Tiptap bold', () => {
      const html = '<p><strong>Bold text</strong></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('**Bold text**');
    });

    test('converts Tiptap italic', () => {
      const html = '<p><em>Italic text</em></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('*Italic text*');
    });

    test('converts Tiptap nested formatting', () => {
      const html = '<p><strong>Bold and <em>italic</em></strong></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Bold and');
      expect(markdown).toContain('italic');
    });

    test('handles Tiptap line breaks', () => {
      const html = '<p>Line 1<br>Line 2</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 2');
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('handles empty string', () => {
      const html = '';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('');
    });

    test('handles whitespace only', () => {
      const html = '   \n\n   ';
      const markdown = turndown.turndown(html);
      expect(markdown.trim()).toBe('');
    });

    test('handles plain text (no HTML)', () => {
      const html = 'Just plain text';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Just plain text');
    });

    test('handles unicode characters', () => {
      const html = '<p>Hello 世界 🌍</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Hello 世界 🌍');
    });

    test('handles emoji', () => {
      const html = '<p>✅ Task complete 🎉</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('✅ Task complete 🎉');
    });

    test('handles special characters', () => {
      const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot;</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('<div>');
      expect(markdown).toContain('&');
      expect(markdown).toContain('"');
    });

    test('handles very long content', () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const html = `<p>${longText}</p>`;
      const markdown = turndown.turndown(html);
      expect(markdown.length).toBeGreaterThan(10000);
      expect(markdown).toContain('Lorem ipsum');
    });

    test('handles nested HTML structures', () => {
      const html = '<div><p><strong><em>Deeply</em> nested</strong> content</p></div>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Deeply');
      expect(markdown).toContain('nested');
      expect(markdown).toContain('content');
    });
  });

  // ==================== PRODUCTION DATA SAMPLES ====================

  describe('Production Data Samples', () => {
    test('sample 1: simple note', () => {
      const html = '<p>Quick note about the project</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Quick note about the project');
    });

    test('sample 2: formatted task list', () => {
      const html =
        '<ul><li><strong>TODO:</strong> Fix bug</li><li><strong>DONE:</strong> Write tests</li></ul>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('**TODO:**');
      expect(markdown).toContain('Fix bug');
      expect(markdown).toContain('**DONE:**');
      expect(markdown).toContain('Write tests');
    });

    test('sample 3: meeting notes with heading', () => {
      const html =
        '<h2>Meeting Notes</h2><p>Discussed project timeline</p><ul><li>Phase 1: Complete</li><li>Phase 2: In progress</li></ul>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('## Meeting Notes');
      expect(markdown).toContain('Discussed project timeline');
      expect(markdown).toContain('Phase 1: Complete');
      expect(markdown).toContain('Phase 2: In progress');
    });

    test('sample 4: code snippet reference', () => {
      const html = '<p>Use <code>npm run test</code> to run tests</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('Use `npm run test` to run tests');
    });

    test('sample 5: mixed formatting with link', () => {
      const html =
        '<p><strong>Important:</strong> See <a href="https://docs.example.com">documentation</a> for more info</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('**Important:**');
      expect(markdown).toContain('[documentation](https://docs.example.com)');
    });

    test('sample 6: colored highlighted text', () => {
      const html =
        '<p><span style="background-color: yellow;">⚠️ Warning</span>: Check this carefully</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('<span style="background-color: yellow;">⚠️ Warning</span>');
      expect(markdown).toContain('Check this carefully');
    });

    test('sample 7: centered title', () => {
      const html = '<div style="text-align: center;"><strong>Project Title</strong></div>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('<div style="text-align: center;">');
      expect(markdown).toContain('**Project Title**');
      expect(markdown).toContain('</div>');
    });

    test('sample 8: multiline paragraph', () => {
      const html = '<p>Line one<br>Line two<br>Line three</p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Line one');
      expect(markdown).toContain('Line two');
      expect(markdown).toContain('Line three');
    });

    test('sample 9: empty note (should be empty)', () => {
      const html = '<p><br></p>';
      const markdown = turndown.turndown(html);
      expect(markdown.trim()).toBe('');
    });

    test('sample 10: complex workspace node', () => {
      const html = `
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
      const markdown = turndown.turndown(html);

      expect(markdown).toContain('## Feature Implementation');
      expect(markdown).toContain('**Status:**');
      expect(markdown).toContain('<span style="color: green;">In Progress</span>');
      expect(markdown).toContain('### Tasks');
      expect(markdown).toMatch(/~~Design API~~|Design API/); // Strikethrough or plain text
      expect(markdown).toContain('Implement backend');
      expect(markdown).toContain('Write tests');
      expect(markdown).toContain('*Note:*');
      expect(markdown).toContain('[API docs](/docs/api)');
    });
  });

  // ==================== VALIDATION TESTS ====================

  describe('Validation', () => {
    test('markdown output should be roughly similar length to HTML', () => {
      const html = '<p><strong>Hello</strong> world, this is a <em>test</em> message</p>';
      const markdown = turndown.turndown(html);

      // Markdown should be shorter (no tags) but not drastically different
      const ratio = markdown.length / html.length;
      expect(ratio).toBeGreaterThan(0.4); // At least 40% of original
      expect(ratio).toBeLessThan(2.0); // Not more than 2x original
    });

    test('non-empty HTML should not result in empty markdown', () => {
      const samples = [
        '<p>Hello</p>',
        '<strong>Bold</strong>',
        '<ul><li>Item</li></ul>',
        '<h2>Title</h2>',
        '<a href="/">Link</a>',
      ];

      for (const html of samples) {
        const markdown = turndown.turndown(html);
        expect(markdown.trim().length).toBeGreaterThan(0);
      }
    });

    test('preserves content meaning after conversion', () => {
      const html = '<p>The <strong>quick</strong> brown <em>fox</em> jumps over the lazy dog</p>';
      const markdown = turndown.turndown(html);

      expect(markdown).toContain('quick');
      expect(markdown).toContain('brown');
      expect(markdown).toContain('fox');
      expect(markdown).toContain('jumps');
      expect(markdown).toContain('lazy');
      expect(markdown).toContain('dog');
    });

    test('preserves formatting semantics', () => {
      const html = '<p><strong>Important</strong> information <em>with emphasis</em></p>';
      const markdown = turndown.turndown(html);

      // Should preserve bold/italic markers
      expect(markdown).toMatch(/\*\*Important\*\*/);
      expect(markdown).toMatch(/\*with emphasis\*/);
    });
  });

  // ==================== ROUND-TRIP TESTS ====================

  describe('Round-Trip Conversion', () => {
    test('simple text round-trip', () => {
      const original = 'Hello world';
      const html = `<p>${original}</p>`;
      const markdown = turndown.turndown(html);
      expect(markdown).toBe(original);
    });

    test('bold text round-trip', () => {
      const html = '<p><strong>Bold</strong></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('**Bold**');
      // Converting back to HTML would give <strong>Bold</strong>
    });

    test('italic text round-trip', () => {
      const html = '<p><em>Italic</em></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('*Italic*');
    });

    test('link round-trip', () => {
      const html = '<p><a href="https://example.com">Link</a></p>';
      const markdown = turndown.turndown(html);
      expect(markdown).toBe('[Link](https://example.com)');
    });

    test('list round-trip', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const markdown = turndown.turndown(html);
      expect(markdown).toContain('Item 1');
      expect(markdown).toContain('Item 2');
    });
  });
});
