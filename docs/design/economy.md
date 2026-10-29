# Backbone economy model

This doc turns the systems in the [game design document](gdd.md) into formulas and starting numbers. Every value is a starting point to tune, and all of them live as data in `src/sim/10-catalog`.

## Clock and pacing

At 1×, the game clock runs 60 times faster than real time: one game minute lasts 1 second, one game hour 1 minute, and a game day 24 minutes. The simulation ticks every game hour; between ticks the clock steps game minutes, and queued hand work (a reply, an order step, a domain move) lands at the minute it is done rather than at the next full hour. A server boots in 3 game minutes and a domain registers in 2. Billing, salaries, know-how and the market run on the monthly tick.

| Speed | Game hour | Game day | Game month | Game year |
| --- | --- | --- | --- | --- |
| 1× | 60 s | 24 min | 12 h | 146 h |
| 2× | 30 s | 12 min | 6 h | 73 h |
| 4× | 15 s | 6 min | 3 h | 36.5 h |
| Skip (720×) | 0.08 s | 2 s | 1 min | 12 min |

Skip runs at 12 game hours a second until the simulation produces any event, then drops back to 1×.

**Pacing targets.** A player who plays reasonably well should hit each level around these years. The headless balance run checks them (see [Balancing](#balancing)).

| Level | Reached in | Game year | Customers | Monthly recurring revenue |
| --- | --- | --- | --- | --- |
| 2 Garage Hero | End of year 1 | 2005 | ~40 | ~€400 |
| 3 Rack Renter | Years 2–3 | 2007 | ~400 | ~€5,000 |
| 4 Cage Fighter | Year 5 | 2010 | ~2,000 | ~€30,000 |
| 5 Room Service | Years 8–9 | 2013 | ~10,000 | ~€200,000 |
| 6 Datacenter Baron | Years 12–14 | 2017–2019 | ~40,000 | ~€1,000,000 |

Level 6 lands before the cloud and GPU boom, so the late game still has new products to chase. Playing mostly at 4×, level 6 takes about 20 hours of real time.

## Starting state

A new game opens paused on 1 January 2005 at 00:00 with €3,500 in cash, an empty 24U rack in the basement next to the home router, and three friends waiting for web hosting. The savings buy the first server, a Dwell Balanced 1U G1 at €2,500, and leave the same €1,000 the company used to start with next to a free server, so year 1 pacing is unchanged. The Bank comes in for the second server, which the panel VM and the friends make due within the first month or two. The home router has 4 ports, one per basement server, so the basement needs no switch.

| Item | Starting value |
| --- | --- |
| Cash | €3,500, no debt; the bank lends up to the level 1 minimum of €10,000 from day one |
| Company | Level 1, 0 know-how, no reviews yet |
| Basement | 1 rack position for a rack up to 24U, 3 kW at most; power at the household price |
| Home line | None. The player orders one in Locations; it goes live after its install days, and every line costs money (Home line) |
| Hardware | An empty 24U rack and the home router. The player buys the first server in the Shop, mounts it, plugs in its power and cables it to the home router; it runs no control plane until its setup installs a panel or a hypervisor on it |
| Reseller accounts | None. The first registrar contract is signed in the first month (NameCheep needs no signup), and every domain costs the partner's wholesale a month (Sales and quotes, Domains) |
| Company domain and email | None. A domain and a mail service are needed before the website and the first email order (Sales and quotes, Domains and Company email) |
| Product lines | None offered; each line unlocks once the player can deliver it (Addresses and internet, The start) |
| Customers | None until the first hosting panel runs on a server the internet reaches. Then 3 friends (Jonas Weber, Mira Schulz and Tobi Kraus, private individuals) sign up for the 2 GB web hosting size at €6 a month on that cluster; happiness 85, and they always pay |


### Weekly challenges

A challenge starts from the normal starting state with one twist, chosen by ISO week number modulo 3. The figures are picked to bite without breaking the start: SDSL 2048 at €129 a month is the line a small hoster with a static address ordered in 2005, Hetzler Park is the cheapest Frankfurt datacenter at €180 a month for a position, and €2,000 does not cover the usual first server, so the player buys a smaller one or borrows.

| Week modulo 3 | Twist |
| --- | --- |
| 0 | Home line SDSL 2048 already in from hour 0 |
| 1 | Every datacenter except Hetzler Park starts at its 2005 capacity; competitors cancel and refill as usual afterwards |
| 2 | Starting cash €2,000 |

Scores count until 1 January 2008, 00:00: net worth then (rounded to the euro), the first day level 3 holds (checked once a day), and the mean of each hour's average happiness of active customers (rounded to a tenth). A replay passes when net worth is within €1, the level 3 day matches and happiness is within 0.1.

## Prices over time

Every price in the GDD's Prices section is a 2026 value. Earlier years scale it by a 2005 multiplier, spread evenly over the 21 years between them:

```math
p(y) = p_{2026} \cdot m^{(2026 - y)/21}
```

Here m is the multiplier in 2005. After 2026 prices stay flat.

| Category | 2005 multiplier m | Example |
| --- | --- | --- |
| IP transit, per Mbit/s | 108 | 1 Gbit/s commit: €190 per month in 2026, about €20 per Mbit/s in 2005 |
| Internet exchange ports | 5 | AMS-IX 10G: €650 per month in 2026 |
| Customer base rate per GB of RAM | 11 | VPS: about €1.50 per GB in 2026, €16 per GB in 2005 |
| Customer base rate per TB of storage | 32 | Object storage: €6.50 per TB in 2026, €210 in 2005 |
| Customer base rate per TB of traffic | 46 | Overage and traffic-heavy services |
| Fixed-price products | 1 | Web hosting, domains and dedicated servers keep their price per size; the sizes get bigger |
| Rented space, rack share, position or cage | 1 | Power is billed separately |
| Server purchase price | Parts | Resources per server come from the generations table below; the price in later years follows the parts (Part prices by year) |
| Salaries | 0.6 | Support agent, junior: €38,700 in 2026, about €23,000 in 2005 |
| Search ads, per click | 0.6 | |
| SSL certificate (DV) | Special | €50 per year until 2015, then free (the Let's Encrypt stand-in) |

**Electricity.** Business prices follow these keyframes, with straight lines between them. The basement pays the household price, which is the business price × 1.6.

| Year | | 2010 | 2014 | 2020 | 2022 | 2023 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business price (ct/kWh) | | 12 | 15 | 18 | 35 | 25 | 17 |

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

Backup and archive servers use HDDs whatever the generation's disk type. Archive storage is the cheapest per TB, then backup, then the storage 2U.

| Generation | G1 | G2 | G3 | G4 | G5 | G6 | G7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Large HDD (backup) | 500 GB | 1 TB | 3 TB | 6 TB | 10 TB | 16 TB | 22 TB |
| Densest HDD (archive) | 750 GB | 2 TB | 4 TB | 8 TB | 14 TB | 20 TB | 28 TB |

- **Power draw.** A server draws 40% of its full power when idle, rising in a straight line with CPU load. The game applies the two ends: a server with no running workload draws the idle 40%, one with a running workload draws its full power, in the power bill and in the rack's fuse limit.
- **Port speed.** Server ports run at 1G until 2011, then 10G, 25G from 2017 and 100G from 2023.
- **Ports.** 1G ports are copper (RJ45); 10G and faster ports are SFP cages.
- **Shop window.** A generation stays in the shop until the generation two steps newer arrives, so G1 is sold until the end of 2010 and G2 until the end of 2013. G6 and G7 stay in the shop.

**Part prices by year.** A part costs its size times the year's price per unit, with straight lines between the keyframe years and flat prices after the last one (2028). The prices are enterprise prices (registered RAM about 1.6 times consumer RAM, enterprise SSDs about 1.5 times, enterprise HDDs about 1.6 times). SSDs are sold from 2009 and NVMe drives from 2014.

| Year | RAM, € per GB | SSD, € per GB | NVMe, € per GB | HDD, € per TB | CPU, € per core |
| --- | --- | --- | --- | --- | --- |
| 2005 | 200 | not sold | not sold | 500 | 200 |
| 2008 | 40 | 12 (sold from 2009) | not sold | 200 | 120 |
| 2010 | 45 | 3.0 | not sold | 100 | 90 |
| 2012 | 11 | 1.5 | not sold | 60 (flood spike) | 70 |
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

Anchors: John C. McCallum's memory price history (DRAM about US$100 to 150 per GB in 2005 for consumer DDR2, about $4 to 5 in 2013 and 2016, the 2017 to 2018 shortage that roughly doubled module prices, about $3 in 2020, the 2023 trough); the 2025 to 2026 AI-driven shortage (DDR5 about $17 per GB in October 2026 after a rise of 200% to 400%, TrendForce; Bernstein expects a further rise in 2027 and a fall in 2028); Backblaze's drive cost per GB ($0.11 in 2009, 0.033 in 2017, 0.0144 in 2022); SSD retail (about $3 per GB in 2010, 0.30 in 2016, 0.11 in 2020, 0.06 at the mid-2023 bottom, 0.09 in 2024, doubled by late 2025). The CPU column is the least anchored.

Fixed parts: a power supply costs €150 in 2005, falling in a straight line to €90 in 2015 and flat after; a fan €25; a mainboard €600 falling to €400 by 2015; a network card €80 falling to €40 by 2015, times 4 for 10G and faster cards until 2017 and times 2 from 2017.

**GPU cards and rental.** A GPU card is a PCIe part sold in the Parts tab and fitted in the GPU 4U line. It is named by its launch year, and the shop sells the newest card and the one before. The cards are puns on Nvidia's Tesla line:

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

**Manufacturers.** Within a class, manufacturers differ in price and failure rate, never in specs. A unit costs the model's price × the price factor, and its failure rate is the base AFR × the failure factor.

| Class | Manufacturer | Price factor | Failure factor |
| --- | --- | --- | --- |
| Servers | Dwell | 1.00 | 1.00 |
| Servers | Hewlett-Packet | 1.08 | 0.80 |
| Servers | SuperMacro | 0.90 | 1.30 |
| Servers | Lenovoid | 0.95 | 1.10 |
| Switches | Sysko | 1.00 | 1.00 |
| Switches | Junipurr | 1.10 | 0.70 |
| Switches | Aristotle | 0.93 | 1.20 |
| Security appliances | Sysko | 1.00 | 1.00 |
| Security appliances | Fortinope | 0.90 | 1.25 |
| Security appliances | Pablo Alto | 1.10 | 0.75 |
| Patch panels | Pandoot | 1.00 | 1.00 |
| Routers | AVN | 1.00 | 0.90 |
| Routers | MicroTick | 1.00 | 1.20 |
| UPS units and PDUs | Eatin | 1.00 | 1.00 |

A router is built by one manufacturer only (Sysko, AVN, MicroTick or Junipurr, by model) and sells at its list price. Junipurr's switch price factor does not apply to its routers.

**Routers.** A router's ports cap how many uplink links a location can have and how fast they run, and its throughput caps what passes through it. The routers below are the Sysko edge routers, which mount in a rack; the other routers are in Routers, UPS and PDUs.

| Router | Height | Ports | Throughput | Full table | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Edge S | 1U | 4 × 1G | 4 Gbit/s | No | 2005 | €3,000 | 100 W |
| Edge M | 1U | 8 × 10G and 4 × 1G | 40 Gbit/s | Yes | 2008 | €12,000 | 200 W |
| Edge L | 2U | 32 × 100G | 400 Gbit/s | Yes | 2014 | €40,000 | 600 W |
| Edge XL | 2U | 36 × 400G | 800 Gbit/s | Yes | 2021 | €90,000 | 900 W |
| Edge XXL | 2U | 36 × 400G | 1.6 Tbit/s | Yes | 2027 | €150,000 | 1,200 W |

**Switches.** All switches are managed and keep their price over the years. Every switch stays in the shop once it arrives, so an older 1G switch can always link a rack to the provider handoff. Layer 3 can route between networks and act as a gateway in later milestones, so it costs and draws more than the layer 2 model with the same ports. Switches, firewalls and gateways draw their full power at all times. Their prices are estimates.

| Switch | Layer | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- |
| L2 switch 8 (the starting switch) | 2 | 1U | 8 × 1G | 2005 | €60 | 8 W |
| L2 switch 24 | 2 | 1U | 24 × 1G and 2 × 1G SFP | 2005 | €900 | 40 W |
| L2 switch 48 | 2 | 1U | 48 × 1G and 4 × 10G SFP | 2008 | €2,800 | 70 W |
| L2 switch 48 SFP | 2 | 1U | 48 × 10G SFP | 2011 | €8,000 | 200 W |
| L3 switch 48 | 3 | 1U | 48 × 1G and 4 × 10G SFP | 2008 | €5,500 | 110 W |
| L3 switch 48 SFP, 40G | 3 | 1U | 48 × 10G and 6 × 40G SFP | 2014 | €14,000 | 280 W |
| L3 switch 48 SFP, 100G | 3 | 1U | 48 × 25G and 8 × 100G SFP | 2017 | €18,000 | 400 W |
| L3 spine 32 × 100G | 3 | 1U | 32 × 100G SFP | 2017 | €20,000 | 450 W |
| L3 spine 32 × 400G | 3 | 1U | 32 × 400G SFP | 2022 | €45,000 | 900 W |
| L3 spine 32 × 800G | 3 | 1U | 32 × 800G SFP | 2027 | €60,000 | 1,400 W |

**Security appliances.** 1U firewalls sit inline between the gateway and the switches. A firewall forwards like a switch, and every link through it runs at most at its throughput.

| Firewall | Throughput | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- |
| Firewall 1G | 1 Gbit/s | 1U | 4 × 1G | 2005 | €1,500 | 40 W |
| Firewall 10G | 10 Gbit/s | 1U | 8 × 1G and 4 × 10G SFP | 2011 | €6,000 | 120 W |
| Firewall 40G | 40 Gbit/s | 1U | 8 × 10G and 4 × 40G SFP | 2017 | €18,000 | 250 W |
| Firewall 100G | 100 Gbit/s | 1U | 8 × 25G and 4 × 100G SFP | 2022 | €40,000 | 450 W |
| Firewall 400G | 400 Gbit/s | 1U | 8 × 100G and 4 × 400G SFP | 2027 | €70,000 | 700 W |

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

Anchors: an APC Smart-UPS 1500 cost about USD 600 in 2005, a 3000 about USD 1,200, and the Smart-UPS RT and Symmetra units of 5 to 10 kVA USD 3,000 to 7,000. A UPS carries a location through a grid outage for its battery in Wh divided by the draw of the location's racks.

| Switched PDU | Height | Outlets | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Switched PDU 8 | 1U | 8 | 2005 | €700 | 15 W |
| Switched PDU 24 | 0U (side rail) | 24 | 2008 | €1,200 | 20 W |

Anchor: the APC AP7900 switched rack PDU at about USD 600. A rack takes one PDU. While it is up, a device in the rack can be power cycled and powered off with the same corruption roll as a pulled plug, without a remote hands fee.

Lifecycle: each row follows the rule in Hardware lifecycle. The newest row of each line (Fritz!Bocks 5690, Router 8300, CCR2216, MX304, Edge XXL, the 800G spine, Firewall 400G, UPS 10 kVA and Switched PDU 24) has no last year on sale, so the Shop never runs out of a kind of device.

## Market and leads

Each city produces a stream of new customers looking for a host. Only a small share of them ever looks at your offer; those are your leads, and the choice formula decides which leads buy.

**Market size.** New customers per month in 2005, growing 8% a year (about 5× by 2026):

| City size | Cities | New customers per month (2005) |
| --- | --- | --- |
| Large | Frankfurt, London, Paris | 1,500 |
| Medium | Amsterdam, Berlin, Milan, Munich | 1,000 |
| Small | Vienna, Zurich | 600 |
| Regional | Düsseldorf 800, Nuremberg 400, Kerkrade 150, Falkenstein 100 | as listed |
| North America | New York 2,000, Los Angeles 1,500, Chicago 1,200, Dallas 1,000, Ashburn 600 | as listed |

Düsseldorf stands for the Rhine-Ruhr area and Kerkrade for the Dutch-German border region around Aachen; Falkenstein and Ashburn are datacenter towns with few local customers.

Customers belong to their city's country and prefer datacenters there (see the location score under [Customer choice](#customer-choice)).

**Profile mix.** Share of each city's new customers, by budget and skill:

| Budget \ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual 25% | Gamer 15% | Hobby developer 10% |
| Medium budget | Sole proprietor 15% | Small business 15% | Agency or startup 8% |
| High budget | Doctor's or law office 5% | Online shop 5% | Enterprise 2% |

**Leads.** Leads per month for each profile and city come from organic reach and referrals, which are capped at a share of that city's new customers that grows with your level, plus website and campaign leads on top:

```math
\text{leads} = \min(\text{organic} + \text{referrals},\ 0.016 \cdot (1 + 0.5 \cdot \text{level}) \cdot \text{market}_{new}) + \text{website} + \text{paid}
```

The cap is 2.4% of a city's new customers at level 1, 4% at level 3 and 6.4% at level 6.

- **Organic:** 0.4 × the city's new customers × the profile's mix × its awareness × (1 + 0.5 × (level − 1)) × review multiplier per month (see Organic leads in the game below). Organic leads only come from cities where you have a location.
- **Referrals:** every customer with happiness 70 or more brings 0.005 leads per month × review multiplier, of their own profile, in your home city.
- **Website:** 4 a month per location city once you own a website, split by the profile mix, times the site factor below.
- **Paid:** campaign budget ÷ cost per lead (see [Marketing and reviews](#marketing-and-reviews)).

Website and campaign leads send 10% to cities without a location of yours, where they cannot buy.

**GPU demand.** Hobby developers, agencies, online shops and enterprises ask for GPU servers in 3% of their orders at a demand factor of 1 (`gpuDemand` in `gpu.ts`). The factor is 0 before 2011, 0.2 from 2011 to 2016, 0.6 from 2017 (deep learning), 1 from 2020 and 2.5 from 2023 (generative AI), so those profiles ask for a GPU server in 0.6%, 1.8%, 3% and 7.5% of their orders, and their other products give way proportionally. News announces the two jumps. A GPU order that finds no free card is lost as no capacity, like any other line. The portfolio score ignores the GPU line.

**Site state.** The company site is rented from "Strateaux" (always up) or runs as a small workload (0.25 vCPU, 0.5 GB RAM, 2 GB disk) on one of your panel hosts. On an own host the site is down while the host is off, failed, frozen, taken offline or compromised, and slow while the host performs below 1 (overload, a PHP upgrade) or has over 90% of its RAM booked. Website leads and the orders of the order form are multiplied by 0 while the site is down and by 0.5 while it is slow, at the daily roll; search ads, campaigns, fairs, referrals and email orders are untouched. The site adds no awareness (the 0.004 a month under Marketing and reviews) while it is down.

The review multiplier is 0.4 + 0.25 × (stars − 1), so 1 star gives 0.4, 3 stars 0.9 and 5 stars 1.4.

Each lead first checks the profile's requirements on the host. A lead that fails them is logged as a lost sale with its reason, for example "company too young". A lead that passes compares you with the competitors (next section) and, if it picks you, sends a request.

## Customer choice

Each lead scores every host that meets its requirements and picks one at random, weighted so that better scores win most of the time. Every host gets the same offer, so price plays no part in the choice.

**Scores.** Each host gets three scores from 0 to 100.

| Score | Formula | Parts |
| --- | --- | --- |
| Performance P | 0.5 gen + 0.3 headroom + 0.2 location | **gen:** 100 for the current server generation, minus 15 per generation behind (capacity-weighted over the cluster). **headroom:** 100 while the busiest link on the path stays below 60% at the 95th percentile, falling linearly to 0 at 100%. **location:** 100 in the customer's city, 70 in their country, 40 elsewhere. |
| Reliability R | 0.5 uptime + 0.3 support + 0.2 cluster | **uptime:** from the last 90 days (formula below); a company with under 30 days of history counts as 60. **support:** 100 when the average first response takes half the promised time, 50 at the promised time, 0 at double. **cluster:** 100 for HA, 40 for consumer. |
| Convenience C | 0.5 panel + 0.3 portfolio + 0.2 add-ons | **panel:** cPanic 90, Pleskit 80, DirectAdmen 60, FreePanel 45, and 60 for products without a panel. **portfolio:** the share of the profile's usual bundle you sell, × 100. **add-ons:** 25 per add-on offered for the product, up to 100. |

Uptime turns the 90-day downtime fraction d into a score, so 99.99% gives 100, 99.9% gives 60 and 99% gives 20:

```math
\text{uptime} = \operatorname{clamp}\left(100 - 40 \cdot \log_{10}\frac{d}{0.0001},\ 0,\ 100\right)
```

**Value of a host.** Each profile weighs the scores and adds the review platform's trust bonus T (see [Marketing and reviews](#marketing-and-reviews)):

```math
U = w_P P + w_R R + w_C C + T
```

**Choice.** Each host j wins with this probability, where τ = 12 sets how much luck is involved:

```math
P(j) = \frac{e^{U_j/\tau}}{\sum_k e^{U_k/\tau}}
```

**Profile weights.** The offer is a multiple of the market base rate, and the growth ceiling is the largest size a customer reaches, as a multiple of its first request.

| Profile | w_P | w_R | w_C | Offer | SLA asked | Growth ceiling |
| --- | --- | --- | --- | --- | --- | --- |
| Private individual | 0.20 | 0.20 | 0.60 | 0.9× | Basic | 1.5× |
| Gamer | 0.50 | 0.30 | 0.20 | 0.9× | Basic | 2× |
| Hobby developer | 0.60 | 0.20 | 0.20 | 0.9× | Basic | 3× |
| Sole proprietor | 0.15 | 0.35 | 0.50 | 1.0× | Basic | 1.5× |
| Small business | 0.30 | 0.40 | 0.30 | 1.0× | Business | 3× |
| Agency or startup | 0.50 | 0.35 | 0.15 | 1.0× | Business | 10×; startups up to 50× |
| Doctor's or law office | 0.10 | 0.60 | 0.30 | 1.3× | Business | 1.5× |
| Online shop | 0.30 | 0.55 | 0.15 | 1.3× | Premium | 5× |
| Enterprise | 0.35 | 0.55 | 0.10 | 1.3× | Premium | 4× |

**Competitors.** Four fixed archetypes sell in every city. Their scores never change.

| Competitor | P | R | C | Sells |
| --- | --- | --- | --- | --- |
| Budget giant | 55 | 60 | 70 | Web hosting, domains, email, VPS |
| Wholesale provider (the OVH stand-in) | 70 | 65 | 50 | Everything; also the source of your resold lines |
| Developer cloud | 85 | 70 | 40 | VPS, dedicated servers, storage, later cloud |
| Premium host | 80 | 90 | 75 | Everything, managed |

**Worked example.** A private individual weighs P, R and C at 0.2, 0.2 and 0.6. A new player scores P 60, R 50, C 50, so U = 52. The budget giant reaches 65, the developer cloud 55, the wholesale provider 57 and the premium host 79. The player wins about 6% of these leads, and convenience (a better control panel, more add-ons) is the fastest way up.

## Requests, SLAs and growth

**Price.** A request pays the market base rate for its resources × the profile's offer × the SLA factor × the feature factor. Fixed-price products such as web hosting use their fixed price instead of the base rate. The hourly rate is the monthly price ÷ 730.

**Features.** Each wanted feature you offer adds 5 to the customer's value U (at most 15) and its price share below. A required feature you don't offer turns the request away.

| Feature | Price share |
| --- | --- |
| High availability | +30% |
| Replicas | +15% per replica beyond the first |
| Spread across racks | +5% |
| Spread across locations | +15% |
| Backups | +20% |
| DDoS protection | +10% on-demand, +25% always-on |
| Private network | €5 a month (m = 1) |
| Two carriers | +5% |

**Shop price setting.** Budget multiplies prices by 0.85 and premium by 1.2. Budget adds 10 to U for low-budget profiles and premium adds 10 for high-budget profiles; each costs the other end 10.

**Commitment and billing.**

| Product | Minimum term | Billed |
| --- | --- | --- |
| Cloud servers, load balancers | None | Hourly, monthly in arrears |
| Web hosting, VPS, game servers, managed databases, Kubernetes, DNS hosting | 1 month | Hourly, monthly in arrears |
| Dedicated servers, colocation | 12 months | Hourly, monthly in arrears; colocation power by the kWh |
| Object storage, CDN, traffic overage | None | Per TB, monthly in arrears |
| Domains, SSL certificates | 12 months | Yearly in advance |

| SLA | Uptime per month | First response | Price factor | Credit when missed |
| --- | --- | --- | --- | --- |
| Basic | 99.5% | 48 h | 1.0 | None |
| Business | 99.9% | 8 h | 1.2 | 10% of the monthly bill |
| Premium | 99.99% | 1 h | 1.5 | 25% of the monthly bill |

Hours a service is down are left off its invoice line. When the hours up fall below the SLA's uptime, the invoice adds a credit line for its share of what was billed for that service. Hours down while the customer is suspended count as up.

**Handling a request.** Answering a request by hand takes 8 minutes of the player's or a sales agent's time. A request waits 3 days, then the customer goes to a competitor. The shop answers instantly while the target cluster's busiest resource stays under the limit you set (80% by default).

**Growth.** A customer grows a set share each year until it reaches its ceiling: 10% a year for low budgets, 25% for medium and 40% for high. A startup (a third of agencies) grows 150% a year and has a 20% chance each year of shutting down. When usage passes 85% of what the customer rents, it sends an expansion request for double its size, capped at its ceiling.

**Cloud quotas.** A cloud customer's usage averages 40% of its quota and peaks at 80% during its busiest hours. It pays per hour used, at the base rate × 1.25 ÷ 730. When its peak passes 80% of the quota, it asks for a 50% to 100% higher quota with a reason drawn from its profile.

## Sales and quotes

How the market above turns into order emails and sales requests in the Support app. Code: `src/sim/30-market`.

**Orders by email.** A lead asking for a basic SLA from a profile with a low or medium budget is a standard order (`orders.ts`). It names its own resources (Custom orders, below), its price starts at the request's market reference less any campaign discount, and it has the same 72 hours as a sales request. Declining it takes 10 minutes of player or support time; the steps of an accepted order take the times under Custom orders. Before the order form every order lead writes an email. With the order form and email orders on, a quarter of the order leads (`EMAIL_SHARE`, 0.25) still write one and the rest go through the form at the player's rates (Per-resource pricing). With Provisioning automation switched on the form places the order at once when the city has the product and room, and an order it cannot place arrives as an order email. Without it a form order is accepted on arrival and waits in the inbox for its steps (Custom orders). A new game always gets its first order email within 14 days: each morning before then without an order, a friend's recommendation brings one from a private individual with chance 1 / (14 − day). Seeds 1 to 8 already brought one between day 1 and day 22 from organic leads alone, so the recommendation only fills the gap.

**Email orders off.** Switching email orders off (`website.ts`, needs the order form) sends every order lead through the order form, and an order the form cannot place is a lost sale instead of an order email. Sales requests (business SLA or high budget), upgrades and the shady request are not affected. Email off therefore saves the 30 to 35 minutes of step work of a quarter of the order leads and costs only the orders the form cannot place.

**Waiting for setup.** A customer who accepts a quote when no server has room waits 48 hours for their login details (`SETUP_WAIT_HOURS`, `sales.ts`). The request shows as Waiting for setup under Cannot serve, and setup is tried again every hour, so adding capacity in time still wins the deal. After 48 hours the customer writes that nothing came and signs elsewhere, a lost sale for lack of capacity.

**Custom orders.** Every order names its own resources, by email or through the form (`spec.ts`, `manual.ts`). It starts from the size its profile's budget picks (What a lead asks for). Web hosting, VPS and game server orders scale that size by one of 0.5, 0.75, 1, 1, 1.25 or 1.5, which average to 1: web disk in half GB steps, traffic in whole GB, 1 + up to 5 × factor mailboxes, with 0.1 vCPU and 0.25 GB RAM; VPS and game server RAM in quarter GB steps, vCPUs scaled (plus one, three times in ten), disk ±25% in 5 GB steps. DNS and VPN orders scale their zones or users and their traffic the same way (DNS zones and VPN users). Other lines take the size as it is. A spec's monthly market price comes from Per-resource pricing, and the SLA factor and the profile's offer factor apply on top. Step times: quote 5, account 5, confirmation and invoice 10, domain 5, setup 15 minutes. **Quoting an email order.** The first step is the quote, at the monthly price and setup fee the player enters (the market reference and the line's setup fee are prefilled). An email order draws its budget between 1.10 and 1.25 times the reference (`ORDER_BUDGET`, the upper half of a sales lead's range, because a standard order is a shelf product), which makes a quote at the reference taken about nine times in ten, and the customer answers like a sales lead: 4 to 24 hours after the quote, 2 hours after a quote that meets their counter, taking it with the logistic chance of Customer choice, countering once at 0.97 times their accepted price when within 0.12 of it and half the time, otherwise refusing; a second refusal ends the order as a lost sale. An accepted quote has 72 hours (`REQUEST_HOURS`) for the steps. An order form order is accepted at arrival at the website's price and setup fee and has the same 72 hours. **Setup.** The setup lists the cluster and panel hosts of the order's city that sell the product, with the RAM and disk booked against what each holds; disk is the only limit (Usage curves and overcommit). Automatic (`targetFor`) and the Place orders automatically switch need the Provisioning automation skill (Know-how and unlock costs). Staff set an order up on the first host with disk room, one with the RAM for it first. The balance model counts an order as placed on acceptance, as a company with the switch on would. An order invoice is due in 14 days; an on-time payer pays it within 1 to 3 days. Upgrades ask for 1.5 or 2 times every resource.

**Domains.** Registry cost per year, 2005 to 2026, linear in between: .de €12 to €6, .at €25 to €12, .ch €15 to €9, .co.uk €8 to €7, .fr €20 to €9, .nl €10 to €6, .it €15 to €8, .com €6 to €9 (VeriSigh raised its price over the years). The customer pays €15 a year for a registration or renewal and €5 for a transfer, which includes its first year. The reminder comes 30 days before expiry.

**Registrar partners.** One contract at a time (`10-catalog/registrars.ts`, `30-customers/registrar.ts`). A domain's wholesale a year is the registry cost of the year above times the partner's factor for the tier, plus the ICANN fee on a .com (€0.18, €0.20 from July 2025). The tier is the number of domains under management (the company's and the customers') at the month start: 0, 100, 500 and 5,000. At a month start the partner invoices the signup once (first month under the contract), the fee, or for a minimum the part the domains did not use, and one twelfth of every domain's wholesale; the ledger books `ledger.registrarSignup`, `ledger.registrar` and `ledger.domains` in the category "domains". Registering and renewing book nothing; the customer pays €15 a year or €5 for a transfer, as above. Moving every domain to a new partner is a hand task of 5 minutes per domain (the Network row of the gdd By hand table). The factors follow the real reseller schemes: GoDaddy's Basic Reseller plan at USD 107.88 a year, Enom's USD 50 enrollment and the OpenSRS and Enom tiers (Essential none, Advanced USD 2,000 and 100 registrations, Premium USD 50,000 and 500, Enterprise USD 100,000 and 1,000), Name.com's Bronze, Silver and Gold at 100, 250 and 1,000 registrations, German resellers such as InterNetX with no setup fee but a monthly minimum, and Verisign's .com fee (USD 6.00 to 2007, 6.42 from October 2007, 7.85 from 2012, 8.39 in 2021, 8.97 in 2022, 9.59 in 2023, 10.26 in 2024, 10.97 from November 2026, which the .com curve above follows). The game uses the count of domains only.

| Partner (pun on) | Signup | Per month | Factor at 0+ / 100+ / 500+ / 5,000+ | Notes |
| --- | --- | --- | --- | --- |
| NameCheep (Namecheap) | €0 | €0 | 1.50 / 1.50 / 1.50 / 1.50 | No tiers; the start option |
| GoDuddy Reseller (GoDaddy) | €0 | €9 fee | 1.30 / 1.20 / 1.15 / 1.10 | |
| InterNetY (InterNetX) | €200 | €50 minimum, the unused part is lost | 1.15 / 1.08 / 1.05 / 1.03 | .de at 1.00 in every tier |
| OpenSRSly (OpenSRS, Tucows) | €100 | €0 | 1.25 / 1.15 / 1.08 / 1.04 | Tiers as the real four |

**Company domain.** Registering it through the partner under contract costs its wholesale a month like any domain and needs no cash at once; it renews with the contract. A name is 3 to 40 letters, digits or hyphens (not at either end) in front of a TLD from the registry table above, and must not belong to a customer. Going online (the web design and listing a line on the website) is refused until it exists.

**Company email.** Per seat and month, seats are 1 plus the employees, recomputed at each month start and booked in the ledger category "subscriptions" as `ledger.companyMail`. Anchors: hosted Exchange from German hosters about €10 a seat in 2005, Google Apps Premier Edition USD 50 a user a year from 2007 and Google Workspace USD 6 a user a month from 2020, Office 365 USD 6 a user a month from June 2011.

| Provider (pun on) | From | Price per seat and month |
| --- | --- | --- |
| Hosted Exchange by Ionose (Ionos) | 2005 | €10, falling in a straight line to €6 by 2015 |
| Goggle Workspace (Google Workspace) | 2007 | €4, €5 from 2020 |
| Lookout 365 (Outlook, Microsoft 365) | 2011 | €5, €6 from 2022 |

| Mail server | From | License | Install | Needs |
| --- | --- | --- | --- | --- |
| Postfixit (Postfix) | 2005 | Free | 4 h | 0.5 vCPU, 1 GB, 20 GB |
| Mailpig (mailcow) | 2015 | Free | 2 h | 1 vCPU, 2 GB, 20 GB |

One mail server per company, on a server or in a VM. Its address is the host's public address; on a dynamic line that address is always listed (Addresses and internet), so a basement mail server works on a business line only. While the host is down or its address is listed, delivery is impaired: order emails arrive at half the rate (`IMPAIRED_SHARE` 0.5) and invoices issued in that window get their payment day 72 hours later (`MAIL_DELAY_HOURS`, applied to the first payment day and to the day a reminder sets). Without any mail service no order email arrives (`mailShare` 0). The balance model's steady bot books Hosted Exchange for the owner and every employee from the start, signs NameCheep, and pays the wholesale of the company domain and of the domains of web customers who ordered by email, against the €15 a year those customers pay; the shift moves the medians by about 0.1 to 0.2 years.

**Organic leads in the game.** Organic leads scale with the market and with awareness instead of a flat 20: 0.4 × the city's new customers × the profile's mix × its awareness × (1 + 0.5 × (level − 1)) × the review multiplier. With the starting awareness (5% for private individuals and gamers, 2% for the rest) Frankfurt gives about 20 leads a month in 2005, and every point of awareness a campaign buys raises organic leads too. Referrals (0.005 a month per customer with happiness 70 or more) and forum posts (2 × (0.5 + s/100) a month per employee, split over hobby developers, gamers and small businesses) come from the home city. Each forum lead also adds 0.5% of the gap to the awareness of those three profiles every month.

**Website and campaigns.** Their leads come from the Marketing app's lead batches. 10% of them arrive from cities without a location of yours, spread evenly; those requests arrive greyed out with "Needs a location in London", so you can see the demand you are missing.

**Lead arrivals.** Leads arrive every hour, Poisson-distributed around the monthly rate ÷ 30.4 ÷ 24, times the hour's arrival weight: the profile's attention curve from Noticing outages, scaled so a week averages 1. Small businesses, agencies, offices, online shops and enterprises write during office hours on workdays, and everyone else writes mostly in the evening. The friend's first order and the shady request still come with the 8:00 mail. Each lead draws its need first, then picks you with its share of the choice below, times its channel's conversion.

**Choice with prices.** The softmax of Customer choice decides who wins a lead, over you and the competitors that sell the product to that profile. Each host's value also carries a price term of 0.25 × λ × 100 × (1 − price factor). Your price factor is the average ratio of your running services' prices to the market reference (friends excluded, 1 without services), so undercutting wins a bigger share only gradually, as your cheaper contracts pile up. Your scores: P = 0.5 generation + 30 + 0.2 location (100 with a location in the city, 40 without); R = 0.5 uptime (60 in the first month, then from this month's down hours with a floor of 0.05% downtime) + 0.3 support (from the first replies of the last 90 days, 75% of the promised time without tickets) + 8; C = 30 + 0.3 × the share of the profile's usual products you sell.

| Competitor | Stands in for | P | R | C | Price | Sells | Targets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ionose | IONOS, the budget giant | 55 | 60 | 70 | 0.8 | Web hosting, domains, SSL, DNS, VPS | Everyone |
| OVHeat | OVH, the wholesale provider | 70 | 65 | 50 | 0.75 | Everything | Everyone |
| Hetzna | Hetzner, the developer cloud | 85 | 70 | 40 | 0.7 | VPS, dedicated, storage, cloud, colocation | Everyone |
| Rackspice | Rackspace, the premium host | 80 | 90 | 75 | 1.3 | Everything | Everyone |
| Nitradoh | A game server host | 75 | 60 | 60 | 0.9 | Game servers | Gamers |
| WP Engyne | A managed WordPress host | 70 | 80 | 85 | 1.4 | Web hosting | Sole proprietors, small businesses, offices, agencies |

The balance model keeps the four archetypes in every segment and leaves the specialists out.

**What a lead asks for.** A lead starts from one of its line's sizes by budget (`SIZES` in `products.ts`): the smallest for low budgets, the second for medium and the largest for high. Four in ten leads settle for one SLA level less than their profile asks.

| Profile | Products asked for |
| --- | --- |
| Private individual | Web hosting |
| Gamer | Game server 60%, VPS 20%, web hosting 20% |
| Hobby developer | VPS 90%, web hosting 10%, GPU server (GPU demand) |
| Sole proprietor | Web hosting 90%, VPS 10% |
| Small business | Web hosting 60%, VPS 40% |
| Agency or startup | Web hosting 30%, VPS 70%, GPU server (GPU demand) |
| Doctor's or law office | Web hosting 90%, VPS 10% |
| Online shop | Web hosting 50%, VPS 50%, GPU server (GPU demand) |
| Enterprise | VPS 50%, dedicated 50%, GPU server (GPU demand) |

**Requirements.** A request needs a location in its city and a cluster with nodes there (a free mounted server for dedicated). A Business or Premium SLA needs a datacenter location in the city, Premium also a company at least 12 months old, and high-budget profiles a review score of 3 stars. A request that misses one arrives greyed out and becomes a lost sale with that reason when it expires.

**Reference and budget.** The market reference is the spec's market price at the basic SLA × the SLA factor × the profile's offer (0.9, 1.0 or 1.3 by budget). Each request has a hidden budget b, uniform between 0.97 and 1.24, and the customer accepts a quote q with this probability:

```math
P(\text{accept}) = \frac{1}{1 + e^{(q / \text{ref} - m) / 0.06}}, \quad m = b \cdot (1 - d) \cdot e_{\text{existing}} \cdot (1 + 0.05\,(\text{stars} - 3.5)) \cdot (1 + 0.1\,a)
```

d is the agency discount from a campaign, e is 1.15 for an existing customer and a the profile's awareness. At the reference most accept (about 85%), 20% above it about one in six. A second quote after a refusal or counter-offer has 0.35 × that chance.

**Replies.** The customer answers 4 to 24 hours after a quote. When they decline and the quote is within 0.12 of m, half of them counter at 0.97 × m × the reference; meeting the counter wins for certain. Further above they write that they have no budget. After a refusal or counter you have 48 hours for one more quote. Unanswered requests expire after 72 hours, expansion requests after 7 days.

**Winning.** An accepted quote signs the customer (payment habit drawn from Billing and payment habits) and provisions the service in the request's city at the quoted price. Without room the deal is lost as "No capacity in Frankfurt" and the customer goes elsewhere.

**Expansion.** Every upgrade ticket (2% to 4% of customers a month, see Happiness and churn) opens an expansion request for 1.5 or 2 times every resource of its service, answered in one step with the upgrade flow (`acceptUpgrade`). Winning it grows the service, in place when its server has room, and closes the ticket.

**Shady requests.** From the fourth month, about one request every three months asks for the biggest VPS, no questions asked, paid in crypto. Its budget is 1.8, so it accepts nearly any price. A won shady customer carries a hidden `shady` flag for abuse and legal follow-ups.

**Price changes.** Raising a running service's price costs happiness, lowering it wins some back, and an overpriced service keeps costing happiness every month. The numbers are in Happiness and churn, Price tolerance.

**Market research.** A market study reveals one profile in the Market app for good; it is a one-time payment booked as marketing. Studies cost €800 for a low-budget profile, €2,000 for a medium one and €4,000 for a high one, €20,400 for all nine (decision). The Demand section counts a city's buyers of a product as the city's new customers × each profile's mix × that profile's product weight, your part as the expected requests from the lead flows above (leads × product weight × your choice share × conversion), and splits the remainder over the competitors by their softmax among themselves. Code: `src/sim/30-market/research.ts`.

**Measured flow.** `npx tsx scripts/sales-flow.ts [seed] [months]` runs the real tick with a bot that quotes 3% under the reference, answers tickets, sets up a website in month 3 and runs €250 of search ads from month 6. Seed 1 gets 6 to 9 requests a month in the basement, 16 to 26 with the website and ads, and fills the basement server at about 26 customers, after which most deals are lost for capacity until you buy hardware.

## Happiness and churn

Every customer has a happiness value H from 0 to 100. Events move it up and down, it slowly drifts toward how good your offer is compared with the best competitor, and it sets the chance of cancelling at each renewal. New customers start at 70; the three starting friends start at 85.

**Events.**

| Event | Change to H |
| --- | --- |
| Ticket still open past the expected reply time | − wait penalty per hour that counts on the customer's clock (profile table) |
| Ticket closed with the right answer | +5 |
| Ticket closed with a wrong answer | −10, plus a follow-up ticket |
| An hour of outage on one of their services, once the outage has outlasted their tolerance | − outage penalty per hour that counts on the customer's clock (profile table) |
| Credit issued | +3 per 10% of the monthly fee |
| A month in which every service kept its SLA uptime | +2, at the monthly billing date |
| Price raised | −1 per 1% of increase, more past the customer's maximum (Price tolerance) |
| Price lowered | +0.2 per 1% of decrease, at most +10 |

**Drift.** On each monthly tick H moves a fifth of the way toward a target set by your value U against the best competitor's:

```math
H \leftarrow H + 0.2\,(H^{*} - H), \quad H^{*} = \operatorname{clamp}\big(70 + 0.5\,(U_{you} - U_{best}),\ 20,\ 95\big)
```

**Churn.** At each renewal the customer cancels with this probability. Monthly contracts renew monthly. Yearly contracts renew once a year and use 12× the monthly base churn.

```math
P(\text{cancel}) = \text{base} + 0.5 \cdot \max\left(0,\ \frac{50 - H}{50}\right)
```

A customer whose happiness falls below 15 leaves at the next monthly billing date, even on a yearly contract. Every cancellation arrives as a ticket first.

**Retention offers.** A retention offer gives one month free. Below H = 30 the customer refuses it. A customer who pays more than their maximum (Price tolerance) for any monthly service, after taking a twelfth off for the free month, also refuses. Otherwise they stay with a chance of (H − 30) %, so 40% at H = 70 and 60% at H = 90. A refused offer cancels the contract at once and the ticket shows "Offer refused, contract cancelled".

**Price tolerance.** Every customer has a maximum monthly price per service, hidden from the player:

```math
\text{max} = \text{market} \times \text{cap} \times t, \qquad t \in [0.9,\ 1.2]
```

The cap is the highest competitor price factor a profile still considers in Customer choice (1.3 for low budgets, 1.6 for medium, 2.5 for high), and t is drawn once per customer from the game seed. The fair price is the market price, or the profile's usual offer from Sales and quotes when that is higher (1.3 × market for high budgets). Both use the higher of this year's market price and the market price in the year the customer signed, so falling hardware prices never turn an old contract into an overpriced one.

| Rule | Value |
| --- | --- |
| Raise, any size | −1 H per 1% over the previous price |
| Raise, part above the maximum | another −2 H per 1% the new price goes further past the maximum |
| Raise past the maximum | a cancellation ticket with a chance of (price ÷ max − 1) ÷ 0.3, certain from 30% past |
| Monthly, above the fair price | −0.1 H per 1% over the fair price |
| Monthly, above the maximum | another −1 H per 1% over the maximum |
| Complaint after a raise of 5% or more | a chance of 1/40 per 1% of the raise, plus 0.5 past the maximum |
| Monthly complaint while a raised service is above the fair price | a chance of 0.5 × (price ÷ fair − 1), plus 0.3 past the maximum |

The monthly cost uses the customer's worst-priced monthly service and is taken before the churn roll. A complaint is a billing ticket ("The new price is too high"). The right reply explains the new price. A 10% credit settles it as usual, and reverting puts the service back on its price from before the run of raises, with the happiness gain of a price cut. Only one price complaint per customer is open at a time.

A 5% raise inside the maximum costs 5 happiness once and about 0.5 a month while the price stays above the fair one, which the drift toward 70 absorbs. Raising a €2 service to €10 costs all happiness at once, so the customer cancels and refuses any retention offer. Repeated small raises past the maximum lower H by 10 or more each month until the customer leaves within a few months.

In the balance model, cohorts take the same monthly cost at the bot's price factor with t at its mean of 1.05. The standard bots price at 0.8 × market and are unaffected. A probe bot at 1.2 × market ends year 5 with 39 customers instead of 43 and year 10 with €6,817 MRR instead of €7,017; at 1.4 × market it ends year 10 with 42 customers instead of 61.

**Upgrades.** Each month a customer outgrows their service with a 2% chance at low budget, 3% at medium and 4% at high budget, which creates an upgrade ticket.

**Customer clocks.** Each profile keeps one of two clocks. On business hours (Monday to Friday, 9:00 to 17:00, the same hours staff work) only those hours count; one business day is 8 business hours. Around the clock, every hour counts. A ticket is due once the reply time has passed on the customer's clock, so a ticket written Friday at 16:00 by a customer who expects a reply within one business day is due Monday at 16:00. The wait penalty only accrues in hours that count, so business-hour customers do not mind a ticket left overnight or over the weekend.

An outage goes unnoticed for the tolerance, counted on the same clock from the hour the service went down. After that each counting hour costs the outage penalty, and in the first such hour the customer may write in (30%, 60% or 90% by budget, three tickets at high budget). A private customer whose site drops on Friday evening tolerates two business days and asks on Wednesday morning; an online shop notices at once, at 3 a.m. on a Sunday too. Businesses that care around the clock are the reason to run AI bots or staff on nights.

**Profile values.** Priority support shortens the promised response to 4 hours, or 1 hour for high-budget profiles.

| Profile | Base churn per month | Outage penalty per hour | Wait penalty per hour | Reply within | Outage tolerance |
| --- | --- | --- | --- | --- | --- |
| Private individual | 2.5% | 1 | 0.3 | 2 business days | 2 business days |
| Gamer | 4.0% | 4 | 0.3 | 1 business day | 1 hour, around the clock |
| Hobby developer | 3.0% | 2 | 0.3 | 2 business days | 2 business days |
| Sole proprietor | 1.2% | 2 | 0.6 | 1 business day | 3 business hours |
| Small business | 1.0% | 3 | 0.6 | 1 business day | 2 business hours |
| Agency or startup | 1.5% | 4 | 0.6 | 1 business day | 2 business hours |
| Doctor's or law office | 0.6% | 8 | 1.5 | 4 business hours | 1 business hour |
| Online shop | 0.8% | 10 | 1.5 | 4 hours, around the clock | none |
| Enterprise | 0.4% | 15 | 1.5 | 4 hours, around the clock | none |

Private customers and hobbyists use their sites in the evening and forgive a weekend. Gamers play at night, so a game server that is down for more than an hour hurts at any time. Businesses notice an outage during their own office hours within a morning. Shops sell and enterprises run around the clock, so they expect fast replies at night and notice every minute offline.

**Balance model.** The monthly model has no hour of day. It turns a business-hours window into calendar hours by dividing by the share of business hours in a week (40 of 168), so 1 business day counts as about 34 hours. An around-the-clock customer adds the average wait for the office to open (about 15 hours: four 16-hour nights and a 64-hour weekend), since the bot runs no night shift. The steady bot hires a bookkeeper when the late payments nobody chases are worth more than the salary.

**Planned maintenance.** An outage on a machine covered by a window the customer was told about at least 24 hours ahead costs no happiness, writes no outage ticket and adds no hours down to the month, so it earns no SLA credit. Work that runs past the window counts as a normal outage from the window's end, noticed from that hour on. A window announced less than 24 hours ahead keeps half of every penalty: half the happiness loss, half the chance of a ticket and half the hours down. Online shops ask to move a window that touches a weekday between 08:00 and 20:00, and gamers decline a window that starts on a Friday or Saturday night (17:00 to 09:00); neither is covered by it until the window is moved, so their outages cost the full penalties. Moving a window is free and starts the 24 hours of notice again.

## Tickets and work rates

A low-skill customer creates about 0.3 tickets a month, so one average support agent keeps about 1,400 of them answered. Every job in the game, from tickets to cabling, is a task with a handling time, and staff work through tasks at a rate set by their skill.

**Ticket rates** per customer per month, by technical skill:

| Ticket type | Low skill | Medium skill | High skill | Handling time |
| --- | --- | --- | --- | --- |
| How-to question | 0.18 | 0.06 | 0.02 | 20 min |
| Billing question | 0.04 | 0.04 | 0.02 | 15 min |
| Abuse report | 0.005 | 0.005 | 0.02 | 30 min |
| Upgrade request | From upgrades ([Happiness and churn](#happiness-and-churn)) | | | 20 min |
| Cancellation | One per cancellation | | | 15 min |
| Suspension appeal | From suspensions ([Billing and payment habits](#billing-and-payment-habits)) | | | 15 min |
| Outage report | Per outage (below) | | | 10 min |
| Colocation install | One per hardware delivery | | | 2 h (technician) |

Gamers create abuse reports at 0.02, like high-skill customers. Each payment reminder also has a 10% chance to create a billing question.

**Outage tickets.** When an outage hits a customer, they write in with a 30% chance at low budget, 60% at medium and 90% at high budget. High-budget customers write 3 tickets, everyone else 1. A public status page halves the chance.

**Unanswered tickets.** A ticket still open this many hours after it was due is closed by the customer, with outcome Ignored. The wait penalty has been charged for every counting hour until then.

| Ticket type | Closed after, past due |
| --- | --- |
| Outage report | 72 h |
| How-to question | 5 days |
| Upgrade request, suspension appeal | 7 days |
| Billing question, abuse report, refund request | 14 days |

A ticket someone is working on stays open. Cancellations are processed at the next billing date instead.

**Control panels** change the how-to rate: cPanic ×0.8, Pleskit ×0.9, DirectAdmen ×1.2, FreePanel ×1.5.

**Work rate.** A worker with skill s (0 to 100) finishes tasks of handling time t minutes at this rate and gets each one right with the given chance:

```math
\text{tasks per hour} = \frac{60}{t} \cdot \left(0.5 + \frac{s}{100}\right), \qquad P(\text{right}) = 0.75 + 0.25 \cdot \frac{s}{100}
```

Staff work 8 hours a day, Monday to Friday, with 30 days of holiday and about 10 sick days a year. The player works whenever they click and is always right if they pick the right answer.

**Other tasks.**

| Task | Who | Handling time |
| --- | --- | --- |
| Install a server or switch | Technician | 1 h |
| Run one cable | Technician | 10 min |
| Repair a failed device, spare in stock | Technician | 2 h |
| Set up a port | Network engineer | 15 min |
| Set up a peering session | Network engineer | 2 h |
| Sign a transit contract | Network engineer | 1 day |

**AI support bot.** It works 24 hours a day at 10× the rate of a skill-50 agent, is right 85% of the time, never improves, and only takes how-to and billing questions. It costs €1,500 per month when it unlocks.

## Billing and payment habits

Invoices are due 14 days after they go out. Most customers pay on time, and the rest only pay once the matching dunning step is sent. A step the player never sends means that money never arrives while the service keeps running.

**Payment habits** by budget. Each invoice rolls once against this table to decide which step makes the customer pay.

| Budget | On time | After reminder | After first dunning notice | After final notice | Never |
| --- | --- | --- | --- | --- | --- |
| Low | 82% | 10% | 4% | 2% | 2% |
| Medium | 90% | 6% | 2% | 1% | 1% |
| High | 65% | 30% | 4% | 1% | 0% |

**Fees and collections.** The first dunning notice adds a €5 fee and the final notice €10. A debt handed to collections returns 30% of its value 30 days later, and the customer is gone.

**Suspension.** Suspending a customer costs 15 happiness and opens a billing ticket. While suspended, the customer pays with a 35% chance each day, or 20% with a bad payment habit. A bad payer still suspended after 14 days leaves with a 50% chance, and the debt goes to collections.

**Suspension of high-budget customers.** Offices, online shops and enterprises lose 30 happiness instead of 15 and pay with a 60% chance each day. With a 60% chance their suspension opens a suspension appeal instead of the billing ticket, at most once per invoice.

| Appeal action | Effect |
| --- | --- |
| Unsuspend | Services back online, 7-day payment extension, +15 happiness. The customer pays 1 to 5 days later with an 85% chance; otherwise the suspend rule suspends again when the extension ends. |
| Keep suspended | Services stay offline, −15 happiness. |
| Reply "Await the payment" | Right answer when the customer forgot to pay or the payment is on its way; wrong for the other two topics. |

Resolving the ticket adds the usual +5 happiness on top. Handling an appeal takes 15 minutes.

**Billing rules.** The Automation entry in the Billing app sends the reminder, dunning and final notices on schedule, suspends after 7, 14 or 30 days overdue, and hands a debt to collections after 42, 60 or 90 days overdue once the final notice is out. Collections starts Off.

**Time per action.** Every employee action takes time from their workday, so one employee can't carry the whole company. Staff divide these times by their speed (0.5 plus skill/100, so skill 50 takes the times as listed); bots work at twice the speed. The code keeps them in `ACTION_MINUTES` (src/sim/47-staff/activity.ts), and ticket times in `MINUTES` (the ticket table above).

| Action | Who | Time |
| --- | --- | --- |
| Answer or resolve a ticket | Support agent | Ticket handling time above |
| Check an invoice, before every billing action | Bookkeeper or accountant | 6 min |
| Send a payment reminder | Bookkeeper | 15 min |
| Send a dunning notice | Accountant | 30 min |
| Send a final notice | Accountant | 30 min |
| Hand a debt to collections | Accountant (final notices) | 30 min |
| Suspend a customer's services | Accountant | 60 min |
| Resume a customer's services | Player | 15 min |
| Run campaigns, for the full boost | Marketing manager | 180 min a workday |
| Look after review platforms, for the full boost | Marketing manager | 60 min a workday, after campaigns |
| Hardware, server or PHP operation | Technician | 60 min |

A billing action is the check plus the action, so a reminder takes 21 minutes and a suspension 66. Staff take one action per invoice per hour, the next dunning step before a suspension, oldest due date first. A marketing manager with fewer hours than a task needs gives that share of its boost: a 2-hour manager gives two thirds of the campaign boost and nothing for reviews. Forum posting scales with hours the same way.

The balance model books 6 staff minutes per customer and month for payments, which matches the times above for a late-paying customer mix. Its steady bot hires a bookkeeper once the late payments left unchased in a month are worth more than a bookkeeper's salary; with that rule none of 20 steady runs goes bankrupt, and level 4 arrives in 2017.6 instead of 2018.5.

**Working hours.** The player sets each employee's day to 2, 4, 6 or 8 hours (8 at hiring). The day starts at 9, Monday to Friday, so a 2-hour employee works 9 to 11. Pay is pro rata: 8 hours is the full salary, 2 hours a quarter. An action starts only if it ends within the employee's hours; whatever is left waits for the next workday. Changing the hours pays out the salary owed so far at the old hours, and the new hours count from then.

## Datacenters and space

**Racks.** Racks keep their price over the years: 24U €350, 42U €800, 47U €1,000. The basement only fits a 24U rack.

**Space.** Prices are 2026 values and keep their price over the years (m = 1). Power is billed per kWh drawn: the business price × the datacenter's power factor, which covers its cooling. A rack that draws more than its position's kW limit trips its breaker and goes offline.

| Space | Price | Lead time | Minimum term | Needs |
| --- | --- | --- | --- | --- |
| Rack share, 1/8 (5U) / 1/4 (10U) / 1/2 (21U) / full (42U) | 0.2× / 0.35× / 0.6× / 1.1× the position price | 2 days | 1 month | Nothing |
| Rack positions, 1 to 4 | The datacenter's position price each | 7 days | 1 month | Nothing |
| Cage, 4 / 8 / 16 positions | 3.4× / 6.4× / 12× the position price | 30 days | 12 months | Cage unlock; datacenters with cages |
| Private suite, 20 / 40 positions | 15× / 28× the position price | 90 days | 36 months | Private suite unlock |
| Own datacenter | Set when it is designed | | | Own datacenter unlock |

**Rack shares.** The smallest space is a 1/8 share of the provider's rack (5U). Any datacenter with free room rents shares and positions from the first day. A share comes with the provider's rack, you mount hardware into it directly, and its sizes are 5U, 10U, 21U and 42U (a full rack). The price is the multiplier above times the datacenter's position price:

| Datacenter (position price) | 1/8 | 1/4 | 1/2 | Full |
| --- | --- | --- | --- | --- |
| Hetzler FSN, Falkenstein (€160), the cheapest | €32 | €56 | €96 | €176 |
| Hetzler Park, Frankfurt (€180), the cheapest in the home city | €36 | €63 | €108 | €198 |
| mainqubes FRA, Frankfurt (€450) | €90 | €158 | €270 | €495 |
| Equinox FR5, Frankfurt (€750) | €150 | €263 | €450 | €825 |

**Extra power on a share.** A provided share cannot take feed B or a high-density feed. It can book extra power in steps of 0.25 kW, up to the share's base limit again (the datacenter's kW per position divided by the share size, so a limit of at most twice the base). A step costs 15% of the position price times the datacenter's power factor per month, so a full extra kW costs about 60% of a position. It is billed with the share's rent under the same ledger line, and a booking or a reduction takes effect after 3 days. A rack over its limit still trips. Anchor: colocation power sold per amp at roughly €30 to 60 per 0.5 A step in 2010s Frankfurt. At Hetzler Park (€180, factor 1.1) a step costs €30 a month; at mainqubes FRA (€450, factor 1.3) it costs €88.

**Availability.** Datacenters are not endless. Each one has a floor capacity in positions that grows in expansion phases over the years up to a final size, and most of it is rented by competitors you never see. You can only rent what is free right now.

| Datacenter size | Positions at opening | Expansion | Final size |
| --- | --- | --- | --- |
| Large (Equinox, Interaction, Global Snitch, Tellyhouse, Data5, Digital Reality) | 300 | +150 every 3 years | 1,200 |
| Medium (Hetzler, Iron Molehill, NTD, Next Lair, Arubaba Hub, Boris Network, CoreSpite, Telex) | 120 | +60 every 4 years | 400 |
| Small (mainqubes, Spree Colo, Docklands Data, Green.chz, SkyBlink) | 40 | +20 every 5 years | 120 |

- **Competitors.** Their share of a datacenter starts at 85% to 97% of capacity, drawn from the seed. Each month every competitor position cancels with a 1.5% chance. Waitlist holds are then granted from the freed space, and competitors fill the remaining free space down to a level drawn evenly between 0% and 4% of capacity. They never take space held for the waitlist.
- **Expansion.** Each expansion phase opens all its new positions on 1 January. In January, February and March competitors take a sixth of the new positions each month, so about half within 3 months, and from April the usual monthly fill applies.
- **What can be rented.** Cages and suites need that many free positions, which for a suite usually means right after an expansion. Rack shares come from the provider's share racks: one position holds 8 eighths.
- **Waitlist.** When a datacenter has too little free space for what you want, you can join its waitlist. When enough space frees up, you get a notification, and the space is held for you for 7 days.
- **Consequence.** You can't grow in one building forever, which pushes you to spread over several datacenters or build your own.

**Moving a rack.** €300 and 1 day within a city, €1,200 and 3 days to another city, €4,000 and 10 days across the Atlantic (air freight and customs). The rack's servers are offline until it arrives. A rack share comes with the provider's rack, so its power limit is the share × the datacenter's kW per position, and it can't be moved or sold. You mount hardware into it directly.

**Catalog.** Two to four datacenters per city; the datacenter towns Kerkrade and Falkenstein have one each. Exchanges new to this table: Franz-IX (Paris), BeCIX (Berlin), MIXup (Milan), VieX (Vienna), SwizzIX (Zurich), ECKS-IX (Düsseldorf), N-ICKS (Nuremberg), IN-EXCESS (Munich), Equinox IX (Ashburn), NYIKES (New York), CHI-KICKS (Chicago), Y'ALL-IX (Dallas), Any3 (Los Angeles).

How the newer locations are priced:

- **Düsseldorf** is Germany's second hub after Frankfurt, with fewer carriers and lower land and power costs, so its positions cost about 13% less than the Frankfurt equivalent (Equinox DU1 €650 against FR5 €750).
- **Kerkrade (SkyBlink Eygelshoven)** is the small independent by the German border that hosters pick for cheap space with many carriers: €300 a position, 20 carriers, €60 cross-connects and fast remote hands, but no exchange on site and no cages.
- **Nuremberg and Falkenstein** are the budget hoster parks. Hetzler's own halls are the cheapest space in the game (€170 and €160) with one carrier, the provider's own network; Boris Network NBG is the carrier-neutral alternative with N-ICKS on site.
- **Munich** prices sit between Frankfurt and Berlin.
- **North America** prices are 2026 US retail converted at about €0.90 to the dollar. Space costs about the same as in Germany, but power is much cheaper, so the power factors are lower (1.05 to 1.2, against 1.3 to 1.5 in Europe). New York and Los Angeles carry a metro premium. Ashburn has the most carriers in the game (60 at Equinox DC2), and Dallas is the cheapest American market.
- Datacenters have no opening years yet; every one is open from 2005, which matches the real buildings closely enough for the American and German hubs.

| Datacenter | City | Carriers | Exchange | Feeds | Backup | Green | kW per position | Position per month | Power factor | Cross-connect | Remote hands | Certified | Cages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Equinox FR5 | Frankfurt | 30 | DE-KICKS on site | A+B | UPS, generator | Yes | 8 | €750 | 1.4 | €250 | €150/h, 1 h | Yes | Yes |
| Interaction FRA | Frankfurt | 25 | DE-KICKS on site | A+B | UPS, generator | No | 6 | €600 | 1.3 | €200 | €120/h, 2 h | Yes | Yes |
| mainqubes FRA | Frankfurt | 12 | DE-KICKS by cross-connect | A+B | UPS, generator | Yes | 6 | €450 | 1.3 | €150 | €100/h, 4 h | Yes | Yes |
| Hetzler Park | Frankfurt | 1 | None | Single | UPS, generator | Yes | 4 | €180 | 1.1 | €80 | €60/h, 8 h | No | No |
| Tellyhouse North | London | 30 | LYNX on site | A+B | UPS, generator | No | 6 | €800 | 1.5 | €300 | €160/h, 1 h | Yes | Yes |
| Global Snitch LON | London | 20 | LYNX by cross-connect | A+B | UPS, generator | Yes | 8 | €700 | 1.4 | €250 | €140/h, 2 h | Yes | Yes |
| Docklands Data | London | 3 | None | Single | UPS | No | 4 | €350 | 1.2 | €100 | €80/h, 8 h | No | No |
| Equinox AM3 | Amsterdam | 25 | HAMS-IX on site | A+B | UPS, generator | Yes | 8 | €650 | 1.3 | €220 | €140/h, 1 h | Yes | Yes |
| Iron Molehill AMS | Amsterdam | 10 | HAMS-IX by cross-connect | A+B | UPS, generator | Yes | 10 | €500 | 1.2 | €180 | €110/h, 4 h | Yes | Yes |
| Tellyhouse Voltaire | Paris | 25 | Franz-IX on site | A+B | UPS, generator | No | 6 | €650 | 1.3 | €220 | €140/h, 2 h | Yes | Yes |
| Data5 Marcoussis | Paris | 8 | Franz-IX by cross-connect | A+B | UPS, generator | Yes | 10 | €450 | 1.2 | €150 | €100/h, 4 h | Yes | Yes |
| NTD Berlin 1 | Berlin | 12 | BeCIX on site | A+B | UPS, generator | Yes | 6 | €500 | 1.3 | €150 | €110/h, 2 h | Yes | Yes |
| Spree Colo | Berlin | 3 | None | Single | UPS | Yes | 4 | €250 | 1.2 | €90 | €70/h, 8 h | No | No |
| Data5 Milano | Milan | 10 | MIXup on site | A+B | UPS, generator | No | 6 | €500 | 1.3 | €160 | €110/h, 2 h | Yes | Yes |
| Arubaba Hub | Milan | 4 | None | A+B | UPS, generator | Yes | 6 | €350 | 1.2 | €100 | €80/h, 4 h | Yes | No |
| Interaction VIE | Vienna | 15 | VieX on site | A+B | UPS, generator | No | 6 | €500 | 1.3 | €160 | €120/h, 2 h | Yes | Yes |
| Next Lair VIE | Vienna | 4 | VieX by cross-connect | Single | UPS, generator | No | 4 | €300 | 1.2 | €100 | €80/h, 4 h | No | No |
| Equinox ZH4 | Zurich | 15 | SwizzIX on site | A+B | UPS, generator | Yes | 8 | €800 | 1.5 | €250 | €160/h, 1 h | Yes | Yes |
| Green.chz Lupfig | Zurich | 6 | SwizzIX by cross-connect | A+B | UPS, generator | Yes | 6 | €550 | 1.3 | €180 | €120/h, 4 h | Yes | Yes |
| Equinox DU1 | Düsseldorf | 18 | ECKS-IX on site | A+B | UPS, generator | Yes | 8 | €650 | 1.35 | €220 | €140/h, 1 h | Yes | Yes |
| Interaction DUS | Düsseldorf | 14 | ECKS-IX by cross-connect | A+B | UPS, generator | No | 6 | €520 | 1.3 | €180 | €110/h, 2 h | Yes | Yes |
| NTD Düsseldorf 1 | Düsseldorf | 10 | ECKS-IX by cross-connect | A+B | UPS, generator | Yes | 6 | €430 | 1.25 | €140 | €100/h, 2 h | Yes | Yes |
| SkyBlink Eygelshoven | Kerkrade | 20 | None | A+B | UPS, generator | Yes | 6 | €300 | 1.15 | €60 | €60/h, 2 h | Yes | No |
| Hetzler NBG | Nuremberg | 1 | None | Single | UPS, generator | Yes | 4 | €170 | 1.1 | €80 | €60/h, 8 h | No | No |
| Boris Network NBG | Nuremberg | 10 | N-ICKS on site | A+B | UPS, generator | Yes | 6 | €420 | 1.25 | €150 | €100/h, 2 h | Yes | Yes |
| Hetzler FSN | Falkenstein | 1 | None | Single | UPS, generator | Yes | 4 | €160 | 1.1 | €80 | €60/h, 8 h | No | No |
| Equinox MU1 | Munich | 15 | IN-EXCESS on site | A+B | UPS, generator | Yes | 8 | €700 | 1.4 | €230 | €150/h, 1 h | Yes | Yes |
| Interaction MUC | Munich | 10 | IN-EXCESS by cross-connect | A+B | UPS, generator | No | 6 | €550 | 1.3 | €180 | €120/h, 2 h | Yes | Yes |
| Equinox DC2 | Ashburn | 60 | Equinox IX on site | A+B | UPS, generator | No | 8 | €650 | 1.15 | €200 | €130/h, 1 h | Yes | Yes |
| Digital Reality ACC | Ashburn | 25 | Equinox IX by cross-connect | A+B | UPS, generator | No | 10 | €480 | 1.1 | €150 | €100/h, 2 h | Yes | Yes |
| CoreSpite VA1 | Ashburn | 15 | Equinox IX by cross-connect | A+B | UPS, generator | No | 8 | €420 | 1.1 | €120 | €90/h, 4 h | Yes | Yes |
| Equinox NY4 | New York | 45 | NYIKES on site | A+B | UPS, generator | No | 8 | €800 | 1.4 | €250 | €160/h, 1 h | Yes | Yes |
| Telex 60 Hudson | New York | 35 | NYIKES by cross-connect | A+B | UPS, generator | No | 5 | €700 | 1.45 | €220 | €150/h, 2 h | Yes | Yes |
| Digital Reality 350 Cermak | Chicago | 40 | CHI-KICKS on site | A+B | UPS, generator | No | 8 | €550 | 1.2 | €180 | €120/h, 2 h | Yes | Yes |
| CoreSpite CH1 | Chicago | 15 | CHI-KICKS by cross-connect | A+B | UPS, generator | No | 8 | €450 | 1.15 | €140 | €100/h, 4 h | Yes | Yes |
| Equinox DA1 | Dallas | 30 | Y'ALL-IX on site | A+B | UPS, generator | No | 8 | €500 | 1.1 | €170 | €120/h, 2 h | Yes | Yes |
| Digital Reality DFW | Dallas | 12 | Y'ALL-IX by cross-connect | A+B | UPS, generator | No | 10 | €400 | 1.05 | €130 | €90/h, 4 h | Yes | Yes |
| CoreSpite One Wilshire | Los Angeles | 60 | Any3 on site | A+B | UPS, generator | No | 6 | €750 | 1.45 | €230 | €150/h, 1 h | Yes | Yes |
| Equinox LA1 | Los Angeles | 30 | Any3 by cross-connect | A+B | UPS, generator | No | 8 | €650 | 1.4 | €210 | €140/h, 2 h | Yes | Yes |

**Basement.** One position, a 24U rack at most, 3 kW at most (a household circuit), no backup, the household power price (business × 1.6) and the home line as its only uplink.

**Home line.** The basement can switch to another line in the Locations app. The old line stays up until the new one is installed, and ordering the current line again cancels a pending switch. Every line is billed as rent on the first of each month, from the month after it goes live. New games start without a line. Lines with a static IP are business lines: they cost more and bring a /29 of addresses (Addresses and internet). Lines stay on offer once they appear. The basement's traffic leaves through the line's upload (Traffic and bandwidth). When the evening peak is over it, the sites served from the basement slow down: each hour a basement service costs its customer the slow-node penalty, 0.1 × the share of traffic the line drops, and writes a slow-site ticket with 0.1 × that share (Usage curves and overcommit). The Locations app shows the line's peak upload over the last 7 days next to its speed, the Network app shows it on the home line's card, and the first hour a line runs full sends one notification per line.

| Line | Provider | Down / up (Mbit/s) | Per month | From | Install days | Static IP |
| --- | --- | --- | --- | --- | --- | --- |
| DSL 16000 | Deutsche Telekomm | 16 / 1 | €45 | 2005 | 7 | No |
| DSL 16000 Business | Deutsche Telekomm | 16 / 1 | €59 | 2005 | 14 | Yes |
| SDSL 2048 | 1&2 | 2 / 2 | €129 | 2005 | 14 | Yes |
| VDSL 50 | Deutsche Telekomm | 50 / 10 | €45 | 2007 | 14 | No |
| VDSL 50 Business | Deutsche Telekomm | 50 / 10 | €99 | 2008 | 14 | Yes |
| Cable 100 | Vodafoam | 100 / 6 | €40 | 2010 | 10 | No |
| VDSL 100 | Deutsche Telekomm | 100 / 40 | €50 | 2014 | 14 | No |
| VDSL 100 Business | Deutsche Telekomm | 100 / 40 | €129 | 2014 | 14 | Yes |
| Cable 400 | Vodafoam | 400 / 25 | €60 | 2016 | 10 | No |
| Business Fiber 1000 | 1&2 | 1000 / 1000 | €350 | 2018 | 30 | Yes |
| Fiber 1000 | Deutsche Glasfasel | 1000 / 500 | €90 | 2019 | 30 | No |
| Cable 1000 | Vodafoam | 1000 / 50 | €80 | 2019 | 10 | No |

## Addresses and internet

Code: `src/sim/10-catalog/addresses.ts` (numbers), `src/sim/60-infra/addresses.ts` (state and upkeep), `src/sim/90-actions/addresses.ts` (actions). Design in gdd.md, Addresses and internet.

**Private addresses.** Every server and VM gets one from its location's range and never manages it: 192.168.1.x for basement servers, 192.168.2.x for basement VMs, 10.n.0.x and 10.n.1.x in the n-th location.

**Home line addresses.** A dynamic line has one address, held by the router and shared by every basement machine; it changes with the forced disconnect every night at 03:00 (Deutsche Telekom's 24-hour disconnect). A static (business) line brings a /29: the router's address and four more to assign, and more at €3 a month each. Only web hosting runs behind a shared address, so a dynamic line sells nothing else; every other line needs a static line in the basement.

**Nightly reconnect.** A dynamic line is offline for 3 minutes at 03:00, below what billing counts. Customers who run a business (small business, agency, office, online shop, enterprise) notice it at once: half their outage penalty every night, which leads to churn. Nobody else notices. Business customers still buy on a dynamic line.

**Datacenter addresses.** Every server in a rented location holds its own IPv4, bought from the provider when none is free. Every VPS, game server, cloud server, VPN, colocation and dedicated server in the basement needs an address of its own; a sale without a free one is lost ("Needs a free IPv4 address"). Provider IPv4 per address per month, by year and by the number the company rents:

| Year | Price | | Count | Share paid |
| --- | --- | --- | --- | --- |
| to 2011 | €1.00 | | 1 to 16 | 100% |
| 2019 (run-out) | €2.00 | | 17 to 64 | 80% |
| 2021 | €3.00 | | 65 to 256 | 60% |
| 2024 on | €3.50 (AWS's $0.005 an hour) | | 257 on | 45% |

Prices between the years are straight lines. Anchors: RIPE NCC's last /8 policy (September 2012), RIPE's run-out (25 November 2019), the transfer market of the 2020s.

**Customers' address needs.** A dedicated IPv4 is a priced unit ("Per dedicated IPv4") on web hosting, VPS, game, cloud, dedicated and colocation lines; the market rate is half again the provider price, at least €2. Every game server order asks for one. Web hosting orders ask for one for SSL before SNI and for sending mail: small business and agency 15%, office 20%, online shop 60%, enterprise 30% until 2010, falling to none by 2016 (Windows XP's end in 2014). From 2012, 3% more orders a year ask for IPv6 too, at most 40%.

**IPv6.** Datacenters offer it from 2010, home lines from 2013 (Telekom dual stack, December 2012). One address per machine, €0.10 a month at a provider, free on a home line.

**Own networks.** With a rented location the company can join RIPE NCC as a LIR: €2,000 sign-up, €1,400 a year, an AS number and the free allocation of the year, a /21 (2,048 addresses) until September 2012, a /22 (1,024) until November 2019 and a /24 (256) after. More /24s come from the transfer market at a price per address: €7 (2014), €10 (2016), €17 (2018), €22 (2020), €40 (2021), €50 (2022), €35 (2024), €30 (2026). A block is announced from one rented location, where its addresses become free; own addresses cost nothing a month.

**Reputation.** Every IPv4 has a mail reputation from 0 to 100: 80 when new, 70 on a static line, 20 on a dynamic line, whose addresses always sit on dynamic-range blocklists. Each 1,000 spam mails a day cost 5 points; a compromised panel host sends 12,000 a day and a spamming customer 2,000. Abuse reports cost points too: phishing 15, spam 10, attack 5, copyright 3. Below 30 the address is listed and stays listed until it is back at 50; a clean day adds 1 point. A delist request, once the spam stopped, clears the listing after 24 hours and adds 20 points. Mail customers behind a listed address write in about bounced mail with a 1% chance a day.

**Balance.** Steady bot level medians before and after: 2006.0, 2006.8, 2008.6, 2011.9, 2017.9 before; 2006.2, 2006.9, 2008.7, 2011.9, 2018.1 after. Solo: 2005.8, 2006.5, 2008.3, 2012.8 before; 2005.8, 2006.5, 2008.3, 2012.9 after. The bot starts on the business DSL line, pays extra line addresses for its VPS and game servers in the basement and provider addresses in the datacenter. Level 2 may land up to a quarter later than the pacing guard allowed before. The happiness harness (scripts/happiness.ts, seeds 1 to 6) starts on the business DSL line and keeps one spare line address; its December medians move from 52 customers, €684 MRR and happiness 92 before to 44.5 customers, €728 MRR and happiness 90.5 after.

## Noticing outages

Code: `src/sim/10-catalog/attention.ts`. A customer notices an outage when the hazard summed over its hours passes a threshold drawn per outage (exponential, mean 1). The hazard of an hour is the segment's attention at that hour (0 to 1) times its sensitivity, times a private customer's own pace. An outage hurts only from the hour it is noticed: the outage penalty in every counted hour after, and the outage ticket chance in that hour. Saturated datacenters and grid outages weigh by attention too: the saturation penalty and ticket chance scale with the hour's attention, and a grid outage brings refund requests and reviews only from customers who noticed its dark minutes.

| Segment | Who | Sensitivity | Attention |
| --- | --- | --- | --- |
| Game | Every game server | 3 | Evenings 0.9 from 19:00 (1.0 on Friday and Saturday, the nights before a free day), 0.05 during work hours, 0.5 on free days, 0.01 from 02:00 to 09:00 after a work night, 0.6 at 02:00 falling to 0.01 by 05:00 after a free night |
| Business | Small business, agency, office, online shop, enterprise | 2 | 1.0 from 08:00 to 18:00 on workdays, 0.02 at night, 0.1 on weekend days |
| Private | Everyone else | 0.015 | 0.3 at 07:00, 0.5 at noon, 1.0 at 18:00, 0.05 at midnight, 0.01 at 02:00 |

A private customer's pace is log-normal with spread 0.8: the median takes about three and a half days, about one in six notices within half a day, one in four takes ten days or more and one in ten twenty days or more. A game server outage from 04:00 on a Tuesday lasting two hours goes unnoticed more than nine times in ten, so night maintenance on game servers is safe; one at 21:00 on a Saturday is noticed within the hour.

## Pear One subscriptions

Prices are for 2005 and rise 8% every January. With a 10% chance each year, Pear announces an extra 15% to 30% "price adjustment" a month ahead. Paying yearly in advance costs 10 months instead of 12.

| Module | App | Base per month | Plus | Needs |
| --- | --- | --- | --- | --- |
| Starter | Locations, Shop, Customers, Support (shown as Email), Billing (manual), Finance (account statement), Bank, Research, Settings, Pear Store | Free | | Start |
| Monitoring | Monitoring | €10 | €0.50 per monitored device | Monitoring skill |
| Nagiosaurus | Monitoring tab in Security | €15 | | Monitoring skill |
| Virtual machines | Virtual machines | Free | | A hypervisor installed |
| Network | Network | Free | | None; buying transit and peering needs Network operations |
| Products | Products | €15 | | Product management skill |
| Billing automation | Billing rules, invoice runs | €30 | €0.10 per active customer | Level 2 |
| Staff | Staff | €20 | €5 per employee | Employee management skill |
| Marketing | Marketing | €20 | | Marketing campaigns skill |
| Market | Market | €15 | | Market research skill |
| Dock badges | Upgrade: counts on dock apps | €5 | | Monitoring skill |
| Searchlight | Upgrade: global search on Ctrl+K and Cmd+K | €2 | | Start |
| Widgets | Upgrade: one desktop widget each | €1 (calendar, open tickets, cash, customers), €2 (monthly revenue, level) | | Start |
| AI bots | ChadGPT Support €50, Clipsy Reminders €100, per bot | ChadGPT: every reply in tokens, see [ChadGPT usage](#chadgpt-usage) | | Automation skill |
| Storefront | The customer shop in Sales | €40 | 0.5% of shop revenue | Shop unlock |

**Support desks.** Each desk is a per-seat Pear Store item: the monthly price is charged once for the owner plus once for every employee with the support role (bots do not count), with the yearly rise of 8%, at install and at every month start. The desk is on sale from its year. Anchors: osTicket has been free and open source since 2005, Zendesk was founded in 2007 at about USD 49 a seat, Freshdesk in 2010 at about USD 15 a seat, FreeScout in 2018 and is free.

| Desk | Pun on | On sale from | Monthly per seat, base price | Features |
| --- | --- | --- | --- | --- |
| OsTickit | osTicket | 2005 | €0 | kind filters |
| Zendusk | Zendesk | 2007 | €49 | filters, search, assignment, reply templates, response timers, customer card, reports |
| Freshdusk | Freshdesk | 2010 | €15 | filters, search, assignment, reply templates, response timers |
| FreeScoot | FreeScout | 2018 | €0 | filters, search, assignment |

Installing pays the first month at once and is refused without the cash for it; later months are billed on the 1st as "Pear One" in the ledger. Cancelling stops billing and keeps the skill. Saves from before the Pear Store keep every widget, billed like a new purchase. The per-device, per-customer and per-employee extras and the surprise price adjustments are not in the game yet.

The monitoring and virtualization products' own licences (see the software choices) come on top of the Pear module.

**In-app purchases.** One-off extras inside an expansion, priced per use: an instant invoice run outside the monthly cycle (€2), an alert text message (€0.10 each), an extra dashboard slot (€3 per month), a priority remote-hands booking (€25).

## Leasing

| Lessor | Parody of |
| --- | --- |
| Grenkel Leasing | Grenke |
| Deutsche Leasling | Deutsche Leasing |
| BNP Parasol Leasing | BNP Paribas Leasing |

Each lessor offers one term (12, 24 or 36 months) per cart. The total paid over the term is the cash price × a factor drawn between 1.06 (a good offer) and 1.40 (a bad one), split into equal monthly payments that start at the next month start. Offers are drawn from the game seed, the month and the cart total, so they hold for the rest of the month. Buying out early costs the remaining payments.

## Hardware, power and failures

A G1 server costs about €26 a month in power in 2005; a G7 costs €89 in 2026 but carries 128 times the RAM. Old hardware also fails more often, so replacing it saves on power, space and outages at once.

**Power cost** per location per month, with W the draw of each device and PUE the overhead for cooling:

```math
\text{power cost} = \sum \frac{W}{1000} \cdot 730 \cdot \text{PUE} \cdot \text{price per kWh}
```

| Location | PUE | Billing |
| --- | --- | --- |
| Basement | 1.0 | Household price |
| Rack positions, cage or suite | The datacenter's power factor | City business price × power factor; a rack above its position's kW limit trips |
| Own room | 1.6 | City business price |
| Own datacenter | 1.4, or 1.2 with liquid cooling | City business price, or a custom contract: 3 years fixed at 10% below the current price |

Only devices that are switched on and have a plugged-in, working power supply count as W. Plugging and unplugging a supply is free; a device that gets power from its first supply boots for 1 hour.

**Buying and selling.** Hardware arrives 72 hours after ordering in 2005, falling in a straight line to 24 hours in 2015 and staying there (`deliveryHours`). Until it arrives a unit is in transit and cannot be mounted, sold or shipped; the Cart shows the wait as "Arrives in 3 days". A company that owns no server yet gets its orders at once, so the first server is in the stockroom the moment it is bought (the starter rule). Spares taken out of a device go to storage at once. Bought hardware goes to storage, and mounting it into a rack is instant and free. Resale value falls in a straight line from 100% to 80% of the price over the first month, then in a straight line to 20% over the next 24 months, and stays at 20%. Racks sell the same way; spare parts sell at the current part price. A spare-parts kit costs 5% of the device's price and turns a repair into a 2-hour task.

**Failures.** Each device has a base annual failure rate (AFR), raised in its first 3 months and again after 3 years of age:

```math
\text{AFR}(a) = \text{base} \cdot e(a) \cdot \big(1 + 0.4 \cdot \max(0,\ a - 3)\big), \qquad e(a) = \begin{cases} 1.5 & a < 0.25 \\ 1 & \text{otherwise} \end{cases}
```

Here a is the age in years, and the chance of failing in any game hour is AFR ÷ 8,760. A 6-year-old server fails 17.6% of the time per year.

| Device | Base AFR | Effect of a failure |
| --- | --- | --- |
| Server | From its components (see Components) | Depends on the component; see Wear, failures and maintenance in the GDD |
| Access or core switch | 2% | Everything wired only to it goes offline |
| Edge router | 1.5% | Its uplinks go down; traffic spills to other exits if there are any |
| UPS | 3% | The next grid outage takes the room down |
| Cooling unit | 5% | The room overheats; servers start failing at 4× their rate after 2 hours |

Without a spare kit in stock, a repair waits for a delivery first.

**Components.** Each component's chance of failing in a year depends on whether it is past its life expectancy, and is multiplied by the manufacturer's failure factor and by 2 while the device runs hot from a failed fan. The chance per game hour is the yearly rate ÷ 8,760.

| Component | Life expectancy | Yearly failure rate before | After | Part price | Swap while running |
| --- | --- | --- | --- | --- | --- |
| HDD | 5 years | 1.5% | 8% | €120 | In RAID |
| SSD | 5 years | 0.8% | 4% | €150 | In RAID |
| NVMe | 5 years | 0.6% | 3% | €200 | In RAID |
| Power supply | 7 years | 1% | 6% | €150 | With two |
| Fan | 6 years | 1% | 7% | €25 | Yes |
| RAM stick | 12 years | 0.2% | 0.6% | €60 | No |
| Mainboard | 12 years | 0.3% | 1% | €600 | No |
| CPU | 15 years | 0.05% | 0.2% | €400 | No |
| Network card | 10 years | 0.3% | 1% | €80 | No |

A server has 4 fans; a switch or router 2 fans, 1 or 2 power supplies and a board that fails like a mainboard. The part price column is the reference price of an unsized spare and sets the insurance premium; the shop sells parts at the prices of Part prices by year.

**Chassis slots.** Each server line has a fixed number of DIMM slots, drive bays, PCIe slots and power supply bays. Sockets are 2 (1 for ARM, backup and archive). The DIMM column interpolates between the generations given: G1 and G2 share the G1 value, G3 and G4 the G3 value, G5 and G6 the G5 value.

| Line | DIMM slots G1 / G3 / G5 / G7 | Bays | PCIe | PSU bays |
| --- | --- | --- | --- | --- |
| Balanced 1U, Compute-dense 1U, ARM 1U | 8 / 12 / 16 / 32 | 4 × 3.5" to G2, 8 × 2.5" at G3, 10 NVMe-capable from G4 | 2 | 2 |
| Memory-optimized 2U | 16 / 24 / 32 / 48 | 8 × 2.5" to G3, 8 NVMe-capable from G4 | 4 | 2 |
| Storage 2U | 8 / 12 / 16 / 24 | 12 × 3.5" to G5, 12 NVMe-capable from G6 | 4 | 2 |
| Backup storage 4U | 8 / 12 / 16 / 24 | 36 × 3.5" | 4 | 2 |
| Archive storage 4U | 8 / 8 / 16 / 16 | 60 × 3.5" | 2 | 2 |
| GPU 4U | 16 / 24 / 32 / 48 | 8 NVMe-capable | 8 (a GPU takes 2) | 2 |

Anchors: Dell PowerEdge 1950 (2006) has 8 DIMMs, 4 × 3.5" or 6 × 2.5" bays and 2 PCIe slots; the R630 (2014) has 24 DIMMs and 10 × 2.5" bays with 4 NVMe; the R660 (2023) has 32 DIMMs and 10 NVMe bays. A 2.5" bay takes SATA or SAS drives, an NVMe-capable bay also takes NVMe drives, and a 3.5" bay takes 3.5" drives only (a 3.5" SSD counts as a 3.5" drive). The storage line moves to NVMe-capable bays when its generation ships NVMe drives. The memory line outgrows the generation's standard stick, so its presets use sticks of twice the size until they fit the DIMM slots.

A part has a size: GB for RAM sticks and drives, cores for CPUs. The preset splits the model's RAM, drive capacity and cores evenly over its sticks, drives and sockets, so the capacity of a bought server is the number in its spec. Capacity comes from the working parts: a failed stick or CPU stops counting. All installed drives are array members, and the smallest sets the size each contributes, so RAID usable space is the level's formula over the drive count times the smallest drive. A failed drive stays in the array until replaced. A mirror pairs drives, so an odd drive count in RAID 1 or RAID 10 leaves one drive unused.

**Bare chassis, extras and parts.** A bare chassis costs the preset price (with the brand factor) minus the CPUs, RAM and drives of the preset at the year's part prices (Part prices by year), and never less than 25% of the preset price. Extras and parts cost the year's part price for their size each, and the brand factor does not apply to parts; where the 25% floor does not apply, a bare chassis plus the preset's parts costs the preset price. The Parts tab offers every size the presets in the shop are built from, which is the current generation and the one before it (a generation stays in the shop until the one two steps newer arrives), plus NVMe drives of 1, 2, 8 and 15 TB from G4, G5, G6 and G7 (Intel P3700 800 GB in 2014). Installing or removing a part that swaps while running is instant in the basement; any other part takes 30 minutes in the basement, and at a datacenter the work takes the remote hands' response time and is billed at their hourly rate for at least one hour, as a swap is.

**RAID.**

| Level | Drives | Usable | Survives |
| --- | --- | --- | --- |
| None | 1+ | All | Nothing; a failed drive loses its data |
| RAID 1 | 2+ | Half | 1 drive |
| RAID 5 | 3+ | All but one | 1 drive |
| RAID 6 | 4+ | All but two | 2 drives |
| RAID 10 | 4+, even | Half | 1 drive per mirror pair |

| Rebuild rate | Rebuild speed | Server performance while rebuilding |
| --- | --- | --- |
| Low | 50 MB/s | × 0.95 |
| Medium | 150 MB/s | × 0.8 |
| High | 400 MB/s | × 0.6 |

A rebuild takes the used data on the drive ÷ the rebuild speed, so a 4 TB HDD that is 70% full takes about 5 hours at medium. Until workloads fill drives, every drive counts as 70% full. A server with two or more drives starts in RAID 1, one with a single drive in none, and changing the level needs the server off and wipes its data.

**Maintenance.** A swap takes 15 minutes once someone is there. In the basement you are there at once. At a datacenter remote hands arrive after their response time and bill their hourly rate for at least one hour.

**Hand work yourself.** At a datacenter the same swap can be done by you or by a friend, after the drive from the home city (the basement's city). Same city: 1 hour and EUR 20 (anchor: a regional train ticket). Same country: 4 hours and EUR 90 (an ICE return). Another European country: 9 hours and EUR 250 (a short-haul flight). Overseas is not offered. A datacenter that is the highest position price of a city with a rival (`visitBooking`) adds 24 hours for the booked visit. Doing it yourself keeps `playerBusyUntil` set through the drive there, the work and the drive back, and waits behind replies already queued. A friend charges EUR 35 (pizza and beer), at most 3 times per calendar year (`friendFavours`), takes the same drive time and leaves the player free; the game's random sequence rolls a 10% chance per favour that the work takes twice as long. Neither option bills remote hands, so hardware insurance pays no hand-work bill for them.

**Remote management, hangs and pulled plugs.** A baseboard management controller is part of the server board: it needs no extra part and costs nothing. Anchors for when it appears: Dell DRAC 5 on PowerEdge 9G in 2006 as an add-in card and iDRAC standard from 11G in 2009; HP iLO 2 on ProLiant G5 in 2006; Supermicro onboard IPMI on X8 boards in 2009; Lenovo IMM on System x from 2008. The game maps them to the generations: Dwell and Hewlett-Packet from generation 2 (2008), SuperMacro and Lenovoid from generation 3 (2011), the ARM line always, generation 1 (2005) never. The management address follows the private address rule: 192.168.3.x in the basement, 10.n.2.x in datacenter n, with the same host octet. Hang rates have no public source and are game choices.

| Event | Rate | Raised by |
| --- | --- | --- |
| Operating system hang | 1% a year | × 2 while a part has failed (degraded or hot), × 3 while the node is frozen from RAM overcommit |
| Management controller hang | 1% a year | × 3 once the server is 6 years old |
| Corruption after a hard stop with running workloads | 15% | Pulled power, reset and power cycle; never after a graceful shutdown |
| Recovered workload comes back fine | 70% | The other 30% need a restore from backup |

Rates are rolled hourly (yearly rate ÷ 8,760) per server and do not draw from the game's random sequence. A reset or power cycle boots for 1 hour. A graceful shutdown completes within the hour and stops the workloads cleanly. A recovery takes 30 minutes per workload, with no remote hands fee because the work happens in the operating system. Resetting a hung controller takes 15 minutes on site, plus the remote hands' response time and a one-hour fee in a datacenter; a technician does it without a fee. When corruption hits a server whose array has all its drives and no rebuild running, the array resyncs for the rebuild time of a drive instead (server performance × 0.95, × 0.8 or × 0.6 by rebuild rate) and no workload is corrupted.

**Hardware lifecycle.** Every model on sale has a last year on sale (end of sale) and a number of support years after it; the model is out of support once the year passes that sum. Devices keep working past both dates. The anchor is Cisco's policy of ending sale six months after the notice and keeping support and spares for five more years; Dell and HPE sell five to seven years of support for servers.

| Kind | Last year on sale | Support years after it |
| --- | --- | --- |
| Server | Launch year of the generation two later, minus one (the two newest generations have none yet) | 5 |
| Switch, firewall, router | Launch year + 6 (none for the newest model of a line) | 5 |
| UPS, PDU | Launch year + 8 (none for the newest model of a line) | 3 |
| Patch panel | Never | None |

- **Price erosion.** A non-server model's list price falls 5% a year from the second year of sale (launch year + n costs 0.95^n of the list price) until its last year on sale, as successors arrive. A server's price follows its parts (see Part prices by year) and is not eroded.
- **Out of support.** Hands-on work on the device (swapping, installing or removing a part) takes twice as long, a spare part for it costs 1.5 times its price (the extra half is booked as a grey market premium when the part goes in), and every component fails 1.2 times as often because the firmware no longer gets fixes. Work that takes no time on a running device stays instant.
- **News.** Each non-server model ends with a Heize online item on 1 January of the year after its last year on sale.

**Used hardware.** Listings come from the current preset price of the model (Part prices by year for servers, eroded list prices for the rest) with the seller's brand factor.

| Rule | Value |
| --- | --- |
| New listings per channel and month | 2 to 6, posted over the month at random hours; a model qualifies once its launch is at least 2 years back |
| Age of a unit | 1 year up to the years since the model's launch |
| WebHostingTalc ask | 60% of the preset price at 1 year falling in a straight line to 45% at 6 years and older |
| Telegrump ask | 45% falling to 30% the same way; 15% of the deals are scams that take the money and ship nothing |
| eBuy | Starts at 25%; the rival's maximum is 35% to 70%; the higher maximum wins and pays the other's maximum |
| Visible defect | 30% of single units; PSU 2 missing ×0.85 (two-supply models), 1 drive reports errors ×0.8 (the drive arrives one year past its life), no rails ×0.95 (rack-mounted) |
| Hidden part age | Each part's age is the unit's age times 0.5 to 1.5 |
| Listing lifetime | eBuy 5 to 10 days, ending at 20:00; board 10 to 30 days after the day of early access; chat 4 to 10 days |
| Shipping | 3 to 5 days; 1 day from a board or chat seller in the destination's city (35% of sellers are in a city where the player has a location) |
| Selling on the board | Default ask 1.3 times the resale value (Buying and selling); a buyer pays the ask within 7 to 30 days when it is under 1.5 times the value, otherwise the listing expires after 30 days |
| Selling on eBuy | Starts at half the value and ends at 1 to 1.4 times the value within 7 to 30 days, minus an 8% fee |
| Board reputation | +1 per board purchase or board sale, never from scams; 5 shows board listings 24 hours early; 15 brings one VPS lead a month |
| Bust hoster's lot | Once a year: 20 servers of one model as one board listing at 35% of their preset price, from the player's first city, for 14 days |
| Clearance weekend | Once a year: 10 eBuy auctions ending on the second evening |

Used devices are never insured, cannot be leased and resell from the price paid like any other device. Anchors: eBay server lots sold at 30% to 50% of list in the 2000s, and WebHostingTalk marketplace asks sit around half of the new price.

**Power feeds.**

| Feed | Effect | Price |
| --- | --- | --- |
| Feed A | Included with every position, at the datacenter's kW per position | In the rent |
| Feed B | Second feed; servers with two power supplies survive a feed failure. The load must fit one feed for that to hold | 40% of the position price per month |
| High-density feed | Doubles the position's kW limit | 60% of the position price per month |
| Basement circuit | One extra household circuit, +3 kW | €400 once |

**Monitoring.** Without monitoring, failures only show as lights on the device fronts. Monitoring is a tier 1 skill in Research.

| Product | Parody of | Price | Trade-off |
| --- | --- | --- | --- |
| "Nagiost" | Nagios | Free | Alerts only after 15 minutes; dashboard refreshes hourly |
| "Zabbicks" | Zabbix | Free | Alerts after 5 minutes; more admin work as it grows |
| "DataDawg" | Datadog | €15 per monitored device per month (2026, m = 3) | Alerts within a minute and the best dashboard |

**Data loss and backups.** A workload with a lost disk is down until it is restored or rebuilt empty. Restoring takes the volume's size ÷ the link speed from the backup server.

| Situation | Happiness | Ticket |
| --- | --- | --- |
| Restored from a backup | −15, and −1 more per hour of backup age, at most −40 | Outage ticket |
| No backup | −60 | Refund request; the customer churns if it is refused |
| Refund granted (one month's fees) | +20 | Closes the refund request |

Backup rules: hourly, daily or weekly, kept 7, 14 or 30 days. A full copy plus 5% of the volume per extra day kept fills the backup pool. Backup jobs follow the backup usage curve and use the zone's switch bandwidth.

**How the first build plays backups.** A cluster backs up to another cluster, in its own zone or another one, daily or weekly (Sundays), at 02:00, with one retention for all: the pool needs 1.3 × the used disk of every workload backed up to it. A job fails with a notification when the target's control plane is down or its nodes lack the free disk. A backup records the hour on each workload. When a server's array is lost, the game opens an incident report listing every workload on it with its customer, disk and last backup. Customers without a backup lose 60 happiness at once and ask for a refund. Restoring from a backup takes the used disk ÷ 450 GB per hour inside the zone or ÷ 45 GB per hour from another zone, rounded up to whole hours, and costs the happiness in the table, counted from the hour of the loss. Without a backup, a restore starts the workload on an empty disk. A refund pays back one month of the service's fees; declining one makes the customer leave. Restores from a backup, refunds and declines each give the customer the review chance from Marketing and reviews, with the 3-star rule after a refund.

**Power outages.** Grid outages are random events per location. They are far more frequent than in reality, so the player meets them in the first year. The basement's household line fails twice as often as a datacenter's utility feed (decision).

| Event | Rate | Duration | What survives it |
| --- | --- | --- | --- |
| Grid outage, basement | 3 a year | Median 20 minutes, 10% last over 2 hours, at most 12 hours | Rooms with a UPS, while its battery lasts |
| Grid outage, datacenter | 1.5 a year per location | As above | Datacenters with generators; a datacenter UPS alone bridges 15 minutes, plus any UPS of your own |
| Datacenter feed failure | 0.3 a year per feed | Median 30 minutes | Servers with a second PSU on the other feed |
| Generator fails to start | 2% of grid outages at a datacenter | Until the grid returns | Nothing on that feed |

A UPS runs for its battery capacity divided by the load:

```math
\text{runtime (min)} = \frac{\text{battery Wh}}{\text{load W}} \cdot 60
```

| Item | Price in 2005 | Notes |
| --- | --- | --- |
| Small UPS, 1,500 VA, 600 Wh | €180 | Carries a small basement rack (0.2 kW) for about 3 hours |
| Second feed (A+B) | Included where the datacenter has it | Only protects dual-PSU servers |
| Dual power supply | +10% of the server's price | PSU failures make up about a quarter of a server's AFR; with two PSUs they no longer take the server down, so its AFR drops from 8% to 6% |

Prices follow the same yearly multipliers as other hardware (see [Prices over time](#prices-over-time)).

An outage reaches the servers for the minutes the UPS and the site can't bridge, rounded up to whole hours of downtime. Customers hit by an hour or more ask for a refund with a 10% chance at low budget, 15% at medium and 30% at high budget (decision).

## Notices and legal requests

Rates per active customer per month (decisions):

| Event | Normal customer | Shady customer |
| --- | --- | --- |
| Real copyright or abuse notice | 0.01 | 0.3 |
| Fake notice about their domain | 0.01 | 0.01 |
| Legal request | 0.002 | 0.06 |
| Abuse report (existing ticket) | Profile rate | 10 × the profile rate |

Notices about domains nobody hosts arrive 0.2 times a month for the company. A notice waits 7 days before it counts as ignored, and an ignored real notice brings the next step after 3 to 7 days.

| Action | Happiness | Result |
| --- | --- | --- |
| Forward a real notice | 0 | Settled; a shady customer ignores it and the next step follows |
| Forward a fake notice | −2 | Settled |
| Take down on a real notice | −5 | Service offline for 48 hours |
| Take down on a fake notice | −25 | Service offline for 48 hours |
| Comply with a legal request | −15 | Closed |
| Object to a legal request | 0 | Closed; 25% (shady 50%) return as a court order with a 3-day deadline |
| Miss a legal deadline | −60 without a backup, −15 with one | The server is seized for 3 to 24 months |

## Traffic and bandwidth

Traffic per customer grows 20% a year, about 46× from 2005 to 2026. In 2005 one full 8 GB basement server sends about 0.4 to 0.7 Mbit/s at its evening peak, so the second server fills the 1 Mbit/s upload of the starting DSL line, and SDSL 2048 carries about three servers' worth; that is the first push out of the basement.

**Average traffic** per customer:

| Product | 2005 (GB per month) | 2026 (GB per month) |
| --- | --- | --- |
| Web hosting | 2 | 90 |
| VPS | 20 | 900 |
| Game server | 60 | 2,800 |
| Storage hosting | 100 | 4,600 |
| Dedicated server, small | 150 | 6,900 |
| VPN | 300 | 14,000 |
| Colocation | 500 | 23,000 |

**Daily curve.** Traffic follows each customer type's usage curve with its jitter, on top of a product's floor, plus the customer's night job (see Usage curves and overcommit), scaled so a week averages to the monthly figure. The 95th percentile in Mbit/s is about GB per month ÷ 164.

**Transit billing.** Each hourly tick records one sample per port. The bill uses the 95th percentile of the last 30 days (the top 5% of hours are dropped) and never charges less than 20% of the port.

**Uplinks.** Carriers and exchanges sell ports at 1G from 2005, 10G from 2008, 100G from 2014 and 400G from 2021.

| Item | 2026 price | 2005 multiplier m | Notes |
| --- | --- | --- | --- |
| Exchange membership | €1,000 setup, then €1,500 a year | 1 | One membership per exchange |
| Exchange port, 1G | €250 a month | 5 | |
| Exchange port, 10G | €650 a month | 5 | |
| Exchange port, 100G | €2,500 a month | 5 | |
| Exchange port, 400G | €6,000 a month | 5 | |
| Remote exchange port | +30% | | A port in another city of the same exchange |
| Cross-connect | €150 a month | 1 | Every link from a carrier or exchange to your patch panel |

- **Lead time.** A new exchange port or transit link takes 14 days, and a private peering cross-connect 30 days.
- **Transit contracts.** A contract can have several links. Its bill uses the 95th percentile of all its links added together and never charges less than 20% of their total capacity.
- **Carrier outages.** Each carrier has one outage a year on average, lasting 2 to 8 hours. Traffic moves to your other uplinks if you have any.

**Saturation.** Traffic above a link's capacity is dropped. Customers behind a saturated link get a headroom score of 0, and each hour of saturation costs them 25% of their outage penalty.

**DDoS attacks.** Each gamer customer draws 0.02 attacks a month and every other customer 0.002. A typical attack is 0.5 Gbit/s in 2005, growing 25% a year to about 54 Gbit/s in 2026, and lasts 1 to 6 hours. On-demand protection starts after a 10-minute detection delay; until then the attack hits the links.

**Per size.** The table is the average customer, on the middle size of a line (the lower middle when the count is even). Each size step up doubles the traffic and each step down halves it, so the four VPS sizes send 10, 20, 40 and 80 GB a month in 2005. A service sends its spec's traffic, grown 20% a year since it started. Domains and certificates send nothing, DNS hosting 1 GB, cloud servers like a VPS.

**Daily wave.** Until workloads have their usage curves, every service follows one wave of 1 + 0.9 × cos(2π (hour − 21) ÷ 24): 1.9 × the average at 21:00 and 0.1 × at 09:00, which puts the 95th percentile near GB per month ÷ 164.

**Exits and routing.** Each hour every zone routes its traffic: exchange ports first, each taking at most the share of traffic its peers want; then transit, shared by capacity; then the datacenter's own bandwidth or, in the basement, the home line's upload. What is left goes over links to other zones, into their spare capacity. Whatever still does not fit is dropped.

| Exit | Capacity | Price |
| --- | --- | --- |
| Home line | The line's upload | Paid privately |
| Datacenter bandwidth | 1 Gbit/s through the handoff | €4 per TB in 2026, m = 46 (about €180 per TB in 2005) |
| IP transit | Its links | Year's price per Mbit/s × carrier factor; commit 20%, 50% or 100% of capacity for 0%, 10% or 20% off |
| Exchange port | The port | Port fee; peering traffic is free |

**Carriers.** A datacenter sells one carrier per four on site, from the top of this list, so a one-carrier building only has Cogentle.

| Carrier | Price factor |
| --- | --- |
| Cogentle | 0.7 |
| Drizzle Electric | 0.8 |
| Tell-Ya Carrier | 1.0 |
| Level Tree | 1.3 |
| NTTea | 1.15 |
| Zayno | 0.95 |

**Routers.** Every transit or exchange link takes one free router port at least as fast as the link: a port of an edge router or of the panel gateway with no cable in it. The handoff's two 1G ports are the cheapest start. Edge routers mount in a rack and come from the Shop.

**AS number and exchanges.** Registering an AS number costs €500 once. An exchange membership costs €1,000 to set up and €1,500 a year, billed as €125 a month. A zone can order ports only at its datacenter's exchange; ports in other cities of the same exchange come later.

**Peering.** Crowdflare, Akamaybe and Drizzle Electric peer with every member through the route servers, which carry 12% of your traffic. Other networks need a session. Each day, each network on an exchange where you have a port asks with a chance of 3% (open), 1% (selective) or 0.1% (restrictive), the last two times your busiest hour of the last day ÷ the traffic they want, capped at 1. When you ask, open networks always accept, selective ones with 0.9 × that size factor and restrictive ones with 0.3 × its square, plus up to 0.1 from trade fair goodwill. A network that says no, or that you turn down, does not ask again for 90 days. Requests expire after 30 days.

**Goodwill.** Trade fairs add goodwill from 0 to 1, which fades by 5% a month. It takes up to 10% off transit and adds to peering chances.

**Links between zones.** A leased wavelength costs €400, €900, €2,500 or €6,000 a month for 1G, 10G, 100G or 400G in 2026 (m = 5) within a region, and 3 × that between regions, or 10 × across the Atlantic. Dark fiber runs only within a region, carries 100G and costs €2,000 a month. Links take 30 days, uplink links 14.

**DDoS protection.** Scrubba Dub On Demand costs €50 a month plus €250 per attack and lets a sixth of the attack's first hour through. Akamaybe Prolexit costs €800 a month and filters everything. A blackhole drops the attack and takes its target offline until it is lifted.

**Latency.** Each hop of a route adds its round trip time; ping and traceroute print it with 10% jitter.

| Hop | Milliseconds | Anchor |
| --- | --- | --- |
| Switch | 0.2 | Store-and-forward gigabit switch, 0.1 to 0.3 ms |
| Firewall | 1 | Stateful inspection |
| Gateway or router | 1 | |
| Home line | 18 in 2005, 8 from 2015 | DSL with interleaving 20 to 40 ms in 2005, fastpath 10 ms, VDSL and fibre from 2015 |
| Datacenter uplink | 3 | Handoff and metro transit |
| Core hop, same country | 8 | Frankfurt to Berlin 8 to 10 ms |
| Core hop, other European city | 25 | Frankfurt to Amsterdam is 8 ms in practice and Frankfurt to London or Milan 15 to 25 ms; the game rates every border crossing at 25 ms |
| Core hop, overseas | 90 | Frankfurt to New York 90 ms |

The core hop applies when the two locations are in different cities: both in one country count as same country (two US cities too), a European and a US city as overseas, everything else as another European city. A line or uplink queues above 80% of its exit capacity (exits used divided by exit capacity): each point above adds 200 ms per unit, so a full link adds 40 ms, and loses 20% of the packets per unit, so a full link loses 4%.

**Saturation in practice.** A zone counts as saturated once more than 2% of its traffic is dropped. Services there stay online, and each hour costs their customers 25% of their outage penalty; when a zone first saturates, each affected customer writes an outage ticket with half their usual chance. The basement is the exception: a full home line slows its sites instead (Home line).

## Workloads and migration

**Sizes.** A web space uses 0.1 vCPU, 0.25 GB of RAM and its spec's disk. A VM uses its spec's vCPUs, RAM and disk. A game server starts at 2 vCPUs and 4 GB of RAM in 2005, doubling every 7 years like VPS sizes.

**Starting sizes.** The catalog in `src/sim/10-catalog/products.ts` holds the sizes each line's customers start from (`SIZES`). "Base" is the year's base RAM g (`vpsPlanGb`), 1 GB in 2005 and doubling every 7 years. Each size is priced by Per-resource pricing below; the prices in the table are for 2005 at the basic SLA.

| Product | Sizes | One unit uses | Market price (2005) | Runs on |
| --- | --- | --- | --- | --- |
| Web hosting | 3 | 0.1 vCPU, 0.25 GB RAM, 1, 2 or 5 GB disk × growth, two mailboxes | €3.75, €6, €12.75 a month | Cluster |
| VPS | 4 | 0.5, 1, 2 or 4 × base RAM; 1 vCPU per 2 GB (at least 1); 20 GB disk per GB of RAM | 0.65, 1.1, 2 or 4 × the VPS rate (€16.50 per GB); from 2012 the smallest is 1.1 × | Cluster |
| Game server | 2 | 2 or 4 vCPUs, 4 or 8 GB RAM, 10 or 20 GB disk × growth | 6.4 or 12.8 × the VPS rate | Cluster |
| DNS hosting | 2, 5 or 15 zones | 0.05 vCPU, 0.1 GB RAM, 1 GB disk | €1.10, €2, €4.98 a month | Cluster |
| VPN | 1, 3 or 10 users | A vCPU per three users (at least 0.5, in quarters), 0.5 GB RAM, 1 GB disk | €2.03, €5, €15.22 a month | Cluster |
| Storage hosting | 100 GB, 500 GB, 1 TB | Disk only | About €8, €42, €83 a month | Cluster |
| Cloud servers | 1 | Like the 1 × base RAM VPS | 1.25 × that VPS | High-availability cluster |
| GPU servers | 4 | 1, 2, 4 or 8 cards; per card 4 vCPUs, 8 GB RAM × growth and 50 GB disk × growth | 1, 2, 4 or 8 × the card rate of GPU cards and rental | Cluster with free cards |
| Dedicated servers | 2 | A whole server with at least 8 or 32 GB × growth | €79, €299 a month | A free server |
| Colocation | 1U, quarter, half, full rack | 1, 10, 21 or 42 units and 150 W, 1, 2 or 4 kW | €60, €415, €845, €1,675 a month | Datacenter rack |
| Domains | 1 | Nothing | €15 a year | Resold |
| SSL certificates | 1 | Nothing | €50 a year until 2015, then free | Resold |

**Per-resource pricing.** Every line charges a base fee per service plus a price per unit of the spec (`marketRates` and `specPrice` in `products.ts`). The market's rates are per month at the basic SLA, per year for domains and SSL, with r the year's VPS rate per GB of RAM (`vpsRatePerGb`, €16.50 in 2005) and g the base RAM. An SLA multiplies the sum by its price factor, and a request's market reference is that price × the profile's offer factor (Reference and budget).

| Line | Base fee | Per unit |
| --- | --- | --- |
| Web hosting | €0.90 | €2.25 ÷ g per GB of disk, €0.30 per mailbox |
| VPS | €0 | 0.2r per vCPU, 0.5r per GB of RAM, 0.02r per GB of disk |
| Game server | €0 | 0.4r per vCPU, 1.35r per GB of RAM, 0.02r per GB of disk |
| Cloud server | €0 | 1.25 × the VPS rates |
| Storage hosting | €0 | €2.60 per TB in 2026 with m = 32, charged per GB |
| DNS hosting | €0.50 | €0.30 per zone |
| VPN | €0.50 | €1.50 per user |
| Domain | €15 a year | |
| SSL certificate | €50 a year until 2015, then €0 | |
| GPU server | €0 | The year's card rate per GPU (GPU cards and rental), 1% of the 2-card price taken by traffic |
| Dedicated server | €6 | €220 ÷ 24 ÷ g per GB of the smallest server RAM it accepts |
| Colocation | €15 | €30 per rack unit, €100 per kW |

Each line with traffic also charges it per 100 GB a month (Traffic, below). The table gives the rates before traffic takes its share.

**Update service.** Web hosting has two more units, both with multiplier 1 (flat over the years, and not scaled by the traffic share). `updateOnce` is the one-off price of updating a site, €49, and is not part of a service's monthly price. `updates` is the monthly price of managed updates, €5 per site, charged on a service with `spec.managedUpdates`. Anchors: managed WordPress hosting costs a premium of USD 5 to 15 a month at Bluehost and GoDaddy, and one-off maintenance plans start at USD 49. A sold one-off books a sales ledger line at the player's rate; managed updates add the player's rate to the service's price.

**DNS zones and VPN users.** A DNS order names its zones and a VPN order its users, drawn like other resources: the size its profile's budget picks (2, 5 or 15 zones; 1, 3 or 10 users) times one of the six customer factors, at least one. The middle sizes keep the former €2 and €5 a month. Anchors from 2005: managed DNS sold in bulk plans for a few euros a year per zone, and a single domain's DNS for up to €1.50 a month, so €0.30 per zone plus a €0.50 base sits at the cheap end; a hosted remote-access VPN ran €1 to €3 per user a month. A VPN gateway books a vCPU per three users (at least half of one, in quarters), so its capacity scales with the users; DNS stays at its tiny fixed size. An upgrade grows the zones or users by its factor.

**Traffic.** Every line with traffic (all but domains and SSL) charges a rate per 100 GB of the spec's monthly traffic. In 2005 hosts bundled traffic and overage cost little, so the market rate is set from a share of the line's middle size: traffic is that share of the middle size's market price, and the line's other rates give up the same share, so the middle size keeps its price, a bigger traffic user pays a little more and a smaller one a little less (`TRAFFIC_SHARE`). As specs' traffic grows 20% a year while prices fall, the rate per 100 GB falls with them.

| Line | Share | Per 100 GB in 2005 | 2015 | 2025 |
| --- | --- | --- | --- | --- |
| Web hosting | 2% | €6.00 | €0.92 | €0.15 |
| DNS hosting | 2% | €4.00 | €0.65 | €0.10 |
| VPS | 3% | €2.72 | €0.34 | €0.05 |
| Cloud server | 3% | €3.40 | €0.42 | €0.06 |
| Storage hosting | 3% | €1.25 | €0.04 | €0.001 |
| Dedicated server | 4% | €2.12 | €0.34 | €0.06 |
| VPN | 5% | €0.08 | €0.01 | €0.002 |
| Colocation | 5% | €4.15 | €0.67 | €0.11 |
| Game server | 6% | €10.60 | €1.47 | €0.20 |

Game servers and colocation move the most data per euro and carry the largest share. A VPN moves 300 GB a month on a €5 bill, so its rate per GB is the lowest.

**Setup fees.** An order through the order form pays a one-time setup fee on top of its first month (`marketSetup` in `products.ts`, `setupFee` in `spec.ts`). The market's fee in 2005, falling to a third by 2026 (m = 3), rounded to whole euros: web hosting €10, VPS €15, game server €15, DNS €5, VPN €10, storage €10, cloud server €0, dedicated server €75, colocation €150. The player sets a line's fee in Pricing next to its rates; empty charges the market's. Customers weigh a fee above the market's as if spread over 36 months of the line's middle size (`SETUP_MONTHS`): the difference ÷ (36 × that monthly price) adds to the price index for leads that would order through the form, so a dearer fee brings a few fewer form orders and a cheaper one a few more. Twice the market's web hosting fee costs about 7% of the form's share. Email orders and sales requests charge no setup fee.

**Form invoices.** The order form invoices an order the moment it is placed: the setup fee (left out when it is zero) and the full first month at the order's price. The service is prepaid for 730 hours, so the monthly run bills only the hours after that and the first month is never billed twice; this is the same rule an email order's invoice step uses. The invoice is due in 14 days, and an on-time payer pays it within 1 to 3 days. Its payment books as two ledger entries: the setup fee under Setup fees and the rest under Customer payments, so the two add up to the invoice total (a collections payout splits the same way).

**The player's rates.** The Products app's Pricing view holds one rate per unit for each line (`rates.ts`). An empty rate charges the market rate, and Market rates resets the whole line. Rates apply to new sales: the order form charges a spec at the player's rates × the SLA factor × (1 − campaign discount) and places it at once. Overpricing costs leads through the price factor in Choice with prices and customers through Price tolerance and churn. Services already sold keep the price they were sold at, and raising one goes through Price changes with its tolerance, complaint and retention rules. Email orders are priced by hand, prefilled at the market reference less any campaign discount. Saves from before per-resource pricing give every service, request and lost sale with a plan that plan's size as its spec in the year it started, and start with every rate empty. Saves from before DNS zones and VPN users give each DNS or VPN service the count its monthly price buys at the loading year's market rates (less the base fee and traffic, at least one); requests and lost sales use their market reference. Their setup fees start at the market's.

**Capacity.** A node books up to its physical cores × 8 in vCPUs, its RAM × 1.5 and its usable RAID disk × 2. A G1 balanced server books 16 vCPUs, 12 GB of RAM and 1 TB of disk: 48 web spaces, or 24 of the 0.5 GB VPS, or 6 of the 2 GB VPS by RAM. Booking counts what workloads booked; the load they put on the hardware follows the usage curves.

**Moving a workload**

| Workload | Time | Downtime |
| --- | --- | --- |
| Virtual machine (live) | RAM × 1.5 ÷ link speed | Under 1 second |
| VM with local disk | Above, plus disk ÷ link speed | Under 1 second |
| Web space, between panel hosts | A hand task of 2 to 4 hours plus 3 minutes a GB, halved by a migration tool (Migrating a web space) | 10 minutes |
| Web space, between servers of a clustered panel host | Immediate | None |
| Game server | 1 minute | 1 minute |
| Storage volume | Disk ÷ link speed | None; reads come from the old node until it finishes |
| Between zones (cold) | (Disk + RAM) ÷ free bandwidth of the link between the zones | The whole transfer; needs a link between the zones |
| Between zones (live) | As above, then a final sync of RAM × 0.1 ÷ free bandwidth | Under 5 seconds; needs a link of 10G or more |

**Migrating a web space.** A web space moves to another panel host as a hand task (`migrateWebspace`, src/sim/90-actions/vms.ts; hours in src/sim/60-infra/migration.ts). The anchor is the owner's own words: about 4 hours to move a customer between two panels, 2 if the panel is the same, scaling with web storage.

| Part | Value |
| --- | --- |
| Base, same panel on both hosts | 2 hours |
| Base, different panels | 4 hours |
| Per GB of web storage (`spec.diskGb`) | 0.05 hours (3 minutes; 20 GB adds an hour) |
| Target panel has a migration tool for the source | Half of the total |
| Rounding | Up to quarter hours, at least 15 minutes |
| Cutover, the last part | 10 minutes unreachable; the site is up before |
| Money | None; the work is remote, so a datacenter bills no remote hands |

The tool applies when the target panel's `migration.same` (source is the same panel) or `migration.other` (any other panel) year has come (Platforms and licenses). A technician trained on panels can run the task (OpKind "migrate") at the server the web space sits on, one operation per office hour; the hours then run as for the player. A web space is migrating until the first tick at or after its hours are over, then it is placed on a node of the target with room, and the 10 minutes count as down time. If the target has lost its room by then, the move is dropped. Web spaces on the servers of a clustered panel host are rebalanced by the scheduler without a task. The link speed below applies to virtual machines, game servers and storage volumes.

The link speed is the slowest link between the two nodes, shared by every migration running at the same time. Between zones, the free bandwidth is the link's capacity minus the customer traffic it already carries at that hour, so a 1G link at its evening peak migrates slowly, and a 100 GB VM over a free 1G link takes about 15 minutes. Draining runs 2 migrations at once per node by default.

**Restart after a node fails.** In a high-availability cluster, workloads restart on other nodes after 5 minutes of detection plus 2 minutes of boot. Customers count that time as an outage.

**Hardware warnings.** 60% of disk and power supply failures announce themselves 1 to 7 days early. A node drained before its failure causes no outage.

**Private networks.** A private network costs the customer €5 a month as an add-on (m = 1) and costs you nothing to run.

## Usage curves and overcommit

**Usage curves.** Each workload's load is a share of what it booked, from 0 to 1, read from its type's curve below. Values between keyframes are straight lines, and each workload adds ±20% hourly jitter drawn from the seed. Fridays from 18:00 count as weekend for game servers and VPNs.

| Curve | Used by | Weekdays (hour → load) | Weekends (hour → load) | Week average |
| --- | --- | --- | --- | --- |
| Game server | Gamers | 0 → 0.15, 16 → 0.15, 20 → 0.45, 23 → 0.3 | 0 → 0.6, 3 → 0.2, 8 → 0.2, 12 → 0.9, 18 → 1.0, 23 → 0.9 | about 0.35 |
| Online shop | Online shops | 0 → 0.1, 6 → 0.15, 9 → 0.55, 13 → 0.7, 17 → 0.6, 20 → 0.75, 22 → 0.3, 23 → 0.12 | 0 → 0.1, 10 → 0.5, 15 → 0.6, 20 → 0.8, 22 → 0.3 | about 0.4 |
| Blog and personal site | Private individuals, hobby developers | 0 → 0.15, 7 → 0.3, 12 → 0.45, 19 → 0.6, 22 → 0.5, 23 → 0.2 | 0 → 0.2, 10 → 0.4, 19 → 0.55, 23 → 0.2 | about 0.35 |
| News and magazine | Agencies' media clients | 0 → 0.1, 5 → 0.3, 7 → 0.9, 9 → 0.7, 12 → 0.6, 18 → 0.5, 22 → 0.3 | 0 → 0.1, 9 → 0.7, 12 → 0.5, 22 → 0.25 | about 0.45 |
| Business site | Sole proprietors, small businesses, offices | 0 → 0.05, 7 → 0.2, 9 → 0.6, 12 → 0.5, 17 → 0.5, 19 → 0.15 | 0.1 all day | about 0.25 |
| Backup and archive | Backup and archive storage | 0 → 0.4, 1 → 1.0, 5 → 1.0, 7 → 0.05 | Same as weekdays | about 0.25 |
| VPN | VPN customers | 0 → 0.2, 8 → 0.3, 19 → 0.7, 23 → 0.4 | 0 → 0.4, 14 → 0.7, 22 → 0.7 | about 0.45 |
| Developer VPS | Hobby developers, agencies | 0 → 0.1, 10 → 0.3, 18 → 0.3, 21 → 0.2 | 0.15 all day | about 0.2 |
| Enterprise | Enterprises, dedicated servers | 0 → 0.3, 8 → 0.6, 18 → 0.6, 22 → 0.35 | 0.3 all day | about 0.45 |

**Surges.** Black Friday (the last Friday of November) and the two weeks before Christmas multiply online shops by 2× and 1.3×. A game's launch weekend multiplies its servers by 1.5×. Each news site has a 1% chance per day of breaking news, which multiplies it by 3× for 2 to 6 hours.

**What runs over.** Booking never refuses a placement for CPU or RAM, on any node, cluster or panel VM; only the disk limit below does.

| Resource | Booking limit | In use | When the node runs over |
| --- | --- | --- | --- |
| CPU | None | Booked vCPUs × load | Performance of everyone on the node × cores ÷ busy vCPUs |
| RAM | None, except installed RAM with Memory reservation on | Booked RAM × (0.6 + 0.4 × load), since memory stays mostly resident | Above 100% the node freezes: every workload on it is down until RAM in use fits again |
| Disk | 2:1 of the usable RAID disk | Grows from 30% of booked at signup at the customer's growth rate, up to 100% | The pool stops writes at 100%: an outage for every workload on it |
| Traffic | No limit | Monthly traffic × traffic shape (below) | Saturation, see Traffic and bandwidth |

A cluster of nothing but game servers peaks at about 1.0 on Saturday evenings, while a mixed cluster stays near 0.5, so mixing customer types roughly doubles safe overcommit. The cluster view shows booked capacity, this week's forecast peak and last week's actual peak.

**How the first build plays.** Usage follows the curves with ±20% jitter per workload and hour, without surges yet. A node's use is the sum of its workloads plus its control plane at full load; a stopped, restoring or lost workload uses nothing. Instead of killing workloads, an overloaded node slows them: performance is cores ÷ busy vCPUs, and 50% when the disk pool runs over. A node whose RAM in use exceeds its installed RAM freezes instead of slowing: every workload on it is down, an outage for each customer on it, until the player stops or moves enough workloads or the hourly load drops. The freeze is checked every hour and again right after a stop, start or move. Every hour each customer on a slowed node loses 0.1 × (1 − performance) in happiness, and each of their services opens a "really slow" outage ticket with a chance of 10% × (1 − performance) unless one is already open. **Overprovisioning is always allowed.** Players may book more vCPU and RAM than a node, a cluster or a panel VM has, whatever the software; it only costs performance. The owner's rule (bug report): no cluster may report no room when room is there, webhosting packages need minimal resources, overprovisioning should always be allowed and only hurts performance when customers use it, and limits per software make no sense because overprovisioning is not a per software thing. So the one hard limit is disk, at twice the usable RAID disk for a node and at the VM's disk inside a panel VM, because data has to sit somewhere. The scheduler still prefers a node whose installed RAM the booking fits (pack takes the busiest of them, spread the idlest) and falls back to the idlest node when none is left. The consequences are the ones above: slowdowns while the CPU in use passes the cores, the freeze while the RAM in use passes the installed RAM. The capacity bars show booked against physical and run past 100% in the warning colour.

**Memory reservation.** A tier 2 training after Monitoring, 100 know-how and 5 days. It adds a Memory reservation switch to every cluster, off by default. With it on, a placement or a move that would book RAM beyond a node's installed RAM less its control plane is refused, so the node cannot freeze; it is the only way RAM refuses a booking.

**Pegged workloads.** A workload is pegged when its CPU ran at 95% or more of its booked vCPUs in more than 12 of the last 24 hours. The node's workload list marks it.

**Traffic shape.** A service's Mbit/s each hour is its monthly average × (floor + (1 − floor) × activity + 2 × night job) ÷ the week's average of that sum, where activity is the curve with the service's own ±20% jitter. A month's traffic therefore stays at the table in Traffic and bandwidth.

| Product | Floor | Reasoning |
| --- | --- | --- |
| Game server | 0.5 | A game server sends ticks to every connected player all night, so its traffic never drops below half its average. |
| Colocation | 0.3 | A rented rack carries mixed customers of its own and never goes quiet. |
| VPN, dedicated server | 0.2 | Tunnels and company servers keep syncing and polling overnight. |
| Everything else | 0 | Websites follow their visitors, so nights are as low as the curve. |

**Night jobs.** Every customer runs their own backup or batch job once a night for one hour, starting on a half hour from 00:00 to 05:30 drawn from the seed; one customer in six draws a new start every night, since cron jobs that depend on other jobs drift. During the job the workload's load rises by 0.3 and it ships two hours' worth of average traffic, because an offsite backup uploads a day's changes at once; 0.3 keeps a small node with several jobs in the same slot below its evening peak.

**The player's backups.** A cluster's backup runs at 02:00 (Sundays only when weekly) and sends 10% of each workload's used disk from its node to the target's control plane within the hour, since a daily backup only copies what changed. The traffic lights the ports on the shortest cable path between the two servers and their LED net bars, and does not reach the uplinks.

**Growth.** Each customer draws a disk growth rate and, separately, a CPU growth rate from the seed, because a big database and a busy shop are different customers.

| Share of customers | Disk use per year (share of booked) | CPU demand per year (share of the first year's) |
| --- | --- | --- |
| 30% | +2% | +2% |
| 50% | +15% | +15% |
| 20% | +50% | +50% |

Disk use starts at 30% of booked and stops at 100%; the average customer reaches about 66% after two years, as before. CPU load is the curve × (1 + rate × years) with jitter, capped at 100%. An upgrade is a new service, so both start over.

**Outgrowing a service.** Once a day at noon, a customer whose disk is at 90% or more, or whose CPU demand × the curve's weekly median reaches 0.9 (near 100% for more than half the week), writes an upgrade ticket with a chance of 1 in 7, so about a week after crossing the line; sales turns it into an expansion request. A full disk breaks the site: the customer loses 2 happiness a day and writes an "our site shows errors" upgrade ticket with a chance of 25% a day while none is open. A fast-growing disk crosses 90% after about 14 months and fills after 17. A fast-growing shop's CPU pegs after about 17 months, a news or enterprise site's after two years, while game servers and office sites, quiet for most of the week, take ten.

**Before and after.** Measured over 30 days with a mixed set of customers (web hosting, VPS, game servers, VPN, storage, dedicated): early game in 2005 with 13 services moves 0.59 TB before and after, with a 95th percentile of 3.4 Mbit/s before and 3.8 after (night jobs add short peaks to a small base); mid game in 2012 with 200 services moves 17.9 TB before and 17.8 after, with a 95th percentile of 103 Mbit/s before and 88 after, so transit bills drop about 15% (€311 to €264 a month at Cogentle's price), because the floors and staggered peaks flatten the sum.

## Platforms and licenses

Every server runs at most one control plane. A hypervisor ("Cloud" below) runs on every node of a hypervisor cluster and sells VPS, game servers, DNS, VPN, storage and, with failover on, cloud servers. A panel runs on a panel host, a bare-metal server or one of the player's own VMs, and sells web hosting. Dedicated servers, colocation, domains and certificates need neither. Values live in `src/sim/10-catalog/platforms.ts`; fees are monthly, in euros, and fixed over the years.

| Software | Kind | License | Install | How-to tickets | Live migration | Control plane |
| --- | --- | --- | --- | --- | --- | --- |
| cPanic | Panel | €0.40 per web space | 3 h | ×0.8 |  | 0.25 vCPU, 0.25 GB, 5 GB |
| Pleskit | Panel | €12 per panel host | 3 h | ×0.9 |  | 0.25 vCPU, 0.25 GB, 5 GB |
| DirectAdmen | Panel | €4 per panel host | 2 h | ×1.2 |  | 0.1 vCPU, 0.1 GB, 2 GB |
| FreePanel | Panel | Free | 2 h | ×1.5 |  | 0.1 vCPU, 0.1 GB, 2 GB |
| OpenVeeZee | Cloud | Free | 3 h | ×1.4 | No | 0.1 vCPU, 0.1 GB, 2 GB |
| OpenStash | Cloud | Free | 8 h | ×1.3 | Yes | 2 vCPU, 2 GB, 20 GB |
| VMwhere | Cloud | €8 per physical core | 5 h | ×0.7 | Yes | 1 vCPU, 2 GB, 10 GB |
| Proxmocks | Cloud | Free | 3 h | ×1.0 | Yes | 0.25 vCPU, 0.25 GB, 5 GB |
| HyperVee | Cloud | €20 per node | 4 h | ×0.9 | No | 1 vCPU, 1 GB, 10 GB |
| TCAdmen | Game | €25 per server | 2 h | ×0.9 | No | 0.25 vCPU, 0.5 GB, 5 GB |
| MultiKraft | Game | €20 per server | 2 h | ×1.0 | No | 0.25 vCPU, 0.5 GB, 5 GB |
| Pterodaktyl | Game | Free | 3 h | ×1.2 | No | 0.25 vCPU, 0.5 GB, 5 GB |

**Split cores.** OpenVeeZee and Proxmocks give a guest a fraction of a core through containers and CPU limits, so a VM books exactly the vCPUs it sold. OpenStash, VMwhere and HyperVee give a VM whole vCPUs: a VM books its vCPUs rounded up and uses that much CPU at load. Web spaces, DNS zones and VPN gateways share a guest per node and keep their fraction everywhere. A customer who scales a VPS below one core asks for tenths of a core (at least 0.2), so 0.75 of one core becomes 0.8.

| Software | From | Imports from same | Imports from other | Clusters from |
| --- | --- | --- | --- | --- |
| cPanic | 2005 | 2005 | 2012 | Never |
| Pleskit | 2005 | 2005 | 2015 | Never |
| DirectAdmen | 2005 | 2010 | Never | Never |
| FreePanel | 2005 | Never | Never | 2009 |
| OpenVeeZee | 2005 | 2005 | Never | Never |
| OpenStash | 2010 | 2010 | Never | 2010 |
| VMwhere | 2005 | 2005 | Never | 2005 |
| Proxmocks | 2008 | 2008 | Never | 2008 |
| HyperVee | 2008 | 2008 | Never | 2012 |
| TCAdmen | 2005 | Never | Never | Never |
| MultiKraft | 2010 | Never | Never | Never |
| Pterodaktyl | 2016 | Never | Never | Never |

Game panel anchors: TCAdmin has been sold since 2004 at about USD 30 a month per server (TCAdmen, €25 a month); Multicraft has been sold since 2010 at about USD 25 a month per host (MultiKraft, €20 a month); Pterodactyl's repository was created in December 2015 and its 1.0 came in 2020, and it is free (Pterodaktyl, from 2016).

Anchors: cPanel could copy accounts between servers with WHM's "Copy an account" since 2005 and gained its transfer tool for other panels around 2012; Plesk's Migration Manager appeared with Plesk 7.5.6 in 2005 and the Plesk Migrator extension (2015) imports cPanel, Confixx and others; DirectAdmin moves accounts through backup and restore since about 2010; ISPConfig 3 introduced multiserver setups in March 2009, which is where FreePanel clusters from, while cPanel and Plesk never clustered web serving (only DNS). Hypervisor years follow the products: OpenStack 2010, VMware ESX long before 2005, Proxmox VE 2008, Hyper-V 2008 (clustering of Hyper-V hosts from the 2012 release).

- **Licenses** are billed on the 1st of each month per hypervisor cluster and per panel host, as ledger lines in the category "licenses".
- **How-to tickets:** a customer's how-to rate is multiplied by the average factor of the software serving each of their workloads (the panel for web spaces, the hypervisor for the rest).
- **Booking:** software sets no limit on what a node books. Every hypervisor and panel books vCPU and RAM past the physical amounts and disk up to twice the usable RAID disk (see Usage curves and overcommit). Ballooning decides one thing: a resize of one of the player's own VMs that only grows its RAM is live on a hypervisor that balloons (Proxmocks and VMwhere, HyperVee from 2012; OpenStash and OpenVeeZee never); any other resize restarts the VM for 10 minutes.
- **Software in a VM** gets 95% of the VM's vCPU and RAM (`IN_VM` in 10-catalog/platforms.ts): a panel VM's web hosting room is 0.95 times its booked vCPU and RAM, less the panel, with its full disk. The same panel on bare metal gets the whole server.
- **Control plane:** a hypervisor's control plane runs on one node of the cluster, the first one added, and counts against what it can book and what it uses. A bare-metal panel host runs its panel on its server; a panel VM runs its panel inside the VM, so the panel counts against the VM's booking. While that node is down, or while the cluster switches software, nothing can be sold, started, migrated or restored on the cluster. Draining moves the control plane to another node once the drained node is empty, and the player can move it to any working node with room.
- **Installing** goes on a machine: a free mounted server, or one of the player's own VMs for a panel, with room for the control plane on it. A hypervisor on a server makes it a one-server hypervisor cluster named after its location; servers with the same installed hypervisor join a cluster once nothing runs on them. A panel VM can be created while its cluster's hypervisor is still installing; its panel starts installing once the hypervisor is done. The control plane is busy for the install hours in the table, and nothing can be placed on the cluster until it is done. An install costs nothing up front; the license is billed from the next 1st of the month.
- **Switching** software is an uninstall and an install. Uninstalling needs the machine empty of what the software serves; a VM stays, empty, and the player deletes it separately.
- **Selling:** the website, order emails and leads only carry product lines that an installed control plane on a cluster with nodes sells. Placement refuses with "No cluster runs a hosting panel" or "No cluster runs a virtualization platform" when no cluster in scope has the right software, and with the capacity error when it has but no node has room.
- **Years and traits.** Software cannot be installed before its `from` year (`error.softwareNotYet`); old saves keep what they have. `migration.same` and `migration.other` are the years from which the software imports a web space from the same software and from another panel (null never), `cluster` the year from which a panel host takes a second server (null never). Panels cluster by joining an empty server that runs the same panel in the zone, through the same join flow as a hypervisor node; a panel host in a VM stays on one server. The clustering years of hypervisors are recorded for reference; hypervisor clusters can grow from the day the hypervisor is installed. There is no replication trait: no panel of the period replicated sites between hosts.
- **Game server panels** (kind "game") run containers for game servers on a server or in one of the player's own VMs, one panel per machine like a web panel. A game panel sells game servers and nothing else, at the how-to factor of its software. Hypervisor clusters keep selling game servers as plain virtual machines, so a game server order goes to a game panel with room first and to a hypervisor cluster otherwise. Game panels ship one release a year like every software and have 1.5 vulnerabilities per release; a compromised game panel takes its game servers down until the player cleans it up (Security advisories, Generated vulnerabilities). A license per game is not modelled yet; the panels bill only their own fee, per server.
- A new game starts with no software installed. Old saves keep the panel and platform they had, and saves from before platforms load with FreePanel and Proxmocks installed.

**Migration in the first build.** Inside a zone, links count as 1 Gbit/s, which moves 450 GB an hour. Virtual machines move live on platforms with live migration; on HyperVee they are offline for (disk + RAM) ÷ 450 GB per hour, rounded up to whole hours. Web spaces move between panel hosts as the hand task above; game servers and storage volumes move without a lost hour. Moves between zones need a ready zone link (Network, zone links): it moves 450 GB an hour for every Gbit/s of its speed, and parallel links add up. A VM moves live over 10 Gbit/s or more and is otherwise offline for the transfer; a web space's hand task takes the copy time on top. The basement has no zone link, so a move from the basement to a rented location goes over the internet at the home line's upload speed, at most 45 GB an hour (`WAN_GB_PER_HOUR`), always cold: a 40 GB VPS on a 10 Mbit/s line (4.5 GB an hour) is offline for 9 hours. Without a home line the move is refused. A workload with a lost disk can't migrate; it is restored instead.

**Migration offers.** The player can ask a customer to agree to a move (gdd.md, Support, Migration offers). The customer answers when their reply time is up: below happiness 40 they decline, otherwise they accept and name a window from the segment of Noticing outages. Players want the first 02:00 to 06:00 after the answer, businesses the next weekday from 18:00 to 22:00 (never the day of the answer), private customers any time, so their move runs at once. The accepted move runs at the first hour of the window as the move above, with its downtime. A customer whose service moves from the basement into a datacenter gains 5 happiness. A move that has not run within 48 hours of the window's start costs 10 happiness and reopens the ticket. The numbers are `DECLINE_BELOW`, `BASEMENT_BONUS`, `MISSED_PENALTY` and `MISSED_AFTER_HOURS` in `src/sim/90-actions/moves.ts`, the windows `MOVE_WINDOW` in `src/sim/10-catalog/attention.ts`.

## Staff: salaries, skill growth and quitting

A junior support agent hired in 2005 costs the company about €2,600 a month. A senior asks about 37% more, which is less than the gap in work rate, so juniors win only if they stay.

**Salary** at hiring, per year and including employer costs, for a candidate with skill s:

```math
\text{salary} = \text{role base}(y) \cdot 1.29 \cdot \left(0.85 + 0.6 \cdot \frac{s}{100}\right)
```

Role bases are 2026 gross salaries, scaled back with the salary multiplier from [Prices over time](#prices-over-time). The accountant figure is an estimate; the rest come from the GDD's Prices section.

| Role | Role base, 2026 (gross per year) |
| --- | --- |
| Support agent | €42,000 |
| Technician | €47,000 |
| Network engineer | €60,000 |
| Kubernetes engineer | €72,000 |
| Sales agent | €40,000 |
| Bookkeeper | €38,300 |
| Accountant | €50,000 |
| Marketing manager | €45,300 |

**Skill growth.** Skill rises 12 points a year in the first two years, 6 a year in years 3 to 5, and 2 a year after that. Each employee has a hidden talent cap between 60 and 100 that skill never passes.

**Hiring.** A standard job ad costs €500 (2026) and brings 3 candidates over two weeks; a premium ad costs €2,000 and brings 8. 60% of candidates are juniors (skill 10 to 35), 30% mid-level (35 to 65) and 10% seniors (65 to 90).

**Raises and quitting.** Once a year each employee asks for 3% plus whatever closes the gap to the market salary for their current skill. Each month an employee quits with this chance:

| Condition | Monthly chance to quit |
| --- | --- |
| Always | 0.5% |
| Paid below 85% of the market salary for their skill | +3% |
| Raise refused in the last 6 months | +5% |

A raise request left unanswered for 30 days counts as refused. Salaries are billed on the first of each month for the month before, prorated for the days employed, and a fired employee is paid for the days worked that month.

**Job market.** Every month each role gets 2 open applications, and every candidate stays on the market for 30 days. Job ads add their candidates on top. Ads, courses and salaries are booked as salaries and follow the salary multiplier.

**Training.** Each task type is a separate course. A course costs €250 (2026, about €150 in 2005) and takes 2 days. With a trainer of the same role the course is free and takes 1 day. Employees in training and trainers do no other work.

| Role | Task types |
| --- | --- |
| Support agent | How-to, billing, outage, upgrade, cancellation, abuse, suspension appeal |
| Bookkeeper | Payment reminders |
| Accountant | Dunning notices, final notices |
| Marketing manager | Campaigns, review platforms, trade fairs |

**Staff at work.** Staff work Monday to Friday from 9 to 17; holidays and sick days come later. A support agent picks the right reply with P(right) from the work rate and a wrong template otherwise, offers retention on cancellations, and unsuspends appeals that have no right reply. Collections stays with the player and the billing rules, and payments record themselves.

**Forum posts.** An employee assigned to the forums brings 2 × (0.5 + s/100) leads a month and does no other work.

**Marketing manager.** Review platforms with a fee need one on staff; without one, the platform falls back to the free listing at the month start before billing. The best manager trained on campaigns who works the queue and is not at a fair multiplies every campaign's leads by 1.05 + 0.1 × s/100. One trained on review platforms multiplies the invite rate by 1.5.

**AI bots.** Each bot is one Pear One subscription and works every hour of the day, staff first during office hours and the bots after them.

| Bot | Base per month (2005) | Handles |
| --- | --- | --- |
| "ChadGPT Support" | €50 plus usage | How-to and billing tickets |
| "Clipsy Reminders" | €100 | Payment reminders |

A bot works at 2 × the base rate (a skill-50 human works at 1 ×) and never gains skill. ChadGPT picks the right reply with P = 0.6 on how-to tickets and P = 0.5 on billing tickets. Each reminder a bot sends makes the customer open a billing ticket with a 5% chance. Each bot task causes an incident with a 0.2% chance: the customer loses 15 happiness and opens a billing ticket, and the Staff app reports one of five absurd lines. A bot that handles 500 tasks a month causes about one incident a month.

### ChadGPT usage

ChadGPT bills every reply it sends in tokens on top of its €50 base subscription. The month's usage becomes one "ChadGPT usage" ledger line on the first of the next month, booked under its own Finance category. A reply rereads the whole thread, so a retry costs more than the first answer:

```math
\text{tokens} = (6{,}000 + 3{,}000 \cdot r) \cdot 1.18^{\,y - 2005}
\qquad
\text{price per 1M tokens} = €280 \cdot 0.85^{\,y - 2005}
```

Here r is the number of replies already in the thread and y the year, held at 2026 after 2026. The price per token falls 15% a year, like real model prices, while each model generation reads and reasons 18% more per reply. A reply therefore costs about the same in every year: €1.68 for a first reply and €2.52 for the second in 2005, €1.79 and €2.68 from 2026.

| Year | Price per 1M tokens | First reply |
| --- | --- | --- |
| 2005 | €280 | 6,000 tokens |
| 2010 | €124 | 13,700 tokens |
| 2015 | €55 | 31,400 tokens |
| 2020 | €24.50 | 71,800 tokens |
| 2026 | €9.20 | 194,000 tokens |

**Retries.** A wrong reply brings a follow-up in the same thread, and ChadGPT answers it again. After 4 replies of its own on one ticket it leaves the ticket in the queue for staff and the player, and the customer loses 10 happiness for the runaround on top of the 10 for each wrong reply.

| Kind | P(right) | Replies per ticket | Solved by ChadGPT | Replies per solved ticket | Cost per solved ticket, 2008 | Share of an agent's |
| --- | --- | --- | --- | --- | --- | --- |
| How-to | 0.6 | 1.62 | 97% | 1.67 | €3.62 | 42% |
| Billing | 0.5 | 1.88 | 94% | 2.0 | €4.63 | 53% |

**Against a support agent.** The reference is a full-time skill-50 support agent whose salary is spread over the tickets they solve in a month at full load: 140 hours at 3.16 tickets an hour with P(right) = 0.875, about 387 solved tickets, which is €8.05 a ticket in 2005 and €11.05 in 2018. From 2006 to 2018 a solved ticket from ChadGPT costs 34% to 44% of that on how-to tickets and 43% to 56% on billing tickets; the share falls slowly as salaries rise. One ChadGPT has room for about 5,000 replies a month, so a company with many customers, an outage or a price rise pays a five-figure monthly bill: the balance model's steady company pays about €10,600 a month from 2014 on.

**Technicians.** A technician costs the technician role base above (€47,000 in 2026) and does one operation per office hour, so at most 40 a week, at their location. Skill sets the salary and does not change the work rate, because every operation fills its hour. Against remote hands at €120 an hour, a technician at a datacenter pays off from about 25 swaps a month; in the basement the gain is only the time the player saves.

| Operation | Training | Operations |
| --- | --- | --- |
| Replace a part that swaps while running | Parts and power | 1 |
| Replace a part that needs the device off | Parts and power | 3 (shut down, swap, start) |
| Shut down or start a device | Parts and power | 1 |
| Drain a cluster node, however many VMs it holds | Draining servers | 1 |
| Upgrade one node to the current PHP | PHP upgrades | 1 per node |

A technician's swap takes 15 minutes, the same as the player's in the basement, and bills no remote hands. The repair rule for failed parts queues at most one swap per spare of that kind in the zone's storage.

## On-call duty

On-call pay follows Rufbereitschaft in the German public-sector agreement, TVöD §8(3), and rest follows the Working Hours Act, Arbeitszeitgesetz §5. The hourly wage is the monthly salary divided by 173, a 40-hour week.

| Item | Pay | Game rule |
| --- | --- | --- |
| On-call day, Monday to Friday | 2 × hourly wage | Earned at 17:00 by the technician on call that day |
| On-call day, Saturday and Sunday | 4 × hourly wage | Earned at 17:00 by the technician on call that day |
| Call-out hour | 130% (overtime) | Every hour worked out of office hours |
| Night, 21:00 to 06:00 | +20% | Added to the call-out hour |
| Sunday | +25% | Added to the call-out hour |

A week on call earns 5 × 2 + 2 × 4 = 18 hourly wages. A call-out at 02:00 on a weekday pays one hour at 150%, on a Sunday at 175%. A €47,000 technician earns about €3,920 a month, so €22.64 an hour, €408 for a week on call and €34 for a night call-out.

The game simplifies the agreement in four ways. TVöD counts the allowance on the day an on-call period starts; the game starts each day's period at 17:00, when the office closes, so every calendar day counts once. The game has no public holidays, which TVöD pays at 4 ×. Each call-out hour includes travel and is already a full hour, so rounding up never adds anything. Consecutive call-out hours count as one call-out.

Rest: ArbZG §5 requires 11 hours of uninterrupted rest, and a call-out restarts it. A technician does no office-hour work until 11 hours after the end of their last call-out hour, so a call-out at 02:00 starts the day at 14:00. Call-outs during the rest still happen, as an emergency does in the real rule.

## Panel VMs and high availability

A panel VM is one of the player's own VMs on a hypervisor cluster with a panel installed. Its booking is the web hosting capacity of its panel host, less the panel's control plane. Values live in `src/sim/90-actions/clusters.ts` and `src/sim/60-infra/ha.ts`.

| Value | Amount |
| --- | --- |
| Suggested size in the setup and the Products app | 2 vCPU, 2 GB RAM, 50 GB disk, about 7 web spaces of 2 GB; the basement server keeps room for the smaller game server next to it |
| Smallest size | 1 vCPU, 1 GB RAM, 10 GB disk, and at least the panel's control plane |
| Resize | Any size that still holds the web spaces' bookings plus the panel and fits on the VM's server |
| Use | What its web spaces use plus the panel's control plane |
| Failover downtime | 5 minutes per VM restarted on another node, added to each affected service's down hours |
| Hot node | 90% of installed RAM in use, more busy vCPUs than physical cores, or booked beyond what it can book |
| Auto-balancing | One VM per hot node an hour, the smallest running one, to the idlest node that is not hot |

- **High availability** is the tier 3 research of 400 know-how and 14 days after Product management and Monitoring. Each hypervisor cluster then has three switches, all off by default: live migration, auto-balancing (needs live migration) and automatic failover.
- **Live migration** needs the switch on and a hypervisor that supports it; otherwise a VM migration is cold and takes the VM offline for (disk + RAM) ÷ (link Gbit/s × 450 GB per hour), at least one hour. Moving web spaces between panel hosts in a zone stays instant.
- **Cloud servers** need a hypervisor cluster with failover on.
- **The Virtual machines and Network apps** cost nothing in the Pear Store. Virtual machines installs once a hypervisor is installed or installing; Network is available from the start, and buying transit and peering in it needs Network operations.

## PHP versions

Each version becomes available on 1 January after its release, rounded so the start of the game has 4.4:

| Version | From | Version | From | Version | From |
| --- | --- | --- | --- | --- | --- |
| 4.4 | 2005 | 5.6 | 2015 | 7.4 | 2020 |
| 5.1 | 2006 | 7.0 | 2016 | 8.0 | 2021 |
| 5.2 | 2007 | 7.1 | 2017 | 8.1 | 2022 |
| 5.3 | 2010 | 7.2 | 2018 | 8.2 | 2023 |
| 5.4 | 2013 | 7.3 | 2019 | 8.3 | 2024 |
| 5.5 | 2014 | | | 8.4 | 2025 |
| | | | | 8.5 | 2026 |

A cluster runs its oldest node's version. With b the number of newer versions out:

| Effect | Value |
| --- | --- |
| How-to ticket rate of web spaces on the cluster | × (1 + 0.05 · min(b, 6)), at most +30% |
| Unsupported | b ≥ 3 |
| Abuse report rate of a customer with a web space on an unsupported cluster | × 1.5 |
| Web hosting requests in Sales that need a supported version | min(1, 0.25 · (b − 2)): 25% at 3 behind, all at 6 |
| Performance of a node's sites in the hour after its upgrade | 70% |

A request that needs a supported version asks for the oldest one still supported and is lost when it would land on the old cluster. Through 2005 to 2009 the catalogue moves slowly, so a cluster set up in 2005 is unsupported from 2010; from 2015 a new version comes every year, and a cluster left alone for three years starts losing sales.

## Security advisories

Four scripted PHP vulnerabilities, modelled on real ones. Each fires on its date for a player with web sites on a cluster node running an affected version; a player without one never sees it.

| Date | Vulnerability | Affected versions |
| --- | --- | --- |
| 12 Mar 2007 | Zend engine memory corruption (Month of PHP Bugs) | 4.4, 5.1, 5.2 |
| 3 May 2012 | PHP-CGI query string options (CVE-2012-1823) | 5.1, 5.2, 5.3 |
| 22 Oct 2019 | PHP-FPM buffer underflow (CVE-2019-11043) | 7.1, 7.2, 7.3 |
| 7 Jun 2024 | PHP-CGI argument injection (CVE-2024-4577) | 8.1, 8.2, 8.3 |

| Stage | Hours after the announcement | Hourly chance an exposed node is compromised |
| --- | --- | --- |
| PHP announces it, patch date stated | 0 | 0 |
| Proof of concept on Twister | 24 | 1% |
| Agency warning (mass scanning) | 48 | 4% |
| Patch released | 60 | 4% for nodes still unpatched |

An exposed node runs an affected version without the patch, hosts web sites and has them online. A compromise:

| Effect | Value |
| --- | --- |
| Happiness of each customer with a site on the node (data leak) | −30 |
| Abuse report per such customer | 1 (spam) |
| Review | 1 star, written by 10% (20% below happiness 40) |
| Sites on the node | Down until cleaned up |
| Spam sent from the host's mail address | 12,000 a day through `addSpam`, as for any sender (Reputation) |
| Performance of the host's sites while compromised | 70% (the PHP upgrade slowdown) |
| Clean-up with a backup | 4 hours |
| Clean-up without a backup (rebuild) | 12 hours and −15 happiness |

Offline sites count as outages at the profile's hourly outage penalty (1 to 4). Taking a node offline at the warning and patching on release costs about 12 hours of outage, 12 to 48 happiness. Leaving it online from the proof of concept to the patch risks a compromise with 1 − 0.99²⁴ · 0.96¹² ≈ 52%, worth about −38 happiness with a backup and −69 without for a customer at penalty 2, plus reviews and support work. Going offline at the proof of concept costs 36 outage hours and rarely pays. Patching is the PHP upgrade: it installs the current version with the fix and slows the node's sites for an hour.

### Generated vulnerabilities

Every installed software has a `version`, the year of the release it runs, and `updatedAt`, the hour it was installed or last updated. A new install, and an update, set the version to the current year. A save from before versions gets the year its install finished when it is still installing and otherwise the save's year minus 2, updated at the save's hour.

Each software family releases one version a year. The vulnerabilities of a family's release in a year are drawn from the game's seed, the family and the year, so they are the same whenever they are looked up (Poisson count, mean by kind):

| Software | Vulnerabilities per year |
| --- | --- |
| Hosting panels | 2 |
| Hypervisors | 1 |
| Mail servers | 1 |
| Game panels | 1.5 |
| Customer CMS | 3 |

Game panels and customer CMS take effect with their own lanes.

| Severity | Share | Patch comes out | Daily chance of a compromise |
| --- | --- | --- | --- |
| Low | 50% | 0 to 14 days after disclosure | 0.05% |
| High | 35% | 0 to 14 days after disclosure | 0.25% |
| Critical | 15% | 0 to 3 days after disclosure | 1% |

With these chances a panel host that is never updated is first compromised after about a year and a half (median); the plan's first numbers were twice as high and hit within the first year.

Disclosure is a random day of the release's year. A vulnerability is open on an instance from its patch until the instance is updated, when the instance runs an older release than the vulnerability's year or the same release from before the patch. Exposure is counted in whole days from the patch, or from the last update when that is later, because before the patch nobody can update. The daily chance is multiplied by 2 from 30 days exposed and by 4 from 90 days exposed, and an instance rolls once a day with the highest chance among its open vulnerabilities.

| Rule | Value |
| --- | --- |
| Reached | A panel host with a web space online, a hypervisor with a customer virtual machine, the company's mail host; its control plane must be running |
| Compromise of a panel host | As in the table above: happiness, abuse reports, reviews, sites down, spam, clean-up |
| Compromise of a hypervisor | The same effects on its customers' virtual machines, which are down until clean-up |
| Compromise of a mail host | Spam from its address until clean-up |
| Banner at the patch (low and high) | Once per instance, only with Nagiosaurus installed |
| Alert at the patch (critical) | Once per instance |

An unattended panel host installed at the start of the game is compromised for the first time after a median of 0.8 years.

### Breaches and ransom

A critical vulnerability that has been open on an instance for more than 30 days can turn the daily exploitation roll into a breach. When the roll hits an instance (the table above) and the instance has such a vulnerability open, 25% of the hits are breaches: the attackers steal the customer data on the host and the host is not compromised in the usual way (no clean-up, no spam). A host with a ransom still undecided cannot be breached again. The customers on a host are those with a workload on it; a mail host holds every customer's mailbox. The tick draws from the seed, the host and the day (the exploitation roll uses tag 91, the breach roll tag 92).

The breach opens an extortion ticket from the Lockbitt Crew. It is an alert, so the game pauses and the sheet opens the ticket in Support. The ticket says the data is offered for sale online and names the sum. The player pays or refuses within 72 hours; no decision by then counts as a refusal, and so does Ignore.

| Rule | Value |
| --- | --- |
| Demand | 2 months of the monthly revenue of the customers on the host, at least €500 and at most €50,000, then × 3 from 2013 and × 5 from 2020 |
| Paying | The demand is booked as `ledger.ransom` (category fees); in 10% of the draws the data is sold anyway, otherwise nothing further happens |
| Refusing | The data is sold |
| Customers on a sold host | −40 happiness, 30% cancel at once, 20% write a 1-star review (reason data loss) |
| Awareness | Falls by 20% in every customer profile (a multiplier of 0.8, so a low awareness cannot go below zero) |
| Press | A banner reports the breach |
| Fine | 30 days after a sale, drawn once (table below), booked as `ledger.fine` (category fees) |

| Sale date | Chance of a fine | Fine |
| --- | --- | --- |
| Before 25 May 2018 | 20% | €2,000 to €25,000, log-uniform |
| From 25 May 2018 | 50% | 2% of the last twelve months of customer payments and setup fees, at least €2,000 and at most €200,000 |

The Security app lists every breach in a Breaches card: date, host, ransom, decision and outcome (open, data kept, or sold with the fine pending, none or its sum).

Anchors. Symantec's 2016 Internet Security Threat Report puts the average ransom at USD 679 (up from USD 294 in 2015). Small-business ransoms ran from USD 500 to USD 50,000 in 2016, which gives the bounds before the multipliers. NetDiligence's SME claims data has a median demand near USD 12,000 in 2017 to 2020, and Coalition reports an average demand of about USD 1.2 million for its insured firms in 2021, so the 2020 multiplier of 5 on a demand capped at €50,000 reaches €250,000 for a large host and stays well below that average. A paid ransom is no guarantee, which is why 10% of the payments still end in a sale. Fines: the old German Federal Data Protection Act (BDSG) allowed up to €300,000 and authorities used it rarely, hence 20% and a range far below the cap. The GDPR applies from 25 May 2018 with up to 2% or 4% of annual turnover; the first large fine was €9.55 million against 1&1 Telecom in 2019, so a small company pays the 2% of its own turnover with a floor and a ceiling. The 25% breach share, the 10% and the 30-day exposure are game choices: a patch that is a month old is long enough for the player to have reacted. Ledger category fees is new and holds both the ransom and the fine; no existing expense category fits them.

The balance bot never calls the tick, so its medians do not change; the exposure for a breach stays at 30 days.

### Updating software

An update installs this year's release at once and sets `updatedAt` to now. The customers on the software are down while it runs:

| Software | Downtime |
| --- | --- |
| Hosting panel | 30 minutes, for its web spaces |
| Game panel | 15 minutes, for its servers |
| Mail server | 15 minutes, no customers are affected |
| Hypervisor | 2 hours per node, for the virtual machines on it, none when the hypervisor moves virtual machines live and the cluster has a second node |

A technician at the server does the update in its office hour: panel and mail updates need panel training, hypervisor updates need server training. Nagiosaurus costs €15 a month in 2005 and rises 8% a year like the other Pear Store apps.

### Customer applications

Every web hosting service runs an app (`spec.app`): WordPass (WordPress), Joomlah (Joomla), Drupel (Drupal) or static HTML. It is drawn from the shares of the year the service starts, linear between the keyframes and flat from 2020; the share that is neither static nor WordPass splits Joomlah 3 : Drupel 1. Anchor: W3Techs measured WordPress on 13% of all websites in 2011 and 43% in 2022.

| Year | Static | WordPass | Joomlah | Drupel |
| --- | --- | --- | --- | --- |
| 2005 | 60% | 20% | 15% | 5% |
| 2010 | 35% | 40% | 18.75% | 6.25% |
| 2015 | 20% | 60% | 15% | 5% |
| 2020 and later | 15% | 70% | 11.25% | 3.75% |

Each service records `appVersion` (the release year it runs) and `appUpdatedAt` (the hour it was installed or last updated). The three apps have 3 vulnerabilities a year each, drawn like the company's software (`vulnsFor` with the app as the family, Generated vulnerabilities above), and a site is open to the patched ones the same way an instance is. A save from before customer apps draws the app from the service's start year and gets the release of two years before the save, or of its start year when that is later.

**Updating by themselves.** After a vulnerability for the app is patched, a customer updates by themselves with a chance by the skill of their profile, on a random day within 7 days of the patch. Updating installs this year's release, which closes every open vulnerability. Anchor: Sucuri found 61% of the hacked WordPress sites it cleaned in 2016 and 39% in 2017 outdated; WordPress 3.7 (2013) added automatic minor updates, so WordPass patches from 2013 use the second column.

| Skill | Before 2013 and other apps | WordPass from 2013 |
| --- | --- | --- |
| High | 80% | 95% |
| Medium | 40% | 70% |
| Low | 10% | 40% |

**Defacement.** A running site that is open rolls once a day with the daily chance of its worst open vulnerability (Generated vulnerabilities above, including the factors for 30 and 90 days exposed). A hit affects only that service:

| Effect | Value |
| --- | --- |
| Site | Shows as defaced; it stays online |
| Spam | 2,000 mails a day through `addSpam` on the host's address while defaced |
| Ticket | A how-to ticket from the customer, topic hacked |
| Clean-up by the player | `cleanSite`, 30 minutes of the player's time, from Monitoring or the ticket; resolves the ticket for +5 happiness |
| Clean-up by the customer | Medium and high skill: 50% clean it up themselves 1 to 3 days after the hit; low skill never |
| Third hack within 365 days | The customer cancels all services |

**Notifying.** Notify customers, per app and vulnerability from Monitoring, writes to every site open to it that has not been written to yet: 30 minutes of the player's time per 10 customers. Of the customers who would not update by themselves, 50% answer with a how-to ticket, topic update. Each customer who asks has a fixed wish, drawn by their profile's budget:

| Budget | One-off update | Managed updates | Refuses |
| --- | --- | --- | --- |
| Low | 80% | 0% | 20% |
| Medium | 70% | 20% | 10% |
| High | 55% | 35% | 10% |

The ticket offers three actions, each 20 minutes of the player's time. The one-off offer succeeds with a customer who wants it, books the `updateOnce` price as a sales ledger line and updates the site. The managed offer succeeds with a customer who wants it, sets `spec.managedUpdates`, adds the `updates` price to the service's monthly price (the customer agreed to it, so it costs no happiness) and updates the site. An offer to a customer who wants something else is declined and the ticket stays open. Doing it free updates the site and gives +5 happiness. A support agent who works such a ticket updates the site for free. A site with managed updates is updated on the day of every patch.

## Marketing and reviews

In 2005 a low-budget lead from search ads costs about €9, so a new private customer costs €25 to €80 depending on your share. Reviews skew negative unless you invite happy customers, which is what review platforms are for.

**Cost per lead** in 2026, scaled back with the search-ads multiplier (0.6 in 2005):

| Channel | Profiles reached | Cost | Condition |
| --- | --- | --- | --- |
| Word of mouth | Every profile, as referrals | Free | Always on |
| Search ads | Low budget / medium / high | €15 / €35 / €90 per lead | None |
| Gaming communities | Gamers | €8 per lead | None |
| Trade fair | Business profiles | See Trade fairs below | Company level 3 to 5 |
| Partner program | Sole proprietors, small businesses | Commission of the first 2 months' revenue | Each agency customer brings 0.5 leads a month |

Spending more in one channel and city gets dearer: the cost per lead is multiplied by 1 + monthly spend ÷ €5,000.

**Reviews.** After a closed ticket, an outage that hit them, a data loss or a cancellation, a customer writes a review with a 10% chance, or 20% when their happiness is below 40. The stars follow happiness, rounded after up to half a star of random noise and kept between 1 and 5. A customer refunded after a data loss who still writes a review gives 3 stars 60% of the time and otherwise follows the formula:

```math
\text{stars} = \operatorname{round}\left(1 + 4 \cdot \frac{H}{100} \pm 0.5\right)
```

**Review score.** The score covers the last 2 years and starts from a prior of 3.5 stars worth 20 reviews, so early reviews move it slowly:

```math
\text{score} = \frac{3.5 \cdot 20 + \sum \text{stars}}{20 + n}
```

**Review platforms.** Invites ask customers with happiness of 60 or more for a review each month, which counters the bias toward angry reviews.

| Platform | Invite rate per happy customer per month | Trust bonus T |
| --- | --- | --- |
| None | 0 | 0 |
| Free listing | 0 | 2 |
| "ProvenExpat" | 1% | 4 |
| "TrustPylon" | 2% | 6 |

Platform fees are flat: the free listing costs nothing, ProvenExpat €49 and TrustPylon €199 a month.

**Owned channels.** Each step is a one-off setup plus monthly upkeep, flat over the years:

| Step | Setup | Upkeep per month | Needs |
| --- | --- | --- | --- |
| Email | Free | Free | Always on |
| Web design | €400 | €15 | None |
| Order form | €900 | €10 | Web design |
| Goggle Ads | €50 | None | Web design |
| AI ads | €1,500 | None | Web design, from 2023 |

Web design and the order form are set up from the first day on the Admin page of the Browser, or in the Marketing app's Channels once Marketing campaigns is learned. The Marketing app waits for 450 know-how of research (Marketing basics, Employee management, Marketing campaigns), so a first-year company could not otherwise buy them before December.

The basic website every company starts with is free and brings no leads of its own. The web design brings 4 leads a month per location city, split by the profile mix. Every lead only writes when its product is listed on the website.

**Site hosting.** A rented host costs €9.90 a month from the month the web design is bought, flat over the years (ledger line "Website hosting: Strateaux"). Anchor: German shared hosting packages from Strato and 1&1 cost €5 to €10 a month in 2005. An own host costs nothing extra.

**Design generations.** The design belongs to a generation: 2005, 2009, 2013, 2017, 2021 or 2025 (every four years; the web design takes the generation of the year it is bought). With b = (current generation − design generation) ÷ 4, website leads and order form orders are multiplied by 1 for b of 0 or 1 and by max(0.4, 1 − 0.2 × (b − 1)) from b = 2:

| Design from | 2012 | 2013 to 2016 | 2017 to 2020 | 2021 on |
| --- | --- | --- | --- | --- |
| 2005 | 100% | 80% | 60% | 40% |

A redesign costs the web design setup (€400, ledger line "Website redesign") and sets the design to the current generation. Anchor: a small-business site cost $2,000 to $7,500 in 2005 to 2009 (WebpageFX, 2013); the game keeps all channel prices far below real agency prices on purpose, so the age penalty is the lever and not the price. The balance bot redesigns when it is two generations behind with more than €5,000 cash and keeps its site on the rented host.

**Trade fairs.** Costs are 2026 euros, scaled back with m = 0.6 like campaigns. Each fair needs one attendee of any role, who is away for the fair's days.

| Fair | Pun of | Date | Days | Level | Cost | Leads | Audiences | Network contacts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SeeBIT, Hanover | CeBIT | 6 March, until 2018 | 5 | 3 | €8,000 | 15 | Sole traders, small businesses, offices | 0.1 |
| CloudFeast, Rust | CloudFest | 23 March | 3 | 4 | €20,000 | 40 | Agencies, online shops, enterprises | 0.2 |
| RIPE-ish Meeting, Amsterdam | RIPE Meeting | 18 May | 5 | 3 | €3,000 | None | | 0.4 |
| DE-SIX Summit, Frankfurt | DE-CIX Summit | 7 October | 1 | 4 | €5,000 | 5 | Enterprises | 0.5 |
| Data Centre Whirled, Frankfurt | Data Centre World | 12 November | 2 | 5 | €35,000 | 60 | Enterprises, offices, online shops | 0.2 |

The leads arrive over the 730 hours after the fair, split evenly over the location cities and the audiences, with a conversion of 1.5. A marketing manager trained on fairs brings back 1.5 × the leads. At the next month start each audience of the fair gains 0.03 awareness on top of g. The network contacts of every fair attended in the last 12 months add up, each fading linearly to 0 over that year, capped at 1; `tradeFairBonus(s)` exposes the sum for transit prices and peering acceptance.

**Community events.** A request arrives 28 to 56 days after the previous one (the first after the start of the game), drawn evenly from the events at or below the company's level; it lapses after 14 days. The services are free, hourly products at the size index of the product's line (SIZES) and end after the duration. A service counts as down by its hours in `downHours`, kept per service while the event runs; the most down hours of any one service decide the outcome.
| Event | Pun of | Kind | Level | Services | Duration | Audience | Reward |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LAN-tastic | LAN party | Public | 1 | 2 game servers (smaller size) | 3 days | Gamers, private users | Awareness +0.02 for both |
| Chaos Computing Club | Chaos Computer Club meetup | Tech | 1 | 1 VPS (1 GB) | 90 days | Developers | Know-how 10 |
| Hack-a-Sorus | Hackathon | Tech | 1 | 2 VPS (1 GB) | 7 days | Developers | Know-how 25 |
| Debonair Linux mirror | Distribution mirror | Tech | 1 | 1 storage volume (500 GB) | 365 days | Developers | Know-how 15 |
| Frag-Fest | Gaming tournament | Public | 1 | 4 game servers (smaller size) | 3 days | Gamers | Awareness +0.03 |
| Linux User Group | User group website | Public | 1 | 1 web space (2 GB) | 365 days | Small businesses, private users | Awareness +0.01 for both |
| DevOops Conference | Conference streaming | Tech | 3 | 8 VPS (2 GB) | 7 days | Agencies, enterprises | Know-how 40 |
Awareness gains use the same share-of-the-gap rule as forum posts and fairs, each applied once when the event ends. A tech event adds a recommendation with a 20% chance: a technician applicant whose skill is a drawn applicant's plus 20 (at most 95, talent above it) stays in the market for 30 days. A public event adds a 5-star review with a 50% chance (written under the event's name) and a batch of 3 to 6 leads with conversion 1, split over the location cities and the audience, counted in the month after the event like fair leads. More than 2 hours down on any one service replaces all of this with two 1-star reviews and 0.9 times the awareness of every audience profile. The balance bot ignores every request, so balance runs are unchanged.

**Campaign channels.** Cost per lead in 2026, scaled back with m = 0.6 like search ads. Conversion multiplies the chance that a lead buys:

| Channel | Profiles | Cost per lead | Conversion |
| --- | --- | --- | --- |
| Goggle Ads | All | Search ads above | 1 |
| AI ads | All | 1.5 × search ads | 1.3 |
| Gaming communities | Gamers | €8 | 1 |
| Cold calling | Sole proprietors, small businesses, offices | €8, €12, €20 | 0.35 |
| Agency outreach | Agencies | €30 | 1, and the offered discount is quoted back |

Budgets are €100, €250, €500, €1,000, €2,500 or €5,000 a month, split evenly over the location cities and then over the targeted profiles. The saturation rule above applies per city.

**Awareness.** Each profile has an awareness between 0 and 1. It starts at 5% for private individuals and gamers and at 2% for everyone else, which is also the floor. At each month start it gains g on the gap to 1 and decays by 2%:

```math
a' = a + (1 - a) \cdot g - 0.02 \cdot a
```

```math
g = 0.05 \cdot \left(1 - e^{-L/100}\right) + 0.004_{\text{website}} + 0.006 \cdot (\text{score} - 3.5) + 0.001 \cdot T + \min(0.01,\ 0.0005 \cdot n_{H \ge 70})
```

L is the profile's paid leads this month and n the number of its customers with happiness of 70 or more. A steady €1,000 a month on one profile settles near 65% after about two years and falls back slowly once it stops. Forum posts and fairs add to the gain directly.

## Know-how and unlock costs

A first-year company earns about 300 know-how; a company with 10,000 customers earns about 25,000 a month. Unlock costs rise from 50 to 150,000 to match, so each tier of the tree opens at roughly the pacing target's year.

**Know-how per active contract per month:**

| Product | Know-how |
| --- | --- |
| Domain, SSL certificate, DNS | 0.2 |
| Web hosting, VPN | 1 |
| Game server | 1.5 |
| VPS | 2 |
| Storage hosting | 3 |
| Cloud servers, managed Kubernetes | 4 |
| Dedicated server, CDN | 5 |
| Colocation | 6 |

**Skills.** Trainings in the Research app make Pear Store items available. Know-how is paid when a training starts, one training runs at a time, and the skill is learned after its duration.

| Skill | Tier | Know-how | Training | Needs | Makes available |
| --- | --- | --- | --- | --- | --- |
| Monitoring | 1 | 50 | 5 days | | Dock badges, Nagiosaurus, failure notifications |
| Marketing basics | 1 | 50 | 5 days | | Leads to Marketing campaigns |
| Employee management | 1 | 100 | 10 days | | Staff |
| Network operations | 2 | 300 | 14 days | Monitoring | Network |
| Product management | 1 | 100 | 7 days | | Products |
| Provisioning automation | 2 | 150 | 10 days | Product management | Automatic setup of orders, the Place orders automatically switch |
| Marketing campaigns | 2 | 300 | 14 days | Marketing basics, Employee management | Marketing |
| Market research | 3 | 800 | 21 days | Product management, Marketing campaigns | Market |
| Virtualization | 3 | 400 | 14 days | Product management, Monitoring | Virtual machines |
| Automation | 3 | 1,500 | 21 days | Employee management, Monitoring | ChadGPT Support, Clipsy Reminders |

The whole tree costs 3,750 know-how and 121 days of training.

Product management was tier 2 at 200 know-how and 14 days after Marketing basics. The happiness run showed a careful first-year company earns 15 to 40 know-how a month, so the 250 know-how path landed in September to November. As a tier 1 skill at 100 know-how and 7 days, the same company learns it between early May and early July (median early June).

**Unlocks.** Launch costs are fixed and do not follow the price multipliers.

| Unlock | Branch | Know-how | Launch cost | Needs |
| --- | --- | --- | --- | --- |
| SSL certificates | Products | 80 | €500 | Level 1 |
| Own DNS hosting | Products | 60 | €500 | Level 1 |
| First hire | Business | 100 | €1,000 | Level 1 |
| Email hosting | Products | 150 | €2,000 | Level 2 |
| Dedicated servers | Products | 300 | €3,000 | Level 2 |
| Status page | Business | 300 | €1,000 | Level 2 |
| Shop | Business | 600 | €4,000 | Level 2 |
| Second location | Infrastructure | 400 | €2,000 | Level 2 |
| Market research | Business | 800 | €5,000 | Level 2 |
| Auto-cable | Infrastructure | 1,000 | €5,000 | Level 3 |
| Private networks | Products | 1,200 | €3,000 | Level 3 |
| Transit contracts | Network | 1,500 | €10,000 | Level 3 |
| Stacked switches | Infrastructure | 1,500 | €5,000 | Level 3 |
| Rack templates | Infrastructure | 2,000 | €10,000 | Level 3 |
| Auto-drain on hardware warnings | Infrastructure | 2,000 | €8,000 | Level 3 |
| Nightly rebalance | Infrastructure | 2,500 | €8,000 | Level 3 |
| Cross-selling boost (each) | Business | 2,500 | €10,000 | Level 3 |
| HA clusters | Infrastructure | 3,000 | €25,000 | Level 3 |
| Review platforms | Business | 3,000 | €5,000 | Level 3 |
| Cage | Infrastructure | 4,000 | €50,000 | Level 4 |
| Exchange peering | Network | 5,000 | €25,000 | Level 4 and an own ASN |
| Storage hosting | Products | 6,000 | €40,000 | Level 4 |
| Object storage | Products | 7,000 | €40,000 | Storage hosting |
| Managed databases | Products | 9,000 | €40,000 | Level 4 |
| Own network number (ASN) | Network | 8,000 | €20,000 | Level 4 |
| VPN | Products | 8,000 | €30,000 | Level 4 |
| SLA insurance | Business | 10,000 | €10,000 | Level 4 |
| Overlay networks | Network | 10,000 | €40,000 | Level 4 |
| Always-on DDoS protection | Network | 12,000 | €100,000 | Level 4 |
| Private suite | Infrastructure | 20,000 | €250,000 | Level 5 |
| CDN | Products | 25,000 | €200,000 | Level 5 |
| Domain registrar | Independence | 30,000 | €150,000 | Level 5 |
| Cloud servers | Products | 80,000 | €500,000 | Level 5, from 2010 |
| Load balancers | Products | 20,000 | €60,000 | Cloud servers |
| Managed Kubernetes | Products | 40,000 | €150,000 | Cloud servers, from 2016, and a Kubernetes engineer |
| Own datacenter | Infrastructure | 80,000 | €2,000,000 | Level 6 |
| Colocation | Products | 100,000 | €100,000 | Level 5 and an own room |
| AI bots | Business | 150,000 | €1,000,000 | Level 5, from 2023 |

## Net worth and level thresholds

Net worth values the customer base at two years of recurring revenue, plus cash and hardware, minus debt. The thresholds below match the pacing targets: €400 of monthly revenue reaches level 2, and €1 million reaches level 6.

```math
\text{net worth} = \text{cash} - \text{debt} + \text{hardware book value} + 24 \cdot \text{MRR}
```

Hardware book value is the resale value of every owned device and rack: 100% to 80% over the first month, then down to 20% over the next 24 months. Leased devices count for the lessor, not for you. MRR is every running contract's monthly price: hourly prices × 730 and yearly prices ÷ 12. The start counts €1,000 cash, €2,910 of hardware and 24 × €18 of the friends' revenue, about €4,340.

The GDD counts years in operation inside net worth. Here they are a separate minimum per level instead, which keeps the formula simple and stops a lucky first year from skipping ahead.

| Level | Name | Net worth | Years in operation |
| --- | --- | --- | --- |
| 1 | Basement Hoster | Start | 0 |
| 2 | Garage Hero | €15,000 | 0 |
| 3 | Rack Renter | €100,000 | 1 |
| 4 | Cage Fighter | €750,000 | 3 |
| 5 | Room Service | €5,000,000 | 5 |
| 6 | Datacenter Baron | €30,000,000 | 8 |

A company whose net worth stays below 80% of its level's threshold for 6 months drops one level, and customers who require the old level stop renewing.

## Bank, insurance and tax

A level-1 company borrows at about 10% interest and a level-6 company at about 4.5%. Profit is taxed at 30% each April, and a company that stays out of cash for 30 days goes bankrupt.

**Loan interest** is the year's base rate plus a risk premium for the company level. Base rates follow these keyframes, with straight lines between them:

| Year | | 2009 | 2015 | 2021 | 2023 | 2026 |
| --- | --- | --- | --- | --- | --- | --- |
| Base rate | 4.0% | 2.5% | 1.0% | 1.0% | 4.5% | 4.0% |

| Level | Risk premium | Minimum loan limit |
| --- | --- | --- |
| 1 | 6.0% | €10,000 |
| 2 | 4.0% | €25,000 |
| 3 | 3.0% | €100,000 |
| 4 | 2.0% | €500,000 |
| 5 | 1.0% | €3,000,000 |
| 6 | 0.5% | €20,000,000 |

The loan limit is the higher of the level's minimum and 12× the average monthly gross profit of the last 6 months. Loans run 1 to 10 years and are repaid in equal monthly instalments.

**Missed repayments.** Each one adds 2 points to the loan's rate, costs a €100 fee and blocks new loans for 12 months. After three in a row the bank calls in the whole loan.

**Bankruptcy.** When cash stays below zero for 30 days and no loan is available that covers the deficit, the company is insolvent and the game ends.

**SLA insurance.** The monthly premium is 2% of the recurring revenue from customers with an SLA, times an uptime factor: 1.0 at 99.95% or better over 90 days, 1.5 at 99.9% or better, and 2.5 below that. A missed SLA owes the customer 10% of their monthly fee per 0.1% of uptime below the promise, up to the full fee. The insurer pays those credits for three claims, then blocks the company for a year.

**Tax.** Prices are without VAT, and VAT is not simulated. Corporate tax takes 30% of each year's profit in April of the following year, and losses carry forward to later years. Taxable profit is the year's ledger without loan principal; instalments count only their interest, and hardware is a cost in the year it is bought.

**Hardware insurance.** The monthly premium is 1.5 × the expected yearly cost of spare parts for every working component still within its life expectancy (part price × its current yearly failure rate, with the manufacturer and overheating factors) / 12, at least €1. A claim pays the spare part's price and the remote hands bill for a component that failed while insured and before the end of its life expectancy; wear-out failures after that are not covered, so parts past their lifetimes add nothing to the premium. The starting basement server costs about €1.40 a month to insure.

## Balancing

The numbers above are first guesses. A headless run of the simulation proves or breaks them before any UI exists, and it stays in CI so later changes can't quietly wreck the pacing.

**The balance run.** `npm run balance` plays 15 game years over 20 seeds with two scripted players and prints, per year, the level, customers, recurring revenue and lowest cash.

- **Steady bot:** prices at 0.8× base, hires a support agent whenever the queue is over a day old, and adds capacity whenever a cluster is 80% full. Its median run must hit each level within a year of the pacing target and never go bankrupt.
- **Solo bot:** plays the same way but never hires. It must survive and reach level 5 within a year of its target, and reach level 6 later than the steady bot, which shows that hiring is how you scale and still optional.

A Vitest suite runs both bots on fixed seeds and fails when either rule breaks. The `balance` skill from the GDD reads the run's output and suggests which value to tune.

**The happiness run.** `npx tsx scripts/happiness.ts [seeds] [months]` plays the real tick and actions like a careful player: every order step at the market price, the setup once paid, the right template on every ticket, the careful action on notices and legal requests, sales quoted at the market price, domains renewed, orders declined when the cluster cannot fit them, and another server bought by the steady bot's 80% rule. Per month it prints customers with a live service, MRR, average happiness, the happiness change by source, the hours services spent down by cause and the wait penalties by ticket kind.

**Happiness decay in the early game (2005).** The happiness run found two causes that sank a well-played company to near zero happiness by spring, with churn in waves:

- Automatic placement booked RAM up to 1.5× installed. Memory in use is booked RAM × (0.6 + 0.4 × load), so a basement server booked past about 8 GB froze most evenings: 86 to 270 service-hours down per customer per month. Automatic placement then preferred nodes within the installed RAM, and later any booking became allowed, so the scheduler only prefers them (Usage curves and overcommit).
- A slowed node cost each customer 1 − performance per hour. Drift recovers only a fifth of the gap each month, so a steady monthly loss D settles happiness about 5 × D below the drift target; a node slowed to 72% for 54 evening hours a week cost about 65 a month and drove customers to churn. At 0.1 × (1 − performance) the same node costs about 6 a month and a node at 40% for 80 hours a week still costs about 20, enough to churn customers when the player keeps overloading.

With both changes the careful bot on seeds 1 to 6 holds happiness near 90 through 2006 instead of 15 to 50. Its size was then set by capacity: one 8 GB basement server holds about €180 of monthly revenue (7 to 16 customers, since VPS and game server orders book 0.5 to 4 GB each), the second server costs €2,500 against €1,000 starting cash and €150 to €300 saved a month, and its December customers stayed at 12 to 20 with €130 to €230 of revenue.

**Early capacity.** The happiness run now plays the loan path. When the cluster is 80% booked and cash is short of the server plus a €2,000 reserve, the bot takes the smallest preset loan that covers the gap over five years, buys a Dwell server, mounts and cables it and adds it to the cluster, up to the basement's four servers. It grows a panel VM only within its server's installed RAM and starts another panel VM otherwise. Once the basement's evening peak reaches 90% of the upload it orders the cheapest line with more upload (SDSL 2048 in 2005). It learns Product management, then Marketing basics, and sets up web design and the order form once no server is due and cash keeps the reserve. With these rules, seeds 1 to 6 reach the following by December 2005:

| Seed | Customers | MRR | Happiness | Net worth | Level | Product management | Order form |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 68 | €631 | 83 | €14,776 | 1 | Early June | Early February |
| 2 | 47 | €606 | 92 | €13,190 | 1 | Early July | Early April |
| 3 | 60 | €577 | 91 | €13,436 | 1 | Early May | Late January |
| 4 | 46 | €659 | 91 | €15,684 | 2 | Early June | Mid February |
| 5 | 43 | €452 | 93 | €9,736 | 1 | Early June | Early February |
| 6 | 47 | €682 | 92 | €15,923 | 2 | Early June | Mid March |

The year 1 targets for customers and revenue hold (median 47 customers and €619), happiness stays near 90, and the median company ends 2005 within about €1,500 of level 2, which two of six seeds reach: the loan buys hardware that is worth only its resale value, so the debt costs net worth. The level 2 threshold stays at €15,000; the balance model reaches it in half its seeds by December.

**The balance model and the live rules.** The cohort model in `src/sim/balance/model.ts` follows the live capacity rules:

- Each cohort's spec is the year's middle size × 1, 2 or 4 by budget (`BUDGET_SIZE`), a web space with two mailboxes per step, priced at the live market rates (Per-resource pricing). It books its spec's vCPUs and RAM: a web space 0.25 GB, a VPS the year's base RAM by budget, and a game server 4 GB of the year's base by budget. Gamers ask for a game server 60% of the time. The cluster keeps 1 GB for its hypervisor and panel.
- The starting server and every basement server are the year's Dwell server at its full price and RAM (8 GB for €2,500 in 2005).
- While in the basement, the home line's upload caps the evening peak at 2× each customer's mean traffic, and the bot switches to the cheapest faster line at 90%.
- The bot borrows in the basement like the happiness run; out of the basement it borrows only while all instalments stay under 60% of its recurring revenue. It buys a server only when cash keeps €2,000 plus three instalments, and it moves to the datacenter once the basement's four servers are in place.
- Net worth subtracts debt and values hardware at its resale value, as `metrics.ts` does.

The basement VPS cap of 8 is gone, since RAM and upload now set the limit. Against the model before these changes, level 2 arrives at the same time (median 2006.6 against 2006.3, half the seeds in 2005), level 3 later (2011.3 against 2009.9), level 4 earlier (2014.1 against 2017.6), and neither bot goes bankrupt. Levels 3 to 6 still missed their pacing years; the next paragraphs find why and bring the median steady run to level 2 in 2006.0, level 3 in 2006.8, level 4 in 2008.9 and level 5 in 2013.5.


**The stall after the basement.** With the rules above the steady bot sat between 87 and 262 customers from 2006 to 2010. Instrumenting the model per year (median of 20 seeds, year-end cash) showed why:

| Year | Customers | MRR | Net worth | Cash | Debt | Binding constraint |
| --- | --- | --- | --- | --- | --- | --- |
| 2005 | 45 | €810 | €18,063 | €3,444 | €15,777 | Basement RAM and upload |
| 2006 | 87 | €1,499 | €31,857 | €4,110 | €23,505 | Capacity: 156 sales won, 43 fit |
| 2007 | 108 | €1,662 | €31,968 | €4,383 | €22,731 | Capacity: 172 won, 44 fit |
| 2008 | 147 | €2,170 | €44,735 | €5,330 | €22,079 | Capacity: 178 won, 73 fit |
| 2009 | 201 | €2,922 | €67,233 | €5,963 | €22,285 | Capacity: 198 won, 103 fit |
| 2010 | 262 | €3,889 | €95,970 | €7,271 | €23,575 | Capacity: 228 won, 120 fit |
| 2011 | 423 | €8,767 | €218,456 | €9,823 | €44,385 | Level 3 loan limit |
| 2013 | 1,327 | €29,603 | €757,290 | €19,296 | €96,747 | Level 3 loan limit |
| 2015 | 3,632 | €79,752 | €2,212,533 | €154,090 | €99,708 | Leads |

Leads were never the problem before 2014: about 500 a year reached the company and a third of them bought, but most sales did not fit the cluster. The bot could not add servers because each datacenter server lost money and the level 2 loan limit of €25,000 was used up. Four rules in the model were wrong against the live game:

- **Datacenter costs.** The model charged a flat €60 per U a month. The live game rents rack shares (the cheapest home-city share, Hetzler Park in Frankfurt, costs €36 to €198 a month for 1/8 to a full rack, about €6 to €13 per server) and bills power per kWh and the datacenter's bandwidth per TB. The model now rents the cheapest home-city share whose kW limit holds the servers' rated draw, pays power at 60% of that draw times the datacenter's power factor, and pays bandwidth for every customer's traffic. Running a 2005 server in the datacenter now costs about €38 a month instead of €60, with bandwidth the largest part.
- **Web hosting resale.** The model charged 40% of every web space's price as a resold line. Web hosting runs in panel VMs on the company's own servers; only domains are resold. The charge is gone.
- **Server lines.** The model bought only the balanced 1U. The Shop sells the memory-optimized 2U from 2005: four times the RAM for 1.8 times the price and 1.6 times the power. Out of the basement the bot now picks the line with the lowest price per GB it can fill, counting the vCPUs its customers book (0.1 per web space, one per 2 GB of VPS, two per 4 GB game server, at most 8 per core). RAM, not CPU, sets the limit in 2005, so it buys memory-optimized servers.
- **Leasing and the loan limit.** The model had no leasing, and its loan limit ignored the live rule's 12 × average monthly profit. The bot now takes the cheapest of three lease offers (factor 1.06 to 1.40, 12 to 36 months) when the bank says no, but only when the payment is below what the server earns at 80% booked at last month's revenue per GB, less its running costs. Leases sit outside the 60% instalment rule because each one pays for itself. Leased hardware is not in net worth until it is paid off, as in `metrics.ts`.

Two bot rules were changed to match a careful player. The bot moves out of the basement no earlier than October of year 1: the model has none of year 1's setup work (trainings, website, order form) and otherwise filled the basement by April, while the happiness run fills it in the last quarter. At the move the basement servers ride along to the rack share for €300 and the home line is cancelled.

No price, threshold or loan limit moved. With these changes (median of 20 seeds):

| Year | Customers | MRR | Net worth | Cash | Debt |
| --- | --- | --- | --- | --- | --- |
| 2005 | 36 | €617 | €14,381 | €2,761 | €8,483 |
| 2006 | 192 | €5,326 | €128,376 | €9,214 | €31,797 |
| 2007 | 670 | €18,226 | €441,465 | €23,417 | €96,060 |
| 2008 | 1,246 | €30,735 | €777,238 | €33,621 | €88,336 |
| 2010 | 4,082 | €97,768 | €2,733,935 | €188,879 | €116,413 |
| 2013 | 8,189 | €175,431 | €6,015,412 | €1,457,996 | €14,794 |
| 2019 | 14,833 | €289,245 | €13,454,433 | €6,187,137 | €0 |

From 2006 every sale fits the cluster, so leads set the pace. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.6 | 2006.0 | 2005.5 | 2005.8 |
| 3 | 2007 | 2011.3 | 2006.8 | 2011.4 | 2006.6 |
| 4 | 2010 | 2014.1 | 2008.9 | 2016.0 | 2009.7 |
| 5 | 2013 | never | 2013.5 | never | never |
| 6 | 2018 | never | never | never | never |

Neither bot goes bankrupt. Level 3 arrives with fewer customers than the pacing table (about 190 instead of 400) at the same revenue, because VPS and game servers pay more per customer than the table assumed. Level 4 arrives a year early: once leases pay for themselves, capacity grows as fast as sales. If level 4 should land closer to 2010, the lease offers are the place to tune. The solo bot reaches level 3 a little before the steady bot because it pays no hiring unlock or salaries in 2006; it falls behind from level 4 when support runs out.

**Level 6.** The steady bot stayed at level 5 with about 15,000 customers in 2019 against 40,000 targeted, while €6 million of cash sat idle. Counting leads by source, wins and cancellations by cause per year (median of 20 seeds) showed:

| Year | Customers | MRR | Leads | Organic | Referrals | Paid | Won | Cancelled | Of them natural churn | Cities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2010 | 4,082 | €97,768 | 7,120 | 2,674 | 120 | 4,328 | 2,412 | 907 | 884 | 4 |
| 2013 | 8,189 | €175,431 | 11,064 | 3,720 | 261 | 7,081 | 3,560 | 1,911 | 1,910 | 6 |
| 2016 | 12,492 | €256,375 | 14,399 | 4,770 | 416 | 9,213 | 4,670 | 3,141 | 3,030 | 6 |
| 2019 | 14,833 | €289,245 | 14,626 | 4,752 | 518 | 9,297 | 4,799 | 3,659 | 3,659 | 6 |

A third of leads bought every year. Churn ran at about 25% a year and nearly all of it was the profiles' own monthly churn (1% to 4% a month by profile, inside the 1% to 3% a month of real small-business hosting); happiness, outages and price added almost nothing, since the bot prices at 0.8 and keeps support up. So churn was not inflated by a bug. The binding constraint was lead flow, and the model computed it with rules the live game no longer has:

- **Organic leads.** The model gave every location city a flat 20 leads a month × the level factor × the review multiplier. The live game (`30-market/market.ts`) gives 0.4 × the city's new customers × the profile's awareness × the same factors, and awareness grows from the website, reviews, happy customers and campaigns (see Awareness under [Marketing and reviews](#marketing-and-reviews)). The model had no awareness, no website leads and no market growth in organic leads.
- **Paid leads.** The model spent 10% of MRR on search ads without a limit, €29,000 a month by 2019. The live game runs one campaign per channel at €5,000 a month at most.
- **Cities.** The bot opened 6 of 18 cities and stopped, although every city has a datacenter whose cheapest 1/8 share costs €32 to €140 a month, and a location there is all a lead needs to buy.

With the live rules in the model, the problem turned around: awareness reached 30% by 2007 and 55% by 2010, organic leads ran at ten times the old flat rate, and the old cap of a quarter of each city's new customers let the steady bot reach level 5 in 2010 and level 6 in 2013, at the floors set by company age. Every competent player who sets up a website would hit the cap in each location city from about 2008. Once leads sit at the cap, the cap and the number of cities set the pace, so the cap had to carry a real-world anchor instead of an open question. A host that 25% of a city's new customers look at is the market leader. At level 6 the pacing table targets about 40,000 customers in 2018, which is about 10,000 new customers a year at 25% churn; at a third of leads won, that is about 30,000 leads, or 5% of the 2018 new customers of all 18 cities.

The cap is now 1.6% × (1 + 0.5 × level) of a city's new customers per profile, from 2.4% at level 1 to 6.4% at level 6, on organic leads and referrals; website and campaign leads come on top as in the live game. It grows with level like organic reach, since a bigger company is known to more buyers. The bot now follows the live lead rules: awareness per profile, a website and order form once out of the basement, website leads, and a search campaign at the largest preset budget within 10% of MRR, at most €5,000, spread over every profile and city with 10% spilling to cities without a location. It opens 2 cities at level 3, 4 at level 4 and all 18 from level 5, largest market first, each with its cheapest datacenter's 1/8 share and a memory-optimized server. It also buys ChadGPT Support once it knows Employee management, Monitoring and Automation and support runs behind: the bot answers how-to and billing tickets around the clock at twice a skill-50 person's rate with the right reply 60% of the time, for €300 a month in 2005. Organic leads now count the live formula; the old flat 20 is gone.

| Year | Customers | MRR | Leads | Organic before the cap | Cap | Paid | Won | Cancelled | Cities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2010 | 5,480 | €133,348 | 8,133 | 66,655 | 5,700 | 2,511 | 2,868 | 1,122 | 4 |
| 2013 | 17,781 | €410,707 | 25,755 | 312,769 | 22,490 | 2,765 | 8,794 | 3,569 | 18 |
| 2016 | 30,210 | €650,478 | 31,421 | 398,905 | 28,330 | 2,570 | 10,181 | 6,181 | 18 |
| 2018 | 39,408 | €819,858 | 40,746 | 538,677 | 37,765 | 2,448 | 12,712 | 7,892 | 18 |

Churn stays nearly all natural, at about 21% a year. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 | 2005.8 | 2005.8 |
| 3 | 2007 | 2006.8 | 2006.8 | 2006.6 | 2006.5 |
| 4 | 2010 | 2008.9 | 2008.6 | 2009.7 | 2008.3 |
| 5 | 2013 | 2013.5 | 2011.8 | never | 2012.2 |
| 6 | 2018 | never | 2017.5 | never | never |

Neither bot goes bankrupt. The solo bot now reaches level 5: ChadGPT carries the routine tickets that used to bury its 60 hours a month, and it settles near 20,000 customers in 2019, held back by the tickets only people answer. Level 5 arrives about a year early because the bot opens every city the moment it reaches level 5; a later level 5 would come from a slower expansion, not from the cap. The steady bot still hires: 35 people by 2019 for the upgrade, outage and cancellation tickets the bot does not take. ChadGPT covers the routine tickets of about 20,000 customers for €300 a month, which makes support hires optional until then; if hiring should matter earlier, its work rate or price is the place to look.

**ChadGPT usage pricing.** ChadGPT moved from a flat €300 to €50 plus tokens per reply, with up to 4 replies per ticket before the ticket goes back to people. The model now counts ChadGPT's work in replies: it clears its capacity divided by the replies per ticket, the unsolved rest stays in the queue, and every reply is billed. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 | 2005.8 | 2005.8 |
| 3 | 2007 | 2006.8 | 2006.8 | 2006.5 | 2006.5 |
| 4 | 2010 | 2008.6 | 2008.6 | 2008.3 | 2008.3 |
| 5 | 2013 | 2011.8 | 2011.9 | 2012.2 | 2012.8 |
| 6 | 2018 | 2017.5 | 2017.9 | never | never |

Neither bot goes bankrupt. The steady bot pays €500 a month for ChadGPT in 2008, €5,400 in 2012 and about €10,600 from 2014, when one ChadGPT runs at capacity, next to €118,000 of salaries in 2018. The solo bot pays €3,400 a month in 2012 and €10,600 by 2018. It reaches level 5 about half a year later than before, because the tickets ChadGPT gives up on land in its 60 hours a month; with 3 tries instead of 4 it reached level 5 only in 2013.6.

**Per-resource pricing.** The model now prices each cohort's spec at the live market rates per resource. The steady bot's median years reached, before and after:

| Level | Target | Steady before | Steady after |
| --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 |
| 3 | 2007 | 2006.8 | 2006.8 |
| 4 | 2010 | 2008.6 | 2008.7 |
| 5 | 2013 | 2011.9 | 2011.9 |
| 6 | 2018 | 2017.9 | 2018.2 |

The solo bot reaches level 5 in 2012.9 instead of 2012.8. Neither bot goes bankrupt.

**Traffic and setup fees.** The model's specs now carry traffic (the live TRAFFIC_GB, growing 20% a year, × the budget size) priced at the market rate per 100 GB, and while the order form is up every new customer without a high budget pays the market's setup fee once on three in four orders (one in four still writes an email, `EMAIL_SHARE`), collected at the on-time share. The model sells no DNS or VPN, so per-unit DNS and VPN leave it alone. Medians before and after:

| Level | Target | Steady before | Steady after |
| --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 |
| 3 | 2007 | 2006.8 | 2006.8 |
| 4 | 2010 | 2008.7 | 2008.6 |
| 5 | 2013 | 2011.9 | 2011.9 |
| 6 | 2018 | 2018.2 | 2017.9 |

The solo bot reaches level 5 in 2012.8 instead of 2012.9. Neither bot goes bankrupt.

**Open questions**

- Should customers be simulated one by one or in cohorts? Per-customer happiness assumes one by one; 40,000 customers on an hourly tick should be fine in TypeScript, but save size needs a check.
- Should competitor scores stay fixed forever, or rise about 1 point a year so late-game players can't coast?
- After 2026, do prices stay flat (as written) or keep their trend?
- Bankruptcy as the lose condition is new; does it fit the game?
