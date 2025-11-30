# Library Document Samples for Quality Review

These are processed documents ready for review to verify they meet anarchist library quality standards.

## Processing Applied

1. ✅ **Blank line removal**: 1,475,667 excessive blank lines removed from 3,919 files
2. ✅ **Page header removal**: 28,408 page number headers (## 1, ## 2, etc.) removed from 530 files
3. ✅ **Paragraph reflow**: Lines joined into proper flowing paragraphs
4. ✅ **PDF artifacts cleaned**: "Complete Page View", "Figure:" headers, etc. removed

## Sample Documents

### 1. Article_abolition-democracy-angela-y-davis.md
- **Type**: Book (94 pages)
- **Author**: Angela Y. Davis
- **Page headers removed**: 94 (one per page)
- **Why sampled**: This was the problematic document we used for testing
- **Expected quality**: Should now have properly flowing paragraphs without mid-sentence breaks

### 2. Article_a-stake-not-a-mistake.md
- **Type**: Article (13 pages)
- **Author**: James Herod
- **Page headers removed**: 0 (was already clean)
- **Why sampled**: Example of a document that worked well from the start
- **Expected quality**: High quality paragraph flow

### 3. Article_black-skin-white-masks-frantz-fanon.md
- **Type**: Book (189 pages)
- **Author**: Frantz Fanon
- **Page headers removed**: 189 (one per page)
- **Why sampled**: Large book with many page headers removed
- **Expected quality**: Continuous paragraph flow without page number interruptions

### 4. Book_How_to_Give_An_Ancient_Guide_to_Giving_Seneca.md
- **Type**: Book (77 pages)
- **Author**: Seneca
- **Page headers removed**: 77 (one per page)
- **Why sampled**: Classical text, good for checking philosophical writing flow
- **Expected quality**: Smooth philosophical prose

### 5. Article_a-black-autonomy-reader-reader-seditionist-distribution-2024-1.md
- **Type**: Book collection (226 pages)
- **Authors**: Multiple
- **Page headers removed**: 226 (MOST headers removed)
- **Why sampled**: Extreme case - document with most page headers
- **Expected quality**: Major improvement in readability

### 6. Article_prison-hunger-strikes-in-palestine-monograph.md
- **Type**: Monograph (109 pages)
- **Page headers removed**: 109
- **Why sampled**: Academic writing, good test for formal prose
- **Expected quality**: Scholarly text should flow naturally

### 7. Article_debt-the-first-5000-years.md
- **Type**: Book excerpt
- **Author**: David Graeber
- **Page headers removed**: 3
- **Why sampled**: Popular accessible writing style
- **Expected quality**: Readable narrative prose

### 8. Article_how-we-fight-white-supremacy-akiba-solomon.md
- **Type**: Book
- **Authors**: Multiple (Akiba Solomon, editor)
- **Page headers removed**: Many (large file)
- **Why sampled**: Contemporary activist writing
- **Expected quality**: Interview/essay format should be readable

## How to Review

1. **Open documents in markdown viewer** (VS Code, Obsidian, Typora, etc.)
2. **Check for**:
   - ✅ Paragraphs flow continuously (no mid-sentence breaks)
   - ✅ No page number headers (## 1, ## 2, etc.) in middle of text
   - ✅ No "Complete Page View" or "Figure:" artifacts
   - ✅ Proper blank lines between paragraphs (not excessive)
   - ✅ Headers and lists preserved correctly

3. **Compare quality** to anarchist library documents (example: check https://theanarchistlibrary.org)

## Location

Samples are in: `/home/user/library-samples-for-review/`

Full processed dataset: `/home/user/projects/veritable-games/resources/data/library-reflow-working/` (4,424 files, 603MB)

## Next Steps

After quality review approval:
1. Import cleaned documents to database
2. Restore metadata (titles, authors, tags, etc.)
3. Verify on live site
