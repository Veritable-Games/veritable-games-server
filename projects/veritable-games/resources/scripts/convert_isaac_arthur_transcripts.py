#!/usr/bin/env python3
"""
Convert Isaac Arthur YouTube VTT transcripts to Markdown format.

Reads .en.vtt files from the raw directory, removes VTT formatting,
and outputs markdown files matching the existing transcript collection format.
"""

import os
import re
from pathlib import Path
from typing import Optional

# Configuration
RAW_DIR = Path("/home/user/projects/veritable-games/resources/data/isaac-arthur-download/raw")
OUTPUT_DIR = Path("/home/user/projects/veritable-games/resources/data/transcripts.OLD/Isaac Arthur/videos")
MIN_CONTENT_LENGTH = 100  # Skip files with less content

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(text: str) -> str:
    """Sanitize text for use in filenames."""
    # Replace problematic characters with underscores
    text = re.sub(r'[/\\:*?"<>|]', '_', text)
    # Remove excessive underscores
    text = re.sub(r'_+', '_', text)
    # Strip leading/trailing underscores
    text = text.strip('_')
    return text


def extract_video_id(filename: str) -> str:
    """Extract video ID from filename format: 'Title [VideoID].en.vtt'"""
    match = re.search(r'\[([a-zA-Z0-9_-]+)\]\.en\.vtt$', filename)
    if match:
        return match.group(1)
    return ""


def extract_title(filename: str) -> str:
    """Extract title from filename, removing video ID and extension."""
    # Remove [VideoID].en.vtt
    title = re.sub(r'\s*\[[a-zA-Z0-9_-]+\]\.en\.vtt$', '', filename)
    return title


def parse_vtt(content: str) -> str:
    """
    Parse VTT content and return plain text transcript.

    Removes:
    - WEBVTT header and metadata lines (Kind, Language)
    - Timestamps (HH:MM:SS.mmm --> HH:MM:SS.mmm)
    - Inline timestamps (<HH:MM:SS.mmm>)
    - VTT tags (<c>, </c>, <v>, </v>)
    - HTML tags (align, position, etc)
    """
    lines = content.split('\n')
    transcript_lines = []

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip header and metadata lines
        if any(line.startswith(prefix) for prefix in ['WEBVTT', 'Kind:', 'Language:']):
            continue

        # Skip timestamp lines (HH:MM:SS.mmm --> HH:MM:SS.mmm)
        if '-->' in line:
            continue

        # Remove inline timestamps (<HH:MM:SS.mmm>)
        line = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d{3}>', '', line)

        # Remove VTT tags
        # Remove <c>, </c> tags (caption styling)
        line = re.sub(r'</?c[^>]*>', '', line)
        # Remove <v> tags (voice styling)
        line = re.sub(r'<v\s+[^>]*>', '', line)
        line = re.sub(r'</v>', '', line)
        # Remove any other angle bracket tags
        line = re.sub(r'<[^>]+>', '', line)

        # Skip lines that are empty after cleaning
        if not line:
            continue

        # Clean up spacing issues
        # Fix spacing around punctuation
        line = re.sub(r'\s+', ' ', line)  # Multiple spaces to single

        transcript_lines.append(line)

    # Remove duplicates while preserving order
    # YouTube captions often repeat similar lines for word-level timing
    unique_lines = []
    for line in transcript_lines:
        # Only add if different from previous line
        if not unique_lines or line != unique_lines[-1]:
            unique_lines.append(line)

    # Join lines with spaces
    text = ' '.join(unique_lines)

    # Final cleanup
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single
    text = re.sub(r'\s+([.,:!?])', r'\1', text)  # Space before punctuation
    text = re.sub(r'([.!?])\s+([a-z])', r'\1 \2', text)  # Ensure space after sentence-ending punctuation

    return text.strip()


def process_vtt_file(vtt_path: Path) -> Optional[tuple[str, str, str]]:
    """
    Process a single VTT file.

    Returns tuple of (title, video_id, content) or None if invalid.
    """
    try:
        # Extract metadata from filename
        filename = vtt_path.name
        title = extract_title(filename)
        video_id = extract_video_id(filename)

        if not video_id:
            print(f"⚠️  Could not extract video ID from: {filename}")
            return None

        # Read and parse VTT content
        with open(vtt_path, 'r', encoding='utf-8') as f:
            vtt_content = f.read()

        transcript_text = parse_vtt(vtt_content)

        # Skip files with insufficient content
        if len(transcript_text) < MIN_CONTENT_LENGTH:
            print(f"⚠️  Skipping {filename} (insufficient content: {len(transcript_text)} chars)")
            return None

        return (title, video_id, transcript_text)

    except Exception as e:
        print(f"❌ Error processing {vtt_path.name}: {e}")
        return None


def write_markdown_file(title: str, video_id: str, content: str) -> bool:
    """Write markdown file with proper format and header."""
    try:
        # Sanitize title for filename
        safe_title = sanitize_filename(title)

        # Create filename in format: 03_Research_Papers_Articles_[Title] [VideoID].en.md
        filename = f"03_Research_Papers_Articles_{safe_title} [{video_id}].en.md"
        filepath = OUTPUT_DIR / filename

        # Check for duplicates (shouldn't happen, but just in case)
        if filepath.exists():
            print(f"⚠️  File already exists, skipping: {filename}")
            return False

        # Write file with header
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("Kind: captions Language: en\n")
            f.write(content)

        return True

    except Exception as e:
        print(f"❌ Error writing file for {title}: {e}")
        return False


def main():
    """Main conversion process."""
    print("🎬 Isaac Arthur Transcript Converter")
    print(f"Input directory: {RAW_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    # Check if raw directory exists and has files
    if not RAW_DIR.exists():
        print(f"❌ Raw directory not found: {RAW_DIR}")
        return

    vtt_files = list(RAW_DIR.glob("*.en.vtt"))
    if not vtt_files:
        print(f"❌ No .en.vtt files found in {RAW_DIR}")
        return

    print(f"📦 Found {len(vtt_files)} VTT files to process")
    print()

    # Process all VTT files
    successful = 0
    skipped = 0
    failed = 0

    for i, vtt_path in enumerate(sorted(vtt_files), 1):
        print(f"[{i}/{len(vtt_files)}] Processing: {vtt_path.name}")

        result = process_vtt_file(vtt_path)
        if result is None:
            skipped += 1
            continue

        title, video_id, content = result

        if write_markdown_file(title, video_id, content):
            successful += 1
            print(f"    ✅ Created: 03_Research_Papers_Articles_{sanitize_filename(title)} [{video_id}].en.md")
        else:
            failed += 1

    print()
    print("=" * 60)
    print("📊 Conversion Summary")
    print(f"   ✅ Successful: {successful}")
    print(f"   ⚠️  Skipped:   {skipped}")
    print(f"   ❌ Failed:    {failed}")
    print(f"   📁 Total:     {successful + skipped + failed}")
    print("=" * 60)

    # Verify output
    output_files = list(OUTPUT_DIR.glob("*.md"))
    print(f"\n📂 Output directory now contains {len(output_files)} markdown files")


if __name__ == "__main__":
    main()
