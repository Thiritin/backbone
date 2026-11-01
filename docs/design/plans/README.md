# Panel feature plans

Eight lane plans cover the features in `docs/design/panel-features.md`. This page lists the lanes, the order they can be built in, the files several lanes edit, and the decisions that are the user's.

Billing, quotes, bank matching, the first-hour walk, vendor sites and payment methods are a separate set of lanes in [billing-by-hand](billing-by-hand.md). Provider websites, colocation contracts with notice periods and the customer portal per provider are in [colo-portals](colo-portals.md). Trials, licence keys, vendor shops with a cart and My account are in [software-licences](software-licences.md). Bank account plans, the plan a legal form needs, switching banks and loan rates by bank are in [bank-plans](bank-plans.md).

## Lanes

- [readouts](readouts.md): shared read-only pages in `PanelBase.tsx` (task log, usage bars, log viewer, licence page frame), per-console screens (cPanic Service Manager and customer side, Pleskit Advisor, FreePanel tree, Horizont flavors, HyperVee Integration Services, VMwhere EVC, OpenVeeZee templates, DNS/mail/VPN/MinnIO charts, IPMI sensors), then two small sims (HyperVee Checkpoints, IPMI virtual media). 12 milestones.
- [packages-provisioning](packages-provisioning.md): the package store per software installation, provisioning from a package, create forms with the Order field in every panel, Customers > New customer, change package. 17 milestones.
- [panel-host-sim](panel-host-sim.md): per-service suspend and unsuspend, terminate, oversell ratio with cap and contention, licence tiers with account caps and expiry, update channel. 8 milestones.
- [shop-portal](shop-portal.md): billing cycles, product groups and products, the hosted portal with WHMCS-style admin and client area, skins, status and legal pages. 12 milestones.
- [game-servers](game-servers.md): game titles and slots, players online, crashes and auto-restart, scheduled restarts, versions and mods, Pterodaktyl daemons and ports, and the live console log (deferred, last). 10 milestones.
- [web-services](web-services.md): PHP profiles, CustomBuild, AutoSSL, banned IPs, Pleskit subscriptions, WordPrass mass update, account transfer, DirectAdmen Message System, DirectAdmen resellers (deferred, last). 9 milestones.
- [mail-dns-vpn-storage](mail-dns-vpn-storage.md): mail queue, blacklist incident and relay, mailbox quotas, PowerDNZ zones and secondary DNS, VPN certificates and expiry, MinnIO buckets and erasure health, OwnClod links and quotas. 11 milestones.
- [hypervisors-backups](hypervisors-backups.md): backup jobs, restore tests and offsite copy, Proxmocks quorum, replication, Ceph and firewall, VMwhere editions, DRS, maintenance mode, alarms and pools, HyperVee Replica and switches, OpenVeeZee beancounters, Horizont networking and volumes, IPMI event log; HA groups and Horizont projects deferred, last. 15 milestones.

## Build order

Lanes in one wave run in parallel in separate worktrees. A lane waits for the lanes it depends on, except for the milestones noted as free to start earlier.

**Wave 0: one small pull request.** `readouts` M1 (the extra-pages hook, the widened `Tab` and the task log on the web panels). Every other lane appends pages through that hook, so it lands before them.

**Wave 1: foundations, in parallel.**
- `readouts` M2 to M12.
- `packages-provisioning` M1 to M17 (M1 and M2 are sim-only and need nothing).
- `panel-host-sim`. Its sim milestones M1, M3, M5 and M7 need nothing; the UI milestones M2, M4, M6 and M8 wait for `readouts` M2 to M4.
- `mail-dns-vpn-storage`. It needs nothing and uses the `suspendService` factory when `panel-host-sim` M1 and M2 have landed.

**Wave 2: lanes that read wave 1.**
- `shop-portal`: needs `packages-provisioning` M1, M2 and M7. M1 to M5 of this lane need nothing and may start in wave 1.
- `game-servers`: needs `panel-host-sim` (held services, oversell panel), `packages-provisioning` M1, M2, M6, M11 and M12 for its package milestone, and `readouts` M1. Its milestones 1 to 8 need only `pickTitle`.
- `web-services`: M1 to M6 need nothing and may start in wave 1; M7 needs `packages-provisioning` M2 and its create form; the suspend button in M5 needs `panel-host-sim` M2.
- `hypervisors-backups`: M1 to M6 need nothing beyond `readouts` M1; M3 uses the system-mail helper of `mail-dns-vpn-storage` M2 when present; M7 needs `panel-host-sim` M5 (licence tiers); M11 needs `panel-host-sim` M3 (oversell ratio). Its VMwhere and HyperVee edits must be rebased on `readouts` M10 and M12.

**Wave 3: deferred milestones, last in their lane.**
- `web-services` M9 (DirectAdmin resellers).
- `hypervisors-backups` M14 (Proxmocks HA groups, after its M4) and M15 (Horizont projects with quotas).
- `game-servers` M10 (live console log).
- `shop-portal` M12 (long tail).

## Shared hotspots

| File | Lanes that edit it | Rule |
| --- | --- | --- |
| `src/ui/apps/browser/consoles/PanelBase.tsx` | readouts (M1 first; `Tab`, `Bar`, `Row`, `useRows`, `Migrate`), panel-host-sim (state column, host overview), packages-provisioning (Account columns, create-form link), game-servers (optional `Row.game`), hypervisors-backups (row actions) | `readouts` M1 lands first and adds `useReadoutPages`. Every later lane appends pages and row fields through the hook or as one optional field on `Row`, and never reorders the nav arrays. |
| `src/ui/apps/browser/consoles/HypervisorBase.tsx` | readouts (`tasks` re-export), panel-host-sim (hold action), packages-provisioning (create form), hypervisors-backups | Same hook rule; row actions are added as separate entries in the action list. |
| `src/sim/50-state.ts` and `newGame` | panel-host-sim (`heldServices`), game-servers (`gameServers`, `daemons`), web-services (`webpanel`), mail-dns-vpn-storage (`netsvc`), shop-portal (`statusDays`), readouts (`Device.virtualMedia`), hypervisors-backups (`Device.log` entry shape) | Each lane adds exactly one top-level key (or one optional `Device` field) in its own commented line, with the default in `newGame` beside it. Merge order does not matter; rebase conflicts are one line. |
| `src/sim/91-save/save.ts` (`deserialize`) | panel-host-sim, game-servers (`fillGames`), web-services, mail-dns-vpn-storage, shop-portal, hypervisors-backups | Each lane adds one `fill<Lane>` call to the chain, with the function in its own file next to its sim code. |
| `src/sim/60-infra/cluster.ts` (`Cluster`, `clusterDefaults`) and `91-save/compute.ts` | packages-provisioning (`packages`), panel-host-sim (`oversell`, `licence`, `channel`), hypervisors-backups (many), game-servers (daemon link) | `packages-provisioning` M1 goes first. Each lane keeps its fields in its own commented block of both the type and `clusterDefaults`. VMwhere editions use `Cluster.licence.tier` from `panel-host-sim` and add no field of their own. |
| `src/sim/80-business/consoles.ts` | panel-host-sim (hold labels), packages-provisioning (deep-link ids), game-servers, hypervisors-backups (freeze flag, firewall, quorum flags) | One flag per line inside a lane-named comment block. |
| `src/sim/60-infra/usage.ts` | game-servers (`gameLoad` extraction), packages-provisioning (booking), panel-host-sim (contention, hold load), hypervisors-backups (frozen skip, failcnt) | `game-servers` extracts `gameLoad` once; `panel-host-sim` M1 swaps the `isSuspended` caller to `serviceHeld`; the others add a clause in a separate function. |
| `src/sim/88-tick/tick.ts` | panel-host-sim (licence tick, update break), game-servers (`gamesTick`), web-services, mail-dns-vpn-storage (`netsvcTick`), shop-portal (daily status hook), hypervisors-backups | One call per lane on its own line. A lane never edits another lane's call. |
| `src/sim/85-products/products.ts` | panel-host-sim (`softwareFee` by tier, licence billing), hypervisors-backups (backup storage) | `panel-host-sim` M5 changes `softwareFee`; hypervisors-backups M1 only adds a separate function. |
| `src/sim/40-support/tickets.ts` | web-services, mail-dns-vpn-storage, game-servers, shop-portal | New ticket topics are appended to the end of the topic table, one block per lane. |
| `src/sim/10-catalog/products.ts` and `platforms.ts` | web-services (`transferFrom`, reseller tables), hypervisors-backups (edition rows), readouts (`snapshots` flag), game-servers (only if packages-provisioning lacks `title`, `slots`) | Catalog rows are appended; `packages-provisioning` M1 reserves `title` and `slots` on the package so `game-servers` does not add them. |
| `src/sim/90-actions/index.ts` | all sim lanes | One export line per new action file. |
| `src/sim/30-customers/customers.ts`, `30-market/market.ts` | packages-provisioning (`Service.pkg`, `SalesRequest.pkg`), shop-portal (cycle fields), web-services (reseller unions, M9) | Optional fields only; each lane in its own comment line. |
| `src/i18n/` | all lanes | Each lane puts new English keys in `src/i18n/ui-<topic>.ts` (`ui-readouts`, `ui-packages`, `ui-panel-host`, `ui-shop-portal`, `ui-games`, `ui-web-services`, `ui-netsvc`, `ui-hypervisors-backups`) with mirrors in every language folder. `en.ts` loads `ui-*.ts` and `lang.ts` loads `<lang>/*.ts` by glob, so no registration edit exists. |

## Fixes made by the critic pass

1. The DirectAdmen Message System was claimed by `readouts` and `web-services`. It now belongs to `web-services` M8 only; `readouts` dropped it and its test.
2. The game panel live console was claimed by `readouts` (M9) and `game-servers` (M10). It now belongs to `game-servers` M10; `readouts` dropped item 21, section 3.19 and the milestone, and renumbered M10 to M13 as M9 to M12.
3. Terminate (cPanic Account Functions, Pleskit remove subscription, DirectAdmin delete user) had no owner: `packages-provisioning` and `shop-portal` assumed `panel-host-sim` had it, which did not. `panel-host-sim` now owns `terminateService` and the Terminate row action (M1 and M2).
4. `hypervisors-backups` defined `Cluster.edition` while `panel-host-sim` defined `Cluster.licence` and said VMwhere editions reuse it. VMwhere editions now use `Cluster.licence.tier` and the shared tier catalog; old VMwhere clusters load as Enterprise (they had every feature), new ones start on Essentials. M7 now depends on `panel-host-sim` M5.
5. `hypervisors-backups` named the OpenVeeZee live checkpoint `suspendWorkload` with a "Suspend" button, which collided with `panel-host-sim`'s account hold (`suspendService`, `heldServices`) and its OpenVeeZee Suspend label. The platform operation is now `freezeWorkload`/`thawWorkload`, `Workload.frozen`, with Checkpoint and Restore buttons; the two flags are independent.
6. `shop-portal`'s `ShopProduct` could not carry a game title or slots. It now has optional `title` and `slots` snapshots, and the bound package's own values win.
7. `panel-host-sim` now states that the oversell readout uses the booking and shows sold spec from `Workload.promised`, the field `packages-provisioning` writes.
8. Five plans named a registration edit in `en.ts` or `lang.ts`. The files are renamed to `ui-<topic>.ts`, which the existing globs load, so no lane edits `en.ts` and a note at the top of each plan says so.
9. Claims checked against the code and found correct: `isSuspended` callers in `cluster.ts`, `tick.ts`, `network.ts`, `status.ts` and `usage.ts:256`; `Tab` at `PanelBase.tsx:25`; the datastore requirement in `snapshots.ts:17`; `plugStick` sending a technician; the untranslated "No OS templates" string; `pushLog` in `power.ts`.

## Open questions

Each recommendation is the planner's; the decision is the user's.

**Scope and shape**
1. Persisted task history (readouts). Recommendation: no, ship the derived log.
2. Draw Service Manager restart buttons for exim and named now (readouts)? Recommendation: only Stop and Start on the web server until the mail and DNS lane gives the daemons behaviour.
3. One optional `Device.virtualMedia` field for IPMI virtual media (readouts). Recommendation: accept it.
4. HyperVee Checkpoints through a `snapshots` catalog flag or by giving HyperVee datastores (readouts). Recommendation: the flag.
5. Is the Order field required on create forms (packages-provisioning)? Recommendation: yes for customer services; hypervisor forms keep the own-VM path when it is empty.
6. Does editing a package change existing accounts? Recommendation: no.
7. How far may a package undercut the sold spec? Recommendation: vCPU down to 25 percent, RAM and disk to 50 percent.
8. Build change package (packages-provisioning M17)? Recommendation: yes, last.
9. Which host does the Support link open on when several fit? Recommendation: the selected host card, defaulting to `hostFor`.
10. Does a suspension free capacity beyond load (panel-host-sim)? Recommendation: no.
11. New panel licence: 30-day top-tier trial or a paid tier from day one? Recommendation: 30-day trial on cPanic, Pleskit and DirectAdmen.
12. Should an expired licence take sites offline after a grace period? Recommendation: no, block new accounts only.
13. Is Edge's time-to-feature plus a small how-to cut enough to tempt players? Recommendation: ship and revisit.
14. Default update channel for old saves: Release or Stable? Recommendation: Release.

**Shop and economy**
15. Does the hand-rolled variant need the "Shop systems" research (shop-portal)? Recommendation: no.
16. Refund unused cycles in cash on mid-term cancellation? Recommendation: yes, only below happiness 15.
17. Real test order from the player's own store? Recommendation: no, checkout stays a preview.
18. Cap for a lead no product covers. Recommendation: keep 1.35 times the reference price.
19. Does a customer's cycle price follow list price changes at renewal? Recommendation: yes.

**Game servers**
20. Who picks the game title? Recommendation: the customer's order via `pickTitle`; the player only when creating by hand, and `changeTitle` afterwards.
21. Refunds when a Pterodaktyl daemon is offline. Recommendation: none; the existing outage credit covers it.
22. Ship the live console log (game-servers M10)? Recommendation: keep as the last milestone and drop it if earlier ones run long.
23. Does the sold unit follow the installed panel or the year? Recommendation: the panel.
24. First balance numbers for the daemon outage rate (0.0003 per hour) and port pool (100). Recommendation: ship and tune in `npm run balance`.

**Web services**
25. Build DirectAdmin resellers at all, and when? Recommendation: after the other lanes land.
26. Transfer time as the player's own time or a technician operation. Recommendation: the player's time, 15 minutes plus 5 per 10 GB.
27. Pun names for "Sectigo" and similar. Recommendation: "Sectigone"; keep AutoSSL and Fail2Ban as feature names.
28. Banned IPs beyond Pleskit. Recommendation: Pleskit only.
29. A "Free migration" line on the website. Recommendation: skip.
30. Certificate expiry incident on all panels with auto mode only on cPanic. Recommendation: keep.

**Mail, DNS, VPN, storage**
31. Relay setting so mail panels get their own customers. Recommendation: yes.
32. Monthly customer-request tickets as the way decisions reach the player. Recommendation: yes, at the stated low rates.
33. MinnIO beyond parity: data loss or only offline. Recommendation: offline only in this lane.
34. CLI-only products (Postfixit, Bound, Knut, WireGuarded): buttons labelled with their commands or read-only listings. Recommendation: buttons.

**Hypervisors and backups**
35. A two-node Proxmocks cluster losing one node goes read-only. Recommendation: yes.
36. Bad backup points at 1 percent per point. Recommendation: keep.
37. VMwhere edition price multipliers 1, 2, 4 of the 600 fee per node. Recommendation: accept and tune in `npm run balance`.
38. Firewall and security group effect (breach risk times 0.5). Recommendation: accept and revisit after a balance run.
39. Lift the HA groups deferral after quorum ships, keep Horizont projects deferred. Recommendation: yes to both.
