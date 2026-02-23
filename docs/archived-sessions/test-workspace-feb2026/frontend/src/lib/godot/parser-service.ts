/**
 * GodotParserService
 * Parses .gd (GDScript) files and .tscn (Scene) files to extract structure, dependencies, and relationships
 */

import { computeForceDirectedLayout3D, selectLayoutConfig } from './graph-layout';

export interface Dependency {
  type:
    | 'extends'
    | 'preload'
    | 'load'
    | 'class_name'
    | 'onready'
    | 'get_node'
    | 'signal_connect'
    | 'scene_script'
    | 'scene_instance';
  path: string;
  line: number;
}

export interface FunctionDef {
  name: string;
  params: string[];
  paramTypes?: Array<{
    name: string;
    type?: string;
    defaultValue?: string;
  }>;
  returnType?: string;
  line: number;
  calls: string[];
  isStatic?: boolean;
  isPrivate?: boolean;
}

export interface Signal {
  name: string;
  params?: string[];
  line: number;
}

export interface Export {
  name: string;
  type?: string;
  line: number;
}

export interface ScriptAnalysis {
  filePath: string;
  className?: string;
  extendsClass?: string;
  dependencies: Dependency[];
  signals: Signal[];
  functions: FunctionDef[];
  exports: Export[];
}

export interface SceneNode {
  name: string;
  type: string;
  nodeClass: string;
  parent?: string;
  children: SceneNode[];
  properties: Record<string, unknown>;
  script?: string; // Attached script resource ID
  instance?: string; // Instanced scene resource ID
}

export interface SceneConnection {
  from: string;
  fromSignal: string;
  to: string;
  toFunction: string;
}

export interface SceneAnalysis {
  filePath: string;
  sceneName: string;
  rootNode?: SceneNode;
  connections: SceneConnection[];
  dependencies?: Dependency[]; // Scene-level dependencies (scripts, instances)
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'script' | 'scene' | 'class';
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number; z: number };
}

export interface GraphEdge {
  from: string;
  to: string;
  type:
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
    | 'type_hint';
  weight?: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Parser version identifier
 * Used to track which parser version indexed each Godot version
 * Format: YYYY-MM-DD-PHASE_IDENTIFIER
 *
 * Updated whenever the parser logic changes significantly:
 * - Addition of new dependency detection patterns
 * - Changes to graph building algorithm
 * - Modifications to type system
 *
 * Version history:
 * - 2025-12-28-8f29b6d9: Earlier phase improvements
 * - 2026-01-01-phase1-calls: Phase 1 - Function call graph implementation
 */
export const PARSER_VERSION = '2026-01-01-phase1-calls';

export class GodotParserService {
  /**
   * Extract parameter types from function parameter string
   * Handles typed parameters like: func foo(player: Player, count: int = 5)
   */
  private extractParameterTypes(paramsStr: string): Array<{
    name: string;
    type?: string;
    defaultValue?: string;
  }> {
    if (!paramsStr.trim()) return [];
    const params = paramsStr.split(',').map(p => p.trim());

    return params.map(param => {
      // Match: name:type=default or name:type or name
      const match = param.match(/^(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
      if (!match || !match[1]) return { name: param };

      const [, name, type, defaultValue] = match;
      return {
        name: name!.trim(),
        type: type?.trim(),
        defaultValue: defaultValue?.trim(),
      };
    });
  }

  /**
   * Extract return type from function signature
   * Handles: func foo() -> ReturnType:
   */
  private extractReturnType(funcLine: string): string | undefined {
    const match = funcLine.match(/->\s*([^:]+):/);
    return match && match[1] ? match[1].trim() : undefined;
  }

  /**
   * Extract base type from generic or array type hints
   * Array[Enemy] -> Enemy, Dictionary<String, Player> -> String
   */
  private extractBaseType(typeHint: string): string {
    // Handle Array[Type] or similar generics
    const genericMatch = typeHint.match(/^\w+\[(.+)\]$/);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].split(',')[0]?.trim() || typeHint;
    }
    return typeHint;
  }

  /**
   * Check if a type is a built-in Godot or GDScript type
   */
  private isBuiltInType(type: string): boolean {
    const builtInTypes = [
      'int',
      'float',
      'bool',
      'String',
      'void',
      'Vector2',
      'Vector3',
      'Vector2i',
      'Vector3i',
      'Color',
      'Rect2',
      'Transform2D',
      'Transform3D',
      'Array',
      'Dictionary',
      'Variant',
      'Object',
      'PackedStringArray',
      'PackedVector2Array',
      'PackedVector3Array',
      'PackedColorArray',
      'PackedInt32Array',
      'PackedInt64Array',
      'PackedFloat32Array',
      'PackedFloat64Array',
      'Basis',
      'Plane',
      'Quaternion',
      'AABB',
      'RID',
      'Callable',
      'Signal',
      'Resource',
      'Node',
    ];
    return builtInTypes.includes(type);
  }

  /**
   * Build registry mapping class names to script file paths
   */
  private buildTypeRegistry(scripts: ScriptAnalysis[]): Map<string, string> {
    const registry = new Map<string, string>();
    scripts.forEach(script => {
      if (script.className) {
        registry.set(script.className, script.filePath);
      }
    });
    return registry;
  }

  /**
   * Parse a .gd (GDScript) file to extract structure
   */
  parseScript(filePath: string, content: string): ScriptAnalysis {
    const lines = content.split('\n');
    const result: ScriptAnalysis = {
      filePath,
      dependencies: [],
      signals: [],
      functions: [],
      exports: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const trimmed = line.trim();
      const lineNum = i + 1;

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse class_name declaration
      if (trimmed.startsWith('class_name ')) {
        result.className = trimmed.replace('class_name ', '').split('#')[0]!.trim();
      }

      // Parse extends declaration
      if (trimmed.startsWith('extends ')) {
        const className = trimmed.replace('extends ', '').split('#')[0]!.trim();
        result.extendsClass = className;
        result.dependencies.push({
          type: 'extends',
          path: this.resolveClassPath(className),
          line: lineNum,
        });
      }

      // Parse preload/load statements
      const preloadMatch = trimmed.match(
        /(?:var|const)\s+\w+\s*=\s*(?:preload|load)\s*\(\s*["'](.+?)["']\s*\)/
      );
      if (preloadMatch && preloadMatch[1]) {
        const depType = trimmed.includes('preload') ? 'preload' : 'load';
        result.dependencies.push({
          type: depType,
          path: preloadMatch[1],
          line: lineNum,
        });
      }

      // Parse @onready annotations with node paths
      const onreadyMatch = trimmed.match(/@onready\s+var\s+(\w+)(?:\s*:\s*\w+)?\s*=\s*\$(.+)/);
      if (onreadyMatch && onreadyMatch[2]) {
        const nodePath = onreadyMatch[2].trim().replace(/['"]/g, '');
        result.dependencies.push({
          type: 'onready',
          path: `nodepath://${nodePath}`,
          line: lineNum,
        });
      }

      // Parse get_node() and get_node_or_null() calls
      const getNodeMatch = trimmed.match(/get_node(?:_or_null)?\s*\(\s*["'](.+?)["']\s*\)/);
      if (getNodeMatch && getNodeMatch[1]) {
        const nodePath = getNodeMatch[1];
        const isAutoload = nodePath.startsWith('/root/');
        const depPath = isAutoload
          ? `autoload://${nodePath.replace('/root/', '')}`
          : `nodepath://${nodePath}`;

        result.dependencies.push({
          type: 'get_node',
          path: depPath,
          line: lineNum,
        });
      }

      // Parse signal connections - both old and new syntax
      // Old: connect("signal_name", Callable(target, "method"))
      // New: signal_name.connect(target.method)

      // Pattern 1: connect("signal_name", ...)
      const connectOldMatch = trimmed.match(/\bconnect\s*\(\s*["'](\w+)["']/);
      if (connectOldMatch && connectOldMatch[1]) {
        result.dependencies.push({
          type: 'signal_connect',
          path: `signal://${connectOldMatch[1]}`,
          line: lineNum,
        });
      }

      // Pattern 2: signal_name.connect(...)
      const connectNewMatch = trimmed.match(/(\w+)\.connect\s*\(/);
      if (connectNewMatch && connectNewMatch[1]) {
        const signalName = connectNewMatch[1];
        if (!['self', 'this', 'super'].includes(signalName)) {
          result.dependencies.push({
            type: 'signal_connect',
            path: `signal://${signalName}`,
            line: lineNum,
          });
        }
      }

      // Parse @export annotations
      if (trimmed.startsWith('@export')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine) {
          const varMatch = nextLine.match(
            /var\s+(\w+)(?:\s*:\s*(\w+(?:\[\w+\])?))?\s*(?:=\s*(.+))?/
          );
          if (varMatch && varMatch[1]) {
            result.exports.push({
              name: varMatch[1],
              type: varMatch[2],
              line: lineNum + 1,
            });
          }
        }
      }

      // Parse signal declarations
      const signalMatch = trimmed.match(/^signal\s+(\w+)(?:\s*\((.*?)\))?/);
      if (signalMatch && signalMatch[1]) {
        const params = signalMatch[2]
          ? signalMatch[2]
              .split(',')
              .map(p => p.trim())
              .filter(Boolean)
          : undefined;
        result.signals.push({
          name: signalMatch[1],
          params,
          line: lineNum,
        });
      }

      // Parse function declarations
      const funcMatch = trimmed.match(/^(?:static\s+)?(?:func|_init)\s+(\w+)\s*\((.*?)\)/);
      if (funcMatch && funcMatch[1]) {
        const isStatic = trimmed.includes('static');
        const isPrivate = funcMatch[1].startsWith('_');
        const funcBody = this.extractFunctionBody(lines, i);
        const calls = this.extractFunctionCalls(funcBody);

        // Extract parameter types and return type
        const paramsWithTypes = this.extractParameterTypes(funcMatch[2] || '');
        const returnType = this.extractReturnType(trimmed);

        result.functions.push({
          name: funcMatch[1],
          params: paramsWithTypes.map(p => p.name),
          paramTypes: paramsWithTypes,
          returnType,
          line: lineNum,
          calls,
          isStatic,
          isPrivate,
        });
      }
    }

    return result;
  }

  /**
   * Parse scene resource declarations to build a map of resource IDs to file paths
   * Extracts [ext_resource ...] declarations that map IDs to script/scene paths
   */
  private parseSceneResources(content: string): Map<string, string> {
    const resourceMap = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      // Match: [ext_resource type="Script" path="res://scripts/player.gd" id="1_abc123"]
      const match = line.match(/\[ext_resource\s+type="([^"]+)"\s+path="([^"]+)"\s+id="([^"]+)"\]/);
      if (match && match[2] && match[3]) {
        const path = match[2];
        const id = match[3];
        resourceMap.set(id, path);
      }
    }

    return resourceMap;
  }

  /**
   * Parse a .tscn (Scene) file to extract hierarchy and connections
   * .tscn files use a custom INI-like format
   */
  parseScene(filePath: string, content: string): SceneAnalysis {
    const lines = content.split('\n');
    const result: SceneAnalysis = {
      filePath,
      sceneName: filePath.split('/').pop()?.replace('.tscn', '') || 'Unknown',
      connections: [],
    };

    // Build resource map for resolving IDs to paths
    const resourceMap = this.parseSceneResources(content);

    const nodes: Map<string, SceneNode> = new Map();
    let currentNodeId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();

      // Parse [node] sections
      const nodeMatch = trimmedLine.match(/^\[node\s+name="(.+?)"\s+type="(.+?)"\]/);
      if (nodeMatch && nodeMatch[1] && nodeMatch[2]) {
        const nodeName = nodeMatch[1];
        const nodeType = nodeMatch[2];
        currentNodeId = nodeName;

        const node: SceneNode = {
          name: nodeName,
          type: nodeType,
          nodeClass: nodeType,
          children: [],
          properties: {},
        };

        nodes.set(nodeName, node);

        // Set as root if no parent specified yet
        if (!result.rootNode && !nodes.has('root')) {
          result.rootNode = node;
        }
      }

      // Parse attached scripts: script = ExtResource("1_abc123")
      if (currentNodeId && !trimmedLine.startsWith('[')) {
        const scriptMatch = trimmedLine.match(
          /^script\s*=\s*(?:ExtResource|SubResource)\s*\(\s*["'](.+?)["']\s*\)/
        );
        if (scriptMatch && scriptMatch[1]) {
          const resourceId = scriptMatch[1];
          const node = nodes.get(currentNodeId);
          if (node) {
            node.script = resourceId;

            // Initialize dependencies array if needed
            if (!result.dependencies) {
              result.dependencies = [];
            }

            // Resolve resource ID to file path using resource map
            const scriptPath = resourceMap.get(resourceId) || `resource://${resourceId}`;

            result.dependencies.push({
              type: 'scene_script',
              path: scriptPath,
              line: i + 1,
            });
          }
        }

        // Parse instanced scenes: instance = ExtResource("2_def456")
        const instanceMatch = trimmedLine.match(
          /^instance\s*=\s*ExtResource\s*\(\s*["'](.+?)["']\s*\)/
        );
        if (instanceMatch && instanceMatch[1]) {
          const resourceId = instanceMatch[1];
          const node = nodes.get(currentNodeId);
          if (node) {
            node.instance = resourceId;

            // Initialize dependencies array if needed
            if (!result.dependencies) {
              result.dependencies = [];
            }

            // Resolve resource ID to file path using resource map
            const scenePath = resourceMap.get(resourceId) || `resource://${resourceId}`;

            result.dependencies.push({
              type: 'scene_instance',
              path: scenePath,
              line: i + 1,
            });
          }
        }
      }

      // Parse [connection] sections for signal connections
      const connMatch = trimmedLine.match(
        /^\[connection\s+signal="(.+?)"\s+from="(.+?)"\s+to="(.+?)"\s+method="(.+?)"\]/
      );
      if (connMatch && connMatch[1] && connMatch[2] && connMatch[3] && connMatch[4]) {
        result.connections.push({
          fromSignal: connMatch[1],
          from: connMatch[2],
          to: connMatch[3],
          toFunction: connMatch[4],
        });
      }
    }

    return result;
  }

  /**
   * Build a dependency graph from script and optional scene analysis results
   */
  buildDependencyGraph(scripts: ScriptAnalysis[], scenes?: SceneAnalysis[]): DependencyGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();
    const referencedBuiltins = new Set<string>(); // Track referenced built-in classes

    // Create nodes for each script
    scripts.forEach((script, index) => {
      const nodeId = script.filePath;
      const label = script.className || script.filePath.split('/').pop() || 'Unknown';

      const node: GraphNode = {
        id: nodeId,
        label,
        type: 'script',
        metadata: {
          functionCount: script.functions?.length || 0,
          signalCount: script.signals?.length || 0,
          exportCount: script.exports?.length || 0,
        },
        // Position will be computed by force-directed layout
      };

      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Create edges from dependencies
    scripts.forEach(script => {
      script.dependencies.forEach(dep => {
        // Skip class_name dependencies - they're not relationships
        if (dep.type === 'class_name') return;

        // Determine weight based on dependency type
        let weight = 1;
        if (dep.type === 'extends') weight = 2;
        else if (dep.type === 'onready') weight = 1.5;
        else if (dep.type === 'get_node') weight = 1.2;

        // For file-based dependencies, try to match to a script
        if (dep.type === 'extends' || dep.type === 'preload' || dep.type === 'load') {
          const toNodeId = this.resolveScriptPath(dep.path, scripts);

          if (toNodeId && toNodeId !== script.filePath) {
            edges.push({
              from: script.filePath,
              to: toNodeId,
              type: dep.type,
              weight,
            });
          } else if (dep.path.startsWith('godot://')) {
            // Track built-in class reference
            const className = dep.path.replace('godot://', '');
            referencedBuiltins.add(className);

            // Create edge to virtual node
            edges.push({
              from: script.filePath,
              to: dep.path, // Use full godot:// path as ID
              type: dep.type,
              weight,
            });
          }
        }

        // For node-based dependencies (@onready, get_node, signals)
        // Create virtual nodes with special path prefixes
        if (
          dep.path.startsWith('nodepath://') ||
          dep.path.startsWith('autoload://') ||
          dep.path.startsWith('signal://') ||
          dep.path.startsWith('resource://')
        ) {
          edges.push({
            from: script.filePath,
            to: dep.path, // Use the path with prefix as node ID
            type: dep.type,
            weight,
          });
        }
      });
    });

    // Create function call edges
    const functionRegistry = this.buildFunctionRegistry(scripts);

    scripts.forEach(script => {
      script.functions.forEach(func => {
        func.calls.forEach(call => {
          const targets = this.resolveFunctionCall(call, script, functionRegistry, scripts);

          targets.forEach(targetPath => {
            // Avoid duplicates (check if stronger edge already exists)
            const edgeExists = edges.some(
              e =>
                e.from === script.filePath &&
                e.to === targetPath &&
                ['extends', 'preload'].includes(e.type)
            );

            if (!edgeExists) {
              edges.push({
                from: script.filePath,
                to: targetPath,
                type: 'calls',
                weight: targets.length === 1 ? 0.8 : 0.4, // Lower weight for ambiguous calls
              });
            }
          });
        });
      });
    });

    // Create type hint edges (from function parameters and return types)
    const typeRegistry = this.buildTypeRegistry(scripts);

    scripts.forEach(script => {
      script.functions.forEach(func => {
        // Parameter types
        func.paramTypes?.forEach(param => {
          if (param.type && !this.isBuiltInType(param.type)) {
            const baseType = this.extractBaseType(param.type);
            const targetPath = typeRegistry.get(baseType);

            if (targetPath && targetPath !== script.filePath) {
              const edgeExists = edges.some(e => e.from === script.filePath && e.to === targetPath);
              if (!edgeExists) {
                edges.push({
                  from: script.filePath,
                  to: targetPath,
                  type: 'type_hint',
                  weight: 0.6,
                });
              }
            }
          }
        });

        // Return type
        if (func.returnType && !this.isBuiltInType(func.returnType)) {
          const baseType = this.extractBaseType(func.returnType);
          const targetPath = typeRegistry.get(baseType);

          if (targetPath && targetPath !== script.filePath) {
            const edgeExists = edges.some(e => e.from === script.filePath && e.to === targetPath);
            if (!edgeExists) {
              edges.push({
                from: script.filePath,
                to: targetPath,
                type: 'type_hint',
                weight: 0.6,
              });
            }
          }
        }
      });
    });

    // Create nodes for scenes
    if (scenes) {
      scenes.forEach(scene => {
        const node: GraphNode = {
          id: scene.filePath,
          label: scene.sceneName,
          type: 'scene',
          metadata: {
            nodeCount: this.countSceneNodes(scene.rootNode),
            connectionCount: scene.connections.length,
          },
        };
        nodes.push(node);
        nodeMap.set(scene.filePath, node);
      });
    }

    // Create edges from scenes to scripts and other scenes
    if (scenes) {
      scenes.forEach(scene => {
        scene.dependencies?.forEach(dep => {
          if (dep.type === 'scene_script') {
            const targetScript = this.resolveScriptPath(dep.path, scripts);
            if (targetScript) {
              edges.push({
                from: scene.filePath,
                to: targetScript,
                type: 'scene_script',
                weight: 1.5,
              });
            }
          }

          if (dep.type === 'scene_instance') {
            const targetScene = scenes.find(s => s.filePath === dep.path);
            if (targetScene) {
              edges.push({
                from: scene.filePath,
                to: targetScene.filePath,
                type: 'scene_instance',
                weight: 1.2,
              });
            }
          }
        });
      });
    }

    // Create virtual nodes for referenced built-in classes
    referencedBuiltins.forEach(className => {
      const virtualNodeId = `godot://${className}`;

      const virtualNode: GraphNode = {
        id: virtualNodeId,
        label: className,
        type: 'class',
        metadata: {
          isVirtual: true,
          isBuiltIn: true,
          functionCount: 0,
          signalCount: 0,
          exportCount: 0,
        },
        // Position will be computed by force-directed layout
      };

      nodes.push(virtualNode);
      nodeMap.set(virtualNodeId, virtualNode);
    });

    // Apply 3D force-directed layout to position nodes
    const layoutConfig = selectLayoutConfig(nodes.length);
    const positionedNodes = computeForceDirectedLayout3D(nodes, edges, layoutConfig);

    return { nodes: positionedNodes, edges };
  }

  /**
   * Extract function body from script lines starting at lineIndex
   */
  private extractFunctionBody(lines: string[], startIndex: number): string {
    const startLine = lines[startIndex];
    if (!startLine) return '';

    const baseIndent = startLine.search(/\S/);
    let body = '';
    let i = startIndex + 1;

    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      const lineIndent = line.search(/\S/);

      // Stop if we hit a line with same or less indentation (new function/block)
      if (line.trim() && lineIndent <= baseIndent) {
        break;
      }

      body += line + '\n';
      i++;
    }

    return body;
  }

  /**
   * Extract function calls from code block
   */
  private extractFunctionCalls(code: string): string[] {
    const calls = new Set<string>();
    // Match function calls: word followed by parentheses
    const callRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
    let match;

    while ((match = callRegex.exec(code)) !== null) {
      const functionName = match[1];
      if (!functionName) continue;

      // Filter out common keywords
      if (
        ![
          'if',
          'elif',
          'else',
          'while',
          'for',
          'match',
          'func',
          'class',
          'extends',
          'var',
          'const',
          'return',
          'assert',
          'await',
          'signal',
          'emit_signal',
          'print',
        ].includes(functionName)
      ) {
        calls.add(functionName);
      }
    }

    return Array.from(calls);
  }

  /**
   * Resolve a class name to its likely file path
   * Godot class names map to script files by convention
   */
  private resolveClassPath(className: string): string {
    // Built-in Godot classes
    if (this.isBuiltInClass(className)) {
      return `godot://${className}`;
    }

    // Custom classes typically in res://scripts/ or user-defined paths
    return `res://scripts/${className}.gd`;
  }

  /**
   * Resolve a relative script path to absolute within project
   */
  private resolveScriptPath(path: string, availableScripts: ScriptAnalysis[]): string | null {
    // If path starts with res://, normalize it
    const normalizedPath = path.startsWith('res://') ? path : `res://${path}`;

    // Try exact match
    for (const script of availableScripts) {
      if (script.filePath === normalizedPath) {
        return script.filePath;
      }
    }

    // Try suffix match (e.g., "Player.gd" matches "res://scripts/Player.gd")
    const pathSegment = path.replace(/\.gd$/, '');
    for (const script of availableScripts) {
      if (script.filePath.endsWith(pathSegment)) {
        return script.filePath;
      }
    }

    return null;
  }

  /**
   * Check if a class name is a built-in Godot class
   */
  private isBuiltInClass(className: string): boolean {
    const builtInClasses = [
      'Node',
      'Node2D',
      'Node3D',
      'Control',
      'CanvasItem',
      'Spatial',
      'Camera3D',
      'Camera2D',
      'CharacterBody2D',
      'CharacterBody3D',
      'RigidBody2D',
      'RigidBody3D',
      'StaticBody2D',
      'StaticBody3D',
      'Area2D',
      'Area3D',
      'AnimatedSprite2D',
      'Sprite2D',
      'Sprite3D',
      'AnimationPlayer',
      'Timer',
      'AudioStreamPlayer',
      'AudioStreamPlayer2D',
      'AudioStreamPlayer3D',
      'Button',
      'Label',
      'LineEdit',
      'TextEdit',
      'Panel',
      'PanelContainer',
      'VBoxContainer',
      'HBoxContainer',
      'GridContainer',
      'TabContainer',
      'Window',
      'Resource',
      'RefCounted',
      'Object',
    ];

    return builtInClasses.includes(className);
  }

  /**
   * Count the number of nodes in a scene hierarchy
   */
  private countSceneNodes(node?: SceneNode): number {
    if (!node) return 0;
    return 1 + node.children.reduce((sum, child) => sum + this.countSceneNodes(child), 0);
  }

  /**
   * Build a registry mapping function names to the scripts that define them
   * Used for function call resolution
   */
  private buildFunctionRegistry(scripts: ScriptAnalysis[]): Map<string, string[]> {
    const registry = new Map<string, string[]>();

    scripts.forEach(script => {
      script.functions.forEach(func => {
        if (!registry.has(func.name)) {
          registry.set(func.name, []);
        }
        registry.get(func.name)!.push(script.filePath);
      });
    });

    return registry;
  }

  /**
   * Resolve a function call to potential target scripts
   * Handles both direct calls (function_name()) and method calls (object.method_name())
   */
  private resolveFunctionCall(
    call: string,
    callingScript: ScriptAnalysis,
    functionRegistry: Map<string, string[]>,
    scripts: ScriptAnalysis[]
  ): string[] {
    const targets: string[] = [];

    // Handle method calls: obj.method()
    const methodMatch = call.match(/^(\w+)\.(\w+)$/);
    if (methodMatch && methodMatch[1] && methodMatch[2]) {
      const objName = methodMatch[1];
      const methodName = methodMatch[2];

      // Check if objName is preloaded/loaded
      const preloadDep = callingScript.dependencies.find(
        dep =>
          (dep.type === 'preload' || dep.type === 'load') &&
          dep.path.toLowerCase().includes(objName.toLowerCase())
      );

      if (preloadDep) {
        const targetPath = this.resolveScriptPath(preloadDep.path, scripts);
        if (targetPath) targets.push(targetPath);
      }

      // Fallback: registry lookup for the method name
      const possibleScripts = functionRegistry.get(methodName) || [];
      targets.push(...possibleScripts);
    }
    // Handle direct calls: function_name()
    else {
      // Check extends chain first
      if (callingScript.extendsClass) {
        const parentPath = this.resolveScriptPath(callingScript.extendsClass, scripts);
        if (parentPath) {
          const parent = scripts.find(s => s.filePath === parentPath);
          if (parent?.functions.some(f => f.name === call)) {
            targets.push(parentPath);
          }
        }
      }

      // Then check registry for other scripts
      const possibleScripts = functionRegistry.get(call) || [];
      targets.push(...possibleScripts);
    }

    // Remove duplicates and self-references
    return Array.from(new Set(targets)).filter(t => t !== callingScript.filePath);
  }

  /**
   * Analyze all scripts in a project and return consolidated data
   */
  analyzeProject(scripts: ScriptAnalysis[]): {
    totalScripts: number;
    totalFunctions: number;
    totalSignals: number;
    dependencyGraph: DependencyGraph;
    scriptsByClassName: Map<string, ScriptAnalysis>;
    scriptsByFilePath: Map<string, ScriptAnalysis>;
  } {
    const scriptsByClassName = new Map<string, ScriptAnalysis>();
    const scriptsByFilePath = new Map<string, ScriptAnalysis>();
    let totalFunctions = 0;
    let totalSignals = 0;

    scripts.forEach(script => {
      scriptsByFilePath.set(script.filePath, script);
      if (script.className) {
        scriptsByClassName.set(script.className, script);
      }
      totalFunctions += script.functions.length;
      totalSignals += script.signals.length;
    });

    const dependencyGraph = this.buildDependencyGraph(scripts);

    return {
      totalScripts: scripts.length,
      totalFunctions,
      totalSignals,
      dependencyGraph,
      scriptsByClassName,
      scriptsByFilePath,
    };
  }
}

// Export singleton instance
export const godotParser = new GodotParserService();
