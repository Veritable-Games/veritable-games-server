#!/usr/bin/env python3
"""
Phase 6: Batch Web Search Processing
Systematically source authors for remaining documents via web search
"""

import psycopg2
import os
import re
import time
import json

DB_CONNECTION = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

class Phase6BatchProcessor:
    def __init__(self):
        self.conn = psycopg2.connect(DB_CONNECTION)
        self.cur = self.conn.cursor()
        self.processed = 0
        self.found = 0
        self.skipped = 0
        self.batch_size = 50

    def clean_title_for_search(self, title):
        """Clean title to make it searchable"""
        # Remove source markers
        title = re.sub(r'\*\*Source\*\*:.*', '', title)
        title = re.sub(r'## Content.*', '', title)

        # Remove file markers
        title = re.sub(r'\*Converted from:.*', '', title)
        title = re.sub(r'\.pdf.*', '', title)

        # Remove hashes and ISBNs for cleaner search
        title = re.sub(r'[a-f0-9]{32}', '', title)

        # Clean up
        title = title.strip()
        return title if len(title) > 5 else None

    def extract_author_from_title(self, title):
        """Try to extract author from complex title patterns"""

        # Pattern 1: "Title by Author Name"
        by_match = re.search(r'\s+by\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', title, re.IGNORECASE)
        if by_match:
            author = by_match.group(1).strip()
            if self.is_valid_author(author):
                return author, 85, 'by_pattern'

        # Pattern 2: "Author Name - Title" (at start)
        dash_start = re.match(r'^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[-–]\s*', title)
        if dash_start:
            author = dash_start.group(1).strip()
            if self.is_valid_author(author):
                return author, 80, 'dash_start'

        # Pattern 3: ISBN or clear book indicator suggests we should web search
        if re.search(r'978\d{10}', title) or ' -- ' in title:
            return None, 0, 'needs_web_search'

        return None, 0, None

    def is_valid_author(self, name):
        """Validate author name"""
        if not name or len(name) < 4 or len(name) > 80:
            return False

        words = name.split()
        if len(words) < 2:
            return False

        # Check for non-author patterns
        skip_words = {'contents', 'source', 'page', 'chapter', 'section',
                     'figure', 'table', 'abstract', 'introduction',
                     'university', 'press', 'publishing', 'publishers'}

        name_lower = name.lower()
        if any(word in name_lower for word in skip_words):
            return False

        return True

    def categorize_document(self, title):
        """Categorize document type for targeted sourcing"""
        title_lower = title.lower()

        # Check for ISBNs (books)
        if re.search(r'978\d{10}', title):
            return 'book_isbn'

        # Check for Anna's Archive format
        if "anna's archive" in title_lower:
            return 'book_annas'

        # Check for academic paper indicators
        if any(x in title_lower for x in ['journal', 'research', 'study', 'pmc', 'pubmed', 'doi']):
            return 'academic'

        # Check for political/anarchist content
        if any(x in title_lower for x in ['anarchis', 'revolution', 'capital', 'liberation', 'socialism', 'communist']):
            return 'political'

        # Check for corrupted/problematic titles
        if len(title) > 150 or '##' in title or title.count('*') > 5:
            return 'corrupted'

        # Check for very short titles (likely fragments)
        if len(title) < 15:
            return 'fragment'

        return 'general'

    def generate_search_query(self, title, category):
        """Generate optimized search query based on category"""
        clean_title = self.clean_title_for_search(title)
        if not clean_title:
            return None

        if category == 'book_isbn':
            isbn = re.search(r'(978\d{10})', title)
            if isbn:
                # Extract potential title before ISBN
                title_part = re.sub(r'978\d{10}.*', '', clean_title).strip()
                if title_part and len(title_part) > 10:
                    return f'isbn {isbn.group(1)} "{title_part[:60]}"'
                return f'isbn {isbn.group(1)}'

        if category == 'book_annas':
            # Extract title before "Anna's Archive"
            title_part = re.sub(r"--\s*Anna's Archive.*", '', clean_title).strip()
            if ' -- ' in title_part:
                parts = title_part.split(' -- ')
                return f'"{parts[0][:60]}" author'

        if category == 'academic':
            # Add "author" to help find author info
            return f'"{clean_title[:80]}" author'

        if category == 'political':
            # These are often from specific publishers
            return f'"{clean_title[:80]}" author anarchist library'

        if category == 'general' and len(clean_title) > 10:
            return f'"{clean_title[:80]}" author'

        return None

    def process_batch(self, batch_num, total_batches):
        """Process a batch of documents"""
        # Get next batch
        self.cur.execute("""
            SELECT id, title
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY id
            LIMIT %s OFFSET %s
        """, (self.batch_size, batch_num * self.batch_size))

        docs = self.cur.fetchall()

        print(f"\n=== Batch {batch_num + 1}/{total_batches} ({len(docs)} documents) ===")

        for doc_id, title in docs:
            self.processed += 1

            # Try title-based extraction first (fast, no web search needed)
            author, confidence, method = self.extract_author_from_title(title)

            if author:
                print(f"  [{self.processed:3d}] ID {doc_id}: {author} (via {method})")
                self.update_database(doc_id, author, method)
                self.found += 1
                continue

            # Categorize for web search strategy
            category = self.categorize_document(title)

            # Skip corrupted/fragment titles
            if category in ['corrupted', 'fragment']:
                self.skipped += 1
                continue

            # Generate search query
            search_query = self.generate_search_query(title, category)

            if search_query:
                # Log for manual/web search processing
                print(f"  [{self.processed:3d}] ID {doc_id}: {category} - Query: {search_query[:60]}...")
            else:
                self.skipped += 1

        self.conn.commit()

        # Progress summary
        print(f"\nBatch {batch_num + 1} complete:")
        print(f"  Processed: {self.processed}")
        print(f"  Found: {self.found}")
        print(f"  Skipped: {self.skipped}")
        print(f"  Success rate: {100.0 * self.found / max(1, self.processed):.1f}%")

    def update_database(self, doc_id, author, method):
        """Update database with found author"""
        self.cur.execute("""
            UPDATE library.library_documents
            SET author = %s, updated_at = NOW()
            WHERE id = %s
        """, (author, doc_id))

    def run(self):
        """Run batch processing"""
        # Count total documents
        self.cur.execute("""
            SELECT COUNT(*) FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
        """)
        total = self.cur.fetchone()[0]
        total_batches = (total + self.batch_size - 1) // self.batch_size

        print("="*70)
        print("PHASE 6: BATCH WEB SEARCH PROCESSING")
        print("="*70)
        print(f"Total documents: {total}")
        print(f"Batch size: {self.batch_size}")
        print(f"Total batches: {total_batches}")
        print("="*70)

        # Process all batches
        for batch_num in range(total_batches):
            self.process_batch(batch_num, total_batches)

            # Small delay between batches
            if batch_num < total_batches - 1:
                time.sleep(1)

        # Final summary
        print("\n" + "="*70)
        print("BATCH PROCESSING COMPLETE")
        print("="*70)
        print(f"Total processed: {self.processed}")
        print(f"Authors found: {self.found}")
        print(f"Skipped: {self.skipped}")
        print(f"Success rate: {100.0 * self.found / max(1, self.processed):.1f}%")
        print("="*70)

        self.cur.close()
        self.conn.close()

if __name__ == '__main__':
    processor = Phase6BatchProcessor()
    processor.run()
