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

Other tenants hold a share of each building's sections (25 to 70%), fixed by the game's seed.

**Refits.** A rented section comes fitted with four desks. A refit closes the section until it is done.

| Fit | Cost | Days | Holds |
| --- | --- | --- | --- |
| Desks | €3,000 | 5 | 4 desks |
| Server room | €12,000 | 14 | 4 rack positions |
