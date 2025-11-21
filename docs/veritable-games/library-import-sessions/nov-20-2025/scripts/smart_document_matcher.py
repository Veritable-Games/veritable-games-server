#!/usr/bin/env python3
import os
import re
import psycopg2

def normalize_title(title):
    """Normalize title for comparison"""
    # Convert to lowercase
    title = title.lower()
    # Replace underscores and dashes with spaces
    title = title.replace('_', ' ').replace('-', ' ')
    # Remove special characters except spaces
    title = re.sub(r'[^a-z0-9\s]', '', title)
    # Collapse multiple spaces
    title = re.sub(r'\s+', ' ', title)
    # Strip whitespace
    return title.strip()

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="veritable_games",
    user="postgres",
    password="postgres"
)
cur = conn.cursor()

# Get all documents from database
cur.execute("SELECT id, title, author FROM library.library_documents WHERE created_by = 3;")
db_docs = {doc[0]: {'title': doc[1], 'author': doc[2], 'normalized': normalize_title(doc[1])} for doc in cur.fetchall()}

print(f"Database: {len(db_docs)} documents")

# Parse markdown files
library_path = "/home/user/projects/veritable-games/resources/data/library"
md_files = {}

for filename in os.listdir(library_path):
    if not filename.endswith('.md'):
        continue
    
    filepath = os.path.join(library_path, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read(1000)
        
        # Extract title from YAML
        title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()
            author_match = re.search(r'^author:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)
            author = author_match.group(1).strip() if author_match else None
            
            md_files[filename] = {
                'title': title,
                'author': author,
                'normalized': normalize_title(title)
            }
    except:
        pass

print(f"Markdown files: {len(md_files)}")

# Match using normalized titles
md_normalized_lookup = {md['normalized']: (fname, md) for fname, md in md_files.items()}
db_normalized_lookup = {db['normalized']: (doc_id, db) for doc_id, db in db_docs.items()}

# Find matches
exact_matches = set(md_normalized_lookup.keys()) & set(db_normalized_lookup.keys())
only_in_files = set(md_normalized_lookup.keys()) - set(db_normalized_lookup.keys())
only_in_db = set(db_normalized_lookup.keys()) - set(md_normalized_lookup.keys())

# Check for partial matches on "only in files"
truly_missing_from_db = []
for norm_title in only_in_files:
    # Check if this is a substring of any DB title (DB titles are often enhanced)
    found = False
    for db_norm in db_normalized_lookup.keys():
        if norm_title in db_norm or db_norm in norm_title:
            found = True
            break
    
    if not found and len(norm_title) > 10:  # Ignore very short titles
        truly_missing_from_db.append(md_normalized_lookup[norm_title])

print("\n" + "=" * 80)
print("SMART MATCHING RESULTS")
print("=" * 80)
print(f"Exact normalized matches:    {len(exact_matches)}")
print(f"Only in markdown files:      {len(only_in_files)}")
print(f"Only in database:            {len(only_in_db)}")
print(f"Truly missing from DB:       {len(truly_missing_from_db)}")
print()

# Show sample of truly missing
print("Sample of documents truly missing from database:")
print()
for i, (fname, md) in enumerate(truly_missing_from_db[:20], 1):
    print(f"{i}. {md['title'][:70]}")
    print(f"   Author: {md['author']}")
    print(f"   File: {fname}")
    print()

if len(truly_missing_from_db) > 20:
    print(f"... and {len(truly_missing_from_db) - 20} more")

# Save full list
with open('/tmp/truly_missing_from_db.txt', 'w') as f:
    f.write(f"Documents truly missing from database: {len(truly_missing_from_db)}\n\n")
    for fname, md in truly_missing_from_db:
        f.write(f"File: {fname}\n")
        f.write(f"Title: {md['title']}\n")
        f.write(f"Author: {md['author']}\n\n")

print(f"\nFull list saved to /tmp/truly_missing_from_db.txt")

cur.close()
conn.close()
