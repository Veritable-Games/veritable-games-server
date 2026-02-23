#!/usr/bin/env python3
"""
Issue Detectors Module
Identifies metadata quality issues in documents
"""

import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional


class IssueDetector:
    """Detects metadata quality issues in documents"""

    PLACEHOLDER_AUTHORS = {
        'unknown', 'n/a', 'anonymous', 'author unknown', 'no author',
        'various authors', 'various', 'multiple authors', 'collective',
        'libcom.org', 'library', 'archive'
    }

    FUTURE_YEAR_THRESHOLD = 2026  # Current year
    MINIMUM_CONTENT_LENGTH = 100   # Minimum word count

    def __init__(self):
        self.issues = []
        self.quality_score = 100  # Start at perfect, deduct for each issue

    def reset(self):
        """Reset for next document"""
        self.issues = []
        self.quality_score = 100

    def check_author(self, author: Optional[str]) -> bool:
        """
        Check for author-related issues
        Deducts up to 40 points
        Returns True if issue found
        """
        if not author or not author.strip():
            self.issues.append({
                'type': 'missing_author',
                'severity': 'critical',
                'message': 'Author field is empty'
            })
            self.quality_score -= 40
            return True

        author_lower = author.lower().strip()

        # Check for placeholder values
        if author_lower in self.PLACEHOLDER_AUTHORS:
            self.issues.append({
                'type': 'placeholder_author',
                'severity': 'critical',
                'message': f'Author is placeholder: "{author}"'
            })
            self.quality_score -= 40
            return True

        # Check for partial/truncated authors
        if len(author_lower) <= 4 and author_lower not in ['marx', 'lenin', 'mao', 'tse']:
            self.issues.append({
                'type': 'truncated_author',
                'severity': 'high',
                'message': f'Author appears truncated: "{author}" (too short)'
            })
            self.quality_score -= 25
            return True

        # Check for initial-only authors (likely truncated)
        if re.match(r'^[A-Z]\.?\s+[A-Z]\.?$', author):
            self.issues.append({
                'type': 'initials_only_author',
                'severity': 'medium',
                'message': f'Author appears to be initials only: "{author}"'
            })
            self.quality_score -= 15
            return True

        return False

    def check_publication_date(self, pub_date: Optional[str]) -> bool:
        """
        Check for publication date-related issues
        Deducts up to 30 points
        Returns True if issue found
        """
        if not pub_date or not str(pub_date).strip():
            self.issues.append({
                'type': 'missing_publication_date',
                'severity': 'critical',
                'message': 'Publication date is empty'
            })
            self.quality_score -= 30
            return True

        pub_date_str = str(pub_date).strip()

        # Try to extract year
        year_match = re.search(r'\b(19|20)\d{2}\b', pub_date_str)

        if not year_match:
            self.issues.append({
                'type': 'invalid_date_format',
                'severity': 'critical',
                'message': f'Publication date has no valid year: "{pub_date_str}"'
            })
            self.quality_score -= 30
            return True

        year = int(year_match.group(0))

        # Check for future dates
        if year > self.FUTURE_YEAR_THRESHOLD:
            self.issues.append({
                'type': 'future_publication_date',
                'severity': 'high',
                'message': f'Publication year is in future: {year}'
            })
            self.quality_score -= 25
            return True

        # Check for unreasonable past dates (before printing press)
        if year < 1440:
            self.issues.append({
                'type': 'impossible_publication_date',
                'severity': 'high',
                'message': f'Publication year predates printing: {year}'
            })
            self.quality_score -= 25
            return True

        # Check for placeholder years
        if pub_date_str == '2025' or pub_date_str == str(self.FUTURE_YEAR_THRESHOLD):
            self.issues.append({
                'type': 'placeholder_publication_date',
                'severity': 'high',
                'message': f'Publication date appears to be placeholder: {pub_date_str}'
            })
            self.quality_score -= 20
            return True

        return False

    def check_title(self, title: Optional[str]) -> bool:
        """
        Check for title-related issues
        Deducts up to 20 points
        Returns True if issue found
        """
        if not title or not str(title).strip():
            self.issues.append({
                'type': 'missing_title',
                'severity': 'critical',
                'message': 'Title is empty'
            })
            self.quality_score -= 20
            return True

        title_str = str(title).strip()

        # Check for Wikipedia-style titles
        if title_str.endswith('(Wikipedia)') or title_str.endswith('(wiki)'):
            self.issues.append({
                'type': 'wiki_suffix_in_title',
                'severity': 'medium',
                'message': 'Title has Wikipedia/wiki suffix'
            })
            self.quality_score -= 10
            return True

        # Check for author in title (common PDF conversion artifact)
        if re.search(r'^[A-Z][a-z]+,?\s+[A-Z]', title_str):
            # Looks like "Author, Title" pattern
            self.issues.append({
                'type': 'author_in_title',
                'severity': 'medium',
                'message': 'Title may contain author name'
            })
            self.quality_score -= 8
            return True

        # Check for truncation indicators
        if title_str.endswith('...') or title_str.endswith('…'):
            self.issues.append({
                'type': 'truncated_title',
                'severity': 'medium',
                'message': 'Title appears truncated (ends with ...)'
            })
            self.quality_score -= 10
            return True

        # Check for very long titles (may indicate PDF artifact)
        if len(title_str) > 200:
            self.issues.append({
                'type': 'excessively_long_title',
                'severity': 'low',
                'message': f'Title is very long ({len(title_str)} chars)'
            })
            self.quality_score -= 5
            return True

        return False

    def check_content_quality(self, content: Optional[str]) -> bool:
        """
        Check for content-related issues
        Deducts up to 10 points
        Returns True if issue found
        """
        if not content:
            self.issues.append({
                'type': 'no_content',
                'severity': 'critical',
                'message': 'Document has no content'
            })
            self.quality_score -= 10
            return True

        # Count words (rough approximation)
        word_count = len(content.split())

        if word_count < self.MINIMUM_CONTENT_LENGTH:
            self.issues.append({
                'type': 'insufficient_content',
                'severity': 'high',
                'message': f'Content too short ({word_count} words, minimum {self.MINIMUM_CONTENT_LENGTH})'
            })
            self.quality_score -= 10
            return True

        return False

    def check_formatting_artifacts(self, content: Optional[str]) -> List[Dict[str, Any]]:
        """
        Check for PDF conversion artifacts in content
        Returns list of artifacts found (not included in quality score)
        """
        artifacts = []

        if not content:
            return artifacts

        # Check for page markers
        page_markers = re.findall(r'^#{1,6}\s+Page\s+\d+', content, re.MULTILINE | re.IGNORECASE)
        if page_markers:
            artifacts.append({
                'type': 'page_markers',
                'count': len(page_markers),
                'message': f'Found {len(page_markers)} page markers'
            })

        # Check for image references
        image_refs = re.findall(r'!\[.*?\]\(.*?\.(?:png|jpg|jpeg|gif|webp)\)', content, re.IGNORECASE)
        if image_refs:
            artifacts.append({
                'type': 'image_references',
                'count': len(image_refs),
                'message': f'Found {len(image_refs)} image references'
            })

        # Check for excessive code blocks (prose wrapped in ```)
        code_blocks = re.findall(r'^```[\s\S]*?^```', content, re.MULTILINE)
        if code_blocks:
            # Only flag if they seem to be prose, not actual code
            for block in code_blocks:
                lines = block.split('\n')[1:-1]  # Skip fence lines
                line_count = len(lines)
                # If code block is >10 lines, might be prose wrapped in code
                if line_count > 10 and not self._looks_like_code(block):
                    artifacts.append({
                        'type': 'prose_in_code_block',
                        'count': 1,
                        'message': 'Found prose-like content wrapped in code block'
                    })
                    break

        # Check for HTML anchors
        html_anchors = re.findall(r'<span id=["\'].*?["\']>', content)
        if html_anchors:
            artifacts.append({
                'type': 'html_anchors',
                'count': len(html_anchors),
                'message': f'Found {len(html_anchors)} HTML anchor elements'
            })

        # Check for excessive blank lines (>2 consecutive)
        excessive_blanks = re.findall(r'\n\n\n+', content)
        if excessive_blanks:
            artifacts.append({
                'type': 'excessive_blank_lines',
                'count': len(excessive_blanks),
                'message': f'Found {len(excessive_blanks)} sections with excessive blank lines'
            })

        return artifacts

    def _looks_like_code(self, text: str) -> bool:
        """Heuristic to detect if text looks like actual code"""
        code_indicators = [
            r'def\s+\w+\s*\(',      # Python function
            r'function\s+\w+\s*\(',  # JavaScript function
            r'class\s+\w+',          # Class definition
            r'import\s+\w+',         # Import statement
            r'package\s+\w+',        # Package statement
            r'\s*\{\s*$',            # Brace on line
            r'^\s*\}',               # Closing brace
            r'=>',                   # Arrow function
            r'\$\{.*?\}',            # Template literal
        ]

        for pattern in code_indicators:
            if re.search(pattern, text, re.MULTILINE):
                return True

        return False

    def analyze(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a document for metadata quality issues

        Args:
            document: Dict with keys: title, author, publication_date, content

        Returns:
            Dict with quality_score, issues, artifacts
        """
        self.reset()

        # Check each field
        self.check_author(document.get('author'))
        self.check_publication_date(document.get('publication_date'))
        self.check_title(document.get('title'))
        self.check_content_quality(document.get('content'))

        # Check for formatting artifacts (doesn't affect score)
        artifacts = self.check_formatting_artifacts(document.get('content'))

        # Ensure quality score is within bounds
        self.quality_score = max(0, min(100, self.quality_score))

        return {
            'quality_score': self.quality_score,
            'issues': self.issues,
            'artifacts': artifacts,
            'issue_count': len(self.issues),
            'artifact_count': len(artifacts),
            'total_problems': len(self.issues) + len(artifacts)
        }


def categorize_by_priority(quality_score: int) -> str:
    """Categorize documents by quality score"""
    if quality_score <= 39:
        return 'CRITICAL'
    elif quality_score <= 59:
        return 'POOR'
    elif quality_score <= 79:
        return 'GOOD'
    else:
        return 'EXCELLENT'


def get_priority_counts(scores: List[int]) -> Dict[str, int]:
    """Get count of documents in each priority category"""
    return {
        'CRITICAL': len([s for s in scores if s <= 39]),
        'POOR': len([s for s in scores if 40 <= s <= 59]),
        'GOOD': len([s for s in scores if 60 <= s <= 79]),
        'EXCELLENT': len([s for s in scores if s >= 80]),
    }


if __name__ == '__main__':
    # Test the detector
    detector = IssueDetector()

    test_doc = {
        'title': 'Test Document',
        'author': 'Unknown',
        'publication_date': '2025',
        'content': 'This is a test document with some content.'
    }

    result = detector.analyze(test_doc)
    print(f"Quality Score: {result['quality_score']}")
    print(f"Issues: {len(result['issues'])}")
    for issue in result['issues']:
        print(f"  - {issue['type']}: {issue['message']}")
