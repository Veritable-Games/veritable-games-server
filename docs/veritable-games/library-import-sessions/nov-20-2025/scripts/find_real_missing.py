#!/usr/bin/env python3
import os
import re
import psycopg2

# Connect to database
conn = psycopg2.connect(
    host="localhost",
    database="veritable_games",
    user="postgres",
    password="postgres"
)
cur = conn.cursor()

# Get all titles in database
cur.execute("SELECT title FROM library.library_documents WHERE created_by = 3;")
db_titles = set(row[0].strip() for row in cur.fetchall())

print(f"Database has {len(db_titles)} documents")

# Get all markdown files and extract titles from YAML
library_path = "/home/user/projects/veritable-games/resources/data/library"
file_titles = {}
missing_count = 0

for filename in sorted(os.listdir(library_path)):
    if not filename.endswith('.md'):
        continue
        
    filepath = os.path.join(library_path, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read(500)  # Read first 500 chars
            # Extract title from YAML frontmatter
            match = re.search(r'^title:\s*(.+)$', content, re.MULTILINE)
            if match:
                title = match.group(1).strip().strip('"').strip("'")
                file_titles[filename] = title
                
                # Check if in database
                if title not in db_titles:
                    missing_count += 1
                    if missing_count <= 20:
                        print(f"MISSING: {title[:80]}")
    except Exception as e:
        print(f"Error reading {filename}: {e}")

print(f"\nTotal .md files: {len(file_titles)}")
print(f"Total in DB: {len(db_titles)}")
print(f"Missing from DB: {missing_count}")

cur.close()
conn.close()
