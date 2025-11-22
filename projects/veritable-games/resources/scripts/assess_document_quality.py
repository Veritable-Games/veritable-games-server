#!/usr/bin/env python3
"""
Phase 3: Document Quality Assessment Script
Analyzes cleaned documents for formatting quality and severity of issues.

Implements 5-category weighted scoring system:
- Content Corruption (10x weight): Critical - mojibake, binary, truncation
- Structure Destruction (5x weight): Severe - wall of text, nested artifacts
- Semantic Loss (5x weight): Severe - missing sections, out-of-order
- Formatting Artifacts (1x weight): Minor - whitespace, markdown syntax
- Metadata Issues (0.5x weight): Trivial - missing author/date

Total Score: 0-100 points (lower is better)
Action Thresholds:
  0-20: Auto-migrate (no review needed)
  21-50: Flag for review (minor issues)
  51-80: Priority review (major issues)
  81-100: Block migration (critical issues)
"""

import psycopg2
import re
import json
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import unicodedata

# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}

OUTPUT_DIR = '/home/user/projects/veritable-games/resources/logs/migration'
DRY_RUN = True  # Set to False to write results to database

# ============================================================================
# QUALITY SCORING WEIGHTS
# ============================================================================

WEIGHTS = {
    'content_corruption': 10.0,      # Critical
    'structure_destruction': 5.0,    # Severe
    'semantic_loss': 5.0,            # Severe
    'formatting_artifacts': 1.0,     # Minor
    'metadata_issues': 0.5,          # Trivial
}

# Maximum points per category (before weighting)
MAX_POINTS_PER_CATEGORY = 10

# Action thresholds
THRESHOLDS = {
    'auto_migrate': 20,       # 0-20: No review needed
    'flag_review': 50,        # 21-50: Minor issues
    'priority_review': 80,    # 51-80: Major issues
    'block': 100,             # 81-100: Critical issues
}


# ============================================================================
# CATEGORY 1: CONTENT CORRUPTION (10x weight)
# ============================================================================

def assess_content_corruption(content):
    """
    Detect critical content corruption issues.
    Returns: (score 0-10, issues_found)
    """

    issues = []
    score = 0

    # 1. Mojibake detection (encoding issues)
    mojibake_patterns = [
        re.compile(r'Ã[©èê]'),  # Common UTF-8 → Latin1 corruption
        re.compile(r'â€™'),      # Smart quote corruption
        re.compile(r'â€œ'),      # Smart quote corruption
        re.compile(r'Ã¢'),      # â corruption
        re.compile(r'â€"'),     # Em dash corruption
    ]

    mojibake_count = 0
    for pattern in mojibake_patterns:
        matches = pattern.findall(content)
        mojibake_count += len(matches)

    if mojibake_count > 100:
        score += 10
        issues.append(f'Severe mojibake: {mojibake_count} instances')
    elif mojibake_count > 50:
        score += 7
        issues.append(f'Major mojibake: {mojibake_count} instances')
    elif mojibake_count > 10:
        score += 4
        issues.append(f'Moderate mojibake: {mojibake_count} instances')
    elif mojibake_count > 0:
        score += 2
        issues.append(f'Minor mojibake: {mojibake_count} instances')

    # 2. Binary/non-text content
    binary_chars = sum(1 for c in content if ord(c) < 32 and c not in '\n\r\t')
    if binary_chars > 100:
        score = 10  # Maximum penalty
        issues.append(f'Binary content detected: {binary_chars} non-printable chars')
    elif binary_chars > 50:
        score += 5
        issues.append(f'Possible binary content: {binary_chars} non-printable chars')

    # 3. Truncation indicators
    truncation_markers = [
        r'\[content truncated\]',
        r'\.\.\.$',  # Ends with ...
        r'[A-Za-z]{50,}$',  # Ends with very long word (likely truncated)
    ]

    for marker in truncation_markers:
        if re.search(marker, content):
            score += 3
            issues.append(f'Truncation indicator: {marker}')
            break

    # 4. OCR failure patterns
    ocr_failure_patterns = [
        re.compile(r'[a-z]{1,2}\s+[a-z]{1,2}\s+[a-z]{1,2}'),  # Fragmented words: l e t t e r s
        re.compile(r'[0-9]{3,}\s+[0-9]{3,}'),  # Random number sequences
    ]

    ocr_failures = 0
    for pattern in ocr_failure_patterns:
        matches = pattern.findall(content)
        ocr_failures += len(matches)

    if ocr_failures > 50:
        score += 5
        issues.append(f'OCR failure: {ocr_failures} fragmented sequences')
    elif ocr_failures > 20:
        score += 3
        issues.append(f'Possible OCR issues: {ocr_failures} sequences')

    # Cap at 10
    return min(score, 10), issues


# ============================================================================
# CATEGORY 2: STRUCTURE DESTRUCTION (5x weight)
# ============================================================================

def assess_structure_destruction(content):
    """
    Detect severe structural issues.
    Returns: (score 0-10, issues_found)
    """

    issues = []
    score = 0

    lines = content.split('\n')
    words = content.split()

    # 1. Wall of text (no paragraph breaks)
    if len(words) > 1000:
        paragraph_breaks = content.count('\n\n')
        expected_breaks = len(words) / 200  # Expect a break every ~200 words

        if paragraph_breaks < expected_breaks / 4:
            score += 8
            issues.append(f'Wall of text: {paragraph_breaks} breaks for {len(words)} words')
        elif paragraph_breaks < expected_breaks / 2:
            score += 5
            issues.append(f'Poor paragraphing: {paragraph_breaks} breaks for {len(words)} words')

    # 2. Nested artifact remnants (artifacts within artifacts)
    nested_patterns = [
        r'##\s*##',  # Double page markers
        r'```\s*```',  # Empty code blocks
        r'!\[.*?\]\(.*?\).*?!\[.*?\]\(.*?\)',  # Consecutive broken images
    ]

    for pattern in nested_patterns:
        matches = re.findall(pattern, content)
        if len(matches) > 5:
            score += 4
            issues.append(f'Nested artifacts: {len(matches)} instances of {pattern}')

    # 3. Table parsing failures
    table_corruption_markers = [
        r'\|\s*\|',  # Empty table cells
        r'\|{5,}',   # Many consecutive pipes
    ]

    for marker in table_corruption_markers:
        matches = re.findall(marker, content)
        if len(matches) > 10:
            score += 3
            issues.append(f'Table corruption: {len(matches)} broken tables')

    # 4. Header hierarchy broken
    header_pattern = re.compile(r'^(#{1,6})\s', re.MULTILINE)
    headers = header_pattern.findall(content)

    if headers:
        levels = [len(h) for h in headers]
        # Check for weird jumps (e.g., # then ######)
        for i in range(len(levels) - 1):
            if levels[i+1] - levels[i] > 2:
                score += 2
                issues.append('Broken header hierarchy')
                break

    # Cap at 10
    return min(score, 10), issues


# ============================================================================
# CATEGORY 3: SEMANTIC LOSS (5x weight)
# ============================================================================

def assess_semantic_loss(content, title):
    """
    Detect loss of meaning or content.
    Returns: (score 0-10, issues_found)
    """

    issues = []
    score = 0

    # 1. Missing common sections (for longer documents)
    words = content.split()
    if len(words) > 5000:  # Books/long documents
        expected_sections = [
            r'\bIntroduction\b',
            r'\bConclusion\b',
        ]

        missing_sections = []
        for section in expected_sections:
            if not re.search(section, content, re.IGNORECASE):
                missing_sections.append(section)

        if len(missing_sections) == 2:
            score += 5
            issues.append('Missing introduction and conclusion')

    # 2. Out-of-order content markers
    # Check if page numbers are out of order (remnants of pagination)
    page_numbers = re.findall(r'(?:^|\s)(\d{1,4})(?:\s|$)', content)
    if len(page_numbers) > 10:
        # Sample every 10th page number
        sampled = [int(n) for n in page_numbers[::10] if n.isdigit()]
        if len(sampled) > 3:
            is_ordered = all(sampled[i] <= sampled[i+1] for i in range(len(sampled) - 1))
            if not is_ordered:
                score += 6
                issues.append('Content appears out of order (page numbers)')

    # 3. Excessive repetition (copy-paste errors)
    # Check for repeated paragraphs
    paragraphs = content.split('\n\n')
    unique_paragraphs = set(p.strip() for p in paragraphs if len(p.strip()) > 50)
    if paragraphs and len(unique_paragraphs) / len(paragraphs) < 0.7:
        score += 4
        issues.append(f'Excessive repetition: {len(paragraphs) - len(unique_paragraphs)} duplicate paragraphs')

    # 4. Title not found in content
    if title and len(title) > 5:
        # Normalize title for search
        title_normalized = re.sub(r'[^a-z0-9\s]', '', title.lower())
        content_normalized = re.sub(r'[^a-z0-9\s]', '', content.lower())

        if title_normalized not in content_normalized:
            score += 2
            issues.append('Title not found in content')

    # Cap at 10
    return min(score, 10), issues


# ============================================================================
# CATEGORY 4: FORMATTING ARTIFACTS (1x weight)
# ============================================================================

def assess_formatting_artifacts(content):
    """
    Detect minor formatting issues.
    Returns: (score 0-10, issues_found)
    """

    issues = []
    score = 0

    # 1. Excessive whitespace
    excessive_newlines = re.findall(r'\n{4,}', content)
    if len(excessive_newlines) > 20:
        score += 3
        issues.append(f'Excessive newlines: {len(excessive_newlines)} instances')

    trailing_spaces = re.findall(r' {3,}$', content, re.MULTILINE)
    if len(trailing_spaces) > 50:
        score += 2
        issues.append(f'Trailing spaces: {len(trailing_spaces)} lines')

    # 2. Broken markdown syntax
    broken_links = re.findall(r'\[([^\]]+)\]\((?!\s*http)', content)
    if len(broken_links) > 10:
        score += 3
        issues.append(f'Broken links: {len(broken_links)} instances')

    # 3. Inconsistent list markers
    list_markers = re.findall(r'^[\*\-\+]\s', content, re.MULTILINE)
    if list_markers:
        unique_markers = set(list_markers)
        if len(unique_markers) > 1:
            score += 1
            issues.append(f'Inconsistent list markers: {unique_markers}')

    # 4. Smart quotes not normalized
    smart_quotes = re.findall(r'[""'']', content)
    if len(smart_quotes) > 50:
        score += 2
        issues.append(f'Smart quotes: {len(smart_quotes)} instances')

    # Cap at 10
    return min(score, 10), issues


# ============================================================================
# CATEGORY 5: METADATA ISSUES (0.5x weight)
# ============================================================================

def assess_metadata_issues(doc):
    """
    Detect missing or poor metadata.
    Returns: (score 0-10, issues_found)
    """

    issues = []
    score = 0

    # 1. Missing critical metadata
    if not doc.get('author'):
        score += 3
        issues.append('Missing author')

    if not doc.get('publication_date'):
        score += 2
        issues.append('Missing publication date')

    if not doc.get('description'):
        score += 2
        issues.append('Missing description')

    if not doc.get('abstract'):
        score += 1
        issues.append('Missing abstract')

    # 2. Poor quality metadata
    if doc.get('title'):
        # Check for generic/placeholder titles
        generic_titles = [
            'untitled',
            'document',
            'file',
            'page',
            'unknown',
        ]

        title_lower = doc['title'].lower()
        if any(generic in title_lower for generic in generic_titles):
            score += 2
            issues.append('Generic/placeholder title')

    # Cap at 10
    return min(score, 10), issues


# ============================================================================
# OVERALL QUALITY ASSESSMENT
# ============================================================================

def assess_document_quality(doc):
    """
    Comprehensive quality assessment of a document.
    Returns: quality report with overall score and action recommendation
    """

    content = doc.get('content', '')
    title = doc.get('title', '')

    # Assess each category
    corruption_score, corruption_issues = assess_content_corruption(content)
    structure_score, structure_issues = assess_structure_destruction(content)
    semantic_score, semantic_issues = assess_semantic_loss(content, title)
    formatting_score, formatting_issues = assess_formatting_artifacts(content)
    metadata_score, metadata_issues = assess_metadata_issues(doc)

    # Calculate weighted total score
    total_score = (
        corruption_score * WEIGHTS['content_corruption'] +
        structure_score * WEIGHTS['structure_destruction'] +
        semantic_score * WEIGHTS['semantic_loss'] +
        formatting_score * WEIGHTS['formatting_artifacts'] +
        metadata_score * WEIGHTS['metadata_issues']
    )

    # Normalize to 0-100 scale
    max_possible_score = sum(MAX_POINTS_PER_CATEGORY * weight for weight in WEIGHTS.values())
    normalized_score = min(100, (total_score / max_possible_score) * 100)

    # Determine action
    if normalized_score <= THRESHOLDS['auto_migrate']:
        action = 'auto_migrate'
        action_label = 'Auto-migrate (no review)'
    elif normalized_score <= THRESHOLDS['flag_review']:
        action = 'flag_review'
        action_label = 'Flag for review (minor issues)'
    elif normalized_score <= THRESHOLDS['priority_review']:
        action = 'priority_review'
        action_label = 'Priority review (major issues)'
    else:
        action = 'block'
        action_label = 'Block migration (critical issues)'

    return {
        'overall_score': round(normalized_score, 2),
        'action': action,
        'action_label': action_label,
        'category_scores': {
            'content_corruption': corruption_score,
            'structure_destruction': structure_score,
            'semantic_loss': semantic_score,
            'formatting_artifacts': formatting_score,
            'metadata_issues': metadata_score,
        },
        'weighted_scores': {
            'content_corruption': round(corruption_score * WEIGHTS['content_corruption'], 2),
            'structure_destruction': round(structure_score * WEIGHTS['structure_destruction'], 2),
            'semantic_loss': round(semantic_score * WEIGHTS['semantic_loss'], 2),
            'formatting_artifacts': round(formatting_score * WEIGHTS['formatting_artifacts'], 2),
            'metadata_issues': round(metadata_score * WEIGHTS['metadata_issues'], 2),
        },
        'issues': {
            'content_corruption': corruption_issues,
            'structure_destruction': structure_issues,
            'semantic_loss': semantic_issues,
            'formatting_artifacts': formatting_issues,
            'metadata_issues': metadata_issues,
        },
    }


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def get_all_documents(conn):
    """Fetch all documents for quality assessment"""
    cur = conn.cursor()

    query = """
        SELECT id, slug, title, author, publication_date, description,
               abstract, content, document_type
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


# ============================================================================
# REPORTING
# ============================================================================

def generate_report(results, dry_run=True):
    """Generate comprehensive quality assessment report"""

    total_docs = len(results)

    # Action breakdown
    action_counts = defaultdict(int)
    for r in results:
        action_counts[r['quality']['action']] += 1

    # Score distribution
    score_ranges = {
        '0-20': 0,
        '21-40': 0,
        '41-60': 0,
        '61-80': 0,
        '81-100': 0,
    }

    for r in results:
        score = r['quality']['overall_score']
        if score <= 20:
            score_ranges['0-20'] += 1
        elif score <= 40:
            score_ranges['21-40'] += 1
        elif score <= 60:
            score_ranges['41-60'] += 1
        elif score <= 80:
            score_ranges['61-80'] += 1
        else:
            score_ranges['81-100'] += 1

    # Average scores by category
    avg_scores = {}
    for category in WEIGHTS.keys():
        scores = [r['quality']['category_scores'][category] for r in results]
        avg_scores[category] = round(sum(scores) / len(scores), 2) if scores else 0

    report = {
        'timestamp': datetime.now().isoformat(),
        'dry_run': dry_run,
        'summary': {
            'total_documents': total_docs,
            'average_quality_score': round(sum(r['quality']['overall_score'] for r in results) / total_docs, 2) if total_docs > 0 else 0,
        },
        'action_breakdown': dict(action_counts),
        'score_distribution': score_ranges,
        'average_category_scores': avg_scores,
        'top_10_worst_quality': [
            {
                'id': r['doc_id'],
                'slug': r['slug'][:50],
                'title': r['title'][:60],
                'score': r['quality']['overall_score'],
                'action': r['quality']['action_label'],
                'main_issues': [
                    issue
                    for category_issues in r['quality']['issues'].values()
                    for issue in category_issues
                ][:3],  # Top 3 issues
            }
            for r in sorted(results, key=lambda x: x['quality']['overall_score'], reverse=True)[:10]
        ],
        'top_10_best_quality': [
            {
                'id': r['doc_id'],
                'slug': r['slug'][:50],
                'title': r['title'][:60],
                'score': r['quality']['overall_score'],
            }
            for r in sorted(results, key=lambda x: x['quality']['overall_score'])[:10]
        ],
        'detailed_results': results,
    }

    return report


def print_summary(report):
    """Print human-readable summary to console"""

    print(f"\n{'='*80}")
    print(f"PHASE 3: DOCUMENT QUALITY ASSESSMENT {'[DRY RUN]' if report['dry_run'] else '[LIVE RUN]'}")
    print(f"{'='*80}\n")

    print(f"Timestamp: {report['timestamp']}\n")

    print("SUMMARY:")
    print(f"  Total documents: {report['summary']['total_documents']:,}")
    print(f"  Average quality score: {report['summary']['average_quality_score']}/100 (lower is better)\n")

    print("ACTION BREAKDOWN:")
    total = report['summary']['total_documents']
    for action, count in sorted(report['action_breakdown'].items()):
        pct = round(100 * count / total, 1) if total > 0 else 0
        action_labels = {
            'auto_migrate': 'Auto-migrate (no review)',
            'flag_review': 'Flag for review (minor)',
            'priority_review': 'Priority review (major)',
            'block': 'Block migration (critical)',
        }
        print(f"  {action_labels.get(action, action):30s}: {count:4,} ({pct}%)")
    print()

    print("SCORE DISTRIBUTION:")
    for score_range, count in sorted(report['score_distribution'].items()):
        pct = round(100 * count / total, 1) if total > 0 else 0
        print(f"  {score_range:10s}: {count:4,} ({pct}%)")
    print()

    print("AVERAGE CATEGORY SCORES (out of 10):")
    for category, score in report['average_category_scores'].items():
        weight = WEIGHTS[category]
        print(f"  {category:25s}: {score:4.2f} (weight: {weight}x)")
    print()

    print("TOP 10 WORST QUALITY DOCUMENTS:")
    for i, doc in enumerate(report['top_10_worst_quality'], 1):
        print(f"  {i:2d}. [Score: {doc['score']:5.1f}] {doc['title'][:60]}")
        print(f"      Action: {doc['action']}")
        print(f"      Issues: {', '.join(doc['main_issues'][:2])}")
        print()

    print("TOP 10 BEST QUALITY DOCUMENTS:")
    for i, doc in enumerate(report['top_10_best_quality'], 1):
        print(f"  {i:2d}. [Score: {doc['score']:5.1f}] {doc['title'][:60]}\n")

    print(f"{'='*80}\n")

    if report['dry_run']:
        print("✅ DRY RUN COMPLETE - No changes made to database")
        print("   Set DRY_RUN=False to write quality scores\n")
    else:
        print("✅ QUALITY ASSESSMENT COMPLETE\n")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Execute Phase 3 quality assessment"""

    # Ensure output directory exists
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*80}")
    print(f"PHASE 3: DOCUMENT QUALITY ASSESSMENT")
    print(f"{'='*80}\n")

    if DRY_RUN:
        print("⚠️  DRY RUN MODE - Results will not be written to database\n")

    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)

    try:
        # Fetch all documents
        print("Fetching documents...")
        documents = get_all_documents(conn)
        print(f"Found {len(documents):,} documents to assess\n")

        # Assess each document
        results = []

        for i, doc in enumerate(documents, 1):
            if i % 100 == 0:
                print(f"Assessing document {i:,}/{len(documents):,}...")

            quality_assessment = assess_document_quality(doc)

            result = {
                'doc_id': doc['id'],
                'slug': doc['slug'],
                'title': doc['title'],
                'quality': quality_assessment,
            }

            results.append(result)

        # Generate report
        print("\nGenerating report...")
        report = generate_report(results, dry_run=DRY_RUN)

        # Save report to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = Path(OUTPUT_DIR) / f"phase3_quality_report_{timestamp}.json"

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"Report saved to: {report_file}")

        # Print summary
        print_summary(report)

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        conn.close()


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
