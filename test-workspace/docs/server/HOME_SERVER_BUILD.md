# Home Server Build - Final Parts List

**Date**: February 6, 2026
**Purpose**: LLM inference + web hosting + game servers + storage
**Form Factor**: ATX Mid-Tower
**Platform**: AMD AM5 (DDR5)
**PCPartPicker**: https://pcpartpicker.com/user/cwcorella/saved/dk2Zzy

---

## Final Parts List

| Component | Model | Price | Link |
|-----------|-------|-------|------|
| **CPU** | AMD Ryzen 9 7900X (12C/24T, 170W) | ~$318 | [Newegg](https://www.newegg.com/amd-ryzen-9-7900x-ryzen-9-7000-series-raphael-zen-4-socket-am5/p/N82E16819113769) |
| **CPU Cooler** | be quiet! Dark Rock Pro 5 | ~$88 | [Newegg](https://www.newegg.com/be-quiet-dark-rock-pro-5/p/13C-001F-00027) |
| **Motherboard** | MSI MAG X670E Tomahawk WiFi | ~$290 | [Newegg](https://www.newegg.com/msi-mag-x670e-tomahawk-wifi-atx-motherboard-amd-x670e-am5/p/N82E16813144595) |
| **RAM** | Crucial Pro DDR5 5600 64GB (2x32GB) | *owned* | [Newegg](https://www.newegg.com/crucial-pro-64gb-ddr5-5600-cas-latency-cl46-desktop-memory-black/p/N82E16820156380) |
| **GPU** | AMD Radeon PRO W7900 48GB | ~$3,999 | [Newegg](https://www.newegg.com/amd-radeon-pro-w7900-100-300000074/p/N82E16814105114) |
| **SSD** | Samsung 9100 PRO 2TB NVMe (PCIe 5.0) | ~$315 | [Newegg](https://www.newegg.com/samsung-2tb-9100-pro-nvme-2-0/p/N82E16820147903) |
| **Case** | Fractal Design Pop Silent ATX Mid-Tower | ~$85 | [Newegg](https://www.newegg.com/black-fractal-design-pop-silent-atx-mid-tower/p/N82E16811352192) |
| **PSU** | Corsair RM850x (2024 ATX 3.1) | ~$136 | [Newegg](https://www.newegg.com/corsair-rmx-series-atx-3-1-compatible-850-w-cybenetics-gold-power-supply-black-rm850x/p/N82E16817139333) |
| **Storage** | *Migrate HDDs from current server* | *owned* | - |

---

## Total Cost

| Item | Price |
|------|-------|
| CPU | ~$318 |
| CPU Cooler | ~$88 |
| Motherboard | ~$290 |
| GPU | ~$3,999 |
| SSD | ~$315 |
| Case | ~$85 |
| PSU | ~$136 |
| **Subtotal** | **~$5,231** |
| Offset (sell 5900X) | -$200 to -$250 |
| **Net Cost** | **~$4,981 - $5,031** |

*Newegg offers Affirm financing — check eligibility at checkout.*

---

## Component Details

### CPU: AMD Ryzen 9 7900X
- 12 cores / 24 threads (matches your 5900X)
- 4.7 GHz base / 5.6 GHz boost
- 170W TDP
- AM5 socket (DDR5 compatible)
- PCIe 5.0 support

### CPU Cooler: be quiet! Dark Rock Pro 5
- 270W TDP rating (handles 7900X with headroom)
- 168mm height (fits Pop Silent's 170mm clearance)
- Dual-tower design with 7 heatpipes
- Silent Wings PWM fans (max 24.3 dBA)
- AM5 socket support (native mounting)

**Note**: The Dark Rock 5 (non-Pro, ~$60) would also suffice at 210W TDP for a 170W CPU. The Pro 5 provides extra thermal headroom for sustained inference loads.

### Motherboard: MSI MAG X670E Tomahawk WiFi
- X670E chipset (PCIe 5.0 for GPU + NVMe)
- 14+2+1 phase VRM (handles 7900X easily)
- 4x DDR5 slots (up to 256GB, supports 5600+ MHz)
- 1x PCIe 5.0 x16 slot (for GPU)
- 3x M.2 slots (2x PCIe 5.0, 1x PCIe 4.0)
- 6x SATA III ports (for HDD migration)
- WiFi 6E + Bluetooth 5.2
- 2.5GbE LAN
- USB 3.2 Gen 2 Type-C

### GPU: AMD Radeon PRO W7900 48GB
- 48GB GDDR6 with ECC
- 864 GB/s memory bandwidth
- 295W TDP (2x 8-pin power)
- 280mm length (fits Pop Silent's 405mm clearance)
- RDNA 3 architecture with ROCm support
- **LLM Performance**:
  - 70B Q4 models: Fits entirely in VRAM (~11-13 tok/s)
  - 30B Q4 models: ~18-22 tok/s
  - 13B models: ~45+ tok/s

**Why W7900 over W7800?** The W7900's 48GB VRAM fits 70B Q4 models entirely in VRAM without quantization compromises. The 50% higher memory bandwidth (864 vs 576 GB/s) translates to ~50% faster inference since LLM generation is memory-bandwidth bound.

### SSD: Samsung 9100 PRO 2TB
- PCIe 5.0 x4 NVMe 2.0
- 14,700 MB/s read / 13,400 MB/s write
- 2GB LPDDR4X cache with TurboWrite 2.0
- 1,200 TBW endurance
- 5-year warranty
- Samsung V-NAND TLC (V8)

### Case: Fractal Design Pop Silent ATX Mid-Tower
- ATX mid-tower with sound-dampening panels
- 170mm CPU cooler clearance (Pro 5 = 168mm)
- 405mm GPU clearance (W7900 = 280mm)
- 2x 3.5" HDD bays + 4x 2.5" SSD mounts
- 3x 140mm Silent fans pre-installed
- USB 3.0 + USB-C front panel
- Clean, minimal aesthetic

### PSU: Corsair RM850x (2024 ATX 3.1)
- 850W 80+ Gold (Cybenetics Gold certified)
- Fully modular
- ATX 3.1 / PCIe 5.1 compliant
- 3x 8-pin (6+2) PCIe + 1x 12VHPWR native
- 140mm FDB fan with Zero RPM mode (silent under light load)
- 100% Japanese 105°C capacitors
- 10-year warranty

### RAM: Crucial Pro DDR5 5600
- 64GB (2x 32GB) - *owned*
- DDR5-5600 (PC5-44800)
- CL46 latency
- XMP 3.0 / AMD EXPO ready
- **Upgrade path**: Can add 2nd kit (~$170) for 128GB total

---

## Power Requirements

| Component | TDP |
|-----------|-----|
| GPU (W7900) | 295W |
| CPU (7900X) | 170W |
| System (drives, fans, mobo) | ~50W |
| **Total Load** | ~515W |
| **PSU Headroom** | 850W = 61% load |

The Corsair RM850x provides ample headroom with 39% overhead.

---

## Migration Checklist

### Before Building
- [ ] Sell Ryzen 9 5900X (~$200-250 on eBay/r/hardwareswap)
- [ ] Order parts from Newegg
- [ ] (Optional) Order 2nd RAM kit for 128GB

### Assembly
- [ ] Install CPU + cooler on motherboard (outside case)
- [ ] Install RAM in slots A2 + B2 (2nd and 4th from CPU)
- [ ] Mount motherboard in case
- [ ] Install NVMe SSD in top M.2 slot (PCIe 5.0)
- [ ] Install PSU and route cables
- [ ] Install GPU in top PCIe x16 slot
- [ ] Connect HDDs to SATA ports
- [ ] Cable management

### After Building
1. Install Ubuntu Server 24.04 LTS (or Pop!_OS if you want desktop)
2. Install ROCm 6.x for AMD GPU support
3. Install Docker + Coolify
4. Restore PostgreSQL from backup
5. Clone repos from GitHub
6. Configure Cloudflare Tunnel
7. Install Ollama/llama.cpp with ROCm backend
8. Test 70B model inference

---

## Quick Links

- **CPU**: https://www.newegg.com/amd-ryzen-9-7900x-ryzen-9-7000-series-raphael-zen-4-socket-am5/p/N82E16819113769
- **CPU Cooler**: https://www.newegg.com/be-quiet-dark-rock-pro-5/p/13C-001F-00027
- **Motherboard**: https://www.newegg.com/msi-mag-x670e-tomahawk-wifi-atx-motherboard-amd-x670e-am5/p/N82E16813144595
- **RAM**: https://www.newegg.com/crucial-pro-64gb-ddr5-5600-cas-latency-cl46-desktop-memory-black/p/N82E16820156380
- **GPU**: https://www.newegg.com/amd-radeon-pro-w7900-100-300000074/p/N82E16814105114
- **SSD**: https://www.newegg.com/samsung-2tb-9100-pro-nvme-2-0/p/N82E16820147903
- **Case**: https://www.newegg.com/black-fractal-design-pop-silent-atx-mid-tower/p/N82E16811352192
- **PSU**: https://www.newegg.com/corsair-rmx-series-atx-3-1-compatible-850-w-cybenetics-gold-power-supply-black-rm850x/p/N82E16817139333
- **PCPartPicker Build**: https://pcpartpicker.com/user/cwcorella/saved/dk2Zzy

---

*Finalized: February 6, 2026*
