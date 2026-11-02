# Noticing outages

Code: `src/sim/10-catalog/attention.ts`. A customer notices an outage when the hazard summed over its hours passes a threshold drawn per outage (exponential, mean 1). The hazard of an hour is the segment's attention at that hour (0 to 1) times its sensitivity, times a private customer's own pace. An outage hurts only from the hour it is noticed: the outage penalty in every counted hour after, and the outage ticket chance in that hour. Saturated datacenters and grid outages weigh by attention too: the saturation penalty and ticket chance scale with the hour's attention, and a grid outage brings refund requests and reviews only from customers who noticed its dark minutes.

| Segment | Who | Sensitivity | Attention |
| --- | --- | --- | --- |
| Game | Every game server | 3 | Evenings 0.9 from 19:00 (1.0 on Friday and Saturday, the nights before a free day), 0.05 during work hours, 0.5 on free days, 0.01 from 02:00 to 09:00 after a work night, 0.6 at 02:00 falling to 0.01 by 05:00 after a free night |
| Business | Small business, agency, office, online shop, enterprise | 2 | 1.0 from 08:00 to 18:00 on workdays, 0.02 at night, 0.1 on weekend days |
| Private | Everyone else | 0.015 | 0.3 at 07:00, 0.5 at noon, 1.0 at 18:00, 0.05 at midnight, 0.01 at 02:00 |

A private customer's pace is log-normal with spread 0.8: the median takes about three and a half days, about one in six notices within half a day, one in four takes ten days or more and one in ten twenty days or more. A game server outage from 04:00 on a Tuesday lasting two hours goes unnoticed more than nine times in ten, so night maintenance on game servers is safe; one at 21:00 on a Saturday is noticed within the hour.
