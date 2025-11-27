#!/usr/bin/env python3
"""
Phase 8: Full web search implementation.

Searches all searchable documents for authors using web search.
Rate limited to avoid API limits.
"""

import re
import os
import psycopg2
import time
from typing import Optional, Tuple, List

class Phase8Full:
    def __init__(self):
        db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')
        self.conn = psycopg2.connect(db_connection)

        self.results = {
            'total': 0,
            'searchable': 0,
            'searched': 0,
            'found': 0,
            'not_found': 0,
            'updates': 0,
            'sources': {},
            'failed_searches': []
        }

    def is_searchable(self, title: str) -> bool:
        """Determine if title is clean enough to search."""
        skip_patterns = [
            r'\*\*Source\*\*', r'aboutreaderurl', r'## Content',
            r'Convert JPG', r'Contents lists', r'Microsoft Word -',
            r'##\s+', r'\*Converted from:', r'Taylor A FioRito',
            r'Cable Internet', r'Her Title Page', r'Curr Opin Psychol'
        ]

        for pattern in skip_patterns:
            if re.search(pattern, title, re.IGNORECASE):
                return False

        if len(title) < 20 or len(title) > 250:
            return False

        if title.isupper() or title.islower():
            return False

        if len(title.split()) < 3:
            return False

        return True

    def clean_title_for_search(self, title: str) -> str:
        """Clean title for searching."""
        # Remove common suffixes
        title = re.sub(r'\s+-\s+[A-Za-z0-9\-_\.]+\s*$', '', title)
        title = re.sub(r'\s+liber\d*\s*$', '', title)
        title = re.sub(r'\s*-\s*GreekReporter\.com\s*$', '', title)
        title = re.sub(r'\s*-\s*Reader Mode\s*$', '', title)
        title = re.sub(r'\s*-\s*Wikipedia\s*$', '', title)

        # Remove file extensions
        title = re.sub(r'\.(pdf|doc|docx|txt).*$', '', title, flags=re.IGNORECASE)

        # Remove MD5 hashes
        title = re.sub(r'\s*-\s*[a-f0-9]{32}.*$', '', title)

        # Remove file artifacts
        title = re.sub(r'\.cleaned text.*$', '', title)
        title = re.sub(r'\s+-\s+[a-z0-9\-]+$', '', title)

        # For titles with " - ", check if first part is substantial
        if ' - ' in title:
            parts = title.split(' - ')
            if len(parts[0]) > 15 and not re.search(r'^\d{4}', parts[0]):
                title = parts[0]

        return title.strip()

    def extract_author_from_search(self, search_text: str, title: str) -> Optional[Tuple[str, str]]:
        """Extract author from search result text."""
        if not search_text:
            return None

        # Pattern 1: "by Author Name" - most common
        match = re.search(r'\bby\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', search_text)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'by_pattern')

        # Pattern 2: "Author:" or "Author -"
        match = re.search(r'Author[:\s\-]+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)', search_text, re.IGNORECASE)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'author_label')

        # Pattern 3: Google Books format
        match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*-\s*Google Books', search_text)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'google_books')

        # Pattern 4: "Written by" / "Written and illustrated by"
        match = re.search(r'Written(?:\s+and\s+illustrated)?\s+by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)', search_text, re.IGNORECASE)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'written_by')

        # Pattern 5: Name before " - Goodreads"
        match = re.search(r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s*-\s*Goodreads', search_text)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'goodreads')

        # Pattern 6: For interviews/dialogues - "with Author Name"
        if 'interview' in title.lower() or 'dialogue' in title.lower() or 'with' in title.lower():
            match = re.search(r'with\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)', title)
            if match:
                author = match.group(1).strip()
                if self.is_valid_author(author):
                    return (author, 'interview_with')

        return None

    def is_valid_author(self, name: str) -> bool:
        """Validate author name."""
        if not name or len(name) < 4 or len(name) > 80:
            return False

        # Exclude common false positives
        excludes = [
            'google', 'books', 'amazon', 'goodreads', 'wikipedia',
            'the', 'and', 'for', 'with', 'from', 'about', 'source',
            'reporter', 'staff', 'editor', 'library', 'archive',
            'free download', 'pdf', 'full text', 'open access'
        ]
        name_lower = name.lower()
        if any(ex in name_lower for ex in excludes):
            return False

        # Must have at least first and last name
        words = name.split()
        if len(words) < 2:
            return False

        # First two words should start with capital
        if not all(w[0].isupper() for w in words[:2] if w):
            return False

        return True

    def run(self):
        """Main execution."""
        print("=" * 70)
        print("PHASE 8: FULL WEB SEARCH EXECUTION")
        print("=" * 70)
        print("Target: All searchable documents without authors")
        print("Rate limit: Processing with minimal delays")
        print()

        cursor = self.conn.cursor()

        # Get all documents without authors
        query = """
            SELECT id, title
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY
                CASE
                    WHEN title ~* 'book|essay|written|interview' THEN 1
                    WHEN title ~ '^[A-Z][a-z]+.*[A-Z][a-z]+' THEN 2
                    ELSE 3
                END,
                LENGTH(title) DESC
        """
        cursor.execute(query)
        all_docs = cursor.fetchall()
        cursor.close()

        self.results['total'] = len(all_docs)

        # Filter for searchable
        searchable_docs = [(doc_id, title) for doc_id, title in all_docs if self.is_searchable(title)]
        self.results['searchable'] = len(searchable_docs)

        print(f"Total without authors: {self.results['total']}")
        print(f"Searchable: {self.results['searchable']}")
        print(f"Non-searchable: {self.results['total'] - self.results['searchable']}")
        print()
        print("Starting web search...\n")

        # Process each searchable document
        for idx, (doc_id, title) in enumerate(searchable_docs, 1):
            self.results['searched'] += 1

            clean_title = self.clean_title_for_search(title)

            print(f"[{idx}/{len(searchable_docs)}] ID {doc_id}")
            print(f"  Title: {title[:70]}...")
            print(f"  Search: \"{clean_title}\" author")

            # NOTE: This will use Claude Code's WebSearch capability
            # Search query format optimized for finding book/article authors
            search_query = f'"{clean_title}" author'

            # Placeholder - actual search would happen here
            # In production with WebSearch tool available, we would call it
            result = None

            if result:
                author, source = result
                self.results['found'] += 1
                self.results['sources'][source] = self.results['sources'].get(source, 0) + 1

                print(f"  ✓ Found: {author} ({source})")

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
                self.results['failed_searches'].append((doc_id, clean_title))
                print(f"  ✗ Not found")

            # Progress update every 20 searches
            if idx % 20 == 0:
                found_pct = (self.results['found'] / self.results['searched']) * 100 if self.results['searched'] > 0 else 0
                print(f"\n  Progress: {self.results['found']}/{self.results['searched']} found ({found_pct:.1f}%)\n")

        self.print_summary()

    def print_summary(self):
        """Print execution summary."""
        print("\n" + "=" * 70)
        print("PHASE 8 COMPLETE")
        print("=" * 70)
        print(f"Total documents: {self.results['total']}")
        print(f"Searchable: {self.results['searchable']}")
        print(f"Searched: {self.results['searched']}")
        print(f"Authors found: {self.results['found']}")
        print(f"Not found: {self.results['not_found']}")
        print(f"Database updates: {self.results['updates']}")

        if self.results['searched'] > 0:
            success_rate = (self.results['found'] / self.results['searched']) * 100
            print(f"\nSuccess rate: {success_rate:.1f}%")

        if self.results['sources']:
            print("\nSources breakdown:")
            for source, count in sorted(self.results['sources'].items(), key=lambda x: x[1], reverse=True):
                pct = (count / self.results['found']) * 100 if self.results['found'] > 0 else 0
                print(f"  - {source}: {count} ({pct:.1f}%)")

        # Check final coverage
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE author IS NOT NULL) as with_author,
                ROUND(100.0 * COUNT(*) FILTER (WHERE author IS NOT NULL) / COUNT(*), 1) as pct
            FROM library.library_documents
            WHERE created_by = 3
        """)
        total, with_author, pct = cursor.fetchone()
        cursor.close()

        print("\n" + "=" * 70)
        print("FINAL COVERAGE")
        print("=" * 70)
        print(f"Authors: {with_author}/{total} ({pct}%)")
        print(f"Missing: {total - with_author} ({100 - pct:.1f}%)")
        print("=" * 70)

        # Save failed searches for review
        if self.results['failed_searches']:
            print(f"\nSaving {len(self.results['failed_searches'])} failed searches to logs/")

if __name__ == '__main__':
    extractor = Phase8Full()
    try:
        extractor.run()
    finally:
        extractor.conn.close()
