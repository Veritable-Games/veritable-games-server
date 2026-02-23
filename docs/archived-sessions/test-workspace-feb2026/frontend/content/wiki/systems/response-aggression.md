# RESPONSE/REPROACH/AGGRESSION

**Type**: Core Enact #10  
**System**: [[enact-dialogue-system|ENACT/Dialogue System]]

## Description

Reactive self-defense, boundary protection, righteous indignation

## Symbol Image

![[/symbols/RESPONSE-WILL-OF-REPROACH-AGGRESSION.png|RESPONSE/WILL OF REPROACH/AGGRESSION]]

_Visual representation of the RESPONSE/WILL OF REPROACH/AGGRESSION affect in the
ENACT system._

## Usage in Dialogue System

This enact represents a fundamental human emotional expression within the
ENACT/Dialogue System. It affects:

- **Character Behavior**: NPCs with high response/will of reproach/aggression
  weighting will express this affect more frequently
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
    RESPONSE_WILL_OF_REPROACH_AGGRESSION = 10
}

func trigger_affect_response(affect: Affect):
    match affect:
        Affect.RESPONSE_WILL_OF_REPROACH_AGGRESSION:
            handle_response_aggression_response()
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
