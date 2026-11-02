# Traffic and bandwidth

Traffic per customer grows 20% a year, about 46× from 2005 to 2026. In 2005 one full 8 GB basement server sends about 0.4 to 0.7 Mbit/s at its evening peak, so the second server fills the 1 Mbit/s upload of the starting DSL line, and SDSL 2048 carries about three servers' worth; that is the first push out of the basement.

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

**Daily curve.** Traffic follows each customer type's usage curve with its jitter, on top of a product's floor, plus the customer's night job (see Usage curves and overcommit), scaled so a week averages to the monthly figure. The 95th percentile of its hourly averages in Mbit/s is about GB per month ÷ 164. Transit bills on 5-minute readings, which also catch the bursts inside an hour, so a single service bills higher than that (see Transit billing).

**Transit billing.** Carriers bill the 95th percentile of 5-minute readings over the last 30 days and never charge less than 20% of the port. The game does not simulate every 5 minutes: each hourly tick records one reading per port that stands in for the hour's twelve.

- **Burst.** Each service's 5-minute traffic swings around its hourly average by a coefficient of variation: game servers 1, storage 0.8, VPN and colocation 0.3, everything else 0.5, and a DDoS 0.5. A zone's burst is the square root of the summed (Mbit/s × burst)² over its total Mbit/s, so many customers smooth each other out and a few bursty ones do not.
- **Reading.** The hour's reading is its carried Mbit/s times a lognormal factor with mean 1 and the zone's burst as its spread, capped at the port's capacity. The factor's quantile steps by the golden ratio every hour from a seeded start per location, so 30 days of readings cover the whole spread evenly.
- **Accuracy.** Against true 5-minute sampling, the 95th of these hourly readings lands within about 2% on average (up to 9% in a single month for three game servers alone). Compared with billing the hourly averages, the bill rises about 1% for 200 web hosting customers, 13% to 18% for a mixed early customer base or one colocation customer, 27% for five storage customers and 58% for three game servers alone.

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

**Per size.** The table is the average customer, on the middle size of a line (the lower middle when the count is even). Each size step up doubles the traffic and each step down halves it, so the four VPS sizes send 10, 20, 40 and 80 GB a month in 2005. A service sends its spec's traffic, grown 20% a year since it started. Domains and certificates send nothing, DNS hosting 1 GB, cloud servers like a VPS.

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

**Links between zones.** A leased wavelength costs €400, €900, €2,500 or €6,000 a month for 1G, 10G, 100G or 400G in 2026 (m = 5) within a region, and 3 × that between regions, or 10 × across the Atlantic. Dark fiber runs only within a region, carries 100G and costs €2,000 a month. Links take 30 days, uplink links 14.

**DDoS protection.** Scrubba Dub On Demand costs €50 a month plus €250 per attack and lets a sixth of the attack's first hour through. Akamaybe Prolexit costs €800 a month and filters everything. A blackhole drops the attack and takes its target offline until it is lifted.

**Latency.** Each hop of a route adds its round trip time; ping and traceroute print it with 10% jitter.

| Hop | Milliseconds | Anchor |
| --- | --- | --- |
| Switch | 0.2 | Store-and-forward gigabit switch, 0.1 to 0.3 ms |
| Firewall | 1 | Stateful inspection |
| Gateway or router | 1 | |
| Home line | 18 in 2005, 8 from 2015 | DSL with interleaving 20 to 40 ms in 2005, fastpath 10 ms, VDSL and fibre from 2015 |
| Datacenter uplink | 3 | Handoff and metro transit |
| Core hop, same country | 8 | Frankfurt to Berlin 8 to 10 ms |
| Core hop, other European city | 25 | Frankfurt to Amsterdam is 8 ms in practice and Frankfurt to London or Milan 15 to 25 ms; the game rates every border crossing at 25 ms |
| Core hop, overseas | 90 | Frankfurt to New York 90 ms |

The core hop applies when the two locations are in different cities: both in one country count as same country (two US cities too), a European and a US city as overseas, everything else as another European city. A line or uplink queues above 80% of its exit capacity (exits used divided by exit capacity): each point above adds 200 ms per unit, so a full link adds 40 ms, and loses 20% of the packets per unit, so a full link loses 4%.

**Saturation in practice.** A zone counts as saturated once more than 2% of its traffic is dropped. Services there stay online, and each hour costs their customers 25% of their outage penalty; when a zone first saturates, each affected customer writes an outage ticket with half their usual chance. The basement is the exception: a full home line slows its sites instead (Home line).
