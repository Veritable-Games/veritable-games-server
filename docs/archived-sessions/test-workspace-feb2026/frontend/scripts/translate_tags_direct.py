#!/usr/bin/env python3
"""
Direct Tag Translation - Claude translates tags inline
No API calls needed - translations are hardcoded by Claude
"""

import csv
import sys
from collections import defaultdict

# Language codes and names
LANGUAGES = {
    'en': 'English', 'pl': 'Polish', 'ru': 'Russian', 'fr': 'French',
    'de': 'German', 'pt': 'Portuguese', 'es': 'Spanish', 'sv': 'Swedish',
    'tr': 'Turkish', 'sr': 'Serbian', 'nl': 'Dutch', 'fi': 'Finnish',
    'it': 'Italian', 'ja': 'Japanese', 'ro': 'Romanian', 'sea': 'Southeast Asian',
    'el': 'Greek', 'cs': 'Czech', 'hr': 'Croatian', 'hu': 'Hungarian',
    'da': 'Danish', 'no': 'Norwegian', 'ar': 'Arabic', 'he': 'Hebrew',
    'zh': 'Chinese', 'ko': 'Korean', 'hi': 'Hindi'
}

# Translation dictionary - Claude's translations
# Format: (source_tag_name, source_lang): [(target_lang, translation, confidence), ...]
TRANSLATIONS = {
    # Anarchism
    ('anarchism', 'en'): [
        ('es', 'anarquismo', 0.98),
        ('fr', 'anarchisme', 0.98),
        ('de', 'anarchismus', 0.98),
        ('pt', 'anarquismo', 0.98),
        ('it', 'anarchismo', 0.98),
        ('ru', 'анархизм', 0.98),
        ('pl', 'anarchizm', 0.98),
        ('sv', 'anarkism', 0.98),
        ('sr', 'anarhizam', 0.98),
        ('nl', 'anarchisme', 0.98),
        ('tr', 'anarşizm', 0.95),
        ('el', 'αναρχισμός', 0.95),
        ('cs', 'anarchismus', 0.98),
        ('ro', 'anarhism', 0.98),
    ],

    # Revolution
    ('revolution', 'en'): [
        ('es', 'revolución', 0.98),
        ('fr', 'révolution', 0.98),
        ('de', 'revolution', 0.98),
        ('pt', 'revolução', 0.98),
        ('it', 'rivoluzione', 0.98),
        ('ru', 'революция', 0.98),
        ('pl', 'rewolucja', 0.98),
        ('sv', 'revolution', 0.98),
        ('nl', 'revolutie', 0.98),
        ('tr', 'devrim', 0.95),
        ('cs', 'revoluce', 0.98),
        ('ro', 'revoluție', 0.98),
    ],

    # Capitalism
    ('capitalism', 'en'): [
        ('es', 'capitalismo', 0.98),
        ('fr', 'capitalisme', 0.98),
        ('de', 'kapitalismus', 0.98),
        ('pt', 'capitalismo', 0.98),
        ('it', 'capitalismo', 0.98),
        ('ru', 'капитализм', 0.98),
        ('pl', 'kapitalizm', 0.98),
        ('sv', 'kapitalism', 0.98),
        ('nl', 'kapitalisme', 0.98),
        ('tr', 'kapitalizm', 0.98),
        ('cs', 'kapitalismus', 0.98),
        ('ro', 'capitalism', 0.98),
    ],

    # Feminism
    ('feminism', 'en'): [
        ('es', 'feminismo', 0.98),
        ('fr', 'féminisme', 0.98),
        ('de', 'feminismus', 0.98),
        ('pt', 'feminismo', 0.98),
        ('it', 'femminismo', 0.98),
        ('ru', 'феминизм', 0.98),
        ('pl', 'feminizm', 0.98),
        ('sv', 'feminism', 0.98),
        ('nl', 'feminisme', 0.98),
        ('tr', 'feminizm', 0.98),
        ('cs', 'feminismus', 0.98),
        ('ro', 'feminism', 0.98),
    ],

    # Marxism
    ('marxism', 'en'): [
        ('es', 'marxismo', 0.98),
        ('fr', 'marxisme', 0.98),
        ('de', 'marxismus', 0.98),
        ('pt', 'marxismo', 0.98),
        ('it', 'marxismo', 0.98),
        ('ru', 'марксизм', 0.98),
        ('pl', 'marksizm', 0.98),
        ('sv', 'marxism', 0.98),
        ('nl', 'marxisme', 0.98),
        ('tr', 'marksizm', 0.98),
        ('cs', 'marxismus', 0.98),
        ('ro', 'marxism', 0.98),
    ],

    # Fascism
    ('fascism', 'en'): [
        ('es', 'fascismo', 0.98),
        ('fr', 'fascisme', 0.98),
        ('de', 'faschismus', 0.98),
        ('pt', 'fascismo', 0.98),
        ('it', 'fascismo', 0.98),
        ('ru', 'фашизм', 0.98),
        ('pl', 'faszyzm', 0.98),
        ('sv', 'fascism', 0.98),
        ('nl', 'fascisme', 0.98),
        ('tr', 'faşizm', 0.98),
        ('cs', 'fašismus', 0.98),
        ('ro', 'fascism', 0.98),
    ],

    # History
    ('history', 'en'): [
        ('es', 'historia', 0.98),
        ('fr', 'histoire', 0.98),
        ('de', 'geschichte', 0.98),
        ('pt', 'história', 0.98),
        ('it', 'storia', 0.98),
        ('ru', 'история', 0.98),
        ('pl', 'historia', 0.98),
        ('sv', 'historia', 0.98),
        ('nl', 'geschiedenis', 0.95),
        ('tr', 'tarih', 0.95),
        ('cs', 'historie', 0.98),
        ('ro', 'istorie', 0.98),
    ],

    # Democracy
    ('democracy', 'en'): [
        ('es', 'democracia', 0.98),
        ('fr', 'démocratie', 0.98),
        ('de', 'demokratie', 0.98),
        ('pt', 'democracia', 0.98),
        ('it', 'democrazia', 0.98),
        ('ru', 'демократия', 0.98),
        ('pl', 'demokracja', 0.98),
        ('sv', 'demokrati', 0.98),
        ('nl', 'democratie', 0.98),
        ('tr', 'demokrasi', 0.98),
        ('cs', 'demokracie', 0.98),
        ('ro', 'democrație', 0.98),
    ],

    # Ecology
    ('ecology', 'en'): [
        ('es', 'ecología', 0.98),
        ('fr', 'écologie', 0.98),
        ('de', 'ökologie', 0.98),
        ('pt', 'ecologia', 0.98),
        ('it', 'ecologia', 0.98),
        ('ru', 'экология', 0.98),
        ('pl', 'ekologia', 0.98),
        ('sv', 'ekologi', 0.98),
        ('nl', 'ecologie', 0.98),
        ('tr', 'ekoloji', 0.98),
        ('cs', 'ekologie', 0.98),
        ('ro', 'ecologie', 0.98),
    ],

    # Philosophy
    ('philosophy', 'en'): [
        ('es', 'filosofía', 0.98),
        ('fr', 'philosophie', 0.98),
        ('de', 'philosophie', 0.98),
        ('pt', 'filosofia', 0.98),
        ('it', 'filosofia', 0.98),
        ('ru', 'философия', 0.98),
        ('pl', 'filozofia', 0.98),
        ('sv', 'filosofi', 0.98),
        ('nl', 'filosofie', 0.98),
        ('tr', 'felsefe', 0.95),
        ('cs', 'filozofie', 0.98),
        ('ro', 'filosofie', 0.98),
    ],
}

def load_tag_lookup(filepath):
    """Load all existing tags by language for matching"""
    tags_by_lang = defaultdict(dict)  # {language: {tag_name_lower: tag_id}}

    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split('|')
                if len(parts) == 3:
                    lang, tag_id, tag_name = parts
                    tags_by_lang[lang][tag_name.lower()] = int(tag_id)
    except Exception as e:
        print(f"Error loading tag lookup: {e}")

    return tags_by_lang

def load_top_tags(filepath):
    """Load top tags to translate"""
    tags = []
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split('|')
                if len(parts) == 3:
                    tag_id, name, usage_count = parts
                    tags.append({
                        'id': int(tag_id),
                        'name': name,
                        'usage_count': int(usage_count)
                    })
    except Exception as e:
        print(f"Error loading top tags: {e}")

    return tags

def generate_translations(top_tags, tags_by_lang, output_csv):
    """Generate translation mappings"""

    print(f"Generating translations for {len(top_tags)} tags...")
    print(f"Available languages: {len(tags_by_lang)}")

    translations_written = 0

    with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'source_tag_id',
            'source_tag_name',
            'source_language',
            'target_tag_id',
            'target_tag_name',
            'target_language',
            'confidence_score',
            'translation_method'
        ])

        for tag in top_tags:
            tag_name = tag['name']
            tag_id = tag['id']

            # Check if we have translations for this tag
            if (tag_name, 'en') in TRANSLATIONS:
                for target_lang, translation, confidence in TRANSLATIONS[(tag_name, 'en')]:
                    # Look up if this translation exists in target language
                    if target_lang in tags_by_lang:
                        translation_lower = translation.lower()
                        if translation_lower in tags_by_lang[target_lang]:
                            target_tag_id = tags_by_lang[target_lang][translation_lower]

                            # Write bidirectional mapping
                            writer.writerow([
                                tag_id, tag_name, 'en',
                                target_tag_id, translation, target_lang,
                                f"{confidence:.2f}", 'claude'
                            ])
                            writer.writerow([
                                target_tag_id, translation, target_lang,
                                tag_id, tag_name, 'en',
                                f"{confidence:.2f}", 'claude'
                            ])
                            translations_written += 2

    print(f"✅ Generated {translations_written} translation mappings")
    print(f"✅ Output: {output_csv}")

def main():
    top_tags_file = '/tmp/top_tags.txt'
    tag_lookup_file = '/tmp/all_tags_lookup.txt'
    output_csv = '/home/user/projects/veritable-games/resources/data/tag_translations.csv'

    print("🚀 Direct Tag Translation Generator")
    print("=" * 60)

    # Load data
    print("\n📊 Loading data...")
    tags_by_lang = load_tag_lookup(tag_lookup_file)
    top_tags = load_top_tags(top_tags_file)

    print(f"✅ Loaded {len(top_tags)} top tags")
    print(f"✅ Loaded tags for {len(tags_by_lang)} languages")

    # Generate translations
    generate_translations(top_tags, tags_by_lang, output_csv)

    print("\n" + "=" * 60)
    print("✅ Complete!")

if __name__ == '__main__':
    main()
