# Playwright MCP Best Practices - Token Optimization

**Last Updated**: February 15, 2026

## Overview

This guide documents best practices for using the Playwright MCP server to minimize token usage in Claude Code sessions.

## Configuration Cleanup Applied

**Date**: February 15, 2026
**Action**: Removed cached data from `~/.claude.json`
**Savings**: ~84KB (53% reduction: 159KB → 74KB)
**Impact**: ~21,000 tokens saved per session

### What Was Removed
- `cachedChangelog` (79KB) - Will re-download when needed
- `cachedGrowthBookFeatures` (1.3KB) - Will re-fetch
- `cachedStatsigGates` (767 bytes) - Will re-fetch
- `cachedDynamicConfigs` (152 bytes) - Will re-fetch

**Backups**: Saved to `~/.claude.json.backup-YYYYMMDD-HHMMSS`

---

## Token-Efficient Playwright Usage

### Rule: Always Use `filename` Parameter

Many Playwright tools support saving output to files instead of returning it in the response. **Always use this option** to reduce token usage.

### Tools That Support File Output

#### 1. `browser_snapshot` - Page Accessibility Snapshot

```typescript
// ❌ BAD - Returns entire snapshot in response (~5,000+ tokens)
mcp__playwright__browser_snapshot()

// ✅ GOOD - Saves to file (~50 tokens)
mcp__playwright__browser_snapshot({
  filename: "snapshots/page-snapshot.md"
})
```

#### 2. `browser_console_messages` - Console Logs

```typescript
// ❌ BAD - Returns all logs in response (~1,000+ tokens)
mcp__playwright__browser_console_messages({ level: "info" })

// ✅ GOOD - Saves to file
mcp__playwright__browser_console_messages({
  level: "info",
  filename: "debug/console-logs.txt"
})
```

**Levels**: `error`, `warning`, `info`, `debug` (each level includes more severe levels)

#### 3. `browser_network_requests` - Network Activity

```typescript
// ❌ BAD - Returns all requests in response (~2,000+ tokens)
mcp__playwright__browser_network_requests({ includeStatic: false })

// ✅ GOOD - Saves to file
mcp__playwright__browser_network_requests({
  includeStatic: false,
  filename: "debug/network-requests.txt"
})
```

**Tip**: Set `includeStatic: false` to exclude images, fonts, scripts (reduces noise)

#### 4. `browser_take_screenshot` - Screenshots

```typescript
// ❌ BAD - Returns base64 image data (~10,000+ tokens)
mcp__playwright__browser_take_screenshot({ type: "png" })

// ✅ GOOD - Saves to file
mcp__playwright__browser_take_screenshot({
  type: "png",
  filename: "screenshots/page.png",
  fullPage: false  // Set true for full scrollable page
})
```

**Element Screenshots**:
```typescript
// Screenshot specific element (requires ref from snapshot)
mcp__playwright__browser_take_screenshot({
  type: "png",
  filename: "screenshots/element.png",
  element: "Submit button",
  ref: "element-ref-from-snapshot"
})
```

---

## Comparison: Token Usage

| Tool | Without `filename` | With `filename` | Savings |
|------|-------------------|-----------------|---------|
| `browser_snapshot` | ~5,000 tokens | ~50 tokens | **99%** |
| `browser_console_messages` | ~1,000 tokens | ~50 tokens | **95%** |
| `browser_network_requests` | ~2,000 tokens | ~50 tokens | **97.5%** |
| `browser_take_screenshot` | ~10,000 tokens | ~100 tokens | **99%** |

---

## Recommended File Naming Convention

Use descriptive paths to organize output:

```bash
# Good structure
snapshots/
  ├── login-page.md
  ├── dashboard.md
  └── error-state.md

debug/
  ├── console-logs.txt
  └── network-requests.txt

screenshots/
  ├── login-form.png
  ├── error-message.png
  └── success-state.png
```

---

## Other Playwright Best Practices

### 1. Use Snapshots Over Screenshots for Actions

Snapshots consume fewer tokens and provide actionable element references:

```typescript
// ✅ GOOD - Get snapshot, extract refs, perform actions
await mcp__playwright__browser_snapshot({ filename: "page.md" })
// Read page.md to find element refs
await mcp__playwright__browser_click({
  ref: "button-ref-123",
  element: "Submit button"
})
```

### 2. Batch Related Operations

```typescript
// ✅ GOOD - Take snapshot once, use for multiple operations
browser_snapshot({ filename: "page.md" })
// Then perform multiple actions using refs from snapshot
browser_click({ ref: "btn-1", element: "Button 1" })
browser_type({ ref: "input-1", text: "value", element: "Input" })
browser_click({ ref: "btn-2", element: "Button 2" })
```

### 3. Clean Up Old Debug Files

Periodically remove old debug outputs:

```bash
# Clean up old files
rm -rf snapshots/* debug/* screenshots/*
```

---

## Current Playwright MCP Configuration

Location: `~/.claude.json`

```json
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "@playwright/mcp@latest",
      "--browser",
      "firefox"
    ],
    "env": {}
  }
}
```

**Browser**: Firefox (configurable: `chromium`, `firefox`, `webkit`)

---

## Troubleshooting

### Config Too Large Again?

Re-run cleanup:
```bash
# Backup
cp ~/.claude.json ~/.claude.json.backup-$(date +%Y%m%d)

# Clean caches
jq 'del(.cachedChangelog) | del(.cachedGrowthBookFeatures) | del(.cachedStatsigGates) | del(.cachedDynamicConfigs)' ~/.claude.json > ~/.claude.json.tmp
mv ~/.claude.json.tmp ~/.claude.json
```

### Monitor Config Size

```bash
# Check current size
ls -lh ~/.claude.json

# Show largest sections
jq 'to_entries | map({key: .key, size: (.value | tostring | length)}) | sort_by(.size) | reverse | .[0:10]' ~/.claude.json
```

---

## Summary

**Key Takeaway**: Always use the `filename` parameter for Playwright tools that support it. This reduces token usage by **95-99%** for debugging operations.

**Quick Reference**:
- Snapshots → `{ filename: "snapshots/page.md" }`
- Console logs → `{ filename: "debug/console.txt" }`
- Network requests → `{ filename: "debug/network.txt" }`
- Screenshots → `{ filename: "screenshots/page.png" }`
