# Overload, heat and customer patience

A player reported that an OpenVeeZee node at full CPU shows its containers as "Migrating", takes every site offline at once and makes every customer complain. Real hosts do not behave like that: a busy server answers slower, private customers barely notice, business customers notice more the longer it lasts, and real trouble starts with heat, failed fans and memory running out. This plan records how the simulation behaves today, the model we want, and the lanes that get us there.

The state described here is origin/main at `6bc9069f` (PR #304, stopped workloads release RAM).

## 1. Current behaviour

### How load is computed

- A workload's load is a share of its booking from 0 to 1: its customer's usage curve times the day's swing, its grown demand and ±20% seeded jitter, plus its night job (`src/sim/60-infra/usage.ts:37-45`). Stopped, busy and lost workloads idle at 0, and a held account at 2%.
- A workload uses `booked vCPU × load` of CPU and `booked RAM × (0.6 + 0.4 × load)` of RAM. Disk fills from 30% of booked at the customer's growth rate (`usage.ts:24-27`, `usage.ts:97-110`). A checkpointed container holds only its disk (`usage.ts:105`).
- Since PR #304 an OpenVeeZee container counts the RAM it actually uses rather than its booking, and a stopped or checkpointed workload holds no CPU or RAM (`src/sim/60-infra/cluster.ts:199-210`). `roomToStart` checks a start against that live RAM (`cluster.ts:216`). A stop, a start, a checkpoint and a restore now recompute the frozen nodes straight away instead of waiting for the next hour.
- A node sums its control plane, its OS and its workloads (`usage.ts:120-131`). Its performance is the lowest of three factors, then reduced by a RAID rebuild and by heat (`usage.ts:132-136`):
  - CPU: `cores ÷ busy vCPUs` once busy vCPUs exceed the cores, else 1.
  - Disk: 0.5 once the pool is over 100%.
  - Heat: 0.6 while the server throttles (`src/sim/60-infra/thermal.ts:16`, `thermal.ts:31-35`).
- A panel host loses up to 15% more past 4 booked vCPU per physical vCPU (`src/sim/60-infra/oversell.ts:6-10`).
- The hypervisor console warns at 2 booked vCPU per core, 90% RAM and 90% disk (`src/sim/60-infra/alarms.ts:12-14`). A node "runs hot" at 90% RAM or more busy vCPUs than cores (`src/sim/60-infra/ha.ts:78-82`), which triggers the load balancer when the cluster has one.
- Network load is per port, from customer traffic and backups (`usage.ts:218-275`). It shows on the ports and does not slow or stop services.
- Hourly order in `src/sim/88-tick/tick.ts`: thermal steps every minute (`tick.ts:253`), sensors log (`tick.ts:298`), then `freezeTick` (`tick.ts:356`), `haTick` (`tick.ts:357`), `beancounterTick` (`tick.ts:358`), `productsTick` with the slowdown penalty (`tick.ts:365`), `usageTick` (`tick.ts:366`) and `supportTick` with outages and churn (`tick.ts:389`).

### What takes a service down or makes it slow

| Mechanism | Trigger | Effect | Too binary? |
| --- | --- | --- | --- |
| CPU contention | Busy vCPUs above cores | Everyone on the node runs at `cores ÷ busy` (`usage.ts:133`) | Mostly fine. Below 100% nothing slows at all, and at 100.1% the site is flagged "slow" in the browser (`src/sim/80-business/browser.ts:140`). |
| RAM over | RAM in use above installed RAM | The node freezes and every workload on it is offline until it fits (`usage.ts:140-151`, `cluster.ts:546`) | Yes. One peak hour of load swing takes every site on the node down. Since #304 OpenVeeZee containers swing with load, so this now happens from ordinary daily peaks. |
| OpenVeeZee failcnt | Node above 90% RAM: only containers with burst fail. Node out of RAM **or busy vCPUs above cores**: every container fails privvmpages and numproc (`src/sim/60-infra/beancounters.ts:37-45`, `beancounters.ts:52`) | Each container gains `max(1, round(40 × its share of node RAM))` failcnt per hour (`beancounters.ts:13`, `beancounters.ts:54`). Six hours in a row mark its sites slow (`beancounters.ts:57`). Past 24 failcnt in a day the OOM killer stops it for an hour: `busyUntil = hour + 1` and one down hour is booked (`beancounters.ts:58`, `beancounters.ts:62`) | Yes, and this is the reported bug. CPU contention alone counts as memory failure. A container holding a quarter of the node's RAM gains 10 per hour and is killed in its third hour, then again every three hours. Every container on the node is hit, not the one over its limit. |
| "Migrating" label | Any `busyUntil` in the future that is not a restore | The console shows "Migrating" (`src/ui/apps/products/parts.tsx:127`) | Yes. The OOM kill above reuses `busyUntil`, so a killed container reads as being migrated. |
| Disk full | Pool above 100% | Writes stall: node performance 0.5 (`usage.ts:134`) | The design table calls this an outage for every workload (`docs/design/economy.md`, Usage curves and overcommit, "What runs over"), so code and doc disagree. |
| Customer disk full | The service's own disk at 100% | −2 happiness a day and a 25% chance of a ticket (`usage.ts:277-301`) | Fine. |
| Heat throttle | Inlet at 35 °C or more | Performance × 0.6 and one hot hour of wear (`thermal.ts:14-16`, `tick.ts:203`) | Yes. A single step at 35 °C with no gradient. |
| Heat shutdown | Inlet at 45 °C | The server switches off, an outage like a power cut, and boots again below 30 °C (`thermal.ts:64-86`) | Fine as an extreme. |

### Complaints, happiness and churn

- **Slowdown** (`src/sim/85-products/products.ts:192-207`): each hour a slowed workload costs `0.1 × (1 − perf − tolerance)` happiness and has a `0.1 × lost` chance of a "slow" ticket (`src/sim/40-support/tickets.ts:175-180`). Tolerance depends on what the service runs, from 5% for a game to 40% for a personal site, scaled 0.5 to 1.5 per customer (`src/sim/10-catalog/usage.ts:104-107`). It ignores the hour of day, whether anyone is looking, and how long the slowdown has lasted.
- **Outage** (`src/sim/40-support/tick.ts:156-171`): costs `outagePenalty` per counted hour, from 1 for a private customer to 10 for a shop (`src/sim/10-catalog/economy.ts:36-44`), but only once the customer noticed it. Noticing follows attention by segment and hour (`src/sim/10-catalog/attention.ts:21-35`): players and offices notice almost at once, private customers with a sensitivity of 0.015. Writing in follows `OUTAGE_WRITE_CHANCE` by budget, 0.3 to 0.9 (`tickets.ts:65`), and a high-budget customer opens three tickets.
- **Upgrade asks** (`usage.ts:285-301`): a customer near the booked disk or with CPU pegged most of the week asks for a bigger plan.
- **Churn** (`tick.ts:186-191`): below 15 happiness a customer cancels; above, the monthly chance grows by `0.5 × (50 − happiness) ÷ 50`.

So private and business customers already differ for outages, but not for slowdowns. The OpenVeeZee bug turns every CPU peak into repeated outages, which is why every customer complains at 100% CPU.

### Heat, fans and damage

- The room temperature is 22 °C in a hall and 17 to 27 °C in the basement, plus built-up heat when cooling falls short (`src/sim/60-infra/sensors.ts:20-23`, `thermal.ts:47-62`).
- A server's inlet adds up to 3 °C as its rack nears its power limit and 6 °C behind a failed fan (`sensors.ts:26-33`). There is no CPU temperature.
- A server draws its rated watts when it runs any workload and its idle watts otherwise (`src/sim/60-infra/status.ts:281-284`, marked ponytail at `status.ts:288`). CPU load does not change power or heat.
- Fans spin at a fixed 9,000 rpm, or 12,500 while another fan has failed (`sensors.ts:8-10`, `sensors.ts:40`). They do not follow load or temperature.
- A failed fan alone does not throttle a hall server (22 + 3 + 6 = 31 °C) but does throttle a basement server in summer (27 + 3 + 6 = 36 °C).
- Every throttled hour adds one hot hour; each 100 hot hours add the base failure rate once more to every component (`thermal.ts:27`, `tick.ts:167-175`). That is the only heat damage.

## 2. Target model

### Load to latency

A site's response time grows smoothly with node utilisation, like a queue. Nothing changes up to about 70%, sites get slightly slower to 100%, and past 100% they slow in proportion to the overload. Only an extreme and sustained overload produces timeouts that count as an outage. Proposed curve, with `u = busy vCPUs ÷ cores`:

- `perf = 1` up to `u = 0.7`.
- From 0.7 to 1.0, perf falls linearly to 0.85.
- Above 1.0, `perf = 0.85 ÷ u`.
- Below a perf of 0.25 for 2 hours in a row, the node's sites time out and count as down until perf recovers.

The node keeps one `perf` number, so every caller of `nodeUsage().perf` stays as it is.

### Memory pressure

Running out of RAM kills or slows single workloads instead of freezing the node.

- **OpenVeeZee.** Failcnt counts memory only. Above 90% node RAM, containers past their barrier lose burst and collect privvmpages failcnt. With the node out of RAM, the kernel OOM-kills the container furthest past its barrier, then the largest, one per hour until RAM fits. A killed container restarts after an hour and shows "OOM killed" in the console. CPU contention does not touch beancounters; numproc failcnt comes only from a container reaching its own numproc limit.
- **Full VMs (VMwhere, KVM).** Up to 110% of installed RAM the host swaps and ballooning reclaims memory: performance falls with the overcommit. Past 110% the host OOM-kills the largest VM until RAM fits. The whole-node freeze goes away.

### Customer sensitivity

A slowdown costs happiness only while someone is looking, scaled by the segment's attention at that hour, and costs more the longer it lasts.

- The hourly penalty becomes `SLOW_PENALTY × lost × attention(segment, hour) × durationFactor`, with the duration factor growing from 1 to 3 over the first 24 slow hours.
- Private customers use their low sensitivity, so a slow evening barely registers. Business customers feel slow business hours and write in more as it drags on.
- Ticket chance follows the same weighting.

### Heat, fans and throttling

- A server's draw runs from its idle watts to its rated watts by its CPU utilisation, so load raises rack power and room heat.
- Each server has a CPU temperature: `inlet + 20 °C × utilisation × fanFactor`, where `fanFactor` is 1 with all fans and rises by 0.5 per failed fan.
- Fans follow the CPU temperature, from 30% of their maximum rpm at 50 °C to 100% at 80 °C. A failed fan reads 0 rpm.
- From 85 °C the CPU throttles: performance falls linearly to 0.5 at 95 °C. The 35 °C inlet throttle stays as the source of room heat.
- Every hour above 90 °C counts as a hot hour and wears the CPU and board, and above 100 °C the server shuts itself off like an inlet shutdown.
- A healthy server at 100% CPU in a 22 °C hall with a full rack reaches about 45 °C, so fans stay low and nothing throttles. With two fans failed the same server reaches about 71 °C at full load: the remaining fans run near full speed, and it is fine at idle. In a 27 °C basement in summer, an overloaded rack adds room heat, and the same server crosses 85 °C and throttles, wearing its CPU and board.

## 3. Gaps

1. CPU contention counts as memory failure on OpenVeeZee and OOM-kills every container on the node (`beancounters.ts:42`, `beancounters.ts:52`). This is the main cause of the report.
2. An OOM kill reads as "Migrating" (`parts.tsx:127`) because it reuses `busyUntil`.
3. The OOM killer hits every container instead of the one over its limit.
4. RAM over 100% freezes a whole node (`usage.ts:140-151`); since #304 this follows ordinary daily peaks on OpenVeeZee.
5. CPU performance is flat up to 100% and has no timeout tier at extreme overload.
6. Slowdowns ignore segment attention, the hour of day and their duration (`tickets.ts:177-180`).
7. Power draw and heat ignore CPU load (`status.ts:281-288`). There is no CPU temperature, and fans ignore load.
8. Throttling is a single step at 35 °C inlet, and a failed fan only matters through the inlet.
9. Heat damage is a general wear multiplier and does not depend on how hot the CPU ran.
10. The disk-full row in economy.md says outage while the code halves performance.

## 4. Build lanes

Each lane ships on its own with a seeded test in `tests/` and updates the matching section of `docs/design/economy.md` in the same pull request. Lanes in the same group touch the same files and run in order. Different groups can run in parallel.

### Group A: OpenVeeZee beancounters

1. **CPU stops counting as memory failure.** `beancounterTick` raises level 2 only when the node is out of RAM, and numproc failcnt only when a container passes its own numproc limit. Files: `src/sim/60-infra/beancounters.ts`, economy.md beancounters section. Test: a node at 150% CPU and 70% RAM runs a week with zero failcnt, no OOM kills and no down hours.
2. **OOM kills one container with its own label.** With the node out of RAM, kill the container furthest past its barrier, then the largest, one per hour, and record it as `oomUntil` on the workload instead of `busyUntil`. `vmState` shows "OOM killed", with the new key in every language file. `deserialize` defaults the field. Files: `beancounters.ts`, `cluster.ts` (Workload type, `workloadOnline`), `src/sim/91-save`, `src/ui/apps/products/parts.tsx`, `src/i18n/ui-misc1.ts` and its translations. Test: a node at 105% RAM kills exactly the largest over-barrier container, the others stay online, and the console state is not "migrating".

### Group B: node performance and memory

3. **RAM overcommit without freezing.** Replace the node freeze: an OpenVeeZee node hands over to lane 2's OOM killer, and a full-VM node swaps up to 110% with performance falling with the overcommit, then OOM-kills the largest VM. Files: `src/sim/60-infra/usage.ts` (`nodeUsage`, `freezeTick`), `cluster.ts` (`workloadOnline`), `src/sim/85-products/products.ts` (`workloadPerf` frozen check), economy.md "What runs over". Test: a VMwhere node at 105% RAM keeps every VM online at reduced performance; at 120% only the largest VM goes down. Runs after lane 2, since both touch `cluster.ts` and the OOM path.
4. **Latency curve.** Replace `cores ÷ busy` with the curve above and add the timeout tier for sustained extreme overload. The browser's "slow" flag uses `perf < 0.95`. Files: `usage.ts`, `src/sim/80-business/browser.ts`, `src/sim/80-business/website.ts`, economy.md. Test: perf is 1 at 60%, between 0.85 and 1 at 90%, `0.85 ÷ u` above 100%, and a node at 4× for 2 hours counts its sites as down.

### Group C: customer patience

5. **Slowdowns by segment and duration.** Weight `slowed` by `attention(segmentOf(...), hour)` and by a duration factor from a new `slowSince` on the service, defaulted in `newGame` and `deserialize`. Files: `src/sim/40-support/tickets.ts`, `src/sim/85-products/products.ts` (`overload`), `src/sim/30-customers/customers.ts`, `src/sim/91-save`, `src/sim/10-catalog/attention.ts` (export only). Test: the same 30% slowdown for 24 hours costs a private customer under a tenth of what it costs an office, and the office's hourly cost grows with the hours. Can run beside groups A and B. It shares `products.ts` with lane 3 in different functions, so it rebases cleanly if lane 3 lands first.

### Group D: heat and fans

6. **Load-based power draw.** `drawWatts` interpolates idle to rated by the server's CPU utilisation. Files: `src/sim/60-infra/status.ts`, economy.md power section. Test: a server at 0%, 50% and 100% draws idle, the midpoint and rated watts, and a rack's breaker check follows. Can run beside groups A, B and C.
7. **CPU temperature and fan curve.** Add `cpuTemperature(s, d)` and fan rpm by temperature to `sensorsOf`; the server management page shows CPU temperature and fan percentage. Files: `src/sim/60-infra/sensors.ts`, the IPMI console in `src/ui/apps/browser/consoles/`, i18n keys. Test: a healthy server at full load in a hall reads about 45 °C with fans near 30%, and with two failed fans the CPU runs hotter and the remaining fans faster. Runs after lane 6, since temperature reads utilisation from the same helper.
8. **CPU throttling and heat damage.** `throttled` becomes a factor from CPU temperature, hot hours count above 90 °C CPU, and above 100 °C the server shuts off. `nodeUsage` multiplies by that factor (one line in `usage.ts`). Files: `src/sim/60-infra/thermal.ts`, `src/sim/88-tick/tick.ts` (hot hours), `usage.ts`, economy.md Cooling and overheating, gdd.md Heat. Test: a server with two failed fans in a 27 °C basement at full load throttles below perf 1 and gains hot hours, and its CPU failure chance rises. Runs after lane 7, and after lane 4 because both edit `nodeUsage`.

### Order

Start lanes 1, 5 and 6 at once. Then lane 2 after 1, lane 7 after 6, lane 3 after 2, lane 4 after 3, and lane 8 last. Lane 1 alone fixes most of the report.

## 5. Open questions

- Should the server management page let the player pick a fan profile, as real management controllers do (default, maximum performance, quiet), trading noise and power for headroom? Nothing in the code or the docs suggests either way; the plan assumes no profile.
- Should load-based power draw also raise the electricity bill, or only heat and breaker load? The game bills the power drawn since the last monthly bill (`src/sim/50-state.ts:221`), so the plan assumes the bill follows, which makes busy racks cost more and idle ones less than today.
