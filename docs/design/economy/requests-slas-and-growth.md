# Requests, SLAs and growth

**Price.** A request pays the market base rate for its resources × the profile's offer × the SLA factor × the feature factor. Fixed-price products such as web hosting use their fixed price instead of the base rate. The hourly rate is the monthly price ÷ 730.

**Features.** Each wanted feature you offer adds 5 to the customer's value U (at most 15) and its price share below. A required feature you don't offer turns the request away.

| Feature | Price share |
| --- | --- |
| High availability | +30% |
| Replicas | +15% per replica beyond the first |
| Spread across racks | +5% |
| Spread across locations | +15% |
| Backups | +20% |
| DDoS protection | +10% on-demand, +25% always-on |
| Private network | €5 a month (m = 1) |
| Two carriers | +5% |

**Shop price setting.** Budget multiplies prices by 0.85 and premium by 1.2. Budget adds 10 to U for low-budget profiles and premium adds 10 for high-budget profiles; each costs the other end 10.

**Commitment and billing.**

| Product | Minimum term | Billed |
| --- | --- | --- |
| Cloud servers, load balancers | None | Hourly, monthly in arrears |
| Web hosting, VPS, game servers, managed databases, Kubernetes, DNS hosting | 1 month | Hourly, monthly in arrears |
| Dedicated servers, colocation | 12 months | Hourly, monthly in arrears; colocation power by the kWh |
| Object storage, CDN, traffic overage | None | Per TB, monthly in arrears |
| Domains, SSL certificates | 12 months | Yearly in advance |

| SLA | Uptime per month | First response | Price factor | Credit when missed |
| --- | --- | --- | --- | --- |
| Basic | 99.5% | 48 h | 1.0 | None |
| Business | 99.9% | 8 h | 1.2 | 10% of the monthly bill |
| Premium | 99.99% | 1 h | 1.5 | 25% of the monthly bill |

Hours a service is down are left off its invoice line. When the hours up fall below the SLA's uptime, the invoice adds a credit line for its share of what was billed for that service. Hours down while the customer is suspended count as up.

**Handling a request.** Answering a request by hand takes 8 minutes of the player's or a sales agent's time. A request waits 3 days, then the customer goes to a competitor. The shop answers instantly while the target cluster's busiest resource stays under the limit you set (80% by default).

**Growth.** A customer grows a set share each year until it reaches its ceiling: 10% a year for low budgets, 25% for medium and 40% for high. A startup (a third of agencies) grows 150% a year and has a 20% chance each year of shutting down. When usage passes 85% of what the customer rents, it sends an expansion request for double its size, capped at its ceiling.

**Cloud quotas.** A cloud customer's usage averages 40% of its quota and peaks at 80% during its busiest hours. It pays per hour used, at the base rate × 1.25 ÷ 730. When its peak passes 80% of the quota, it asks for a 50% to 100% higher quota with a reason drawn from its profile.
