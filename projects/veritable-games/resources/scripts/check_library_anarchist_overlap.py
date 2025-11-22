#!/usr/bin/env python3
"""
Check overlap between library documents and anarchist library.

Shows which imported library documents also exist in the anarchist library.
"""

import psycopg2
import os

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("="*70)
    print("Library vs Anarchist Library Overlap Analysis")
    print("="*70)

    # Get all library documents imported by library-importer
    cur.execute("""
        SELECT id, slug, title, author
        FROM library.library_documents
        WHERE created_by = 3
        ORDER BY slug
    """)
    library_docs = cur.fetchall()
    print(f"\nLibrary documents imported: {len(library_docs)}")

    # Check which ones also exist in anarchist library
    overlaps = []
    for lib_id, lib_slug, lib_title, lib_author in library_docs:
        cur.execute("""
            SELECT id, slug, title, author
            FROM anarchist.documents
            WHERE slug = %s
        """, (lib_slug,))
        anarchist_match = cur.fetchone()

        if anarchist_match:
            overlaps.append({
                'slug': lib_slug,
                'lib_title': lib_title,
                'lib_author': lib_author or 'Unknown',
                'anarch_title': anarchist_match[2],
                'anarch_author': anarchist_match[3] or 'Unknown'
            })

    print(f"Documents that exist in BOTH library and anarchist: {len(overlaps)}")
    print(f"Unique to library: {len(library_docs) - len(overlaps)}")

    # Show first 20 overlaps as examples
    if overlaps:
        print(f"\n{'='*70}")
        print("Sample of overlapping documents (first 20):")
        print(f"{'='*70}")
        for i, overlap in enumerate(overlaps[:20], 1):
            print(f"\n{i}. Slug: {overlap['slug']}")
            print(f"   Library: {overlap['lib_title'][:60]} by {overlap['lib_author']}")
            print(f"   Anarchist: {overlap['anarch_title'][:60]} by {overlap['anarch_author']}")

    conn.close()

if __name__ == '__main__':
    main()
