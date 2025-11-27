#!/usr/bin/env python3
"""
Remove page number headers that are breaking paragraph flow

Pattern to remove: Lines like "## 1", "## 2", "## 94" (just a header with a number)
These are PDF page numbers incorrectly detected as section headers
"""

import re
from pathlib import Path

def remove_page_headers(content: str) -> tuple[str, int]:
    """Remove page number headers and return cleaned content + count removed"""
    lines = content.split('\n')
    output = []
    removed_count = 0

    for line in lines:
        # Match: ## followed by optional spaces and ONLY digits
        if re.match(r'^##\s+\d+\s*$', line):
            removed_count += 1
            continue  # Skip this line
        output.append(line)

    return '\n'.join(output), removed_count

def process_file(file_path: Path) -> dict:
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        cleaned, removed = remove_page_headers(content)

        if removed > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(cleaned)

        return {
            'success': True,
            'removed': removed,
            'changed': removed > 0
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 remove_page_number_headers.py <directory>")
        return 1

    directory = Path(sys.argv[1])
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        return 1

    # Find all markdown files
    md_files = list(directory.rglob('*.md'))

    print("=" * 80)
    print("Remove Page Number Headers")
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
        'total_removed': 0
    }

    for idx, file_path in enumerate(md_files, 1):
        print(f"[{idx}/{len(md_files)}] Processing: {file_path.name}", end='')

        result = process_file(file_path)
        stats['total'] += 1

        if result['success']:
            if result['changed']:
                stats['changed'] += 1
                stats['total_removed'] += result['removed']
                print(f" - Removed {result['removed']} page headers")
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
    print(f"Total page headers removed: {stats['total_removed']:,}")
    print("=" * 80)

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
