#!/usr/bin/env python3
"""
Collection-Specific Issue Detectors
Extends base IssueDetector for each collection's unique characteristics
"""

import re
from typing import List, Dict, Any, Optional
from issue_detectors import IssueDetector


class YouTubeIssueDetector(IssueDetector):
    """YouTube transcript-specific issue detection"""

    def __init__(self):
        super().__init__()
        self.min_line_length = 200  # Threshold for "wall of text"

    def check_paragraph_separation(self, content: Optional[str]) -> bool:
        """Check if transcript has poor paragraph separation (wall of text)"""
        if not content:
            self.issues.append({
                'type': 'empty_transcript',
                'severity': 'critical',
                'message': 'Transcript is empty'
            })
            self.quality_score -= 50
            return True

        lines = content.split('\n')
        if not lines:
            return True

        avg_line_length = sum(len(l) for l in lines) / len(lines)

        if avg_line_length > self.min_line_length:
            self.issues.append({
                'type': 'poor_paragraph_separation',
                'severity': 'high',
                'message': f'Lines very long ({avg_line_length:.0f} chars avg) - wall of text'
            })
            self.quality_score -= 20
            return True

        return False

    def check_speaker_identification(self, content: Optional[str]) -> bool:
        """Check if transcript identifies speakers"""
        if not content:
            return False

        # Look for speaker labels like "Speaker: text" or "John: text"
        speaker_pattern = r'^\w+[\s\w]*:'
        speakers = re.findall(speaker_pattern, content, re.MULTILINE)

        if not speakers:
            self.issues.append({
                'type': 'missing_speaker_identification',
                'severity': 'medium',
                'message': 'No speaker labels detected (format: "Speaker: text")'
            })
            self.quality_score -= 15
            return True

        return False

    def check_transcript_completeness(self, content: Optional[str]) -> bool:
        """Check for transcript incompleteness markers"""
        if not content:
            return False

        incomplete_markers = [
            '[Music]', '[Applause]', '[Laughter]', '[inaudible]',
            '(incomplete)', '(truncated)', '(cut off)'
        ]

        incomplete_count = sum(1 for m in incomplete_markers if m.lower() in content.lower())

        if incomplete_count > 5:
            self.issues.append({
                'type': 'incomplete_transcript',
                'severity': 'high',
                'message': f'Transcript appears incomplete ({incomplete_count} markers found)'
            })
            self.quality_score -= 25
            return True

        return False

    def check_youtube_metadata(self, doc: Dict[str, Any]) -> bool:
        """Check YouTube-specific metadata"""
        issues_found = False

        # Check channel name
        if not doc.get('channel') or not str(doc.get('channel')).strip():
            self.issues.append({
                'type': 'missing_channel_name',
                'severity': 'high',
                'message': 'Channel name is empty (becomes author)'
            })
            self.quality_score -= 30
            issues_found = True

        # Check publish date
        if not doc.get('publish_date') or not str(doc.get('publish_date')).strip():
            self.issues.append({
                'type': 'missing_video_date',
                'severity': 'high',
                'message': 'Video publish date is missing'
            })
            self.quality_score -= 30
            issues_found = True

        return issues_found

    def analyze_youtube_transcript(self, transcript: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive YouTube transcript analysis"""
        self.reset()

        # Basic metadata
        self.check_youtube_metadata(transcript)

        # Content quality
        content = transcript.get('content', '')
        self.check_paragraph_separation(content)
        self.check_speaker_identification(content)
        self.check_transcript_completeness(content)

        # Standard checks
        self.check_content_quality(content)

        self.quality_score = max(0, min(100, self.quality_score))

        return {
            'quality_score': self.quality_score,
            'issues': self.issues,
            'transcript_type': 'YouTube',
            'issues_count': len(self.issues)
        }


class MarxistIssueDetector(IssueDetector):
    """Marxist.org document-specific issue detection"""

    GENERIC_AUTHORS = {
        'unknown', 'anonymous', 'author unknown', 'various', 'multiple',
        'collective', 'archive', 'marxists.org', 'web'
    }

    def check_marxist_author(self, author: Optional[str]) -> bool:
        """Check Marxist-specific author issues"""
        if not author or not str(author).strip():
            self.issues.append({
                'type': 'missing_marxist_author',
                'severity': 'critical',
                'message': 'Author not extracted from marxists.org'
            })
            self.quality_score -= 40
            return True

        author_lower = str(author).lower().strip()

        # Check for generic/placeholder authors (common in Marxist docs)
        if author_lower in self.GENERIC_AUTHORS:
            self.issues.append({
                'type': 'generic_marxist_author',
                'severity': 'high',
                'message': f'Author appears generic: "{author}"'
            })
            self.quality_score -= 20
            return True

        return False

    def check_marxist_category(self, category: Optional[str]) -> bool:
        """Check if document has category/section classification"""
        if not category or not str(category).strip():
            self.issues.append({
                'type': 'missing_marxist_category',
                'severity': 'medium',
                'message': 'Document category/section not extracted'
            })
            self.quality_score -= 15
            return True

        return False

    def detect_wikipedia_artifacts(self, content: Optional[str]) -> List[Dict]:
        """Detect Wikipedia import artifacts (common in Marxist imports)"""
        artifacts = []

        if not content:
            return artifacts

        # Wikipedia table markup
        if '{|' in content or '|}' in content:
            artifacts.append({
                'type': 'wikipedia_table_markup',
                'message': 'Contains Wikipedia table markup',
                'severity': 'medium'
            })

        # Wikipedia infobox
        if '{{Infobox' in content or '{{infobox' in content.lower():
            artifacts.append({
                'type': 'wikipedia_infobox',
                'message': 'Wikipedia infobox detected',
                'severity': 'medium'
            })

        # Wikipedia categories
        wikipedia_cats = re.findall(r'\[\[Category:[^\]]+\]\]', content)
        if wikipedia_cats:
            artifacts.append({
                'type': 'wikipedia_categories',
                'message': f'Found {len(wikipedia_cats)} Wikipedia category links',
                'severity': 'low'
            })

        # Wikipedia links
        wikipedia_links = re.findall(r'\[\[w:.*?\]\]', content)
        if wikipedia_links:
            artifacts.append({
                'type': 'wikipedia_links',
                'message': f'Found {len(wikipedia_links)} Wikipedia links',
                'severity': 'low'
            })

        return artifacts

    def check_language(self, language: Optional[str]) -> bool:
        """Check if language is identified"""
        if not language or not str(language).strip():
            self.issues.append({
                'type': 'missing_language',
                'severity': 'low',
                'message': 'Document language not identified'
            })
            self.quality_score -= 5
            return True

        return False

    def analyze_marxist_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive Marxist document analysis"""
        self.reset()

        # Marxist-specific checks
        self.check_marxist_author(doc.get('author'))
        self.check_marxist_category(doc.get('category'))
        self.check_language(doc.get('language'))

        # Standard checks
        self.check_title(doc.get('title'))
        self.check_publication_date(doc.get('publication_date'))
        self.check_content_quality(doc.get('content'))

        # Wikipedia artifacts (tracked separately)
        artifacts = self.detect_wikipedia_artifacts(doc.get('content'))

        self.quality_score = max(0, min(100, self.quality_score))

        return {
            'quality_score': self.quality_score,
            'issues': self.issues,
            'artifacts': artifacts,
            'collection_type': 'Marxist',
            'issues_count': len(self.issues),
            'artifact_count': len(artifacts)
        }


class AnarchistIssueDetector(IssueDetector):
    """Anarchist Library validation (light audit)"""

    def check_language_consistency(self, declared_language: str, content: str) -> bool:
        """Verify declared language matches content"""
        if not declared_language or not content:
            return False

        # Simple heuristic: check first 100 words for language patterns
        first_100_words = ' '.join(content.split()[:100])

        # Map language codes to expected patterns
        language_patterns = {
            'en': r'\b(the|and|a|to|of|in|is|for|that|it)\b',
            'fr': r'\b(le|la|et|de|un|une|à|est|pour|qu|qui)\b',
            'es': r'\b(el|la|y|de|un|una|a|es|para|que|que)\b',
            'de': r'\b(der|die|das|und|in|ist|zu|mit|von|nicht)\b',
            'it': r'\b(il|la|e|di|un|una|a|è|per|che|da)\b',
        }

        # Only check if we have pattern for declared language
        if declared_language.lower() not in language_patterns:
            return False

        pattern = language_patterns[declared_language.lower()]
        matches = len(re.findall(pattern, first_100_words, re.IGNORECASE))

        # If very few matches, language might be wrong
        if matches < 10:
            self.issues.append({
                'type': 'language_mismatch',
                'severity': 'medium',
                'message': f'Declared language "{declared_language}" may not match content'
            })
            self.quality_score -= 10
            return True

        return False

    def check_category_consistency(self, categories: List[str], content: str) -> bool:
        """Verify categories match content"""
        if not categories or not content:
            return False

        issues_found = False

        # Extract keywords from content (first 500 words)
        content_sample = ' '.join(content.split()[:500]).lower()

        for category in categories:
            # Check if category appears in content
            if category.lower() not in content_sample:
                self.issues.append({
                    'type': 'category_mismatch',
                    'severity': 'low',
                    'message': f'Category "{category}" not found in content'
                })
                self.quality_score -= 3
                issues_found = True

        return issues_found

    def check_formatting_consistency(self, content: str) -> bool:
        """Check formatting is consistent with Markdown standards"""
        if not content:
            return False

        issues_found = False

        # Count different header styles
        markdown_headers = len(re.findall(r'^#+\s', content, re.MULTILINE))
        html_headers = len(re.findall(r'<h[1-6]', content, re.IGNORECASE))
        text_headers = len(re.findall(r'^[_=]+$', content, re.MULTILINE))

        total_headers = markdown_headers + html_headers + text_headers

        if total_headers > 0:
            # Anarchist Library standard: Markdown format
            if html_headers > 0 or text_headers > 0:
                self.issues.append({
                    'type': 'non_markdown_headers',
                    'severity': 'low',
                    'message': f'Uses {html_headers} HTML + {text_headers} text headers (prefer Markdown)'
                })
                self.quality_score -= 5
                issues_found = True

        return issues_found

    def analyze_anarchist_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive Anarchist document validation (light)"""
        self.reset()

        # Anarchist-specific checks
        language = doc.get('language', '')
        content = doc.get('content', '')
        categories = doc.get('categories', [])

        self.check_language_consistency(language, content)
        self.check_category_consistency(categories, content)
        self.check_formatting_consistency(content)

        # Standard quality checks (but lighter than other collections)
        if content:
            word_count = len(content.split())
            if word_count < 100:
                self.issues.append({
                    'type': 'insufficient_content',
                    'severity': 'medium',
                    'message': f'Very short content ({word_count} words)'
                })
                self.quality_score -= 10

        self.quality_score = max(0, min(100, self.quality_score))

        return {
            'quality_score': self.quality_score,
            'issues': self.issues,
            'collection_type': 'Anarchist',
            'issues_count': len(self.issues),
            'validation_type': 'consistency'
        }


class LibraryIssueDetector(IssueDetector):
    """Library collection (PDF reconversions) enhanced detection"""

    def check_source_tracking(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Check if document source is tracked"""
        sources = []

        # Try to identify original source
        title = doc.get('title', '').lower()
        author = doc.get('author', '').lower()
        content_sample = doc.get('content', '')[:1000].lower()

        # Heuristic: Check if this might be from Anarchist Library
        anarchist_indicators = [
            'anarchist', 'liberty', 'egoist', 'syndicalist',
            'kropotkin', 'goldman', 'bakunin', 'proudhon'
        ]

        anarchist_score = sum(
            1 for indicator in anarchist_indicators
            if indicator in title or indicator in author
        )

        if anarchist_score >= 2:
            sources.append({
                'likely_source': 'anarchist_library',
                'confidence': 0.80 if anarchist_score >= 2 else 0.60
            })

        # Heuristic: Check if from Marxists.org
        marxist_indicators = ['marx', 'lenin', 'trotsky', 'mao', 'stalin']
        marxist_score = sum(
            1 for indicator in marxist_indicators
            if indicator in title or indicator in author
        )

        if marxist_score >= 1:
            sources.append({
                'likely_source': 'marxists_org',
                'confidence': 0.70
            })

        return {
            'likely_sources': sources,
            'needs_source_verification': len(sources) > 0
        }

    def analyze_library_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive Library document analysis"""
        self.reset()

        # Standard checks (as in original)
        self.check_author(doc.get('author'))
        self.check_publication_date(doc.get('publication_date'))
        self.check_title(doc.get('title'))
        self.check_content_quality(doc.get('content'))

        # Library-specific: source tracking
        source_info = self.check_source_tracking(doc)

        # Formatting artifacts
        artifacts = self.check_formatting_artifacts(doc.get('content'))

        self.quality_score = max(0, min(100, self.quality_score))

        return {
            'quality_score': self.quality_score,
            'issues': self.issues,
            'artifacts': artifacts,
            'collection_type': 'Library',
            'likely_sources': source_info.get('likely_sources', []),
            'issues_count': len(self.issues),
            'artifact_count': len(artifacts)
        }


def get_detector_for_collection(collection: str) -> IssueDetector:
    """Get appropriate detector for collection"""
    detectors = {
        'library': LibraryIssueDetector,
        'anarchist': AnarchistIssueDetector,
        'youtube': YouTubeIssueDetector,
        'marxist': MarxistIssueDetector,
    }

    detector_class = detectors.get(collection.lower(), IssueDetector)
    return detector_class()


if __name__ == '__main__':
    # Test each detector
    print("Testing Collection-Specific Detectors\n")

    # Test YouTube
    print("=" * 60)
    print("YOUTUBE DETECTOR TEST")
    print("=" * 60)
    yt_detector = YouTubeIssueDetector()
    yt_doc = {
        'channel': 'Test Channel',
        'publish_date': '2020-01-01',
        'content': 'Speaker One: This is a test\nSpeaker Two: This is a response\n\n[00:15:23] Speaker One: More content'
    }
    result = yt_detector.analyze_youtube_transcript(yt_doc)
    print(f"Quality Score: {result['quality_score']}")
    print(f"Issues: {result['issues']}\n")

    # Test Marxist
    print("=" * 60)
    print("MARXIST DETECTOR TEST")
    print("=" * 60)
    marxist_detector = MarxistIssueDetector()
    marxist_doc = {
        'author': 'Karl Marx',
        'title': 'The Communist Manifesto',
        'publication_date': '1848',
        'category': 'Manifestos',
        'language': 'en',
        'content': 'A spectre is haunting Europe...' * 100
    }
    result = marxist_detector.analyze_marxist_document(marxist_doc)
    print(f"Quality Score: {result['quality_score']}")
    print(f"Issues: {result['issues']}\n")

    # Test Anarchist
    print("=" * 60)
    print("ANARCHIST DETECTOR TEST")
    print("=" * 60)
    anarchist_detector = AnarchistIssueDetector()
    anarchist_doc = {
        'language': 'en',
        'categories': ['Anarchism', 'Philosophy'],
        'content': 'This is an anarchist text about freedom and equality...' * 50
    }
    result = anarchist_detector.analyze_anarchist_document(anarchist_doc)
    print(f"Quality Score: {result['quality_score']}")
    print(f"Issues: {result['issues']}\n")
