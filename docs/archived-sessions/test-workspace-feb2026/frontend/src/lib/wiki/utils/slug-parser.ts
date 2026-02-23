/**
 * Type-safe slug parsing for wiki pages
 * Separates namespace from slug based on known namespace prefixes
 */

export type WikiNamespace = 'main' | 'library' | 'project' | 'help' | 'template' | 'noxii';

export interface ParsedSlug {
  /** The actual slug without namespace prefix */
  slug: string;
  /** The namespace the page belongs to */
  namespace: WikiNamespace;
  /** The original input for reference/debugging */
  originalSlug: string;
}

/**
 * Parse a slug that may contain a namespace prefix
 *
 * Wiki pages store slug and namespace as SEPARATE database columns:
 * - Database: slug="doom-bible", namespace="library"
 * - URL: /api/wiki/pages/library/doom-bible
 * - This function extracts: { slug: "doom-bible", namespace: "library" }
 *
 * @param rawSlug - The slug from the URL parameter (e.g., "library/doom-bible" or "page-title")
 * @returns Parsed slug with separated namespace
 *
 * @example
 * parseWikiSlug("library/doom-bible")
 * // => { slug: "doom-bible", namespace: "library", originalSlug: "library/doom-bible" }
 *
 * @example
 * parseWikiSlug("cascade-day")
 * // => { slug: "cascade-day", namespace: "main", originalSlug: "cascade-day" }
 *
 * @example
 * parseWikiSlug("project/noxii-game")
 * // => { slug: "noxii-game", namespace: "project", originalSlug: "project/noxii-game" }
 */
export function parseWikiSlug(rawSlug: string): ParsedSlug {
  // Known namespaces that can appear as URL prefixes
  const knownNamespaces: WikiNamespace[] = ['library', 'project', 'help', 'template', 'noxii'];

  // Check if slug starts with a known namespace prefix
  for (const ns of knownNamespaces) {
    const prefix = `${ns}/`;
    if (rawSlug.startsWith(prefix)) {
      return {
        slug: rawSlug.slice(prefix.length), // Remove the "namespace/" prefix
        namespace: ns,
        originalSlug: rawSlug,
      };
    }
  }

  // No namespace prefix found, default to 'main' namespace
  return {
    slug: rawSlug,
    namespace: 'main',
    originalSlug: rawSlug,
  };
}
