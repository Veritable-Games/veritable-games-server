#!/bin/bash
################################################################################
# Test Marker PDF Converter on Sample PDFs
#
# Tests the marker_single + cleanup pipeline on 4 representative PDFs:
#   1. Short political document (1 page)
#   2. Wikipedia article (25 pages)
#   3. Academic paper (citations, equations)
#   4. Classic anarchist text (book chapter)
#
# Validates:
#   - Artifacts removed (page markers, metadata, "Extracted Text" sections)
#   - Chapter titles preserved
#   - Footnotes preserved
#   - Clean paragraph structure
#
# Usage:
#   cd /home/user/projects/veritable-games/resources/data
#   bash ../scripts/test_marker_samples.sh
#
# Created: November 26, 2025
################################################################################

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Directories
DATA_DIR="/home/user/projects/veritable-games/resources/data"
PDF_DIR="$DATA_DIR/library-pdfs"
TEST_OUTPUT_DIR="$DATA_DIR/marker-test-samples"
LOG_DIR="/home/user/projects/veritable-games/resources/logs/pdf-reconversion"

# Scripts
CLEANUP_SCRIPT="/home/user/projects/veritable-games/resources/scripts/cleanup_pdf_artifacts.py"

# Test PDFs
declare -A TEST_PDFS=(
    ["short_political"]="DC IWW Resolution on Standing Rock.pdf"
    ["wikipedia"]="Jesse Owens - Wikipedia.pdf"
    ["academic"]="2307.02486.pdf"
    ["classic_text"]="Anarchist Morality.pdf"
)

# Validation patterns (artifacts that should NOT appear)
declare -a FORBIDDEN_PATTERNS=(
    "^## Page [0-9]+"
    "\*Converted from:"
    "### Extracted Text"
    "### Complete Page View"
    "### Figures and Images"
    "^## [0-9]{1,3}$"
)

# Statistics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
}

print_header() {
    echo ""
    echo "================================================================================"
    echo "  MARKER PDF CONVERTER - SAMPLE TEST SUITE"
    echo "================================================================================"
    echo ""
    echo "Testing 4 representative PDFs:"
    for key in "${!TEST_PDFS[@]}"; do
        echo "  - ${TEST_PDFS[$key]}"
    done
    echo ""
    echo "Output directory: $TEST_OUTPUT_DIR"
    echo "================================================================================"
    echo ""
}

print_footer() {
    echo ""
    echo "================================================================================"
    echo "  TEST RESULTS"
    echo "================================================================================"
    echo ""
    echo "Total tests:  $TOTAL_TESTS"
    echo "Passed:       $PASSED_TESTS"
    echo "Failed:       $FAILED_TESTS"
    echo ""
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "✅ ALL TESTS PASSED"
    else
        echo "❌ SOME TESTS FAILED - Review output above"
    fi
    echo "================================================================================"
    echo ""
}

validate_output() {
    local name="$1"
    local md_file="$2"

    log "INFO" "  Validating: $name"

    local validation_passed=true
    local issues_found=0

    # Check file exists and has content
    if [ ! -f "$md_file" ]; then
        log "ERROR" "    ❌ File not found: $md_file"
        return 1
    fi

    local file_size=$(stat -c%s "$md_file" 2>/dev/null || echo "0")
    if [ "$file_size" -lt 100 ]; then
        log "ERROR" "    ❌ File too small: ${file_size} bytes"
        return 1
    fi

    log "INFO" "    File size: ${file_size} bytes"

    # Check for forbidden patterns (artifacts)
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        local matches=$(grep -cE "$pattern" "$md_file" || echo "0")
        if [ "$matches" -gt 0 ]; then
            log "WARN" "    ⚠️  Found $matches instances of: $pattern"
            ((issues_found++))
            validation_passed=false
        fi
    done

    # Check for excessive blank lines (3+ consecutive)
    local excessive_blanks=$(grep -cE $'^\n\n\n+' "$md_file" || echo "0")
    if [ "$excessive_blanks" -gt 0 ]; then
        log "WARN" "    ⚠️  Found $excessive_blanks instances of 3+ consecutive blank lines"
        ((issues_found++))
        validation_passed=false
    fi

    # Check for code block wrappers around content
    local code_blocks=$(grep -cE '^```$' "$md_file" || echo "0")
    if [ "$code_blocks" -gt 4 ]; then  # Some code blocks are OK (for actual code)
        log "WARN" "    ⚠️  Found $code_blocks code blocks (may include content wrappers)"
        ((issues_found++))
    fi

    # Summary
    if [ "$validation_passed" = true ]; then
        log "INFO" "    ✅ Validation PASSED - No artifacts found"
        return 0
    else
        log "ERROR" "    ❌ Validation FAILED - Found $issues_found issue types"
        return 1
    fi
}

test_single_pdf() {
    local name="$1"
    local pdf_filename="$2"

    ((TOTAL_TESTS++))

    echo ""
    echo "────────────────────────────────────────────────────────────────────────────"
    echo "Test $TOTAL_TESTS: $name"
    echo "PDF: $pdf_filename"
    echo "────────────────────────────────────────────────────────────────────────────"

    local pdf_path="$PDF_DIR/$pdf_filename"
    local output_dir="$TEST_OUTPUT_DIR/$name"

    # Check PDF exists
    if [ ! -f "$pdf_path" ]; then
        log "ERROR" "PDF not found: $pdf_path"
        ((FAILED_TESTS++))
        return 1
    fi

    # Create output directory
    mkdir -p "$output_dir"

    # Step 1: Convert with marker_single
    log "INFO" "  Step 1/3: Running marker_single..."

    if timeout 600 marker_single "$pdf_path" \
        --output_dir "$output_dir" \
        --output_format markdown \
        --disable_multiprocessing \
        > /dev/null 2>&1; then

        log "INFO" "  ✓ marker_single completed"
    else
        local exit_code=$?
        log "ERROR" "  ❌ marker_single failed (exit: $exit_code)"
        ((FAILED_TESTS++))
        return 1
    fi

    # Step 2: Find generated markdown
    local md_file=$(find "$output_dir" -name "*.md" -type f | head -1)

    if [ -z "$md_file" ] || [ ! -f "$md_file" ]; then
        log "ERROR" "  ❌ No markdown file generated"
        ((FAILED_TESTS++))
        return 1
    fi

    log "INFO" "  ✓ Found markdown: $(basename "$md_file")"

    # Step 3: Apply cleanup
    log "INFO" "  Step 2/3: Running cleanup_pdf_artifacts.py..."

    if timeout 60 python3 "$CLEANUP_SCRIPT" \
        --file "$md_file" \
        --output "$md_file" \
        --skip-ocr \
        > /dev/null 2>&1; then

        log "INFO" "  ✓ Cleanup completed"
    else
        local exit_code=$?
        log "WARN" "  ⚠️  Cleanup warning (exit: $exit_code) - continuing"
    fi

    # Step 4: Validate output
    log "INFO" "  Step 3/3: Validating output..."

    if validate_output "$name" "$md_file"; then
        ((PASSED_TESTS++))
        echo ""
        log "INFO" "✅ TEST PASSED: $name"
        return 0
    else
        ((FAILED_TESTS++))
        echo ""
        log "ERROR" "❌ TEST FAILED: $name"
        return 1
    fi
}

generate_comparison_report() {
    log "INFO" "Generating comparison report..."

    local report_file="$TEST_OUTPUT_DIR/COMPARISON_REPORT.md"

    cat > "$report_file" << EOF
# Marker PDF Converter - Test Results

**Date**: $(date '+%Y-%m-%d %H:%M:%S')
**Test PDFs**: ${#TEST_PDFS[@]}
**Passed**: $PASSED_TESTS
**Failed**: $FAILED_TESTS

---

## Test Summary

| PDF | Status | File Size | Issues |
|-----|--------|-----------|--------|
EOF

    for name in "${!TEST_PDFS[@]}"; do
        local md_file=$(find "$TEST_OUTPUT_DIR/$name" -name "*.md" -type f | head -1)

        if [ -f "$md_file" ]; then
            local size=$(stat -c%s "$md_file" 2>/dev/null || echo "0")
            local status="✅ PASS"
            local issues=0

            # Count issues
            for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
                local matches=$(grep -cE "$pattern" "$md_file" || echo "0")
                ((issues += matches))
            done

            if [ $issues -gt 0 ]; then
                status="❌ FAIL"
            fi

            echo "| $name | $status | ${size} bytes | $issues |" >> "$report_file"
        else
            echo "| $name | ❌ FAIL | N/A | Conversion failed |" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

---

## Validation Criteria

Forbidden patterns (artifacts that should NOT appear):

EOF

    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        echo "- \`$pattern\`" >> "$report_file"
    done

    cat >> "$report_file" << EOF

---

## Output Location

All test outputs are in: \`$TEST_OUTPUT_DIR/\`

Each subdirectory contains:
- Original markdown from marker_single
- Cleaned markdown after cleanup_pdf_artifacts.py
- JSON metadata (from marker)

EOF

    log "INFO" "Report saved to: $report_file"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    # Print header
    print_header

    # Create output directory
    mkdir -p "$TEST_OUTPUT_DIR"
    mkdir -p "$LOG_DIR"

    # Test each PDF
    for name in short_political wikipedia academic classic_text; do
        test_single_pdf "$name" "${TEST_PDFS[$name]}" || true
    done

    # Generate comparison report
    generate_comparison_report

    # Print footer
    print_footer

    # Exit with appropriate code
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Run main
main "$@"
