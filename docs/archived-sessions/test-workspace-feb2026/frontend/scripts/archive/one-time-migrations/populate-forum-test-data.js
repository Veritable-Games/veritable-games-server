/**
 * Forum Test Data Population Script
 *
 * Creates realistic test topics and replies for all forum categories
 * Contextualized to actual Veritable Games projects
 */

const Database = require('better-sqlite3');
const path = require('path');

// Database paths
const FORUMS_DB = path.join(__dirname, '../data/forums.db');

const db = new Database(FORUMS_DB);

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

console.log('📝 Populating forum test data...\n');

// Helper to create timestamps
const daysAgo = days => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

const hoursAgo = hours => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

// Test data structure
const testData = [
  // ========== FORUM RULES (Category 1) ==========
  {
    category_id: 1,
    user_id: 1,
    title: 'Welcome to the Veritable Games Community!',
    content: `Welcome to our community forums!

This is a space for discussing all Veritable Games projects including NOXII, AUTUMN, and our experimental universal systems. We're excited to have you here!

**Quick Guidelines:**
- Be respectful and constructive
- Stay on-topic within categories
- Share your creativity and feedback
- Help fellow community members
- Report issues to moderators

Looking forward to seeing your contributions!`,
    status: 'open',
    is_pinned: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
    replies: [
      {
        user_id: 3,
        content:
          'Thanks for the warm welcome! Really excited to be part of this community. The projects look amazing!',
        created_at: daysAgo(29),
      },
      {
        user_id: 5,
        content: 'Been following NOXII development for a while. Stoked to finally join the forums!',
        created_at: daysAgo(28),
      },
    ],
  },
  {
    category_id: 1,
    user_id: 3,
    title: 'Question about posting mod files',
    content: `Hi everyone! I've created a custom map for NOXII and want to share it in the Maps & Mods section.

What's the recommended way to share files? Should I:
1. Host on external site and link?
2. Include download links in the post?
3. Provide GitHub repository?

Thanks for the guidance!`,
    status: 'solved',
    created_at: daysAgo(25),
    updated_at: daysAgo(24),
    replies: [
      {
        user_id: 1,
        content: `Great question! For mod files, we recommend:

1. **Host on GitHub** - Best for version control and community contributions
2. **Include clear installation instructions** in your post
3. **Add screenshots/videos** to showcase your work
4. **List any dependencies** or required game versions

Looking forward to seeing your map!`,
        is_solution: true,
        created_at: daysAgo(24),
      },
    ],
  },

  // ========== NOXII GENERAL DISCUSSION (Category 2) ==========
  {
    category_id: 2,
    user_id: 5,
    title: 'The "Anarchist Infiltrator" backstory is brilliant',
    content: `Just dove into the NOXII lore and I'm completely hooked on the premise.

A former Colonial Officer who becomes an anarchist, then *voluntarily gets recaptured* to help prisoners escape? That's such a compelling setup for a character-driven narrative.

The tension between:
- Maintaining cover while competing in death games
- Building relationships that affect survival
- Buying time for the resistance
- Putting on a spectacle for millions of viewers

...creates so many interesting gameplay opportunities. How much of the social manipulation will be player-driven vs scripted?`,
    status: 'open',
    is_pinned: false,
    view_count: 127,
    created_at: daysAgo(15),
    updated_at: hoursAgo(8),
    replies: [
      {
        user_id: 2,
        content: `Thanks for the enthusiasm! The social dynamics are actually a core pillar of NOXII's design.

We're aiming for a hybrid approach:
- **Core relationships** have scripted story beats
- **Alliance formation** is mostly player-driven
- **Betrayals and sacrifices** emerge from your choices
- **Crowd favor** dynamically responds to your performance

The idea is that every match tells a unique story based on who you trust, who you sacrifice, and how you play the spectacle.`,
        created_at: daysAgo(14),
      },
      {
        user_id: 4,
        content: `This is giving me big Hunger Games meets Prison Break vibes, but with way more player agency. Will there be a faction system for the resistance vs. the colonizers?`,
        created_at: daysAgo(13),
      },
      {
        user_id: 2,
        content: `Yes! Factions play a role in the meta-narrative. Your actions in the arena affect resistance operations outside. But we don't want to spoil too much yet 😉`,
        created_at: hoursAgo(8),
      },
    ],
  },
  {
    category_id: 2,
    user_id: 3,
    title: 'Skydiving mechanics - how realistic are we going?',
    content: `Competitive skydiving death games sounds absolutely wild as a core mechanic.

Are we talking:
- Realistic physics and terminal velocity?
- Arcade-style with power-ups and boosts?
- Somewhere in between?

Also curious about the verticality - are arenas designed as vertical playgrounds, or is skydiving mainly for dramatic entrances/escapes?`,
    status: 'open',
    view_count: 89,
    created_at: daysAgo(12),
    updated_at: daysAgo(11),
    replies: [
      {
        user_id: 2,
        content: `Great questions! We're leaning toward "grounded but stylish" physics:

**Skydiving:**
- Based on real terminal velocity and drag
- Special gear allows limited air control
- Environmental hazards (wind shears, obstacles)
- Coordinated team dives create tactical advantages

**Arena Design:**
- Massive vertical structures (think mega-prisons)
- Multiple altitude tiers with different objectives
- Some matches start with a dive, others have launch points
- Verticality creates risk/reward gameplay

Think more "Titanfall 2 movement" than "realistic simulator"`,
        created_at: daysAgo(11),
      },
    ],
  },
  {
    category_id: 2,
    user_id: 4,
    title: 'Will there be a demo or alpha test?',
    content: `Hey devs! Any plans for community testing? Would love to help stress-test the multiplayer systems and provide feedback.`,
    status: 'open',
    view_count: 156,
    created_at: daysAgo(8),
    updated_at: daysAgo(7),
    replies: [
      {
        user_id: 2,
        content: `We're planning a closed alpha for community members later this year. Keep an eye on announcements here and our Discord!`,
        created_at: daysAgo(7),
      },
      {
        user_id: 5,
        content: 'Sign me up! I have experience with alpha testing from other competitive games.',
        created_at: daysAgo(7),
      },
    ],
  },

  // ========== NOXII MODDING (Category 3) ==========
  {
    category_id: 3,
    user_id: 4,
    title: '[TUTORIAL] Setting up the NOXII modding environment',
    content: `Quick guide for anyone wanting to start modding NOXII!

**Prerequisites:**
- NOXII dev build (available to alpha testers)
- Unity 2022.3 LTS
- Visual Studio Code or your preferred IDE

**Steps:**
1. Clone the mod template from GitHub
2. Import your Unity project
3. Set up the NOXII SDK reference
4. Create your mod manifest

**Useful Resources:**
- Official SDK documentation
- Community modding Discord
- Example mods repository

Drop questions below and I'll help out! Also planning a video tutorial if there's interest.`,
    status: 'open',
    is_pinned: true,
    view_count: 234,
    created_at: daysAgo(20),
    updated_at: daysAgo(3),
    replies: [
      {
        user_id: 3,
        content:
          'This is super helpful! Any chance you could cover custom character skins in the video tutorial?',
        created_at: daysAgo(19),
      },
      {
        user_id: 4,
        content: 'Absolutely! Custom character models will be part 2 of the series.',
        is_solution: false,
        created_at: daysAgo(18),
      },
      {
        user_id: 5,
        content: `Quick question - are we allowed to create custom arenas, or only modify existing ones?`,
        created_at: daysAgo(3),
      },
    ],
  },
  {
    category_id: 3,
    user_id: 5,
    title: 'Custom weapon balancing - best practices?',
    content: `Working on a mod that adds new weapon types to NOXII. What are the community's thoughts on balancing custom weapons?

Should we:
- Match the TTK (time-to-kill) of vanilla weapons?
- Create unique niches that don't overlap?
- Focus on fun over perfect balance?

Don't want to create something overpowered that ruins matches.`,
    status: 'open',
    view_count: 67,
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
    replies: [
      {
        user_id: 4,
        content: `I'd say create unique niches! NOXII's design already has a lot of variety, so adding weapons that feel different (not just stat variations) is more interesting.

That said, definitely playtest in custom matches before public release.`,
        created_at: daysAgo(5),
      },
    ],
  },

  // ========== MAPS & MODS (Category 4) ==========
  {
    category_id: 4,
    user_id: 3,
    title: '[MAP RELEASE] "Vertical Descent" - Prison Tower Arena',
    content: `**Vertical Descent** is now available!

A massive prison tower with 15 vertical tiers. Each tier has unique environmental hazards and escape routes. Designed for 8-12 players.

**Features:**
- Start at the top, fight your way down
- Collapsing floors create dynamic battlefield changes
- Multiple zipline and jump-pad routes
- Loot scattered across all tiers
- Final arena at the bottom with crowd spectators

**Download:** [GitHub Link]
**Installation:** Extract to /NOXII/CustomMaps/
**Recommended Players:** 8-12

Screenshots and gameplay video coming soon! Feedback welcome.`,
    status: 'open',
    view_count: 312,
    created_at: daysAgo(10),
    updated_at: hoursAgo(12),
    replies: [
      {
        user_id: 5,
        content:
          'Holy shit, just played this with some friends. The collapsing floors are INTENSE. Great work!',
        created_at: daysAgo(9),
      },
      {
        user_id: 4,
        content: `This is brilliant! Love how the verticality forces aggressive play.

One suggestion: tier 7 seems to have a camping spot that's too strong. Maybe add another entrance?`,
        created_at: daysAgo(8),
      },
      {
        user_id: 3,
        content:
          'Thanks for the feedback! Yeah I noticed that too. Working on a v1.1 update to address the camping issues.',
        created_at: hoursAgo(12),
      },
    ],
  },
  {
    category_id: 4,
    user_id: 4,
    title: '[MOD] Enhanced Spectator Mode',
    content: `Released a mod that improves the spectator experience for NOXII matches!

**Features:**
- Free camera with smooth movement
- Player highlight system
- Kill feed enhancements
- Match statistics overlay
- Instant replay system (last 10 seconds)

Perfect for content creators or anyone who wants to record matches.

**Download & Installation:** [GitHub]
**Compatible with:** NOXII v0.8.x`,
    status: 'open',
    view_count: 178,
    created_at: daysAgo(5),
    updated_at: daysAgo(4),
    replies: [
      {
        user_id: 2,
        content: `This is excellent work! We might actually integrate some of these features into the base game.

Would you be interested in collaborating on the official spectator mode?`,
        created_at: daysAgo(4),
      },
      {
        user_id: 4,
        content: `Absolutely! DMing you on Discord.`,
        created_at: daysAgo(4),
      },
    ],
  },

  // ========== AUTUMN DEVELOPMENT (Category 5) ==========
  {
    category_id: 5,
    user_id: 2,
    title: '[DEV UPDATE] AUTUMN Pre-Production Progress - November',
    content: `Hey everyone! Time for a development update on Project AUTUMN.

**What we've been working on:**

🍂 **Narrative Design:**
- Fleshed out the relationship dynamics between the seasonal sisters
- Created dialogue trees for library interactions
- Developed Mother Nature and Father Fortune backstories

📚 **Environment Art:**
- Autumn's library is taking shape (concept art attached)
- Cozy lighting system for different times of day
- Interactive book system prototyping

🎵 **Audio:**
- Commissioned original soundtrack
- Working with foley artists for environmental sounds
- Testing spatial audio for library ambience

**Next Steps:**
- Character model refinement for Autumn
- Puzzle design for exploration mechanics
- Season transition system prototyping

What features are you most excited about? Any suggestions?`,
    status: 'open',
    is_pinned: true,
    view_count: 445,
    created_at: daysAgo(7),
    updated_at: hoursAgo(3),
    replies: [
      {
        user_id: 3,
        content: `This sounds magical! Will we get to interact with all the sisters, or is it mainly Autumn?

Also, LOVE the idea of a cozy library setting. Are there different sections (fiction, history, etc.)?`,
        created_at: daysAgo(6),
      },
      {
        user_id: 2,
        content: `Yes! Each sister will have her own domain:
- Autumn: The Library (knowledge and memories)
- Spring: The Garden (growth and renewal)
- Summer: The Beach (joy and freedom)
- Winter: The Observatory (reflection and planning)

You'll visit each area, and the sisters help each other through challenges.`,
        created_at: daysAgo(6),
      },
      {
        user_id: 5,
        content:
          'The environmental audio is such an underrated aspect of cozy games. Will there be rain sounds against the library windows?',
        created_at: daysAgo(5),
      },
      {
        user_id: 2,
        content:
          "Of course! Dynamic weather with location-specific audio. Autumn rain on library windows is basically mandatory for the vibe we're going for 🍂",
        created_at: hoursAgo(3),
      },
    ],
  },
  {
    category_id: 5,
    user_id: 3,
    title: 'Feature Request: Photo mode for AUTUMN',
    content: `Given how gorgeous the library and seasonal environments are looking, it would be amazing to have a photo mode!

Features that would be cool:
- Pause and free camera
- Filters (vintage, sepia, etc.)
- Hide UI toggle
- Depth of field adjustments
- Time of day selector

Would love to capture screenshots of cozy moments in the library.`,
    status: 'open',
    view_count: 123,
    created_at: daysAgo(4),
    updated_at: daysAgo(3),
    replies: [
      {
        user_id: 2,
        content: `This is a great idea! Photo mode is actually on our wishlist already. The library is designed to be screenshot-worthy, so we want to make that easy.

Adding it to our feature backlog for post-launch or late beta.`,
        created_at: daysAgo(3),
      },
      {
        user_id: 4,
        content: 'Yes please! Also maybe a way to share photos in-game or to a community gallery?',
        created_at: daysAgo(3),
      },
    ],
  },

  // ========== OFF-TOPIC (Category 6) ==========
  {
    category_id: 6,
    user_id: 5,
    title: 'What games are you playing while waiting for VG releases?',
    content: `Curious what the community is playing in the meantime!

I've been rotating between:
- Risk of Rain 2 (for the vertical movement itch)
- Hades (for that tight combat feel)
- A Short Hike (cozy vibes)

What about you all?`,
    status: 'open',
    view_count: 201,
    created_at: daysAgo(9),
    updated_at: hoursAgo(6),
    replies: [
      {
        user_id: 3,
        content: `Ooh, if you like cozy games, try Coffee Talk and Unpacking. Both are perfect for the AUTUMN vibe.

For action, I've been grinding Apex Legends to practice movement mechanics.`,
        created_at: daysAgo(8),
      },
      {
        user_id: 4,
        content:
          'Titanfall 2 campaign is fantastic for movement FPS. Also Deep Rock Galactic for the co-op fun.',
        created_at: daysAgo(8),
      },
      {
        user_id: 5,
        content:
          'Adding all of these to my wishlist. Coffee Talk looks perfect for rainy evenings.',
        created_at: hoursAgo(6),
      },
    ],
  },
  {
    category_id: 6,
    user_id: 3,
    title: 'Community Game Night - This Friday?',
    content: `Hey everyone! Would anyone be interested in a community game night this Friday (8 PM EST)?

We could play:
- Custom NOXII matches (for alpha testers)
- Among Us
- Jackbox Party Pack
- Or suggest something!

Drop a comment if you're interested and what you'd like to play!`,
    status: 'open',
    view_count: 167,
    created_at: daysAgo(2),
    updated_at: hoursAgo(1),
    replies: [
      {
        user_id: 5,
        content: "I'm in! Vote for custom NOXII matches to test some new maps.",
        created_at: daysAgo(2),
      },
      {
        user_id: 4,
        content: 'Count me in too! Jackbox would be fun for a bigger group.',
        created_at: daysAgo(1),
      },
      {
        user_id: 3,
        content: "Awesome! I'll set up a Discord event. We can do NOXII first, then Jackbox after.",
        created_at: hoursAgo(1),
      },
    ],
  },
];

// Insert topics and replies
const insertTopic = db.prepare(`
  INSERT INTO forum_topics (
    category_id, user_id, title, content, status, is_pinned,
    view_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertReply = db.prepare(`
  INSERT INTO forum_replies (
    topic_id, user_id, content, is_solution, created_at
  ) VALUES (?, ?, ?, ?, ?)
`);

const updateTopicStats = db.prepare(`
  UPDATE forum_topics
  SET reply_count = ?, last_activity_at = ?, updated_at = ?
  WHERE id = ?
`);

const updateCategoryStats = db.prepare(`
  UPDATE forum_categories
  SET topic_count = topic_count + 1,
      reply_count = reply_count + ?
  WHERE id = ?
`);

let totalTopics = 0;
let totalReplies = 0;

db.transaction(() => {
  testData.forEach(topic => {
    // Insert topic
    const result = insertTopic.run(
      topic.category_id,
      topic.user_id,
      topic.title,
      topic.content,
      topic.status,
      topic.is_pinned ? 1 : 0,
      topic.view_count || 0,
      topic.created_at,
      topic.updated_at
    );

    const topicId = result.lastInsertRowid;
    totalTopics++;

    console.log(`✅ Created topic: "${topic.title}" (ID: ${topicId})`);

    // Insert replies
    if (topic.replies && topic.replies.length > 0) {
      let lastReplyDate = topic.created_at;

      topic.replies.forEach(reply => {
        insertReply.run(
          topicId,
          reply.user_id,
          reply.content,
          reply.is_solution ? 1 : 0,
          reply.created_at
        );
        totalReplies++;
        lastReplyDate = reply.created_at;
        console.log(`  💬 Added reply by user ${reply.user_id}`);
      });

      // Update topic stats
      updateTopicStats.run(topic.replies.length, lastReplyDate, lastReplyDate, topicId);
    }

    // Update category stats
    updateCategoryStats.run(topic.replies ? topic.replies.length : 0, topic.category_id);
  });
})();

console.log(`\n✨ Done! Created ${totalTopics} topics with ${totalReplies} replies`);
console.log('\n📊 Category Summary:');

const categoryStats = db
  .prepare(
    `
  SELECT
    c.name,
    c.topic_count,
    c.reply_count,
    c.section
  FROM forum_categories c
  ORDER BY c.sort_order
`
  )
  .all();

categoryStats.forEach(cat => {
  console.log(
    `  ${cat.section} > ${cat.name}: ${cat.topic_count} topics, ${cat.reply_count} replies`
  );
});

db.close();
console.log('\n✅ Forum test data populated successfully!');
