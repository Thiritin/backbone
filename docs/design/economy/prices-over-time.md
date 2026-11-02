# Prices over time

Every price in the GDD's Prices section is a 2026 value. Earlier years scale it by a 2005 multiplier, spread evenly over the 21 years between them:

```math
p(y) = p_{2026} \cdot m^{(2026 - y)/21}
```

Here m is the multiplier in 2005. After 2026 prices stay flat.

| Category | 2005 multiplier m | Example |
| --- | --- | --- |
| IP transit, per Mbit/s | 108 | 1 Gbit/s commit: €190 per month in 2026, about €20 per Mbit/s in 2005 |
| Internet exchange ports | 5 | AMS-IX 10G: €650 per month in 2026 |
| Customer base rate per GB of RAM | 20 | Game servers: about €1.50 per GB in 2026, €30 per GB in 2005; VPS and cloud servers follow the VPS rate keyframes (Per-resource pricing) |
| Customer base rate per TB of storage | 32 | Object storage: €6.50 per TB in 2026, €210 in 2005 |
| Customer base rate per TB of traffic | 46 | Overage and traffic-heavy services |
| Fixed-price products | Keyframes | Web hosting, domains and dedicated servers follow the fixed-price keyframes below; the sizes get bigger |
| Rented space, rack or cage | 1 | Power is billed separately |
| Server purchase price | Parts | Resources per server come from the generations table below; the price in later years follows the parts (Part prices by year) |
| Salaries | 0.6 | Support agent, junior: €38,700 in 2026, about €23,000 in 2005 |
| Search ads, per click | 0.6 | |
| SSL certificates | Keyframes | DV, OV and EV follow the SSL keyframes below; from 2016 a free certificate exists (the Let's Encrypt stand-in) |

**Electricity.** Business prices follow these keyframes, with straight lines between them. The basement pays the household price, which is the business price × 1.6.

| Year | | 2010 | 2014 | 2020 | 2022 | 2023 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business price (ct/kWh) | | 12 | 15 | 18 | 35 | 25 | 17 |

**Fixed-price lines.** Web hosting, domains and dedicated servers multiply their 2005 rates (Per-resource pricing) by a factor that follows these keyframes, with straight lines between them and the last value after it. The sizes keep growing, so a gigabyte of web space gets much cheaper while the entry price only falls a little. German list prices are the reference: an entry web space cost about €5 a month in 2005 and €3 to €4 in the early 2020s, until energy costs pushed the large hosts to raise prices in 2023. A .de or .com domain has cost €12 to €15 a year at German hosts for the whole period, and a small dedicated server fell from about €79 to about €40 a month before rising again from 2022.

| Line | 2005 | 2010 | 2012 | 2015 | 2021 | 2022 | 2023 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Web hosting | 1 | 0.95 | | 0.85 | | 0.8 | 0.88 | 0.88 |
| Domains | 1 | | 0.93 | | 0.93 | | | 1 |
| Dedicated servers | 1 | | 0.8 | | 0.65 | | 0.75 | 0.8 |

The yearly domain price the customer pays for a registration or renewal is the domain line's market rate of the year: €15 in 2005, €13.95 from 2012 to 2021 and €15 again in 2026. Values live in `FIXED_KEYS` in `src/sim/10-catalog/products.ts`.

**SSL certificates.** The SSL line has three sizes: a DV, an OV and an EV certificate. Their yearly market prices follow these keyframes; the OV and EV rates are the difference to the DV price, so the player sets a base fee and an OV and EV validation on top. Values live in `SSL_KEYS` in `src/sim/10-catalog/products.ts`.

| Certificate | 2005 | 2010 | 2015 | 2020 | 2026 |
| --- | --- | --- | --- | --- | --- |
| DV | €50 | €40 | €30 | €20 | €15 |
| OV | €150 | | €120 | | €100 |
| EV | €400 | | €300 | €250 | €200 |

**Licence price rises.** On 1 January of each year below a vendor's list prices for new keys, renewals and editions become this multiple of its licence era's fees. cPanic follows cPanel's yearly rises after its 2019 switch to per-account pricing, Pleskit follows Plesk's rises, and Windoors Server follows the dearer core licences of Windows Server 2025. The jumps between licence models stay in the licence eras (Platforms and licenses): cPanic in June 2019, DirectAdmen in September 2019, Windoors in October 2016 and VMwhere's switch to per-core subscriptions in December 2023. Values live in `LICENCE_RISES` in `src/sim/10-catalog/licence-tiers.ts`.

| Software | 2021 | 2022 | 2023 | 2024 | 2025 |
| --- | --- | --- | --- | --- | --- |
| cPanic | ×1.10 | ×1.21 | ×1.33 | ×1.46 | ×1.61 |
| Pleskit | ×1.10 | | ×1.20 | | ×1.30 |
| Windoors Server | | | | | ×1.10 |

**Price announcements.** Every price change the player pays for, or that moves the market, is announced in the News app before it takes effect, at nine in the morning on the 1st of the month:

| Change | Announced | News key |
| --- | --- | --- |
| A licence era after the first (software, operating systems, shop systems) | 3 months before | `event.news.licenceModel` |
| A licence price rise | 3 months before, on 1 October | `event.news.licenceRise` |
| A registry price step | 6 months before | `event.news.registryPrice` |
| A fixed-price line rising 5% or more from one year to the next | 1 October before | `event.news.marketPrice` |

Competitors price at the market times their price factor (Customer choice), so a market rise raises every rival's price on the same day; the 2023 web hosting rise of 10% and the dedicated server rises of 2022 and 2023 are announced this way.

**Server generations.** A new 1U compute server generation arrives every three years. Each one costs a bit more but packs far more resources per watt, which is what makes replacing old servers pay off.

| Generation | Year | Cores | RAM | Storage | Power | Price |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | 2005 | 2 | 8 GB | 500 GB HDD | 250 W | €2,500 |
| G2 | 2008 | 8 | 24 GB | 1 TB HDD | 300 W | €3,000 |
| G3 | 2011 | 12 | 64 GB | 2 TB HDD | 300 W | €3,500 |
| G4 | 2014 | 24 | 128 GB | 2 TB SSD | 300 W | €4,000 |
| G5 | 2017 | 40 | 256 GB | 4 TB SSD | 350 W | €4,500 |
| G6 | 2020 | 64 | 512 GB | 8 TB NVMe | 400 W | €5,000 |
| G7 | 2023 | 128 | 1 TB | 15 TB NVMe | 450 W | €5,500 |

**Server lines.** Every generation has one pre-built model per line, and each line scales its generation's row. Specs are fixed at purchase, with one exception: a balanced 1U with one power supply can fill its empty second bay later for the price difference to the two-supply build of its brand (€250 for a Dwell G1), which turns it into that build. The balanced 1U with two power supplies costs 10% more than the one with one and draws 5% more power.

| Line | Height | Sockets | Cores | RAM | Drives | Network ports | Power supplies | Full power | Price | Sold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Balanced 1U | 1U | 2 | 1× | 1× | 1 of the generation's disk in 4 bays | 2 | 1, or 2 | 1×, or 1.05× | 1×, or 1.1× | Always |
| Compute-dense 1U | 1U | 2 | 2× | 1× | 1 of the generation's disk in 4 bays | 2 | 1 | 1.5× | 1.6× | Always |
| Memory-optimized 2U | 2U | 2 | 1× | 4× | 1 of the generation's disk in 4 bays | 4 | 2 | 1.6× | 1.8× | Always |
| Storage 2U | 2U | 2 | 1× | 1× | 12 of the generation's disk | 2 | 2 | 1.7× | 2× | Always |
| Backup storage 4U | 4U | 1 | 0.5× | 0.5× | 36 large HDDs | 2 | 2 | 2× | 2.4× | Always |
| Archive storage 4U | 4U | 1 | 0.25× | 0.25× | 60 densest HDDs | 2 | 2 | 2.2× | 3.2× | Always |
| GPU 4U | 4U | 2 | 1× | 2× | 1 of the generation's disk in 4 bays, 4 GPU cards | 2 | 2 | 2× plus the cards | 3× plus the cards | From 2011 |
| ARM 1U | 1U | 1 | 1.5× | 1× | 1 of the generation's disk in 4 bays | 2 | 1 | 0.6× | 0.9× | From 2020 |
| Value 1U | 1U | 1 | 0.5× | 0.5× | 1 small disk in 2 bays (4 from 2011) | 2 | 1 | 0.55× | 0.5× | Always |
| Clock 1U | 1U | 1 | the socket's fastest CPU | 0.5× | 1 small disk in 2 bays (4 from 2011) | 2 | 1 | 0.6× | 0.6× | Always |
| Large-memory 2U | 2U | 2 | 1× | 8× | 1 of the generation's disk in 8 bays | 4 | 2 | 1.9× | 2.8× | Always |
| Four-socket 2U | 2U | 4 | 2× | 8× | 2 of the generation's disk in 8 bays | 4 | 2 | 1.95× | 4× | Always |
| Storage 2U, 24 bays | 2U | 2 | 1× | 1× | 8, 12, then 24 small drives in 24 bays (NVMe from 2017) | 2 | 2 | 1.8× | 2.2× | Always |
| GPU 4U, 8 cards | 4U | 2 | 1× | 4× | 2 of the generation's disk in 8 bays, 8 GPU cards | 4 | 2 | 2.5× plus the cards | 4× plus the cards | From 2017 |
| Twin 2U, per node | 2U for four nodes | 2 | 1× | 1× | 1 of the generation's disk in 3 bays (6 from 2014) | 2 | 2 shared by the chassis | 0.8× | 0.6× | From 2008 |

**Twin 2U.** One purchase is a 2U chassis with two shared power supplies and the fan wall, and four nodes with their own CPUs, RAM, drives and network card. Each node costs 0.6 times and draws 0.8 times a balanced 1U of its generation, so four servers take 2U at 2.4 times the price of one 1U. SuperMacro and Dwell sell it at their price factors; the chassis carries the price and sells with its nodes. A G2 Twin from SuperMacro costs €6,004 in 2010 (€1,501 a node), and from 2010 the used market lists Twin lots at the usual discount, €450 to €900 a node. Rented as the smaller dedicated server at about €79 a month, a used node pays for itself in 6 to 11 months and a new one in about 19; the same node as a VPS host earns more a month and brings more tickets, so dedicated stays the lower-touch path at a lower margin. Dedicated prices stay as they are. A node at full load draws 240 W, about €23 a month metered at Hetzler in 2010. Anchors: Supermicro's Twin (2007) and 2U Twin (2008) with four dual-socket nodes, Dell PowerEdge C6100 (2010), four nodes sharing two 1100 W supplies.

Backup and archive servers use HDDs whatever the generation's disk type. Archive storage is the cheapest per TB, then backup, then the storage 2U.

| Generation | G1 | G2 | G3 | G4 | G5 | G6 | G7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Large HDD (backup) | 500 GB | 1 TB | 3 TB | 6 TB | 10 TB | 16 TB | 22 TB |
| Densest HDD (archive) | 750 GB | 2 TB | 4 TB | 8 TB | 14 TB | 20 TB | 28 TB |

- **Power draw.** A server draws 40% of its full power when idle, rising in a straight line with CPU load. A server with no running workload draws its idle power; one with a running workload draws from idle to full power by its CPU utilisation (the vCPUs its OS, control plane and workloads use over its cores, at most 1), in the power bill, the rack's fuse limit and the IPMI power reading. A server under burn-in draws full power.
- **Port speed.** Server ports run at 1G until 2011, then 10G, 25G from 2017 and 100G from 2023.
- **Ports.** 1G ports are copper (RJ45); 10G and faster ports are SFP cages.
- **Shop window.** A generation stays in the shop until the generation two steps newer arrives, so G1 is sold until the end of 2010 and G2 until the end of 2013. G6 and G7 stay in the shop.

**Part prices by year.** A part costs its size times the year's price per unit, with straight lines between the keyframe years and flat prices after the last one (2028). The prices are enterprise prices (registered RAM about 1.6 times consumer RAM, enterprise SSDs about 1.5 times, enterprise HDDs about 1.6 times). SSDs are sold from 2009 and NVMe drives from 2014.

**Memory and drive parts.** Sticks and drives come from makers (`families.ts`), parodies of the real ones: Kingstown, Sumsang, Mikron, SK Hyenix and Crucible for memory; Seagull, Western Digitail, Toshibark and Hitachee for HDDs; Indel, Sumsang, Mikron, Kioxiaa, Seagull and Solidigum for flash. A family is one maker's line of one kind with the sizes it sells per year window: a memory family names its DDR type (DDR2 in 2005, DDR3 from 2008, DDR4 from 2014, DDR5 from 2023), speed and stick kind (RDIMM, LRDIMM for 64 GB and up before 2020, Crucible's UDIMMs for small boards); a drive family its interface (SATA, SAS, NVMe), spindle speed (7.2k bulk, 10k and 15k SAS until 2018) or endurance in drive writes per day (Indel's Optane at 30), throughput and IOPS for the spec sheet. A part's price is the year's price per GB times its maker's factor (Hitachee 1.05, Indel 1.1, Crucible 0.9, Solidigum 0.9) times its class factor (10k SAS 1.5, 15k 2, Optane 4, QLC 0.7); its yearly failure rate is the kind's times its maker's factor (Hitachee and Indel 0.7, Western Digitail and Sumsang 0.8, Seagull and Crucible 1.2). A board takes sticks of its generation's DDR type only (`error.wrongRam`); a stick or drive from before parts had makers fits any board and counts as its kind's first family of the year. A preset ships the first family of its year that sells its size. The Parts tab sells every size of every family on sale, filed under CPUs, Memory, Drives, Cards, Boards and Power and cooling, each under its maker.

| Year | RAM, € per GB | SSD, € per GB | NVMe, € per GB | HDD, € per TB | CPU, € per core |
| --- | --- | --- | --- | --- | --- |
| 2005 | 200 | not sold | not sold | 500 | 200 |
| 2008 | 40 | 12 (sold from 2009) | not sold | 200 | 120 |
| 2010 | 45 | 3.0 | not sold | 100 | 90 |
| 2011 | 28 | 2.25 | not sold | 80 | 80 |
| 2012 | 11 | 1.5 | not sold | 120 (flood spike) | 70 |
| 2013 | 8 | 1.0 | not sold | 50 | 65 |
| 2014 | 14 | 0.70 | 1.2 | 42 | 60 |
| 2016 | 8 | 0.40 | 0.65 | 40 | 50 |
| 2018 | 13 (DRAM spike) | 0.35 | 0.50 | 35 | 45 |
| 2020 | 5 | 0.14 | 0.18 | 25 | 35 |
| 2023 | 3.5 | 0.07 | 0.09 | 18 | 30 |
| 2025 | 7 | 0.12 | 0.14 | 16 | 28 |
| 2026 | 22 (AI spike) | 0.30 | 0.33 | 15 | 28 |
| 2027 | 30 | 0.35 | 0.38 | 15 | 28 |
| 2028 | 15 | 0.20 | 0.22 | 14 | 27 |

Anchors: John C. McCallum's memory price history (DRAM about US$100 to 150 per GB in 2005 for consumer DDR2, about $4 to 5 in 2013 and 2016, the 2017 to 2018 shortage that roughly doubled module prices, about $3 in 2020, the 2023 trough); the 2025 to 2026 AI-driven shortage (DDR5 about $17 per GB in October 2026 after a rise of 200% to 400%, TrendForce; Bernstein expects a further rise in 2027 and a fall in 2028); Backblaze's drive cost per GB ($0.11 in 2009, 0.033 in 2017, 0.0144 in 2022), and its report that the October 2011 Thailand flood roughly doubled drive prices for months and kept them about 1.5 times higher through 2012; SSD retail (about $3 per GB in 2010, 0.30 in 2016, 0.11 in 2020, 0.06 at the mid-2023 bottom, 0.09 in 2024, doubled by late 2025). The CPU column is the least anchored.

Fixed parts: a power supply costs €150 in 2005, falling in a straight line to €90 in 2015 and flat after; a fan €25; a mainboard €600 falling to €400 by 2015; a network card €80 falling to €40 by 2015, times 4 for 10G and faster cards until 2017 and times 2 from 2017.

**CPU vendors.** Every CPU and mainboard comes from one of three makers (`CPU_MODELS` in `cpus.ts`): Indel and AMB build x86 parts from 2005, Ampear builds ARM parts from 2020. A row gives a full socket's cores (the compute-dense line's socket; the generation table's cores are the Indel row), the speed of one core (`perCore`), the watts of a full socket and the price factor on the per-core CPU price. A line's socket is its share of a full socket: the balanced 1U takes half, the backup line half, the archive line a quarter, the ARM 1U one and a half. A server's vCPU is its working cores times `perCore`; a game server on a node below 1 runs at that speed, so it is slowed by the gap.

| Generation | Year | Indel cores, speed, W | AMB cores, speed, W, price | Ampear cores, speed, W, price |
| --- | --- | --- | --- | --- |
| G1 | 2005 | 2, 0.9, 110 W | 2, 1.0, 95 W, 1 | |
| G2 | 2008 | 8, 1.15, 130 W | 8, 0.95, 145 W, 0.8 | |
| G3 | 2011 | 12, 1.15, 130 W | 12, 0.95, 145 W, 0.8 | |
| G4 | 2014 | 24, 1.15, 165 W | 24, 0.95, 180 W, 0.8 | |
| G5 | 2017 | 40, 1.05, 205 W | 64, 0.95, 180 W, 0.5 | |
| G6 | 2020 | 64, 1.05, 270 W | 102, 0.95, 225 W, 0.5 | 64, 0.8, 135 W, 0.7 |
| G7 | 2023 | 128, 1.05, 320 W | 205, 0.95, 360 W, 0.5 | 128, 0.8, 160 W, 0.7 |

**Clocks, sockets and makers.** Every row also has a clock in GHz and a socket. Indel clocks 3.0, 2.8, 2.9, 2.6, 2.5, 2.4 and 2.3 GHz from G1 to G7 (cores replace clock), AMB 2.4, 2.2, 2.4, 2.3, 2.2, 2.45 and 2.5 GHz, Ampear 2.8 GHz in G6 and 3.0 in G7. A board has its maker's socket of its chassis's generation and takes a CPU of that socket and maker only: Indel I1 (G1, G2), I2 (G3, G4), I3 (G5, G6), I4 (G7); AMB A1 (G1 to G3), A2 (G4, G5), A3 (G6, G7); Ampear P1 (G6, G7). A newer CPU of the same socket runs in an older board. A server line is sold with some makers only: the balanced 1U, storage 2U and twin lines with Indel or AMB, the 2 PSU, memory and GPU lines with Indel, the compute-dense, backup and archive lines with AMB, the ARM line with Ampear. A line's default CPU is its first maker's, so the compute-dense preset from G5 has 1.6 times the cores of the generation table. The Parts tab still sells every maker's CPUs.

**Storage lines.** The storage, backup and archive lines differ in drive count and size, not only in bays. Storage 2U is online storage: few, small drives with a full balanced CPU (G1: 4 × 160 GB, 8 bays; 12 bays and 12 drives from G2). Backup 4U is bulk storage with a half CPU and room to grow, shipping part of its bays (G1: 6 × 160 GB, about 1 TB, in 12 bays; 36 bays full from G4). Archive 4U is the densest and cheapest per TB with a quarter CPU (G1: 12 × 500 GB in 24 bays; 60 full from G4). The Value 1U ships one small drive (160 GB, then 500 GB, 1 TB). Spare drives of the early sizes (80, 160, 500 GB) are in the Parts tab.

**Who sells what.** Every manufacturer has a lineup (`LINEUP` in `hardware.ts`): for each line and generation it builds, its own model name in its own numbering, as Dwell PowerEdgy 1850, R610, R620 up to R660 for the Balanced 1U, Hewlett-Packet ProLight DL360 G5 to Gen11, SuperMacro SuperSaver 6015P-TR to SYS-121C-TN10R, Lenovoid System x3550 M4 and ThinkSystem SR630 to SR630 V3, Gigabutt R180-F28 to R183-Z90. The shop card, the rack and the used market show that name; the catalog name ("Balanced 1U G3") is the class label. A line is on sale in a generation while some maker has a name for it. Dwell builds every line but the compute-dense, large-memory, clock and ARM ones, and the only 2 PSU balanced build; Hewlett-Packet the balanced, clock, memory, large-memory, four-socket and storage lines, Twin and 8-card GPU boxes from 2014 and 2017, the ARM 1U from 2020; SuperMacro everything but the large-memory line and the archive 4U before 2011, and the only compute-dense 1U; Lenovoid starts with the 2011 generation and builds the balanced, value, memory, large-memory and four-socket lines, GPU and Twin boxes from 2017; Gigabutt starts with the 2014 generation with balanced, clock and memory boxes, then compute-dense, storage, GPU, 8-card GPU and Twin boxes, and the ARM 1U from 2020. Release shifts, end of sale, failure rates, watts and price factors per maker apply to the lines it sells.

**CPU parts.** Each socket generation of a maker sells a range of CPU parts (`CPU_SKUS` in `cpus.ts`), parodies of the real lineups: Indel Xenon (Xenon 3.6 and 5050 in 2005, E5420 and X5570, E5-2620 to E5-2690, E5-2620 v3 to E5-2699 v4, Silver 4110 to Platinum 8180, Silver 4314 to Platinum 8380, Silver 4410Y to Platinum 8480+ and the 144-core Xenon 6 6780E from 2024), AMB Opteroni (252 to 290, 2347 to 2435, 4184 to 6282 SE, two leftovers in 2014) and Epyk (7251 to 7601, 7262 to 7763, 9124 to 9965) and Ampear Ultra and AmpearOne (Q32-17 to Max M128-30, A96-28 to A192-32X). A part has cores, threads (SMT on Indel from 2008 and on Epyk, none on Ampear), a base and a boost clock, a TDP and a price factor on the year's per-core price; frequency parts (E5-2643, Gold 6144, Gold 6346, Gold 6444Y, Epyk 7F52, 74F3, 9174F, 9374F) cost most per core. A part's speed per core is its generation row's `perCore` times the square root of its boost over the row's clock. A preset ships the part nearest its share of a full socket, the one priced like the generation row among equals; the Clock 1U ships the fastest part its board takes. The shop sells every part of the sockets on sale in the Parts tab and lets a server be configured with any part of its socket up to the board's top; a configured server costs its chassis plus those parts. A spare asked for by size takes the nearest part. Each socket draws its part's TDP. Two different parts never share a server. A server's vCPU is its working cores plus 0.3 of a core for every second thread (`SMT_SHARE`), times its part's speed per core.

**Mainboards and prices.** A server lists its mainboard by name, maker, socket and top CPU, as in "Indel I3-40, dual socket" (`boardSpec` in `hardware.ts`). A board takes CPUs of its socket up to twice the preset CPU's share of a full socket, at most a full socket, measured against the CPU's own generation. A whole server costs its chassis plus its parts, but never more than 0.9 times its parts bought one by one (`BUNDLE` in `parts.ts`). The shop has no bare chassis; spare HDDs of 80 GB upward are sold in the Parts tab in the years they were common.

Indel's price factor is 1. From G5 an AMB socket has 1.6 times the cores at 0.8 the price of an Indel socket, which is 0.5 per core; an Ampear core draws half the watts of an Indel core of its generation at 0.7 the price. A CPU draws its row's watts times its cores over the full socket's cores. A server's rated watts split into its preset's CPUs and the rest of the chassis: a server draws the rest plus the watts of the CPUs it has, so an Indel preset (Ampear on the ARM line) draws exactly the line's watts, and idle it draws the model's idle share of its CPUs' difference. The x86 watts stay below three quarters of the generation's watts per full socket so the rest of a compute-dense chassis stays above zero. Compatibility mode on a hypervisor cluster masks CPU features so VMs move live between vendors, at 0.9 of every node's vCPU.

Anchors: AMD Opteron 2005 (dual core at 95 W against the 110 W single and dual core Xeons of the Irwindale and Paxville years), Intel Xeon 5500 2009 (Nehalem retakes the lead per core and per watt until Skylake), AMD EPYC 2017 (32 cores per socket against 28 at a lower price; Rome and Genoa keep the core lead), Ampere Altra 2020 (80 Arm cores at about 250 W, Altra Max 128), and VMware EVC and Proxmox CPU types for compatibility mode. The speeds are game values that keep the lead swaps visible rather than benchmark ratios.

**GPU cards and rental.** A GPU card is a PCIe part sold in the Parts tab and fitted in the GPU 4U lines. It is named by its launch year and its id, and the shop sells the newest card and the one before of every line: the Tezla line below, which GPU servers ship with, nVidea's small single-slot cards (T4 2018, A10 2021, L40S 2023) and AMB's Radeon Instinkt line (MI25 2017, MI100 2020, MI210 2022, MI300X 2023, at 0.8 the price per card). A card's price falls to half once its own line's successor is out. The Tezlas are puns on Nvidia's Tesla line:

| Card | Launch | List price | Power | Slots | Anchor |
| --- | --- | --- | --- | --- | --- |
| nVidea Tezla C870 | 2007 | €1,300 | 170 W | 1 | Tesla C870, June 2007, about US$1,500 |
| nVidea Tezla M2050 | 2010 | €2,200 | 225 W | 1 | Tesla M2050, 2010, about US$2,500 |
| nVidea Tezla K80 | 2014 | €4,500 | 300 W | 1 | Tesla K80, 2014, about US$5,000 |
| nVidea Tezla V100 | 2017 | €9,000 | 300 W | 2 | Tesla V100, 2017, about US$10,000 |
| nVidea Tezla A100 | 2020 | €11,000 | 400 W | 2 | A100, 2020, US$10,000 to 15,000 |
| nVidea Tezla H100 | 2023 | €28,000 | 700 W | 2 | H100, 2023, about US$30,000 |
| nVidea Tezla B200 | 2025 | €35,000 | 1,000 W | 2 | B200, 2025, about US$35,000 |

A card falls 10% of its list price every year after its launch, down to half, and sits at half from the day its successor launches. The GPU 4U takes up to four cards of any width. A 2U of G1 to G4 takes one single-width card, because the power supplies of later generations cannot feed it, and a 1U takes none. A card's watts add to the server's draw for the rack's power limit and the electricity bill, and a failed card draws nothing. A GPU 4U ships with four of the newest card at its generation's launch, and its list price includes them at that year's card price; the line's base is 2× the generation's power and 3× its price (the cards come on top). Bare chassis leave the cards out.

GPU rental is priced per card a month by year, straight between these anchors and flat before 2011 and after 2026: €600 in 2011, €450 in 2016, €1,500 in 2017, €1,800 in 2020, €4,000 in 2023 and €2,500 in 2026. Anchors: AWS cg1 at US$2.10 an hour for two M2050 in 2010, p2 with K80 at US$0.90 an hour in 2016, p3 with V100 at US$3.06 in 2017, p4d with A100 at US$4.10 a card-hour in 2020, p5 with H100 at US$12.29 a card-hour in 2023, the June 2025 AWS price cut of up to 45%, and Hetzner's GEX44 at €184 a month in 2024. The market rate has no further multiplier, since the table is already by year.

**Chassis and preset prices.** The chassis price of a model is its list price (generations table times the line's multiplier) minus all its parts at the prices of its generation's launch year, and never less than 25% of the list price. A preset costs its chassis plus its parts at the year's prices, times the brand factor, so a preset costs exactly its list price in its launch year and gets cheaper within a generation as parts fall, then jumps in the spikes. Where the parts at launch cost more than the list price leaves after the 25% floor (most models, because RAM, CPUs and drives priced per unit add up to more than the list price), the preset buys its parts at a share of their price, chosen so the launch price stays the list price; the share is the same in every later year. A bare chassis costs the preset price minus its CPUs, RAM and drives at the year's full part prices, never less than 25% of the preset price, so building a machine from parts costs more than the preset wherever the share applies.

**Resale of parts.** A spare part in storage sells at the current part price times the resale curve of Buying and selling, and counts at that value in net worth. A RAM stick bought in 2023 and sold in 2026 sells for more than it cost.

**Manufacturers.** Within a class, manufacturers differ in price, failure rate, release, end of sale and power draw, never in specs. A unit costs the model's price × the price factor, its failure rate is the base AFR × the failure factor, it reaches the Shop the release shift in months from the model's year, its last year on sale moves by the end of sale shift in years, and it draws the model's watts × the power factor (CPUs and chassis; GPU cards are unchanged). The Shop lists a model while any manufacturer sells it, and a unit can only be bought from the month its manufacturer releases it. Switches, security appliances, patch panels, routers, UPS units and PDUs have no shift and a power factor of 1.00.

| Class | Manufacturer | Price factor | Failure factor | Release shift | End of sale shift | Power factor |
| --- | --- | --- | --- | --- | --- | --- |
| Servers | Dwell | 1.00 | 1.00 | 0 | 0 | 1.00 |
| Servers | Hewlett-Packet | 1.08 | 0.80 | +3 months | -1 year | 0.95 |
| Servers | SuperMacro | 0.90 | 1.30 | -4 months | +1 year | 1.05 |
| Servers | Lenovoid | 0.95 | 1.10 | +6 months | 0 | 1.00 |
| Servers | Gigabutt | 0.90 | 1.25 | -1 month | 0 | 1.04 |
| Switches | Sysko | 1.00 | 1.00 | 0 | 0 | 1.00 |
| Switches | Junipurr | 1.10 | 0.70 | 0 | 0 | 1.00 |
| Switches | Aristotle | 0.93 | 1.20 | 0 | 0 | 1.00 |
| Security appliances | Sysko | 1.00 | 1.00 | 0 | 0 | 1.00 |
| Security appliances | Fortinope | 0.90 | 1.25 | 0 | 0 | 1.00 |
| Security appliances | Pablo Alto | 1.10 | 0.75 | 0 | 0 | 1.00 |
| Patch panels | Pandoot | 1.00 | 1.00 | 0 | 0 | 1.00 |
| Routers | AVN | 1.00 | 0.90 | 0 | 0 | 1.00 |
| Routers | MicroTick | 1.00 | 1.20 | 0 | 0 | 1.00 |
| UPS units and PDUs | Eatin | 1.00 | 1.00 | 0 | 0 | 1.00 |

A router is built by one manufacturer only (Sysko, AVN, MicroTick or Junipurr, by model) and sells at its list price. Junipurr's switch price factor does not apply to its routers.

**Routers.** A router's ports cap how many uplink links a location can have and how fast they run, and its throughput caps what passes through it. The routers below are the Sysko edge routers, which mount in a rack; the other routers are in Routers, UPS and PDUs.

| Router | Height | Ports | Throughput | Full table | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Edge S | 1U | 4 × 1G | 4 Gbit/s | No | 2005 | €3,000 | 100 W |
| Edge M | 1U | 8 × 10G and 4 × 1G | 40 Gbit/s | Yes | 2008 | €12,000 | 200 W |
| Edge L | 2U | 32 × 100G | 400 Gbit/s | Yes | 2014 | €40,000 | 600 W |
| Edge XL | 2U | 36 × 400G | 800 Gbit/s | Yes | 2021 | €90,000 | 900 W |
| Edge XXL | 2U | 36 × 400G | 1.6 Tbit/s | Yes | 2027 | €150,000 | 1,200 W |

**Switches.** Switches keep their list price, less the yearly price erosion. Every switch comes from one maker in the maker's own numbering (`SWITCHES` in `hardware.ts`), so a model's price, power and years on sale are its maker's: Sysko Catalust and Nexxus (6 years on sale, 5 of support), Junipurr EX and QFX (6 and 5), Aristotle 7000 (5 and 5, datacenter only, cheapest per 10G, 25G, 100G and 400G port), Hewlett-Packet ProCurvy and Arugula (7 years on sale, lifetime support), MicroTick CRS (6 and 3, a quarter of the big makers' prices, 100G for 650 euro from 2021), Nettgear ProSafe and M4300 (5 and 3, the 60 euro 8 port box of 2005), Ubiquitea EdgeSwitch and UniFee (5 and 3, from 2015) and D-Lunk DGS (4 and 2, the cheapest 2005 to 2016). In every year the shop sells an 8, a 24 and a 48 port copper switch, one of them under 500 euro. Layer 3 can route between networks and act as a gateway, so within a maker it costs and draws more than the layer 2 model with the same ports. The generic switches of the first builds (`sw-8` to `sw-32e`) live on as Sysko models with their ports, so saved games keep their cabling: Catalust 2960-8TC (the starting switch, 8 × 1G, 60 euro, 8 W), 2960-24TT, 2960S-48TD, 3750X-48, Nexxus 3064, 9372PX, 93180YC-EX, 9336C-FX2, 9364D-GX2 and 9808. Switches, firewalls and gateways draw their full power at all times. Prices are estimates of launch street prices.

Every switch above is managed: it takes a management address, port groups and VLANs through its web interface. Four unmanaged switches have no address and no settings and forward between all their ports; the desktop ones stand on a 1U shelf. They make the basement's first switch cheaper than the Catalust 2960-8TC.

| Unmanaged switch | Ports | Form | Sold from | Price | Power |
| --- | --- | --- | --- | --- | --- |
| D-Lunk DES-1008D | 8 × 100M | Desktop | 2005 | €25 | 3 W |
| Nettgear GS108 | 8 × 1G | Desktop | 2005 | €75 | 4 W |
| D-Lunk DGS-1024D | 24 × 1G | 1U | 2006 | €180 | 15 W |
| Nettgear GS116 | 16 × 1G | Desktop | 2008 | €110 | 8 W |

Anchors: the DES-1008D sold for about 25 euro and the GS108 for about 70 euro in 2005. Each row follows its maker's years on sale and support.

**Security appliances.** 1U firewalls sit inline between the gateway and the switches. A firewall forwards like a switch, and every link through it runs at most at its throughput. Every firewall comes from one maker (`FIREWALLS` in `hardware.ts`) and also lists what it inspects (`ipsGbit`, lower than the throughput) and the connections it tracks (`sessions`); both show on the spec sheet and wait for the sim to use them. Sysko PIXel, ASAP and Firepowder (the old `fw-1g` to `fw-400g` are the ASAP 5520, ASAP 5585-X, Firepowder 4120, 4215 and 9300), Fortinope FortiGoat (the most throughput per euro), Pablo Alto PA (the dearest, the best inspection), Junipurr SRX (from 2009), Netgoat pfSinse boxes (from 2015, the cheapest, no inspection before 2018) and SoPhosphate UTM, XG and XGS (from 2011). In every year the shop sells a firewall under 1000 euro and a datacenter one.

**Patch panels and gateways.**

| Device | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Patch panel 24, copper | 1U | 24 jacks, 1G | 2005 | €80 | 0 W |
| Patch panel 24, fiber | 1U | 24 jacks, SFP | 2005 | €250 | 0 W |
| Patch panel 48, copper | 1U | 48 jacks, 1G | 2005 | €140 | 0 W |
| Patch panel 48, fiber | 1U | 48 jacks, SFP | 2005 | €450 | 0 W |
| Home router (100 Mbit/s) | Carrier panel | 4 × 1G | Comes with the basement | Free | 10 W |
| Datacenter handoff | Carrier panel | 2 × 1G | Comes with every datacenter location | Free | 0 W |

A patch panel is passive. Each jack has a front and a back port, and a link through a jack runs at the slower of the two ports on either side of the panel. Gateways sit on the location's carrier panel, not in a rack, so they stay when a rack moves.

**Routers, UPS and PDUs.** Prices are approximate launch street prices in euro from contemporary reviews and price lists, recorded as game anchors; none comes from a single public source. A router passes on at most its throughput. The home router that comes with the basement routes 100 Mbit/s (a router bought for the basement replaces it), and the basement's line carries the lower of its upload and the router's speed. In a datacenter a router's throughput is shared among the links on it. A router with a full table can hold a full BGP table and run an own AS, which announcing a block needs; the others take provider addresses and a default route. BGP sessions is the number of sessions the model takes.

| Router | Maker | Height | Ports | Throughput | Full table | BGP sessions | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fritz!Bocks 7050 | AVN | Carrier panel | 4 × 1G | 100 Mbit/s | No | 0 | 2006 | €150 | 8 W |
| Fritz!Bocks 7390 | AVN | Carrier panel | 4 × 1G | 300 Mbit/s | No | 0 | 2010 | €220 | 9 W |
| Fritz!Bocks 7590 | AVN | Carrier panel | 4 × 1G | 1 Gbit/s | No | 0 | 2018 | €249 | 12 W |
| Fritz!Bocks 5690 | AVN | Carrier panel | 4 × 1G | 2.5 Gbit/s | No | 0 | 2024 | €330 | 14 W |
| Router 1841 | Sysko | 1U | 2 × 1G | 100 Mbit/s | No | 2 | 2005 | €1,300 | 40 W |
| Router 2811 | Sysko | 2U | 4 × 1G | 300 Mbit/s | No | 4 | 2005 | €2,500 | 120 W |
| Router 2911 | Sysko | 2U | 3 × 1G | 1 Gbit/s | No | 8 | 2009 | €2,800 | 130 W |
| Router 4451 | Sysko | 2U | 4 × 1G | 2 Gbit/s | Yes | 64 | 2013 | €8,000 | 250 W |
| Router 8300 | Sysko | 2U | 4 × 10G and 4 × 1G | 10 Gbit/s | Yes | 256 | 2020 | €9,000 | 300 W |
| RB1100 | MicroTick | 1U | 13 × 1G | 1 Gbit/s | No | 4 | 2010 | €300 | 30 W |
| CCR1036 | MicroTick | 1U | 12 × 1G and 4 × 10G SFP | 10 Gbit/s | Yes | 128 | 2013 | €1,000 | 40 W |
| CCR2004 | MicroTick | 1U | 16 × 1G and 2 × 10G SFP | 10 Gbit/s | Yes | 128 | 2020 | €450 | 40 W |
| CCR2216 | MicroTick | 1U | 16 × 25G and 2 × 100G SFP | 100 Gbit/s | Yes | 512 | 2022 | €2,500 | 120 W |
| MX80 | Junipurr | 2U | 4 × 10G SFP and 8 × 1G | 80 Gbit/s | Yes | 512 | 2010 | €25,000 | 350 W |
| MX204 | Junipurr | 1U | 4 × 100G and 8 × 10G SFP | 400 Gbit/s | Yes | 2,048 | 2017 | €40,000 | 400 W |
| MX304 | Junipurr | 2U | 16 × 100G | 1.6 Tbit/s | Yes | 8,192 | 2022 | €80,000 | 1,000 W |

Anchors: the AVM Fritz!Box 7050, 7390, 7590 and 5690 at their launch prices, the Cisco 1841, 2811, 2911, 4451 and 8300, the MikroTik RB1100, CCR1036, CCR2004 and CCR2216, and the Juniper MX80, MX204 and MX304. The Sysko edge routers follow the table under Routers; their throughput is 4, 40, 400, 800 and 1,600 Gbit/s from S to XXL and every one from M up holds a full table. Rack-mounted routers in the basement count for its line like the carrier panel router, and the fastest one sets the cap.

| UPS | Height | Battery | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| UPS 1500 VA | 1U | 600 Wh | 2005 | €180 | 10 W |
| UPS 3000 VA | 2U | 1,800 Wh | 2005 | €900 | 25 W |
| UPS 5 kVA | 3U | 3,500 Wh | 2005 | €2,500 | 50 W |
| UPS 10 kVA (two feeds) | 6U | 8,000 Wh | 2008 | €6,000 | 100 W |
| UPS 1500 VA, network card | 1U | 600 Wh | 2005 | €480 | 12 W |
| UPS 3000 VA, network card | 2U | 1,800 Wh | 2005 | €1,200 | 27 W |
| UPS 5 kVA, network card | 3U | 3,500 Wh | 2005 | €2,800 | 52 W |
| UPS 10 kVA, network card (two feeds) | 6U | 8,000 Wh | 2008 | €6,300 | 102 W |

Anchors: an APC Smart-UPS 1500 cost about USD 600 in 2005, a 3000 about USD 1,200, and the Smart-UPS RT and Symmetra units of 5 to 10 kVA USD 3,000 to 7,000. A UPS carries a location through a grid outage for its battery in Wh divided by the draw of the location's racks. Only a UPS whose power cord is plugged in counts.

A UPS with a network card (anchor: an APC Network Management Card at about USD 300 to 400) takes an address on the LAN and has a web interface with its battery, load, runtime and the servers it protects. When an outage outlasts the batteries, it signals the servers at its location to shut down cleanly instead of losing power, so no data is corrupted. A server hears the signal when both it and the UPS are online and either runs the `nuts-client` agent, installed with apt from its shell, or is a VMwhere or HyperVee node, whose hypervisor API the UPS drives. Reinstalling the OS removes the agent.

| Switched PDU | Height | Outlets | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Switched PDU 8 | 1U | 8 | 2005 | €700 | 15 W |
| Switched PDU 24 | 0U (side rail) | 24 | 2008 | €1,200 | 20 W |

Anchor: the APC AP7900 switched rack PDU at about USD 600. A rack takes one PDU. While it is up, a device in the rack can be power cycled and powered off with the same corruption roll as a pulled plug, without a remote hands fee.

Lifecycle: each row follows the rule in Hardware lifecycle. The newest row of each line (Fritz!Bocks 5690, Router 8300, CCR2216, MX304, Edge XXL, the 800G spine, Firewall 400G, UPS 10 kVA and Switched PDU 24) has no last year on sale, so the Shop never runs out of a kind of device.
