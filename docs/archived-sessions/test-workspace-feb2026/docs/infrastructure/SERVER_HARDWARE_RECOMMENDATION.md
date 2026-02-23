# Server Hardware Recommendation: System76 Upgrade

**Date**: February 4, 2026
**Purpose**: Hardware specification recommendation for replacing the current underpowered server
**Vendor**: System76
**Platform**: All-AMD (EPYC CPU + Radeon PRO / Instinct GPU)
**Budget**: $5,000 - $7,000 (with financing if available)

---

## Current System Profile

### Hardware (from Server Documentation)

| Component | Current Spec | Problem |
|-----------|-------------|---------|
| **CPU** | AMD Ryzen 9 5900X (12C/24T, desktop AM4) | Desktop chip, not server-grade. Fine for web, insufficient for concurrent LLM + web + game hosting |
| **RAM** | ~32-64GB DDR4 (desktop, 2-channel) | **Critical bottleneck** -- system freezes when running LLM models. No ECC. Only 2 memory channels (~51 GB/s bandwidth) |
| **GPU** | None / consumer-grade | No dedicated inference GPU. PDF conversion and LLM inference are CPU-bound |
| **Storage** | 512GB SSD (sdb) + 5.5TB HDD (sdc) + 1TB SSD (sda, **FAILED**) | Already lost a drive. No hot-swap. Desktop SATA |
| **Form Factor** | Desktop tower (converted) | No rack mount, no redundant PSU, no IPMI/BMC, no hot-swap |
| **Network** | Consumer 1GbE | No management port, no 10GbE |

### Workloads (Active + Planned)

**Running Today (from `veritable-games-server` and `veritable-games-site`):**
- Veritable Games website (Next.js 15 + React 19 + PostgreSQL 15, 8 schemas, 170+ tables)
- 18+ Docker containers (Coolify, Traefik, pgAdmin, app, database, redis, etc.)
- BTCPay Server + Bitcoin full node (60GB blockchain, growing to 500GB+)
- WebSocket server (Yjs real-time collaboration, port 3002)
- PDF conversion pipeline (marker_single, AI-powered OCR)
- Literature archive (24,643 anarchist texts + 6,584 marxists.org texts)
- Monitoring + automated backups (SMART, cron, daily pg_dump)

**Planned:**
- **LLM inference** (llama.cpp / Ollama) -- primary upgrade driver, currently freezes the server
- **Godot game server hosting** -- multiplayer player hosting
- Expanded concurrent users and WebSocket connections

---

## Why the Current System Fails at LLM Inference

LLM token generation is **memory-bandwidth-bound**, not compute-bound. Your Ryzen 9 5900X has 2 DDR4 channels providing ~51 GB/s. Running a 70B Q4 model (~40GB) saturates that bandwidth entirely, starving PostgreSQL, Docker, and the OS -- hence the freezes.

| System | Memory Channels | Bandwidth | 70B Q4_K_M tok/s |
|--------|----------------|-----------|-------------------|
| **Your Ryzen 9 5900X** (DDR4, 2ch) | 2 | ~51 GB/s | ~1-2 (system freezes) |
| EPYC 9124 entry (DDR5, 12ch) | 12 | ~461 GB/s | ~5-6 |
| EPYC 9254 mid-range (DDR5, 12ch) | 12 | ~461 GB/s | ~7 |
| **AMD Radeon PRO W7900** (GDDR6) | GPU bus | 864 GB/s | **~11-13** |
| AMD Instinct MI210 (HBM2e) | GPU bus | 1,638 GB/s | **~15-20** (est.) |

Even the entry-level EPYC with 12 DDR5 channels is a **9x bandwidth improvement** over your desktop. Add an AMD GPU and you get interactive-speed inference on 70B models without touching system RAM.

---

## Recommended Configuration: Eland 1U + AMD GPU ($5-7K Target)

The System76 **Eland 1U** is the right chassis for this budget. It has 1 PCIe x16 slot for a GPU, entry-level EPYC pricing, and all the server fundamentals you're missing.

### Spec Sheet

| Component | Specification | Est. Cost | Rationale |
|-----------|--------------|-----------|-----------|
| **Chassis** | System76 Eland 1U (`elan1-r3`) | (included in base) | 1U rack, hot-swap, redundant PSU, IPMI |
| **CPU** | 1x AMD EPYC 9124 (16C/32T, 3.0GHz) or 9224 (24C/48T) | ~$500-1,200 | Entry EPYC. 16-24 cores is more than enough for web + DB + game servers. All 12 DDR5 channels available. |
| **RAM** | 192GB DDR5-4800 ECC (12x 16GB) | ~$600-900 | **All 12 channels populated** for maximum bandwidth. 192GB leaves headroom for Docker + DB + models. Upgrade to 12x 32GB (384GB) later. |
| **GPU** | 1x AMD Radeon PRO W7900 (48GB GDDR6) | ~$3,500 | 48GB handles 70B Q4 models at ~11-13 tok/s. ROCm 6.1+ supported. Outperforms RTX 4090 on large models by 4-7x due to VRAM. ECC available. |
| **Boot/OS** | 1x 1TB NVMe | ~$80-120 | OS + Docker images + PostgreSQL |
| **Data Storage** | 1-2x 2TB NVMe (hot-swap bays) | ~$200-400 | Document libraries, Bitcoin blockchain, project data. Add more drives later (10 hot-swap bays available). |
| **PSU** | 2x 650W redundant 80+ Platinum (included) | (included) | Redundancy you don't have today |
| **Network** | 2x 1GbE + 1x IPMI mgmt (included) | (included) | IPMI gives you remote management without SSH |
| **OS** | Pop!_OS or Ubuntu 24.04 LTS Server | Free | |

### Estimated Total: $5,000 - $7,000

| Budget Tier | Config | Estimated |
|-------------|--------|-----------|
| **Lean ($5K)** | EPYC 9124 + 192GB DDR5 + W7900 + 1TB NVMe | ~$5,000-5,500 |
| **Comfortable ($6-7K)** | EPYC 9224 + 192GB DDR5 + W7900 + 3TB NVMe | ~$6,000-7,000 |
| **Stretch ($7-8K)** | EPYC 9254 + 384GB DDR5 + W7900 + 4TB NVMe | ~$7,000-8,000 |

*These are rough estimates. System76 pricing is quote-based for servers. The W7900 may be sourced separately if not in their configurator.*

---

## AMD GPU Options (All-AMD Stack)

| GPU | VRAM | Bandwidth | 70B Q4 tok/s | Est. Cost | Notes |
|-----|------|-----------|-------------|-----------|-------|
| **Radeon PRO W7900** | 48GB GDDR6 | 864 GB/s | ~11-13 | ~$3,500 | **Best value for $5-7K budget.** ROCm 6.1+ supported. Fits 1-slot PCIe. Handles 70B Q4 models entirely in VRAM. |
| **Radeon PRO W7800** | 32GB GDDR6 | 576 GB/s | ~8-10 | ~$2,500 | Budget option. 32GB limits you to ~30B Q4 models comfortably. Saves $1K for more RAM/storage. |
| **Instinct MI210** | 64GB HBM2e | 1,638 GB/s | ~15-20 (est.) | ~$2,000-3,500 (used) | Datacenter card. 2x bandwidth of W7900. 64GB fits larger models. But: passive cooling (needs airflow), higher TDP (300W), harder to source. |
| **Instinct MI250** | 128GB HBM2e | 3,277 GB/s | ~20+ (est.) | ~$4,000-6,000 (used) | Over budget for a full server build. Best raw inference performance but costs as much as the entire server. |

### Recommendation: Radeon PRO W7900 (48GB)

For the $5-7K total budget, the W7900 is the sweet spot:
- 48GB VRAM fits 70B Q4-quantized models entirely in GPU memory
- 11-13 tok/s on 70B Q4_K_M -- interactive speed for chat
- Benchmarked at 19.8 tok/s on DeepSeek R1 Distill Qwen 32B (vs 2.7 tok/s on RTX 4090)
- ROCm support for llama.cpp is [officially documented by AMD](https://rocm.docs.amd.com/en/latest/compatibility/ml-compatibility/llama-cpp-compatibility.html)
- Active cooling (has a fan) -- works in 1U with proper airflow
- ECC memory option

### Alternative: Radeon PRO W7800 (32GB) to Save $1K

If you want to redirect $1K toward more RAM (384GB) or storage, the W7800 at ~$2,500 is viable. The tradeoff: 32GB VRAM limits you to ~30B parameter models at Q4 quantization. For 70B models you'd need heavy quantization (Q2/Q3) with quality loss, or partial CPU offload.

---

## What This Upgrade Gets You

| Capability | Current (Ryzen desktop) | After (Eland 1U + W7900) |
|-----------|------------------------|--------------------------|
| **LLM 70B Q4 inference** | ~1-2 tok/s (freezes system) | ~11-13 tok/s (GPU, system unaffected) |
| **LLM 13B inference** | ~5-8 tok/s (slow) | ~40+ tok/s (GPU) |
| **Concurrent workloads** | LLM locks out everything | GPU inference is independent of CPU/RAM |
| **RAM** | ~32-64GB, no ECC, 2 channels | 192-384GB ECC DDR5, 12 channels |
| **Drive failure** | Already lost one, no hot-swap | 10x hot-swap bays, replace live |
| **Power failure** | Single PSU = hard crash | Redundant PSU |
| **Remote management** | SSH only (useless if hung) | IPMI/BMC -- power cycle remotely even if OS is frozen |
| **Game server headroom** | Limited cores for hosting | 16-24 EPYC cores after web + DB |
| **Bitcoin full node** | Works but storage-constrained | Hot-swap NVMe, room to grow |

---

## Financing

System76 does **not** have a standard financing program, but there are options:

1. **Klarna** -- System76 is a Klarna merchant. "Pay in 4" splits the cost into 4 interest-free installments.
2. **Custom terms** -- System76's Terms of Service allow payment terms to be "agreed to in writing." For a server purchase, contact sales and ask directly about payment arrangements.
3. **Business credit** -- If Veritable Games is an LLC or similar entity, a business line of credit from a bank or fintech (Kabbage, BlueVine, etc.) can finance equipment purchases.

**Ask System76 directly** -- server purchases are higher-ticket items and they may have flexibility that isn't advertised for consumer hardware.

---

## System76 Sales Ticket Message

Here's a concise message for the form field:

> I'm interested in an Eland 1U EPYC server for combined web hosting and LLM inference. Currently running a Ryzen 9 5900X desktop that's RAM-constrained -- need to move to a proper server. Workloads: Next.js/PostgreSQL web app (20+ Docker containers, veritablegames.com), Godot game server hosting, local LLM inference (llama.cpp, 70B parameter models via ROCm), and a Bitcoin full node. Looking for: entry AMD EPYC CPU (9124/9224), 192GB DDR5 ECC (all 12 channels populated), NVMe storage, and 1x AMD Radeon PRO W7900 (48GB) in the PCIe slot. Budget is $5-7K. Do you offer financing or payment plans for server purchases? What's the most affordable Eland config that supports a full-height GPU?

*(~600 characters -- if the field is smaller, here's a shorter version:)*

> Looking for an entry Eland 1U EPYC server (~$5-7K budget) for web hosting + LLM inference. Need: AMD EPYC 9124/9224, 192GB DDR5 ECC (all channels populated), NVMe hot-swap, and 1x AMD Radeon PRO W7900 (48GB) GPU for llama.cpp inference via ROCm. Currently on a desktop Ryzen 9 5900X that freezes under LLM workloads. Also running 20+ Docker containers (Next.js, PostgreSQL, BTCPay). Do you offer payment plans?

---

## Alternative Path: Eland Chassis + Source GPU Separately

System76 may not stock AMD Radeon PRO GPUs in their server configurator (they primarily advertise NVIDIA). A practical approach:

1. **Order the Eland 1U from System76** without a GPU -- just CPU + RAM + storage (~$2,000-3,500)
2. **Source the Radeon PRO W7900 separately** from AMD's authorized resellers, B&H Photo, CDW, or Newegg (~$3,500)
3. **Install the GPU yourself** -- it's a PCIe card, no special tooling needed

This also lets you shop for the best GPU price independently and potentially find the W7900 on sale or open-box.

---

## Migration Plan

Your existing Docker-based infrastructure makes migration straightforward:

1. **Install OS** (Pop!_OS or Ubuntu 24.04 LTS Server)
2. **Install ROCm** (AMD GPU driver stack for llama.cpp)
3. **Install Docker + Coolify**
4. **Restore PostgreSQL** from your existing daily `pg_dumpall` backup
5. **Clone repos** from GitHub (`veritable-games-site`, `veritable-games-server`)
6. **Configure Coolify** -- set env vars, point to new containers
7. **Update Cloudflare Tunnel** -- redirect `veritablegames.com` to new server IP
8. **Migrate BTCPay** -- restore or re-sync Bitcoin blockchain
9. **Install Ollama/llama.cpp** with ROCm backend
10. **Replicate monitoring** -- SMART checks, health scripts, cron backup jobs
11. **Decommission old server** -- keep as cold backup until stable

---

## Sources

### System76
- [System76 Servers](https://system76.com/servers/)
- [System76 Ibex Pro AMD](https://system76.com/ibex-pro-amd/)
- [Eland 1U Technical Docs](https://tech-docs.system76.com/models/elan1-r2/README.html)
- [Eland Pro 2U Technical Docs](https://tech-docs.system76.com/models/elap2-r3/README.html)
- [Ibex Pro 2U Technical Docs](https://tech-docs.system76.com/models/ibep2-r1/README.html)
- [Starling Ampere Announcement](https://blog.system76.com/post/scale-quickly-with-new-starling-arm-based-ampere-s/)
- [System76 AI/ML Solutions](https://system76.com/ai-machine-learning/)
- [Klarna Buy-Now-Pay-Later for System76](https://www.klarna.com/us/store/23b123a4-ff8b-482d-afa4-8c40560b1af0/System76-Inc./pay-with-klarna/)

### AMD EPYC
- [AMD EPYC 9005 Series](https://www.amd.com/en/products/processors/server/epyc/9005-series.html)
- [AMD EPYC for LLM Inference (vLLM)](https://www.amd.com/en/blogs/2025/unlocking-optimal-llm-performance-on-amd-epyc--cpus-with-vllm.html)
- [AMD EPYC 9004 CPU for LLM Whitepaper](https://www.amd.com/content/dam/amd/en/documents/epyc-technical-docs/white-papers/amd-epyc-9004-wp-cpu-for-llm.pdf)
- [AMD EPYC 9004 for GPU Hosting](https://www.amd.com/en/products/processors/server/epyc/ai/9004-host-cpu-gpu.html)

### AMD GPU + LLM Inference
- [AMD Radeon PRO GPUs and ROCm for LLM Inference](https://www.amd.com/en/blogs/2024/amd-radeon-pro-gpus-and-rocm-software-for-llm-in.html)
- [llama.cpp ROCm Compatibility (AMD Official)](https://rocm.docs.amd.com/en/latest/compatibility/ml-compatibility/llama-cpp-compatibility.html)
- [llama.cpp ROCm Performance Discussion](https://github.com/ggml-org/llama.cpp/discussions/15021)
- [W7900 Pervasive Computing Project](https://llm-tracker.info/W7900-Pervasive-Computing-Project)
- [AMD GPU Tracker](https://llm-tracker.info/howto/AMD-GPUs)
- [W7900 48GB vs RTX 4090 -- Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/amd-rdna-3-professional-gpus-with-48gb-can-beat-nvidia-24gb-cards-in-ai-putting-the-large-in-llm)
- [AMD Instinct MI210 Specs](https://www.amd.com/en/products/accelerators/instinct/mi200/mi210.html)
- [Best AMD GPUs for AI 2026](https://www.bestgpusforai.com/blog/best-amd-gpus-for-ai)

### CPU Inference Benchmarks
- [llama.cpp CPU Performance Discussion](https://github.com/ggml-org/llama.cpp/discussions/3167)
- [llama.cpp EPYC 9554 Benchmarks](https://ahelpme.com/ai/llm-inference-benchmarks-with-llamacpp-with-amd-epyc-9554-cpu/)
- [DeepSeek 671B on CPU-only Discussion](https://github.com/ggml-org/llama.cpp/discussions/11765)

### GPU Comparisons
- [RTX PRO 6000 vs Datacenter GPUs](https://www.cloudrift.ai/blog/benchmarking-rtx6000-vs-datacenter-gpus)
- [RTX 4090 vs 5090 vs PRO 6000 for LLM](https://www.cloudrift.ai/blog/benchmarking-rtx-gpus-for-llm-inference)
- [Best GPUs for LLM Inference 2025](https://www.databasemart.com/blog/best-nvidia-gpus-for-llm-inference-2025)
- [Puget Systems LLM Hardware Recommendations](https://www.pugetsystems.com/solutions/ai-and-hpc-workstations/ai-large-language-models/hardware-recommendations/)
