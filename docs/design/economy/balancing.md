# Balancing

The numbers above are first guesses. A headless run of the simulation proves or breaks them before any UI exists, and it stays in CI so later changes can't quietly wreck the pacing.

**The balance run.** `npm run balance` plays 15 game years over 20 seeds with two scripted players and prints, per year, the level, customers, recurring revenue and lowest cash.

- **Steady bot:** prices at 0.8× base, hires a support agent whenever the queue is over a day old, and adds capacity whenever a cluster is 80% full. Its median run must hit each level within a year of the pacing target and never go bankrupt.
- **Solo bot:** plays the same way but never hires. It must survive and reach level 5 within a year of its target, and reach level 6 later than the steady bot, which shows that hiring is how you scale and still optional.

A Vitest suite runs both bots on fixed seeds and fails when either rule breaks. The `balance` skill from the GDD reads the run's output and suggests which value to tune.

**The happiness run.** `npx tsx scripts/happiness.ts [seeds] [months]` plays the real tick and actions like a careful player: every order step at the market price, the setup once paid, the right template on every ticket, the careful action on notices and legal requests, sales quoted at the market price, domains renewed, orders declined when the cluster cannot fit them, and another server bought by the steady bot's 80% rule. Per month it prints customers with a live service, MRR, average happiness, the happiness change by source, the hours services spent down by cause and the wait penalties by ticket kind.

**Happiness decay in the early game (2005).** The happiness run found two causes that sank a well-played company to near zero happiness by spring, with churn in waves:

- Automatic placement booked RAM up to 1.5× installed. Memory in use is booked RAM × (0.6 + 0.4 × load), so a basement server booked past about 8 GB froze most evenings: 86 to 270 service-hours down per customer per month. Automatic placement then preferred nodes within the installed RAM, and later any booking became allowed, so the scheduler only prefers them (Usage curves and overcommit).
- A slowed node cost each customer 1 − performance per hour. Drift recovers only a fifth of the gap each month, so a steady monthly loss D settles happiness about 5 × D below the drift target; a node slowed to 72% for 54 evening hours a week cost about 65 a month and drove customers to churn. At 0.1 × (1 − performance) the same node costs about 6 a month and a node at 40% for 80 hours a week still costs about 20, enough to churn customers when the player keeps overloading.

With both changes the careful bot on seeds 1 to 6 holds happiness near 90 through 2006 instead of 15 to 50. Its size was then set by capacity: one 8 GB basement server holds about €180 of monthly revenue (7 to 16 customers, since VPS and game server orders book 0.5 to 4 GB each), the second server costs €2,500 against €1,000 starting cash and €150 to €300 saved a month, and its December customers stayed at 12 to 20 with €130 to €230 of revenue.

**Early capacity.** The happiness run now plays the loan path. When the cluster is 80% booked and cash is short of the server plus a €2,000 reserve, the bot takes the smallest preset loan that covers the gap over five years, buys a Dwell server, mounts and cables it and adds it to the cluster, up to the basement's four servers. It grows a panel VM only within its server's installed RAM and starts another panel VM otherwise. Once the basement's evening peak reaches 90% of the upload it orders the cheapest line with more upload (SDSL 2048 in 2005). It learns Product management, then Marketing basics, and sets up web design and the order form once no server is due and cash keeps the reserve. With these rules, seeds 1 to 6 reach the following by December 2005:

| Seed | Customers | MRR | Happiness | Net worth | Level | Product management | Order form |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 68 | €631 | 83 | €14,776 | 1 | Early June | Early February |
| 2 | 47 | €606 | 92 | €13,190 | 1 | Early July | Early April |
| 3 | 60 | €577 | 91 | €13,436 | 1 | Early May | Late January |
| 4 | 46 | €659 | 91 | €15,684 | 2 | Early June | Mid February |
| 5 | 43 | €452 | 93 | €9,736 | 1 | Early June | Early February |
| 6 | 47 | €682 | 92 | €15,923 | 2 | Early June | Mid March |

The year 1 targets for customers and revenue hold (median 47 customers and €619), happiness stays near 90, and the median company ends 2005 within about €1,500 of level 2, which two of six seeds reach: the loan buys hardware that is worth only its resale value, so the debt costs net worth. The level 2 threshold stays at €15,000; the balance model reaches it in half its seeds by December.

**The balance model and the live rules.** The cohort model in `src/sim/balance/model.ts` follows the live capacity rules:

- Each cohort's spec is the year's middle size × 1, 2 or 4 by budget (`BUDGET_SIZE`), a web space with two mailboxes per step, priced at the live market rates (Per-resource pricing). It books its spec's vCPUs and RAM: a web space 0.25 GB, a VPS the year's base RAM by budget, and a game server 4 GB of the year's base by budget. Gamers ask for a game server 60% of the time. The cluster keeps 1 GB for its hypervisor and panel.
- The starting server and every basement server are the year's Dwell server at its full price and RAM (8 GB for €2,500 in 2005).
- While in the basement, the home line's upload caps the evening peak at 2× each customer's mean traffic, and the bot switches to the cheapest faster line at 90%.
- The bot borrows in the basement like the happiness run; out of the basement it borrows only while all instalments stay under 60% of its recurring revenue. It buys a server only when cash keeps €2,000 plus three instalments, and it moves to the datacenter once the basement's four servers are in place or its customers' evening peak takes 90% of the home line's upload. While the upload is that full it buys no more basement servers.
- Net worth subtracts debt and values hardware at its resale value, as `metrics.ts` does.

The basement VPS cap of 8 is gone, since RAM and upload now set the limit. Against the model before these changes, level 2 arrives at the same time (median 2006.6 against 2006.3, half the seeds in 2005), level 3 later (2011.3 against 2009.9), level 4 earlier (2014.1 against 2017.6), and neither bot goes bankrupt. Levels 3 to 6 still missed their pacing years; the next paragraphs find why and bring the median steady run to level 2 in 2006.0, level 3 in 2006.8, level 4 in 2008.9 and level 5 in 2013.5.


**The stall after the basement.** With the rules above the steady bot sat between 87 and 262 customers from 2006 to 2010. Instrumenting the model per year (median of 20 seeds, year-end cash) showed why:

| Year | Customers | MRR | Net worth | Cash | Debt | Binding constraint |
| --- | --- | --- | --- | --- | --- | --- |
| 2005 | 45 | €810 | €18,063 | €3,444 | €15,777 | Basement RAM and upload |
| 2006 | 87 | €1,499 | €31,857 | €4,110 | €23,505 | Capacity: 156 sales won, 43 fit |
| 2007 | 108 | €1,662 | €31,968 | €4,383 | €22,731 | Capacity: 172 won, 44 fit |
| 2008 | 147 | €2,170 | €44,735 | €5,330 | €22,079 | Capacity: 178 won, 73 fit |
| 2009 | 201 | €2,922 | €67,233 | €5,963 | €22,285 | Capacity: 198 won, 103 fit |
| 2010 | 262 | €3,889 | €95,970 | €7,271 | €23,575 | Capacity: 228 won, 120 fit |
| 2011 | 423 | €8,767 | €218,456 | €9,823 | €44,385 | Level 3 loan limit |
| 2013 | 1,327 | €29,603 | €757,290 | €19,296 | €96,747 | Level 3 loan limit |
| 2015 | 3,632 | €79,752 | €2,212,533 | €154,090 | €99,708 | Leads |

Leads were never the problem before 2014: about 500 a year reached the company and a third of them bought, but most sales did not fit the cluster. The bot could not add servers because each datacenter server lost money and the level 2 loan limit of €25,000 was used up. Four rules in the model were wrong against the live game:

- **Datacenter costs.** The model charged a flat €60 per U a month. The live game rents rack shares (the cheapest home-city share, Hetzler Park in Frankfurt, costs €36 to €198 a month for 1/8 to a full rack, about €6 to €13 per server) and bills power per kWh and the datacenter's bandwidth per TB. The model now rents the cheapest home-city share whose kW limit holds the servers' rated draw, pays power at 60% of that draw times the datacenter's power factor, and pays bandwidth for every customer's traffic. Running a 2005 server in the datacenter now costs about €38 a month instead of €60, with bandwidth the largest part.
- **Web hosting resale.** The model charged 40% of every web space's price as a resold line. Web hosting runs in panel VMs on the company's own servers; only domains are resold. The charge is gone.
- **Server lines.** The model bought only the balanced 1U. The Shop sells the memory-optimized 2U from 2005: four times the RAM for 1.8 times the price and 1.6 times the power. Out of the basement the bot now picks the line with the lowest price per GB it can fill, counting the vCPUs its customers book (0.1 per web space, one per 2 GB of VPS, two per 4 GB game server, at most 8 per core). RAM, not CPU, sets the limit in 2005, so it buys memory-optimized servers.
- **Leasing and the loan limit.** The model had no leasing, and its loan limit ignored the live rule's 12 × average monthly profit. The bot now takes the cheapest of three lease offers (factor 1.06 to 1.40, 12 to 36 months) when the bank says no, but only when the payment is below what the server earns at 80% booked at last month's revenue per GB, less its running costs. Leases sit outside the 60% instalment rule because each one pays for itself. Leased hardware is not in net worth until it is paid off, as in `metrics.ts`.

Two bot rules were changed to match a careful player. The bot moves out of the basement no earlier than October of year 1: the model has none of year 1's setup work (trainings, website, shop) and otherwise filled the basement by April, while the happiness run fills it in the last quarter. At the move the basement servers ride along to the rack share for €300 and the home line is cancelled.

No price, threshold or loan limit moved. With these changes (median of 20 seeds):

| Year | Customers | MRR | Net worth | Cash | Debt |
| --- | --- | --- | --- | --- | --- |
| 2005 | 36 | €617 | €14,381 | €2,761 | €8,483 |
| 2006 | 192 | €5,326 | €128,376 | €9,214 | €31,797 |
| 2007 | 670 | €18,226 | €441,465 | €23,417 | €96,060 |
| 2008 | 1,246 | €30,735 | €777,238 | €33,621 | €88,336 |
| 2010 | 4,082 | €97,768 | €2,733,935 | €188,879 | €116,413 |
| 2013 | 8,189 | €175,431 | €6,015,412 | €1,457,996 | €14,794 |
| 2019 | 14,833 | €289,245 | €13,454,433 | €6,187,137 | €0 |

From 2006 every sale fits the cluster, so leads set the pace. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.6 | 2006.0 | 2005.5 | 2005.8 |
| 3 | 2007 | 2011.3 | 2006.8 | 2011.4 | 2006.6 |
| 4 | 2010 | 2014.1 | 2008.9 | 2016.0 | 2009.7 |
| 5 | 2013 | never | 2013.5 | never | never |
| 6 | 2018 | never | never | never | never |

Neither bot goes bankrupt. Level 3 arrives with fewer customers than the pacing table (about 190 instead of 400) at the same revenue, because VPS and game servers pay more per customer than the table assumed. Level 4 arrives a year early: once leases pay for themselves, capacity grows as fast as sales. If level 4 should land closer to 2010, the lease offers are the place to tune. The solo bot reaches level 3 a little before the steady bot because it pays no hiring unlock or salaries in 2006; it falls behind from level 4 when support runs out.

**Level 6.** The steady bot stayed at level 5 with about 15,000 customers in 2019 against 40,000 targeted, while €6 million of cash sat idle. Counting leads by source, wins and cancellations by cause per year (median of 20 seeds) showed:

| Year | Customers | MRR | Leads | Organic | Referrals | Paid | Won | Cancelled | Of them natural churn | Cities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2010 | 4,082 | €97,768 | 7,120 | 2,674 | 120 | 4,328 | 2,412 | 907 | 884 | 4 |
| 2013 | 8,189 | €175,431 | 11,064 | 3,720 | 261 | 7,081 | 3,560 | 1,911 | 1,910 | 6 |
| 2016 | 12,492 | €256,375 | 14,399 | 4,770 | 416 | 9,213 | 4,670 | 3,141 | 3,030 | 6 |
| 2019 | 14,833 | €289,245 | 14,626 | 4,752 | 518 | 9,297 | 4,799 | 3,659 | 3,659 | 6 |

A third of leads bought every year. Churn ran at about 25% a year and nearly all of it was the profiles' own monthly churn (1% to 4% a month by profile, inside the 1% to 3% a month of real small-business hosting); happiness, outages and price added almost nothing, since the bot prices at 0.8 and keeps support up. So churn was not inflated by a bug. The binding constraint was lead flow, and the model computed it with rules the live game no longer has:

- **Organic leads.** The model gave every location city a flat 20 leads a month × the level factor × the review multiplier. The live game (`30-market/market.ts`) gives 0.4 × the city's new customers × the profile's awareness × the same factors, and awareness grows from the website, reviews, happy customers and campaigns (see Awareness under [Marketing and reviews](marketing-and-reviews.md)). The model had no awareness, no website leads and no market growth in organic leads.
- **Paid leads.** The model spent 10% of MRR on search ads without a limit, €29,000 a month by 2019. The live game runs one campaign per channel at €5,000 a month at most.
- **Cities.** The bot opened 6 of 18 cities and stopped, although every city has a datacenter whose cheapest 1/8 share costs €32 to €140 a month, and a location there is all a lead needs to buy.

With the live rules in the model, the problem turned around: awareness reached 30% by 2007 and 55% by 2010, organic leads ran at ten times the old flat rate, and the old cap of a quarter of each city's new customers let the steady bot reach level 5 in 2010 and level 6 in 2013, at the floors set by company age. Every competent player who sets up a website would hit the cap in each location city from about 2008. Once leads sit at the cap, the cap and the number of cities set the pace, so the cap had to carry a real-world anchor instead of an open question. A host that 25% of a city's new customers look at is the market leader. At level 6 the pacing table targets about 40,000 customers in 2018, which is about 10,000 new customers a year at 25% churn; at a third of leads won, that is about 30,000 leads, or 5% of the 2018 new customers of all 18 cities.

The cap is now 1.6% × (1 + 0.5 × level) of a city's new customers per profile, from 2.4% at level 1 to 6.4% at level 6, on organic leads and referrals; website and campaign leads come on top as in the live game. It grows with level like organic reach, since a bigger company is known to more buyers. The bot now follows the live lead rules: awareness per profile, a website and order form once out of the basement, website leads, and a search campaign at the largest preset budget within 10% of MRR, at most €5,000, spread over every profile and city with 10% spilling to cities without a location. It opens 2 cities at level 3, 4 at level 4 and all 18 from level 5, largest market first, each with its cheapest datacenter's 1/8 share and a memory-optimized server. It also buys ChadGPT Support once it knows Employee management, Monitoring and Automation and support runs behind: the bot answers how-to and billing tickets around the clock at twice a skill-50 person's rate with the right reply 60% of the time, for €300 a month in 2005. Organic leads now count the live formula; the old flat 20 is gone.

| Year | Customers | MRR | Leads | Organic before the cap | Cap | Paid | Won | Cancelled | Cities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2010 | 5,480 | €133,348 | 8,133 | 66,655 | 5,700 | 2,511 | 2,868 | 1,122 | 4 |
| 2013 | 17,781 | €410,707 | 25,755 | 312,769 | 22,490 | 2,765 | 8,794 | 3,569 | 18 |
| 2016 | 30,210 | €650,478 | 31,421 | 398,905 | 28,330 | 2,570 | 10,181 | 6,181 | 18 |
| 2018 | 39,408 | €819,858 | 40,746 | 538,677 | 37,765 | 2,448 | 12,712 | 7,892 | 18 |

Churn stays nearly all natural, at about 21% a year. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 | 2005.8 | 2005.8 |
| 3 | 2007 | 2006.8 | 2006.8 | 2006.6 | 2006.5 |
| 4 | 2010 | 2008.9 | 2008.6 | 2009.7 | 2008.3 |
| 5 | 2013 | 2013.5 | 2011.8 | never | 2012.2 |
| 6 | 2018 | never | 2017.5 | never | never |

Neither bot goes bankrupt. The solo bot now reaches level 5: ChadGPT carries the routine tickets that used to bury its 60 hours a month, and it settles near 20,000 customers in 2019, held back by the tickets only people answer. Level 5 arrives about a year early because the bot opens every city the moment it reaches level 5; a later level 5 would come from a slower expansion, not from the cap. The steady bot still hires: 35 people by 2019 for the upgrade, outage and cancellation tickets the bot does not take. ChadGPT covers the routine tickets of about 20,000 customers for €300 a month, which makes support hires optional until then; if hiring should matter earlier, its work rate or price is the place to look.

**ChadGPT usage pricing.** ChadGPT moved from a flat €300 to €50 plus tokens per reply, with up to 4 replies per ticket before the ticket goes back to people. The model now counts ChadGPT's work in replies: it clears its capacity divided by the replies per ticket, the unsolved rest stays in the queue, and every reply is billed. Median years reached, before and after:

| Level | Target | Steady before | Steady after | Solo before | Solo after |
| --- | --- | --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 | 2005.8 | 2005.8 |
| 3 | 2007 | 2006.8 | 2006.8 | 2006.5 | 2006.5 |
| 4 | 2010 | 2008.6 | 2008.6 | 2008.3 | 2008.3 |
| 5 | 2013 | 2011.8 | 2011.9 | 2012.2 | 2012.8 |
| 6 | 2018 | 2017.5 | 2017.9 | never | never |

Neither bot goes bankrupt. The steady bot pays €500 a month for ChadGPT in 2008, €5,400 in 2012 and about €10,600 from 2014, when one ChadGPT runs at capacity, next to €118,000 of salaries in 2018. The solo bot pays €3,400 a month in 2012 and €10,600 by 2018. It reaches level 5 about half a year later than before, because the tickets ChadGPT gives up on land in its 60 hours a month; with 3 tries instead of 4 it reached level 5 only in 2013.6.

**Per-resource pricing.** The model now prices each cohort's spec at the live market rates per resource. The steady bot's median years reached, before and after:

| Level | Target | Steady before | Steady after |
| --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 |
| 3 | 2007 | 2006.8 | 2006.8 |
| 4 | 2010 | 2008.6 | 2008.7 |
| 5 | 2013 | 2011.9 | 2011.9 |
| 6 | 2018 | 2017.9 | 2018.2 |

The solo bot reaches level 5 in 2012.9 instead of 2012.8. Neither bot goes bankrupt.

**Traffic and setup fees.** The model's specs now carry traffic (the live TRAFFIC_GB, growing 20% a year, × the budget size) priced at the market rate per 100 GB, and while the shop is up every new customer without a high budget pays the market's setup fee once on three in four orders (one in four still writes an email, `EMAIL_SHARE`), collected at the on-time share. The model sells no DNS or VPN, so per-unit DNS and VPN leave it alone. Medians before and after:

| Level | Target | Steady before | Steady after |
| --- | --- | --- | --- |
| 2 | 2005 | 2006.0 | 2006.0 |
| 3 | 2007 | 2006.8 | 2006.8 |
| 4 | 2010 | 2008.7 | 2008.6 |
| 5 | 2013 | 2011.9 | 2011.9 |
| 6 | 2018 | 2018.2 | 2017.9 |

The solo bot reaches level 5 in 2012.8 instead of 2012.9. Neither bot goes bankrupt.

**Game server prices.** A game server used to start at 2 vCPUs and 4 GB of RAM, so in 2005 the smallest one cost €106 a month and took all the cores and half the RAM of a basement server, and in 2026 it was 16 vCPUs and 32 GB for €77. Game servers made 30 to 48% of the steady bot's recurring revenue, although gamers are 15% of the leads. A game server now starts at 0.5 vCPU, 0.5 GB and 5 GB of disk, which comes to €29.25 in 2005 and €11.70 in 2026, close to a 16-slot server of 2005 and a 4 GB server of 2026. With the old VPS rate the steady bot lost about a third of its revenue, stalled after the move and went bankrupt on 3 of 20 seeds, mostly in a basement whose upload was full while two servers stood half empty. The VPS rate's 2005 multiplier went from 11 to 20, which puts the smallest VPS at €19.41 in 2005 and leaves 2026 unchanged, and the bot now moves out when the basement's upload is full. Steady medians: 2006.1, 2006.8, 2008.5, 2011.7, 2017.9 (before 2006.3, 2007.1, 2008.8, 2012.1, 2018.2), none bankrupt. Solo: 2005.9, 2006.7, 2008.4, 2012.8, never (before 2005.8, 2006.5, 2008.3, 2012.9, never).

**Open questions**

- Should customers be simulated one by one or in cohorts? Per-customer happiness assumes one by one; 40,000 customers on an hourly tick should be fine in TypeScript, but save size needs a check.
- Should competitor scores stay fixed forever, or rise about 1 point a year so late-game players can't coast?
- After 2026, do prices stay flat (as written) or keep their trend?
- Bankruptcy as the lose condition is new; does it fit the game?
