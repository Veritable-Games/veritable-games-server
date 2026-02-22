# Phase 6: Testing and Polish - Test Plan

## Test Categories

### 1. Drag-and-Drop Linking
- [ ] Drag document A onto document B creates a link
- [ ] Success message displays "Linked 'A' with 'B'"
- [ ] After linking, both documents appear in linked group switcher
- [ ] Cannot link document to itself (visual feedback)
- [ ] Cannot link documents already in same group (visual feedback)
- [ ] Dragged document shows visual feedback (opacity)
- [ ] Drop target shows purple ring highlight
- [ ] Loading spinner displays during linking
- [ ] Error message displays if linking fails
- [ ] Error message is dismissable

### 2. Multi-Select Functionality
- [ ] Ctrl+Click toggles selection on a single document
- [ ] Document shows blue ring highlight when selected
- [ ] Selection checkbox appears in top-left corner
- [ ] SelectionToolbar appears when documents are selected
- [ ] SelectionToolbar shows correct count ("X of Y selected")
- [ ] "Select all" button selects all documents
- [ ] "Clear (Esc)" button clears selection
- [ ] Escape key clears selection
- [ ] Escape key hides SelectionToolbar
- [ ] Cannot drag when documents are selected

### 3. Language Filtering
- [ ] Language dropdown opens/closes on click
- [ ] Can search languages by name/code
- [ ] Selecting languages filters documents
- [ ] Multiple languages can be selected (OR logic)
- [ ] Selected languages show as tags below dropdown
- [ ] Can remove language by clicking X on tag
- [ ] "Select All" button selects all 27 languages
- [ ] "Clear" button deselects all languages
- [ ] Filters work with infinite scroll
- [ ] Scroll position restored after filtering

### 4. Tag Filtering
- [ ] Tag filter sidebar displays categories
- [ ] Clicking tag toggles selection
- [ ] Selected tags filter documents (OR logic)
- [ ] Tags work with infinite scroll
- [ ] Tags work in combination with language filter

### 5. Filter Combinations
- [ ] Language + Tags filters work together
- [ ] Language + Search query works together
- [ ] Tags + Search query works together
- [ ] All three (Language + Tags + Search) work together
- [ ] Clear filters button clears language and tags

### 6. Scroll Position
- [ ] Scroll position preserved when changing filters
- [ ] Scroll position restored when navigating back
- [ ] Works with infinite scroll loading

### 7. Infinite Scroll
- [ ] Sentinel loads more documents when visible
- [ ] Loading indicator displays
- [ ] New documents append to list
- [ ] "hasMore" becomes false when at end
- [ ] Works with all filter combinations

### 8. Mobile Responsiveness
- [ ] Language dropdown works on mobile
- [ ] SelectionToolbar is usable on mobile
- [ ] Filters stack vertically on mobile
- [ ] Cards display properly on mobile (1 column)
- [ ] Grid displays properly on tablet (2 columns)

### 9. Visual Polish
- [ ] All interactive elements have hover states
- [ ] Loading spinners are smooth and visible
- [ ] Colors are consistent (purple for links, blue for selection, orange for unlink)
- [ ] Borders and spacing are consistent
- [ ] No layout shift when showing/hiding SelectionToolbar
- [ ] No layout shift when showing/hiding messages

### 10. Edge Cases
- [ ] Filtering with 0 results shows "No documents match your filters"
- [ ] Very long document titles don't break layout
- [ ] Very long tag names don't break layout
- [ ] Linking across different document sources works
- [ ] Rapid filter changes don't cause race conditions
- [ ] Rapid clicks don't trigger duplicate actions

## Known Issues to Address

(To be filled in during testing)

## Fixes Applied

(To be documented as we fix issues)
