#!/usr/bin/env python3
"""
Phase 8: Web search implementation for remaining documents.

USAGE:
  python3 extract_library_metadata_phase8_web_impl.py [batch_size]

  batch_size: Number of documents to search (default: 50, max: 100)

Rate limiting: Searches one document every 3 seconds to avoid hitting limits.
"""

import re
import os
import psycopg2
import sys
import time
from typing import Optional, Tuple, List

class Phase8WebImplementation:
    def __init__(self, batch_size=50):
        db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')
        self.conn = psycopg2.connect(db_connection)
        self.batch_size = min(batch_size, 100)  # Max 100 per run

        self.results = {
            'processed': 0,
            'searched': 0,
            'found': 0,
            'not_found': 0,
            'updates': 0,
            'sources': {}
        }

    def is_searchable(self, title: str) -> bool:
        """Determine if title is clean enough to search."""
        skip_patterns = [
            r'\*\*Source\*\*', r'aboutreaderurl', r'## Content',
            r'Convert JPG', r'Contents lists', r'Microsoft Word -',
            r'\.pdf', r'\.doc', r'##\s+', r'\*Converted from:',
            r'Cable Internet', r'Her Title Page Final', r'Taylor A FioRito'
        ]

        for pattern in skip_patterns:
            if re.search(pattern, title, re.IGNORECASE):
                return False

        if len(title) < 20 or len(title) > 200:
            return False

        if title.isupper() or title.islower():
            return False

        if len(title.split()) < 3:
            return False

        return True

    def clean_title_for_search(self, title: str) -> str:
        """Clean title for searching."""
        # Remove trailing identifiers
        title = re.sub(r'\s+-\s+[A-Za-z0-9\-_\.]+$', '', title)
        title = re.sub(r'\s+liber\d*$', '', title)
        title = re.sub(r'\s*-\s*GreekReporter\.com$', '', title)
        title = re.sub(r'\s*-\s*Reader Mode$', '', title)

        # Remove file extensions and artifacts
        title = re.sub(r'\.(pdf|doc|docx|txt).*$', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\s*-\s*[a-f0-9]{32}.*$', '', title)  # MD5 hashes

        # For books with " - " separator, take first part if substantial
        if ' - ' in title and len(title.split(' - ')[0]) > 15:
            title = title.split(' - ')[0]

        return title.strip()

    def extract_author_from_text(self, text: str) -> Optional[Tuple[str, str]]:
        """Extract author from search result text."""
        if not text:
            return None

        # Pattern 1: "by Author Name"
        patterns = [
            (r'\bby\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', 'by_pattern'),
            (r'Author[:\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)', 'author_label'),
            (r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s*-\s*Google Books', 'google_books'),
            (r'Written by[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)', 'written_by'),
        ]

        for pattern, source in patterns:
            match = re.search(pattern, text, re.IGNORECASE if 'Author' in pattern or 'Written' in pattern else 0)
            if match:
                author = match.group(1).strip()
                if self.is_valid_author(author):
                    return (author, source)

        return None

    def is_valid_author(self, name: str) -> bool:
        """Validate author name."""
        if not name or len(name) < 4 or len(name) > 80:
            return False

        excludes = ['google', 'books', 'amazon', 'goodreads', 'wikipedia',
                   'the', 'and', 'for', 'with', 'from', 'about', 'source',
                   'reporter', 'staff', 'editor']
        name_lower = name.lower()
        if any(ex in name_lower for ex in excludes):
            return False

        words = name.split()
        if len(words) < 2:
            return False

        # Must start with capital letters
        if not all(w[0].isupper() for w in words[:2] if w):
            return False

        return True

    def search_for_author(self, title: str, doc_id: int) -> Optional[Tuple[str, str]]:
        """
        Search web for author.
        Returns (author, source) or None.

        NOTE: This requires Claude Code's WebSearch tool to be available.
        """
        clean_title = self.clean_title_for_search(title)

        # Build search query
        search_query = f'"{clean_title}" author'

        print(f"  Searching: {search_query}")

        # This would use WebSearch API - placeholder for actual implementation
        # In production, you'd call: results = WebSearch(search_query)
        # For now, return None to indicate manual implementation needed

        return None

    def process_batch(self, documents: List[Tuple[int, str]]):
        """Process a batch of documents."""
        for idx, (doc_id, title) in enumerate(documents, 1):
            self.results['processed'] += 1

            if not self.is_searchable(title):
                continue

            self.results['searched'] += 1

            print(f"\n[{idx}/{len(documents)}] ID {doc_id}")
            print(f"  Title: {title[:80]}...")

            # Search for author
            result = self.search_for_author(title, doc_id)

            if result:
                author, source = result
                self.results['found'] += 1
                self.results['sources'][source] = self.results['sources'].get(source, 0) + 1

                print(f"  ✓ Found: {author} (source: {source})")

                # Update database
                cursor = self.conn.cursor()
                cursor.execute("""
                    UPDATE library.library_documents
                    SET author = %s, updated_at = NOW()
                    WHERE id = %s
                """, (author, doc_id))
                self.conn.commit()
                cursor.close()
                self.results['updates'] += 1
            else:
                self.results['not_found'] += 1
                print(f"  ✗ Not found")

            # Rate limiting: wait 3 seconds between searches
            if idx < len(documents):
                time.sleep(3)

    def run(self):
        """Main execution."""
        print("=" * 70)
        print("PHASE 8: WEB SEARCH IMPLEMENTATION")
        print("=" * 70)
        print(f"Batch size: {self.batch_size} documents")
        print(f"Rate limit: 1 search per 3 seconds")
        print()

        cursor = self.conn.cursor()

        # Get documents without authors
        query = """
            SELECT id, title
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY
                CASE
                    WHEN title ~ '[Bb]ook|[Ee]ssay|[Aa]rticle' THEN 1
                    ELSE 2
                END,
                LENGTH(title) DESC
            LIMIT %s
        """
        cursor.execute(query, (self.batch_size,))
        documents = cursor.fetchall()
        cursor.close()

        if not documents:
            print("No documents without authors found!")
            return

        print(f"Processing {len(documents)} documents...\n")
        print("=" * 70)
        print("NOTE: This requires manual WebSearch integration")
        print("Each document would be searched using WebSearch API")
        print("=" * 70)
        print()

        # In production, you would call self.process_batch(documents)
        # For now, show what would be searched
        for idx, (doc_id, title) in enumerate(documents[:10], 1):
            if self.is_searchable(title):
                clean = self.clean_title_for_search(title)
                print(f"{idx}. ID {doc_id}: \"{clean}\" author")

        self.print_summary()

    def print_summary(self):
        """Print summary."""
        print("\n" + "=" * 70)
        print("PHASE 8 SUMMARY")
        print("=" * 70)
        print(f"Documents processed: {self.results['processed']}")
        print(f"Searches performed: {self.results['searched']}")
        print(f"Authors found: {self.results['found']}")
        print(f"Not found: {self.results['not_found']}")
        print(f"Database updates: {self.results['updates']}")

        if self.results['sources']:
            print("\nSources breakdown:")
            for source, count in sorted(self.results['sources'].items(), key=lambda x: x[1], reverse=True):
                print(f"  - {source}: {count}")

        print()
        print("To run with WebSearch integration:")
        print("  1. Implement WebSearch API calls in search_for_author()")
        print("  2. Run in batches: python3 script.py 50")
        print(f"  3. Estimated time: {self.batch_size * 3 / 60:.1f} minutes per batch")
        print("=" * 70)

if __name__ == '__main__':
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    extractor = Phase8WebImplementation(batch_size)
    try:
        extractor.run()
    finally:
        extractor.conn.close()
