# Addresses and internet

Code: `src/sim/10-catalog/addresses.ts` (numbers), `src/sim/60-infra/addresses.ts` (state and upkeep), `src/sim/90-actions/addresses.ts` (actions). Design in gdd/addresses-and-internet.md, Addresses and internet.

**Private addresses.** Every server and VM gets one from its location's range and never manages it: 192.168.1.x for basement servers, 192.168.2.x for basement VMs, 10.n.0.x and 10.n.1.x in the n-th location.

**Home line addresses.** A dynamic line has one address, held by the router and shared by every basement machine; it changes with the forced disconnect every night at 03:00 (Deutsche Telekom's 24-hour disconnect). A static (business) line brings a /29: the router's address and four more to assign, and more at €3 a month each. Only web hosting runs behind a shared address, so a dynamic line sells nothing else; every other line needs a static line in the basement.

**Nightly reconnect.** A dynamic line is offline for 3 minutes at 03:00, below what billing counts. Customers who run a business (small business, agency, office, online shop, enterprise) notice it at once: half their outage penalty every night, which leads to churn. Nobody else notices. Business customers still buy on a dynamic line.

**Datacenter addresses.** Every server in a rented location holds its own IPv4, bought from the provider when none is free. Every VPS, game server, cloud server, VPN, colocation and dedicated server in the basement needs an address of its own; a sale without a free one is lost ("Needs a free IPv4 address"). Provider IPv4 per address per month, by year and by the number the company rents:

| Year | Price | | Count | Share paid |
| --- | --- | --- | --- | --- |
| to 2011 | €1.00 | | 1 to 16 | 100% |
| 2019 (run-out) | €2.00 | | 17 to 64 | 80% |
| 2021 | €3.00 | | 65 to 256 | 60% |
| 2024 on | €3.50 (AWS's $0.005 an hour) | | 257 on | 45% |

Prices between the years are straight lines. Anchors: RIPE NCC's last /8 policy (September 2012), RIPE's run-out (25 November 2019), the transfer market of the 2020s.

**Customers' address needs.** A dedicated IPv4 is a priced unit ("Per dedicated IPv4") on web hosting, VPS, game, cloud, dedicated and colocation lines; the market rate is half again the provider price, at least €2. Every game server order asks for one. Web hosting orders ask for one for SSL before SNI and for sending mail: small business and agency 15%, office 20%, online shop 60%, enterprise 30% until 2010, falling to none by 2016 (Windows XP's end in 2014). From 2012, 3% more orders a year ask for IPv6 too, at most 40%.

**IPv6.** Datacenters offer it from 2010, home lines from 2013 (Telekom dual stack, December 2012). One address per machine, €0.10 a month at a provider, free on a home line.

**Own networks.** With a rented location the company can join RIPE NCC as a LIR: €2,000 sign-up, €1,400 a year, an AS number and the free allocation of the year, a /21 (2,048 addresses) until September 2012, a /22 (1,024) until November 2019 and a /24 (256) after. More /24s come from the transfer market at a price per address: €7 (2014), €10 (2016), €17 (2018), €22 (2020), €40 (2021), €50 (2022), €35 (2024), €30 (2026). A block is announced from one rented location, where its addresses become free; own addresses cost nothing a month. The company announces it from its own router with a full table, or the provider announces it under the company's AS for a one-off €250 setup fee.

**Reputation.** Every IPv4 has a mail reputation from 0 to 100: 80 when new, 70 on a static line, 20 on a dynamic line, whose addresses always sit on dynamic-range blocklists. Each 1,000 spam mails a day cost 5 points; a compromised panel host sends 12,000 a day and a spamming customer 2,000. Abuse reports cost points too: phishing 15, spam 10, attack 5, copyright 3. Below 30 the address is listed and stays listed until it is back at 50; a clean day adds 1 point. A delist request, once the spam stopped, clears the listing after 24 hours and adds 20 points. Mail customers behind a listed address write in about bounced mail with a 1% chance a day.

**Balance.** Steady bot level medians before and after: 2006.0, 2006.8, 2008.6, 2011.9, 2017.9 before; 2006.2, 2006.9, 2008.7, 2011.9, 2018.1 after. Solo: 2005.8, 2006.5, 2008.3, 2012.8 before; 2005.8, 2006.5, 2008.3, 2012.9 after. The bot starts on the business DSL line, pays extra line addresses for its VPS and game servers in the basement and provider addresses in the datacenter. Level 2 may land up to a quarter later than the pacing guard allowed before. The happiness harness (scripts/happiness.ts, seeds 1 to 6) starts on the business DSL line and keeps one spare line address; its December medians move from 52 customers, €684 MRR and happiness 92 before to 44.5 customers, €728 MRR and happiness 90.5 after.
