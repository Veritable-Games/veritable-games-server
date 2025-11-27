#!/usr/bin/env python3
"""
Generate source URLs for remaining documents without authors
"""
import psycopg2
import os
import re
import csv

DB_CONNECTION = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

conn = psycopg2.connect(DB_CONNECTION)
cur = conn.cursor()

cur.execute("""
    SELECT 
        id,
        title,
        publication_date,
        slug,
        CASE 
            WHEN title LIKE '%Wikipedia%' OR title LIKE '%wikipedia%' THEN 'Wikipedia'
            WHEN title ~ '^\d{4}\.\d+' THEN 'ArXiv Paper'
            WHEN title ~ ',.*,.*--' OR title ~ ',.*,.*;' THEN 'Multi-Author'
            WHEN title LIKE '%**Source**%' THEN 'Source Marker'
            WHEN title LIKE '%liber3%' THEN 'Liber3 Archive'
            WHEN title LIKE '%Anna''s Archive%' OR title LIKE '%-- Anna''s Archive' THEN 'Annas Archive'
            WHEN LENGTH(title) > 150 THEN 'Corrupted/Long Title'
            WHEN title ~ '--.*--.*--' THEN 'Complex Separator'
            ELSE 'Other'
        END as pattern_type
    FROM library.library_documents 
    WHERE created_by = 3 AND author IS NULL
    ORDER BY pattern_type, title
""")

results = cur.fetchall()

# Generate source URLs
output_rows = []

for row in results:
    doc_id, title, pub_date, slug, pattern_type = row
    
    source_url = ""
    search_query = ""
    notes = ""
    
    if pattern_type == "ArXiv Paper":
        # Extract ArXiv ID
        arxiv_match = re.search(r'(\d{4}\.\d+)', title)
        if arxiv_match:
            arxiv_id = arxiv_match.group(1)
            source_url = f"https://arxiv.org/abs/{arxiv_id}"
            search_query = f"arxiv {arxiv_id}"
            notes = "ArXiv paper - authors available on page"
    
    elif pattern_type == "Wikipedia":
        # Clean Wikipedia title
        wiki_title = title.replace(' - Wikipedia', '').replace(' - wikipedia', '')
        wiki_title = wiki_title.replace('.pdf', '').strip()
        wiki_url = wiki_title.replace(' ', '_')
        source_url = f"https://en.wikipedia.org/wiki/{wiki_url}"
        search_query = f'"{wiki_title}" wikipedia'
        notes = "Wikipedia article - mark as 'Wikipedia Contributors'"
    
    elif pattern_type == "Annas Archive":
        # Extract potential ISBN or hash
        isbn_match = re.search(r'978\d{10}', title)
        if isbn_match:
            isbn = isbn_match.group(0)
            source_url = f"https://annas-archive.org/search?q={isbn}"
            search_query = f"isbn {isbn}"
            notes = "Anna's Archive book - search by ISBN"
        else:
            # Try to extract title and author
            parts = title.split(' -- ')
            if len(parts) >= 2:
                book_title = parts[0].strip()
                search_query = f'"{book_title}" anna\'s archive'
                source_url = f"https://annas-archive.org/search?q={book_title.replace(' ', '+')}"
                notes = "Anna's Archive book - search by title"
    
    elif pattern_type == "Multi-Author":
        # Extract potential title and authors
        if ' -- ' in title:
            parts = title.split(' -- ')
            if len(parts) >= 2:
                potential_authors = parts[1]
                potential_title = parts[0]
                search_query = f'"{potential_title}" "{potential_authors}"'
                notes = "Multi-author work - searchable by title and authors"
        elif ' - ' in title:
            parts = title.split(' - ')
            if len(parts) >= 2:
                search_query = f'"{parts[0]}" "{parts[1]}"'
                notes = "Multi-author work - search by title"
    
    else:
        # General search
        clean_title = title.replace('**Source**:', '').replace('.pdf', '').strip()
        if len(clean_title) > 10 and len(clean_title) < 150:
            search_query = f'"{clean_title[:100]}"'
            notes = "General search by title"
    
    output_rows.append({
        'id': doc_id,
        'title': title,
        'publication_date': pub_date or '',
        'pattern_type': pattern_type,
        'source_url': source_url,
        'search_query': search_query,
        'notes': notes,
        'slug': slug
    })

# Write to CSV
output_file = '/tmp/remaining_documents_with_sources.csv'
with open(output_file, 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['id', 'title', 'publication_date', 'pattern_type', 'source_url', 'search_query', 'notes', 'slug']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(output_rows)

print(f"✅ Generated source URLs for {len(output_rows)} documents")
print(f"Output: {output_file}")

# Print statistics
from collections import Counter
pattern_counts = Counter(row['pattern_type'] for row in output_rows)
sourceable_counts = Counter(row['pattern_type'] for row in output_rows if row['source_url'])

print("\n=== Statistics ===")
print("\nBy Pattern:")
for pattern, count in pattern_counts.most_common():
    sourceable = sourceable_counts[pattern]
    print(f"  {pattern}: {count} total, {sourceable} with direct URLs ({100*sourceable/count:.1f}%)")

print(f"\nTotal documents: {len(output_rows)}")
print(f"With direct source URLs: {sum(1 for r in output_rows if r['source_url'])}")
print(f"With search queries: {sum(1 for r in output_rows if r['search_query'])}")

cur.close()
conn.close()
