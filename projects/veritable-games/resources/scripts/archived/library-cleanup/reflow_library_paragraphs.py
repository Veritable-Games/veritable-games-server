#!/usr/bin/env python3
"""
Simple Markdown Paragraph Reflow Script

Designed for anarchist library markdown exports that have hard line wrapping.
Joins lines within paragraphs while preserving all structural elements.

NO file format assumptions - works with any markdown file.
"""

import re
from pathlib import Path
import argparse


def detect_if_already_reflowed(content: str, threshold: int = 140) -> bool:
    """
    Check if file is already reflowed by analyzing average prose line length

    Args:
        content: File content
        threshold: Avg chars/line above which we consider it reflowed

    Returns:
        True if file appears already reflowed, False otherwise
    """
    lines = content.split('\n')

    # Get prose lines (skip structural elements)
    prose_lines = []
    for line in lines:
        stripped = line.strip()

        # Skip blank lines
        if not stripped:
            continue

        # Skip headers
        if stripped.startswith('#'):
            continue

        # Skip lists
        if stripped.startswith(('-', '*', '•')):
            continue

        # Skip numbered lists
        if re.match(r'^\d+\.', stripped):
            continue

        # Skip very short lines (likely metadata/labels)
        if len(stripped) < 30:
            continue

        # Skip lines that are indented (code/quotes)
        if line.startswith('    '):
            continue

        prose_lines.append(stripped)

    # Need reasonable sample
    if len(prose_lines) < 10:
        return False

    avg_length = sum(len(l) for l in prose_lines) / len(prose_lines)

    return avg_length > threshold


def is_structural_line(line: str) -> bool:
    """
    Detect if a line is a structural element that should NOT be joined

    Structural elements:
    - Blank lines
    - Headers (##)
    - Lists (-, *, •, 1.)
    - Indented blocks (4+ spaces - code/quotes)
    """
    stripped = line.strip()

    # Blank line
    if not stripped:
        return True

    # Header
    if stripped.startswith('#'):
        return True

    # List markers
    if stripped.startswith(('-', '*', '•')):
        return True

    # Numbered list
    if re.match(r'^\d+\.', stripped):
        return True

    # Indented block (4+ spaces)
    leading_spaces = len(line) - len(line.lstrip())
    if leading_spaces >= 4:
        return True

    return False


def reflow_paragraphs(content: str) -> tuple[str, int]:
    """
    Join lines within paragraphs while preserving structure

    Rules:
    - Paragraphs separated by blank lines are preserved
    - Structural elements (headers, lists, indented blocks) stay separate
    - Within paragraphs, line breaks are replaced with spaces

    Returns:
        (reflowed_content, lines_joined_count)
    """
    lines = content.split('\n')
    output = []
    paragraph_buffer = []
    lines_joined = 0

    for line in lines:
        # Check if this is a structural element
        if is_structural_line(line):
            # Flush paragraph buffer first
            if paragraph_buffer:
                # Join buffered lines with spaces
                joined = ' '.join(paragraph_buffer)
                output.append(joined)
                lines_joined += len(paragraph_buffer) - 1
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
        lines_joined += len(paragraph_buffer) - 1

    return '\n'.join(output), lines_joined


def process_file(file_path: Path, dry_run: bool = False) -> dict:
    """
    Process a single markdown file

    Returns:
        Dict with processing results
    """
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if already reflowed
        if detect_if_already_reflowed(content):
            return {
                'status': 'skipped',
                'reason': 'already_reflowed',
                'lines_joined': 0
            }

        # Reflow paragraphs
        reflowed, lines_joined = reflow_paragraphs(content)

        # Only write if we actually joined lines
        if lines_joined == 0:
            return {
                'status': 'skipped',
                'reason': 'no_changes',
                'lines_joined': 0
            }

        # Write back (unless dry run)
        if not dry_run:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(reflowed)

        return {
            'status': 'processed',
            'lines_joined': lines_joined,
            'old_size': len(content),
            'new_size': len(reflowed)
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def main():
    parser = argparse.ArgumentParser(
        description='Reflow hard-wrapped paragraphs in markdown files'
    )
    parser.add_argument(
        'directory',
        type=Path,
        help='Directory containing markdown files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )
    parser.add_argument(
        '--pattern',
        default='*.md',
        help='File pattern to match (default: *.md)'
    )

    args = parser.parse_args()

    if not args.directory.exists():
        print(f"Error: Directory {args.directory} does not exist")
        return 1

    # Find all markdown files
    md_files = list(args.directory.rglob(args.pattern))

    print("=" * 80)
    print("MARKDOWN PARAGRAPH REFLOW")
    print("=" * 80)
    print(f"Directory: {args.directory}")
    print(f"Files found: {len(md_files)}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 80)
    print()

    stats = {
        'total': 0,
        'processed': 0,
        'skipped_reflowed': 0,
        'skipped_no_changes': 0,
        'errors': 0,
        'total_lines_joined': 0
    }

    for idx, file_path in enumerate(md_files, 1):
        print(f"[{idx}/{len(md_files)}] Processing: {file_path.name}", end='')

        result = process_file(file_path, dry_run=args.dry_run)
        stats['total'] += 1

        if result['status'] == 'processed':
            stats['processed'] += 1
            stats['total_lines_joined'] += result['lines_joined']
            size_change = ((result['new_size'] - result['old_size']) / result['old_size']) * 100
            print(f" - Joined {result['lines_joined']} lines ({size_change:+.1f}% size)")
        elif result['status'] == 'skipped':
            if result['reason'] == 'already_reflowed':
                stats['skipped_reflowed'] += 1
                print(" - Skipped (already reflowed)")
            else:
                stats['skipped_no_changes'] += 1
                print(" - Skipped (no changes needed)")
        else:
            stats['errors'] += 1
            print(f" - ERROR: {result['error']}")

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total files: {stats['total']}")
    print(f"Processed: {stats['processed']}")
    print(f"Skipped (already reflowed): {stats['skipped_reflowed']}")
    print(f"Skipped (no changes): {stats['skipped_no_changes']}")
    print(f"Errors: {stats['errors']}")
    print(f"Total lines joined: {stats['total_lines_joined']:,}")
    print("=" * 80)

    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
