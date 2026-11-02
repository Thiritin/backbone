# Usage curves and overcommit

**Packages.** A software installation holds up to 12 named packages (`80-business/packages.ts`). The provision step of an order takes 8 minutes (`orderProvisionPackage`) with a package that covers the ordered vCPU, RAM and disk, and 15 minutes with a custom spec or a smaller package. A package may book as little as 25% of the sold vCPU and 50% of the sold RAM and disk; below that the step fails. A smaller package books less than was sold, and the service keeps using the sold size times its load, so the node slows through the usual contention. Web hosting usernames have 8 characters before 2012 and 16 from 2012, start with a lowercase letter and are unique among services.

**Usage curves.** Each workload's load is a share of its sold size, from 0 to 1, read from its type's curve below. Values between keyframes are straight lines. Each day of the week then scales the curve by its weekday factor below, each service's day strays up to ±15% from it (drawn from the seed per day), and each workload adds ±20% hourly jitter drawn from the seed. Fridays from 18:00 count as weekend for game servers and VPNs.

| Curve | Used by | Weekdays (hour → load) | Weekends (hour → load) | Week average |
| --- | --- | --- | --- | --- |
| Game server | Gamers | 0 → 0.15, 16 → 0.15, 20 → 0.45, 23 → 0.3 | 0 → 0.6, 3 → 0.2, 8 → 0.2, 12 → 0.9, 18 → 1.0, 23 → 0.9 | about 0.35 |
| Online shop | Online shops | 0 → 0.1, 6 → 0.15, 9 → 0.55, 13 → 0.7, 17 → 0.6, 20 → 0.75, 22 → 0.3, 23 → 0.12 | 0 → 0.1, 10 → 0.5, 15 → 0.6, 20 → 0.8, 22 → 0.3 | about 0.4 |
| Blog | A quarter of private individuals | 0 → 0.15, 7 → 0.3, 12 → 0.45, 19 → 0.6, 22 → 0.5, 23 → 0.2 | 0 → 0.2, 10 → 0.4, 19 → 0.55, 23 → 0.2 | about 0.35 |
| News and magazine | Agencies' media clients | 0 → 0.1, 5 → 0.3, 7 → 0.9, 9 → 0.7, 12 → 0.6, 18 → 0.5, 22 → 0.3 | 0 → 0.1, 9 → 0.7, 12 → 0.5, 22 → 0.25 | about 0.45 |
| Business site | Sole proprietors, small businesses, offices | 0 → 0.05, 7 → 0.2, 9 → 0.6, 12 → 0.5, 17 → 0.5, 19 → 0.15 | 0.1 all day | about 0.25 |
| Backup and archive | Backup and archive storage | 0 → 0.4, 1 → 1.0, 5 → 1.0, 7 → 0.05 | Same as weekdays | about 0.25 |
| VPN | VPN customers | 0 → 0.2, 8 → 0.3, 19 → 0.7, 23 → 0.4 | 0 → 0.4, 14 → 0.7, 22 → 0.7 | about 0.45 |
| Developer VPS | Hobby developers, agencies | 0 → 0.1, 10 → 0.3, 18 → 0.3, 21 → 0.2 | 0.15 all day | about 0.2 |
| Enterprise | Enterprises, dedicated servers | 0 → 0.3, 8 → 0.6, 18 → 0.6, 22 → 0.35 | 0.3 all day | about 0.45 |

A personal page (the other three quarters of private individuals, unless they book a game server or VPN) runs 0 → 0.02, 18 → 0.05, 22 → 0.03 on weekdays and 0 → 0.03, 12 → 0.06, 22 → 0.03 on weekends, so it holds its resident memory and little else, and it sends a tenth of its booked traffic.

**Weekday factors** (Sunday to Saturday): game servers 1.05, 0.85, 0.85, 0.9, 0.95, 1.05, 1.1; online shops 1.15, 1.1, 1, 0.95, 0.95, 0.9, 0.9; blogs 1.1, 0.95, 1, 1, 1, 0.9, 0.95; news 0.85, 1.15, 1.05, 1, 1, 0.95, 0.85; business sites 1, 1.1, 1.05, 1, 1, 0.85, 1; VPNs and enterprise 1, 1.05, 1, 1, 1, 0.95, 1; developer VPS 1.3, 0.9, 0.95, 1, 1, 0.95, 1.3; backups and personal pages 1 every day.

**Surges.** Black Friday (the last Friday of November) and the two weeks before Christmas multiply online shops by 2× and 1.3×. A game's launch weekend multiplies its servers by 1.5×. Each news site has a 1% chance per day of breaking news, which multiplies it by 3× for 2 to 6 hours.

**What runs over.** Booking never refuses a placement for CPU or RAM, on any node, cluster or panel VM; only the disk limit below does.

| Resource | Booking limit | In use | When the node runs over |
| --- | --- | --- | --- |
| CPU | None | Booked vCPUs × load | Performance of everyone on the node falls from 100% at 70% load to 85% at 100%, then to 0.85 ÷ load; below 25% for 2 hours its workloads time out |
| RAM | None, except installed RAM with Memory reservation on | Booked RAM × (0.6 + 0.4 × load), since memory stays mostly resident | A full-VM node swaps up to 110% and slows, then OOM-kills its largest VM each hour; an OpenVeeZee node OOM-kills one container each hour |
| Disk | 2:1 of the usable RAID disk | Grows from 30% of booked at signup at the customer's growth rate, up to 100% | The pool stops writes at 100%: an outage for every workload on it |
| Traffic | No limit | Monthly traffic × traffic shape (below) | Saturation, see Traffic and bandwidth |

**Frozen VMs.** A running VM of the player's whose software (its control plane at this year's size) and what it hosts use more vCPU or RAM than the VM has is frozen: its CPU and RAM readouts sit at 100% and its consoles cannot be reached. What runs inside slows like on a node, along the CPU curve above and, for RAM past the VM's size, the swap slowdown; below 25% for 2 hours its web spaces time out. Resizing the VM so everything fits ends the freeze at once. A bare-metal server never freezes and degrades as a node.

**Readout wobble.** CPU and RAM readouts (LED bars, monitoring, terminal, console lists) wobble by up to ±8% of their value each hour, drawn from the seed, the machine and the hour, within 0 to 100%; a full or frozen machine stays at 100%. The simulation itself uses the unwobbled values.

A cluster of nothing but game servers peaks at about 1.0 on Saturday evenings, while a mixed cluster stays near 0.5, so mixing customer types roughly doubles safe overcommit. The cluster view shows booked capacity, this week's forecast peak and last week's actual peak.

**How the first build plays.** Usage follows the curves with ±20% jitter per workload and hour, without surges yet. A node's use is the sum of its workloads plus its control plane at full load; a stopped, restoring or lost workload uses nothing. Instead of killing workloads, a loaded node slows them like a queue. With u = busy vCPUs ÷ cores, performance is 100% up to u = 0.7, falls linearly to 85% at u = 1 and is 0.85 ÷ u beyond, so twice the cores runs at 42.5%; it is 50% when the disk pool runs over. A site counts as slow in the browser below 95%. A node that stays below 25% for 2 hours in a row times out: every workload on it counts as down, an outage for its customers, until its performance recovers. A full-VM node (VMwhere, Proxmocks, a panel host) whose RAM in use exceeds its installed RAM swaps: up to 110% its performance falls to 1 ÷ (1 + 5 × the overcommit), so 105% runs at 80% and 110% at 67%. Past 110% the host OOM-kills its largest running VM for an hour, one per hour until RAM fits; the kill is an outage hour for that VM's customers, and the console shows it as OOM killed. An OpenVeeZee node hands RAM pressure to its beancounters instead (OpenVeeZee section). Customers notice only the performance lost past their tolerance, which depends on what the service runs (its usage curve): game 5%, shop and enterprise 10%, news and VPN 15%, business 20%, blog 25%, dev 35%, backup 60%, scaled by 0.5 to 1.5 per customer from the seed and never shown to the player. Every hour each customer on a slowed node loses 0.1 × the felt loss in happiness, and each of their services opens a "really slow" outage ticket with a chance of 10% × the felt loss unless one is already open. The felt loss is the noticed loss × the share of the customer's segment looking at that hour (Noticing outages) × the segment's sensitivity relative to business customers, capped at 1 (private customers 0.0075) × a duration factor that grows from 1 to 3 over the first 24 hours of an unbroken slowdown. A slow evening barely registers with a private customer, and a slowdown dragging through business hours costs an office the most. **Overprovisioning is always allowed.** Players may book more vCPU and RAM than a node, a cluster or a panel VM has, whatever the software; it only costs performance. The owner's rule (bug report): no cluster may report no room when room is there, webhosting packages need minimal resources, overprovisioning should always be allowed and only hurts performance when customers use it, and limits per software make no sense because overprovisioning is not a per software thing. So the one hard limit is disk, at twice the usable RAID disk for a node and at the VM's disk inside a panel VM, because data has to sit somewhere. The scheduler still prefers a node whose installed RAM the booking fits (pack takes the busiest of them, spread the idlest) and falls back to the idlest node when none is left. The consequences are the ones above: slowdowns as the CPU in use nears and passes the cores, swapping and OOM kills while the RAM in use passes the installed RAM. The capacity bars show booked against physical and run past 100% in the warning colour.

**Memory reservation.** A tier 2 training after Monitoring, 100 know-how and 5 days. It adds a Memory reservation switch to every cluster, off by default. With it on, a placement or a move that would book RAM beyond a node's installed RAM less its control plane is refused, so the node cannot run out of RAM; it is the only way RAM refuses a booking.

**Stopped workloads and starting.** A stopped VM keeps its disk on its node but holds none of its CPU or RAM, so it counts toward neither the booked RAM of the node, placement, Memory reservation nor the overallocation alarm. A VM takes its whole booked RAM when it starts: starting is refused while the RAM the node's running VMs book plus its own exceeds what the node can book. On OpenVeeZee RAM is not reserved: a running container holds the RAM it uses, a stopped or frozen one none, and a container starts or is restored only while the RAM in use on its node plus what it will use fits the node. The booked RAM of containers is shown next to the RAM in use and never refuses anything.

**Pegged workloads.** A workload is pegged when its CPU ran at 95% or more of its booked vCPUs in more than 12 of the last 24 hours. The node's workload list marks it.

**Limits.** A customer workload's booking is its limit; the service keeps its sold size (`90-actions/limits.ts`, `60-infra/usage.ts`). The player can set the limit to any size from 0.1 vCPU, 0.25 GB RAM and 1 GB disk, as long as the disk still holds the stored data, the node or panel VM has the disk for it and a panel host stays within its oversell cap. Setting limits takes 2 minutes. A customer needs their sold size times their load, as above; a limit above the sold size stretches that need by the limit ÷ sold size, at most 1.5 (STRETCH_MAX), so a customer given twice their package uses at most half again at peak. Use is the need, capped at the limit. A customer at the size they bought is never starved, whatever their load. Below the sold size a customer loses performance as their need nears the limit: 1 − notice × limit ÷ need for CPU and RAM, the larger of the two, with notice 0.9 for VPS and game servers (a VM near its limit swaps and shows steal) and 1 for every other line (a web space feels nothing until it hits the limit). A disk need over the limit costs 30% (DISK_STARVE), since writes fail. This loss slows only that service, multiplies with any slowdown of the host and reaches happiness and slow tickets the same way, past the customer's tolerance.

**Traffic shape.** A service's Mbit/s each hour is its monthly average × (floor + (1 − floor) × activity + 2 × night job) ÷ the week's average of that sum, where activity is the curve with the service's own ±20% jitter. A month's traffic therefore stays at the table in Traffic and bandwidth.

| Product | Floor | Reasoning |
| --- | --- | --- |
| Game server | 0.5 | A game server sends ticks to every connected player all night, so its traffic never drops below half its average. |
| Colocation | 0.3 | A rented rack carries mixed customers of its own and never goes quiet. |
| VPN, dedicated server | 0.2 | Tunnels and company servers keep syncing and polling overnight. |
| Everything else | 0 | Websites follow their visitors, so nights are as low as the curve. |

**Night jobs.** Every customer runs their own backup or batch job once a night for one hour, starting on a half hour from 00:00 to 05:30 drawn from the seed; one customer in six draws a new start every night, since cron jobs that depend on other jobs drift. During the job the workload's load rises by 0.3 and it ships two hours' worth of average traffic, because an offsite backup uploads a day's changes at once; 0.3 keeps a small node with several jobs in the same slot below its evening peak.

**The player's backups.** A cluster's backup runs at 02:00 (Sundays only when weekly) and sends 10% of each workload's used disk from its node to the target's control plane within the hour, since a daily backup only copies what changed. The traffic lights the ports on the shortest cable path between the two servers and their LED net bars, and does not reach the uplinks.

**Growth.** Each customer draws a disk growth rate and, separately, a CPU growth rate from the seed, because a big database and a busy shop are different customers.

| Share of customers | Disk use per year (share of booked) | CPU demand per year (share of the first year's) |
| --- | --- | --- |
| 30% | +2% | +2% |
| 50% | +15% | +15% |
| 20% | +50% | +50% |

Disk use starts at 30% of booked and stops at 100%; the average customer reaches about 66% after two years, as before. CPU load is the curve × (1 + rate × years) with jitter, capped at 100%. An upgrade is a new service, so both start over.

**Outgrowing a service.** Once a day at noon, a customer whose disk is at 90% or more, or whose CPU demand × the curve's weekly median reaches 0.9 (near 100% for more than half the week), writes an upgrade ticket with a chance of 1 in 7, so about a week after crossing the line; sales turns it into an expansion request. A full disk breaks the site: the customer loses 2 happiness a day and writes an "our site shows errors" upgrade ticket with a chance of 25% a day while none is open. A fast-growing disk crosses 90% after about 14 months and fills after 17. A fast-growing shop's CPU pegs after about 17 months, a news or enterprise site's after two years, while game servers and office sites, quiet for most of the week, take ten.

**Before and after.** Measured over 30 days with a mixed set of customers (web hosting, VPS, game servers, VPN, storage, dedicated): early game in 2005 with 13 services moves 0.59 TB before and after, with a 95th percentile of 3.4 Mbit/s before and 3.8 after (night jobs add short peaks to a small base); mid game in 2012 with 200 services moves 17.9 TB before and 17.8 after, with a 95th percentile of 103 Mbit/s before and 88 after, so transit bills drop about 15% (€311 to €264 a month at Cogentle's price), because the floors and staggered peaks flatten the sum.

### Traffic overuse

A service's traffic grows 20% a year from the day it started while its plan stays the same, so a service that keeps its plan for a few years moves more traffic in a month than the plan includes. The customer page shows the last month's traffic against the plan for every service with included traffic, and a service over its plan offers three answers.

| Answer | Effect |
| --- | --- |
| Throttle traffic | The service stays at its booked traffic from then on, so the transit it costs stops growing. The customer loses 10 happiness. Lifting the throttle lets the traffic grow again. |
| Bill overage | An invoice for the GB over the plan, at the line's traffic rate per 100 GB (the player's rate in Products, else the market's). The customer loses 5 happiness. |
| Offer upgrade | The customer answers with an upgrade request for the next bigger plan, which the player quotes in Sales and the customer accepts or counters like any other upgrade. |

A bill or an upgrade offer covers 730 hours, so the same service can be billed or offered an upgrade once a month. The state holds a company-wide `overusePolicy` (null by default): when it is set, the daily noon check applies that answer to every service over its traffic that is not yet throttled or handled this month. The player sets it in the Books app's billing rules after the Traffic billing training (250 know-how, 10 days, after Product management); the choices are off, throttle, bill or offer upgrade. An upgrade offer still waits for the player to quote it in Sales.
