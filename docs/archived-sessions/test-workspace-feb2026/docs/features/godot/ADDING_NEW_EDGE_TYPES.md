# Adding New Edge Types to the Dependency Graph

This guide explains how to add new dependency relationship types to the Godot dependency graph system.

---

## Overview

The dependency graph supports 11 edge types across 5 categories. To add a new type, you need to:

1. **Define the edge type** in the type system
2. **Extract the relationship** in the parser
3. **Render with color/styling** in visualization
4. **Add legend entry** for user control
5. **Test and document**

---

## Step-by-Step Example: Adding "import" Edge Type

Let's say you want to add support for GDScript imports: `import enemy_scene as Enemy`

### Step 1: Define the Type

Update `parser-service.ts`:

```typescript
// Line 76-87: Update EdgeType export
export type EdgeType =
  | 'extends'
  | 'preload'
  | 'load'
  | 'calls'
  | 'signal'
  | 'onready'
  | 'get_node'
  | 'signal_connect'
  | 'scene_script'
  | 'scene_instance'
  | 'type_hint'
  | 'import';  // ← NEW

// Line 94-110: Update GraphEdge interface
export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;  // ← Already supports all types
  weight?: number;
}
```

### Step 2: Extract in Parser

Add extraction method to `parser-service.ts`:

```typescript
/**
 * Extract import statements from GDScript
 * Matches: import path as Name or import path
 */
private extractImports(content: string): Array<{path: string; alias?: string}> {
  const imports: Array<{path: string; alias?: string}> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match: import "res://path/to/file.gd" as Name
    const match = line.match(/^import\s+"([^"]+)"\s+as\s+(\w+)/);
    if (match) {
      const [, path, alias] = match;
      imports.push({path: path.trim(), alias: alias.trim()});
    }

    // Match: import "res://path/to/file.gd"
    const simpleMatch = line.match(/^import\s+"([^"]+)"/);
    if (simpleMatch && !match) {
      const [, path] = simpleMatch;
      imports.push({path: path.trim()});
    }
  }

  return imports;
}
```

Call it in `parseScript()` method:

```typescript
// Around line 268 where other extraction happens
const imports = this.extractImports(content);

// Store in ScriptAnalysis
result.imports = imports;
```

### Step 3: Create Graph Edges

In `buildDependencyGraph()` method, add after function calls:

```typescript
// Create import edges
scripts.forEach(script => {
  if (!script.imports) return;

  script.imports.forEach(imp => {
    const targetPath = this.resolveScriptPath(imp.path, scripts);
    if (targetPath && targetPath !== script.filePath) {
      edges.push({
        from: script.filePath,
        to: targetPath,
        type: 'import',
        weight: 1.1,  // Strong explicit dependency
      });
    }
  });
});
```

### Step 4: Add Color and Styling

Update `visualization-utils.ts`:

```typescript
// In getLineStyle() function, add to styles Record
import: {pattern: 'solid', arrowSize: 'medium', opacity: 0.85}

// Updated styles object:
const styles: Record<EdgeType, LineStyle> = {
  extends: {pattern: 'solid', arrowSize: 'large', opacity: 0.9},
  // ... existing types ...
  import: {pattern: 'solid', arrowSize: 'medium', opacity: 0.85},  // ← NEW
};
```

Update `DependencyGraphViewer.tsx`:

```typescript
// In the edgeColors mapping
const edgeColors: Record<EdgeType, number> = {
  // ... existing colors ...
  import: 0xec4899,  // Pink/magenta for imports
};

// In the incoming edges color map
const typeColorMap: Record<EdgeType, string> = {
  // ... existing colors ...
  import: 'text-pink-400',  // ← NEW
};

// In the outgoing edges color map (same update)
```

### Step 5: Add to Legend

Update the legend in `DependencyGraphViewer.tsx`:

Option A: Add to existing "Structural" category if it's a strong dependency

```typescript
{/* Structural Dependencies */}
{(() => {
  const category = 'Structural';
  const types: EdgeType[] = [
    'extends', 'scene_script', 'scene_instance', 'import'  // ← ADD
  ];
  // ... rest of category logic
})()}
```

Option B: Create new category if it's its own type

```typescript
{/* Imports */}
{(() => {
  const category = 'Imports';
  const types: EdgeType[] = ['import'];  // ← NEW
  const isExpanded = legendExpanded.has(category);
  const visibleCount = types.filter(t => visibleEdgeTypes.has(t)).length;

  return (
    <div className="mb-3 border-b border-gray-700 pb-3 last:border-b-0">
      {/* ... standard category template ... */}
      {isExpanded && (
        <div className="ml-4 space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={visibleEdgeTypes.has('import')}
              onChange={e => {
                e.stopPropagation();
                toggleEdgeType('import');
              }}
              className="cursor-pointer"
            />
            <div className="h-2 w-2 rounded bg-pink-500"></div>
            <span className="text-xs">Import</span>
          </div>
        </div>
      )}
    </div>
  );
})()}
```

### Step 6: Update Default Visibility

In `DependencyGraphViewer.tsx` useState initialization:

```typescript
// Default visibility - include imports
const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<EdgeType>>(
  new Set([
    'extends', 'scene_script', 'scene_instance',  // Structural
    'preload', 'load',  // Resources
    'import',  // ← NEW - imports are important, show by default
  ])
);
```

### Step 7: Update ScriptAnalysis Interface

Update `parser-service.ts`:

```typescript
export interface ScriptAnalysis {
  filePath: string;
  content: string;
  className?: string;
  functions: FunctionDef[];
  signals: SignalDef[];
  exports: ExportedVariable[];
  dependencies: DependencyRef[];
  imports?: Array<{path: string; alias?: string}>;  // ← NEW
  rootNode?: SceneNode;
  // ... other fields
}
```

---

## Testing Your New Edge Type

### Unit Test Example

Create `/frontend/src/lib/godot/__tests__/import-extraction.test.ts`:

```typescript
import { GodotParserService } from '../parser-service';

describe('Import Extraction', () => {
  const parser = new GodotParserService();

  test('extracts import with alias', () => {
    const script = `
import "res://enemies/goblin.gd" as Goblin

func _ready():
    var enemy = Goblin.new()
`;
    const result = parser.parseScript('Player.gd', script);
    expect(result.imports).toEqual([
      {path: 'res://enemies/goblin.gd', alias: 'Goblin'}
    ]);
  });

  test('extracts import without alias', () => {
    const script = `import "res://utils/math.gd"`;
    const result = parser.parseScript('Game.gd', script);
    expect(result.imports).toEqual([
      {path: 'res://utils/math.gd'}
    ]);
  });

  test('creates correct edges for imports', () => {
    const scripts: ScriptAnalysis[] = [
      {
        filePath: 'Player.gd',
        className: 'Player',
        imports: [{path: 'res://enemies/Enemy.gd'}],
        // ... other fields
      },
      {
        filePath: 'res://enemies/Enemy.gd',
        className: 'Enemy',
        // ... other fields
      },
    ];

    const graph = parser.buildDependencyGraph(scripts);

    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        from: 'Player.gd',
        to: 'res://enemies/Enemy.gd',
        type: 'import',
      })
    );
  });
});
```

### Integration Test Example

Test the full pipeline from script to visualization:

```typescript
test('imports visible in dependency graph', async () => {
  // Upload a project with imports
  // Generate graph
  // Verify edges appear in graph JSON
  // Verify color mapping is correct
  // Verify legend can toggle visibility
});
```

---

## Checklist

When adding a new edge type, verify:

- [ ] EdgeType updated in parser-service.ts
- [ ] ScriptAnalysis or other interface updated
- [ ] Extraction method implemented in parser
- [ ] Edge creation in buildDependencyGraph()
- [ ] Color defined in edgeColors record
- [ ] Line style defined in getLineStyle()
- [ ] Type colors in incoming/outgoing maps
- [ ] Legend category added or updated
- [ ] Default visibility set appropriately
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated (this doc + DEPENDENCY_GRAPH_ENHANCEMENT.md)
- [ ] TypeScript compilation passes (`npm run type-check`)

---

## Common Patterns

### Extracting from Strings

```typescript
// Regex pattern tips
/^import\s+"([^"]+)"/           // Match import lines
/^export\s+class\s+(\w+)/       // Match class exports
/^signal\s+(\w+)\s*\(/          // Match signal definitions
/^const\s+(\w+)\s*=\s*"([^"]+)" // Match const definitions
```

### Resolving Paths

```typescript
// Use existing resolver
const targetPath = this.resolveScriptPath(importPath, scripts);

// Or parse paths manually
const fullPath = importPath.startsWith('res://')
  ? importPath
  : `res://scripts/${importPath}`;
```

### Weighted Edges

```typescript
// Weight indicates importance/strength
// Higher = stronger dependency
// Common weights:
// 1.5 = very strong (extends, scene_script)
// 1.2 = strong (preload, imports)
// 1.0 = medium (load, calls)
// 0.6 = weak (type hints)
// 0.4 = very weak (ambiguous calls)
```

---

## Performance Considerations

- **Extraction**: O(n) lines of script
- **Resolution**: O(m) scripts to search
- **Graph Building**: O(e) edges to create
- **Rendering**: O(e) edges to render
- **Filtering**: O(e) edges to toggle visibility (instant)

For a project with 50 scripts and 75 edges, extraction takes ~50ms total.

---

## Future Edge Types to Consider

1. **export**: Track exported classes/variables
2. **load_scene**: Dynamic scene loading
3. **resource_load**: Dynamic resource loading
4. **await**: Async/await dependencies
5. **emit**: Signal emissions
6. **callback**: Callback references
7. **group**: Node group references
8. **physics_body**: Collider interactions
9. **animation**: AnimationPlayer references
10. **audio**: AudioStreamPlayer references

---

## Related Documentation

- [DEPENDENCY_GRAPH_ENHANCEMENT.md](./DEPENDENCY_GRAPH_ENHANCEMENT.md) - Complete system overview
- [GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md](./GODOT_DEVELOPER_CONSOLE_ARCHITECTURE.md) - System architecture
- `/frontend/src/lib/godot/parser-service.ts` - Parser implementation
- `/frontend/src/components/godot/DependencyGraphViewer.tsx` - Visualization
