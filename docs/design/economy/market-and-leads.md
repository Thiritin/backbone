# Market and leads

Each city produces a stream of new customers looking for a host. Only a small share of them ever looks at your offer; those are your leads, and the choice formula decides which leads buy.

**Market size.** New customers per month in 2005, growing 8% a year (about 5× by 2026):

| City size | Cities | New customers per month (2005) |
| --- | --- | --- |
| Large | Frankfurt, London, Paris | 1,500 |
| Medium | Amsterdam, Berlin, Milan, Munich | 1,000 |
| Small | Vienna, Zurich | 600 |
| Regional | Düsseldorf 800, Nuremberg 400, Kerkrade 150, Falkenstein 100 | as listed |
| North America | New York 2,000, Los Angeles 1,500, Chicago 1,200, Dallas 1,000, Ashburn 600 | as listed |

Düsseldorf stands for the Rhine-Ruhr area and Kerkrade for the Dutch-German border region around Aachen; Falkenstein and Ashburn are datacenter towns with few local customers.

Customers belong to their city's country and prefer datacenters there (see the location score under [Customer choice](customer-choice.md)).

**Profile mix.** Share of each city's new customers, by budget and skill:

| Budget \ Skill | Low skill | Medium skill | High skill |
| --- | --- | --- | --- |
| Low budget | Private individual 22% | Gamer 15% | Hobby developer 10% |
| Medium budget | Sole proprietor 15% | Small business 15% | Agency or startup 8% |
| High budget | Doctor's or law office 5% | Online shop 5% | Enterprise 2% |

Web developers (medium budget, 3%) take their share from private individuals. They are rare at the start, with a quarter of the usual awareness, and the dev meetups and conferences you sponsor and the fairs that reach agencies are the early way to them.

**Leads.** Leads per month for each profile and city come from organic reach and referrals, which are capped at a share of that city's new customers that grows with your level, plus website and campaign leads on top:

```math
\text{leads} = \min(\text{organic} + \text{referrals},\ 0.016 \cdot (1 + 0.5 \cdot \text{level}) \cdot \text{market}_{new}) + \text{website} + \text{paid}
```

The cap is 2.4% of a city's new customers at level 1, 4% at level 3 and 6.4% at level 6.

- **Organic:** 0.3 × the city's new customers × the profile's mix × its awareness × (1 + 0.5 × (level − 1)) × review multiplier per month (see Organic leads in the game below). Organic leads only come from cities where you have a location.
- **Referrals:** every customer with happiness 70 or more brings 0.003 leads per month × review multiplier, of their own profile, in your home city.
- **Website:** 4 a month per location city once you own a website, split by the profile mix, times the site factor below.
- **Paid:** campaign budget ÷ cost per lead (see [Marketing and reviews](marketing-and-reviews.md)).

Website and campaign leads send 10% to cities without a location of yours, where they cannot buy.

**x86 orders.** A share of VPS, game server and cloud orders needs x86 (`x86Share` in `cpus.ts`), drawn per order from its own seed: 60% in 2020, falling in a straight line to 30% in 2026 and flat after. Orders before 2020 carry no requirement, since no ARM server exists yet. Ampear nodes take only the orders without it; web hosting, DNS and the other lines run anywhere. Anchors: Windows Server images, old x86-only images and most game server binaries, against the growing share of Arm instances at the big clouds (AWS Graviton from 2018).

**GPU demand.** Hobby developers, agencies, online shops and enterprises ask for GPU servers in 3% of their orders at a demand factor of 1 (`gpuDemand` in `gpu.ts`). The factor is 0 before 2011, 0.2 from 2011 to 2016, 0.6 from 2017 (deep learning), 1 from 2020 and 2.5 from 2023 (generative AI), so those profiles ask for a GPU server in 0.6%, 1.8%, 3% and 7.5% of their orders, and their other products give way proportionally. News announces the two jumps. A GPU order that finds no free card is lost as no capacity, like any other line. The portfolio score ignores the GPU line.

**Site state.** The company site is rented from "Strateaux" (always up) or runs as a small workload (0.25 vCPU, 0.5 GB RAM, 2 GB disk) on one of your panel hosts. On an own host the site is down while the host is off, failed, taken offline or compromised, and slow while the host performs below 1 (overload, a PHP upgrade) or has over 90% of its RAM booked. Website leads and shop orders are multiplied by 0 while the site is down and by 0.5 while it is slow, at the daily roll; search ads, campaigns, fairs, referrals and email orders are untouched. The site adds no awareness (the 0.004 a month under Marketing and reviews) while it is down.

The review multiplier is 0.4 + 0.25 × (stars − 1), so 1 star gives 0.4, 3 stars 0.9 and 5 stars 1.4.

Each lead first checks the profile's requirements on the host. A lead that fails them is logged as a lost sale with its reason, for example "company too young". A lead that passes compares you with the competitors (next section) and, if it picks you, sends a request.
