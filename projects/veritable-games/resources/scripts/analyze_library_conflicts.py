#!/usr/bin/env python3
"""
Library Import Conflict Analysis

Analyzes which markdown files couldn't be imported due to slug conflicts.
Generates a detailed report showing:
- Markdown file details (title, author from tracking.csv)
- Existing database record (title, author, source)
- Conflict type (true duplicate vs different author)

Usage:
    python3 analyze_library_conflicts.py
"""

import os
import re
import csv
from pathlib import Path
import psycopg2
from typing import Dict, List, Optional

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
TRACKING_CSV = LIBRARY_PATH / 'tracking.csv'
CONFLICT_REPORT = Path('/home/user/projects/veritable-games/resources/scripts/library_conflict_report.csv')


class ConflictAnalyzer:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.tracking_data: Dict[str, dict] = {}
        self.conflicts: List[dict] = []

    def load_tracking_csv(self):
        """Load tracking.csv metadata."""
        if not TRACKING_CSV.exists():
            print(f"Warning: tracking.csv not found at {TRACKING_CSV}")
            return

        try:
            with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    index_file = row.get('INDEX File', '').strip()
                    if index_file:
                        self.tracking_data[index_file] = {
                            'author': row.get('Author(s)', '').strip(),
                            'publication_date': row.get('Publication Date', '').strip(),
                            'topic': row.get('Topic', '').strip(),
                        }
            print(f"✓ Loaded {len(self.tracking_data)} entries from tracking.csv\n")
        except Exception as e:
            print(f"✗ Error loading tracking.csv: {e}")

    def extract_title_from_content(self, content: str) -> Optional[str]:
        """Extract title from markdown content (first # heading)."""
        lines = content.split('\n')
        for line in lines[:50]:
            line = line.strip()
            if line.startswith('# '):
                title = line[2:].strip()
                # Remove trailing #
                title = re.sub(r'#+$', '', title).strip()
                return title
        return None

    def generate_slug(self, title: str) -> str:
        """Generate URL-friendly slug from title."""
        slug = title.lower()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = slug.strip('-')

        if len(slug) > 200:
            slug = slug[:200].rstrip('-')

        return slug

    def get_existing_document(self, slug: str) -> Optional[dict]:
        """Get existing document from database by slug."""
        # Check library documents
        self.cur.execute("""
            SELECT id, title, author, 'library' as source, created_by
            FROM library.library_documents
            WHERE slug = %s
        """, (slug,))
        result = self.cur.fetchone()

        if result:
            return {
                'id': result[0],
                'title': result[1],
                'author': result[2] or 'Unknown',
                'source': result[3],
                'created_by': result[4]
            }

        # Check anarchist documents
        self.cur.execute("""
            SELECT id, title, author, 'anarchist' as source
            FROM anarchist.documents
            WHERE slug = %s
        """, (slug,))
        result = self.cur.fetchone()

        if result:
            return {
                'id': result[0],
                'title': result[1],
                'author': result[2] or 'Unknown',
                'source': result[3],
                'created_by': None
            }

        return None

    def analyze_conflicts(self):
        """Analyze all markdown files and identify conflicts."""
        print("="*70)
        print("Library Import Conflict Analysis")
        print("="*70)
        print(f"Source: {LIBRARY_PATH}")
        print(f"Database: {DATABASE_URL}\n")

        # Load tracking data
        self.load_tracking_csv()

        # Find all markdown files
        md_files = list(LIBRARY_PATH.glob('*.md'))
        print(f"Found {len(md_files)} markdown files\n")
        print("Analyzing conflicts...\n")

        conflict_count = 0
        imported_count = 0

        for md_path in md_files:
            filename = md_path.name

            # Read file content
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"✗ Error reading {filename}: {e}")
                continue

            # Extract title
            title = self.extract_title_from_content(content)
            if not title:
                # Fallback: use filename
                title = filename.replace('.md', '').replace('_', ' ').replace('-', ' ').title()

            # Generate slug
            slug = self.generate_slug(title)

            # Get metadata from tracking.csv
            csv_metadata = self.tracking_data.get(filename, {})
            md_author = csv_metadata.get('author', 'Unknown')

            # Check if document exists in database
            existing = self.get_existing_document(slug)

            if existing:
                # Check if it's from library-importer (created_by=3)
                if existing.get('created_by') == 3:
                    imported_count += 1
                else:
                    # It's a conflict (existed from anarchist library)
                    conflict_count += 1

                    # Determine conflict type
                    if md_author.lower() == existing['author'].lower():
                        conflict_type = 'true_duplicate'
                    elif md_author == 'Unknown' or existing['author'] == 'Unknown':
                        conflict_type = 'unknown_author'
                    else:
                        conflict_type = 'different_author'

                    self.conflicts.append({
                        'filename': filename,
                        'md_title': title,
                        'md_author': md_author,
                        'slug': slug,
                        'existing_title': existing['title'],
                        'existing_author': existing['author'],
                        'existing_source': existing['source'],
                        'conflict_type': conflict_type
                    })

        print(f"Analysis complete:")
        print(f"  Total markdown files: {len(md_files)}")
        print(f"  Successfully imported: {imported_count}")
        print(f"  Conflicts (skipped): {conflict_count}")
        print()

        # Save conflicts to CSV
        self.save_conflict_report()

    def save_conflict_report(self):
        """Save conflict analysis to CSV."""
        if not self.conflicts:
            print("✓ No conflicts detected (all documents imported successfully)")
            return

        try:
            with open(CONFLICT_REPORT, 'w', newline='', encoding='utf-8') as f:
                fieldnames = [
                    'conflict_type', 'filename', 'slug',
                    'md_title', 'md_author',
                    'existing_title', 'existing_author', 'existing_source'
                ]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.conflicts)

            # Print conflict breakdown
            print(f"⚠️  Found {len(self.conflicts)} conflicts")
            print(f"   Conflict report saved to: {CONFLICT_REPORT}\n")

            # Count by conflict type
            true_dups = sum(1 for c in self.conflicts if c['conflict_type'] == 'true_duplicate')
            diff_authors = sum(1 for c in self.conflicts if c['conflict_type'] == 'different_author')
            unknown = sum(1 for c in self.conflicts if c['conflict_type'] == 'unknown_author')

            print("Conflict Breakdown:")
            print(f"  True duplicates (same title, same author): {true_dups}")
            print(f"  Different authors (same title, different author): {diff_authors}")
            print(f"  Unknown author conflicts: {unknown}")

        except Exception as e:
            print(f"✗ Error saving conflict report: {e}")


def main():
    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print(f"✓ Connected to database\n")
    except Exception as e:
        print(f"✗ Error connecting to database: {e}")
        return

    try:
        analyzer = ConflictAnalyzer(conn)
        analyzer.analyze_conflicts()
    finally:
        conn.close()


if __name__ == '__main__':
    main()
