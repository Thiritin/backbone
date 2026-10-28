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

The menu bar holds the time controls, date and cash. The game saves itself in the browser. The logo menu on the far left shows your company logo; it exports the save to a file, imports one, and deletes all progress after a confirmation. A first visit, or one after deleting, opens a start screen with a New game button. A new game opens Welcome to Pear, where you name your company and pick a logo mark and colour, or skip it; Settings keeps the same fields under Company, above Appearance (light, dark or automatic) and Notifications (one Allow switch per app). Closing the welcome opens the Getting started guide, which also sits on the desktop as an icon.

**Pear One and the Pear Store.** The desktop is Pear One, an all-in-one hosting platform from Pear, a fruit company with a familiar look. A new game starts with the starter apps in the dock: Locations, Shop, Customers, Support, Billing, Finance, Bank, Research, Checklist and Settings. Getting started and Notes are desktop documents and stay out of the dock. Every other app sits in the Pear Store, the app store for Pear One. An item whose skill the company has not learned yet shows the skill it needs, and its button opens that skill in Research; once the skill is learned the item shows Get. The store never shows research costs. Installing an app adds it to the dock, and apps unlock further features as you go. Because of EU competition rules, some software comes in several competing products to choose from, such as the virtualization platform and monitoring. The introduction text lives in docs/design/intro.md.

**The store lives in the Shop.** The Pear Store is a Software section in the Shop, next to the hardware manufacturers. It opens with a banner in the Pear style: the Pear logo and "Unlock the future today. Great upgrades to your operating system that make your life easier." Below the banner, a featured app and curated rows (Essentials, Growth, Upgrades) list each app with its icon, subscription and a Get, Open or Research button; clicking one opens its page with what it includes, its price and Install or Cancel. An app has to be researched (or reached by company level) before you can buy it, and buying it installs it in the dock. Apps also sell upgrades as cards of their own. The first is dock badges: once bought, every app in the dock shows a count of what waits for you, such as open tickets in Support, unpaid invoices in Billing or failed parts in Locations. Without the upgrade, only the dot under a running app shows. The desktop widgets (calendar, open tickets, cash, monthly revenue, customers and level) are upgrades too: a new game has none, and each one appears on the desktop once bought. Widgets need no research.

**Subscriptions.** Pear One is a funnel. The base is free, since you already paid for the hardware, and every app beyond the starter set is a feature expansion from the Pear Store with a monthly subscription, billed through the Bank like rent. Some expansions also sell in-app purchases: one-off extras such as an instant invoice run, alert text messages or extra dashboard slots. Prices scale with your size (per device, per customer or per employee), and Pear raises them every year, sometimes sharply, with a cheerful email about "new value". Cancelling a module removes the app from the dock and switches its features off, but keeps its data, so you can come back. Installing pays the first month at once and needs the cash for it; every later month is billed on the first with the other bills. Modules are a real cost to weigh against the work they save, and a steady drain that grows with the company.

| App | What it does |
| --- | --- |
| Locations | Grid of your locations; opens room views and rack front views |
| Shop | Servers, switches and patch panels by manufacturer, bought into storage |
| Network | Europe map, uplinks, topology view, DDoS protection |
| Products | Product lines, software licenses, clusters |
| Sales | Requests from new and existing customers, quota requests, later the shop |
| Virtual machines | VMs, hosts, storage pools, backups and incidents, branded after your virtualization platform |
| Customers | Customer list, contracts, happiness |
| Support | Ticket inbox with reply templates and actions |
| Billing | Invoices, payment reminders, dunning, collections |
| Finance | Account statement, later profit and loss, cash flow, recurring revenue, churn |
| Bank | Loan offers, active loans and repayments |
| Staff | Job market, hiring, salaries, task assignment |
| Marketing | Campaigns, reviews, review platforms |
| Market | Market research: demand, customer requirements, lost-sale reports |
| Research | The skill tree: trainings that make Pear Store items available |

**Notifications.** Banners for new tickets, overdue invoices, hardware failures, attacks and staff requests. Each one opens the right app at the right place, and a notification center keeps the history. Nothing pauses the game automatically.

**Look.** Clean and light like macOS, with a dark mode. Interface text in Inter, numbers in a monospace font so columns line up, icons from Lucide. Rack and server fronts are drawn in code, so every device has a consistent, detailed front.

## Locations and space

Infrastructure lives in locations: your basement first, then space in other companies' datacenters, and in the end your own. You always own your racks and everything in them. A location gives you floor space, power, cooling and connectivity, and where you go decides a lot of what you can offer: which carriers and exchanges you reach, how well outages are covered, and which customers trust you.

**Regions and availability zones.** The game follows OpenStack: each location is an availability zone (AZ), and its city is the region. Frankfurt is region "fra"; the basement is its first zone fra1, and a rack share at Equinox FR5 becomes fra2. Everything with a place belongs to exactly one zone: racks, storage, clusters and every workload a customer books. A customer books a VM, a web space or a rack section in one specific zone, and gets redundancy by booking in two zones of the same region. Zones in one region are linked cheaply and with low latency; regions are far apart.

**Limited space.** Datacenter space is scarce. Every datacenter has a fixed floor that grows only in occasional expansion phases, and competitors rent most of it. You can rent only what is free at the moment. Space frees up when competitors cancel, at random, or when the building expands, and a waitlist tells you when what you need is available. Sooner or later every building is full, so growth means spreading across datacenters or building your own.

**Space**

| Space | What you get | Size | Billed |
| --- | --- | --- | --- |
| Basement | Room for one 24U rack and a home internet line | 1 position | Free; power at the household price |
| Rack share | Part of a rack the provider owns and installs, with its own lockable section and power share | 1/8, 1/4, 1/2 or a full rack | Per share per month, power per kWh |
| Rack positions | Floor positions in a provider's shared hall for your own racks | 1 to 4 positions | Per position per month, power per kWh |
| Cage | A fenced, locked area in the hall | 4, 8 or 16 positions | Per cage; cheaper per position than single positions |
| Private suite | A room of your own in the provider's building | 20 or 40 positions | Lease per month; you add your own UPS and feeds |
| Own datacenter | A building you lease or build | 100 positions and up | Lease or purchase; power room, generators and carrier room are yours |

**Racks are yours.** You buy racks (24U, 42U or 47U) and place each one in a free position. A rack can move with everything in it: the servers inside go offline, cables to other racks and to the carrier panel are unplugged, and the rack arrives a day later in the same city or three days later in another. That is how a company grows out of the basement: you rent a position in a datacenter and move the basement rack there.

**Datacenters.** Every city has several datacenters from different providers, and each one has its strengths and weaknesses. The Add location dialog compares them side by side:

| Property | Varies between | What it changes |
| --- | --- | --- |
| Provider | Big carrier-neutral chains, local operators, budget hosts | Price, reputation and the rest of this table |
| Carriers on site | One to thirty | Which transit you can buy; a single-carrier site is cheap but locks you in |
| Internet exchange | On site, reachable by cross-connect, or none | Whether exchange peering is possible here |
| Private interconnects | Which big networks have a presence | Whether private peering is possible here |
| Power feeds | Single, or A and B | Whether dual power supplies pay off |
| UPS and generator | Neither, UPS only, or both | How many grid outages reach your servers |
| Green power | Yes or no | Customers who want green hosting; a slightly higher power price |
| Power price | Per kWh, by city and provider | Running cost |
| Power density | 4 to 20 kW per position | How many servers a rack can actually run |
| Cross-connects | Monthly fee per cable | The cost of every carrier, exchange and customer link |
| Remote hands | Price per hour and response time | Repairs without your own technician on site |
| Certification | Certified or not | Offices and enterprises require it |
| Lead time and term | Days until ready, months of commitment | How fast you can expand and how long you are bound |

**Provider logos.** Every datacenter provider has its own parody logo, drawn in code: an original mark and wordmark that hint at the real company through its name and colour without copying its logo. The basement shows a house icon.

**Location view.** The Locations app opens on an overview: a map with a pin per location and a card for each with its space, power protection, uplinks and how full it is. A switcher at the top jumps between locations, and a plus button opens the Add location dialog. Inside a location you see its floor: the positions with your racks in them, the free positions, and the carrier panel where uplinks and cross-connects arrive. Clicking a rack opens its front view; device fronts are drawn only there.

**Energy.** Every location bills the power your hardware draws at its own price per kWh. Your own datacenter can sign a custom contract with an energy provider.

**Power protection.** The grid fails now and then, and how much of that reaches your customers depends on the location.

| Location | Protection |
| --- | --- |
| Basement | None: every grid outage takes the servers down. A UPS rides through short outages until its battery runs out. |
| Datacenter | Whatever the site has: feeds, UPS and generator differ by datacenter |
| Private suite or own datacenter | Whatever you build: UPS, batteries, generators and two utility feeds |

A second feed only helps servers that have two power supplies, one on each feed. Dual-PSU servers cost more, so the player decides per server whether the protection is worth it. Customers who care about uptime pay for it: HA products can require dual feeds, or servers spread over two locations.

**Own datacenter rooms.** A private suite or own datacenter adds rooms beyond the server floor:

| Room | Holds | First available |
| --- | --- | --- |
| Power room | UPS, batteries, generators | Private suite |
| Cooling | Air handlers, later liquid cooling | Own datacenter |
| Carrier room | Hand-offs to carriers and internet exchanges | Own datacenter |

## Racks, hardware and cabling

Racks hold servers, switches and routers, and you cable them port by port. Bandwidth, redundancy and failures all follow from how you wire them.

**Hardware**

| Device | Size | Role |
| --- | --- | --- |
| Compute server | 1U | VPS, web and game servers |
| Storage server | 2U | Storage hosting, backups |
| GPU server | 4U | AI compute, late game |
| Access switch | 1U | Connects the servers in one rack |
| Core switch | 1–2U | Connects racks to each other |
| Edge router | 1–2U | Connects to transit and peering |
| Patch panel | 1U | Tidy cross-rack cabling; faster repairs |
| Aggregation switch | 1U | SFP fiber ports that link racks and uplinks |

Switches come in several sizes: 8, 24 and 48 copper ports, each with a few SFP cages for fiber.

**Brands.** Servers and switches come from parody brands whose fronts look like the real ones: Dwell (hex-mesh bezel), Hewlett-Packet (silver front with a pull tab and a perforated grille), SuperMacro (black chassis with silver drive trays) and Sysko for switches. A player can tell a rack's contents apart at a glance.

**Rack front view.** Clicking a rack shows its front: every device drawn at its real height, with status lights. Clicking a device opens it in the inspector on the right.

**Ports and cables.** Clicking a switch or router lists its ports in the inspector. For each port you pick the other end: a device in the same rack, or another rack and device from a list. Copper covers 1G, short direct-attach cables 10–25G inside a rack, and fiber 10–400G between racks. Cables between racks run through the trays. Both ends must match in speed, and each port gets a role (server, uplink, or link to another switch).

**Patch panels.** A patch panel sits at the top of a rack, and the player decides what each jack is for: a carrier's cross-connect, a link to another rack, or a colocation customer's line. Incoming cables land on the back of the panel, and short patch cables connect the front jacks to switch ports. Re-patching a jack is quicker than pulling a new cable through the trays.

**Port groups.** Two to eight ports going to the same device can be bundled into a group (LACP). The group adds up their bandwidth and stays up when one cable or port fails. Both ends must be grouped, or the link falls back to a single port.

**Server network cards.** A server's network ports are bonded in one of two modes, set in the inspector:

| Mode | How it works | Bandwidth | Switch side |
| --- | --- | --- | --- |
| Failover | One port carries the traffic and the other takes over when it fails | One port | Nothing to set up; works across two switches |
| Load balance | All ports carry traffic (LACP) | All ports added up | Needs a port group; across two switches the pair must be stacked (an unlock) |

Failover is the safe default. Load balance doubles a server's bandwidth, but if the switch ports aren't grouped it falls back to one port and the inspector shows a warning.

**Port inspector.** Selecting a port shows the whole path as a diagram, from the switch port through any patch panel to the device on the other end, with the cable type and speed on each hop. Below it, a graph shows the port's traffic in and out over the last 24 hours.

**Technician PC.** A laptop that you plug into a free switch port gives you debug tools: ping, traceroute, a cable test that finds broken pairs, and port status. Finding the fault before sending a technician shortens the repair, because the technician brings the right part.

**Bandwidth.** Every port, switch and router has a capacity, and traffic can't exceed the slowest link on its path. One server on a 1G port can't serve 200 Gbps. Scaling up means faster ports, switches, uplinks and transit.

**Failures and redundancy.** Disks, power supplies, switches and routers fail at random, and more often as they age. Without a second path, everything behind a failed device goes offline. Two switches, two routers and servers wired to both keep services up. Until you hire technicians, you fix failures yourself.

**Upgrades**

- A server swaps in place for another of the same height, for example a faster 1U. Bigger machines, such as a 4U GPU server, need free space. Drain the server first, or its workloads go offline during the swap.
- A switch or router swaps in place only if the new one has at least as many ports as are in use, so you can't downgrade below the used port count. Cables stay on their ports.

**Server models.** Every server is described by the same handful of specs, so comparing two is quick:

| Spec | Range | What it changes |
| --- | --- | --- |
| Height | 1U, 2U, 4U | Rack space |
| Architecture | x86; ARM from 2020 | ARM is cheaper per core and per watt, but a cluster runs one architecture |
| CPU | 1 or 2 sockets × cores per socket | Cores available to workloads |
| RAM | Fixed slots, filled at purchase or later | Memory available to workloads |
| Storage | Drive bays × disk type (HDD, SSD, NVMe) | Disk space and speed |
| Network | Ports × speed (1G up to 100G by year) | Bandwidth, and whether failover is possible |
| Power | Draw at idle and at full load | The power bill and the fuse limit per rack |
| Power supplies | 1 or 2 | Two connect to an A and a B feed and survive a failed supply |

The Shop app sells pre-built hardware from several manufacturers, each with its own parody logo. Within a class the manufacturers differ a little in price and failure rate, never in specs.

| Class | Lines | Notes |
| --- | --- | --- |
| Servers | Balanced 1U, compute-dense 1U, memory-optimized 2U, storage 2U, backup storage 4U, archive storage 4U, GPU 4U from 2016, ARM 1U from 2020 | One model per line and generation, so capacity can be matched to what customers need |
| Switches | Layer 2 or layer 3, with copper or SFP ports | All managed; layer 3 can route between networks and act as a gateway in later milestones |
| Security appliances | 1U firewalls with a throughput rating | Sit inline between the gateway and the switches; needed for firewall and DDoS features later |
| Patch panels | 24 or 48 ports, copper or fiber | Passive |

Storage servers hold fast disks for block and object storage. Backup servers hold many large HDDs for backups. Archive servers hold the densest, slowest drives and are the cheapest per TB, which makes archival backups a storage class customers can buy. Every model is pre-built with fixed CPU, RAM, disks, NICs and power supplies, so the choice is which model, architecture and size to buy. Bigger and denser models draw more power. Each model shows as a small isometric picture, so the sizes are easy to compare.

**Cart and leasing.** You add models to a cart and see the total before you check out. At checkout you pay in cash or lease the whole cart. A lease spreads the cost over 12, 24 or 36 monthly payments, and three leasing companies each make an offer. Offers vary at random from good to bad and change every month, so it pays to compare them. Leased hardware works like bought hardware, but it can't be sold until it is paid off. Buying it out early costs the remaining payments, and after the last payment it is yours.

**Storage.** Each availability zone has its own storage room. At checkout you choose the zone the Shop delivers to. Units are mounted from the rack view of that zone, and unmounting puts them back into the same zone's storage and drops their cables. The storage list itself has no mount action. Sending stored units to another zone is a shipment that costs and takes as long as a rack move. Identical units in storage form a stack, and a stack can be mounted in one step, each unit directly on top of the last. Hardware sells from storage or from a rack at its resale value: 80% of the price after the first month, falling evenly to 20% over the next two years. A new generation arrives every three years, and each one packs more resources per U and per watt, so replacing old servers cuts the energy bill as well as freeing space.

**Copy and paste.** A finished rack can be saved as a template and pasted into an empty rack slot. The game orders the hardware, and technicians install and cable it. A typical large location ends up with one core routing rack and many server racks, each with its own pair of switches.

**Cabling manager.** Each location has a cabling view that lays every port of the location out on one plane, in columns from the carrier panel and its uplinks through routers and switches to servers and patch panels. You drag from one port to another to lay a cable, and the game picks copper, DAC or fiber from the port types and whether both ends are in the same rack. Ports that can't connect dim while you drag. Clicking a cable selects it so you can remove it. The rack view and the cabling view show the same cables.

**Wear, failures and maintenance.** Every device is built from components that wear out: drives, power supplies, fans, RAM, the mainboard, the CPU and network cards in servers, and power supplies, fans and the board in switches and routers. Each component type has a life expectancy. Before it, failures are rare; after it, they become likely, and drives fail far more often than RAM or mainboards. A failed component shows as an amber or red light on the device front, and what happens depends on what broke:

- **Drive:** in a RAID array the server keeps running degraded until the drive is replaced and rebuilt; without RAID the data on it is lost and the server goes down.
- **Power supply:** with two, the server keeps running on the other; with one, it goes down.
- **Fan:** the device runs hot and its other components fail twice as often until the fan is replaced.
- **RAM, mainboard, CPU or network card:** the device goes down until the part is replaced.

Spare parts are bought in the Shop and kept in the zone's storage. You replace a part from the device in the Locations view. Drives in a RAID array, fans and one of two power supplies can be swapped while the device runs; everything else needs the device powered off, so its workloads go offline unless you migrate them first. At a datacenter the provider's remote hands do the swap, at their hourly rate and response time. Replacing worn parts before they fail is your call, and it is cheaper than an outage.

**RAID.** Each server's drives run in a RAID level you choose: none, RAID 1, RAID 5, RAID 6 or RAID 10. More redundancy means less usable space and more drive failures survived. A rebuild runs at the rebuild rate you set: a fast rebuild slows the server, a slow one leaves it exposed for longer. Distributed storage pools across servers, Ceph style, are a later unlock.

**Power and labels.** Any device can be powered off and on from the Locations view; everything that depends on it goes down with it. Devices can be given a custom label, and cables a custom colour.

**Power feeds.** A rented position comes with one power feed at the datacenter's kW limit. You can add a second feed (B) so that servers with two power supplies survive a feed failure, or a high-density feed that raises the kW limit. The basement can get one extra household circuit. A feed that draws more than its limit trips.

**Monitoring.** Without monitoring, the only way to notice a failure is to see the lights in the Locations view, or to wait for customers to complain. Monitoring software is an early research unlock. It notifies you of every failure and warns about parts past their life expectancy. It also opens the Monitoring app, a dashboard of every location, rack, feed, link and server with live usage and a list of alerts. Like other software, it comes in a few products with different prices.

**Keeping it fun at scale.** Cabling port by port is fun for the first few racks and tedious at 200. Three things fix that: rack templates, an auto-cable button that wires a server to the next free ports on its rack's switches, and technicians who do installs for you.

## Clusters and products

Servers join clusters, and products draw their resources from clusters. Everything is virtualized, so adding a server to a cluster adds capacity for every product running on it.

**Clusters.** A cluster is a named pool of servers, such as "Webhosting 1" or "HA Cloud". Its capacity is the sum of its servers' CPU, RAM and storage. Its tier sets what it costs to run and how it handles failures:

- **Consumer cluster:** no failover. Cheap, and fine for customers who shrug off a day of downtime.
- **High-availability cluster:** keeps spare capacity in reserve and spreads servers over two switches or two locations. Costs more, and is sold to customers who can't tolerate outages.

**Everything runs on clusters.** Every product runs as workloads on a cluster, so draining, replicas, keep-apart rules and failover work the same for all of them. Web hosting runs inside shared web server instances with the control panel, and DNS, game servers, load balancers, databases and Kubernetes run as instances too. Object storage runs on a storage cluster made of storage nodes. Two things stay outside: a dedicated server is a whole node taken out of the scheduler's pool and handed to one customer (OpenStack's bare-metal service, Ironic), and colocation is the customer's own hardware using your space, power and ports. The basement server starts as a one-node cluster, which is why a second node and the HA unlock matter.

**Workloads.** Every contract runs as one or more workloads, placed on the servers (nodes) of a cluster:

| Workload | Uses | Moves to another node by |
| --- | --- | --- |
| Virtual machine | vCPUs, RAM, disk | Live migration; customers don't notice |
| Web space | A slice of a web server's CPU, RAM and disk | Copying its files; a few seconds offline |
| Game server | Mostly CPU and traffic | Restarting on the new node; players are kicked |
| Storage volume | Disk | Copying its data; slow, and uses bandwidth |
| Dedicated server | A whole node | It can't move; the customer rents that machine |

**Placement.** The cluster's scheduler picks a node for every new workload, the way OpenStack does. Each cluster has a policy: *pack* fills one node before the next, so fewer servers draw full power, and *spread* keeps every node equally loaded, so a failed node hits fewer customers. Each cluster also sets two rules in its settings, in the spirit of Ceph's default placement rules:

- **Replicas:** how many copies of each workload's disk the cluster keeps (1 to 3). More replicas survive more failed nodes and cost that much more storage.
- **Spread across:** host or rack. A cluster lives in one availability zone, so a customer's workloads and the replicas of one disk go to different hosts or racks within it wherever the cluster has room, and fall back to hosts when it doesn't. Spreading across zones is the customer's choice: they book in two zones. The node view flags workloads placed against the rule. CPU, RAM and disk can be overcommitted per cluster (see Usage and overcommit). A workload has to fit on one node, so a cluster can have enough free RAM in total and still refuse a big VM. The Rebalance button moves small workloads around to make room.

**Node states.** Each node in a cluster has one of four states:

| State | Meaning | OpenStack |
| --- | --- | --- |
| Active | Takes new workloads | Compute service enabled |
| Cordoned | Keeps its workloads but takes no new ones | Compute service disabled |
| Draining | The scheduler moves every workload to other nodes | Live-migrating every instance off the host |
| Maintenance | Empty; safe to upgrade, re-cable, swap or remove | Disabled and empty |

Draining stops with a message when the rest of the cluster has no room, and says how much is missing. Uncordoning returns the node to Active. Migrations share the links between nodes, so the scheduler moves a few at a time.

**OpenStack as the model.** Virtual machines and cloud servers follow OpenStack, so players who know it recognise everything and players who don't learn something real. The game uses plain names on screen and keeps the OpenStack concept behind each one:

| In the game | OpenStack concept | How it plays |
| --- | --- | --- |
| Cluster | Compute region or cell | A pool of nodes with one scheduler |
| Node | Compute host (Nova) | A server that runs instances |
| Instance size | Flavor | vCPUs, RAM and disk; requests name a size |
| Location (datacenter) | Availability zone | Every booking names one; a cluster lives in one |
| City | Region | Holds one or more zones |
| Hardware class | Host aggregate | Nodes tagged NVMe, ARM or high-memory; sizes can require a class |
| Placement policy | Scheduler filters and weighers | Filters drop nodes that can't fit; *pack* or *spread* weighs the rest |
| Overcommit | CPU, RAM and disk allocation ratios | CPU up to 8:1, RAM up to 1.5:1, disk (thin provisioning) up to 2:1 |
| Keep apart | Server group (anti-affinity or soft anti-affinity) | A customer's instances land on different nodes, strictly or when possible |
| Disk replicas and spread | Ceph-backed volumes with CRUSH failure domains | 1 to 3 copies spread across hosts, racks or locations |
| Volume | Block storage (Cinder) | Disks that outlive an instance and move with it |
| Image | Image service (Glance) | The operating systems you offer; each one is a convenience point |
| Private network | Project network (Neutron, VLAN or VXLAN) | Overlay networks are the VXLAN unlock |
| Public IP | Floating IP | Each one uses an address from your pool |
| Customer account | Project (Keystone) with quotas | Cloud quotas and quota requests |
| Restart after a failure | Evacuation, instance HA (Masakari) | Part of HA clusters |
| Load balancer | Octavia | Runs as instances on the cluster |
| Object storage | Swift or Ceph RGW | Runs on storage nodes |
| DNS hosting | Designate | Two DNS workloads per cluster |
| Managed databases | Trove | Database instances you patch and back up |
| Managed Kubernetes | Magnum | Needs a Kubernetes engineer |

**Control planes.** Every cluster needs management services running on some of its own nodes: the platform's controllers and API, the scheduler, the storage monitors, and for managed Kubernetes the customer clusters' control planes. They take a fixed slice of CPU and RAM on the nodes that host them. A consumer cluster runs one copy; a high-availability cluster runs three on different nodes and keeps working while two of them are up. If the control plane goes down, running workloads keep running, but nothing can be started, moved, restored or sold on that cluster until it is back.

**Server view.** Selecting a server in a location shows everything about it in one place. Its ports work like a switch's: each port with its speed, link state, bond group and the device and port at the other end. Below that come live utilization of CPU, RAM, disk and network against the hardware and the overcommit limits, the workloads running on it with their customers, and the control-plane roles it hosts.

**Usage and overcommit.** Customers rarely use everything they booked at once, so a cluster can sell more than it physically has. Every workload follows a usage curve for its customer type over the hours of the week: game servers sleep through the working week and run hot on weekend afternoons and evenings, online shops are busy from morning to 22:00, news sites peak at breakfast, and backups run at night. The load on a node is the sum of its workloads' curves. As long as that sum stays below the hardware, overcommitting is free money. When the peaks line up, it isn't: CPU contention slows every customer on the node, RAM pressure swaps and then kills workloads, and a full thin-provisioned disk pool stops writes. Mixing customer types on a cluster flattens the peak, and a cluster of nothing but game servers melts every Saturday night. The cluster view shows booked capacity next to the forecast peak for the coming week, and sale seasons, game launches and breaking news push the curves higher for a while.

**When a node fails.** In a high-availability cluster its workloads restart on other nodes within minutes. In a consumer cluster they stay down until the node is repaired. Disks and power supplies often warn before they die, which gives a careful player time to drain the node first.

**Automation.** Unlocks turn these chores into rules: drain a node automatically when it reports a hardware warning, rebalance every night, and restart workloads elsewhere when a node fails.

**Product catalog**

| Product | Runs on | Needs | Notes |
| --- | --- | --- | --- |
| Web hosting | Cluster | Control panel license |  |
| Domains |  | Reseller account, later your own registrar | Can be resold; needs DNS hosting |
| DNS hosting | Cluster | Two DNS workloads on different nodes | Tiny load, but if both go down every customer domain stops resolving |
| SSL certificates |  | Certificate reseller account | Can be resold; often bought with domains |
| Game servers | Cluster | A license per game | Gamers attract DDoS attacks |
| VPS | Cluster | Virtualization platform | Fixed size, monthly |
| Cloud servers | HA cluster | Cloud platform license | Hourly, within a quota; late game |
| VPN | Cluster |  | Uses a lot of bandwidth |
| Dedicated servers | Whole machines | Spare servers in racks | Individuals rent small machines, companies big ones |
| Storage hosting | Storage servers |  | Backups and file hosting; uses a lot of bandwidth |
| Object storage | Storage servers |  | Billed per TB stored and per TB downloaded |
| Managed databases | Cluster | Database license or open source | You run backups and updates; database tickets |
| Load balancers | Cluster |  | Sold with cloud servers; small load, many connections |
| Managed Kubernetes | Cluster | A Kubernetes engineer on staff | Each engineer looks after a limited number of customer clusters |
| CDN | Clusters in several cities | Presence in 3+ locations |  |
| Colocation | Your racks in a datacenter | Datacenter space | Customers rent a rack share or a full rack; you wire their uplinks |
| Add-ons |  | Unlocked per product | Backups, extra IPs, priority support, DDoS protection |

**Colocation.** Customers rent space in your racks: 1/8, 1/4 or 1/2 of a rack or a full rack, the same sizes the datacenters rent to you. A request names the size, the power it needs and its uplinks, such as 2 × 1G or 2 × 10G. You assign a rack with enough free units and power, and the game marks that section as the customer's and puts a patch panel at its top. The customer's hardware is a closed block that draws its power. Your job is to cable the panel's requested ports to your switches. The service is online once every requested uplink reaches the internet at its speed, and it counts against the rack's power limit like your own servers.

Worth adding later: email hosting and GPU compute.

**Software choices.** Some products need software bought on the market. Each choice offers four balanced options. The cheap ones are tempting early, but switching later means a migration with downtime and tickets.

| Control panel (web hosting) | Pricing model | Trade-off |
| --- | --- | --- |
| "cPanic" (cPanel) | Per hosted account, in tiers | Customers know it; gets expensive as you grow |
| "Pleskit" (Plesk) | Per server, by number of domains | Good value at mid size |
| "DirectAdmen" (DirectAdmin) | Per server, flat tiers | Cheap; fewer features, more tickets |
| "FreePanel" (open-source panels) | Free | No license fee; more admin work and tickets |

| Cloud platform (cloud servers) | Pricing model | Trade-off |
| --- | --- | --- |
| "OpenStash" (OpenStack) | Free | Every feature above; needs the most admin work until you have staff for it |
| "VMwhere" (VMware) | Per CPU core, yearly | Polished and few tickets; the license bill grows with every node |
| "Proxmocks" (Proxmox) | Free, optional support per socket | Easy to run; no quotas or self-service until the shop unlock |
| "HyperVee" (Hyper-V) | Per server, with an OS license | Business customers like it; Linux customers don't |

Game servers work the same way: each game has its own license terms (one-time, per server or per player slot) and its own demand.

**Storage, backups and data loss.** Workload disks live on their server's RAID array (see RAID), and later on distributed storage pools. If more drives fail before a rebuild finishes than the RAID level survives, or a drive fails without RAID, the data on them is gone. Every affected workload is marked "Lost disk", and the game opens an incident report that lists the lost disks, the affected volumes, workloads and customers, and the age of each one's last backup, so nothing has to be hunted down across apps.

Backups are on-site: backup rules per cluster set how often (hourly, daily, weekly) and how long to keep them, and they write to backup servers in the same zone, mostly at night. A lost disk with a backup can be restored, from the incident report or from the virtual machine manager, and only the data since that backup is gone. Without a backup the customer's data is lost for good.

Data loss hurts. Affected customers ask for a refund, and unhappy ones leave reviews. A refund calms them, but some still write a review: often a 3-star one, sometimes worse. Most customers never write a review at all.

**Virtual machine manager.** A desktop app for running workloads, branded after the virtualization platform you chose: its name and logo in the menu bar and window change with the platform (Proxmocks, VMwhere, OpenStash, HyperVee). It has the usual inventory tree of zone, cluster, host and VM. VMs can be started, stopped, restarted and migrated live or cold to a host you pick, and restored from a backup point. Hosts can be cordoned, drained or put into maintenance. Storage shows each server's RAID health, rebuild progress and rebuild rate, and later the distributed pools. The incidents tab lists open incident reports. It uses the same window design as every other app.

**Requests instead of price lists.** You don't publish plans. You decide what to build and offer, and customers come to you with requests, by email at first and later through your website's order form. Each customer picks a host by its size, its scores and hidden factors. Your job is choosing which requests to accept and at what price.

**Where requests come from.** At the start every request arrives as an email in the Sales app, and answering one takes a few minutes of your time like a ticket. There are few of them early on, and more as the company grows. Later the **shop** unlocks: customers order there themselves, and it accepts every request it can serve as long as the target cluster stays below a limit you set.

| Request | From | Example |
| --- | --- | --- |
| New customer | A lead that chose you | "A VPS with 4 vCPUs and 8 GB for our shop backend" |
| Expansion | An existing customer that grew | "Our news site needs twice the RAM" |
| Quota increase | A cloud customer | "Raise our quota to 64 vCPUs for the Black Friday sale" |

**The request card.** Every request shows:

- the customer's name and type, for example "Bloomfield Florist, sole proprietor";
- what they want, with resources, location and contract length;
- the SLA they ask for (uptime and response time);
- the monthly revenue, or the expected revenue for hourly cloud usage;
- their requirements with a check or a cross each;
- a bar per resource of the target cluster (CPU, RAM, storage, bandwidth) showing usage before and after. A bar is green below 70%, orange from 70% and red from 90%.

You accept or decline. A declined customer goes to a competitor. Requests you can't serve still arrive, greyed out with what's missing ("needs a location in London", "needs two carriers"), so you can see what demand you are leaving on the table. The Market app adds them up.

**Growth.** Every customer has a growth path with a ceiling. A blog stays about the same size forever, a news site grows to a few times its start, and a startup can grow fifty-fold or shut down. When a customer nears the size they rent, an expansion request follows.

**Cloud servers.** Cloud customers rent virtual machines by the hour and start and stop them as they like. Each cloud customer has a quota (vCPUs, RAM, storage), and their usage moves up and down within it. Raising the quota takes a request with a reason, which you approve, cut down or decline. Quotas can add up to more than the cluster holds, because customers rarely use all of it at once; if they do, their new machines fail to start and they get unhappy.

**Quoting a price.** Every request comes with a market reference: what this kind of customer expects to pay for this service in that year, adjusted for its SLA and features. When you answer, you quote your own monthly price, and the market reference stays next to the field so you can go slightly above or below it. The customer replies by email. Close to the reference, most accept. Well above it, they write that they don't have the budget and will look for another provider, and the deal is lost. A customer who says they can't make it is usually gone, though a lower counter-offer sometimes wins them back. Existing customers accept more for the same service, because switching is a hassle for them. When the shop unlocks, each product line also gets a list price for orders through the order form, again shown against the market reference.

**Changing prices.** You can raise the price of a running service. Customers rarely leave over a moderate increase, but every increase costs happiness for a few months, so it works best as an occasional step. Raise it too far above the market and they cancel.

**Agencies first.** Agencies host many small websites for their clients and grow with them. Winning an agency with a very good web hosting offer pays off later, when its clients need VPS and more. Marketing can target agencies directly, and a discount offered in a campaign is quoted back to you when the agency writes in.

**Billing.** Services are billed for every hour they run and invoiced once a month for the month that just ended. Hours a service is down are not billed, so an outage costs you its revenue. Business and Premium SLAs pay credits on top. Usage such as traffic over the included amount, object storage and CDN traffic is billed per TB on the same invoice. Domains and SSL certificates are the exception: they are paid a year in advance and renewed each year, and a customer who doesn't renew is gone.

**Commitment.** Each contract has a minimum term: none for cloud servers, one month for hosting and VPS, twelve months for dedicated servers and colocation. Customers only leave when their term runs out, unless a missed SLA lets them leave early.

**Features.** Each product line has features you switch on in its settings once the unlocks and the infrastructure allow them. Customers require some features and want others: a request whose required features are missing arrives greyed out, and every wanted feature you offer makes customers likelier to pick you and adds to the price.

| Feature | Needs |
| --- | --- |
| High availability | An HA cluster |
| Replicas | 2 or 3 replicas in the cluster settings |
| Spread across racks | Nodes in at least two racks |
| Spread across locations | The cluster stretched over two locations |
| Backups | A backup cluster or storage servers |
| DDoS protection | On-demand or always-on protection on the location |
| Private network | The private networks unlock |
| Two carriers | Uplinks from two carriers at the location |

| Customer | Requires | Wants |
| --- | --- | --- |
| Private individual |  | Backups |
| Gamer, small game server |  | DDoS protection |
| Gamer, game server of 8 GB or more | DDoS protection | A location in their country |
| Hobby developer |  | Private network |
| Sole proprietor |  | Backups |
| Small business | Backups | High availability |
| Agency or startup |  | Private network, replicas |
| Doctor's or law office | Backups, high availability | A location in their country |
| Online shop | High availability, backups | DDoS protection, replicas |
| Enterprise | High availability, replicas, spread across racks, private network | Two carriers, spread across locations, DDoS protection |

## Customers and market

Customers come from nine profiles on a 3×3 grid of budget and technical skill. Each profile weighs three scores on every host, and its budget sets how much it offers to pay. This borrows King of Retail's model, where every product has quality, fashion and luxury scores and customers sit on a wealth × fashion grid ([customer wiki](https://king-of-retail.fandom.com/wiki/Customers)).

**The three scores**

| Score | Raised by | Matters most to |
| --- | --- | --- |
| Performance | Hardware, resources, network capacity, latency | High technical skill |
| Reliability | HA clusters, uptime record, SLA, support response time | High budget |
| Convenience | Control panel, add-ons, one provider for everything | Low technical skill |

Low-budget customers offer the least and ask for the lowest SLA.

**The nine profiles**

| Budget \\ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual: a blog, family photos | Gamer: game server and a small site | Hobby developer: the cheapest VPS |
| Medium budget | Sole proprietor: a flower shop's website | Small business: site, email, domains | Agency or startup: VPS, many sites |
| High budget | Doctor's or law office: managed, must not fail | Online shop: HA hosting, SSL, backups | Enterprise: dedicated, cloud, colocation |

**Hidden profiles.** Behind each profile the game keeps: products wanted and how likely they are bought together, budget, request size, outage tolerance, ticket habits, and requirements on the host (see Company level and reputation).

| Profile | Usually buys together |
| --- | --- |
| Gamer | Game server, small website, domain; never enterprise support |
| Sole proprietor | Web hosting, domain, email |
| Online shop | Web hosting, SSL, backups, DDoS protection |
| Enterprise | Dedicated or cloud servers, SSL (with every domain), priority support |

**Cross-selling.** Unlockable boosts raise those odds, such as a free SSL certificate with every domain or a game server and website bundle. Each gives customers a bonus and you more sales per customer.

**Market research.** Requirements start hidden. The Market Research app reveals, per profile, budget ranges, which scores they weigh, and what they demand from a host. It also shows demand by product and city, and reports on lost sales, for example "chose another host: no domains on offer".

**Competitors.** A few big, established hosts with parody names dominate the market, such as a Hetzner stand-in, an IONOS stand-in and an OVH stand-in, alongside specialists: game server hosts, VPS-only budget hosts and managed WordPress hosts. Each has its own product line with prices, and each targets different segments, so a cheap VPS host competes for hobbyists and a game server host for gamers. They run passively in the background: the game doesn't simulate their customers one by one, only their offers and their share of each segment. They are a fixed backdrop and don't react to you, but the market is crowded and hard-fought. A customer first drops hosts that miss its requirements, then compares the remaining hosts on the three scores.

**Undercutting and awareness.** You can price just below a competitor's offer to win more of its segment, but customers don't switch overnight. How many people know your company limits how many consider you at all, and that awareness grows slowly through marketing, reviews and word of mouth. A price cut brings a gradual trickle of customers over months, not an instant wave, and a well-known competitor keeps most of its customers even when you are cheaper.

## Company level and reputation

Your company climbs a ladder of levels set by its net worth. Business customers only consider a host at a level they trust, so no enterprise moves its systems to a company running out of a garage.

**Net worth** combines three things: customers (recurring revenue), hardware you own, and years in operation.

| Level | Name | Typical setup | Who will buy |
| --- | --- | --- | --- |
| 1 | Basement Hoster | One rack in the basement | Friends, gamers, hobbyists |
| 2 | Garage Hero | A rack position in a datacenter | Private individuals, sole proprietors |
| 3 | Rack Renter | Several racks in datacenters | Small businesses |
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
| Suspension appeal | A high-budget customer's services are suspended | Unsuspend with a payment extension, keep suspended |
| Expansion request | Customer nears the size they rent | Opens the request in Sales |
| Cancellation | Unhappy or departing customer | Retention offer, process the cancellation |
| Colocation install | Colocation customer ships hardware | Book an install with a technician |
| Abuse report | Spam or attacks from a customer's server | Warn, suspend |
| Copyright notice | A rights holder reports a URL on a customer's domain | Forward to the customer, take the content down, reject |
| Legal request | A government agency asks for data or a takedown | Comply, object, ignore at your peril |

**Abuse and copyright notices.** Rights holders and complainers write in about URLs on your customers' domains. Studios such as Warner Bras. or Universal Pickchers send copyright notices, and a YouTuber demands you remove a site that called their video bad and links it. Some notices are real, some are fake, and some point to domains you don't even host. Each one names the URL, so you can check it against your customers before acting. Taking down content on a fake notice angers the customer; ignoring a real one invites the next, angrier letter.

**Legal requests.** Government agencies send requests through the inbox with a verified mark next to the sender, and each has a deadline. Answer in time and the matter closes. Miss the deadline and the agency seizes the physical server, with every disk in it. Customers on that server lose their data unless you have a backup on another system, and the server comes back after 3 months to 2 years. Agencies mostly come after malicious customers, so who you accept matters.

**Shady customers.** Now and then a sales request sounds off: high volume, no questions asked, and payment in crypto. You can accept it. The crypto arrives as ordinary money in your bank account, the customer pays well and on time, and abuse reports and legal requests follow.

**The cascade.** Customer happiness drops while tickets wait, and unhappy customers cancel or don't renew. Cancellations are tickets too, so a bad week snowballs into a flood. An outage creates tickets from every affected customer, weighted by segment: a flower shop writes once, an online shop three times.

**Automating support.** Support agents work through the queue at their own speed. Later, an AI support bot handles simple ticket types such as how-to and billing questions, and passes the rest to humans. A public status page (an unlock) cuts outage tickets.

## Billing, finance and insurance

Every contract is invoiced monthly for the hours it ran, domains and certificates yearly, and some customers don't pay. Chasing them is a manual job until bookkeepers and accountants take it over.

**Starting money.** A new game starts with €1,000 of savings, which buys almost nothing, so the first step is a loan from the bank. A level-1 company can borrow up to €10,000 from day one.

**Invoices and dunning.** Invoices go out automatically on the first of each month. Some customers pay late and a few never pay. When a dunning step is due, a button appears in the Billing app, and clicking it sends the notice (starting values, to tune):

1. **Payment reminder**, 7 days after the due date. Friendly, no fee.
2. **First dunning notice (Mahnung)**, after 14 days, with a fee.
3. **Final notice**, after 28 days. The customer's service is suspended, which creates tickets.
4. **Collections**, after 42 days. The debt goes to a collection agency for a fraction of its value, and the customer is gone.

Payment habits differ by segment. Private individuals forget most often, and enterprises pay slowly but always pay.

**Bookkeepers and accountants.** Bookkeepers record payments and send reminders. Accountants handle the later dunning steps, collections and month-end reports. Each works at their own rate, so a growing customer base needs a growing team.

**Finance app.** The account statement, and later profit and loss, cash flow, monthly recurring revenue, churn, revenue by product and segment, and costs by category, each as charts.

**Account statement.** The Finance app lists every booking on the company account: date, counterparty, description, category and amount, with the running balance. Filters narrow it by category (customer payments, hardware, rent, power, transit, salaries, loans, tax) and by month.

**Bank app.** The Bank app holds only loans. Your active loans appear as cards with the remaining balance, monthly instalment, instalments left and a Repay button. Below them, offers appear as a grid of cards in the style of the shop: you pick a term (1, 2, 3, 5 or 10 years), and each card shows a preset amount up to your limit, plus one for the whole remaining limit, with its interest rate, monthly instalment, total interest and a Take loan button. The rate and the limit depend on your company level and repayment history, and missed repayments add penalties.

**Insurance.** SLA insurance pays the credits you owe customers when you miss an SLA. It covers three claims; after the third, the insurer blocks you for a year. The premium rises with a poor uptime record.

**Suspension.** You can suspend a customer's services over an unpaid invoice. A suspended customer usually pays within days, because their site or server is down, but they open a ticket and lose happiness, and some leave instead. Nobody chases an invoice unless you or a rule do it, so a customer who stops paying keeps using the service for free until someone notices. The Billing app shows how much is owed by customers who are still being served.

**Suspension by customer.** Suspension hits customers differently. Low- and medium-budget customers grumble and pay, or leave per their payment habit. High-budget customers (offices, online shops and enterprises) run their business on the services, so going offline costs them twice the happiness and they pay much faster. Often they first write a suspension appeal: they forgot to pay, the manager who signs invoices is on vacation, nobody has access to the payment details, or the money is already on its way. The appeal ticket offers two actions. Unsuspend brings the services back online at once with a 7-day payment extension; most pay within it, and if the extension runs out unpaid, the suspend rule takes the services offline again, this time without a second appeal. Keep suspended leaves them offline and costs more happiness. A reply that says the services return once the payment arrives settles the appeals of customers who are paying anyway.

**Automation.** The Billing sidebar has an Automation entry that holds the billing rules, each set with a switch or a segmented control:

- **Send reminders**: the reminder, dunning and final notices go out on schedule.
- **Suspend services after**: Off, 7, 14 or 30 days overdue. Services come back as soon as the invoice is paid.
- **Send to collections after**: Off, 42, 60 or 90 days overdue, once the final notice has gone out. Off by default, so collections stays a manual step until you turn it on.

**Customers as a CRM.** The Customers app is the hub for everything about a customer: a searchable, filterable list, and for each customer an overview with lifetime spend, open balance, active services, invoices, tickets and their workloads. Every item links to the app that handles it (Billing, Support, the virtual machine manager).

## Staff and AI bots

Staff are named people with a skill level, a work rate and a salary. Juniors cost little and grow into experts; seniors are good from day one but cost far more, as on the real job market.

**Employees.** Each employee has a name, role, skill (0–100), work rate, salary and tenure. Work rate rises with skill. Skill grows with tenure, fastest in the first years. The salary is set by skill at hiring, and yearly raises stay small, so a junior who stays is the cheapest expert you can get. Once a year each employee asks for a raise, and refusing makes them more likely to leave and take their skill with them.

**Roles**

| Role | Takes over | Notes |
| --- | --- | --- |
| Support agent | Tickets |  |
| Technician | Installs, repairs, cabling, colocation installs | Works at one location; until hired, you are the technician |
| Network engineer | Port setup, routing, transit and peering contracts |  |
| Kubernetes engineer | Managed Kubernetes clusters | Needed to sell managed Kubernetes; each looks after a set number of customer clusters |
| Sales agent | Answering requests in the Sales app |  |
| Bookkeeper | Recording payments, payment reminders |  |
| Accountant | Dunning, collections, month-end reports |  |
| Marketing manager | Campaigns, review platforms, market research |  |

**Training.** A new employee knows nothing about your processes. Before they handle a ticket type or a task, they are trained on it, which takes time and money, and each skill is trained separately: an agent trained on billing questions still cannot handle abuse reports. Once an employee is fully trained, you can make them a trainer. A trainer does nothing but train others until nobody is left to train, then goes back to their normal work. Once you have staff, they handle the work across all of these areas, including abuse and legal requests.

**Hiring.** The Staff app lists candidates on the job market with their name, role, skill and salary ask. Job ads cost money, and better ads bring more candidates.

**Staff app.** The Team view lists each employee with role, skill, salary, assignment and a bar per task type that fills as training finishes. Selecting an employee opens their training plan, where you pick task types as cards, set the assignment (work queue, trainer or forums), answer a raise request or let them go. The Job market view shows candidates as cards grouped by role with a Hire button, and posts standard or premium job ads. The first roles in play are support agents, bookkeepers and accountants.

**AI bots.** Bots unlock late through research. They work fast and cost a monthly subscription instead of a salary. They never gain skill, handle only routine task types, and sometimes make mistakes that create follow-up work, such as a wrong ticket answer that angers a customer.

## Marketing and reviews

Marketing brings in new customers, and reviews decide how many of them trust you. You can run basic campaigns yourself; review platforms need a marketing manager.

**Your own channels.** Besides paid campaigns, the Marketing app manages the acquisition channels you own and grow step by step. You start with email only: customers find you through friends and write to your inbox, and every order is a conversation. Next you set up a basic website, which makes you findable and brings in a steady trickle of requests. The website then gets extended with an online order form, so customers can order standard products on their own and the order lands as a ready service instead of an email. With a website in place you can run Google ads (search ads below) that send visitors to it, and later AI ads, which target better and cost more. Each step is a one-off setup cost plus upkeep, and the website and order form are also where your prices and reviews show.

**Staff in the community.** Once you have employees, you can assign one to post in hosting and gaming forums. Helpful posts bring in customers slowly and cheaply, and the effect grows with the employee's skill. Bigger companies can send staff to trade fairs and industry meetups. Fairs bring business customers, and the people you meet there get you better transit prices and make networks more willing to peer with you.

**Campaigns.** In the Marketing app you pick a channel, the profiles to target and a monthly budget.

| Channel | Reaches | Notes |
| --- | --- | --- |
| Word of mouth | Friends, gamers | Free and slow; the only channel in the basement |
| Search ads ("Goggle Ads") | Anyone searching for hosting | Paid per click; needs a website |
| AI ads | Anyone, with better targeting | Unlocks late; costs more per click and converts better; needs a website |
| Gaming communities | Gamers | Sponsor a streamer or a server list |
| Trade fairs | Businesses, enterprises, carriers | Expensive; needs staff; only pays off at higher company levels; improves transit prices and peering acceptance |
| Forum posts | Hobbyists, gamers, small businesses | Needs an employee assigned; cheap and slow |
| Cold calling | Small shops, local businesses | Cheap to start but converts poorly; the cost per customer depends on who you call. Reaches businesses that never search for hosting |
| Agency outreach | Web agencies | Targets agencies with a discounted offer; they bring their clients' later VPS needs |
| Partner program | Agencies, small businesses | Commission per referred customer |

**Reviews.** Customers leave reviews after tickets, outages and cancellations. By default you can only read them. A marketing manager can sign you up to a review platform:

| Platform | Cost | Effect |
| --- | --- | --- |
| Free listing | Free | Collects reviews; small trust boost |
| "ProvenExpat" (ProvenExpert) | Moderate monthly fee | Review invites, a website badge; medium boost |
| "TrustPylon" (Trustpilot) | High monthly fee | Strong marketing tools; the biggest boost |

The review score feeds into your reputation and into the host requirements customers check.

**How the Marketing app works.** The app has four sections. Channels lists the owned steps as cards: email is always on, the website comes first, and the order form, Goggle Ads and AI ads each need the website. AI ads become available in 2023. Campaigns shows one card per paid channel (Goggle Ads, AI ads, gaming communities, cold calling, agency outreach) with the audiences it reaches as toggles and a monthly budget as a segmented control; agency outreach also offers a discount of 10%, 20% or 30%. A campaign's budget is billed at each month start, and so are website and order form upkeep and the review platform fee. Campaigns spread their budget evenly over the cities where you have a location. Awareness shows how well each audience knows you. Reviews shows the score, the latest reviews and the platforms, of which you use one at a time. Trade fairs, forum posts and the partner program come with the Staff app, and so does the marketing manager that review platforms will require.

## Network and DDoS

Each location connects to the internet through what its city offers: transit carriers, internet exchanges and, later, private peering. Bandwidth costs money, and your customers' traffic has to fit through your links.

**The map.** The Network app opens on Western Europe's big cities, such as Frankfurt, Amsterdam, London, Paris, Berlin, Vienna, Zurich and Milan. The rest of the world stays zoomed out and only matters as distant transit destinations. The map itself covers the whole world, with coastlines, cities and the submarine cables from Series of Tubes (MIT). Only the European cities hold datacenters for now, and the cables are drawn without gameplay, so both can grow later. The Locations overview and the Add location dialog use the same map. Each city has its own carriers and prices, internet exchanges, datacenter operators, power price and demand.

**Ways to connect**

| Option | How it works | Cost | When |
| --- | --- | --- | --- |
| Home line | A consumer line in the basement, from DSL in 2005 to fiber later; upload stays slow until business fiber | Free on the starting DSL line, then a flat monthly fee per line | Start |
| Datacenter bandwidth | The datacenter's own transit, through its handoff | Per TB or per Mbps | Early |
| IP transit | A port with a carrier present in the city | Billed at the 95th percentile, with a minimum commit | Mid game |
| Exchange peering | A port at an internet exchange, then sessions with other networks | Port fee; the traffic itself is free | Mid game; needs your own network number (ASN) |
| Private peering | A direct cable to one big network | Cross-connect fee; weeks of lead time | Late game |
| Links between locations | Leased wavelengths or dark fiber | Monthly fee | Several locations |

**Uplinks.** A location can have as many uplinks as its routers have ports. Each uplink is a contract with one carrier or exchange and has one or more links. Every link uses one router port, and its speed is limited by that port and by what the carrier sells that year, from 1G in 2005 to 400G in the 2020s. A small router has a few 1G ports, and bigger ones have 10G, 100G and 400G ports, so faster or more links mean a better router. Two links on two routers keep the uplink up when one router fails, and a second carrier keeps you online when the first has an outage.

**Joining an exchange.** You apply for membership at the exchange, which needs your own network number (ASN) and costs a setup fee plus a yearly fee. Then you order ports: one, two or more, each at a speed your routers support. The exchange delivers each port as a cross-connect to your patch panel after a lead time. Connecting to the exchange's route servers gives you sessions with every network that peers openly, and other networks need their own session. Exchanges such as DE-KICKS also offer ports in other cities, so one membership can cover several locations.

**Peering requests.** Once you are a member of an exchange, other members ask to peer with you, and each request arrives in your inbox. It shows the network's name, its PeeringDB-style facts (how many routes and prefixes it announces, its traffic level, its peering policy and which exchanges it is on) and what it expects in return. Small networks with a handful of routes save you little transit but cost a session to maintain; large ones move real traffic off your paid transit. You accept or reject each request. Big eyeball networks rarely ask and are hard to win over; small hosters and hobby networks ask often. As you grow, more and bigger networks ask, and your own requests to them are accepted more often.

**Topology view.** A second view of the same data draws the network as a tree from left to right: carriers and exchanges, uplinks, routers, switches and the servers on each switch. Every line shows its speed and is coloured by load with the same thresholds as the request bars. Clicking anything opens it in the inspector, and switches with many servers collapse into a count until you expand them.

**Uplinks in the Network app.** A location's page lists its uplinks as cards, one per carrier or exchange, with the type, every link with its speed and router port, the 95th percentile against the commit, and the monthly cost.

**Private networks.** Customers with several workloads, such as agencies, shops and enterprises, ask for a private network between them. A private network is a VLAN on your switches: workloads in it reach each other only if every node they run on has a switch port that carries the VLAN. A port to a node can carry all customer networks with one toggle, which is the easy setting. Enterprise customers require a private network, and other customers buy one as an add-on. One switch domain holds up to 4,094 VLANs; overlay networks (an unlock) lift that limit and stretch a private network across racks and locations.

**Every zone has its own network.** Carriers, transit, exchange ports, private peering and the gateway belong to one availability zone, just like racks and storage. A new zone starts with only what its datacenter offers. The one thing that ties zones together is a link you book between them, leased capacity or dark fiber. Over that link a zone can send traffic out through another zone's better transit and peering, so one well-connected site can carry a weaker one, at the cost of the link and the latency. The same link carries migrations between zones, and how long they take depends on the bandwidth left over. Without a link, zones share nothing.

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

**Skills.** Pear Store apps and upgrades are gated by skills the company learns in the Research app, such as Monitoring, Employee management or Market research. Research shows them as a tree in tier columns from left to right, with lines from each skill to the skills it builds on. A skill is learned (filled), in training (with a progress bar and the days left), ready to start, or locked with the skills it still needs. Selecting a skill opens a side panel with its description, cost, training time, prerequisites, what it leads to and what it makes available in the Pear Store.

Starting a training needs every prerequisite learned and enough know-how, which is paid up front. One training runs at a time, and the skill is learned when its training time has passed. The company then gets a notification and a short click-through sheet in the style of the introduction that explains the new feature and points to the Pear Store; the skill's panel reopens it under How it works. The sheet text lives in docs/design/research.md. Costs, durations and the tree are in economy.md under "Know-how and unlock costs".

**Starting kit:** a 24U rack in the basement with one compute server and a small switch, a reseller account for domains, and web hosting, game servers and VPS on your own hardware.

| Branch | Unlock path, in order |
| --- | --- |
| Products | SSL certificates → email → dedicated servers → storage hosting → VPN → CDN → cloud servers → colocation |
| Infrastructure | Rack share → datacenter positions → second location → cage → private suite → own datacenter; HA clusters; rack templates; auto-cable |
| Network | Transit contracts → internet exchange peering → own network number (ASN) → always-on DDoS protection |
| Business | First hire → status page → market research → cross-selling boosts → review platforms → insurance → AI bots |
| Independence | Domain registrar, own control panel and other in-house replacements for bought-in services |

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

The MVP has the basement rack, one datacenter location, web hosting and VPS, support and billing done by hand, and the first hires. That's the smallest version where you can feel the automation loop. Each milestone ends in something playable.

1. **Desktop shell.** Menu bar, dock, draggable windows, notifications, time controls, saving in the browser. Done when apps open and the clock runs.
2. **Locations and racks.** The basement rack, adding a datacenter location from the catalog, buying and moving racks, the rack front view, buying servers and switches with their specs, cabling ports in the inspector, bonding a server's ports. Done when a rack moved from the basement to a datacenter comes back online there.
3. **Clusters and products.** One cluster, web hosting and VPS on your own hardware, colocation in rack sections with uplinks to wire, workloads placed by the scheduler, cordoning and draining a node, the virtual machine manager with storage pools, control planes, the server view with workloads and utilization, the Sales app with request cards and resource bars. Done when an accepted request runs as a VM that survives a drain.
4. **Customers and support.** Customer profiles, purchases, tickets with templates and actions, happiness and churn, disk failures with data loss, backups and restores, incident reports, refunds and reviews, abuse and copyright notices, legal requests with server seizure, shady crypto customers. Done when an outage floods the inbox.
5. **Billing and finance.** Invoices, dunning buttons, collections, profit and loss, a bank loan. Done when an unpaid invoice can go all the way to collections.
6. **First hires.** The job market, a support agent and a bookkeeper working through their queues, training per skill, trainers. Done when a hire visibly empties a queue.

**After the MVP:** more location tiers, the Network app with several carriers, exchange memberships and multi-link uplinks, private networks for customers, automatic rebalancing and evacuation, more products, marketing and reviews, the research tree, company levels, competitors, DDoS, AI bots.

## Open questions

- [x] Room layout: predefined slots (as written here) or free placement? -> Predefined Slots
- [x] Research: know-how points plus money (as proposed), or money only? -> as propsoed
- [x] Should the player have limited working hours per day? That would make hiring feel necessary instead of optional. -> no, they can also pause the game if they feel like pausing it, they could technically run it alone if they wanted to.
- [x] Start in the present day, or in the past (around 2005) with technology advancing over time? past and yes technology would advance but dont make too much variety between servers we want to keep it on resources on the servers mainly, so bigger ram etc. unlocks over time, oh energy costs are also athing depending on what the lcoation charges per energy (own datacetners can have custom contracts with energy providers) it should move users to replace old servers with new ones to be more energy erficinet
- [x] Do competitors expand and react to you, or are they a static backdrop? they are a static backdrop, there should be like some other bigger providers, and its a really hard and fought overm arket
- [x] Parody names: puns on the real name ("TrustPylon") or fully invented names? puns on real names
- [x] Which open-source license (MIT, GPL)? MIT
- [x] Which events auto-pause the game? nothing
- [ ] Do hardware brands differ in price and failure rate, or only in look?
- [x] Without price lists, should the player still have one lever on price, such as a premium or discount per product that changes which requests arrive? Yes: you quote a price on every request against a market reference, set list prices for the order form, and can raise prices of running services (see Quoting a price).

Ideally at the start they are enthised to either rent a server from a company to get resources to place on, we always have servers as "clusters" so they can be assigned to different products/workloads, so they can fully rent out a server from a existing bigger provider at the start.&#32;
