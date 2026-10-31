# Plan: game-servers lane

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

Lane id `game-servers`. It owns everything in the "Game panels" and "Game titles and slots" sections of `panel-features.md` and turns the three game consoles (TCAdmen, MultiKraft, Pterodaktyl) from skins over `RowsTable` into panels that look and behave like TCAdmin, Multicraft and Pterodactyl.

## 1. Scope

Traced to `panel-features.md`, "Game panels" (lines 100 to 110), "Game titles and slots" (lines 212 to 226), the packages table (line 184 to 186), "Cut / deferred" and build-order step 6.

| # | Feature | Tag | Source section |
| --- | --- | --- | --- |
| 1 | Punned game titles with arrival and fade years by era | [Sim] | Game titles and slots |
| 2 | Sold unit follows the era: slots (TCAdmen), RAM (MultiKraft), RAM and CPU (Pterodaktyl) | [Sim] [UI] | Game titles and slots |
| 3 | Slot to resource conversion per title | [Sim] | Game titles and slots |
| 4 | Players online as load times slots, with a per-server readout | [Sim] [UI] | Game panels, Game titles and slots |
| 5 | Full at peak raises the upgrade request chance | [Sim] | Game titles and slots |
| 6 | Old services without a title show RAM only | [Sim] [UI] | Game titles and slots |
| 7 | Game version picker, release waves, churn on old versions | [Sim] [UI] | Game panels |
| 8 | Mod and plugin installer | [Sim] [UI] | Game panels |
| 9 | Scheduled restarts | [Sim] [UI] | Game panels |
| 10 | Crash detection with automatic restart | [Sim] [UI] | Game panels, Cross-cutting (auto-restart) |
| 11 | Pterodaktyl node daemon status | [Sim] [UI] | Game panels |
| 12 | Pterodaktyl port allocations | [Sim] [UI] | Game panels |
| 13 | The packages screens of the three consoles (Game services, Plans, Nests and eggs) | [UI] | Packages table |
| 14 | A live console with log lines | [UI] | Game panels, listed as UI. See milestone 8 and open question 3. |

Deferred items: the live console log (14) is a [UI] feature that only copies the look of the product. `panel-features.md` lists it under Game panels without putting it on the cut list, so it is planned as the last milestone. Nothing on the cut list is planned here.

Packages and the order forms come from `packages-provisioning`. This lane adds the game fields to them, not the screens' framework.

## 2. Current state

- `src/sim/80-business/index.ts:20` registers `gamePanels` as `tcadmen`, `multikraft`, `pterodaktyl`. `src/sim/80-business/consoles.ts:23` has `GAME_PANELS`, line 30 `GAME_NAMES`, line 75 to 76 the ports. All three share the `game` look and the same `ConsoleFeatures`. Nothing differs between them except the title and port.
- Game servers are the product `gameServer` (`src/sim/10-catalog/products.ts:34`, runs on a cluster, hourly period). Size comes from `game(share)` at line 56 (0.5 vCPU and 0.5 GB RAM times share, grown by year). There is no title, slot count, version, mod or restart state. `Service` (`src/sim/30-customers/customers.ts:17`) has `label`, `price`, `product` but no game fields.
- Load: `curveFor(gameServer, ...)` gives the "game" curve (`src/sim/10-catalog/usage.ts:22`), documented in economy.md "Usage curves and overcommit" (weekday peak 0.45, weekend peak 1.0, week average about 0.35). `workloadUse` (`src/sim/60-infra/usage.ts:70`, curve line 34) returns used resources, not the load share, so a player count has no source yet.
- Upgrade requests: `src/sim/40-support/tick.ts:163` to `170` draws `UPGRADE_CHANCE[p.budget]` (2, 3, 4 percent, `src/sim/40-support/tickets.ts:51`) per customer and opens an `upgrade` ticket on a random `expandable` service (`tickets.ts:107`). Growth uses `grownSpec` (`src/sim/30-market/spec.ts:51`) with `UPGRADE_FACTOR` 1.5 (`src/sim/40-support/retention.ts:27`). Churn is `p.churn` plus a happiness term at lines 163 to 165 of the same file.
- Provisioning: `provisionService` at `src/sim/90-actions/clusters.ts:431`.
- Console UI: `TCAdmen.tsx` (53 lines, era split at 2016 via `erasFrom(2005, 2016)`), `MultiKraft.tsx` (72), `Pterodaktyl.tsx` (52). Each lays out `RowsTable`/`useRows` from `PanelBase.tsx` (`useRows` line 118 builds rows with start, stop, migrate, resize actions; `Row` type line 111). Pterodaktyl draws its own `pt-server` articles with CPU and memory bars.
- Tests: `tests/game-panels.test.ts` covers provisioning on game panels; `tests/panel-consoles.test.tsx` and `tests/console-screens.test.ts` render consoles.
- Deterministic draws: `hashRng(...xs)` in `src/sim/00-core/rng.ts:33` gives a draw from the seed without advancing `state.rng`.
- i18n: topic files are registered in `src/i18n/en.ts` (for example `import { SHOP_EN } from "./shop"` at line 15) and mirrored under `src/i18n/<lang>/`.

## 3. Design

### 3.1 Titles and the era unit (features 1, 2, 3, 6)

New catalog `src/sim/10-catalog/games.ts`:

```ts
export interface GameTitle {
  id: string; name: string;            // punned name
  from: number; fade: number;          // year it arrives, year its player base starts to shrink
  weight: number;                      // share of new orders while current
  perSlot: { vcpu: number; ramGb: number; diskGb: number };
  slots: [number, number];             // order range, 12 to 32 for the slot era
  releases: number[];                  // years with a new version
  leak: boolean;                       // memory grows until restart
  mods: string[];                      // ids in MODS
}
```

Titles (all puns; the real names are never used):

| id | Name | Parodies | Arrives | Fades | Per slot (vCPU, GB RAM, GB disk) |
| --- | --- | --- | --- | --- | --- |
| `counterstrife` | Counter-Strife 1.6 | Counter-Strike | 2005 | 2012 | 0.04, 0.025, 0.02 |
| `quackiii` | Quack III Arena | Quake III | 2005 | 2010 | 0.03, 0.02, 0.02 |
| `battlefeld` | Battlefeld 1942 | Battlefield | 2005 | 2011 | 0.05, 0.035, 0.03 |
| `warcrafty` | World of Warcrafty (private realm) | World of Warcraft | 2006 | 2014 | 0.09, 0.07, 0.05 |
| `teamfortune` | Team Fortune 2 | Team Fortress 2 | 2008 | 2018 | 0.05, 0.03, 0.03 |
| `blockcraft` | Blockcraft | Minecraft | 2010 | never | 0.05, 0.08 (Java, leaks), 0.03 |
| `terrarea` | Terrarea | Terraria | 2012 | 2022 | 0.03, 0.03, 0.02 |
| `rost` | Rost | Rust | 2014 | never | 0.12, 0.10, 0.08 |
| `arkaic` | ARC Archaic | ARK | 2016 | 2024 | 0.14, 0.14, 0.10 |
| `fiveem` | FiveEm | FiveM | 2017 | never | 0.08, 0.06, 0.05 |
| `valhome` | Valhome | Valheim | 2021 | never | 0.10, 0.09, 0.06 |
| `pallworld` | Pallworld | Palworld | 2024 | never | 0.12, 0.12, 0.08 |

`perSlot` is the conversion. The existing `game(1)` size is 0.5 vCPU and 0.5 GB RAM, so 16 slots of an average title (0.03 vCPU, 0.03 GB) fit the existing resource model; economy.md's example value of 0.05 vCPU and 32 MB per slot is the middle of this table. Capacity, overcommit and pricing stay on resources: a slot service books `slots * perSlot` as its `Resources`.

Which unit applies is decided by the software on the cluster the service runs on (`softwareById(c.softwareId).id`):

| Software | Unit | Shown as |
| --- | --- | --- |
| `tcadmen` | slots, 12 to 32 per server | "Slots" column in the Game servers list |
| `multikraft` | RAM, 1 to 4 GB | "Memory" in the Plans list |
| `pterodaktyl` | RAM (512 MB steps) and CPU limit (percent of a core, 50 steps) | Memory limit and CPU limit on the eggs and servers |
| hypervisor cluster | RAM only, no title | existing VM row |

Economy extension: this lane extends economy.md "Usage curves and overcommit" with a new subsection "Game titles". Per-resource pricing (Prices over time) stays unchanged because a slot service is priced on its converted `Resources`. A slot-sold package carries a price per slot per month (proposal: 2005 about 0.60 per slot, falling to 0.25 per slot by 2012, derived from the Per-resource pricing of the converted resources times the product's margin so no new curve is needed; the implementer should derive it from `priceAt` and not hard-code it).

Titles available at a year: `from <= year`, weighted by `weight * decay` where `decay` is 1 until `fade`, then falls 25 percent a year to a floor of 0.1. New orders and shop demand use this weight (sales draw lives in `src/sim/30-market/`, the hook is one function `pickTitle(seed, key, year)` in the catalog so no market file needs more than one call; if `packages-provisioning` already owns the order draw, the call goes there).

State (all in a new file `src/sim/60-infra/games.ts`, type exported to `50-state.ts`):

```ts
export interface GameServer {
  serviceId: string;
  title: string;
  slots: number | null;           // null for RAM sold services
  version: number;                // release index inside GameTitle.releases
  mods: string[];
  ports: number[];                // first is the game port
  restart: { every: "off" | "daily" | "weekly"; hour: number; day: number };
  auto: boolean;                  // auto-restart after a crash
  crashedAt: number | null;
  leak: number;                   // 0..1
  seenFull: number;               // hour of last full-at-peak, -1 for never
}
```

`GameState.gameServers: GameServer[]`, default `[]` in `newGame` (`src/sim/50-state.ts`), filled in `deserialize` (`src/sim/91-save/save.ts`, add `fillGames` in the existing fill chain at line 75; a missing array becomes `[]`).

Old saves and old services: a `gameServer` service with no `GameServer` entry is a "legacy" service. The UI shows it by RAM only (feature 6) with title column "Unknown", no mods, no restart schedule. `fillGames` does not invent titles. A pure helper `gameOf(state, serviceId)` returns `null` for these. No grandfathering or compensation work is done (user decision).

Provisioning: `provisionService` (`clusters.ts:431`) gets one hook at the end: for `gameServer` on a game panel, call `createGameServer(s, service, choice)` where `choice` is `{ title, slots? }` from the order spec or package (packages lane). With no choice (an automated order before the lane lands) it picks `pickTitle`. The order's own resources stay as ordered; slots are `floor(booked.ramGb / perSlot.ramGb)` clamped to the title's range, so the displayed slots never exceed the booked resources.

### 3.2 Players online and full at peak (features 4, 5)

Add `gameLoad(s, w, hour): number` in `src/sim/60-infra/usage.ts` by extracting the load computation of line 34 (curve times day swing times demand times jitter, capped at 1) so `workloadUse` and the player count share it. Slots-sold services: `players = round(slots * gameLoad)`. RAM-sold services: `slotsEq = floor(ramGb / perSlot.ramGb)` of the title, same formula. No new state.

Full at peak: in the hourly games tick, when `players >= slots` (load times slots rounds to all slots) mark `seenFull = s.hour`. The upgrade chance in `src/sim/40-support/tick.ts:168` multiplies: `chance(UPGRADE_CHANCE[p.budget] * fullBoost(s, c))` where `fullBoost` is 3 if any of the customer's game servers has `s.hour - seenFull <= 168` (7 days) else 1. When a game server is the pick for the upgrade ticket, prefer the full one. The accepted upgrade grows slots to `ceil(slots * factor / 4) * 4` (acceptUpgrade path through `grownSpec`; add a branch next to it). To keep one draw per customer the change is a multiplier on the existing probability, not an extra draw, so seeded tests stay stable. Economy extension: "Happiness and churn", Expansion paragraph (economy.md line 534).

### 3.3 Game versions (feature 7)

A title's `releases` list gives the years a new version appears. Each January 1 plus a per-title offset (hash of title id, 0 to 90 days), `gamesTick` checks `releaseIndex(title, hour)`. A server whose `version` is behind is `outdated`.

Rules (proposal):
- A new release raises the howTo/upgrade ticket volume: each customer with an outdated server files a `howTo` ticket with new topic `gameVersion` with 25 percent chance within the first 14 days (one hashRng draw per server and release; ticket topics are added to `TOPICS` in `src/sim/40-support/tickets.ts:88`, a shared hotspot with one line).
- Outdated for more than 30 days: the customer loses 0.15 happiness per day, capped at 12 per release. The existing churn formula then takes customers who are left behind. Players on a faded title that the player never moves also drain happiness (see 3.5).
- Action `updateGameVersion(s, serviceId)` in `src/sim/90-actions/games.ts`: restarts the server (5 minutes of downtime through `crashedAt`-like `busyUntil`), sets `version` to latest, removes incompatible mods (mod `needs` older than the new release flagged "broken", 3.4). Cost is player time only (a 5 minute task for staff with the `servers` skill, same shape as other maintenance technician actions in `src/sim/47-staff/technicians.ts`).
- Action `setGameVersion(s, serviceId, version)` for rollback: a customer on a title with a stuck mod can be held on the older version. Allowed, but "outdated" rules still apply.

Console: TCAdmin has "Update server" and "Game version" in the game details; Multicraft has a "Version" dropdown on the server config page; Pterodactyl has the "Startup" tab with a version variable (egg variable) and "Reinstall Server". The UI shows the three in their own chrome (3.7).

### 3.4 Mods and plugins (feature 8)

Catalog `MODS` in `games.ts`: each mod `{ id, name, titles: string[], load: number, leak: number, happy: number, needs: number }`. Examples (all punned or generic): `sourcemud` (SourceMud, parodies SourceMod; Counter-Strife and Team Fortune; load 1.05, happy +1), `metamix` (MetaMix), `bukkaboo` (Bukkaboo, parodies Bukkit/Spigot; Blockcraft; load 1.10, leak +0.002 per hour, happy +2), `essentiel` (Essentiels), `worldedik` (WorldEdik), `oxidize` (Oxidize, parodies Oxide; Rost), `carbonara` (Carbonara), `fiveemfw` (the framework for FiveEm; load 1.20), `modpack` (a pack at 1.4 load, 3 mods worth of crash weight).

State: `GameServer.mods`. Action `installMod(s, serviceId, modId)` and `removeMod(s, serviceId, modId)`: install is 10 game minutes of busy time. Effects:
- `load`: multiplies `gameLoad` (resource use), so a modded server pushes its host up and can be overloaded, which already slows every customer on it (`src/sim/85-products/products.ts:260`).
- `leak`: added to the leak rate (3.6).
- `happy`: one time `+happy` to the customer on install, because players like their plugins (cap +5 total).
- Crash weight: each installed mod adds 25 percent to the base crash chance; a mod whose `needs` is older than the server's version is "broken" and adds 200 percent (3.6).

Console screens: TCAdmin "Mods" and "Plugins" tab in the server details (the real product has "Game Mods" and "Game Plugins"), Multicraft "Plugins" (the real Multicraft has a plugin and mod installer), Pterodactyl "Plugin manager" does not exist in the base panel but eggs and "Mod Manager" for Minecraft/Rost, so the Pterodaktyl screen is the egg's "Mod Manager" with the list of install buttons.

### 3.5 Titles arriving and fading, churn on old titles

`from` controls availability, `fade` the decline. Mechanics:
- Customers on a faded title (`year > fade`): the customer loses 0.05 happiness per day from the fade year plus one, doubling every year after, capped at 0.4. Churn then follows the existing happiness formula. The customer asks to move: a `cancellation` ticket by existing rules; no new ticket kind.
- Action `changeTitle(s, serviceId, titleId)`: the player moves the customer to a newer title, converting slots by resources: `newSlots = floor(oldSlots * oldPerSlot.ramGb / newPerSlot.ramGb)` clamped to the new title's range; installed mods are cleared; version set to latest; sets `happy +3` (the customer wanted it). Removes the faded drain. Upgrade tickets about a title change ride on the `upgrade` kind: the TOPICS entry is shared with `gameVersion`.
- Churn rate at the title level is a readout: the Game servers list shows a "Titles" summary card (count per title, with a faded tag).

Economy extension: "Happiness and churn" in economy.md gets a paragraph "Game titles"; proposal numbers above.

### 3.6 Crashes, auto-restart and scheduled restarts (features 9, 10)

Hourly in `gamesTick`, per running `GameServer`:
- Crash chance per hour: `base * (1 + 0.25 * mods) * (1 + 2 * brokenMods) * (1 + 2 * leak) * (overloaded ? 2 : 1)` with `base = 0.0008` (about one crash in 52 days). One draw `hashRng(s.seed, idNum(serviceId), s.hour)` per server, no `s.rng` advance.
- Leak grows by `0.01` per hour for titles with `leak: true` (Blockcraft, ARC Archaic, Rost with a little) plus mod `leak`; capped at 1; reset to 0 by any restart.
- A crashed server sets `crashedAt = s.hour`. While `crashedAt !== null` the service is down for its customer: it counts as an outage the same way `workloadOnline` false does for noticing (economy.md "Noticing outages"); the implementer wires `crashedAt` into the one function that decides a service is down for happiness (the lane must read `src/sim/45-billing` and `src/sim/40-support/status.ts` and add to the existing check, not a new path).
- Auto-restart (`auto: true`): the server restarts 2 game minutes later, `crashedAt` cleared, leak reset, the customer loses no more happiness than 0.2. Off: the customer notices after 1 hour and opens an `outage` ticket; each hour down costs 0.5 happiness, capped at 10; the player clears it with `restartGame(s, serviceId)`. This makes auto-restart a visible decision. Default for new servers: `auto: false` in 2005 to 2011, `true` from the year of MultiKraft (2011) because its panel offers it, `true` always on Pterodaktyl (Wings restarts crashed containers). The toggle is a per-console action `setAutoRestart`.
- Scheduled restart: `restart.every` and `hour` (and `day` for weekly). Executing it costs 3 minutes of downtime, resets `leak`, and costs `0.5` happiness if it fires between 17:00 and 23:00 or on weekend afternoons (the gamers' peak per the Game server curve) so the player has a real choice of hour. Default `off`. Action `setRestartSchedule(s, serviceId, every, hour, day)`.
- Not in scope: refunds, SLA credits for crashes.

Economy extension: economy.md "Noticing outages" and "Tickets and work rates" (an outage ticket for crashes uses the existing 10 minute work).

### 3.7 Pterodaktyl node daemon and port allocations (features 11, 12)

State: `GameState.daemons: Record<string, Daemon>` keyed by device id, where `Daemon = { state: "online" | "offline"; version: number; since: number }`. Default `{}`; `deserialize` fills an `online` entry per device in a Pterodaktyl cluster on load via `fillGames`. Created lazily when a device joins a Pterodaktyl cluster (in the cluster-join action; one line in `src/sim/90-actions/clusters.ts`).

- The daemon (Wings) goes offline with a 0.0003 per hour chance per node (hash draw). Servers on an offline node are unreachable (counted like a crash, `crashedAt` is not set; the console shows "Node daemon offline"). The player restarts it with `restartDaemon(s, deviceId)` (5 minutes); unattended it recovers after 6 hours.
- Version: a daemon release per year (`version`); a node behind the panel by more than one release shows a warning and its crash chance doubles. `updateDaemon(s, deviceId)` clears it.
- Port allocations: each Pterodaktyl node has an allocation pool `ports` of 100 (25565 to 25664) per node IP. Each Pterodaktyl game server holds one allocation (`GameServer.ports[0]`, taken first free) and an extra one when the title needs a query port (Rost, FiveEm, ARC Archaic). Provisioning on a Pterodaktyl node fails with an error key `error.noAllocation` if the pool is empty, so the pool is a real placement limit (about 50 servers per node); the placement helpers `targetFor` and the staff provisioner skip a node with no free allocation. Actions `addAllocation(s, serviceId)` and `removeAllocation(s, serviceId, port)`. TCAdmin and Multicraft pick ports on their own (shown, not edited).

### 3.8 The screens (13, 14 and per console)

Each of the three consoles keeps its era split.

**TCAdmen**, imitating TCAdmin 1.x/2.x (Control Panel "Game Servers" tree). Early (2005 to 2015): grey/black chrome with a left tree "Game Servers > Hosting > server", status icons, a top toolbar. New screens: (a) tree with the title as the node's group; (b) server details page with tabs "Overview", "Game Settings" (title, slots, version dropdown), "Mods and Plugins", "Schedule" (restart schedule, TCAdmin's "Scheduled Tasks"), "Monitor" (auto-restart "Monitoring" toggle, TCAdmin has "Enable Game Monitor"), "Players" (count/slots with the last 24h bar chart); (c) "Game services" list for packages (title and slots) matching the Packages table. Late (2016 on): dark grey and green with the same pages as cards.

**MultiKraft**, imitating Multicraft (2011 to 2018 era look: blue/white web UI, "Dashboard" list of servers, then a server page with the Status, Console, Players, Config, Plugins, Schedule tabs). The screens: Dashboard list with players online (n/slots), "Players" tab, "Config" with the version select, "Plugins" installer, "Schedule" tab (restart schedule; Multicraft's "Scheduled Tasks" has the same fields), "Settings > Plans" for packages (title and RAM). Auto-restart is Multicraft's "Auto-restart on crash" server setting.

**Pterodaktyl**, imitating Pterodactyl (2018 on: dark, blue accent, left "Servers", "Nodes", "Nests" admin). Screens: server list cards with the CPU and memory bars as today plus the allocation; node list ("Admin > Nodes") with "Wings" status heartbeat (green/red), allocations tab per node (IP, port, assigned to), "Nests" screen with eggs (title, default RAM and CPU limit) for packages, server Console/Startup/Settings tabs; a "Schedules" tab (cron style: daily or weekly restart, imitating Pterodactyl's "Schedules" with "Send power action" tasks), "Mod Manager" for installs, "Startup" for the version. Auto-restart is always on, shown as "Crash detection".

All three share small new building blocks in a new file `src/ui/apps/browser/consoles/GamePanel.tsx` (player count readout, mod list, schedule form, version picker, titles summary) so `PanelBase.tsx` stays a hotspot with at most the `Row` extension of one optional field (`game?: GameRow`) and `useRows` filling it for game clusters. The rows table of other consoles is unchanged.

Live console with log lines (14): each console shows a `Console` tab with generated log lines from the server's state: start, player join/leave pairs (sized by players online and hash-seeded by hour), version, mod loaded, crash stack line, auto-restart notice. A pure function `gameLog(s, serviceId, hour, n)` in `src/sim/60-infra/games.ts` returns line keys with params so the UI only renders. It is a readout with no new state.

## 4. Milestones

Each is a pull-request sized change, green on its own, with `npm run typecheck`, `npm test`, and an i18n test pass. All new English keys live in the lane's own topic file `src/i18n/ui-games.ts` (key prefix `games.`), mirrored by `src/i18n/<lang>/games.ts` for `de`, `es`, `fr`, `it`, `pt`.

1. **Game catalog and state.** `GameTitle` catalog, the `GameServer` type, `gameServers: []` in `newGame`, `fillGames` in `deserialize`, `gameOf` helper, `pickTitle`, the slot conversion helpers `slotsOf`/`resourcesOf`. No tick, no UI. Tests: `tests/games-catalog.test.ts` (titles available per year, fade weights, conversion round trip, an old save without `gameServers` loads and legacy services return `null`), `tests/i18n.test.ts` for the new topic file.
2. **Provisioning with a title.** Hook in `provisionService`, unit by software, slots clamped to the booked resources. Needs `packages-provisioning` package type for the title and slots fields (see section 6); until it lands, the choice comes from `pickTitle`. Tests: `tests/games-provision.test.ts` (slot era, RAM era, hypervisor cluster gets no title, resources booked equal slots times per-slot, seeded).
3. **Players online and full at peak.** `gameLoad` extraction, player counts, `seenFull`, the `fullBoost` multiplier, the slot growth in the accept-upgrade path, Players readout in the three consoles' lists. Tests: `tests/games-players.test.ts` (weekend evening peak fills a small server, a weekday morning does not, the upgrade chance is 3 times with `seenFull` within 7 days and unchanged without, accepted upgrade rounds up slots, `workloadUse` results unchanged for non-game workloads).
4. **Crashes and auto-restart.** `gamesTick`, crash chance, leak, auto flag, outage hooks, `restartGame`, `setAutoRestart`, the `crashedAt` readout in the rows. Tests: `tests/games-crash.test.ts` (seeded crash count over 90 days within a band, auto-restart clears within 2 minutes, off opens an outage ticket and costs happiness, mods and leak raise the rate).
5. **Scheduled restarts.** `setRestartSchedule`, tick execution, peak penalty. Tests: `tests/games-schedule.test.ts` (daily at 04:00 resets leak and has no penalty, daily at 20:00 costs happiness, weekly day matching, old saves default `off`).
6. **Versions and mods.** Release waves, outdated drain, `updateGameVersion`, `setGameVersion`, mod catalog, `installMod`, `removeMod`, broken mods, `gameVersion` ticket topic. Tests: `tests/games-version.test.ts`, `tests/games-mods.test.ts` (wave tickets within the window, drain capped at 12, mod load multiplies use, broken mod after version bump multiplies crash chance, update removes broken mods).
7. **Title fade and changeTitle.** Fade decay in `pickTitle`, faded drain, `changeTitle` and slot conversion, the Titles summary. Tests: `tests/games-fade.test.ts` (weights after fade, drain per year, conversion keeps resources equal within a step, mods cleared).
8. **Pterodaktyl daemon and allocations.** `daemons` state with defaults and fill, daemon outage and recovery, versions, allocation pool and its placement limit, `restartDaemon`, `updateDaemon`, `addAllocation`, `removeAllocation`. Tests: `tests/games-daemon.test.ts` (offline daemon makes node servers unreachable, recovery after 6 hours, pool of 100 limits placement, `targetFor` skips a full node, old saves get `online` daemons).
9. **Console screens for the three panels.** The `GamePanel.tsx` blocks and per-console screens from section 3.8 for packages (Game services, Plans, Nests and eggs, using the packages lane's package list), server details tabs, nodes and allocations for Pterodaktyl. Tests: extend `tests/panel-consoles.test.tsx` with a render check per console and era (TCAdmen 2010 and 2018, MultiKraft 2014, Pterodaktyl 2020), legacy service shows RAM only, no raw keys (existing console-screens test pattern).
10. **Deferred: live console log.** `gameLog` and the Console tab in each panel. Tests: `tests/games-log.test.ts` (deterministic for a seed and hour, join/leave pairs match players, crash lines appear after a crash) and a render check.

Milestones 1, 2 and 3 are the minimum for the "Game titles and slots" build step (panel-features.md step 6); 4 to 8 are the remaining Game panels features; 9 is the visible payoff; 10 is the deferred final one.

## 5. Files touched

Hotspots are marked (HOT). Other lanes also edit those; keep each edit to the smallest hunk.

| Milestone | Creates | Edits |
| --- | --- | --- |
| 1 | `src/sim/10-catalog/games.ts`, `src/sim/60-infra/games.ts`, `src/i18n/ui-games.ts`, `src/i18n/{de,es,fr,it,pt}/ui-games.ts`, `tests/games-catalog.test.ts` | `src/sim/50-state.ts` (HOT: `gameServers` field, `newGame`), `src/sim/91-save/save.ts` (HOT: `fillGames` in the fill chain), `src/i18n/en.ts` (HOT: one-line registration of the games topic file), `src/i18n/lang.ts` if the loader lists topic files |
| 2 | `tests/games-provision.test.ts` | `src/sim/90-actions/clusters.ts` (provision hook, shared with `packages-provisioning` and `panel-host-sim`), `src/sim/30-market/sales.ts` only if title pick lives there, `src/sim/10-catalog/products.ts` (HOT, only if the packages lane has not already added a `title` and `slots` spec field) |
| 3 | `src/sim/90-actions/games.ts`, `tests/games-players.test.ts` | `src/sim/60-infra/usage.ts` (extract `gameLoad`; shared with `readouts`), `src/sim/40-support/tick.ts` (the `UPGRADE_CHANCE` multiplier at line 168), the accept-upgrade path (`src/sim/40-support/retention.ts` or its caller), `src/ui/apps/browser/consoles/PanelBase.tsx` (HOT: `Row.game` and `useRows`), `src/ui/apps/browser/consoles/GamePanel.tsx` (new) |
| 4 | `tests/games-crash.test.ts` | `src/sim/88-tick/tick.ts` (HOT: call `gamesTick` once per hour), `src/sim/60-infra/games.ts`, `src/sim/90-actions/games.ts`, `src/sim/60-infra/cluster.ts` or the outage-noticing function (one hunk to treat `crashedAt` as down), `src/sim/90-actions/index.ts` (export) |
| 5 | `tests/games-schedule.test.ts` | `src/sim/60-infra/games.ts`, `src/sim/90-actions/games.ts` |
| 6 | `tests/games-version.test.ts`, `tests/games-mods.test.ts` | `src/sim/10-catalog/games.ts` (mods), `src/sim/60-infra/games.ts`, `src/sim/90-actions/games.ts`, `src/sim/40-support/tickets.ts` (one `TOPICS` entry), `src/sim/47-staff/technicians.ts` if staff do the update task |
| 7 | `tests/games-fade.test.ts` | `src/sim/10-catalog/games.ts`, `src/sim/60-infra/games.ts`, `src/sim/90-actions/games.ts` |
| 8 | `tests/games-daemon.test.ts` | `src/sim/50-state.ts` (HOT: `daemons`), `src/sim/91-save/save.ts` (HOT: fill), `src/sim/90-actions/clusters.ts` (join hook), `src/sim/30-market/sales.ts` (`targetFor` skips nodes with no allocation), `src/sim/60-infra/games.ts`, `src/sim/90-actions/games.ts` |
| 9 | `src/ui/apps/browser/consoles/GamePanel.tsx` (extended), optional `gamepanel.css` | `TCAdmen.tsx`, `MultiKraft.tsx`, `Pterodaktyl.tsx` and their CSS, `PanelBase.tsx` (HOT), `src/sim/80-business/consoles.ts` (HOT: only if `ConsoleFeatures` needs `games`/`daemon` flags per panel, e.g. `features.game: "tcadmen" | "multikraft" | "pterodaktyl"`), `tests/panel-consoles.test.tsx` |
| 10 | `tests/games-log.test.ts` | `src/sim/60-infra/games.ts` (`gameLog`), the three consoles, `GamePanel.tsx` |

All milestones also edit `src/i18n/ui-games.ts` and its five mirrors.

## 6. Dependencies

Must land first:
- `panel-host-sim` for panel-host capacity and the cluster-join hook (milestones 2 and 8 use cluster membership and node state).
- `packages-provisioning` for the package type and the create forms. The game package fields are `{ title, slots }` (TCAdmen), `{ title, ramGb }` (MultiKraft) and `{ title, ramGb, cpuPct }` (Pterodaktyl). Milestone 9's packages screens need it. Milestones 1 to 8 work without it using `pickTitle`.
- `readouts` for the shared usage readout extraction in `usage.ts` (`gameLoad` must not collide with its changes), and its bar and meter blocks used by `GamePanel.tsx`.

Blocks:
- `shop-portal` (game products sold in the shop need titles and slots in the product's package; product pricing per slot).
- `hypervisors-backups` only lightly: game servers on hypervisor clusters stay RAM only and are unaffected.

Independent of: `web-services`, `mail-dns-vpn-storage`.

## 7. Open questions

1. **Does a customer pick the title or does the player?** Real TCAdmin hosts let the customer pick the game when ordering. Recommendation: the customer's order names the title (drawn by `pickTitle`), and the player chooses it only when creating a service by hand in the console; the title is fixed after provisioning except through `changeTitle`.
2. **Should a crash on a Pterodaktyl node with an offline daemon cost refunds?** Recommendation: no refunds in this lane; the existing outage ticket credit retention option covers it.
3. **Is the live console log worth shipping?** It only copies the look. Recommendation: keep it as milestone 10 and drop it if the milestones before it take longer than planned.
4. **Game panel eras for the unit**: should a 2018 or later MultiKraft install still sell RAM and a 2008 Pterodaktyl install sell slots, i.e. does the unit follow the panel or the year? Recommendation: it follows the panel installed on the cluster (a console is what the customer sees), and the year only decides which panels the shop offers to install.
5. **Daemon outage rate and port pool size** (0.0003 per hour, 100 ports): these are first numbers for `npm run balance` to tune. Recommendation: ship them and adjust in the balance pass.
