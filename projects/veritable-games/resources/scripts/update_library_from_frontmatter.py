#!/usr/bin/env python3
"""
Update Library Documents Database from YAML Frontmatter

Reads YAML frontmatter from library documents and updates the database
with author, publication_date, and source_url metadata.

Usage:
    python3 update_library_from_frontmatter.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import yaml
import psycopg2
from pathlib import Path

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')


def extract_frontmatter(md_path):
    """Parse YAML frontmatter from markdown file."""
    try:
        with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        # Extract frontmatter between --- markers
        match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
        if not match:
            return {}

        return yaml.safe_load(match.group(1)) or {}
    except Exception as e:
        print(f"Error parsing {md_path.name}: {e}")
        return {}


def generate_slug(title: str) -> str:
    """Generate slug from title (matching import script)."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 200:
        slug = slug[:200].rstrip('-')
    return slug


def update_from_frontmatter(dry_run=False, limit=None):
    """Update database with metadata from YAML frontmatter."""

    print("="*70)
    print("Updating Library Documents from YAML Frontmatter")
    print("="*70)
    print()

    if dry_run:
        print("🔍 DRY-RUN MODE - No database changes\n")

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    stats = {
        'total': 0,
        'updated': 0,
        'no_frontmatter': 0,
        'no_db_match': 0,
        'already_complete': 0,
    }

    try:
        # Get all markdown files
        md_files = sorted(LIBRARY_PATH.glob('*.md'))

        if limit:
            md_files = md_files[:limit]

        print(f"Processing {len(md_files)} markdown files\n")

        for idx, md_path in enumerate(md_files, 1):
            stats['total'] += 1

            # Extract frontmatter
            metadata = extract_frontmatter(md_path)

            if not metadata or 'title' not in metadata:
                stats['no_frontmatter'] += 1
                continue

            # Generate slug from title (matching how documents were imported)
            title = metadata['title']
            slug = generate_slug(title)

            # Look up document in database by slug
            cur.execute("""
                SELECT id, author, publication_date
                FROM library.library_documents
                WHERE slug = %s AND created_by = 3
            """, (slug,))

            result = cur.fetchone()
            if not result:
                # Try alternate slug (from filename)
                alt_slug = md_path.stem.lower()
                alt_slug = re.sub(r'^\d+_[a-z_]+_[a-z_]+_', '', alt_slug)
                cur.execute("""
                    SELECT id, author, publication_date
                    FROM library.library_documents
                    WHERE slug = %s AND created_by = 3
                """, (alt_slug,))
                result = cur.fetchone()

            if not result:
                stats['no_db_match'] += 1
                if idx % 100 == 0:
                    print(f"[{idx:5d}/{len(md_files)}] NO MATCH: {title[:50]}")
                continue

            doc_id, current_author, current_pub_date = result

            # Get new metadata from frontmatter
            new_author = metadata.get('author')
            new_date = metadata.get('date')

            # Check if update is needed
            needs_update = False
            updates = []

            if new_author and new_author != current_author:
                needs_update = True
                updates.append(f"author: '{new_author}'")

            if new_date and str(new_date) != current_pub_date:
                needs_update = True
                updates.append(f"date: {new_date}")

            if not needs_update:
                stats['already_complete'] += 1
                continue

            # Update database
            if not dry_run:
                cur.execute("""
                    UPDATE library.library_documents
                    SET author = COALESCE(%s, author),
                        publication_date = COALESCE(%s, publication_date),
                        updated_at = NOW()
                    WHERE id = %s
                """, (new_author, new_date, doc_id))

            stats['updated'] += 1

            # Show progress
            if idx <= 20 or idx % 100 == 0:
                print(f"[{idx:5d}/{len(md_files)}] UPDATED: {title[:50]}")
                for update in updates:
                    print(f"          {update}")

        if not dry_run:
            conn.commit()
            print("\n✅ All changes committed to database\n")
        else:
            print("\nDRY-RUN - No database changes\n")

        # Print summary
        print(f"{'='*70}")
        print("UPDATE SUMMARY")
        print(f"{'='*70}")
        print(f"Total files processed: {stats['total']}")
        print(f"Documents updated: {stats['updated']}")
        print(f"Already complete: {stats['already_complete']}")
        print(f"No frontmatter: {stats['no_frontmatter']}")
        print(f"No database match: {stats['no_db_match']}")
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

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    update_from_frontmatter(dry_run=dry_run, limit=limit)
