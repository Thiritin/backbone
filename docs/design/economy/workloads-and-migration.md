# Workloads and migration

**Sizes.** A web space uses 0.1 vCPU, 0.25 GB of RAM and its spec's disk. A VM uses its spec's vCPUs, RAM and disk. A game server starts at 0.5 vCPU and 0.5 GB of RAM in 2005, doubling every 7 years like VPS sizes.

**Starting sizes.** The catalog in `src/sim/10-catalog/products.ts` holds the sizes each line's customers start from (`SIZES`). "Base" is the year's base RAM g (`vpsPlanGb`), 1 GB in 2005 and doubling every 7 years. Each size is priced by Per-resource pricing below; the prices in the table are for 2005 at the basic SLA.

| Product | Sizes | One unit uses | Market price (2005) | Runs on |
| --- | --- | --- | --- | --- |
| Web hosting | 3 | 0.1 vCPU, 0.25 GB RAM, 1, 2 or 5 GB disk × growth, two mailboxes | €3.75, €6, €12.75 a month | Cluster |
| VPS | 4 | 0.5, 1, 2 or 4 × base RAM; 1 vCPU per 2 GB (at least 1); 20 GB disk per GB of RAM | 0.65, 1.1, 2 or 4 × the VPS rate (€30 per GB); from 2012 the smallest is 1.1 × | Cluster |
| Game server | 2 | 0.5 or 1 vCPU, 0.5 or 1 GB RAM, 5 or 10 GB disk × growth | €29.25 or €58.50 a month (€11.70 or €23.40 in 2026) | Cluster |
| DNS hosting | 2, 5 or 15 zones | 0.05 vCPU, 0.1 GB RAM, 1 GB disk | €1.10, €2, €4.98 a month | Cluster |
| VPN | 1, 3 or 10 users | A vCPU per three users (at least 0.5, in quarters), 0.5 GB RAM, 1 GB disk | €2.03, €5, €15.22 a month | Cluster |
| Storage hosting | 100 GB, 500 GB, 1 TB | Disk only | About €8, €42, €83 a month | Cluster |
| Cloud servers | 1 | Like the 1 × base RAM VPS | 1.25 × that VPS | High-availability cluster |
| GPU servers | 4 | 1, 2, 4 or 8 cards; per card 4 vCPUs, 8 GB RAM × growth and 50 GB disk × growth | 1, 2, 4 or 8 × the card rate of GPU cards and rental | Cluster with free cards |
| Dedicated servers | 2 | A whole server with at least 8 or 32 GB × growth | €79, €299 a month in 2005 | A free server |
| Colocation | 1U, quarter, half, full rack | 1, 10, 21 or 42 units and 150 W, 1, 2 or 4 kW | €60, €415, €845, €1,675 a month | Datacenter rack |
| Domains | 1 | Nothing | €15 a year in 2005, then the fixed-price keyframes | Resold |
| SSL certificates | DV, OV, EV | Nothing | €50, €150 and €400 a year in 2005, then the SSL keyframes | Resold |

**Per-resource pricing.** Every line charges a base fee per service plus a price per unit of the spec (`marketRates` and `specPrice` in `products.ts`). The market's rates are per month at the basic SLA, per year for domains and SSL, with r the year's VPS rate per GB of RAM (`vpsRatePerGb`, €30 in 2005) and g the base RAM. An SLA multiplies the sum by its price factor, and a request's market reference is that price × the profile's offer factor (Reference and budget).

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
| SSL certificate | The DV price a year (SSL keyframes) | OV and EV validation: the OV and EV prices less the DV price |
| GPU server | €0 | The year's card rate per GPU (GPU cards and rental), 1% of the 2-card price taken by traffic |
| Dedicated server | €6 | €220 ÷ 24 ÷ g per GB of the smallest server RAM it accepts |
| Colocation | €15 | €30 per rack unit, €100 per kW |

Each line with traffic also charges it per 100 GB a month (Traffic, below). The table gives the rates before traffic takes its share. The web hosting, domain and dedicated server rates are the 2005 values; later years multiply them by the fixed-price keyframes (Prices over time).

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

**Setup fees.** A shop order pays a one-time setup fee on top of its first month (`marketSetup` in `products.ts`, `setupFee` in `spec.ts`). The market's fee in 2005, falling to a third by 2026 (m = 3), rounded to whole euros: web hosting €10, VPS €15, game server €15, DNS €5, VPN €10, storage €10, cloud server €0, dedicated server €75, colocation €150. The player sets a line's fee in Pricing next to its rates; empty charges the market's. Customers weigh a fee above the market's as if spread over 36 months of the line's middle size (`SETUP_MONTHS`): the difference ÷ (36 × that monthly price) adds to the price index for leads that would order through the shop, so a dearer fee brings a few fewer shop orders and a cheaper one a few more. Twice the market's web hosting fee costs about 7% of the shop's share. Email orders and sales requests charge no setup fee.

**Shop invoices.** The shop invoices an order the moment it is placed: the setup fee (left out when it is zero) and the full first month at the order's price. The service is prepaid for 730 hours, so the monthly run bills only the hours after that and the first month is never billed twice; this is the same rule an email order's invoice step uses. The invoice is due in 14 days, and an on-time payer pays it within 1 to 3 days. Its payment books as two ledger entries: the setup fee under Setup fees and the rest under Customer payments, so the two add up to the invoice total (a collections payout splits the same way).

**The player's rates.** The Products app's Pricing view holds one rate per unit for each line (`rates.ts`). An empty rate charges the market rate, and Market rates resets the whole line. Rates apply to new sales: the shop charges a spec at the player's rates × the SLA factor × (1 − campaign discount) and places it at once. Overpricing costs leads through the price factor in Choice with prices and customers through Price tolerance and churn. Services already sold keep the price they were sold at, and raising one goes through Price changes with its tolerance, complaint and retention rules. Email orders are priced by hand, prefilled at the market reference less any campaign discount. Saves from before per-resource pricing give every service, request and lost sale with a plan that plan's size as its spec in the year it started, and start with every rate empty. Saves from before DNS zones and VPN users give each DNS or VPN service the count its monthly price buys at the loading year's market rates (less the base fee and traffic, at least one); requests and lost sales use their market reference. Their setup fees start at the market's.

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
| Between zones (cold) | (Disk + RAM) ÷ free bandwidth of the link between the zones, or over the internet at the slower side's uplink, at most 45 GB an hour | The whole transfer; a zone link wins when there is one |
| Between zones (live) | As above, then a final sync of RAM × 0.1 ÷ free bandwidth | Under 5 seconds; needs a link of 10G or more |
| Recovery off a server that is off, by hand | The hand work's wait + 1 hour + (disk + RAM) ÷ link speed | The whole time |

A VM or game server on a server that is off or failed, whose cluster's control plane is also down, can be recovered by hand to a working node of another cluster in the same location (`rescueWorkload`, src/sim/90-actions/vms.ts). It needs no control plane and is billed like other hand work.

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

**Moving a server.** "Move to" on a mounted server ships it with its workloads into the first rack with free room at another location. It costs what moving a rack costs (€300 in the same city, €1,200 to another city, €4,000 overseas), the cables are patched to the same kind of device in the new rack. The server is driven over (1 hour in the same city, 4 in the same country, 9 to another European country, as the drives in Hardware, power and failures) and couriered overseas (240 hours). The install is 2 to 4 hours of hand work at the far end (remote hands or a friend), which starts once both the server and the hands are there, so the server is offline for the longer of the trip and the hand work wait, plus the install. A cluster that runs on more servers than this one cannot move, and the zone of the server's clusters and services changes with it. The customers on the server get a maintenance window that starts at once and lasts the whole downtime (Happiness and churn, planned maintenance), which makes its notice late and halves the penalties; a window planned at least 24 hours ahead that covers the whole move is used instead and nothing new is announced. Move servers on a rack loads several of its servers at once, and a cluster moves when all of its servers go together. Drive it yourself takes the load in your own car when you stand at the servers and are free: you pay only the drive fare (€20 in the same city, €90 in the same country, €250 to another European country) with no shipping and no remote hands bill, and you rack the servers on arrival, so they are offline for the drive plus 2 to 4 hours of install per server. A friend can take a load from home for one favour and the €35 round, with no shipping either.

**Renumbering.** A service that changes location gives its IPv4 addresses back and takes the same number from the target's free addresses (the ones rented there plus the room in announced blocks); rented addresses go back to their provider and stop being billed. The move is refused with "No free address in this location." when the target has fewer. This applies to cold migrations, accepted migration offers and server moves alike. A customer with a renumbered IPv4 loses 5 happiness (they update their DNS), 2 when they were told beforehand: through an accepted migration offer or a window planned a day ahead. An address of the company's own block is not renumbered when the company announces a block at both locations; it stays with the service and the customer notices nothing.

**Restart after a node fails.** In a high-availability cluster, workloads restart on other nodes after 5 minutes of detection plus 2 minutes of boot. Customers count that time as an outage.

**Hardware warnings.** 60% of disk and power supply failures announce themselves 1 to 7 days early. A node drained before its failure causes no outage.

**Private networks.** A private network costs the customer €5 a month as an add-on (m = 1) and costs you nothing to run.
