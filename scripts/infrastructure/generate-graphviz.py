#!/usr/bin/env python3
"""
Generate comprehensive GraphViz DOT file - Phase 2
Creates infrastructure visualization with hierarchical clustering
"""

import json
import subprocess
from pathlib import Path

def get_directory_size(path: str) -> str:
    """Get human-readable directory size"""
    try:
        result = subprocess.run(
            ["du", "-sh", path],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout.split()[0].strip()
    except:
        return "?"

def get_directory_stats(path: str) -> dict:
    """Get directory statistics"""
    try:
        result = subprocess.run(
            ["find", path, "-type", "f", "-exec", "wc", "-l", "{}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return {
            "size": get_directory_size(path),
            "files": len(result.stdout.strip().split('\n'))
        }
    except:
        return {"size": "?", "files": "?"}

def generate_dot():
    """Generate comprehensive GraphViz DOT file"""

    # Get real sizes
    home_size = get_directory_size("/home/user")
    data_size = get_directory_size("/data")

    dot_content = f'''digraph VeritableGamesInfrastructure {{
    rankdir=TB;
    compound=true;
    newrank=true;
    splines=ortho;

    // Global styles
    node [shape=folder, style=filled, fontname="Courier New", fontsize=9];
    edge [fontname="Courier New", fontsize=8];

    // Color scheme
    // Blue: Git repositories
    // Green: Project data
    // Yellow: Backups
    // Orange: Infrastructure
    // Purple: Services
    // Red: Symlinks

    // ==================================================
    // PRIMARY DRIVE: /home/user (Git Repository)
    // ==================================================
    subgraph cluster_home_drive {{
        label="Drive 1: /home/user\\n({home_size} - Git Repository)";
        style=filled;
        fillcolor="#e3f2fd";
        color=blue;
        penwidth=3;

        // Root node
        home_root [
            label="/home/user\\n{home_size}",
            shape=box3d,
            fillcolor="#1976d2",
            fontcolor=white,
            fontsize=12,
            penwidth=2
        ];

        // Documentation cluster
        subgraph cluster_home_docs {{
            label="docs/\\nDocumentation Hub";
            style=filled;
            fillcolor="#fff9c4";
            color=goldenrod;

            docs_server [label="server/\\n(Ops guides)", fillcolor="#fbc02d"];
            docs_vg [label="veritable-games/\\n(VG docs)", fillcolor="#fbc02d"];
            docs_deployment [label="deployment/\\n(Guides)", fillcolor="#fbc02d"];
            docs_operations [label="operations/\\n(SSH, WireGuard)", fillcolor="#fbc02d"];
            docs_reference [label="reference/\\n(Architecture)", fillcolor="#fbc02d"];
        }}

        // Projects cluster
        subgraph cluster_home_projects {{
            label="projects/\\nGit Repositories";
            style=filled;
            fillcolor="#c8e6c9";
            color=green;

            vg_main [
                label="veritable-games/\\nMain Project",
                fillcolor="#2e7d32",
                fontcolor=white
            ];

            subgraph cluster_vg_site {{
                label="site/\\n(Git Submodule)";
                fillcolor="#a5d6a7";
                color=green;

                vg_site [
                    label="site/\\nNext.js App\\n(Git Submodule)",
                    fillcolor="#388e3c",
                    fontcolor=white,
                    penwidth=2,
                    shape=box3d
                ];
            }}

            vg_resources [
                label="resources/\\n(3.1GB)\\nScripts & Data",
                fillcolor="#66bb6a"
            ];

            vg_docs_project [label="docs/\\n(Project)", fillcolor="#81c784"];
        }}

        // Infrastructure
        subgraph cluster_home_infra {{
            label="Infrastructure";
            style=filled;
            fillcolor="#f3e5f5";
            color=purple;

            home_btcpay [
                label="btcpayserver-docker/\\n(Bitcoin)\\n~130 scripts",
                fillcolor="#9c27b0",
                fontcolor=white
            ];
            home_wg [label="wireguard-backups/\\n(VPN configs)", fillcolor="#ce93d8"];
            home_scripts [label="scripts/\\n(Utilities)", fillcolor="#ce93d8"];
            home_logs [label="logs/\\n(auto-deploy.log)", fillcolor="#ce93d8"];
        }}

        // Symlinks (shown as separate nodes pointing to /data)
        subgraph cluster_home_symlinks {{
            label="Symlinks (→ /data)";
            style=filled;
            fillcolor="#ffccbc";
            color="#d84315";

            home_backups [
                label="backups/\\n(symlink)",
                fillcolor="#ff6e40",
                fontcolor=white,
                shape=ellipse
            ];
            home_archives [
                label="archives/\\n(symlink)",
                fillcolor="#ff6e40",
                fontcolor=white,
                shape=ellipse
            ];
        }}

        // Connections within /home/user
        home_root -> docs_server;
        home_root -> vg_main;
        home_root -> home_btcpay;
        home_root -> home_scripts;
        home_root -> home_wg;
        home_root -> home_backups [style=dashed, color=red];
        home_root -> home_archives [style=dashed, color=red];

        vg_main -> vg_site [label="submodule", color=blue, penwidth=2];
        vg_main -> vg_resources;
        vg_main -> vg_docs_project;

        docs_server -> docs_server;
    }}

    // ==================================================
    // SECONDARY DRIVE: /data (Large Storage)
    // ==================================================
    subgraph cluster_data_drive {{
        label="Drive 2: /data\\n({data_size} - Secondary Storage)";
        style=filled;
        fillcolor="#f3e5f5";
        color=purple;
        penwidth=3;

        // Root node
        data_root [
            label="/data\\n{data_size}",
            shape=box3d,
            fillcolor="#7b1fa2",
            fontcolor=white,
            fontsize=12,
            penwidth=2
        ];

        // Unity projects
        subgraph cluster_unity {{
            label="unity-projects/\\n(499GB)";
            fillcolor="#ffccbc";
            color=darkorange;

            unity_main [
                label="Unity Game Projects\\n(499GB)\\n~120 projects",
                fillcolor="#ff6f00",
                fontcolor=white,
                penwidth=2
            ];
        }}

        // Archives
        subgraph cluster_archives {{
            label="archives/\\n(124GB)";
            fillcolor="#e1f5fe";
            color=cyan;

            arch_vg [label="veritable-games/\\n(3.8GB)", fillcolor="#01579b", fontcolor=white];
            arch_db [label="database-snapshots/\\n(4.2GB)", fillcolor="#0277bd", fontcolor=white];
            arch_server [label="server-backups/\\n(2.1GB)", fillcolor="#0288d1"];
            arch_others [label="others/\\n(114GB)", fillcolor="#0288d1"];
        }}

        // Company site
        data_company [
            label="company-site/\\n(66GB)",
            fillcolor="#c8e6c9",
            penwidth=2
        ];

        // References
        data_refs [
            label="references/\\n(58GB)\\nTools & Docs",
            fillcolor="#dcedc8"
        ];

        // Project backups
        subgraph cluster_proj_backups {{
            label="projects/\\n(50GB - Backups)";
            fillcolor="#f8bbd0";
            color=pink;

            proj_enact [label="ENACT/\\n(Backup)", fillcolor="#ec407a"];
            proj_noxii [label="NOXII/\\n(Backup)", fillcolor="#ec407a"];
            proj_legacy [label="NOXII-LEGACY/\\n(Backup)", fillcolor="#ec407a"];
        }}

        // Backups (comprehensive)
        subgraph cluster_backups {{
            label="backups/\\n(39GB)\\nComprehensive Backups";
            fillcolor="#fffde7";
            color=goldenrod;
            penwidth=2;

            back_daily [label="daily/", fillcolor="#fdd835"];
            back_hourly [label="hourly/", fillcolor="#fdd835"];
            back_weekly [label="weekly/", fillcolor="#fdd835"];
            back_monthly [label="monthly/", fillcolor="#fdd835"];
            back_yearly [label="yearly/", fillcolor="#fdd835"];
            back_btcpay [label="btcpay/", fillcolor="#fdd835"];
            back_coolify [label="coolify/", fillcolor="#fdd835"];
            back_videos [label="videos/", fillcolor="#fdd835"];
            back_wireguard [label="wireguard/", fillcolor="#fdd835"];
        }}

        // Repository (development tools)
        subgraph cluster_repository {{
            label="repository/\\n(30GB)\\nDevelopment Tools";
            fillcolor="#e0f2f1";
            color=teal;

            repo_aiml [label="AI-ML/\\n(Tools)", fillcolor="#00897b"];
            repo_3d [label="3D-Graphics/", fillcolor="#00897b"];
            repo_algo [label="Algorithms/", fillcolor="#00897b"];
            repo_auto [label="Automation/", fillcolor="#00897b"];
        }}

        // Coolify services
        subgraph cluster_coolify {{
            label="coolify/\\n(472KB)";
            fillcolor="#f1f8e9";
            color=lightgreen;

            cool_apps [label="applications/", fillcolor="#558b2f"];
            cool_db [label="databases/", fillcolor="#558b2f"];
            cool_proxy [label="proxy/", fillcolor="#558b2f"];
        }}

        // Docker volumes
        data_docker [
            label="docker-hdd-volumes/\\n(Bitcoin blockchain)",
            fillcolor="#ffecb3",
            penwidth=2
        ];

        // Connections within /data
        data_root -> unity_main;
        data_root -> arch_vg;
        data_root -> data_company;
        data_root -> data_refs;
        data_root -> proj_enact;
        data_root -> back_daily;
        data_root -> repo_aiml;
        data_root -> cool_apps;
        data_root -> data_docker;

        arch_vg -> arch_db;
        arch_vg -> arch_server;
    }}

    // ==================================================
    // CROSS-DRIVE RELATIONSHIPS
    // ==================================================

    // Symlinks (dashed lines)
    home_backups -> back_daily [
        label="symlink target",
        style=dashed,
        color=red,
        penwidth=2,
        constraint=false
    ];

    home_archives -> arch_vg [
        label="symlink target",
        style=dashed,
        color=red,
        penwidth=2,
        constraint=false
    ];

    // Backup flows (dotted)
    home_root -> back_daily [
        label="backed up",
        style=dotted,
        color=orange,
        penwidth=2,
        constraint=false
    ];

    vg_main -> back_daily [
        label="DB backups",
        style=dotted,
        color=orange,
        constraint=false
    ];

    // Data flows (solid)
    vg_resources -> arch_vg [
        label="references data",
        color=green,
        constraint=false
    ];

    // Legend
    subgraph cluster_legend {{
        label="Legend";
        style=filled;
        fillcolor="#f5f5f5";
        color=gray;

        legend_repo [label="Git Repository", fillcolor="#1976d2", fontcolor=white, shape=box3d];
        legend_data [label="Data Directory", fillcolor="#66bb6a"];
        legend_backup [label="Backup Target", fillcolor="#fdd835"];
        legend_symlink [label="Symlink (dashed)", fillcolor="#ff6e40", style=dashed, color=red];
        legend_submodule [label="Git Submodule", color=blue];
        legend_edge [label="Edge Type:", shape=plaintext];

        legend_repo -> legend_data [style=invis];
    }}
}}
'''

    return dot_content

def main():
    """Generate and save GraphViz DOT file"""

    print("🎨 Generating GraphViz DOT file...")

    dot_content = generate_dot()

    output_path = "/tmp/infrastructure-map/veritable-games-infrastructure.dot"
    with open(output_path, 'w') as f:
        f.write(dot_content)

    print(f"✅ GraphViz DOT file generated: {output_path}")
    print(f"   Size: {len(dot_content)} bytes")

    # Verify DOT syntax
    try:
        result = subprocess.run(
            ["dot", "-Tsvg", output_path, "-o", "/dev/null"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print("✅ DOT syntax valid (verified with graphviz)")
        else:
            print(f"⚠️  DOT syntax warning: {result.stderr}")
    except FileNotFoundError:
        print("⚠️  graphviz not installed, skipping syntax verification")

    print("\n📝 To render this file:")
    print(f"  dot -Tsvg {output_path} -o infrastructure.svg")
    print(f"  dot -Tpng -Gdpi=300 {output_path} -o infrastructure.png")
    print(f"  dot -Tpdf {output_path} -o infrastructure.pdf")

if __name__ == "__main__":
    main()
