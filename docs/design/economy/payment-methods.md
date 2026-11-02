# Payment methods

A shop system takes payment at checkout. Bank transfer is always offered; every other method is a module bought once on the shop vendor's site, registered with its licence key in Books and switched on or off in the shop. The code keeps the numbers in `src/sim/10-catalog/payments.ts`.

| Method (real one) | From | Module | Fee per payment | Paid | Side effect |
| --- | --- | --- | --- | --- | --- |
| Bank transfer | 2005 | none | none | by the customer's habit, matched in Books | dunning as in Billing and payment habits |
| Direct debit | 2005 | €49 | €0.35 | collected at checkout, weekly payout from the shop system | a bad payer's debit returns when their invoice would have paid late, with a €3 fee, 3 to 7 days after the payout |
| PayPail (PayPal) | 2005 | €49 | 1.9% + €0.35 | prepaid at checkout, weekly payout | 1% of payments are disputed 5 to 20 days after the payout; the money is held 30 days, then comes back |
| Visor (Visa) | 2006 | €199 | 2.9% + €0.30 | collected at checkout, weekly payout | 0.5% of honest payments are charged back 7 to 90 days after the payout with the chargeback fee; stolen cards (below) charge back fully |
| paysavecard (paysafecard) | 2007 | €99 | 10% | prepaid at checkout, weekly payout | twice the base churn of the profile |
| Instantly (Sofortüberweisung) | 2008 | €49 | 0.9% | the customer's own transfer arrives at checkout with the exact amount and invoice number | none |
| Bitcorn Pay (Bitcoin) | 2012 | €99 | 1% | prepaid at checkout, weekly payout | three times the abuse ticket and real notice rate for each customer paying this way |

**Preferences.** Each shop order draws the method its customer wants first, from the weights of its profile over the methods that exist that year. Customers from the other side of the Atlantic and shady customers use their own rows.

| Crowd | Transfer | Debit | PayPail | Card | paysavecard | Instantly | Crypto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Private individual | 45 | 10 | 35 | 5 | | 5 | |
| Gamer | 15 | | 35 | 10 | 35 | 5 | |
| Hobby developer | 25 | | 35 | 25 | | 5 | 10 |
| Sole proprietor | 50 | 25 | 15 | 10 | | | |
| Small business | 45 | 30 | 5 | 20 | | | |
| Agency or startup | 40 | 15 | 10 | 35 | | | |
| Doctor's or law office | 50 | 40 | | 10 | | | |
| Online shop | 35 | 30 | 10 | 25 | | | |
| Enterprise | 60 | 25 | | 15 | | | |
| International | 10 | | 30 | 60 | | | |
| Shady | | | | 20 | 20 | | 60 |

**Missing method.** When the shop does not offer the wanted method, half of the orders go through by bank transfer and the rest are lost sales with the reason that names the method. paysavecard and crypto customers never switch. Email orders always pay by bank transfer.

**Prepaid.** PayPail, paysavecard and crypto invoices are paid at checkout, so Books never sends a reminder or suspends for them; neither do direct debit and card, whose money the shop collects at checkout. Each gateway pays out on Monday at 09:00 as one transfer per method, less its fees, with a reference listing the invoices; Import from shop or Shop link books it.

**Money taken back.** Returns, disputes and chargebacks arrive in Books as negative transfers of the invoice amount plus the fee. Matching one to its paid invoice reopens it: a disputed invoice waits for the released money, a returned or charged-back one is due again by bank transfer under the dunning steps. Match by reference books them on its own. A chargeback on a stolen card marks the customer as fraud and suspends their services when it is matched.

**Stolen cards.** Through a shop only card orders can be fraudulent, at the shares in Fraud and chargebacks below; their chargeback 30 to 60 days after signing up arrives as one negative transfer per paid invoice instead of the automatic write-off.
