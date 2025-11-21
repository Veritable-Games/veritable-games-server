# Shared Resources Directory

This directory contains resources that are shared across multiple projects or used for server-wide purposes.

## Contents

### archives/
Archived files and historical configurations:
- `authorized_keys_fixed` - SSH key backup
- `migration-files.tar.gz` - Historical migration archives

**Purpose:** Long-term storage of files that may be needed for reference but aren't actively used.

### packages/
System-level package installers:
- `claude-code.deb` - Claude Code CLI installation package
- `cloudflared-linux-amd64.deb` - Cloudflare tunnel client

**Purpose:** Software packages that can be installed system-wide and aren't specific to any single project.

## Usage Guidelines

### When to Add Files Here

Add files to `shared/` when they:
- Are used by multiple projects
- Are system-level tools or packages
- Provide infrastructure support (SSH keys, certificates, etc.)
- Don't belong to any specific project

### When NOT to Add Files Here

Don't add files here if they:
- Are specific to a single project → Use `projects/project-name/`
- Are documentation → Use `/home/user/docs/`
- Are configuration specific to one service → Keep with that service

## Maintenance

- Review annually for files that can be removed
- Archive files should be dated or versioned for clarity
- Packages should be updated when new versions are needed
- Document any new categories added to this directory

## See Also

- `/home/user/projects/` - Project-specific resources
- `/home/user/docs/` - Documentation
- `/home/user/CLAUDE.md` - Server guidance
