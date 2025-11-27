#!/usr/bin/env python3
"""
Phase 8: Web search for remaining documents.

Use web searching (Google Books, WorldCat, general search) to find authors
for documents with clean, searchable titles.
"""

import re
import os
import psycopg2
from typing import Optional, Tuple
import time

class Phase8WebSearch:
    def __init__(self):
        db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')
        self.conn = psycopg2.connect(db_connection)

        self.results = {
            'processed': 0,
            'searchable': 0,
            'found': 0,
            'skipped': 0,
            'patterns': {},
            'updates': 0
        }

    def is_searchable(self, title: str) -> bool:
        """Determine if title is clean enough to search."""
        # Skip titles with corruption artifacts
        skip_patterns = [
            r'\*\*Source\*\*',
            r'aboutreaderurl',
            r'## Content',
            r'Convert JPG',
            r'Contents lists',
            r'Microsoft Word -',
            r'\.pdf|\.doc|\.docx',
            r'##\s+',
            r'\*Converted from:',
            r'Cable Internet',
            r'Her Title Page Final'
        ]

        for pattern in skip_patterns:
            if re.search(pattern, title, re.IGNORECASE):
                return False

        # Must have reasonable length
        if len(title) < 20 or len(title) > 200:
            return False

        # Must have some proper capitalization (not all caps or all lowercase)
        if title.isupper() or title.islower():
            return False

        # Should have multiple words
        if len(title.split()) < 3:
            return False

        return True

    def clean_title_for_search(self, title: str) -> str:
        """Clean title to make it more searchable."""
        # Remove trailing identifiers
        title = re.sub(r'\s+-\s+[A-Za-z0-9\-]+$', '', title)
        title = re.sub(r'\s+liber\d*$', '', title)

        # Remove file extensions
        title = re.sub(r'\.(pdf|doc|docx|txt).*$', '', title, flags=re.IGNORECASE)

        # Remove "Reader Mode" suffix
        title = re.sub(r'\s+-\s+Reader Mode$', '', title)

        # Take first part before " - " if it looks like a book title
        if ' - ' in title:
            parts = title.split(' - ')
            if len(parts[0]) > 15:  # First part is substantial
                title = parts[0]

        return title.strip()

    def extract_author_from_search_result(self, title: str, search_results: str) -> Optional[Tuple[str, str]]:
        """
        Extract author from web search results.
        Returns (author, source) tuple.
        """
        # Pattern 1: "by Author Name"
        match = re.search(r'\bby\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', search_results)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'web_by_pattern')

        # Pattern 2: "Author Name - Google Books"
        match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*-\s*Google Books', search_results)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'google_books')

        # Pattern 3: Look for author in book description
        match = re.search(r'Author[:\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)', search_results, re.IGNORECASE)
        if match:
            author = match.group(1).strip()
            if self.is_valid_author(author):
                return (author, 'web_author_label')

        return None

    def is_valid_author(self, name: str) -> bool:
        """Validate extracted author name."""
        if not name or len(name) < 4:
            return False

        excludes = ['google', 'books', 'amazon', 'goodreads', 'wikipedia',
                   'the', 'and', 'for', 'with', 'from', 'about']
        if any(ex in name.lower() for ex in excludes):
            return False

        # Must have at least first and last name
        words = name.split()
        if len(words) < 2:
            return False

        return True

    def search_for_author(self, title: str) -> Optional[Tuple[str, str]]:
        """
        Placeholder for web search.
        In actual implementation, this would call WebSearch API.

        Returns (author, source) tuple or None.
        """
        # Clean title for searching
        search_title = self.clean_title_for_search(title)

        # This is where you would integrate with WebSearch
        # For now, return None to indicate no web search implementation
        # In real use: results = WebSearch(f'"{search_title}" author')
        # Then: return self.extract_author_from_search_result(title, results)

        return None

    def run(self):
        """Main execution."""
        print("=" * 70)
        print("PHASE 8: WEB SEARCH FOR AUTHORS")
        print("=" * 70)
        print("Strategy: Search Google Books, WorldCat, and general web")
        print("Target: Documents with clean, searchable titles")
        print()

        cursor = self.conn.cursor()

        # Get documents without authors that are searchable
        query = """
            SELECT id, title
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY id
        """
        cursor.execute(query)
        documents = cursor.fetchall()
        cursor.close()

        total = len(documents)
        print(f"Total documents without authors: {total}\n")

        # Filter for searchable titles
        searchable_docs = []
        for doc_id, title in documents:
            if self.is_searchable(title):
                searchable_docs.append((doc_id, title))

        print(f"Searchable titles: {len(searchable_docs)}/{total}\n")
        print("=" * 70)
        print("NOTE: This is a DRY RUN - Web searching requires WebSearch API")
        print("The script identifies searchable titles and shows what would")
        print("be searched. Actual web searching would need to be implemented.")
        print("=" * 70)
        print()

        # Show sample of what would be searched
        print("Sample of titles that would be searched:\n")
        for idx, (doc_id, title) in enumerate(searchable_docs[:20], 1):
            clean_title = self.clean_title_for_search(title)
            print(f"{idx}. ID {doc_id}")
            print(f"   Original: {title[:80]}...")
            print(f"   Search query: \"{clean_title}\" author")
            print()

        self.results['processed'] = total
        self.results['searchable'] = len(searchable_docs)
        self.print_summary()

    def print_summary(self):
        """Print summary."""
        print("\n" + "=" * 70)
        print("PHASE 8 DRY RUN COMPLETE")
        print("=" * 70)
        print(f"Documents analyzed: {self.results['processed']}")
        print(f"Searchable titles: {self.results['searchable']}")
        print(f"Non-searchable (corrupted/bad): {self.results['processed'] - self.results['searchable']}")
        print()
        print("To implement web searching:")
        print("  1. Enable WebSearch API access")
        print("  2. Implement rate limiting (avoid hitting search limits)")
        print("  3. Parse search results for author information")
        print("  4. Validate extracted authors")
        print()
        print(f"Estimated potential: {int(self.results['searchable'] * 0.5)}-{int(self.results['searchable'] * 0.7)} authors")
        print(f"Estimated final coverage: 92-95% (up from current 89.6%)")
        print("=" * 70)

if __name__ == '__main__':
    extractor = Phase8WebSearch()
    try:
        extractor.run()
    finally:
        extractor.conn.close()
