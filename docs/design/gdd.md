# Backbone game design document

You start as a one-person "basement hoster" and grow into a datacenter operator by automating your own company. At first you answer every ticket, send every payment reminder and plug in every cable yourself. Then you hire people, and later AI bots, to do it for you.

## Vision

The game is about running a whole hosting company, not just its hardware: infrastructure, support, billing, marketing and staff. Each part is done by hand until you automate it.

**Design pillars**

- **Automate yourself out of the job.** Every department starts as clicks you make yourself. Hiring staff, and later AI bots, turns those clicks into work that happens in the background.
- **Real infrastructure, simplified.** Racks, ports, clusters, transit and peering are close enough to reality that an engineer recognizes them. Real companies appear under parody names, so "Internet X" becomes "Internet Y".
- **Problems cascade like the real thing.** An outage floods support, unanswered tickets lose customers, and every cancellation is one more ticket.
- **You sit at a desk.** The whole game is a macOS-style desktop with apps, windows and notifications.

**Platform and scope**

- Free, open-source (MIT) browser game, made for fun. It's hosted as a static website: no server, no accounts, no multiplayer, no Steam.
- Saves stay in the player's browser.
- Set in Europe. The map opens on Western Europe's big cities, and other regions only appear as distant transit destinations. The game starts around 2005, and technology advances over the years.
- Prices are in euros and roughly match the real European market.
- Time controls: pause, 1×, 2×, 4×, 8×. Nothing pauses automatically. A player can run the whole company alone if they want; hiring is how you scale, not a requirement.

**Inspirations:** Software Inc. (UI and company management), Der Planer (the office PC you play the whole game on), King of Retail (customer demand).

## Core loop

Win customers, handle the work they create, automate that work, and use the freed time and money to expand. You start out doing every job yourself.

&#91;embedded content: core loop · automate to grow, neglect to churn\]

The loop runs clockwise. Work you ignore turns into cancellations, and each cancellation is more work.

| Department | By hand | Automated by |
| --- | --- | --- |
| Support | Pick a reply and an action for each ticket | Support agents, later an AI support bot |
| Billing | Click to send each reminder and dunning notice | Bookkeepers and accountants |
| Infrastructure | Install, cable and repair hardware | Technicians and rack templates |
| Network | Set up ports, buy transit, arrange peering | Network engineers |
| Marketing | Run campaigns, read reviews | Marketing manager |

## The desktop

The whole game is a macOS-style desktop. Every system is an app in the dock that opens in its own window, and notifications slide in at the top right so you always know what is happening.

&#91;embedded content: desktop mock-up · menu bar, two windows, notifications, dock\]

The menu bar holds the time controls, date and cash. The red badge counts open tickets.

| App | What it does |
| --- | --- |
| Locations | Grid of your locations; opens room views and rack front views |
| Network | Europe map, transit and peering contracts, DDoS protection |
| Products | Product lines, plans editor, software licenses, clusters |
| Customers | Customer list, contracts, happiness |
| Support | Ticket inbox with reply templates and actions |
| Billing | Invoices, payment reminders, dunning, collections |
| Finance | Profit and loss, cash flow, recurring revenue, churn |
| Bank | Loans and repayments |
| Staff | Job market, hiring, salaries, task assignment |
| Marketing | Campaigns, reviews, review platforms |
| Market | Market research: demand, customer requirements, lost-sale reports |
| Unlocks | The research tree |

**Notifications.** Banners for new tickets, overdue invoices, hardware failures, attacks and staff requests. Each one opens the right app at the right place, and a notification center keeps the history. Nothing pauses the game automatically.

**Look.** Clean and light like macOS, with a dark mode. Interface text in Inter, numbers in a monospace font so columns line up, icons from Lucide. Rack and server fronts are drawn in code, so every device has a consistent, detailed front.

## Locations and space

Infrastructure lives in locations, from your own basement up to your own datacenter. Each location is a set of rooms with predefined slots. There is no free-placement grid.

**Hosting tiers**

| Tier | What you get | Cost | Limits |
| --- | --- | --- | --- |
| Garage or basement | Shelf slots and a home internet line | Free; power goes on your home bill | Few slots, slow upload, no redundancy; business customers stay away |
| Rented rack units | A few U in someone else's rack | Per U per month | Shared uplink; you ship hardware in |
| Rented rack | A whole rack in a provider's datacenter | Per rack per month | Power budget per rack |
| Cage | A fenced area with several rack slots | Per cage per month | Use the provider's transit or bring your own |
| Own room | A room in someone else's building, with its own slots | Lease per month | Unlocks your own power and cooling slots |
| Own datacenter | A building with several rooms | Purchase or long lease | Full control: power room, generators, carrier room |

**Rack sizes.** Rented racks come in common sizes: 12U, 24U, 42U and 47U. Small racks cost more per U but less in total; big racks cost less per U but more up front.

**Reselling.** Reselling sits next to the tiers and needs no hardware. You buy a product line wholesale from a parody of a big provider (an OVH stand-in) and sell it at your own price and markup. It only works for some product lines: web hosting, domains and SSL certificates. Margins are thin and the wholesaler's outages become yours. You can later move each line in-house, for example from domain reseller to registrar.

**Rooms and slots**

| Room | Slot type | Holds | First available |
| --- | --- | --- | --- |
| Basement | Shelf | Tower and small servers, a consumer router and switch | Garage tier |
| Server room | Rack | Servers, switches, routers, patch panels | Rented rack |
| Power room | Power | UPS, batteries, generators | Own room |
| Cooling | Cooling | Air handlers, later liquid cooling | Own datacenter |
| Carrier room | Cross-connect | Hand-offs to carriers and internet exchanges | Own datacenter |

Each slot only takes its own kind of equipment, so a server can't go in the generator room. A location's size is a fixed number of slots, and a rack's size is a fixed number of U.

**Location view.** The Locations app shows your locations as a grid of tiles. Opening one shows a top-down 2D render of its rooms. Each rack displays a miniature of the server fronts inside it, and the cable trays above the rows visibly fill as you add cabling. Clicking a rack opens its front view.

**Energy.** Every location pays its city's electricity price for what its hardware draws. Rented space bills power per kW or passes on the local price. Your own datacenter can sign a custom contract with an energy provider.

## Racks, hardware and cabling

Racks hold servers, switches and routers, and you cable them port by port. Bandwidth, redundancy and failures all follow from how you wire them.

**Hardware**

| Device | Size | Role |
| --- | --- | --- |
| Tower server | Shelf | Basement starter |
| Compute server | 1U | VPS, web and game servers |
| Storage server | 2U | Storage hosting, backups |
| GPU server | 4U | AI compute, late game |
| Access switch | 1U | Connects the servers in one rack |
| Core switch | 1–2U | Connects racks to each other |
| Edge router | 1–2U | Connects to transit and peering |
| Patch panel | 1U | Tidy cross-rack cabling; faster repairs |

**Rack front view.** Clicking a rack shows its front: every device drawn at its real height, with status lights. Clicking a device opens it in the inspector on the right.

**Ports and cables.** Clicking a switch or router lists its ports in the inspector. For each port you pick the other end: a device in the same rack, or another rack and device from a list. Copper covers 1G, short direct-attach cables 10–25G inside a rack, and fiber 10–400G between racks. Cables between racks run through the trays. Both ends must match in speed, and each port gets a role (server, uplink, or link to another switch).

**Bandwidth.** Every port, switch and router has a capacity, and traffic can't exceed the slowest link on its path. One server on a 1G port can't serve 200 Gbps. Scaling up means faster ports, switches, uplinks and transit.

**Failures and redundancy.** Disks, power supplies, switches and routers fail at random, and more often as they age. Without a second path, everything behind a failed device goes offline. Two switches, two routers and servers wired to both keep services up. Until you hire technicians, you fix failures yourself.

**Upgrades**

- A server swaps in place for another of the same height, for example a faster 1U. Bigger machines, such as a 4U GPU server, need free space.
- A switch or router swaps in place only if the new one has at least as many ports as are in use, so you can't downgrade below the used port count. Cables stay on their ports.

**Hardware generations.** A new server generation arrives every few years from the 2005 start. Servers differ mainly in resources (cores, RAM, storage) and power draw, not in exotic features. Each generation packs more resources per U and per watt, so replacing old servers cuts the energy bill as well as freeing space.

**Copy and paste.** A finished rack can be saved as a template and pasted into an empty rack slot. The game orders the hardware, and technicians install and cable it. A typical large location ends up with one core routing rack and many server racks, each with its own pair of switches.

**Keeping it fun at scale.** Cabling port by port is fun for the first few racks and tedious at 200. Three things fix that: rack templates, an auto-cable button that wires a server to the next free ports on its rack's switches, and technicians who do installs for you.

## Clusters and products

Servers join clusters, and products draw their resources from clusters. Everything is virtualized, so adding a server to a cluster adds capacity for every product running on it.

**Clusters.** A cluster is a named pool of servers, such as "Webhosting 1" or "HA Cloud". Its capacity is the sum of its servers' CPU, RAM and storage. Its tier sets what it costs to run and how it handles failures:

- **Consumer cluster:** no failover. Cheap, and fine for customers who shrug off a day of downtime.
- **High-availability cluster:** keeps spare capacity in reserve and spreads servers over two switches or two locations. Costs more, and is sold to customers who can't tolerate outages.

**Product catalog**

| Product | Runs on | Needs | Notes |
| --- | --- | --- | --- |
| Web hosting | Cluster | Control panel license | Can be resold |
| Domains |  | Reseller account, later your own registrar | Can be resold |
| SSL certificates |  | Certificate reseller account | Can be resold; often bought with domains |
| Game servers | Cluster | A license per game | Gamers attract DDoS attacks |
| VPS | Cluster | Virtualization platform |  |
| VPN | Cluster |  | Uses a lot of bandwidth |
| Dedicated servers | Whole machines | Spare servers in racks | Individuals rent small machines, companies big ones |
| Storage hosting | Storage servers |  | Backups and file hosting; uses a lot of bandwidth |
| CDN | Clusters in several cities | Presence in 3+ locations |  |
| Cloud hosting | HA cluster | Cloud platform license | Late game |
| Colocation | Your own rack space | Own room or datacenter | Customers bring hardware; every install is a ticket |
| Add-ons |  | Unlocked per product | Backups, extra IPs, priority support, DDoS protection |

Worth adding later: email hosting, managed databases and GPU compute.

**Software choices.** Some products need software bought on the market. Each choice offers four balanced options. The cheap ones are tempting early, but switching later means a migration with downtime and tickets.

| Control panel (web hosting) | Pricing model | Trade-off |
| --- | --- | --- |
| "cPanic" (cPanel) | Per hosted account, in tiers | Customers know it; gets expensive as you grow |
| "Pleskit" (Plesk) | Per server, by number of domains | Good value at mid size |
| "DirectAdmen" (DirectAdmin) | Per server, flat tiers | Cheap; fewer features, more tickets |
| "FreePanel" (open-source panels) | Free | No license fee; more admin work and tickets |

Game servers work the same way: each game has its own license terms (one-time, per server or per player slot) and its own demand.

**Plans editor.** For each product you edit a table of plans: name, resources (CPU, RAM, storage, traffic), price and contract length. The game shows the market's base rate next to each value, such as the average price per GB of RAM or per TB of traffic. Customers pick the plan that fits their needs within their budget, from you or from a competitor.

**Contracts.** All contracts recur, monthly or yearly.

## Customers and market

Customers come from nine profiles on a 3×3 grid of budget and technical skill. Each profile weighs three scores on every plan against its price. This borrows King of Retail's model, where every product has quality, fashion and luxury scores and customers sit on a wealth × fashion grid ([customer wiki](https://king-of-retail.fandom.com/wiki/Customers)).

**The three scores**

| Score | Raised by | Matters most to |
| --- | --- | --- |
| Performance | Hardware, resources, network capacity, latency | High technical skill |
| Reliability | HA clusters, uptime record, SLA, support response time | High budget |
| Convenience | Control panel, add-ons, one provider for everything | Low technical skill |

Price matters most to low-budget customers.

**The nine profiles**

| Budget \\ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual: a blog, family photos | Gamer: game server and a small site | Hobby developer: the cheapest VPS |
| Medium budget | Sole proprietor: a flower shop's website | Small business: site, email, domains | Agency or startup: VPS, many sites |
| High budget | Doctor's or law office: managed, must not fail | Online shop: HA hosting, SSL, backups | Enterprise: dedicated, cloud, colocation |

**Hidden profiles.** Behind each profile the game keeps: products wanted and how likely they are bought together, budget, plan size, outage tolerance, ticket habits, and requirements on the host (see Company level and reputation).

| Profile | Usually buys together |
| --- | --- |
| Gamer | Game server, small website, domain; never enterprise support |
| Sole proprietor | Web hosting, domain, email |
| Online shop | Web hosting, SSL, backups, DDoS protection |
| Enterprise | Dedicated or cloud servers, SSL (with every domain), priority support |

**Cross-selling.** Unlockable boosts raise those odds, such as a free SSL certificate with every domain or a game server and website bundle. Each gives customers a bonus and you more sales per customer.

**Market research.** Requirements start hidden. The Market Research app reveals, per profile, budget ranges, which scores they weigh, and what they demand from a host. It also shows demand by product and city, and reports on lost sales, for example "chose another host: no domains on offer".

**Competitors.** A few big, established hosts with parody names dominate the market. They are a fixed backdrop and don't react to you, but the market is crowded and hard-fought. A customer first drops hosts that miss its requirements, then compares the remaining plans on price and the three scores.

## Company level and reputation

Your company climbs a ladder of levels set by its net worth. Business customers only consider a host at a level they trust, so no enterprise moves its systems to a company running out of a garage.

**Net worth** combines three things: customers (recurring revenue), hardware you own, and years in operation.

| Level | Name | Typical setup | Who will buy |
| --- | --- | --- | --- |
| 1 | Basement Hoster | A few towers on a shelf | Friends, gamers, hobbyists |
| 2 | Garage Hero | Rented rack units | Private individuals, sole proprietors |
| 3 | Rack Renter | Several rented racks | Small businesses |
| 4 | Cage Fighter | A cage and a small team | Agencies, mid-size companies |
| 5 | Room Service | Own rooms, HA clusters | Mid-size companies, first enterprises |
| 6 | Datacenter Baron | Own datacenter | Enterprises, public sector |

**What customers check.** Each customer profile has hidden requirements about the host itself, not just the product:

- Company level and years in operation
- Number of employees
- Portfolio: many want one provider for everything, such as web hosting and domains together
- Uptime history and review score
- Location, for example German companies preferring German datacenters

Market research reveals these requirements (see Customers and market).

## Support

Support is the first job that overwhelms you. Every outage, question, install request and cancellation arrives as a ticket in the Support app.

**Answering a ticket.** Each ticket offers a few pre-written replies and predefined actions, such as restart the service, issue a credit, escalate to a technician, or process the cancellation. The right choice closes it; a wrong one brings a follow-up. Each customer expects an answer within a set time, which depends on their segment and plan (priority support shortens it).

| Ticket type | Triggered by | Typical actions |
| --- | --- | --- |
| Outage report | A service the customer uses goes down | Status reply, credit, escalate |
| How-to question | New customers; cheap control panels | Template answer |
| Billing question | Invoices and payment reminders | Explain, resend invoice, grant an extension |
| Upgrade request | Customer outgrows their plan | Move to a bigger plan |
| Cancellation | Unhappy or departing customer | Retention offer, process the cancellation |
| Colocation install | Colocation customer ships hardware | Book an install with a technician |
| Abuse report | Spam or attacks from a customer's server | Warn, suspend |

**The cascade.** Customer happiness drops while tickets wait, and unhappy customers cancel or don't renew. Cancellations are tickets too, so a bad week snowballs into a flood. An outage creates tickets from every affected customer, weighted by segment: a flower shop writes once, an online shop three times.

**Automating support.** Support agents work through the queue at their own speed. Later, an AI support bot handles simple ticket types such as how-to and billing questions, and passes the rest to humans. A public status page (an unlock) cuts outage tickets.

## Billing, finance and insurance

Every contract is billed monthly or yearly, and some customers don't pay. Chasing them is a manual job until bookkeepers and accountants take it over.

**Invoices and dunning.** Invoices go out automatically on each billing date. Some customers pay late and a few never pay. When a dunning step is due, a button appears in the Billing app, and clicking it sends the notice (starting values, to tune):

1. **Payment reminder**, 7 days after the due date. Friendly, no fee.
2. **First dunning notice (Mahnung)**, after 14 days, with a fee.
3. **Final notice**, after 28 days. The customer's service is suspended, which creates tickets.
4. **Collections**, after 42 days. The debt goes to a collection agency for a fraction of its value, and the customer is gone.

Payment habits differ by segment. Private individuals forget most often, and enterprises pay slowly but always pay.

**Bookkeepers and accountants.** Bookkeepers record payments and send reminders. Accountants handle the later dunning steps, collections and month-end reports. Each works at their own rate, so a growing customer base needs a growing team.

**Finance app.** Profit and loss, cash flow, monthly recurring revenue, churn, revenue by product and segment, and costs by category, each as charts.

**Bank app.** Take out loans with a set amount, term and interest rate. The rate and the maximum amount depend on your company level and repayment history, and missed repayments add penalties.

**Insurance.** SLA insurance pays the credits you owe customers when you miss an SLA. It covers three claims; after the third, the insurer blocks you for a year. The premium rises with a poor uptime record.

## Staff and AI bots

Staff are named people with a skill level, a work rate and a salary. Juniors cost little and grow into experts; seniors are good from day one but cost far more, as on the real job market.

**Employees.** Each employee has a name, role, skill (0–100), work rate, salary and tenure. Work rate rises with skill. Skill grows with tenure, fastest in the first years. The salary is set by skill at hiring, and yearly raises stay small, so a junior who stays is the cheapest expert you can get. Once a year each employee asks for a raise, and refusing makes them more likely to leave and take their skill with them.

**Roles**

| Role | Takes over | Notes |
| --- | --- | --- |
| Support agent | Tickets |  |
| Technician | Installs, repairs, cabling, colocation installs | Works at one location; until hired, you are the technician |
| Network engineer | Port setup, routing, transit and peering contracts |  |
| Bookkeeper | Recording payments, payment reminders |  |
| Accountant | Dunning, collections, month-end reports |  |
| Marketing manager | Campaigns, review platforms, market research |  |

**Hiring.** The Staff app lists candidates on the job market with their name, role, skill and salary ask. Job ads cost money, and better ads bring more candidates.

**AI bots.** Bots unlock late through research. They work fast and cost a monthly subscription instead of a salary. They never gain skill, handle only routine task types, and sometimes make mistakes that create follow-up work, such as a wrong ticket answer that angers a customer.

## Marketing and reviews

Marketing brings in new customers, and reviews decide how many of them trust you. You can run basic campaigns yourself; review platforms need a marketing manager.

**Campaigns.** In the Marketing app you pick a channel, the profiles to target and a monthly budget.

| Channel | Reaches | Notes |
| --- | --- | --- |
| Word of mouth | Friends, gamers | Free and slow; the only channel in the basement |
| Search ads | Anyone searching for hosting | Paid per click |
| Gaming communities | Gamers | Sponsor a streamer or a server list |
| Trade fairs | Businesses, enterprises | Expensive; only pays off at higher company levels |
| Partner program | Agencies, small businesses | Commission per referred customer |

**Reviews.** Customers leave reviews after tickets, outages and cancellations. By default you can only read them. A marketing manager can sign you up to a review platform:

| Platform | Cost | Effect |
| --- | --- | --- |
| Free listing | Free | Collects reviews; small trust boost |
| "ProvenExpat" (ProvenExpert) | Moderate monthly fee | Review invites, a website badge; medium boost |
| "TrustPylon" (Trustpilot) | High monthly fee | Strong marketing tools; the biggest boost |

The review score feeds into your reputation and into the host requirements customers check.

## Network and DDoS

Each location connects to the internet through what its city offers: transit carriers, internet exchanges and, later, private peering. Bandwidth costs money, and your customers' traffic has to fit through your links.

**The map.** The Network app opens on Western Europe's big cities, such as Frankfurt, Amsterdam, London, Paris, Berlin, Vienna, Zurich and Milan. The rest of the world stays zoomed out and only matters as distant transit destinations. Each city has its own carriers and prices, internet exchanges, datacenter operators, power price and demand.

**Ways to connect**

| Option | How it works | Cost | When |
| --- | --- | --- | --- |
| Home line | Consumer fiber in the basement, slow upload | Flat monthly fee | Start |
| Provider bandwidth | Comes with rented rack units or racks | Per TB or per Mbps | Early |
| IP transit | A port with a carrier present in the city | Billed at the 95th percentile, with a minimum commit | Mid game |
| Exchange peering | A port at an internet exchange, then sessions with other networks | Port fee; the traffic itself is free | Mid game; needs your own network number (ASN) |
| Private peering | A direct cable to one big network | Cross-connect fee; weeks of lead time | Late game |
| Links between locations | Leased wavelengths or dark fiber | Monthly fee | Several locations |

**Routing,** simplified from Series of Tubes ([repo](https://github.com/fjaeckel/seriesoftubes), MIT license). Traffic leaves through the cheapest exit available: private peering first, then exchange peering, then transit. Equal exits share the load, and anything over a link's capacity spills to the next option. Transit is billed on the 95th percentile of the last 30 days, never less than 20% of the port. Networks peer openly, only above a traffic threshold, only for a fee, or (the big carriers) not with small players at all.

**Parody names.** Series of Tubes has ~200 network names and is MIT-licensed, so we can reuse them with credit. We add our own for hosting brands, such as the OVH stand-in.

| Real company | Parody | Role |
| --- | --- | --- |
| Cogent | Cogentle | Cheapest transit; some customers demand "no Cogentle" |
| Lumen | Level Tree | Premium transit |
| Arelion (Telia) | Tell-Ya Carrier | Transit |
| Hurricane Electric | Drizzle Electric | Cheap transit, peers with everyone |
| Deutsche Telekom | Doitsche Telekomm | Big eyeball network, hard to peer with |
| Vodafone | Voda-Phony | Eyeball network |
| DE-CIX | DE-KICKS | Frankfurt exchange, raises prices yearly |
| AMS-IX | HAMS-IX | Amsterdam exchange |
| LINX | LYNX | London exchange |
| Equinix | Equinox | Datacenter operator |
| Interxion | Interaction | Datacenter operator |
| Cloudflare | Crowdflare | CDN, peers openly |
| Deutsche Bank | Deutsche Bankrupt | Bank in the Bank app |

**DDoS attacks.** Attacks target one customer, and gamers attract the most. The flood saturates your links, so everyone sharing them suffers. Your options:

- **On-demand protection:** pay per incident. It kicks in after a detection delay, so there are minutes of downtime first.
- **Always-on protection:** a monthly fee. It filters everything all the time and adds a little latency. Game servers need it.
- **Blackholing:** an emergency button that drops all traffic to the attacked address. The target goes offline, but everyone else is saved.

Customers can also buy DDoS protection from you as an add-on.

## Research and unlocks

Unlocks cost know-how points plus a one-time launch cost in money. You earn know-how from every active contract each month, so progress comes from running the business, not just from a big bank balance. Some unlocks also need a minimum company level.

**Starting kit:** a basement, reseller accounts for web hosting and domains, and game servers and VPS on your own hardware.

| Branch | Unlock path, in order |
| --- | --- |
| Products | SSL certificates → email → dedicated servers → storage hosting → VPN → CDN → cloud hosting → colocation |
| Infrastructure | Rented rack units → rented rack → cage → own room → own datacenter; HA clusters; rack templates; auto-cable |
| Network | Transit contracts → internet exchange peering → own network number (ASN) → always-on DDoS protection |
| Business | First hire → status page → market research → cross-selling boosts → review platforms → insurance → AI bots |
| Independence | Domain registrar, own control panel and other in-house replacements for resold lines |

Hardware generations unlock by year, not through research (see Racks, hardware and cabling).

## Prices

Starting values come from today's Western European market (checked October 2026, excluding VAT, dollars converted at about €0.86). Because the game starts around 2005, hardware and transit start higher and fall every year until they reach these levels.

**Space and power**

| Item | Price today | Source |
| --- | --- | --- |
| 1U in a shared rack | €25–170 per month | [hosttest.de](https://www.hosttest.de/vergleich/colocation-frankfurt.html) |
| Quarter rack (~10U, 1 kW) | ~€420 per month | [MIRhosting](https://mirhosting.com/colocation-in-frankfurt) |
| Half rack (~22U, 2 kW) | ~€840 per month | [MIRhosting](https://mirhosting.com/colocation-in-frankfurt) |
| Full 47U rack | €1,300–4,000 per month, plus ~€2,500 setup | [IMT Systems](https://www.imt-systems.com/en/colocation.html) |
| Extra power | €275–420 per kW per month | [IMT Systems](https://www.imt-systems.com/en/colocation.html) |
| Cage | €10,000–30,000 per month (estimate) |  |
| Business electricity | ~17 ct per kWh | [BDEW](https://www.bdew.de/service/daten-und-grafiken/bdew-strompreisanalyse/) |

**Network**

| Item | Price today | Source |
| --- | --- | --- |
| Transit, 1 Gbps commit on a 10G port | ~€190 per month | [Genius Weer](https://geniusweer.com/en/solutions/transit-ip) |
| Transit, 10 Gbps commit | ~€1,100 per month retail; ~€600 wholesale | [Genius Weer](https://geniusweer.com/en/solutions/transit-ip), [TeleGeography](https://resources.telegeography.com/ip-transit-price-erosion-significant-regional-differences-remain) |
| AMS-IX port, 10G / 100G | €650 / €3,240 per month | [AMS-IX](https://www.ams-ix.net/ams/pricing) |
| DE-CIX port | On request; assume close to AMS-IX |  |

**Hardware (purchase)**

| Item | Price today | Source |
| --- | --- | --- |
| 1U server, configured | €3,000–6,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| 2U server, configured | €6,000–12,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| Storage server with disks | €15,000–25,000 | [Thomas-Krenn](https://www.thomas-krenn.com/de/produkte/server-hardware) |
| GPU server, 8 GPUs | ~€300,000 | [AMCompute](https://www.amcompute.com/gpu-server-values/h200) |
| 1G switch, 48 ports | €500 (budget) to €5,000 | [dectdirect](https://www.dectdirect.nl/de/crs354-48g-4s2qrm.html) |
| 25G switch, 48 ports + 8×100G | ~€6,000 | [ServeTheHome](https://www.servethehome.com/fs-n8560-48bc-48x-25gbe-8x-100gbe-switch-review/3/) |
| 100G switch | €1,900 (budget) to €30,000 | [MikroTik](https://mikrotik.com/product/crs520_4xs_16xq_rm) |
| Edge router | €2,400 (budget) to €25,000 | [MikroTik](https://mikrotik.com/product/ccr2216_1g_12xs_2xq) |

**What customers pay (market base rates)**

| Product | Price today | Source |
| --- | --- | --- |
| Shared web hosting | €2–28 per month | [Hetzner](https://www.hetzner.com/webhosting/), [IONOS](https://www.ionos.de/hosting/webhosting) |
| VPS | €8 (2 cores, 4 GB) to €67 (16 cores, 64 GB) per month | [netcup](https://www.netcup.com/de/server/vps) |
| Dedicated server | €59–99 small, €159–614 large, per month | [Hetzner](https://www.hetzner.com/dedicated-rootserver/matrix-ax/) |
| Game server | €2.40–6.10 per GB of RAM per month | [Tech Insider](https://tech-insider.org/de/nitrado-g-portal-und-shockbyte-im-berblick/) |
| Object storage | ~€6.50 per TB per month | [Hetzner](https://www.hetzner.com/storage/object-storage/) |
| Backup storage | €2–3.20 per TB per month | [Hetzner](https://www.hetzner.com/storage/storage-box/) |
| .de / .com domain | €5–18 / €10–29 per year retail; €3–3.60 / €12–13 wholesale | [Experte](https://www.experte.de/domains/guenstige-domain), [INWX](https://www.inwx.de/de/domain/pricelist) |
| SSL certificate | DV from €8 (free via Let's Encrypt), OV ~€100, EV ~€140 per year | [Hostinger](https://www.hostinger.com/de/tutorials/ssl-zertifikat-kosten) |

**Running costs**

| Item | Price today | Source |
| --- | --- | --- |
| Support agent, junior / senior | €38,700 / €46,200 gross per year | [gehalt.de](https://www.gehalt.de/beruf/first-level-support) |
| Sysadmin, junior / senior (median) | €40,200 / €54,800 | [StepStone](https://www.stepstone.de/gehalt/Junior-Systemadministrator-in.html), [StepStone](https://www.stepstone.de/gehalt/Senior-Systemadministrator-in.html) |
| Network engineer | €54,000–67,700 | [gehalt.de](https://www.gehalt.de/einkommen/suche/senior-network-engineer) |
| Bookkeeper (median) | €38,300 | [StepStone](https://www.stepstone.de/gehalt/Buchhalter-in.html) |
| Marketing manager (median) | €45,300 | [StepStone](https://www.stepstone.de/gehalt/Marketingmanager-in.html) |
| Employer costs on top of salary | +29% | [Destatis](https://www.destatis.de/DE/Themen/Arbeit/Arbeitskosten-Lohnnebenkosten/Tabellen/lohnkosten-deutschland.html) |
| cPanel | ~€26–60 per server per month by account tier, +€0.42 per extra account | [cPanel](https://cpanel.net/pricing/) |
| Plesk | €7–31 per server per month by domain tier | [Plesk](https://www.plesk.com/pricing/) |
| DirectAdmin | ~€4–25 per server per month | [DirectAdmin](https://www.directadmin.com/pricing.php) |
| HestiaCP (open source) | Free | [HestiaCP](https://hestiacp.com/) |
| Search ads | €2–6 per click (estimate) | [CodeDesign](https://codedesign.org/google-ads-cost-europe-your-complete-guide/) |
| Trustpilot | ~€85–690 per month | [Trustpilot](https://business.trustpilot.com/pricing) |
| ProvenExpert | €30–100 per month | [ecom-tools](https://ecom-tools.de/provenexpert/) |
| Always-on DDoS filtering | ~€3.90 per Mbps of clean traffic per month | [Gcore](https://gcore.com/pricing/security) |
| DDoS-protected IP via a reseller | ~€2.60 per IP per month | [BuyVM](https://wiki.buyvm.net/doku.php/ddos) |
| Small-business loan interest | ~4% (startups 5–8%, estimate) | [Bundesbank](https://www.bundesbank.de/resource/blob/964884/37fc1e33c4e286356ad5b89489fb2a46/472B63F073F071307366337C94F8C870/2026-10-01-mfi-zinsstatistik-download.pdf) |

OVH includes always-on DDoS protection at no extra cost, which is a good model for the wholesale provider players resell from.

## Tech stack and project structure

Build it with TypeScript, Vite and React, keep the simulation as plain TypeScript, and organize the repo the way Series of Tubes does. That means numbered topic folders, a CLAUDE.md with hard rules, skills for recurring jobs, and one test suite per feature. The code is MIT-licensed.

| Layer | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript, Vite | Fast reload; builds a static site |
| Desktop and apps | React + Zustand | A window manager with a dozen app panels is UI work, React's strength |
| Rack and room views | SVG drawn by React components | Crisp device fronts at any zoom; no game engine needed |
| Europe map | Canvas 2D + d3-geo, Natural Earth outlines | Series of Tubes draws its map on a plain canvas too |
| Charts | uPlot | Many live series, cheap to draw |
| Simulation | Plain TypeScript, seeded randomness, an hourly tick | Testable without a browser; same seed, same game |
| Saves | localStorage, versioned and compressed; old saves repaired on load | Switch to IndexedDB if saves outgrow localStorage's ~5 MB |
| Tests | Vitest for the simulation, Playwright for the UI | Claude Code can run both by itself |
| Hosting | GitHub Pages; a service worker for offline play | No server at all |

**Folder layout**

```text
CLAUDE.md                 hard rules, layout, commands
.claude/skills/           edit-the-game, add-content, write-tests, balance, release
docs/design/              game design, economy model, first-hour script
docs/ARCHITECTURE.md      how the pieces fit
docs/adr/                 decision records (static only, saves, i18n)
src/sim/                  pure TypeScript, never imports React
  00-core/                seeded random, time, money, ids
  10-catalog/             hardware, products, licenses, prices
  20-world/               cities, datacenters, carriers, exchanges
  30-market/              customer profiles, demand, competitors
  40-company/             staff, levels, reputation
  50-state.ts             game state and new-game setup
  60-infra/               locations, racks, ports, clusters
  70-network/             routing, transit billing, peering
  80-business/            tickets, invoices, dunning, marketing
  85-incidents/           failures, outages, DDoS
  88-tick/                the hourly and monthly tick
  90-actions/             every player action, used by UI and tests alike
  91-save/                save, load, repair old saves
src/ui/desktop/           menu bar, dock, windows, notifications
src/ui/apps/              one folder per app
src/ui/art/               code-drawn rack and server fronts
src/i18n/                 player-facing strings by label
tests/                    one seeded suite per feature, save fixtures
.github/workflows/        CI, deploy to Pages, @claude action
```

**Hard rules for CLAUDE.md,** adapted from Series of Tubes:

- Static site only; never add a server.
- Every real company appears as a pun.
- Player actions go through `90-actions`, so the UI and tests use the same path.
- Old saves must keep loading: every new field gets a default when a save is repaired on load.
- Every change comes with a test, using seeded randomness and never luck.
- Player-facing text goes through i18n labels, never sentences glued together from fragments.

## MVP and milestones

The MVP has a basement, one rented rack, web hosting and VPS, support and billing done by hand, and the first hires. That's the smallest version where you can feel the automation loop. Each milestone ends in something playable.

1. **Desktop shell.** Menu bar, dock, draggable windows, notifications, time controls, saving in the browser. Done when apps open and the clock runs.
2. **Locations and racks.** Basement and one rented rack, the rack front view, buying servers and switches, cabling ports in the inspector. Done when a cabled server shows as online.
3. **Clusters and products.** One cluster, resold web hosting and your own VPS, the plans editor with market rates. Done when a customer can buy a plan.
4. **Customers and support.** Customer profiles, purchases, tickets with templates and actions, happiness and churn. Done when an outage floods the inbox.
5. **Billing and finance.** Invoices, dunning buttons, collections, profit and loss, a bank loan. Done when an unpaid invoice can go all the way to collections.
6. **First hires.** The job market, a support agent and a bookkeeper working through their queues. Done when a hire visibly empties a queue.

**After the MVP:** more location tiers, the Network app with transit and peering, more products, marketing and reviews, the research tree, company levels, competitors, DDoS, AI bots.

## Open questions

- [x] Room layout: predefined slots (as written here) or free placement? -> Predefined Slots
- [x] Research: know-how points plus money (as proposed), or money only? -> as propsoed
- [x] Should the player have limited working hours per day? That would make hiring feel necessary instead of optional. -> no, they can also pause the game if they feel like pausing it, they could technically run it alone if they wanted to.
- [x] Start in the present day, or in the past (around 2005) with technology advancing over time? past and yes technology would advance but dont make too much variety between servers we want to keep it on resources on the servers mainly, so bigger ram etc. unlocks over time, oh energy costs are also athing depending on what the lcoation charges per energy (own datacetners can have custom contracts with energy providers) it should move users to replace old servers with new ones to be more energy erficinet
- [x] Do competitors expand and react to you, or are they a static backdrop? they are a static backdrop, there should be like some other bigger providers, and its a really hard and fought overm arket
- [x] Parody names: puns on the real name ("TrustPylon") or fully invented names? puns on real names
- [x] Which open-source license (MIT, GPL)? MIT
- [x] Which events auto-pause the game? nothing

Ideally at the start they are enthised to either rent a server from a company to get resources to place on, we always have servers as "clusters" so they can be assigned to different products/workloads, so they can fully rent out a server from a existing bigger provider at the start.&#32;
