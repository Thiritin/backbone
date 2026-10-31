# Plan: readouts lane

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

This lane gives every console the read-only screens its real product has, drawn from state the sim already holds. It adds no game state, no save fields and no economy numbers. Where a screen needs numbers, they are derived by pure functions of the existing state and the seed, so the same save always shows the same readout.

Source of truth for scope: `docs/design/panel-features.md` (sections "Shared across all panels", each console, and "Build order" step 1). Numbers extend `docs/design/economy.md`, sections "Traffic and bandwidth", "Usage curves and overcommit", "Platforms and licenses", "Power outages and Legal requests" and "Notices and legal requests". Console looks follow `docs/design/software.md`, sections 9 and 10.

## 1. Scope

Every item is [UI] unless marked. Items marked [Sim, small] are the only ones that touch `src/sim` beyond a pure derived helper; they sit in the last milestone and are explained in section 3.

Shared blocks in the panel shell (panel-features.md, "Shared across all panels"):

1. Task log. [UI] Running and recent tasks per panel host, game host and service host.
2. Usage bars per account. [UI] Disk, bandwidth and mailbox limit against use, red near the cap.
3. Log viewer. [UI] Access, error, auth, mail and system logs generated from incidents, abuse notices, breaches and vulnerabilities.
4. Licence page. [UI] Reads the existing licence cost (`licenseCost`). The tier, account cap and expiry halves of the catalog's "License page" are [Sim] and belong to lane `panel-host-sim`; this lane ships the page frame they will fill.

Per console (panel-features.md, each console section, not cut):

5. cPanic: Service Manager. [UI]
6. cPanic: customer-side icon grid and "Log in as user". [UI]
7. Pleskit: Advisor score. [UI]
8. FreePanel: module tree, System Information dashboard and the Virtual Servers list. [UI]
10. Horizont: flavors catalog. [UI]
11. HyperVee: Integration Services version per VM. [UI] Checkpoints naming is in item 17 because it needs a small sim guard.
12. VMwhere: EVC warnings. [UI] The EVC switch calls the existing `setCompatMode`.
13. OpenVeeZee: container templates. [UI]
14. PowerDNZ: query stats chart. [UI]
15. Mailpig and Postfixit: SPF and DKIM checks per domain. [UI]
16. OpenVeePeeN and AnyConnekt: connected sessions and throughput chart. [UI]
17. HyperVee Checkpoints (snapshots under the HyperVee name). [Sim, small] The catalog tags it [UI], but `takeSnapshot` refuses HyperVee today (section 2).
18. MinnIO: usage over time. [UI]
19. IPMI and KVM: sensor readings with thresholds and a power draw reading. [UI] Power cycle is already built (section 2).
20. IPMI: virtual media mounting for OS installs. [Sim, small] A remote mount cannot reuse the USB stick action, which sends a technician (section 2).

Not in this lane: the DirectAdmen Message System (owned by `web-services`), the game panel live console (owned by `game-servers`), everything tagged [Sim] in panel-features.md other than items 17 and 20, and everything on the cut list (cron editor, firewall rules editor, DNSSEC switch, network topology graph, extensions catalog, BIOS boot order). The cut list stays cut.

## 2. Current state

Verified against `/Users/martin/Projects/backbone-panel-doc` (origin/main).

Shell and panels:

- `src/ui/apps/browser/consoles/PanelBase.tsx` holds the shared blocks. `Tab` is `"objects" | "nodes" | "software"` (line 25). `PanelProps` is at line 28, `usePanelTab` at 33, `Bar` at 67, `Migrate` at 88, `Row` at 111, `useRows` at 118, `RowsTable` at 152, `Nodes` at 183, `useSoftware` at 211, `Backups` at 240.
- Every panel console renders three pages from that tab union through its own chrome (for example `cpanic/CPanic.tsx:19-26` builds a `menu` of three entries; `freepanel/FreePanel.tsx:20-24` builds a three-group `tree`; `powerdnz/PowerDnz.tsx:24` builds a two-entry `nav`). Adding a page today means editing each console's nav array and its body conditions.
- `Row` carries `cpu`, `ram`, `disk` tuples and `usage` text (PanelBase.tsx:111-115). `RowsTable` draws only the lead bar (line 164). `Bar` (line 67) has a fixed fill with no warning level; `.cx-bar i` in `consoles.css:68-69` uses the accent colour only.
- `licenseCost(s, c)` returns `{ panel, platform }` in `src/sim/85-products/products.ts:133`; `licensingAt` and `LicenseKind` (`once | core | server | account | free`) are in `src/sim/10-catalog/server-os.ts:7-9`. Nothing in the UI shows a licence page.
- There is no task history in the sim. Time stamps that survive: `Cluster.switching.doneAt`, `Cluster.updatedAt`, `Cluster.phpUntil`, `Workload.placedAt`, `busyUntil`, `migrating.doneAt`, `cloning`, `recoverDoneAt`, `backupAt` (latest only), `snapshots[].at` (`src/sim/60-infra/cluster.ts:33-60`) and `game.lossReports`.

Hypervisor consoles (already deeper than panels):

- `HypervisorBase.tsx:377-404` already has `Task`, `tasks()` and `TaskLog`, used by `proxmocks/Proxmocks.tsx:153` and `vmwhere/VmWhere.tsx:323`. It covers installs, moves, restores, clones and lost disks. Panels have no equivalent.
- `AlarmList` is at `HypervisorBase.tsx:360`.
- Horizont already has a code constant `FLAVORS` (`openstash/Horizont.tsx:18-22`) used by the create wizard (line 206-212) and `flavorOf` (line 23). There is no catalog page.
- OpenVeeZee already lists "OS templates" per physical server (`openveezee/OpenVeeZee.tsx:55-62`) and an OS template column (line 30). The empty row is hard-coded English ("No OS templates", line 59), which breaks the `t()` rule.
- VMwhere shows a static "Compatibility" fact (`vmwhere/VmWhere.tsx:33,47,67`). The sim already decides live versus cold moves by CPU vendor: `liveBetween` and `deviceVendor` (`cluster.ts:108-110`, `status.ts:307`), `migrationDowntime` (`90-actions/vms.ts:60`), and `setCompatMode` (`90-actions/cpus.ts:5`), which is exercised only by `tests/cpus.test.ts:250` and has no UI button.
- HyperVee's settings list has a "Checkpoints" entry that shows only the last backup (`hypervee/HyperVee.tsx:16,179`). Snapshots exist in the sim (`90-actions/snapshots.ts:31,48,69`) and VMwhere draws them (`VmWhere.tsx:162-174`), but `snapshotting()` (`snapshots.ts:15-18`) requires `softwareById(platform).datastores`, and only VMwhere sets that field (`platforms.ts:42,104`). HyperVee (`platforms.ts:106`) does not, so `takeSnapshot` returns `error.noSnapshots` for it.

Infrastructure consoles:

- `ui/apps/browser/consoles/services.ts` has `tenants()` and `mailboxes()`; every service console reads its customers' workloads through it.
- `PowerDnz.tsx:30` shows a stat strip (zones, accounts, version) in the late look only; there is no chart.
- `Mailpig.tsx:10` has tabs Mailboxes, Domains, Queue, Configuration. The Domains tab lists only the company domain (line 32). The sim has no SPF or DKIM state (`rg -i spf` finds nothing in `src`).
- The reusable chart is `consoles/Chart.tsx` (`Chart`, `niceMax`, `Donut`). Its x axis labels are hour-of-day only (line 36), so a 30-day chart needs a small prop.
- Customer workloads keep no history, but are recomputable: `vmStats(s, id)` in `src/sim/60-infra/stats.ts:42-58` returns a 24-hour ring including `netMbit` for any workload; `diskFill(s, w, hour)` and `workloadLoad(s, w, hour)` in `src/sim/60-infra/usage.ts:19,29` take an hour; `serviceMbps(s, v)` in `src/sim/60-infra/network.ts:64` reads `s.hour` and needs an hour parameter.

IPMI and KVM:

- `ui/apps/browser/ipmi/IpmiPage.tsx` already has the tabs Power, Storage, Sensors and Event Log (lines 30-31). Power has power on, graceful shutdown, reset and power cycle (lines 64-77). Sensors lists inlet temperature, fan RPM and PSU state from `sensorsOf` (`sim/60-infra/sensors.ts:27`) (lines 85-97). The event log comes from `d.log`. `KvmPage.tsx` shows the KVM's power buttons. So "sensor readings" and "power cycle" exist; what is missing is a real controller's threshold columns and a power draw reading, and virtual media.
- The installer media for a physical server is the single USB stick: `writeStick`, `plugStick` (`90-actions/media.ts:38,52`). At a datacenter the player is away from, `plugStick` books hand work with a cost (lines 58-66). `setMedia` (`90-actions/console.ts:210`) mounts an ISO only in the player's own VMs.

Game panels:

- `TCAdmen.tsx`, `MultiKraft.tsx` and `Pterodaktyl.tsx` render the same three pages. The only "console" in the sim is the own-VM console window (`useRows` action `console`, PanelBase.tsx:131). There are no game titles or slots yet (lane `game-servers`).

Sources for generated logs:

- Power incidents: `game.ops.incidents` with `cause`, `devices`, `customers` (`sim/60-infra/ops.ts:6-9`).
- Abuse, copyright and legal notices are tickets of kind `abuse`, `notice` or `legal` with `serviceId`, `createdAt` and `notice.url` (`sim/40-support/tickets.ts:10,25`, `Notice` at line 21).
- Breaches: `game.breaches` (`sim/60-infra/breach.ts:16`), compromised hosts `game.security.hacked`, sites offline `security.offline` (`sim/60-infra/security.ts:39`).
- Vulnerabilities: `openVulns(game, clusterId)` and `vulnsFor` (`sim/60-infra/vulns.ts`).
- Lost disks: `game.lossReports`.

## 3. Design

No new fields on `GameState`, so there is no `newGame` default and no `deserialize` change. A test (section 4, M1) loads an old save fixture and renders every readout to prove it. Session-only UI state (which panel the cPanic admin is "logged in as", which tab is open) lives in `useSessionState`, as `browser.logins` does in `ConsolePage.tsx:49`.

### 3.1 One derived-helper module

New file `src/sim/80-business/readouts.ts`. It imports sim modules only, never React, and returns plain data with i18n keys and params so the UI formats them with `t()`. Functions:

- `panelTasks(s, c, now)`: the task rows of section 3.2.
- `accountUse(s, workload)`: `{ disk: [used, limit], traffic: [usedGb, limitGb], mailboxes: limit }` plus a `level` of `ok`, `warn` or `bad`.
- `logLines(s, c, source, limit)`: the lines of section 3.4, newest first.
- `advisorChecks(s, c)`: the Advisor recommendations and score (3.7).
- `mailChecks(s, domain)`: SPF and DKIM results per domain (3.14).
- `vpnSessions(s, c, hour)`: the connected sessions (3.15).
- `seriesOf(s, w, kind, points)`: query counts, throughput and storage fill over time (3.13, 3.15, 3.16).

Two tiny edits outside the module, both backward compatible:

- `serviceMbps(s, v, hour = s.hour)` in `network.ts:64` so a month of traffic can be recomputed.
- `Chart` gains an optional `ticks` prop for non-hourly axes (`Chart.tsx:36`).

All randomness uses `hashRng(s.seed, ...)` with the cluster or workload number and the hour, as `usage.ts:35` does, so a readout never changes between renders.

Numbers extend economy.md "Usage curves and overcommit" and "Traffic and bandwidth". They are display thresholds, not balance values:

| Constant | Value | Meaning |
| --- | --- | --- |
| `LEVEL_WARN` | 0.80 | A bar turns amber at 80% of its limit. |
| `LEVEL_BAD` | 0.95 | A bar turns red at 95%. |
| `TASK_WINDOW_HOURS` | 336 | Tasks finished in the last 14 days stay listed. |
| `TASK_MAX` | 12 | Rows in a task log. |
| `LOG_WINDOW_HOURS` | 168 | Logs reach back 7 days. |
| `LOG_MAX` | 200 | Lines per log source. |
| `TRAFFIC_SAMPLE_HOURS` | 6 | A month of traffic is summed from every sixth hour (122 samples), `ponytail`-style ceiling: raise the sample rate if the figure visibly jitters. |

### 3.2 Task log (item 1)

Real screens imitated: cPanic WHM Task Queue Monitor (the Server Status group), Pleskit's background Tasks list, DirectAdmen's Task Queue (admin level), FreePanel's Webmin Actions Log, TCAdmen's Events page, MultiKraft's Activity view, Pterodaktyl's Activity tab, and the same table in the style of each infrastructure console's "Events" or "Jobs" page. The hypervisor consoles keep their own `TaskLog`, which becomes a thin caller of the same `tasks()` source (the function moves to `readouts.ts` and `HypervisorBase.tsx` re-exports it so Proxmocks and VMwhere keep importing from the old place).

Columns: Start, Finish, Task, Status. Sources and what they can truthfully show:

| Source | Task text | Start | Finish | Status |
| --- | --- | --- | --- | --- |
| `c.switching` | Install or update of the software | `doneAt` minus the software's `installHours` | `doneAt` | Running |
| `c.updatedAt` inside the window | Software update | `updatedAt` | `updatedAt` | Done |
| `c.phpUntil` in the future | PHP rebuild | not shown | `phpUntil` | Running |
| `w.migrating`, `w.busyUntil`, `w.cloning`, `w.recoverDoneAt` | Move, restore, clone, recover | not shown | the stored hour | Running |
| `w.placedAt` inside the window | Account or service created | `placedAt` | `placedAt` | Done |
| `w.backupAt` inside the window | Backup of the account | `backupAt` | `backupAt` | Done |
| `game.lossReports` for the host's nodes | Disks lost on a node | `hour` | `hour` | Error |

Start is shown only where it can be derived; otherwise the cell is empty. The log is honest about its limit: it is not a history, because the sim keeps only the latest `backupAt` and `updatedAt`. See open question 1.

### 3.3 Usage bars per account (item 2)

Real screens: cPanic WHM "List Accounts" disk and bandwidth columns, and the customer-side statistics column; Pleskit subscription list with Disk and Traffic usage; DirectAdmen "Manage Users" with bandwidth and quota columns; Virtualmin "List Virtual Servers" quota columns; Pterodaktyl server cards with CPU and RAM meters (already present, only the warning colour is new).

- `Bar` (PanelBase.tsx:67) gets a `data-level` attribute from `LEVEL_WARN` and `LEVEL_BAD`; `consoles.css` colours it with existing theme tokens (accent, warn, bad). Every existing bar in every console inherits the colour change, including the hypervisor resource bars. This is the only change that reaches other lanes' screens, so it is the first thing in M2.
- `Row` gains `traffic: [number, number]` and `mail: number` (PanelBase.tsx:111). `useRows` fills them from `accountUse`. Web panels show disk and bandwidth side by side; game panels show CPU and RAM only; OwnClod shows the user's quota against use.
- Used traffic is the sum of `serviceMbps` over the last 730 hours at `TRAFFIC_SAMPLE_HOURS` spacing, converted to GB. Because `serviceMbps` grows traffic 20% a year from the service start, a long-running customer drifts past the spec's `trafficGb`, so the bar goes red for real over-users. That is the signal the player sees in the list.
- The bandwidth sum is memoised on `game.hour` in `useRows`, so a re-render does not repeat 122 samples per account.

### 3.4 Log viewer (item 3)

Real screens: cPanic customer-side Metrics "Raw Access" and "Errors", plus WHM's server log pages; Pleskit Websites and Domains, Logs (the Log Browser, with Access and Error tabs); DirectAdmen User level "Log Files" (Show Log Files); Webmin System Logs and Virtualmin "View Logfiles"; the game panels' console and log pages; mail consoles' "Mail log". Era look follows each console (x3 monospace panel in a bordered box until 2014 for cPanic; Onyx card with a toolbar and a filter from 2015 for Pleskit; the plain `<pre>` Show Log Files page for DirectAdmin).

Sources by file:

| Log | Line format | Event sources |
| --- | --- | --- |
| Access | Combined log format with the day and hour, client IP, request and size | Baseline lines per account from `workloadLoad` per hour (more load, more lines); a request line for each notice's `notice.url` just before the notice ticket's `createdAt`; takedown hours from `ops.takedowns` as 503 lines |
| Error | Daemon timestamp, level, message | Incident hours for the host's devices (power loss, restart), lost disks, `slowedAt` windows as "worker busy" warnings, open vulnerabilities as module warnings from the disclosure hour |
| Auth | syslog `sshd` and panel login lines | Baseline failed-login noise from the seed; a successful login from a foreign address at each breach's `hour`; hosts in `security.hacked` repeat it |
| Mail | mail daemon lines | Abuse tickets whose notice topic is spam produce a burst of outbound lines before the ticket; deferred lines when the cluster has a mail queue |
| System | syslog | Boots and shutdowns from `d.log` of the host's device, update installs from `updatedAt` |

Baseline lines are decoration drawn from the seed and are marked as such only in code comments, not in the UI. Event lines are always real: they appear at the hour of the underlying event and vanish only when that event leaves its window. Pun rule: daemon and product names in lines use the catalog's pun names (for example Bound for the DNS daemon); where the catalog has no name for a daemon, the line uses the generic process name (`httpd`, `named`, `mailer`) so no real company or product appears.

### 3.5 Licence page (item 4)

Real screens: cPanic WHM "Server Configuration > cPanic License Info" style key and server-IP page; Pleskit Tools and Settings > License Management; DirectAdmin Admin Level > License; Virtualmin "Check Virtualmin Licence". Each shows software, licence kind, monthly or one-time cost and what it is counted on.

Content, read from existing helpers: `licensingAt(software, year)` for the kind, `softwareFee(...)` and `licenseCost(game, c)` for the panel and platform cost (products.ts:133), and the number of web spaces or servers it is counted on (an `account` kind multiplies by the host's account count). A `free` licence shows the product's free-software line. The page has a reserved block for tier, account cap and expiry that renders nothing until `panel-host-sim` provides them, so that lane edits the content, not the layout.

### 3.6 cPanic: Service Manager (item 5)

Real screen: WHM > Service Configuration > Service Manager (list of daemons with Enabled and Monitor columns) with the Restart Services links. New sidebar entry under "Server Status" in both eras (x3 grey table, Paper Lantern white table).

Rows: web server, mail server, name server, ssh daemon, the panel's own daemon, with status Running or Stopped and, for the first, a Stop or Start button. The web server's status is `security.offline` for the host, driven by the existing `setSitesOffline` action (PanelBase.tsx:227). The other rows are read-only and show Running while the host is up. Enabled and Monitor are values (a check mark), not inputs, because no setting backs them. The catalog's "restart" buttons for the mail and name servers have no effect in the sim today, so they are not drawn; lane `mail-dns-vpn-storage` adds them when those daemons gain behaviour. Open question 2.

### 3.7 Pleskit: Advisor score (item 7)

Real screen: the Advisor card on the late look's Home page (security and performance recommendations with a score), shown from the Onyx look (2015 on); the early 8.x look keeps its icon grid.

`advisorChecks(s, c)` starts at 100 and subtracts:

| Finding | Penalty | Fix points to |
| --- | --- | --- |
| Open vulnerability, critical / high / low | 15 / 8 / 3 each, at most 40 in total | Software page, update |
| Software update due | 10 | Software page, update |
| PHP behind the era's version (`phpDue`) | 10 | Software page, PHP |
| Backups off (`c.backup.every === "off"`) | 15 | Software page, backups |
| Automatic updates off where available | 5 | Software page, auto updates |
| Sites set offline | 5 | Software page, sites online |

The score is clamped to 0 to 100 and drawn as a ring with the recommendation list under it; each row has a button that switches to the Software page (no new action). Colour bands: 90 and up green, 70 to 89 amber, below 70 red.

### 3.8 cPanic: customer side (item 6)

Real screens: the customer cPanel home. Early look is the X3 theme (icons grouped under tabbed headings, a left statistics column); the late look is Paper Lantern (grouped sections Files, Databases, Domains, Email, Metrics, Software, with the statistics sidebar). Both eras follow `ERAS = erasFrom(2005, 2014)` in `CPanic.tsx:8`.

- "Log in as user" is a button in each row of the account list (WHM List Accounts has the same cPanel link). It sets session state `browser.cpanic.as.<clusterId>` to the account's workload id. While set, the console draws the customer side with a "Back to WHM" link and no admin menu. No password is involved and nothing is written to the game.
- The icon grid shows File Manager, Email Accounts, Zone Editor, phpMyAdmin, plus Raw Access and Errors which open the log viewer (3.4) filtered to the account.
- File Manager: a directory listing of `public_html` built from `service.spec.app` and `appVersion` (the app's well-known files), with sizes that sum to the disk used. Email Accounts: up to `spec.mailboxes` addresses on the account's domain with a quota bar. Zone Editor: A, www, MX and TXT rows for the domain; the TXT row for SPF reads `mailChecks` (3.14). phpMyAdmin: the account's databases and their size, a share of disk used.
- The statistics column reuses the usage bars from 3.3 (disk, bandwidth, mailboxes).
- All customer-side pages are read-only. An account whose site is offline or whose host is down shows the same error page the site shows.

### 3.9 FreePanel (item 8)

Real screens: the Webmin left category menu and its System Information dashboard (host name, operating system, system time, kernel and CPU, uptime, CPU load, memory, disk space, package updates) and Virtualmin's "List Virtual Servers".

- The tree (`FreePanel.tsx:20-24`) is rebuilt as categories Dashboard, Virtualmin, System, Cluster (only when `f.cluster`). Entries exist only for built pages: Dashboard has System Information; Virtualmin has List Virtual Servers (the objects table, restyled with Virtualmin's columns domain, user, status, disk quota); System has Software Package Updates (software), System Logs (3.4), Webmin Actions Log (3.2) and Check Licence (3.5); Cluster has Cluster Nodes. The catalog's Servers, Networking and Hardware categories would hold only pages on the cut list or nothing, so they are not drawn.
- System Information values come from the host: host name from `consoleHost`, operating system and version from the cluster VM or node (`w.os` or the device), uptime from `upSince` or `placedAt`, CPU load as three numbers derived from the last hours of `vmStats` or `nodeUsage`, memory and disk as bars from the same data, package updates as the software `updateDue` state.

### 3.11 Horizont: flavors catalog (item 10)

Real screen: Horizon Admin > Flavors (name, VCPUs, RAM, root disk, ephemeral, public) on the purple 2010 and dark-sidebar 2016 looks (`ERAS = erasFrom(2010, 2016)`).

The `FLAVORS` constant moves to a shared module (`openstash/flavors.ts`) and becomes the table's source and the wizard's source, so the two cannot drift. Columns: Name, VCPUs, RAM, Root Disk, Instances (count of VMs on the cluster whose size equals the flavor, using the existing `same` and `flavorOf`). No create or delete: the catalog is read-only, and the "custom" flavor row reports VMs that match none.

### 3.12 HyperVee Integration Services and VMwhere EVC, OpenVeeZee templates (items 11 to 13)

HyperVee Integration Services. Real screen: VM Settings > Management > Integration Services (Operating system shutdown, Time synchronization, Data Exchange, Heartbeat, Backup (volume checkpoint)), plus the "Integration Services version" column in the Hyper-V Manager list. Add that column and a settings entry. Version is the host's `c.version`; the guest's version is the year of its `placedAt` (own VMs: `os.installedAt`). A guest older than the host shows "Update required" and the Backup service as "Update required" too; a VM that is stopped shows the services as "Off". Purely a display of two existing years.

VMwhere EVC. Real screen: Cluster > Configure > VMware EVC (mode Disabled or a CPU baseline) and the vMotion compatibility warning in the Migrate wizard ("The virtual machine's CPU features are not compatible with the target host"). In the migrate dialog, a target whose vendor differs from the VM's host and where `liveBetween` is false gets that warning and a cold-migration hours figure (already computed as `down` in `MigrationTarget`). On the cluster page the static "Compatibility" fact (`VmWhere.tsx:33,47,67`) becomes an EVC row with a switch bound to `setCompatMode`, with the cost shown as the existing `COMPAT_VCPU` share of vCPU. The warning is shared by `Migrate` in `PanelBase.tsx:88` so Proxmocks and Horizont show the same condition in their words.

OpenVeeZee templates. Real screen: the OpenVZ/SolusVM style "OS Templates" page (template name, number of containers using it, architecture). The current list is a fieldset inside the physical server page (`OpenVeeZee.tsx:55-62`). Promote it to its own menu page, add the count of containers per template that already exists, and route the empty text through `t()`.

### 3.13 PowerDNZ query stats (item 14)

Real screen: PowerDNS Admin dashboard and the pdns "Statistics" charts (queries per second). The late look already has a stat strip (`PowerDnz.tsx:30`); the chart goes below it. The early look gets a plain "Statistics" table of totals, because the early product had counters only.

Queries per hour for a zone are derived: `zones x QUERIES_PER_ZONE_HOUR x workloadLoad(hour) x TRAFFIC_GROWTH^(years since 2005)` with `QUERIES_PER_ZONE_HOUR = 90` in 2005, so the curve follows the same daily swing and 20% yearly growth as traffic in economy.md. The chart is the 24-hour ring (`Chart` kind `bars`, `end = game.hour`). A zone on a stopped or down DNS workload reads zero.

### 3.14 Mail SPF and DKIM (item 15)

Real screen: Postfix-style mail admin domain list plus the mail-tester style check beside each domain. Mailpig's Domains tab (`Mailpig.tsx:32`) gains SPF, DKIM and DMARC columns with Pass, Missing or Not checked.

`mailChecks(s, domain)` is derived: Pass when the domain's zone is served by one of the player's DNS clusters (`tenants(...).zones`) and the mail server is up; Missing when the company has no DNS service for the domain; Not checked when the zone is hosted elsewhere. Lane `mail-dns-vpn-storage` will add real blacklist state; when it does, it may replace the derivation behind the same function signature without changing this screen.

### 3.15 VPN sessions and throughput (item 16)

Real screens: OpenVPN Access Server Admin > Status > Current Users (user, real address, VPN address, bytes sent and received, connected since) and Cisco AnyConnect/ASDM "Monitoring > VPN > VPN Statistics > Sessions" (the Sysko AnyConnekt tabbed look until 2016, flat teal after).

`vpnSessions(s, c, hour)` returns, per tenant workload, `round(spec.users x min(1, workloadLoad x 1.2))` sessions. Each session has a user name from the customer's name, a client address and a connected-since hour from the seed, and bytes in proportion to `netMbit` for the hours connected. Throughput is the 24-hour `netMbit` ring of the VPN workloads summed (`Chart` kind `area`, unit Mbit/s). Both screens show nothing when the host or workload is down.

### 3.16 MinnIO usage over time (item 18)

Real screen: MinIO Console > Monitoring > Metrics (Usage chart), then the dashboard's total usage card in the white 2021 look (`ERAS = erasFrom(2016, 2021)`).

Series: `diskFill(s, w, hour) x w.diskGb` summed over the storage tenants, one point per day for 30 days (`Chart` kind `area`, new `ticks` prop for day labels). Because `diskFill` grows from 30% of the booked limit at the customer's growth rate (`usage.ts:19`), the chart is the real fill curve and flattens at the booked limit.

### 3.17 IPMI sensors and virtual media (items 19 and 20)

Sensors. Real screens: the Dwell iDRAC-style, Hewlett-Packet iLO-style, SuperMacro IPMI and Lenovoid XClarify-style sensor pages (the look is per brand in `IpmiPage.tsx:19-25`). The current Sensors tab shows a name and a reading. Add Status (OK, Warning, Critical) and Lower and Upper threshold columns, and two readings: system power draw in watts from `deviceWatts` and the PSU load share. Thresholds are constants in `readouts.ts`: inlet 35 degrees Celsius warning and 42 critical, fan under 4000 RPM warning, 0 critical. Rows turn to the brand's own warning colour. No new state.

Virtual media (final milestone, [Sim, small]). Real screen: the BMC's Virtual Media / Virtual Console media dialog (mount ISO, eject). The Media list is `game.media.images` (downloaded OS images). A mount must not send a technician, so the plan adds one action, `mountVirtualMedia(s, deviceId, image | null)`, in `90-actions/media.ts`, with these rules: the server must have a reachable management controller (`remoteFix` or `ipmiIp` path used by `browser.ts:165`); mounting sets the same boot source that `bootFromUsb` sets for the stick, using a per-device `d.virtualMedia?: OsImage` optional field. That field is the only state this lane would add; if the user prefers no new state, see open question 3. The BMC page gets a "Virtual Media" tab with the image list, a Mount or Eject button and a boot menu hint that follows the existing BIOS screen. `deserialize` leaves the field undefined for old saves, and `newGame` needs no default because it is optional.

### 3.18 HyperVee checkpoints (item 17, final milestone, [Sim, small])

Real screen: Hyper-V Manager's "Checkpoints" pane under the VM list and VM Settings > Management > Checkpoints (Create Checkpoint, Apply, Delete, with names such as "VmName - (31/10/2026 - 14:02:11)"). The look is the glossy MMC from 2008 and the flat MMC from 2012 (`HyperVee.tsx:13`).

Sim change: replace the `datastores` requirement in `snapshotting()` (`snapshots.ts:15-18`) with a new catalog flag `snapshots: true` on `Software` that VMwhere and HyperVee set (`platforms.ts:104,106`), so the datastore feature is not dragged onto HyperVee. No state, but it is a rules change, so it gets a seeded test. The UI is the VMwhere Snapshots list renamed Checkpoints, with the automatic name from the time taken. Open question 4.

## 4. Milestones

Each milestone is one pull request, green on `npm run typecheck`, `npm test` and `npm run build`. The i18n topic file for this lane is `src/i18n/ui-readouts.ts` (export `READOUTS_EN`) with mirrors `src/i18n/de/ui-readouts.ts`, `es/readouts.ts`, `fr/readouts.ts`, `it/readouts.ts`, `pt/readouts.ts`; the key prefix is `readouts.`. Each milestone that adds keys adds them to all six files, so `tests/i18n.test.ts` stays green. The one-line registration `...READOUTS_EN` in `src/i18n/en.ts` (next to `...IPMI_EN`, line 50) is added in M1 once.

1. **M1: Derived helpers and the extra-pages hook.** New `src/sim/80-business/readouts.ts` (task source, constants), the `serviceMbps` hour parameter, and `Tab` widened with `"tasks" | "logs" | "licence"` plus a `useReadoutPages(game, c, f)` hook in a new `consoles/Readouts.tsx` that returns `{ id, label, body }` pages for a console to append. `HypervisorBase.tsx` re-exports `tasks`. Wires the Task log into cPanic, Pleskit, DirectAdmen and FreePanel in their own chrome (3.2). Tests: `tests/readouts-tasks.test.ts` (seeded: an install in progress shows a Running row with the right finish hour, a finished update appears inside the window and not outside, `serviceMbps` with the default hour equals the old value) and `tests/readouts-save.test.ts` (an old-save fixture renders the four panels with the task page without throwing).
2. **M2: Usage bars per account.** `Bar` levels, `Row.traffic`, `accountUse`, `consoles.css` tokens; web panels show disk and bandwidth, game panels CPU and RAM. Tests: `tests/readouts-usage.test.ts` (levels at 0.79, 0.80, 0.95; a service started in 2005 and run to 2012 exceeds its traffic limit; the same save gives the same figure twice).
3. **M3: Log viewer.** `logLines` for the five sources and the log page in the four web panels. Tests: `tests/readouts-logs.test.ts` (an abuse ticket produces its access line before `createdAt`; a breach produces the foreign login at its hour; a power incident produces error lines for its devices; output is identical for the same seed and differs for another).
4. **M4: Licence page.** Reads `licenseCost`, with the reserved block for `panel-host-sim`. Tests: `tests/readouts-licence.test.ts` (account, server, once and free licences show the figures `licenseCost` returns; a free panel shows no cost).
5. **M5: Task, log and licence pages on every other panel console.** TCAdmen, MultiKraft, Pterodaktyl, PowerDNZ, Mailpig and Postfixit, OpenVeePeeN, AnyConnekt, MinnIO, OwnClod and the backup console, each in its own chrome. Tests: extend `tests/panel-consoles.test.tsx` (every console renders the new nav entries signed in, early and late look) and `tests/readouts-consoles.test.tsx`.
6. **M6: cPanic Service Manager, customer side and Log in as user.** Tests: `tests/cpanic-customer.test.tsx` (the account list shows the Log in as user button; the customer side renders in both eras; Stop on the web server calls `setSitesOffline` and the row shows Stopped).
7. **M7: Pleskit Advisor.** `advisorChecks` and the late-look card. Tests: `tests/readouts-advisor.test.ts` (a fresh host scores 100 minus only the backup finding; each finding lowers the score by its penalty; the clamp holds).
8. **M8: FreePanel module tree, System Information and Virtual Servers.** Tests: `tests/readouts-freepanel.test.tsx`.
9. **M9: Infrastructure readouts.** PowerDNZ query chart, mail SPF and DKIM, VPN sessions and throughput, MinnIO usage over time, and the `Chart` `ticks` prop. Tests: `tests/readouts-services.test.ts` (query curve follows the load curve and zeroes for a down workload; `mailChecks` Pass, Missing and Not checked cases; session count never exceeds `spec.users`; the storage series never exceeds the booked disk and is non-decreasing).
10. **M10: Hypervisor readouts.** Horizont flavors page (and the shared `flavors.ts`), HyperVee Integration Services, VMwhere EVC warning and switch, OpenVeeZee templates page, and the hard-coded "No OS templates" moved to `t()`. Tests: `tests/readouts-hypervisors.test.tsx` (flavor counts match VMs; an EVC warning shows for a cross-vendor target and not for the same vendor or in compatibility mode; the switch calls `setCompatMode`).
11. **M11: IPMI sensor thresholds and power draw.** Tests: `tests/readouts-ipmi.test.ts` (a failed fan marks its row Critical and raises the inlet reading; thresholds at their boundaries).
12. **M12: Final milestone, the two small sim changes.** HyperVee Checkpoints with the `snapshots` catalog flag, and IPMI virtual media with `mountVirtualMedia`. Tests: extend `tests/snapshots.test.ts` (HyperVee can take, revert and delete up to three checkpoints; a platform without the flag still refuses) and add `tests/virtual-media.test.ts` (mount needs a reachable controller; mount sets the boot source; eject clears it; an old save without the field loads).

## 5. Files touched

Shared hotspots are marked **[hotspot]**; other lanes also edit them, so each of these edits is kept to a few lines.

| Milestone | Creates | Edits |
| --- | --- | --- |
| M1 | `src/sim/80-business/readouts.ts`, `consoles/Readouts.tsx`, `src/i18n/ui-readouts.ts`, `src/i18n/{de,es,fr,it,pt}/ui-readouts.ts`, `tests/readouts-tasks.test.ts`, `tests/readouts-save.test.ts` | `PanelBase.tsx` **[hotspot]** (`Tab`, `usePanelTab`), `HypervisorBase.tsx` **[hotspot]** (`tasks` re-export), `src/i18n/en.ts` **[hotspot]** (one registration line), `src/sim/60-infra/network.ts` (`serviceMbps` hour parameter), `cpanic/CPanic.tsx`, `pleskit/Pleskit.tsx`, `directadmen/DirectAdmin.tsx`, `freepanel/FreePanel.tsx`, `consoles.css` |
| M2 | `tests/readouts-usage.test.ts` | `PanelBase.tsx` **[hotspot]** (`Bar`, `Row`, `useRows`, `RowsTable`), `consoles.css`, the four web panels' CSS, `readouts.ts`, the six `readouts.ts` i18n files |
| M3 | `consoles/LogViewer.tsx`, `tests/readouts-logs.test.ts` | `readouts.ts`, `Readouts.tsx`, the four web panels, the six i18n files |
| M4 | `consoles/Licence.tsx`, `tests/readouts-licence.test.ts` | `Readouts.tsx`, the four web panels, the six i18n files. Reads `products.ts` only. |
| M5 | `tests/readouts-consoles.test.tsx` | `TCAdmen.tsx`, `MultiKraft.tsx`, `Pterodaktyl.tsx`, `PowerDnz.tsx`, `Mailpig.tsx`, `OpenVeePeeN.tsx`, `AnyConnekt.tsx`, `MinnIO.tsx`, `OwnClod.tsx`, `BackupConsole.tsx`, `tests/panel-consoles.test.tsx`, six i18n files |
| M6 | `cpanic/Customer.tsx`, `cpanic/ServiceManager.tsx`, `tests/cpanic-customer.test.tsx` | `CPanic.tsx`, `cpanic.css`, six i18n files |
| M7 | `pleskit/Advisor.tsx`, `tests/readouts-advisor.test.ts` | `Pleskit.tsx`, `pleskit.css`, `readouts.ts`, six i18n files |
| M8 | `freepanel/SystemInfo.tsx`, one test | `FreePanel.tsx`, `DirectAdmin.tsx`, their CSS, six i18n files |
| M9 | `tests/readouts-services.test.ts` | `Chart.tsx` **[hotspot]** (`ticks` prop), `PowerDnz.tsx`, `Mailpig.tsx`, `OpenVeePeeN.tsx`, `AnyConnekt.tsx`, `MinnIO.tsx`, `readouts.ts`, their CSS, six i18n files |
| M10 | `openstash/flavors.ts`, `tests/readouts-hypervisors.test.tsx` | `Horizont.tsx`, `HyperVee.tsx`, `VmWhere.tsx`, `OpenVeeZee.tsx`, `PanelBase.tsx` **[hotspot]** (`Migrate` EVC warning), `HypervisorBase.tsx` **[hotspot]**, their CSS, six i18n files |
| M11 | `tests/readouts-ipmi.test.ts` | `ipmi/IpmiPage.tsx`, `ipmi/ipmi.css`, `readouts.ts`, six i18n files |
| M12 | `tests/virtual-media.test.ts` | `src/sim/90-actions/snapshots.ts`, `src/sim/10-catalog/platforms.ts` **[hotspot]** (`snapshots` flag), `src/sim/90-actions/media.ts`, `src/sim/50-state.ts` **[hotspot]** (optional `Device.virtualMedia` type only), `src/sim/91-save/` **[hotspot]** (confirm `deserialize` keeps the optional field), `hypervee/HyperVee.tsx`, `ipmi/IpmiPage.tsx`, `tests/snapshots.test.ts`, six i18n files |

Not touched by M1 to M11: `50-state.ts`, `91-save`, `88-tick`, `consoles.ts`, `products.ts` (read only) and everything in `90-actions`. This is the property that lets this lane land first without colliding.

## 6. Dependencies

- Must land first: none. Panel-features.md "Build order" puts this lane at step 1.
- This lane blocks, softly, the others that add pages to a panel's nav, because M1 introduces `useReadoutPages` and the widened `Tab`. After M1 they should append pages through the hook instead of editing nav arrays:
  - `packages-provisioning` (Add a Package, Service Plans, create forms) and `shop-portal`.
  - `panel-host-sim` (licence tier, cap and expiry fill the reserved block from M4; suspend and oversell columns reuse the usage bars from M2).
  - `game-servers` (owns the game panel live console; this lane does not draw it).
  - `web-services` (breach, WordPrass and AutoSSL events appear in the log viewer from M3 once they exist as state).
  - `mail-dns-vpn-storage` (replaces the derived SPF and DKIM and the Service Manager's read-only rows with real state behind the same functions).
  - `hypervisors-backups` (backup jobs add rows to the task source; the EVC and checkpoint work in M10 and M12 must be coordinated with its VMwhere and Proxmocks edits).
- Shared files to merge carefully with parallel lanes: `PanelBase.tsx`, `HypervisorBase.tsx`, `en.ts` (one line each), `platforms.ts` (M12).

## 7. Open questions

1. **Real task history.** The task log is derived and so cannot show a finished backup that a newer one replaced or an update older than 14 days. A true history needs a capped `game.tasks` list, which is state, a `newGame` default, `deserialize` handling and writes in many actions. Recommendation: ship the derived log now; if the player wants a full history later, add the list in `packages-provisioning`, where account creation and provisioning already write to the sim.
2. **Service Manager restart buttons.** Restarting the mail and name servers has no effect today. Recommendation: draw only Stop and Start on the web server now, and add the other restarts when `mail-dns-vpn-storage` gives those daemons behaviour, so no button is a no-op.
3. **IPMI virtual media state.** The mount needs one optional field on `Device`. Recommendation: accept it, since the alternative (sending a technician) defeats the point of a remote mount. If the user wants this lane to stay free of any new field, drop item 20 and keep only the media list as a read-only view.
4. **HyperVee checkpoints rule change.** The catalog calls this [UI], but the sim blocks it. Recommendation: add the `snapshots` catalog flag in M12 rather than giving HyperVee datastores, which would pull in all of the datastore migration rules.
