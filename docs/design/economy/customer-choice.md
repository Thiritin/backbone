# Customer choice

Each lead scores every host that meets its requirements and picks one at random, weighted so that better scores win most of the time. Every host gets the same offer, so price plays no part in the choice.

**Scores.** Each host gets three scores from 0 to 100.

| Score | Formula | Parts |
| --- | --- | --- |
| Performance P | 0.5 gen + 0.3 headroom + 0.2 location | **gen:** 100 for the current server generation, minus 15 per generation behind (capacity-weighted over the cluster). **headroom:** 100 while the busiest link on the path stays below 60% at the 95th percentile, falling linearly to 0 at 100%. **location:** 100 in the customer's city, 70 in their country, 40 elsewhere. |
| Reliability R | 0.5 uptime + 0.3 support + 0.2 cluster | **uptime:** from the last 90 days (formula below); a company with under 30 days of history counts as 60. **support:** 100 when the average first response takes half the promised time, 50 at the promised time, 0 at double. **cluster:** 100 for HA, 40 for consumer. |
| Convenience C | 0.5 panel + 0.3 portfolio + 0.2 add-ons | **panel:** cPanic 90, Pleskit 80, DirectAdmen 60, FreePanel 45, and 60 for products without a panel. **portfolio:** the share of the profile's usual bundle you sell, × 100. **add-ons:** 25 per add-on offered for the product, up to 100. |

Uptime turns the 90-day downtime fraction d into a score, so 99.99% gives 100, 99.9% gives 60 and 99% gives 20:

```math
\text{uptime} = \operatorname{clamp}\left(100 - 40 \cdot \log_{10}\frac{d}{0.0001},\ 0,\ 100\right)
```

**Value of a host.** Each profile weighs the scores and adds the review platform's trust bonus T (see [Marketing and reviews](marketing-and-reviews.md)):

```math
U = w_P P + w_R R + w_C C + T
```

**Choice.** Each host j wins with this probability, where τ = 12 sets how much luck is involved:

```math
P(j) = \frac{e^{U_j/\tau}}{\sum_k e^{U_k/\tau}}
```

**Profile weights.** The offer is a multiple of the market base rate, and the growth ceiling is the largest size a customer reaches, as a multiple of its first request.

| Profile | w_P | w_R | w_C | Offer | SLA asked | Growth ceiling |
| --- | --- | --- | --- | --- | --- | --- |
| Private individual | 0.20 | 0.20 | 0.60 | 0.9× | Basic | 1.5× |
| Gamer | 0.50 | 0.30 | 0.20 | 0.9× | Basic | 2× |
| Hobby developer | 0.60 | 0.20 | 0.20 | 0.9× | Basic | 3× |
| Sole proprietor | 0.15 | 0.35 | 0.50 | 1.0× | Basic | 1.5× |
| Small business | 0.30 | 0.40 | 0.30 | 1.0× | Business | 3× |
| Agency or startup | 0.50 | 0.35 | 0.15 | 1.0× | Business | 10×; startups up to 50× |
| Web developer | 0.15 | 0.60 | 0.25 | 1.0× | Business | 1.6× |
| Doctor's or law office | 0.10 | 0.60 | 0.30 | 1.3× | Business | 1.5× |
| Online shop | 0.30 | 0.55 | 0.15 | 1.3× | Premium | 5× |
| Enterprise | 0.35 | 0.55 | 0.10 | 1.3× | Premium | 4× |

**Competitors.** Four archetypes sell in every city. Their scores drift over the years as described in [competitors.md](../competitors.md).

| Competitor | P | R | C | Sells |
| --- | --- | --- | --- | --- |
| Budget giant | 55 | 60 | 70 | Web hosting, domains, email, VPS |
| Wholesale provider (the OVH stand-in) | 70 | 65 | 50 | Everything; also the source of your resold lines |
| Developer cloud | 85 | 70 | 40 | VPS, dedicated servers, storage, later cloud |
| Premium host | 80 | 90 | 75 | Everything, managed |

**Worked example.** A private individual weighs P, R and C at 0.2, 0.2 and 0.6. A new player scores P 60, R 50, C 50, so U = 52. The budget giant reaches 65, the developer cloud 55, the wholesale provider 57 and the premium host 79. The player wins about 6% of these leads, and convenience (a better control panel, more add-ons) is the fastest way up.
