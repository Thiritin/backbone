# Clock and pacing

At 1×, the game clock runs 60 times faster than real time: one game minute lasts 1 second, one game hour 1 minute, and a game day 24 minutes. The simulation ticks every game hour; between ticks the clock steps game minutes, and queued hand work (a reply, an order step, a domain move) lands at the minute it is done rather than at the next full hour. A server boots in 3 game minutes and a domain registers in 2. Billing, salaries, know-how and the market run on the monthly tick.

| Speed | Game hour | Game day | Game month | Game year |
| --- | --- | --- | --- | --- |
| 1× | 60 s | 24 min | 12 h | 146 h |
| 8× | 7.5 s | 3 min | 1.5 h | 18.3 h |
| 60× | 1 s | 24 s | 12 min | 2.4 h |
| Skip (720×) | 0.08 s | 2 s | 1 min | 12 min |

Skip runs at 12 game hours a second until the simulation produces any event, then drops back to 1×.

**Pacing targets.** A player who plays reasonably well should hit each level around these years. The headless balance run checks them (see [Balancing](balancing.md)).

| Level | Reached in | Game year | Customers | Monthly recurring revenue |
| --- | --- | --- | --- | --- |
| 2 Garage Hero | End of year 1 | 2005 | ~40 | ~€400 |
| 3 Rack Renter | Years 2–3 | 2007 | ~400 | ~€5,000 |
| 4 Cage Fighter | Year 5 | 2010 | ~2,000 | ~€30,000 |
| 5 Room Service | Years 8–9 | 2013 | ~10,000 | ~€200,000 |
| 6 Datacenter Baron | Years 12–14 | 2017–2019 | ~40,000 | ~€1,000,000 |

Level 6 lands before the cloud and GPU boom, so the late game still has new products to chase. Playing mostly at 60×, level 6 takes about 3 hours of real time.

**Hand work takes game time.** Every hands-on action by the player is a work order in every location type, the basement included: a mount is 30 game minutes (30 seconds at 1x) plus a short walk, cabling 15 and parts 60. A first hour of buying, mounting and cabling therefore costs about two game hours of waiting at 1x, which the clock can be sped up through.
