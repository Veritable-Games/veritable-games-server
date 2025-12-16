#!/bin/bash
# CPU and Memory Limited Wrapper for marker_single
# Prevents excessive CPU usage
#
# Usage: marker_single_limited.sh [marker_single args]
# Example: marker_single_limited.sh "document.pdf" --output_dir "output"

set -euo pipefail

# Performance environment variables (reduce thread contention)
export TOKENIZERS_PARALLELISM=false
export OMP_NUM_THREADS=2
export OMP_DYNAMIC=false
export MKL_NUM_THREADS=2
export OPENBLAS_NUM_THREADS=2
export MKL_DYNAMIC=false
export GRPC_VERBOSITY=ERROR
export GLOG_minloglevel=2
export PYTORCH_ENABLE_MPS_FALLBACK=1

# PyTorch GPU memory management (Layer 1: Reduce fragmentation, improve allocation)
export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True,max_split_size_mb:256,garbage_collection_threshold:0.7"
export CUDA_LAUNCH_BLOCKING=1  # Safer GPU operations (serialize CUDA calls)

# CPU limit as percentage (increased to 100% - GPU is the bottleneck)
CPU_LIMIT="${MARKER_CPU_LIMIT:-100}"

# Nice level (0-19, higher = lower priority, default: 10)
NICE_LEVEL="${MARKER_NICE_LEVEL:-10}"

# CRITICAL FIX: Add NCCL library path for PyTorch
export LD_LIBRARY_PATH="$HOME/.local/share/pipx/venvs/marker-pdf/lib/python3.12/site-packages/nvidia/nccl/lib:${LD_LIBRARY_PATH:-}"

# Full path to marker_single
MARKER_SINGLE="$HOME/.local/bin/marker_single"

# Check if cpulimit is installed
if ! command -v cpulimit &> /dev/null; then
    echo "ERROR: cpulimit is not installed. Install with: sudo apt install cpulimit"
    exit 1
fi

# Check if marker_single is available
if [ ! -x "$MARKER_SINGLE" ]; then
    echo "ERROR: marker_single not found at $MARKER_SINGLE"
    echo "Install with: pipx install marker-pdf"
    exit 1
fi

echo "[CPU Limited marker_single]"
echo "  CPU Limit: ${CPU_LIMIT}%"
echo "  Nice Level: ${NICE_LEVEL} (lower priority)"
echo "  NCCL Library Path: ${LD_LIBRARY_PATH}"
echo "  marker_single: ${MARKER_SINGLE}"
echo "  Command: $@"
echo ""

# NOTE: Memory limit (ulimit -v) removed because it prevents NCCL library from loading
# PyTorch/NCCL needs to map large memory segments which fails with restrictive ulimit

# Run marker_single with nice (lower priority) and cpulimit (hard CPU cap)
# -l = CPU limit percentage
# -m = monitor forks/child processes
# -f = foreground mode (launch target and wait)
nice -n ${NICE_LEVEL} cpulimit -l ${CPU_LIMIT} -m -f -- "${MARKER_SINGLE}" "$@"

exit $?
