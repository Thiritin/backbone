# Datacenters and space

**Racks.** Racks keep their price over the years: 24U €350, 42U €800, 47U €1,000. The basement only fits a 24U rack.

**Space.** Prices are 2026 values and keep their price over the years (m = 1). Power is billed per kWh drawn: the business price × the datacenter's power factor, which covers its cooling. A rack that draws more than its position's kW limit trips its breaker and goes offline.

| Space | Price | Lead time | Minimum term | Needs |
| --- | --- | --- | --- | --- |
| Rack, 1/8 (5U) / 1/4 (10U) / 1/2 (21U) / full (42U) | 0.2× / 0.35× / 0.6× / 1.1× the position price | 2 days | 1 month | Nothing |
| Cage, 4 / 8 / 16 positions | 3.4× / 6.4× / 12× the position price | 30 days | 12 months | Cage unlock; datacenters with cages |
| Private suite, 20 / 40 positions | 15× / 28× the position price | 90 days | 36 months | Private suite unlock |
| Own datacenter | Set when it is designed | | | Own datacenter unlock |

**Rack shares.** The smallest space is a 1/8 share of the provider's rack (5U). Any datacenter with free room rents shares and positions from the first day. A share comes with the provider's rack, you mount hardware into it directly, and its sizes are 5U, 10U, 21U and 42U (a full rack). The price is the multiplier above times the datacenter's position price:

| Datacenter (position price) | 1/8 | 1/4 | 1/2 | Full |
| --- | --- | --- | --- | --- |
| Hetzler FSN, Falkenstein (€160), the cheapest | €32 | €56 | €96 | €176 |
| Hetzler Park, Frankfurt (€180), the cheapest in the home city | €36 | €63 | €108 | €198 |
| mainqubes FRA, Frankfurt (€450) | €90 | €158 | €270 | €495 |
| Equinox FR5, Frankfurt (€750) | €150 | €263 | €450 | €825 |

**Extra power on a share.** A provided share cannot take feed B or a high-density feed. It can book extra power in steps of 0.25 kW, up to the share's base limit again (the datacenter's kW per position divided by the share size, so a limit of at most twice the base). A step costs 15% of the position price times the datacenter's power factor per month, so a full extra kW costs about 60% of a position. It is billed with the share's rent under the same ledger line, and a booking or a reduction takes effect after 3 days. A rack over its limit still trips. Anchor: colocation power sold per amp at roughly €30 to 60 per 0.5 A step in 2010s Frankfurt. At Hetzler Park (€180, factor 1.1) a step costs €30 a month; at mainqubes FRA (€450, factor 1.3) it costs €88.

**Flat-rate power.** An own rack in a cage or suite at a datacenter that offers it can take a contract of 2 × 10 A (4.4 kW) or 2 × 16 A (7 kW) instead of metered power. The monthly price is the metered cost of drawing 60% of the contract: kW × 0.6 × 730 hours × the business power price × the datacenter's power factor, at each month's power price. It pays when the rack averages above 60% of its limit and costs more below, and because the price scales with the limit the late game stays even. The contract's kW replaces the position's limit, including a high-density feed, and is billed as its own line with the rent. At Hetzler (factor 1.1) 2 × 10 A costs €191 a month in 2005, €254 in 2010 and €382 in 2020; 2 × 16 A costs €304, €405 and €607. Anchor: German colocation racks sold per amp with a fixed monthly price, 2 × 10 A or 2 × 16 A at 230 V per rack in the 2000s and 2010s.

| Datacenter | Power |
| --- | --- |
| Hetzler Park, Hetzler FSN | Metered or flat |
| Hetzler NBG | Flat only |
| Docklands Data, Spree Colo, Next Lair VIE, SkyBlink Eygelshoven, Arubaba Hub, CoreSpite VA1, CoreSpite CH1 | Metered or flat |
| Every other datacenter | Metered only |

**Availability.** Datacenters are not endless. Each one has a floor capacity in positions that grows in expansion phases over the years up to a final size, and most of it is rented by competitors you never see. You can only rent what is free right now.

| Datacenter size | Positions at opening | Expansion | Final size |
| --- | --- | --- | --- |
| Large (Equinox, Interaction, Global Snitch, Tellyhouse, Data5, Digital Reality) | 300 | +150 every 3 years | 1,200 |
| Medium (Hetzler, Iron Molehill, NTD, Next Lair, Arubaba Hub, Boris Network, CoreSpite, Telex) | 120 | +60 every 4 years | 400 |
| Small (mainqubes, Spree Colo, Docklands Data, Green.chz, SkyBlink) | 40 | +20 every 5 years | 120 |

- **Competitors.** Their share of a datacenter starts at 85% to 97% of capacity, drawn from the seed. Each month every competitor position cancels with a 1.5% chance. Waitlist holds are then granted from the freed space, and competitors fill the remaining free space down to a level drawn evenly between 0% and 4% of capacity. They never take space held for the waitlist.
- **Expansion.** Each expansion phase opens all its new positions on 1 January. In January, February and March competitors take a sixth of the new positions each month, so about half within 3 months, and from April the usual monthly fill applies.
- **What can be rented.** Cages and suites need that many free positions, which for a suite usually means right after an expansion. Rack shares come from the provider's share racks: one position holds 8 eighths.
- **Waitlist.** When a datacenter has too little free space for what you want, you can join its waitlist. When enough space frees up, you get a notification, and the space is held for you for 7 days.
- **Consequence.** You can't grow in one building forever, which pushes you to spread over several datacenters or build your own.

**Moving a rack.** €300 and 1 day within a city, €1,200 and 3 days to another city, €4,000 and 10 days across the Atlantic (air freight and customs). The rack's servers are offline until it arrives. A rack share comes with the provider's rack, so its power limit is the share × the datacenter's kW per position, and it can't be moved or sold. You mount hardware into it directly.

**Catalog.** Two to four datacenters per city; the datacenter towns Kerkrade and Falkenstein have one each. Exchanges new to this table: Franz-IX (Paris), BeCIX (Berlin), MIXup (Milan), VieX (Vienna), SwizzIX (Zurich), ECKS-IX (Düsseldorf), N-ICKS (Nuremberg), IN-EXCESS (Munich), Equinox IX (Ashburn), NYIKES (New York), CHI-KICKS (Chicago), Y'ALL-IX (Dallas), Any3 (Los Angeles).

How the newer locations are priced:

- **Düsseldorf** is Germany's second hub after Frankfurt, with fewer carriers and lower land and power costs, so its positions cost about 13% less than the Frankfurt equivalent (Equinox DU1 €650 against FR5 €750). myLoch DUS is the local hoster with its own halls: the cheapest space in town at €380, slower remote hands, and power billed either way.
- **Kerkrade (SkyBlink Eygelshoven)** is the small independent by the German border that hosters pick for cheap space with many carriers: €300 a position, 20 carriers, €60 cross-connects and fast remote hands, but no exchange on site and no cages.
- **Nuremberg and Falkenstein** are the budget hoster parks. Hetzler's own halls are the cheapest space in the game (€170 and €160) with one carrier, the provider's own network; Boris Network NBG is the carrier-neutral alternative with N-ICKS on site.
- **Munich** prices sit between Frankfurt and Berlin.
- **North America** prices are 2026 US retail converted at about €0.90 to the dollar. Space costs about the same as in Germany, but power is much cheaper, so the power factors are lower (1.05 to 1.2, against 1.3 to 1.5 in Europe). New York and Los Angeles carry a metro premium. Ashburn has the most carriers in the game (60 at Equinox DC2), and Dallas is the cheapest American market.
- Aisles says whether the halls run hot and cold aisles, with rack rows facing each other; large and certified sites do, budget sites do not.
- Datacenters have no opening years yet; every one is open from 2005, which matches the real buildings closely enough for the American and German hubs.

| Datacenter | City | Carriers | Exchange | Feeds | Backup | Green | kW per position | Position per month | Power factor | Cross-connect | Remote hands | Certified | Cages | Aisles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Equinox FR5 | Frankfurt | 30 | DE-KICKS on site | A+B | UPS, generator | Yes | 8 | €750 | 1.4 | €250 | €150/h, 1 h | Yes | Yes | Yes |
| Interaction FRA | Frankfurt | 25 | DE-KICKS on site | A+B | UPS, generator | No | 6 | €600 | 1.3 | €200 | €120/h, 2 h | Yes | Yes | Yes |
| mainqubes FRA | Frankfurt | 12 | DE-KICKS by cross-connect | A+B | UPS, generator | Yes | 6 | €450 | 1.3 | €150 | €100/h, 4 h | Yes | Yes | No |
| Hetzler Park | Frankfurt | 1 | None | Single | UPS, generator | Yes | 4 | €180 | 1.1 | €80 | €60/h, 8 h | No | No | No |
| Tellyhouse North | London | 30 | LYNX on site | A+B | UPS, generator | No | 6 | €800 | 1.5 | €300 | €160/h, 1 h | Yes | Yes | Yes |
| Global Snitch LON | London | 20 | LYNX by cross-connect | A+B | UPS, generator | Yes | 8 | €700 | 1.4 | €250 | €140/h, 2 h | Yes | Yes | Yes |
| Docklands Data | London | 3 | None | Single | UPS | No | 4 | €350 | 1.2 | €100 | €80/h, 8 h | No | No | No |
| Equinox AM3 | Amsterdam | 25 | HAMS-IX on site | A+B | UPS, generator | Yes | 8 | €650 | 1.3 | €220 | €140/h, 1 h | Yes | Yes | Yes |
| Iron Molehill AMS | Amsterdam | 10 | HAMS-IX by cross-connect | A+B | UPS, generator | Yes | 10 | €500 | 1.2 | €180 | €110/h, 4 h | Yes | Yes | Yes |
| Tellyhouse Voltaire | Paris | 25 | Franz-IX on site | A+B | UPS, generator | No | 6 | €650 | 1.3 | €220 | €140/h, 2 h | Yes | Yes | Yes |
| Data5 Marcoussis | Paris | 8 | Franz-IX by cross-connect | A+B | UPS, generator | Yes | 10 | €450 | 1.2 | €150 | €100/h, 4 h | Yes | Yes | Yes |
| NTD Berlin 1 | Berlin | 12 | BeCIX on site | A+B | UPS, generator | Yes | 6 | €500 | 1.3 | €150 | €110/h, 2 h | Yes | Yes | Yes |
| Spree Colo | Berlin | 3 | None | Single | UPS | Yes | 4 | €250 | 1.2 | €90 | €70/h, 8 h | No | No | No |
| Data5 Milano | Milan | 10 | MIXup on site | A+B | UPS, generator | No | 6 | €500 | 1.3 | €160 | €110/h, 2 h | Yes | Yes | Yes |
| Arubaba Hub | Milan | 4 | None | A+B | UPS, generator | Yes | 6 | €350 | 1.2 | €100 | €80/h, 4 h | Yes | No | No |
| Interaction VIE | Vienna | 15 | VieX on site | A+B | UPS, generator | No | 6 | €500 | 1.3 | €160 | €120/h, 2 h | Yes | Yes | Yes |
| Next Lair VIE | Vienna | 4 | VieX by cross-connect | Single | UPS, generator | No | 4 | €300 | 1.2 | €100 | €80/h, 4 h | No | No | No |
| Equinox ZH4 | Zurich | 15 | SwizzIX on site | A+B | UPS, generator | Yes | 8 | €800 | 1.5 | €250 | €160/h, 1 h | Yes | Yes | Yes |
| Green.chz Lupfig | Zurich | 6 | SwizzIX by cross-connect | A+B | UPS, generator | Yes | 6 | €550 | 1.3 | €180 | €120/h, 4 h | Yes | Yes | Yes |
| Equinox DU1 | Düsseldorf | 18 | ECKS-IX on site | A+B | UPS, generator | Yes | 8 | €650 | 1.35 | €220 | €140/h, 1 h | Yes | Yes | Yes |
| Interaction DUS | Düsseldorf | 14 | ECKS-IX by cross-connect | A+B | UPS, generator | No | 6 | €520 | 1.3 | €180 | €110/h, 2 h | Yes | Yes | Yes |
| NTD Düsseldorf 1 | Düsseldorf | 10 | ECKS-IX by cross-connect | A+B | UPS, generator | Yes | 6 | €430 | 1.25 | €140 | €100/h, 2 h | Yes | Yes | No |
| myLoch DUS | Düsseldorf | 8 | ECKS-IX by cross-connect | A+B | UPS, generator | No | 6 | €380 | 1.2 | €120 | €80/h, 4 h | Yes | Yes | No |
| SkyBlink Eygelshoven | Kerkrade | 20 | None | A+B | UPS, generator | Yes | 6 | €300 | 1.15 | €60 | €60/h, 2 h | Yes | No | No |
| Hetzler NBG | Nuremberg | 1 | None | Single | UPS, generator | Yes | 4 | €170 | 1.1 | €80 | €60/h, 8 h | No | No | No |
| Boris Network NBG | Nuremberg | 10 | N-ICKS on site | A+B | UPS, generator | Yes | 6 | €420 | 1.25 | €150 | €100/h, 2 h | Yes | Yes | No |
| Hetzler FSN | Falkenstein | 1 | None | Single | UPS, generator | Yes | 4 | €160 | 1.1 | €80 | €60/h, 8 h | No | No | No |
| Equinox MU1 | Munich | 15 | IN-EXCESS on site | A+B | UPS, generator | Yes | 8 | €700 | 1.4 | €230 | €150/h, 1 h | Yes | Yes | Yes |
| Interaction MUC | Munich | 10 | IN-EXCESS by cross-connect | A+B | UPS, generator | No | 6 | €550 | 1.3 | €180 | €120/h, 2 h | Yes | Yes | Yes |
| Equinox DC2 | Ashburn | 60 | Equinox IX on site | A+B | UPS, generator | No | 8 | €650 | 1.15 | €200 | €130/h, 1 h | Yes | Yes | Yes |
| Digital Reality ACC | Ashburn | 25 | Equinox IX by cross-connect | A+B | UPS, generator | No | 10 | €480 | 1.1 | €150 | €100/h, 2 h | Yes | Yes | Yes |
| CoreSpite VA1 | Ashburn | 15 | Equinox IX by cross-connect | A+B | UPS, generator | No | 8 | €420 | 1.1 | €120 | €90/h, 4 h | Yes | Yes | No |
| Equinox NY4 | New York | 45 | NYIKES on site | A+B | UPS, generator | No | 8 | €800 | 1.4 | €250 | €160/h, 1 h | Yes | Yes | Yes |
| Telex 60 Hudson | New York | 35 | NYIKES by cross-connect | A+B | UPS, generator | No | 5 | €700 | 1.45 | €220 | €150/h, 2 h | Yes | Yes | Yes |
| Digital Reality 350 Cermak | Chicago | 40 | CHI-KICKS on site | A+B | UPS, generator | No | 8 | €550 | 1.2 | €180 | €120/h, 2 h | Yes | Yes | Yes |
| CoreSpite CH1 | Chicago | 15 | CHI-KICKS by cross-connect | A+B | UPS, generator | No | 8 | €450 | 1.15 | €140 | €100/h, 4 h | Yes | Yes | No |
| Equinox DA1 | Dallas | 30 | Y'ALL-IX on site | A+B | UPS, generator | No | 8 | €500 | 1.1 | €170 | €120/h, 2 h | Yes | Yes | Yes |
| Digital Reality DFW | Dallas | 12 | Y'ALL-IX by cross-connect | A+B | UPS, generator | No | 10 | €400 | 1.05 | €130 | €90/h, 4 h | Yes | Yes | Yes |
| CoreSpite One Wilshire | Los Angeles | 60 | Any3 on site | A+B | UPS, generator | No | 6 | €750 | 1.45 | €230 | €150/h, 1 h | Yes | Yes | Yes |
| Equinox LA1 | Los Angeles | 30 | Any3 by cross-connect | A+B | UPS, generator | No | 8 | €650 | 1.4 | €210 | €140/h, 2 h | Yes | Yes | Yes |

**Cross-connects and price changes.** A cross-connect ordered in a provider's portal reaches a carrier on sale at the datacenter or its exchange when that is on site. It costs the Cross-connect column a month, fixed at order time and billed with the rent, plus a setup fee of two months. An uplink link to the same partner in that zone runs over it and pays no second cross-connect. Each January one provider, preferring one the player rents from, raises its position price by 2 to 5% for new contracts and emails its customers; existing contracts keep their monthly price.

**Basement.** One position, a 24U rack at most, 3 kW at most (a household circuit), no backup, the household power price (business × 1.6) and the home line as its only uplink.

**Home line.** The basement can switch to another line in the Locations app. The old line stays up until the new one is installed, and ordering the current line again cancels a pending switch. Every line is billed as rent on the first of each month, from the month after it goes live. New games start on Mom's DSL: the family's private line, 6 Mbit/s down, 0.5 Mbit/s up, one dynamic address. Mom pays for it, so it never appears on the ledger. It is not on offer, so it cannot be ordered back after a switch. Lines with a static IP are business lines: they cost more and bring a /29 of addresses (Addresses and internet). Lines stay on offer once they appear. The basement's traffic leaves through the line's upload (Traffic and bandwidth). When the evening peak is over it, the sites served from the basement slow down: each hour a basement service costs its customer the slow-node penalty, 0.1 × the share of traffic the line drops, and writes a slow-site ticket with 0.1 × that share (Usage curves and overcommit). The Locations app shows the line's peak upload over the last 7 days next to its speed, the Network app shows it on the home line's card, and the first hour a line runs full sends one notification per line.

| Line | Provider | Down / up (Mbit/s) | Per month | From | Install days | Static IP |
| --- | --- | --- | --- | --- | --- | --- |
| DSL 16000 | Deutsche Telekomm | 16 / 1 | €45 | 2005 | 7 | No |
| DSL 16000 Business | Deutsche Telekomm | 16 / 1 | €59 | 2005 | 14 | Yes |
| SDSL 2048 | 1&2 | 2 / 2 | €129 | 2005 | 14 | Yes |
| VDSL 50 | Deutsche Telekomm | 50 / 10 | €45 | 2007 | 14 | No |
| VDSL 50 Business | Deutsche Telekomm | 50 / 10 | €99 | 2008 | 14 | Yes |
| Cable 100 | Vodafoam | 100 / 6 | €40 | 2010 | 10 | No |
| VDSL 100 | Deutsche Telekomm | 100 / 40 | €50 | 2014 | 14 | No |
| VDSL 100 Business | Deutsche Telekomm | 100 / 40 | €129 | 2014 | 14 | Yes |
| Cable 400 | Vodafoam | 400 / 25 | €60 | 2016 | 10 | No |
| Business Fiber 1000 | 1&2 | 1000 / 1000 | €350 | 2018 | 30 | Yes |
| Fiber 1000 | Deutsche Glasfasel | 1000 / 500 | €90 | 2019 | 30 | No |
| Cable 1000 | Vodafoam | 1000 / 50 | €80 | 2019 | 10 | No |
