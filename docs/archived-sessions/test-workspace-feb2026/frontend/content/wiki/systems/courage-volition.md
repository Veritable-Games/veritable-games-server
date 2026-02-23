# COURAGE/VOLITION

**Type**: Core Enact #11  
**System**: [[enact-dialogue-system|ENACT/Dialogue System]]

## Description

Bravery, standing for principles, proactive leadership action

## Symbol Image

_Symbol image is currently in development and will be added in a future update._

## Usage in Dialogue System

This enact represents a fundamental human emotional expression within the
ENACT/Dialogue System. It affects:

- **Character Behavior**: NPCs with high courage/volition weighting will express
  this affect more frequently
- **Player Expression**: Available as a directional choice during conversations
- **Relationship Impact**: Using this affect appropriately builds trust; using
  it inappropriately can damage relationships
- **Political Identity**: Repeated use influences how NPCs perceive the player's
  political alignment

## Technical Implementation

### In GDScript

```gdscript
# Example usage in dialogue system
enum Affect {
    COURAGE_VOLITION = 11
}

func trigger_affect_response(affect: Affect):
    match affect:
        Affect.COURAGE_VOLITION:
            handle_courage_volition_response()
            pass
```

### Emotional Context

- **Triggers**: Situations that naturally evoke this emotional state
- **Responses**: How NPCs react when this affect is expressed
- **Combinations**: How this affect combines with other emotions for complex
  expressions

## Related Documentation

- [[enact-dialogue-system|ENACT/Dialogue System Overview]]
- [[enact-dialogue-system|Character Emotional Framework]]
- [[enact-dialogue-system|Dialogue System Implementation]]

## Tags

#enact #dialogue-system #symbols #emotions #game-mechanics
