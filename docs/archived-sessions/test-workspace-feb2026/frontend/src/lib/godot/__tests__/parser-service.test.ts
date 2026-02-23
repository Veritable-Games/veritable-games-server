import { describe, it, expect } from 'vitest';
import { GodotParserService } from '../parser-service';

describe('GodotParserService', () => {
  const parser = new GodotParserService();

  describe('parseScript', () => {
    it('should parse class_name declaration', () => {
      const content = `extends Node
class_name Player

func _ready():
  pass
`;
      const result = parser.parseScript('res://Player.gd', content);
      expect(result.className).toBe('Player');
      expect(result.filePath).toBe('res://Player.gd');
    });

    it('should parse extends declaration', () => {
      const content = `extends CharacterBody2D

func _ready():
  pass
`;
      const result = parser.parseScript('res://scripts/Player.gd', content);
      expect(result.extendsClass).toBe('CharacterBody2D');
      expect(result.dependencies).toContainEqual({
        type: 'extends',
        path: expect.stringContaining('CharacterBody2D'),
        line: 1,
      });
    });

    it('should parse preload statements', () => {
      const content = `extends Node

const Enemy = preload("res://Enemy.gd")
var items = load("res://items/sword.tres")

func _ready():
  pass
`;
      const result = parser.parseScript('res://Player.gd', content);
      expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'preload',
          path: 'res://Enemy.gd',
        })
      );
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'load',
          path: 'res://items/sword.tres',
        })
      );
    });

    it('should parse signal declarations', () => {
      const content = `extends Node

signal health_changed(old_value, new_value)
signal player_died

func _ready():
  pass
`;
      const result = parser.parseScript('res://Player.gd', content);
      expect(result.signals.length).toBe(2);
      expect(result.signals[0].name).toBe('health_changed');
      expect(result.signals[0].params).toEqual(['old_value', 'new_value']);
      expect(result.signals[1].name).toBe('player_died');
    });

    it('should parse function declarations with parameters', () => {
      const content = `extends Node

func _ready():
  pass

func take_damage(amount: int, source: String = ""):
  var new_health = health - amount
  emit_signal("health_changed", health, new_health)

static func create_player(name: String):
  return Player.new()
`;
      const result = parser.parseScript('res://Player.gd', content);
      expect(result.functions.length).toBeGreaterThanOrEqual(3);

      const takeDamageFunc = result.functions.find(f => f.name === 'take_damage');
      expect(takeDamageFunc).toBeDefined();
      expect(takeDamageFunc?.params).toContain('amount: int');
      expect(takeDamageFunc?.isPrivate).toBe(false);

      const createPlayerFunc = result.functions.find(f => f.name === 'create_player');
      expect(createPlayerFunc?.isStatic).toBe(true);
    });

    it('should extract function calls from function body', () => {
      const content = `extends Node

func attack():
  check_ammo()
  play_animation("attack")
  deal_damage(10)
  emit_signal("attacked")
`;
      const result = parser.parseScript('res://Player.gd', content);
      const attackFunc = result.functions.find(f => f.name === 'attack');
      expect(attackFunc?.calls).toContain('check_ammo');
      expect(attackFunc?.calls).toContain('play_animation');
      expect(attackFunc?.calls).toContain('deal_damage');
    });

    it('should parse @export annotations', () => {
      const content = `extends CharacterBody2D

@export
var speed: float = 200.0

@export
var jump_force: float = 400.0

func _ready():
  pass
`;
      const result = parser.parseScript('res://Player.gd', content);
      expect(result.exports.length).toBe(2);
      expect(result.exports[0].name).toBe('speed');
      expect(result.exports[0].type).toBe('float');
      expect(result.exports[1].name).toBe('jump_force');
    });

    it('should ignore comments and empty lines', () => {
      const content = `extends Node
# This is a comment
# class_name ShouldBeIgnored

class_name ActualClass

# func ignored():
#   pass

func real_function():
  pass
`;
      const result = parser.parseScript('res://test.gd', content);
      expect(result.className).toBe('ActualClass');
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].name).toBe('real_function');
    });

    it('should handle complex script with all features', () => {
      const content = `extends CharacterBody2D
class_name Player

const Enemy = preload("res://Enemy.gd")

@export
var speed: float = 200.0

signal health_changed(old_value, new_value)
signal died

var health: int = 100

func _ready():
  connect("health_changed", Callable(self, "_on_health_changed"))

func _process(delta):
  handle_input()
  apply_velocity()

func take_damage(amount: int):
  var old_health = health
  health -= amount
  health_changed.emit(old_health, health)
  if health <= 0:
    die()

func die():
  died.emit()
  queue_free()

static func create_player():
  return Player.new()
`;
      const result = parser.parseScript('res://scripts/Player.gd', content);

      expect(result.className).toBe('Player');
      expect(result.extendsClass).toBe('CharacterBody2D');
      expect(result.dependencies.length).toBeGreaterThanOrEqual(1);
      expect(result.signals.length).toBe(2);
      expect(result.exports.length).toBe(1);
      expect(result.functions.length).toBeGreaterThanOrEqual(5);
    });

    it('should parse @onready annotations', () => {
      const content = `extends CharacterBody2D

@onready var player = $Player
@onready var animation_player = $AnimationPlayer
@onready var health_bar: ProgressBar = $UI/HealthBar
@onready var enemy = $"../Enemy"

func _ready():
  pass
`;
      const result = parser.parseScript('res://Game.gd', content);

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'onready',
          path: 'nodepath://Player',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'onready',
          path: 'nodepath://AnimationPlayer',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'onready',
          path: 'nodepath://UI/HealthBar',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'onready',
          path: 'nodepath://../Enemy',
        })
      );
    });

    it('should parse get_node() calls', () => {
      const content = `extends Node

func _ready():
  var player = get_node("Player")
  var manager = get_node("/root/GameManager")
  var health = get_node_or_null("UI/HealthBar")
  var parent_ref = get_node("../Enemy")
`;
      const result = parser.parseScript('res://Game.gd', content);

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'get_node',
          path: 'nodepath://Player',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'get_node',
          path: 'autoload://GameManager',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'get_node',
          path: 'nodepath://UI/HealthBar',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'get_node',
          path: 'nodepath://../Enemy',
        })
      );
    });

    it('should parse signal connect() calls', () => {
      const content = `extends Node

signal health_changed(old_val, new_val)
signal died

func _ready():
  connect("health_changed", Callable(self, "_on_health_changed"))
  died.connect(_on_player_died)
  player.health_changed.connect(ui._update_health)
`;
      const result = parser.parseScript('res://Player.gd', content);

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'signal_connect',
          path: 'signal://health_changed',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'signal_connect',
          path: 'signal://died',
        })
      );

      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'signal_connect',
          path: 'signal://health_changed',
        })
      );
    });
  });

  describe('buildDependencyGraph', () => {
    it('should create nodes for all scripts', () => {
      const scripts = [
        { filePath: 'res://Player.gd', className: 'Player', dependencies: [] } as any,
        { filePath: 'res://Enemy.gd', className: 'Enemy', dependencies: [] } as any,
      ];

      const graph = parser.buildDependencyGraph(scripts);
      expect(graph.nodes.length).toBe(2);
      expect(graph.nodes.map(n => n.label)).toContain('Player');
      expect(graph.nodes.map(n => n.label)).toContain('Enemy');
    });

    it('should create edges from dependencies', () => {
      const scripts = [
        {
          filePath: 'res://Player.gd',
          className: 'Player',
          dependencies: [
            {
              type: 'extends' as const,
              path: 'res://scripts/CharacterBody2D.gd',
              line: 1,
            },
          ],
          signals: [],
          functions: [],
          exports: [],
        },
        {
          filePath: 'res://scripts/CharacterBody2D.gd',
          className: 'CharacterBody2D',
          dependencies: [],
          signals: [],
          functions: [],
          exports: [],
        },
      ];

      const graph = parser.buildDependencyGraph(scripts);
      expect(graph.edges.length).toBeGreaterThanOrEqual(1);
      expect(graph.edges[0].type).toBe('extends');
    });

    it('should assign 3D positions to nodes for visualization', () => {
      const scripts = [
        {
          filePath: 'res://Player.gd',
          className: 'Player',
          dependencies: [
            {
              type: 'extends' as const,
              path: 'res://Character.gd',
              line: 1,
            },
          ],
          signals: [],
          functions: [],
          exports: [],
        },
        {
          filePath: 'res://Character.gd',
          className: 'Character',
          dependencies: [],
          signals: [],
          functions: [],
          exports: [],
        },
        {
          filePath: 'res://Enemy.gd',
          className: 'Enemy',
          dependencies: [],
          signals: [],
          functions: [],
          exports: [],
        },
      ];

      const graph = parser.buildDependencyGraph(scripts);

      // Verify all nodes have 3D positions
      graph.nodes.forEach(node => {
        expect(node.position).toBeDefined();
        expect(node.position?.x).toBeDefined();
        expect(node.position?.y).toBeDefined();
        expect(node.position?.z).toBeDefined();
        expect(typeof node.position?.x).toBe('number');
        expect(typeof node.position?.y).toBe('number');
        expect(typeof node.position?.z).toBe('number');
      });

      // CRITICAL: Not all nodes should be at z=0 (would indicate circular layout)
      const allZeroZ = graph.nodes.every(n => n.position?.z === 0);
      expect(allZeroZ).toBe(false);

      // At least one node should have significant Z depth
      const hasDepth = graph.nodes.some(n => n.position && Math.abs(n.position.z) > 0.1);
      expect(hasDepth).toBe(true);
    });
  });

  describe('parseScene', () => {
    it('should parse basic scene structure', () => {
      const content = `[gd_scene load_steps=2 format=3 uid="uid://abc"]

[node name="Main" type="Node"]
[node name="Player" type="CharacterBody2D" parent="Main"]
[node name="Enemy" type="CharacterBody2D" parent="Main"]
`;
      const result = parser.parseScene('res://main.tscn', content);
      expect(result.sceneName).toBe('main');
      expect(result.filePath).toBe('res://main.tscn');
    });

    it('should parse scene connections', () => {
      const content = `[gd_scene load_steps=2 format=3 uid="uid://abc"]

[node name="Main" type="Node"]
[node name="Player" type="Node" parent="Main"]
[node name="Enemy" type="Node" parent="Main"]

[connection signal="health_changed" from="Player" to="Enemy" method="_on_player_health_changed"]
[connection signal="died" from="Enemy" to="Main" method="_on_enemy_died"]
`;
      const result = parser.parseScene('res://main.tscn', content);
      expect(result.connections.length).toBe(2);
      expect(result.connections[0].from).toBe('Player');
      expect(result.connections[0].fromSignal).toBe('health_changed');
      expect(result.connections[0].to).toBe('Enemy');
      expect(result.connections[0].toFunction).toBe('_on_player_health_changed');
    });

    it('should parse scene script attachments', () => {
      const content = `[gd_scene load_steps=3 format=3]

[node name="Main" type="Node"]
script = ExtResource("1_abc123")

[node name="Player" type="CharacterBody2D"]
script = ExtResource("2_def456")
`;
      const result = parser.parseScene('res://main.tscn', content);

      expect(result.rootNode?.script).toBe('1_abc123');
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies?.length).toBeGreaterThan(0);
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'scene_script',
          path: 'resource://1_abc123',
        })
      );
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'scene_script',
          path: 'resource://2_def456',
        })
      );
    });

    it('should parse scene instances', () => {
      const content = `[gd_scene load_steps=2 format=3]

[node name="Main" type="Node"]

[node name="Enemy" type="Node" parent="Main"]
instance = ExtResource("3_xyz789")
`;
      const result = parser.parseScene('res://level.tscn', content);

      expect(result.dependencies).toBeDefined();
      expect(result.dependencies).toContainEqual(
        expect.objectContaining({
          type: 'scene_instance',
          path: 'resource://3_xyz789',
        })
      );
    });
  });

  describe('analyzeProject', () => {
    it('should aggregate statistics across all scripts', () => {
      const scripts = [
        {
          filePath: 'res://Player.gd',
          className: 'Player',
          dependencies: [],
          signals: [{ name: 'health_changed', line: 1 }],
          functions: [
            {
              name: 'take_damage',
              params: [],
              line: 1,
              calls: [],
            },
          ],
          exports: [],
        },
        {
          filePath: 'res://Enemy.gd',
          className: 'Enemy',
          dependencies: [],
          signals: [
            { name: 'died', line: 1 },
            { name: 'attacked', line: 2 },
          ],
          functions: [
            {
              name: 'attack',
              params: [],
              line: 1,
              calls: [],
            },
            {
              name: 'die',
              params: [],
              line: 2,
              calls: [],
            },
          ],
          exports: [],
        },
      ] as any;

      const result = parser.analyzeProject(scripts);
      expect(result.totalScripts).toBe(2);
      expect(result.totalFunctions).toBe(3);
      expect(result.totalSignals).toBe(3);
      expect(result.scriptsByClassName.get('Player')).toBeDefined();
      expect(result.scriptsByClassName.get('Enemy')).toBeDefined();
      expect(result.dependencyGraph.nodes.length).toBe(2);
    });
  });
});
