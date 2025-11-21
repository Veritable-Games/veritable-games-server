#!/usr/bin/env python3
import re

# Read the truly missing list
with open('/tmp/truly_missing_from_db.txt', 'r') as f:
    content = f.read()

# Parse entries
entries = []
current_entry = {}
for line in content.split('\n'):
    if line.startswith('File:'):
        if current_entry:
            entries.append(current_entry)
        current_entry = {'file': line.replace('File:', '').strip()}
    elif line.startswith('Title:'):
        current_entry['title'] = line.replace('Title:', '').strip()
    elif line.startswith('Author:'):
        current_entry['author'] = line.replace('Author:', '').strip()

if current_entry:
    entries.append(current_entry)

# Categorize
categories = {
    'no_author_fragments': [],
    'pdf_artifacts': [],
    'legitimate_with_author': [],
    'short_titles': [],
    'other': []
}

for entry in entries:
    title = entry.get('title', '')
    author = entry.get('author', 'None')
    
    # Check categories
    if author == 'None' and len(title) < 80:
        categories['no_author_fragments'].append(entry)
    elif 'pdf' in entry['file'].lower() or 'Microsoft Word' in title:
        categories['pdf_artifacts'].append(entry)
    elif author != 'None' and len(title) > 20:
        categories['legitimate_with_author'].append(entry)
    elif len(title) < 50:
        categories['short_titles'].append(entry)
    else:
        categories['other'].append(entry)

print("=" * 80)
print("CATEGORIZATION OF 142 MISSING DOCUMENTS")
print("=" * 80)
print()
print(f"No author + fragments:        {len(categories['no_author_fragments'])}")
print(f"PDF/Word artifacts:           {len(categories['pdf_artifacts'])}")
print(f"Legitimate (with author):     {len(categories['legitimate_with_author'])}")
print(f"Short titles:                 {len(categories['short_titles'])}")
print(f"Other:                        {len(categories['other'])}")
print()

print("LEGITIMATE DOCUMENTS (WITH AUTHORS):")
print("-" * 80)
for entry in categories['legitimate_with_author']:
    print(f"Title: {entry['title']}")
    print(f"Author: {entry['author']}")
    print(f"File: {entry['file']}")
    print()

print(f"\nTotal worthy of import: {len(categories['legitimate_with_author'])}")
