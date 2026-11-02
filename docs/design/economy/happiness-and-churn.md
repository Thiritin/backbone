# Happiness and churn

Every customer has a happiness value H from 0 to 100. Events move it up and down, it slowly drifts toward how good your offer is compared with the best competitor, and it sets the chance of cancelling at each renewal. New customers start at 70; the three starting friends start at 85.

**Events.**

| Event | Change to H |
| --- | --- |
| Ticket still open past the expected reply time | − wait penalty per hour that counts on the customer's clock (profile table) |
| Ticket closed with the right answer | +5 |
| Right first answer within 2 hours of the ticket opening | +2 |
| Ticket closed with a wrong answer | −10, plus a follow-up ticket |
| An hour of outage on one of their services, once the outage has outlasted their tolerance | − outage penalty per hour that counts on the customer's clock (profile table) |
| Credit issued | +3 per 10% of the monthly fee |
| A month in which every service kept its SLA uptime | +2, at the monthly billing date |
| Price raised | −1 per 1% of increase, more past the customer's maximum (Price tolerance) |
| Price lowered | +0.2 per 1% of decrease, at most +10 |

**Drift.** On each monthly tick H moves a fifth of the way toward a target set by your value U against the best competitor's:

```math
H \leftarrow H + 0.2\,(H^{*} - H), \quad H^{*} = \operatorname{clamp}\big(70 + 0.5\,(U_{you} - U_{best}),\ 20,\ 95\big)
```

**Churn.** At each renewal the customer cancels with this probability. Monthly contracts renew monthly. Yearly contracts renew once a year and use 12× the monthly base churn.

```math
P(\text{cancel}) = \text{base} + 0.5 \cdot \max\left(0,\ \frac{50 - H}{50}\right)
```

A customer whose happiness falls below 15 leaves at the next monthly billing date, even on a yearly contract. Every cancellation arrives as a ticket first.

**Retention offers.** A cancellation ticket offers eight options, each with its own chance of keeping the customer. Every chance starts at (H − 10) %, so 50% at H = 60, and is then adjusted by the cancellation reason and the customer's profile, then clamped to 5% to 95%. There is no happiness floor: a customer at H = 5 stays about a third of the time for a strong offer, because the player pays for it.

| Option | Cost | Price reason | Outage or slowness reason | Private customer | Business |
| --- | --- | --- | --- | --- | --- |
| 50% off the next month | 0.5 × monthly bill, credited at once | +30% | −20% | +10% | |
| One month free | 1 × monthly bill, credited at once | +30% | −20% | +10% | |
| 20% off for 3, 6 or 12 months | 0.2 × months × the hourly services' monthly bill | +30% | −20% | +10% | |
| Free upgrade | The market price of the extra resources for a month, never charged | | | | |
| Apology and fix promise | None | | +30% | | |
| Move to a better server | None; a hand task and the downtime of the move | −10% | +30% | | +10% |

The reason is the ticket's topic. A cancellation that comes from a price raise carries Price. A cancellation from the monthly churn roll carries Outage when a service of the customer is down or an outage ticket of theirs was written in the last month, Slowness when the last such ticket was about slowness, Price when an hourly service costs more than the customer finds fair (Price tolerance), and no reason otherwise. Private customers are all profiles outside the business segment (small business, agency, office, online shop, enterprise).

The player sees each option as a card with its cost and the word for its chance: Unlikely below 40%, Even from 40% to below 60%, Likely from 60%. An option the customer cannot take is left out: every option when a service stays above the customer's maximum price after the option (a free month counts as a twelfth off the monthly price, half a month as a twenty-fourth, the discounts as a fifth); the upgrade when the service has no room on its server for one size up (1.5 times every resource; the node must hold the extra RAM and disk, a web space needs the disk in its panel VM); the fix promise unless the reason is outage or slowness; the move unless a host in a datacenter location, other than the current cluster, can take the service.

A credit raises happiness by 30 per share of the monthly bill (+15 for half a month, +30 for a month). Every other option that keeps the customer adds 10, and a kept customer's ticket also earns the +5 for a resolved ticket. The customer rolls the chance once the player's 15 minutes of work are done. A failed roll cancels the contract at once and the ticket shows "Offer refused, contract cancelled".

A discount changes the price of every hourly service of the customer through an agreed price change, which costs no happiness. The price returns at the Nth month start after the offer. A price the player set during the discount stays; only an untouched discounted price returns to its old value. A free upgrade raises the service's spec and its workload's booking and leaves the price unchanged. A move sends the customer a migration offer they have already accepted: the move runs in the customer's window like any accepted migration and gives the basement bonus when it leaves the basement.

The apology waits three days. The ticket stays open as waiting, the monthly run does not process it, and the player cannot act on it. After 72 hours the customer checks: if any service behind the ticket is down or slow, the contract is cancelled and the ticket shows "Fault still present, contract cancelled". Otherwise the customer stays with the chance computed at that time.

Staff on a cancellation offer the cheapest option whose chance is at least 40%, the cost being the one in the table (an upgrade costs its notional market price, so an apology or a move wins a tie). When none is at least even, they process the cancellation.

**Price tolerance.** Every customer has a maximum monthly price per service, hidden from the player:

```math
\text{max} = \text{market} \times \text{cap} \times t, \qquad t \in [0.9,\ 1.2]
```

The cap is the highest competitor price factor a profile still considers in Customer choice (1.3 for low budgets, 1.6 for medium, 2.5 for high), and t is drawn once per customer from the game seed. The fair price is the market price, or the profile's usual offer from Sales and quotes when that is higher (1.3 × market for high budgets). Both use the higher of this year's market price and the market price in the year the customer signed, so falling hardware prices never turn an old contract into an overpriced one.

| Rule | Value |
| --- | --- |
| Raise, any size | −1 H per 1% over the previous price |
| Raise, part above the maximum | another −2 H per 1% the new price goes further past the maximum |
| Raise past the maximum | a cancellation ticket with a chance of (price ÷ max − 1) ÷ 0.3, certain from 30% past |
| Monthly, above the fair price | −0.1 H per 1% over the fair price |
| Monthly, above the maximum | another −1 H per 1% over the maximum |
| Complaint after a raise of 5% or more | a chance of 1/40 per 1% of the raise, plus 0.5 past the maximum |
| Monthly complaint while a raised service is above the fair price | a chance of 0.5 × (price ÷ fair − 1), plus 0.3 past the maximum |

The monthly cost uses the customer's worst-priced monthly service and is taken before the churn roll. A complaint is a billing ticket ("The new price is too high"). The right reply explains the new price. A 10% credit settles it as usual, and reverting puts the service back on its price from before the run of raises, with the happiness gain of a price cut. Only one price complaint per customer is open at a time.

A 5% raise inside the maximum costs 5 happiness once and about 0.5 a month while the price stays above the fair one, which the drift toward 70 absorbs. Raising a €2 service to €10 costs all happiness at once, so the customer cancels and refuses any retention offer. Repeated small raises past the maximum lower H by 10 or more each month until the customer leaves within a few months.

In the balance model, cohorts take the same monthly cost at the bot's price factor with t at its mean of 1.05. The standard bots price at 0.8 × market and are unaffected. A probe bot at 1.2 × market ends year 5 with 39 customers instead of 43 and year 10 with €6,817 MRR instead of €7,017; at 1.4 × market it ends year 10 with 42 customers instead of 61.

**Upgrades.** Each month a customer outgrows their service with a 2% chance at low budget, 3% at medium and 4% at high budget, which creates an upgrade ticket.

**Customer clocks.** Each profile keeps one of two clocks. On business hours (Monday to Friday, 9:00 to 17:00, the same hours staff work) only those hours count; one business day is 8 business hours. Around the clock, every hour counts. A ticket is due once the reply time has passed on the customer's clock, so a ticket written Friday at 16:00 by a customer who expects a reply within one business day is due Monday at 16:00. The wait penalty only accrues in hours that count, so business-hour customers do not mind a ticket left overnight or over the weekend.

An outage goes unnoticed for the tolerance, counted on the same clock from the hour the service went down. After that each counting hour costs the outage penalty, and in the first such hour the customer may write in (30%, 60% or 90% by budget, three tickets at high budget). A private customer whose site drops on Friday evening tolerates two business days and asks on Wednesday morning; an online shop notices at once, at 3 a.m. on a Sunday too. Businesses that care around the clock are the reason to run AI bots or staff on nights.

**Profile values.** Priority support shortens the promised response to 4 hours, or 1 hour for high-budget profiles.

| Profile | Base churn per month | Outage penalty per hour | Wait penalty per hour | Reply within | Outage tolerance |
| --- | --- | --- | --- | --- | --- |
| Private individual | 2.5% | 1 | 0.3 | 2 business days | 2 business days |
| Gamer | 4.0% | 4 | 0.3 | 1 business day | 1 hour, around the clock |
| Hobby developer | 3.0% | 2 | 0.3 | 2 business days | 2 business days |
| Sole proprietor | 1.2% | 2 | 0.6 | 1 business day | 3 business hours |
| Small business | 1.0% | 3 | 0.6 | 1 business day | 2 business hours |
| Agency or startup | 1.5% | 4 | 0.6 | 1 business day | 2 business hours |
| Web developer | 0.8% | 4 | 0.6 | 1 business day | 2 business hours |
| Doctor's or law office | 0.6% | 8 | 1.5 | 4 business hours | 1 business hour |
| Online shop | 0.8% | 10 | 1.5 | 4 hours, around the clock | none |
| Enterprise | 0.4% | 15 | 1.5 | 4 hours, around the clock | none |

Private customers and hobbyists use their sites in the evening and forgive a weekend. Gamers play at night, so a game server that is down for more than an hour hurts at any time. Businesses notice an outage during their own office hours within a morning. Shops sell and enterprises run around the clock, so they expect fast replies at night and notice every minute offline.

**Balance model.** The monthly model has no hour of day. It turns a business-hours window into calendar hours by dividing by the share of business hours in a week (40 of 168), so 1 business day counts as about 34 hours. An around-the-clock customer adds the average wait for the office to open (about 15 hours: four 16-hour nights and a 64-hour weekend), since the bot runs no night shift. The steady bot hires a bookkeeper when the late payments nobody chases are worth more than the salary.

**Planned maintenance.** An outage on a machine covered by a window the customer was told about at least 24 hours ahead costs no happiness, writes no outage ticket and adds no hours down to the month, so it earns no SLA credit. Work that runs past the window counts as a normal outage from the window's end, noticed from that hour on. A window announced less than 24 hours ahead keeps half of every penalty: half the happiness loss, half the chance of a ticket and half the hours down. Online shops ask to move a window that touches a weekday between 08:00 and 20:00, and gamers decline a window that starts on a Friday or Saturday night (17:00 to 09:00); neither is covered by it until the window is moved, so their outages cost the full penalties. Moving a window is free and starts the 24 hours of notice again.


Shared links without an expiry that are older than 90 days leak with a monthly chance of 0.015 (0.003 with a password) and cost the customer 20 happiness. The expiry policy of 7, 30 or 90 days trades these leaks for extension tickets.

**Game titles.** A faded title costs no happiness. Its players online fall to `max(0.15, 0.7 ^ (year - fade))` of normal, and once a month its servers shrink to the slots their busiest hour of the week needs, at a price scaled down alike. A quarter of its customers, picked by seed, stay for good. The rest ask to move to the current title of the same genre with a monthly chance of `0.04 * (year - fade)`; declining, or leaving the request a week, ends that game server, and the customer leaves when it was their last service. Writing a game config costs 400 on TCAdmen and 200 on Pterodaktyl.
