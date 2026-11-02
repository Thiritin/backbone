# Tickets and work rates

A low-skill customer creates about 0.15 tickets a month, so one average support agent keeps about 2,800 of them answered. Every job in the game, from tickets to cabling, is a task with a handling time, and staff work through tasks at a rate set by their skill.

**Ticket rates** per customer per month, by technical skill:

| Ticket type | Low skill | Medium skill | High skill | Handling time |
| --- | --- | --- | --- | --- |
| How-to question | 0.09 | 0.03 | 0.01 | 20 min |
| Billing question | 0.02 | 0.02 | 0.01 | 15 min |
| Abuse report | 0.0025 | 0.0025 | 0.01 | 30 min |
| Upgrade request | From upgrades ([Happiness and churn](happiness-and-churn.md)) | | | 20 min |
| Cancellation | One per cancellation | | | 15 min |
| Suspension appeal | From suspensions ([Billing and payment habits](billing-and-payment-habits.md)) | | | 15 min |
| Outage report | Per outage (below) | | | 10 min |
| Colocation install | One per hardware delivery | | | 2 h (technician) |

Gamers create abuse reports at 0.01, like high-skill customers. Each payment reminder also has a 10% chance to create a billing question.

**Outage tickets.** When an outage hits a customer, they write in with a 30% chance at low budget, 60% at medium and 90% at high budget. High-budget customers write 3 tickets, everyone else 1. A public status page halves the chance.

**Unanswered tickets.** A ticket still open this many hours after it was due is closed by the customer, with outcome Ignored. The wait penalty has been charged for every counting hour until then.

| Ticket type | Closed after, past due |
| --- | --- |
| Outage report | 72 h |
| How-to question | 5 days |
| Upgrade request, suspension appeal | 7 days |
| Billing question, abuse report, refund request | 14 days |

A ticket someone is working on stays open. Cancellations are processed at the next billing date instead.

**Tenure** changes the how-to rate: customers ask most while they set up, ×2.5 at signup and ×0.85 per month after, down to ×0.15 for settled customers, so a low-skill customer who stays for years writes about once every three years.

**Control panels** change the how-to rate: cPanic ×0.8, Pleskit ×0.9, DirectAdmen ×1.2, FreePanel ×1.5.

**Web space tasks** (`web-hosting.md`, Customer behaviour on top of it). Each web hosting customer on a panel host wishes for a new database at 0.02 a month, a new mailbox at 0.02 and an FTP login for a helper at 0.015, rolled once a day, and only while no task or upgrade ticket of theirs is open. The wish becomes a how-to ticket that names the database, mailbox or FTP account; the ticket has no replies and closes by itself in the hour after the web space has it, a database once a user holds privileges on it. A wish the package has no room for becomes an upgrade request instead, which goes to Sales like any other. A site the player broke by deleting its config file or its database is reported by a visitor with a 25% chance each hour, and that ticket closes once the app runs again. A defaced site carries one PHP shell in its app's upload folder, and deleting it in the File Manager cleans the site like a restore.

**Work rate.** A worker with skill s (0 to 100) finishes tasks of handling time t minutes at this rate and gets each one right with the given chance:

```math
\text{tasks per hour} = \frac{60}{t} \cdot \left(0.5 + \frac{s}{100}\right), \qquad P(\text{right}) = 0.75 + 0.25 \cdot \frac{s}{100}
```

Staff work 8 hours a day, Monday to Friday, with 30 days of holiday and about 10 sick days a year. The player works whenever they click and is always right if they pick the right answer.

**Other tasks.**

| Task | Who | Handling time |
| --- | --- | --- |
| Install a server or switch | Technician | 1 h |
| Run one cable | Technician | 10 min |
| Repair a failed device, spare in stock | Technician | 2 h |
| Set up a port | Network engineer | 15 min |
| Set up a peering session | Network engineer | 2 h |
| Sign a transit contract | Network engineer | 1 day |

**AI support bot.** It works 24 hours a day at 10× the rate of a skill-50 agent, is right 85% of the time, never improves, and only takes how-to and billing questions. It costs €1,500 per month when it unlocks.


Bucket requests: each month a storage service raises a request to make a bucket public with probability 0.06. Approving gives the customer +3 happiness, declining by closing the ticket costs 2, and closing a public bucket again costs 1. A public bucket has a 0.04 monthly chance of exposing its files, which costs 25 happiness. Shared links: OwnClod customers hand out about half a link per user each month; an expired link has a 0.10 chance of a request to extend it.
