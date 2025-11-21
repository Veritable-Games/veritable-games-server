#!/usr/bin/env python3
import os
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
cur.execute("SELECT LOWER(title) FROM library.library_documents WHERE created_by = 3;")
db_titles = set(row[0] for row in cur.fetchall())

# Get all markdown files
library_path = "/home/user/projects/veritable-games/resources/data/library"
markdown_files = []
for filename in os.listdir(library_path):
    if filename.endswith('.md'):
        markdown_files.append(filename)

# Find files not in database
missing_files = []
for filename in sorted(markdown_files):
    # Extract title from filename (remove category prefix and .md extension)
    parts = filename.split('_', 2)  # Split on first 2 underscores
    if len(parts) >= 3:
        title_part = parts[2].replace('.md', '')
        # Check if title exists in database
        title_lower = title_part.lower()
        if title_lower not in db_titles:
            missing_files.append(filename)

print(f"Found {len(missing_files)} files not in database:")
print()
for i, filename in enumerate(missing_files[:20], 1):
    print(f"{i}. {filename}")
    
if len(missing_files) > 20:
    print(f"... and {len(missing_files) - 20} more")

# Save full list
with open('/tmp/missing_files.txt', 'w') as f:
    for filename in missing_files:
        f.write(filename + '\n')

print(f"\nFull list saved to /tmp/missing_files.txt")

cur.close()
conn.close()
