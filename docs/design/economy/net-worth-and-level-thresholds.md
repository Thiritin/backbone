# Net worth and level thresholds

Net worth values the customer base at two years of recurring revenue, plus cash and hardware, minus debt. The thresholds below match the pacing targets: €400 of monthly revenue reaches level 2, and €1 million reaches level 6.

```math
\text{net worth} = \text{cash} - \text{debt} + \text{hardware book value} + 24 \cdot \text{MRR}
```

Hardware book value is the resale value of every owned device and rack: 100% to 80% over the first month, then down to 20% over the next 24 months. Leased devices count for the lessor, not for you. MRR is every running contract's monthly price: hourly prices × 730 and yearly prices ÷ 12. The start counts €1,000 cash, €2,910 of hardware and 24 × €18 of the friends' revenue, about €4,340.

The GDD counts years in operation inside net worth. Here they are a separate minimum per level instead, which keeps the formula simple and stops a lucky first year from skipping ahead.

| Level | Name | Net worth | Years in operation |
| --- | --- | --- | --- |
| 1 | Basement Hoster | Start | 0 |
| 2 | Garage Hero | €15,000 | 0 |
| 3 | Rack Renter | €100,000 | 1 |
| 4 | Cage Fighter | €750,000 | 3 |
| 5 | Room Service | €5,000,000 | 5 |
| 6 | Datacenter Baron | €30,000,000 | 8 |

A company whose net worth stays below 80% of its level's threshold for 6 months drops one level, and customers who require the old level stop renewing.
