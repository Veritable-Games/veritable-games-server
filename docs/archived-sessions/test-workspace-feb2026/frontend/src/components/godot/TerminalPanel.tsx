'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@/hooks/useDraggable';

interface TerminalMessage {
  type: 'info' | 'success' | 'warning' | 'error' | 'command';
  text: string;
  timestamp: Date;
}

interface TerminalPanelProps {
  versionId?: number;
  projectSlug?: string;
  onClose?: () => void;
  // Panel repositioning mode support
  isSelected?: boolean;
  onSelect?: () => void;
  allowDragFromAnywhere?: boolean;
}

export function TerminalPanel({
  versionId,
  projectSlug,
  onClose,
  isSelected,
  onSelect,
  allowDragFromAnywhere,
}: TerminalPanelProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Terminal draggable hook
  const terminalDrag = useDraggable({
    id: 'terminal',
    defaultPosition: { x: 0, y: 16 },
    versionId: versionId || 0,
    isSelected: isSelected || false,
    onSelect,
    allowDragFromAnywhere: allowDragFromAnywhere || false,
  });

  // Initialize with startup hint
  useEffect(() => {
    const startupMessages: TerminalMessage[] = [
      {
        type: 'info',
        text: '╔════════════════════════════════════════════════════════════╗',
        timestamp: new Date(),
      },
      {
        type: 'success',
        text: '║         Godot Developer Console - MCP Terminal            ║',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '╚════════════════════════════════════════════════════════════╝',
        timestamp: new Date(),
      },
      {
        type: 'success',
        text: '✅ MCP Server configured and ready',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '📚 Available Commands:',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  help                - Show all commands',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  list-tools          - Show 15 MCP tools',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  list-resources      - Show 8 MCP resources',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  features            - Show full feature list',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  tools-graph         - Dependency analysis tools',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  tools-build         - Build management tools',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  tools-script        - Script operation tools',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  tools-analysis      - Advanced analysis tools',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  clear               - Clear terminal',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '🚀 Quick Tips:',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  • Use Claude Code to ask about Godot projects',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  • Terminal shows tool outputs and diagnostics',
        timestamp: new Date(),
      },
      {
        type: 'info',
        text: '  • Type "help" for more detailed command info',
        timestamp: new Date(),
      },
    ];
    setMessages(startupMessages);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (type: TerminalMessage['type'], text: string) => {
    setMessages(prev => [...prev, { type, text, timestamp: new Date() }]);
  };

  const handleCommand = (command: string) => {
    addMessage('command', `$ ${command}`);

    const args = command.toLowerCase().trim().split(' ');
    const cmd = args[0];

    switch (cmd) {
      case 'help':
        addMessage('info', 'Available commands:');
        addMessage('info', '');
        addMessage('info', '  help                 - Show this help message');
        addMessage('info', '  list-tools           - List all available MCP tools');
        addMessage('info', '  list-resources       - List all available MCP resources');
        addMessage('info', '  features             - Show all features');
        addMessage('info', '  tools-graph          - Tools for dependency analysis');
        addMessage('info', '  tools-build          - Tools for build management');
        addMessage('info', '  tools-script         - Tools for script operations');
        addMessage('info', '  tools-analysis       - Tools for advanced analysis');
        addMessage('info', '  start-hint           - Show MCP server startup hint');
        addMessage('info', '  clear                - Clear terminal');
        break;

      case 'list-tools':
        addMessage('success', '15 MCP Tools Available:');
        addMessage('info', '');
        const tools = [
          'ping - Health check',
          'get_projects - List all Godot projects',
          'get_versions - List project versions',
          'get_dependency_graph - Full 3D script dependency graph',
          'search_nodes - Find scripts by name/path',
          'find_isolated_nodes - Identify unused scripts',
          'get_node_details - Deep script analysis',
          'get_node_dependencies - BFS traversal (N hops)',
          'trigger_build - Start HTML5 build',
          'get_build_status - Check build progress',
          'get_script_content - Read script source code',
          'analyze_dependency_chain - Find paths between scripts',
          'get_runtime_events - See executing scripts',
          'set_context_node - Set selected node for Claude',
          'get_context - Get current context state',
        ];
        tools.forEach(tool => addMessage('info', `  • ${tool}`));
        break;

      case 'list-resources':
        addMessage('success', '8 MCP Resources Available:');
        addMessage('info', '');
        const resources = [
          'godot://projects - JSON list of all projects',
          'godot://project/{slug}/versions - Versions for a project',
          'godot://version/{id}/graph - Full dependency graph',
          'godot://version/{id}/scripts - All scripts in version',
          'godot://version/{id}/script/{path} - Individual script source',
          'godot://version/{id}/build - Build status',
          'godot://version/{id}/runtime-events - Live execution events',
          'godot://context - Current context (selected node, etc.)',
        ];
        resources.forEach(res => addMessage('info', `  • ${res}`));
        break;

      case 'features':
        addMessage('success', '🚀 Full Feature List:');
        addMessage('info', '');
        addMessage('info', '✅ Dependency Analysis:');
        addMessage('info', '   - 3D force-directed graph visualization');
        addMessage('info', '   - Script search and filtering');
        addMessage('info', '   - Isolated node detection');
        addMessage('info', '   - Dijkstra pathfinding');
        addMessage('info', '');
        addMessage('info', '✅ Build Management:');
        addMessage('info', '   - Async HTML5 export triggering');
        addMessage('info', '   - Build status polling');
        addMessage('info', '   - Success/failure notifications');
        addMessage('info', '');
        addMessage('info', '✅ Script Analysis:');
        addMessage('info', '   - Source code reading');
        addMessage('info', '   - Function/signal detection');
        addMessage('info', '   - Dependency extraction');
        addMessage('info', '   - Class hierarchy analysis');
        addMessage('info', '');
        addMessage('info', '✅ Runtime Monitoring:');
        addMessage('info', '   - Live execution event streaming');
        addMessage('info', '   - Temperature-based activation tracking');
        addMessage('info', '   - Hotspot identification');
        addMessage('info', '   - Performance metrics');
        addMessage('info', '');
        addMessage('info', '✅ Claude Code Integration:');
        addMessage('info', '   - AI-powered script analysis');
        addMessage('info', '   - Context-aware recommendations');
        addMessage('info', '   - Automatic dependency resolution');
        break;

      case 'tools-graph':
        addMessage('success', 'Dependency Graph Tools:');
        addMessage('info', '');
        addMessage('info', '  get_dependency_graph - Load full 3D graph with stats');
        addMessage('info', '  search_nodes - Find scripts by name (case-insensitive)');
        addMessage('info', '  find_isolated_nodes - Identify unconnected scripts');
        addMessage('info', '  get_node_details - Deep analysis of specific script');
        addMessage('info', '  get_node_dependencies - BFS traversal (customizable depth)');
        break;

      case 'tools-build':
        addMessage('success', 'Build Management Tools:');
        addMessage('info', '');
        addMessage('info', '  trigger_build - Start HTML5 export (returns immediately)');
        addMessage('info', '  get_build_status - Check current build state');
        addMessage('info', '  list_versions - Enumerate all project versions');
        break;

      case 'tools-script':
        addMessage('success', 'Script Operation Tools:');
        addMessage('info', '');
        addMessage('info', '  get_script_content - Read full source code + metadata');
        addMessage('info', '  analyze_dependency_chain - Find shortest path between scripts');
        addMessage('info', '  get_runtime_events - Stream recent execution events');
        break;

      case 'tools-analysis':
        addMessage('success', 'Advanced Analysis Tools:');
        addMessage('info', '');
        addMessage('info', '  set_context_node - Update selected script for Claude context');
        addMessage('info', '  get_context - Retrieve current visualization state');
        addMessage('info', '  ping - Test MCP server connectivity');
        break;

      case 'start-hint':
        addMessage('info', '');
        addMessage('success', '✅ MCP Server Setup Complete');
        addMessage('info', '');
        addMessage('info', '✓ Server configured: bash frontend/mcp-servers/godot/start.sh');
        addMessage('info', '✓ Claude Code configured: ~/.claude/settings.local.json');
        addMessage(
          'info',
          '✓ Database: postgresql://postgres:postgres@localhost:5432/veritable_games'
        );
        addMessage('info', '✓ API Base: http://localhost:3002');
        addMessage('info', '');
        addMessage('info', '🚀 To manually start MCP server:');
        addMessage('command', 'cd frontend/mcp-servers/godot && npm start');
        addMessage('info', '');
        addMessage('info', 'Or with custom database:');
        addMessage('command', 'bash start.sh postgresql://user:pass@host/db http://api:3002');
        addMessage('info', '');
        addMessage('success', '💡 Use Claude Code to interact with Godot projects!');
        break;

      case 'clear':
        setMessages([]);
        break;

      case '':
        // Empty command, just show prompt
        break;

      default:
        addMessage('error', `Unknown command: "${command}". Type "help" for available commands.`);
    }

    addMessage('info', '');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        handleCommand(input);
        setInput('');
      }
    }
  };

  if (isMinimized) {
    return (
      <div
        ref={terminalDrag.ref}
        onClick={terminalDrag.onClick}
        onMouseDown={terminalDrag.handleMouseDown}
        style={{
          position: 'absolute',
          left: `${terminalDrag.position.x}px`,
          top: `${terminalDrag.position.y}px`,
          zIndex: terminalDrag.isDragging ? 30 : 20,
          cursor: terminalDrag.isDragging ? 'grabbing' : 'default',
          outline: terminalDrag.isMoveBlocked
            ? '2px solid #ef4444'
            : terminalDrag.isSelected
              ? '2px solid #60a5fa'
              : 'none',
          outlineOffset: '2px',
          transition: terminalDrag.isDragging ? 'none' : 'outline 0.2s ease',
        }}
        className="rounded border border-gray-700 bg-gray-900/80 px-3 py-2"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="text-sm font-semibold text-white hover:text-blue-400"
        >
          Terminal (minimized) - Click to expand
        </button>
      </div>
    );
  }

  return (
    <div
      ref={terminalDrag.ref}
      onClick={terminalDrag.onClick}
      onMouseDown={terminalDrag.handleMouseDown}
      style={{
        position: 'absolute',
        left: `${terminalDrag.position.x}px`,
        top: `${terminalDrag.position.y}px`,
        zIndex: terminalDrag.isDragging ? 30 : 20,
        cursor: terminalDrag.isDragging ? 'grabbing' : 'default',
        width: '384px',
        height: '320px',
        outline: terminalDrag.isMoveBlocked
          ? '2px solid #ef4444'
          : terminalDrag.isSelected
            ? '2px solid #60a5fa'
            : 'none',
        outlineOffset: '2px',
        transition: terminalDrag.isDragging ? 'none' : 'outline 0.2s ease',
      }}
      className="flex flex-col rounded border border-gray-700 bg-gray-950 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t border-b border-gray-700 bg-gray-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
          <span className="text-xs font-semibold text-gray-300">Terminal</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-sm text-gray-400 hover:text-gray-200"
            title="Minimize"
          >
            _
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-200"
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-0 overflow-y-auto p-3 font-mono text-xs">
        {messages.map((msg, idx) => {
          let color = 'text-gray-400';
          if (msg.type === 'success') color = 'text-green-400';
          if (msg.type === 'error') color = 'text-red-400';
          if (msg.type === 'warning') color = 'text-yellow-400';
          if (msg.type === 'command') color = 'text-blue-400';

          return (
            <div key={idx} className={`${color} whitespace-pre-wrap break-words`}>
              {msg.text}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="rounded-b border-t border-gray-700 bg-gray-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type 'help' for commands..."
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
