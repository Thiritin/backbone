# Staff: salaries, skill growth and quitting

A junior support agent hired in 2005 costs the company about €2,600 a month. A senior asks about 37% more, which is less than the gap in work rate, so juniors win only if they stay.

**Salary** at hiring, per year and including employer costs, for a candidate with skill s:

```math
\text{salary} = \text{role base}(y) \cdot 1.29 \cdot \left(0.85 + 0.6 \cdot \frac{s}{100}\right)
```

Role bases are 2026 gross salaries, scaled back with the salary multiplier from [Prices over time](prices-over-time.md). The accountant figure is an estimate; the rest come from the GDD's Prices section.

| Role | Role base, 2026 (gross per year) |
| --- | --- |
| Support agent | €42,000 |
| Technician | €47,000 |
| Network engineer | €60,000 |
| Kubernetes engineer | €72,000 |
| Sales agent | €40,000 |
| Bookkeeper | €38,300 |
| Accountant | €50,000 |
| Marketing manager | €45,300 |

**Skill growth.** Skill rises 12 points a year in the first two years, 6 a year in years 3 to 5, and 2 a year after that. Each employee has a hidden talent cap between 60 and 100 that skill never passes.

**Hiring.** A standard job ad costs €500 (2026) and brings 3 candidates over two weeks; a premium ad costs €2,000 and brings 8. 60% of candidates are juniors (skill 10 to 35), 30% mid-level (35 to 65) and 10% seniors (65 to 90).

**Raises and quitting.** Once a year each employee asks for 3% plus whatever closes the gap to the market salary for their current skill. Each month an employee quits with this chance:

| Condition | Monthly chance to quit |
| --- | --- |
| Always | 0.5% |
| Paid below 85% of the market salary for their skill | +3% |
| Raise refused in the last 6 months | +5% |

A raise request left unanswered for 30 days counts as refused. Salaries are billed on the first of each month for the month before, prorated for the days employed, and a fired employee is paid for the days worked that month.

**Job market.** Every month each role gets 2 open applications, and every candidate stays on the market for 30 days. Job ads add their candidates on top. Ads, courses and salaries are booked as salaries and follow the salary multiplier.

**Training.** Each task type is a separate course. A course costs €250 (2026, about €150 in 2005) and takes 2 days. With a trainer of the same role the course is free and takes 1 day. Employees in training and trainers do no other work.

| Role | Task types |
| --- | --- |
| Support agent | How-to, billing, outage, upgrade, cancellation, abuse, suspension appeal |
| Bookkeeper | Payment reminders, sending invoices, matching payments |
| Accountant | Dunning notices, final notices |
| Marketing manager | Campaigns, review platforms, trade fairs |

**Staff at work.** Staff work Monday to Friday from 9 to 17; holidays and sick days come later. A support agent picks the right reply with P(right) from the work rate and a wrong template otherwise, offers retention on cancellations, and unsuspends appeals that have no right reply. Collections stays with the player and the billing rules, and payments record themselves.

**Forum posts.** An employee assigned to the forums brings 2 × (0.5 + s/100) leads a month and does no other work.

**Marketing manager.** Review platforms with a fee need one on staff; without one, the platform falls back to the free listing at the month start before billing. The best manager trained on campaigns who works the queue and is not at a fair multiplies every campaign's leads by 1.05 + 0.1 × s/100. One trained on review platforms multiplies the invite rate by 1.5.

**AI bots.** A bot works every hour of the day, staff first during office hours and the bots after them. Clipsy is a Pear One subscription; the generative AI agent comes with a hosted desk's AI add-on from 2023 (see Desk AI usage) and answers only tickets the desk holds.

| Bot | Base per month (2005) | Handles |
| --- | --- | --- |
| Zendusk AI agent, Freddie AI Agent | €50 add-on plus usage, from 2023 | How-to and billing tickets |
| "Clipsy Reminders" | €100 | Payment reminders |

A bot works at 2 × the base rate (a skill-50 human works at 1 ×) and never gains skill. The AI agent picks the right reply with P = 0.6 on how-to tickets and P = 0.5 on billing tickets. Each reminder a bot sends makes the customer open a billing ticket with a 5% chance. Each bot task causes an incident with a 0.2% chance: the customer loses 15 happiness and opens a billing ticket, and the Staff app reports one of five absurd lines. A bot that handles 500 tasks a month causes about one incident a month.

### Desk AI usage

The AI agent bills every reply it sends in tokens, and reply drafting bills every draft the same way, on top of the €50 monthly add-on. The month's usage becomes one "Desk AI" ledger line on the first of the next month, booked under the AI usage Finance category next to the add-on line. Old saves keep their "ChadGPT usage" lines. A reply rereads the whole thread, so a retry costs more than the first answer:

```math
\text{tokens} = (6{,}000 + 3{,}000 \cdot r) \cdot 1.18^{\,y - 2005}
\qquad
\text{price per 1M tokens} = €280 \cdot 0.85^{\,y - 2005}
```

Here r is the number of replies already in the thread and y the year, held at 2026 after 2026. The price per token falls 15% a year, like real model prices, while each model generation reads and reasons 18% more per reply. A reply therefore costs about the same in every year: €1.68 for a first reply and €2.52 for the second in 2005, €1.79 and €2.68 from 2026.

| Year | Price per 1M tokens | First reply |
| --- | --- | --- |
| 2005 | €280 | 6,000 tokens |
| 2010 | €124 | 13,700 tokens |
| 2015 | €55 | 31,400 tokens |
| 2020 | €24.50 | 71,800 tokens |
| 2026 | €9.20 | 194,000 tokens |

**Retries.** A wrong reply brings a follow-up in the same thread, and the AI agent answers it again. After 4 replies of its own on one ticket it leaves the ticket in the queue for staff and the player, and the customer loses 10 happiness for the runaround on top of the 10 for each wrong reply.

| Kind | P(right) | Replies per ticket | Solved by the agent | Replies per solved ticket | Cost per solved ticket, 2008 | Share of an agent's |
| --- | --- | --- | --- | --- | --- | --- |
| How-to | 0.6 | 1.62 | 97% | 1.67 | €3.62 | 42% |
| Billing | 0.5 | 1.88 | 94% | 2.0 | €4.63 | 53% |

**Against a support agent.** The reference is a full-time skill-50 support agent whose salary is spread over the tickets they solve in a month at full load: 140 hours at 3.16 tickets an hour with P(right) = 0.875, about 387 solved tickets, which is €8.05 a ticket in 2005 and €11.05 in 2018. From 2006 to 2018 a solved ticket from the agent would cost 34% to 44% of that on how-to tickets and 43% to 56% on billing tickets; from 2023, when the desks offer it, 28% to 30% and 36% to 39%, since the share falls slowly as salaries rise. One agent has room for about 5,000 replies a month, so a company with many customers, an outage or a price rise pays a five-figure monthly bill.

**Technicians.** A technician costs the technician role base above (€47,000 in 2026) and does one operation per office hour, so at most 40 a week, at their location. Skill sets the salary and does not change the work rate, because every operation fills its hour. Against remote hands at €120 an hour, a technician at a datacenter pays off from about 25 swaps a month; in the basement the gain is only the time the player saves.

| Operation | Training | Operations |
| --- | --- | --- |
| Replace a part that swaps while running | Parts and power | 1 |
| Replace a part that needs the device off | Parts and power | 3 (shut down, swap, start) |
| Shut down or start a device | Parts and power | 1 |
| Drain a cluster node, however many VMs it holds | Draining servers | 1 |
| Upgrade one node to the current PHP | PHP upgrades | 1 per node |

A technician's swap takes 15 minutes, the same as the player's in the basement, and bills no remote hands. The repair rule for failed parts queues at most one swap per spare of that kind in the zone's storage.
