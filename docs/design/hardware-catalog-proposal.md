# Hardware catalog rework: proposal

Status: proposal, nothing built. Surveyed on origin/main (c. 2026-10-30). Software (Pear One store) is out of scope.

## 1. What the shop sells today

Everything hardware comes out of `src/sim/10-catalog/hardware.ts`, `cpus.ts`, `parts.ts`, `gpu.ts`.

### Servers: 12 lines x 7 generations, one formula

| Line id | Shop name | Brands | Sockets | Cores x gen | RAM x gen | Bays | From |
|---|---|---|---|---|---|---|---|
| compute | Balanced 1U | Dwell | 2 | 1 | 1 | 4 LFF / 8 SFF / 10 NVMe | 2005 |
| compute-2psu | Balanced 1U, 2 PSU | Dwell | 2 | 1 | 1 | same | 2005 |
| value | Value 1U | SuperMacro | 1 | 0.5 | 0.5 | 2 to 4 | 2005 |
| dense | Compute-dense 1U | SuperMacro | 2 | 2 | 1 | same as compute | 2005 |
| memory | Memory-optimized 2U | Dwell | 2 | 1 | 4 | 8 | 2005 |
| bigmem | Large-memory 2U | Hewlett-Packet | 2 | 1 | 8 | 8 | 2005 |
| storage | Storage 2U | Dwell | 2 | 1 | 1 | 8 to 12 LFF | 2005 |
| backup | Backup storage 4U | SuperMacro | 1 | 0.5 | 0.5 | 12 to 36 LFF | 2005 |
| archive | Archive storage 4U | Dwell | 1 | 0.25 | 0.25 | 24 to 60 LFF | 2005 |
| gpu | GPU 4U | Dwell | 2 | 1 | 2 | 8 | 2011 |
| twin-node | Twin 2U (4 nodes) | SuperMacro | 2 | 1 | 1 | 3 LFF / 6 SFF | 2008 |
| arm | ARM 1U | Lenovoid | 1 | 1.5 | 1 | same as compute | 2020 |

Generation row (`economy.ts` GENERATIONS): 2005 2c/8 GB/500 GB HDD/2500 EUR, 2008 8c/24 GB, 2011 12c/64 GB, 2014 24c/128 GB SSD, 2017 40c/256 GB, 2020 64c/512 GB NVMe, 2023 128c/1 TB. Every model is `g{n}-{line}` named "Balanced 1U G4". A generation stays on sale until the one two steps newer arrives.

Manufacturers (`MANUFACTURERS`) never change specs. They only scale price (0.9 to 1.1), failure (0.7 to 1.3), release month (-4 to +6), end of sale and watts. Dwell, Hewlett-Packet, SuperMacro, Lenovoid share the identical chassis. Twelve of the 84 server models are the whole variety; the rest is the same box with a different sticker.

### CPUs: one SKU per maker per generation

`CPU_MODELS`: Indel, AMB, Ampear (from 2020), one row each per generation with `cores`, `ghz`, `perCore`, `watts`, `price`, `socket`. A CPU part is `{kind: "cpu", size: cores, vendor, gen}`; its core count is a share of the full socket. Clock is display only. `perCore` (0.8 to 1.15) is the only speed knob and is flat across a generation.

Sim use: `installedVcpu = cores x perCore` (status.ts), game servers run at `min(nodePerf, hostPerf, perCoreOf(node))` (products.ts:230). No threads, no boost, no per-model clocks, nothing rewards a fast core.

### Parts: generic, sized by GB or cores

`COMPONENT_KINDS` = hdd, ssd, nvme, psu, fan, ram, board, cpu, nic, gpu. A part has `size`, `ff`, `vendor` (CPUs and boards only), `gen`. Price is size x the year's EUR/GB or EUR/core keyframe (`parts.ts`). No part has a maker except CPUs, boards and GPUs. No RAM type (DDR2/3/4/5), no drive interface, no rpm, no endurance, no IOPS. Failure rates are per kind only (`COMPONENTS`).

Parts tab offers = whatever current presets ship with, plus an HDD size table (80 GB to 12 TB), two NVMe sizes, two GPU cards.

### Switches: 10 generic models, small ones vanish

| Id | Ports | Price | On sale |
|---|---|---|---|
| sw-8 | 8 x 1G | 60 | 2005 to 2011 |
| sw-24 | 24 x 1G + 2 SFP | 900 | 2005 to 2011 |
| sw-48 | 48 x 1G + 4 x 10G | 2800 | 2008 to 2014 |
| sw-48-l3 | 48 x 1G + 4 x 10G, L3 | 5500 | 2008 to 2014 |
| sw-48x | 48 x SFP 10G | 8000 | 2011 to 2017 |
| sw-48q | 48 x 10G + 6 x 40G, L3 | 14000 | 2014 to 2020 |
| sw-48y | 48 x 25G + 8 x 100G, L3 | 18000 | 2017 to 2023 |
| sw-32c / 32d / 32e | 32 x 100G / 400G / 800G | 20k / 45k / 60k | 2017 / 2022 / 2027 |

From 2012 there is no 8 or 24 port switch. From 2015 there is no copper access switch at all. Sysko, Junipurr, Aristotle differ by factors only.

### Firewalls: five sizes, six-year windows

fw-1g 1500 EUR (2005 to 2011), fw-10g 6000 (2011 to 2017), fw-40g 18000 (2017 to 2023), fw-100g 40000 (2022), fw-400g 70000 (2027). After 2011 the cheapest firewall costs 6000, after 2017 18000. Sysko, Fortinope, Pablo Alto by factors only.

### Already done right: routers, GPU cards, remote access

Routers are brand-specific SKUs with real-world-shaped model numbers: Sysko 1841 / 2811 / 2911 / 4451 / 8300, MicroTick RB1100 / CCR1036 / CCR2004 / CCR2216, Junipurr MX80 / MX204 / MX304, AVN Fritz!Bocks 7050 to 5690, plus Edge router S to XXL. GPU cards are seven named nVidea Tezlas. KVMs and console servers are named (PiKVN, IP-KVN 8, OpenGearbox 8/16/48, Rarytan OOB 8). UPS and PDU are generic (Eatin only). This router pattern is what the rest of the catalog should follow.

### USB port today

`fronts.tsx` UsbPort: 7 x 3.2 px rect placed at `w - 23 - panel`, left of the control panel, on every server face that is not a chassis node. Twin nodes (`NodeFace`) get no USB port at all, so a Twin node cannot boot the installer stick. On the Caddies (backup, archive) and Gpu faces the position is computed from a control panel those faces do not draw, so it floats over drive caddies.

## 2. Target model

Three ideas carry the whole rework.

1. **SKUs, not formulas.** A device model is one vendor's product with its own name, model number, release month, end of sale, chassis spec and default build. Shop labels (Balanced, Memory, Storage, GPU, Dense, ARM, Multi-node) become tags on SKUs used for filtering, not identity.
2. **Vendors differ in specs, not just factors.** Each vendor has a lineup shape and strengths: who ships a new CPU first, who has more DIMM slots, who has denser bays, who is cheap and flaky, who is dear and bulletproof, who only plays in the datacenter.
3. **Parts have makers and specs.** CPUs get threads, base and boost clock. RAM gets a type and speed. Drives get interface, rpm or endurance and a vendor. Fit rules check type and socket.

The generation clock (`GENERATIONS`, price keyframes) stays as the era engine for part prices and the news. SKUs reference it for pricing; they are not generated from it.

### 2.1 Data shape

```ts
interface ServerSku {
  id: string;            // "dwell-r720"
  vendor: string;        // manufacturer id
  name: string;          // "PowerEdgy R720"
  tags: Tag[];           // "balanced" | "dense" | "memory" | "storage" | "backup" | "archive" | "gpu" | "arm" | "twin" | "value"
  from: number;          // year * 12 + month
  until: number | null;  // last month on sale
  support: number;       // years after end of sale
  chassis: { height; sockets; socket: string; ddr: "DDR2" | "DDR3" | "DDR4" | "DDR5"; dimmSlots; maxRamGb; bays: BayGroup[]; pcie; psuBays; gpuSlots; ports: PortSpec[]; nodes?: number };
  build: { cpu: string; cpus: number; ram: string; sticks: number; drive: string; drives: number; gpu?: string; psus: 1 | 2 };
  watts: number;         // chassis without CPUs
  failureFactor: number; // on top of the vendor's
  bmc?: string;          // "iDRAQ 7"
}
interface CpuSku { id; vendor: "indel" | "amb" | "ampear"; name; socket; from; until; cores; threads; baseGhz; boostGhz; ipc; tdp; price }
interface RamSku { id; vendor; name; ddr; gb; mts; kind: "RDIMM" | "LRDIMM" | "UDIMM"; from; until; price; failureFactor }
interface DriveSku { id; vendor; name; kind: "hdd" | "ssd" | "nvme"; ff; gb; iface: "SATA" | "SAS" | "NVMe"; rpm?; dwpd?; mbps; iops; from; until; price; failureFactor }
```

`PartSpec` gains `sku?: string`. Parts without one (old saves, Generic spares) keep working: `size`, `vendor`, `gen` resolve to the nearest SKU for display and perf, and `fits()` treats them as the chassis's own type.

Chassis specs are still built from a handful of templates (1U 1S, 1U 2S, 2U 2S 8 SFF, 2U 12 LFF, 4U 36, 4U 60, 4U GPU, 2U Twin) with per-vendor overrides, so the vendor files stay short tables instead of 500 lines of literals.

### 2.2 Server vendors and their lineups

Five vendors. Lenovoid gets its real lineup, and Gigabutt joins as the ARM and GPU box builder.

| Vendor | Price | Failure | Watts | Release | Support | Strength | Weakness |
|---|---|---|---|---|---|---|---|
| Dwell | 1.00 | 1.0 | 1.00 | +0 | 7 y | widest lineup, every class, long support, iDRAQ | boring, premium RAM and caddies (+10% on Dwell-branded parts, optional) |
| Hewlett-Packet | 1.08 | 0.8 | 0.93 | +3 mo | 5 y | lowest failure, most DIMM slots (+50%), quietest PSUs | late, short sale window, iLOL Advanced license for remote console |
| SuperMacro | 0.88 | 1.3 | 1.06 | -4 mo | 3 y | first with every new CPU, densest bays, Twin and 4-node, cheapest 1S value boxes | flakiest, fewest DIMM slots, loud, IPMI defaults (one more breach vector) |
| Lenovoid | 0.95 | 1.0 | 1.00 | +6 mo | 5 y | big-memory and 4-socket boxes (SR850, SR950), x86 only | late, no storage 4U, no ARM, no GPU box until 2020 |
| Gigabutt | 0.85 | 1.25 | 1.04 | -2 mo | 3 y | ARM first (Ampear from 2020), 8-GPU boxes, cheap 2U | no 4U storage, thin lineup before 2017, fewest PCIe slots |

Model numbering, one family per vendor, generation visible in the number like the real world:

| Vendor | 1U 1S value | 1U 2S | 2U 2S | 2U storage | 4U storage | GPU | Twin | 4S / big memory | ARM |
|---|---|---|---|---|---|---|---|---|---|
| Dwell PowerEdgy | R200 / R210 / R220 / R230 / R240 / R250 / R260 | 1850 / R610 / R620 / R630 / R640 / R650 / R660 | 2850 / R710 / R720 / R730 / R740 / R750 / R760 | R510 / R720xd / R730xd / R740xd / R750xd / R760xd | | C4130 / C4140 / XE8545 / XE8640 | C6100 / C6220 / C6320 / C6420 / C6520 / C6620 | R900 / R910 / R920 / R930 / R940 / R950 / R960 | |
| Hewlett-Packet ProLight | DL120 G5 / DL120 G7 / DL120 Gen8 / DL120 Gen9 / DL20 Gen10 / Gen10+ / Gen11 | DL360 G5 / G6 / Gen8 / Gen9 / Gen10 / Gen10 Plus / Gen11 | DL380 G5 / G6 / Gen8 / Gen9 / Gen10 / Gen10 Plus / Gen11 | DL180 G6 / Gen8 / Gen9 / Gen10 | | Apollo 6500 (2017+) | Apollo 2000 (2014+) | DL580 G5 / G7 / Gen8 / Gen9 / Gen10 / Gen11 | RL300 Gen11 (2022) |
| SuperMacro SuperSaver | 5015 / 5016 / 5017R / 5018R / 5019P / 1019P / SYS-111E | 6015 / 6016T / 6017R / 6018R / 6019P / 1029U / SYS-121H | 6025 / 6026T / 6027R / 6028R / 6029P / 2029U / SYS-221H | 6026T-12 / 6027R-E1R12 / 6028R-E1CR12 / 6029P-E1CR12 / 2029U-E1CR24 / SYS-221P-C9R | 847E16 / 847E26 / 847E1C / 847E2C-R1K (36 bay), 946ED (60/90 bay) | 4028GR / 4029GP / 4124GS / SYS-421GE | 6026TT / 6027TR / 6028TP / 6029TP / 2029TP / SYS-221BT | 8048B / 8049U | SYS-R12SPD (Ampear) |
| Lenovoid System x / ThinkSystem | x3250 M4 / M5, SR250, SR250 V2, V3 | x3550 M4 / M5, SR630, V2, V3 | x3650 M4 / M5, SR650, V2, V3 | | | SR670, SR670 V2, SR675 V3 | SD530, SD650 V2 | x3850 X5 / X6, SR850, SR950, SR850 V3 | |
| Gigabutt | R121 / R131 / R161 / R163 | R181 / R182 / R183 | R281 / R282 / R283 | S251 / S252 / S253 | | G291 / G292 / G293 / G492 / G593 (8 GPU) | H261 / H262 / H263 | | R272-P30 / R272-P32 / R263-P33 (Ampear) |

Lenovoid starts in 2012 (System x), earlier years have IBN System x3550 M1/M2/M3 under the same vendor row with a different label, or Lenovoid simply starts later. Recommend: Lenovoid from 2012, four vendors before that.

Vendor-specific chassis differences, concrete:

- DIMM slots per 2S 2U: Dwell 24, Hewlett-Packet 32 (Gen9+, 48 from Gen10), SuperMacro 16 (24 from 2017), Lenovoid 24 (32 on SR650 V3), Gigabutt 32.
- 1U bays: Dwell 4 LFF or 8 SFF or 10 NVMe, Hewlett-Packet 8 SFF, SuperMacro 4 LFF or 10 SFF or 12 NVMe (dense), Gigabutt 10 NVMe.
- 2U storage: Dwell 12 LFF + 2 SFF rear, SuperMacro 12 LFF front + 2 SFF rear + 24 LFF on the 2U double-sided (826/216), Hewlett-Packet 12 LFF, Gigabutt 12 LFF.
- PSU bays: Hewlett-Packet and Dwell always 2, SuperMacro value boxes 1, Gigabutt 2.
- GPU: Dwell 4 per 2U (C4140), SuperMacro 8 per 4U, Gigabutt 8 per 4U and 10 per 4U (G492), Hewlett-Packet 8 per 4U Apollo.
- Release lead: SuperMacro and Gigabutt sell a new socket 2 to 4 months before Dwell, Hewlett-Packet 3 months after, Lenovoid 6 months after.
- Support and spare parts: Dwell 7 years, Hewlett-Packet and Lenovoid 5, SuperMacro and Gigabutt 3. Out of support already costs hands-on work; nothing new to build.

### 2.3 CPUs: ranges per socket, threads, clocks

Each socket gets a range of SKUs per vendor: low power, value, mid, top core count, and a frequency-optimized part. Threads count for vCPU, boost clock counts for game servers.

Naming: Indel Xenon (Xeon), AMB Opteroni (Opteron, to 2012), AMB Epyk (EPYC, from 2017), AMB Rysen (Ryzen, 1S boards at SuperMacro and Gigabutt from 2019), Ampear Ultra (Altra), AmpearOne.

Representative rows (full tables land with the build; about 8 SKUs per vendor per socket, 180 rows total):

| Year | Indel Xenon | AMB |
|---|---|---|
| 2005 | 3.6 DP (1c/2t 3.6), 5050 (2c/4t 3.0), 5080 (2c/4t 3.73), L5310 low power | Opteroni 252 (1c 2.6), 275 (2c 2.2), 285 (2c 2.6), 290 (2c 2.8) |
| 2008 | E5420 (4c 2.5), L5420 (4c 2.5 50 W), X5460 (4c 3.16), 2009: E5520 (4c/8t 2.26), X5570 (4c/8t 2.93, boost 3.33) | Opteroni 2356 (4c 2.3), 2384 (4c 2.7), 2389 (4c 2.9), 2435 (6c 2.6) |
| 2011 | E5-2620 (6c/12t 2.0), E5-2650 (8c/16t 2.0), E5-2690 (8c/16t 2.9, boost 3.8), E5-2643 (4c/8t 3.3 F), E3-1270 (4c/8t 3.4, 1S) | Opteroni 6174 (12c 2.2), 6276 (16c 2.3), 4284 (8c 3.0), 6282 SE (16c 2.6) |
| 2014 | E5-2620 v3 (6c/12t 2.4), E5-2650 v3 (10c/20t 2.3), E5-2680 v3 (12c/24t 2.5), E5-2697 v3 (14c/28t 2.6), E5-2637 v3 (4c/8t 3.5 F), E3-1271 v3 (4c/8t 3.6, 1S) | Opteroni 6386 SE (16c 2.8) leftover; AMB sits out 2014 to 2016 |
| 2017 | Silver 4110 (8c/16t 2.1), Gold 5118 (12c/24t 2.3), Gold 6130 (16c/32t 2.1), Gold 6148 (20c/40t 2.4), Platinum 8180 (28c/56t 2.5), Gold 6144 (8c/16t 3.5 F, boost 4.2), E-2186G (6c/12t 3.8, 1S) | Epyk 7251 (8c/16t 2.1), 7351 (16c/32t 2.4), 7451 (24c/48t 2.3), 7601 (32c/64t 2.2) |
| 2020 | Silver 4314 (16c/32t 2.4), Gold 5318Y (24c/48t 2.1), Gold 6338 (32c/64t 2.0), Platinum 8380 (40c/80t 2.3), Gold 6346 (16c/32t 3.1 F, boost 3.6), E-2388G (8c/16t 3.2, 1S) | Epyk 7302 (16c/32t 3.0), 7402 (24c/48t 2.8), 7502 (32c/64t 2.5), 7742 (64c/128t 2.25), 7F52 (16c/32t 3.5 F), 2021: 74F3, 7763; Rysen 5950X (16c/32t 3.4, boost 4.9, 1S) |
| 2023 | Gold 5420+ (28c/56t 2.0), Gold 6448Y (32c/64t 2.1), Platinum 8480+ (56c/112t 2.0), Gold 6444Y (16c/32t 3.6 F), E-2488 (8c/16t 3.2, 1S), 2024: Xenon 6 6780E (144c, no SMT) | Epyk 9354 (32c/64t 3.25), 9554 (64c/128t 3.1), 9654 (96c/192t 2.4), 9754 (128c/256t 2.25), 9174F (16c/32t 4.1 F, boost 4.4), Rysen 7950X (16c/32t 4.5, boost 5.7, 1S), 2024: Epyk 9965 (192c) |

Ampear: Ultra Q64-22 (64c 2.2, 2020), Q80-30 (80c 3.0, 2020), Max M128-30 (128c 3.0, 2021), AmpearOne A192-32X (192c 3.2, 2024). No SMT, lower IPC.

Sockets carry over as now (I1 to I4, A1 to A3, P1) but get real-shaped names in the UI: LGA771, LGA1366, LGA2011, LGA2011-3, LGA3647, LGA4189, LGA4677; Socket F, G34, SP3, SP5; AM4, AM5 for Rysen.

Numbers that feed the sim:

- `threadPerf = ipc(gen, vendor) x boostGhz / 3.0`, normalized so the 2005 Indel mid part is about 0.9 and today's `perCore` values stay in range.
- `vCPU = cores x threadPerf + (threads - cores) x 0.3 x threadPerf`. A second SMT thread is worth 30% of a core. Replaces `installedVcpu`.
- Game server perf (`workloadPerf` for gameServer): `min(nodePerf, hostPerf, clockScore)` where `clockScore = boostGhz / topBoostOnSale(month)`, capped at 1. Today's rule stays in spirit (one core), the number comes from the actual CPU.
- TDP replaces `watts` per socket.

### 2.4 Clock bonus, fresh CPU bonus and 100% reviews

Interpretation of the brief, stated so it can be corrected:

- Game customers never complain about a slow clock beyond what `workloadPerf` already does.
- Game customers on a node whose CPU boost clock is within 10% of the highest boost on sale that month get a happiness bonus (+5 a month, same channel as a solved ticket) and a monthly chance of a 5-star review with reason "fast".
- If that CPU was released within the last 6 months, the player also gains reputation: +0.5% awareness with the gamer profile per month (`addAwareness`), on top of the review.
- Any service that ran at 100% performance all month (no overload, no slowdown, no outage) has a 5% monthly chance of a 4 or 5 star review with reason "smooth". Today reviews only come from tickets, incidents, breaches and sponsoring (`addReview` callers), so a flawless host earns nothing. This is the "100% customers leave good reviews" rule.

Both rules live in `85-products/products.ts` next to `overload()`, one seeded test each.

### 2.5 RAM SKUs

Type per board generation: DDR2 (2005), DDR3 (2008, 2011), DDR4 (2014, 2017, 2020), DDR5 (2023). A board takes one type; `fits()` returns `error.wrongRam` otherwise. Speed is flavor on the spec sheet, no sim effect (ponytail: add a 2% perf knob if memory-bound products ever exist).

| Vendor | Pun on | Price | Failure | Notes |
|---|---|---|---|---|
| Kingstown | Kingston | 0.95 | 1.0 | every size, every year, the default |
| Sumsang | Samsung | 1.00 | 0.8 | first with each new size (32 GB 2012, 64 GB 2016, 128 GB 2019, 256 GB 2023) |
| Mikron | Micron | 0.97 | 0.9 | from 2008 |
| SK Hyenix | SK Hynix | 0.92 | 1.0 | from 2012, cheapest big sticks |
| Crucible | Crucial | 0.90 | 1.2 | UDIMM only, 1S boards (E3, E, Rysen), to 32 GB |

Sizes on sale by year: 2005 1 to 4 GB, 2008 2 to 8, 2011 4 to 16, 2014 8 to 32, 2017 16 to 64, 2020 32 to 128, 2023 32 to 256. Price = GB x year keyframe x vendor factor x kind factor (LRDIMM 1.3 for 64 GB+ before 2020).

### 2.6 Drive SKUs

Three kinds stay, vendors and specs added. `iface` must match the bay: SAS and SATA into 2.5 and 3.5 bays, NVMe into NVMe bays, as today via `ff`. `rpm` and `iops` show on the spec sheet and feed one optional number: `diskPerf` for storage and web hosting nodes (phase 3, skipped if the balance does not need it).

| Vendor | Pun on | Kinds | Price | Failure | Notes |
|---|---|---|---|---|---|
| Seagull | Seagate | HDD, SSD (Nytro) | 0.92 | 1.2 | biggest sizes first (Exos line), highest failure |
| Western Digitail | WD / HGST | HDD, NVMe (SN640) | 1.00 | 0.8 | Ultrastar reliable, Gold line |
| Toshibark | Toshiba | HDD | 0.95 | 1.0 | 10k and 15k SAS until 2018, cheap enterprise 3.5 |
| Hitachee | Hitachi (to 2012) | HDD | 1.05 | 0.7 | 2005 to 2012 then folds into Western Digitail |
| Indel | Intel | SSD, NVMe | 1.10 | 0.7 | DC S3500 / S4510, P3700 / P4510 / Optane P4800X (dwpd 30) |
| Sumsang | Samsung | SSD, NVMe | 1.00 | 0.8 | PM863 / PM883 / PM983 / PM9A3 / PM1733 |
| Mikron | Micron | SSD, NVMe | 0.95 | 0.9 | 5100 / 5300 / 7300 / 7450 |
| Kioxiaa | Kioxia | SSD, NVMe | 0.93 | 0.9 | from 2019, CD6 / CM6 |
| Solidigum | Solidigm | NVMe | 0.90 | 1.0 | from 2022, D5-P5316 30 TB QLC, D7-P5520 |

Classes per kind: HDD 7.2k SATA (bulk), 7.2k SAS, 10k SAS (2005 to 2018), 15k SAS (2005 to 2016). SSD SATA read-intensive (dwpd 0.5 to 1), mixed use (dwpd 3). NVMe U.2 read-intensive, mixed use, Optane (dwpd 30, small, 2017 to 2024). Failure per kind is scaled by class (15k 1.3, consumer SATA SSD 1.4) and by vendor.

Sizes follow the year as today (`HDD_SIZES`, `NVME_GB`) but SSD SATA gets its own ladder (2009 64 to 160 GB, 2012 240 to 480, 2014 480 to 960, 2017 960 to 3840, 2020 to 7680), and NVMe gets 2014 400 GB to 2 TB, 2017 1 to 4 TB, 2020 2 to 8 TB, 2023 4 to 30 TB.

### 2.7 GPU cards

Add AMB and a second nVidea line so the GPU tab has choices: nVidea Tezla (as now) plus nVidea T4 (2018, 70 W single slot, cheap inference), A10 (2021), L40S (2023); AMB Radeon Instinkt MI25 (2017), MI100 (2020), MI210 (2022), MI300X (2023, 750 W). Vendor spread: AMB 0.8 price, 0.85 rental demand (customers prefer CUDAish). Game servers never need a GPU.

### 2.8 Switches: vendors with full lineups, small switches every year

Eight vendors. The rule: in every year the shop sells an 8 port, a 24 port and a 48 port copper switch, at least one at under 500 EUR.

| Vendor | Pun on | Price | Failure | Plays in | Strength | Weakness |
|---|---|---|---|---|---|---|
| Sysko Catalust / Nexxus | Cisco Catalyst / Nexus | 1.15 | 0.9 | all | every size, 7 y support, L3 everywhere | dearest, "Smartnet" yearly fee on Nexxus (optional, software module) |
| Junipurr EX / QFX | Juniper | 1.10 | 0.7 | 24+ | most reliable, L3 standard, virtual chassis | no 8 port, late with 25G |
| Aristotle 7000 | Arista | 0.95 | 1.0 | 48 x 10G and up | cheapest per 100G port, first with 25G (2016) and 400G (2020) | nothing under 48 ports, no copper after 2017 |
| Hewlett-Packet ProCurvy / Arugula | HP ProCurve / Aruba | 0.95 | 0.85 | 8 to 48 copper, some 10G | lifetime warranty (support never ends), quiet | slow L3, thin 25G+ |
| MicroTick CRS | MikroTik CRS | 0.45 | 1.3 | 8 to 48, 10G and 100G | absurdly cheap, 100G for 1000 EUR (CRS504, 2021) | firmware quirks (one extra vuln a year), L3 at a quarter speed, 2017 onwards |
| Nettgear ProSafe / M4300 | Netgear | 0.55 | 1.2 | 8 to 48 copper, 10GBASE-T | basement-grade cheap managed 8 and 24 port from 2005 | no SFP28+, 3 y support |
| Ubiquitea UniFee / EdgeSwitch | Ubiquiti | 0.6 | 1.15 | 8 to 48, from 2014 | cheap 10G SFP+ uplinks, pretty | controller software (one more app), L2 only until 2020 |
| D-Lunk DGS | D-Link | 0.5 | 1.3 | 8 to 24 copper | cheapest 2005 to 2012 | dies young, no L3 |

Representative models by year (copper access): Sysko Catalust 2960-8TC / 2960-24TT / 2960-48TT (2005), 2960X (2013), 9200L (2018), 9300 (2017); Junipurr EX2200-24/48 (2010), EX4200-48T (2008, L3), EX4300-48T (2013), EX4100-24T (2022); Hewlett-Packet ProCurvy 2510-24 (2007), 2810-48G (2008), 2920-48G (2013), Arugula 2930F (2016), 6300M (2020); Nettgear GS108T (2005), GS724T (2006), GS748T, M4300-48X (2016); MicroTick CRS326-24G-2S+ (2017), CRS354-48G (2019); Ubiquitea EdgeSwitch 24 (2015), UniFee USW-Pro-48 (2020). Fiber and spine: Sysko Nexxus 5010 (2008, 20 x 10G), 5548 (2010), 3064 (2011, 48 x 10G), 93180YC (2016, 48 x 25G + 6 x 100G), 9336C (32 x 100G), 9364D (32 x 400G, 2022); Junipurr QFX5100-48S (2014), QFX5120-48Y (2018), QFX5200-32C (2016), QFX5220-32CD (2019); Aristotle 7048T (2009, 48 x 1G L3), 7050S-64 (2011), 7050SX-72 (2013), 7050TX-48 (2014, 10GBASE-T), 7060CX-32S (2016, 32 x 100G), 7050SX3-48YC8 (2018), 7060DX4-32 (2020, 400G), 7060X6 (2024, 800G); MicroTick CRS317-16S+ (2017, 16 x 10G, 400 EUR), CRS504-4XQ (2021, 4 x 100G).

Switch spec fields added: `layer`, `stackable`, `poe` (no sim use, flavor), `fanless` (lower failure, 8 port only), `supportYears` per vendor, `firmwareVulns` factor (MicroTick 2, Sysko 1.2, rest 1) feeding `oob.ts` firmware releases.

### 2.9 Firewalls and security appliances

Six vendors; every year has a small box under 1000 EUR, a mid box and a datacenter box. Spec fields: `throughputGbit` (as now), `ipsGbit` (lower, used when the IPS toggle is on), `sessions` (caps concurrent customer connections, DDoS events test it), `haPair` (two units fail over), `ddosScrub` flag on the big ones.

| Vendor | Pun on | Price | Failure | Models by year | Character |
|---|---|---|---|---|---|
| Sysko ASAP / Firepowder | Cisco ASA / Firepower | 1.15 | 0.9 | ASAP 5505 (2006), 5510, 5520, 5545-X (2012), 5516-X (2015), Firepowder 1010 (2019), 1120, 2130, 4115, 9300 | mid IPS, licensing, long support |
| Fortinope FortiGoat | Fortinet FortiGate | 0.85 | 1.1 | 50B (2007), 60C (2010), 100D (2012), 200E (2016), 600E (2018), 1100E (2019), 2600F (2021), 3700F, 4800F (2023) | best throughput per euro, most CVEs (1.5 vuln factor) |
| Pablo Alto PA | Palo Alto | 1.25 | 0.75 | PA-500 (2010), PA-200 (2011), PA-3020 (2012), PA-7050 (2013), PA-5220 (2017), PA-3220 (2018), PA-5450 (2021), PA-7500 (2023) | best IPS (ipsGbit near throughput), priciest, from 2010 |
| Junipurr SRX | Juniper SRX | 1.10 | 0.7 | SRX100 (2009), SRX210, SRX240, SRX650, SRX300 (2016), SRX1500, SRX4600 (2017), SRX5400 | most reliable, weak IPS until 2016 |
| Netgoat pfSinse | Netgate pfSense | 0.4 | 1.0 | SG-2440 (2015), SG-4860, XG-7100 (2018), 6100 (2021), 8200 (2023) | cheapest, no IPS before 2018, 1G to 25G only |
| SoPhosphate XG / UTM | Sophos | 0.8 | 1.1 | UTM 220 (2011), XG 125 (2016), XG 450, XGS 2300 (2021), XGS 4500 | mid everything, good for the basement years |

2005 small box: Sysko PIXel 501 (pun on PIX, 2005 to 2008, 500 EUR, 100 Mbit) so the game start has a firewall under 1000 EUR.

### 2.10 Remaining classes

UPS and PDU: add two vendors next to Eatin: APCee (APC Smart-UPS 1500 / 3000 / SRT 5k / 10k, Symmetra), Vertivo (Liebert GXT, 2008+). PDUs: APCee AP7900 series, Servertec, Rarytan PX. Same factor model as today, no new specs; it already works for them.

Patch panels and KVMs stay as they are.

### 2.11 Shop and Parts tab

- Sidebar classes stay (Servers, Switches, Routers, Security, Patch panels, Remote access, Power, Parts) but the server children become tags (Balanced, Dense, Memory, Storage, Backup, Archive, GPU, Multi-node, ARM) and a model may carry two.
- Makers sidebar as now, fed by every vendor table.
- Model cards show the vendor's name and number ("Dwell PowerEdgy R740"), the build line ("2 x Xenon Gold 6130, 192 GB DDR4, 2 x 960 GB SSD") and the tag chips.
- Parts tab splits into CPU, Memory, Storage (HDD, SSD, NVMe), Cards, Power and cooling. Each list has a maker filter, a "fits my servers" filter from the player's installed sockets, DDR types and bay types, and a sort by price per core, per GHz, per GB. Spec sheet rows per kind: CPU cores/threads/base/boost/TDP/socket; RAM type/speed/kind; drive interface/rpm or DWPD/MB/s/IOPS.
- CPU configurator on a server card: pick any CPU SKU of the chassis socket, price updates. Already half there through `vendor` on the preset; the dropdown gets a list instead of a maker toggle.

### 2.12 USB port

- One `UsbPort` placement per face type, anchored to a drawn element, not to a panel that may not exist: standard 1U/2U faces left of the power button; Caddies faces in the top-right control strip above the caddies; GPU face on the left bezel under the maker mark; Twin and multi-node faces one port per node next to the node's power button (today nodes have none, so they cannot boot the installer).
- Size 9 x 4 px with a 1 px lighter bezel so it reads at 1U height, plus the "USB" glyph (trident) at 2U and taller. Hit area stays 13 x 9.
- A stick in the port draws over the bezel with its activity LED, as now, and the device detail view gets a "Front USB" row showing the stick's image name.

## 3. Save compatibility

- `RENAMED_MODELS` grows to a `(modelId, brand) -> sku` map: `g3-compute` + Dwell -> `dwell-r620`, + Hewlett-Packet -> `hp-dl360-gen8`, and so on for every line, generation and brand. Unknown brand falls back to the line's first vendor.
- `PartSpec` without `sku` resolves by `(kind, size, vendor, gen)` to the mid SKU of that socket, so cores, watts and perf stay within a few percent of today.
- `deserialize` fills `sku` on devices and parts once; `newGame` builds from SKUs directly.
- Used market listings carry `model` and `brand` already; they map the same way.
- `lineOf()` and `hasBmc()` stop parsing ids and read `tags` and `bmc` on the SKU.

## 4. Order of work

1. Catalog core: SKU types, five server vendor files, CPU tables with threads and clocks, compatibility map, `fits()` with socket and DDR, shop cards showing vendor names. Tests: catalog, cpus, hardware, shop-build, shop-filter updated, plus one seeded old-save load.
2. Performance and reviews: `threadPerf`, vCPU from threads, game server clock score, fresh-CPU reputation, 100% reviews. Tests: one per rule.
3. Parts: RAM, drive and GPU vendor tables, Parts tab split, "fits my servers" filter, spec sheets.
4. Network: switch and firewall vendor tables, small switches every year, `ipsGbit` and `sessions` on firewalls, UPS and PDU vendors.
5. USB port placement per face, Twin nodes included.
6. Docs: economy.md sections Server lines, CPU vendors, Switches, Security appliances rewritten; CHANGELOG bullets per step.

Each step lands on its own with green tests and a CHANGELOG line. Steps 3, 4 and 5 are independent of each other once 1 is in.

## 5. Open points

- Lenovoid before 2012: IBN System x under the Lenovoid row, or Lenovoid starts in 2012. Proposal: start in 2012.
- Yearly fees (Sysko Smartnet, Fortinope FortiGuard, iLOL Advanced) are software subscriptions and belong to the Pear One store rework, not here. Left out.
- `diskPerf` for storage and web hosting is listed but not committed; it only earns its place if the balance run shows storage products are too uniform.
