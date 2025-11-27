#!/usr/bin/env python3
"""Find markdown files that weren't imported to the database."""

import psycopg2
import os
import re
from pathlib import Path

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')
LIBRARY_PATH = Path('/home/user/projects/veritable-games/resources/data/library')

def extract_title_from_content(content):
    """Extract title from markdown content."""
    lines = content.split('\n')
    for line in lines[:50]:
        line = line.strip()
        if line.startswith('# '):
            title = line[2:].strip()
            title = re.sub(r'#+$', '', title).strip()
            return title
    return None

def generate_slug(title):
    """Generate slug from title."""
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 200:
        slug = slug[:200].rstrip('-')
    return slug

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Get all slugs from library and anarchist
cur.execute("SELECT slug FROM library.library_documents WHERE created_by = 3")
library_slugs = set(row[0] for row in cur.fetchall())

cur.execute("SELECT slug FROM anarchist.documents")
anarchist_slugs = set(row[0] for row in cur.fetchall())

print(f"Library documents: {len(library_slugs)}")
print(f"Anarchist documents: {len(anarchist_slugs)}")

# Check all markdown files
md_files = list(LIBRARY_PATH.glob('*.md'))
print(f"Markdown files: {len(md_files)}\n")

missing = []
for md_path in md_files:
    with open(md_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    title = extract_title_from_content(content)
    if not title:
        title = md_path.stem.replace('_', ' ').replace('-', ' ').title()

    slug = generate_slug(title)

    # Check if slug exists in either library or anarchist
    if slug not in library_slugs:
        # Check if it's in anarchist
        if slug in anarchist_slugs:
            missing.append((md_path.name, slug, 'in_anarchist'))
        else:
            missing.append((md_path.name, slug, 'nowhere'))

print(f"Missing from library (but in anarchist): {len([m for m in missing if m[2] == 'in_anarchist'])}")
print(f"Missing from everywhere: {len([m for m in missing if m[2] == 'nowhere'])}")
print(f"\nTotal missing: {len(missing)}\n")

# Show first 20 that are in anarchist
anarchist_missing = [m for m in missing if m[2] == 'in_anarchist']
if anarchist_missing:
    print("First 20 files that exist in anarchist library:")
    for filename, slug, _ in anarchist_missing[:20]:
        print(f"  {filename[:80]}")

conn.close()
