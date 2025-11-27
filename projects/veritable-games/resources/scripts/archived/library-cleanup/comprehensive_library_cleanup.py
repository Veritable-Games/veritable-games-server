#!/usr/bin/env python3
"""
Comprehensive Library Document Cleanup Script
==============================================
Fixes catastrophic quality issues in user library documents:
- Title corruption (8.8% have titles > 200 chars, some over 1 MB)
- YAML frontmatter pollution (100% of documents)
- Page number artifacts
- Broken paragraph formatting
- Corrupted author fields
- Duplicate detection and analysis

Author: Claude Code
Created: November 24, 2025
"""

import re
import sys
import argparse
import psycopg2
from datetime import datetime
from typing import List, Tuple, Dict, Optional
import yaml

# Database connection settings
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'veritable_games',
    'user': 'postgres',
    'password': 'postgres'
}


class ComprehensiveLibraryCleanup:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.conn = None
        self.cursor = None
        self.stats = {
            'total_documents': 0,
            'documents_modified': 0,

            # Phase 1: Title repair
            'titles_repaired': 0,
            'titles_from_yaml': 0,
            'titles_from_h1': 0,
            'titles_truncated': 0,
            'pdf_extensions_removed': 0,

            # Phase 2: YAML stripping
            'yaml_blocks_removed': 0,
            'yaml_parse_failures': 0,

            # Phase 3: Content cleaning
            'page_numbers_removed': 0,
            'indentation_fixed': 0,
            'truncated_urls_removed': 0,
            'broken_headings_fixed': 0,
            'image_refs_removed': 0,

            # Phase 4: Author cleanup
            'authors_repaired': 0,
            'authors_from_yaml': 0,

            # Phase 5: Duplicates
            'duplicates_found': 0,

            # Character counts
            'total_chars_removed': 0,
        }

        self.examples = []
        self.max_examples = 10

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
    # PHASE 1: Title Repair
    # ========================================================================

    def extract_yaml_frontmatter(self, content: str) -> Tuple[Optional[Dict], str]:
        """
        Extract and parse YAML frontmatter from content
        Returns: (yaml_dict or None, content_without_yaml)
        """
        # Pattern: --- at start, followed by YAML, followed by ---
        pattern = r'^---\s*\n(.*?)\n---\s*\n'
        match = re.search(pattern, content, re.DOTALL | re.MULTILINE)

        if not match:
            return None, content

        yaml_text = match.group(1)
        content_without_yaml = content[match.end():]

        try:
            yaml_data = yaml.safe_load(yaml_text)
            return yaml_data, content_without_yaml
        except yaml.YAMLError as e:
            # YAML parsing failed - still remove the block but return None
            return None, content_without_yaml

    def extract_title_from_content(self, content: str) -> Optional[str]:
        """
        Extract clean title from content (YAML or first H1)
        """
        # Try YAML first
        yaml_data, _ = self.extract_yaml_frontmatter(content)
        if yaml_data and 'title' in yaml_data:
            title = str(yaml_data['title']).strip()
            # Remove .pdf extension if present
            if title.lower().endswith('.pdf'):
                title = title[:-4]
            return title

        # Try first H1 heading
        h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()
            # Remove .pdf extension if present
            if title.lower().endswith('.pdf'):
                title = title[:-4]
            return title

        return None

    def validate_and_repair_title(self, title: str, content: str) -> Tuple[str, Dict]:
        """
        Validate title and repair if corrupted
        Returns: (cleaned_title, stats_dict)
        """
        changes = {}
        original_title = title

        # Check for catastrophic corruption (title > 200 chars)
        if len(title) > 200:
            changes['corrupted'] = True
            changes['original_length'] = len(title)

            # Try to extract clean title from content
            extracted_title = self.extract_title_from_content(content)
            if extracted_title:
                title = extracted_title[:200]  # Truncate to safe length
                changes['extracted_from'] = 'yaml' if '---' in content[:100] else 'h1'
            else:
                # Last resort: truncate and clean
                title = title[:200]
                changes['truncated'] = True

        # Remove .pdf extension
        if title.lower().endswith('.pdf'):
            title = title[:-4]
            changes['pdf_removed'] = True

        # Clean up any remaining metadata artifacts
        # Pattern: "Title author: 'Name' date: '1892'"
        if "author:" in title or "date:" in title or "title:" in title:
            # Extract just the title part before metadata
            parts = re.split(r'\s+(author|date|title):', title, maxsplit=1)
            if parts:
                title = parts[0].strip()
                changes['metadata_removed'] = True

        # Final validation
        title = title.strip()
        if len(title) == 0:
            title = "Untitled Document"
            changes['fallback_title'] = True
        elif len(title) > 200:
            title = title[:200]
            changes['final_truncation'] = True

        if title != original_title:
            changes['title_changed'] = True

        return title, changes

    # ========================================================================
    # PHASE 2: YAML Frontmatter Stripping
    # ========================================================================

    def strip_yaml_frontmatter(self, content: str) -> Tuple[str, Optional[Dict], bool]:
        """
        Remove YAML frontmatter from content
        Returns: (cleaned_content, yaml_metadata, was_removed)
        """
        yaml_data, cleaned_content = self.extract_yaml_frontmatter(content)

        if yaml_data is not None or '---\n' in content[:100]:
            return cleaned_content.strip(), yaml_data, True

        return content, None, False

    # ========================================================================
    # PHASE 3: Content Artifact Removal
    # ========================================================================

    def remove_page_numbers(self, content: str) -> Tuple[str, int]:
        """
        Remove page number artifacts
        Patterns:
        - "1 of 179 3/18/25, 6:42 PM The Conquest of Bread https://..."
        - "2 of 11 3/17/25, 11:40 PM"
        """
        patterns = [
            # Full pattern with title and URL
            r'^\d+ of \d+ \d{1,2}/\d{1,2}/\d{2,4},?\s*\d{1,2}:\d{2}\s*[AP]M.*?https?://[^\n]+',
            # Simpler pattern
            r'^\d+ of \d+ \d{1,2}/\d{1,2}/\d{2,4},?\s*\d{1,2}:\d{2}\s*[AP]M[^\n]*',
            # Just the page number part
            r'\d+ of \d+ \d{1,2}/\d{1,2}/\d{2,4},?\s*\d{1,2}:\d{2}\s*[AP]M',
        ]

        count = 0
        cleaned = content

        for pattern in patterns:
            matches = re.findall(pattern, cleaned, re.MULTILINE)
            if matches:
                count += len(matches)
                cleaned = re.sub(pattern, '', cleaned, flags=re.MULTILINE)

        return cleaned, count

    def fix_indentation(self, content: str) -> Tuple[str, int]:
        """
        Fix excessive indentation from PDF extraction
        Preserve markdown list/quote indentation
        """
        lines = content.split('\n')
        fixed_lines = []
        fixes = 0

        for line in lines:
            # Skip lines that are legitimately indented (lists, quotes, code)
            if line.startswith('    ') and not line.strip().startswith(('-', '*', '+', '>', '```')):
                # Check if line has excessive indentation (>10 spaces)
                stripped = line.lstrip()
                leading_spaces = len(line) - len(stripped)

                if leading_spaces > 10:
                    # Reduce to normal paragraph (no indentation)
                    fixed_lines.append(stripped)
                    fixes += 1
                else:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)

        return '\n'.join(fixed_lines), fixes

    def remove_truncated_urls(self, content: str) -> Tuple[str, int]:
        """
        Remove truncated URLs ending in "..."
        Pattern: https://www.example.com/some/path...
        """
        pattern = r'https?://[^\s]+\.\.\.'
        matches = re.findall(pattern, content)
        cleaned = re.sub(pattern, '', content)
        return cleaned, len(matches)

    def fix_broken_headings(self, content: str) -> Tuple[str, int]:
        """
        Fix orphaned ## markers that appear mid-paragraph
        Pattern: text\n## more text (where ## is not at start of line conceptually)
        """
        # Find ## that appear after non-heading text on same line
        pattern = r'(\w+)\s*\n##\s+(\w+)'
        matches = re.findall(pattern, content)

        # Replace with proper paragraph break
        cleaned = re.sub(pattern, r'\1 \2', content)

        return cleaned, len(matches)

    def remove_image_references(self, content: str) -> Tuple[str, int]:
        """
        Remove image references to non-existent files
        Pattern: ![alt text](images/page_X_content/img-Y.png)
        """
        pattern = r'!\[([^\]]*)\]\(images/[^\)]+\)'
        matches = re.findall(pattern, content)
        cleaned = re.sub(pattern, '', content)
        return cleaned, len(matches)

    # ========================================================================
    # PHASE 4: Author Field Cleanup
    # ========================================================================

    def extract_and_clean_author(self, author: str, yaml_data: Optional[Dict]) -> Tuple[str, Dict]:
        """
        Clean author field, extracting from YAML if corrupted
        Returns: (cleaned_author, changes_dict)
        """
        changes = {}
        original_author = author

        # Check if author is corrupted (contains metadata)
        if author and ("author:" in author or "date:" in author or "title:" in author or
                       "{" in author or "}" in author or len(author) > 100):
            changes['corrupted'] = True

            # Try to extract from YAML
            if yaml_data and 'author' in yaml_data:
                author = str(yaml_data['author']).strip()
                changes['extracted_from_yaml'] = True
            else:
                # Try to extract just the author part before metadata
                parts = re.split(r'\s+(author|date|title):', author, maxsplit=1)
                if parts and len(parts[0].strip()) > 0:
                    author = parts[0].strip()
                    changes['extracted_prefix'] = True
                else:
                    # Can't fix - set to None
                    author = None
                    changes['unfixable'] = True

        # Validate final author
        if author:
            author = author.strip()
            if len(author) > 100:
                author = author[:100]
                changes['truncated'] = True

            # Remove any remaining special characters
            if any(char in author for char in ['{', '}', '[', ']']):
                author = re.sub(r'[{}\[\]]', '', author)
                changes['special_chars_removed'] = True

        if author != original_author:
            changes['author_changed'] = True

        return author, changes

    # ========================================================================
    # PHASE 5: Duplicate Detection
    # ========================================================================

    def find_duplicates(self) -> List[Dict]:
        """
        Find documents that exist in both user library and anarchist library
        Returns list of duplicate records with comparison data
        """
        query = """
        SELECT
            l.id as library_id,
            l.title as library_title,
            l.author as library_author,
            LENGTH(l.content) as library_content_length,
            a.id as anarchist_id,
            a.title as anarchist_title,
            a.author as anarchist_author,
            a.file_path as anarchist_file_path
        FROM library.library_documents l
        INNER JOIN anarchist.documents a
            ON LOWER(TRIM(l.title)) = LOWER(TRIM(a.title))
        ORDER BY l.title
        """

        self.cursor.execute(query)
        results = self.cursor.fetchall()

        duplicates = []
        for row in results:
            duplicates.append({
                'library_id': row[0],
                'library_title': row[1],
                'library_author': row[2],
                'library_content_length': row[3],
                'anarchist_id': row[4],
                'anarchist_title': row[5],
                'anarchist_author': row[6],
                'anarchist_file_path': row[7],
            })

        return duplicates

    # ========================================================================
    # Main Processing Logic
    # ========================================================================

    def process_document(self, doc_id: int, title: str, author: Optional[str],
                        content: str) -> Tuple[str, Optional[str], str, Dict]:
        """
        Process a single document through all cleanup phases
        Returns: (new_title, new_author, new_content, changes_dict)
        """
        changes = {}
        original_length = len(content) if content else 0

        # PHASE 1: Title repair
        if title:
            new_title, title_changes = self.validate_and_repair_title(title, content or '')
            if title_changes:
                changes['title'] = title_changes
        else:
            new_title = title

        if not content:
            return new_title, author, content, changes

        # PHASE 2: YAML stripping
        new_content, yaml_data, yaml_removed = self.strip_yaml_frontmatter(content)
        if yaml_removed:
            changes['yaml_stripped'] = True

            # Update title from YAML if it was corrupted
            if yaml_data and 'title' in yaml_data and changes.get('title', {}).get('corrupted'):
                yaml_title = str(yaml_data['title']).strip()
                if yaml_title.lower().endswith('.pdf'):
                    yaml_title = yaml_title[:-4]
                if len(yaml_title) <= 200:
                    new_title = yaml_title
                    changes['title']['updated_from_yaml'] = True

        # PHASE 3: Content artifact removal
        new_content, page_count = self.remove_page_numbers(new_content)
        if page_count > 0:
            changes['page_numbers_removed'] = page_count

        new_content, indent_count = self.fix_indentation(new_content)
        if indent_count > 0:
            changes['indentation_fixed'] = indent_count

        new_content, url_count = self.remove_truncated_urls(new_content)
        if url_count > 0:
            changes['truncated_urls_removed'] = url_count

        new_content, heading_count = self.fix_broken_headings(new_content)
        if heading_count > 0:
            changes['broken_headings_fixed'] = heading_count

        new_content, image_count = self.remove_image_references(new_content)
        if image_count > 0:
            changes['image_refs_removed'] = image_count

        # PHASE 4: Author cleanup
        new_author = author
        if author:
            new_author, author_changes = self.extract_and_clean_author(author, yaml_data)
            if author_changes:
                changes['author'] = author_changes

        # Calculate total characters removed
        new_length = len(new_content)
        chars_removed = original_length - new_length
        changes['chars_removed'] = chars_removed

        return new_title, new_author, new_content, changes

    def process_all_documents(self, limit: Optional[int] = None):
        """
        Process all library documents through cleanup pipeline
        """
        print(f"\n{'='*70}")
        print(f"COMPREHENSIVE LIBRARY CLEANUP - {'DRY RUN' if self.dry_run else 'LIVE MODE'}")
        print(f"{'='*70}\n")

        # Fetch documents
        query = "SELECT id, title, author, content FROM library.library_documents WHERE content IS NOT NULL"
        if limit:
            query += f" LIMIT {limit}"

        self.cursor.execute(query)
        documents = self.cursor.fetchall()
        self.stats['total_documents'] = len(documents)

        print(f"Processing {len(documents)} documents...\n")

        for doc_id, title, author, content in documents:
            if not content:
                continue

            # Process document
            new_title, new_author, new_content, changes = self.process_document(
                doc_id, title, author, content
            )

            # Track statistics
            if changes:
                self.stats['documents_modified'] += 1

                # Phase 1 stats
                if 'title' in changes:
                    self.stats['titles_repaired'] += 1
                    if changes['title'].get('extracted_from') == 'yaml':
                        self.stats['titles_from_yaml'] += 1
                    elif changes['title'].get('extracted_from') == 'h1':
                        self.stats['titles_from_h1'] += 1
                    if changes['title'].get('truncated') or changes['title'].get('final_truncation'):
                        self.stats['titles_truncated'] += 1
                    if changes['title'].get('pdf_removed'):
                        self.stats['pdf_extensions_removed'] += 1

                # Phase 2 stats
                if changes.get('yaml_stripped'):
                    self.stats['yaml_blocks_removed'] += 1

                # Phase 3 stats
                if changes.get('page_numbers_removed'):
                    self.stats['page_numbers_removed'] += changes['page_numbers_removed']
                if changes.get('indentation_fixed'):
                    self.stats['indentation_fixed'] += changes['indentation_fixed']
                if changes.get('truncated_urls_removed'):
                    self.stats['truncated_urls_removed'] += changes['truncated_urls_removed']
                if changes.get('broken_headings_fixed'):
                    self.stats['broken_headings_fixed'] += changes['broken_headings_fixed']
                if changes.get('image_refs_removed'):
                    self.stats['image_refs_removed'] += changes['image_refs_removed']

                # Phase 4 stats
                if 'author' in changes:
                    self.stats['authors_repaired'] += 1
                    if changes['author'].get('extracted_from_yaml'):
                        self.stats['authors_from_yaml'] += 1

                # Character count
                self.stats['total_chars_removed'] += changes.get('chars_removed', 0)

                # Show examples
                if len(self.examples) < self.max_examples and self.dry_run:
                    self.examples.append({
                        'id': doc_id,
                        'old_title': title[:100] if title else '',
                        'new_title': new_title[:100] if new_title else '',
                        'old_author': author[:50] if author else '',
                        'new_author': new_author[:50] if new_author else '',
                        'changes': changes,
                    })

                # Update database
                if not self.dry_run:
                    update_parts = []
                    params = []

                    if new_title != title:
                        update_parts.append("title = %s")
                        params.append(new_title)

                    if new_author != author:
                        update_parts.append("author = %s")
                        params.append(new_author)

                    if new_content != content:
                        update_parts.append("content = %s")
                        params.append(new_content)

                    if update_parts:
                        # Also regenerate slug
                        update_parts.append("slug = %s")
                        slug = self.generate_slug(new_title, doc_id)
                        params.append(slug)

                        update_query = f"UPDATE library.library_documents SET {', '.join(update_parts)} WHERE id = %s"
                        params.append(doc_id)

                        self.cursor.execute(update_query, params)

    def generate_slug(self, title: str, doc_id: int) -> str:
        """Generate clean slug from title"""
        # Lowercase
        slug = title.lower()
        # Remove special characters
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        # Replace spaces with hyphens
        slug = re.sub(r'\s+', '-', slug)
        # Truncate to 200 chars and append ID
        slug = slug[:200] + '-' + str(doc_id)
        return slug

    def generate_duplicate_report(self, duplicates: List[Dict]) -> str:
        """Generate detailed duplicate comparison report"""
        report = []
        report.append("\n" + "="*70)
        report.append("DUPLICATE DOCUMENT ANALYSIS")
        report.append("="*70 + "\n")

        report.append(f"Total duplicates found: {len(duplicates)}")
        report.append(f"Percentage of user library: {len(duplicates) / self.stats['total_documents'] * 100:.1f}%\n")

        # Show first 10 duplicates
        report.append("Sample Duplicates (first 10):\n")
        for i, dup in enumerate(duplicates[:10], 1):
            report.append(f"{i}. {dup['library_title']}")
            report.append(f"   Library: ID {dup['library_id']}, Author: {dup['library_author']}, Length: {dup['library_content_length']:,} chars")
            report.append(f"   Anarchist: ID {dup['anarchist_id']}, Author: {dup['anarchist_author']}")
            report.append(f"   File: {dup['anarchist_file_path']}")
            report.append("")

        return '\n'.join(report)

    def print_summary(self, duplicates: Optional[List[Dict]] = None):
        """Print cleanup summary statistics"""
        print(f"\n{'='*70}")
        print("CLEANUP SUMMARY")
        print(f"{'='*70}\n")

        print(f"Total documents processed:    {self.stats['total_documents']:,}")
        print(f"Documents modified:           {self.stats['documents_modified']:,}")
        if self.stats['total_documents'] > 0:
            print(f"  ({self.stats['documents_modified']/self.stats['total_documents']*100:.1f}% of total)\n")

        print("Phase 1 - Title Repair:")
        print(f"  Titles repaired:            {self.stats['titles_repaired']:,}")
        print(f"  Extracted from YAML:        {self.stats['titles_from_yaml']:,}")
        print(f"  Extracted from H1:          {self.stats['titles_from_h1']:,}")
        print(f"  Titles truncated:           {self.stats['titles_truncated']:,}")
        print(f"  .pdf extensions removed:    {self.stats['pdf_extensions_removed']:,}\n")

        print("Phase 2 - YAML Stripping:")
        print(f"  YAML blocks removed:        {self.stats['yaml_blocks_removed']:,}\n")

        print("Phase 3 - Content Artifact Removal:")
        print(f"  Page numbers removed:       {self.stats['page_numbers_removed']:,}")
        print(f"  Indentation fixes:          {self.stats['indentation_fixed']:,}")
        print(f"  Truncated URLs removed:     {self.stats['truncated_urls_removed']:,}")
        print(f"  Broken headings fixed:      {self.stats['broken_headings_fixed']:,}")
        print(f"  Image references removed:   {self.stats['image_refs_removed']:,}\n")

        print("Phase 4 - Author Cleanup:")
        print(f"  Authors repaired:           {self.stats['authors_repaired']:,}")
        print(f"  Extracted from YAML:        {self.stats['authors_from_yaml']:,}\n")

        if duplicates is not None:
            print("Phase 5 - Duplicate Analysis:")
            print(f"  Duplicates found:           {len(duplicates):,}")
            print(f"  Percentage of library:      {len(duplicates)/self.stats['total_documents']*100:.1f}%\n")

        print(f"Total characters removed:     {self.stats['total_chars_removed']:,}")
        print(f"  (~{self.stats['total_chars_removed']//2:,} words)\n")

        # Show examples if in dry-run mode
        if self.dry_run and self.examples:
            print(f"\n{'='*70}")
            print(f"SAMPLE CHANGES (first {len(self.examples)} documents)")
            print(f"{'='*70}\n")

            for i, example in enumerate(self.examples, 1):
                print(f"{i}. Document ID {example['id']}")
                if example['old_title'] != example['new_title']:
                    print(f"   Title: '{example['old_title']}...'")
                    print(f"      →  '{example['new_title']}...'")
                if example['old_author'] != example['new_author']:
                    print(f"   Author: '{example['old_author']}'")
                    print(f"       →  '{example['new_author']}'")
                print(f"   Changes: {example['changes']}")
                print()


def main():
    parser = argparse.ArgumentParser(
        description='Comprehensive library document cleanup',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run on sample
  python3 comprehensive_library_cleanup.py --dry-run --limit 20

  # Full dry run
  python3 comprehensive_library_cleanup.py --dry-run

  # Execute cleanup
  python3 comprehensive_library_cleanup.py

  # Generate duplicate report only
  python3 comprehensive_library_cleanup.py --duplicates-only
        """
    )

    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be changed without modifying database')
    parser.add_argument('--limit', type=int,
                       help='Limit number of documents to process (for testing)')
    parser.add_argument('--duplicates-only', action='store_true',
                       help='Only analyze and report duplicates, skip cleanup')

    args = parser.parse_args()

    # Confirm if not dry run
    if not args.dry_run and not args.duplicates_only:
        print("⚠️  WARNING: This will modify the database!")
        response = input("Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)

    # Run cleanup
    cleaner = ComprehensiveLibraryCleanup(dry_run=args.dry_run or args.duplicates_only)
    cleaner.connect()

    try:
        if args.duplicates_only:
            # Only generate duplicate report
            print("\nAnalyzing duplicates...")
            duplicates = cleaner.find_duplicates()
            print(cleaner.generate_duplicate_report(duplicates))
        else:
            # Full cleanup process
            cleaner.process_all_documents(limit=args.limit)

            # Also check for duplicates
            print("\nAnalyzing duplicates...")
            duplicates = cleaner.find_duplicates()
            cleaner.stats['duplicates_found'] = len(duplicates)

            # Print summary
            cleaner.print_summary(duplicates)

            # Print duplicate report
            if duplicates:
                print(cleaner.generate_duplicate_report(duplicates))

        if not args.dry_run and not args.duplicates_only:
            cleaner.conn.commit()
            print("\n✓ Changes committed to database")
        else:
            print("\n✓ Analysis complete - no changes made")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        if cleaner.conn:
            cleaner.conn.rollback()
        raise
    finally:
        cleaner.disconnect()


if __name__ == '__main__':
    main()
