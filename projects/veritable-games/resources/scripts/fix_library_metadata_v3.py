#!/usr/bin/env python3
"""
Fix Library Documents Metadata v3

Approach: Scan all markdown files, match to database by slug, update with tracking.csv metadata.

Usage:
    python3 fix_library_metadata_v3.py [--dry-run] [--limit N]
"""

import os
import sys
import csv
import re
import psycopg2
from pathlib import Path
from typing import Dict, Optional

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
TRACKING_CSV = LIBRARY_PATH / 'tracking.csv'


def generate_slug(title: str, fallback_idx=None) -> str:
    """Generate slug from title (matching import script logic)."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 200:
        slug = slug[:200].rstrip('-')
    return slug


def extract_title_from_content(content: str) -> Optional[str]:
    """Extract title from markdown content."""
    lines = content.split('\n')
    for line in lines[:50]:
        line = line.strip()
        if line.startswith('# '):
            title = line[2:].strip()
            # Remove trailing # characters
            title = re.sub(r'#+$', '', title).strip()
            return title
    return None


def load_metadata_by_filename():
    """Load tracking.csv: filename -> {title, author, publication_date}"""
    # First collect by title
    metadata_by_title = {}

    if not TRACKING_CSV.exists():
        print(f"Error: tracking.csv not found")
        return {}

    with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = row.get('Document Title', '').strip()
            if not title:
                continue

            if title not in metadata_by_title:
                metadata_by_title[title] = {
                    'author': None,
                    'publication_date': None,
                    'index_files': [],
                }

            entry = metadata_by_title[title]

            author = row.get('Author(s)', '').strip()
            if author and not entry['author']:
                entry['author'] = author

            pub_date = row.get('Publication Date', '').strip()
            if pub_date and not entry['publication_date']:
                entry['publication_date'] = pub_date

            index_file = row.get('INDEX File', '').strip()
            if index_file:
                entry['index_files'].append(index_file)

    # Build filename -> metadata
    filename_lookup = {}
    for title, data in metadata_by_title.items():
        for filename in data['index_files']:
            filename_lookup[filename] = {
                'title': title,
                'author': data['author'],
                'publication_date': data['publication_date'],
            }

    print(f"Loaded {len(filename_lookup)} filenames with metadata")
    with_author = sum(1 for d in filename_lookup.values() if d['author'])
    with_date = sum(1 for d in filename_lookup.values() if d['publication_date'])
    print(f"  - {with_author} with authors")
    print(f"  - {with_date} with publication dates")
    print()

    return filename_lookup


def fix_metadata(dry_run=False, limit=None):
    """Scan markdown files and update database with metadata."""

    print("="*70)
    print("Fixing Library Documents Metadata v3")
    print("="*70)
    print()

    # Load metadata
    metadata_lookup = load_metadata_by_filename()

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Get all markdown files
        md_files = sorted(LIBRARY_PATH.glob('*.md'))
        print(f"Found {len(md_files)} markdown files\n")

        if limit:
            md_files = md_files[:limit]
            print(f"Processing first {limit} files (--limit {limit})\n")

        stats = {
            'total': 0,
            'updated': 0,
            'no_metadata': 0,
            'no_db_match': 0,
            'already_has_metadata': 0,
        }

        for idx, md_path in enumerate(md_files, 1):
            filename = md_path.name
            stats['total'] += 1

            # Read file to extract title
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"[{idx:5d}] ERROR reading {filename}: {e}")
                continue

            # Extract title
            title = extract_title_from_content(content)
            if not title:
                print(f"[{idx:5d}] SKIP: No title in {filename}")
                continue

            # Generate slug
            slug = generate_slug(title)

            # Look up in database
            cur.execute("""
                SELECT id, title, author, publication_date
                FROM library.library_documents
                WHERE slug = %s AND created_by = 3
            """, (slug,))

            db_row = cur.fetchone()
            if not db_row:
                stats['no_db_match'] += 1
                continue

            doc_id, db_title, current_author, current_pub_date = db_row

            # Skip if already has metadata
            if current_author and current_pub_date:
                stats['already_has_metadata'] += 1
                continue

            # Look up metadata from tracking.csv
            meta = metadata_lookup.get(filename)
            if not meta:
                stats['no_metadata'] += 1
                continue

            new_author = meta.get('author') or current_author
            new_pub_date = meta.get('publication_date') or current_pub_date

            # Skip if no new data
            if new_author == current_author and new_pub_date == current_pub_date:
                continue

            if dry_run:
                print(f"[{idx:5d}] DRY-RUN: {filename[:60]}")
                print(f"          DB: {db_title[:60]}")
                if new_author:
                    print(f"          Author: {new_author}")
                if new_pub_date:
                    print(f"          Date: {new_pub_date}")
            else:
                # Update
                cur.execute("""
                    UPDATE library.library_documents
                    SET author = %s, publication_date = %s, updated_at = NOW()
                    WHERE id = %s
                """, (new_author, new_pub_date, doc_id))

                print(f"[{idx:5d}] UPDATED: {db_title[:60]}")
                if new_author:
                    print(f"          Author: {new_author}")
                if new_pub_date:
                    print(f"          Date: {new_pub_date}")

            stats['updated'] += 1

        if not dry_run:
            conn.commit()
            print("\n✓ Committed changes to database")
        else:
            print("\nDRY-RUN - No changes committed")

        print(f"\n{'='*70}")
        print("Summary:")
        print(f"{'='*70}")
        print(f"Total files processed: {stats['total']}")
        print(f"Updated: {stats['updated']}")
        print(f"Already had metadata: {stats['already_has_metadata']}")
        print(f"No tracking.csv metadata: {stats['no_metadata']}")
        print(f"Not found in database: {stats['no_db_match']}")
        print(f"{'='*70}")

    except Exception as e:
        conn.rollback()
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    limit = None

    # Check for --limit N
    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    if dry_run:
        print("Running in DRY-RUN mode\n")

    fix_metadata(dry_run=dry_run, limit=limit)
