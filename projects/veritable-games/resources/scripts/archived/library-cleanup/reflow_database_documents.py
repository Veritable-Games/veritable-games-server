#!/usr/bin/env python3
"""
Database Document Reflow Script

Uses the PROVEN paragraph reflow logic from cleanup_markdown.py v3.0
This is the ACTUAL working code that fixed 29 game design documents.

NOT my broken attempt - this is the user's working code adapted for database.
"""

import sys
import re
import psycopg2

class DatabaseReflower:
    def __init__(self, dry_run=False, limit=None):
        self.dry_run = dry_run
        self.limit = limit
        self.stats = {
            'total': 0,
            'processed': 0,
            'bytes_before': 0,
            'bytes_after': 0
        }

    def log(self, message, level="INFO"):
        """Print log message"""
        colors = {
            "SUCCESS": "\033[0;32m",
            "ERROR": "\033[0;31m",
            "WARN": "\033[1;33m",
            "INFO": "\033[0;34m"
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

    # =========================================================================
    # THESE ARE THE ACTUAL WORKING FUNCTIONS FROM cleanup_markdown.py v3.0
    # =========================================================================

    def fix_hyphenation(self, text: str) -> str:
        """
        Fix hyphenation artifacts from PDF line wrapping

        Examples:
        - "city-\n scape" → "cityscape"
        - "city-\nscape" → "cityscape"
        - "full-\n set" → "full-set"
        """
        # Pattern 1: word-\nword (with or without space after newline)
        # Only join if the hyphen appears at end of line
        text = re.sub(r'(\w)-\n\s*(\w)', r'\1\2', text)

        return text

    def is_divider_line(self, line: str) -> bool:
        """Check if line is a divider (----, ====)"""
        stripped = line.strip()
        if len(stripped) < 3:
            return False

        # Check if line is all the same character
        if stripped == '-' * len(stripped) or stripped == '=' * len(stripped):
            return True

        return False

    def is_structural_line(self, line: str) -> bool:
        """
        Detect if a line is a structural element that should NOT be joined with others

        Structural elements include:
        - Headers (lines starting with ##)
        - List items (-, •, ·, numbered)
        - Indented blocks (4+ spaces - code/quotes)
        - Divider lines (-----, =====)
        - Blank lines
        """
        stripped = line.strip()

        # Blank line
        if not stripped:
            return True

        # Header
        if stripped.startswith('#'):
            return True

        # List marker
        if stripped.startswith(('-', '•', '·')):
            return True

        # Numbered list
        if re.match(r'^\d+\.', stripped):
            return True

        # Indented block (4+ spaces)
        leading_spaces = len(line) - len(line.lstrip())
        if leading_spaces >= 4:
            return True

        # Divider line
        if self.is_divider_line(line):
            return True

        return False

    def reflow_paragraphs(self, text: str) -> str:
        """
        Join lines within paragraphs while preserving paragraph breaks and structure

        Rules:
        - Blank lines (paragraph breaks) are PRESERVED
        - Headers, lists, indented blocks, dividers stay on separate lines
        - Within paragraphs, single newlines are replaced with spaces
        - Hyphenation artifacts are fixed

        THIS IS THE PROVEN WORKING CODE FROM cleanup_markdown.py v3.0
        """
        # First, fix hyphenation
        text = self.fix_hyphenation(text)

        lines = text.split('\n')
        output = []
        paragraph_buffer = []

        for i, line in enumerate(lines):
            # Check if this is a structural element
            if self.is_structural_line(line):
                # Flush paragraph buffer first
                if paragraph_buffer:
                    # Join buffered lines with spaces
                    joined = ' '.join(paragraph_buffer)
                    output.append(joined)
                    paragraph_buffer = []

                # Add structural line as-is
                output.append(line)
            else:
                # Regular text line - add to paragraph buffer
                paragraph_buffer.append(line.strip())

        # Flush remaining buffer
        if paragraph_buffer:
            joined = ' '.join(paragraph_buffer)
            output.append(joined)

        return '\n'.join(output)

    # =========================================================================
    # END OF WORKING FUNCTIONS
    # =========================================================================

    def clean_document(self, content: str) -> str:
        """Apply paragraph reflow to document"""
        return self.reflow_paragraphs(content)

    def run(self):
        """Main execution"""
        print("=" * 80)
        print("Database Document Reflow (Using cleanup_markdown.py v3.0 Logic)")
        print("=" * 80)
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
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
                original_size = len(original_content)

                # Clean content using PROVEN reflow logic
                cleaned_content = self.clean_document(original_content)
                cleaned_size = len(cleaned_content)

                # Update statistics
                self.stats['processed'] += 1
                self.stats['bytes_before'] += original_size
                self.stats['bytes_after'] += cleaned_size

                bytes_diff = original_size - cleaned_size
                pct_change = (bytes_diff / original_size * 100) if original_size > 0 else 0

                # Update database (if not dry-run)
                if not self.dry_run:
                    cursor.execute(
                        "UPDATE library.library_documents SET content = %s, updated_at = NOW() WHERE id = %s",
                        (cleaned_content, doc_id)
                    )

                self.log(
                    f"  ✓ Reflowed: {pct_change:+.1f}% size change ({original_size}B → {cleaned_size}B)",
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
        total_saved = self.stats['bytes_before'] - self.stats['bytes_after']
        mb_saved = total_saved / 1024 / 1024

        print()
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total processed:      {self.stats['total']}")
        print(f"✓ Reflowed:           {self.stats['processed']}")
        print()
        print("Size changes:")
        print(f"  - Before:            {self.stats['bytes_before']:,} bytes")
        print(f"  - After:             {self.stats['bytes_after']:,} bytes")
        print(f"  - Difference:        {total_saved:+,} bytes ({mb_saved:+.2f} MB)")
        print()
        print(f"✅ Reflow {'preview' if self.dry_run else 'complete'}")
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

    reflower = DatabaseReflower(dry_run=dry_run, limit=limit)
    sys.exit(reflower.run())
