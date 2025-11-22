#!/usr/bin/env python3
"""
Test migration pipeline on 10 sample documents.
Validates: extraction, cleaning, YAML generation, file writes.

This is a DRY RUN - does NOT modify database, writes to test directory.
"""

import psycopg2
import os
import re
import yaml
from pathlib import Path
from datetime import datetime
import hashlib

# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}

TEST_OUTPUT_DIR = '/home/user/projects/veritable-games/site/frontend/data/library/test-migration'
SAMPLE_SIZE = 10

# PDF Artifact Cleaning Patterns
METADATA_PATTERN = re.compile(
    r'^\*Converted from: `.*?`\*\s*\n'
    r'\*Total pages: \d+\*\s*\n'
    r'\*File size: \d+ bytes\*\s*\n'
    r'\*Converted: .*?\*\s*\n'
    r'\n---\n',
    re.MULTILINE
)

PAGE_HEADER_PATTERN = re.compile(r'^## Page \d+\n', re.MULTILINE)

FIGURES_SECTION_PATTERN = re.compile(
    r'^### Figures and Images \(\d+ found\)\n'
    r'(?:^#### Figure: .*?\n'
    r'^!\[Figure from page \d+\]\(images/.*?\)\n'
    r'(?:^---\n)?)*',
    re.MULTILINE
)

COMPLETE_PAGE_PATTERN = re.compile(
    r'^### Complete Page View\n'
    r'^!\[Page \d+ Complete\]\(images/page_\d+_full\.png\)\n',
    re.MULTILINE
)

EXTRACTED_TEXT_HEADER_PATTERN = re.compile(
    r'^### Extracted Text\n\n',
    re.MULTILINE
)

DIVIDER_BEFORE_PAGE_PATTERN = re.compile(
    r'\n---\n\n(?=## Page \d+)',
    re.MULTILINE
)

FORM_FEED_PATTERN = re.compile(r'\x0C')


def clean_content(content):
    """Remove all PDF conversion artifacts from content"""
    if not content:
        return content

    # Step 1: Remove conversion metadata header
    content = METADATA_PATTERN.sub('', content, count=1)

    # Step 2: Extract content from code block wrappers
    content = extract_from_code_blocks(content)

    # Step 3: Remove image sections
    content = FIGURES_SECTION_PATTERN.sub('', content)
    content = COMPLETE_PAGE_PATTERN.sub('', content)

    # Step 4: Remove "Extracted Text" headers
    content = EXTRACTED_TEXT_HEADER_PATTERN.sub('', content)

    # Step 5: Remove page headers
    content = PAGE_HEADER_PATTERN.sub('', content)

    # Step 6: Remove dividers before page headers
    content = DIVIDER_BEFORE_PAGE_PATTERN.sub('', content)

    # Step 7: Remove form feed characters
    content = FORM_FEED_PATTERN.sub('', content)

    # Step 8: Clean up excessive whitespace
    content = clean_whitespace(content)

    return content


def extract_from_code_blocks(text):
    """Extract content from triple backtick wrappers"""
    pattern = re.compile(
        r'^### Extracted Text\n\n```\n(.*?)\n```',
        re.MULTILINE | re.DOTALL
    )

    def replace_match(match):
        return match.group(1)

    return pattern.sub(replace_match, text)


def clean_whitespace(text):
    """Normalize whitespace while preserving paragraph structure"""
    # Remove trailing whitespace from lines
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)

    # Reduce excessive newlines to double newline
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Remove whitespace at start/end
    return text.strip()


def generate_file_path(slug, created_at=None):
    """Generate file path in format: YYYY/MM/slug.md"""
    if created_at:
        date = created_at
    else:
        date = datetime.now()

    year = date.year
    month = str(date.month).zfill(2)
    return f"{year}/{month}/{slug}.md"


def create_markdown_file(doc, output_dir):
    """Create markdown file with YAML frontmatter"""

    # Clean content
    original_content = doc['content'] or ''
    cleaned_content = clean_content(original_content)

    # Calculate cleaning impact
    original_size = len(original_content)
    cleaned_size = len(cleaned_content)
    reduction_pct = ((original_size - cleaned_size) / original_size * 100) if original_size > 0 else 0

    # Build frontmatter
    frontmatter = {
        'id': doc['id'],
        'slug': doc['slug'],
        'title': doc['title'],
    }

    # Add optional fields
    if doc['author']:
        frontmatter['author'] = doc['author']
    if doc['publication_date']:
        frontmatter['publication_date'] = doc['publication_date']
    if doc['document_type']:
        frontmatter['document_type'] = doc['document_type']
    if doc['status']:
        frontmatter['status'] = doc['status']
    if doc['language']:
        frontmatter['language'] = doc['language']
    if doc['description']:
        frontmatter['description'] = doc['description']
    if doc['abstract']:
        frontmatter['abstract'] = doc['abstract']

    # System metadata
    frontmatter['created_by'] = doc['created_by']
    if doc['created_at']:
        frontmatter['created_at'] = doc['created_at'].isoformat()
    if doc['updated_at']:
        frontmatter['updated_at'] = doc['updated_at'].isoformat()
    frontmatter['view_count'] = doc['view_count'] or 0

    # Migration metadata
    frontmatter['migrated_at'] = datetime.now().isoformat()
    frontmatter['original_db_id'] = doc['id']
    frontmatter['migration_version'] = '1.0'
    frontmatter['content_checksum'] = hashlib.md5(cleaned_content.encode('utf-8')).hexdigest()

    # Generate file path
    file_path = generate_file_path(doc['slug'], doc['created_at'])
    full_path = Path(output_dir) / file_path

    # Ensure directory exists
    full_path.parent.mkdir(parents=True, exist_ok=True)

    # Write file
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write('---\n')
        yaml.dump(frontmatter, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        f.write('---\n\n')
        f.write(cleaned_content)

    return {
        'file_path': file_path,
        'full_path': str(full_path),
        'original_size': original_size,
        'cleaned_size': cleaned_size,
        'reduction_pct': reduction_pct,
    }


def main():
    """Run test migration on 10 sample documents"""

    print(f"\n{'='*80}")
    print(f"TEST MIGRATION: {SAMPLE_SIZE} Sample Documents")
    print(f"{'='*80}\n")

    # Clean test output directory
    if os.path.exists(TEST_OUTPUT_DIR):
        import shutil
        shutil.rmtree(TEST_OUTPUT_DIR)
    os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)

    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Select 10 sample documents (mix of polluted and clean)
    query = """
        SELECT
            id, slug, title, author, publication_date, document_type,
            status, description, abstract, language, created_by,
            created_at, updated_at, view_count, content
        FROM library.library_documents
        WHERE content IS NOT NULL
        ORDER BY
            (LENGTH(content) - LENGTH(REPLACE(content, '\f', ''))) DESC,  -- Most polluted first
            RANDOM()
        LIMIT %s
    """

    cur.execute(query, (SAMPLE_SIZE,))
    columns = [desc[0] for desc in cur.description]

    print(f"Selected {SAMPLE_SIZE} documents for testing\n")

    # Process each document
    results = []
    for row in cur.fetchall():
        doc = dict(zip(columns, row))

        print(f"Processing: {doc['slug'][:50]}...")

        try:
            result = create_markdown_file(doc, TEST_OUTPUT_DIR)
            result['doc_id'] = doc['id']
            result['doc_title'] = doc['title']
            result['success'] = True
            result['error'] = None

            print(f"  ✓ File created: {result['file_path']}")
            print(f"  ✓ Size: {result['original_size']:,} → {result['cleaned_size']:,} bytes ({result['reduction_pct']:.1f}% reduction)")

        except Exception as e:
            result = {
                'doc_id': doc['id'],
                'doc_title': doc['title'],
                'success': False,
                'error': str(e),
            }
            print(f"  ✗ Error: {e}")

        results.append(result)
        print()

    # Summary
    print(f"\n{'='*80}")
    print("TEST MIGRATION SUMMARY")
    print(f"{'='*80}\n")

    successes = [r for r in results if r['success']]
    failures = [r for r in results if not r['success']]

    print(f"Total documents: {len(results)}")
    print(f"Successfully migrated: {len(successes)}")
    print(f"Errors: {len(failures)}")
    print(f"Success rate: {100.0 * len(successes) / len(results):.1f}%\n")

    if successes:
        total_original = sum(r['original_size'] for r in successes)
        total_cleaned = sum(r['cleaned_size'] for r in successes)
        avg_reduction = ((total_original - total_cleaned) / total_original * 100) if total_original > 0 else 0

        print(f"Content cleaning:")
        print(f"  Original size: {total_original:,} bytes")
        print(f"  Cleaned size: {total_cleaned:,} bytes")
        print(f"  Average reduction: {avg_reduction:.1f}%\n")

    if failures:
        print("ERRORS:")
        for r in failures:
            print(f"  - ID {r['doc_id']}: {r['error']}")
        print()

    # Verification
    print("Verification:")

    # Count files created
    file_count = sum(1 for _ in Path(TEST_OUTPUT_DIR).rglob('*.md'))
    print(f"  Files created: {file_count}")

    # Test file readability
    readable_count = 0
    for result in successes:
        try:
            with open(result['full_path'], 'r', encoding='utf-8') as f:
                content = f.read()
                if '---' in content and len(content) > 0:
                    readable_count += 1
        except:
            pass

    print(f"  Files readable: {readable_count}")

    # Final verdict
    print()
    if len(successes) == len(results) and file_count == len(results):
        print("✅ TEST MIGRATION SUCCESSFUL - Ready to proceed to Phase 1")
    else:
        print("⚠️  TEST MIGRATION HAD ISSUES - Review errors before proceeding")

    print(f"\nTest files location: {TEST_OUTPUT_DIR}\n")

    conn.close()

    return len(successes) == len(results)


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
