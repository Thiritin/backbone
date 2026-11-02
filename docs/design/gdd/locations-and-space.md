# Locations and space

Infrastructure lives in locations: your basement first, then space in other companies' datacenters, and in the end your own. You always own your racks and everything in them. A location gives you floor space, power, cooling and connectivity, and where you go decides a lot of what you can offer: which carriers and exchanges you reach, how well outages are covered, and which customers trust you.

**Regions and availability zones.** The game follows OpenStack: each location is an availability zone (AZ), and its city is the region. Frankfurt is region "fra"; the basement is its first zone fra1, and a rack share at Equinox FR5 becomes fra2. Everything with a place belongs to exactly one zone: racks, storage, clusters and every workload a customer books. A customer books a VM, a web space or a rack section in one specific zone, and gets redundancy by booking in two zones of the same region. Zones in one region are linked cheaply and with low latency; regions are far apart.

**Limited space.** Datacenter space is scarce. Every datacenter has a fixed floor that grows only in occasional expansion phases, and competitors rent most of it. You can rent only what is free at the moment. Space frees up when competitors cancel, at random, or when the building expands, and a waitlist tells you when what you need is available. Sooner or later every building is full, so growth means spreading across datacenters or building your own.

**Space**

| Space | What you get | Size | Billed |
| --- | --- | --- | --- |
| Basement | Room for one 24U rack and a home internet line | 1 position | Free; power at the household price |
| Rack | Part of a rack the provider owns and installs, with its own lockable section and power share | 1/8, 1/4, 1/2 or a full rack | Per share per month, power per kWh |
| Cage | A fenced, locked area in the hall | 4, 8 or 16 positions | Per cage; cheaper per position than full racks |
| Private suite | A room of your own in the provider's building | 20 or 40 positions | Lease per month; you add your own UPS and feeds |
| Own datacenter | A building you lease or build | 100 positions and up | Lease or purchase; power room, generators and carrier room are yours |

**Extra power on a share.** A rack share is the provider's rack and has no feeds to add. Its Upgrades card offers extra power instead, in steps of 0.25 kW up to the share's base limit again, so at most twice the limit. A step is billed monthly with the share's rent and takes effect three days after booking. A rack over its limit still trips, and racks in your own cage or suite keep the feed B and high-density feed upgrades.

**Flat-rate power.** Each datacenter bills the power of an own rack in a cage or suite one way: metered per kWh, as a flat-rate contract, or either at your choice. Hetzler offers flat rate at all three sites (Hetzler NBG sells nothing else), and so do the small budget rooms (Docklands Data, Spree Colo, Next Lair VIE, SkyBlink Eygelshoven, Arubaba Hub, CoreSpite VA1 and CH1); the carrier hotels and the other large sites bill metered only. A contract is two feeds of 10 A (4.4 kW) or two of 16 A (7 kW) at a fixed monthly price. The rack's limit becomes the contract's kW, the breaker trips above it as on any rack, and the rack's draw leaves the power bill. The Power contract choice on the rack card switches between metered and the two contracts, and a change takes effect after three days. A rack bought at a flat-only site starts on 2 × 10 A, and a rack moved to another location takes the default of its new site. Shares stay metered and keep their extra power.

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
| Remote hands | Price per hour and response time | Repairs and mounting without your own technician on site |
| Certification | Certified or not | Offices and enterprises require it |
| Lead time and term | Days until ready, months of commitment | How fast you can expand and how long you are bound |

**Provider logos.** Every datacenter provider has its own parody logo, drawn in code: an original mark and wordmark that hint at the real company through its name and colour without copying its logo. The basement shows a house icon.

**Location view.** The Locations app opens on an overview: a map with a pin per location and a card for each with its space, power protection, uplinks and how full it is. A switcher at the top jumps between locations, and a plus button opens the Add location dialog. Inside a location you see its floor: the positions with your racks in them, the free positions, and the carrier panel where uplinks and cross-connects arrive. Clicking a rack opens its front view; device fronts are drawn only there.

**Energy.** Every location bills the power your hardware draws at its own price per kWh. Your own datacenter can sign a custom contract with an energy provider.

**Power protection.** The grid fails now and then, and how much of that reaches your customers depends on the location.

| Location | Protection |
| --- | --- |
| Basement | None: every grid outage takes the servers down. A UPS from the shop (Eatin, from a 1U 1,500 VA unit to a 6U 10 kVA one) rides through outages until its battery runs out. |
| Datacenter | Whatever the site has: feeds, UPS and generator differ by datacenter |
| Private suite or own datacenter | Whatever you build: UPS, batteries, generators and two utility feeds |

A second feed only helps servers that have two power supplies, one on each feed. Dual-PSU servers cost more, so the player decides per server whether the protection is worth it. Customers who care about uptime pay for it: HA products can require dual feeds, or servers spread over two locations.

**Own datacenter rooms.** A private suite or own datacenter adds rooms beyond the server floor:

| Room | Holds | First available |
| --- | --- | --- |
| Power room | UPS, batteries, generators | Private suite |
| Cooling | Air handlers, later liquid cooling | Own datacenter |
| Carrier room | Hand-offs to carriers and internet exchanges | Own datacenter |
