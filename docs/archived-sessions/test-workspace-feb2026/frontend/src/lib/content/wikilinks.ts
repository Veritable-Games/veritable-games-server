// MediaWiki-style wikilink parser and renderer

export interface WikiLink {
  raw: string; // Original [[...]] text
  namespace?: string; // Optional namespace (e.g., 'Project', 'User', 'Forum')
  target: string; // The link target
  display?: string; // Optional display text after |
  anchor?: string; // Optional anchor after #
}

// Pattern to match MediaWiki-style links: [[Namespace:Page#Anchor|Display]]
// Moved to module-level to avoid Turbopack HMR issues with static class properties
const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

// Pattern to parse the link components
const LINK_PARTS_PATTERN = /^(?:([^:]+):)?([^#|]+)(?:#([^|]+))?(?:\|(.+))?$/;

export class WikiLinkParser {
  /**
   * Parse all wikilinks in a text
   */
  static parseLinks(text: string): WikiLink[] {
    const links: WikiLink[] = [];
    // Create a new regex instance to avoid state issues with global flag
    const pattern = new RegExp(WIKILINK_PATTERN.source, 'g');
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const linkContent = match[1];
      if (!linkContent) continue;
      const link = this.parseLink(match[0], linkContent);
      if (link) {
        links.push(link);
      }
    }

    return links;
  }

  /**
   * Parse a single wikilink
   */
  static parseLink(raw: string, content: string): WikiLink | null {
    const parts = content.match(LINK_PARTS_PATTERN);

    if (!parts) {
      return null;
    }

    const [, namespace, target, anchor, display] = parts;

    // If no namespace is specified, determine if it's a known namespace
    let finalNamespace = namespace;
    let finalTarget = target;

    if (!namespace && target) {
      // Check if the target starts with a known namespace
      const knownNamespaces = ['Project', 'User', 'Forum', 'Wiki', 'Category', 'File'];
      const colonIndex = target.indexOf(':');

      if (colonIndex > 0) {
        const possibleNamespace = target.substring(0, colonIndex);
        if (knownNamespaces.includes(possibleNamespace)) {
          finalNamespace = possibleNamespace;
          finalTarget = target.substring(colonIndex + 1);
        }
      }
    }

    return {
      raw,
      namespace: finalNamespace,
      target: (finalTarget || '').trim(),
      display: display?.trim(),
      anchor: anchor?.trim(),
    };
  }

  /**
   * Convert wikilinks to HTML
   */
  static renderToHtml(text: string, options: RenderOptions = {}): string {
    return text.replace(WIKILINK_PATTERN, (match, content) => {
      const link = this.parseLink(match, content);
      if (!link) {
        return match;
      }

      const href = this.buildHref(link, options);
      const displayText = link.display || link.target;
      const className = this.getLinkClass(link, options);

      return `<a href="${href}" class="${className}" data-wikilink="${link.raw}">${displayText}</a>`;
    });
  }

  /**
   * Convert wikilinks to markdown links
   */
  static renderToMarkdown(text: string, options: RenderOptions = {}): string {
    return text.replace(WIKILINK_PATTERN, (match, content) => {
      const link = this.parseLink(match, content);
      if (!link) {
        return match;
      }

      const href = this.buildHref(link, options);
      const displayText = link.display || link.target;

      return `[${displayText}](${href})`;
    });
  }

  /**
   * Build the actual href for a wikilink
   */
  private static buildHref(link: WikiLink, options: RenderOptions): string {
    const { baseUrl = '' } = options;
    let path = '';

    switch (link.namespace?.toLowerCase()) {
      case 'project':
        path = `/projects/${link.target.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      case 'forum':
        path = `/forums/topic/${link.target}`;
        break;
      case 'user':
        path = `/forums/profile/${link.target}`;
        break;
      case 'wiki':
      case undefined:
        path = `/wiki/${link.target.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      case 'category':
        path = `/wiki/category/${link.target.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      case 'file':
        path = `/files/${link.target}`;
        break;
      default:
        path = link.namespace
          ? `/${link.namespace.toLowerCase()}/${link.target.toLowerCase().replace(/\s+/g, '-')}`
          : `/wiki/${link.target.toLowerCase().replace(/\s+/g, '-')}`;
    }

    if (link.anchor) {
      path += `#${link.anchor.toLowerCase().replace(/\s+/g, '-')}`;
    }

    return baseUrl + path;
  }

  /**
   * Get CSS class for a link based on its type
   */
  private static getLinkClass(link: WikiLink, options: RenderOptions): string {
    const classes = ['wikilink'];

    if (link.namespace) {
      classes.push(`wikilink-${link.namespace.toLowerCase()}`);
    }

    if (options.checkExistence && !options.existingPages?.includes(link.target)) {
      classes.push('wikilink-missing');
    }

    if (options.additionalClasses) {
      classes.push(options.additionalClasses);
    }

    return classes.join(' ');
  }

  /**
   * Extract all cross-references from text
   */
  static extractCrossReferences(
    text: string,
    sourceType: string,
    sourceId: string
  ): CrossReference[] {
    const links = this.parseLinks(text);
    const references: CrossReference[] = [];

    for (const link of links) {
      const targetType = this.getTargetType(link.namespace);
      if (targetType) {
        references.push({
          source_type: sourceType,
          source_id: sourceId,
          target_type: targetType,
          target_id: link.target,
          reference_context: link.raw,
        });
      }
    }

    return references;
  }

  private static getTargetType(namespace?: string): string | null {
    switch (namespace?.toLowerCase()) {
      case 'project':
        return 'project';
      case 'forum':
        return 'forum';
      case 'wiki':
      case undefined:
        return 'wiki';
      default:
        return null;
    }
  }
}

export interface RenderOptions {
  baseUrl?: string;
  checkExistence?: boolean;
  existingPages?: string[];
  additionalClasses?: string;
}

export interface CrossReference {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  reference_context: string;
}

// Helper function to process content with wikilinks
export function processWikiContent(
  content: string,
  format: 'html' | 'markdown' = 'html',
  options: RenderOptions = {}
): string {
  if (format === 'html') {
    return WikiLinkParser.renderToHtml(content, options);
  } else {
    return WikiLinkParser.renderToMarkdown(content, options);
  }
}

// Helper function to validate wikilink syntax
export function isValidWikiLink(text: string): boolean {
  return /^\[\[([^\]]+)\]\]$/.test(text);
}

// Helper function to create a wikilink
export function createWikiLink(
  target: string,
  options: {
    namespace?: string;
    display?: string;
    anchor?: string;
  } = {}
): string {
  let link = '';

  if (options.namespace) {
    link += `${options.namespace}:`;
  }

  link += target;

  if (options.anchor) {
    link += `#${options.anchor}`;
  }

  if (options.display) {
    link += `|${options.display}`;
  }

  return `[[${link}]]`;
}
