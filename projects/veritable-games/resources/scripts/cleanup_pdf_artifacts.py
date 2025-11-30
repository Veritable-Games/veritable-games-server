#!/usr/bin/env python3
"""
PDF Artifact Cleanup Script (Python - High Performance)

Removes PDF-to-Markdown conversion artifacts from database documents:
- Complete Page View sections
- Figures and Images sections
- Conversion metadata blocks
- Page markers and dividers
- Form feed characters
- Excessive blank lines

Additionally attempts basic OCR correction for corrupted text.

Usage: ./cleanup_pdf_artifacts.py [OPTIONS]
"""

import re
import sys
import argparse
import psycopg2
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional, Dict
import subprocess

# Color codes for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    BOLD = '\033[1m'
    NC = '\033[0m'

class Stats:
    """Statistics tracking"""
    def __init__(self):
        self.total = 0
        self.cleaned = 0
        self.already_clean = 0
        self.failed = 0
        self.complete_page_view = 0
        self.figures = 0
        self.page_markers = 0
        self.form_feeds = 0
        self.metadata = 0
        self.ocr_fixed = 0
        self.ocr_flagged = 0
        self.bytes_saved = 0

class PDFArtifactCleaner:
    """Main cleanup class"""

    def __init__(self, config: Dict):
        self.config = config
        self.stats = Stats()
        self.log_file = config.get('log_file')
        self.ocr_log_file = config.get('log_file', '').replace('.log', '_ocr.txt')
        self.failed_docs_file = config.get('log_file', '').replace('.log', '_failed.txt')
        self.skip_ocr = config.get('skip_ocr', False)
        self.word_dict = None

        # Initialize log file
        with open(self.log_file, 'w') as f:
            f.write(f"PDF Artifact Cleanup - {datetime.now()}\n")
            f.write("=" * 80 + "\n\n")

    def log(self, message: str, level: str = 'INFO'):
        """Log message to file and optionally console"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{timestamp}] [{level}] {message}\n"

        with open(self.log_file, 'a') as f:
            f.write(log_line)

        # Console output with colors
        if level == 'ERROR':
            print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")
        elif level == 'SUCCESS':
            print(f"{Colors.GREEN}[✓]{Colors.NC} {message}")
        elif level == 'WARN':
            print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")
        elif level == 'INFO':
            print(f"{Colors.BLUE}[INFO]{Colors.NC} {message}")
        else:
            print(f"[{level}] {message}")

    def build_word_dictionary(self) -> set:
        """Build word dictionary for OCR correction"""
        if self.word_dict is not None:
            return self.word_dict

        self.log("Building word dictionary...", "INFO")
        words = set()

        # System dictionary
        dict_path = Path('/usr/share/dict/words')
        if dict_path.exists():
            with open(dict_path, 'r', errors='ignore') as f:
                words.update(line.strip().lower() for line in f if len(line.strip()) >= 3)

        # Common technical/political terms
        common_terms = [
            'anarchist', 'anarchism', 'capitalism', 'socialism', 'communism',
            'historical', 'naturalistic', 'pragmatic', 'perspectives',
            'routledge', 'chapters', 'between', 'selection', 'editorial',
            'contributors', 'individual', 'political', 'philosophical',
            'theoretical', 'practical', 'contemporary', 'discussion',
            'analysis', 'critique', 'movement', 'organization', 'collective',
            'assembly', 'democracy', 'autonomy', 'solidarity', 'resistance'
        ]
        words.update(common_terms)

        self.word_dict = words
        self.log(f"Dictionary built with {len(words)} words", "SUCCESS")
        return words

    def detect_corrupted_word(self, word: str) -> bool:
        """Detect if word is likely OCR-corrupted (missing vowels)"""
        if len(word) < 4:
            return False

        # Count vowels
        vowel_count = sum(1 for c in word.lower() if c in 'aeiou')
        consonant_count = sum(1 for c in word.lower() if c.isalpha() and c not in 'aeiou')

        # Corrupted if: 4+ chars, 3+ consonants, 0-1 vowels
        if len(word) >= 4 and consonant_count >= 3 and vowel_count <= 1:
            return True

        return False

    def attempt_ocr_fix(self, corrupted: str) -> Tuple[str, int]:
        """
        Attempt to fix OCR-corrupted word by inserting vowels.
        Returns (fixed_word, confidence_score)
        """
        if not self.word_dict:
            self.build_word_dictionary()

        best_match = corrupted
        best_score = 0

        # Try inserting each vowel at each position
        for i in range(len(corrupted) + 1):
            for vowel in 'aeiou':
                candidate = corrupted[:i] + vowel + corrupted[i:]

                # Check if candidate is in dictionary
                if candidate.lower() in self.word_dict:
                    # Score based on length and position
                    score = 100
                    if best_score < score:
                        best_match = candidate
                        best_score = score

                # Try double vowel insertion for longer words
                if len(corrupted) >= 6:
                    for j in range(i + 1, len(corrupted) + 2):
                        for vowel2 in 'aeiou':
                            candidate2 = corrupted[:i] + vowel + corrupted[i:j-1] + vowel2 + corrupted[j-1:]
                            if candidate2.lower() in self.word_dict:
                                score = 95
                                if best_score < score:
                                    best_match = candidate2
                                    best_score = score

        return best_match, best_score

    def apply_ocr_corrections(self, content: str) -> str:
        """Apply OCR corrections to content"""
        if self.skip_ocr:
            return content

        lines = content.split('\n')
        corrected_lines = []

        for line in lines:
            # Skip markdown headers, code blocks, etc.
            if line.strip().startswith('#') or line.strip().startswith('```'):
                corrected_lines.append(line)
                continue

            words = line.split()
            corrected_words = []

            for word in words:
                # Extract alpha characters only for testing
                clean_word = ''.join(c for c in word if c.isalpha())

                if not clean_word:
                    corrected_words.append(word)
                    continue

                if self.detect_corrupted_word(clean_word):
                    fixed, confidence = self.attempt_ocr_fix(clean_word.lower())

                    if confidence > 80 and fixed != clean_word.lower():
                        # Preserve original capitalization pattern
                        if clean_word[0].isupper():
                            fixed = fixed.capitalize()

                        # Replace in original word (preserve punctuation)
                        corrected_word = word.replace(clean_word, fixed)
                        corrected_words.append(corrected_word)

                        # Log correction
                        with open(self.ocr_log_file, 'a') as f:
                            f.write(f"Fixed: {clean_word} → {fixed} (confidence: {confidence}%)\n")

                        self.stats.ocr_fixed += 1
                    elif confidence <= 80 and fixed == clean_word.lower():
                        # Flag for manual review
                        with open(self.ocr_log_file, 'a') as f:
                            f.write(f"Flagged: {clean_word} (no confident fix found)\n")

                        corrected_words.append(word)
                        self.stats.ocr_flagged += 1
                    else:
                        corrected_words.append(word)
                else:
                    corrected_words.append(word)

            corrected_lines.append(' '.join(corrected_words))

        return '\n'.join(corrected_lines)

    def remove_conversion_metadata(self, content: str) -> str:
        """Remove conversion metadata block"""
        # Remove: *Converted from: ...* through *Converted: ...*
        pattern = r'\*Converted from:.*?\*\s*\n\*Total pages:.*?\*\s*\n\*File size:.*?\*\s*\n\*Converted:.*?\*\s*\n'
        content = re.sub(pattern, '', content, flags=re.DOTALL)

        # Also remove any stray conversion lines
        content = re.sub(r'^\*Converted from:.*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^\*Total pages:.*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^\*File size:.*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'^\*Converted:.*$', '', content, flags=re.MULTILINE)

        return content

    def remove_complete_page_view(self, content: str) -> str:
        """Remove Complete Page View sections"""
        # Pattern 1: Inline format (all on one line - MOST COMMON)
        # ### Complete Page View ![Page 2 Complete](images/page_002_full.png) content...
        pattern_inline = r'###\s+Complete Page View\s+!\[Page \d+ Complete\]\(images/page_\d+_full\.png\)\s*'
        content = re.sub(pattern_inline, '', content)

        # Pattern 2: Multi-line format with image reference
        pattern_multiline = r'###\s+Complete Page View\s*\n!\[Page \d+ Complete\]\(images/page_\d+_full\.png\)\s*\n'
        content = re.sub(pattern_multiline, '', content)

        # Pattern 3: Standalone Complete Page View header (no image)
        pattern_standalone = r'###\s+Complete Page View\s*\n'
        content = re.sub(pattern_standalone, '', content)

        return content

    def remove_figures_and_images(self, content: str) -> str:
        """Remove Figures and Images sections"""
        # Remove entire Figures and Images sections
        pattern = r'###\s+Figures and Images.*?(?=\n---|### |## |$)'
        content = re.sub(pattern, '', content, flags=re.DOTALL)

        # Remove individual figure references - handle both ### and #### levels
        # Format: ### Figure: filename.png\n![Figure from page N](images/...)\n

        # Pattern 1: ### Figure: ... with image (multi-line)
        pattern_3hash_multiline = r'###\s+Figure:\s*\S+\s*\n!\[Figure from page[^\]]*\]\(images/[^\)]+\)\s*\n?'
        content = re.sub(pattern_3hash_multiline, '', content)

        # Pattern 2: ### Figure: ... standalone (no image)
        pattern_3hash_standalone = r'###\s+Figure:\s*\S+\s*\n'
        content = re.sub(pattern_3hash_standalone, '', content)

        # Pattern 3: #### Figure: ... with image (4 hashes - less common)
        pattern_4hash_multiline = r'####\s+Figure:\s*\S+\s*\n!\[Figure from page[^\]]*\]\(images/[^\)]+\)\s*\n?'
        content = re.sub(pattern_4hash_multiline, '', content)

        # Pattern 4: #### Figure: ... standalone
        pattern_4hash_standalone = r'####\s+Figure:\s*\S+\s*\n'
        content = re.sub(pattern_4hash_standalone, '', content)

        return content

    def remove_page_markers(self, content: str) -> str:
        """Remove page markers and dividers"""
        # Remove: ## Page N
        content = re.sub(r'^##\s+Page\s+\d+\s*$', '', content, flags=re.MULTILINE)

        # Remove standalone --- dividers (but preserve in context like lists)
        lines = content.split('\n')
        filtered_lines = []
        for i, line in enumerate(lines):
            # Keep --- if it's part of YAML frontmatter or table
            if line.strip() == '---':
                # Check context
                prev_line = lines[i-1].strip() if i > 0 else ''
                next_line = lines[i+1].strip() if i < len(lines)-1 else ''

                # Skip if it's between page markers or after extracted text
                if prev_line.startswith('##') or next_line.startswith('##'):
                    continue
                if '### Extracted Text' in prev_line:
                    continue

            filtered_lines.append(line)

        return '\n'.join(filtered_lines)

    def remove_form_feeds(self, content: str) -> str:
        """Remove form feed characters"""
        # Remove \x0C (form feed) and its representation
        content = content.replace('\x0c', '')
        content = content.replace('\\x0C', '')
        return content

    def remove_orphaned_footnote_numbers(self, content: str) -> str:
        """Remove standalone number headers (orphaned footnote references)

        These appear as:
        ## 4
        some text

        ## 5
        more text

        They are footnote reference numbers being treated as markdown headers,
        creating nonsensical section breaks.
        """
        # Match: ## N (where N is 1-3 digits, standalone on line)
        # Don't match: ## Page N, ## Section N, ## Introduction, etc.
        # Only match pure numbers
        pattern = r'^##\s+\d{1,3}\s*$\n?'
        return re.sub(pattern, '', content, flags=re.MULTILINE)

    def extract_from_extracted_text(self, content: str) -> str:
        """Extract content from ### Extracted Text sections"""
        lines = content.split('\n')
        result_lines = []
        in_extracted = False
        in_code_block = False

        for line in lines:
            # Detect ### Extracted Text section
            if re.match(r'###\s+Extracted\s+Text', line):
                in_extracted = True
                continue

            # Handle code blocks
            if in_extracted:
                if line.strip() == '```':
                    if not in_code_block:
                        in_code_block = True
                    else:
                        in_code_block = False
                        in_extracted = False
                    continue

                if in_code_block:
                    result_lines.append(line)
            else:
                # Keep non-extracted-text content
                result_lines.append(line)

        return '\n'.join(result_lines)

    def normalize_whitespace(self, content: str) -> str:
        """Normalize excessive whitespace within lines (multiple spaces → single space)"""
        lines = content.split('\n')
        normalized_lines = []

        for line in lines:
            # Don't touch code blocks (lines starting with 4 spaces or tab) or empty lines
            if line.startswith('    ') or line.startswith('\t') or not line.strip():
                normalized_lines.append(line)
            else:
                # Normalize multiple spaces to single space (preserve structure)
                # But keep single leading/trailing spaces
                normalized = re.sub(r'  +', ' ', line)
                normalized_lines.append(normalized)

        return '\n'.join(normalized_lines)

    def remove_inappropriate_indentation(self, content: str) -> str:
        """Remove leading spaces that create unwanted code blocks

        PDF conversion often preserves indentation that becomes code blocks in markdown.
        We keep intentional code blocks (``` fenced) but remove accidental ones.
        """
        lines = content.split('\n')
        cleaned_lines = []
        in_fenced_code = False

        for line in lines:
            # Track fenced code blocks
            if line.strip().startswith('```'):
                in_fenced_code = not in_fenced_code
                cleaned_lines.append(line)
                continue

            # Keep fenced code blocks as-is
            if in_fenced_code:
                cleaned_lines.append(line)
                continue

            # Remove leading spaces from non-code lines (unless it's a list item)
            stripped = line.lstrip()
            if stripped and not stripped[0] in ['-', '*', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
                # Not a list item, remove indentation
                cleaned_lines.append(stripped)
            else:
                # Keep list items with their indentation
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    def clean_excessive_blank_lines(self, content: str) -> str:
        """Reduce excessive blank lines to max 2 consecutive"""
        # Replace 3+ newlines with 2
        return re.sub(r'\n{3,}', '\n\n', content)

    # ========================================================================
    # MARKER-SPECIFIC CLEANUP METHODS (for marker_single PDF converter)
    # ========================================================================

    def remove_html_anchors(self, content: str) -> str:
        """Remove HTML span anchors from marker output

        Removes: <span id="page-X-X"></span>
        These are PDF page reference anchors that don't work in markdown
        """
        return re.sub(r'<span\s+id="[^"]+"></span>\s*', '', content)

    def fix_pdf_anchor_links(self, content: str) -> str:
        """Fix broken markdown links with PDF page anchors

        Converts: [Text](#page-X-X) → Text (plain text)
        These PDF internal links don't work in markdown, so convert to plain text
        """
        return re.sub(r'\[([^\]]+)\]\(#page-\d+-\d+\)', r'\1', content)

    def fix_page_break_line_splits(self, content: str) -> str:
        """Join lines broken by PDF page breaks

        Fixes cases where marker splits sentences mid-phrase:
        - "banner of nihilist or rather of\n\nanarchist philosophy"
        - "And unfortunately for us,\n\nmovements are produced"

        Joins when line ends with continuation words or punctuation
        """
        # Pattern 1: Lines ending with comma before lowercase word
        # "for us,\n\nmovements" → "for us, movements"
        content = re.sub(r',\n\n+([a-z])', r', \1', content)

        # Pattern 2: Lines ending with preposition + paragraph break
        continuation_words = [
            'of', 'or', 'and', 'the', 'a', 'an', 'to', 'for',
            'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into',
            'toward', 'towards', 'upon', 'about'
        ]

        for word in continuation_words:
            # "word <preposition>\n\n<lowercase>" → "word <preposition> <lowercase>"
            pattern = rf'(\S+)\s+{word}\n\n+([a-z]\w*)'
            replacement = rf'\1 {word} \2'
            content = re.sub(pattern, replacement, content)

        # Pattern 3: General case - any word + paragraph break + lowercase
        # "entirely new\n\nform" → "entirely new form"
        # Only join if line doesn't end with sentence-ending punctuation
        content = re.sub(r'([a-z])\n\n+([a-z])', r'\1 \2', content)

        return content

    def fix_missing_spaces(self, content: str) -> str:
        """Fix missing spaces in text

        Common OCR/conversion errors:
        - "sentence.Next" → "sentence. Next"
        - "word,another" → "word, another"
        - "wordAnother" → "word Another"
        """
        # Fix missing space after period
        content = re.sub(r'\.([A-Z])', r'. \1', content)

        # Fix missing space after comma (but not in numbers like "1,000")
        content = re.sub(r',([a-z])', r', \1', content)

        # Fix words run together (lowercase directly followed by uppercase)
        # BUT preserve acronyms and intentional camelCase
        # Only fix if preceded by lowercase letter
        content = re.sub(r'([a-z])([A-Z][a-z])', r'\1 \2', content)

        return content

    def fix_broken_urls(self, content: str) -> str:
        """Fix URLs broken by space insertion

        Fixes: "https://example.com/some-pa ge" → "https://example.com/some-page"
        """
        # Find URLs with spaces and remove the spaces
        def fix_url_spaces(match):
            url = match.group(0)
            # Remove spaces within the URL
            fixed_url = url.replace(' ', '')
            return fixed_url

        # Pattern: URLs that may have spaces inserted
        content = re.sub(
            r'https?://[^\s<>"\)]+\s+[^\s<>"\)]+',
            fix_url_spaces,
            content
        )

        return content

    def fix_hyphenation_errors(self, content: str) -> str:
        """Fix missing hyphens in common compound words

        Converts: selfabnegation → self-abnegation
                  selflove → self-love

        Common in older texts where OCR joins hyphenated compounds
        """
        # Dictionary of common compound word fixes
        compounds = [
            ('selfabnegation', 'self-abnegation'),
            ('selflove', 'self-love'),
            ('selfinterest', 'self-interest'),
            ('selfdefense', 'self-defense'),
            ('selfsacrifice', 'self-sacrifice'),
            ('selfevident', 'self-evident'),
            ('selfrespect', 'self-respect'),
            ('wellbeing', 'well-being'),
            ('wellknown', 'well-known'),
        ]

        for wrong, right in compounds:
            # Case-insensitive replacement
            content = re.sub(rf'\b{wrong}\b', right, content, flags=re.IGNORECASE)

        return content

    # ========================================================================

    def is_section_header(self, line: str, next_line: str) -> bool:
        """
        Detect if line is likely a section header (from original cleanup_markdown.py)
        - Short line (< 50 chars) followed by blank line
        - Not already a header, list, or URL
        - Doesn't end with sentence punctuation
        - Not all lowercase
        """
        stripped = line.strip()

        # Must have content and be short
        if not stripped or len(stripped) >= 50:
            return False

        # Exclude if starts with these patterns
        if (stripped.startswith('#') or     # Already a header
            stripped.startswith('-') or      # List item
            stripped.startswith('•') or      # Bullet
            stripped.startswith('·') or      # Bullet
            stripped.startswith('http') or   # URL
            stripped.startswith('www.')):    # URL
            return False

        # Exclude if ends with sentence punctuation (likely wrapped paragraph)
        if stripped[-1] in '.,:;!?':
            return False

        # Exclude if all lowercase (unlikely to be a header)
        if stripped.islower():
            return False

        # Must be followed by blank line
        if next_line.strip() != '':
            return False

        # Passed all checks - likely a header
        return True

    def apply_smart_formatting(self, content: str) -> str:
        """Apply smart formatting (headers, bullets) - enhanced from original cleanup_markdown.py"""
        lines = content.split('\n')
        formatted_lines = []

        for i, line in enumerate(lines):
            next_line = lines[i + 1] if i + 1 < len(lines) else ''

            # Skip empty lines
            if not line.strip():
                formatted_lines.append(line)
                continue

            # Convert centered headers (15+ leading spaces, short text)
            leading_spaces = len(line) - len(line.lstrip())
            if leading_spaces >= 15 and len(line.strip()) < 60:
                formatted_lines.append(f"## {line.strip()}")
                continue

            # Section header detection (short line + blank after)
            if self.is_section_header(line, next_line):
                formatted_lines.append(f"## {line.strip()}")
                continue

            # Normalize bullet points
            stripped = line.lstrip()
            if stripped.startswith('•') or stripped.startswith('·') or stripped.startswith('−'):
                indent = ' ' * (len(line) - len(stripped))
                text = stripped[1:].lstrip()
                formatted_lines.append(f"{indent}- {text}")
                continue

            # Default: keep line as-is
            formatted_lines.append(line)

        return '\n'.join(formatted_lines)

    def clean_document_content(self, content: str) -> Tuple[str, Dict]:
        """
        Apply full cleanup pipeline to document content.
        Returns (cleaned_content, artifact_counts)
        """
        original_size = len(content)

        # Count artifacts before removal
        artifacts = {
            'page_views': len(re.findall(r'### Complete Page View', content)),
            'figures': len(re.findall(r'### Figures and Images', content)),
            'page_markers': len(re.findall(r'^## Page \d+', content, re.MULTILINE)),
            'form_feeds': content.count('\\x0C') + content.count('\x0c'),
            'metadata': len(re.findall(r'\*Converted from:', content))
        }

        # Apply cleanup pipeline
        content = self.remove_conversion_metadata(content)
        content = self.remove_complete_page_view(content)
        content = self.remove_figures_and_images(content)
        content = self.remove_page_markers(content)
        content = self.remove_orphaned_footnote_numbers(content)
        content = self.remove_form_feeds(content)
        content = self.extract_from_extracted_text(content)

        # Text flow normalization (NEW: Fix spacing and indentation issues)
        content = self.normalize_whitespace(content)
        content = self.remove_inappropriate_indentation(content)

        content = self.clean_excessive_blank_lines(content)
        content = self.apply_smart_formatting(content)
        content = self.apply_ocr_corrections(content)

        # Marker-specific cleanup (for marker_single PDF converter)
        content = self.remove_html_anchors(content)
        content = self.fix_pdf_anchor_links(content)
        content = self.fix_broken_urls(content)  # Before page break fixes
        content = self.fix_page_break_line_splits(content)
        content = self.fix_missing_spaces(content)
        content = self.fix_hyphenation_errors(content)

        # Final cleanup
        content = content.strip() + '\n'

        new_size = len(content)
        artifacts['bytes_saved'] = original_size - new_size
        artifacts['reduction_pct'] = (artifacts['bytes_saved'] / original_size * 100) if original_size > 0 else 0

        return content, artifacts

    def process_document(self, doc_id: int, idx: int, total: int, cursor, conn) -> bool:
        """Process a single document"""
        try:
            self.log(f"[{idx}/{total}] Processing document ID {doc_id}...", "INFO")

            # Fetch content
            cursor.execute(f"SELECT content FROM library.library_documents WHERE id = {doc_id}")
            row = cursor.fetchone()

            if not row or not row[0]:
                self.log(f"Failed to fetch content for ID {doc_id}", "ERROR")
                self.stats.failed += 1
                return False

            original_content = row[0]

            # Check if already clean
            if not any(marker in original_content for marker in [
                '### Complete Page View',
                '### Figures and Images',
                '### Figure:',
                '### Extracted Text',
                '*Converted from:'
            ]):
                self.log(f"  Already clean, skipping", "INFO")
                self.stats.already_clean += 1
                return True

            # Clean content
            cleaned_content, artifacts = self.clean_document_content(original_content)

            # Validate: Check for remaining artifacts (POST-CLEANUP VERIFICATION)
            remaining_artifacts = {
                'cpv': '### Complete Page View' in cleaned_content,
                'fig': '### Figure:' in cleaned_content,
                'orphan_nums': bool(re.search(r'^## \d{1,3}$', cleaned_content, re.MULTILINE))
            }
            if any(remaining_artifacts.values()):
                self.log(
                    f"  ⚠️  WARNING: Artifacts remain after cleanup: {remaining_artifacts}",
                    "WARN"
                )

            # Update statistics
            self.stats.complete_page_view += artifacts['page_views']
            self.stats.figures += artifacts['figures']
            self.stats.page_markers += artifacts['page_markers']
            self.stats.form_feeds += artifacts['form_feeds']
            self.stats.metadata += artifacts['metadata']
            self.stats.bytes_saved += artifacts['bytes_saved']

            # Update database (if not dry-run)
            if not self.config.get('dry_run'):
                cursor.execute(
                    "UPDATE library.library_documents SET content = %s, updated_at = NOW() WHERE id = %s",
                    (cleaned_content, doc_id)
                )
                conn.commit()

                self.log(
                    f"  ✓ Cleaned: {artifacts['reduction_pct']:.1f}% size reduction "
                    f"({len(original_content)}B → {len(cleaned_content)}B)",
                    "SUCCESS"
                )
            else:
                self.log(
                    f"  [DRY-RUN] Would reduce size by {artifacts['reduction_pct']:.1f}% "
                    f"({len(original_content)}B → {len(cleaned_content)}B)",
                    "INFO"
                )

            self.stats.cleaned += 1
            return True

        except Exception as e:
            self.log(f"Error processing document {doc_id}: {str(e)}", "ERROR")

            with open(self.failed_docs_file, 'a') as f:
                f.write(f"ID {doc_id}: {str(e)}\n")

            self.stats.failed += 1
            return False

    def process_file(self, input_path: str, output_path: str = None) -> int:
        """
        Process a single markdown file (file mode)

        Args:
            input_path: Path to input markdown file
            output_path: Path to output file (None = overwrite input)

        Returns:
            0 on success, 1 on failure
        """
        try:
            # Read input file
            self.log(f"Reading file: {input_path}", "INFO")
            with open(input_path, 'r', encoding='utf-8') as f:
                original_content = f.read()

            # Check if has any artifacts (pdftotext OR marker-specific)
            has_pdftotext_artifacts = any(marker in original_content for marker in [
                '### Complete Page View',
                '### Figures and Images',
                '### Figure:',
                '### Extracted Text',
                '*Converted from:'
            ])

            has_marker_artifacts = any([
                '<span' in original_content,  # HTML span anchors
                '#page-' in original_content,  # PDF page anchor links
                re.search(r'\w+\s+(of|or|and|to|for|in|at|by|with)\n\n+\w', original_content),  # Preposition page breaks
                re.search(r',\n\n+[a-z]', original_content),  # Comma + page break
                re.search(r'\.\w', original_content),  # Missing space after period
                re.search(r',[a-z]', original_content),  # Missing space after comma (but not in file, this will catch some)
                re.search(r'[a-z][A-Z][a-z]', original_content),  # Words run together (camelCase)
                re.search(r'https?://[^\s]+\s+[^\s]+', original_content)  # Broken URLs with spaces
            ])

            if not has_pdftotext_artifacts and not has_marker_artifacts:
                self.log("File is already clean, no artifacts found", "INFO")
                self.stats.already_clean = 1
                self.stats.total = 1
                return 0

            # Clean content
            artifact_types = []
            if has_pdftotext_artifacts:
                artifact_types.append("pdftotext artifacts")
            if has_marker_artifacts:
                artifact_types.append("marker artifacts")

            self.log(f"Cleaning content ({', '.join(artifact_types)})...", "INFO")
            cleaned_content, artifacts = self.clean_document_content(original_content)

            # Update statistics
            self.stats.total = 1
            self.stats.cleaned = 1
            self.stats.complete_page_view = artifacts['page_views']
            self.stats.figures = artifacts['figures']
            self.stats.page_markers = artifacts['page_markers']
            self.stats.form_feeds = artifacts['form_feeds']
            self.stats.metadata = artifacts['metadata']
            self.stats.bytes_saved = artifacts['bytes_saved']

            # Determine output path
            if output_path is None:
                output_path = input_path
                self.log(f"Output path not specified, overwriting input file", "INFO")

            # Write output file
            self.log(f"Writing cleaned content to: {output_path}", "INFO")
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_content)

            self.log(
                f"✓ Cleaned: {artifacts['reduction_pct']:.1f}% size reduction "
                f"({len(original_content)}B → {len(cleaned_content)}B)",
                "SUCCESS"
            )

            # Show statistics
            self.show_file_statistics(artifacts)

            return 0

        except FileNotFoundError:
            self.log(f"Input file not found: {input_path}", "ERROR")
            self.stats.failed = 1
            return 1
        except Exception as e:
            self.log(f"Error processing file: {str(e)}", "ERROR")
            self.stats.failed = 1
            return 1

    def show_file_statistics(self, artifacts: Dict):
        """Display statistics for file mode"""
        total_artifacts = (
            artifacts['page_views'] +
            artifacts['figures'] +
            artifacts['page_markers'] +
            artifacts['form_feeds'] +
            artifacts['metadata']
        )

        mb_saved = artifacts['bytes_saved'] / 1024 / 1024

        print("\n" + "=" * 80)
        print("CLEANUP SUMMARY")
        print("=" * 80)
        print("Artifacts removed:")
        print(f"  - Complete Page View sections:  {artifacts['page_views']}")
        print(f"  - Figures and Images sections:  {artifacts['figures']}")
        print(f"  - Page markers:                 {artifacts['page_markers']}")
        print(f"  - Form feeds:                   {artifacts['form_feeds']}")
        print(f"  - Conversion metadata:          {artifacts['metadata']}")
        print()
        print(f"Total artifacts:      {total_artifacts}")
        print()
        print(f"Size reduction:       {artifacts['reduction_pct']:.1f}%")
        print(f"Bytes saved:          {mb_saved:.2f} MB")
        print()
        print(f"✅ Cleanup complete")
        print(f"📝 Detailed log: {self.log_file}")

        if not self.skip_ocr and self.stats.ocr_fixed > 0:
            print(f"📝 OCR corrections: {self.ocr_log_file}")

        print("=" * 80 + "\n")

    def show_statistics(self):
        """Display final statistics"""
        total_artifacts = (
            self.stats.complete_page_view +
            self.stats.figures +
            self.stats.page_markers +
            self.stats.form_feeds +
            self.stats.metadata
        )

        mb_saved = self.stats.bytes_saved / 1024 / 1024

        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total processed:      {self.stats.total}")
        print(f"✓ Cleaned:            {self.stats.cleaned}")
        print(f"⊘ Already clean:      {self.stats.already_clean}")
        print(f"✗ Failed:             {self.stats.failed}")
        print()
        print("Artifacts removed:")
        print(f"  - Complete Page View sections:  {self.stats.complete_page_view}")
        print(f"  - Figures and Images sections:  {self.stats.figures}")
        print(f"  - Page markers:                 {self.stats.page_markers}")
        print(f"  - Form feeds:                   {self.stats.form_feeds}")
        print(f"  - Conversion metadata:          {self.stats.metadata}")
        print()
        print(f"Total artifacts:      {total_artifacts}")
        print()

        if not self.skip_ocr:
            print("OCR corrections:")
            print(f"  - Words fixed:                  {self.stats.ocr_fixed}")
            print(f"  - Flagged for review:           {self.stats.ocr_flagged}")
            print()

        print("Database changes:")
        print(f"  - Documents updated:            {self.stats.cleaned}")
        print(f"  - Total bytes saved:            {mb_saved:.2f} MB")
        print()
        print(f"✅ Cleanup complete")
        print(f"📝 Detailed log: {self.log_file}")

        if not self.skip_ocr and self.stats.ocr_fixed > 0:
            print(f"📝 OCR corrections: {self.ocr_log_file}")

        if self.stats.failed > 0:
            print(f"📝 Failed documents: {self.failed_docs_file}")

        print("=" * 80 + "\n")

    def run(self):
        """Main execution method"""
        # Connect to database
        try:
            conn = psycopg2.connect(
                host=self.config.get('db_host', 'localhost'),
                port=self.config.get('db_port', 5432),
                dbname=self.config.get('db_name', 'veritable_games'),
                user=self.config.get('db_user', 'postgres'),
                password=self.config.get('db_password', 'postgres')
            )
            cursor = conn.cursor()
            self.log("Connected to database", "SUCCESS")
        except Exception as e:
            self.log(f"Database connection failed: {e}", "ERROR")
            return 1

        # Get document IDs to process
        self.log("Fetching documents with PDF artifacts...", "INFO")

        limit_clause = f"LIMIT {self.config.get('limit')}" if self.config.get('limit') else ""

        cursor.execute(f"""
            SELECT id
            FROM library.library_documents
            WHERE reconversion_status IN ('ready_for_reconversion', 'needs_source', 'reconverted')
            AND (
                content LIKE '%### Complete Page View%'
                OR content LIKE '%### Figures and Images%'
                OR content LIKE '%### Figure:%'
                OR content LIKE '%### Extracted Text%'
                OR content LIKE '%*Converted from:%'
            )
            ORDER BY id
            {limit_clause}
        """)

        doc_ids = [row[0] for row in cursor.fetchall()]
        self.stats.total = len(doc_ids)

        if self.stats.total == 0:
            self.log("No documents found needing cleanup!", "SUCCESS")
            return 0

        self.log(f"Found {self.stats.total} documents to process", "SUCCESS")

        # Create backup if not dry-run
        if not self.config.get('dry_run'):
            self.log("Skipping backup (manual backup already created)", "WARN")

        # Process documents
        for idx, doc_id in enumerate(doc_ids, 1):
            self.process_document(doc_id, idx, self.stats.total, cursor, conn)

            # Commit batch
            if idx % self.config.get('batch_size', 100) == 0:
                if not self.config.get('dry_run'):
                    conn.commit()
                    self.log(f"Committed batch at {idx}/{self.stats.total}", "INFO")

        # Final commit
        if not self.config.get('dry_run'):
            conn.commit()

        # Close connection
        cursor.close()
        conn.close()

        # Show statistics
        self.show_statistics()

        return 0 if self.stats.failed == 0 else 1

def main():
    parser = argparse.ArgumentParser(
        description='Clean PDF-to-Markdown conversion artifacts from database documents or files'
    )

    # File mode arguments
    parser.add_argument(
        '--file',
        type=str,
        metavar='PATH',
        help='Process a single markdown file (file mode) instead of database'
    )
    parser.add_argument(
        '--output',
        type=str,
        metavar='PATH',
        help='Output path for file mode (defaults to overwriting input)'
    )

    # Database mode arguments
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without updating database (database mode only)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        metavar='N',
        help='Process only N documents (database mode only)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        metavar='N',
        help='Process N documents per batch (database mode only, default: 100)'
    )
    parser.add_argument(
        '--stats',
        action='store_true',
        help='Show statistics only, no processing (NOT IMPLEMENTED)'
    )
    parser.add_argument(
        '--db-host',
        default='localhost',
        help='Database host (default: localhost)'
    )
    parser.add_argument(
        '--db-port',
        type=int,
        default=5432,
        help='Database port (default: 5432)'
    )
    parser.add_argument(
        '--db-name',
        default='veritable_games',
        help='Database name (default: veritable_games)'
    )
    parser.add_argument(
        '--db-user',
        default='postgres',
        help='Database user (default: postgres)'
    )
    parser.add_argument(
        '--db-password',
        default='postgres',
        help='Database password (default: postgres)'
    )

    # Common arguments
    parser.add_argument(
        '--skip-ocr',
        action='store_true',
        help='Skip OCR correction, structural cleanup only'
    )
    parser.add_argument(
        '--log',
        default=f'/tmp/cleanup_artifacts_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log',
        metavar='FILE',
        help='Write detailed log to FILE'
    )

    args = parser.parse_args()

    # Detect mode
    file_mode = args.file is not None

    # Build config
    config = {
        'skip_ocr': args.skip_ocr,
        'log_file': args.log,
    }

    # Add database-specific config if in database mode
    if not file_mode:
        config.update({
            'dry_run': args.dry_run,
            'limit': args.limit,
            'batch_size': args.batch_size,
            'stats_only': args.stats,
            'db_host': args.db_host,
            'db_port': args.db_port,
            'db_name': args.db_name,
            'db_user': args.db_user,
            'db_password': args.db_password
        })

    # Print header
    print("=" * 80)
    print("PDF Artifact Cleanup Script (Python)")
    print("=" * 80)

    if file_mode:
        print(f"Mode: FILE")
        print(f"Input: {args.file}")
        print(f"Output: {args.output if args.output else args.file + ' (overwrite)'}")
        print(f"OCR correction: {'Disabled' if config['skip_ocr'] else 'Enabled'}")
    else:
        print(f"Mode: {'DRY-RUN' if config['dry_run'] else 'LIVE'}")
        print(f"Target: library.library_documents (PostgreSQL)")
        print(f"Database: {config['db_name']} @ {config['db_host']}:{config['db_port']}")
        print(f"Batch size: {config['batch_size']}")
        print(f"OCR correction: {'Disabled' if config['skip_ocr'] else 'Enabled'}")
        if config['limit']:
            print(f"Limit: {config['limit']} documents")

    print(f"Log file: {config['log_file']}")
    print("=" * 80)
    print()

    # Run cleaner
    cleaner = PDFArtifactCleaner(config)

    if file_mode:
        return cleaner.process_file(args.file, args.output)
    else:
        return cleaner.run()

if __name__ == '__main__':
    sys.exit(main())
