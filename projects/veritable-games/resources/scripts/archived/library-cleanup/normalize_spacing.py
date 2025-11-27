#!/usr/bin/env python3
"""
Normalize excessive spacing in markdown files

Fixes PDF artifacts where multiple spaces appear between words
"""

import re
from pathlib import Path

def normalize_spacing(content: str) -> tuple[str, int]:
    """Normalize excessive spaces between words, return cleaned content + count of fixes"""
    lines = content.split('\n')
    output = []
    fixes = 0

    for line in lines:
        # Don't modify lines that are purely whitespace (blank lines)
        if not line.strip():
            output.append(line)
            continue

        # Check if line has multiple consecutive spaces
        if re.search(r'  +', line):
            # Normalize multiple spaces to single space
            # But preserve indentation at start of line
            leading_spaces = len(line) - len(line.lstrip())
            content_part = line[leading_spaces:]

            # Normalize spaces in content
            normalized = re.sub(r'  +', ' ', content_part)

            # Rebuild line with original indentation
            new_line = ' ' * leading_spaces + normalized

            if new_line != line:
                fixes += 1

            output.append(new_line)
        else:
            output.append(line)

    return '\n'.join(output), fixes

def process_file(file_path: Path) -> dict:
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        cleaned, fixes = normalize_spacing(content)

        if fixes > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned)

        return {
            'success': True,
            'fixes': fixes,
            'changed': fixes > 0
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 normalize_spacing.py <directory>")
        return 1

    directory = Path(sys.argv[1])
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        return 1

    # Find all markdown files
    md_files = list(directory.rglob('*.md'))

    print("=" * 80)
    print("Normalize Excessive Spacing")
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
        'total_fixes': 0
    }

    for idx, file_path in enumerate(md_files, 1):
        print(f"[{idx}/{len(md_files)}] Processing: {file_path.name}", end='')

        result = process_file(file_path)
        stats['total'] += 1

        if result['success']:
            if result['changed']:
                stats['changed'] += 1
                stats['total_fixes'] += result['fixes']
                print(f" - Fixed {result['fixes']} lines")
            else:
                stats['unchanged'] += 1
                print()
        else:
            stats['errors'] += 1
            print(f" - ERROR: {result['error']}")

    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total files: {stats['total']}")
    print(f"Changed: {stats['changed']}")
    print(f"Unchanged: {stats['unchanged']}")
    print(f"Errors: {stats['errors']}")
    print(f"Total lines fixed: {stats['total_fixes']:,}")
    print("=" * 80)

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
