/**
 * Translation Detection Script
 * Identifies documents that are likely translations of each other
 * by matching: normalized title + author + different language
 *
 * Run with: npx ts-node src/scripts/detect-translations.ts
 * Output: CSV file with potential translations for manual review
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

interface Document {
  id: string;
  title: string;
  author?: string;
  language: string;
  slug: string;
  source: 'library' | 'anarchist';
}

interface TranslationGroup {
  groupId: string;
  documents: Document[];
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface CsvRow {
  groupId: string;
  confidence: string;
  reason: string;
  documentIds: string;
  titles: string;
  authors: string;
  languages: string;
  slugs: string;
}

// Normalize title for comparison: lowercase, remove punctuation, extra spaces
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Calculate string similarity (Levenshtein distance)
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(longer: string, shorter: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return costs[shorter.length];
}

// Detect translations for a single document
function findTranslations(document: Document, allDocuments: Document[]): Document[] {
  const normalizedTitle = normalizeTitle(document.title);
  const candidates = allDocuments.filter(
    doc =>
      doc.id !== document.id &&
      doc.language !== document.language && // Different language
      doc.source === document.source // Same source (don't mix library and anarchist)
  );

  const matches: { doc: Document; score: number }[] = [];

  for (const candidate of candidates) {
    const normalizedCandidateTitle = normalizeTitle(candidate.title);

    // Title similarity threshold: 0.7 (70% similar)
    const titleSimilarity = stringSimilarity(normalizedTitle, normalizedCandidateTitle);

    // Author match (exact or both missing)
    const authorMatch =
      document.author === candidate.author || (!document.author && !candidate.author);

    if (titleSimilarity >= 0.7 && authorMatch) {
      matches.push({
        doc: candidate,
        score: titleSimilarity,
      });
    }
  }

  // Sort by similarity score and return matches
  return matches.sort((a, b) => b.score - a.score).map(m => m.doc);
}

async function detectTranslations() {
  logger.info('🔍 Starting translation detection...\n');

  try {
    // Fetch all library documents
    const { data: libraryDocs, error: libError } = await supabase
      .from('documents')
      .select('id, title, author, language, slug');

    if (libError) throw new Error(`Failed to fetch library documents: ${libError.message}`);

    // Fetch all anarchist documents
    const { data: anarchistDocs, error: anarError } = await supabase
      .from('anarchist_documents')
      .select('id, title, author, language, slug');

    if (anarError) throw new Error(`Failed to fetch anarchist documents: ${anarError.message}`);

    // Combine and normalize
    const allDocuments: Document[] = [
      ...(libraryDocs || []).map(doc => ({
        ...doc,
        source: 'library' as const,
      })),
      ...(anarchistDocs || []).map(doc => ({
        ...doc,
        source: 'anarchist' as const,
      })),
    ];

    logger.info(`📚 Loaded ${libraryDocs?.length || 0} library documents`);
    logger.info(`📜 Loaded ${anarchistDocs?.length || 0} anarchist documents\n`);

    // Find translation groups
    const translationGroups: Map<string, TranslationGroup> = new Map();
    const processedIds: Set<string> = new Set();

    for (const document of allDocuments) {
      if (processedIds.has(document.id)) continue;

      const translations = findTranslations(document, allDocuments);

      if (translations.length > 0) {
        const groupId = `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const groupDocuments = [document, ...translations];

        // Mark all documents in group as processed
        groupDocuments.forEach(doc => processedIds.add(doc.id));

        translationGroups.set(groupId, {
          groupId,
          documents: groupDocuments,
          confidence: translations.length >= 2 ? 'high' : 'medium',
          reason: `${translations.length} translation(s) detected based on title similarity and author match`,
        });
      }
    }

    logger.info(`✅ Found ${translationGroups.size} potential translation groups\n`);

    // Convert to CSV format
    const csvRows: CsvRow[] = Array.from(translationGroups.values()).map(group => ({
      groupId: group.groupId,
      confidence: group.confidence,
      reason: group.reason,
      documentIds: group.documents.map(d => `${d.source}:${d.id}`).join('|'),
      titles: group.documents.map(d => d.title).join('|'),
      authors: group.documents.map(d => d.author || 'N/A').join('|'),
      languages: group.documents.map(d => d.language).join('|'),
      slugs: group.documents.map(d => `/${d.source}/${d.slug}`).join('|'),
    }));

    // Write CSV file
    const outputPath = path.join(process.cwd(), 'translations-review.csv');
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'groupId', title: 'Group ID' },
        { id: 'confidence', title: 'Confidence' },
        { id: 'reason', title: 'Reason' },
        { id: 'documentIds', title: 'Document IDs' },
        { id: 'titles', title: 'Titles' },
        { id: 'authors', title: 'Authors' },
        { id: 'languages', title: 'Languages' },
        { id: 'slugs', title: 'Slugs' },
      ],
    });

    await csvWriter.writeRecords(csvRows);
    logger.info(`📄 CSV file written to: ${outputPath}\n`);

    // Summary statistics
    const totalDocumentsInGroups = Array.from(translationGroups.values()).reduce(
      (sum, group) => sum + group.documents.length,
      0
    );

    logger.info('📊 Summary:');
    logger.info(`   Total translation groups: ${translationGroups.size}`);
    logger.info(`   Documents with translations: ${totalDocumentsInGroups}`);
    logger.info(
      `   Documents without translations: ${allDocuments.length - totalDocumentsInGroups}`
    );
    logger.info('\n📝 Next steps:');
    logger.info('   1. Review translations-review.csv');
    logger.info('   2. Edit confidence levels if needed');
    logger.info('   3. Remove incorrect groups (delete rows)');
    logger.info('   4. Run: npx ts-node src/scripts/import-translations.ts');
  } catch (error) {
    logger.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

detectTranslations();
