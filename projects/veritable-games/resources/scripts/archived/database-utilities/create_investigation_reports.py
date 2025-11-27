#!/usr/bin/env python3
"""
Create comprehensive reports for manual investigation:
1. 16 overlapping documents (library + anarchist)
2. 513 "missing" files (not imported)
"""

import psycopg2
import os
import csv
import re
from pathlib import Path

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
TRACKING_CSV = LIBRARY_PATH / 'tracking.csv'
OUTPUT_DIR = Path('/home/user/Desktop')

def load_tracking_csv():
    """Load tracking.csv metadata."""
    tracking_data = {}
    if not TRACKING_CSV.exists():
        return tracking_data

    try:
        with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                index_file = row.get('INDEX File', '').strip()
                if index_file:
                    tracking_data[index_file] = {
                        'author': row.get('Author(s)', '').strip(),
                        'publication_date': row.get('Publication Date', '').strip(),
                        'page_count': row.get('Page Count', '').strip(),
                        'topic': row.get('Topic', '').strip(),
                    }
    except Exception as e:
        print(f"Error loading tracking.csv: {e}")

    return tracking_data

def extract_title_from_content(content):
    """Extract title from markdown content."""
    lines = content.split('\n')
    for line in lines[:50]:
        line = line.strip()
        if line.startswith('# '):
            title = line[2:].strip()
            title = re.sub(r'#+$', '', title).strip()
            return title
    return None

def generate_slug(title):
    """Generate slug from title (matching import script)."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 200:
        slug = slug[:200].rstrip('-')
    return slug

def create_overlaps_report(conn, tracking_data):
    """Create report of 16 documents that exist in both library and anarchist."""
    cur = conn.cursor()

    # Get all library documents
    cur.execute("""
        SELECT ld.id, ld.slug, ld.title, ld.author, ld.content
        FROM library.library_documents ld
        WHERE ld.created_by = 3
        ORDER BY ld.slug
    """)
    library_docs = cur.fetchall()

    overlaps = []
    for lib_id, lib_slug, lib_title, lib_author, lib_content in library_docs:
        # Check if exists in anarchist
        cur.execute("""
            SELECT id, slug, title, author, language
            FROM anarchist.documents
            WHERE slug = %s
        """, (lib_slug,))
        anarchist_match = cur.fetchone()

        if anarchist_match:
            anarch_id, anarch_slug, anarch_title, anarch_author, anarch_lang = anarchist_match

            # Find corresponding markdown file
            md_file = None
            md_author = None
            for filename in tracking_data.keys():
                # Try to match by extracting slug from filename
                if lib_slug in filename.lower():
                    md_file = filename
                    md_author = tracking_data[filename].get('author', '')
                    break

            overlaps.append({
                'slug': lib_slug,
                'markdown_file': md_file or 'NOT FOUND',
                'markdown_author': md_author or '',
                'library_id': lib_id,
                'library_title': lib_title,
                'library_author': lib_author or 'Unknown',
                'library_content_length': len(lib_content) if lib_content else 0,
                'anarchist_id': anarch_id,
                'anarchist_title': anarch_title,
                'anarchist_author': anarch_author or 'Unknown',
                'anarchist_language': anarch_lang or 'en',
            })

    # Write to CSV
    output_file = OUTPUT_DIR / 'library_anarchist_overlaps.csv'
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'slug', 'markdown_file', 'markdown_author',
            'library_id', 'library_title', 'library_author', 'library_content_length',
            'anarchist_id', 'anarchist_title', 'anarchist_author', 'anarchist_language'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(overlaps)

    print(f"✓ Created overlaps report: {output_file}")
    print(f"  Found {len(overlaps)} documents in both library and anarchist")
    return len(overlaps)

def create_missing_files_report(conn, tracking_data):
    """Create report of files that weren't imported."""
    cur = conn.cursor()

    # Get all imported slugs
    cur.execute("""
        SELECT slug FROM library.library_documents WHERE created_by = 3
    """)
    imported_slugs = set(row[0] for row in cur.fetchall())

    # Check all markdown files
    md_files = list(LIBRARY_PATH.glob('*.md'))
    missing = []

    for md_path in md_files:
        filename = md_path.name

        # Read content
        try:
            with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            missing.append({
                'filename': filename,
                'reason': f'READ_ERROR: {str(e)}',
                'md_title': '',
                'md_author': '',
                'slug_generated': '',
                'file_size_bytes': md_path.stat().st_size,
                'in_anarchist': 'UNKNOWN',
                'anarchist_title': '',
                'anarchist_author': '',
            })
            continue

        # Extract title
        title = extract_title_from_content(content)
        if not title:
            # Fallback: use filename
            title = filename.replace('.md', '').replace('_', ' ').replace('-', ' ').title()

        # Generate slug
        slug = generate_slug(title)

        # Check if imported
        if slug in imported_slugs:
            continue  # Successfully imported

        # Get metadata from tracking.csv
        csv_metadata = tracking_data.get(filename, {})
        md_author = csv_metadata.get('author', '')

        # Check if exists in anarchist library
        cur.execute("""
            SELECT id, title, author
            FROM anarchist.documents
            WHERE slug = %s
        """, (slug,))
        anarchist_match = cur.fetchone()

        reason = 'NOT_IMPORTED'
        if anarchist_match:
            reason = 'EXISTS_IN_ANARCHIST'

        missing.append({
            'filename': filename,
            'reason': reason,
            'md_title': title[:200],
            'md_author': md_author,
            'slug_generated': slug,
            'file_size_bytes': md_path.stat().st_size,
            'in_anarchist': 'YES' if anarchist_match else 'NO',
            'anarchist_title': anarchist_match[1] if anarchist_match else '',
            'anarchist_author': anarchist_match[2] if anarchist_match else '',
        })

    # Write to CSV
    output_file = OUTPUT_DIR / 'library_missing_files.csv'
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'filename', 'reason', 'md_title', 'md_author', 'slug_generated',
            'file_size_bytes', 'in_anarchist', 'anarchist_title', 'anarchist_author'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(missing)

    print(f"✓ Created missing files report: {output_file}")
    print(f"  Found {len(missing)} files not imported")

    # Print breakdown
    reasons = {}
    for item in missing:
        reason = item['reason']
        reasons[reason] = reasons.get(reason, 0) + 1

    print("\n  Breakdown by reason:")
    for reason, count in sorted(reasons.items(), key=lambda x: x[1], reverse=True):
        print(f"    {reason}: {count}")

    return len(missing)

def main():
    print("="*70)
    print("Creating Investigation Reports")
    print("="*70)
    print(f"Output directory: {OUTPUT_DIR}\n")

    # Load tracking data
    print("Loading tracking.csv...")
    tracking_data = load_tracking_csv()
    print(f"✓ Loaded {len(tracking_data)} entries\n")

    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)

    try:
        # Create reports
        overlap_count = create_overlaps_report(conn, tracking_data)
        print()
        missing_count = create_missing_files_report(conn, tracking_data)

        print(f"\n{'='*70}")
        print("Reports Complete!")
        print(f"{'='*70}")
        print(f"Files created in: {OUTPUT_DIR}")
        print(f"  1. library_anarchist_overlaps.csv ({overlap_count} records)")
        print(f"  2. library_missing_files.csv ({missing_count} records)")
        print(f"{'='*70}")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
