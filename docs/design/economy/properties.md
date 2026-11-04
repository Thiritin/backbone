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

**Own hall.** The design is in [Own datacenter](../gdd/own-datacenter.md). Rows are free; racks are bought per position as everywhere. A rack position takes up to 6 kW. Each hall floor has a transformer of 100 kW, 300 kW in a Halle; above it the main breaker trips as in every room, and only the player resets it.

| Item | One-time | Monthly | What it does |
| --- | --- | --- | --- |
| Cooling unit | €18,000 | €150 | Cools the 8 nearest positions (40 kW); one fits per two-tile slot on the far wall and the right wall; removing one refunds 50%, moving one is free |
| Extra transformer | €80,000 | €400 | Adds 100 kW (300 kW in a Halle); one per hall floor, bought in the transformer room |
| Feed B | €25,000 | €200 | Opens a second feed on every rack in the hall |
| UPS | €40,000 | €300 | Bridges a grid outage for minutes |
| Generator | €60,000 | €500 | Carries a grid outage with the UPS; needs the UPS |
| Carrier build-in | €15,000 per carrier | None | The carrier's transit then books as at a colocation site, onto a fiber patch panel the player mounts |

**Moving.** A rack with devices that is moved, alone or with its row, is dark for 2 hours (`HALL.moveHours`) and costs nothing.

**Colocation customers.** Spare positions are listed at a monthly price per position the player sets. The city's going rate is the average list price of a position at its datacenters. At the going rate a spare position finds a customer in a month with a chance of 50%, falling to none at twice the going rate and rising to 75% at half of it; one customer signs per month at most. Each customer pays the price agreed at signing every month start and leaves in a month with a chance of 4%.
