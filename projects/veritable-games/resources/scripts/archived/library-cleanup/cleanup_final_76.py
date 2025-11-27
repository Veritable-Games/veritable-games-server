#!/usr/bin/env python3
"""
Third-Pass Cleanup: Final 76 Corrupted Documents

Targets documents with "**Source**:" in titles that weren't matched by previous passes.
Uses aggressive slug fragment matching to find source files.

Usage:
    python3 cleanup_final_76.py [--dry-run]
"""

import os
import re
import sys
import yaml
import psycopg2
from pathlib import Path
from typing import Optional

# Configuration
DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/veritable_games'
SOURCE_DIR = Path('/home/user/projects/veritable-games/resources/data/library')


def extract_title_from_yaml(filepath: Path) -> Optional[str]:
    """Extract title from YAML frontmatter."""
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')
        match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)

        if match:
            try:
                frontmatter = yaml.safe_load(match.group(1))
                if isinstance(frontmatter, dict):
                    title = frontmatter.get('title', '')
                    if title and isinstance(title, str):
                        # Clean corrupted titles
                        title = title.split('aboutreaderurl')[0]
                        title = title.split('**Source**')[0]
                        title = title.strip()

                        if 3 < len(title) < 500:
                            return title
            except yaml.YAMLError:
                pass
    except Exception:
        pass

    return None


def extract_title_from_h1(filepath: Path) -> Optional[str]:
    """Extract title from first H1 heading."""
    try:
        text = filepath.read_text(encoding='utf-8', errors='ignore')
        # Remove frontmatter
        text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', text, flags=re.DOTALL)

        # Find first H1
        match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
        if match:
            title = match.group(1).strip()
            if 3 < len(title) < 500:
                return title
    except Exception:
        pass

    return None


def extract_slug_fragment(slug: str, title: str) -> str:
    """
    Extract the meaningful part of the slug before corruption.

    Examples:
        'five-things-source-...' → 'five-things'
        'burnout-compassion-fatigue-compassion-source-...' → 'burnout-compassion-fatigue-compassion'
    """
    # Split on 'source' and take the part before it
    parts = slug.split('-source-')
    if len(parts) > 1:
        return parts[0]

    # Also try splitting on common corruption patterns
    slug = slug.split('-converted-from-')[0]
    slug = slug.split('-total-pages-')[0]

    # Take first 50 chars if still too long
    return slug[:50]


def match_file_by_slug_fragment(slug_fragment: str, title: str) -> Optional[Path]:
    """Find source file using aggressive slug fragment matching."""
    # Normalize fragment
    slug_norm = slug_fragment.lower().replace('-', '').replace('_', '')

    # Also extract key words from title for additional matching
    title_words = re.findall(r'\b[a-z]{4,}\b', title.lower())[:5]  # First 5 significant words

    best_match = None
    best_score = 0

    for md_file in SOURCE_DIR.glob('*.md'):
        filename = md_file.name
        filename_norm = filename.lower().replace('-', '').replace('_', '').replace('.md', '')

        score = 0

        # Strategy 1: Slug fragment in filename (strong match)
        if len(slug_norm) > 10 and slug_norm in filename_norm:
            score += 10

        # Strategy 2: Filename in slug (moderate match)
        if len(filename_norm) > 20 and filename_norm[:30] in slug_norm:
            score += 5

        # Strategy 3: Title words in filename (weak match)
        for word in title_words:
            if word in filename_norm:
                score += 1

        # Strategy 4: Reverse - slug in filename at start (strong)
        if filename_norm.startswith(slug_norm[:20]):
            score += 8

        if score > best_score:
            best_score = score
            best_match = md_file

    # Only return if we have a reasonable confidence match
    return best_match if best_score >= 5 else None


def get_corrupted_documents(cursor) -> list:
    """Get the 76 corrupted documents that need cleaning."""
    cursor.execute("""
        SELECT id, slug, title, content
        FROM library.library_documents
        WHERE status = 'published'
        AND updated_at < '2025-11-22 02:00:00'
        AND (
            title LIKE '%**Source**%'
            OR title LIKE '%source:%'
            OR slug LIKE '%source%'
        )
        ORDER BY id
    """)
    return cursor.fetchall()


def main():
    dry_run = '--dry-run' in sys.argv

    print("=" * 80)
    print("THIRD-PASS CLEANUP: Final 76 Corrupted Documents")
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
        'no_title': 0,
        'failed': 0
    }

    print(f"\n🔧 Processing {stats['total']} documents...")
    print()

    for idx, (doc_id, slug, title, content) in enumerate(corrupted_docs, 1):
        # Extract slug fragment (before corruption)
        slug_fragment = extract_slug_fragment(slug, title)

        # Extract clean part of title (before corruption markers)
        clean_title_part = title.split('**Source**')[0].split('source:')[0].strip()

        # Find source file using aggressive matching
        source_file = match_file_by_slug_fragment(slug_fragment, clean_title_part)

        if not source_file:
            stats['no_source'] += 1
            if idx <= 10:
                print(f"[{idx:5d}] ⊘ NO SOURCE: ID {doc_id}")
                print(f"         Slug fragment: {slug_fragment[:60]}")
                print(f"         Title: {title[:60]}...")
            continue

        # Extract proper title from source file
        proper_title = extract_title_from_yaml(source_file)
        if not proper_title:
            proper_title = extract_title_from_h1(source_file)

        if not proper_title:
            stats['no_title'] += 1
            continue

        # Show update
        if stats['updated'] < 30 or idx % 10 == 0:
            print(f"[{idx:5d}] ✓ UPDATE: ID {doc_id}")
            print(f"         Old: {title[:70]}")
            print(f"         New: {proper_title[:70]}")
            print(f"         File: {source_file.name[:60]}")

        # Update database
        if not dry_run:
            try:
                # Also clean the content by stripping corrupted frontmatter
                clean_content = content

                # Remove corrupted YAML frontmatter
                clean_content = re.sub(r'^---\s*\n.*?\n---\s*\n', '', clean_content, flags=re.DOTALL, count=1)

                # Remove common garbage patterns at start
                clean_content = re.sub(r'^.*?\*\*Source\*\*:.*?\n', '', clean_content, flags=re.MULTILINE)
                clean_content = re.sub(r'^## Content\s*\n', '', clean_content, flags=re.MULTILINE)

                # Clean up PDF page markers
                clean_content = re.sub(r'-- ## Page \d+.*?(?=--|\Z)', '', clean_content, flags=re.DOTALL)

                clean_content = clean_content.strip()

                cursor.execute("""
                    UPDATE library.library_documents
                    SET title = %s, content = %s, updated_at = NOW()
                    WHERE id = %s
                """, (proper_title, clean_content, doc_id))

                stats['updated'] += 1

                # Commit every 10 docs
                if idx % 10 == 0:
                    conn.commit()

            except Exception as e:
                stats['failed'] += 1
                print(f"   ❌ ERROR: {e}")
                conn.rollback()
        else:
            stats['updated'] += 1

    # Final commit
    if not dry_run:
        conn.commit()

    # Summary
    print()
    print("=" * 80)
    print("THIRD-PASS CLEANUP COMPLETE")
    print("=" * 80)
    print(f"Total documents:  {stats['total']}")
    print(f"✓ Updated:        {stats['updated']}")
    print(f"⊘ No source file: {stats['no_source']}")
    print(f"⊘ No title found: {stats['no_title']}")
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
