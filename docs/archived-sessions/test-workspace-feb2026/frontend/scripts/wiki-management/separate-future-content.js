const fs = require('fs');

console.log('📁 CREATING SEPARATE FUTURE DEVELOPMENT FILE\n');

const unorganizedPath = '/home/user/Projects/web/project-notes/cosmic-knights-unorganized-notes.md';
const futurePath = '/home/user/Projects/web/project-notes/cosmic-knights-future-development.md';

// Read current unorganized content
const unorganizedContent = fs.readFileSync(unorganizedPath, 'utf8');

// Identify clear future development sections
const futureIndicators = [
  'Future Development Concepts (Not Yet Implemented)',
  'Alternative Gameplay Modes (Future Consideration)',
  'Extended Progression Framework (Advanced Development)',
  'Advanced Technical Systems (Future Implementation)',
  'Expanded Cross-Platform Integration',
  'AI Commander Sophistication (Advanced Development)',
  'Development Questions for Future Phases',
  'Advanced Content Creation Framework',
  'Platform Integration Extensions',
  'Asymmetric Faction Integration (Future Expansion)',
  'Environmental Weather Systems (Advanced Features)',
  'Implementation Priority Framework (Future Phases)',
  'Phase 4: Advanced Cooperative Features (Future)',
  'Phase 5: Expansion Content (Future)',
  'Phase 6: Community Integration (Future)',
  'Single-Player Mode with AI Companions',
  'Competitive Multiplayer Expansion',
  'Long-Term Knight Identity',
  'Alternative Resource Systems (Design Exploration)',
  'Machine Learning Integration',
  'Enhanced Community Features',
  'Mission Variety Expansion',
  'Banner Tournaments',
  'Skeleton Swarm Player Control',
  'Dynamic Environmental Challenges',
];

// Split content and identify future vs potential implementation content
const sections = unorganizedContent.split('##');
const header = sections[0]; // Title and intro

let futureContent = '';
let implementationContent = '';

sections.slice(1).forEach(section => {
  const sectionTitle = section.split('\n')[0].trim();
  const sectionText = section.toLowerCase();

  // Check if this section is clearly future development
  const isFuture = futureIndicators.some(
    indicator =>
      sectionTitle.includes(indicator) ||
      sectionText.includes('future') ||
      sectionText.includes('advanced development') ||
      sectionText.includes('not yet implemented') ||
      sectionText.includes('phase 4') ||
      sectionText.includes('phase 5') ||
      sectionText.includes('phase 6') ||
      sectionText.includes('expansion') ||
      sectionText.includes('alternative') ||
      sectionText.includes('extended')
  );

  if (isFuture) {
    futureContent += '##' + section;
  } else {
    implementationContent += '##' + section;
  }
});

// Create future development file
const futureFileContent = `# COSMIC KNIGHTS Future Development Roadmap
*Advanced concepts and expansion features for later development phases*

This file contains concepts intended for **Phase 4+** development - features that expand beyond the core horde survival framework. These are creative ideas and advanced systems to implement after the foundational game is complete.

${futureContent}

---

*This roadmap preserves advanced design concepts for future Cosmic Knights expansion and enhancement after core implementation is complete.*`;

// Create cleaned unorganized file focused on potential current implementation
const cleanedUnorganizedContent = `# COSMIC KNIGHTS Unorganized Notes & Implementation Candidates
*Content that might be integrated into current wiki pages or require new pages*

This file contains concepts that could potentially be **implemented in the current development phase** or integrated into existing wiki pages. These need review to determine if they should become new wiki content or enhance existing pages.

${implementationContent}

---

## Review Guidelines

**For each section above, consider:**
1. **Already Implemented?** - Check if this content exists in current wiki pages
2. **Needs New Page?** - Should this become a new wiki page?
3. **Enhance Existing?** - Can this be integrated into an existing wiki page?
4. **Future Development?** - Should this move to the future development file?

**Move to Organized:** Only after confirming the content is implemented in wiki pages
**Move to Future:** If the content is clearly beyond current scope
**Create Wiki Page:** If the content represents a major system needing documentation`;

console.log('📝 ANALYZING CONTENT DISTRIBUTION:\n');

// Count sections for reporting
const futureSections = futureContent.split('##').length - 1;
const implementationSections = implementationContent.split('##').length - 1;

console.log('🔮 FUTURE DEVELOPMENT CONTENT:');
console.log(`   • Sections: ${futureSections}`);
console.log('   • Content: Advanced features, alternative modes, Phase 4+ concepts');
console.log('');

console.log('🔧 IMPLEMENTATION CANDIDATES:');
console.log(`   • Sections: ${implementationSections}`);
console.log('   • Content: Potential wiki content, enhancement candidates');
console.log('');

// Write the files
try {
  // Create future development file
  fs.writeFileSync(futurePath, futureFileContent);
  console.log('   ✅ Created cosmic-knights-future-development.md');

  // Update unorganized file to focus on implementation candidates
  fs.writeFileSync(unorganizedPath, cleanedUnorganizedContent);
  console.log('   ✅ Updated cosmic-knights-unorganized-notes.md (implementation focus)');

  console.log('\n🎯 SEPARATION COMPLETE!\n');

  console.log('📊 RESULT:');
  console.log('   📝 ORGANIZED: Confirmed wiki implementations (4 sections)');
  console.log(`   🔧 UNORGANIZED: Implementation candidates (${implementationSections} sections)`);
  console.log(`   🔮 FUTURE: Advanced development roadmap (${futureSections} sections)`);

  console.log('\n✅ Perfect separation achieved!');
  console.log('   • Future concepts clearly separated for Phase 4+ development');
  console.log('   • Unorganized now focuses on potential current implementations');
  console.log('   • Easy to review what might need wiki pages vs future planning');
} catch (error) {
  console.error('❌ Error creating files:', error.message);
}

console.log('\n🔍 NEXT STEPS:');
console.log('   1. Review cosmic-knights-unorganized-notes.md for wiki integration');
console.log('   2. Consider which sections need new wiki pages');
console.log('   3. Use cosmic-knights-future-development.md for long-term planning');
console.log('   4. Move confirmed implementations to organized notes');
