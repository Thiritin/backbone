# Properties

Offices are rented or bought by the section, about 40 square metres each. The numbers live in `src/sim/20-world/properties.ts`; the design is in [Properties](../gdd/properties.md).

**Rent.** Rent per section per month for a building of factor 1, by the first year it applies. Each building multiplies it by its own factor (0.8 to 1.2). The rent of a section is fixed on the day it is rented.

| From | 2005 | 2010 | 2015 | 2020 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Rent per section | €600 | €650 | €750 | €900 | €1,000 |

**Deposit and notice.** Renting a section bills a deposit of three months' rent at once; the rent itself is billed with the other rent at each month start. Notice is three months to the end of a month: the last rent is billed at the third month start after the notice, and the deposit comes back at the fourth. A server room still holding racks rolls the lease one more month.

**Buying.** Buy prices are set in 2005 euros per building and follow the rent curve. Buying takes over every section other tenants do not hold, stops the rent and returns any deposit. From then on each section costs €150 a month in upkeep.

| Building | Sections | Rent factor | Buy price (2005) | Listed from |
| --- | --- | --- | --- | --- |
| Zeilwerk | 4 floors × 3 | 1.2 | Not for sale | 2005 |
| Mainblick Offices | 3 floors × 2 | 1.0 | Not for sale | 2005 |
| Gallushof | 2 floors × 2 | 0.8 | €380,000 | 2005 |
| Ostend-Kontor | 3 floors × 3 | 0.9 | €820,000 | 2005 |
| Bockenheimer Bogen | 5 floors × 4 | 1.1 | Not for sale | 2012 |
| Halle Fechenheim | 1 floor × 1 | Not for rent | €2,400,000 | 2012 |

Other tenants hold a share of each building's sections (25 to 70%), fixed by the game's seed.

**Refits.** A rented section comes fitted with four desks. A refit closes the section until it is done.

| Fit | Cost | Days | Holds |
| --- | --- | --- | --- |
| Desks | €3,000 | 5 | 4 desks |
| Server room | €12,000 | 14 | 4 rack positions |
| Server closet | €4,000 | 3 | 4 desks and 1 rack position on 2 kW |
| Hall | €90,000 per floor | 45 | 20 rack positions per floor, 60 in a Halle |

**Office lines.** A business line into an office server room or closet, billed monthly at the price of the year it is booked.

| From | 2005 | 2010 | 2015 | 2020 | 2025 |
| --- | --- | --- | --- | --- | --- |
| Line | SDSL 2 Mbit/s | SDSL 20 Mbit/s | Fiber 100 Mbit/s | Fiber 1 Gbit/s | Fiber 10 Gbit/s |
| Per month | €120 | €150 | €200 | €300 | €450 |

**Own hall.** The design is in [Own datacenter](../gdd/own-datacenter.md). Racks are bought per position as everywhere and stand on any free tile. A rack position takes up to 6 kW. Items are placed in the hall or its annex rooms, each bought once at the price shown, billed monthly where a monthly cost is shown, and refunded at half the price paid when removed; an item the refit placed refunds nothing. Over the limit of the placed transformers the main breaker trips as in every room, and only the player resets it.

| Item | Where | Size | One-time | Monthly | Does |
| --- | --- | --- | --- | --- | --- |
| Cooling unit | Hall | 2 × 1 | €18,000 | €150 | 40 kW of cooling |
| Vent | Hall | 1 × 1 | €400 | none | Floor vent |
| Containment | Hall, from 2008 | 1 × 1 | €1,500 | none | Frame over a tile |
| Transformer | Transformer room | 1 × 2 (Halle 2 × 2) | €80,000 | €400 | 100 kW of limit (Halle 300 kW), two per hall floor, one per floor free from the refit |
| Switchgear B | Transformer room | 1 × 2 | €25,000 | €200 | Opens feed B on every rack; one per hall |
| Generator | Transformer room | 2 × 2 | €60,000 | €500 | Carries 300 kW in a grid outage |
| UPS | Battery room | 1 × 2 | €40,000 | €300 | Carries 150 kW from the batteries |
| Battery cabinet | Battery room | 1 × 2 | €8,000 | none | Stores 50 kWh |
| NOC desk | Hall or NOC room | 2 × 1 | €3,000 | none | Two seats, one placed free by the refit |
| Wall screen | NOC room | 2 wide | €6,000 | none | At most four |

The NOC room costs €30,000 once and is built instantly below the hall. A cage fence costs €2,000 per position and the meet-me fence €5,000; both refund half.

| Item | One-time | Monthly | What it does |
| --- | --- | --- | --- |
| Cooling unit | €18,000 | €150 | Cools the 8 nearest positions (40 kW); one fits per two-tile slot on the far wall and the right wall; removing one refunds 50%, moving one is free |
| Extra transformer | €80,000 | €400 | Adds 100 kW (300 kW in a Halle); one per hall floor, bought in the transformer room; half the kW while it has no maintenance access (`HALL.service.derate`) |
| Feed B | €25,000 | €200 | Opens a second feed on every rack in the hall |
| UPS | €40,000 | €300 | Bridges a grid outage for minutes |
| Generator | €60,000 | €500 | Carries a grid outage with the UPS; needs the UPS |
| Carrier build-in | €15,000 per carrier | None | Needs the meet-me zone; the carrier's transit then books as at a colocation site, onto a fiber patch panel in that zone |

**Moving.** A rack with devices that is moved, alone or with its row, is dark for 2 hours (`HALL.moveHours`) and costs nothing.

**Colocation customers.** Spare positions are listed at a monthly price per position the player sets. The city's going rate is the average list price of a position at its datacenters. At the going rate a spare position finds a customer in a month with a chance of 50%, falling to none at twice the going rate and rising to 75% at half of it; one customer signs per month at most. A listed hall gets `1 + floor(free / 10)` signing chances a month, counting free positions in colocation zones only; positions outside zones are never sold. Each customer pays the price agreed at signing every month start and leaves in a month with a chance of 4%, or 25% in a month the breaker tripped (`HALL.colo.leavesAfterOutage`). Each customer draws 2 to 5 kW per position (`HALL.colo.kw`, seeded at signing).

**Zones.** Open colocation zones are free. A cage zone (from 2015, 2 to 8 positions) costs €2,000 per position; the meet-me zone (one per hall, 1 to 4 positions) costs €5,000; removing either refunds 50% (`HALL.zones`). An empty cage signs a customer each month with chance 50% (`HALL.colo.signs`) who pays `length × rate × 1.1` (`HALL.colo.cageMarkup`).

**Cross-connects and the hub.** Each month a customer orders a cross-connect with chance 15%, up to 3, paying €150 a month (`HALL.xconnect`). At 8 customers a free city carrier builds in with chance 30% a month; with 3 carriers and 12 customers the city's exchange takes the first free meet-me position (`HALL.hub`).

**Power price.** An own hall buys power at the business price times `HALL.powerFactor` 1.0 times the hall's PUE, below the household factor 1.6.

**Airflow** (`HALL.air`). Efficiency = 0.7 + 0.2 fed + 0.1 contained - 0.2 recirculating (kW-weighted shares of rack spots), clamped to 0.5 to 1.0; a fed intake has a vent within 12 tiles of a cooling unit. Effective cooling = 40 kW per unit times efficiency; PUE = 1.2 + 0.5 (1 - efficiency), so room cooling alone is 1.35, vents 1.25 and vents with containment 1.2. Inlet delta per rack: room cooling +4 +1 per kW above 4; vent-fed +1 per kW above its share of 12 kW (16 contained); +6 recirculation, +3 blocked exhaust, -2 contained, never below -2; 6 or more is hot.

**Grid outage.** At load L the batteries bridge min(50 kWh x batteries / L x 60, 240) minutes when the UPS units (150 kW each) total at least L, else nothing. Generators (300 kW each) totalling at least L carry the hall after a bridge of at least 1 minute.
