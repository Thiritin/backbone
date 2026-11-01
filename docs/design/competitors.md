# Competitors and HOSTtoast

The market already scores six fixed competitors in every lead roll (`COMPETITORS` in `10-catalog/economy.ts`, Customer choice in economy.md). This plan turns them into a living market: rivals that refresh hardware, have outages, collect reviews, gain and lose customers, open and go bust, and list themselves on a comparison portal where a paid tier buys a better spot.

Anchor for the portal: hosttest.de lists hosts in four tiers (Registriert, Geprüft, Premium, Diamant). The three upper tiers are paid memberships with minimum requirements (at least a year on the market, an SLA of at least 99% or 99.5%, support tested regularly and answering within two working days or 24 hours), and paid tiers sort above lower ones in every comparison, ahead of the star rating.

## 1. Rival state

Competitors move from the catalog into state as `competitors: Rival[]`. `newGame` seeds the six majors from today's table; `deserialize` fills the list for old saves the same way.

| Field | Meaning |
| --- | --- |
| `id`, `name` | Id and shown name. The majors keep their pun names; generated rivals get a name from the seed. |
| `template` | budget, wholesale, devCloud, premium, game or managed, the archetype rows of today's table. |
| `P`, `R`, `C`, `priceFactor`, `sells`, `targets` | As today, now changing over time. |
| `founded` | Month index the rival opened; the majors count as founded before 2005. |
| `lag` | Months it takes the rival to move to a new server generation, 0 to 18, drawn once. |
| `outage` | Months left on an outage hit and the R it took, or null. |
| `customers` | Customer count per city. |
| `reviews` | Stars sum and count over the last 2 years, kept as monthly buckets. |
| `tier` | Its HOSTtoast tier. |
| `closed` | Month it closed or was bought, or null. |

The market roll reads rivals from state instead of `COMPETITORS` and skips closed ones. With nothing changing yet, phase 1 must leave every existing market test green.

Decisions for phase 1:

- The majors' ids are their names in lower case with hyphens (`ionose`, `wp-engyne`), and `founded` counts months since January 2005.
- Each major starts with the customers per city its 2005 share of the city's new customers holds at 1.5% churn a month.
- P, R and C in state are the scores the market reads today. P is recomputed from the template each month, an outage subtracts its hit from R and gives it back when it ends, and C keeps every step it has taken.
- The `reviews` and `tier` fields arrive with phases 2 and 3, which use them.

## 2. Monthly drift

At the month roll, with a generator hashed from the game seed, the month and the rival, so a seed replays the same market without changing any other draw of the game rng:

- **Performance.** The template P is the score a rival has on the current generation. When a new generation launches (`generationAt`), every rival scores 7.5 lower (the 0.5 gen weight × 15 per generation behind) until `lag` months have passed, then it is back at its template P. Rivals refresh hardware on the same timeline as the player, so a fast rival is briefly ahead of a slow player.
- **Reliability.** Each rival has an outage chance per month of 2% (premium 1%, budget 3%). An outage takes 10 to 25 from R for 1 to 3 months, posts a news item ("Hetzna: Frankfurt down for 6 hours") and writes reviews (section 4).
- **Convenience.** C rises by the template's step `lag` months after a convenience milestone arrives in the world: control panels (2006), one-click installs (2009), managed WordPress (2013), a customer API (2016), AI assistants (2023). Steps: budget and managed +4, premium +3, the others +2, capped at 95.
- **Price.** Every year from 2006 a budget rival's price factor falls by 2%, `lag` months after January, floored at the template's value minus 0.15. The other templates hold their price factor.
- **Why lag applies to all three and only budget cuts prices.** With convenience and every price moving each January, the balance model's share of leads you win in 2006 fell from 69% to 65%, and with every template cutting prices even to a floor of 0.05 the steady bot reached level 6 in 2019.5, past its pacing test (2018.8 with fixed rivals). Following each move after the rival's own lag and leaving price cuts to the budget template keeps 2005 and 2006 within 2 points of the fixed table and level 6 at 2018.9. The balance model counts a rival's price cuts at the game's 0.25 price weight, since its own price term is calibrated at four times that.
- **Customers.** A rival's new customers per city are its softmax share of that month's leads in the city (the same `P(j)` the market already computes), minus churn of 1.5% a month, plus 2% while it has an outage. The new customers are the city's buyers that month as Market research splits them (`demand` in `30-market/research.ts`), and the Market app charts each month's split per city for the last 60 months.

## 3. Entry and exit

- Seed 3 small rivals at the start: template budget, game or managed, scores 10 below the template, price factor 0.1 lower, one or two home cities.
- **Entry waves.** A new small rival opens with 15% a month in 2006 to 2009 (shared and VPS boom), 10% in 2010 to 2015 (cloud) and 5% from 2016, at most 10 rivals open at once.
- **Exit.** A small rival with under 0.5% share in all its cities for 6 months in a row closes with 50% chance: it goes bust (its customers become switchers, section 5) or a major buys it (the customers move to that major). Both post a news item. The six majors never close.
- **Names.** Generated from two syllable lists, a stem (Netz, Host, Server, Web, Daten, Cloud, Rack, Bit) and an ending (kiste, werk, haus, mann, ly, io, 24, pro), deduplicated per game. They are ids and stay untranslated.

## 4. Rival reviews

Rivals get reviews from the same formula as the player: 5% of their new customers a month write one with stars from `1 + 4 × H / 100 ± 0.5`, where H is 40 + 0.6 × R; an outage month adds 0.2% of their customers as reviews with H = 20. The score uses the same 2-year window and the 3.5-star prior worth 20 reviews. Review text comes from a pool of `t()` templates keyed by star count and topic (support, speed, price, outage).

## 5. Saturation and switchers

Phase 4, after the rest plays well. Each city gets a ceiling of hosting customers, 40 × its 2005 market, growing with the market. Above 70% of the ceiling the new-customer leads fall linearly to 30% at 100%, and the gap becomes switcher leads: customers leaving a rival, weighted toward rivals with an outage, a low score or a price rise. A switcher lead never picks the rival it left. The late game then grows by taking customers instead of finding new ones. The exact curve needs a balance run before it is fixed.

## 6. HOSTtoast

An in-game site, `hosttoast.de`, in the browser (`10-catalog/sites.ts`), from 2005 with an early and a late look.

**The list.** One row per open host, the player included once listed: rank, tier badge, name, stars and number of reviews, starting price for the filtered product, and P, R and C as bars. Filters: product and city. Sort: tier first, then review score, as on the real portal.

**Tiers.**

| Tier | Fee a month | Needs | Trust bonus T | Awareness a month |
| --- | --- | --- | --- | --- |
| Registered | Free | Nothing | +2 | +0.001 |
| Verified | €29 | 6 months old, 90-day uptime ≥ 99% | +3 | +0.002 |
| Premium | €99 | 1 year old, uptime ≥ 99%, test ticket answered within 48 hours | +5 | +0.004 |
| Diamond | €299 | 2 years old, uptime ≥ 99.5%, test ticket answered within 24 hours | +7 | +0.007 |

Fees are flat over the years, like the review platforms. T replaces the free listing's +2 from the review platforms table; ProvenExpat and TrustPylon stay, and their T adds to the HOSTtoast T, so the two together are capped at 10.

**Signing up.** The player registers on the site (an action in `90-actions`), then applies for a tier. A tier the company does not meet is refused with the reason ("Company too young", "Uptime below 99.5%").

**The audit.** On the 1st of each month HOSTtoast opens a support ticket marked as a test (it looks like any customer ticket in the queue). Answering late, or a 90-day uptime under the tier's minimum, drops the company one tier at the next month, with an email from HOSTtoast saying so. The fee follows the new tier.

**Rivals on HOSTtoast.** Every rival is registered. Each January a rival buys the best tier it qualifies for when its yearly revenue estimate (customers × the market base rate × its price factor) is over 50 × the tier's yearly fee; an outage that breaks its uptime minimum drops it like the player. The majors start 2005 on Premium, Rackspice on Diamond.

**Awards.** Each December HOSTtoast names a "Host of the year" per product, the best score with at least 30 reviews, and gives a "100% uptime" seal to hosts with no downtime that year. A badge adds +1 T for the following year.

## 7. Where it shows

- Market app, Competitors tab: share per city over time as a stacked area, and a table of rivals with scores, tier, stars and customers.
- News and mail: rival outages, openings, closings, acquisitions, HOSTtoast tier changes and awards.
- Books: the HOSTtoast fee as its own ledger line.

## 8. Build order

1. Rivals in state with drift (sections 1 and 2) and the Market app table and chart.
2. Small rivals, entry and exit, and rival reviews (sections 3 and 4).
3. HOSTtoast: site, tiers, sign-up and tier actions, audit, rivals' tiers, awards (section 6).
4. Saturation and switchers (section 5), after a balance run.

Each step is a pull request with a seeded test; `npm run balance` runs after steps 1 and 3 to check the player's share in the first two years stays within 2 points of today's.
