import { visit } from 'unist-util-visit';
import { Node } from 'unist';
import { logger } from '@/lib/utils/logger';

interface TextNode extends Node {
  type: 'text';
  value: string;
}

interface InfoboxNode extends Node {
  type: 'infobox';
  template: string;
  fields: Record<string, string>;
}

/**
 * AST node that may have children (paragraphs, root, etc.)
 */
interface ParentNode extends Node {
  children?: Node[];
}

// Plugin to parse {{infobox|Type|field=value}} syntax
export function remarkInfobox() {
  return function transformer(tree: Node) {
    // First, collect all text content to check for infoboxes that might span multiple nodes
    let fullContent = '';
    const collectText = (node: ParentNode) => {
      if (node.type === 'text' && 'value' in node) {
        fullContent += (node as TextNode).value;
      } else if (node.children) {
        node.children.forEach(child => collectText(child as ParentNode));
      }
    };

    const treeWithChildren = tree as ParentNode;
    if (treeWithChildren.children) {
      treeWithChildren.children.forEach(child => collectText(child as ParentNode));
    }

    // Check if there are any infoboxes in the content
    const infoboxRegex = /\{\{infobox\|([\s\S]*?)\}\}/gi;
    const hasInfobox = infoboxRegex.test(fullContent);

    // Debug logging only in development
    if (process.env.NODE_ENV === 'development' && hasInfobox) {
      logger.info('[Infobox Plugin] Processing infoboxes in content');
    }

    if (!hasInfobox) {
      return; // No infoboxes found, exit early
    }

    // Process the tree to handle infoboxes
    // First pass: merge consecutive text nodes to handle multi-line infoboxes
    visit(tree, (node: any, index: number | null | undefined, parent: any) => {
      // Process both paragraph nodes and root nodes
      if ((node.type === 'paragraph' || node.type === 'root') && node.children) {
        const newChildren: any[] = [];
        let currentText = '';

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];

          if (child.type === 'text') {
            currentText += child.value;
          } else {
            // If we have accumulated text, add it as a node
            if (currentText) {
              newChildren.push({ type: 'text', value: currentText });
              currentText = '';
            }
            newChildren.push(child);
          }
        }

        // Add any remaining text
        if (currentText) {
          newChildren.push({ type: 'text', value: currentText });
        }

        node.children = newChildren;
      }
    });

    // Second pass: process infoboxes
    visit(tree, 'text', (node: TextNode, index: number | null, parent: any) => {
      if (!node.value || typeof index !== 'number' || !parent) return;

      // Match {{infobox|Type|field1=value1|field2=value2}} syntax
      // Use [\s\S] to match any character including newlines
      const infoboxRegex = /\{\{infobox\|([\s\S]*?)\}\}/gi;
      const text = node.value;
      const matches = [...text.matchAll(infoboxRegex)];

      if (matches.length === 0) return;

      // Debug log only in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Infobox Plugin] Found', matches.length, 'infobox(es) in text node');
      }

      const newNodes: Node[] = [];
      let lastIndex = 0;

      matches.forEach(match => {
        const fullMatch = match[0];
        const content = match[1];
        const matchStart = match.index!;
        const matchEnd = matchStart + fullMatch.length;

        // Add text before the infobox
        if (matchStart > lastIndex) {
          const textBefore = text.slice(lastIndex, matchStart);
          if (textBefore) {
            newNodes.push({
              type: 'text',
              value: textBefore,
            } as TextNode);
          }
        }

        // Parse the infobox content
        const { template, fields } = parseInfoboxContent(content || '');

        // Create an HTML node with data attributes
        // ReactMarkdown can render HTML nodes but not custom node types
        const htmlValue = `<div data-infobox="true" data-template="${template.replace(/"/g, '&quot;')}" data-fields='${JSON.stringify(fields).replace(/'/g, '&#39;')}'></div>`;

        const htmlNode = {
          type: 'html',
          value: htmlValue,
        };

        newNodes.push(htmlNode);
        lastIndex = matchEnd;
      });

      // Add remaining text after the last infobox
      if (lastIndex < text.length) {
        const textAfter = text.slice(lastIndex);
        if (textAfter) {
          newNodes.push({
            type: 'text',
            value: textAfter,
          } as TextNode);
        }
      }

      // Replace the original text node with the new nodes
      parent.children.splice(index, 1, ...newNodes);
    });
  };
}

// Parse infobox content to extract template type and fields
function parseInfoboxContent(content: string): {
  template: string;
  fields: Record<string, string>;
} {
  const parts = content.split('|').map(p => p.trim());
  const template = parts[0] || 'generic';
  const fields: Record<string, string> = {};

  // Process each field after the template name
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const equalIndex = part.indexOf('=');

    if (equalIndex !== -1) {
      const fieldName = part.slice(0, equalIndex).trim();
      const fieldValue = part.slice(equalIndex + 1).trim();

      if (fieldName) {
        // Handle multi-line values (continued on next parts without '=')
        let fullValue = fieldValue;

        // Look ahead for continuation lines
        let j = i + 1;
        while (j < parts.length && parts[j]?.includes && !parts[j]!.includes('=')) {
          fullValue += '\n' + parts[j]!;
          i = j; // Skip these parts in the main loop
          j++;
        }

        fields[fieldName] = fullValue;
      }
    }
  }

  return { template: template.toLowerCase(), fields };
}

// Extract all infoboxes from markdown content
export function extractInfoboxes(
  content: string
): Array<{ template: string; fields: Record<string, string> }> {
  const infoboxRegex = /\{\{infobox\|([^\}]+)\}\}/gi;
  const infoboxes: Array<{ template: string; fields: Record<string, string> }> = [];
  let match;

  while ((match = infoboxRegex.exec(content)) !== null) {
    const matchContent = match[1];
    if (matchContent) {
      const { template, fields } = parseInfoboxContent(matchContent);
      infoboxes.push({ template, fields });
    }
  }

  return infoboxes;
}

// Convert infobox data to markdown syntax
export function infoboxToMarkdown(template: string, fields: Record<string, string>): string {
  const parts = [template];

  Object.entries(fields).forEach(([key, value]) => {
    // Handle multi-line values
    const formattedValue = value.replace(/\n/g, '\n|');
    parts.push(`${key}=${formattedValue}`);
  });

  return `{{infobox|${parts.join('|')}}}`;
}

// Map template names to template IDs from the database
export const templateMapping: Record<string, number> = {
  'game project': 1,
  project: 1,
  character: 2,
  'character profile': 2,
  system: 3,
  'game system': 3,
  notice: 9,
  navigation: 10,
  status: 11,
  citation: 12,
  spoiler: 13,
};

// Get template ID from template name
export function getTemplateId(templateName: string): number | null {
  const normalized = templateName.toLowerCase().trim();
  return templateMapping[normalized] || null;
}
