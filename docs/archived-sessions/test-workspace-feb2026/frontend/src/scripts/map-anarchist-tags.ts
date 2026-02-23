/**
 * Anarchist Library Tag Categorization Script
 * Extracts all tags from anarchist documents and categorizes them
 * into existing library tag categories
 *
 * Run with: npx ts-node src/scripts/map-anarchist-tags.ts
 * Output: CSV file with tag mappings for manual review
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { logger } from '@/lib/utils/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TagMapping {
  tagName: string;
  tagCount: number;
  suggestedCategory: string;
  suggestedCategoryColor: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface CsvRow {
  tagName: string;
  tagCount: string;
  suggestedCategory: string;
  categoryColor: string;
  confidence: string;
  reason: string;
}

// Predefined library categories and keywords
const LIBRARY_CATEGORIES = [
  {
    name: 'Political Theory',
    color: '#FF6B6B',
    keywords: [
      'anarchism',
      'anarchist',
      'anarcho',
      'politics',
      'political',
      'theory',
      'socialism',
      'communism',
      'marxism',
      'libertarian',
      'authority',
      'state',
      'revolution',
      'resistance',
      'rebellion',
      'oppression',
      'liberation',
    ],
  },
  {
    name: 'Economics',
    color: '#4ECDC4',
    keywords: [
      'economics',
      'economy',
      'capitalism',
      'labor',
      'work',
      'wage',
      'trade',
      'business',
      'market',
      'money',
      'currency',
      'finance',
      'wealth',
      'cooperative',
      'mutual',
      'aid',
    ],
  },
  {
    name: 'Social Justice',
    color: '#95E1D3',
    keywords: [
      'justice',
      'equality',
      'rights',
      'discrimination',
      'racism',
      'sexism',
      'gender',
      'identity',
      'queer',
      'lgbtq',
      'feminist',
      'feminism',
      'disability',
      'class',
      'intersectional',
      'oppression',
    ],
  },
  {
    name: 'Technology & Science',
    color: '#A8E6CF',
    keywords: [
      'technology',
      'tech',
      'science',
      'computing',
      'digital',
      'artificial',
      'intelligence',
      'internet',
      'algorithm',
      'data',
      'cyber',
      'software',
    ],
  },
  {
    name: 'History',
    color: '#FFD3B6',
    keywords: [
      'history',
      'historical',
      'past',
      'century',
      'war',
      'revolution',
      'movement',
      'struggle',
      'labor',
      'civil',
      'rights',
      'era',
      'period',
    ],
  },
  {
    name: 'Education & Culture',
    color: '#FFAAA5',
    keywords: [
      'education',
      'pedagogy',
      'learning',
      'school',
      'culture',
      'art',
      'literature',
      'philosophy',
      'religion',
      'spiritual',
      'knowledge',
      'consciousness',
      'culture',
      'society',
    ],
  },
  {
    name: 'Environment & Ecology',
    color: '#76C7AD',
    keywords: [
      'environment',
      'ecology',
      'ecological',
      'nature',
      'climate',
      'land',
      'green',
      'sustainable',
      'conservation',
      'permaculture',
      'indigenous',
      'forest',
      'water',
      'soil',
      'animal',
    ],
  },
  {
    name: 'Community & Organization',
    color: '#FFDDC1',
    keywords: [
      'community',
      'organization',
      'collective',
      'group',
      'network',
      'assembly',
      'direct',
      'action',
      'consensus',
      'structure',
      'power',
      'hierarchy',
      'cooperation',
      'solidarity',
    ],
  },
];

// Categorize a tag based on keyword matching
function categorizeTag(tagName: string): {
  category: string;
  color: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const lowerTag = tagName.toLowerCase();

  // Find exact category matches
  for (const category of LIBRARY_CATEGORIES) {
    if (category.keywords.some(keyword => lowerTag.includes(keyword))) {
      // Check if tag exactly matches a keyword
      const exactMatch = category.keywords.some(keyword => keyword === lowerTag);
      return {
        category: category.name,
        color: category.color,
        confidence: exactMatch ? 'high' : 'medium',
        reason: exactMatch ? 'Exact keyword match' : 'Contains category keyword',
      };
    }
  }

  // Default to "Political Theory" as catch-all category
  return {
    category: 'Political Theory',
    color: '#FF6B6B',
    confidence: 'low',
    reason: 'No keyword match - requires manual review',
  };
}

async function mapAnarchistTags() {
  logger.info('🏷️  Starting anarchist tag categorization...\n');

  try {
    // Fetch all anarchist documents with their tags
    const { data: anarchistDocs, error } = await supabase
      .from('anarchist_documents')
      .select('id, tags');

    if (error) throw new Error(`Failed to fetch anarchist documents: ${error.message}`);

    logger.info(`📜 Loaded ${anarchistDocs?.length || 0} anarchist documents\n`);

    // Extract and count unique tags
    const tagCounts: Map<string, number> = new Map();

    for (const doc of anarchistDocs || []) {
      const tags = (doc.tags as string[]) || [];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    logger.info(`🏷️  Found ${tagCounts.size} unique tags\n`);

    // Categorize each tag
    const tagMappings: TagMapping[] = Array.from(tagCounts.entries())
      .map(([tagName, count]) => {
        const { category, color, confidence, reason } = categorizeTag(tagName);
        return {
          tagName,
          tagCount: count,
          suggestedCategory: category,
          suggestedCategoryColor: color,
          confidence,
          reason,
        };
      })
      .sort((a, b) => b.tagCount - a.tagCount); // Sort by frequency

    // Convert to CSV format
    const csvRows: CsvRow[] = tagMappings.map(mapping => ({
      tagName: mapping.tagName,
      tagCount: mapping.tagCount.toString(),
      suggestedCategory: mapping.suggestedCategory,
      categoryColor: mapping.suggestedCategoryColor,
      confidence: mapping.confidence,
      reason: mapping.reason,
    }));

    // Write CSV file
    const outputPath = path.join(process.cwd(), 'anarchist-tags-review.csv');
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'tagName', title: 'Tag Name' },
        { id: 'tagCount', title: 'Document Count' },
        { id: 'suggestedCategory', title: 'Suggested Category' },
        { id: 'categoryColor', title: 'Category Color' },
        { id: 'confidence', title: 'Confidence' },
        { id: 'reason', title: 'Reason' },
      ],
    });

    await csvWriter.writeRecords(csvRows);
    logger.info(`📄 CSV file written to: ${outputPath}\n`);

    // Summary statistics
    const highConfidence = tagMappings.filter(t => t.confidence === 'high').length;
    const mediumConfidence = tagMappings.filter(t => t.confidence === 'medium').length;
    const lowConfidence = tagMappings.filter(t => t.confidence === 'low').length;

    logger.info('📊 Summary:');
    logger.info(`   Total unique tags: ${tagCounts.size}`);
    logger.info(`   High confidence: ${highConfidence}`);
    logger.info(`   Medium confidence: ${mediumConfidence}`);
    logger.info(`   Low confidence (needs review): ${lowConfidence}`);
    logger.info('\n📋 Category breakdown:');

    const categoryCounts: Map<string, number> = new Map();
    for (const mapping of tagMappings) {
      categoryCounts.set(
        mapping.suggestedCategory,
        (categoryCounts.get(mapping.suggestedCategory) || 0) + mapping.tagCount
      );
    }

    for (const [category, count] of Array.from(categoryCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )) {
      logger.info(`   ${category}: ${count} documents`);
    }

    logger.info('\n📝 Next steps:');
    logger.info('   1. Review anarchist-tags-review.csv');
    logger.info('   2. Edit suggested categories if needed');
    logger.info('   3. Delete rows for irrelevant tags (or edit category to "Skip")');
    logger.info('   4. Run: npx ts-node src/scripts/import-anarchist-tags.ts');
  } catch (error) {
    logger.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

mapAnarchistTags();
