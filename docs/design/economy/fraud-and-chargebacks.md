# Fraud and chargebacks

A small share of standard orders is paid with a stolen card or a stolen PayPail account. Sales leads are never fraudulent. The share is rolled once per order:

| Product | Share of shop orders |
| --- | --- |
| GPU servers | 6% |
| VPS and cloud | 5% |
| Dedicated servers | 4% |
| VPN | 3% |
| Game servers | 2% |
| Web hosting | 1% |
| Everything else | 0.5% |

| Years | Factor |
| --- | --- |
| 2005 to 2009 | 1 |
| 2010 to 2016 | 1.3, as online card payments spread |
| 2017 and 2018 | 2, while crypto mining pays for stolen servers |
| From 2019 | 1.2, after strong customer authentication |

An order by email pays its invoice by bank transfer and carries a fifth of the share.

**The fraudster.** The customer pays every invoice on time and behaves like a shady customer ([Notices and legal requests](notices-and-legal-requests.md)): abuse reports, copyright notices, legal requests and spam from their addresses. 30 to 60 days after signing up the card holder disputes the payments.

**Chargeback.** Every paid invoice of the customer is taken back from the account and written off, PayPail charges a €15 fee, and the customer and their services are gone.

**PayPail.** On the first of each month PayPail counts the chargebacks of the last 90 days. With at least 3 chargebacks that are more than 1% of the invoice payments in the same window, the first month brings a warning. A second month in a row brings a €250 monitoring fee every month and raises the chargeback fee to €25. A month below the line clears both.

**Order review.** The setting Review server orders by hand holds VPS, cloud, GPU and dedicated orders for staff, also with order automation on: they arrive in Support like orders without automation and run step by step. The account step takes 10 minutes more and declines 70% of the fraudulent orders and 3% of honest ones, who go elsewhere.

**Order screening.** The skill Fraud screening (from 2008) adds the setting Screen orders with MaxMined. The scoring service MaxMined scores every standard order when it arrives, by email, form or shop; sales leads skip it. It declines 80% of the fraudulent orders and 1% of honest ones, which count as lost sales with the reason Declined. It takes no staff time and leaves order automation running. Each check costs €0.08 in 2026 with m = 2 (about €0.15 in 2008), billed on the first of the month as one fee line. With order review on as well, review only sees the orders the screen let through, so 94% of the fraud on server orders is caught and about 4% of honest server orders are declined.

The balance model takes two months of payments and the fee off the revenue of each fraudulent signup and never reviews or screens orders.
