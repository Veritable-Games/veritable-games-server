#!/usr/bin/env python3
"""
Godot Projects Visualization - Complete Game Projects Structure
Shows NOXII and ENACT game engine development across versions
"""

import subprocess

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

def generate_godot_dot():
    """Generate GraphViz DOT file focused on Godot game projects"""

    # Get sizes
    noxii_size = get_directory_size("/data/projects/NOXII")
    noxii_legacy_size = get_directory_size("/data/projects/NOXII-LEGACY")
    enact_size = get_directory_size("/data/projects/ENACT")

    dot_content = f'''digraph VeritableGamesGodotProjects {{
    rankdir=TB;
    compound=true;
    newrank=true;
    splines=ortho;

    node [shape=folder, style=filled, fontname="Courier New", fontsize=9];
    edge [fontname="Courier New", fontsize=8];

    // ==================================================
    // GODOT GAME PROJECTS
    // ==================================================

    root [
        label="Game Development\\nProjects",
        shape=box3d,
        fillcolor="#2e7d32",
        fontcolor=white,
        fontsize=14,
        penwidth=3
    ];

    // ===== NOXII (Current) =====
    subgraph cluster_noxii {{
        label="NOXII ({noxii_size})\\nCurrent Godot Game Project";
        fillcolor="#e8f5e9";
        color="#2e7d32";
        penwidth=3;

        noxii_root [
            label="NOXII/\\nActive Development",
            fillcolor="#4caf50",
            fontcolor=white,
            penwidth=2
        ];

        subgraph cluster_noxii_versions {{
            label="Version Archive";
            fillcolor="#c8e6c9";

            noxii_v04 [
                label="v0.04 (Latest)\\n931MB\\nFull Implementation",
                fillcolor="#388e3c",
                fontcolor=white
            ];
            noxii_v03 [label="v0.03\\n1.3GB\\nCore Systems", fillcolor="#66bb6a"];
            noxii_v02 [label="v0.02\\n1.2GB\\nEngine Iteration", fillcolor="#66bb6a"];
            noxii_v01 [label="v0.01\\n1.2GB\\nInitial Prototype", fillcolor="#81c784"];

            noxii_archives [
                label="Compressed\\n(noxii-0.0X.tar.xz)\\n~1.4GB total",
                fillcolor="#a5d6a7",
                shape=ellipse
            ];
        }}

        subgraph cluster_noxii_structure {{
            label="Project Structure";
            fillcolor="#c8e6c9";

            noxii_scripts [label="scripts/\\nGDScript gameplay"];
            noxii_assets [label="assets/\\n3D models, textures"];
            noxii_scenes [label="scenes/\\nGame scenes"];
            noxii_addons [label="addons/\\nCustom plugins"];
            noxii_docs [label="docs/\\nTechnical docs\\nFix reports"];
        }}

        noxii_root -> noxii_v04;
        noxii_root -> noxii_v03;
        noxii_root -> noxii_v02;
        noxii_root -> noxii_v01;
        noxii_root -> noxii_archives [color=gray, style=dashed];
        noxii_v04 -> noxii_scripts;
        noxii_v04 -> noxii_assets;
        noxii_v04 -> noxii_scenes;
    }}

    // ===== ENACT (Current) =====
    subgraph cluster_enact {{
        label="ENACT ({enact_size})\\nCurrent Godot Game Project";
        fillcolor="#e3f2fd";
        color="#1565c0";
        penwidth=3;

        enact_root [
            label="ENACT/\\nActive Development",
            fillcolor="#1976d2",
            fontcolor=white,
            penwidth=2
        ];

        subgraph cluster_enact_versions {{
            label="Version Archive (9 Versions)";
            fillcolor="#bbdefb";

            enact_v09 [
                label="v0.09 (Latest)\\n1.2GB\\nDialogue + Interaction",
                fillcolor="#0d47a1",
                fontcolor=white
            ];
            enact_v08 [label="v0.08\\n1.2GB\\nPerformance Fixes", fillcolor="#1565c0"];
            enact_v07 [label="v0.07\\n1.2GB\\nNavigation Systems", fillcolor="#1976d2"];
            enact_v06 [label="v0.06\\n1.6GB\\nDialogue System", fillcolor="#1e88e5"];
            enact_v05 [label="v0.05\\n1.7GB\\nOptimization", fillcolor="#42a5f5"];
            enact_older [label="v0.01-v0.04\\n5.2GB total\\n(4 versions)", fillcolor="#90caf9"];

            enact_archives [
                label="Compressed\\n(enact-0.0X.tar.xz)\\n~3.5GB total",
                fillcolor="#bbdefb",
                shape=ellipse
            ];
        }}

        subgraph cluster_enact_structure {{
            label="Project Structure";
            fillcolor="#bbdefb";

            enact_scripts [label="scripts/\\nGDScript gameplay"];
            enact_assets [label="assets/\\n3D models, audio"];
            enact_scenes [label="scenes/\\nGame levels"];
            enact_systems [label="systems/\\nGame mechanics"];
            enact_tests [label="tests/\\nValidation tests"];
            enact_docs [label="docs/\\nArchitecture\\nIntegration plans"];
        }}

        enact_root -> enact_v09;
        enact_root -> enact_v08;
        enact_root -> enact_v07;
        enact_root -> enact_v06;
        enact_root -> enact_v05;
        enact_root -> enact_older;
        enact_root -> enact_archives [color=gray, style=dashed];
        enact_v09 -> enact_scripts;
        enact_v09 -> enact_assets;
        enact_v09 -> enact_systems;
    }}

    // ===== NOXII LEGACY =====
    subgraph cluster_noxii_legacy {{
        label="NOXII-LEGACY ({noxii_legacy_size})\\nHistorical Versions (0.01-0.27)";
        fillcolor="#fff3e0";
        color="#e65100";
        penwidth=2;

        noxii_legacy_root [
            label="NOXII-LEGACY/\\nArchived Development",
            fillcolor="#ff6f00",
            fontcolor=white
        ];

        subgraph cluster_legacy_versions {{
            label="Complete Version Archive";
            fillcolor="#ffe0b2";

            legacy_recent [label="v0.20-v0.27\\n(Recent archive)\\n8 versions", fillcolor="#ff6f00"];
            legacy_mid [label="v0.10-v0.19\\n(Mid versions)\\n10 versions", fillcolor="#ffb74d"];
            legacy_early [label="v0.01-v0.09\\n(Early versions)\\n9 versions", fillcolor="#ffcc80"];
        }}

        noxii_legacy_root -> legacy_recent;
        noxii_legacy_root -> legacy_mid;
        noxii_legacy_root -> legacy_early;
    }}

    // ==================================================
    // STORAGE OVERVIEW
    // ==================================================

    subgraph cluster_storage {{
        label="Project Storage";
        fillcolor="#f5f5f5";
        color=gray;
        penwidth=2;

        storage_active [
            label="Active Projects\\n(NOXII + ENACT)\\n21.9GB total",
            fillcolor="#4caf50",
            fontcolor=white
        ];

        storage_legacy [
            label="Legacy Archive\\n(NOXII-LEGACY)\\n29GB",
            fillcolor="#ff6f00",
            fontcolor=white
        ];

        storage_total [
            label="TOTAL GODOT\\nPROJECTS\\n50.9GB",
            shape=box3d,
            fillcolor="#2e7d32",
            fontcolor=white,
            penwidth=3
        ];
    }}

    // ==================================================
    // BACKUP STRUCTURE
    // ==================================================

    subgraph cluster_backups {{
        label="Project Backups & Archives";
        fillcolor="#fff9c4";
        color=goldenrod;
        penwidth=2;

        symlinks [
            label="Symlinks (Home)\\n/home/user/projects/backups/\\n→ /data/projects/",
            fillcolor="#fbc02d",
            fontcolor=black
        ];

        backups_daily [
            label="Daily Snapshots\\n/data/backups/daily/\\nAutomated hourly",
            fillcolor="#fdd835"
        ];

        compressed [
            label="Compressed Archives\\n(*.tar.xz)\\n~5GB total",
            fillcolor="#ffeb3b",
            shape=ellipse
        ];
    }}

    // ==================================================
    // KEY FEATURES
    // ==================================================

    subgraph cluster_features {{
        label="Development Features";
        fillcolor="#f3e5f5";
        color=purple;

        feature_godot4 [label="🎮 Godot 4 Engine"];
        feature_gd [label="📝 GDScript Gameplay"];
        feature_3d [label="🎨 3D Graphics"];
        feature_systems [label="⚙️ Game Systems"];
        feature_docs [label="📚 Comprehensive Docs"];
    }}

    // ==================================================
    // CONNECTIONS
    // ==================================================

    root -> noxii_root;
    root -> enact_root;
    root -> noxii_legacy_root;

    noxii_root -> storage_active;
    enact_root -> storage_active;
    noxii_legacy_root -> storage_legacy;

    storage_active -> storage_total;
    storage_legacy -> storage_total;

    storage_total -> symlinks [label="backed by", color=red, style=dashed];
    storage_total -> backups_daily [label="daily snapshots", color=orange, style=dotted];
    storage_total -> compressed [label="also archived", color=gray];

    // ==================================================
    // LEGEND
    // ==================================================

    subgraph cluster_legend {{
        label="Legend";
        fillcolor="#f5f5f5";
        color=gray;

        legend_active [label="🟢 Active", fillcolor="#4caf50", fontcolor=white];
        legend_legacy [label="🟠 Legacy/Archive", fillcolor="#ff6f00", fontcolor=white];
        legend_version [label="Version", fillcolor="#90caf9"];
        legend_symlink [label="Symlink", style=dashed, color=red];

        legend_active -> legend_legacy [style=invis];
    }}
}}
'''

    return dot_content

def main():
    """Generate and save Godot projects visualization"""

    print("🎮 Generating Godot Projects Visualization...")
    print("   Showing NOXII and ENACT game development")

    dot_content = generate_godot_dot()

    output_path = "/tmp/infrastructure-map/veritable-games-godot-projects.dot"
    with open(output_path, 'w') as f:
        f.write(dot_content)

    print(f"✅ Godot projects DOT file generated: {output_path}")
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
    print(f"  dot -Tsvg {output_path} -o godot-projects.svg")
    print(f"  dot -Tpng -Gdpi=300 {output_path} -o godot-projects.png")

if __name__ == "__main__":
    main()
