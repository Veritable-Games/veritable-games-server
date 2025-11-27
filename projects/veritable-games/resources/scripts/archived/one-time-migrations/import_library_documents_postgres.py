#!/usr/bin/env python3
"""
Library Documents Import Script for PostgreSQL

Imports 4,432+ markdown library documents into PostgreSQL with:
- Full content storage in database
- 3-tier hybrid tag extraction (prefix + frequency + LLM)
- Category-based organization (13 categories from filename prefix)
- Metadata from tracking.csv integration

Usage:
    python3 import_library_documents_postgres.py [--limit N] [--dry-run] [--incremental]

Requirements:
    - PostgreSQL database running
    - DATABASE_URL environment variable set
    - tracking.csv file in library directory
"""

import os
import sys
import re
import csv
import yaml
from pathlib import Path
from collections import Counter
import psycopg2
from typing import Dict, List, Optional, Set, Tuple

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')
TRACKING_CSV = LIBRARY_PATH / 'tracking.csv'
DUPLICATES_LOG = Path('/home/user/projects/veritable-games/resources/scripts/library_import_duplicates.csv')
LIBRARY_IMPORTER_USER_ID = 3  # Created in Phase 1

# Category prefix mapping (filename prefix → category_id)
CATEGORY_MAP = {
    '01': 12,  # political-theory
    '02': 13,  # game-design
    '03': 5,   # research
    '04': 14,  # education
    '05': 15,  # architecture
    '06': 16,  # technology-ai
    '07': 6,   # psychology
    '08': 7,   # economics
    '09': 8,   # environment
    '10': 9,   # history
    '11': 10,  # art-culture
    '12': 1,   # reference
    '13': 11,  # fiction
}

# Prefix → guaranteed tags mapping (Tier 1)
PREFIX_TAG_MAP = {
    '01': ['political-theory'],
    '02': ['game-design'],
    '03': ['research', 'academic'],
    '04': ['education', 'pedagogy'],
    '05': ['architecture', 'urban-planning'],
    '06': ['technology', 'artificial-intelligence'],
    '07': ['psychology'],
    '08': ['economics', 'social-theory'],
    '09': ['environment', 'ecology'],
    '10': ['history', 'historical'],
    '11': ['art', 'culture'],
    '12': ['reference', 'manual'],
    '13': ['fiction', 'literature'],
}

# Document type → tags mapping
DOCTYPE_TAG_MAP = {
    'Article': ['article'],
    'Articles': ['article'],
    'Book': ['book'],
    'Books': ['book'],
    'Paper': ['paper', 'research-paper'],
    'Papers': ['paper', 'research-paper'],
    'Pedagogy': ['pedagogy'],
    'Documents': ['document'],
    'Manuals': ['manual'],
}

# Common English stopwords to filter out from frequency analysis
STOPWORDS = {
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his',
    'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
    'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
    'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year',
    'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
    'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
    'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most',
    'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did',
    'having', 'may', 'should', 'am', 'being'
}


class LibraryImporter:
    def __init__(self, conn, dry_run=False, incremental=False):
        self.conn = conn
        self.cur = conn.cursor()
        self.dry_run = dry_run
        self.incremental = incremental
        self.tag_cache: Dict[str, int] = {}  # tag_name → tag_id
        self.tracking_data: Dict[str, dict] = {}
        self.duplicate_records: List[dict] = []  # Track duplicate slugs for analysis
        self.stats = {
            'imported': 0,
            'skipped': 0,
            'errors': 0,
            'total': 0
        }

    def load_tracking_csv(self):
        """Load tracking.csv metadata into memory."""
        if not TRACKING_CSV.exists():
            print(f"Warning: tracking.csv not found at {TRACKING_CSV}")
            return

        try:
            with open(TRACKING_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    index_file = row.get('INDEX File', '').strip()
                    if index_file:
                        # Store by filename for lookup
                        self.tracking_data[index_file] = {
                            'author': row.get('Author(s)', '').strip(),
                            'publication_date': row.get('Publication Date', '').strip(),
                            'page_count': row.get('Page Count', '').strip(),
                            'topic': row.get('Topic', '').strip(),
                            'source': row.get('Source', '').strip(),
                            'notes': row.get('Notes', '').strip(),
                        }
            print(f"Loaded {len(self.tracking_data)} entries from tracking.csv\n")
        except Exception as e:
            print(f"Error loading tracking.csv: {e}")

    def extract_category_from_filename(self, filename: str) -> Optional[Tuple[str, str, str]]:
        """
        Extract category prefix, doctype, and title slug from filename.

        Pattern: {PREFIX}_{CATEGORY}_{DOCTYPE}_{slug}.md
        Example: 01_Political_Theory_Books_Are_Prisons_Obsolete.md

        Returns: (prefix, doctype, slug) or None
        """
        # Handle both singular and plural forms
        pattern = r'^(\d{2})_([^_]+)_(Article|Articles|Book|Books|Paper|Papers|Pedagogy|Documents|Manuals)_(.+)\.md$'
        match = re.match(pattern, filename, re.IGNORECASE)

        if match:
            prefix, category, doctype, slug = match.groups()
            return (prefix, doctype, slug)

        # Fallback: try simpler pattern without doctype
        pattern2 = r'^(\d{2})_([^_]+)_(.+)\.md$'
        match2 = re.match(pattern2, filename)
        if match2:
            prefix, category, slug = match2.groups()
            return (prefix, '', slug)  # No doctype

        return None

    def extract_title_from_content(self, content: str) -> Optional[str]:
        """Extract title from H1 heading in markdown content."""
        lines = content.strip().split('\n')
        for line in lines[:10]:  # Check first 10 lines
            if line.startswith('# '):
                title = line[2:].strip()
                # Clean up: remove .pdf extension, decode URL encoding
                title = re.sub(r'\.pdf$', '', title, flags=re.IGNORECASE)
                title = title.replace('_', ' ')
                return title
        return None

    def generate_slug(self, title: str, fallback_idx: int = 0) -> str:
        """
        Generate URL-friendly slug from title.

        Sanitizes to lowercase alphanumeric + hyphens only.
        """
        # Convert to lowercase
        slug = title.lower()
        # Replace spaces and underscores with hyphens
        slug = re.sub(r'[\s_]+', '-', slug)
        # Remove non-alphanumeric characters (except hyphens)
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        # Remove multiple consecutive hyphens
        slug = re.sub(r'-+', '-', slug)
        # Trim hyphens from ends
        slug = slug.strip('-')

        # Fallback if slug is empty
        if not slug:
            slug = f'document-{fallback_idx}'

        # Truncate if too long (database limit)
        if len(slug) > 200:
            slug = slug[:200].rstrip('-')

        return slug

    def extract_frequency_tags(self, title: str, content: str, max_tags: int = 10) -> List[str]:
        """
        Tier 2: Extract tags based on word frequency analysis.

        Scans title + first 2000 chars for most frequent meaningful words.
        """
        # Combine title (weighted 5x) and content sample
        text = (title + ' ') * 5 + content[:2000]

        # Normalize: lowercase, split on non-word characters
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())

        # Filter stopwords
        words = [w for w in words if w not in STOPWORDS]

        # Count frequency
        counter = Counter(words)

        # Get top N most common
        top_words = [word for word, count in counter.most_common(max_tags * 2)]

        # Convert to tags (kebab-case)
        tags = []
        for word in top_words:
            tag = word.replace('_', '-')
            if len(tag) >= 3 and tag not in tags:
                tags.append(tag)
            if len(tags) >= max_tags:
                break

        return tags

    def get_or_create_tag(self, tag_name: str) -> int:
        """Get existing tag ID or create new tag in shared.tags."""
        # Check cache first
        if tag_name in self.tag_cache:
            return self.tag_cache[tag_name]

        if self.dry_run:
            # In dry-run, just cache with fake ID
            self.tag_cache[tag_name] = -1
            return -1

        # Check if tag exists in shared.tags
        self.cur.execute(
            "SELECT id FROM shared.tags WHERE name = %s",
            (tag_name,)
        )
        result = self.cur.fetchone()

        if result:
            tag_id = result[0]
        else:
            # Create new tag in shared.tags
            self.cur.execute(
                "INSERT INTO shared.tags (name) VALUES (%s) RETURNING id",
                (tag_name,)
            )
            tag_id = self.cur.fetchone()[0]

        self.tag_cache[tag_name] = tag_id
        return tag_id

    def normalize_tag(self, tag: str) -> str:
        """Normalize tag: lowercase, strip whitespace, convert spaces to hyphens."""
        normalized = tag.strip().lower()
        normalized = re.sub(r'\s+', '-', normalized)  # Spaces to hyphens
        normalized = re.sub(r'[^a-z0-9-]', '', normalized)  # Remove special chars
        normalized = re.sub(r'-+', '-', normalized)  # Collapse multiple hyphens
        return normalized.strip('-')

    def extract_tags_tier1_prefix(self, prefix: str, doctype: str) -> List[str]:
        """Tier 1: Extract guaranteed tags from filename prefix and doctype."""
        tags = []

        # Category tags from prefix
        if prefix in PREFIX_TAG_MAP:
            tags.extend(PREFIX_TAG_MAP[prefix])

        # Doctype tags
        if doctype in DOCTYPE_TAG_MAP:
            tags.extend(DOCTYPE_TAG_MAP[doctype])

        return tags

    def import_document(self, md_path: Path, idx: int) -> bool:
        """
        Import a single markdown document.

        Returns True if successful, False otherwise.
        """
        try:
            # Extract metadata from filename
            filename = md_path.name
            category_data = self.extract_category_from_filename(filename)

            if not category_data:
                print(f"[{idx:5d}] SKIP: Could not parse filename: {filename}")
                self.stats['skipped'] += 1
                return False

            prefix, doctype, slug_from_filename = category_data
            category_id = CATEGORY_MAP.get(prefix)

            if not category_id:
                print(f"[{idx:5d}] SKIP: Unknown prefix '{prefix}': {filename}")
                self.stats['skipped'] += 1
                return False

            # Read file content
            try:
                with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            except Exception as e:
                print(f"[{idx:5d}] ERROR reading file {filename}: {e}")
                self.stats['errors'] += 1
                return False

            # Extract title from content or filename
            title = self.extract_title_from_content(content)
            if not title:
                # Fallback: use slug from filename
                title = slug_from_filename.replace('-', ' ').replace('_', ' ').title()

            if not title:
                print(f"[{idx:5d}] SKIP: No title found: {filename}")
                self.stats['skipped'] += 1
                return False

            # Generate slug
            slug = self.generate_slug(title, idx)

            # Check if document already exists (for incremental imports)
            if self.incremental and not self.dry_run:
                self.cur.execute("SELECT id FROM library.library_documents WHERE slug = %s", (slug,))
                if self.cur.fetchone():
                    print(f"[{idx:5d}] SKIP: Already exists: {slug}")
                    self.stats['skipped'] += 1
                    return False

            # Get metadata from tracking.csv
            tracking_key = filename  # or filename without extension
            csv_metadata = self.tracking_data.get(tracking_key, {})

            author = csv_metadata.get('author') or None
            publication_date = csv_metadata.get('publication_date') or None

            # Determine document_type from doctype
            if doctype.lower() in ['book', 'books']:
                document_type = 'book'
            elif doctype.lower() in ['article', 'articles']:
                document_type = 'article'
            elif doctype.lower() in ['paper', 'papers']:
                document_type = 'paper'
            elif doctype.lower() == 'manuals':
                document_type = 'manual'
            elif doctype.lower() == 'pedagogy':
                document_type = 'guide'
            else:
                document_type = 'document'

            # Tier 1: Extract prefix tags (guaranteed)
            tags_tier1 = self.extract_tags_tier1_prefix(prefix, doctype)

            # Tier 2: Extract frequency tags
            tags_tier2 = self.extract_frequency_tags(title, content)

            # Tier 3: LLM tags (placeholder - will be done in batch later)
            tags_tier3 = []  # Populated in separate LLM batch process

            # Merge and deduplicate tags
            all_tags = tags_tier1 + tags_tier2 + tags_tier3
            normalized_tags = []
            seen = set()
            for tag in all_tags:
                normalized = self.normalize_tag(tag)
                if normalized and normalized not in seen and len(normalized) >= 3:
                    normalized_tags.append(normalized)
                    seen.add(normalized)

            if self.dry_run:
                print(f"[{idx:5d}] DRY-RUN: Would import '{title[:50]}...' "
                      f"({len(normalized_tags)} tags, category={prefix})")
                self.stats['imported'] += 1
                return True

            # Insert document into database
            try:
                self.cur.execute("""
                    INSERT INTO library.library_documents
                    (slug, title, author, publication_date, content, document_type,
                     status, language, category_id, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    RETURNING id
                """, (
                    slug, title, author, publication_date, content, document_type,
                    'published', 'en', category_id, LIBRARY_IMPORTER_USER_ID
                ))

                doc_id = self.cur.fetchone()[0]

                # Insert tags
                for tag_name in normalized_tags:
                    tag_id = self.get_or_create_tag(tag_name)
                    if tag_id > 0:  # Skip fake IDs from dry-run
                        self.cur.execute("""
                            INSERT INTO library.library_document_tags (document_id, tag_id)
                            VALUES (%s, %s)
                            ON CONFLICT DO NOTHING
                        """, (doc_id, tag_id))

                self.stats['imported'] += 1

                if idx % 100 == 0:
                    print(f"[{idx:5d}] Imported: {title[:60]}... ({len(normalized_tags)} tags)")

                return True

            except psycopg2.IntegrityError as e:
                if 'duplicate key' in str(e):
                    print(f"[{idx:5d}] SKIP: Duplicate slug: {slug}")
                    self.stats['skipped'] += 1

                    # Log duplicate for analysis
                    self.duplicate_records.append({
                        'slug': slug,
                        'title': title,
                        'author': author or 'Unknown',
                        'filename': md_path.name,
                        'category': prefix,
                        'doctype': doctype
                    })

                    self.conn.rollback()
                    # Clear tag cache after rollback since tag IDs may be invalid
                    self.tag_cache.clear()
                    return False
                else:
                    raise

        except Exception as e:
            print(f"[{idx:5d}] ERROR importing {md_path.name}: {e}")
            self.stats['errors'] += 1
            if not self.dry_run:
                self.conn.rollback()
                # Clear tag cache after rollback since tag IDs may be invalid
                self.tag_cache.clear()
            return False

    def save_duplicates_to_csv(self):
        """Save duplicate slug records to CSV for analysis."""
        if not self.duplicate_records:
            print("\n✓ No duplicate slugs detected")
            return

        try:
            with open(DUPLICATES_LOG, 'w', newline='', encoding='utf-8') as f:
                fieldnames = ['slug', 'title', 'author', 'filename', 'category', 'doctype']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(self.duplicate_records)

            print(f"\n⚠️  Found {len(self.duplicate_records)} duplicate slugs")
            print(f"   Duplicate records saved to: {DUPLICATES_LOG}")
        except Exception as e:
            print(f"\n✗ Error saving duplicates log: {e}")

    def run(self, limit: Optional[int] = None):
        """Run the import process."""
        print("="*70)
        print("Library Documents Import to PostgreSQL")
        print("="*70)
        print(f"Source: {LIBRARY_PATH}")
        print(f"Database: {DATABASE_URL}")
        print(f"Dry-run: {self.dry_run}")
        print(f"Incremental: {self.incremental}")
        if limit:
            print(f"Limit: {limit} documents")
        print()

        # Load tracking.csv
        self.load_tracking_csv()

        # Find all .md files
        md_files = list(LIBRARY_PATH.glob('*.md'))
        md_files = sorted(md_files)  # Deterministic order

        if limit:
            md_files = md_files[:limit]

        self.stats['total'] = len(md_files)

        print(f"Found {self.stats['total']} markdown files\n")
        print("Starting import...\n")

        # Process documents
        for idx, md_path in enumerate(md_files, 1):
            self.import_document(md_path, idx)

            # Commit every 500 documents
            if idx % 500 == 0 and not self.dry_run:
                self.conn.commit()
                print(f"\n[COMMIT] Batch {idx} committed\n")

        # Final commit
        if not self.dry_run:
            self.conn.commit()

        # Save duplicate records to CSV
        self.save_duplicates_to_csv()

        # Print final statistics
        print("\n" + "="*70)
        print("Import Complete!")
        print("="*70)
        print(f"  Imported: {self.stats['imported']}")
        print(f"  Skipped: {self.stats['skipped']}")
        print(f"  Errors: {self.stats['errors']}")
        print(f"  Total processed: {self.stats['total']}")
        if self.stats['total'] > 0:
            success_rate = (self.stats['imported'] / self.stats['total']) * 100
            print(f"  Success rate: {success_rate:.1f}%")
        print("="*70)


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Import library documents to PostgreSQL')
    parser.add_argument('--limit', type=int, help='Limit number of documents to import')
    parser.add_argument('--dry-run', action='store_true', help='Run without modifying database')
    parser.add_argument('--incremental', action='store_true', help='Skip existing documents')
    args = parser.parse_args()

    # Connect to database
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print(f"✓ Connected to database\n")
    except Exception as e:
        print(f"✗ Error connecting to database: {e}", file=sys.stderr)
        print(f"DATABASE_URL: {DATABASE_URL}", file=sys.stderr)
        sys.exit(1)

    try:
        importer = LibraryImporter(conn, dry_run=args.dry_run, incremental=args.incremental)
        importer.run(limit=args.limit)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
