#!/usr/bin/env python3
"""
Deep Infrastructure Visualization - Extended Version
Shows detailed directory structures and game projects
"""

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

def generate_deep_dot():
    """Generate deep GraphViz DOT file with project details"""

    # Get real sizes
    home_size = get_directory_size("/home/user")
    data_size = get_directory_size("/data")
    dodec_size = get_directory_size("/data/unity-projects/DODEC")
    dodec_2025 = get_directory_size("/data/unity-projects/DODEC/2025")
    dodec_2024 = get_directory_size("/data/unity-projects/DODEC/2024")

    dot_content = f'''digraph VeritableGamesDeepInfrastructure {{
    rankdir=TB;
    compound=true;
    newrank=true;
    splines=ortho;

    node [shape=folder, style=filled, fontname="Courier New", fontsize=9];
    edge [fontname="Courier New", fontsize=8];

    // ==================================================
    // PRIMARY DRIVE: /home/user (Git Repository)
    // ==================================================
    subgraph cluster_home_drive {{
        label="/home/user ({home_size} - Git Repository)";
        style=filled;
        fillcolor="#e3f2fd";
        color=blue;
        penwidth=3;

        home_root [
            label="/home/user",
            shape=box3d,
            fillcolor="#1976d2",
            fontcolor=white,
            fontsize=12,
            penwidth=2
        ];

        // Docs
        subgraph cluster_docs {{
            label="docs/ (Documentation Hub)";
            fillcolor="#fff9c4";
            color=goldenrod;

            docs_server [label="server/"];
            docs_vg [label="veritable-games/"];
            docs_deployment [label="deployment/"];
            docs_guides [label="guides/"];
            docs_features [label="features/"];
            docs_infrastructure [label="infrastructure/ (NEW)"];
        }}

        // Main projects
        subgraph cluster_projects {{
            label="projects/";
            fillcolor="#c8e6c9";
            color=green;

            subgraph cluster_vg {{
                label="veritable-games/";
                fillcolor="#a5d6a7";

                vg_site [
                    label="site/\\n(Next.js App)\\nGit Submodule",
                    fillcolor="#388e3c",
                    fontcolor=white,
                    penwidth=2,
                    shape=box3d
                ];

                subgraph cluster_site {{
                    label="site/frontend/";
                    fillcolor="#81c784";
                    site_src [label="src/"];
                    site_app [label="app/"];
                    site_api [label="api/ (40+)"];
                    site_lib [label="lib/"];
                    site_components [label="components/"];
                }}

                vg_resources [label="resources/ (3.1GB)"];
                vg_docs [label="docs/"];
                vg_site_docs [label="docs/features/"];
            }}
        }}

        // Infrastructure
        subgraph cluster_infra {{
            label="Infrastructure";
            fillcolor="#f3e5f5";
            color=purple;

            home_btcpay [
                label="btcpayserver-docker/\\n(Bitcoin)",
                fillcolor="#9c27b0",
                fontcolor=white
            ];
            home_wg [label="wireguard-backups/"];
            home_scripts [label="scripts/"];
        }}

        // Symlinks
        subgraph cluster_symlinks {{
            label="Symlinks → /data";
            fillcolor="#ffccbc";

            home_backups [
                label="backups →\\n/data/backups",
                fillcolor="#ff6e40",
                fontcolor=white,
                shape=ellipse
            ];
            home_archives [
                label="archives →\\n/data/archives",
                fillcolor="#ff6e40",
                fontcolor=white,
                shape=ellipse
            ];
        }}

        home_root -> docs_server;
        home_root -> vg_site;
        home_root -> home_btcpay;
        home_root -> home_scripts;
        home_root -> home_backups [style=dashed, color=red];
        home_root -> home_archives [style=dashed, color=red];

        vg_site -> site_src;
        vg_site -> site_app;
        vg_site -> vg_resources;
    }}

    // ==================================================
    // SECONDARY DRIVE: /data (Large Storage)
    // ==================================================
    subgraph cluster_data_drive {{
        label="/data ({data_size} - Secondary Storage)";
        style=filled;
        fillcolor="#f3e5f5";
        color=purple;
        penwidth=3;

        data_root [
            label="/data",
            shape=box3d,
            fillcolor="#7b1fa2",
            fontcolor=white,
            fontsize=12,
            penwidth=2
        ];

        // ===== GAME PROJECTS (DEEP) =====
        subgraph cluster_unity_deep {{
            label="unity-projects/ ({dodec_size})\\nDODEC Engine - Versioned Releases";
            fillcolor="#ffccbc";
            color=darkorange;
            penwidth=3;

            subgraph cluster_dodec_main {{
                label="DODEC/ (Main Game Engine)";
                fillcolor="#ffe0b2";

                subgraph cluster_dodec_2025 {{
                    label="2025/ ({dodec_2025}) - Latest";
                    fillcolor="#ffd699";
                    color=darkorange;

                    dodec_231 [label="v2.31 (Mar 2025)\\n2022.3.60f1\\n5.6GB", fillcolor="#ff9800"];
                    dodec_230 [label="v2.30 (Feb 2025)\\n2022.3.57f1\\n12GB", fillcolor="#ff9800"];
                    dodec_229_226 [label="v2.25-v2.29\\n6 versions\\n40GB total", fillcolor="#ffb74d"];
                }}

                subgraph cluster_dodec_2024 {{
                    label="2024/ ({dodec_2024})";
                    fillcolor="#ffd699";
                    dodec_2024_list [label="2024 Releases\\nVersioned Archives", fillcolor="#ffb74d"];
                }}

                subgraph cluster_dodec_older {{
                    label="2019-2023/ (Historical)";
                    fillcolor="#ffd699";
                    dodec_history [label="Complete Version\\nHistory\\n~400GB total", fillcolor="#ffb74d"];
                }}
            }}
        }}

        // ===== BACKUPS (DEEP) =====
        subgraph cluster_backups_deep {{
            label="backups/ (39GB)\\nMulti-Frequency Snapshots";
            fillcolor="#fffde7";
            color=goldenrod;
            penwidth=2;

            subgraph cluster_backup_freqs {{
                label="Backup Schedules";
                fillcolor="#fffacd";

                back_hourly [label="hourly/\\nDatabase snapshots", fillcolor="#fdd835"];
                back_daily [label="daily/\\nFull backup copies", fillcolor="#fdd835"];
                back_weekly [label="weekly/\\nIncremental", fillcolor="#fdd835"];
                back_monthly [label="monthly/\\nArchive copies", fillcolor="#fdd835"];
                back_yearly [label="yearly/\\nLong-term storage", fillcolor="#fdd835"];
            }}

            subgraph cluster_backup_services {{
                label="Service-Specific";
                fillcolor="#fffacd";

                back_btcpay [label="btcpay/\\nBitcoin configs", fillcolor="#fdd835"];
                back_coolify [label="coolify/\\nDeployment state", fillcolor="#fdd835"];
                back_wireguard [label="wireguard/\\nVPN configs", fillcolor="#fdd835"];
                back_videos [label="videos/\\nSnapshot archives", fillcolor="#fdd835"];
            }}

            subgraph cluster_backup_legacy {{
                label="Structure";
                fillcolor="#fffacd";

                back_volumes [label="volumes/\\nDocker volumes", fillcolor="#fdd835"];
                back_logs [label="logs/\\nBackup logs", fillcolor="#fdd835"];
                back_scripts [label="scripts/\\nAutomation", fillcolor="#fdd835"];
            }}
        }}

        // ===== ARCHIVES (DEEP) =====
        subgraph cluster_archives_deep {{
            label="archives/ (124GB)\\nHistorical Data";
            fillcolor="#e1f5fe";
            color=cyan;
            penwidth=2;

            subgraph cluster_archive_vg {{
                label="veritable-games/ (3.8GB)";
                fillcolor="#b3e5fc";
                arch_vg_content [label="Content snapshots\\nDatabase backups\\nMedia archives", fillcolor="#01579b", fontcolor=white];
            }}

            subgraph cluster_archive_db {{
                label="database-snapshots/ (4.2GB)";
                fillcolor="#b3e5fc";
                arch_db_content [label="PostgreSQL dumps\\nSchema backups\\nMigrations", fillcolor="#0277bd", fontcolor=white];
            }}

            subgraph cluster_archive_server {{
                label="server-backups/ (2.1GB)";
                fillcolor="#b3e5fc";
                arch_server_content [label="Config snapshots\\nSSH keys\\nDeploy logs", fillcolor="#0288d1"];
            }}

            subgraph cluster_archive_other {{
                label="others/ (114GB)";
                fillcolor="#b3e5fc";
                arch_other [label="Historical data\\nOld projects\\nLegacy configs", fillcolor="#0288d1"];
            }}
        }}

        // ===== REFERENCES & TOOLS =====
        subgraph cluster_refs_deep {{
            label="references/ (58GB)\\nDevelopment Tools & Documentation";
            fillcolor="#dcedc8";
            color=lightgreen;

            ref_docs [label="Docs & Guides\\n(20GB)"];
            ref_frameworks [label="Frameworks & SDK\\n(15GB)"];
            ref_tools [label="Tools & Utilities\\n(12GB)"];
            ref_samples [label="Sample Code\\n(11GB)"];
        }}

        subgraph cluster_repo_deep {{
            label="repository/ (30GB)\\nDevelopment Resources";
            fillcolor="#e0f2f1";
            color=teal;

            subgraph cluster_repo_aiml {{
                label="AI-ML/";
                fillcolor="#b2dfdb";
                repo_llm [label="LLM Tools\\nEmbedding models\\nRAG frameworks", fillcolor="#00897b"];
            }}

            subgraph cluster_repo_tools {{
                label="Dev Tools/";
                fillcolor="#b2dfdb";
                repo_3d [label="3D Graphics\\nRendering engines"];
                repo_algo [label="Algorithms\\nData structures"];
                repo_auto [label="Automation\\nScripting tools"];
            }}
        }}

        // ===== PROJECT BACKUPS =====
        subgraph cluster_proj_backups {{
            label="projects/ (50GB)\\nProject Backups";
            fillcolor="#f8bbd0";
            color=pink;

            proj_dodec [label="DODEC\\nGame engine backup", fillcolor="#ec407a"];
            proj_enact [label="ENACT\\nArchive", fillcolor="#ec407a"];
            proj_noxii [label="NOXII\\nArchive", fillcolor="#ec407a"];
            proj_site [label="SITE\\nBackup", fillcolor="#ec407a"];
        }}

        // ===== COMPANY SITE =====
        data_company [
            label="company-site/ (66GB)\\nPublic Web Content",
            fillcolor="#c8e6c9",
            penwidth=2
        ];

        // ===== COOLIFY / DOCKER =====
        subgraph cluster_coolify_deep {{
            label="coolify/ (472KB)";
            fillcolor="#f1f8e9";
            color=lightgreen;

            cool_apps [label="applications/\\nApp configs"];
            cool_db [label="databases/\\nDB configs"];
            cool_proxy [label="proxy/\\nTraefik config"];
        }}

        subgraph cluster_docker_deep {{
            label="docker-hdd-volumes/";
            fillcolor="#ffecb3";
            color=goldenrod;

            docker_bitcoin [label="Bitcoin\\nBlockchain\\nFull node data", fillcolor="#fbc02d"];
            docker_volumes [label="Other volumes\\nDatabase files", fillcolor="#fbc02d"];
        }}

        // Connections within /data
        data_root -> dodec_231;
        data_root -> back_daily;
        data_root -> arch_vg_content;
        data_root -> ref_docs;
        data_root -> repo_llm;
        data_root -> proj_dodec;
        data_root -> data_company;
        data_root -> cool_apps;
        data_root -> docker_bitcoin;

        // Internal connections
        dodec_231 -> dodec_230 [style=invis];
        back_daily -> back_weekly [style=invis];
        arch_vg_content -> arch_db_content [style=invis];
    }}

    // ==================================================
    // CROSS-DRIVE RELATIONSHIPS
    // ==================================================

    home_backups -> back_daily [
        label="symlink",
        style=dashed,
        color=red,
        penwidth=2,
        constraint=false
    ];

    home_archives -> arch_vg_content [
        label="symlink",
        style=dashed,
        color=red,
        penwidth=2,
        constraint=false
    ];

    // Backup flows
    home_root -> back_daily [
        label="backed up daily",
        style=dotted,
        color=orange,
        constraint=false
    ];

    vg_site -> back_daily [
        label="DB backups",
        style=dotted,
        color=orange,
        constraint=false
    ];

    // Data flows
    vg_resources -> arch_vg_content [
        label="references",
        color=green,
        constraint=false
    ];

    // Legend
    subgraph cluster_legend {{
        label="Legend & Details";
        style=filled;
        fillcolor="#f5f5f5";
        color=gray;

        legend_drive [label="Physical Drive", fillcolor="#1976d2", fontcolor=white, shape=box3d];
        legend_project [label="Project/Category", fillcolor="#66bb6a"];
        legend_backup [label="Backup Storage", fillcolor="#fdd835"];
        legend_symlink [label="Symlink (dashed)", fillcolor="#ff6e40"];
        legend_game [label="Game/Engine", fillcolor="#ff9800"];

        legend_drive -> legend_project [style=invis];
    }}
}}
'''

    return dot_content

def main():
    """Generate and save deep GraphViz DOT file"""

    print("🎨 Generating DEEP GraphViz DOT file...")
    print("   Including: Game projects, backup schedules, detailed structure")

    dot_content = generate_deep_dot()

    output_path = "/tmp/infrastructure-map/veritable-games-infrastructure-DEEP.dot"
    with open(output_path, 'w') as f:
        f.write(dot_content)

    print(f"✅ Deep GraphViz DOT file generated: {output_path}")
    print(f"   Size: {len(dot_content):,} bytes")

    # Verify
    try:
        result = subprocess.run(
            ["dot", "-Tsvg", output_path, "-o", "/dev/null"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print("✅ DOT syntax valid")
        else:
            print(f"⚠️  Syntax warning: {result.stderr[:200]}")
    except FileNotFoundError:
        print("⚠️  graphviz not installed, skipping syntax check")

    print("\n📝 To render:")
    print(f"  dot -Tsvg {output_path} -o infrastructure-DEEP.svg")
    print(f"  dot -Tpng -Gdpi=300 {output_path} -o infrastructure-DEEP.png")

if __name__ == "__main__":
    main()
