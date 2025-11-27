#!/usr/bin/env python3
"""
Library Document Content Cleanup Script
========================================
Removes PDF conversion artifacts, metadata sections, and website chrome
from user-uploaded library documents.

Author: Claude Code
Created: November 24, 2025
"""

import re
import sys
import argparse
import psycopg2
from datetime import datetime
from typing import List, Tuple, Dict
import csv

# Database connection settings
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}


class LibraryContentCleaner:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.conn = None
        self.cursor = None
        self.stats = {
            'total_documents': 0,
            'documents_modified': 0,
            'figure_captions_removed': 0,
            'doc_summaries_removed': 0,
            'page_numbers_removed': 0,
            'pdf_titles_fixed': 0,
            'timestamps_removed': 0,
            'newsletters_removed': 0,
            'footers_removed': 0,
            'more_like_this_removed': 0,
            'frontmatter_fixed': 0,
            'total_chars_removed': 0,
        }

    def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            print("✓ Connected to database")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            sys.exit(1)

    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            if not self.dry_run:
                self.conn.commit()
            self.conn.close()
        print("✓ Database connection closed")

    # ========================================================================
    # PHASE 1: Safe Automated Cleaning (Zero Risk)
    # ========================================================================

    def remove_figure_captions(self, content: str) -> Tuple[str, int]:
        """Remove figure captions: ![Figure from page X](images/...)"""
        pattern = r'!\[Figure from page \d+\]\(images/page_\d+_content/img-\d+\.(png|jpg|jpeg)\)'
        matches = re.findall(pattern, content)
        cleaned = re.sub(pattern, '', content)
        return cleaned, len(matches)

    def remove_document_summary(self, content: str) -> Tuple[str, bool]:
        """Remove Document Summary sections (conversion metadata)"""
        # Pattern: ## Document Summary ... Conversion completed: ...
        pattern = r'## Document Summary\s*\n.*?Conversion completed:.*?(?:\d{4}\*?)?$'
        match = re.search(pattern, content, re.DOTALL | re.MULTILINE)
        if match:
            cleaned = re.sub(pattern, '', content, flags=re.DOTALL | re.MULTILINE)
            return cleaned.strip(), True
        return content, False

    def remove_page_numbers(self, content: str) -> Tuple[str, int]:
        """Remove page numbers: X of Y MM/DD/YY, HH:MM AM/PM"""
        # Pattern: "2 of 11 3/17/25, 11:40 PM"
        pattern = r'\d+ of \d+ \d{1,2}/\d{1,2}/\d{2,4}(?:, \d{1,2}:\d{2} [AP]M)?'
        matches = re.findall(pattern, content)
        cleaned = re.sub(pattern, '', content)
        return cleaned, len(matches)

    def strip_pdf_from_title(self, title: str) -> Tuple[str, bool]:
        """Remove .pdf extension from title"""
        if title.lower().endswith('.pdf'):
            return title[:-4], True
        return title, False

    def remove_conversion_timestamps(self, content: str) -> Tuple[str, int]:
        """Remove conversion completion timestamps"""
        # Pattern: "Conversion completed: Mon Aug 18 02:06:51 PM PDT 2025"
        pattern = r'Conversion completed:.*?(?:AM|PM).*?\d{4}'
        matches = re.findall(pattern, content)
        cleaned = re.sub(pattern, '', content)
        return cleaned, len(matches)

    # ========================================================================
    # PHASE 2: Pattern-Based Cleaning (Low Risk)
    # ========================================================================

    def remove_newsletter_prompts(self, content: str) -> Tuple[str, int]:
        """Remove newsletter signup prompts"""
        patterns = [
            r'NEWSLETTERS?\s*\n',
            r'Sign up for (?:our|the) newsletter.*?\n',
            r'Subscribe to (?:our|the) (?:newsletter|mailing list).*?\n',
            r'ONE EMAIL\. ONE STORY\. EVERY WEEK\..*?Subscribe.*?content\.',
            r'Your email\.\.\. Subscribe',
        ]
        count = 0
        cleaned = content
        for pattern in patterns:
            matches = re.findall(pattern, cleaned, re.IGNORECASE | re.DOTALL)
            if matches:
                count += len(matches)
                cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
        return cleaned, count

    def remove_footer_content(self, content: str) -> Tuple[str, int]:
        """Remove website footer content (privacy policy, copyright, etc.)"""
        patterns = [
            r'PRIVACY POLICY.*?(?:MANAGE CONSENT|$)',
            r'TERMS OF USE.*?SECURITY POLICY',
            r'©\s*\d{4}\s+[A-Z\s]+(?:MEDIA|GROUP|LLC|INC\.?)',
            r'ABOUT\s+ACCESSIBILITY\s+PRIVACY POLICY',
        ]
        count = 0
        cleaned = content
        for pattern in patterns:
            matches = re.findall(pattern, cleaned, re.IGNORECASE | re.DOTALL)
            if matches:
                count += len(matches)
                cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE | re.DOTALL)
        return cleaned, count

    def remove_more_like_this_sections(self, content: str) -> Tuple[str, int]:
        """Remove 'MORE LIKE THIS' sidebar content"""
        pattern = r'MORE\s+LIKE\s+THIS.*?(?=\n#{1,2}\s|\Z)'
        matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(pattern, '', content, flags=re.IGNORECASE | re.DOTALL)
        return cleaned, len(matches)

    def fix_frontmatter_quotes(self, title: str) -> Tuple[str, bool]:
        """Fix triple quotes in titles from frontmatter"""
        if "'''" in title:
            # Remove triple quotes
            fixed = title.replace("'''", "'")
            return fixed, True
        return title, False

    # ========================================================================
    # Main Cleaning Logic
    # ========================================================================

    def clean_content_phase1(self, content: str) -> Dict:
        """Apply Phase 1 cleaning (safe, zero risk)"""
        result = {'content': content, 'changes': {}}
        original_length = len(content)

        # 1. Remove figure captions
        result['content'], count = self.remove_figure_captions(result['content'])
        if count > 0:
            result['changes']['figure_captions'] = count
            self.stats['figure_captions_removed'] += count

        # 2. Remove document summary
        result['content'], removed = self.remove_document_summary(result['content'])
        if removed:
            result['changes']['doc_summary'] = True
            self.stats['doc_summaries_removed'] += 1

        # 3. Remove page numbers
        result['content'], count = self.remove_page_numbers(result['content'])
        if count > 0:
            result['changes']['page_numbers'] = count
            self.stats['page_numbers_removed'] += count

        # 4. Remove conversion timestamps
        result['content'], count = self.remove_conversion_timestamps(result['content'])
        if count > 0:
            result['changes']['timestamps'] = count
            self.stats['timestamps_removed'] += count

        # Track total chars removed
        chars_removed = original_length - len(result['content'])
        result['chars_removed'] = chars_removed
        self.stats['total_chars_removed'] += chars_removed

        return result

    def clean_content_phase2(self, content: str) -> Dict:
        """Apply Phase 2 cleaning (pattern-based, low risk)"""
        result = {'content': content, 'changes': {}}
        original_length = len(content)

        # 1. Remove newsletter prompts
        result['content'], count = self.remove_newsletter_prompts(result['content'])
        if count > 0:
            result['changes']['newsletters'] = count
            self.stats['newsletters_removed'] += count

        # 2. Remove footer content
        result['content'], count = self.remove_footer_content(result['content'])
        if count > 0:
            result['changes']['footers'] = count
            self.stats['footers_removed'] += count

        # 3. Remove "MORE LIKE THIS" sections
        result['content'], count = self.remove_more_like_this_sections(result['content'])
        if count > 0:
            result['changes']['more_like_this'] = count
            self.stats['more_like_this_removed'] += count

        # Track total chars removed
        chars_removed = original_length - len(result['content'])
        result['chars_removed'] = chars_removed
        self.stats['total_chars_removed'] += chars_removed

        return result

    def process_documents(self, phase='1', limit=None):
        """Process all library documents"""
        print(f"\n{'='*70}")
        print(f"LIBRARY CONTENT CLEANUP - {'DRY RUN' if self.dry_run else 'LIVE MODE'}")
        print(f"Phase: {phase}")
        print(f"{'='*70}\n")

        # Fetch documents
        query = "SELECT id, slug, title, content FROM library.library_documents WHERE content IS NOT NULL"
        if limit:
            query += f" LIMIT {limit}"

        self.cursor.execute(query)
        documents = self.cursor.fetchall()
        self.stats['total_documents'] = len(documents)

        print(f"Processing {len(documents)} documents...\n")

        examples_shown = 0
        max_examples = 10

        for doc_id, slug, title, content in documents:
            if not content:
                continue

            original_content = content
            original_title = title
            modified = False
            title_modified = False

            # Apply Phase 1
            if '1' in phase:
                result = self.clean_content_phase1(content)
                if result['changes']:
                    content = result['content']
                    modified = True

                    if self.dry_run and examples_shown < max_examples:
                        print(f"Document ID {doc_id}: {slug}")
                        print(f"  Changes: {result['changes']}")
                        print(f"  Chars removed: {result['chars_removed']:,}")
                        print()
                        examples_shown += 1

                # Fix title .pdf extension
                title, fixed = self.strip_pdf_from_title(title)
                if fixed:
                    title_modified = True
                    self.stats['pdf_titles_fixed'] += 1

                # Fix frontmatter quotes
                title, fixed = self.fix_frontmatter_quotes(title)
                if fixed:
                    title_modified = True
                    self.stats['frontmatter_fixed'] += 1

            # Apply Phase 2
            if '2' in phase:
                result = self.clean_content_phase2(content)
                if result['changes']:
                    content = result['content']
                    modified = True

                    if self.dry_run and examples_shown < max_examples:
                        print(f"Document ID {doc_id}: {slug}")
                        print(f"  Phase 2 changes: {result['changes']}")
                        print(f"  Chars removed: {result['chars_removed']:,}")
                        print()
                        examples_shown += 1

            # Update database
            if (modified or title_modified) and not self.dry_run:
                update_query = "UPDATE library.library_documents SET "
                update_parts = []
                params = []

                if modified:
                    update_parts.append("content = %s")
                    params.append(content)
                if title_modified:
                    update_parts.append("title = %s")
                    params.append(title)

                update_query += ", ".join(update_parts) + " WHERE id = %s"
                params.append(doc_id)

                self.cursor.execute(update_query, params)
                self.stats['documents_modified'] += 1
            elif modified or title_modified:
                self.stats['documents_modified'] += 1

    def print_summary(self):
        """Print cleanup summary statistics"""
        print(f"\n{'='*70}")
        print("CLEANUP SUMMARY")
        print(f"{'='*70}\n")

        print(f"Total documents processed:    {self.stats['total_documents']:,}")
        print(f"Documents modified:           {self.stats['documents_modified']:,}")
        print(f"  ({(self.stats['documents_modified']/self.stats['total_documents']*100):.1f}% of total)\n")

        print("Phase 1 Removals:")
        print(f"  Figure captions removed:    {self.stats['figure_captions_removed']:,}")
        print(f"  Document summaries removed: {self.stats['doc_summaries_removed']:,}")
        print(f"  Page numbers removed:       {self.stats['page_numbers_removed']:,}")
        print(f"  .pdf titles fixed:          {self.stats['pdf_titles_fixed']:,}")
        print(f"  Timestamps removed:         {self.stats['timestamps_removed']:,}\n")

        print("Phase 2 Removals:")
        print(f"  Newsletter prompts removed: {self.stats['newsletters_removed']:,}")
        print(f"  Footer sections removed:    {self.stats['footers_removed']:,}")
        print(f"  'More Like This' removed:   {self.stats['more_like_this_removed']:,}")
        print(f"  Frontmatter quotes fixed:   {self.stats['frontmatter_fixed']:,}\n")

        print(f"Total characters removed:     {self.stats['total_chars_removed']:,}")
        print(f"  (~{self.stats['total_chars_removed']//2:,} words)\n")


def main():
    parser = argparse.ArgumentParser(
        description='Clean up library document content',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (see what would change)
  python3 cleanup_library_content.py --dry-run

  # Phase 1 only (safest)
  python3 cleanup_library_content.py --phase 1

  # Phases 1+2 (recommended)
  python3 cleanup_library_content.py --phase 1-2

  # Test on 20 documents first
  python3 cleanup_library_content.py --dry-run --limit 20
        """
    )

    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be changed without modifying database')
    parser.add_argument('--phase', default='1',
                        help='Cleanup phase: 1, 2, or 1-2 (default: 1)')
    parser.add_argument('--limit', type=int,
                        help='Limit number of documents to process (for testing)')

    args = parser.parse_args()

    # Confirm if not dry run
    if not args.dry_run:
        print("⚠️  WARNING: This will modify the database!")
        response = input("Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)

    # Run cleanup
    cleaner = LibraryContentCleaner(dry_run=args.dry_run)
    cleaner.connect()

    try:
        cleaner.process_documents(phase=args.phase, limit=args.limit)
        cleaner.print_summary()

        if not args.dry_run:
            cleaner.conn.commit()
            print("\n✓ Changes committed to database")
        else:
            print("\n✓ Dry run complete - no changes made")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        if cleaner.conn:
            cleaner.conn.rollback()
        raise
    finally:
        cleaner.disconnect()


if __name__ == '__main__':
    main()
