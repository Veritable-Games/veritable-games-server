#!/usr/bin/env python3
"""
Library Metadata Extraction - Phase 4B: CSV Metadata Matching

Matches documents in the database with entries in tracking.csv to fill
missing author and publication date metadata.

Uses fuzzy string matching to handle slight title variations.

Usage:
    python3 extract_library_metadata_phase4b_csv.py [--dry-run] [--limit N]
"""

import os
import sys
import csv
import re
import psycopg2
from pathlib import Path
from typing import Dict, Optional, Tuple
from difflib import SequenceMatcher

CSV_PATH = Path('/home/user/projects/veritable-games/resources/data/library/tracking.csv')
DB_CONNECTION = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

class CSVMetadataMatcher:
    """Match database documents with CSV metadata."""

    def __init__(self):
        self.csv_data = {}
        self.load_csv()

    def normalize_title(self, title: str) -> str:
        """Normalize title for matching."""
        # Remove common variations
        title = title.lower().strip()

        # Remove quotes
        title = title.replace('"', '').replace("'", '')

        # Remove special characters but keep spaces and alphanumeric
        title = re.sub(r'[^\w\s-]', '', title)

        # Normalize whitespace
        title = ' '.join(title.split())

        return title

    def similarity_score(self, str1: str, str2: str) -> float:
        """Calculate similarity score between two strings (0-1)."""
        return SequenceMatcher(None, str1, str2).ratio()

    def load_csv(self):
        """Load tracking.csv into memory."""
        print(f"Loading CSV from {CSV_PATH}...")

        try:
            with open(CSV_PATH, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    title = row.get('Document Title', '').strip()
                    author = row.get('Author(s)', '').strip()
                    pub_date = row.get('Publication Date', '').strip()

                    if title:
                        normalized_title = self.normalize_title(title)

                        self.csv_data[normalized_title] = {
                            'original_title': title,
                            'author': author if author else None,
                            'publication_date': pub_date if pub_date else None,
                        }

            print(f"Loaded {len(self.csv_data)} entries from CSV")

        except Exception as e:
            print(f"Error loading CSV: {e}")
            sys.exit(1)

    def find_best_match(self, title: str, threshold: float = 0.85) -> Optional[Dict]:
        """
        Find best matching CSV entry for given title.
        Returns match if similarity >= threshold.
        """
        normalized = self.normalize_title(title)

        # Try exact match first
        if normalized in self.csv_data:
            return self.csv_data[normalized]

        # Try fuzzy matching
        best_score = 0
        best_match = None

        for csv_title, data in self.csv_data.items():
            score = self.similarity_score(normalized, csv_title)

            if score > best_score:
                best_score = score
                best_match = data

        if best_score >= threshold:
            return best_match

        return None

    def process_documents(self, limit: int = None, dry_run: bool = False):
        """
        Process all documents without metadata and try to fill from CSV.
        """
        try:
            conn = psycopg2.connect(DB_CONNECTION)
            cur = conn.cursor()

            # Get documents without author or publication_date
            query = """
                SELECT id, title, author, publication_date
                FROM library.library_documents
                WHERE created_by = 3
                  AND (author IS NULL OR publication_date IS NULL)
                ORDER BY id
            """

            if limit:
                query += f" LIMIT {limit}"

            cur.execute(query)
            documents = cur.fetchall()

            print(f"\nProcessing {len(documents)} documents without complete metadata...")
            print(f"Dry run: {dry_run}\n")

            processed = 0
            exact_matches = 0
            fuzzy_matches = 0
            authors_filled = 0
            dates_filled = 0
            both_filled = 0
            no_match = 0

            for doc_id, title, current_author, current_pub_date in documents:
                processed += 1

                # Debug: print first few
                if processed <= 3:
                    print(f"[DEBUG] Processing doc {doc_id}: {title}")
                    print(f"[DEBUG]   Current author: {current_author}")
                    print(f"[DEBUG]   Current date: {current_pub_date}")

                # Try to find match in CSV
                match = self.find_best_match(title, threshold=0.85)

                if processed <= 3:
                    if match:
                        print(f"[DEBUG]   Match found: {match}")
                    else:
                        print(f"[DEBUG]   No match found")
                    print()

                if match:
                    csv_author = match['author']
                    csv_date = match['publication_date']

                    # Determine what needs updating
                    needs_author = (not current_author) and csv_author
                    needs_date = (not current_pub_date) and csv_date

                    if needs_author or needs_date:
                        # Check if exact or fuzzy match
                        normalized_title = self.normalize_title(title)
                        normalized_csv = self.normalize_title(match['original_title'])

                        if normalized_title == normalized_csv:
                            exact_matches += 1
                            match_type = "EXACT"
                        else:
                            fuzzy_matches += 1
                            match_type = "FUZZY"

                        print(f"[{processed}/{len(documents)}] {match_type} MATCH")
                        print(f"  DB Title: {title}")
                        print(f"  CSV Title: {match['original_title']}")

                        if needs_author:
                            print(f"  ✓ Author: {csv_author}")
                            authors_filled += 1

                        if needs_date:
                            print(f"  ✓ Date: {csv_date}")
                            dates_filled += 1

                        if needs_author and needs_date:
                            both_filled += 1

                        print()

                        if not dry_run:
                            # Build update query
                            updates = []
                            params = []

                            if needs_author:
                                updates.append("author = %s")
                                params.append(csv_author)

                            if needs_date:
                                updates.append("publication_date = %s")
                                params.append(csv_date)

                            params.append(doc_id)

                            update_query = f"""
                                UPDATE library.library_documents
                                SET {', '.join(updates)}, updated_at = NOW()
                                WHERE id = %s
                            """

                            cur.execute(update_query, params)
                else:
                    no_match += 1

            if not dry_run:
                conn.commit()

            cur.close()
            conn.close()

            print()
            print("=" * 70)
            print("CSV MATCHING COMPLETE")
            print("=" * 70)
            print(f"Documents processed: {processed}")
            print(f"Exact matches found: {exact_matches}")
            print(f"Fuzzy matches found: {fuzzy_matches}")
            print(f"Total matches: {exact_matches + fuzzy_matches}")
            print(f"No match found: {no_match}")
            print()
            print(f"Authors filled: {authors_filled}")
            print(f"Dates filled: {dates_filled}")
            print(f"Both filled: {both_filled}")
            print(f"Match rate: {(exact_matches + fuzzy_matches)/processed*100:.1f}%")
            print()

        except Exception as e:
            print(f"Error processing documents: {e}")
            sys.exit(1)


def main():
    dry_run = '--dry-run' in sys.argv
    limit = None

    if '--limit' in sys.argv:
        try:
            limit_idx = sys.argv.index('--limit')
            limit = int(sys.argv[limit_idx + 1])
        except (IndexError, ValueError):
            print("Error: --limit requires a number")
            sys.exit(1)

    matcher = CSVMetadataMatcher()
    matcher.process_documents(limit=limit, dry_run=dry_run)


if __name__ == '__main__':
    main()
