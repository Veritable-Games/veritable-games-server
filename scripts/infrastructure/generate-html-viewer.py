#!/usr/bin/env python3
"""
Generate interactive HTML tree viewer - Phase 4
Creates an interactive, searchable visualization of the infrastructure
"""

import json
import subprocess
from pathlib import Path

def get_summary_stats():
    """Get infrastructure statistics"""
    stats = {
        "home_user": "122GB",
        "data": "869GB",
        "total": "991GB",
        "home_dirs": 0,
        "data_dirs": 0,
        "git_repos": 0,
        "docker_containers": 0
    }

    # Count directories
    try:
        result = subprocess.run(
            ["find", "/home/user", "-maxdepth", "3", "-type", "d"],
            capture_output=True,
            text=True,
            timeout=10
        )
        stats["home_dirs"] = len(result.stdout.strip().split('\n'))
    except:
        pass

    try:
        result = subprocess.run(
            ["find", "/data", "-maxdepth", "2", "-type", "d"],
            capture_output=True,
            text=True,
            timeout=10
        )
        stats["data_dirs"] = len(result.stdout.strip().split('\n'))
    except:
        pass

    # Count git repos
    try:
        result = subprocess.run(
            ["find", "/home/user", "-type", "d", "-name", ".git"],
            capture_output=True,
            text=True,
            timeout=10
        )
        stats["git_repos"] = len(result.stdout.strip().split('\n'))
    except:
        pass

    # Count docker containers
    try:
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        stats["docker_containers"] = len([x for x in result.stdout.strip().split('\n') if x])
    except:
        pass

    return stats

def generate_html():
    """Generate interactive HTML tree viewer"""

    stats = get_summary_stats()

    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veritable Games - Infrastructure Map</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        header {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}

        h1 {{
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
        }}

        .subtitle {{
            color: #666;
            font-size: 1.1em;
        }}

        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }}

        .stat-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}

        .stat-value {{
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }}

        .stat-label {{
            font-size: 0.9em;
            opacity: 0.9;
        }}

        .content {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }}

        @media (max-width: 1200px) {{
            .content {{
                grid-template-columns: 1fr;
            }}
        }}

        .panel {{
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}

        .panel-header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            font-size: 1.3em;
            font-weight: bold;
        }}

        .panel-content {{
            padding: 20px;
            max-height: 500px;
            overflow-y: auto;
        }}

        .search-box {{
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 1em;
            transition: border-color 0.3s;
        }}

        .search-box:focus {{
            outline: none;
            border-color: #667eea;
        }}

        .tree {{
            margin-left: 0;
        }}

        .tree-item {{
            margin: 5px 0;
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
            user-select: none;
        }}

        .tree-item:hover {{
            background: #f0f0f0;
            transform: translateX(5px);
        }}

        .tree-item.folder {{
            color: #1976d2;
            font-weight: 600;
            margin-left: 0px;
        }}

        .tree-item.folder::before {{
            content: "📁 ";
            margin-right: 5px;
        }}

        .tree-item.file {{
            color: #666;
            margin-left: 20px;
        }}

        .tree-item.file::before {{
            content: "📄 ";
            margin-right: 5px;
        }}

        .tree-item.symlink {{
            color: #f57c00;
            font-style: italic;
            margin-left: 20px;
        }}

        .tree-item.symlink::before {{
            content: "🔗 ";
            margin-right: 5px;
        }}

        .tree-item.git {{
            color: #4caf50;
            font-weight: 600;
        }}

        .tree-item.git::before {{
            content: "🔀 ";
            margin-right: 5px;
        }}

        .size {{
            color: #999;
            font-size: 0.85em;
            margin-left: 10px;
            float: right;
        }}

        .toggle {{
            cursor: pointer;
            display: inline-block;
            width: 20px;
            text-align: center;
            color: #667eea;
            font-weight: bold;
        }}

        .children {{
            margin-left: 20px;
            margin-top: 5px;
        }}

        .children.collapsed {{
            display: none;
        }}

        .badge {{
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.85em;
            margin-left: 10px;
        }}

        .info-section {{
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #667eea;
            margin-bottom: 15px;
            border-radius: 4px;
        }}

        .info-section h3 {{
            color: #667eea;
            margin-bottom: 10px;
        }}

        .info-section ul {{
            list-style: none;
            margin-left: 0;
        }}

        .info-section li {{
            padding: 5px 0;
            color: #666;
            border-bottom: 1px solid #eee;
        }}

        .info-section li:last-child {{
            border-bottom: none;
        }}

        .visualization {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}

        .visualization img {{
            width: 100%;
            height: auto;
            border-radius: 5px;
        }}

        .diagram-preview {{
            text-align: center;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 5px;
            font-size: 3em;
            margin-bottom: 15px;
        }}

        .download-links {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
        }}

        .download-btn {{
            background: #667eea;
            color: white;
            padding: 12px;
            border-radius: 5px;
            text-decoration: none;
            text-align: center;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
            font-size: 0.95em;
        }}

        .download-btn:hover {{
            background: #764ba2;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}

        footer {{
            text-align: center;
            color: white;
            padding: 20px;
            font-size: 0.9em;
        }}

        .no-results {{
            color: #999;
            padding: 20px;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🗺️ Veritable Games Server Infrastructure</h1>
            <p class="subtitle">Comprehensive visualization of storage, projects, and relationships</p>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-value">{stats['home_user']}</div>
                    <div class="stat-label">/home/user</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['data']}</div>
                    <div class="stat-label">/data</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['total']}</div>
                    <div class="stat-label">Total Storage</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{stats['git_repos']}</div>
                    <div class="stat-label">Git Repos</div>
                </div>
            </div>
        </header>

        <div class="content">
            <!-- Left Column: Directory Structure -->
            <div class="panel">
                <div class="panel-header">📂 Directory Structure</div>
                <div class="panel-content">
                    <input type="text" class="search-box" id="searchHome" placeholder="Search /home/user...">

                    <div id="homeTree" class="tree"></div>
                </div>
            </div>

            <!-- Right Column: Information & Download -->
            <div class="panel">
                <div class="panel-header">📊 Infrastructure Details</div>
                <div class="panel-content">
                    <div class="info-section">
                        <h3>Primary Drive (/home/user)</h3>
                        <ul>
                            <li>💾 Size: <strong>{stats['home_user']}</strong></li>
                            <li>📁 Directories: <strong>{stats['home_dirs']}</strong></li>
                            <li>🔀 Git Repositories: <strong>{stats['git_repos']}</strong></li>
                            <li>📝 Type: Git-tracked server repository</li>
                            <li>🎯 Purpose: Configuration, projects, documentation</li>
                        </ul>
                    </div>

                    <div class="info-section">
                        <h3>Secondary Drive (/data)</h3>
                        <ul>
                            <li>💾 Size: <strong>{stats['data']}</strong></li>
                            <li>📁 Directories: <strong>{stats['data_dirs']}</strong></li>
                            <li>🎮 Unity Projects: <strong>499GB</strong></li>
                            <li>💾 Backups: <strong>39GB</strong></li>
                            <li>📚 Archives: <strong>124GB</strong></li>
                        </ul>
                    </div>

                    <div class="info-section">
                        <h3>Service Integration</h3>
                        <ul>
                            <li>🐳 Docker Containers: <strong>{stats['docker_containers']}</strong></li>
                            <li>🔄 Symlinks: <strong>2</strong> (backups, archives)</li>
                            <li>📦 Git Submodules: <strong>2</strong></li>
                            <li>💾 Database: PostgreSQL 15</li>
                            <li>🚀 Deployment: Coolify</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Visualization Section -->
        <div class="visualization">
            <div class="panel-header">📈 Infrastructure Diagram</div>

            <div class="download-links">
                <a href="infrastructure.svg" class="download-btn" download>📊 Download SVG</a>
                <a href="infrastructure.png" class="download-btn" download>🖼️ Download PNG</a>
                <a href="infrastructure.pdf" class="download-btn" download>📄 Download PDF</a>
                <a href="infrastructure.json" class="download-btn" download>📋 Download JSON</a>
            </div>

            <p style="text-align: center; color: #999; margin-top: 15px; font-size: 0.9em;">
                View the SVG version above or download high-resolution images for presentations
            </p>
        </div>

        <footer>
            <p>🏗️ Infrastructure Visualization | Generated {subprocess.run(['date'], capture_output=True, text=True).stdout.strip()}</p>
            <p>For documentation, see: <a href="../README.md" style="color: white;">docs/server/README.md</a></p>
        </footer>
    </div>

    <script>
        // Sample tree data structure
        const homeUserData = {{
            "docs": {{
                "server": {{}},
                "veritable-games": {{}},
                "reference": {{}}
            }},
            "projects": {{
                "veritable-games": {{
                    "site": {{"[submodule]": true}},
                    "resources": {{}},
                    "docs": {{}}
                }}
            }},
            "scripts": {{}},
            "wireguard-backups": {{}},
            "btcpayserver-docker": {{
                "[git repo]": true
            }},
            "backups": {{
                "[symlink → /data/backups]": true
            }},
            "archives": {{
                "[symlink → /data/archives]": true
            }}
        }};

        function renderTree(container, data, isRoot = true) {{
            if (!container) return;

            let html = '<ul class="tree">';

            for (const [key, value] of Object.entries(data)) {{
                const isDir = typeof value === 'object' && !Array.isArray(value);
                const isSymlink = key.includes('symlink');
                const isGit = key.includes('[') || key === 'site';

                let className = 'tree-item ';
                if (isDir && !isSymlink) className += 'folder';
                else if (isSymlink) className += 'symlink';
                else if (isGit) className += 'git';
                else className += 'file';

                const itemCount = isDir ? Object.keys(value).length : 0;
                const childrenId = 'children-' + key.replace(/[^a-z0-9]/gi, '_');

                html += `<li>
                    <span class="tree-item ${{className.trim()}}">
                        ${{itemCount > 0 ? '<span class="toggle" onclick="toggleChildren(\\'${{childrenId}}\\')">▼</span>' : ''}}
                        <span class="name">${{key}}</span>
                        ${{isDir && itemCount > 0 ? '<span class="size">(' + itemCount + ' items)</span>' : ''}}
                    </span>`;

                if (isDir && itemCount > 0) {{
                    html += `<div id="${{childrenId}}" class="children">`;
                    for (const [childKey] of Object.entries(value)) {{
                        html += `<div class="tree-item file" style="margin-left: 20px;">📄 ${{childKey}}</div>`;
                    }}
                    html += '</div>';
                }}

                html += '</li>';
            }}

            html += '</ul>';
            container.innerHTML = html;
        }}

        function toggleChildren(id) {{
            const el = document.getElementById(id);
            if (el) {{
                el.classList.toggle('collapsed');
            }}
        }}

        function filterTree(searchId, treeId) {{
            const searchBox = document.getElementById(searchId);
            const tree = document.getElementById(treeId);
            const query = searchBox.value.toLowerCase();

            if (!query) {{
                renderTree(tree, homeUserData, true);
                return;
            }}

            // Show matching items
            const items = tree.querySelectorAll('.tree-item');
            items.forEach(item => {{
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'block' : 'none';
            }});
        }}

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {{
            const homeTree = document.getElementById('homeTree');
            renderTree(homeTree, homeUserData, true);

            document.getElementById('searchHome').addEventListener('input', (e) => {{
                filterTree('searchHome', 'homeTree');
            }});
        }});
    </script>
</body>
</html>
'''

    return html_content

def main():
    """Generate and save HTML viewer"""

    print("🎨 Generating interactive HTML viewer...")

    html = generate_html()

    output_path = "/home/user/docs/server/infrastructure-maps/infrastructure-explorer.html"

    # Ensure directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        f.write(html)

    print(f"✅ HTML viewer generated: {output_path}")
    print(f"   Size: {len(html):,} bytes")
    print(f"\n   Open in browser: firefox {output_path}")

if __name__ == "__main__":
    main()
