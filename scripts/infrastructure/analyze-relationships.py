#!/usr/bin/env python3
"""
Analyze relationships between directories - Phase 1B
Maps symlinks, git submodules, backup targets, and logical relationships
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Any

def get_symlinks() -> List[Dict[str, str]]:
    """Extract symlink relationships"""
    symlinks = []

    try:
        result = subprocess.run(
            ["find", "/home/user", "-maxdepth", "3", "-type", "l", "-printf", "%l|%p\\n"],
            capture_output=True,
            text=True,
            timeout=10
        )

        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split('|')
            if len(parts) == 2:
                target, source = parts
                symlinks.append({
                    "source": source,
                    "target": target,
                    "type": "symlink"
                })
    except Exception as e:
        print(f"⚠️  Error collecting symlinks: {e}")

    return symlinks

def get_git_submodules() -> List[Dict[str, str]]:
    """Find git submodules"""
    submodules = []

    # Check main server repo
    if os.path.exists("/home/user/.gitmodules"):
        try:
            result = subprocess.run(
                ["cat", "/home/user/.gitmodules"],
                capture_output=True,
                text=True,
                timeout=5
            )

            content = result.stdout
            # Parse .gitmodules format
            current_path = None
            for line in content.split('\n'):
                if line.strip().startswith('['):
                    current_path = None
                elif 'path' in line:
                    current_path = line.split('=')[1].strip()
                elif 'url' in line and current_path:
                    url = line.split('=')[1].strip()
                    submodules.append({
                        "parent": "/home/user",
                        "submodule": current_path,
                        "url": url,
                        "type": "git_submodule"
                    })
        except Exception as e:
            print(f"⚠️  Error parsing .gitmodules: {e}")

    return submodules

def get_backup_relationships() -> List[Dict[str, str]]:
    """Identify backup source/target relationships"""
    backups = []

    # /home/user backups -> /data/backups
    backups.append({
        "source": "/home/user",
        "target": "/data/backups",
        "type": "backup",
        "frequency": "daily",
        "description": "Server configuration and project backups"
    })

    # PostgreSQL backups
    backups.append({
        "source": "veritable-games-postgres (Docker)",
        "target": "/data/backups/daily",
        "type": "database_backup",
        "frequency": "daily",
        "description": "PostgreSQL database backups"
    })

    # Coolify backups
    backups.append({
        "source": "coolify (Docker)",
        "target": "/data/backups/coolify",
        "type": "service_backup",
        "frequency": "weekly",
        "description": "Coolify configuration and metadata"
    })

    # WireGuard configs
    backups.append({
        "source": "wireguard-backups/",
        "target": "/data/backups/wireguard",
        "type": "config_backup",
        "frequency": "on-change",
        "description": "WireGuard VPN configurations"
    })

    return backups

def get_project_resources() -> List[Dict[str, str]]:
    """Identify project resource connections"""
    projects = []

    projects.append({
        "project": "Veritable Games",
        "path": "/home/user/projects/veritable-games/site",
        "resources": "/home/user/projects/veritable-games/resources",
        "data": "/data/archives/veritable-games",
        "documentation": "/home/user/docs/veritable-games",
        "type": "multi_resource"
    })

    return projects

def get_mount_points() -> List[Dict[str, str]]:
    """Get storage mount information"""
    mounts = []

    try:
        result = subprocess.run(
            ["df", "-h", "/", "/data"],
            capture_output=True,
            text=True,
            timeout=5
        )

        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        for line in lines:
            parts = line.split()
            if len(parts) >= 6:
                mounts.append({
                    "filesystem": parts[0],
                    "size": parts[1],
                    "used": parts[2],
                    "available": parts[3],
                    "percent": parts[4],
                    "mount": parts[5]
                })
    except Exception as e:
        print(f"⚠️  Error collecting mount info: {e}")

    return mounts

def get_docker_volumes() -> List[Dict[str, str]]:
    """Get Docker volume mappings"""
    volumes = []

    try:
        result = subprocess.run(
            ["docker", "volume", "ls", "--format", "{{.Name}}\t{{.Mountpoint}}"],
            capture_output=True,
            text=True,
            timeout=5
        )

        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) == 2:
                volumes.append({
                    "name": parts[0],
                    "mountpoint": parts[1],
                    "type": "docker_volume"
                })
    except Exception as e:
        print(f"⚠️  Error collecting Docker volumes: {e}")

    return volumes

def main():
    """Analyze and save all relationships"""

    print("🔗 Analyzing relationships...")

    relationships = {
        "metadata": {
            "generated": subprocess.run(["date", "+%Y-%m-%d %H:%M:%S"],
                                       capture_output=True, text=True).stdout.strip(),
            "hostname": subprocess.run(["hostname"],
                                      capture_output=True, text=True).stdout.strip()
        },
        "symlinks": get_symlinks(),
        "git_submodules": get_git_submodules(),
        "backup_relationships": get_backup_relationships(),
        "project_resources": get_project_resources(),
        "mount_points": get_mount_points(),
        "docker_volumes": get_docker_volumes()
    }

    # Save as JSON
    output_path = "/tmp/infrastructure-map/relationships.json"
    with open(output_path, 'w') as f:
        json.dump(relationships, f, indent=2)

    print(f"✅ Relationships saved to {output_path}")

    # Print summary
    print("\n📊 Relationship Summary:")
    print(f"  Symlinks: {len(relationships['symlinks'])}")
    print(f"  Git Submodules: {len(relationships['git_submodules'])}")
    print(f"  Backup Relationships: {len(relationships['backup_relationships'])}")
    print(f"  Project Resources: {len(relationships['project_resources'])}")
    print(f"  Mount Points: {len(relationships['mount_points'])}")
    print(f"  Docker Volumes: {len(relationships['docker_volumes'])}")

    # Print symlinks
    if relationships['symlinks']:
        print("\n🔗 Symlinks Found:")
        for sym in relationships['symlinks']:
            print(f"  {sym['source']} → {sym['target']}")

    # Print submodules
    if relationships['git_submodules']:
        print("\n📦 Git Submodules Found:")
        for sub in relationships['git_submodules']:
            print(f"  {sub['parent']}/{sub['submodule']}")

    # Print backups
    if relationships['backup_relationships']:
        print("\n💾 Backup Relationships:")
        for backup in relationships['backup_relationships']:
            print(f"  {backup['source']} → {backup['target']} ({backup['frequency']})")

if __name__ == "__main__":
    main()
