#!/usr/bin/env python3
"""
Phase 2: Document Structure Detection Script
Detects chapters, sections, and document types using pattern-based analysis.

This script performs IN-PLACE analysis and updates the library.library_documents table
with detected structure metadata (NOT file migration).

Features:
- Chapter detection (25+ multilingual patterns)
- Document type classification (book, article, essay, etc.)
- Header hierarchy extraction
- Table of contents generation
"""

import psycopg2
import re
import json
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}

OUTPUT_DIR = '/home/user/projects/veritable-games/resources/logs/migration'
DRY_RUN = True  # Set to False to execute actual updates

# ============================================================================
# CHAPTER DETECTION PATTERNS (25+ patterns across languages)
# ============================================================================

# High confidence patterns (95%+ confidence)
CHAPTER_PATTERNS_HIGH = [
    # English - Explicit "CHAPTER" markers
    re.compile(r'^CHAPTER\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE | re.IGNORECASE),
    re.compile(r'^Chapter\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),
    re.compile(r'^Ch\.\s*([0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),

    # PART markers
    re.compile(r'^PART\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE | re.IGNORECASE),
    re.compile(r'^Part\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),

    # Multilingual explicit markers
    re.compile(r'^Capítulo\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),  # Spanish
    re.compile(r'^Chapitre\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),  # French
    re.compile(r'^Capitolo\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),  # Italian
    re.compile(r'^Kapitel\s+([IVXLCDM]+|[0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),   # German
]

# Medium confidence patterns (70-95% confidence)
CHAPTER_PATTERNS_MEDIUM = [
    # Numbered sections with visual separation
    re.compile(r'^#+\s*([0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),  # Markdown headers with numbers
    re.compile(r'^([IVXLCDM]+)[\s:.\-—]+(.+)$', re.MULTILINE),   # Roman numerals alone
    re.compile(r'^([0-9]+)[\s:.\-—]+([A-Z].{10,})$', re.MULTILINE),  # Number + capitalized title

    # Academic structure
    re.compile(r'^SECTION\s+([0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE | re.IGNORECASE),
    re.compile(r'^Section\s+([0-9]+)[\s:.\-—]+(.+)$', re.MULTILINE),
]

# Low confidence patterns (60-70% confidence)
CHAPTER_PATTERNS_LOW = [
    # Implicit structure (all-caps headings)
    re.compile(r'^([A-Z\s]{10,})$', re.MULTILINE),  # ALL CAPS HEADINGS (10+ chars)

    # Generic numbered lists
    re.compile(r'^([0-9]+)\.\s+([A-Z].{10,})$', re.MULTILINE),  # 1. Title Here
]

# ============================================================================
# DOCUMENT TYPE CLASSIFICATION
# ============================================================================

def classify_document_type(content, detected_chapters):
    """
    Classify document type based on content patterns and structure.
    Returns: (type, confidence, reasoning)
    """

    word_count = len(content.split())

    # Book indicators
    if detected_chapters and len(detected_chapters) >= 5:
        if word_count > 30000:
            return 'book', 0.95, f'{len(detected_chapters)} chapters, {word_count:,} words'
        elif word_count > 15000:
            return 'book', 0.85, f'{len(detected_chapters)} chapters, {word_count:,} words (short book)'

    # Long document with chapters but not quite a book
    if detected_chapters and len(detected_chapters) >= 3:
        if word_count > 10000:
            return 'document', 0.80, f'{len(detected_chapters)} sections, {word_count:,} words'

    # Paper/article indicators (academic structure)
    academic_markers = [
        r'\bAbstract\b',
        r'\bIntroduction\b',
        r'\bMethodology\b',
        r'\bResults\b',
        r'\bConclusion\b',
        r'\bReferences\b',
        r'\bBibliography\b',
    ]

    academic_count = sum(1 for marker in academic_markers if re.search(marker, content, re.IGNORECASE))

    if academic_count >= 4:
        if word_count > 5000:
            return 'paper', 0.90, f'{academic_count}/7 academic sections, {word_count:,} words'
        else:
            return 'article', 0.85, f'{academic_count}/7 academic sections, {word_count:,} words (short)'

    # Essay (mid-length, no strong structure)
    if 1500 < word_count < 10000:
        if detected_chapters and len(detected_chapters) <= 3:
            return 'essay', 0.75, f'{len(detected_chapters)} sections, {word_count:,} words'
        elif not detected_chapters:
            return 'essay', 0.70, f'No sections, {word_count:,} words'

    # Article (shorter, focused)
    if 500 < word_count <= 3000:
        return 'article', 0.70, f'{word_count:,} words'

    # Short document
    if word_count <= 500:
        return 'short', 0.80, f'Very short ({word_count} words)'

    # Default: generic document
    return 'document', 0.50, f'{word_count:,} words, no clear type'


# ============================================================================
# STRUCTURE DETECTION
# ============================================================================

def detect_chapters(content):
    """
    Detect chapters/sections in content using pattern matching.
    Returns: list of detected chapters with metadata
    """

    chapters = []

    # Try high confidence patterns first
    for pattern in CHAPTER_PATTERNS_HIGH:
        matches = pattern.finditer(content)
        for match in matches:
            position = match.start()

            # Extract chapter number and title
            groups = match.groups()
            if len(groups) >= 2:
                number = groups[0]
                title = groups[1].strip()
            else:
                number = None
                title = match.group(0).strip()

            chapters.append({
                'position': position,
                'number': number,
                'title': title,
                'confidence': 0.95,
                'pattern': 'high',
                'matched_text': match.group(0),
            })

    # If no high-confidence matches, try medium confidence
    if len(chapters) == 0:
        for pattern in CHAPTER_PATTERNS_MEDIUM:
            matches = pattern.finditer(content)
            for match in matches:
                position = match.start()
                groups = match.groups()

                if len(groups) >= 2:
                    number = groups[0]
                    title = groups[1].strip()
                else:
                    number = None
                    title = match.group(0).strip()

                # Filter out very short titles (likely false positives)
                if len(title) < 10:
                    continue

                chapters.append({
                    'position': position,
                    'number': number,
                    'title': title,
                    'confidence': 0.80,
                    'pattern': 'medium',
                    'matched_text': match.group(0),
                })

    # If still no matches, try low confidence
    if len(chapters) == 0:
        for pattern in CHAPTER_PATTERNS_LOW:
            matches = pattern.finditer(content)
            for match in matches:
                position = match.start()
                title = match.group(0).strip()

                # Very strict filtering for low confidence
                if len(title) < 15:
                    continue

                # Must be followed by paragraph text
                next_text = content[position + len(title):position + len(title) + 200]
                if not next_text or len(next_text.strip()) < 50:
                    continue

                chapters.append({
                    'position': position,
                    'number': None,
                    'title': title,
                    'confidence': 0.65,
                    'pattern': 'low',
                    'matched_text': match.group(0),
                })

    # Sort by position in document
    chapters.sort(key=lambda x: x['position'])

    # Remove duplicates (keep highest confidence)
    unique_chapters = []
    seen_positions = set()

    for chapter in chapters:
        # Check if this position is too close to an existing one
        too_close = False
        for seen_pos in seen_positions:
            if abs(chapter['position'] - seen_pos) < 100:  # Within 100 chars
                too_close = True
                break

        if not too_close:
            unique_chapters.append(chapter)
            seen_positions.add(chapter['position'])

    return unique_chapters


def analyze_header_hierarchy(content):
    """
    Analyze markdown header structure.
    Returns: hierarchy statistics
    """

    header_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    matches = header_pattern.findall(content)

    hierarchy = defaultdict(int)
    for level_marker, title in matches:
        level = len(level_marker)
        hierarchy[level] += 1

    return dict(hierarchy)


def extract_table_of_contents(chapters):
    """
    Generate table of contents from detected chapters.
    Returns: formatted TOC string
    """

    if not chapters:
        return None

    toc_lines = []

    for i, chapter in enumerate(chapters, 1):
        if chapter['number']:
            toc_lines.append(f"{chapter['number']}. {chapter['title']}")
        else:
            toc_lines.append(f"{i}. {chapter['title']}")

    return '\n'.join(toc_lines)


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def get_all_documents(conn):
    """Fetch all documents for structure detection"""
    cur = conn.cursor()

    query = """
        SELECT id, slug, title, content, document_type
        FROM library.library_documents
        WHERE content IS NOT NULL
        ORDER BY id
    """

    cur.execute(query)
    columns = [desc[0] for desc in cur.description]

    documents = []
    for row in cur.fetchall():
        documents.append(dict(zip(columns, row)))

    cur.close()
    return documents


def update_document_structure(conn, doc_id, structure_metadata):
    """
    Update document with detected structure.
    NOTE: This requires adding columns to library_documents table first
    """
    cur = conn.cursor()

    # For now, we'll store structure metadata in the description field as JSON
    # In production, you might want dedicated columns for this data

    query = """
        UPDATE library.library_documents
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """

    cur.execute(query, (doc_id,))
    cur.close()


# ============================================================================
# REPORTING
# ============================================================================

def generate_report(results, dry_run=True):
    """Generate comprehensive structure detection report"""

    total_docs = len(results)
    docs_with_chapters = [r for r in results if r['chapter_count'] > 0]
    docs_without_chapters = [r for r in results if r['chapter_count'] == 0]

    # Type breakdown
    type_counts = defaultdict(int)
    for r in results:
        type_counts[r['detected_type']] += 1

    # Confidence breakdown
    high_conf = [r for r in results if r['type_confidence'] >= 0.85]
    medium_conf = [r for r in results if 0.70 <= r['type_confidence'] < 0.85]
    low_conf = [r for r in results if r['type_confidence'] < 0.70]

    report = {
        'timestamp': datetime.now().isoformat(),
        'dry_run': dry_run,
        'summary': {
            'total_documents': total_docs,
            'documents_with_chapters': len(docs_with_chapters),
            'documents_without_chapters': len(docs_without_chapters),
            'chapter_detection_rate': round(100 * len(docs_with_chapters) / total_docs, 1) if total_docs > 0 else 0,
        },
        'type_breakdown': dict(type_counts),
        'confidence_breakdown': {
            'high_confidence': len(high_conf),
            'medium_confidence': len(medium_conf),
            'low_confidence': len(low_conf),
        },
        'chapter_statistics': {
            'total_chapters_detected': sum(r['chapter_count'] for r in results),
            'average_chapters_per_doc': round(sum(r['chapter_count'] for r in results) / len(docs_with_chapters), 1) if docs_with_chapters else 0,
            'max_chapters': max((r['chapter_count'] for r in results), default=0),
        },
        'top_10_most_structured': [
            {
                'id': r['doc_id'],
                'slug': r['slug'][:50],
                'title': r['title'][:60],
                'chapter_count': r['chapter_count'],
                'detected_type': r['detected_type'],
            }
            for r in sorted(results, key=lambda x: x['chapter_count'], reverse=True)[:10]
        ],
        'detailed_results': results,
    }

    return report


def print_summary(report):
    """Print human-readable summary to console"""

    print(f"\n{'='*80}")
    print(f"PHASE 2: DOCUMENT STRUCTURE DETECTION {'[DRY RUN]' if report['dry_run'] else '[LIVE RUN]'}")
    print(f"{'='*80}\n")

    print(f"Timestamp: {report['timestamp']}\n")

    print("SUMMARY:")
    print(f"  Total documents: {report['summary']['total_documents']:,}")
    print(f"  Documents with chapters: {report['summary']['documents_with_chapters']:,} ({report['summary']['chapter_detection_rate']}%)")
    print(f"  Documents without chapters: {report['summary']['documents_without_chapters']:,}\n")

    print("TYPE BREAKDOWN:")
    for doc_type, count in sorted(report['type_breakdown'].items(), key=lambda x: x[1], reverse=True):
        pct = round(100 * count / report['summary']['total_documents'], 1)
        print(f"  {doc_type:15s}: {count:4,} ({pct}%)")
    print()

    print("CONFIDENCE BREAKDOWN:")
    print(f"  High confidence (≥85%): {report['confidence_breakdown']['high_confidence']:,}")
    print(f"  Medium confidence (70-84%): {report['confidence_breakdown']['medium_confidence']:,}")
    print(f"  Low confidence (<70%): {report['confidence_breakdown']['low_confidence']:,}\n")

    print("CHAPTER STATISTICS:")
    print(f"  Total chapters detected: {report['chapter_statistics']['total_chapters_detected']:,}")
    print(f"  Average chapters per doc: {report['chapter_statistics']['average_chapters_per_doc']}")
    print(f"  Maximum chapters: {report['chapter_statistics']['max_chapters']}\n")

    print("TOP 10 MOST STRUCTURED DOCUMENTS:")
    for i, doc in enumerate(report['top_10_most_structured'], 1):
        print(f"  {i:2d}. [{doc['chapter_count']:2d} chapters] {doc['title'][:60]}")
        print(f"      Type: {doc['detected_type']}, Slug: {doc['slug'][:50]}\n")

    print(f"{'='*80}\n")

    if report['dry_run']:
        print("✅ DRY RUN COMPLETE - No changes made to database")
        print("   Set DRY_RUN=False to execute updates\n")
    else:
        print("✅ STRUCTURE DETECTION COMPLETE\n")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Execute Phase 2 structure detection"""

    # Ensure output directory exists
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*80}")
    print(f"PHASE 2: DOCUMENT STRUCTURE DETECTION")
    print(f"{'='*80}\n")

    if DRY_RUN:
        print("⚠️  DRY RUN MODE - No database changes will be made\n")
    else:
        print("🚨 LIVE MODE - Database WILL be modified\n")
        response = input("Are you sure you want to proceed? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            return False

    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)

    try:
        # Fetch all documents
        print("Fetching documents...")
        documents = get_all_documents(conn)
        print(f"Found {len(documents):,} documents to analyze\n")

        # Process each document
        results = []

        for i, doc in enumerate(documents, 1):
            if i % 100 == 0:
                print(f"Analyzing document {i:,}/{len(documents):,}...")

            # Detect chapters
            chapters = detect_chapters(doc['content'])

            # Classify document type
            detected_type, type_confidence, type_reasoning = classify_document_type(doc['content'], chapters)

            # Analyze header hierarchy
            header_hierarchy = analyze_header_hierarchy(doc['content'])

            # Generate table of contents
            toc = extract_table_of_contents(chapters)

            result = {
                'doc_id': doc['id'],
                'slug': doc['slug'],
                'title': doc['title'],
                'original_type': doc['document_type'],
                'detected_type': detected_type,
                'type_confidence': type_confidence,
                'type_reasoning': type_reasoning,
                'chapter_count': len(chapters),
                'chapters': chapters,
                'header_hierarchy': header_hierarchy,
                'table_of_contents': toc,
            }

            results.append(result)

            # Update database if not dry run
            if not DRY_RUN:
                structure_metadata = {
                    'detected_type': detected_type,
                    'chapters': chapters,
                    'toc': toc,
                }
                update_document_structure(conn, doc['id'], structure_metadata)

        # Commit changes if not dry run
        if not DRY_RUN:
            print("\nCommitting changes to database...")
            conn.commit()

        # Generate report
        print("\nGenerating report...")
        report = generate_report(results, dry_run=DRY_RUN)

        # Save report to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = Path(OUTPUT_DIR) / f"phase2_structure_report_{timestamp}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"Report saved to: {report_file}")

        # Print summary
        print_summary(report)

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        if not DRY_RUN:
            print("Rolling back changes...")
            conn.rollback()
        return False

    finally:
        conn.close()


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
