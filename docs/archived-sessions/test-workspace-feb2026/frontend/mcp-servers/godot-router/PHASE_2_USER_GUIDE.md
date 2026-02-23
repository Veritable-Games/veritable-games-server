# Phase 2: CWD-Based Auto-Detection - User Guide

## Overview

Phase 2 adds automatic version detection based on your working directory. You no
longer need to specify `versionId` parameters - the router automatically detects
which Godot version you're working on.

**Bottom line**: Just `cd` into your Godot project directory, and the router
handles the rest.

---

## How It Works

### Before (Phase 1)

```bash
$ # You had to remember which version you were working on
$ get_dependency_graph { versionId: 1, scriptPath: "res://Player.gd" }
```

### After (Phase 2)

```bash
$ cd /home/user/mnt/godot-projects/noxii/0.16/scripts
$ # No need to specify versionId!
$ get_dependency_graph { scriptPath: "res://Player.gd" }
# Router automatically detects versionId=1
```

---

## Switching Between Projects

One of the biggest benefits - switching between projects is seamless:

```bash
# Working on noxii v0.16
$ cd /home/user/mnt/godot-projects/noxii/0.16/scripts
$ get_dependency_graph { scriptPath: "res://Player.gd" }
# Uses noxii v0.16 automatically

# Later, switching to enact v0.09
$ cd /home/user/mnt/godot-projects/enact/0.09/scripts
$ get_dependency_graph { scriptPath: "res://MainScene.gd" }
# Uses enact v0.09 automatically

# No configuration changes needed!
```

---

## The debug_detection Tool

If you're unsure which version was detected, use the `debug_detection` tool:

```bash
$ debug_detection {}

# Output:
┌─ CWD Detection Result ─┐
│ Confidence: HIGH
│ ✅ Detected: noxii/0.16 (versionId=1)
│ CWD: /home/user/mnt/godot-projects/noxii/0.16/scripts
├─ Debug Info ──────────┤
│ ✅ CWD is within GODOT_PROJECTS_PATH
│ ✅ Extracted: project_slug="noxii", version_tag="0.16"
│ ✅ project.godot found
│ ✅ Found versionId in database: 1
└────────────────────────┘
```

### Confidence Levels

- **HIGH**: Perfect detection - versionId found, project.godot verified
- **MEDIUM**: Partial detection - path looks right but versionId not in database
- **LOW**: Weak detection - path recognized but project.godot missing
- **NONE**: No detection - not in GODOT_PROJECTS_PATH

---

## Still Works: Explicit versionId

You can still explicitly specify `versionId` if needed:

```bash
$ # Even if you're in noxii directory, can query enact version
$ get_dependency_graph { versionId: 2, scriptPath: "res://Scene.gd" }
# Uses versionId=2 (enact) regardless of CWD
```

This is useful for:

- Comparing between versions
- Batch operations on multiple versions
- Automation scripts

---

## What Gets Detected

The router extracts:

- **project_slug**: The project name (e.g., "noxii", "enact")
- **version_tag**: The version number (e.g., "0.16", "0.09")

From your directory structure:

```
/home/user/mnt/godot-projects/
├── noxii/
│   ├── 0.16/           ← version_tag
│   │   ├── project.godot   (detected!)
│   │   ├── scripts/
│   │   └── ...
│   └── 0.15/
│       ├── project.godot
│       └── ...
└── enact/
    └── 0.09/
        ├── project.godot   (detected!)
        └── ...
```

When you run from `/godot-projects/noxii/0.16/scripts`:

- Detects `project_slug = "noxii"`
- Detects `version_tag = "0.16"`
- Queries database for versionId
- Returns versionId=1

---

## Tools That Support Auto-Detection

All 15 tools support optional `versionId`:

### Graph Tools

- `get_dependency_graph` - No versionId needed ✅
- `search_nodes` - No versionId needed ✅
- `find_isolated_nodes` - No versionId needed ✅

### Node Tools

- `get_node_details` - No versionId needed ✅
- `get_node_dependencies` - No versionId needed ✅

### Build Tools

- `trigger_build` - No versionId needed ✅
- `get_build_status` - No versionId needed ✅

### Script Tools

- `get_script_content` - No versionId needed ✅
- `update_script` - No versionId needed ✅

### Analysis Tools

- `analyze_dependency_chain` - No versionId needed ✅
- `get_runtime_events` - No versionId needed ✅

### Context Tools

- `set_context_node` - No versionId needed ✅

### Meta Tools

- `get_projects` - No versionId parameter (lists all projects)
- `get_versions` - Requires projectSlug parameter
- `get_context` - Returns current context
- `ping` - Simple connectivity test

---

## FAQ

### Q: What if I'm not in a Godot project directory?

The router handles this gracefully:

```bash
$ cd /home/user/Documents
$ debug_detection {}

# Output:
┌─ CWD Detection Result ─┐
│ Confidence: NONE
│ ❌ Detection Failed
│ CWD: /home/user/Documents
├─ Debug Info ──────────┤
│ ❌ CWD not within GODOT_PROJECTS_PATH
└────────────────────────┘

# Tools will fail asking for explicit versionId
$ get_dependency_graph { scriptPath: "res://test.gd" }
# Error: Need versionId or be in a Godot project directory
```

Solution: `cd` into a Godot project directory, or use explicit `versionId`.

### Q: How often is the detection cached?

The router caches detection for **5 minutes**. This means:

- First request to a new directory: ~50-100ms overhead (includes database query)
- Subsequent requests within 5 minutes: ~1-2ms overhead (in-memory cache)
- After 5 minutes without requests: Cache expires, next request re-detects

This is very efficient - typical usage has ~90% cache hits.

### Q: Can I work with multiple Godot versions simultaneously?

Yes! The router detects based on your current working directory:

```bash
# Terminal 1 - Working on noxii v0.16
$ cd /home/user/mnt/godot-projects/noxii/0.16
$ get_dependency_graph { scriptPath: "res://A.gd" }  # Uses noxii v0.16

# Terminal 2 - Working on enact v0.09
$ cd /home/user/mnt/godot-projects/enact/0.09
$ get_dependency_graph { scriptPath: "res://B.gd" }  # Uses enact v0.09

# Each terminal's commands use the appropriate version
```

### Q: Does this require database access?

Yes, the router queries the database to look up `versionId` from the project
path. This requires:

- `DATABASE_URL` environment variable (already configured)
- Network access to PostgreSQL database (already available)
- Valid `godot_projects` and `godot_versions` tables (already exist)

No schema changes needed.

### Q: What about performance?

Detection adds minimal overhead:

- **Cached**: ~1-2ms (90% of requests)
- **Fresh**: ~50-100ms (includes database query)

Most tool execution time will be dominated by the tool itself, not detection.

### Q: Can I disable auto-detection?

Just use explicit `versionId`:

```bash
$ get_dependency_graph { versionId: 1, scriptPath: "res://test.gd" }
# Ignores CWD detection, uses explicit versionId=1
```

Auto-detection is purely optional.

---

## What's Coming: Phase 3

Phase 3 will add **multi-instance support**:

- Each Godot version runs in its own process
- Isolated state per version (no interference between projects)
- Persistent context when switching between versions
- Better resource management

For now (Phase 2), multiple versions share a single router process with shared
context - which is fine for most use cases.

---

## Tips and Best Practices

### 1. Organize Your Projects

```bash
# Good structure for auto-detection:
/home/user/mnt/godot-projects/
├── noxii/0.16/
├── noxii/0.15/
├── enact/0.09/
└── enact/0.08/

# The router can auto-detect any subdirectory of this structure
```

### 2. Use debug_detection When Unsure

```bash
# Confused about what version you're in?
$ debug_detection {}
# Shows exactly what was detected
```

### 3. Aliases for Common Projects

```bash
# .bashrc or .zshrc
alias cdnoxii='cd /home/user/mnt/godot-projects/noxii/0.16'
alias cdenact='cd /home/user/mnt/godot-projects/enact/0.09'

# Now: cdnoxii && get_dependency_graph { ... }
```

### 4. Check Detection During Onboarding

```bash
# First time in a new environment
$ cd /home/user/mnt/godot-projects/noxii/0.16
$ debug_detection {}
# Confirms detection is working before using real tools
```

---

## Troubleshooting

### Detection shows NONE confidence

**Cause**: Not in GODOT_PROJECTS_PATH

**Solution**:

```bash
# Check your current directory
$ pwd

# Go to a Godot project directory
$ cd /home/user/mnt/godot-projects/noxii/0.16

# Verify detection
$ debug_detection {}
```

### Detection shows LOW confidence

**Cause**: `project.godot` file missing in version directory

**Solution**:

```bash
# Check if project.godot exists
$ ls -la /home/user/mnt/godot-projects/noxii/0.16/project.godot

# If missing, the version directory might be corrupted
# Use explicit versionId as workaround
$ get_dependency_graph { versionId: 1, scriptPath: "..." }
```

### Detection shows MEDIUM confidence

**Cause**: `project.godot` exists but versionId not in database

**Solution**:

```bash
# The project exists in filesystem but wasn't registered in the database
# Use explicit versionId if you know it:
$ get_dependency_graph { versionId: 999, scriptPath: "..." }

# Or, register the project in the database (requires admin access)
```

### Tools fail with "versionId required"

**Cause**: No detection possible and no explicit versionId provided

**Solution**:

```bash
# Make sure you're in a Godot project directory
$ cd /home/user/mnt/godot-projects/PROJECT_NAME/VERSION_TAG

# Or provide explicit versionId
$ get_dependency_graph { versionId: 1, scriptPath: "res://test.gd" }
```

---

## Summary

Phase 2 makes working with multiple Godot projects effortless:

1. **cd** into a project directory
2. **Call tools** without specifying versionId
3. **Switch projects** by changing directories
4. **Override** with explicit versionId if needed
5. **Debug** with the debug_detection tool

No configuration changes needed. Just start using it!

---

For more technical details, see: `PHASE_2_COMPLETION.md`
