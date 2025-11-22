#!/usr/bin/env python3
"""
Phase 6: Cleanup and final extraction for remaining 15.5% of documents.

Strategies:
1. Parse embedded CSV/spreadsheet data in titles
2. Extract from truncated author names (search content for full name)
3. Fix Anna's Archive format that wasn't caught
4. Parse embedded metadata strings (filenames with years, etc.)
5. Mark genuinely author-less documents as "Anonymous" or "Collective"
6. Extract from corrupted PDF filenames with embedded content
"""

import re
import os
import psycopg2
from typing import Optional, Tuple, Dict
import unicodedata

class Phase6Cleanup:
    def __init__(self):
        db_connection = os.getenv('DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/veritable_games')
        self.conn = psycopg2.connect(db_connection)

        self.results = {
            'processed': 0,
            'authors_extracted': 0,
            'dates_extracted': 0,
            'marked_anonymous': 0,
            'patterns': {},
            'db_updates': 0
        }

    def is_valid_author_name(self, name: str) -> bool:
        """Basic author name validation."""
        if not name or len(name) < 6:
            return False

        name_lower = name.lower()

        # Exclude common non-author terms
        excludes = [
            'wikipedia', 'libcom', 'archive', 'source', 'about', 'reader',
            'content', 'page', 'complete', 'view', 'image', 'full', 'png',
            'unknown', 'anonymous', 'collective', 'various'
        ]
        if any(excl in name_lower for excl in excludes):
            return False

        words = name.split()
        if len(words) < 2:
            return False

        # Must start with capital letters
        if not all(w[0].isupper() for w in words[:2] if w):
            return False

        return True

    def strategy_1_embedded_csv_data(self, title: str) -> Tuple[Optional[str], Optional[str], int, str]:
        """
        Extract from embedded CSV/spreadsheet data.
        Pattern: "Title Author Year PageCount Topic Status"
        Example: "Just Get to Know Your Neighbors Emeline Posner 2024 12 Housing Unrecorded"
        """
        # Look for pattern: "Title Name1 Name2 YYYY ..."
        # If we have "Name Name Year Number" it's likely CSV data
        parts = title.split()

        for i in range(len(parts) - 3):
            # Check if we have: Name Name Year Number
            if (parts[i][0].isupper() and
                parts[i+1][0].isupper() and
                re.match(r'\d{4}', parts[i+2]) and
                re.match(r'\d+', parts[i+3])):

                # Potential author is parts[i] and parts[i+1]
                potential_author = f"{parts[i]} {parts[i+1]}"
                year = parts[i+2]

                if self.is_valid_author_name(potential_author):
                    if 1900 <= int(year) <= 2025:
                        return potential_author, year, 80, 'embedded_csv'

        return None, None, 0, None

    def strategy_2_truncated_author_search(self, title: str, content: str) -> Tuple[Optional[str], int, str]:
        """
        For truncated author names, search content for full name.
        Example: "... - Mouvement Communiste and Kole" → search for "Kole" in content
        """
        # Look for truncated name pattern (ends with incomplete word)
        match = re.search(r'-\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+and\s+[A-Z][a-z]+)\s*$', title)
        if not match:
            match = re.search(r'-\s+([A-Z][a-z]{2,})\s*$', title)

        if match:
            truncated = match.group(1).strip()
            last_word = truncated.split()[-1]

            # Search first 10 pages for completion
            first_pages = '\n'.join(content.split('\n')[:1000])

            # Look for "Last_word Full_Name" pattern
            pattern = rf'\b{last_word}[a-z]*\s+([A-Z][a-z]+)'
            match = re.search(pattern, first_pages)

            if match:
                potential_completion = f"{last_word}{match.group(0).split()[0][len(last_word):]}"
                if self.is_valid_author_name(potential_completion):
                    return potential_completion, 70, 'truncated_search'

        return None, 0, None

    def strategy_3_annas_archive_uncaught(self, title: str) -> Tuple[Optional[str], Optional[str], int, str]:
        """
        Catch remaining Anna's Archive format.
        Pattern: "Title -- Author -- Publisher -- Year -- ... -- Anna's Archive"
        """
        if 'anna' not in title.lower() or 'archive' not in title.lower():
            return None, None, 0, None

        parts = [p.strip() for p in title.split(' -- ')]

        if len(parts) >= 3:
            # Second part is usually author
            potential_author = parts[1].strip()

            # Remove trailing numbers/IDs
            potential_author = re.sub(r'\s+[0-9a-f]{16,}$', '', potential_author)

            # Check if third part is publisher (would confirm second is author)
            if len(parts) >= 4:
                third = parts[2].strip()
                fourth = parts[3].strip()

                # Look for year in third or fourth part
                year = None
                for part in [third, fourth]:
                    year_match = re.search(r'\b(\d{4})\b', part)
                    if year_match:
                        year = year_match.group(1)
                        if 1900 <= int(year) <= 2025:
                            break

                if self.is_valid_author_name(potential_author):
                    return potential_author, year, 90, 'annas_archive_uncaught'

        return None, None, 0, None

    def strategy_4_embedded_metadata_strings(self, title: str) -> Tuple[Optional[str], Optional[str], int, str]:
        """
        Parse embedded metadata strings.
        Patterns:
        - "Title - filename year topic"
        - "Title -- Author -- Location, Year -- Publisher"
        """
        # Pattern: "Title -- Author -- Location, Year --"
        match = re.search(r'--\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*--\s*[A-Za-z\s]+,\s*(\d{4})', title)
        if match:
            potential_author = match.group(1).strip()
            year = match.group(2)

            if self.is_valid_author_name(potential_author):
                if 1900 <= int(year) <= 2025:
                    return potential_author, year, 85, 'embedded_metadata'

        # Pattern: "Title -- Author (Year) --"
        match = re.search(r'--\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*\((\d{4})\)', title)
        if match:
            potential_author = match.group(1).strip()
            year = match.group(2)

            if self.is_valid_author_name(potential_author):
                if 1900 <= int(year) <= 2025:
                    return potential_author, year, 85, 'embedded_year_parens'

        return None, None, 0, None

    def strategy_5_historical_event_detection(self, title: str) -> bool:
        """
        Detect historical events/collective works that shouldn't have individual authors.
        Returns True if document should be marked as collective/anonymous.
        """
        event_patterns = [
            r'^\d{4}\s+[A-Z][a-z]+\s+(?:General\s+)?Strike',  # "1892 New Orleans General Strike"
            r'^\d{4}\s+[A-Z][a-z]+s?\s+Overthrow',  # "1931 Chileans Overthrow..."
            r'^\d{4}\s+Global\s+Climate\s+Strike',
            r'^\d{4}[-–]\d{2,4}\s+',  # Date range (events)
            r'^Views and Comments',  # Newsletter series
            r'^Short Call',  # Newsletter
            r'IWW (statement|solidarity|press|resolution)',
            r'^Anarchy \d+$',  # Magazine issues
            r'^\d{4}\s+[A-Z][a-z]+\s+(?:Protests|Uprising|Revolution)',
        ]

        title_lower = title.lower()

        for pattern in event_patterns:
            if re.search(pattern, title, re.IGNORECASE):
                return True

        # Check for organizational/collective indicators
        collective_indicators = [
            'coordenação', 'análise', 'revolutionary movements',
            'awaiting new material', 'compilation', 'various authors'
        ]

        return any(ind in title_lower for ind in collective_indicators)

    def process_document(self, doc_id: int, title: str, content: str) -> Dict:
        """Process single document through all strategies."""
        result = {
            'id': doc_id,
            'author': None,
            'publication_date': None,
            'confidence': 0,
            'pattern': None,
            'mark_anonymous': False
        }

        # Try extraction strategies first
        strategies = [
            (self.strategy_3_annas_archive_uncaught, True),  # Returns (author, date, conf, pattern)
            (self.strategy_1_embedded_csv_data, True),
            (self.strategy_4_embedded_metadata_strings, True),
        ]

        for strategy, returns_date in strategies:
            try:
                if returns_date:
                    author, pub_date, confidence, pattern = strategy(title)
                    if author and confidence > result['confidence']:
                        result['author'] = author
                        result['publication_date'] = pub_date
                        result['confidence'] = confidence
                        result['pattern'] = pattern
                else:
                    author, confidence, pattern = strategy(title, content)
                    if author and confidence > result['confidence']:
                        result['author'] = author
                        result['confidence'] = confidence
                        result['pattern'] = pattern
            except Exception as e:
                print(f"  Error in {strategy}: {e}")

        # Try truncated search (requires content)
        try:
            author, confidence, pattern = self.strategy_2_truncated_author_search(title, content)
            if author and confidence > result['confidence']:
                result['author'] = author
                result['confidence'] = confidence
                result['pattern'] = pattern
        except Exception as e:
            print(f"  Error in truncated search: {e}")

        # If no author found, check if it should be marked collective/anonymous
        if not result['author']:
            if self.strategy_5_historical_event_detection(title):
                result['mark_anonymous'] = True

        return result

    def update_database(self, doc_id: int, author: Optional[str],
                       pub_date: Optional[str], mark_anonymous: bool):
        """Update database with extracted metadata."""
        cursor = self.conn.cursor()

        updates = []
        params = []

        if author:
            updates.append("author = %s")
            params.append(author)
        elif mark_anonymous:
            updates.append("author = %s")
            params.append("Collective")
            self.results['marked_anonymous'] += 1

        if pub_date:
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
            self.results['db_updates'] += 1

        cursor.close()

    def run(self):
        """Main execution."""
        print("=" * 70)
        print("PHASE 6: CLEANUP AND FINAL EXTRACTION")
        print("=" * 70)
        print("Target: ~601 remaining documents")
        print("Goals:")
        print("  1. Extract from corrupted/embedded titles")
        print("  2. Mark genuinely author-less documents as 'Collective'")
        print()

        cursor = self.conn.cursor()

        # Get documents without authors
        query = """
            SELECT id, title, content
            FROM library.library_documents
            WHERE created_by = 3 AND author IS NULL
            ORDER BY id
        """
        cursor.execute(query)
        documents = cursor.fetchall()
        cursor.close()

        total = len(documents)
        print(f"Processing {total} documents...\n")

        for idx, (doc_id, title, content) in enumerate(documents, 1):
            self.results['processed'] += 1

            if idx % 100 == 0:
                print(f"Progress: {idx}/{total} ({idx/total*100:.1f}%)")

            result = self.process_document(doc_id, title, content)

            if result['author'] or result['publication_date'] or result['mark_anonymous']:
                if result['author']:
                    self.results['authors_extracted'] += 1
                    pattern = result['pattern']
                    self.results['patterns'][pattern] = self.results['patterns'].get(pattern, 0) + 1
                    print(f"\n[{idx}/{total}] ID {doc_id}")
                    print(f"  Title: {title[:100]}...")
                    print(f"  Author: {result['author']} (confidence: {result['confidence']}%, pattern: {pattern})")

                if result['publication_date']:
                    self.results['dates_extracted'] += 1
                    print(f"  Date: {result['publication_date']}")

                if result['mark_anonymous']:
                    print(f"\n[{idx}/{total}] ID {doc_id} - Marking as Collective")
                    print(f"  Title: {title[:100]}...")

                self.update_database(
                    doc_id,
                    result['author'],
                    result['publication_date'],
                    result['mark_anonymous']
                )

        self.print_summary()

    def print_summary(self):
        """Print execution summary."""
        print("\n" + "=" * 70)
        print("PHASE 6 COMPLETE")
        print("=" * 70)
        print(f"Documents processed: {self.results['processed']}")
        print(f"Authors extracted: {self.results['authors_extracted']}")
        print(f"Dates extracted: {self.results['dates_extracted']}")
        print(f"Marked as Collective: {self.results['marked_anonymous']}")
        print(f"Total database updates: {self.results['db_updates']}")

        if self.results['authors_extracted'] > 0:
            print(f"\nSuccess rate: {self.results['authors_extracted']/self.results['processed']*100:.1f}%")

            print("\nPattern breakdown:")
            for pattern, count in sorted(self.results['patterns'].items(), key=lambda x: x[1], reverse=True):
                pct = count / self.results['authors_extracted'] * 100
                print(f"  - {pattern}: {count} ({pct:.1f}%)")

        # Check final coverage
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) FILTER (WHERE author IS NOT NULL) as with_author,
                COUNT(*) FILTER (WHERE publication_date IS NOT NULL) as with_date,
                COUNT(*) FILTER (WHERE author = 'Collective') as collective,
                COUNT(*) as total
            FROM library.library_documents
            WHERE created_by = 3
        """)
        with_author, with_date, collective, total = cursor.fetchone()
        cursor.close()

        print("\n" + "=" * 70)
        print("FINAL COVERAGE")
        print("=" * 70)
        print(f"Authors: {with_author}/{total} ({with_author/total*100:.1f}%)")
        print(f"  - Individual authors: {with_author - collective}")
        print(f"  - Collective works: {collective}")
        print(f"Publication Dates: {with_date}/{total} ({with_date/total*100:.1f}%)")
        print(f"Missing Authors: {total - with_author} ({(total - with_author)/total*100:.1f}%)")
        print("=" * 70)

if __name__ == '__main__':
    cleanup = Phase6Cleanup()
    try:
        cleanup.run()
    finally:
        cleanup.conn.close()
