# Service limits and self-inflicted slowness

Status: in progress. Branch `service-limits`.

The player sets the resources a customer service may use, the customer uses what they bought, and a service that outgrows its limit is slow on the customer's side rather than on the player's host. The customer still writes in; the player diagnoses which side is overloaded and either raises the limit or recommends an upgrade.

## 1. Scope

| # | Feature | Layer |
| --- | --- | --- |
| 1 | `setLimits(s, serviceId, size)`: the player books a customer workload at any size above a floor, at provisioning and later | Sim |
| 2 | Use follows the sold spec, capped by the limit; a limit above the sold spec lets peaks run above it | Sim |
| 3 | Starvation: need over limit slows only that service; VM lines notice early, shared lines when they hit the limit | Sim |
| 4 | Ticket action `upgrade` on a slow ticket: opens an expansion request when the service was starved, annoys the customer when the host was at fault | Sim |
| 5 | Limit fields on the customer's service page and in the hypervisor consoles; RAM and disk in fractional GB, HyperVee in MB like the real product | UI |

Not here: packages per installation (`packages-provisioning`), the oversell cap (`panel-host-sim`).

## 2. Current state

- A customer workload's `vcpu`, `ramGb`, `diskGb` on `Workload` (`src/sim/60-infra/cluster.ts:67`) are booked once at placement from `sizeOf(v.spec)` (`src/sim/90-actions/clusters.ts:390`). No action changes them; only the retention upgrade and expansion paths rewrite `v.spec` and re-place.
- `workloadUse` (`src/sim/60-infra/usage.ts:75`) scales use with the booking: CPU `booked.vcpu * load`, RAM `w.ramGb * (0.6 + 0.4 * load)`. A smaller booking therefore shrinks use instead of starving the customer.
- `overload` (`src/sim/85-products/products.ts:273`) marks services slow from node and host perf only, then `slowed` (`src/sim/40-support/tickets.ts:157`) bumps happiness and opens an `outage` ticket with topic `slow`. That ticket has no action beyond `credit`.
- `expansions` (`src/sim/30-market/sales.ts:137`) turns an open `upgrade` ticket into a sales request with `grownSpec`; `replyUpgrade` (`:245`) applies it.
- Own VMs: `createVm` and `resizeVm` (`clusters.ts:96`, `:181`) take GB; `SizeFields` (`src/ui/apps/browser/consoles/HypervisorBase.tsx:63`) has `min={1}` and integer steps. HyperVee shows MB everywhere but its wizard asks for GB (`HyperVee.tsx:205`).
- No customer field for skill. `slowTolerance` (`src/sim/10-catalog/usage.ts:101`) already varies by product, profile and customer, and is the "how smart" knob.

## 3. Design

### 3.1 Limits (feature 1)

The booking on the workload is the limit; `Service.spec` stays the sold spec. No new state field for limits.

`setLimits(s, serviceId, size: Resources): ActionResult` in `src/sim/90-actions/limits.ts`:
- Errors: `error.unknownService` (none, ended, or no cluster workload), `error.vmSize` (non-finite or below `LIMIT_MIN = { vcpu: 0.25, ramGb: 0.25, diskGb: 1 }`), `error.vmTooSmall` (disk below what is stored: `diskFill` share of the sold disk plus snapshot deltas), `error.nodeFull` (node or datastore cannot take the growth, via `nodeTakes` and `datastoreFits` as `resizeVm` does), `error.oversellCap`.
- Rebooks the workload in place (`{ ...w, ...size }`), `freezeTick`. Dedicated and colocation services have no limit (`error.unknownService`).
- `ACTION_MINUTES.limits = 2`, logged as `activity.limits` with the new size.

### 3.2 Use (feature 2)

In `src/sim/60-infra/usage.ts`:
- `need(s, v, w, hour): Resources`, what the customer would use unconstrained: `sold = sizeOf(v.spec)`, `stretch = clamp(limit / sold, 1, STRETCH_MAX)` per resource, `vcpu = sold.vcpu * load * stretch.vcpu`, `ramGb = sold.ramGb * (RAM_BASE + 0.4 * load) * stretch.ramGb`, `diskGb = sold.diskGb * diskFill`. Shared lines keep `booked()` core rounding on the limit, not on the need.
- `workloadUse` for customer workloads returns `min(limit, need)` per resource. Own VMs unchanged.
- Numbers: `STRETCH_MAX = 1.5` (a customer given twice their package uses at most half again at peak), `RAM_BASE = 0.6` as today.

### 3.3 Starvation (feature 3)

`starvation(s, v, w, hour): number` in `usage.ts`, the share of performance the customer loses to their own limit: per resource `ratio = need / limit`; `shortfall = max(0, 1 - 1 / ratio)` once `ratio >= NOTICE[line]`, else 0; the result is the max over vcpu and ramGb, and `DISK_STARVE = 0.3` when disk need is over the limit (writes fail, the site stalls). `NOTICE`: `0.9` for `vps` and `gameServer` (a VM at 90 % of its vCPU shows steal and swap at once), `1.0` for every other line (a web space feels nothing until the panel enforces the limit).

`overload` multiplies `workloadPerf` by `1 - starvation`. A starved service gets `v.starvedAt = s.hour` (new optional field on `Service`, default absent, old saves load unchanged); `slowedAt` stays the host-side mark and is set only when `workloadPerf < 1`. `slowed` runs as today on the combined loss minus `slowTolerance`, so a tolerant customer on a slightly tight limit never writes, and a gamer writes at once.

Economy: extends "Usage curves and overcommit" with `STRETCH_MAX`, `NOTICE`, `DISK_STARVE`.

### 3.4 The slow ticket (feature 4)

Ticket text stays `ticket.outage.slow.*`. `TOPIC_ACTIONS["outage.slow"] = ["upgrade"]`, `ACTION_MINUTES.upgrade = 5`. Resolving with `upgrade`:
- Service starved in the last `STARVED_RECENT = 48` hours (`starvedAt`) and not host-slow in that window: open an expansion sales request exactly as `expansions` does for an `upgrade` ticket (`sales.msg.upgrade`, `grownSpec`); refactor the request creation into `expansionRequest(s, t)` and call it from both. The ticket resolves; the customer answers the quote through the existing sales flow.
- Otherwise (host at fault, or no recent starvation): `bump(c, -WRONG_UPGRADE = 5)`, the ticket resolves with reply `ticket.reply.upgradeDeclined`, no request.
- Raising the limit with `setLimits` needs no ticket action: starvation ends, the customer stops losing happiness, and `credit` or a plain resolve closes the ticket.

### 3.5 UI (feature 5)

- Customer page (`src/ui/apps/customers/CustomerPage.tsx`, service detail): row `misc.limits` with three number fields (vCPU, RAM GB, disk GB) prefilled from the workload, a Save button calling `setLimits`, and beside it `misc.useNow` from `workloadUse` as `used / limit` per resource. Sold spec stays the `misc.resources` row.
- Hypervisor consoles (`HypervisorBase.tsx`): the resize form of a customer VM calls `setLimits` instead of `resizeVm`.
- `SizeFields`: `min={0.25}` and `step={0.25}` for vCPU and RAM, `step={1}` for disk. Create and resize of own VMs keep `PANEL_VM_MIN`.
- HyperVee wizard and settings take RAM in MB (`hvStartupMemoryMb`, value `ramGb * 1024`, stored back as `/ 1024`), matching the real product; its summary already shows MB. Proxmocks keeps GiB labels.
- Ticket app: the `upgrade` action button appears through `actionsOf`; label `ticket.action.upgrade` ("Recommend an upgrade").

## 4. Milestones

| M | Content | Test |
| --- | --- | --- |
| M1 | 3.1 to 3.3: `setLimits`, `need`, capped `workloadUse`, `starvation`, `starvedAt`, `overload` change, economy.md section | `tests/limits.test.ts`: rebook up and down, errors, use capped at limit, stretch above sold, a starved vps slows and marks `starvedAt` without slowing its neighbour, a web space at 95 % does not, at 110 % does, raising the limit ends it |
| M2 | 3.4: ticket action, `expansionRequest`, decline reply, i18n in every language | `tests/limits-ticket.test.ts`: starved service gets a request on `upgrade`; host-slow service gets the penalty and no request |
| M3 | 3.5: customer page limits, console resize for customer VMs, `SizeFields` steps, HyperVee MB, i18n in every language | `tests/i18n.test.ts` |

M1 first; M2 and M3 can run in parallel with M1 against the signatures above.

## 5. Files touched

`src/sim/90-actions/limits.ts` (new), `90-actions/index.ts`, `60-infra/usage.ts`, `85-products/products.ts`, `30-customers/customers.ts` (`starvedAt`), `40-support/tickets.ts`, `30-market/sales.ts`, `90-actions/support.ts`, `47-staff/activity.ts`, `src/ui/apps/customers/CustomerPage.tsx`, `src/ui/apps/browser/consoles/HypervisorBase.tsx`, `hypervee/HyperVee.tsx`, `src/i18n/ui-*.ts` and every `src/i18n/<lang>/`, `docs/design/economy.md`, `CHANGELOG.md`.
