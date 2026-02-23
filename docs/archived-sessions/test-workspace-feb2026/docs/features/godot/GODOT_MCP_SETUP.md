# Godot MCP Server - Setup Complete ✅

The Godot MCP Server has been configured for Claude Code integration.

## What is the MCP Server?

The MCP (Model Context Protocol) server allows Claude to directly interact with Godot project data through 15 specialized tools and 8 resources.

## Configuration Status

✅ **MCP Server is configured** at: `~/.claude/settings.local.json`

### Current Configuration:
```json
{
  "mcpServers": {
    "godot": {
      "command": "bash",
      "args": ["/home/user/Projects/veritable-games-main/frontend/mcp-servers/godot/start.sh"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/veritable_games",
        "API_BASE_URL": "http://localhost:3002"
      }
    }
  }
}
```

## Available Tools (15 Total)

### Script Analysis
- **list_scripts** - List all scripts in a version
- **get_script** - Get full content and metadata of a script
- **search_scripts** - Search scripts by content, functions, or signals
- **analyze_dependencies** - Analyze script dependencies and relationships

### Dependency Graph
- **get_dependency_graph** - Get complete dependency graph visualization
- **get_active_nodes** - Find actively executing scripts (temperature-based)
- **find_hot_paths** - Identify frequently used code paths

### Build Management
- **get_build_status** - Check if build is pending, building, success, or failed
- **trigger_build** - Start a new Godot build (export to WebGL)
- **wait_for_build** - Poll and wait for build completion

### Project Information
- **list_projects** - List all Godot projects
- **list_versions** - List versions for a project
- **get_version_info** - Get detailed version information
- **get_project_info** - Get detailed project information
- **get_source_file** - Retrieve source code from filesystem

## Available Resources (8 Total)

- **projects** - List all projects with metadata
- **versions** - List versions by project
- **dependency_graphs** - Dependency graph for each version
- **scripts** - Script inventory and metadata
- **active_scripts** - Currently executing scripts
- **build_status** - Build status for all versions
- **runtime_events** - Real-time script execution events
- **graph_temperature** - Heat map of script execution frequency

## How to Use

### Option 1: Use in Claude Code CLI
In any Claude Code session, you can now ask about Godot:

```bash
# Examples:
# "Which scripts are most active in NOXII 0.16?"
# "Show me the dependencies for Player.gd"
# "What's the build status for all versions?"
# "List all scripts in the physics menu"
```

### Option 2: Direct Server Start (for debugging)
```bash
cd /home/user/Projects/veritable-games-main/frontend/mcp-servers/godot
npm start
# or with custom database:
npm run start:localhost
```

## Troubleshooting

### Server Won't Start
1. Check PostgreSQL is running:
   ```bash
   psql -U postgres -h localhost veritable_games -c "SELECT 1"
   ```

2. Verify environment variables:
   ```bash
   echo $DATABASE_URL
   echo $API_BASE_URL
   ```

3. Check MCP server logs in Claude Code

### Connection Issues
- Make sure the API server is running (`npm run dev` from frontend/)
- Verify DATABASE_URL points to the correct PostgreSQL instance
- Check that port 3002 is accessible

## Database Requirements

The MCP server requires PostgreSQL with the Veritable Games schema:
- Database: `veritable_games`
- User: `postgres` (default)
- Host: `localhost:5432` (default)

## Features

✨ **Real-time Insights**
- Temperature-based activity tracking (shows which scripts are executing most)
- Live runtime event streaming
- Dependency analysis and hot-path detection

🔥 **Build Integration**
- Trigger Godot builds directly from Claude
- Monitor build progress and status
- Get notifications when builds complete

📊 **Deep Analysis**
- Search across all script content, functions, and signals
- Analyze dependency relationships
- Identify bottlenecks and frequently-used code paths

## Next Steps

1. **Start a Claude Code session** in your terminal
2. **Ask Claude about your Godot projects** - no special commands needed
3. **Examples to try:**
   - "What scripts are active right now?"
   - "Show me all dependencies for [script name]"
   - "What's the build status?"
   - "Find all scripts that call [function name]"

Enjoy your enhanced Godot development experience! 🚀
