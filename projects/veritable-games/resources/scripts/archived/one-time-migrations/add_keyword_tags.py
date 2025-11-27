#!/usr/bin/env python3
"""
Add keyword-based tags to library documents (Tier 3 - Thematic tagging).

Analyzes document content and adds relevant thematic tags.
"""

import psycopg2
import os
import re
from collections import Counter

DATABASE_URL = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/veritable_games')

# Thematic keyword mappings (keyword → tag)
KEYWORD_TAGS = {
    # Political themes
    'anarchism': ['anarchism', 'political-theory'],
    'anarchist': ['anarchism', 'political-theory'],
    'socialism': ['socialism'],
    'socialist': ['socialism'],
    'communism': ['communism'],
    'communist': ['communism'],
    'capitalism': ['capitalism', 'critique'],
    'capitalist': ['capitalism', 'critique'],
    'marxism': ['marxism'],
    'marxist': ['marxism'],
    'revolution': ['revolution'],
    'revolutionary': ['revolution'],
    'syndicalism': ['syndicalism', 'labor'],
    'syndicalist': ['syndicalism', 'labor'],

    # Labor & organizing
    'union': ['labor', 'organizing'],
    'strike': ['labor', 'strike', 'direct-action'],
    'workers': ['labor', 'working-class'],
    'organizing': ['organizing', 'activism'],
    'solidarity': ['solidarity', 'mutual-aid'],
    'iww': ['iww', 'labor'],
    'labor': ['labor'],
    'labour': ['labor'],

    # Social themes
    'feminism': ['feminism', 'gender'],
    'feminist': ['feminism', 'gender'],
    'racism': ['racism', 'anti-racism'],
    'anti-racism': ['anti-racism'],
    'colonialism': ['colonialism', 'decolonization'],
    'colonial': ['colonialism'],
    'decolonization': ['decolonization'],
    'indigenous': ['indigenous-rights'],
    'queer': ['queer-theory', 'lgbtq'],
    'lgbtq': ['lgbtq'],

    # Economic
    'rent': ['housing', 'rent-strike'],
    'housing': ['housing'],
    'tenant': ['housing', 'tenants-rights'],
    'eviction': ['housing', 'eviction'],
    'gentrification': ['gentrification', 'urban-planning'],

    # Environmental
    'climate': ['climate-change', 'environment'],
    'ecology': ['ecology', 'environment'],
    'ecological': ['ecology', 'environment'],
    'environment': ['environment'],
    'sustainability': ['sustainability', 'environment'],

    # Resistance & action
    'resistance': ['resistance', 'activism'],
    'protest': ['protest', 'direct-action'],
    'rebellion': ['rebellion', 'resistance'],
    'riot': ['riot', 'uprising'],
    'uprising': ['uprising', 'rebellion'],
    'occupation': ['occupation', 'direct-action'],
    'blockade': ['blockade', 'direct-action'],

    # Prison & police
    'prison': ['prison', 'abolition'],
    'jail': ['prison', 'incarceration'],
    'abolition': ['abolition'],
    'abolitionist': ['abolition'],
    'police': ['police', 'state-violence'],
    'cop': ['police', 'state-violence'],

    # Theory
    'mutual-aid': ['mutual-aid', 'solidarity'],
    'direct-action': ['direct-action'],
    'autonomy': ['autonomy'],
    'self-organization': ['self-organization', 'autonomy'],
    'prefigurative': ['prefigurative-politics'],
    'dual-power': ['dual-power', 'strategy'],
}

def normalize_tag(tag):
    """Normalize tag name."""
    normalized = tag.strip().lower()
    normalized = re.sub(r'\s+', '-', normalized)
    normalized = re.sub(r'[^a-z0-9-]', '', normalized)
    normalized = re.sub(r'-+', '-', normalized)
    return normalized.strip('-')

def extract_keyword_tags(content, title):
    """Extract thematic tags based on keywords in content."""
    # Combine title (weighted heavily) with content sample
    text = ((title + ' ') * 10 + content[:5000]).lower()

    found_tags = set()
    for keyword, tags in KEYWORD_TAGS.items():
        # Use word boundaries to avoid partial matches
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found_tags.update(tags)

    return list(found_tags)

def get_or_create_tag(cur, tag_name):
    """Get existing tag ID or create new tag."""
    # Check if exists
    cur.execute("SELECT id FROM shared.tags WHERE name = %s", (tag_name,))
    result = cur.fetchone()

    if result:
        return result[0]

    # Create new tag
    cur.execute("INSERT INTO shared.tags (name) VALUES (%s) RETURNING id", (tag_name,))
    return cur.fetchone()[0]

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("="*70)
    print("Adding Keyword-Based Tags (Tier 3)")
    print("="*70)

    # Get all library documents without keyword tags
    cur.execute("""
        SELECT id, title, content
        FROM library.library_documents
        WHERE created_by = 3
        ORDER BY id
    """)

    documents = cur.fetchall()
    print(f"\nProcessing {len(documents)} documents...\n")

    stats = {'processed': 0, 'tags_added': 0, 'skipped': 0}

    for doc_id, title, content in documents:
        stats['processed'] += 1

        if not content:
            stats['skipped'] += 1
            continue

        # Extract keyword tags
        keyword_tags = extract_keyword_tags(content, title)

        if not keyword_tags:
            if stats['processed'] % 100 == 0:
                print(f"[{stats['processed']:5d}] No keywords: {title[:60]}")
            continue

        # Add tags to document
        tags_added_for_doc = 0
        for tag_name in keyword_tags:
            normalized = normalize_tag(tag_name)
            if len(normalized) < 3:
                continue

            tag_id = get_or_create_tag(cur, normalized)

            # Insert tag association (ignore if already exists)
            try:
                cur.execute("""
                    INSERT INTO library.library_document_tags (document_id, tag_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                """, (doc_id, tag_id))
                if cur.rowcount > 0:
                    tags_added_for_doc += 1
                    stats['tags_added'] += 1
            except Exception as e:
                print(f"Error adding tag '{normalized}' to doc {doc_id}: {e}")

        if stats['processed'] % 100 == 0:
            conn.commit()
            print(f"[{stats['processed']:5d}] +{tags_added_for_doc} tags: {title[:60]}")

    # Final commit
    conn.commit()

    print(f"\n{'='*70}")
    print("Tagging Complete!")
    print(f"{'='*70}")
    print(f"  Processed: {stats['processed']}")
    print(f"  Tags added: {stats['tags_added']}")
    print(f"  Skipped (no content): {stats['skipped']}")
    print(f"{'='*70}")

    conn.close()

if __name__ == '__main__':
    main()
