# GitHub MCP Server Setup for Claude Code

**Purpose**: Enable Claude Code to directly interact with GitHub APIs for CI/CD monitoring, PR management, and repository operations

**Last Updated**: November 2, 2025

---

## What is GitHub MCP Server?

The GitHub MCP (Model Context Protocol) Server allows Claude Code to:
- ✅ Check CI/CD workflow status in real-time
- ✅ View detailed build logs and errors
- ✅ Create and manage pull requests
- ✅ Access repository information
- ✅ Work with issues and branches
- ✅ Review commit history

**Without MCP**: Claude must ask you to run `gh` commands
**With MCP**: Claude can directly query GitHub APIs

---

## Prerequisites

- Claude Code CLI installed
- GitHub account
- Repository access (Veritable-Games/veritable-games-site)
- 10 minutes

---

## Step 1: Create GitHub Personal Access Token (PAT)

### 1.1 Generate Token

1. **Go to GitHub Settings**:
   - Visit: https://github.com/settings/tokens
   - Or: GitHub.com → Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Click "Generate new token (classic)"**

3. **Configure Token**:
   - **Note**: `Claude Code MCP - Veritable Games`
   - **Expiration**: 90 days (or custom)
   - **Scopes** (check these boxes):
     - ✅ `repo` (Full control of private repositories)
       - Includes: repo:status, repo_deployment, public_repo, repo:invite, security_events
     - ✅ `read:org` (Read org and team membership, read org projects)
     - ✅ `workflow` (Update GitHub Action workflows)

4. **Click "Generate token"**

5. **Copy Token Immediately**
   - Format: `github_pat_11ABVXWVQ0...` (starts with `github_pat_`)
   - **Save it now** - you won't see it again!

### 1.2 Store Token Securely

**Create/update `.env` file in project root**:

```bash
# From your project root (/home/user/Projects/veritable-games-main)
echo "GITHUB_PAT=github_pat_YOUR_TOKEN_HERE" >> .env
```

**Verify `.env` is in `.gitignore`**:
```bash
grep "^\.env$" .gitignore || echo ".env" >> .gitignore
```

**⚠️ CRITICAL**: Never commit your `.env` file or token to git!

---

## Step 2: Install GitHub MCP Server Binary

### 2.1 Download Latest Release

```bash
# Create directory for MCP binaries
mkdir -p ~/.local/bin

# Download latest GitHub MCP server (Linux x86_64)
cd /tmp
curl -L -o github-mcp-server.tar.gz \
  https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server_Linux_x86_64.tar.gz

# Extract binary
tar -xzf github-mcp-server.tar.gz

# Move to PATH
mv github-mcp-server ~/.local/bin/
chmod +x ~/.local/bin/github-mcp-server

# Verify installation
which github-mcp-server
# Should output: /home/user/.local/bin/github-mcp-server
```

### 2.2 Verify Binary Works

```bash
# Test the binary (should show version info)
github-mcp-server --version
```

---

## Step 3: Configure Claude Code

### 3.1 Add GitHub MCP Server

**From your project directory**:

```bash
cd /home/user/Projects/veritable-games-main

# Add GitHub MCP server with your token
claude mcp add-json github '{
  "command": "github-mcp-server",
  "args": ["stdio"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_PAT_HERE"
  }
}'
```

**Or use environment variable** (recommended):

```bash
# Using token from .env file
claude mcp add-json github '{
  "command": "github-mcp-server",
  "args": ["stdio"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "'$(grep GITHUB_PAT .env | cut -d '=' -f2)'"
  }
}'
```

**Expected output**:
```
Added stdio MCP server github to local config
```

### 3.2 Verify Configuration

```bash
# List all configured MCP servers
claude mcp list

# Should show:
# github: github-mcp-server stdio - ✓ Connected
```

```bash
# Get detailed server info
claude mcp get github

# Should show server details with your token (partially masked)
```

---

## Step 4: Restart Claude Code

**Important**: MCP servers only become available after restarting Claude Code.

```bash
# Exit current Claude Code session
exit

# Start new session in your project
cd /home/user/Projects/veritable-games-main
claude
```

---

## Step 5: Test MCP Server

Once Claude Code restarts, the AI will have access to GitHub MCP tools.

**You can ask Claude to**:
```
Can you check the status of our latest CI/CD run?
```

```
Show me the failed job logs from the most recent workflow
```

```
What's the status of open pull requests?
```

Claude will now directly query GitHub instead of asking you to run commands!

---

## Troubleshooting

### MCP Server Shows "Failed to Connect"

**Check token validity**:
```bash
# Test token with curl
TOKEN=$(grep GITHUB_PAT .env | cut -d '=' -f2)
curl -H "Authorization: Bearer $TOKEN" https://api.github.com/user

# Should return your GitHub user info
```

**If returns error**: Token is invalid or expired - generate new one

### MCP Server Not Listed

```bash
# Verify binary is in PATH
which github-mcp-server

# Should output: /home/user/.local/bin/github-mcp-server
```

**If not found**:
```bash
# Add to PATH in shell config
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "No such tool available" Error

This means Claude Code hasn't loaded the MCP tools yet.

**Solutions**:
1. Restart Claude Code completely
2. Wait 30-60 seconds after restart
3. Verify MCP server shows as "Connected" in `claude mcp list`

### Permission Denied Errors

**Check token scopes**:
- Needs `repo` scope for private repository access
- Needs `workflow` scope for Actions access

Regenerate token with correct scopes if missing.

### Docker-Based MCP Server Issues

If you previously tried the Docker-based approach and it failed:

```bash
# Remove old Docker configuration
claude mcp remove github

# Use binary-based approach instead (Step 3 above)
```

The binary-based approach is more reliable than Docker for local development.

---

## Configuration Scopes

Claude Code supports three MCP configuration scopes:

### Local (Default)
```bash
# Configured when you run: claude mcp add-json github ...
# Scope: Current project only
# Config file: /home/user/.claude.json (project-specific)
```

**Use when**: Token is project-specific

### User
```bash
# Available across all projects
claude mcp add-json github ... -s user

# Config file: ~/.claude/config.json
```

**Use when**: Same token for all your projects

### Project (Shared)
```bash
# Shared via .mcp.json file in project repo
claude mcp add-json github ... -s project

# Config file: .mcp.json (checked into git, without secrets!)
```

**Use when**: Team shares MCP configuration

**⚠️ For this project**: Use **local** scope (default) to keep token private

---

## Updating the Token

When your token expires (90 days):

1. **Generate new token** (Step 1)
2. **Update `.env` file**:
   ```bash
   # Edit .env and replace old token
   nano .env
   ```
3. **Reconfigure MCP server**:
   ```bash
   claude mcp remove github
   claude mcp add-json github '{...}' # with new token
   ```
4. **Restart Claude Code**

---

## Security Best Practices

### ✅ DO

- Store token in `.env` file
- Add `.env` to `.gitignore`
- Set token expiration (90 days recommended)
- Use minimum required scopes
- Delete token when no longer needed

### ❌ DON'T

- Commit token to git
- Share token in chat/email
- Use `admin` scopes unless required
- Set "No expiration"
- Reuse same token across projects/teams

---

## Alternative: HTTP Transport (If Binary Fails)

If the binary-based approach doesn't work, try HTTP transport:

```bash
# Remove binary MCP server
claude mcp remove github

# Add HTTP-based server
claude mcp add --transport http github https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer $(grep GITHUB_PAT .env | cut -d '=' -f2)"

# Restart Claude Code
```

**Note**: HTTP transport may have limitations compared to stdio (binary) approach.

---

## What Claude Can Do With GitHub MCP

Once set up, Claude Code can:

### CI/CD Operations
- Check workflow run status
- View build logs
- Identify failing jobs
- Monitor deployment status

### Pull Request Management
- Create pull requests
- Add reviewers
- Comment on PRs
- Check PR status

### Repository Operations
- List commits
- View file changes
- Check branch status
- Access repository settings

### Issue Management
- Create issues
- Comment on issues
- Update labels
- Close/reopen issues

**All without asking you to run commands!**

---

## Resources

- **GitHub MCP Server Repo**: https://github.com/github/github-mcp-server
- **MCP Protocol Docs**: https://modelcontextprotocol.io
- **Claude Code MCP Guide**: https://docs.claude.com/en/docs/claude-code/mcp
- **GitHub PAT Guide**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

---

## Summary

```bash
# Quick setup (from project root)

# 1. Create token on GitHub with repo + workflow scopes
# 2. Store token
echo "GITHUB_PAT=github_pat_YOUR_TOKEN" >> .env

# 3. Download & install binary
curl -L https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server_Linux_x86_64.tar.gz | tar -xz
mv github-mcp-server ~/.local/bin/
chmod +x ~/.local/bin/github-mcp-server

# 4. Configure Claude Code
claude mcp add-json github '{
  "command": "github-mcp-server",
  "args": ["stdio"],
  "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "'$(grep GITHUB_PAT .env | cut -d= -f2)'"}
}'

# 5. Restart Claude Code
exit
claude

# Done! Claude can now access GitHub APIs
```

---

**Need Help?** Check Claude Code docs or GitHub MCP server issues on GitHub.
