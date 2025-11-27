#!/usr/bin/env python3
"""
Second-Pass Cleanup Script for 739 Corrupted User Library Documents

Targets documents that weren't updated in the first migration pass,
specifically handling files with 'aboutreaderurl' and other garbage in filenames.

Usage:
    python3 cleanup_corrupted_739.py [--dry-run]
"""

import os
import re
import sys
import psycopg2
from pathlib import Path
from typing import Optional, Tuple, Dict

# Configuration
DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/veritable_games'
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

# Garbage patterns to remove from filenames and titles
GARBAGE_PATTERNS = [
    r'_aboutreaderurl.*$',
    r'aboutreaderurl.*$',
    r'_source_.*$',
    r'-source-.*$',
    r'_converted_from.*$',
    r'-converted-from.*$',
    r'_total_pages.*$',
    r'-total-pages.*$',
    r'_file_size.*$',
    r'-file-size.*$',
    r'_page_\d+.*$',
    r'-page-\d+.*$',
]

def clean_filename_to_title(filename: str) -> str:
    """
    Extract clean title from filename with aggressive garbage removal.

    Removes:
    - Category prefix (01_Political_Theory_Article_)
    - All known garbage patterns
    - File extension
    """
    # Remove .md extension
    clean = filename.replace('.md', '')

    # Remove category prefix pattern: NN_Category_DocType_
    clean = re.sub(r'^\d+_[^_]+_(Article|Book|Paper|Document|Resource|Guide|Articles|Books|Papers|Documents|Manuals|Pedagogy)s?_', '', clean)

    # Remove all garbage patterns
    for pattern in GARBAGE_PATTERNS:
        clean = re.sub(pattern, '', clean, flags=re.IGNORECASE)

    # Replace underscores and hyphens with spaces
    clean = clean.replace('_', ' ').replace('-', ' ')

    # Collapse multiple spaces
    clean = re.sub(r'\s+', ' ', clean).strip()

    # Truncate to reasonable length
    if len(clean) > 255:
        clean = clean[:255].rsplit(' ', 1)[0]  # Break at word boundary

    return clean


def strip_corrupted_frontmatter(content: str) -> str:
    """
    Remove corrupted YAML frontmatter and clean content.

    Corrupted frontmatter looks like:
    ---
    author: Something aboutreaderurl
    title: 'Long corrupted title with aboutreaderurl= **Source**: ./file.pdf ## Content...'
    ---
    """
    # Remove YAML frontmatter block (everything between --- markers)
    content = re.sub(r'^---\s*\n.*?\n---\s*\n', '', content, flags=re.DOTALL | re.MULTILINE)

    # Remove common garbage at start of content
    content = re.sub(r'^aboutreaderurl=\s*\*\*Source\*\*:.*?\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\*\*Source\*\*:.*?\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^## Content\s*\n', '', content, flags=re.MULTILINE)

    # Remove page markers from PDF conversion
    content = re.sub(r'-- ## Page \d+.*?(?=--|\Z)', '', content, flags=re.DOTALL)
    content = re.sub(r'!\[Page \d+ Complete\]\(images/page_\d+_full\.png\)', '', content)

    # Clean up extra whitespace
    content = re.sub(r'\n{3,}', '\n\n', content)

    return content.strip()


def find_source_file(title_fragment: str, slug_fragment: str) -> Optional[Path]:
    """
    Find source file using aggressive matching strategies.

    Tries multiple patterns:
    1. Exact match on normalized filename
    2. Match with 'aboutreaderurl' variants
    3. Fuzzy match on slug fragment
    """
    # Normalize fragments for comparison
    title_norm = title_fragment.lower().replace(' ', '').replace('-', '').replace('_', '')[:50]
    slug_norm = slug_fragment.lower().replace('-', '').replace('_', '')[:50]

    for md_file in LIBRARY_PATH.glob('*.md'):
        filename = md_file.name
        filename_norm = filename.lower().replace(' ', '').replace('-', '').replace('_', '').replace('.md', '')

        # Check if normalized filename contains title or slug fragment
        if title_norm in filename_norm or slug_norm in filename_norm:
            return md_file

        # Check reverse: if title/slug contains filename fragment
        if filename_norm[:30] in title_norm or filename_norm[:30] in slug_norm:
            return md_file

    return None


def get_corrupted_documents(cursor) -> list:
    """Get list of documents that weren't updated in first pass."""
    cursor.execute("""
        SELECT id, slug, title, content
        FROM library.library_documents
        WHERE status = 'published'
        AND updated_at < '2025-11-22 02:00:00'
        ORDER BY id
    """)
    return cursor.fetchall()


def update_document(cursor, doc_id: int, clean_title: str, clean_content: str, author: Optional[str], pub_date: Optional[str]) -> bool:
    """Update document with cleaned data."""
    try:
        cursor.execute("""
            UPDATE library.library_documents
            SET
                title = %s,
                content = %s,
                author = COALESCE(NULLIF(%s, ''), author),
                publication_date = COALESCE(NULLIF(%s, ''), publication_date),
                updated_at = NOW()
            WHERE id = %s
        """, (clean_title, clean_content, author, pub_date, doc_id))
        return True
    except Exception as e:
        print(f"   ❌ ERROR updating document {doc_id}: {e}")
        return False


def main():
    dry_run = '--dry-run' in sys.argv

    print("=" * 80)
    print("SECOND-PASS CLEANUP: 739 Corrupted User Library Documents")
    print("=" * 80)

    if dry_run:
        print("🔍 DRY-RUN MODE (no database changes)")
    else:
        print("⚠️  LIVE MODE - will update database")

    print()

    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        print("✓ Database connection established")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return 1

    # Get corrupted documents
    print("\n📋 Fetching corrupted documents...")
    corrupted_docs = get_corrupted_documents(cursor)
    print(f"✓ Found {len(corrupted_docs)} documents to clean")

    # Statistics
    stats = {
        'total': len(corrupted_docs),
        'updated': 0,
        'no_source': 0,
        'failed': 0,
        'skipped': 0
    }

    print(f"\n🔧 Processing {stats['total']} documents...")
    print()

    for idx, (doc_id, slug, title, content) in enumerate(corrupted_docs, 1):
        # Progress indicator every 50 docs
        if idx % 50 == 0:
            print(f"Progress: {idx}/{stats['total']} ({idx*100//stats['total']}%)")
            print(f"  Updated: {stats['updated']} | No Source: {stats['no_source']} | Failed: {stats['failed']}")
            print()

        # Extract fragment from title for matching
        title_fragment = title[:100].split('aboutreaderurl')[0].split('**Source**')[0].strip()
        slug_fragment = slug[:50]

        # Find source file
        source_file = find_source_file(title_fragment, slug_fragment)

        if not source_file:
            stats['no_source'] += 1
            if idx <= 10:  # Show first 10 failures
                print(f"[{idx:5d}] ⊘ NO SOURCE: ID {doc_id} | {title[:60]}...")
            continue

        # Read source file
        try:
            with open(source_file, 'r', encoding='utf-8', errors='replace') as f:
                source_content = f.read()
        except Exception as e:
            stats['failed'] += 1
            print(f"[{idx:5d}] ✗ READ ERROR: {source_file.name}: {e}")
            continue

        # Extract clean title from filename
        clean_title = clean_filename_to_title(source_file.name)

        if not clean_title:
            clean_title = title_fragment  # Fallback to cleaned database title

        # Strip corrupted frontmatter and clean content
        clean_content = strip_corrupted_frontmatter(source_content)

        # Extract author and pub_date from content if possible (basic)
        author_match = re.search(r'author:\s*([^\n]+)', source_content[:500])
        author = author_match.group(1).strip() if author_match else None
        if author and 'aboutreaderurl' in author.lower():
            author = None  # Corrupted author field

        pub_date = None  # Keep existing pub_date

        # Show what we're doing
        if stats['updated'] < 20 or idx % 100 == 0:  # Show first 20 + every 100th
            print(f"[{idx:5d}] ✓ UPDATE: ID {doc_id}")
            print(f"         Old: {title[:60]}...")
            print(f"         New: {clean_title[:60]}")
            print(f"         File: {source_file.name[:70]}")

        # Update document
        if not dry_run:
            if update_document(cursor, doc_id, clean_title, clean_content, author, pub_date):
                stats['updated'] += 1
                if idx % 100 == 0:
                    conn.commit()  # Commit every 100 docs
            else:
                stats['failed'] += 1
        else:
            stats['updated'] += 1  # Count as updated in dry-run

    # Final commit
    if not dry_run:
        conn.commit()

    # Summary
    print()
    print("=" * 80)
    print("CLEANUP COMPLETE")
    print("=" * 80)
    print(f"Total documents:  {stats['total']}")
    print(f"✓ Updated:        {stats['updated']}")
    print(f"⊘ No source file: {stats['no_source']}")
    print(f"✗ Failed:         {stats['failed']}")
    print()

    success_rate = (stats['updated'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")

    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")
    else:
        print("\n✅ Database updated successfully")

    cursor.close()
    conn.close()

    return 0


if __name__ == '__main__':
    sys.exit(main())
