#!/usr/bin/env python3
import os
import re
import hashlib
import psycopg2
from collections import defaultdict

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="veritable_games",
    user="postgres",
    password="postgres"
)
cur = conn.cursor()

# Get all documents from database with their metadata
cur.execute("""
    SELECT id, title, author, created_at::text 
    FROM library.library_documents 
    WHERE created_by = 3 
    ORDER BY id;
""")
db_docs = cur.fetchall()

print(f"Database has {len(db_docs)} documents\n")

# Parse markdown files and extract metadata
library_path = "/home/user/projects/veritable-games/resources/data/library"
markdown_files = []
parse_errors = []

print("Parsing markdown files...")
for filename in sorted(os.listdir(library_path)):
    if not filename.endswith('.md'):
        continue
    
    filepath = os.path.join(library_path, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract YAML frontmatter
        yaml_match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if yaml_match:
            yaml_content = yaml_match.group(1)
            
            # Extract title
            title_match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', yaml_content, re.MULTILINE)
            title = title_match.group(1).strip() if title_match else filename
            
            # Extract author
            author_match = re.search(r'^author:\s*["\']?(.+?)["\']?\s*$', yaml_content, re.MULTILINE)
            author = author_match.group(1).strip() if author_match else None
            
            # Calculate file hash for duplicate detection
            file_hash = hashlib.md5(content.encode()).hexdigest()[:8]
            
            markdown_files.append({
                'filename': filename,
                'title': title,
                'author': author,
                'hash': file_hash,
                'size': len(content)
            })
        else:
            parse_errors.append(filename)
            
    except Exception as e:
        parse_errors.append(f"{filename}: {str(e)}")

print(f"Successfully parsed {len(markdown_files)} markdown files")
print(f"Parse errors: {len(parse_errors)}\n")

# Create lookup structures
db_titles = {doc[1].lower().strip(): doc for doc in db_docs}
md_titles = {md['title'].lower().strip(): md for md in markdown_files}

# Find matches and mismatches
exact_matches = []
missing_from_db = []
missing_from_disk = []

# Check markdown files against database
for md in markdown_files:
    title_lower = md['title'].lower().strip()
    if title_lower in db_titles:
        exact_matches.append(md)
    else:
        # Check for partial matches (database title might be enhanced)
        found_partial = False
        for db_title_lower, db_doc in db_titles.items():
            if title_lower in db_title_lower or db_title_lower in title_lower:
                found_partial = True
                break
        
        if not found_partial:
            missing_from_db.append(md)

# Check database against markdown files
for db_doc in db_docs:
    db_title_lower = db_doc[1].lower().strip()
    if db_title_lower not in md_titles:
        # Check for partial matches
        found_partial = False
        for md in markdown_files:
            md_title_lower = md['title'].lower().strip()
            if md_title_lower in db_title_lower or db_title_lower in md_title_lower:
                found_partial = True
                break
        
        if not found_partial:
            missing_from_disk.append(db_doc)

print("=" * 80)
print("ANALYSIS RESULTS")
print("=" * 80)
print(f"Markdown files on disk:     {len(markdown_files)}")
print(f"Documents in database:      {len(db_docs)}")
print(f"Exact title matches:        {len(exact_matches)}")
print(f"Missing from database:      {len(missing_from_db)}")
print(f"Missing from disk:          {len(missing_from_disk)}")
print(f"Parse errors:               {len(parse_errors)}")
print()

# Detect potential duplicates by content hash
hash_groups = defaultdict(list)
for md in markdown_files:
    hash_groups[md['hash']].append(md['filename'])

duplicates = {k: v for k, v in hash_groups.items() if len(v) > 1}
print(f"Potential duplicates:       {len(duplicates)} groups ({sum(len(v)-1 for v in duplicates.values())} extra files)")
print()

# Save detailed results
with open('/tmp/missing_from_db.txt', 'w') as f:
    f.write(f"Documents missing from database: {len(missing_from_db)}\n\n")
    for md in missing_from_db[:100]:
        f.write(f"Title: {md['title']}\n")
        f.write(f"File:  {md['filename']}\n")
        f.write(f"Author: {md['author']}\n\n")
    if len(missing_from_db) > 100:
        f.write(f"... and {len(missing_from_db) - 100} more\n")

with open('/tmp/missing_from_disk.txt', 'w') as f:
    f.write(f"Database entries missing from disk: {len(missing_from_disk)}\n\n")
    for db_doc in missing_from_disk[:100]:
        f.write(f"ID: {db_doc[0]}\n")
        f.write(f"Title: {db_doc[1]}\n")
        f.write(f"Author: {db_doc[2]}\n\n")
    if len(missing_from_disk) > 100:
        f.write(f"... and {len(missing_from_disk) - 100} more\n")

print("Detailed reports saved:")
print("  /tmp/missing_from_db.txt")
print("  /tmp/missing_from_disk.txt")

cur.close()
conn.close()
