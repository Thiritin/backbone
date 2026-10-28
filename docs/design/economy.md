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

A new game starts on 1 January 2005 with €5,000 in cash, one tower server in the basement and three friends as customers.

| Item | Starting value |
| --- | --- |
| Cash | €5,000, no debt |
| Company | Level 1, 0 know-how, no reviews yet |
| Basement | 4 shelf slots; power at the household price |
| Home line | DSL, 16 Mbit/s down and 1 Mbit/s up; paid privately, so it costs the company nothing |
| Hardware | 1 tower server (2 cores, 4 GB RAM, 250 GB disk, 150 W), owned, in the cluster "Basement 1", plus one spare-parts kit |
| Reseller accounts | Web hosting and domains from the wholesale provider, at 40% of the base rate |
| Customers | 3 friends (private individuals) on resold web hosting; happiness 85, and they always pay |

**Renting a server.** From day 1 the player can also rent a dedicated server from the wholesale provider for €59 per month (2005: 2 cores, 8 GB RAM, 100 Mbit/s, no setup fee). It joins a cluster like an owned server. This settles the GDD's open point: the basement and a rented server are both available at the start, and the hosting tiers table gains a "Rented server" row between basement and rented rack units.

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

**Server models.** Each model scales its generation's row. A model with two power supplies costs 10% more than the same model with one.

| Model | Height | Sockets | Cores | RAM | Drive bays | Network ports | Power supplies | Full power | Price | Sold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Compute 1U | 1U | 2 | 1× | 1× | 4 | 2 | 1, or 2 | 1× | 1× | Always |
| Compute 1U, one socket | 1U | 1 | 0.5× | 0.5× | 4 | 2 | 1 | 0.6× | 0.65× | Always |
| High-memory 2U | 2U | 2 | 1× | 4× | 8 | 4 | 2 | 1.4× | 2.2× | From 2008 |
| Storage 2U | 2U | 1 | 0.5× | 0.5× | 12 | 2 | 2 | 1.2× | 1.5× | Always |
| GPU 4U | 4U | 2 | 1× | 2× | 8 | 2 | 2 | 6× | Set with GPU compute | From 2016 |
| ARM 1U | 1U | 1 | 1.5× | 1× | 4 | 2 | 1 | 0.6× | 0.9× | From 2020 |
| Tower | Shelf | 1 | 0.5× | 0.5× | 2 | 1 | 1 | 0.6× | €1,000 | Until 2010 |

- **Drives.** Each bay takes one drive of the generation's disk type at that generation's size. An extra drive costs 4% of the generation's price and draws 8 W.
- **RAM.** RAM can be added up to the model's maximum, which is twice the listed amount, at 25% of the generation's price per listed amount.
- **Power draw.** A server draws 40% of its full power when idle, rising in a straight line with CPU load.
- **Port speed.** Server ports run at 1G until 2011, then 10G, 25G from 2017 and 100G from 2023.
- **Ports.** 1G ports are copper (RJ45); 10G and faster ports are SFP cages.
- **Drives at purchase.** A server ships with one drive in its bays, so a Compute 1U has the generation's storage. The Storage 2U ships with six drives and has six bays free.
- **Shop window.** A generation stays in the shop until the generation two steps newer arrives, so G1 is sold until the end of 2010 and G2 until the end of 2013. G6 and G7 stay in the shop.
- **Tower.** The tower is the starting server and keeps the specs from the starting state (2 cores, 4 GB RAM, 250 GB disk, 150 W); it sits on a shelf and is sold for €1,000 until 2010.

**Routers.** Routers keep their price over the years. A router's ports cap how many uplink links a location can have and how fast they run.

| Router | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Edge S | 1U | 4 × 1G | 2005 | €3,000 | 100 W |
| Edge M | 1U | 8 × 10G and 4 × 1G | 2008 | €12,000 | 200 W |
| Edge L | 2U | 32 × 100G | 2014 | €40,000 | 600 W |
| Edge XL | 2U | 36 × 400G | 2021 | €90,000 | 900 W |

**Switches and gateways.** Switches come from Sysko and keep their price over the years. Every switch stays in the shop once it arrives, so an older 1G switch can always link a rack to the provider handoff. Switches and gateways draw their full power at all times. Their prices are estimates.

| Device | Height | Ports | Sold from | Price | Full power |
| --- | --- | --- | --- | --- | --- |
| Sysko SG8 | Shelf | 8 × 1G | 2005 | €60 | 8 W |
| Sysko 2924 | 1U | 24 × 1G and 2 × 1G SFP | 2005 | €900 | 40 W |
| Sysko 2948 | 1U | 48 × 1G and 4 × 10G SFP | 2008 | €2,800 | 70 W |
| Sysko 4948X | 1U | 48 × 10G SFP | 2011 | €8,000 | 200 W |
| Sysko 9348Y | 1U | 48 × 25G, 4 × 10G and 4 × 100G SFP | 2017 | €12,000 | 350 W |
| Sysko 9332C | 1U | 32 × 100G SFP | 2023 | €20,000 | 450 W |
| Patch panel, copper | 1U | 24 jacks, 1G | 2005 | €80 | 0 W |
| Patch panel, fiber | 1U | 24 jacks, SFP | 2005 | €250 | 0 W |
| Home router | Shelf | 4 × 1G | Comes with the basement | Free | 10 W |
| Provider handoff | 1U | 2 × 1G | Comes with a rented rack | Free | 0 W |

A patch panel is passive. Each jack has a front and a back port, and a link through a jack runs at the slower of the two ports on either side of the panel. A rented rack has 42U and costs 42 × €60 = €2,520 per month; its power is included in the rent. Rent is paid at the start of each month together with the basement's power bill.

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

**Worked example.** A private individual compares web hosting plans. The player scores P 60, R 50, C 50 and charges 0.8× base, so U = 52 + 20 = 72. The budget giant and the developer cloud reach 85, the wholesale provider 82 and the premium host 49. The player wins 11% of these leads. At 0.6× base the player's U rises to 92 and the share to 39%, but the margin on resold hosting is gone.

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

**Handling a request.** Answering a request by hand takes 8 minutes of the player's or a sales agent's time. A request waits 3 days, then the customer goes to a competitor. The shop answers instantly while the target cluster's busiest resource stays under the limit you set (80% by default).

**Growth.** A customer grows a set share each year until it reaches its ceiling: 10% a year for low budgets, 25% for medium and 40% for high. A startup (a third of agencies) grows 150% a year and has a 20% chance each year of shutting down. When usage passes 85% of what the customer rents, it sends an expansion request for double its size, capped at its ceiling.

**Cloud quotas.** A cloud customer's usage averages 40% of its quota and peaks at 80% during its busiest hours. It pays per hour used, at the base rate × 1.25 ÷ 730. When its peak passes 80% of the quota, it asks for a 50% to 100% higher quota with a reason drawn from its profile.

## Happiness and churn

Every customer has a happiness value H from 0 to 100. Events move it up and down, it slowly drifts toward how good your plan is compared with the best competitor, and it sets the chance of cancelling at each renewal. New customers start at 70; the three starting friends start at 85.

**Events.**

| Event | Change to H |
| --- | --- |
| Ticket still open past the promised response time | − wait penalty per hour (profile table) |
| Ticket closed with the right answer | +5 |
| Ticket closed with a wrong answer | −10, plus a follow-up ticket |
| An hour of outage on one of their services | − outage penalty (profile table) |
| Credit issued | +3 per 10% of the monthly fee |
| Price raised at renewal | −0.5 per 1% of increase |

**Drift.** On each monthly tick H moves a fifth of the way toward a target set by your plan's value U against the best competitor's:

```math
H \leftarrow H + 0.2\,(H^{*} - H), \quad H^{*} = \operatorname{clamp}\big(70 + 0.5\,(U_{you} - U_{best}),\ 20,\ 95\big)
```

**Churn.** At each renewal the customer cancels with this probability. Monthly contracts renew monthly. Yearly contracts renew once a year and use 12× the monthly base churn.

```math
P(\text{cancel}) = \text{base} + 0.5 \cdot \max\left(0,\ \frac{50 - H}{50}\right)
```

A customer whose happiness falls below 15 leaves at the next monthly billing date, even on a yearly contract. Every cancellation arrives as a ticket first. A retention offer (one month free) keeps the customer 30% of the time when H is 30 or more, and 10% of the time below that.

**Upgrades.** Each month a customer outgrows their plan with a 2% chance at low budget, 3% at medium and 4% at high budget, which creates an upgrade ticket.

**Profile values.** Priority support shortens the promised response to 4 hours, or 1 hour for high-budget profiles.

| Profile | Base churn per month | Outage penalty per hour | Wait penalty per hour | Promised response |
| --- | --- | --- | --- | --- |
| Private individual | 2.5% | 1 | 0.3 | 48 h |
| Gamer | 4.0% | 4 | 0.3 | 48 h |
| Hobby developer | 3.0% | 2 | 0.3 | 48 h |
| Sole proprietor | 1.2% | 2 | 0.6 | 24 h |
| Small business | 1.0% | 3 | 0.6 | 24 h |
| Agency or startup | 1.5% | 4 | 0.6 | 24 h |
| Doctor's or law office | 0.6% | 8 | 1.5 | 8 h |
| Online shop | 0.8% | 10 | 1.5 | 8 h |
| Enterprise | 0.4% | 15 | 1.5 | 8 h |

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
| Outage report | Per outage (below) | | | 10 min |
| Colocation install | One per hardware delivery | | | 2 h (technician) |

Gamers create abuse reports at 0.02, like high-skill customers. Each payment reminder also has a 10% chance to create a billing question.

**Outage tickets.** When an outage hits a customer, they write in with a 30% chance at low budget, 60% at medium and 90% at high budget. High-budget customers write 3 tickets, everyone else 1. A public status page halves the chance.

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

**Back-office tasks.** Staff handle these at the work rate from [Tickets and work rates](#tickets-and-work-rates). A skill-50 bookkeeper records about 4,000 payments a month.

| Task | Who | Handling time |
| --- | --- | --- |
| Record a payment | Bookkeeper | 2 min |
| Send a payment reminder | Bookkeeper | 3 min |
| Send a dunning notice | Accountant | 10 min |
| Send a final notice | Accountant | 15 min |
| Hand a debt to collections | Accountant | 30 min |
| Month-end report | Accountant | 2 days per month |

## Hardware, power and failures

A G1 server costs about €26 a month in power in 2005; a G7 costs €89 in 2026 but carries 128 times the RAM. Old hardware also fails more often, so replacing it saves on power, space and outages at once.

**Power cost** per location per month, with W the draw of each device and PUE the overhead for cooling:

```math
\text{power cost} = \sum \frac{W}{1000} \cdot 730 \cdot \text{PUE} \cdot \text{price per kWh}
```

| Location | PUE | Billing |
| --- | --- | --- |
| Basement | 1.0 | Household price |
| Rented U, rack or cage | Included | A power budget is included in the rent; each kW above it costs the GDD's extra-power price |
| Own room | 1.6 | City business price |
| Own datacenter | 1.4, or 1.2 with liquid cooling | City business price, or a custom contract: 3 years fixed at 10% below the current price |

**Buying and selling.** Hardware arrives 3 days after ordering in 2005, falling to 1 day by 2015. Book value falls in a straight line to zero over 5 years. Used hardware sells for 50% of book value, but never less than 5% of its price. A spare-parts kit costs 5% of the device's price and turns a repair into a 2-hour task.

**Failures.** Each device has a base annual failure rate (AFR), raised in its first 3 months and again after 3 years of age:

```math
\text{AFR}(a) = \text{base} \cdot e(a) \cdot \big(1 + 0.4 \cdot \max(0,\ a - 3)\big), \qquad e(a) = \begin{cases} 1.5 & a < 0.25 \\ 1 & \text{otherwise} \end{cases}
```

Here a is the age in years, and the chance of failing in any game hour is AFR ÷ 8,760. A 6-year-old server fails 17.6% of the time per year.

| Device | Base AFR | Effect of a failure |
| --- | --- | --- |
| Server (disks, power supplies and RAM together) | 8% | On a consumer cluster its workloads go down until repair. On an HA cluster they restart elsewhere within 5 minutes, if the cluster has spare capacity. |
| Access or core switch | 2% | Everything wired only to it goes offline |
| Edge router | 1.5% | Its uplinks go down; traffic spills to other exits if there are any |
| UPS | 3% | The next grid outage takes the room down |
| Cooling unit | 5% | The room overheats; servers start failing at 4× their rate after 2 hours |

Without a spare kit in stock, a repair waits for a delivery first.

**Power outages.** Grid outages are random events per city. They are far more frequent than in reality, so the player meets them in the first year.

| Event | Rate | Duration | What survives it |
| --- | --- | --- | --- |
| City grid outage | 1.5 a year per city | Median 20 minutes, 10% last over 2 hours | Rooms with a UPS, while its battery lasts; datacenters with generators |
| Datacenter feed failure | 0.3 a year per feed | Median 30 minutes | Servers with a second PSU on the other feed |
| Generator fails to start | 2% of grid outages at a datacenter | Until the grid returns | Nothing on that feed |

A UPS runs for its battery capacity divided by the load:

```math
\text{runtime (min)} = \frac{\text{battery Wh}}{\text{load W}} \cdot 60
```

| Item | Price in 2005 | Notes |
| --- | --- | --- |
| Small UPS, 1,500 VA, 600 Wh | €180 | Carries the basement shelf (0.2 kW) for about 3 hours |
| Second feed (A+B) on a rented rack | +60% of the rack's power fee | Only protects dual-PSU servers |
| Dual power supply | +10% of the server's price | PSU failures make up about a quarter of a server's AFR; with two PSUs they no longer take the server down, so its AFR drops from 8% to 6% |

Prices follow the same yearly multipliers as other hardware (see [Prices over time](#prices-over-time)).

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

**Daily curve.** Traffic peaks between 20:00 and 22:00 at 2× the average and bottoms out at 04:00 at 0.4×. The 95th percentile in Mbit/s is about GB per month ÷ 164.

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

## Workloads and migration

**Sizes.** A web space uses 0.1 vCPU, 0.25 GB of RAM and its plan's disk. A VM uses its plan's vCPUs, RAM and disk. A game server uses 2 vCPUs and 4 GB of RAM in 2005, doubling every 7 years like VPS plans.

**CPU contention.** A vCPU is busy 25% of the time on average. When a node's busy vCPUs exceed its cores, the performance score of every customer on that node is multiplied by cores ÷ busy vCPUs. With the average load, a 4:1 overcommit is the break-even point.

**Moving a workload**

| Workload | Time | Downtime |
| --- | --- | --- |
| Virtual machine (live) | RAM × 1.5 ÷ link speed | Under 1 second |
| VM with local disk | Above, plus disk ÷ link speed | Under 1 second |
| Web space | Disk ÷ link speed | 5 seconds |
| Game server | 1 minute | 1 minute |
| Storage volume | Disk ÷ link speed | None; reads come from the old node until it finishes |

The link speed is the slowest link between the two nodes, shared by every migration running at the same time. Draining runs 2 migrations at once per node by default.

**Restart after a node fails.** In a high-availability cluster, workloads restart on other nodes after 5 minutes of detection plus 2 minutes of boot. Customers count that time as an outage.

**Hardware warnings.** 60% of disk and power supply failures announce themselves 1 to 7 days early. A node drained before its failure causes no outage.

**Private networks.** A private network costs the customer €5 a month as an add-on (m = 1) and costs you nothing to run.

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

## Marketing and reviews

In 2005 a low-budget lead from search ads costs about €9, so a new private customer costs €25 to €80 depending on your share. Reviews skew negative unless you invite happy customers, which is what review platforms are for.

**Cost per lead** in 2026, scaled back with the search-ads multiplier (0.6 in 2005):

| Channel | Profiles reached | Cost | Condition |
| --- | --- | --- | --- |
| Word of mouth | Every profile, as referrals | Free | Always on |
| Search ads | Low budget / medium / high | €15 / €35 / €90 per lead | None |
| Gaming communities | Gamers | €8 per lead | None |
| Trade fair | High budget, agencies | €20,000 per fair, for 40 leads | Level 4 or higher |
| Partner program | Sole proprietors, small businesses | Commission of the first 2 months' revenue | Each agency customer brings 0.5 leads a month |

Spending more in one channel and city gets dearer: the cost per lead is multiplied by 1 + monthly spend ÷ €5,000.

**Reviews.** A customer writes a review with a 5% chance after a closed ticket, 10% after an outage that hit them and 30% after cancelling. The stars follow happiness, rounded after up to half a star of random noise and kept between 1 and 5:

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

## Know-how and unlock costs

A first-year company earns about 300 know-how; a company with 10,000 customers earns about 25,000 a month. Unlock costs rise from 50 to 150,000 to match, so each tier of the tree opens at roughly the pacing target's year.

**Know-how per active contract per month:**

| Product | Know-how |
| --- | --- |
| Domain, SSL certificate | 0.2 |
| Web hosting, VPN | 1 |
| Game server | 1.5 |
| VPS | 2 |
| Storage hosting | 3 |
| Cloud servers, managed Kubernetes | 4 |
| Dedicated server, CDN | 5 |
| Colocation | 6 |

**Unlocks.** Launch costs are fixed and do not follow the price multipliers.

| Unlock | Branch | Know-how | Launch cost | Needs |
| --- | --- | --- | --- | --- |
| Rented rack units | Infrastructure | 50 | €500 | Level 1 |
| SSL certificates | Products | 80 | €500 | Level 1 |
| Own DNS hosting | Products | 60 | €500 | Level 1 |
| First hire | Business | 100 | €1,000 | Level 1 |
| Email hosting | Products | 150 | €2,000 | Level 2 |
| Dedicated servers | Products | 300 | €3,000 | Level 2 |
| Status page | Business | 300 | €1,000 | Level 2 |
| Shop | Business | 600 | €4,000 | Level 2 |
| Rented rack | Infrastructure | 400 | €2,000 | Level 2 |
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
| Own room | Infrastructure | 20,000 | €250,000 | Level 5 |
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

**Bankruptcy.** When cash stays below zero for 30 days and no loan is available, the company is insolvent and the game ends. The GDD has no lose condition yet, so this one is a proposal.

**SLA insurance.** The monthly premium is 2% of the recurring revenue from customers with an SLA, times an uptime factor: 1.0 at 99.95% or better over 90 days, 1.5 at 99.9% or better, and 2.5 below that. A missed SLA owes the customer 10% of their monthly fee per 0.1% of uptime below the promise, up to the full fee. The insurer pays those credits for three claims, then blocks the company for a year.

**Tax.** Prices are without VAT, and VAT is not simulated. Corporate tax takes 30% of each year's profit in April of the following year, and losses carry forward to later years.

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
