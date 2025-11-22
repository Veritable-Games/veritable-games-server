#!/usr/bin/env python3
"""Simple anarchist library import - no external dependencies"""

import subprocess
import os
import sys
from pathlib import Path

LIBRARY_PATH = Path(os.path.expanduser("~/converted-markdown"))
TOTAL = len(list(LIBRARY_PATH.rglob("*.md")))
COUNT = 0

print(f"Found {TOTAL} markdown files")
print("Starting import...")

for md_file in sorted(LIBRARY_PATH.rglob("*.md")):
    COUNT += 1

    # Basic metadata extraction
    slug = md_file.stem
    rel_path = str(md_file.relative_to(LIBRARY_PATH))

    # Get language from directory name
    parts = rel_path.split("/")
    lang = "en"
    for part in parts:
        if part.startswith("anarchist_library_texts_"):
            lang = part.replace("anarchist_library_texts_", "")
            break

    # Simple title from slug
    title = slug.replace("-", " ").replace("_", " ").title()
    category = f"anarchist-{lang}"

    # Escape single quotes for SQL
    slug_esc = slug.replace("'", "''")
    title_esc = title.replace("'", "''")
    rel_path_esc = rel_path.replace("'", "''")

    # Insert via docker psql
    cmd = [
        "docker", "exec", "veritable-games-postgres", "psql",
        "-U", "postgres", "-d", "veritable_games",
        "-c", f"INSERT INTO anarchist.documents (slug, title, language, file_path, category) VALUES ('{slug_esc}', '{title_esc}', '{lang}', '{rel_path_esc}', '{category}') ON CONFLICT (slug) DO NOTHING;"
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=False, timeout=5)
    except Exception as e:
        if COUNT % 1000 != 0:
            pass  # Silent except for milestone prints

    if COUNT % 2500 == 0 or COUNT == TOTAL:
        pct = (COUNT * 100) // TOTAL
        print(f"[{COUNT}/{TOTAL}] {pct}% complete")

print("✓ Import complete")

# Final count
cmd = ["docker", "exec", "veritable-games-postgres", "psql", "-U", "postgres", "-d", "veritable_games", "-c", "SELECT COUNT(*) FROM anarchist.documents;"]
result = subprocess.run(cmd, capture_output=True, text=True)
print(f"\nFinal count:\n{result.stdout}")
