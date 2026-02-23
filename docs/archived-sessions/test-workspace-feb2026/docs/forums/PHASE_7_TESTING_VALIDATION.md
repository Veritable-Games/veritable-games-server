# Phase 7: Testing and Validation - Comprehensive Guide

## Overview

This document provides a complete testing plan for the forum moderation system
with bit flags, real-time SSE updates, and optimistic UI.

## Test Categories

1. [Bit Flag System Tests](#1-bit-flag-system-tests)
2. [Database Trigger Tests](#2-database-trigger-tests)
3. [API Endpoint Tests](#3-api-endpoint-tests)
4. [Real-Time SSE Tests](#4-real-time-sse-tests)
5. [Optimistic UI Tests](#5-optimistic-ui-tests)
6. [FTS Search Tests](#6-fts-search-tests)
7. [Multi-Flag Scenarios](#7-multi-flag-scenarios)
8. [Performance Tests](#8-performance-tests)
9. [Edge Case Tests](#9-edge-case-tests)

---

## 1. Bit Flag System Tests

### 1.1 Verify Bit Flag Constants

```bash
node -e "
const { TopicStatusFlags, hasFlag, addFlag, removeFlag, toggleFlag } = require('./src/lib/forums/status-flags');
console.log('✓ LOCKED:', TopicStatusFlags.LOCKED === 1);
console.log('✓ PINNED:', TopicStatusFlags.PINNED === 2);
console.log('✓ SOLVED:', TopicStatusFlags.SOLVED === 4);
console.log('✓ ARCHIVED:', TopicStatusFlags.ARCHIVED === 8);
console.log('✓ DELETED:', TopicStatusFlags.DELETED === 16);
console.log('✓ FEATURED:', TopicStatusFlags.FEATURED === 32);
"
```

### 1.2 Test Bit Flag Operations

```bash
node -e "
const { TopicStatusFlags, hasFlag, addFlag, removeFlag, toggleFlag } = require('./src/lib/forums/status-flags');

// Test addFlag
let status = 0;
status = addFlag(status, TopicStatusFlags.LOCKED);
console.log('✓ Add LOCKED:', status === 1);

status = addFlag(status, TopicStatusFlags.PINNED);
console.log('✓ Add PINNED:', status === 3);

// Test hasFlag
console.log('✓ Has LOCKED:', hasFlag(status, TopicStatusFlags.LOCKED) === true);
console.log('✓ Has PINNED:', hasFlag(status, TopicStatusFlags.PINNED) === true);
console.log('✓ Not SOLVED:', hasFlag(status, TopicStatusFlags.SOLVED) === false);

// Test removeFlag
status = removeFlag(status, TopicStatusFlags.LOCKED);
console.log('✓ Remove LOCKED:', status === 2 && hasFlag(status, TopicStatusFlags.LOCKED) === false);

// Test toggleFlag
status = toggleFlag(status, TopicStatusFlags.SOLVED);
console.log('✓ Toggle SOLVED on:', hasFlag(status, TopicStatusFlags.SOLVED) === true);

status = toggleFlag(status, TopicStatusFlags.SOLVED);
console.log('✓ Toggle SOLVED off:', hasFlag(status, TopicStatusFlags.SOLVED) === false);
"
```

### 1.3 Test Multiple Flags

```bash
node -e "
const { TopicStatusFlags, addFlag, hasFlag, decodeStatusFlags } = require('./src/lib/forums/status-flags');

// Set multiple flags
let status = 0;
status = addFlag(status, TopicStatusFlags.LOCKED);
status = addFlag(status, TopicStatusFlags.PINNED);
status = addFlag(status, TopicStatusFlags.SOLVED);

console.log('Status value:', status, '(should be 7)');
console.log('Decoded:', decodeStatusFlags(status));
console.log('✓ Has LOCKED:', hasFlag(status, TopicStatusFlags.LOCKED));
console.log('✓ Has PINNED:', hasFlag(status, TopicStatusFlags.PINNED));
console.log('✓ Has SOLVED:', hasFlag(status, TopicStatusFlags.SOLVED));
console.log('✓ Not ARCHIVED:', !hasFlag(status, TopicStatusFlags.ARCHIVED));
"
```

**Expected Results:**

- All assertions should return `true`
- Status with LOCKED + PINNED + SOLVED should equal 7 (1 + 2 + 4)

---

## 2. Database Trigger Tests

### 2.1 Verify FTS Triggers Exist

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db', { readonly: true });

const triggers = db.prepare(\`
  SELECT name FROM sqlite_master
  WHERE type = 'trigger' AND name LIKE 'forum_fts_%'
  ORDER BY name
\`).all();

console.log('FTS Triggers:');
triggers.forEach(t => console.log('  ✓', t.name));

const expected = [
  'forum_fts_reply_delete',
  'forum_fts_reply_insert',
  'forum_fts_reply_update',
  'forum_fts_topic_delete',
  'forum_fts_topic_insert',
  'forum_fts_topic_update'
];

console.log('\\nVerification:', triggers.length === expected.length ? '✅ All triggers present' : '❌ Missing triggers');
db.close();
"
```

### 2.2 Test FTS Trigger - Topic Insert

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Insert test topic with bit flags
const result = db.prepare(\`
  INSERT INTO forum_topics (category_id, user_id, title, content, status)
  VALUES (1, 1, 'Test FTS Trigger Topic', 'Testing FTS triggers', 7)
\`).run();

const topicId = result.lastInsertRowid;
console.log('Created topic ID:', topicId);

// Check FTS was updated
const ftsRow = db.prepare(\`
  SELECT content_id, is_locked, is_pinned, is_solved, is_archived
  FROM forum_search_fts
  WHERE content_id = ? AND content_type = 'topic'
\`).get(topicId);

console.log('FTS Row:', ftsRow);
console.log('✓ is_locked:', ftsRow.is_locked === 1);
console.log('✓ is_pinned:', ftsRow.is_pinned === 1);
console.log('✓ is_solved:', ftsRow.is_solved === 1);
console.log('✓ is_archived:', ftsRow.is_archived === 0);

// Cleanup
db.prepare('DELETE FROM forum_topics WHERE id = ?').run(topicId);
db.close();
"
```

### 2.3 Test FTS Trigger - Topic Update

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Create topic with no flags
const result = db.prepare(\`
  INSERT INTO forum_topics (category_id, user_id, title, content, status)
  VALUES (1, 1, 'Test Update Topic', 'Testing updates', 0)
\`).run();

const topicId = result.lastInsertRowid;

// Update status to add flags
db.prepare('UPDATE forum_topics SET status = 15 WHERE id = ?').run(topicId);

// Check FTS was updated (15 = LOCKED + PINNED + SOLVED + ARCHIVED)
const ftsRow = db.prepare(\`
  SELECT is_locked, is_pinned, is_solved, is_archived
  FROM forum_search_fts
  WHERE content_id = ? AND content_type = 'topic'
\`).get(topicId);

console.log('FTS after update:', ftsRow);
console.log('✓ is_locked:', ftsRow.is_locked === 1);
console.log('✓ is_pinned:', ftsRow.is_pinned === 1);
console.log('✓ is_solved:', ftsRow.is_solved === 1);
console.log('✓ is_archived:', ftsRow.is_archived === 1);

// Cleanup
db.prepare('DELETE FROM forum_topics WHERE id = ?').run(topicId);
db.close();
"
```

**Expected Results:**

- All triggers should exist
- FTS should automatically update when topics are inserted/updated
- Bit flags should be correctly extracted (7 = locked + pinned + solved)

---

## 3. API Endpoint Tests

### 3.1 Test Lock/Unlock Endpoint

```bash
# Get a topic ID first
TOPIC_ID=$(node -e "const Database = require('better-sqlite3'); const db = new Database('./data/forums.db'); const topic = db.prepare('SELECT id FROM forum_topics LIMIT 1').get(); console.log(topic.id); db.close();")

# Lock topic
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": true}'

# Verify in database
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');
const topic = db.prepare('SELECT status FROM forum_topics WHERE id = ?').get($TOPIC_ID);
const { hasFlag, TopicStatusFlags } = require('./src/lib/forums/status-flags');
console.log('✓ Topic is locked:', hasFlag(topic.status, TopicStatusFlags.LOCKED));
db.close();
"

# Unlock topic
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```

### 3.2 Test Pin/Unpin Endpoint

```bash
TOPIC_ID=$(node -e "const Database = require('better-sqlite3'); const db = new Database('./data/forums.db'); const topic = db.prepare('SELECT id FROM forum_topics LIMIT 1').get(); console.log(topic.id); db.close();")

# Pin topic
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/pin \
  -H "Content-Type: application/json" \
  -d '{"pinned": true}'

# Verify
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');
const topic = db.prepare('SELECT status FROM forum_topics WHERE id = ?').get($TOPIC_ID);
const { hasFlag, TopicStatusFlags } = require('./src/lib/forums/status-flags');
console.log('✓ Topic is pinned:', hasFlag(topic.status, TopicStatusFlags.PINNED));
db.close();
"
```

### 3.3 Test Solved Endpoint

```bash
TOPIC_ID=$(node -e "const Database = require('better-sqlite3'); const db = new Database('./data/forums.db'); const topic = db.prepare('SELECT id FROM forum_topics LIMIT 1').get(); console.log(topic.id); db.close();")

# Mark as solved
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/solved \
  -H "Content-Type: application/json" \
  -d '{"solved": true}'

# Verify
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');
const topic = db.prepare('SELECT status FROM forum_topics WHERE id = ?').get($TOPIC_ID);
const { hasFlag, TopicStatusFlags } = require('./src/lib/forums/status-flags');
console.log('✓ Topic is solved:', hasFlag(topic.status, TopicStatusFlags.SOLVED));
db.close();
"
```

**Expected Results:**

- All API endpoints should return `{ success: true }`
- Database status field should be updated with correct bit flags
- Multiple flags can coexist (e.g., topic can be both locked AND pinned)

---

## 4. Real-Time SSE Tests

### 4.1 Test SSE Connection

**Terminal 1 - Start SSE listener:**

```bash
curl -N http://localhost:3000/api/forums/events
```

**Terminal 2 - Trigger moderation action:**

```bash
TOPIC_ID=1
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": true}'
```

**Expected Output (Terminal 1):**

```
event: connected
data: {"clientId":"client_123...","timestamp":1234567890,"filters":{}}

event: message
data: {"id":"evt_...","type":"topic:locked","timestamp":1234567890,"data":{"topic_id":1,"status":1,"is_locked":true,...}}
```

### 4.2 Test SSE Filtering by Topic

```bash
# Connect with topic filter
curl -N "http://localhost:3000/api/forums/events?topic=1"

# In another terminal, lock different topics
curl -X POST http://localhost:3000/api/forums/topics/1/lock -H "Content-Type: application/json" -d '{"locked": true}'
curl -X POST http://localhost:3000/api/forums/topics/2/lock -H "Content-Type: application/json" -d '{"locked": true}'
```

**Expected:**

- Only events for topic ID 1 should appear in the SSE stream
- Topic 2 events should be filtered out

### 4.3 Test SSE Reconnection

**Manual Test:**

1. Open browser DevTools → Network tab
2. Navigate to `/forums/topic/1`
3. Observe EventSource connection to `/api/forums/events?topic=1`
4. Disable network (DevTools → Network → Offline)
5. Wait 5 seconds
6. Re-enable network
7. **Expected:** EventSource automatically reconnects within 3-5 seconds

### 4.4 Test Multiple Clients

**Terminal 1:**

```bash
curl -N http://localhost:3000/api/forums/events
```

**Terminal 2:**

```bash
curl -N http://localhost:3000/api/forums/events
```

**Terminal 3:**

```bash
TOPIC_ID=1
curl -X POST http://localhost:3000/api/forums/topics/$TOPIC_ID/pin \
  -H "Content-Type: application/json" \
  -d '{"pinned": true}'
```

**Expected:**

- Both Terminal 1 and Terminal 2 should receive the `topic:pinned` event
  simultaneously
- Events should be broadcast to all connected clients

**Expected Results:**

- SSE connections should establish successfully
- Events should be received in real-time (< 100ms latency)
- Filtering by topic/category should work
- Auto-reconnection should work after network interruption
- Multiple clients should all receive broadcast events

---

## 5. Optimistic UI Tests

### 5.1 Test Optimistic Lock Toggle

**Browser Test:**

1. Navigate to `/forums/topic/1`
2. Open Browser DevTools → Network → Throttling → Slow 3G
3. Click "Lock Topic" in moderation dropdown
4. **Expected Immediate (<16ms):**
   - Lock badge appears
   - Badge shows pulse animation
   - Moderation button shows "Updating..."
5. **Expected After ~2 seconds:**
   - Pulse animation stops
   - Badge remains (confirmed by server)
   - Moderation button back to normal

### 5.2 Test Optimistic Rollback on Error

**Simulate Server Error:**

```bash
# Stop the dev server temporarily
kill $(lsof -t -i:3000)
```

**Browser Test:**

1. Navigate to `/forums/topic/1`
2. Click "Pin Topic"
3. **Expected Immediate:**
   - Pin badge appears (optimistic)
   - Pulse animation starts
4. **Expected After fetch() fails:**
   - Pin badge disappears (rollback)
   - Error callback fires (if configured with `onError`)

**Restart server:**

```bash
npm run dev
```

### 5.3 Test Real-Time Sync from Other Users

**Browser Tab 1:**

```
Navigate to /forums/topic/1
```

**Browser Tab 2 (or different browser):**

```
Navigate to /forums/topic/1
Click "Solve Topic"
```

**Expected in Tab 1:**

- Solved badge appears within 1 second (via SSE event)
- No manual refresh needed

**Expected Results:**

- Optimistic updates appear instantly (< 16ms)
- UI automatically rolls back on error
- Real-time updates from other users appear via SSE
- No visual flicker or jarring state changes

---

## 6. FTS Search Tests

### 6.1 Verify FTS Columns

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

const row = db.prepare(\`
  SELECT content_id, content_type, title, is_locked, is_pinned, is_solved, is_archived
  FROM forum_search_fts
  LIMIT 1
\`).get();

console.log('FTS Row:', row);
console.log('✓ Has is_locked:', 'is_locked' in row);
console.log('✓ Has is_pinned:', 'is_pinned' in row);
console.log('✓ Has is_solved:', 'is_solved' in row);
console.log('✓ Has is_archived:', 'is_archived' in row);

db.close();
"
```

### 6.2 Test Search with Status Filters

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Search for locked topics
const lockedTopics = db.prepare(\`
  SELECT content_id, title, is_locked, is_pinned, is_solved
  FROM forum_search_fts
  WHERE content_type = 'topic' AND is_locked = 1
\`).all();

console.log('Locked topics found:', lockedTopics.length);
lockedTopics.forEach(t => console.log('  -', t.title, '(locked:', t.is_locked, ')'));

// Search for solved topics
const solvedTopics = db.prepare(\`
  SELECT content_id, title, is_solved
  FROM forum_search_fts
  WHERE content_type = 'topic' AND is_solved = 1
\`).all();

console.log('\\nSolved topics found:', solvedTopics.length);
solvedTopics.forEach(t => console.log('  -', t.title));

db.close();
"
```

### 6.3 Test Full-Text Search with Status

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Search for topics containing 'game' that are NOT archived
const results = db.prepare(\`
  SELECT content_id, title, is_locked, is_pinned, is_solved, is_archived
  FROM forum_search_fts
  WHERE forum_search_fts MATCH 'game'
    AND content_type = 'topic'
    AND is_archived = 0
  ORDER BY rank ASC
  LIMIT 10
\`).all();

console.log('Search results for \"game\" (excluding archived):');
results.forEach(r => {
  console.log('  -', r.title);
  console.log('    Status: locked=', r.is_locked, 'pinned=', r.is_pinned, 'solved=', r.is_solved);
});

db.close();
"
```

**Expected Results:**

- FTS table should have all 4 status columns
- Filtering by status should work correctly
- Full-text search combined with status filters should work
- Status fields should match the topics table

---

## 7. Multi-Flag Scenarios

### 7.1 Test Topic with Multiple Flags

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');
const { addFlag, TopicStatusFlags, decodeStatusFlags } = require('./src/lib/forums/status-flags');

// Create topic with multiple flags (locked + pinned + solved)
let status = 0;
status = addFlag(status, TopicStatusFlags.LOCKED);
status = addFlag(status, TopicStatusFlags.PINNED);
status = addFlag(status, TopicStatusFlags.SOLVED);

const result = db.prepare(\`
  INSERT INTO forum_topics (category_id, user_id, title, content, status)
  VALUES (1, 1, 'Multi-Flag Test Topic', 'Testing multiple flags', ?)
\`).run(status);

const topicId = result.lastInsertRowid;
console.log('Created topic with status:', status, decodeStatusFlags(status));

// Verify FTS
const ftsRow = db.prepare(\`
  SELECT is_locked, is_pinned, is_solved, is_archived
  FROM forum_search_fts
  WHERE content_id = ? AND content_type = 'topic'
\`).get(topicId);

console.log('✓ FTS is_locked:', ftsRow.is_locked === 1);
console.log('✓ FTS is_pinned:', ftsRow.is_pinned === 1);
console.log('✓ FTS is_solved:', ftsRow.is_solved === 1);
console.log('✓ FTS is_archived:', ftsRow.is_archived === 0);

// Cleanup
db.prepare('DELETE FROM forum_topics WHERE id = ?').run(topicId);
db.close();
"
```

### 7.2 Test All Flags Enabled

```bash
node -e "
const { TopicStatusFlags, addFlag, decodeStatusFlags } = require('./src/lib/forums/status-flags');

let status = 0;
status = addFlag(status, TopicStatusFlags.LOCKED);
status = addFlag(status, TopicStatusFlags.PINNED);
status = addFlag(status, TopicStatusFlags.SOLVED);
status = addFlag(status, TopicStatusFlags.ARCHIVED);
status = addFlag(status, TopicStatusFlags.DELETED);
status = addFlag(status, TopicStatusFlags.FEATURED);

console.log('All flags enabled:');
console.log('  Status value:', status);
console.log('  Binary:', (status >>> 0).toString(2).padStart(8, '0'));
console.log('  Decoded:', decodeStatusFlags(status));
console.log('  Expected: 63 (1 + 2 + 4 + 8 + 16 + 32)');
console.log('  ✓ Correct:', status === 63);
"
```

**Expected Results:**

- Topics can have multiple flags simultaneously
- All 6 flags can be enabled at once (status = 63)
- FTS correctly extracts all flags
- UI displays all relevant badges

---

## 8. Performance Tests

### 8.1 Test SSE with Many Concurrent Connections

**Script:** Create `test-sse-performance.js`

```javascript
const EventSource = require('eventsource');

const NUM_CONNECTIONS = 50;
const connections = [];

console.log(`Opening ${NUM_CONNECTIONS} SSE connections...`);

for (let i = 0; i < NUM_CONNECTIONS; i++) {
  const es = new EventSource('http://localhost:3000/api/forums/events');

  es.onopen = () => {
    console.log(`Connection ${i + 1} opened`);
  };

  es.addEventListener('connected', event => {
    const data = JSON.parse(event.data);
    console.log(`Connection ${i + 1} received connected event`);
  });

  es.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    console.log(`Connection ${i + 1} received ${data.type} event`);
  });

  connections.push(es);
}

// Trigger an event after 2 seconds
setTimeout(() => {
  console.log('\\nTriggering moderation action...');
  fetch('http://localhost:3000/api/forums/topics/1/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locked: true }),
  });
}, 2000);

// Close connections after 5 seconds
setTimeout(() => {
  console.log('\\nClosing all connections...');
  connections.forEach((es, i) => {
    es.close();
    console.log(`Connection ${i + 1} closed`);
  });
  process.exit(0);
}, 5000);
```

**Run:**

```bash
npm install eventsource
node test-sse-performance.js
```

**Expected:**

- All 50 connections should open successfully
- All connections should receive the moderation event
- Event delivery should complete within 1 second
- No errors or connection failures

### 8.2 Test FTS Performance

```bash
time node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Search 100 times
for (let i = 0; i < 100; i++) {
  const results = db.prepare(\`
    SELECT content_id, title, is_locked, is_pinned, is_solved, is_archived, rank
    FROM forum_search_fts
    WHERE forum_search_fts MATCH 'game'
    ORDER BY rank ASC
    LIMIT 20
  \`).all();
}

console.log('✓ Completed 100 searches');
db.close();
"
```

**Expected:**

- 100 searches should complete in < 1 second total
- Each search should take < 10ms on average

**Expected Results:**

- System should handle 50+ concurrent SSE connections
- Event broadcasting should scale linearly
- FTS searches should be fast (< 10ms each)
- No memory leaks or performance degradation over time

---

## 9. Edge Case Tests

### 9.1 Test Invalid Status Values

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Try to insert topic with invalid status (-1)
try {
  db.prepare(\`
    INSERT INTO forum_topics (category_id, user_id, title, content, status)
    VALUES (1, 1, 'Invalid Status Test', 'Testing', -1)
  \`).run();
  console.log('✓ Database accepts negative status (stored as INTEGER)');
} catch (error) {
  console.log('❌ Database rejected negative status:', error.message);
}

// Try status > 63 (all flags)
try {
  db.prepare(\`
    INSERT INTO forum_topics (category_id, user_id, title, content, status)
    VALUES (1, 1, 'Large Status Test', 'Testing', 999)
  \`).run();
  console.log('✓ Database accepts status > 63');
} catch (error) {
  console.log('❌ Database rejected large status:', error.message);
}

db.close();
"
```

### 9.2 Test Concurrent Updates

**Script:** Create `test-concurrent-updates.js`

```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/forums.db');

// Create test topic
const result = db
  .prepare(
    `
  INSERT INTO forum_topics (category_id, user_id, title, content, status)
  VALUES (1, 1, 'Concurrent Update Test', 'Testing', 0)
`
  )
  .run();

const topicId = result.lastInsertRowid;
console.log('Created topic ID:', topicId);

// Simulate concurrent updates
const updates = [];
for (let i = 0; i < 10; i++) {
  const status = Math.floor(Math.random() * 16); // Random 0-15
  updates.push(
    db
      .prepare('UPDATE forum_topics SET status = ? WHERE id = ?')
      .run(status, topicId)
  );
}

console.log('✓ Performed 10 concurrent updates');

// Cleanup
db.prepare('DELETE FROM forum_topics WHERE id = ?').run(topicId);
db.close();
```

### 9.3 Test SSE Message Order

**Manual Test:**

1. Open browser to `/forums/topic/1`
2. Quickly perform these actions in sequence (< 1 second):
   - Lock topic
   - Pin topic
   - Mark as solved
3. **Expected:** Events should arrive in the correct order
4. **Expected:** Final UI state should reflect all three flags

**Expected Results:**

- System should handle invalid/edge case inputs gracefully
- Concurrent updates should not corrupt data
- Event order should be preserved in SSE streams
- No race conditions or data corruption

---

## Summary Checklist

Use this checklist to track testing progress:

### Bit Flags

- [ ] All flag constants are correct (1, 2, 4, 8, 16, 32)
- [ ] addFlag() works correctly
- [ ] removeFlag() works correctly
- [ ] toggleFlag() works correctly
- [ ] hasFlag() works correctly
- [ ] decodeStatusFlags() works correctly
- [ ] Multiple flags can coexist

### Database

- [ ] All 6 FTS triggers exist
- [ ] FTS table has all 4 status columns
- [ ] Topic INSERT trigger extracts flags correctly
- [ ] Topic UPDATE trigger extracts flags correctly
- [ ] Reply triggers inherit topic status
- [ ] FTS stays in sync with topics table

### API Endpoints

- [ ] /lock endpoint works (lock/unlock)
- [ ] /pin endpoint works (pin/unpin)
- [ ] /solved endpoint works (mark solved/unsolved)
- [ ] /archive endpoint works (archive/unarchive)
- [ ] All endpoints return proper JSON responses
- [ ] Multiple flags can be set on same topic

### Real-Time SSE

- [ ] SSE connection establishes successfully
- [ ] Connected event is received
- [ ] Moderation events are broadcast
- [ ] Topic filtering works
- [ ] Category filtering works
- [ ] Auto-reconnection works after network drop
- [ ] Multiple clients all receive events
- [ ] Heartbeat keeps connection alive

### Optimistic UI

- [ ] Optimistic updates appear instantly (< 16ms)
- [ ] Pulse animation shows during pending state
- [ ] Rollback works on error
- [ ] Real-time updates from other users work
- [ ] No visual flicker or jarring changes
- [ ] OptimisticStatusBadges component works
- [ ] OptimisticModerationDropdown component works

### FTS Search

- [ ] All 4 status columns exist in FTS
- [ ] Full-text search works
- [ ] Filtering by status works
- [ ] Search + status filter combination works
- [ ] Search performance is acceptable (< 10ms)

### Multi-Flag Scenarios

- [ ] Topics can have 2+ flags simultaneously
- [ ] All 6 flags can be enabled (status = 63)
- [ ] FTS correctly shows all flags
- [ ] UI displays all relevant badges

### Performance

- [ ] 50+ concurrent SSE connections work
- [ ] Event broadcast latency < 100ms
- [ ] FTS searches complete in < 10ms
- [ ] No memory leaks over time

### Edge Cases

- [ ] Invalid status values handled gracefully
- [ ] Concurrent updates don't corrupt data
- [ ] Event order is preserved
- [ ] No race conditions

---

## Running All Tests

```bash
# Install test dependencies
npm install eventsource

# Run all database tests
bash scripts/test-bit-flags.sh

# Run all API tests
bash scripts/test-api-endpoints.sh

# Start dev server
npm run dev

# Manual browser tests (checklist above)
# Performance tests (concurrent connections)
```

## Reporting Issues

If any tests fail, document:

1. Test name
2. Expected result
3. Actual result
4. Steps to reproduce
5. Console errors/logs
6. Database state (if applicable)

Create a GitHub issue or update the project documentation with findings.
