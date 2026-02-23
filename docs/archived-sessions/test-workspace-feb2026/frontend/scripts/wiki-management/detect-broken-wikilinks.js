#!/usr/bin/env node

/**
 * Broken Wiki Links Detection Script
 *
 * This script detects broken wikilink references across the wiki system:
 * 1. Scans wiki_page_links table for broken target_slug references
 * 2. Scans wiki page content for [[WikiLink]] patterns that point to non-existent pages
 * 3. Generates a markdown report: /docs/BROKEN_WIKI_LINKS_REPORT.md
 *
 * Run after title changes to identify links that need manual fixing.
 *
 * Usage: npm run wiki:detect-broken-links
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database paths
const wikiDbPath = path.join(__dirname, '../../data/wiki.db');
const reportPath = path.join(__dirname, '../../../docs/BROKEN_WIKI_LINKS_REPORT.md');

// Wikilink regex pattern: [[Target]] or [[Target|Display]] or [[Namespace:Target]]
const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

function parseWikiLink(linkContent) {
  // Pattern: [[Namespace:Target#Anchor|Display]]
  const parts = linkContent.match(/^(?:([^:]+):)?([^#|]+)(?:#([^|]+))?(?:\|(.+))?$/);

  if (!parts) {
    return null;
  }

  const [, namespace, target, anchor, display] = parts;

  return {
    raw: `[[${linkContent}]]`,
    namespace: namespace || 'main',
    target: (target || '').trim(),
    anchor: anchor?.trim(),
    display: display?.trim(),
  };
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function detectBrokenLinks() {
  console.log('🔍 Detecting broken wiki links...\n');

  const db = new Database(wikiDbPath);
  db.pragma('journal_mode = WAL');

  // Get all wiki pages for reference
  const allPages = db
    .prepare(
      `
    SELECT id, slug, title, namespace, status
    FROM wiki_pages
    WHERE status = 'published'
  `
    )
    .all();

  const pagesBySlug = new Map();
  allPages.forEach(page => {
    const key = `${page.namespace}:${page.slug}`;
    pagesBySlug.set(key, page);
  });

  console.log(`📚 Total wiki pages: ${allPages.length}\n`);

  // ========================================
  // Part 1: Check wiki_page_links table
  // ========================================
  console.log('1️⃣  Checking wiki_page_links table for broken references...\n');

  const pageLinks = db
    .prepare(
      `
    SELECT
      wpl.id,
      wpl.source_page_id,
      wpl.target_slug,
      wpl.target_page_id,
      wpl.link_text,
      p.title as source_title,
      p.slug as source_slug,
      p.namespace as source_namespace
    FROM wiki_page_links wpl
    JOIN wiki_pages p ON wpl.source_page_id = p.id
    WHERE p.status = 'published'
  `
    )
    .all();

  const brokenDatabaseLinks = [];

  pageLinks.forEach(link => {
    // Check if target_page_id is valid
    if (link.target_page_id) {
      const targetExists = db
        .prepare(
          `
        SELECT id FROM wiki_pages WHERE id = ? AND status = 'published'
      `
        )
        .get(link.target_page_id);

      if (!targetExists) {
        brokenDatabaseLinks.push({
          source: {
            id: link.source_page_id,
            title: link.source_title,
            slug: link.source_slug,
            namespace: link.source_namespace,
          },
          targetSlug: link.target_slug,
          linkText: link.link_text,
        });
      }
    } else {
      // target_page_id is NULL, check if target_slug exists
      const targetExists = db
        .prepare(
          `
        SELECT id FROM wiki_pages WHERE slug = ? AND status = 'published'
      `
        )
        .get(link.target_slug);

      if (!targetExists) {
        brokenDatabaseLinks.push({
          source: {
            id: link.source_page_id,
            title: link.source_title,
            slug: link.source_slug,
            namespace: link.source_namespace,
          },
          targetSlug: link.target_slug,
          linkText: link.link_text,
        });
      }
    }
  });

  console.log(`   Found ${brokenDatabaseLinks.length} broken entries in wiki_page_links table\n`);

  // ========================================
  // Part 2: Scan wiki page content
  // ========================================
  console.log('2️⃣  Scanning wiki page content for [[WikiLinks]]...\n');

  const pagesWithContent = db
    .prepare(
      `
    SELECT
      p.id,
      p.slug,
      p.title,
      p.namespace,
      r.content
    FROM wiki_pages p
    LEFT JOIN wiki_revisions r ON p.id = r.page_id
      AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
    WHERE p.status = 'published'
      AND r.content IS NOT NULL
  `
    )
    .all();

  const brokenContentLinks = [];
  const linksBySourcePage = new Map();

  pagesWithContent.forEach(page => {
    const content = page.content;
    const matches = [...content.matchAll(WIKILINK_PATTERN)];

    matches.forEach(match => {
      const linkContent = match[1];
      const parsed = parseWikiLink(linkContent);

      if (!parsed || !parsed.target) {
        return;
      }

      // Convert target to slug
      const targetSlug = slugify(parsed.target);
      const namespace = parsed.namespace || 'main';
      const lookupKey = `${namespace}:${targetSlug}`;

      // Check if target page exists
      const targetPage = pagesBySlug.get(lookupKey);

      if (!targetPage) {
        // Broken link found
        const brokenLink = {
          source: {
            id: page.id,
            title: page.title,
            slug: page.slug,
            namespace: page.namespace,
          },
          raw: parsed.raw,
          namespace: parsed.namespace,
          targetSlug: targetSlug,
          originalTarget: parsed.target,
          display: parsed.display,
        };

        brokenContentLinks.push(brokenLink);

        // Group by source page
        const sourceKey = `${page.namespace}:${page.slug}`;
        if (!linksBySourcePage.has(sourceKey)) {
          linksBySourcePage.set(sourceKey, {
            page: {
              id: page.id,
              title: page.title,
              slug: page.slug,
              namespace: page.namespace,
            },
            brokenLinks: [],
          });
        }
        linksBySourcePage.get(sourceKey).brokenLinks.push(brokenLink);
      }
    });
  });

  console.log(`   Found ${brokenContentLinks.length} broken [[WikiLinks]] in page content\n`);

  // ========================================
  // Part 3: Generate Report
  // ========================================
  console.log('3️⃣  Generating markdown report...\n');

  const timestamp = new Date().toISOString();
  const totalBroken = brokenDatabaseLinks.length + brokenContentLinks.length;
  const affectedPages = new Set([
    ...brokenDatabaseLinks.map(l => `${l.source.namespace}:${l.source.slug}`),
    ...brokenContentLinks.map(l => `${l.source.namespace}:${l.source.slug}`),
  ]).size;

  let report = `# Broken Wiki Links Report

**Generated:** ${timestamp}
**Total Broken Links:** ${totalBroken}
**Affected Pages:** ${affectedPages}

---

## Summary

This report identifies broken wikilink references across the wiki system. These links may have become broken due to:
- Page title changes (which auto-regenerate slugs)
- Page deletions
- Typos in wikilink syntax
- Pages that were never created

**Action Required:** Manually review and update these links.

---

## Table of Contents

1. [Broken Links in wiki_page_links Database](#broken-links-in-wiki_page_links-database)
2. [Broken [[WikiLinks]] in Page Content](#broken-wikilinks-in-page-content)
3. [Recommendations](#recommendations)

---

## Broken Links in wiki_page_links Database

Database table entries that reference non-existent pages.

**Count:** ${brokenDatabaseLinks.length}

`;

  if (brokenDatabaseLinks.length > 0) {
    brokenDatabaseLinks.forEach(link => {
      report += `### Source: [${link.source.title}](/wiki/${link.source.slug})\n`;
      report += `- **Namespace:** ${link.source.namespace}\n`;
      report += `- **Broken Target Slug:** \`${link.targetSlug}\`\n`;
      if (link.linkText) {
        report += `- **Link Text:** "${link.linkText}"\n`;
      }
      report += `- **Action:** Update or remove this wiki_page_links entry\n\n`;
    });
  } else {
    report += `✅ No broken links found in wiki_page_links table.\n\n`;
  }

  report += `---

## Broken [[WikiLinks]] in Page Content

Wikilinks found in page content that point to non-existent pages.

**Count:** ${brokenContentLinks.length}

`;

  if (brokenContentLinks.length > 0) {
    // Group by source page
    linksBySourcePage.forEach((data, sourceKey) => {
      const { page, brokenLinks } = data;

      report += `### [${page.title}](/wiki/${page.slug})\n`;
      report += `**Namespace:** \`${page.namespace}\` | **Slug:** \`${page.slug}\`\n\n`;
      report += `**Broken Links (${brokenLinks.length}):**\n\n`;

      brokenLinks.forEach(link => {
        report += `- **Wikilink:** \`${link.raw}\`\n`;
        report += `  - **Target:** \`${link.originalTarget}\` → slug: \`${link.targetSlug}\`\n`;
        report += `  - **Namespace:** \`${link.namespace}\`\n`;
        if (link.display) {
          report += `  - **Display Text:** "${link.display}"\n`;
        }
        report += `\n`;
      });

      report += `\n`;
    });
  } else {
    report += `✅ No broken [[WikiLinks]] found in page content.\n\n`;
  }

  report += `---

## Recommendations

### For Broken Database Links (wiki_page_links)

1. **Manual cleanup:** Run SQL queries to remove orphaned entries:
   \`\`\`sql
   DELETE FROM wiki_page_links
   WHERE target_page_id NOT IN (SELECT id FROM wiki_pages WHERE status = 'published');
   \`\`\`

2. **Update target_slug:** If you know the new slug, update the entries manually.

### For Broken [[WikiLinks]] in Content

1. **Update wikilinks manually:** Edit the source pages and fix the broken links:
   - Change \`[[Old Title]]\` to \`[[New Title]]\`
   - Or remove the link if the target page no longer exists

2. **Create missing pages:** If the linked pages should exist, create them.

3. **Use proper namespace prefixes:** Ensure cross-namespace links use proper syntax:
   - \`[[library:Page Name]]\` for library pages
   - \`[[project:autumn:Page]]\` for project pages

### Prevention

- Run this script after major title changes
- Use \`npm run wiki:detect-broken-links\` regularly
- Consider using the "Suggest Internal Links" script to add valid links

---

**End of Report**
`;

  // Write report to file
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`✅ Report generated: ${reportPath}\n`);
  console.log(`📊 Summary:`);
  console.log(`   - Database broken links: ${brokenDatabaseLinks.length}`);
  console.log(`   - Content broken links: ${brokenContentLinks.length}`);
  console.log(`   - Total broken links: ${totalBroken}`);
  console.log(`   - Affected pages: ${affectedPages}\n`);

  db.close();

  return {
    totalBroken,
    affectedPages,
    brokenDatabaseLinks: brokenDatabaseLinks.length,
    brokenContentLinks: brokenContentLinks.length,
  };
}

// Run the script
try {
  const results = detectBrokenLinks();

  if (results.totalBroken === 0) {
    console.log('🎉 No broken links found! Your wiki is in great shape.\n');
    process.exit(0);
  } else {
    console.log(`⚠️  Found ${results.totalBroken} broken links that need attention.\n`);
    console.log(`📄 Review the report at: docs/BROKEN_WIKI_LINKS_REPORT.md\n`);
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Error detecting broken links:', error);
  process.exit(1);
}
