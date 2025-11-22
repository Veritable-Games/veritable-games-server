#!/usr/bin/env python3
"""
Text Flow Cleanup Script for Library Documents

Fixes spacing and indentation issues from PDF-to-markdown conversion:
- Normalizes excessive whitespace (multiple spaces → single space)
- Removes inappropriate indentation that creates code blocks
- Processes ALL published documents (not just those with artifacts)

Usage:
    python3 cleanup_text_flow.py              # Live run on all documents
    python3 cleanup_text_flow.py --dry-run    # Preview changes without updating
    python3 cleanup_text_flow.py --limit 100  # Process only first 100 documents
"""

import sys
import re
import psycopg2
from datetime import datetime

class TextFlowCleaner:
    def __init__(self, dry_run=False, limit=None):
        self.dry_run = dry_run
        self.limit = limit
        self.stats = {
            'total': 0,
            'cleaned': 0,
            'multispaces_removed': 0,
            'indents_removed': 0,
            'bytes_saved': 0
        }

    def log(self, message, level="INFO"):
        """Print log message with timestamp"""
        colors = {
            "SUCCESS": "\033[0;32m",  # Green
            "ERROR": "\033[0;31m",    # Red
            "WARN": "\033[1;33m",     # Yellow
            "INFO": "\033[0;34m"      # Blue
        }
        reset = "\033[0m"
        color = colors.get(level, "")

        icon = {
            "SUCCESS": "[✓]",
            "ERROR": "[✗]",
            "WARN": "[⚠]",
            "INFO": "[INFO]"
        }.get(level, "")

        print(f"{color}{icon}{reset} {message}")

    def normalize_whitespace(self, content: str) -> tuple:
        """Normalize excessive whitespace within lines (multiple spaces → single space)"""
        lines = content.split('\n')
        normalized_lines = []
        removed_count = 0

        for line in lines:
            # Don't touch code blocks (lines starting with 4 spaces or tab) or empty lines
            if line.startswith('    ') or line.startswith('\t') or not line.strip():
                normalized_lines.append(line)
            else:
                # Count multiple space sequences before normalization
                before_count = len(re.findall(r'  +', line))

                # Normalize multiple spaces to single space
                normalized = re.sub(r'  +', ' ', line)
                normalized_lines.append(normalized)

                if before_count > 0:
                    removed_count += before_count

        return '\n'.join(normalized_lines), removed_count

    def remove_inappropriate_indentation(self, content: str) -> tuple:
        """Remove leading spaces that create unwanted code blocks"""
        lines = content.split('\n')
        cleaned_lines = []
        in_fenced_code = False
        removed_count = 0

        for line in lines:
            # Track fenced code blocks
            if line.strip().startswith('```'):
                in_fenced_code = not in_fenced_code
                cleaned_lines.append(line)
                continue

            # Keep fenced code blocks as-is
            if in_fenced_code:
                cleaned_lines.append(line)
                continue

            # Remove leading spaces from non-code lines (unless it's a list item)
            if len(line) - len(line.lstrip()) >= 4:  # Has 4+ leading spaces
                removed_count += 1

            stripped = line.lstrip()
            if stripped and not stripped[0] in ['-', '*', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
                # Not a list item, remove indentation
                cleaned_lines.append(stripped)
            else:
                # Keep list items with their indentation
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines), removed_count

    def clean_document(self, content: str) -> tuple:
        """Apply text flow cleanup to document content"""
        original_size = len(content)

        # Apply text flow normalization
        content, multispaces = self.normalize_whitespace(content)
        content, indents = self.remove_inappropriate_indentation(content)

        new_size = len(content)
        bytes_saved = original_size - new_size

        return content, {
            'multispaces_removed': multispaces,
            'indents_removed': indents,
            'bytes_saved': bytes_saved,
            'reduction_pct': (bytes_saved / original_size * 100) if original_size > 0 else 0
        }

    def run(self):
        """Main execution"""
        print("=" * 80)
        print("Text Flow Cleanup Script")
        print("=" * 80)
        print(f"Mode: {'DRY RUN (no changes)' if self.dry_run else 'LIVE (will update database)'}")
        print(f"Target: library.library_documents (PostgreSQL)")
        print(f"Database: veritable_games @ localhost:5432")
        print(f"Limit: {self.limit if self.limit else 'None (all documents)'}")
        print("=" * 80)
        print()

        # Connect to database
        try:
            conn = psycopg2.connect(
                host='localhost',
                port=5432,
                dbname='veritable_games',
                user='postgres',
                password='postgres'
            )
            cursor = conn.cursor()
            self.log("Connected to database", "SUCCESS")
        except Exception as e:
            self.log(f"Database connection failed: {e}", "ERROR")
            return 1

        # Get all published documents
        self.log("Fetching published documents...", "INFO")

        limit_clause = f"LIMIT {self.limit}" if self.limit else ""

        cursor.execute(f"""
            SELECT id
            FROM library.library_documents
            WHERE status = 'published'
            AND content IS NOT NULL
            ORDER BY id
            {limit_clause}
        """)

        doc_ids = [row[0] for row in cursor.fetchall()]
        self.stats['total'] = len(doc_ids)

        if self.stats['total'] == 0:
            self.log("No documents found!", "WARN")
            return 0

        self.log(f"Found {self.stats['total']} documents to process", "SUCCESS")
        print()

        # Process documents
        for idx, doc_id in enumerate(doc_ids, 1):
            try:
                self.log(f"[{idx}/{self.stats['total']}] Processing document ID {doc_id}...", "INFO")

                # Fetch content
                cursor.execute(f"SELECT content FROM library.library_documents WHERE id = {doc_id}")
                row = cursor.fetchone()

                if not row or not row[0]:
                    self.log(f"  Skipping: No content", "WARN")
                    continue

                original_content = row[0]

                # Clean content
                cleaned_content, stats = self.clean_document(original_content)

                # Update statistics
                self.stats['cleaned'] += 1
                self.stats['multispaces_removed'] += stats['multispaces_removed']
                self.stats['indents_removed'] += stats['indents_removed']
                self.stats['bytes_saved'] += stats['bytes_saved']

                # Update database (if not dry-run)
                if not self.dry_run:
                    cursor.execute(
                        "UPDATE library.library_documents SET content = %s, updated_at = NOW() WHERE id = %s",
                        (cleaned_content, doc_id)
                    )

                self.log(
                    f"  ✓ Cleaned: {stats['reduction_pct']:.1f}% size reduction "
                    f"(Spaces: {stats['multispaces_removed']}, Indents: {stats['indents_removed']})",
                    "SUCCESS"
                )

                # Commit every 100 documents
                if idx % 100 == 0 and not self.dry_run:
                    conn.commit()
                    self.log(f"Committed batch at {idx}/{self.stats['total']}", "INFO")

            except Exception as e:
                self.log(f"Error processing document {doc_id}: {str(e)}", "ERROR")

        # Final commit
        if not self.dry_run:
            conn.commit()

        # Show statistics
        mb_saved = self.stats['bytes_saved'] / 1024 / 1024

        print()
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total processed:      {self.stats['total']}")
        print(f"✓ Cleaned:            {self.stats['cleaned']}")
        print()
        print("Improvements:")
        print(f"  - Multiple spaces normalized:  {self.stats['multispaces_removed']:,}")
        print(f"  - Indented lines fixed:         {self.stats['indents_removed']:,}")
        print()
        print("Storage:")
        print(f"  - Total bytes saved:            {self.stats['bytes_saved']:,} bytes ({mb_saved:.2f} MB)")
        print()
        print(f"✅ Text flow cleanup {'preview' if self.dry_run else 'complete'}")
        print("=" * 80)

        cursor.close()
        conn.close()

        return 0

if __name__ == "__main__":
    # Parse arguments
    dry_run = "--dry-run" in sys.argv
    limit = None

    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=")[1])

    cleaner = TextFlowCleaner(dry_run=dry_run, limit=limit)
    sys.exit(cleaner.run())
