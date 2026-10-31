# Plan: panel host simulation

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

Lane id: `panel-host-sim`. Source of scope: `docs/design/panel-features.md` (Shared across all panels, Suspend, Overselling on panel hosts, Plan, Build order steps 7 and 8). New English keys go in `src/i18n/ui-panel-host.ts`, mirrored in `src/i18n/{de,es,fr,it,pt}/ui-panel-host.ts`, registered by one line in `src/i18n/en.ts` and one in `src/i18n/lang.ts`.

## 1. Scope

| # | Feature | Tag | panel-features.md |
| --- | --- | --- | --- |
| 1 | Suspend and unsuspend of one account (service) in every console, with product-specific labels | [Sim] and [UI] | Shared across all panels, "Account suspend and unsuspend"; Suspend |
| 2 | Suspension reasons: unpaid invoice, shady customer or abuse notice, manual | [Sim] | Suspend (late or bad payers, shady customers) |
| 3 | Oversell ratio per panel host with a player-set cap, readouts and slowdown consequences | [Sim] and [UI] | Overselling on panel hosts; Build order step 8 |
| 4 | Licence tiers per panel with account caps, trial and expiry that blocks new accounts | [Sim] and [UI] | Shared across all panels, "License page" |
| 6 | Terminate an account (cPanic Terminate Account, Pleskit Remove subscription, DirectAdmin Delete User, Proxmocks Destroy and the product equivalents), added by the critic pass because no lane owned it | [Sim] and [UI] | Web panels, cPanic "Account Functions: Create, Terminate, Modify and Suspend" |
| 5 | Update channel Stable, Release, Edge with breakage risk | [Sim] and [UI] | Shared across all panels, "Update channel" |

Not owned here: the packages store and create forms (`packages-provisioning`), usage bars, task log and the log viewer (`readouts`), the mail blacklist incident (`mail-dns-vpn-storage`), VMwhere license editions (`hypervisors-backups`). This lane exposes functions they call (section 6).

None of the five features is on the deferred list, so there is no deferred milestone. DirectAdmin resellers (deferred, no lane) will have to count reseller sub-accounts against the licence cap and cascade a hold; that is noted for whoever picks them up.

## 2. Current state

- Customer-level hold exists. `suspendCustomer` (`src/sim/90-actions/customers.ts:42`) toggles `s.heldCustomers` (`src/sim/50-state.ts:165`, default `[]` at `:323`). `isSuspended(s, customerId)` (`src/sim/45-billing/billing.ts:107`) is true for a held customer or one with an unpaid suspended invoice. Invoice suspension is `suspend()` (`billing.ts:130`) driven by `ruleSuspendsAt` (`:182`) and the billing rules `autoSuspendDays`. Suspension bumps happiness by `-SUSPEND_HAPPINESS` (`billing.ts:62`) and opens a ticket; unsuspending and keeping suspended have constants at `:68` and `:71`. The only UI is the Suspend button on `src/ui/apps/customers/CustomerPage.tsx:111-114`. No console has one.
- `isSuspended` callers (all take a customer id, none a service): `src/sim/60-infra/cluster.ts:450`, `src/sim/40-support/tick.ts:133`, `src/sim/60-infra/network.ts:70`, `src/sim/40-support/status.ts:11`, `src/sim/60-infra/usage.ts:256`, `src/sim/47-staff/staff.ts:293` (via `suspend`).
- A suspended customer's workloads keep their load: `workloadLoad` (`src/sim/60-infra/usage.ts:29`) only zeroes stopped, busy and lost workloads, so a suspension frees no real capacity today.
- Abuse: `Customer.shady` (`src/sim/30-customers/customers.ts:12`) multiplies abuse reports (`src/sim/40-support/tick.ts:118`) and notices (`src/sim/40-support/notices.ts:31`). A takedown sets `s.ops.takedowns[serviceId]` for 48 hours (`notices.ts:113-116`, `TAKEDOWN_HOURS` `:37`). A shady customer leaves content up after a forward (`:111`).
- Overcommit: CPU and RAM booking is never refused; only disk is, up to `OVERCOMMIT.disk = 2` (`src/sim/10-catalog/products.ts:29`, `nodeTakes` at `src/sim/60-infra/cluster.ts:184`, comment `:102`). Real use is read by `nodeUsage` (`src/sim/60-infra/usage.ts:88`): `perf = physical vCPU / used vCPU` when over, disk over physical halves it. `overload` (`src/sim/85-products/products.ts:262`) turns `workloadPerf` below 1 into `slowedAt` and unhappiness, and a month without `slowedAt` earns a review (`:322`). `hostPerf` (`src/sim/60-infra/php.ts:17`) already slows a panel host after PHP upgrades or a hack. A panel host's VM books `PANEL_VM_SIZE`; its web spaces use `workloadUse`.
- Licences: fees come from `licensing` in `src/sim/10-catalog/platforms.ts:98-101` (`cpanic` kind "account" 0.4, `pleskit` "server" 12, `directadmin` "server" 4, `freepanel` free) and are billed monthly as ledger "licenses" lines (`src/sim/85-products/products.ts:332-334`, `softwareFee`). There is no cap, expiry or tier. `LicenseKind` is in `src/sim/10-catalog/server-os.ts:7`.
- Updates: `updateDue` and `updateSoftware` (`src/sim/90-actions/software.ts:111,116`) move a cluster's `version` to the current game year and take its workloads down for `UPDATE_MINUTES` (panel 30). `autoUpdateTick` (`:144`) runs at 03:00 for clusters with `autoUpdate`. `Cluster.version` and `updatedAt` feed vulnerability exposure (`src/sim/60-infra/vulns.ts:58`). There is no channel and updates never fail.
- Cluster defaults live in `clusterDefaults` (`src/sim/60-infra/cluster.ts:~89`); old saves go through it in `src/sim/91-save/compute.ts:35,62`.
- UI: `PanelBase.tsx` `useRows` (`:118`) builds per-workload actions (start, stop, migrate, resize, delete); `Row.actions` is where a hold button goes. The cPanic console already shows version and a PHP action at `cpanic/CPanic.tsx:218-226`. `consoles.ts` holds `ConsoleFeatures` and `consoleTitle`.

## 3. Design

### 3.1 Account holds (features 1 and 2)

The hold stays a customer-level fact for billing and becomes a service-level fact for consoles, because a real panel suspends one account while the customer may own several.

State:
- `GameState.heldServices: Record<string, HoldReason>` (service id to reason). `HoldReason = "payment" | "abuse" | "manual"`. `newGame`: `{}`. `deserialize`: `data.heldServices ?? {}`. `heldCustomers` stays as is and means "all services of this customer".
- New helper in `45-billing/billing.ts`: `serviceHeld(s, v: Service): boolean` is true when `heldServices[v.id]` exists or `isSuspended(s, v.customerId)`. `holdReason(s, v)` returns the stored reason, or "payment" when the customer has an unpaid suspended invoice, or "manual" for `heldCustomers`.
- The five service-level callers switch from `isSuspended(s, v.customerId)` to `serviceHeld(s, v)`: `cluster.ts:450`, `tick.ts:133`, `network.ts:70`, `status.ts:11`, `usage.ts:256`. `isSuspended` stays for invoice logic.

Actions (`src/sim/90-actions/holds.ts`, exported from `90-actions/index.ts`):
- `suspendService(s, serviceId, reason)` and `unsuspendService(s, serviceId)`. The first hold on a customer reuses `SUSPEND_HAPPINESS` and the "suspended" billing ticket from `suspendCustomer`; a hold with reason "abuse" on a `shady` customer costs no happiness (they are the problem) and closes the open abuse notice ticket on that service as `takenDown` (reuse `applyNoticeWork(..., "takedown")` semantics without the extra 48-hour record). Unsuspending a service held for "payment" is refused while the invoice is unpaid (`error.holdPayment`).
- Payment tie: when `suspend()` (invoice) fires, nothing new is stored; `holdReason` derives "payment". Paying the invoice unsuspends as today. Habit shows in the console as a per-row badge "Overdue" read from invoices, so the player sees `late` and `bad` payers without a new state field.

Tick effects:
- `workloadLoad` returns `HELD_LOAD = 0.02` for a held service (a parked page). This frees used CPU and RAM and relieves slowdown on the host; booking and disk stay, so the host is not freed until the account is deleted. This is the "frees capacity and stops losses" in panel-features.md, bounded by what the sim can honestly say.
- A held shady customer draws no new abuse notices on held services: in `src/sim/40-support/tick.ts:118` the abuse rate multiplies by 0 when every service of the customer is held. This is the abuse relief the plan promises.
- Churn: reuse `SUSPEND_CHURN_DAYS` and `SUSPEND_CHURN_CHANCE` (`billing.ts:72-73`) for "manual" and "abuse" holds longer than 14 days on a non-shady customer.
- Economy: no new numbers beyond `HELD_LOAD = 0.02`; extends economy.md "Billing" (suspension) and "Usage curves and overcommit".

UI, one screen per console, label from `consoles.ts` `holdLabels(look)`:

| Console | Real screen imitated | Suspend label | Unsuspend label | Row state |
| --- | --- | --- | --- | --- |
| cPanic | WHM > Account Functions > Manage Account Suspension (reason box, Suspend/Unsuspend) | Suspend | Unsuspend | "Suspended" with reason in the Reason column |
| Pleskit | Subscriptions list > Suspend / Activate, status icon | Suspend subscription | Activate | status text "Suspended by admin" |
| DirectAdmin | Admin Level > Manage Users > Suspend/Unsuspend checkbox | Suspend | Unsuspend | red "Suspended" cell |
| FreePanel | Virtualmin > Edit Virtual Server > Disable / Enable | Disable server | Enable server | "Disabled" with reason |
| TCAdmen | Services list > Suspend (Game Monitor) | Suspend service | Resume service | "Suspended" |
| MultiKraft | Servers > Suspend | Suspend | Unsuspend | "Suspended" |
| Pterodaktyl | Admin > Servers > Manage > Suspend (Reinstall/Suspend panel) | Suspend | Unsuspend | "Suspended" badge |
| Proxmocks | no real suspend; "Stop and lock" as panel-features.md names it (Config lock) | Stop and lock | Unlock and start | lock icon |
| VMwhere, HyperVee, OpenVeeZee, Horizont | VM Suspend (vSphere power state Suspended), Hyper-V "Save", `vzctl suspend`, Nova "Suspend instance" | Suspend | Resume | power state "Suspended" |
| Mailpig, Postfixit | Mailbox/domain "Disable account" (Postfix admin Active toggle) | Disable account | Enable account | Active unchecked |
| PowerDNZ | Domain "Disable" is not real; Admin > Zones > "Disable zone" in PowerDNS Admin | Disable zone | Enable zone | greyed row |
| OpenVeePeeN, AnyConnekt | OpenVPN AS User Permissions "Deny access"; AnyConnect profile removal | Deny access | Allow access | "Denied" |
| MinnIO, OwnClod | MinIO user policy detach / ownCloud Users "Disabled" | Disable user | Enable user | "Disabled" |

This lane builds the shared `HoldAction` (a `PanelAction` factory taking the look) and wires it for the web panels, game panels and hypervisors in `useRows`/`HypervisorBase.tsx`. The mail, DNS, VPN and storage consoles get their entry from `mail-dns-vpn-storage`, which calls the same factory. The confirm dialog on cPanic, Plesk and DirectAdmin has a reason select (Non-payment, Abuse, Other) that maps to `HoldReason`; the other consoles pick the reason from context ("Abuse" when an open notice exists on that service, else "Other").

### 3.2 Oversell ratio per panel host (feature 3)

State:
- `Cluster.oversell?: number | null`, the player's cap on booked vCPU divided by physical vCPU for a panel host or game panel host. `null`/missing means no cap, which is today's behaviour. Default in `clusterDefaults`: `oversell: null`. Old saves load unchanged because missing is no cap; `deserialize` needs no migration beyond `clusterDefaults`.
- Readouts are derived, no state: `oversellRatio(s, c) = { cpu, ram }` booked over physical, summed over the nodes of the cluster (bare metal) or the panel VM (inside a VM, using the VM's booked vCPU and RAM times `IN_VM` 0.95 from `10-catalog/platforms.ts`).

Booked resources are what the package books; a service sold above its booking (`Workload.promised`, set by `packages-provisioning` M2) shows both numbers in the readout, and the ratio uses the booking.

Placement (`src/sim/60-infra/oversell.ts`, new): `withinOversell(s, c, add: Resources)` is true when the cap is null or `(booked + add) / physical <= cap` for vCPU. Called from `nodeTakes` (`cluster.ts:184`) for panel clusters only, and from `placeService`/`provisionService` (`src/sim/90-actions/clusters.ts:383,431`) so both manual forms and automation obey it. Error `error.oversellCap`.

Tick effect (so overselling has a price beyond the existing CPU math):
- Contention when ratio is high. In `nodeUsage` (`usage.ts:88`) the cpu term already slows at peak use. Add `contention(ratio)` for panel clusters only: `perf *= max(0.85, 1 - 0.04 * max(0, ratio - 4))`. Rationale: past 4 booked vCPU per physical vCPU the disk and network of shared hosting degrade even when averages look fine. This slows at all hours, `overload` (`products.ts:262`) then sets `slowedAt` and unhappiness, and the month-without-`slowedAt` review (`products.ts:322`) is lost.
- No new threshold for the CPU case: average panel loads of 0.25 to 0.45 (economy.md "Usage curves") mean ratios up to about 2.5 are safe at the daily peak of 0.7 to 0.9 on a quiet host, and a game panel (curve peaks 1.0 at weekend evening) is safe only to about 1.2. The panel shows peak use against the ratio so the player learns this; no tutorial text.
- Gain: more accounts per host. Cost: slowdown, reviews, and a shady neighbour's spike reaching everyone (already true through `nodeUsage`).

Economy: extends "Usage curves and overcommit". Numbers: `OVERSELL_KNEE = 4`, `OVERSELL_SLOPE = 0.04`, `OVERSELL_FLOOR = 0.85`.

UI, per console (host overview, not the accounts list):

| Console | Real screen imitated |
| --- | --- |
| cPanic | WHM > Server Status > Server Information and Daily Process Log; booked/used meters beside "Load Average"; the cap sits under WHM > Server Configuration > Tweak Settings as "Max accounts per CPU" |
| Pleskit | Tools & Settings > Server Health Monitor, plus Resource Controller (limits) |
| DirectAdmin | Admin Level > System Info and Admin Settings (server limits) |
| FreePanel | Webmin System Information dashboard; Virtualmin > System Settings > Server Templates for the cap |
| TCAdmen, MultiKraft, Pterodaktyl | Game panel host list with "Slots used / RAM booked", Pterodactyl node page "Memory over-allocation %" (this is a real Pterodactyl setting, so the cap there is the real field name) |

Each shows booked and used vCPU, RAM and disk, the ratio, the cap field, the hour of last `slowedAt` ("Last slowdown") and the number of accounts. Pterodaktyl's field is "Overallocate" in percent (150 = ratio 1.5), the others take a ratio.

### 3.3 Licence tiers (feature 4)

Catalog (`src/sim/10-catalog/licence-tiers.ts`, new; extends economy.md "Platforms and licenses"): per panel software a list of tiers `{ id, name, cap: number | null, fee, kind }`. The top tier keeps today's fee so existing economics do not move. Real editions imitated: cPanel Solo/Admin/Pro/Premier, Plesk Web Admin/Web Pro/Web Host, DirectAdmin Personal/Lite/Standard.

| Software | Tier | Account cap | Fee per month |
| --- | --- | --- | --- |
| cPanic | Solo | 1 | €2 |
| cPanic | Admin | 5 | €4 |
| cPanic | Pro | 30 | €10 |
| cPanic | Premier | none | €0.40 per account (today's) |
| Pleskit | Web Admin | 10 | €5 |
| Pleskit | Web Pro | 30 | €8 |
| Pleskit | Web Host | none | €12 (today's) |
| DirectAdmin | Personal | 1 | €1 |
| DirectAdmin | Lite | 10 | €2 |
| DirectAdmin | Standard | none | €4 (today's) |
| FreePanel | none | none | free |

Every cap tier is cheaper than the top tier at its full cap and dearer at low counts only for cPanic Pro (€10 up to 30 accounts is cheaper than €0.40 per account above 25), so upgrading is a real decision. Game panels keep their per-server fee and are not tiered here (`game-servers` may add tiers using the same catalog shape). VMwhere editions in `hypervisors-backups` (M7) add Essentials, Standard and Enterprise rows to this catalog (`kind: "once"`, `cap: null`) and use the same `Cluster.licence.tier` and `licenceFor`; that lane adds no field of its own.

State:
- `Cluster.licence?: { tier: string; trialUntil: number | null; lapsedAt: number | null }`. `clusterDefaults`: for a cluster with a licensed panel and no `licence`, `{ tier: <top tier id>, trialUntil: null, lapsedAt: null }`, so every existing save keeps unlimited accounts and no expiry. A newly installed licensed panel gets `{ tier: <top>, trialUntil: now + 30 days, lapsedAt: null }` (a trial is the top tier in cap and free for 30 days; panels bill from the next 1st today, so the trial replaces nothing already free). After the trial it needs a paid tier.
- `softwareFee` (`products.ts:~66`) reads the tier fee instead of the catalog fee when a tier exists.

Actions: `setLicenceTier(s, clusterId, tierId)` in `90-actions/licence.ts`. Refuses a tier whose cap is below the current account count (`error.licenceCap`). Downgrades apply at once, upgrades too; fee changes from the next 1st via the existing monthly line.

Tick effects (`licenceTick`, hourly in the economy tick next to licence billing):
- On the 1st, if cash cannot pay the cluster's licence line, set `lapsedAt = hour` (expired). Cash recovery below the fee within 7 days lets the next hourly pass clear it (`lapsedAt = null`) and bill; after 7 days the licence stays lapsed until `setLicenceTier` is called and paid.
- An expired or trial-ended licence blocks `placeService`, `provisionService` and the create forms (error `error.licenceExpired`) and the update action. Existing accounts keep running. The panel shows a red banner. No happiness effect on customers: the sim has no basis for one.
- The account cap blocks placement above `cap` (`error.licenceCap`).
- Count: web spaces and game servers on the cluster with `endedAt === null` services, held ones included (real panels count suspended accounts).

UI:

| Console | Real screen imitated |
| --- | --- |
| cPanic | WHM > Server Information > "cPanel License Information" (licence type, accounts used of cap, expiry) and the red banner "Your license has expired" |
| Pleskit | Tools & Settings > License Management (key type, domain/subscription limit) with the red notice bar on the top |
| DirectAdmin | Admin Level > License Information ("Licence ID, expires"), banner in the header |
| FreePanel | Webmin > Virtualmin License ("Your license is GPL, unlimited") shown only on this lane's behalf with no tier choice |

Era looks use the existing `erasFrom` in `PanelBase.tsx:30`; the licence page reuses each console's existing early/late chrome and adds no new era.

### 3.4 Update channel (feature 5)

State: `Cluster.channel?: "stable" | "release" | "edge"`. Default in `clusterDefaults`: `"stable"` for old saves (they currently take the year's release at once, closest to Release; set `"release"` for old saves so nothing visibly changes, and `"stable"` for new installs).

Release targets (replace `c.version < yearOf(s.hour)` in `updateDue`, `software.ts:111`): `targetYear(channel, s.hour)`: Edge is the current year from 1 January, Release from 1 April, Stable from 1 July; before that date a channel targets the previous year. A cluster whose `version >= targetYear` is up to date. The vulnerability exposure code (`vulns.ts:58`) is untouched: a lagging channel stays exposed to that year's vulnerabilities for longer, which is the cost of Stable; vulnerability patches that are already out (`openVulns`) keep making `updateDue` true on every channel.

Breakage (in `updateSoftware`, deterministic from `hashRng(s.seed, s.hour, clusterIdNum, 71)`): chance that an update breaks: Stable 1%, Release 4%, Edge 12% (a panel with `phpUntil` or hacked doubles nothing; keep it flat). A break extends `busyUntil` of every workload on the cluster by `BREAK_HOURS = 6` (Edge) / 3 (others), counts the time in `downHours`, files a ticket `outage` per affected customer through the existing outage ticket path, and raises an event `event.updateBroke`. The player cannot undo it; fixing it is waiting, which is deliberate. `autoUpdateTick` rolls the same dice, so an Edge host with auto update can break at 03:00 unnoticed.

Edge benefit: other lanes gate features by the release year a cluster runs. Export `featureYear(s, c)` (= `c.version` while the cluster is on that release): a feature that arrives in year Y is available on Edge from 1 January, Release from 1 April, Stable from 1 July, so Edge gets it up to six months sooner. This lane ships only the function and uses it for one visible effect: how-to tickets factor `×0.97` on Edge (new features reduce questions). Other lanes (`web-services` signature mechanics, `hypervisors-backups`) decide their own gates.

Economy: extends "Security advisories, Updating". Numbers above (`BREAK_CHANCE = { stable: 0.01, release: 0.04, edge: 0.12 }`).

UI:

| Console | Real screen imitated |
| --- | --- |
| cPanic | WHM > Server Configuration > Update Preferences, "cPanel Update Tier" radio (LTS/Stable/Release/Current renamed Stable/Release/Edge) and "Upgrade now" |
| Pleskit | Tools & Settings > Updates and Upgrades > Update Settings (release tier selector), Install Updates |
| DirectAdmin | Admin Level > Admin Settings > Update/CustomBuild channel; the CustomBuild rebuild action stays with `web-services` |
| FreePanel | Webmin Configuration > Webmin Upgrade (upgrade source) with the channel as a dropdown |

## 4. Milestones

1. **Account holds in the sim.** `heldServices`, `serviceHeld`, `holdReason`, `suspendService`, `unsuspendService`, `terminateService` (sets `Service.endedAt`, drops the workload through the same path the churn roll uses, costs `SUSPEND_HAPPINESS`, leaves unpaid invoices open, refuses nothing else), the five caller swaps, `HELD_LOAD`, abuse rate relief, notice closing. Tests: `tests/service-hold.test.ts` (terminate ends the service and frees the booking; hold stops one service not its sibling, unsuspend, payment hold refused while unpaid, shady abuse notices stop, held load frees used CPU, old save without `heldServices` loads, serialize round trip); existing `tests/suspension.test.ts` and `tests/appeal.test.ts` stay green.
2. **Hold UI in every console.** Terminate row action beside Suspend with the product's own label and a confirm dialog; `holdLabels` in `consoles.ts`, `HoldAction` factory and the row state column in `PanelBase.tsx` and `HypervisorBase.tsx`, the reason select on cPanic, Pleskit, DirectAdmin; `ui-panel-host.ts` keys in all languages. Tests: `tests/hold-labels.test.ts` (each `ConsoleLook` has both labels, no empty keys), `tests/i18n.test.ts` stays green, a `tests/panel-hold-ui.test.tsx` render check for cPanic and TCAdmen rows following `tests/software-sites.test.tsx`.
3. **Oversell sim.** `oversell.ts`, `Cluster.oversell` default, placement check, contention in `nodeUsage`, `setOversell` action. Tests: `tests/oversell.test.ts` (placement refused above cap, no cap unchanged, contention starts past ratio 4 and floors at 0.85, `slowedAt` set by contention, old save loads with no cap).
4. **Oversell UI.** Host overview per web and game console with booked/used, ratio, cap field, last slowdown. Tests: `tests/oversell-ui.test.tsx` (ratio text and cap action).
5. **Licence sim.** `licence-tiers.ts`, `Cluster.licence`, `softwareFee` by tier, `setLicenceTier`, `licenceTick` expiry, cap and expiry checks in `placeService`/`provisionService`. Tests: `tests/licence.test.ts` (tier fee on the ledger, cap blocks, downgrade below count refused, trial ends and blocks, lapse on empty cash, recover within 7 days, old save gets unlimited top tier).
6. **Licence UI.** Licence pages and banners for cPanic, Pleskit, DirectAdmin, FreePanel. Tests: `tests/licence-ui.test.tsx`.
7. **Update channel sim.** `Cluster.channel`, `targetYear`, break roll, `featureYear`, how-to factor, auto-update interaction. Tests: `tests/update-channel.test.ts` (target year per channel and date, break rates over a seeded sample within bounds, break extends `busyUntil` and files tickets, old save defaults to release, `featureYear`).
8. **Update channel UI.** Update preference screens for the four web consoles. Tests: `tests/update-channel-ui.test.tsx`.

Each is green alone; 1 to 2, 3 to 4, 5 to 6 and 7 to 8 are independent chains and may land in any interleaving.

## 5. Files touched

Hotspots are marked **(H)**.

- M1: new `src/sim/90-actions/holds.ts`; edit `src/sim/50-state.ts` **(H)** (field and `newGame` default), `src/sim/91-save/save.ts` **(H)** (`deserialize` default), `src/sim/45-billing/billing.ts`, `src/sim/60-infra/cluster.ts:450` **(H)**, `src/sim/40-support/tick.ts`, `src/sim/60-infra/network.ts`, `src/sim/40-support/status.ts`, `src/sim/60-infra/usage.ts`, `src/sim/90-actions/index.ts`, `src/sim/40-support/notices.ts` (close notice); new `tests/service-hold.test.ts`.
- M2: edit `src/sim/80-business/consoles.ts` **(H)**, `src/ui/apps/browser/consoles/PanelBase.tsx` **(H)**, `src/ui/apps/browser/consoles/HypervisorBase.tsx` **(H)**, the console folders `cpanic/`, `pleskit/`, `directadmin/`, `freepanel/`, `tcadmen/`, `multikraft/`, `pterodaktyl/`, `proxmocks/`, `vmwhere/`, `hypervee/`, `openveezee/`, `openstash/` (reason select only where noted), `src/i18n/en.ts` **(H)** and `src/i18n/lang.ts` (registration lines); new `src/i18n/ui-panel-host.ts` and `src/i18n/{de,es,fr,it,pt}/ui-panel-host.ts`; new `tests/hold-labels.test.ts`, `tests/panel-hold-ui.test.tsx`.
- M3: new `src/sim/60-infra/oversell.ts`, `src/sim/90-actions/oversell.ts`; edit `src/sim/60-infra/cluster.ts` **(H)** (`Cluster` type, `clusterDefaults`, `nodeTakes`), `src/sim/60-infra/usage.ts` (contention), `src/sim/90-actions/clusters.ts`, `src/sim/91-save/compute.ts`; new `tests/oversell.test.ts`.
- M4: edit `PanelBase.tsx` **(H)** (host overview export), the web and game console folders, `ui-panel-host.ts` keys; new `tests/oversell-ui.test.tsx`.
- M5: new `src/sim/10-catalog/licence-tiers.ts`, `src/sim/90-actions/licence.ts`; edit `src/sim/85-products/products.ts` **(H)** (`softwareFee`, licence billing at `:332`), `src/sim/60-infra/cluster.ts` **(H)**, `src/sim/90-actions/clusters.ts`, `src/sim/88-tick/tick.ts` **(H)** (`licenceTick` registration), `src/sim/91-save/compute.ts`; new `tests/licence.test.ts`.
- M6: edit `PanelBase.tsx` **(H)**, `cpanic/CPanic.tsx`, `pleskit/Pleskit.tsx`, `directadmin/`, `freepanel/`, `ui-panel-host.ts` keys; new `tests/licence-ui.test.tsx`.
- M7: edit `src/sim/90-actions/software.ts`, `src/sim/60-infra/cluster.ts` **(H)**, `src/sim/40-support/tick.ts` (how-to factor), `src/sim/88-tick/tick.ts` **(H)** only if the break needs an event hook; new `src/sim/60-infra/channel.ts`, `tests/update-channel.test.ts`.
- M8: edit the four web console folders and `PanelBase.tsx` **(H)**, `ui-panel-host.ts` keys; new `tests/update-channel-ui.test.tsx`.

`products.ts` here means `src/sim/85-products/products.ts`; the catalog `src/sim/10-catalog/products.ts` is untouched.

## 6. Dependencies

- Needs first: `readouts` (it restructures `PanelBase.tsx` rows, usage bars and the task log; M2, M4, M6 and M8 add to the same file and should land after it). The sim milestones M1, M3, M5, M7 have no lane dependency and can land first.
- Soft: `packages-provisioning` (its create forms must call `placeService`/`provisionService` with the cap and licence checks; if its forms land first they get the checks for free because the checks sit in those actions, and M5 adds a test for the form path).
- Blocks: `mail-dns-vpn-storage` (uses `suspendService`, `holdLabels` and `HoldAction` for the mail blacklist incident fix and the account row buttons), `game-servers` (auto-restart must skip held services; uses `serviceHeld` and the oversell panel), `web-services` (signature mechanics such as AutoSSL and Pleskit mass update gate on `featureYear`), `hypervisors-backups` (VM suspend rows, VMwhere editions reuse the licence-tier catalog shape, `setLicenceTier`), `shop-portal` (the shop product creation must respect the licence cap and show the held state on Add client).

## 7. Open questions

1. Does a suspension free host capacity beyond load? Recommendation: no; booking and disk stay until the account is deleted, because a suspended account can come back.
2. Should the licence trial be 30 days free on every new panel, or should new installs start on a paid tier? Recommendation: 30-day trial on cPanic, Pleskit and DirectAdmin, so expiry is something a player meets once early and learns from.
3. Should an expired licence also take sites offline after a grace period? Recommendation: no; blocking only new accounts matches the plan and avoids punishing a cash crunch twice.
4. Edge's benefit is time-to-feature plus a small how-to cut. Is that enough to tempt players? Recommendation: ship it and revisit once `web-services` mechanics gate on `featureYear`.
5. Old saves: Release or Stable as the default channel? Recommendation: Release, since it matches what clusters do today.
