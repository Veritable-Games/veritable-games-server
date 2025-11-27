#!/usr/bin/env python3
"""
Fix Format B documents that have blank lines after every line

This script removes blank lines between text lines so the reflow logic
can properly join them into paragraphs.

Format B pattern:
```
Line one of text

Line two of text

Line three of text
```

Should become:
```
Line one of text
Line two of text
Line three of text
```

Then the reflow logic can join them into a single paragraph.
"""

import re
import sys
from pathlib import Path

def is_structural_line(line: str) -> bool:
    """Check if line is a structural element (header, list, etc.)"""
    stripped = line.strip()

    if not stripped:
        return False

    # Header
    if stripped.startswith('#'):
        return True

    # List marker
    if stripped.startswith(('-', '•', '·', '*')):
        return True

    # Numbered list
    if re.match(r'^\d+\.', stripped):
        return True

    # Horizontal rule/divider
    if re.match(r'^[-=*_]{3,}$', stripped):
        return True

    return False

def fix_blank_line_paragraphs(content: str) -> str:
    """
    Remove excessive blank lines between text lines

    Keep blank lines:
    - Before/after headers
    - Before/after lists
    - Before/after horizontal rules
    - Between actual paragraphs (2+ blank lines become 1)

    Remove blank lines:
    - Between regular text lines (indicates Format B wrapping)
    """
    lines = content.split('\n')
    output = []
    i = 0

    while i < len(lines):
        current_line = lines[i]

        # If current line is blank
        if not current_line.strip():
            # Look ahead to see what comes next
            next_non_blank_idx = i + 1
            while next_non_blank_idx < len(lines) and not lines[next_non_blank_idx].strip():
                next_non_blank_idx += 1

            # Count blank lines
            blank_count = next_non_blank_idx - i

            # If we have previous content
            if output:
                prev_line = output[-1] if output else ''
                next_line = lines[next_non_blank_idx] if next_non_blank_idx < len(lines) else ''

                # Keep blank line if:
                # - Previous or next line is structural
                # - Multiple blank lines (actual paragraph break)
                if (is_structural_line(prev_line) or
                    is_structural_line(next_line) or
                    blank_count >= 2):
                    output.append('')  # Keep ONE blank line
                # Otherwise skip the blank line (Format B artifact)
            else:
                # Keep leading blank lines
                output.append('')

            i = next_non_blank_idx
        else:
            # Non-blank line - add it
            output.append(current_line)
            i += 1

    return '\n'.join(output)

def process_file(file_path: Path, dry_run: bool = False) -> dict:
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        # Fix blank line paragraphs
        fixed_content = fix_blank_line_paragraphs(original_content)

        # Calculate changes
        original_lines = len(original_content.split('\n'))
        fixed_lines = len(fixed_content.split('\n'))
        lines_removed = original_lines - fixed_lines

        if not dry_run and fixed_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)

        return {
            'success': True,
            'original_lines': original_lines,
            'fixed_lines': fixed_lines,
            'lines_removed': lines_removed,
            'changed': fixed_content != original_content
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Fix Format B blank line artifacts')
    parser.add_argument('directory', help='Directory containing markdown files')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without modifying files')
    parser.add_argument('--limit', type=int, help='Limit number of files to process')

    args = parser.parse_args()

    directory = Path(args.directory)
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        return 1

    # Find all markdown files
    md_files = list(directory.rglob('*.md'))

    if args.limit:
        md_files = md_files[:args.limit]

    print("=" * 80)
    print(f"Fix Blank Line Paragraphs {'(DRY RUN)' if args.dry_run else ''}")
    print("=" * 80)
    print(f"Directory: {directory}")
    print(f"Files found: {len(md_files)}")
    print("=" * 80)
    print()

    stats = {
        'total': 0,
        'changed': 0,
        'unchanged': 0,
        'errors': 0,
        'total_lines_removed': 0
    }

    for idx, file_path in enumerate(md_files, 1):
        print(f"[{idx}/{len(md_files)}] Processing: {file_path.name}")

        result = process_file(file_path, dry_run=args.dry_run)
        stats['total'] += 1

        if result['success']:
            if result['changed']:
                stats['changed'] += 1
                stats['total_lines_removed'] += result['lines_removed']
                print(f"  ✓ Changed: Removed {result['lines_removed']} blank lines "
                      f"({result['original_lines']} → {result['fixed_lines']} lines)")
            else:
                stats['unchanged'] += 1
        else:
            stats['errors'] += 1
            print(f"  ✗ Error: {result['error']}")

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total files: {stats['total']}")
    print(f"Changed: {stats['changed']}")
    print(f"Unchanged: {stats['unchanged']}")
    print(f"Errors: {stats['errors']}")
    print(f"Total blank lines removed: {stats['total_lines_removed']:,}")
    print("=" * 80)

    if args.dry_run:
        print("\n⚠️  This was a DRY RUN - no files were modified")
        print("Run without --dry-run to apply changes")

    return 0

if __name__ == '__main__':
    sys.exit(main())
