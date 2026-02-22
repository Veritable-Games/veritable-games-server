# Godot Version Management Strategy

**Last Updated:** December 26, 2025
**Recommendation:** Upgrade all projects to Godot 4.4 LTS or Godot 5.0+

---

## Current Situation

### Projects on Godot 4.3
**Status:** ⚠️ At Risk
**Issues:**
- HTML5 export CLI is broken in Godot 4.3+ (GitHub Issue #95287)
- Headless export to Web fails with errors
- Workaround: Export manually from Godot Editor GUI (not CLI)

### Affected Projects
- NOXII (v1.0.0, v1.1.0, v2.0.0)
- ENACT (alpha-1, beta-1)
- [All current versions listed in godot-projects/]

---

## Recommended Strategy: Upgrade All Versions

### Why Upgrade to 4.4+ or 5.0+?

| Concern | Godot 4.3 | Godot 4.4 | Godot 5.0 |
|---------|-----------|-----------|-----------|
| HTML5 CLI Export | ❌ Broken | ✅ Fixed | ✅ Fixed |
| Sandbox Limitations | ⚠️ Restricted | ✅ Better | ✅ Better |
| Long-term Support | ⚠️ Ending | ✅ LTS | ✅ LTS |
| GDScript Syntax | ✅ Stable | ✅ Stable | ✅ Enhanced |
| Parser Compatibility | ✅ Works | ✅ Works | ✅ Works |

### Timeline
- **Immediate:** Update to Godot 4.4 (safest, closest to current)
- **Q1 2025:** Consider Godot 5.0 migration (major version, evaluate compatibility)
- **Long-term:** Adopt Godot 5.x as new standard

---

## How to Upgrade a Project

### Step 1: Open Project in Godot Editor
```bash
# Download Godot 4.4 from godotengine.org
# Open project in Godot 4.4

# Godot will offer to migrate the project
# Accept migration → Godot converts all assets/code
# Test that everything works

# Repeat for each version (v1.0.0, v1.1.0, v2.0.0, etc.)
```

### Step 2: Export to HTML5
```
Godot Editor → Project → Export...
→ Select "Web (HTML5)"
→ Click "Export Project"
→ Choose output path: `frontend/public/godot-builds/[project]/[version]/`
→ Wait for build to complete
```

**Do NOT use CLI export:**
```bash
# ❌ AVOID THIS - broken in 4.3
godot --headless --path /project --export-release "Web" /output/index.html

# ✅ USE GUI EXPORT INSTEAD
# (From Godot Editor → Project → Export)
```

### Step 3: Update Database Metadata
```bash
# After successful export, update database:
UPDATE godot_versions
SET build_status = 'success',
    build_path = '/godot-builds/[project]/[version]'
WHERE version_tag = '[version]';
```

### Step 4: Re-index Scripts
```typescript
// Call GodotService.indexScripts() for updated version
const scripts = await godotService.indexScripts(versionId, projectPath);
console.log(`Indexed ${scripts.length} scripts`);
```

---

## Upgrade Checklist

### For Each Project Version

- [ ] Download Godot 4.4 LTS
- [ ] Open project in Godot 4.4
- [ ] Allow project migration
- [ ] Fix any migration warnings (if any)
- [ ] Test in Editor (play scene)
- [ ] Export to HTML5 via GUI
- [ ] Verify build files in `/godot-builds/[project]/[version]/`
- [ ] Update database: `build_status = 'success'`
- [ ] Re-run script indexing
- [ ] Test in overlay visualization
- [ ] Commit changes to git

### Projects to Upgrade
- [ ] NOXII v1.0.0
- [ ] NOXII v1.1.0
- [ ] NOXII v2.0.0
- [ ] ENACT alpha-1
- [ ] ENACT beta-1
- [ ] [Other projects...]

---

## Build Process: Before & After

### Before (Godot 4.3 - Manual GUI Export)
```
Developer action:
1. Open Godot Editor with project
2. Project → Export...
3. Select Web (HTML5)
4. Click Export
5. Wait ~2 minutes
6. Files appear in /godot-builds/[project]/[version]/
7. Manually update database
```

### After (Future - CLI Export from 4.4+)
```
Single command:
godot --headless --path /path/to/project \
  --export-release "Web" /output/index.html

Then auto-register in database via POST /api/godot/versions/[id]/build
```

---

## GDScript Parsing Compatibility

### Parser Support

**Godot 4.3 Features:** ✅ All supported
```gdscript
extends Node

class_name MyClass

signal my_signal(param: int)

@export
var speed: float = 200.0

func _ready():
    pass

func take_damage(amount: int):
    my_signal.emit(amount)
```

**Godot 4.4 Features:** ✅ All supported
- Same syntax as 4.3
- Parser doesn't need updating

**Godot 5.0 Features:** ⚠️ Mostly compatible
- New syntax additions
- May need parser enhancement
- GDScript 2.0 planned for later

### Action Required
**None!** GodotParserService works with all versions. The regex patterns are version-agnostic.

---

## File Structure After Upgrade

### Updated Project Layout
```
/godot-projects/noxii/v1.0.0/  (now in Godot 4.4)
├── project.godot              (updated version)
├── godot.yml                  (new metadata)
├── .godot/                    (cache - auto-generated)
├── scripts/
│   ├── Player.gd             (code unchanged)
│   ├── Enemy.gd              (code unchanged)
│   └── ...
└── scenes/
    └── main.tscn

/public/godot-builds/noxii/v1.0.0/
├── index.html                (NEW - 4.4 export)
├── index.wasm               (NEW - 4.4 export)
├── index.pck                (NEW - 4.4 export)
└── index.icon.svg           (NEW - 4.4 export)
```

---

## Troubleshooting Upgrade Issues

### Issue: "Project format is from a newer version"
**Cause:** Opened in older Godot version
**Solution:** Use Godot 4.4 to open projects, not older versions

### Issue: "Missing dependency" warnings
**Cause:** Plugin or addon not compatible
**Solution:**
1. Check Godot 4.4 compatibility
2. Update plugin to 4.4 version
3. Or remove if no longer needed

### Issue: Script errors after migration
**Cause:** Godot made breaking changes
**Solution:**
1. Check Godot 4.4 release notes
2. Fix scripts in Godot Editor
3. Test before exporting

### Issue: HTML5 export still fails
**Cause:** Exporting via CLI (not GUI)
**Solution:** Use Godot Editor GUI export, not command-line

---

## Timeline & Rollout Plan

### Phase 1: Individual Upgrade (This Week)
- Upgrade 1-2 test projects to Godot 4.4
- Verify exports work
- Test in visualization system
- Document any issues

### Phase 2: Bulk Migration (Next Week)
- Upgrade remaining NOXII versions
- Upgrade remaining ENACT versions
- Update all database records
- Full system testing

### Phase 3: Optimization (Week After)
- Implement CLI export automation (optional)
- Set up build queue system (BullMQ)
- Automate version management UI
- Documentation updates

---

## Future: CLI Export Automation (Phase 4)

### Goal
Enable one-click rebuild in the overlay UI using Godot CLI.

### Prerequisites
1. All projects on Godot 4.4+ (no CLI bugs)
2. Build server setup
3. BullMQ job queue
4. Build status tracking UI

### Implementation
```typescript
// Future POST /api/godot/versions/[id]/build endpoint
async function buildVersion(versionId: number) {
  // 1. Get version info
  const version = await godotService.getVersion(versionId);

  // 2. Queue build job
  const job = await buildQueue.add('godot-export', {
    projectPath: version.extracted_path,
    outputPath: `/godot-builds/${version.project_slug}/${version.version_tag}`,
    version: '4.4',  // Godot version
  });

  // 3. Update status in DB
  await updateVersionStatus(versionId, 'building');

  // 4. Return job ID for polling
  return { jobId: job.id, status: 'queued' };
}
```

### Build Job Worker
```typescript
// Bull worker that executes on background server
buildQueue.process(async (job) => {
  const { projectPath, outputPath, version } = job.data;

  // Run Godot CLI export
  const result = await execSync(
    `godot --headless --path ${projectPath} ` +
    `--export-release "Web" ${outputPath}/index.html`
  );

  // Update database on completion
  if (result.success) {
    await updateVersionStatus(job.data.versionId, 'success');
  } else {
    await updateVersionStatus(job.data.versionId, 'failed');
  }

  return result;
});
```

---

## Server Requirements

### Current (Manual Exports)
- Godot Editor GUI available (developer machine)
- Write access to `/public/godot-builds/`
- PostgreSQL database

### Future (Automated Builds)
- Godot CLI installed on server
- Build queue system (Redis for BullMQ)
- Background job worker
- Disk space for HTML5 exports (~500MB per version)
- Build timeout handling (30-60 minutes per build)

---

## Version Support Matrix

| Version | Status | HTML5 CLI | Parser | Support Until |
|---------|--------|-----------|--------|----------------|
| 4.2 | ❌ Old | ✅ Works | ✅ Works | EOL Nov 2024 |
| 4.3 | ⚠️ Current | ❌ Broken | ✅ Works | EOL Nov 2025 |
| 4.4 | ✅ Recommended | ✅ Fixed | ✅ Works | EOL Nov 2026 |
| 5.0 | 🆕 Latest | ✅ Fixed | ⚠️ Enhanced | EOL Nov 2027 |

---

## References

- **Godot Download:** https://godotengine.org/download
- **4.3 Export Issue:** https://github.com/godotengine/godot/issues/95287
- **4.4 Release Notes:** https://docs.godotengine.org/en/4.4/about/release_notes.html
- **HTML5 Export Guide:** https://docs.godotengine.org/en/4.4/tutorials/export/exporting_for_web.html

---

**Summary:** Upgrade all projects to Godot 4.4 LTS using the Godot Editor GUI export. No parser changes needed. HTML5 builds will work correctly. Once upgraded, the visualization system will function perfectly without CLI issues.
