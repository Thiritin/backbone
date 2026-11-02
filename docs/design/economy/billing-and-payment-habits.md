# Billing and payment habits

Invoices are due 14 days after they go out. Most customers pay on time, and the rest only pay once the matching dunning step is sent. A step the player never sends means that money never arrives while the service keeps running.

**Payment habits** by budget. Each invoice rolls once against this table to decide which step makes the customer pay.

| Budget | On time | After reminder | After first dunning notice | After final notice | Never |
| --- | --- | --- | --- | --- | --- |
| Low | 82% | 10% | 4% | 2% | 2% |
| Medium | 90% | 6% | 2% | 1% | 1% |
| High | 65% | 30% | 4% | 1% | 0% |

**Fees and collections.** The first dunning notice adds a €5 fee and the final notice €10. A debt handed to collections returns 30% of its value 30 days later, and the customer is gone.

**Suspension.** Suspending a customer costs 15 happiness and opens a billing ticket. While suspended, the customer pays with a 35% chance each day, or 20% with a bad payment habit. A bad payer still suspended after 14 days leaves with a 50% chance, and the debt goes to collections.

**Suspension of high-budget customers.** Offices, online shops and enterprises lose 30 happiness instead of 15 and pay with a 60% chance each day. With a 60% chance their suspension opens a suspension appeal instead of the billing ticket, at most once per invoice.

| Appeal action | Effect |
| --- | --- |
| Unsuspend | Services back online, 7-day payment extension, +15 happiness. The customer pays 1 to 5 days later with an 85% chance; otherwise the suspend rule suspends again when the extension ends. |
| Keep suspended | Services stay offline, −15 happiness. |
| Reply "Await the payment" | Right answer when the customer forgot to pay or the payment is on its way; wrong for the other two topics. |

Resolving the ticket adds the usual +5 happiness on top. Handling an appeal takes 15 minutes.

**Billing rules.** The rules in the Reminders tab of Books send the reminder, dunning and final notices on schedule, suspends after 7, 14 or 30 days overdue, and hands a debt to collections after 42, 60 or 90 days overdue once the final notice is out. Collections starts Off.

**Lexwear modules.** Lexwear sells add-on modules for Books on lexwear.de, each a one-time licence in 2005 euros. The licence key arrives by email a minute after the purchase and turns the module on in Books. Lexwear's newsletter offers each module once, when its count is first reached.

| Module | Price | Does | Newsletter when |
| --- | --- | --- | --- |
| Helpdesk link | €149 | Create quote button on order tickets | 3 domains registered for customers |
| Monthly run | €99 | Sends every draft invoice on the 1st at 09:00 | 10 customers |
| Match by reference | €129 | Books each transfer whose reference names an open invoice and whose amount is exact | 10 transfers matched |
| HBCI online banking | €79 | Pulls the bank statement and pays payables | Never |

The billing rules say what is sent; bookkeepers and accountants carry them out in their work hours, and the Automation research runs all of them. Bookkeepers also send drafts and match transfers, writing off a shortfall below €1, before any reminder in the same hour; a second bookkeeper doubles the rate.

**Time per action.** Every employee action takes time from their workday, so one employee can't carry the whole company. Staff divide these times by their speed (0.5 plus skill/100, so skill 50 takes the times as listed); bots work at twice the speed. The code keeps them in `ACTION_MINUTES` (src/sim/47-staff/activity.ts), and ticket times in `MINUTES` (the ticket table above).

| Action | Who | Time |
| --- | --- | --- |
| Answer or resolve a ticket | Support agent | Ticket handling time above |
| Check an invoice, before every billing action | Bookkeeper or accountant | 6 min |
| Send a draft invoice | Bookkeeper | 5 min |
| Match a bank transfer to its invoice | Bookkeeper | 3 min |
| Send a payment reminder | Bookkeeper | 15 min |
| Send a dunning notice | Accountant | 30 min |
| Send a final notice | Accountant | 30 min |
| Hand a debt to collections | Accountant (final notices) | 30 min |
| Suspend a customer's services | Accountant | 60 min |
| Resume a customer's services | Player | 15 min |
| Run campaigns, for the full boost | Marketing manager | 180 min a workday |
| Look after review platforms, for the full boost | Marketing manager | 60 min a workday, after campaigns |
| Hardware, server or PHP operation | Technician | 60 min |

A billing action is the check plus the action, so a reminder takes 21 minutes and a suspension 66. Staff take one action per invoice per hour, the next dunning step before a suspension, oldest due date first. A marketing manager with fewer hours than a task needs gives that share of its boost: a 2-hour manager gives two thirds of the campaign boost and nothing for reviews. Forum posting scales with hours the same way.

The balance model books 6 staff minutes per customer and month for payments, which matches the times above for a late-paying customer mix. Its steady bot hires a bookkeeper once the late payments left unchased in a month are worth more than a bookkeeper's salary; with that rule none of 20 steady runs goes bankrupt, and level 4 arrives in 2017.6 instead of 2018.5.

**Working hours.** Each employee works their team's shifts: per weekday a start hour and 1 to 12 hours, and a shift may run past midnight. The salary is for 40 hours a week; each hour on shift earns salary / 173, paid at the month start, so pay follows the hours actually worked. An action starts only if it ends within the shift; whatever is left waits for the next shift. Technicians on shift handle operations at their location; when nobody there is on shift, the on-call technician covers.
