/**
 * Generate Sample News Articles
 *
 * ⚠️ DEVELOPMENT ONLY - DO NOT RUN IN PRODUCTION
 *
 * Creates 25 sample news articles with varied dates, authors, and content
 * for testing pagination on the news page.
 *
 * Run with: npx tsx scripts/generate-sample-news.ts
 */

import { assertDevEnvironment } from '../src/lib/utils/require-sqlite';
import { dbPool } from '../src/lib/database/legacy/pool';

// Prevent accidental production usage
assertDevEnvironment('Generate Sample News Articles (SQLite-only utility)');

interface NewsArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  published_at: string;
  status: string;
  featured_image: string | null;
  tags: string;
}

const sampleArticles: NewsArticle[] = [
  {
    title: 'Welcome to Veritable Games',
    slug: 'welcome-to-veritable-games',
    excerpt:
      'Introducing the new Veritable Games community platform with wiki, library, projects, and 3D visualization.',
    content: `# Welcome to Veritable Games

We're excited to introduce the new Veritable Games community platform! This platform brings together everything you need to engage with our gaming community.

## Key Features

- **Wiki System**: Comprehensive game documentation with revision history
- **Library**: Curated collection of gaming guides and resources
- **Projects**: Showcase and collaborate on community projects
- **3D Visualization**: Immersive stellar visualization system

Join us as we build the future of gaming communities together!`,
    author: 'admin',
    published_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'published',
    featured_image: null,
    tags: JSON.stringify(['announcement', 'welcome', 'platform']),
  },
  {
    title: 'New Features in Stellar Visualization',
    slug: 'new-features-stellar-visualization',
    excerpt:
      'Major updates to the 3D stellar visualization system with improved physics and performance.',
    content: `# New Features in Stellar Visualization

We've rolled out significant improvements to our 3D stellar visualization system!

## What's New

- **Improved Physics**: More accurate orbital mechanics and celestial body interactions
- **Enhanced Performance**: 60fps rendering even with thousands of objects
- **New Camera Controls**: Smoother navigation and better zoom functionality
- **Visual Upgrades**: Better lighting, shadows, and particle effects

Check out the stellar visualization system to see these improvements in action!`,
    author: 'Development Team',
    published_at: new Date(Date.now() - 173 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'published',
    featured_image: null,
    tags: JSON.stringify(['update', 'stellar', '3d', 'features']),
  },
  {
    title: 'Wiki System Gets Major Upgrade',
    slug: 'wiki-system-major-upgrade',
    excerpt:
      'Complete overhaul of the wiki system with revision history, auto-categorization, and improved search.',
    content: `# Wiki System Gets Major Upgrade

Our wiki system has received a comprehensive overhaul!

## New Capabilities

- **Revision History**: Full tracking of all changes with diff viewing
- **Auto-Categorization**: Intelligent category suggestions
- **Improved Search**: Lightning-fast full-text search with FTS5
- **Better Editor**: Enhanced markdown editor with live preview

Start creating and editing wiki pages today to experience these improvements!`,
    author: 'Platform Team',
    published_at: new Date(Date.now() - 166 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'published',
    featured_image: null,
    tags: JSON.stringify(['wiki', 'features', 'update', 'documentation']),
  },
];

// Generate additional articles programmatically
const additionalTitles = [
  'Community Guidelines Updated',
  'Weekly Development Update #1',
  'New Project Showcase Feature',
  'Library System Enhancement',
  'Performance Optimization Results',
  'User Profile Improvements',
  'Weekly Development Update #2',
  'Security Update and Best Practices',
  'Mobile Experience Enhancements',
  'Weekly Development Update #3',
  'Database Architecture Improvements',
  'API Documentation Published',
  'Weekly Development Update #4',
  'Content Moderation Tools',
  'Search Functionality Upgrade',
  'Weekly Development Update #5',
  'Community Spotlight: Top Contributors',
  'Authentication System Overhaul',
  'Weekly Development Update #6',
  'New Markdown Editor Features',
  'Platform Statistics Dashboard',
  'Weekly Development Update #7',
];

const authors = ['admin', 'Development Team', 'Platform Team', 'Community Manager'];
const tagSets = [
  ['announcement', 'community'],
  ['update', 'development'],
  ['features', 'enhancement'],
  ['security', 'update'],
  ['performance', 'optimization'],
  ['documentation'],
];

additionalTitles.forEach((title, index) => {
  const daysAgo = 160 - index * 7; // Spread over time
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const author = authors[index % authors.length] ?? 'admin'; // Ensure author is always defined
  const tags = tagSets[index % tagSets.length];

  sampleArticles.push({
    title,
    slug,
    excerpt: `Summary of ${title}. This article covers the latest updates and improvements to our platform.`,
    content: `# ${title}

This is a sample article about ${title.toLowerCase()}.

## Overview

We're excited to share these updates with the community. This article provides details about recent improvements and what's coming next.

## Key Points

- Major improvements to platform stability
- Enhanced user experience across all features
- Better performance and reliability
- Community feedback incorporated

## What's Next

We'll continue to iterate and improve based on your feedback. Stay tuned for more updates!

Thank you for being part of our community!`,
    author,
    published_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    status: 'published',
    featured_image: null,
    tags: JSON.stringify(tags),
  });
});

async function generateSampleNews() {
  console.log('🚀 Starting sample news generation...\n');

  const db = dbPool.getConnection('content');

  try {
    // Check if news table exists
    const tableExists = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='news'
    `
      )
      .get();

    if (!tableExists) {
      console.error('❌ Error: news table does not exist in content.db');
      console.log('   Please ensure the database schema is initialized.');
      process.exit(1);
    }

    // Check existing articles to avoid duplicates
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM news').get() as {
      count: number;
    };
    console.log(`📊 Current articles in database: ${existingCount.count}`);

    if (existingCount.count >= 25) {
      console.log('✅ Database already has 25+ articles. Skipping generation.');
      console.log('   To regenerate, delete existing articles first.');
      return;
    }

    // Insert articles
    const insertStmt = db.prepare(`
      INSERT INTO news (
        title, slug, excerpt, content, author, published_at, status, featured_image, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    for (const article of sampleArticles) {
      try {
        // Check if slug already exists
        const exists = db.prepare('SELECT id FROM news WHERE slug = ?').get(article.slug);

        if (exists) {
          console.log(`⏭️  Skipping "${article.title}" (already exists)`);
          skipped++;
          continue;
        }

        insertStmt.run(
          article.title,
          article.slug,
          article.excerpt,
          article.content,
          article.author,
          article.published_at,
          article.status,
          article.featured_image,
          article.tags
        );

        inserted++;
        console.log(`✅ Created "${article.title}"`);
      } catch (error) {
        console.error(`❌ Failed to create "${article.title}":`, error);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   - Articles created: ${inserted}`);
    console.log(`   - Articles skipped: ${skipped}`);
    console.log(`   - Total in database: ${existingCount.count + inserted}`);
    console.log('\n✨ Sample news generation complete!');
  } catch (error) {
    console.error('❌ Error generating sample news:', error);
    process.exit(1);
  }
}

// Run the generator
generateSampleNews().catch(console.error);
