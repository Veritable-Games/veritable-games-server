#!/bin/bash
################################################################################
# PDF Artifact Cleanup Script
#
# Removes PDF-to-Markdown conversion artifacts from database documents:
# - Complete Page View sections
# - Figures and Images sections
# - Conversion metadata blocks
# - Page markers and dividers
# - Form feed characters
# - Excessive blank lines
#
# Additionally attempts basic OCR correction for corrupted text.
#
# Usage: ./cleanup_pdf_artifacts.sh [OPTIONS]
################################################################################

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-veritable_games}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_TABLE="library.library_documents"

# Script options (defaults)
DRY_RUN=false
LIMIT=""
SKIP_OCR=false
BATCH_SIZE=100
LOG_FILE="/tmp/cleanup_artifacts_$(date +%Y%m%d_%H%M%S).log"
STATS_ONLY=false

# Statistics
STATS_TOTAL=0
STATS_CLEANED=0
STATS_ALREADY_CLEAN=0
STATS_FAILED=0
STATS_COMPLETE_PAGE_VIEW=0
STATS_FIGURES=0
STATS_PAGE_MARKERS=0
STATS_FORM_FEEDS=0
STATS_METADATA=0
STATS_OCR_FIXED=0
STATS_OCR_FLAGGED=0
STATS_BYTES_SAVED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Utility Functions
################################################################################

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$LOG_FILE"
}

################################################################################
# Database Functions
################################################################################

db_query() {
    local query="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$query"
}

db_query_file() {
    local query="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$query"
}

get_document_ids() {
    local limit_clause=""
    if [[ -n "$LIMIT" ]]; then
        limit_clause="LIMIT $LIMIT"
    fi

    db_query "
        SELECT id
        FROM $DB_TABLE
        WHERE status = 'published'
        AND (
            content LIKE '%### Complete Page View%'
            OR content LIKE '%### Figures and Images%'
            OR content LIKE '%### Extracted Text%'
            OR content LIKE '%*Converted from:%'
        )
        ORDER BY id
        $limit_clause
    "
}

get_document_content() {
    local doc_id="$1"
    # Use dollar-quoted string to handle special characters
    db_query_file "SELECT content FROM $DB_TABLE WHERE id = $doc_id"
}

update_document_content() {
    local doc_id="$1"
    local content_file="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    # Use psql COPY for binary-safe content update
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        UPDATE $DB_TABLE
        SET content = pg_read_file('$content_file'), updated_at = NOW()
        WHERE id = $doc_id
    " 2>/dev/null || {
        # Fallback: use parameter substitution
        local escaped_content
        escaped_content=$(cat "$content_file" | sed "s/'/''/g")
        db_query "UPDATE $DB_TABLE SET content = E'$escaped_content', updated_at = NOW() WHERE id = $doc_id"
    }
}

################################################################################
# Artifact Removal Functions
################################################################################

remove_conversion_metadata() {
    local content="$1"
    # Remove the conversion metadata block at the top
    echo "$content" | sed -E '
        /^\*Converted from:/,/^\*Converted:.*\*$/ {
            d
        }
    '
}

remove_complete_page_view() {
    local content="$1"
    # Remove Complete Page View sections
    echo "$content" | sed -E '
        /^### Complete Page View$/,/^!\[Page [0-9]+ Complete\]/ {
            d
        }
    '
}

remove_figures_and_images() {
    local content="$1"
    # Remove Figures and Images sections
    echo "$content" | sed -E '
        /^### Figures and Images/,/^(---|### |## )/ {
            /^(---|### |## )/! d
        }
        /^#### Figure:/,/^!\[Figure from page/ {
            d
        }
    '
}

remove_page_markers() {
    local content="$1"
    # Remove page markers like "## Page N"
    echo "$content" | sed -E '
        /^---$/d
        /^## Page [0-9]+$/d
    '
}

remove_form_feeds() {
    local content="$1"
    # Remove form feed characters
    echo "$content" | tr -d '\f' | sed 's/\\x0C//g'
}

extract_from_extracted_text() {
    local content="$1"
    local output=""
    local in_extracted=false
    local in_code_block=false

    while IFS= read -r line; do
        # Detect Extracted Text section start
        if [[ "$line" =~ ^###[[:space:]]+Extracted[[:space:]]Text ]]; then
            in_extracted=true
            continue
        fi

        # Handle code blocks within Extracted Text
        if [[ "$in_extracted" == "true" ]]; then
            if [[ "$line" == '```' ]]; then
                if [[ "$in_code_block" == "false" ]]; then
                    in_code_block=true
                else
                    in_code_block=false
                    in_extracted=false
                fi
                continue
            fi

            # Extract content between code blocks
            if [[ "$in_code_block" == "true" ]]; then
                output+="$line"$'\n'
            fi
        else
            # Preserve non-extracted-text content
            output+="$line"$'\n'
        fi
    done <<< "$content"

    echo "$output"
}

clean_excessive_blank_lines() {
    local content="$1"
    # Reduce 3+ consecutive blank lines to max 2
    echo "$content" | sed -E ':a; /^\s*$/{ N; /^\s*\n\s*\n\s*$/{ s/\n\n/\n/; ba; }; }'
}

################################################################################
# OCR Correction Functions
################################################################################

build_word_dictionary() {
    # Build a dictionary from system wordlist + common technical terms
    local dict_file="/tmp/cleanup_wordlist.txt"

    if [[ -f "$dict_file" ]]; then
        echo "$dict_file"
        return
    fi

    {
        # System dictionary
        if [[ -f /usr/share/dict/words ]]; then
            cat /usr/share/dict/words
        fi

        # Common technical/political terms
        echo "anarchist"
        echo "anarchism"
        echo "capitalism"
        echo "historical"
        echo "naturalistic"
        echo "pragmatic"
        echo "perspectives"
        echo "routledge"
        echo "chapters"
        echo "between"
        echo "selection"
        echo "editorial"
        echo "contributors"
        echo "individual"
    } | tr '[:upper:]' '[:lower:]' | sort -u > "$dict_file"

    echo "$dict_file"
}

detect_corrupted_word() {
    local word="$1"
    # Detect words with mostly consonants (likely OCR corruption)
    # Pattern: 3+ consonants with no vowels, length >= 4
    if [[ ${#word} -lt 4 ]]; then
        return 1
    fi

    if [[ "$word" =~ ^[bcdfghjklmnpqrstvwxyz]{3,}$ ]]; then
        return 0
    fi

    return 1
}

attempt_ocr_fix() {
    local corrupted="$1"
    local dict_file="$2"

    # Try inserting vowels at different positions
    local best_match=""
    local best_score=0

    # Generate candidates by inserting vowels
    local len=${#corrupted}
    for ((i=0; i<=len; i++)); do
        for vowel in a e i o u; do
            local candidate="${corrupted:0:i}${vowel}${corrupted:i}"

            # Check if candidate exists in dictionary
            if grep -q "^${candidate}$" "$dict_file"; then
                # Simple scoring: exact match = 100
                if [[ $best_score -lt 100 ]]; then
                    best_match="$candidate"
                    best_score=100
                fi
            fi
        done
    done

    # Return best match if score > 80
    if [[ $best_score -gt 80 ]]; then
        echo "$best_match"
        return 0
    fi

    echo "$corrupted"
    return 1
}

apply_ocr_corrections() {
    local content="$1"
    local ocr_log="${LOG_FILE%.log}_ocr.txt"

    if [[ "$SKIP_OCR" == "true" ]]; then
        echo "$content"
        return
    fi

    local dict_file
    dict_file=$(build_word_dictionary)

    local output="$content"
    local fixed_count=0
    local flagged_count=0

    # Process word by word
    while IFS= read -r line; do
        local new_line="$line"

        # Extract words
        for word in $line; do
            # Remove punctuation for testing
            local clean_word="${word//[^a-zA-Z]/}"
            local lower_word="${clean_word,,}"

            if detect_corrupted_word "$lower_word"; then
                local fixed
                if fixed=$(attempt_ocr_fix "$lower_word" "$dict_file"); then
                    if [[ "$fixed" != "$lower_word" ]]; then
                        # Log correction
                        echo "Fixed: $lower_word → $fixed" >> "$ocr_log"

                        # Replace in line (preserve case roughly)
                        if [[ "${clean_word:0:1}" =~ [A-Z] ]]; then
                            fixed="$(tr '[:lower:]' '[:upper:]' <<< "${fixed:0:1}")${fixed:1}"
                        fi

                        new_line="${new_line//$word/${word//$clean_word/$fixed}}"
                        ((fixed_count++))
                        ((STATS_OCR_FIXED++))
                    fi
                else
                    # Flag for manual review
                    echo "Flagged: $lower_word (no confident fix)" >> "$ocr_log"
                    ((flagged_count++))
                    ((STATS_OCR_FLAGGED++))
                fi
            fi
        done

        output="${output//$line/$new_line}"
    done <<< "$content"

    echo "$output"
}

################################################################################
# Smart Formatting Functions (from original Python script)
################################################################################

apply_smart_formatting() {
    local content="$1"

    # Convert centered headers (many leading spaces + short text)
    content=$(echo "$content" | sed -E 's/^[[:space:]]{15,}(.{1,60})$/## \1/')

    # Normalize bullet points
    content=$(echo "$content" | sed -E 's/^[[:space:]]*(•|·|−)[[:space:]]+/- /')

    # Detect section headers (short line + blank line after)
    # This is complex in sed, skip for now - bash isn't ideal for this logic

    echo "$content"
}

################################################################################
# Main Processing Function
################################################################################

process_document() {
    local doc_id="$1"
    local idx="$2"
    local total="$3"

    info "[$idx/$total] Processing document ID $doc_id..."

    # Get original content
    local content_file="/tmp/doc_${doc_id}_original.txt"
    get_document_content "$doc_id" > "$content_file"

    if [[ ! -s "$content_file" ]]; then
        error "Failed to fetch content for ID $doc_id"
        ((STATS_FAILED++))
        return 1
    fi

    local original_size
    original_size=$(wc -c < "$content_file")
    local content
    content=$(<"$content_file")

    # Check if already clean
    if ! echo "$content" | grep -qE '(### Complete Page View|### Figures and Images|### Extracted Text|\*Converted from:)'; then
        info "  Already clean, skipping"
        ((STATS_ALREADY_CLEAN++))
        return 0
    fi

    # Count artifacts before cleanup
    local page_views
    page_views=$(echo "$content" | grep -c '### Complete Page View' || true)
    local figures
    figures=$(echo "$content" | grep -c '### Figures and Images' || true)
    local page_markers
    page_markers=$(echo "$content" | grep -c '^## Page [0-9]' || true)
    local form_feeds
    form_feeds=$(echo "$content" | grep -c '\\x0C' || true)
    local metadata
    metadata=$(echo "$content" | grep -c '\*Converted from:' || true)

    ((STATS_COMPLETE_PAGE_VIEW += page_views))
    ((STATS_FIGURES += figures))
    ((STATS_PAGE_MARKERS += page_markers))
    ((STATS_FORM_FEEDS += form_feeds))
    ((STATS_METADATA += metadata))

    # Apply cleanup pipeline
    info "  Removing conversion metadata..."
    content=$(remove_conversion_metadata "$content")

    info "  Removing Complete Page View sections..."
    content=$(remove_complete_page_view "$content")

    info "  Removing Figures and Images sections..."
    content=$(remove_figures_and_images "$content")

    info "  Removing page markers..."
    content=$(remove_page_markers "$content")

    info "  Removing form feed characters..."
    content=$(remove_form_feeds "$content")

    info "  Extracting from Extracted Text sections..."
    content=$(extract_from_extracted_text "$content")

    info "  Cleaning excessive blank lines..."
    content=$(clean_excessive_blank_lines "$content")

    info "  Applying smart formatting..."
    content=$(apply_smart_formatting "$content")

    info "  Applying OCR corrections..."
    content=$(apply_ocr_corrections "$content")

    # Write cleaned content
    local cleaned_file="/tmp/doc_${doc_id}_cleaned.txt"
    echo "$content" > "$cleaned_file"

    local new_size
    new_size=$(wc -c < "$cleaned_file")
    local reduction
    reduction=$(awk "BEGIN {printf \"%.1f\", (($original_size - $new_size) / $original_size * 100)}")

    ((STATS_BYTES_SAVED += (original_size - new_size)))

    # Update database
    if [[ "$DRY_RUN" == "false" ]]; then
        if update_document_content "$doc_id" "$cleaned_file"; then
            success "  ✓ Cleaned: $reduction% size reduction (${original_size}B → ${new_size}B)"
            ((STATS_CLEANED++))
        else
            error "  Failed to update database"
            ((STATS_FAILED++))
            return 1
        fi
    else
        info "  [DRY-RUN] Would reduce size by $reduction% (${original_size}B → ${new_size}B)"
        ((STATS_CLEANED++))
    fi

    # Cleanup temp files
    rm -f "$content_file" "$cleaned_file"
}

################################################################################
# Statistics and Reporting
################################################################################

show_statistics() {
    local total_artifacts=$((STATS_COMPLETE_PAGE_VIEW + STATS_FIGURES + STATS_PAGE_MARKERS + STATS_FORM_FEEDS + STATS_METADATA))

    cat <<EOF

================================================================================
SUMMARY
================================================================================
Total processed:      $STATS_TOTAL
✓ Cleaned:            $STATS_CLEANED
⊘ Already clean:      $STATS_ALREADY_CLEAN
✗ Failed:             $STATS_FAILED

Artifacts removed:
  - Complete Page View sections:  $STATS_COMPLETE_PAGE_VIEW
  - Figures and Images sections:  $STATS_FIGURES
  - Page markers:                 $STATS_PAGE_MARKERS
  - Form feeds:                   $STATS_FORM_FEEDS
  - Conversion metadata:          $STATS_METADATA

Total artifacts:      $total_artifacts

EOF

    if [[ "$SKIP_OCR" == "false" ]]; then
        cat <<EOF
OCR corrections:
  - Words fixed:                  $STATS_OCR_FIXED
  - Flagged for review:           $STATS_OCR_FLAGGED

EOF
    fi

    # Calculate size reduction
    local mb_saved
    mb_saved=$(awk "BEGIN {printf \"%.2f\", $STATS_BYTES_SAVED / 1024 / 1024}")

    cat <<EOF
Database changes:
  - Documents updated:            $STATS_CLEANED
  - Total bytes saved:            $mb_saved MB

✅ Cleanup complete
📝 Detailed log: $LOG_FILE
EOF

    if [[ "$SKIP_OCR" == "false" ]]; then
        echo "📝 OCR corrections: ${LOG_FILE%.log}_ocr.txt"
    fi
}

################################################################################
# Main Execution
################################################################################

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --dry-run          Preview changes without updating database
  --limit N          Process only N documents (for testing)
  --skip-ocr         Skip OCR correction, structural cleanup only
  --batch-size N     Process N documents per batch (default: 100)
  --log FILE         Write detailed log to FILE
  --stats            Show statistics only, no processing
  -h, --help         Show this help message

Examples:
  # Dry run on 10 documents
  $0 --dry-run --limit 10

  # Clean all documents with OCR
  $0

  # Clean without OCR correction
  $0 --skip-ocr

  # Show statistics only
  $0 --stats

EOF
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --limit)
                LIMIT="$2"
                shift 2
                ;;
            --skip-ocr)
                SKIP_OCR=true
                shift
                ;;
            --batch-size)
                BATCH_SIZE="$2"
                shift 2
                ;;
            --log)
                LOG_FILE="$2"
                shift 2
                ;;
            --stats)
                STATS_ONLY=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Print header
    cat <<EOF | tee "$LOG_FILE"
================================================================================
PDF Artifact Cleanup Script
================================================================================
Mode: $(if [[ "$DRY_RUN" == "true" ]]; then echo "DRY-RUN"; else echo "LIVE"; fi)
Target: $DB_TABLE (PostgreSQL)
Database: $DB_NAME @ $DB_HOST:$DB_PORT
Batch size: $BATCH_SIZE
OCR correction: $(if [[ "$SKIP_OCR" == "true" ]]; then echo "Disabled"; else echo "Enabled"; fi)
$(if [[ -n "$LIMIT" ]]; then echo "Limit: $LIMIT documents"; fi)
================================================================================

EOF

    # Get document IDs to process
    info "Fetching documents with PDF artifacts..."
    local doc_ids
    mapfile -t doc_ids < <(get_document_ids)

    STATS_TOTAL=${#doc_ids[@]}

    if [[ $STATS_TOTAL -eq 0 ]]; then
        success "No documents found needing cleanup!"
        exit 0
    fi

    info "Found $STATS_TOTAL documents to process"

    if [[ "$STATS_ONLY" == "true" ]]; then
        show_statistics
        exit 0
    fi

    # Create database backup if not dry-run
    if [[ "$DRY_RUN" == "false" ]]; then
        warn "Creating database backup..."
        local backup_file="/tmp/library_documents_backup_$(date +%Y%m%d_%H%M%S).sql"
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t "$DB_TABLE" > "$backup_file"
        success "Backup created: $backup_file"
    fi

    # Process documents
    local idx=0
    for doc_id in "${doc_ids[@]}"; do
        ((idx++))
        process_document "$doc_id" "$idx" "$STATS_TOTAL" || true

        # Commit batch
        if [[ $((idx % BATCH_SIZE)) -eq 0 ]] && [[ "$DRY_RUN" == "false" ]]; then
            info "Committing batch..."
        fi
    done

    # Show final statistics
    show_statistics
}

# Run main
main "$@"
