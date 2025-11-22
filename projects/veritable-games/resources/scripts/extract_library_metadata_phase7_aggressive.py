#!/usr/bin/env python3
"""
Phase 7: Aggressive extraction for obvious patterns we missed.

The user is right - many documents have CLEAR author names that we should have caught.
This phase uses simpler, more aggressive patterns.
"""

import re
import os
import psycopg2
from typing import Optional, Tuple

class Phase7Aggressive:
    def __init__(self):
        db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')
        self.conn = psycopg2.connect(db_connection)

        self.results = {
            'processed': 0,
            'extracted': 0,
            'patterns': {},
            'updates': 0
        }

    def is_valid_name(self, name: str) -> bool:
        """Simple validation - just needs to look like a name."""
        name = name.strip()

        if len(name) < 4 or len(name) > 100:
            return False

        # Must have at least one capital letter
        if not any(c.isupper() for c in name):
            return False

        # Exclude obvious non-names
        excludes = ['wikipedia', 'source', 'content', 'page', 'about', 'reader',
                   'pdf', 'abstract', 'introduction', 'conclusion', 'minutes']
        name_lower = name.lower()
        if any(ex in name_lower for ex in excludes):
            return False

        return True

    def extract_from_title(self, title: str) -> Tuple[Optional[str], Optional[str], str]:
        """Try multiple simple patterns."""

        # Pattern 1: "Title - Author Name" (single dash)
        # e.g., "Why Are All Cops Bastards - Serge Quaddruppani and Jérôme Floch"
        match = re.search(r'\s+-\s+([A-Z][a-zA-Zé-ÿ\s,&]+?)(?:\s*\(|$)', title)
        if match:
            author = match.group(1).strip()
            # Remove trailing " and " if incomplete
            author = re.sub(r'\s+and\s*$', '', author)
            if self.is_valid_name(author):
                return author, None, 'simple_dash'

        # Pattern 2: "Title Name Name" (name at end)
        # e.g., "The Spanish Anarchists Murray Bookchin liber3"
        match = re.search(r'\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+liber\d*$', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_name(author):
                return author, None, 'name_at_end_liber'

        # Pattern 3: "Title - Author (Alternate Name)"
        # e.g., "Stokely Speaks - Stokely Carmichael (Kwame Ture)"
        match = re.search(r'\s+-\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\(', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_name(author):
                return author, None, 'dash_with_parens'

        # Pattern 4: "Title - Single Name" (e.g., Luxemburg)
        match = re.search(r'\s+-\s+([A-Z][a-z]{3,})\s*$', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_name(author):
                return author, None, 'single_surname'

        # Pattern 5: "Title [Year] Author Name"
        match = re.search(r'\[(\d{4})\]\s+([A-Z][a-z]+\s+[A-Z][a-z]+)', title)
        if match:
            year = match.group(1)
            author = match.group(2).strip()
            if self.is_valid_name(author):
                return author, year, 'year_bracket_name'

        # Pattern 6: "Title, Year" (extract year only)
        match = re.search(r',\s+(\d{4})\s*$', title)
        if match:
            year = match.group(1)
            if 1900 <= int(year) <= 2025:
                return None, year, 'comma_year'

        # Pattern 7: Author in parentheses at end
        # e.g., "Title (Author Name)"
        match = re.search(r'\(([A-Z][a-z]+\s+[A-Z][a-z]+)\)\s*$', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_name(author):
                return author, None, 'parens_at_end'

        # Pattern 8: "by Author" anywhere in title
        match = re.search(r'\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', title)
        if match:
            author = match.group(1).strip()
            if self.is_valid_name(author):
                return author, None, 'by_in_title'

        return None, None, None

    def run(self):
        """Main execution."""
        print("=" * 70)
        print("PHASE 7: AGGRESSIVE EXTRACTION (Fixing Obvious Misses)")
        print("=" * 70)
        print("Target: ~508 documents without authors")
        print("Strategy: Simple, aggressive patterns for obvious cases")
        print()

        cursor = self.conn.cursor()

        query = """
            SELECT id, title, publication_date
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY id
        """
        cursor.execute(query)
        documents = cursor.fetchall()
        cursor.close()

        total = len(documents)
        print(f"Processing {total} documents...\n")

        for idx, (doc_id, title, current_date) in enumerate(documents, 1):
            self.results['processed'] += 1

            if idx % 100 == 0:
                print(f"Progress: {idx}/{total} ({idx/total*100:.1f}%)")

            author, pub_date, pattern = self.extract_from_title(title)

            if author or (pub_date and not current_date):
                print(f"\n[{idx}/{total}] ID {doc_id}")
                print(f"  Title: {title[:100]}...")

                if author:
                    print(f"  Author: {author} (pattern: {pattern})")
                    self.results['extracted'] += 1
                    self.results['patterns'][pattern] = self.results['patterns'].get(pattern, 0) + 1

                if pub_date and not current_date:
                    print(f"  Date: {pub_date}")

                # Update database
                cursor = self.conn.cursor()
                updates = []
                params = []

                if author:
                    updates.append("author = %s")
                    params.append(author)

                if pub_date and not current_date:
                    updates.append("publication_date = %s")
                    params.append(pub_date)

                if updates:
                    updates.append("updated_at = NOW()")
                    params.append(doc_id)

                    query = f"""
                        UPDATE library.library_documents
                        SET {', '.join(updates)}
                        WHERE id = %s
                    """
                    cursor.execute(query, params)
                    self.conn.commit()
                    self.results['updates'] += 1

                cursor.close()

        self.print_summary()

    def print_summary(self):
        """Print summary."""
        print("\n" + "=" * 70)
        print("PHASE 7 COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {self.results['processed']}")
        print(f"Authors extracted: {self.results['extracted']}")
        print(f"Database updates: {self.results['updates']}")

        if self.results['extracted'] > 0:
            print(f"\nSuccess rate: {self.results['extracted']/self.results['processed']*100:.1f}%")
            print("\nPattern breakdown:")
            for pattern, count in sorted(self.results['patterns'].items(), key=lambda x: x[1], reverse=True):
                pct = count / self.results['extracted'] * 100
                print(f"  - {pattern}: {count} ({pct:.1f}%)")

        # Final coverage
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) FILTER (WHERE author IS NOT NULL) as with_author,
                COUNT(*) FILTER (WHERE publication_date IS NOT NULL) as with_date,
                COUNT(*) as total
            FROM library.library_documents
            WHERE created_by = 3
        """)
        with_author, with_date, total = cursor.fetchone()
        cursor.close()

        print("\n" + "=" * 70)
        print("UPDATED COVERAGE")
        print("=" * 70)
        print(f"Authors: {with_author}/{total} ({with_author/total*100:.1f}%)")
        print(f"Publication Dates: {with_date}/{total} ({with_date/total*100:.1f}%)")
        print(f"Missing Authors: {total - with_author} ({(total - with_author)/total*100:.1f}%)")
        print("=" * 70)

if __name__ == '__main__':
    extractor = Phase7Aggressive()
    try:
        extractor.run()
    finally:
        extractor.conn.close()
