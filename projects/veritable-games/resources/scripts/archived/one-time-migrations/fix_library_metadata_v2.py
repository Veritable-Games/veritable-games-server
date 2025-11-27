#!/usr/bin/env python3
"""
Fix Library Documents Metadata v2

Problem: Titles in database don't match titles in tracking.csv due to markdown formatting.

Solution: Match by INDEX File (filename) instead of title, merge metadata from
multiple rows in tracking.csv.

Usage:
    python3 fix_library_metadata_v2.py [--dry-run]
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


def generate_slug(title: str) -> str:
    """Generate slug from title (matching import script logic)."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 200:
        slug = slug[:200].rstrip('-')
    return slug


def load_metadata_by_filename():
    """
    Load tracking.csv and build lookup: filename -> {author, publication_date}

    Merges metadata from duplicate rows by Document Title.
    """
    # First, collect all metadata by title
    metadata_by_title = {}

    if not TRACKING_CSV.exists():
        print(f"Error: tracking.csv not found at {TRACKING_CSV}")
        return {}

    try:
        with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                title = row.get('Document Title', '').strip()
                if not title:
                    continue

                # Initialize entry if not exists
                if title not in metadata_by_title:
                    metadata_by_title[title] = {
                        'author': None,
                        'publication_date': None,
                        'index_files': [],
                    }

                entry = metadata_by_title[title]

                # Merge author
                author = row.get('Author(s)', '').strip()
                if author and not entry['author']:
                    entry['author'] = author

                # Merge publication date
                pub_date = row.get('Publication Date', '').strip()
                if pub_date and not entry['publication_date']:
                    entry['publication_date'] = pub_date

                # Collect index files
                index_file = row.get('INDEX File', '').strip()
                if index_file:
                    entry['index_files'].append(index_file)

        # Now build filename -> metadata lookup
        filename_lookup = {}
        for title, data in metadata_by_title.items():
            for index_file in data['index_files']:
                filename_lookup[index_file] = {
                    'title': title,
                    'author': data['author'],
                    'publication_date': data['publication_date'],
                }

        print(f"Loaded metadata for {len(metadata_by_title)} unique titles")
        print(f"Mapped to {len(filename_lookup)} filenames")

        # Stats
        with_author = sum(1 for data in filename_lookup.values() if data['author'])
        with_date = sum(1 for data in filename_lookup.values() if data['publication_date'])

        print(f"  - {with_author} filenames with authors")
        print(f"  - {with_date} filenames with publication dates")
        print()

        return filename_lookup

    except Exception as e:
        print(f"Error loading tracking.csv: {e}")
        import traceback
        traceback.print_exc()
        return {}


def extract_filename_from_slug(slug: str) -> str:
    """
    Try to reconstruct the original filename from document slug.

    Pattern: {PREFIX}_{CATEGORY}_{DOCTYPE}_{slug}.md
    """
    # We don't have the full filename, but we can list all markdown files
    # and check which ones match the slug suffix
    md_files = list(LIBRARY_PATH.glob('*.md'))

    for md_path in md_files:
        # Extract slug from filename
        # Pattern: 01_Political_Theory_Article_slug-here.md
        filename = md_path.name
        parts = filename.split('_', 3)  # Split on first 3 underscores
        if len(parts) >= 4:
            file_slug = parts[3].replace('.md', '')
            if file_slug == slug:
                return filename

    return None


def fix_metadata(dry_run=False):
    """Update library documents with correct author and publication_date."""

    print("="*70)
    print("Fixing Library Documents Metadata v2")
    print("="*70)
    print()

    # Load metadata by filename
    metadata = load_metadata_by_filename()
    if not metadata:
        print("No metadata loaded. Exiting.")
        return

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Get all library documents
        cur.execute("""
            SELECT id, title, slug, author, publication_date
            FROM library.library_documents
            WHERE created_by = 3
            ORDER BY id
        """)
        documents = cur.fetchall()

        print(f"Found {len(documents)} library documents to check\n")

        stats = {
            'total': len(documents),
            'updated': 0,
            'no_metadata': 0,
            'already_has_metadata': 0,
        }

        for doc_id, title, slug, current_author, current_pub_date in documents:
            # Skip if already has both author and date
            if current_author and current_pub_date:
                stats['already_has_metadata'] += 1
                continue

            # Try to find filename from slug
            filename = extract_filename_from_slug(slug)

            if not filename:
                # Fallback: try to construct possible filenames
                # This is a heuristic - may not always work
                stats['no_metadata'] += 1
                continue

            # Look up metadata by filename
            meta = metadata.get(filename)

            if not meta:
                stats['no_metadata'] += 1
                continue

            # Check if we have new data to add
            new_author = meta.get('author') if not current_author else current_author
            new_pub_date = meta.get('publication_date') if not current_pub_date else current_pub_date

            # Skip if no new data
            if new_author == current_author and new_pub_date == current_pub_date:
                continue

            if dry_run:
                print(f"[{doc_id:5d}] DRY-RUN: Would update '{title[:50]}'")
                print(f"          Filename: {filename}")
                if new_author != current_author:
                    print(f"          Author: '{current_author or '(null)'}' → '{new_author or '(null)'}'")
                if new_pub_date != current_pub_date:
                    print(f"          Date: '{current_pub_date or '(null)'}' → '{new_pub_date or '(null)'}'")
            else:
                # Update document
                cur.execute("""
                    UPDATE library.library_documents
                    SET author = %s, publication_date = %s, updated_at = NOW()
                    WHERE id = %s
                """, (new_author, new_pub_date, doc_id))

                print(f"[{doc_id:5d}] UPDATED: {title[:60]}")
                if new_author:
                    print(f"          Author: {new_author}")
                if new_pub_date:
                    print(f"          Date: {new_pub_date}")

            stats['updated'] += 1

        if not dry_run:
            conn.commit()
            print("\nCommitted changes to database ✓")
        else:
            print("\nDRY-RUN - No changes committed")

        print(f"\n{'='*70}")
        print("Summary:")
        print(f"{'='*70}")
        print(f"Total documents: {stats['total']}")
        print(f"Updated: {stats['updated']}")
        print(f"Already had metadata: {stats['already_has_metadata']}")
        print(f"No metadata found: {stats['no_metadata']}")
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

    if dry_run:
        print("Running in DRY-RUN mode (no changes will be made)\n")

    fix_metadata(dry_run=dry_run)
