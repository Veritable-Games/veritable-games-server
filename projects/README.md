# Projects Directory

This directory contains all project-specific resources and repositories.

## Structure

```
projects/
└── veritable-games/    # Veritable Games project resources
```

## Organization Philosophy

The project subdirectory contains all project-specific resources:
- Data and content
- Scripts and utilities
- Database configurations
- Logs and temporary files
- Documentation (also mirrored in /home/user/docs/)

## Active Project

### veritable-games/
**Description:** Radical literature archival platform with wiki, forums, and library features

**Repository:** `/home/user/projects/veritable-games/site/`

**Resources:** `/home/user/projects/veritable-games/resources/`
- `data/` - Anarchist & Marxist literature archives (3.1GB)
- `scripts/` - Python import and extraction scripts
- `sql/` - Database schema migrations
- `logs/` - Script execution logs
- `docker-compose.yml` - Local PostgreSQL development environment

**Production:** Deployed via Coolify to https://www.veritablegames.com

## Adding New Projects

When adding a new project:

1. Create project directory: `mkdir -p /home/user/projects/new-project/`
2. Clone or copy project files into the directory
3. Add project documentation to `/home/user/docs/new-project/`
4. Update `/home/user/CLAUDE.md` with project details
5. Update this README with project information

## See Also

- `/home/user/CLAUDE.md` - Primary guidance for Claude Code models
- `/home/user/docs/README.md` - Documentation index
- `/home/user/shared/` - Cross-project shared resources
