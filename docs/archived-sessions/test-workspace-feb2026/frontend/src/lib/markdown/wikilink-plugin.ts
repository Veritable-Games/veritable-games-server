import { visit } from 'unist-util-visit';
import { Node } from 'unist';
import { logger } from '@/lib/utils/logger';

interface TextNode extends Node {
  type: 'text';
  value: string;
}

interface LinkNode extends Node {
  type: 'link';
  url: string;
  title?: string;
  children: Node[];
}

interface InlineNode extends Node {
  type: 'inlineCode' | 'strong' | 'emphasis';
  value?: string;
  children?: Node[];
}

// Plugin to transform [[WikiLink]] syntax into proper markdown links
export function remarkWikiLinks() {
  return function transformer(tree: Node) {
    visit(tree, 'text', (node: TextNode, index: number | null, parent: any) => {
      if (!node.value || typeof index !== 'number' || !parent) return;

      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
      const text = node.value;
      const matches = [...text.matchAll(wikiLinkRegex)];

      if (matches.length === 0) return;

      const newNodes: Node[] = [];
      let lastIndex = 0;

      matches.forEach(match => {
        const fullMatch = match[0];
        const content = match[1];
        const matchStart = match.index!;
        const matchEnd = matchStart + fullMatch.length;

        // Add text before the wikilink
        if (matchStart > lastIndex) {
          const textBefore = text.slice(lastIndex, matchStart);
          if (textBefore) {
            newNodes.push({
              type: 'text',
              value: textBefore,
            } as TextNode);
          }
        }

        // Parse the wikilink content
        const { slug, displayText, namespace } = parseWikiLinkContent(content ?? '');

        // Determine the URL based on namespace
        let url: string;
        if (namespace && ['library', 'projects', 'forums', 'news', 'users'].includes(namespace)) {
          // Special namespaces with their own routes
          url = `/${namespace}/${slug}`;
        } else if (namespace) {
          // Wiki-specific namespaces (included in slug)
          url = `/wiki/${slug}`;
        } else {
          // Default to wiki
          url = `/wiki/${slug}`;
        }

        // Create a link node
        const linkNode: LinkNode = {
          type: 'link',
          url,
          title: displayText !== slug ? slug : undefined,
          children: [
            {
              type: 'text',
              value: displayText,
            } as TextNode,
          ],
        };

        newNodes.push(linkNode);
        lastIndex = matchEnd;
      });

      // Add remaining text after the last wikilink
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

// Parse wikilink content to extract slug, display text, and namespace
function parseWikiLinkContent(content: string): {
  slug: string;
  displayText: string;
  namespace?: string;
} {
  // Handle different wikilink formats:
  // [[Page Name]] -> slug: page-name, display: Page Name
  // [[Page Name|Display Text]] -> slug: page-name, display: Display Text
  // [[namespace:Page Name]] -> slug: page-name, display: Page Name, namespace: namespace
  // [[namespace:Page Name|Display Text]] -> slug: page-name, display: Display Text, namespace: namespace
  // [[/absolute/path]] -> slug: /absolute/path, display: path, namespace: absolute
  // [[/projects/name|Display]] -> slug: name, display: Display, namespace: projects

  const pipeIndex = content.indexOf('|');
  let linkTarget: string;
  let displayText: string;

  if (pipeIndex !== -1) {
    // Has custom display text
    linkTarget = content.slice(0, pipeIndex).trim();
    displayText = content.slice(pipeIndex + 1).trim();
  } else {
    // Use page name as display text
    linkTarget = content.trim();
    displayText = linkTarget;
  }

  // Handle absolute paths (e.g., /projects/dodec)
  if (linkTarget.startsWith('/')) {
    const parts = linkTarget.slice(1).split('/');
    if (parts.length >= 2) {
      const namespace = (parts[0] ?? '').toLowerCase();
      const slug = parts.slice(1).join('/');

      // If no custom display text, show just the slug
      if (displayText === linkTarget) {
        displayText = parts[parts.length - 1] ?? linkTarget;
      }

      return { slug, displayText, namespace };
    }
  }

  // Check for namespace with colon syntax
  const colonIndex = linkTarget.indexOf(':');
  let namespace: string | undefined;
  let slug: string;

  if (colonIndex !== -1) {
    const potentialNamespace = linkTarget.slice(0, colonIndex).trim().toLowerCase();
    const pageName = linkTarget.slice(colonIndex + 1).trim();

    // Recognized namespaces that have their own routes
    const specialNamespaces = ['library', 'projects', 'forums', 'news', 'users'];

    if (specialNamespaces.includes(potentialNamespace)) {
      namespace = potentialNamespace;
      slug = createSlugFromTitle(pageName);
      // If no custom display text, show page name without namespace
      if (displayText === linkTarget) {
        displayText = pageName;
      }
    } else {
      // For wiki-specific namespaces, include them in the slug path
      slug = createSlugFromTitle(linkTarget);
    }
  } else {
    // Regular page name
    slug = createSlugFromTitle(linkTarget);
  }

  return { slug, displayText, namespace };
}

// Convert a page title to a URL-safe slug
function createSlugFromTitle(title: string): string {
  // Handle namespace syntax (namespace:page)
  const colonIndex = title.indexOf(':');
  if (colonIndex !== -1) {
    const namespace = title.slice(0, colonIndex).trim();
    const pageName = title.slice(colonIndex + 1).trim();

    const namespaceSlug = namespace
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const pageSlug = pageName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    return `${namespaceSlug}/${pageSlug}`;
  }

  // Regular page name
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Plugin to track wikilinks for backlink generation
export function remarkWikiLinkTracker(
  onWikiLink?: (source: string, target: string, displayText: string) => void
) {
  return function transformer(tree: Node, file: any) {
    const sourceSlug = file.data?.slug || 'unknown';

    visit(tree, 'link', (node: LinkNode) => {
      if (node.url.startsWith('/wiki/')) {
        const targetSlug = node.url.replace('/wiki/', '');
        const displayText = node.children
          .filter((child): child is TextNode => child.type === 'text')
          .map(child => child.value)
          .join('');

        if (onWikiLink) {
          onWikiLink(sourceSlug, targetSlug, displayText);
        }
      }
    });
  };
}

// Utility function to extract all wikilinks from markdown content
export function extractWikiLinks(
  content: string
): Array<{ target: string; displayText: string; originalText: string }> {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: Array<{ target: string; displayText: string; originalText: string }> = [];
  let match;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const originalText = match[0];
    const content_inner = match[1] ?? '';
    const { slug, displayText } = parseWikiLinkContent(content_inner);

    links.push({
      target: slug,
      displayText,
      originalText,
    });
  }

  return links;
}

// Utility function to check if a page exists (for red/blue link styling)
export async function validateWikiLinks(links: string[]): Promise<Record<string, boolean>> {
  try {
    // Remove duplicates from links array
    const uniqueLinks = [...new Set(links)];

    if (uniqueLinks.length === 0) {
      return {};
    }

    // Make API call to check which pages exist
    const response = await fetch('/api/wiki/pages/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slugs: uniqueLinks }),
    });

    if (!response.ok) {
      logger.warn('WikiLink validation API failed:', response.status);
      // Return empty map on API failure - links will appear as normal links
      return {};
    }

    const result = await response.json();

    if (result.success) {
      return result.data || {};
    } else {
      logger.warn('WikiLink validation failed:', result.error);
      return {};
    }
  } catch (error) {
    logger.error('Error validating wiki links:', error);
    // Return empty map on error - links will appear as normal links
    return {};
  }
}
