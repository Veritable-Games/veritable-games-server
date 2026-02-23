const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'forums.db');
const db = new Database(dbPath);

console.log('🔧 REORGANIZING COSMIC KNIGHTS WIKI FOR CLARITY AND SPECIFICITY\n');

// Helper function to get latest revision content
const getPageContent = slug => {
  const result = db
    .prepare(
      `
    SELECT r.content 
    FROM wiki_pages p 
    JOIN wiki_revisions r ON p.id = r.page_id 
    WHERE p.slug = ? 
    AND r.revision_timestamp = (
      SELECT MAX(revision_timestamp) 
      FROM wiki_revisions r2 
      WHERE r2.page_id = p.id
    )
  `
    )
    .get(slug);
  return result?.content || '';
};

// Helper function to create/update page
const createOrUpdatePage = (slug, title, content, summary) => {
  try {
    // Check if page exists
    const existingPage = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);

    if (existingPage) {
      // Update existing page
      db.prepare(
        'UPDATE wiki_pages SET title = ?, updated_at = datetime("now") WHERE slug = ?'
      ).run(title, slug);

      // Add new revision
      const contentLength = Buffer.byteLength(content, 'utf8');
      db.prepare(
        `
        INSERT INTO wiki_revisions (page_id, content, summary, author_id, size_bytes, revision_timestamp)
        VALUES (?, ?, ?, 1, ?, datetime('now'))
      `
      ).run(existingPage.id, content, summary, contentLength);

      console.log(`✅ Updated: ${title}`);
    } else {
      // Create new page
      const result = db
        .prepare(
          `
        INSERT INTO wiki_pages (title, slug, project_slug, status, created_at, updated_at)
        VALUES (?, ?, 'cosmic-knights', 'published', datetime('now'), datetime('now'))
      `
        )
        .run(title, slug);

      const pageId = result.lastInsertRowid;

      // Add to category
      db.prepare('INSERT INTO wiki_page_categories (page_id, category_id) VALUES (?, ?)').run(
        pageId,
        'cosmic-knights'
      );

      // Add initial revision
      const contentLength = Buffer.byteLength(content, 'utf8');
      db.prepare(
        `
        INSERT INTO wiki_revisions (page_id, content, summary, author_id, size_bytes, revision_timestamp)
        VALUES (?, ?, ?, 1, ?, datetime('now'))
      `
      ).run(pageId, content, summary, contentLength);

      console.log(`✅ Created: ${title}`);
    }
  } catch (error) {
    console.error(`❌ Error with ${title}: ${error.message}`);
  }
};

// 1. STREAMLINED OVERVIEW
console.log('\n📄 Creating streamlined overview page...');
const overviewContent = `# Cosmic Knights Overview
*Revolutionary Cooperative Horde Survival with AI Banner Command*

## Quick Start Guide

**Cosmic Knights** revolutionizes cooperative gaming by solving the fundamental problem of unreliable teammates. Each human player commands 3 intelligent AI Banner-mates against overwhelming skeleton hordes.

### Core Innovation
- **Each Player Controls**: 1 Custom Knight + 3 AI Banner-mates
- **Victory Condition**: Seal all 7 Fractures before environmental corruption overwhelms your position
- **No Teammate Problems**: Your AI Banner-mates learn your style and never abandon you

### Essential Systems

**Combat & Controls**
- [Knight Combat](cosmic-knights-knight-combat) - Health, movement, and basic combat mechanics
- [Special Abilities](cosmic-knights-special-abilities) - 5 tactical abilities beyond weapons
- [Controls](cosmic-knights-controls) - Button mappings and control schemes

**Banner Systems**
- [Banner Command](cosmic-knights-banner-command) - Commanding your 3 AI teammates
- [AI Learning](cosmic-knights-ai-learning) - How AI adapts to your playstyle

**Weapons** (6 Total)
- [Mining Pistol](cosmic-knights-mining-pistol) - Resource extraction tool
- [Gale Wind Cannon](cosmic-knights-weapon-gale) - Crowd control
- [Glesum Crystallization](cosmic-knights-weapon-glesum) - Area denial
- [Bestiolae Magma](cosmic-knights-weapon-bestiolae) - Environmental hazards
- [Tendril Lightning](cosmic-knights-weapon-tendril) - Multi-target
- [Greatgun Precision](cosmic-knights-weapon-greatgun) - Dual sword/rifle

**Tactical Systems**
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource management
- [Fracture Warfare](cosmic-knights-fracture-warfare-sealing) - Objectives and victory
- [Skeleton Hordes](cosmic-knights-skeleton-hordes) - Enemy types and AI
- [Corruption Pressure](cosmic-knights-corruption-pressure) - Time limits and urgency

**Progression & Multiplayer**
- [Progression & Unlocks](cosmic-knights-progression-unlocks) - What you earn as you play
- [Multiplayer Systems](cosmic-knights-multiplayer-systems) - Features for multiple human players

**World & Environment**
- [Level Environments](cosmic-knights-level-environments) - Map design and environmental features

## Getting Started

1. **Learn the Basics**: Start with [Knight Combat](cosmic-knights-knight-combat) and [Controls](cosmic-knights-controls)
2. **Master Your Banner**: Understand [Banner Command](cosmic-knights-banner-command) to coordinate your AI teammates
3. **Choose Your Weapons**: Experiment with the [6 weapon types](cosmic-knights-weapon-arsenal) to find your style
4. **Seal the Fractures**: Learn [Fracture Warfare](cosmic-knights-fracture-warfare-sealing) to achieve victory

*This overview provides quick access to all Cosmic Knights systems. Each linked page provides detailed mechanics and strategies.*`;

createOrUpdatePage(
  'cosmic-knights-overview',
  'Cosmic Knights Overview',
  overviewContent,
  'Streamlined overview with clear navigation'
);

// 2. KNIGHT COMBAT (merged from player-mechanics and parts of cosmic-knights)
console.log('\n📄 Creating Knight Combat page...');

const playerMechanicsContent = getPageContent('player-mechanics');
const abilitiesContent = getPageContent('abilities-system');
const mainContent = getPageContent('cosmic-knights');

const knightCombatContent = `# Knight Combat
*Core Health, Movement, and Combat Mechanics*

## Overview

Knight combat forms the foundation of personal skill expression in Cosmic Knights. Every player controls one elite Knight with unified health/resource systems, creating strategic depth through crystal-based mechanics that balance survival with offensive capability.

## Health System

### Unified Crystal Health
**Core Mechanics:**
- **Crystal Energy = Health**: Your crystal reserves represent both health and combat resources
- **Visual Representation**: Neon health bar travels down knight's spine, visible to all Banner members
- **Damage Response**: Taking damage depletes crystal reserves, creating tactical resource management decisions
- **Revival System**: Downed knights can be revived by Banner-mates transferring 25% of their crystals

**Health States:**
- **100-40% Crystals**: Full combat effectiveness
- **Below 40%**: Health bar flashes with increasing intensity
- **Zero Crystals**: Knight enters downed state, requires Banner revival
- **Bleed-out Timer**: 30 seconds to receive revival before respawn

### Damage Mitigation
**Defensive Options:**
- **Brace (B/LMB)**: Reduce incoming damage through timed blocking
- **Parry Window**: Perfect timing negates damage and stuns attacker
- **Environmental Cover**: Use alien architecture for protection
- **Banner Support**: AI teammates can provide defensive positioning

## Movement System

### Core Movement Mechanics
**Base Movement:**
- **Third-Person Control**: Direct knight control with full 360-degree movement
- **Sprint**: Hold shift for increased movement speed (consumes no resources)
- **Jump**: Spacebar for vertical navigation and tactical positioning
- **Crouch**: Ctrl for cover and stealth approaches

**Advanced Movement:**
- **Dash (A/Space)**: Quick omnidirectional movement with brief invulnerability
- **Cooldown Management**: Dash has 3-second cooldown requiring tactical timing
- **Environmental Navigation**: Use alien architecture for tactical positioning
- **Banner Coordination**: Movement synchronized with AI teammate positioning

### Combat Movement Integration
**Tactical Positioning:**
- **Weapon Range Management**: Different weapons require different positioning strategies
- **Skeleton Avoidance**: Movement essential for managing overwhelming hordes
- **Objective Positioning**: Fracture sealing requires sustained positioning
- **Resource Gathering**: Safe positioning for crystal mining operations

## Melee Combat

### Close-Range Engagement
**Basic Melee:**
- **Quick Attack**: Right-click for basic melee strikes
- **Heavy Attack**: Hold right-click for powerful strikes
- **Combo System**: Chain attacks for increased damage
- **Stamina Management**: Heavy attacks consume tactical stamina

**Melee Integration:**
- **Weapon Switching**: Seamless transition between ranged and melee
- **Emergency Response**: Melee always available regardless of ammunition
- **Skeleton Disruption**: Melee attacks stagger nearby enemies
- **Environmental Interaction**: Break obstacles and environmental elements

## Combat Feedback Systems

### Visual Indicators
**Health and Status:**
- **Spine Light Bar**: Real-time health visualization
- **Damage Flash**: Screen edges flash red when taking damage
- **Critical Warning**: Intense visual warnings below 40% health
- **Revival Indicator**: Clear visual when downed teammate needs revival

### Audio Feedback
**Combat Sounds:**
- **Impact Audio**: Clear feedback for successful hits
- **Warning Sounds**: Audio alerts for low health
- **Environmental Audio**: Spatial awareness through sound
- **Banner Communication**: AI teammates provide audio callouts

## Banner Integration

### AI Teammate Support
**Combat Coordination:**
- **Covering Fire**: AI Banner-mates provide tactical support
- **Revival Priority**: AI teammates prioritize player revival
- **Resource Sharing**: Banner-mates can transfer crystals in emergencies
- **Tactical Positioning**: AI adapts to player combat style

### Cooperative Combat
**Team Tactics:**
- **Focus Fire**: Coordinate attacks on priority targets
- **Defensive Formation**: Banner positioning for maximum protection
- **Resource Management**: Shared crystal economy decisions
- **Emergency Response**: Banner-wide crisis management

## Combat Tips

### Survival Strategies
1. **Resource Balance**: Don't deplete all crystals on offense
2. **Banner Coordination**: Use AI teammates for tactical advantage
3. **Environmental Awareness**: Use terrain for protection
4. **Timing Mastery**: Perfect parries and dodges preserve resources

### Advanced Techniques
- **Animation Canceling**: Dash to cancel attack recovery
- **Parry Chains**: Sequential parries against multiple enemies
- **Environmental Kills**: Use hazards for resource-free eliminations
- **Banner Synergy**: Coordinate with AI for maximum effectiveness

## Related Systems
- [Special Abilities](cosmic-knights-special-abilities) - Tactical abilities beyond basic combat
- [Banner Command](cosmic-knights-banner-command) - AI teammate coordination
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource management system
- [Controls](cosmic-knights-controls) - Complete control mappings

*Knight Combat provides the foundation for all tactical engagement in Cosmic Knights, balancing personal skill expression with strategic resource management in the revolutionary cooperative framework.*`;

createOrUpdatePage(
  'cosmic-knights-knight-combat',
  'Knight Combat',
  knightCombatContent,
  'Core combat mechanics consolidated from multiple sources'
);

// 3. SPECIAL ABILITIES (refined from abilities-system)
console.log('\n📄 Creating Special Abilities page...');

const specialAbilitiesContent = `# Special Abilities
*Five Tactical Powers Beyond Weapons*

## Overview

Cosmic Knights features five specialized abilities that provide tactical advantages beyond standard weapon systems. Each ability serves specific strategic purposes and requires careful crystal energy management for maximum effectiveness.

## The Five Abilities

### 1. Disrupt - Area Stunning
**Effect**: Emit sonic blast stunning all nearby skeletons
- **Range**: 15-meter radius around knight
- **Duration**: 3-second stun effect
- **Crystal Cost**: 20% of current reserves
- **Best Use**: Emergency crowd control when overwhelmed

**Tactical Applications:**
- Clear space for revival operations
- Create breathing room during Fracture sealing
- Enable tactical repositioning
- Support Banner-mate extraction

### 2. Kindle - Instant Elimination
**Effect**: Explosive burst destroying all skeletons within close range
- **Range**: 5-meter radius destruction zone
- **Damage**: Instant elimination regardless of enemy type
- **Crystal Cost**: 40% of current reserves
- **Best Use**: Crisis response when completely surrounded

**Tactical Applications:**
- Emergency defense during Fracture sealing
- Clear landing zones for Banner operations
- Instant threat elimination
- Breakthrough creation for advancement

### 3. Turn - Enemy Conversion
**Effect**: Convert 50% of nearby skeletons to permanent allies
- **Range**: 10-meter radius conversion zone
- **Duration**: Converted skeletons remain until destroyed
- **Crystal Cost**: 30% of current reserves
- **Best Use**: Create defensive buffer during objectives

**Tactical Applications:**
- Establish defensive perimeter
- Create distraction for tactical operations
- Reduce enemy pressure on Banner
- Support sustained Fracture sealing

### 4. Haste - Speed Manipulation
**Effect**: Accelerate skeleton movement but drastically reduce their health
- **Range**: 20-meter radius effect zone
- **Duration**: 10-second effect
- **Crystal Cost**: 15% of current reserves
- **Best Use**: Make enemies fragile for easy elimination

**Tactical Applications:**
- Setup for weapon sweep attacks
- Create tactical timing advantages
- Enable quick elimination chains
- Support Banner offensive operations

### 5. Unite - Resource Distribution
**Effect**: Equally distribute all Banner health and ammunition
- **Range**: Entire Banner (all 4 members)
- **Distribution**: Perfect equal split of resources
- **Crystal Cost**: None (redistribution only)
- **Best Use**: Emergency resource balancing

**Tactical Applications:**
- Save critically low Banner members
- Balance resources before major operations
- Emergency revival support
- Tactical resource optimization

## Ability Management

### Crystal Energy System
**Resource Requirements:**
- All abilities except Unite consume crystal energy
- Percentage-based costs scale with current reserves
- Cannot use abilities below minimum crystal threshold
- Resource management crucial for ability availability

### Cooldown Mechanics
**Timing Systems:**
- **Individual Cooldowns**: Each ability has separate cooldown
- **Disrupt**: 30-second cooldown
- **Kindle**: 60-second cooldown
- **Turn**: 45-second cooldown
- **Haste**: 20-second cooldown
- **Unite**: 90-second cooldown

### Strategic Timing
**Optimal Usage:**
- Save abilities for critical moments
- Coordinate with Banner operations
- Consider resource state before activation
- Plan ability chains for maximum effect

## Banner Coordination

### AI Integration
**Banner-mate Response:**
- AI teammates aware of ability usage
- Automatic tactical adaptation
- Coordinated follow-up attacks
- Strategic positioning adjustment

### Multiplayer Coordination
**With Human Players:**
- Ability usage visible to all players
- Coordinate ability timing
- Avoid overlapping similar abilities
- Strategic ability combinations

## Ability Combinations

### Synergistic Usage
**Effective Combinations:**
- **Haste + Weapon Sweep**: Fragile enemies for easy clearing
- **Disrupt + Kindle**: Stun then eliminate
- **Turn + Defensive Position**: Converted enemies protect objectives
- **Unite + Revival**: Resource balance for team recovery

### Advanced Techniques
**Expert Strategies:**
- Chain abilities across Banner members
- Time abilities with environmental hazards
- Coordinate with weapon attacks
- Use abilities to enable objectives

## Progression Integration

### Ability Enhancement
**Upgrade Paths:**
- Reduced cooldown timers
- Increased effect radius
- Lower crystal costs
- Enhanced effect duration

### Mastery Rewards
**Achievement Systems:**
- Ability usage tracking
- Effectiveness metrics
- Strategic usage rewards
- Banner coordination bonuses

## Tactical Considerations

### Resource Management
**Crystal Economy:**
- Balance ability use with health needs
- Consider Banner-wide resource state
- Plan for emergency reserves
- Coordinate resource distribution

### Situational Awareness
**Strategic Decision-Making:**
- Assess immediate threats
- Consider objective requirements
- Evaluate Banner status
- Plan ability sequences

## Tips and Strategies

### Beginner Tips
1. Start with Disrupt for safe learning
2. Save Kindle for true emergencies
3. Use Unite to help struggling teammates
4. Practice ability timing in safe areas

### Advanced Strategies
- Coordinate abilities across Banner
- Use environment to amplify effects
- Time abilities with objective phases
- Create ability-weapon combinations

## Related Systems
- [Knight Combat](cosmic-knights-knight-combat) - Core combat mechanics
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource management
- [Banner Command](cosmic-knights-banner-command) - AI coordination
- [Progression & Unlocks](cosmic-knights-progression-unlocks) - Ability upgrades

*Special Abilities provide tactical options beyond weapons, enabling creative problem-solving and emergency response in the revolutionary cooperative framework.*`;

createOrUpdatePage(
  'cosmic-knights-special-abilities',
  'Special Abilities',
  specialAbilitiesContent,
  'Consolidated and clarified ability system'
);

// 4. PROGRESSION & UNLOCKS
console.log('\n📄 Creating Progression & Unlocks page...');

const progressionContent = getPageContent('cosmic-knights-knight-progression');

const progressionUnlocksContent = `# Progression & Unlocks
*What You Earn and Unlock Through Play*

## Overview

Cosmic Knights features dual-path progression supporting both individual combat mastery and Banner leadership development. Every match contributes to permanent progression, unlocking new capabilities, customization options, and tactical advantages.

## Progression Paths

### Individual Knight Path
**Personal Combat Advancement:**
- **Weapon Mastery**: Track usage and effectiveness with each weapon
- **Combat Skills**: Improve base health, movement speed, and damage
- **Ability Enhancement**: Upgrade special ability effectiveness
- **Cosmetic Unlocks**: Armor variants, color schemes, and visual effects

**Milestone Rewards:**
- Level 5: First armor variant unlock
- Level 10: Weapon skin customization
- Level 20: Elite knight status badge
- Level 30: Legendary armor sets
- Level 50: Master knight recognition

### Banner Leadership Path
**Command Development:**
- **AI Training**: Improve Banner-mate intelligence and responsiveness
- **Tactical Options**: Unlock new Banner formations and strategies
- **Command Authority**: Gain respect for multiplayer leadership
- **Strategic Tools**: Access advanced tactical overlays and planning

**Leadership Milestones:**
- Rank 1: Basic Banner command
- Rank 5: Advanced AI behaviors
- Rank 10: Company command capability
- Rank 15: Strategic overlay access
- Rank 20: Master tactician status

## Experience System

### Match Contribution
**XP Sources:**
- **Skeleton Eliminations**: 10 XP per kill
- **Fracture Sealing**: 500 XP per seal
- **Banner Support**: 50 XP per revival
- **Match Victory**: 1000 XP bonus
- **Perfect Victory**: 2000 XP (no deaths)

### Performance Multipliers
**Bonus XP Factors:**
- **Difficulty Modifier**: x1.5 on Hard, x2.0 on Extreme
- **Banner Efficiency**: Bonus for resource conservation
- **Tactical Excellence**: Rewards for strategic play
- **Cooperation Bonus**: Extra XP for Banner coordination

## Unlock Categories

### Weapon Modifications
**Progressive Unlocks:**
- **Level 1-10**: Basic weapon skins and colors
- **Level 11-20**: Tactical attachments and effects
- **Level 21-30**: Advanced modifications
- **Level 31-40**: Elite weapon variants
- **Level 41-50**: Legendary weapon designs

**Functional Upgrades:**
- Reduced reload times
- Increased ammunition capacity
- Enhanced damage output
- Improved accuracy
- Special effect additions

### Ability Upgrades
**Enhancement Trees:**
- **Efficiency Path**: Reduce crystal costs
- **Power Path**: Increase effect strength
- **Duration Path**: Extend ability effects
- **Cooldown Path**: Reduce recharge times

**Upgrade Examples:**
- Disrupt: +5 meter radius per tier
- Kindle: -5 second cooldown per tier
- Turn: +10% conversion rate per tier
- Haste: +2 second duration per tier
- Unite: Include equipment in distribution

### Banner Customization
**AI Personality Options:**
- **Aggressive**: Offensive-focused AI behavior
- **Defensive**: Protection-priority AI
- **Balanced**: Adaptive AI approach
- **Support**: Resource-focused AI

**Visual Customization:**
- Banner colors and emblems
- AI armor variants
- Formation indicators
- Victory animations

## Currency Systems

### Knight Honor
**Earned Through:**
- Match completion
- Objective success
- Tactical excellence
- Banner coordination

**Spent On:**
- Cosmetic unlocks
- Convenience items
- XP boosters
- Banner customization

### Crystal Shards
**Premium Currency:**
- Optional purchase or rare drops
- Cosmetic-only items
- No gameplay advantages
- Support ongoing development

## Prestige System

### Prestige Levels
**Post-50 Progression:**
- Reset to level 1 with prestige star
- Retain all unlocks
- Gain prestige rewards
- Access exclusive content

**Prestige Benefits:**
- Unique armor sets per prestige
- Special weapon effects
- Elite Banner options
- Recognition badges

## Daily Challenges

### Challenge Types
**Rotating Objectives:**
- **Combat Challenge**: Eliminate 100 skeletons
- **Objective Challenge**: Seal 3 Fractures
- **Support Challenge**: Revive 5 Banner-mates
- **Efficiency Challenge**: Complete match using <500 crystals
- **Mastery Challenge**: Win without using abilities

**Challenge Rewards:**
- Bonus XP grants
- Knight Honor currency
- Exclusive cosmetics
- Progression boosters

## Seasonal Content

### Season Pass
**Seasonal Progression:**
- 100-tier reward track
- Free and premium paths
- Exclusive seasonal items
- Limited-time challenges

**Season Themes:**
- New armor sets
- Weapon variants
- Environmental effects
- Banner customizations

## Achievement System

### Achievement Categories
**Permanent Goals:**
- **Combat Mastery**: Weapon-specific achievements
- **Tactical Excellence**: Strategic play recognition
- **Banner Leadership**: Coordination achievements
- **Exploration**: Environmental discovery

**Completion Rewards:**
- Titles and badges
- Exclusive unlocks
- Knight Honor bonuses
- Profile decorations

## Tips for Progression

### Efficient Leveling
1. Focus on match completion over individual performance
2. Play on higher difficulties for XP multipliers
3. Complete daily challenges consistently
4. Coordinate with Banner for efficiency bonuses

### Unlock Priority
**Recommended Order:**
1. AI behavior improvements (immediate impact)
2. Weapon modifications (combat effectiveness)
3. Ability upgrades (tactical options)
4. Cosmetic customization (personal expression)

## Related Systems
- [Knight Combat](cosmic-knights-knight-combat) - Combat mechanics affected by progression
- [Banner Command](cosmic-knights-banner-command) - AI improvements through progression
- [Special Abilities](cosmic-knights-special-abilities) - Ability upgrades
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource management improvements

*Progression & Unlocks provide long-term goals and continuous improvement, ensuring every match contributes to your Knight's development in the revolutionary cooperative framework.*`;

createOrUpdatePage(
  'cosmic-knights-progression-unlocks',
  'Progression & Unlocks',
  progressionUnlocksContent,
  'Clear progression and unlock systems'
);

// 5. CONTROLS (simplified from controls-interface)
console.log('\n📄 Creating Controls page...');

const controlsContent = `# Controls
*Complete Button Mappings and Control Schemes*

## Overview

Cosmic Knights uses intuitive third-person controls with seamless Banner command integration. The control scheme prioritizes accessibility while supporting advanced tactical coordination.

## Control Schemes

### PC Controls (Keyboard + Mouse)

**Movement:**
- **W/A/S/D**: Movement
- **Mouse**: Camera/Aim
- **Shift**: Sprint
- **Space**: Jump
- **Ctrl**: Crouch
- **Tab**: Banner command overlay

**Combat:**
- **Left Click**: Primary weapon fire
- **Right Click**: Melee attack / Weapon alt-fire
- **R**: Convert crystals to ammo
- **Q**: Fracture beacon
- **E**: Interact / Revive
- **1-5**: Special abilities

**Banner Commands (Tab + Key):**
- **Tab + Q**: Rally to position
- **Tab + E**: Defensive formation
- **Tab + R**: Gather resources
- **Tab + F**: Focus target

**Quick Actions:**
- **F**: Quick melee
- **G**: Throw grenade (if equipped)
- **V**: Voice chat (multiplayer)
- **M**: Map overlay

### Controller Layout (Xbox/PlayStation)

**Movement:**
- **Left Stick**: Movement
- **Right Stick**: Camera/Aim
- **Left Stick Click (L3)**: Sprint
- **A/X Button**: Jump
- **B/Circle**: Crouch
- **Select/Touchpad**: Banner overlay

**Combat:**
- **Right Trigger (RT/R2)**: Primary fire
- **Right Bumper (RB/R1)**: Melee/Alt-fire
- **Left Trigger (LT/L2)**: Aim down sights
- **Left Bumper (LB/L1)**: Convert crystals
- **X/Square**: Interact/Revive
- **Y/Triangle**: Fracture beacon

**Banner Commands (Select + Button):**
- **Select + A/X**: Rally command
- **Select + B/Circle**: Defensive command
- **Select + X/Square**: Resource command
- **Select + Y/Triangle**: Focus command

**D-Pad Functions:**
- **Up**: Ability 1 (Disrupt)
- **Right**: Ability 2 (Kindle)
- **Down**: Ability 3 (Turn)
- **Left**: Ability 4 (Haste)
- **Hold Up**: Ability 5 (Unite)

## Movement Controls Detail

### Basic Movement
**Standard Navigation:**
- Analog movement with variable speed
- Camera-relative directional control
- Smooth turning with acceleration
- Jump height varies with movement speed

### Advanced Movement
**Tactical Maneuvers:**
- **Dash**: Double-tap direction or dedicated button
- **Slide**: Crouch while sprinting
- **Mantle**: Automatic ledge climbing
- **Wall Jump**: Jump near walls for extra height

## Combat Controls Detail

### Weapon Handling
**Primary Systems:**
- Hip-fire for mobility
- ADS for precision
- Automatic reload when empty
- Manual reload available anytime

### Melee Combat
**Close-Range Options:**
- Quick melee always available
- Charged heavy attacks
- Directional attacks based on movement
- Combo chains with timing

## Banner Command System

### Command Interface
**Tab/Select Overlay:**
- Hold for command mode
- Time slows slightly (single-player)
- Visual indicators for commands
- Release to execute

### Quick Commands
**Contextual Options:**
- Point at location for position commands
- Aim at enemies for focus commands
- Look at objectives for tactical commands
- Automatic context detection

## Accessibility Options

### Control Customization
**Remapping Options:**
- Full button remapping
- Separate combat/movement bindings
- Multiple control profiles
- Import/export settings

### Assistance Features
**Accessibility Support:**
- Toggle aim vs hold
- Auto-sprint option
- Simplified Banner commands
- One-button ability activation

### Difficulty Adjustments
**Control Assistance:**
- Aim assistance strength
- Movement smoothing
- Camera shake reduction
- Input buffer timing

## Advanced Techniques

### Animation Canceling
**Combo Mechanics:**
- Dash cancels attack recovery
- Jump cancels reload animation
- Melee cancels weapon switch
- Ability cancels movement locks

### Quick Inputs
**Speed Techniques:**
- Weapon quick-switch combinations
- Rapid ability chaining
- Banner command macros
- Movement tech combinations

## Platform-Specific Features

### PC Advantages
**Mouse & Keyboard Benefits:**
- Precise aiming control
- Faster camera movement
- More hotkey options
- Text chat capability

### Controller Advantages
**Gamepad Benefits:**
- Analog movement precision
- Vibration feedback
- Comfortable extended play
- Couch gaming support

## Control Tips

### New Player Recommendations
1. Start with default controls
2. Adjust sensitivity gradually
3. Practice Banner commands in safe areas
4. Use aim assistance while learning

### Advanced Optimization
- Increase sensitivity for faster reactions
- Customize Banner command layout
- Create ability quick-combos
- Optimize for your playstyle

## Common Issues

### Troubleshooting
**Input Problems:**
- Verify controller connection
- Update drivers if needed
- Check in-game deadzone settings
- Disable conflicting software

**Performance Issues:**
- Lower input polling rate if needed
- Disable v-sync for responsiveness
- Adjust frame rate limits
- Check background applications

## Related Systems
- [Knight Combat](cosmic-knights-knight-combat) - Combat mechanics
- [Banner Command](cosmic-knights-banner-command) - AI control details
- [Special Abilities](cosmic-knights-special-abilities) - Ability activation
- [Multiplayer Systems](cosmic-knights-multiplayer-systems) - Multiplayer controls

*Controls provide intuitive access to all Cosmic Knights systems, with customization options ensuring every player can find their optimal configuration.*`;

createOrUpdatePage(
  'cosmic-knights-controls',
  'Controls',
  controlsContent,
  'Complete control mappings and schemes'
);

// 6. AI LEARNING (keep existing, update title)
console.log('\n📄 Updating AI Learning page title...');
db.prepare('UPDATE wiki_pages SET title = ? WHERE slug = ?').run(
  'AI Learning',
  'cosmic-knights-ai-learning-system'
);

// 7. MULTIPLAYER SYSTEMS (merge democratic voting, knight possession, company commander)
console.log('\n📄 Creating Multiplayer Systems page...');

const democraticContent = getPageContent('cosmic-knights-democratic-voting-system');
const possessionContent = getPageContent('cosmic-knights-knight-possession-system');

const multiplayerSystemsContent = `# Multiplayer Systems
*Features for Multiple Human Players*

## Overview

When multiple human players join a match, Cosmic Knights enables additional cooperative systems including democratic decision-making, Company Commander roles, and Knight possession mechanics. These features enhance coordination while maintaining individual player agency.

**Important**: These systems only activate with 2+ human players. Single-player games with AI Banner-mates use standard AI coordination without voting or possession mechanics.

## Democratic Voting System

### When Voting Occurs
**Major Strategic Decisions:**
- **Fracture Priority**: Which Fractures to seal first
- **Resource Allocation**: Crystal distribution strategies
- **Tactical Approach**: Offensive vs defensive positioning
- **Emergency Response**: Crisis management decisions

### Voting Mechanics
**Process:**
- Quick Yes/No votes (5-second timer)
- Simple majority wins
- Abstention allowed
- Results immediately implemented

**Vote Categories:**
- Strategic objectives
- Resource management
- Banner formations
- Emergency protocols

### What Players Vote On
**Common Decisions:**
- "Should we seal the North Fracture next?"
- "Allocate crystals to weapons or health?"
- "Retreat to defensive positions?"
- "Activate emergency protocols?"

## Company Commander Role

### Commander Selection
**Assignment Methods:**
- **Voluntary**: Player requests command role
- **Rotation**: Command rotates between players
- **Performance**: Highest-scoring player leads
- **Democratic**: Team votes for commander

### Commander Capabilities
**Strategic Tools:**
- **RTS Overlay**: Top-down tactical view
- **Resource Management**: Distribute team resources
- **Objective Assignment**: Set Banner priorities
- **Tactical Planning**: Mark positions and routes

**Leadership Functions:**
- Suggest tactical approaches
- Coordinate Banner operations
- Manage resource economy
- Direct emergency response

### Knight Possession System

**Possession Mechanics:**
- Commander can request control of any Knight
- Target player must approve (5-second vote)
- Limited duration (30 seconds max)
- Used for demonstration or crisis response

**When to Use Possession:**
- Show tactical techniques
- Emergency skill intervention
- Critical objective completion
- Training and demonstration

### Command Authority Limits

**Player Agency Protection:**
- Cannot force player actions
- All commands are suggestions
- Players can ignore directives
- Democratic override available

**Respect-Based Leadership:**
- Authority earned through success
- Poor commanders can be voted out
- Individual freedom maintained
- Cooperation over coercion

## Communication Systems

### Voice Chat
**Channels:**
- **Team Channel**: All human players
- **Proximity Chat**: Nearby players only
- **Command Channel**: Commander broadcast
- **Private Messages**: Direct communication

### Text Communication
**Chat Options:**
- Team chat
- Quick commands
- Tactical markers
- Emote system

### Ping System
**Marking Tools:**
- Location pings
- Enemy markers
- Objective indicators
- Resource locations

## Matchmaking Systems

### Team Formation
**Options:**
- **Quick Match**: Random team assignment
- **Friends Only**: Private matches
- **Ranked Play**: Skill-based matching
- **Custom Games**: User-defined rules

### Skill Matching
**Factors:**
- Individual combat rating
- Banner command experience
- Cooperation score
- Win/loss ratio

## Progression Sharing

### Shared Rewards
**Team Benefits:**
- Collective XP bonuses
- Shared achievement progress
- Team milestone rewards
- Cooperation multipliers

### Individual Tracking
**Personal Progress:**
- Individual statistics maintained
- Personal unlocks separate
- Skill rating independent
- Achievement tracking

## Multiplayer Modes

### Standard Cooperation
**2-4 Players:**
- Each controls 1 Knight
- Shared AI Banner-mates
- Democratic decisions
- Collective victory

### Company Mode
**Advanced Coordination:**
- One Company Commander
- Multiple Banner squads
- Strategic layer enabled
- Complex objectives

### Competitive Variants
**Optional Modes:**
- **Race Mode**: Compete for most Fractures sealed
- **Score Attack**: Highest elimination count
- **Survival**: Last Banner standing
- **Time Trial**: Fastest victory

## Connection Management

### Host Migration
**Stability Features:**
- Automatic host selection
- Seamless migration on disconnect
- Progress preservation
- Rejoin capability

### Latency Compensation
**Network Features:**
- Client-side prediction
- Lag compensation
- Regional servers
- Ping indicators

## Etiquette Guidelines

### Cooperation Best Practices
1. Communicate intentions clearly
2. Respect democratic decisions
3. Share resources fairly
4. Support struggling teammates

### Commander Guidelines
- Lead by example
- Explain tactical decisions
- Accept feedback gracefully
- Rotate command role

## Troubleshooting

### Common Issues
**Connection Problems:**
- Check NAT settings
- Verify firewall permissions
- Test network stability
- Update game client

**Coordination Issues:**
- Use ping system if no mic
- Establish roles early
- Agree on objectives
- Respect playstyles

## Tips for Multiplayer Success

### Team Coordination
1. Assign Banner specializations
2. Establish resource priorities
3. Plan Fracture sequence
4. Coordinate ability usage

### Leadership Excellence
- Clear communication
- Strategic planning
- Flexible adaptation
- Team encouragement

## Related Systems
- [Banner Command](cosmic-knights-banner-command) - AI coordination mechanics
- [Democratic Voting](cosmic-knights-democratic-voting-system) - Detailed voting system
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource sharing
- [Fracture Warfare](cosmic-knights-fracture-warfare-sealing) - Cooperative objectives

*Multiplayer Systems enhance cooperative gameplay when multiple human players participate, adding strategic depth while maintaining individual agency in the revolutionary framework.*`;

createOrUpdatePage(
  'cosmic-knights-multiplayer-systems',
  'Multiplayer Systems',
  multiplayerSystemsContent,
  'Consolidated multiplayer features'
);

// 8. CORRUPTION PRESSURE (rename from environmental-corruption)
console.log('\n📄 Updating Corruption Pressure page...');

const corruptionContent = getPageContent('cosmic-knights-environmental-corruption');
const updatedCorruptionContent = corruptionContent
  .replace('# Environmental Corruption System', '# Corruption Pressure')
  .replace('The **Environmental Corruption System**', 'The **Corruption Pressure** system');

createOrUpdatePage(
  'cosmic-knights-corruption-pressure',
  'Corruption Pressure',
  updatedCorruptionContent,
  'Renamed for clarity'
);

// 9. LEVEL ENVIRONMENTS (merge 3 level design pages)
console.log('\n📄 Creating unified Level Environments page...');

const levelDesign1 = getPageContent('level-design');
const levelDesign2 = getPageContent('cosmic-knights-level-design');

const levelEnvironmentsContent = `# Level Environments
*Map Design, Environmental Features, and Tactical Terrain*

## Overview

Cosmic Knights maps blend alien architecture with tactical design, creating battlefields that support Banner cooperation while providing strategic depth. Every environment tells a story while serving gameplay needs through careful layout, lighting, and interactive elements.

## Core Design Principles

### Illuminated Battlefields
**Visibility Philosophy:**
- **Always Well-Lit**: No excessive darkness obscuring combat
- **Clear Sightlines**: Tactical awareness through good visibility
- **Atmospheric Lighting**: Alien environments without sacrificing clarity
- **Progressive Dimming**: Corruption affects lighting gradually

**Lighting Elements:**
- Bioluminescent alien flora
- Crystalline formations providing glow
- Technological light sources
- Environmental energy effects

### Alien Architecture
**Environmental Storytelling:**
- **Non-Human Construction**: Organic curves and impossible geometry
- **Advanced Technology**: Integrated systems within structures
- **Cultural Indicators**: Environmental hints about alien civilization
- **Mysterious Purpose**: Structures suggesting unknown functions

**Architectural Features:**
- Flowing organic passages
- Crystalline growth structures
- Geometric impossibilities
- Energy field barriers

## Map Structure

### Size and Scale
**Map Dimensions:**
- **Small Maps**: 500x500 meters (quick 10-minute matches)
- **Medium Maps**: 750x750 meters (standard 15-minute matches)
- **Large Maps**: 1000x1000 meters (extended 20-minute matches)
- **Vertical Space**: 3-4 elevation levels

### Zone Design
**Area Types:**
- **Central Hubs**: Open combat areas for major battles
- **Corridors**: Connecting passages for tactical movement
- **Defensive Points**: Fortifiable positions for Banner operations
- **Resource Zones**: Crystal-rich areas requiring security

### Fracture Placement
**Strategic Distribution:**
- 7 Fractures per map regardless of size
- Distributed to encourage exploration
- Varying difficulty based on position
- Environmental storytelling through placement

## Environmental Features

### Interactive Elements
**Tactical Opportunities:**
- **Destructible Cover**: Temporary protection that degrades
- **Environmental Hazards**: Alien machinery that damages all
- **Activation Systems**: Switches controlling doors and bridges
- **Resource Nodes**: Crystal deposits for mining

### Trap Systems
**Integrated Dangers:**
- **Crushing Mechanisms**: Timed hazards requiring careful navigation
- **Energy Fields**: Damage zones that activate periodically
- **Gravity Anomalies**: Areas affecting movement and combat
- **Toxic Pools**: Environmental damage requiring avoidance

**Trap Interaction:**
- Player-triggered activation
- Affects skeletons equally
- Strategic positioning opportunities
- Risk/reward resource placement

### Dynamic Elements
**Changing Battlefield:**
- **Corruption Spread**: Visual environmental degradation
- **Fracture Effects**: Active portals affecting nearby areas
- **Structural Collapse**: Progressive destruction from combat
- **Weather Systems**: Environmental effects affecting visibility

## Biome Varieties

### Crystal Caverns
**Underground Environments:**
- Bioluminescent crystal formations
- Natural cave systems with alien modifications
- Reflective surfaces affecting visibility
- Vertical shafts for multi-level combat

### Alien Ruins
**Ancient Structures:**
- Partially collapsed architecture
- Overgrown with alien vegetation
- Hidden passages and secrets
- Environmental storytelling elements

### Tech Facilities
**Advanced Installations:**
- Functional alien machinery
- Energy barriers and shields
- Automated defense systems
- Industrial hazard zones

### Organic Hives
**Living Environments:**
- Biological architecture
- Reactive environment systems
- Organic growth obstacles
- Symbiotic lighting organisms

## Tactical Design

### Banner Specialization Support
**Area Design for Roles:**
- **Assault Zones**: Open areas for mobile combat
- **Guardian Points**: Defensible positions with cover
- **Siege Positions**: Elevated areas for long-range support
- **Recon Paths**: Alternative routes for flexible positioning

### Choke Points
**Strategic Bottlenecks:**
- Controlled engagement zones
- Defensive advantage positions
- Resource funnel areas
- Objective approach paths

### Flanking Routes
**Alternative Paths:**
- Multiple approaches to objectives
- Risk/reward route choices
- Hidden passages for tactical surprise
- Vertical movement options

## Environmental Storytelling

### Visual Narrative
**Story Through Environment:**
- Battle damage from previous conflicts
- Alien civilization remnants
- Knight equipment scattered about
- Progressive corruption evidence

### Audio Atmosphere
**Environmental Sound:**
- Ambient alien atmosphere
- Structural creaking and groaning
- Energy field humming
- Distant skeleton sounds

### Lore Integration
**World Building:**
- Terminal entries about locations
- Environmental clues about purpose
- Visual hints about alien culture
- Connection to larger narrative

## Performance Optimization

### LOD Systems
**Level of Detail:**
- Distance-based detail reduction
- Maintained tactical clarity
- Optimized for large battles
- Platform-specific adjustments

### Occlusion Culling
**Rendering Efficiency:**
- Hidden geometry not rendered
- Smart visibility calculation
- Performance during intense combat
- Support for many skeletons

## Map Flow

### Navigation Design
**Player Guidance:**
- Intuitive pathfinding without markers
- Visual landmarks for orientation
- Lighting guides to objectives
- Environmental flow indicators

### Pacing Control
**Combat Rhythm:**
- Alternating intense and calm areas
- Resource zones between battles
- Defensive positions at objectives
- Breathing room design

## Corruption Integration

### Progressive Degradation
**Environmental Change:**
- Darkening atmosphere
- Structural decay effects
- Spreading corruption visuals
- Gameplay impact visualization

### Restoration Rewards
**Success Feedback:**
- Dramatic lighting improvement
- Environmental healing effects
- Cleared corruption zones
- Victory transformation

## Design Tips

### Creating Tension
- Limited visibility corners
- Elevation advantages
- Resource scarcity areas
- Time pressure zones

### Supporting Cooperation
- Wide defensive positions
- Multiple angle coverage
- Shared resource zones
- Revival-safe areas

## Related Systems
- [Corruption Pressure](cosmic-knights-corruption-pressure) - Environmental degradation mechanics
- [Fracture Warfare](cosmic-knights-fracture-warfare-sealing) - Objective placement
- [Banner Command](cosmic-knights-banner-command) - Tactical position support
- [Crystal Economy](cosmic-knights-crystal-economy) - Resource node placement

*Level Environments create the alien battlefields where Banner operations unfold, balancing tactical gameplay with atmospheric storytelling in the revolutionary cooperative framework.*`;

createOrUpdatePage(
  'cosmic-knights-level-environments',
  'Level Environments',
  levelEnvironmentsContent,
  'Unified environmental design documentation'
);

// 10. Clean up old/duplicate pages
console.log('\n🗑️  Removing redundant pages...');

const pagesToRemove = [
  'player-mechanics',
  'abilities-system',
  'level-design',
  'cosmic-knights-level-design',
  'development-guidelines',
  'cosmic-knights-democratic-voting-system',
  'cosmic-knights-knight-possession-system',
  'cosmic-knights-environmental-corruption',
];

pagesToRemove.forEach(slug => {
  try {
    // Get page ID
    const page = db.prepare('SELECT id FROM wiki_pages WHERE slug = ?').get(slug);
    if (page) {
      // Remove from categories
      db.prepare('DELETE FROM wiki_page_categories WHERE page_id = ?').run(page.id);
      // Remove revisions
      db.prepare('DELETE FROM wiki_revisions WHERE page_id = ?').run(page.id);
      // Remove page
      db.prepare('DELETE FROM wiki_pages WHERE id = ?').run(page.id);
      console.log(`✅ Removed: ${slug}`);
    }
  } catch (error) {
    console.error(`❌ Error removing ${slug}: ${error.message}`);
  }
});

// Final summary
console.log('\n📊 REORGANIZATION COMPLETE!');
console.log('\nNew Structure:');
console.log('CORE GAMEPLAY:');
console.log('  ✅ Cosmic Knights Overview');
console.log('  ✅ Knight Combat');
console.log('  ✅ Special Abilities');
console.log('  ✅ Progression & Unlocks');
console.log('  ✅ Controls');
console.log('\nBANNER SYSTEMS:');
console.log('  ✅ Banner Command');
console.log('  ✅ AI Learning');
console.log('\nMULTIPLAYER:');
console.log('  ✅ Multiplayer Systems');
console.log('\nTACTICAL SYSTEMS:');
console.log('  ✅ Crystal Economy');
console.log('  ✅ Fracture Warfare & Sealing');
console.log('  ✅ Skeleton Hordes');
console.log('  ✅ Corruption Pressure');
console.log('\nWEAPONS: (6 individual pages)');
console.log('\nWORLD:');
console.log('  ✅ Level Environments');

db.close();
