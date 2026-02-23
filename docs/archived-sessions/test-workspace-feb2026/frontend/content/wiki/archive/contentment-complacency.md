<h1>CONTENTMENT/COMPLACENCY</h1>
<h2>Description</h2>
<p>Satisfaction, peace, expressing completion and equilibrium</p>
<h2>Symbol Image</h2>
<p><em>Symbol image is currently in development and will be added in a future update.</em></p>
<h2>Usage in Dialogue System</h2>
<p>This enact represents a fundamental human emotional expression within the ENACT/Dialogue System. It affects:</p>
<ul>
<li><strong>Character Behavior</strong>: NPCs with high contentment/complacency weighting will express this affect more frequently</li>
<li><strong>Player Expression</strong>: Available as a directional choice during conversations</li>
<li><strong>Relationship Impact</strong>: Using this affect appropriately builds trust; using it inappropriately can damage relationships</li>
<li><strong>Political Identity</strong>: Repeated use influences how NPCs perceive the player&#39;s political alignment</li>
</ul>
<h2>Technical Implementation</h2>
<h3>In GDScript</h3>
<pre><code class="language-gdscript"># Example usage in dialogue system
enum Affect {
 CONTENTMENT_COMPLACENCY = 3
}

func trigger_affect_response(affect: Affect): match affect:
Affect.CONTENTMENT_COMPLACENCY: handle_contentment_complacency_response() pass
</code></pre>

<h3>Emotional Context</h3>
<ul>
<li><strong>Triggers</strong>: Situations that naturally evoke this emotional state</li>
<li><strong>Responses</strong>: How NPCs react when this affect is expressed</li>
<li><strong>Combinations</strong>: How this affect combines with other emotions for complex expressions</li>
</ul>
<h2>Related Documentation</h2>
<ul>
<li>[[enact-dialogue-system|ENACT/Dialogue System Overview]]</li>
<li>[[enact-dialogue-system|Character Emotional Framework]]</li>
<li>[[enact-dialogue-system|Dialogue System Implementation]]</li>
</ul>
<h2>Tags</h2>
<p>#enact #dialogue-system #symbols #emotions #game-mechanics</p>
