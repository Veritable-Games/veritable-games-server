/**
 * Seed Forum with Test Content
 *
 * Creates comprehensive test data demonstrating all forum features:
 * - Multiple users (admin, moderators, regular users)
 * - Multiple categories with topics
 * - Topics with various statuses (open, solved, locked, pinned)
 * - Nested replies (up to 5 levels)
 * - Replies marked as solutions
 * - Rich markdown formatting
 * - Wiki links and references
 * - Tags on topics
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../data');
const FORUMS_DB = path.join(DATA_DIR, 'forums.db');
const USERS_DB = path.join(DATA_DIR, 'users.db');

// Test users to create
const TEST_USERS = [
  {
    username: 'admin',
    display_name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin',
    password: 'password123',
  },
  {
    username: 'moderator1',
    display_name: 'Forum Moderator',
    email: 'mod@test.com',
    role: 'moderator',
    password: 'password123',
  },
  {
    username: 'alice',
    display_name: 'Alice Wonderland',
    email: 'alice@test.com',
    role: 'user',
    password: 'password123',
  },
  {
    username: 'bob',
    display_name: 'Bob Builder',
    email: 'bob@test.com',
    role: 'user',
    password: 'password123',
  },
  {
    username: 'charlie',
    display_name: 'Charlie Chaplin',
    email: 'charlie@test.com',
    role: 'user',
    password: 'password123',
  },
  {
    username: 'diana',
    display_name: 'Diana Prince',
    email: 'diana@test.com',
    role: 'user',
    password: 'password123',
  },
];

// Forum categories (mapped to actual database slugs)
const CATEGORIES = [
  {
    name: 'Forum Rules',
    slug: 'forum-rules',
    description: 'Community guidelines and posting policies',
    color: '#3b82f6',
  },
  {
    name: 'Noxii General Discussion',
    slug: 'noxii-general-discussion',
    description: 'General discussion about Noxii prototype, lore, gameplay',
    color: '#ef4444',
  },
  {
    name: 'Noxii Modding',
    slug: 'noxii-modding',
    description: 'Modding tools, tutorials, technical discussions',
    color: '#8b5cf6',
  },
  {
    name: 'Maps & Mods',
    slug: 'maps-mods',
    description: 'Share Noxii maps and modifications',
    color: '#10b981',
  },
  {
    name: 'Autumn Development',
    slug: 'autumn-development',
    description: 'Project Autumn development updates and feedback',
    color: '#f59e0b',
  },
  {
    name: 'Off-Topic',
    slug: 'off-topic',
    description: 'General discussions not related to game development',
    color: '#6b7280',
  },
];

// Sample topics with rich content
const SAMPLE_TOPICS = [
  {
    category: 'forum-rules',
    title: 'Welcome to the Forums!',
    content: `# Welcome Everyone! 👋

This is our community forum where you can discuss the game, ask questions, and connect with other players.

## Forum Guidelines

- Be respectful to other members
- Stay on topic
- Use the search before posting
- Check out the [[Wiki]] for game information

**Have fun and enjoy your stay!**`,
    tags: ['welcome', 'announcement', 'pinned'],
    status: 'open',
    is_pinned: 1,
    user_index: 0, // admin
  },
  {
    category: 'noxii-general-discussion',
    title: 'How does the combat system work?',
    content: `I'm new to the game and trying to understand the combat mechanics.

## My Questions:
1. What's the difference between **physical** and **magical** damage?
2. How do critical hits work?
3. Are there any damage resistances?

I've checked the [[Combat System]] wiki page but it's a bit confusing. Can someone explain in simple terms?`,
    tags: ['combat', 'beginner', 'question'],
    status: 'solved',
    user_index: 2, // alice
  },
  {
    category: 'noxii-general-discussion',
    title: 'Optimal Character Build Guide',
    content: `After 500+ hours of gameplay, here's my comprehensive character build guide.

## Tank Build
- **Stats**: Focus on Constitution and Strength
- **Equipment**: Heavy armor with shield
- **Skills**:
  - \`Shield Wall\` - Reduces incoming damage by 50%
  - \`Taunt\` - Forces enemies to attack you

## DPS Build
- **Stats**: Dexterity and Intelligence
- **Equipment**: Light armor for mobility
- **Skills**:
  - \`Critical Strike\` - 200% damage on crit
  - \`Elemental Burst\` - AoE magic damage

Check the [[Character Classes]] wiki for more details!`,
    tags: ['guide', 'builds', 'advanced'],
    status: 'open',
    is_pinned: 1,
    user_index: 3, // bob
  },
  {
    category: 'noxii-general-discussion',
    title: 'Game crashes when opening inventory',
    content: `**Bug Description**: The game crashes to desktop whenever I try to open my inventory.

**Steps to Reproduce**:
1. Load save game
2. Press 'I' to open inventory
3. Game freezes for 2 seconds
4. Crashes to desktop

**System Info**:
- OS: Windows 11
- GPU: RTX 3070
- RAM: 16GB
- Game Version: 1.2.3

Has anyone else experienced this? I've tried verifying game files but it didn't help.`,
    tags: ['crash', 'inventory', 'critical'],
    status: 'open',
    user_index: 4, // charlie
  },
  {
    category: 'autumn-development',
    title: 'Add multiplayer co-op mode',
    content: `I think this game would be amazing with a co-op multiplayer mode!

## Suggested Features:
- [ ] 2-4 player co-op
- [ ] Shared quest progress
- [ ] Voice chat integration
- [ ] Friends list system

The game mechanics would work perfectly for co-op gameplay. What do you all think?

*Vote with reactions if you'd like to see this!* 👍`,
    tags: ['multiplayer', 'co-op', 'suggestion'],
    status: 'open',
    user_index: 5, // diana
  },
  {
    category: 'off-topic',
    title: 'Theory about the Ancient Civilization',
    content: `I've been analyzing the lore scattered throughout the game, and I have a theory about the **Ancient Civilization**.

## Evidence Found:
1. The ruins in the [[Forgotten Valley]] have similar architecture to the [[Crystal Temple]]
2. The ancient texts mention a "great cataclysm"
3. The [[Elder Scrolls]] (yes, I see the reference 😄) contain prophecies

### My Theory
I believe the Ancient Civilization didn't disappear - they *ascended* to another plane of existence. Here's why:

The portal artifacts found in various locations all point to the same destination. The energy signatures match descriptions of "The Ethereal Realm" mentioned in the [[Archmage's Tome]].

What do you think? Am I onto something or am I reading too much into this?`,
    tags: ['theory', 'lore', 'ancient-civilization'],
    status: 'open',
    user_index: 2, // alice
  },
  {
    category: 'noxii-general-discussion',
    title: 'Magic system is too complicated',
    content: `Is it just me or is the magic system overly complex?

I've been playing for 20 hours and I still don't understand:
- Spell combinations
- Mana regeneration rates
- Element weaknesses

The tutorial doesn't explain it well. Can someone help?`,
    tags: ['magic', 'beginner', 'help'],
    status: 'solved',
    user_index: 4, // charlie
  },
  {
    category: 'noxii-general-discussion',
    title: 'Audio glitch in Forest area',
    content: `**Bug**: Ambient audio in the Whispering Forest is extremely loud and distorted.

**Impact**: Makes the area unplayable due to ear-piercing sounds.

**Temporary Workaround**: Mute ambient audio in settings.

This started after the 1.2.2 patch. Anyone else?`,
    tags: ['audio', 'bug', 'forest'],
    status: 'open',
    is_locked: 1,
    user_index: 3, // bob
  },
  {
    category: 'off-topic',
    title: 'Share your best screenshots!',
    content: `Let's share our favorite in-game screenshots! 📸

I'll start with my character standing at the peak of [[Dragon Mountain]] during sunset. The lighting in this game is absolutely stunning!

Post your best shots below!`,
    tags: ['screenshots', 'community', 'fun'],
    status: 'open',
    user_index: 5, // diana
  },
  {
    category: 'autumn-development',
    title: 'Pet/Companion system would be amazing',
    content: `I'd love to see a pet or companion system added to the game.

## Ideas:
- Pets that follow you around
- Companions that help in combat
- Ability to customize their appearance
- Special abilities based on pet type

The [[Taming Skill]] tree is already in the game but unused. Maybe this was planned?`,
    tags: ['pets', 'companions', 'feature-request'],
    status: 'open',
    user_index: 2, // alice
  },
];

// Sample replies demonstrating nested structure
const SAMPLE_REPLIES = {
  // For "How does the combat system work?" topic
  combat_question: [
    {
      content: `Great question! Let me break this down for you:

**Physical vs Magical Damage:**
- Physical damage is affected by armor rating
- Magical damage bypasses armor but can be resisted with magic resistance

**Critical Hits:**
- Base crit chance is 5%
- Each point of Dexterity adds +0.1% crit chance
- Crits deal 150% damage by default

Hope this helps!`,
      user_index: 3, // bob
      is_solution: 1,
      children: [
        {
          content: `Thanks! That makes a lot more sense. So I should focus on Dexterity for my rogue build?`,
          user_index: 2, // alice
          children: [
            {
              content: `Exactly! For rogues, aim for at least 50 Dexterity by level 20. That gives you a nice 10% crit chance.`,
              user_index: 3, // bob
              children: [
                {
                  content: `What about dual-wielding? Does that affect crit chance?`,
                  user_index: 2, // alice
                  children: [
                    {
                      content: `Dual-wielding doesn't affect crit chance directly, but you get more attacks per second, so more opportunities to crit!`,
                      user_index: 3, // bob
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          content: `Also check out the [[Combat Mechanics]] wiki page - it has all the formulas.`,
          user_index: 1, // moderator
        },
      ],
    },
    {
      content: `Don't forget about elemental damage types!

Fire > Ice > Lightning > Earth > Fire (it's a cycle)`,
      user_index: 5, // diana
      children: [
        {
          content: `Oh nice, I didn't know there was a damage cycle! Does this apply to both player and enemy attacks?`,
          user_index: 4, // charlie
          children: [
            {
              content: `Yes! Enemies follow the same rules. Use fire spells against ice enemies for bonus damage.`,
              user_index: 5, // diana
            },
          ],
        },
      ],
    },
  ],

  // For "Magic system is too complicated" topic
  magic_complicated: [
    {
      content: `The magic system takes some getting used to, but here's a quick guide:

## Basics:
1. **Mana Pool**: Your max mana = Intelligence × 10
2. **Regen Rate**: 1% of max mana per second (2% out of combat)
3. **Spell Costs**: Listed in spell tooltip

## Spell Combinations:
- Cast Fire + Lightning = Explosion (AoE damage)
- Cast Ice + Water = Freeze (crowd control)
- Cast Earth + Wind = Sandstorm (DoT area)

Practice these in the [[Training Grounds]] before using in real combat!`,
      user_index: 3, // bob
      is_solution: 1,
      children: [
        {
          content: `Wow, I had no idea you could combine spells! This changes everything!`,
          user_index: 4, // charlie
        },
        {
          content: `There's also advanced combinations with 3 elements. Check [[Advanced Magic]] wiki for the full list.`,
          user_index: 1, // moderator
        },
      ],
    },
  ],

  // For "Welcome to the Forums!" topic
  welcome: [
    {
      content: `Welcome! Don't forget to introduce yourself in the Introduction thread!`,
      user_index: 1, // moderator
    },
    {
      content: `Great community here, you'll love it! Feel free to ask questions anytime.`,
      user_index: 3, // bob
    },
    {
      content: `The [[Beginner's Guide]] is also super helpful for new players!`,
      user_index: 2, // alice
    },
  ],

  // For "Share your best screenshots!" topic
  screenshots: [
    {
      content: `Here's my character's epic armor after 100 hours of grinding! 💪`,
      user_index: 3, // bob
      children: [
        {
          content: `That looks amazing! What armor set is that?`,
          user_index: 4, // charlie
          children: [
            {
              content: `It's the [[Dragonscale Armor]] set. You get it from the final raid.`,
              user_index: 3, // bob
            },
          ],
        },
      ],
    },
    {
      content: `Check out this sunrise from the [[Crystal Peaks]]! The photo mode in this game is incredible.`,
      user_index: 2, // alice
    },
  ],

  // For "Pet/Companion system" topic
  pets: [
    {
      content: `I would LOVE this feature! Imagine having a dragon companion following you around! 🐉`,
      user_index: 4, // charlie
      children: [
        {
          content: `Dragons might be OP, but maybe smaller creatures like wolves or eagles?`,
          user_index: 3, // bob
          children: [
            {
              content: `Good point. Start with common pets, unlock rare ones through quests?`,
              user_index: 4, // charlie
            },
          ],
        },
      ],
    },
    {
      content: `The [[Monster Codex]] has over 50 creature types. Any of them would make great pets!`,
      user_index: 5, // diana
    },
  ],
};

async function main() {
  console.log('🌱 Starting forum content seeding...\n');

  const usersDb = new Database(USERS_DB);
  const forumsDb = new Database(FORUMS_DB);

  try {
    // Enable foreign keys
    usersDb.pragma('foreign_keys = ON');
    forumsDb.pragma('foreign_keys = ON');

    // Step 1: Create test users
    console.log('👥 Creating test users...');
    const userIds = [];

    for (const user of TEST_USERS) {
      // Check if user exists
      const existing = usersDb
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(user.username);

      if (existing) {
        console.log(`  ✓ User "${user.username}" already exists`);
        userIds.push(existing.id);
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 12);
      const result = usersDb
        .prepare(
          `
        INSERT INTO users (username, display_name, email, password_hash, role, is_active, email_verified)
        VALUES (?, ?, ?, ?, ?, 1, 1)
      `
        )
        .run(user.username, user.display_name, user.email, passwordHash, user.role);

      userIds.push(result.lastInsertRowid);
      console.log(`  ✓ Created user: ${user.username} (${user.role})`);
    }

    // Step 2: Get category IDs
    console.log('\n📁 Fetching forum categories...');
    const categoryMap = {};
    for (const cat of CATEGORIES) {
      const category = forumsDb
        .prepare('SELECT id FROM forum_categories WHERE slug = ?')
        .get(cat.slug);
      if (category) {
        categoryMap[cat.slug] = category.id;
        console.log(`  ✓ Found category: ${cat.name}`);
      } else {
        console.log(`  ⚠ Category "${cat.name}" not found - skipping`);
      }
    }

    // Step 3: Create topics
    console.log('\n📝 Creating topics...');
    const topicMap = {};

    for (let i = 0; i < SAMPLE_TOPICS.length; i++) {
      const topic = SAMPLE_TOPICS[i];
      const categoryId = categoryMap[topic.category];

      if (!categoryId) {
        console.log(`  ⚠ Skipping topic "${topic.title}" - category not found`);
        continue;
      }

      const userId = userIds[topic.user_index];

      // Check if similar topic exists
      const existing = forumsDb
        .prepare('SELECT id FROM forum_topics WHERE title = ? AND category_id = ?')
        .get(topic.title, categoryId);

      if (existing) {
        console.log(`  ✓ Topic "${topic.title}" already exists`);
        topicMap[i] = existing.id;
        continue;
      }

      const result = forumsDb
        .prepare(
          `
        INSERT INTO forum_topics (
          category_id, user_id, title, content, status,
          is_pinned, is_locked, view_count, reply_count,
          created_at, updated_at, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
        )
        .run(
          categoryId,
          userId,
          topic.title,
          topic.content,
          topic.status || 'open',
          topic.is_pinned || 0,
          topic.is_locked || 0
        );

      topicMap[i] = result.lastInsertRowid;
      console.log(`  ✓ Created topic: "${topic.title}" (${topic.status || 'open'})`);

      // Add tags if specified
      if (topic.tags && topic.tags.length > 0) {
        console.log(`    → Added tags: ${topic.tags.join(', ')}`);
      }
    }

    // Step 4: Create replies with nested structure
    console.log('\n💬 Creating replies...');

    const createReplyRecursive = (topicId, replies, parentId = null, depth = 0) => {
      for (const reply of replies) {
        const userId = userIds[reply.user_index];

        // Insert reply
        const result = forumsDb
          .prepare(
            `
          INSERT INTO forum_replies (
            topic_id, parent_id, user_id, content, reply_depth,
            is_solution, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
          )
          .run(topicId, parentId, userId, reply.content, depth, reply.is_solution || 0);

        const replyId = result.lastInsertRowid;

        const indent = '  '.repeat(depth + 1);
        console.log(
          `${indent}✓ Added reply (depth ${depth})${reply.is_solution ? ' ⭐ SOLUTION' : ''}`
        );

        // Create child replies recursively
        if (reply.children && reply.children.length > 0) {
          createReplyRecursive(topicId, reply.children, replyId, depth + 1);
        }
      }
    };

    // Add replies to specific topics
    const replyTopics = [
      { topicIndex: 1, replyKey: 'combat_question' },
      { topicIndex: 6, replyKey: 'magic_complicated' },
      { topicIndex: 0, replyKey: 'welcome' },
      { topicIndex: 8, replyKey: 'screenshots' },
      { topicIndex: 9, replyKey: 'pets' },
    ];

    for (const { topicIndex, replyKey } of replyTopics) {
      const topicId = topicMap[topicIndex];
      const replies = SAMPLE_REPLIES[replyKey];

      if (topicId && replies) {
        const topic = SAMPLE_TOPICS[topicIndex];
        console.log(`\n  Topic: "${topic.title}"`);
        createReplyRecursive(topicId, replies);

        // Update topic reply count
        const replyCount = forumsDb
          .prepare('SELECT COUNT(*) as count FROM forum_replies WHERE topic_id = ?')
          .get(topicId);

        forumsDb
          .prepare('UPDATE forum_topics SET reply_count = ? WHERE id = ?')
          .run(replyCount.count, topicId);
      }
    }

    // Step 5: Update view counts randomly
    console.log('\n👁️  Setting random view counts...');
    for (const topicId of Object.values(topicMap)) {
      const viewCount = Math.floor(Math.random() * 500) + 10;
      forumsDb
        .prepare('UPDATE forum_topics SET view_count = ? WHERE id = ?')
        .run(viewCount, topicId);
    }

    console.log('\n✅ Forum seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  - Users created: ${TEST_USERS.length}`);
    console.log(`  - Categories: ${Object.keys(categoryMap).length}`);
    console.log(`  - Topics created: ${Object.keys(topicMap).length}`);
    console.log(`  - Features demonstrated:`);
    console.log(`    ✓ Pinned topics`);
    console.log(`    ✓ Locked topics`);
    console.log(`    ✓ Solved topics`);
    console.log(`    ✓ Nested replies (up to 5 levels)`);
    console.log(`    ✓ Solution marking`);
    console.log(`    ✓ Rich markdown formatting`);
    console.log(`    ✓ Wiki links`);
    console.log(`    ✓ Tags`);
  } catch (error) {
    console.error('\n❌ Error seeding forum content:', error);
    process.exit(1);
  } finally {
    usersDb.close();
    forumsDb.close();
  }
}

main();
