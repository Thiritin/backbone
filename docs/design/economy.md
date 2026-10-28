# Backbone economy model

This doc turns the systems in the [game design document](gdd.md) into formulas and starting numbers. Every value is a starting point to tune, and all of them live as data in `src/sim/10-catalog`.

## Clock and pacing

At 1×, one game hour lasts 2.5 seconds, so a game day takes 1 minute and a game year about 6 hours. The simulation ticks every game hour. Billing, salaries, know-how and the market run on the monthly tick.

| Speed | Game day | Game month | Game year |
| --- | --- | --- | --- |
| 1× | 1 min | 30 min | 6 h |
| 2× | 30 s | 15 min | 3 h |
| 4× | 15 s | 7.5 min | 1.5 h |
| 8× | 7.5 s | 3.75 min | 45 min |

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

A new game starts on 1 January 2005 with €1,000 in cash, a 24U rack in the basement with one server and a switch, and three friends waiting for web hosting.

| Item | Starting value |
| --- | --- |
| Cash | €1,000, no debt; the bank lends up to the level 1 minimum of €10,000 from day one |
| Company | Level 1, 0 know-how, no reviews yet |
| Basement | 1 rack position for a rack up to 24U, 3 kW at most; power at the household price |
| Home line | Deutsche Telekomm DSL 16000, 16 Mbit/s down and 1 Mbit/s up; paid privately, so it costs the company nothing |
| Hardware | A 24U rack with one Dwell Balanced 1U G1 and a Sysko L2 switch 8, cabled to the home router; the server is the cluster "Basement 1", with no control plane installed |
| Reseller accounts | Domains from a registrar, at 40% of the retail price |
| Customers | None until the first hosting panel finishes installing. Then 3 friends (Jonas Weber, Mira Schulz and Tobi Kraus, private individuals) sign up for Web M hosting at €6 a month on that cluster; happiness 85, and they always pay |


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
| Customer base rate per TB of traffic | 46 | Overage and traffic-heavy plans |
| Fixed-price products | 1 | Web hosting plans, domains and dedicated server tiers keep their price; the plans get bigger |
| Rented space per U, rack or cage | 1 | Power is billed separately |
| Server purchase price | 1 | Resources per server come from the generations table below |
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

**Server lines.** Every generation has one pre-built model per line, and each line scales its generation's row. Specs are fixed at purchase: nothing is added or swapped per unit. The balanced 1U with two power supplies costs 10% more than the one with one and draws 5% more power.

| Line | Height | Sockets | Cores | RAM | Drives | Network ports | Power supplies | Full power | Price | Sold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Balanced 1U | 1U | 2 | 1× | 1× | 1 of the generation's disk in 4 bays | 2 | 1, or 2 | 1×, or 1.05× | 1×, or 1.1× | Always |
| Compute-dense 1U | 1U | 2 | 2× | 1× | 1 of the generation's disk in 4 bays | 2 | 1 | 1.5× | 1.6× | Always |
| Memory-optimized 2U | 2U | 2 | 1× | 4× | 1 of the generation's disk in 4 bays | 4 | 2 | 1.6× | 1.8× | Always |
| Storage 2U | 2U | 2 | 1× | 1× | 12 of the generation's disk | 2 | 2 | 1.7× | 2× | Always |
| Backup storage 4U | 4U | 1 | 0.5× | 0.5× | 36 large HDDs | 2 | 2 | 2× | 2.4× | Always |
| Archive storage 4U | 4U | 1 | 0.25× | 0.25× | 60 densest HDDs | 2 | 2 | 2.2× | 3.2× | Always |
| GPU 4U | 4U | 2 | 1× | 2× | 1 of the generation's disk in 4 bays, 4 GPUs | 2 | 2 | 5× | 6× | From 2016 |
| ARM 1U | 1U | 1 | 1.5× | 1× | 1 of the generation's disk in 4 bays | 2 | 1 | 0.6× | 0.9× | From 2020 |

Backup and archive servers use HDDs whatever the generation's disk type. Archive storage is the cheapest per TB, then backup, then the storage 2U.

| Generation | G1 | G2 | G3 | G4 | G5 | G6 | G7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Large HDD (backup) | 500 GB | 1 TB | 3 TB | 6 TB | 10 TB | 16 TB | 22 TB |
| Densest HDD (archive) | 750 GB | 2 TB | 4 TB | 8 TB | 14 TB | 20 TB | 28 TB |

- **Power draw.** A server draws 40% of its full power when idle, rising in a straight line with CPU load.
- **Port speed.** Server ports run at 1G until 2011, then 10G, 25G from 2017 and 100G from 2023.
- **Ports.** 1G ports are copper (RJ45); 10G and faster ports are SFP cages.
- **Shop window.** A generation stays in the shop until the generation two steps newer arrives, so G1 is sold until the end of 2010 and G2 until the end of 2013. G6 and G7 stay in the shop.

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

**Routers.** Routers keep their price over the years. A router's ports cap how many uplink links a location can have and how fast they run.

| Router | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Edge S | 1U | 4 × 1G | 2005 | €3,000 | 100 W |
| Edge M | 1U | 8 × 10G and 4 × 1G | 2008 | €12,000 | 200 W |
| Edge L | 2U | 32 × 100G | 2014 | €40,000 | 600 W |
| Edge XL | 2U | 36 × 400G | 2021 | €90,000 | 900 W |

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

**Security appliances.** 1U firewalls sit inline between the gateway and the switches. A firewall forwards like a switch, and every link through it runs at most at its throughput.

| Firewall | Throughput | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- | --- |
| Firewall 1G | 1 Gbit/s | 1U | 4 × 1G | 2005 | €1,500 | 40 W |
| Firewall 10G | 10 Gbit/s | 1U | 8 × 1G and 4 × 10G SFP | 2011 | €6,000 | 120 W |
| Firewall 40G | 40 Gbit/s | 1U | 8 × 10G and 4 × 40G SFP | 2017 | €18,000 | 250 W |
| Firewall 100G | 100 Gbit/s | 1U | 8 × 25G and 4 × 100G SFP | 2022 | €40,000 | 450 W |

**Patch panels and gateways.**

| Device | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Patch panel 24, copper | 1U | 24 jacks, 1G | 2005 | €80 | 0 W |
| Patch panel 24, fiber | 1U | 24 jacks, SFP | 2005 | €250 | 0 W |
| Patch panel 48, copper | 1U | 48 jacks, 1G | 2005 | €140 | 0 W |
| Patch panel 48, fiber | 1U | 48 jacks, SFP | 2005 | €450 | 0 W |
| Home router | Carrier panel | 4 × 1G | Comes with the basement | Free | 10 W |
| Datacenter handoff | Carrier panel | 2 × 1G | Comes with every datacenter location | Free | 0 W |

A patch panel is passive. Each jack has a front and a back port, and a link through a jack runs at the slower of the two ports on either side of the panel. Gateways sit on the location's carrier panel, not in a rack, so they stay when a rack moves.

## Market and leads

Each city produces a stream of new customers looking for a host. Only a small share of them ever looks at your offer; those are your leads, and the choice formula decides which leads buy.

**Market size.** New customers per month in 2005, growing 8% a year (about 5× by 2026):

| City size | Cities | New customers per month (2005) |
| --- | --- | --- |
| Large | Frankfurt, London, Paris | 1,500 |
| Medium | Amsterdam, Berlin, Milan | 1,000 |
| Small | Vienna, Zurich | 600 |

Customers belong to their city's country and prefer datacenters there (see the location score under [Customer choice](#customer-choice)).

**Profile mix.** Share of each city's new customers, by budget and skill:

| Budget \ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual 25% | Gamer 15% | Hobby developer 10% |
| Medium budget | Sole proprietor 15% | Small business 15% | Agency or startup 8% |
| High budget | Doctor's or law office 5% | Online shop 5% | Enterprise 2% |

**Leads.** Leads per month for each profile and city come from three sources and are capped at a quarter of that city's new customers:

```math
\text{leads} = \min(\text{organic} + \text{referrals} + \text{paid},\ 0.25 \cdot \text{market}_{new})
```

- **Organic:** 20 × (1 + 0.5 × (level − 1)) × review multiplier per month, split by the profile mix. Organic leads only come from your home city and cities where you have a location.
- **Referrals:** every customer with happiness 70 or more brings 0.005 leads per month × review multiplier, of their own profile.
- **Paid:** campaign budget ÷ cost per lead (see [Marketing and reviews](#marketing-and-reviews)).

The review multiplier is 0.4 + 0.25 × (stars − 1), so 1 star gives 0.4, 3 stars 0.9 and 5 stars 1.4.

Each lead first checks the profile's requirements on the host. A lead that fails them is logged as a lost sale with its reason, for example "company too young". A lead that passes compares you with the competitors (next section) and, if it picks you, sends a request.

## Customer choice

Each lead scores every host that meets its requirements and picks one at random, weighted so that better scores win most of the time. Every host gets the same offer, so price plays no part in the choice.

**Scores.** Each plan gets three scores from 0 to 100.

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

**Orders by email.** A lead asking for a basic SLA from a profile with a low or medium budget is a standard order (`orders.ts`). Its price is the request's market reference less any campaign discount, and it has the same 72 hours as a sales request. Accepting it or declining it takes 10 minutes of player or support time. Without the order form it arrives as an order ticket; with the order form it is placed directly when the city has the product and room. A new game always gets its first order email within 14 days: each morning before then without an order, a friend's recommendation brings one from a private individual with chance 1 / (14 − day). Seeds 1 to 8 already brought one between day 1 and day 22 from organic leads alone, so the recommendation only fills the gap.

**Organic leads in the game.** Organic leads scale with the market and with awareness instead of a flat 20: 0.4 × the city's new customers × the profile's mix × its awareness × (1 + 0.5 × (level − 1)) × the review multiplier. With the starting awareness (5% for private individuals and gamers, 2% for the rest) Frankfurt gives about 20 leads a month in 2005, and every point of awareness a campaign buys raises organic leads too. Referrals (0.005 a month per customer with happiness 70 or more) and forum posts (2 × (0.5 + s/100) a month per employee, split over hobby developers, gamers and small businesses) come from the home city. Each forum lead also adds 0.5% of the gap to the awareness of those three profiles every month.

**Website and campaigns.** Their leads come from the Marketing app's lead batches. 10% of them arrive from cities without a location of yours, spread evenly; those requests arrive greyed out with "Needs a location in London", so you can see the demand you are missing.

**Daily mail.** Leads arrive every morning at 8:00, Poisson-distributed around the monthly rate ÷ 30.4. Each lead draws its need first, then picks you with its share of the choice below, times its channel's conversion.

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

**What a lead asks for.** Plans follow the budget: the smallest plan for low budgets, the second for medium and the largest for high. Four in ten leads settle for one SLA level less than their profile asks.

| Profile | Products asked for |
| --- | --- |
| Private individual | Web hosting |
| Gamer | Game server 60%, VPS 20%, web hosting 20% |
| Hobby developer | VPS 90%, web hosting 10% |
| Sole proprietor | Web hosting 90%, VPS 10% |
| Small business | Web hosting 60%, VPS 40% |
| Agency or startup | Web hosting 30%, VPS 70% |
| Doctor's or law office | Web hosting 90%, VPS 10% |
| Online shop | Web hosting 50%, VPS 50% |
| Enterprise | VPS 50%, dedicated 50% |

**Requirements.** A request needs a location in its city and a cluster with nodes there (a free mounted server for dedicated). A Business or Premium SLA needs a datacenter location in the city, Premium also a company at least 12 months old, and high-budget profiles a review score of 3 stars. A request that misses one arrives greyed out and becomes a lost sale with that reason when it expires.

**Reference and budget.** The market reference is the plan's market price × the SLA factor × the profile's offer (0.9, 1.0 or 1.3 by budget). Each request has a hidden budget b, uniform between 0.97 and 1.24, and the customer accepts a quote q with this probability:

```math
P(\text{accept}) = \frac{1}{1 + e^{(q / \text{ref} - m) / 0.06}}, \quad m = b \cdot (1 - d) \cdot e_{\text{existing}} \cdot (1 + 0.05\,(\text{stars} - 3.5)) \cdot (1 + 0.1\,a)
```

d is the agency discount from a campaign, e is 1.15 for an existing customer and a the profile's awareness. At the reference most accept (about 85%), 20% above it about one in six. A second quote after a refusal or counter-offer has 0.35 × that chance.

**Replies.** The customer answers 4 to 24 hours after a quote. When they decline and the quote is within 0.12 of m, half of them counter at 0.97 × m × the reference; meeting the counter wins for certain. Further above they write that they have no budget. After a refusal or counter you have 48 hours for one more quote. Unanswered requests expire after 72 hours, expansion requests after 7 days.

**Winning.** An accepted quote signs the customer (payment habit drawn from Billing and payment habits) and provisions the service in the request's city at the quoted price. Without room the deal is lost as "No capacity in Frankfurt" and the customer goes elsewhere.

**Expansion.** Every upgrade ticket (2% to 4% of customers a month, see Happiness and churn) opens an expansion request for the next bigger plan of its service, or one more of the biggest. Winning it replaces the service and closes the ticket.

**Shady requests.** From the fourth month, about one request every three months asks for the biggest VPS, no questions asked, paid in crypto. Its budget is 1.8, so it accepts nearly any price. A won shady customer carries a hidden `shady` flag for abuse and legal follow-ups.

**Price changes.** Raising a running service's price costs happiness, lowering it wins some back, and an overpriced service keeps costing happiness every month. The numbers are in Happiness and churn, Price tolerance.

**Market research.** A market study reveals one profile in the Market app for good; it is a one-time payment booked as marketing. Studies cost €800 for a low-budget profile, €2,000 for a medium one and €4,000 for a high one, €20,400 for all nine (decision). The Demand section counts a city's buyers of a product as the city's new customers × each profile's mix × that profile's product weight, your part as the expected requests from the lead flows above (leads × product weight × your choice share × conversion), and splits the remainder over the competitors by their softmax among themselves. Code: `src/sim/30-market/research.ts`.

**Measured flow.** `npx tsx scripts/sales-flow.ts [seed] [months]` runs the real tick with a bot that quotes 3% under the reference, answers tickets, sets up a website in month 3 and runs €250 of search ads from month 6. Seed 1 gets 6 to 9 requests a month in the basement, 16 to 26 with the website and ads, and fills the basement server at about 26 customers, after which most deals are lost for capacity until you buy hardware.

## Happiness and churn

Every customer has a happiness value H from 0 to 100. Events move it up and down, it slowly drifts toward how good your plan is compared with the best competitor, and it sets the chance of cancelling at each renewal. New customers start at 70; the three starting friends start at 85.

**Events.**

| Event | Change to H |
| --- | --- |
| Ticket still open past the expected reply time | − wait penalty per hour that counts on the customer's clock (profile table) |
| Ticket closed with the right answer | +5 |
| Ticket closed with a wrong answer | −10, plus a follow-up ticket |
| An hour of outage on one of their services, once the outage has outlasted their tolerance | − outage penalty per hour that counts on the customer's clock (profile table) |
| Credit issued | +3 per 10% of the monthly fee |
| Price raised | −1 per 1% of increase, more past the customer's maximum (Price tolerance) |
| Price lowered | +0.2 per 1% of decrease, at most +10 |

**Drift.** On each monthly tick H moves a fifth of the way toward a target set by your plan's value U against the best competitor's:

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

**Upgrades.** Each month a customer outgrows their plan with a 2% chance at low budget, 3% at medium and 4% at high budget, which creates an upgrade ticket.

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
| Rack share, 1/8 (5U) / 1/4 (10U) / 1/2 (21U) / full (42U) | 0.2× / 0.35× / 0.6× / 1.1× the position price | 2 days | 1 month | Datacenter positions unlock |
| Rack positions, 1 to 4 | The datacenter's position price each | 7 days | 1 month | Datacenter positions unlock |
| Cage, 4 / 8 / 16 positions | 3.4× / 6.4× / 12× the position price | 30 days | 12 months | Cage unlock; datacenters with cages |
| Private suite, 20 / 40 positions | 15× / 28× the position price | 90 days | 36 months | Private suite unlock |
| Own datacenter | Set when it is designed | | | Own datacenter unlock |

**Availability.** Datacenters are not endless. Each one has a floor capacity in positions that grows in expansion phases over the years up to a final size, and most of it is rented by competitors you never see. You can only rent what is free right now.

| Datacenter size | Positions at opening | Expansion | Final size |
| --- | --- | --- | --- |
| Large (Equinox, Interaction, Global Snitch, Tellyhouse, Data5) | 300 | +150 every 3 years | 1,200 |
| Medium (Hetzler Park, Iron Molehill, NTD, Next Lair, Arubaba Hub) | 120 | +60 every 4 years | 400 |
| Small (mainqubes, Spree Colo, Docklands Data, Green.chz) | 40 | +20 every 5 years | 120 |

- **Competitors.** Their share of a datacenter starts at 85% to 97% of capacity, drawn from the seed. Each month every competitor position cancels with a 1.5% chance. Waitlist holds are then granted from the freed space, and competitors fill the remaining free space down to a level drawn evenly between 0% and 4% of capacity. They never take space held for the waitlist.
- **Expansion.** Each expansion phase opens all its new positions on 1 January. In January, February and March competitors take a sixth of the new positions each month, so about half within 3 months, and from April the usual monthly fill applies.
- **What can be rented.** Cages and suites need that many free positions, which for a suite usually means right after an expansion. Rack shares come from the provider's share racks: one position holds 8 eighths.
- **Waitlist.** When a datacenter has too little free space for what you want, you can join its waitlist. When enough space frees up, you get a notification, and the space is held for you for 7 days.
- **Consequence.** You can't grow in one building forever, which pushes you to spread over several datacenters or build your own.

**Moving a rack.** €300 and 1 day within a city, €1,200 and 3 days to another city. The rack's servers are offline until it arrives. A rack share comes with the provider's rack, so its power limit is the share × the datacenter's kW per position, and it can't be moved or sold. You mount hardware into it directly.

**Catalog.** Two to four datacenters per city. Exchanges new to this table: Franz-IX (Paris), BeCIX (Berlin), MIXup (Milan), VieX (Vienna), SwizzIX (Zurich).

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

**Basement.** One position, a 24U rack at most, 3 kW at most (a household circuit), no backup, the household power price (business × 1.6) and the home line as its only uplink.

**Home line.** The basement can switch to another line in the Locations app. The old line stays up until the new one is installed, and ordering the current line again cancels a pending switch. A paid line is billed as rent on the first of each month; the starting DSL line is paid privately. Lines stay on offer once they appear. The sim stores each line's speed; there is no traffic model yet, so upload does not limit the basement.

| Line | Provider | Down / up (Mbit/s) | Per month | From | Install days | Static IP |
| --- | --- | --- | --- | --- | --- | --- |
| DSL 16000 | Deutsche Telekomm | 16 / 1 | Paid privately | 2005 | 7 | No |
| SDSL 2048 | 1&2 | 2 / 2 | €129 | 2005 | 14 | Yes |
| VDSL 50 | Deutsche Telekomm | 50 / 10 | €45 | 2007 | 14 | No |
| Cable 100 | Vodafoam | 100 / 6 | €40 | 2010 | 10 | No |
| VDSL 100 | Deutsche Telekomm | 100 / 40 | €50 | 2014 | 14 | No |
| Cable 400 | Vodafoam | 400 / 25 | €60 | 2016 | 10 | No |
| Business Fiber 1000 | 1&2 | 1000 / 1000 | €350 | 2018 | 30 | Yes |
| Fiber 1000 | Deutsche Glasfasel | 1000 / 500 | €90 | 2019 | 30 | No |
| Cable 1000 | Vodafoam | 1000 / 50 | €80 | 2019 | 10 | No |

## Pear One subscriptions

Prices are for 2005 and rise 8% every January. With a 10% chance each year, Pear announces an extra 15% to 30% "price adjustment" a month ahead. Paying yearly in advance costs 10 months instead of 12.

| Module | App | Base per month | Plus | Needs |
| --- | --- | --- | --- | --- |
| Starter | Locations, Shop, Customers, Support, Billing (manual), Finance (account statement), Bank, Research, Checklist, Settings, Pear Store | Free | | Start |
| Monitoring | Monitoring | €10 | €0.50 per monitored device | Monitoring skill |
| Virtual machines | Virtual machines | €20 | €2 per host | Virtualization skill |
| Network | Network | €25 | | Network operations skill |
| Products | Products | €15 | | Product management skill |
| Billing automation | Billing rules, invoice runs | €30 | €0.10 per active customer | Level 2 |
| Staff | Staff | €20 | €5 per employee | Employee management skill |
| Marketing | Marketing | €20 | | Marketing campaigns skill |
| Market | Market | €15 | | Market research skill |
| Dock badges | Upgrade: counts on dock apps | €5 | | Monitoring skill |
| Widgets | Upgrade: one desktop widget each | €1 (calendar, open tickets, cash, customers), €2 (monthly revenue, level) | | Start |
| AI bots | ChadGPT Support €300, Clipsy Reminders €100, per bot | | | Automation skill |
| Storefront | The customer shop in Sales | €40 | 0.5% of shop revenue | Shop unlock |

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

**Buying and selling.** Hardware arrives 3 days after ordering in 2005, falling to 1 day by 2015. Bought hardware goes to storage, and mounting it into a rack is instant and free. Resale value falls in a straight line from 100% to 80% of the price over the first month, then in a straight line to 20% over the next 24 months, and stays at 20%. Racks sell the same way. A spare-parts kit costs 5% of the device's price and turns a repair into a 2-hour task.

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

A server has 4 fans; a switch or router 2 fans, 1 or 2 power supplies and a board that fails like a mainboard. Part prices are 2026 values with m = 1.

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

Traffic per customer grows 20% a year, about 46× from 2005 to 2026. In 2005 ten VPS customers fill the basement's 1 Mbit/s upload, which is the first push out of the basement.

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

**Daily curve.** Traffic follows each customer type's usage curve (see Usage curves and overcommit), scaled so a week averages to the monthly figure. The 95th percentile in Mbit/s is about GB per month ÷ 164.

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

**Per plan.** The table is the average customer, on the middle plan of a product (the lower middle when the count is even). Each plan step up doubles the traffic and each step down halves it, so VPS S, M, L and XL send 10, 20, 40 and 80 GB a month in 2005. Domains and certificates send nothing, DNS hosting 1 GB, cloud servers like a VPS.

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

**Links between zones.** A leased wavelength costs €400, €900, €2,500 or €6,000 a month for 1G, 10G, 100G or 400G in 2026 (m = 5) within a region, and 3 × that between regions. Dark fiber runs only within a region, carries 100G and costs €2,000 a month. Links take 30 days, uplink links 14.

**DDoS protection.** Scrubba Dub On Demand costs €50 a month plus €250 per attack and lets a sixth of the attack's first hour through. Akamaybe Prolexit costs €800 a month and filters everything. A blackhole drops the attack and takes its target offline until it is lifted.

**Saturation in practice.** A zone counts as saturated once more than 2% of its traffic is dropped. Services there stay online, and each hour costs their customers 25% of their outage penalty; when a zone first saturates, each affected customer writes an outage ticket with half their usual chance.

## Workloads and migration

**Sizes.** A web space uses 0.1 vCPU, 0.25 GB of RAM and its plan's disk. A VM uses its plan's vCPUs, RAM and disk. A game server uses 2 vCPUs and 4 GB of RAM in 2005, doubling every 7 years like VPS plans.

**Plans and market references.** The catalog in `src/sim/10-catalog/products.ts` holds these plans. "Base" is the year's base plan RAM, 1 GB in 2005 and doubling every 7 years; fixed-price plans keep their price and grow at the same pace. The market reference is the 2005 price; priced plans follow their base rate over the years, and an SLA multiplies it by its price factor.

| Product | Plans | One unit uses | Market reference (2005) | Runs on |
| --- | --- | --- | --- | --- |
| Web hosting | S, M, L | 0.1 vCPU, 0.25 GB RAM, 1, 2 or 5 GB disk × growth | €3, €6, €12 a month | Cluster |
| VPS | S, M, L, XL | 0.5, 1, 2 or 4 × base RAM; 1 vCPU per 2 GB (at least 1); 20 GB disk per GB of RAM | RAM × the VPS rate (€16.50 per GB) | Cluster |
| Game server | S, L | 2 or 4 vCPUs, 4 or 8 GB RAM, 10 or 20 GB disk × growth | RAM × 1.6 × the VPS rate, the low end of €2.40 to €6.10 per GB | Cluster |
| DNS hosting | DNS | 0.05 vCPU, 0.1 GB RAM, 1 GB disk | €2 a month | Cluster |
| VPN | VPN | 1 vCPU, 0.5 GB RAM, 1 GB disk | €5 a month | Cluster |
| Storage hosting | 100 GB, 500 GB, 1 TB | Disk only | €2.60 per TB in 2026 with m = 32, about €83 per TB in 2005 | Cluster |
| Cloud servers | M | Like VPS M | 1.25 × VPS M | High-availability cluster |
| Dedicated servers | S, L | A whole server with at least 8 or 32 GB × growth | €79, €299 a month | A free server |
| Colocation | 1U, quarter, half, full rack | 1, 10, 21 or 42 units and 150 W, 1, 2 or 4 kW | €60, €420, €840, €1,600 a month | Datacenter rack |
| Domains | Domain | Nothing | €15 a year | Resold |
| SSL certificates | Certificate | Nothing | €50 a year until 2015, then free | Resold |

**Capacity.** A node books up to its physical cores × 8 in vCPUs, its RAM × 1.5 and its usable RAID disk × 2. A G1 balanced server books 16 vCPUs, 12 GB of RAM and 1 TB of disk: 48 web spaces, or 24 VPS S, or 6 VPS L by RAM. Booking counts what workloads booked; the load they put on the hardware follows the usage curves.

**Moving a workload**

| Workload | Time | Downtime |
| --- | --- | --- |
| Virtual machine (live) | RAM × 1.5 ÷ link speed | Under 1 second |
| VM with local disk | Above, plus disk ÷ link speed | Under 1 second |
| Web space | Disk ÷ link speed | 5 seconds |
| Game server | 1 minute | 1 minute |
| Storage volume | Disk ÷ link speed | None; reads come from the old node until it finishes |
| Between zones (cold) | (Disk + RAM) ÷ free bandwidth of the link between the zones | The whole transfer; needs a link between the zones |
| Between zones (live) | As above, then a final sync of RAM × 0.1 ÷ free bandwidth | Under 5 seconds; needs a link of 10G or more |

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

**What runs over.** Overcommit ratios are set per cluster.

| Resource | Max ratio | In use | When the node runs over |
| --- | --- | --- | --- |
| CPU | 8:1 | Booked vCPUs × load | Performance of everyone on the node × cores ÷ busy vCPUs |
| RAM | 1.5:1 | Booked RAM × (0.6 + 0.4 × load), since memory stays mostly resident | Above 100% the node swaps and performance drops to 30%; above 110% it kills the biggest workload, which is an outage and a ticket |
| Disk | 2:1 | Grows from 30% of booked at signup to 70% after two years | The pool stops writes at 100%: an outage for every workload on it |
| Traffic | No limit | Monthly traffic × load | Saturation, see Traffic and bandwidth |

A cluster of nothing but game servers peaks at about 1.0 on Saturday evenings, while a mixed cluster stays near 0.5, so mixing customer types roughly doubles safe overcommit. The cluster view shows booked capacity, this week's forecast peak and last week's actual peak.

**How the first build plays.** Usage follows the curves with ±20% jitter per workload and hour, without surges yet. A node's use is the sum of its workloads plus its control plane at full load; a stopped, restoring or lost workload uses nothing. Instead of killing workloads, an overloaded node slows them: performance is cores ÷ busy vCPUs, 30% when RAM runs over and 50% when the disk pool runs over. Every hour each customer on a slowed node loses 1 − performance in happiness, and each of their services opens a "really slow" outage ticket with a chance of 10% × (1 − performance) unless one is already open. Overcommit ratios are the same for every cluster.

## Platforms and licenses

A cluster runs nothing until the player installs a hosting panel, a virtualization platform, or both. The panel sells web hosting; the platform sells VPS, game servers, DNS, VPN and storage. Dedicated servers, colocation, domains and certificates need neither. Values live in `src/sim/10-catalog/platforms.ts`; fees are monthly, in euros, and fixed over the years.

| Software | Kind | License | Install | How-to tickets | Density | Live migration | Control plane |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cPanic | Panel | €0.40 per web space | 3 h | ×0.8 | | | 0.25 vCPU, 0.25 GB, 5 GB |
| Pleskit | Panel | €12 per node | 3 h | ×0.9 | | | 0.25 vCPU, 0.25 GB, 5 GB |
| DirectAdmen | Panel | €4 per node | 2 h | ×1.2 | | | 0.1 vCPU, 0.1 GB, 2 GB |
| FreePanel | Panel | Free | 2 h | ×1.5 | | | 0.1 vCPU, 0.1 GB, 2 GB |
| OpenStash | Cloud | Free | 8 h | ×1.3 | 1.0 | Yes | 2 vCPU, 2 GB, 20 GB |
| VMwhere | Cloud | €8 per physical core | 5 h | ×0.7 | 1.15 | Yes | 1 vCPU, 2 GB, 10 GB |
| Proxmocks | Cloud | Free | 3 h | ×1.0 | 1.0 | Yes | 0.25 vCPU, 0.25 GB, 5 GB |
| HyperVee | Cloud | €20 per node | 4 h | ×0.9 | 1.05 | No | 1 vCPU, 1 GB, 10 GB |

- **Licenses** are billed on the 1st of each month per cluster, as ledger lines in the category "licenses".
- **How-to tickets:** a customer's how-to rate is multiplied by the average factor of the software serving each of their workloads (the panel for web spaces, the platform for the rest).
- **Density** multiplies what a node can book, from memory sharing and lighter hypervisors.
- **Control plane:** the panel's and the platform's control planes run on one node of the cluster, the first one added, and count against what it can book and what it uses. While that node is down, or while the cluster switches software, nothing can be sold, started, migrated or restored on the cluster. Draining moves the control plane to another node once the drained node is empty, and the player can move it to any working node with room.
- **Installing** needs a node in the cluster and room for the control plane on it. The control plane is busy for the install hours in the table, and nothing can be placed on the cluster until it is done. An install costs nothing up front; the license is billed from the next 1st of the month.
- **Switching** to other software of the same kind takes the new software's install hours and needs the cluster empty of the workloads the old software serves. Workloads of the other kind stay online.
- **Selling:** the website, order emails and leads only carry product lines that an installed control plane on a cluster with nodes sells. Placement refuses with "No cluster runs a hosting panel" or "No cluster runs a virtualization platform" when no cluster in scope has the right software, and with the capacity error when it has but no node has room.
- A new game's "Basement 1" runs nothing. Old saves keep the panel and platform they had, and saves from before platforms load with FreePanel and Proxmocks installed.

**Migration in the first build.** Inside a zone, links count as 1 Gbit/s, which moves 450 GB an hour. Virtual machines move live on platforms with live migration; on HyperVee they are offline for (disk + RAM) ÷ 450 GB per hour, rounded up to whole hours. Web spaces, game servers and storage volumes move without a lost hour. Moves between zones need a link between the zones; until the network links between locations exist, they are refused. A workload with a lost disk can't migrate; it is restored instead.

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
| "ChadGPT Support" | €300 | How-to and billing tickets |
| "Clipsy Reminders" | €100 | Payment reminders |

A bot works at 2 × the base rate (a skill-50 human works at 1 ×), picks the right reply with P = 0.6 and never gains skill. Each reminder a bot sends makes the customer open a billing ticket with a 5% chance. Each bot task causes an incident with a 0.2% chance: the customer loses 15 happiness and opens a billing ticket, and the Staff app reports one of five absurd lines. A bot that handles 500 tasks a month causes about one incident a month.

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
| Clean-up with a backup | 4 hours |
| Clean-up without a backup (rebuild) | 12 hours and −15 happiness |

Offline sites count as outages at the profile's hourly outage penalty (1 to 4). Taking a node offline at the warning and patching on release costs about 12 hours of outage, 12 to 48 happiness. Leaving it online from the proof of concept to the patch risks a compromise with 1 − 0.99²⁴ · 0.96¹² ≈ 52%, worth about −38 happiness with a backup and −69 without for a customer at penalty 2, plus reviews and support work. Going offline at the proof of concept costs 36 outage hours and rarely pays. Patching is the PHP upgrade: it installs the current version with the fix and slows the node's sites for an hour.

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
| Website | €400 | €15 | None |
| Order form | €900 | €10 | Website |
| Goggle Ads | €50 | None | Website |
| AI ads | €1,500 | None | Website, from 2023 |

A website brings 4 leads a month per location city, split by the profile mix.

**Trade fairs.** Costs are 2026 euros, scaled back with m = 0.6 like campaigns. Each fair needs one attendee of any role, who is away for the fair's days.

| Fair | Pun of | Date | Days | Level | Cost | Leads | Audiences | Network contacts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SeeBIT, Hanover | CeBIT | 6 March, until 2018 | 5 | 3 | €8,000 | 15 | Sole traders, small businesses, offices | 0.1 |
| CloudFeast, Rust | CloudFest | 23 March | 3 | 4 | €20,000 | 40 | Agencies, online shops, enterprises | 0.2 |
| RIPE-ish Meeting, Amsterdam | RIPE Meeting | 18 May | 5 | 3 | €3,000 | None | | 0.4 |
| DE-SIX Summit, Frankfurt | DE-CIX Summit | 7 October | 1 | 4 | €5,000 | 5 | Enterprises | 0.5 |
| Data Centre Whirled, Frankfurt | Data Centre World | 12 November | 2 | 5 | €35,000 | 60 | Enterprises, offices, online shops | 0.2 |

The leads arrive over the 730 hours after the fair, split evenly over the location cities and the audiences, with a conversion of 1.5. A marketing manager trained on fairs brings back 1.5 × the leads. At the next month start each audience of the fair gains 0.03 awareness on top of g. The network contacts of every fair attended in the last 12 months add up, each fading linearly to 0 over that year, capped at 1; `tradeFairBonus(s)` exposes the sum for transit prices and peering acceptance.

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
| Monitoring | 1 | 50 | 5 days | | Dock badges, failure notifications |
| Marketing basics | 1 | 50 | 5 days | | Leads to Product management and Marketing campaigns |
| Employee management | 1 | 100 | 10 days | | Staff |
| Network operations | 2 | 300 | 14 days | Monitoring | Network |
| Product management | 2 | 200 | 14 days | Marketing basics | Products |
| Marketing campaigns | 2 | 300 | 14 days | Marketing basics, Employee management | Marketing |
| Market research | 3 | 800 | 21 days | Product management, Marketing campaigns | Market |
| Virtualization | 3 | 400 | 14 days | Product management, Monitoring | Virtual machines |
| Automation | 3 | 1,500 | 21 days | Employee management, Monitoring | ChadGPT Support, Clipsy Reminders |

The whole tree costs 3,700 know-how and 118 days of training.

**Unlocks.** Launch costs are fixed and do not follow the price multipliers.

| Unlock | Branch | Know-how | Launch cost | Needs |
| --- | --- | --- | --- | --- |
| Datacenter positions | Infrastructure | 50 | €500 | Level 1 |
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
- **Solo bot:** plays the same way but never hires. It must survive but level up clearly later, which shows that hiring is how you scale and still optional.

A Vitest suite runs both bots on fixed seeds and fails when either rule breaks. The `balance` skill from the GDD reads the run's output and suggests which value to tune.

**Open questions**

- Should customers be simulated one by one or in cohorts? Per-customer happiness assumes one by one; 40,000 customers on an hourly tick should be fine in TypeScript, but save size needs a check.
- Should competitor scores stay fixed forever, or rise about 1 point a year so late-game players can't coast?
- Is a lead cap of 25% of a city's new customers too generous for the late game?
- After 2026, do prices stay flat (as written) or keep their trend?
- Bankruptcy as the lose condition is new; does it fit the game?
