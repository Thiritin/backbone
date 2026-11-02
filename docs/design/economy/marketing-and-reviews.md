# Marketing and reviews

In 2005 a low-budget lead from search ads costs about €9, so a new private customer costs €25 to €80 depending on your share. Reviews skew negative unless you invite happy customers, which is what review platforms are for.

**Cost per lead** in 2026, scaled back with the search-ads multiplier (0.6 in 2005):

| Channel | Profiles reached | Cost | Condition |
| --- | --- | --- | --- |
| Word of mouth | Every profile, as referrals | Free | Always on |
| Search ads | Low budget / medium / high | €15 / €35 / €90 per lead | None |
| Gaming communities | Gamers | €8 per lead | None |
| Trade fair | Business profiles | See Trade fairs below | Company level 3 to 5 |
| Partner program | Sole proprietors, small businesses | Commission of the first 2 months' revenue | Each agency customer brings 0.5 leads a month |
| Flyers | Private, sole proprietors, small businesses | €22.50 / €17.50 / €15 per lead by run size in 2026 (see Flyers below) | Your own location in the city |

Spending more in one channel and city gets dearer: the cost per lead is multiplied by 1 + monthly spend ÷ €5,000.

**Reviews.** After a closed ticket, an outage that hit them, a data loss or a cancellation, a customer writes a review with a 10% chance, or 20% when their happiness is below 40. The stars follow happiness, rounded after up to half a star of random noise and kept between 1 and 5. A customer refunded after a data loss who still writes a review gives 3 stars 60% of the time and otherwise follows the formula:

```math
\text{stars} = \operatorname{round}\left(1 + 4 \cdot \frac{H}{100} \pm 0.5\right)
```

**Review score.** The score covers the last 2 years and starts from a prior of 3.5 stars worth 20 reviews, so early reviews move it slowly:

```math
\text{score} = \frac{3.5 \cdot 20 + \sum \text{stars}}{20 + n}
```

**Fast game servers and smooth months.** At every month's start (`monthlyReviews` in `products.ts`), a game server on a node whose CPU boost clock is within 90% of the fastest part on sale that year (`topBoost`, the current generation's parts and the one before) raises its customer's happiness by 3 and writes a five-star review with a 10% chance; a slow clock costs nothing beyond the per-core speed. When that part is still new (within 6 months of its January launch), each such node raises awareness among gamers by 1% of the gap, 5% at most per month. Every service that ran the whole month without a slowdown (`slowedAt` on the service) or an outage earns a review of at least four stars with a 5% chance. A customer writes at most one of these a month.

**Review platforms.** Invites ask customers with happiness of 60 or more for a review each month, which counters the bias toward angry reviews.

| Platform | Invite rate per happy customer per month | Trust bonus T |
| --- | --- | --- |
| None | 0 | 0 |
| Free listing | 0 | 0 |
| "ProvenExpat" | 1% | 4 |
| "TrustPylon" | 2% | 6 |

Platform fees are flat: the free listing costs nothing, ProvenExpat €49 and TrustPylon €199 a month. The free listing's +2 now comes from the HOSTtoast listing (competitors.md, HOSTtoast), whose T adds to the platform's, capped at 10.

**Flyers.** The print shop "Flyerlarm" (flyerlarm.de) sells runs of 1,000, 5,000 and 10,000 flyers at 0.09, 0.07 and 0.06 euros each in 2026, scaled back with m = 0.6 like search ads, and books the price at the order (ledger line "Flyers"). A run is delivered after 3 days and handed out evenly over the next 28 days in one city where you have a location, so a run is done 31 days after the order. Every flyer handed out brings 0.004 leads, split over private, sole proprietor and small business customers by their mix, with a conversion multiplier of 0.8. A lead therefore costs the flyer price ÷ 0.004: €22.50, €17.50 and €15 for the three runs in 2026, and 0.6 times that in 2005. Flyers need neither a website nor research, the Marketing app lists the running runs and the print shop keeps the order history. Decision: flyers reach only the three consumer and small business profiles because they read a flyer in the letterbox.

**Owned channels.** Each step is a one-off setup plus monthly upkeep, flat over the years:

| Step | Setup | Upkeep per month | Needs |
| --- | --- | --- | --- |
| Email | Free | Free | Always on |
| Web design | €400 in 2005 (the agency price below) | €15 | None |
| Goggle Ads | €50 | None | Web design |
| AI ads | €1,500 | None | Web design, from 2023 |

Web design is ordered at the design agency Young von Mutt (youngvonmutt.de, Marketing category of the site index), which the website card in the Marketing app opens, once the site is launched. The Marketing app waits for 450 know-how of research (Marketing basics, Employee management, Marketing campaigns), so a first-year company could not otherwise buy them before December.

The basic website every company starts with is free and brings no leads of its own. The web design brings 4 leads a month per location city, split by the profile mix. Every lead only writes when its product is listed on the website.

**Site hosting.** A rented host costs €9.90 a month from the month the web design is bought, flat over the years (ledger line "Website hosting: Strateaux"). Anchor: German shared hosting packages from Strato and 1&1 cost €5 to €10 a month in 2005. An own host costs nothing extra.

**Design generations.** The design belongs to a generation: 2005, 2009, 2013, 2017, 2021 or 2025 (every four years; the web design takes the generation of the year it is bought). With b = (current generation − design generation) ÷ 4, website leads and shop orders are multiplied by 1 for b of 0 or 1 and by max(0.4, 1 − 0.2 × (b − 1)) from b = 2:

| Design from | 2012 | 2013 to 2016 | 2017 to 2020 | 2021 on |
| --- | --- | --- | --- | --- |
| 2005 | 100% | 80% | 60% | 40% |

**Design agency.** The web design and every redesign cost designPrice(year, level) = base × (1 + 0.5 × (level − 1)), where the base is €400 in 2005, €650 in 2009, €1,000 in 2013, €1,500 in 2017, €2,200 in 2021 and €3,500 in 2025, interpolated linearly per year and flat from 2025, and level is the company level. A level 1 company pays €400 in 2005 and €3,500 in 2025; a level 6 company pays €12,250 in 2025. The first web design is live at once. A redesign can be ordered at any time, even for a current design, books the price under marketing (ledger line "Website redesign") and is delivered 14 days later; the old design stays live until then, and only one redesign can be on order at a time. Delivery sets the design to the generation of the order date and the Marketing app notes it. The company level stands in for company size because no headcount metric exists. Anchor: a small-business site cost $2,000 to $7,500 in 2005 to 2009 (WebpageFX, 2013). The balance bot redesigns when it is two generations behind with more than the price plus €5,000 in cash, pays the same price, takes the design as live at once and keeps its site on the rented host.

**Trade fairs.** Costs are 2026 euros, scaled back with m = 0.6 like campaigns. Each fair needs one attendee of any role, who is away for the fair's days.

| Fair | Pun of | Date | Days | Level | Cost | Leads | Audiences | Network contacts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SeeBIT, Hanover | CeBIT | 6 March, until 2018 | 5 | 3 | €8,000 | 15 | Sole traders, small businesses, offices | 0.1 |
| CloudFeast, Rust | CloudFest | 23 March | 3 | 4 | €20,000 | 40 | Agencies, online shops, enterprises | 0.2 |
| RIPE-ish Meeting, Amsterdam | RIPE Meeting | 18 May | 5 | 3 | €3,000 | None | | 0.4 |
| DE-SIX Summit, Frankfurt | DE-CIX Summit | 7 October | 1 | 4 | €5,000 | 5 | Enterprises | 0.5 |
| Data Centre Whirled, Frankfurt | Data Centre World | 12 November | 2 | 5 | €35,000 | 60 | Enterprises, offices, online shops | 0.2 |

The leads arrive over the 730 hours after the fair, split evenly over the location cities and the audiences, with a conversion of 1.5. A marketing manager trained on fairs brings back 1.5 × the leads. At the next month start each audience of the fair gains 0.03 awareness on top of g. The network contacts of every fair attended in the last 12 months add up, each fading linearly to 0 over that year, capped at 1; `tradeFairBonus(s)` exposes the sum for transit prices and peering acceptance.

**Community events.** A request arrives 28 to 56 days after the previous one (the first after the start of the game), drawn evenly from the events at or below the company's level; it lapses after 14 days. A request answered with 50% off on Sponsor-Bored is decided 24 hours later: the community takes it at a 0.5 chance (seeded by the sponsorship) and the services then run at half the list price for a normal customer, who churns when the event ends; otherwise, or when the services find no room, the request closes. Such a request does not lapse while it waits. People is the audience shown on the board's requests list. The services are free, hourly products at the size index of the product's line (SIZES) and end after the duration. A service counts as down by its hours in `downHours`, kept per service while the event runs; the most down hours of any one service decide the outcome.
| Event | Pun of | Kind | Level | Services | Duration | Audience | People | Reward |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LAN-tastic | LAN party | Public | 1 | 2 game servers (smaller size) | 3 days | Gamers, private users | 150 | Awareness +0.02 for both |
| Chaos Computing Club | Chaos Computer Club meetup | Tech | 1 | 1 VPS (1 GB) | 90 days | Developers | 60 | Know-how 10 |
| Hack-a-Sorus | Hackathon | Tech | 1 | 2 VPS (1 GB) | 7 days | Developers | 80 | Know-how 25 |
| Debonair Linux mirror | Distribution mirror | Tech | 1 | 1 storage volume (500 GB) | 365 days | Developers | 2,000 | Know-how 15 |
| Frag-Fest | Gaming tournament | Public | 1 | 4 game servers (smaller size) | 3 days | Gamers | 300 | Awareness +0.03 |
| Linux User Group | User group website | Public | 1 | 1 web space (2 GB) | 365 days | Small businesses, private users | 120 | Awareness +0.01 for both |
| DevOops Conference | Conference streaming | Tech | 3 | 8 VPS (2 GB) | 7 days | Agencies, enterprises | 1,200 | Know-how 40 |
Awareness gains use the same share-of-the-gap rule as forum posts and fairs, each applied once when the event ends. A tech event adds a recommendation with a 20% chance: a technician applicant whose skill is a drawn applicant's plus 20 (at most 95, talent above it) stays in the market for 30 days. A public event adds a 5-star review with a 50% chance (written under the event's name) and a batch of 3 to 6 leads with conversion 1, split over the location cities and the audience, counted in the month after the event like fair leads. More than 2 hours down on any one service replaces all of this with two 1-star reviews and 0.9 times the awareness of every audience profile. The balance bot ignores every request, so balance runs are unchanged.

**Sponsor board.** An offer draws its slots plus 2 applications, each at a uniform 2 to 10 days after posting (hourly resolution, seeded by the offer). An application is drawn evenly from five applicants. Anchors are the audiences of a gaming clan, a LAN party in a gymnasium, a fan forum, a course project and a distribution mirror.

| Applicant | Audience | People | Advertises |
| --- | --- | --- | --- |
| Clan | Gamers | 80 to 400 | Banner on the site |
| Small LAN party | Gamers | 30 to 120 | Mention on stage |
| Fan site | Private users | 300 to 3,000 | Banner on the site |
| Student project | Developers | 20 to 150 | Forum signature |
| Open source mirror | Developers | 200 to 2,000 | Forum signature |

The service is one unit of the offer's size and runs for the term (730 hours a month). Free offers book EUR 0 for a hidden organiser; half-price offers charge 50% of the list price to a normal customer, who churns when the term ends. A sponsorship that runs a full month adds +0.005 awareness to its audience profile through the usual share-of-the-gap rule, at every 730th hour of the term, and the board adds at most 0.03 in total over all sponsorships. While it runs and the banner is up it also adds a lead batch of `min(4, max(1, round(audience / 250)))` leads of that profile a month, split over the location cities. At the first month, 15% of applicants drop the banner: that month's awareness still counts, then awareness and leads stop. 10% of applicants are shady customers (notice rates in Notices and legal requests). Downtime is judged as in a community event: more than 2 hours down at the end of the term gives two 1-star reviews and 10% less awareness in the audience. Applications lapse after 14 days. The cap of three open offers keeps the inbox readable.

**Campaign channels.** Cost per lead in 2026, scaled back with m = 0.6 like search ads. Conversion multiplies the chance that a lead buys:

| Channel | Profiles | Cost per lead | Conversion |
| --- | --- | --- | --- |
| Goggle Ads | All | Search ads above | 1 |
| AI ads | All | 1.5 × search ads | 1.3 |
| Gaming communities | Gamers | €8 | 1 |
| Cold calling | Sole proprietors, small businesses, offices | €8, €12, €20 | 0.35 |
| Agency outreach | Agencies | €30 | 1, and the offered discount is quoted back |

Budgets are €100, €250, €500, €1,000, €2,500 or €5,000 a month, split evenly over the location cities and then over the targeted profiles. The saturation rule above applies per city.

**Awareness.** Each profile has an awareness between 0 and 1. It starts at 5% for private individuals and gamers and at 2% for everyone else, which is also the floor. At each month start it gains g on the gap to 1 and decays by 2%:

```math
a' = a + (1 - a) \cdot g - 0.02 \cdot a
```

```math
g = 0.05 \cdot \left(1 - e^{-L/100}\right) + 0.004_{\text{website}} + 0.006 \cdot (\text{score} - 3.5) + 0.001 \cdot T + \min(0.01,\ 0.0005 \cdot n_{H \ge 70})
```

L is the profile's paid leads this month and n the number of its customers with happiness of 70 or more. A steady €1,000 a month on one profile settles near 65% after about two years and falls back slowly once it stops. Forum posts and fairs add to the gain directly.
