# Shop systems

Variants, licences, module prices and stock rules are in `shop.md`, section 2.3. The research "Shop systems" costs 60 know-how and 4 days. Shop licences are billed with marketing on the 1st.

### Billing cycles

A shop sells its products for a month, a quarter, a year or two years. A longer cycle is billed in advance at N times the monthly price less the cycle's discount. ModemBill sells monthly, quarterly and annual, OrderBocks adds biennial and the other systems sell all four.

| Cycle | Months | Market discount |
| --- | --- | --- |
| Monthly | 1 | 0% |
| Quarterly | 3 | 3% |
| Annual | 12 | 10% |
| Biennial | 24 | 15% |

A shop order draws its cycle from the profile's base shares (`CYCLE_SHARE` in `cycles.ts`: a private customer takes monthly 78%, quarterly 10%, annual 11%, biennial 1%; an enterprise 20, 10, 50, 20). Each offered non-monthly cycle's weight is its base share times `exp(8 * (d - m))`, where `d` is the discount the player sets and `m` the market discount; the weights are normalised over the offered cycles. Ten points above the market's discount multiplies a share by 2.2, ten below by 0.45. Cycles the player has not priced use the market discount.

Lead conversion for shop orders reads the advertised price level: the line's rate against the market for its middle size, times the weighted cycle price against the same weighting at market discounts. A changed rate or discount reaches new leads at once, where the sold-services index follows only after sales.

A customer inside a paid term skips the monthly churn roll unless happiness is below 15. In the month before the term ends the customer rolls once with `min(0.9, N * base) + 0.5 * max(0, (50 - H) / 50)`, where `base` is the profile's monthly churn and `N` the term months. A customer who leaves inside a paid term, with no invoice open, gets the unused whole months back as a ledger entry.

A renewal invoice for the next term goes out at the month start before a term ends, at the service's current price. Paying it extends the term by N months. A prepaid service has no monthly arrears lines.

The balance model takes the annual share of shop orders as a revenue discount.
