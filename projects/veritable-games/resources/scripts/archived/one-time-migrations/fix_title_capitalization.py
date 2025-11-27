#!/usr/bin/env python3
"""
Fix Library Document Titles - Extract Proper Capitalization from Source Files

Extracts titles from YAML frontmatter or H1 headings in source .md files
and updates the database with properly-capitalized titles.

Usage:
    python3 fix_title_capitalization.py [--dry-run] [--limit N]
"""

import os
import re
import sys
import yaml
import psycopg2
from pathlib import Path
from typing import Optional, Tuple

# Configuration
DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/veritable_games'
SOURCE_DIR = Path('/home/user/projects/veritable-games/resources/data/library')


def extract_title_from_yaml(filepath: Path) -> Optional[str]:
    """Extract title from YAML frontmatter in markdown file."""
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')

        # Match YAML frontmatter block
        match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)

        if match:
            try:
                frontmatter = yaml.safe_load(match.group(1))
                if isinstance(frontmatter, dict):
                    title = frontmatter.get('title', '')
                    if title and isinstance(title, str):
                        # Clean up corrupted titles
                        title = title.split('aboutreaderurl')[0]
                        title = title.split('**Source**')[0]
                        title = title.strip()

                        # Validate length
                        if 3 < len(title) < 500:
                            return title
            except yaml.YAMLError:
                pass  # Fall through to H1 extraction
    except Exception:
        pass

    return None


def extract_title_from_h1(filepath: Path) -> Optional[str]:
    """Extract title from first H1 heading in markdown file."""
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')

        # Remove YAML frontmatter first
        text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', text, flags=re.DOTALL)

        # Find first H1 heading
        match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
        if match:
            title = match.group(1).strip()

            # Clean and validate
            if 3 < len(title) < 500:
                return title
    except Exception:
        pass

    return None


def match_file_to_document(slug: str, title: str) -> Optional[Path]:
    """Find source .md file for a database document using slug/title matching."""
    # Normalize for comparison
    slug_norm = slug.lower().replace('-', '').replace('_', '')[:50]
    title_norm = title.lower().replace(' ', '').replace('-', '').replace('_', '')[:50]

    for md_file in SOURCE_DIR.glob('*.md'):
        filename = md_file.name
        filename_norm = filename.lower().replace('-', '').replace('_', '').replace('.md', '')

        # Strategy 1: Slug in filename
        if slug_norm in filename_norm:
            return md_file

        # Strategy 2: Filename in slug (shorter match)
        if len(filename_norm) > 20 and filename_norm[:30] in slug_norm:
            return md_file

        # Strategy 3: Title in filename
        if len(title_norm) > 15 and title_norm[:30] in filename_norm:
            return md_file

        # Strategy 4: Filename in title
        if len(filename_norm) > 20 and filename_norm[:30] in title_norm:
            return md_file

    return None


def main():
    dry_run = '--dry-run' in sys.argv
    limit = None

    # Parse --limit argument
    for i, arg in enumerate(sys.argv):
        if arg == '--limit' and i + 1 < len(sys.argv):
            try:
                limit = int(sys.argv[i + 1])
            except ValueError:
                pass

    print("=" * 80)
    print("FIX LIBRARY DOCUMENT TITLE CAPITALIZATION")
    print("=" * 80)

    if dry_run:
        print("🔍 DRY-RUN MODE (no database changes)")
    else:
        print("⚠️  LIVE MODE - will update database")

    if limit:
        print(f"📊 Processing limit: {limit} documents")

    print()

    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        print("✓ Database connection established")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return 1

    # Get all documents
    print("\n📋 Fetching documents...")
    cursor.execute("""
        SELECT id, slug, title
        FROM library.library_documents
        WHERE status = 'published'
        ORDER BY id
    """)

    all_docs = cursor.fetchall()
    docs = all_docs[:limit] if limit else all_docs

    print(f"✓ Found {len(all_docs)} total documents")
    if limit:
        print(f"  Processing first {len(docs)} documents")

    # Statistics
    stats = {
        'total': len(docs),
        'updated': 0,
        'no_source': 0,
        'no_title': 0,
        'unchanged': 0,
        'failed': 0
    }

    print(f"\n🔧 Processing {stats['total']} documents...")
    print()

    for idx, (doc_id, slug, current_title) in enumerate(docs, 1):
        # Progress indicator
        if idx % 500 == 0:
            print(f"Progress: {idx}/{stats['total']} ({idx*100//stats['total']}%)")
            print(f"  Updated: {stats['updated']} | No Source: {stats['no_source']} | Unchanged: {stats['unchanged']}")
            print()

        # Find source file
        source_file = match_file_to_document(slug, current_title)

        if not source_file:
            stats['no_source'] += 1
            if idx <= 10:  # Show first 10 failures
                print(f"[{idx:5d}] ⊘ NO SOURCE: ID {doc_id} | {current_title[:50]}...")
            continue

        # Extract proper title (try YAML first, then H1)
        proper_title = extract_title_from_yaml(source_file)
        if not proper_title:
            proper_title = extract_title_from_h1(source_file)

        if not proper_title:
            stats['no_title'] += 1
            continue

        # Skip if title already correct
        if current_title == proper_title:
            stats['unchanged'] += 1
            continue

        # Skip if only whitespace differences
        if current_title.strip().lower() == proper_title.strip().lower():
            stats['unchanged'] += 1
            continue

        # Show update (first 30 + every 100th)
        if stats['updated'] < 30 or idx % 100 == 0:
            print(f"[{idx:5d}] ✓ UPDATE: ID {doc_id}")
            print(f"         Old: {current_title[:70]}")
            print(f"         New: {proper_title[:70]}")
            print(f"         File: {source_file.name[:60]}")

        # Update database
        if not dry_run:
            try:
                cursor.execute("""
                    UPDATE library.library_documents
                    SET title = %s, updated_at = NOW()
                    WHERE id = %s
                """, (proper_title, doc_id))

                stats['updated'] += 1

                # Commit every 100 docs
                if idx % 100 == 0:
                    conn.commit()

            except Exception as e:
                stats['failed'] += 1
                print(f"   ❌ ERROR: {e}")
                conn.rollback()
        else:
            stats['updated'] += 1  # Count as updated in dry-run

    # Final commit
    if not dry_run:
        conn.commit()

    # Summary
    print()
    print("=" * 80)
    print("CAPITALIZATION FIX COMPLETE")
    print("=" * 80)
    print(f"Total documents:  {stats['total']}")
    print(f"✓ Updated:        {stats['updated']}")
    print(f"⊘ No source file: {stats['no_source']}")
    print(f"⊘ No title found: {stats['no_title']}")
    print(f"⊘ Already correct:{stats['unchanged']}")
    print(f"✗ Failed:         {stats['failed']}")
    print()

    success_rate = (stats['updated'] / stats['total'] * 100) if stats['total'] > 0 else 0
    print(f"Update rate: {success_rate:.1f}%")

    if dry_run:
        print("\n💡 Run without --dry-run to apply changes")
    else:
        print("\n✅ Database updated successfully")

    cursor.close()
    conn.close()

    return 0


if __name__ == '__main__':
    sys.exit(main())
