#!/usr/bin/env python3
"""
PDF Conversion Tools Comparison Script

Tests multiple PDF conversion tools on representative documents
to compare quality and output formats.
"""

import os
import subprocess
import time
import json
from pathlib import Path
from datetime import datetime

# Base paths
BASE_DIR = Path("/home/user/projects/veritable-games/resources/data")
PDF_DIR = BASE_DIR / "library-pdfs"
OUTPUT_DIR = BASE_DIR / "pdf-conversion-tests"
LOG_DIR = Path("/home/user/projects/veritable-games/resources/logs/pdf-reconversion")

# Test PDFs - representative samples
TEST_PDFS = [
    {
        "name": "short_political",
        "path": "DC IWW Resolution on Standing Rock.pdf",
        "type": "Short political document",
    },
    {
        "name": "wikipedia",
        "path": "Jesse Owens - Wikipedia.pdf",
        "type": "Wikipedia article (complex formatting)",
    },
    {
        "name": "academic",
        "path": "2307.02486.pdf",
        "type": "Academic paper (citations/references)",
    },
    {
        "name": "classic_text",
        "path": "Anarchist Morality.pdf",
        "type": "Classic anarchist text",
    },
]

# Conversion tools to test
TOOLS = [
    {
        "name": "marker_single",
        "command": lambda input_pdf, output_dir: [
            "marker_single",
            str(input_pdf),
            "--output_dir", str(output_dir),
            "--output_format", "markdown",
        ],
        "output_file": lambda name, output_dir: output_dir / f"{name}.md",
        "description": "AI-powered PDF to Markdown (best quality, preserves structure)",
        "use_output_dir": True,
    },
    {
        "name": "pdftotext",
        "command": lambda input_pdf, output_file: [
            "pdftotext",
            "-layout",  # Preserve layout
            str(input_pdf),
            str(output_file),
        ],
        "output_file": lambda name, output_dir: output_dir / f"{name}.txt",
        "description": "Poppler text extraction with layout (fast, basic)",
    },
    {
        "name": "pdftotext_simple",
        "command": lambda input_pdf, output_file: [
            "pdftotext",
            str(input_pdf),
            str(output_file),
        ],
        "output_file": lambda name, output_dir: output_dir / f"{name}.txt",
        "description": "Poppler text extraction without layout",
    },
    {
        "name": "pdftohtml",
        "command": lambda input_pdf, output_file: [
            "pdftohtml",
            "-s",  # Single HTML file
            "-stdout",
            str(input_pdf),
        ],
        "output_file": lambda name, output_dir: output_dir / f"{name}.html",
        "description": "Poppler HTML extraction (preserves formatting)",
        "capture_stdout": True,
    },
]


def run_conversion(tool, input_pdf, output_dir, pdf_name):
    """Run a single conversion with timing and error handling"""
    print(f"  Testing {tool['name']}...")

    tool_output_dir = output_dir / pdf_name / tool['name']
    tool_output_dir.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    try:
        # Get output file path
        if tool.get('use_output_dir'):
            # marker_single uses output directory
            output_path = tool_output_dir
            cmd = tool['command'](input_pdf, output_path)
        else:
            output_path = tool['output_file'](pdf_name, tool_output_dir)
            cmd = tool['command'](input_pdf, output_path)

        # Run conversion
        if tool.get('capture_stdout'):
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            # Write stdout to output file
            with open(output_path, 'w') as f:
                f.write(result.stdout)
        else:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

        elapsed_time = time.time() - start_time

        # Check for output file(s)
        if tool.get('use_output_dir'):
            # Tools that output to directory (marker_single) may create multiple files
            output_files = list(tool_output_dir.glob("*"))
            if output_files:
                # Find the main markdown file
                md_files = [f for f in output_files if f.suffix == '.md']
                if md_files:
                    output_size = md_files[0].stat().st_size
                else:
                    output_size = sum(f.stat().st_size for f in output_files if f.is_file())
            else:
                output_size = 0
        else:
            output_size = output_path.stat().st_size if output_path.exists() else 0

        return {
            "success": result.returncode == 0 and output_size > 0,
            "time": elapsed_time,
            "output_size": output_size,
            "return_code": result.returncode,
            "stderr": result.stderr if result.returncode != 0 else "",
            "output_path": str(tool_output_dir if tool.get('use_output_dir') else output_path),
        }

    except subprocess.TimeoutExpired:
        elapsed_time = time.time() - start_time
        return {
            "success": False,
            "time": elapsed_time,
            "output_size": 0,
            "return_code": -1,
            "stderr": "Conversion timed out (>5 minutes)",
            "output_path": "",
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        return {
            "success": False,
            "time": elapsed_time,
            "output_size": 0,
            "return_code": -1,
            "stderr": str(e),
            "output_path": "",
        }


def main():
    print("=" * 80)
    print("PDF Conversion Tools Comparison")
    print("=" * 80)
    print()

    # Create output directories
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Results storage
    results = {
        "timestamp": datetime.now().isoformat(),
        "tools": {tool['name']: tool['description'] for tool in TOOLS},
        "test_pdfs": TEST_PDFS,
        "conversions": [],
    }

    # Test each PDF
    for pdf_info in TEST_PDFS:
        pdf_path = PDF_DIR / pdf_info['path']

        if not pdf_path.exists():
            print(f"⚠️  PDF not found: {pdf_info['path']}")
            continue

        pdf_size = pdf_path.stat().st_size
        print(f"\n📄 Testing: {pdf_info['name']}")
        print(f"   Type: {pdf_info['type']}")
        print(f"   Size: {pdf_size:,} bytes")
        print()

        pdf_results = {
            "name": pdf_info['name'],
            "type": pdf_info['type'],
            "path": pdf_info['path'],
            "size": pdf_size,
            "conversions": {},
        }

        # Test each tool
        for tool in TOOLS:
            result = run_conversion(tool, pdf_path, OUTPUT_DIR, pdf_info['name'])
            pdf_results['conversions'][tool['name']] = result

            if result['success']:
                print(f"    ✅ {tool['name']:20s} - {result['time']:.2f}s - {result['output_size']:,} bytes")
            else:
                print(f"    ❌ {tool['name']:20s} - FAILED - {result['stderr'][:50]}")

        results['conversions'].append(pdf_results)

    # Save results
    results_file = LOG_DIR / f"conversion-comparison-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)

    # Generate summary report
    print("\n" + "=" * 80)
    print("SUMMARY REPORT")
    print("=" * 80)
    print()

    print("Tool Performance Summary:")
    print("-" * 80)

    for tool in TOOLS:
        tool_name = tool['name']
        successes = sum(
            1 for pdf_result in results['conversions']
            if pdf_result['conversions'].get(tool_name, {}).get('success', False)
        )
        total_time = sum(
            pdf_result['conversions'].get(tool_name, {}).get('time', 0)
            for pdf_result in results['conversions']
        )
        avg_time = total_time / len(TEST_PDFS) if TEST_PDFS else 0

        print(f"{tool_name:20s} - {successes}/{len(TEST_PDFS)} successful - Avg: {avg_time:.2f}s")
        print(f"  {tool['description']}")
        print()

    print(f"📊 Detailed results saved to: {results_file}")
    print(f"📂 Converted files location: {OUTPUT_DIR}")
    print()
    print("Next steps:")
    print("  1. Review converted files in each tool's subdirectory")
    print("  2. Compare markdown formatting quality")
    print("  3. Check preservation of structure, tables, and formatting")
    print()


if __name__ == "__main__":
    main()
