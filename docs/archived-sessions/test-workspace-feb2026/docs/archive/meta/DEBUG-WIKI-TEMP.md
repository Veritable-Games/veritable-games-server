# Temporary Wiki Category Debug Scripts

**⚠️ DELETE THESE FILES WHEN DEBUGGING IS COMPLETE:**
- `debug-wiki-categories.sh`
- `capture-wiki-debug.sh`
- `DEBUG-WIKI-TEMP.md` (this file)

## Quick Start (Easiest Method)

```bash
# From the root directory:
cd frontend
npm run dev 2>&1 | ../capture-wiki-debug.sh
```

Then:
1. Go to the wiki in your browser
2. Create a new page
3. **Select a category** (NOT Uncategorized)
4. Submit the page
5. Look at the terminal - you'll see colored debug output
6. Copy the lines that start with `[Wiki API]` or `[WikiPageService]`

## Alternative Method (If Real-time Doesn't Work)

```bash
# Terminal 1 - Run server and save logs:
cd frontend
npm run dev 2>&1 | tee ../server.log

# Use the app, create a wiki page with a category

# Terminal 2 - Extract the logs:
cd /home/user/Projects/web/veritable-games-main
./capture-wiki-debug.sh
```

## What to Look For

The debug output will show:

**Green line** - API received the request:
```
[Wiki API] Creating page: { title: 'My Page', categories: ['noxii'], ... }
```

**Yellow line** - Service processing:
```
[WikiPageService] createPage data: { title: 'My Page', categories: ['noxii'], ... }
```

**Blue line** - Category resolved correctly:
```
[WikiPageService] Resolved categoryId: 'noxii'
```

**Red line** - ⚠️ Problem! Category became uncategorized:
```
[WikiPageService] Resolved categoryId: 'uncategorized'
```

## Clean Up When Done

```bash
# Delete these temporary files:
rm debug-wiki-categories.sh capture-wiki-debug.sh DEBUG-WIKI-TEMP.md server.log
```

## Manual Alternative

If scripts don't work, just watch the terminal where `npm run dev` is running and look for these lines:

```
[Wiki API] Creating page: ...
[WikiPageService] createPage data: ...
[WikiPageService] Resolved categoryId: ...
```

Copy those lines and share them.
