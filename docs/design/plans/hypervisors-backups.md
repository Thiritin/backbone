# Lane plan: hypervisors-backups

> Critic note (i18n): `src/i18n/en.ts` loads every `ui-*.ts` by glob and `lang.ts` loads every `<lang>/*.ts` by glob, so this lane's new English file is `src/i18n/ui-<topic>.ts` with mirrors `src/i18n/<lang>/ui-<topic>.ts`, and no `en.ts` or `lang.ts` registration edit is needed anywhere below that says otherwise.

This lane deepens the five hypervisor consoles (Proxmocks VE, VMwhere vSphear, HyperVee, OpenVeeZee, Horizont), the Backup console (Backula, Veeham Backup, Proxmocks Backup Server) and the IPMI page. The scope comes from `docs/design/panel-features.md` (sections Hypervisors, Infrastructure consoles > Backup console and IPMI and KVM, Signature mechanics, Cut and deferred). New English keys live in the lane's own topic file `src/i18n/ui-hypervisors-backups.ts`, mirrored in `src/i18n/{de,es,fr,it,pt}/ui-hypervisors-backups.ts`.

## 1. Scope

Every feature below keeps its tag from panel-features.md. A feature marked [Sim] also has a UI screen.

| Console | Feature | Tag | panel-features.md source |
| --- | --- | --- | --- |
| Proxmocks | Backup jobs with schedule and retention, replacing one-off backups; retention uses repository space | [Sim] | Hypervisors > Proxmocks VE; Signature mechanics |
| Proxmocks | Firewall per VM (on/off, policy and port macros; the rules editor stays cut) | [Sim] | Hypervisors > Proxmocks VE; Cut and deferred |
| Proxmocks | Storage replication between nodes | [Sim] | Hypervisors > Proxmocks VE |
| Proxmocks | Cluster quorum: losing the majority makes the cluster read-only | [Sim] | Hypervisors > Proxmocks VE |
| Proxmocks | Shared storage panel in the style of Ceph | [Sim] | Hypervisors > Proxmocks VE |
| VMwhere | DRS at Manual, Partial or Full | [Sim] | Hypervisors > VMwhere vSphear; Signature mechanics |
| VMwhere | Maintenance mode that evacuates a host | [Sim] (thin, see section 2) | same |
| VMwhere | Alarms with thresholds | [Sim] | same |
| VMwhere | Resource pools | [Sim] | same |
| VMwhere | Licence editions gating features | [Sim] | same |
| HyperVee | Replica to a second host | [Sim] | Hypervisors > HyperVee |
| HyperVee | Virtual Switch Manager | [Sim] | same |
| OpenVeeZee | Beancounters with failcnt from overselling | [Sim] | Hypervisors > OpenVeeZee |
| OpenVeeZee | Burst memory | [Sim] | same |
| OpenVeeZee | Live suspend and resume (built as checkpoint and restore) | [Sim] | same |
| Horizont | Floating IPs | [Sim] | Hypervisors > Horizont |
| Horizont | Security groups | [Sim] | same |
| Horizont | Volumes that attach to and detach from instances | [Sim] | same |
| Backup console | Jobs, retention and a restore point calendar | [Sim] | Infrastructure consoles > Backup console |
| Backup console | Restore test button | [Sim] | same |
| Backup console | Offsite copy target | [Sim] | same |
| Backup console | Mail alerts for failed jobs | [Sim] | same |
| IPMI | System Event Log | [Sim] | Infrastructure consoles > IPMI and KVM |
| Proxmocks | HA groups with node priorities (deferred milestone) | [Sim] | Cut and deferred |
| Horizont | Projects with quotas per tenant (deferred milestone) | [Sim] | Cut and deferred |

Not owned here and staying cut or elsewhere: the EVC warning, flavors catalog, network topology graph, Integration Services version, checkpoints naming, container templates (all [UI] items in the catalog that are not in this lane's brief), the cron editor, the rules editor, BIOS boot order, sensor readings and power cycle (already built in `IpmiPage.tsx`).

## 2. Current state

Backups today:

- `Cluster.backup: { targetId, every }` with `BackupEvery = "off" | "daily" | "weekly"` (`src/sim/60-infra/cluster.ts:21`, `:33-40`). One schedule per source cluster, one target cluster. Default set in `clusterDefaults` (`cluster.ts:89`), and `src/sim/91-save/compute.ts:70` clears a target that no longer exists.
- `Workload.backupAt: number | null` is the hour of the single newest copy (`cluster.ts:56-62`, `workloadDefaults` at `:95`). There are no restore points, no retention and no verification.
- The job itself is two readers: `backupFlows` in `src/sim/60-infra/usage.ts:40-55` (network traffic at `BACKUP_HOUR = 2`, weekly on Sundays, `BACKUP_CHANGED = 0.1`, from `src/sim/10-catalog/usage.ts:75-76`) and the stamping code in `src/sim/85-products/products.ts:232-250` that sets `backupAt`. `backupPool(s, targetId)` (`products.ts:152`) sizes the repository with the flat `BACKUP_POOL = 1.3` (`products.ts:30`), so retention has no real cost today.
- Restore reads the single copy: `restoreHours` (`products.ts:166-168`), `restore` in `src/sim/90-actions/vms.ts:183-200`, and data-loss settlement in `src/sim/60-infra/incidents.ts:34-35,165-182` through `hasBackupElsewhere`. Happiness for a restored workload is the table in economy.md under "Data loss and backups" (line 1156).
- UI: the shared `Backups` block (`src/ui/apps/browser/consoles/PanelBase.tsx:239-254`, schedule chips and target chips calling `setBackup`), the `restore` row action (`PanelBase.tsx:128`), the Proxmocks `Backup` tab (`proxmocks/Proxmocks.tsx:51,65`), and `BackupConsole.tsx` (58 lines: job table from `game.clusters.filter(c => c.backup.targetId === p.c.id)`, repository from `backupPool`, software tab). `consoleFeatures().backups` (`src/sim/80-business/consoles.ts:55`) turns the block on for every console that is not mail or a backup product.

Hypervisor state that exists:

- `NodeState = "active" | "cordoned" | "draining" | "maintenance"` (`cluster.ts:18`). `setNodeState` (`cluster.ts:406`), `moveOff` and the draining loop (`cluster.ts:382-446`) already evacuate a draining node and move it to maintenance; the actions are in `src/sim/90-actions/clusters.ts:301-320`. VMwhere maintenance mode is therefore a rename plus a rule, not a new evacuation engine.
- `Ha { live, balance, failover }` (`cluster.ts:23`); `haTick` runs failover and balance hourly (`src/sim/60-infra/ha.ts`, `FAILOVER_MINUTES = 5`, `HOT_RAM = 0.9`). Balancing is on or off per cluster, which is where DRS levels slot in. Clustered panel hosts fail over without research (`ha.ts:75-76`).
- `Datastore { deviceId, protocol, readyAt }`, `attachDatastore`/`detachDatastore` (`src/sim/90-actions/datastores.ts`), `Snapshot` with deltas (`cluster.ts:83-85`, `src/sim/90-actions/snapshots.ts`). economy.md "Datastores" and "Snapshots" (lines 1706 and 1727) hold the numbers.
- `summarize` and alarms (`src/sim/60-infra/alarms.ts`): `CPU_RATIO = 2`, `DISK_FULL = 0.9`, `HOT_RAM`; `Alarm { severity, on, key, params }`, listed by `AlarmList` in both Proxmocks (`Proxmocks.tsx:125`) and VMwhere (`VmWhere.tsx:114`). Thresholds are constants, not editable.
- Overcommit and usage curves: `nodeUsage` and `nodeUsed` (`src/sim/60-infra/usage.ts`, `cluster.ts:118`), economy.md "Usage curves and overcommit" (line 1419) and "Workloads and migration" (line 1309).
- Consoles: `HypervisorBase.tsx` (434 lines, `GLYPH`, `Vm`, `nodeName`, `osText`, node and VM lists), `Proxmocks.tsx` (170), `VmWhere.tsx` (365), `HyperVee.tsx` (219), `OpenVeeZee.tsx` (240), `Horizont.tsx` (225). Each console has its own folder and CSS. `consoleFeatures` decides create, migrate mode (`MigrateMode`) and cluster capability by year (`consoles.ts:34-58`).
- Licensing: `Software.licensing` rows `{ from, kind, fee }` (`src/sim/10-catalog/platforms.ts:104`, VMwhere `once` fee 600 from 2005). There is no edition concept.
- IPMI: `Device.log: { hour, key }[]` with `pushLog` (`src/sim/60-infra/power.ts:34`, capped by `LOG_MAX`) is the event log today. Callers: lockout (`oob.ts:89,226`), failed components (`88-tick/tick.ts:143`), unclean stops (`power.ts:53`). The page lists it newest first in `LogTab` (`src/ui/apps/browser/ipmi/IpmiPage.tsx:99-109`). Sensors exist (`src/sim/60-infra/sensors.ts`).
- Mail alerts: the sim emits `SimEvent { app, key, params }`; `src/sim/alerts.ts` maps stop-the-clock keys to apps. There is no inbox mail for system alerts today.
- Security: breach risk per panel host comes from `POC_RISK` and `WARNING_RISK` in `src/sim/60-infra/security.ts:29-30`. There is no firewall concept in the sim (`firewall` appears only in hardware and economy text).
- Tests to extend: `tests/clusters.test.ts`, `tests/alarms.test.ts`, `tests/snapshots.test.ts`.

## 3. Design

All numbers extend economy.md section "Panel VMs and high availability" (line 1687) and its sub-sections Datastores and Snapshots, unless another section is named. Each shipped milestone adds its values to economy.md in the same pull request. Constants live in `src/sim/10-catalog/platforms.ts` or `src/sim/10-catalog/usage.ts`, next to their neighbours.

### 3.1 Backup jobs, retention and restore points (Proxmocks, Backup console)

State (new, in `src/sim/60-infra/backups.ts`, exported types used by `Cluster` and `Workload`):

- `BackupJob { id: string; name: string; targetId: string; every: "daily" | "weekly"; hour: number; workloadIds: string[] | null; keep: { last: number; weekly: number }; offsiteId: string | null; notify: boolean; lastRun: number | null; lastOk: boolean | null }`. `workloadIds: null` means all workloads of the cluster.
- `Cluster.jobs: BackupJob[]`. Default `[]` in `clusterDefaults`.
- `Workload.points: RestorePoint[]` with `RestorePoint { at: number; gb: number; jobId: string; verified: boolean; bad: boolean; offsite: boolean }`. Default `[]` in `workloadDefaults`.
- `Cluster.backup` and `Workload.backupAt` stay as derived compatibility fields: `backupAt` is the `at` of the newest point (or null), and `cluster.backup` is removed once every reader moves to jobs (milestone 1 migrates the readers listed in section 2). `deserialize` converts an old `backup: { targetId, every }` with `every !== "off"` into one job "Backup" covering all workloads, `hour = BACKUP_HOUR`, `keep = { last: 1, weekly: 0 }`, and gives workloads with a non-null `backupAt` a single point of size `diskGb * fill`. Old saves just load; nothing else is compensated.

Actions in `src/sim/90-actions/backups.ts` (new): `saveJob`, `deleteJob`, `runJobNow`, `pruneNow`. `setBackup` in `clusters.ts` becomes a wrapper that edits the first job, so the existing `Backups` block keeps working until it is replaced.

Tick (`src/sim/60-infra/backups.ts`, called from `products.ts`'s hourly stamping in place of the inline loop at `:232-250`): at each job's hour (weekly on Sundays) every running, non-lost workload of the job gets a new point. Size is a full copy (`diskGb * diskFill`) when it has no point yet or the base was pruned, otherwise an increment of `BACKUP_CHANGED` (0.1) of that. Retention then drops points beyond `keep.last` newest plus one per week for `keep.weekly` weeks; the oldest remaining full stays as the base, so keeping more points costs one increment each.

Economy numbers:

| Value | Amount |
| --- | --- |
| Default retention | keep last 3, weekly 0 |
| Retention range | last 1 to 14, weekly 0 to 8 |
| Jobs per cluster | up to 4 |
| Repository use | sum of `points[].gb` for all workloads of all jobs writing to the target; replaces `BACKUP_POOL = 1.3` in `backupPool` |
| Full repository | the job skips its remaining workloads and is marked failed with reason `full` |
| Target down | job marked failed with reason `unreachable` |
| Restore age | uses the newest good point, so the existing age penalty (economy.md line 1156) is unchanged |

Backup flows for traffic (`usage.ts:40-55`) read jobs instead of `cluster.backup`.

Proxmocks UI: Datacenter > Backup, the real Proxmox VE screen (table of jobs with Add, Edit, Remove, Run now; the edit dialog has Node, Storage, Schedule, Selection mode "All"/"Include selected VMs", Retention tab with Keep Last and Keep Weekly, Send email to). The per-VM `Backup` tab (`Proxmocks.tsx:65`) becomes the real Backup panel: the list of that VM's restore points with Restore and Remove, and "Backup now". Era look: the existing Proxmocks styling (`proxmocks.css`); the retention fields exist from the first Proxmocks year.

Backup console UI (Veeham, Backula, Proxmocks Backup Server share `BackupConsole.tsx`; keep one component with three small skins in `backup.css`):

- Veeham Backup and Replication: Home > Jobs > Backup, a job tree on the left and a job table (Name, Type, Objects, Status, Last result, Next run). Edit job wizard steps Name, Virtual Machines, Storage (retention "Restore points to keep on disk"), Schedule.
- Backula Web (BAT/Bacula web style): Jobs list with Level (Full/Incremental), Status, Pool; retention as the pool's Volume Retention.
- Proxmocks Backup Server: Datastore > Summary and Content with the usage chart, a Prune and GC tab (maps to `pruneNow` and retention), and a Sync Jobs list (maps to the offsite copy).
- Restore point calendar: a month grid, one cell per day, filled when any point exists that day, with the day's points in a side list (Veeham "Restore points" window). Plain table of cells; no chart library.

### 3.2 Restore test, offsite copy, failed job alerts (Backup console)

State: `RestorePoint.verified`, `.bad`, `.offsite` (above); `BackupJob.offsiteId`, `.notify`.

- Restore test: action `testRestore(workloadId, pointAt)` takes `restoreHours` of the repository link (no downtime for the workload) and sets `verified = true` or reveals `bad = true`. Bit rot: each stored point is bad with probability 1% at creation (seeded by `hashRng(seed, workloadIdNum, at)`), 3% on an offsite copy that took the WAN path. A bad point that was never tested fails when restored: the workload comes back empty (the same outcome as `restore` with no backup, `vms.ts:196`) after the wasted restore hours. A tested bad point is skipped and the previous good point is used automatically. This gives the button a decision: spend hours to learn the backup is real.
- Offsite copy: a job with `offsiteId` copies its newest point, weekly on Sundays at `hour + 3`, to a repository cluster in a different availability zone, at `WAN_GB_PER_HOUR` (45). The copy counts as backup elsewhere for datacenter-level loss: `hasBackupElsewhere` (`incidents.ts:35`) and the datacenter `backup` site check (`incidents.ts:103`) accept a point with `offsite` set. Repository space is charged on both targets.
- Failed job alerts: a failed run with `notify = true` raises `SimEvent` key `event.backupFailed` (app "Locations", not a stop-the-clock alert) and appends a company mail through the mail lane's system-mail helper when it exists; until that lane lands the event alone is emitted. The job list shows Last result (Success, Failed: full, Failed: unreachable). Alerts are rate-limited to one per job per day.

Backup console UI: a Test restore button on each restore point, an Offsite copy column and target pick in the job editor (Proxmocks Backup Server "Sync Jobs", Veeham "Backup Copy" job), and a Notifications field (Veeham "Send email notifications to").

### 3.3 Cluster quorum (Proxmocks) [Sim]

State: none stored; quorum is derived. A Proxmocks cluster (kind "cloud" with platform `proxmocks`, two or more nodes) has quorum when the working nodes are a strict majority of `nodes`. `working` comes from `src/sim/60-infra/status.ts`.

Rules: without quorum the cluster is read-only. `createVm`, `deleteVm`, migrate, snapshot, restore, `setNodeState`, `saveJob` and `attachDatastore` refuse with `error.noQuorum`. Running VMs keep running. Failover (`ha.ts`) is suspended without quorum, as in real Proxmox (HA needs quorum). Two-node clusters lose quorum when either node dies, which is the classic Proxmox pitfall and the lesson of the feature; a third node (or the existing mini-server as a "QDevice", cost: any server with no software, free, the same eligibility as a datastore server in economy.md Datastores) restores a majority. The QDevice is a new `Cluster.qdevice: string | null` (default `null`, filled by deserialize) and counts as one vote.

Proxmocks UI: Datacenter > Cluster, the Cluster Information box with Quorate: Yes/No, Expected votes, Total votes, and the node list with Online/Offline; a red banner "Cluster not ready - no quorum?" on the tree when read-only; QDevice add/remove button.

### 3.4 Storage replication and the shared storage panel (Proxmocks) [Sim]

Storage replication (Proxmox "Replication" under Datacenter and per VM):

- `Workload.replica: { toNode: string; every: "15min" | "hourly" | "daily"; lastAt: number | null } | null`, default `null`.
- Action `setReplication(workloadId, toNode | null, every)`. Needs a Proxmocks cluster with local disks (no datastore for that workload), another working node with room for the disk, and a year gate from the Proxmocks `cluster` year in `platforms.ts`.
- Tick: each interval copies the changed share (`BACKUP_CHANGED` of fill) over the LAN, adds that disk to the target node's booked `diskGb` (replicas book space, like a snapshot delta does), and sets `lastAt`.
- Effect: when the source node fails, `failover` in `ha.ts` can restart a VM whose disk lives on the dead node if it has a replica on a working node (today only a VM on a working datastore restarts, economy.md Datastores "Failover"). Data written since `lastAt` is lost: the workload gets the existing data-loss settlement (`settleLoss`, `vms.ts:199`) with `lostAt = lastAt`.
- Numbers: intervals 15 minutes, hourly, daily; bandwidth cost is the same `BACKUP_CHANGED * fill * diskGb` per run; booked space equals the VM disk.

Shared storage panel (Ceph look): derived read-only plus one action.

- A Proxmocks cluster with at least 3 nodes can create a "pool" from node disks: `Cluster.ceph: { enabled: boolean; size: 2 | 3 } | undefined`, default undefined. Capacity is the summed usable disk of the nodes divided by `size` (the replica count). VMs on the pool count as having a shared disk, so they fail over like VMs on a datastore, with no replication lag.
- Losing a node costs 1 of `size` copies; at one copy left the pool turns read-only (same as quorum rule). Rebalancing after a node returns takes `diskUsed / (Gbit * LAN_GB_PER_HOUR)` hours and raises a warning alarm meanwhile.
- UI: Datacenter > Ceph, the real status page (Health, Monitors, OSDs table with In/Out Up/Down, Pools, usage bar). Datacenter > Storage lists the pool next to datastores.

### 3.5 Per-VM firewall (Proxmocks) [Sim]

The rules editor stays cut, so the feature is a switch plus a policy and macros, the shape of the real Proxmox VM > Firewall > Options page.

- `Workload.firewall: { on: boolean; allow: ("web" | "ssh" | "mail" | "db" | "rdp")[] } | null`, default `null` (no firewall). The `allow` list is the Proxmox "macro" tick list.
- Effect: for a VM that hosts a panel or software (own VM, `cluster.vm`), the per-hour breach draw in `security.ts` is multiplied by 0.5 when the firewall is on and `allow` lacks the ports the vulnerable software uses (the software's `ports` in `platforms.ts:70-74`), by 1 otherwise. If the firewall blocks a port the VM's software needs (for example Postfixit without "mail"), the service goes offline until fixed, which is the classic self-inflicted outage and gives the switch a cost. Economy: no money cost; the cost is the outage risk and the player's attention.
- UI: VM > Firewall, Options tab (Firewall: Yes/No, Input Policy DROP/ACCEPT) and a Rules tab that lists the chosen macros as read-only rows with the macro name (HTTP, SSH, SMTP, MySQL, RDP).

### 3.6 VMwhere: licence editions, DRS, maintenance mode, alarms, resource pools

Licence editions (build first, since DRS and alarms gate on it):

- Editions are tiers in the shared licence catalog of `panel-host-sim` (`src/sim/10-catalog/licence-tiers.ts`, ids `essentials`, `standard`, `enterprise`, `cap: null`), stored in `Cluster.licence.tier` (the field `panel-host-sim` adds; this lane adds no `edition` field). `clusterDefaults` fills `licence` for an old VMwhere cluster with `enterprise`, so saves that had every feature keep it (no grandfathering work); a newly built VMwhere cluster starts on `essentials`. The tier-fee billing path (`softwareFee`) is the one `panel-host-sim` M5 builds; this lane adds the VMwhere rows.
- Gates: Essentials keeps live migration, snapshots, datastores. Standard adds HA failover (`ha.failover`) and alarm thresholds. Enterprise adds DRS Partial/Full and resource pools. Licence cost scales the existing `once` fee (600): Essentials ×1, Standard ×2, Enterprise ×4, per cluster node, paid on upgrade through the licensing path in `src/sim/90-actions/software.ts` (verify the licence-charging function there during implementation). An under-licensed feature is greyed out with the edition name.
- UI: Administration > Licensing, the real page (Assets list, product edition, Capacity, Expiration "Never").

DRS (extends `Ha.balance`):

- `Cluster.drs: "off" | "manual" | "partial" | "full"`, default `"off"`; deserialize maps the old `ha.balance === true` to `"full"` and false to `"off"`, and `ha.balance` is then derived. Manual: the hourly pass produces recommendations (a list `Cluster.recs: { workloadId; to; at }[]`, capped at 5) the player applies with one click; Partial: automatic placement of new VMs, recommendations for existing; Full: also applies recommendations (today's `balance` in `ha.ts`).
- The existing hot test (`runsHot`, `HOT_RAM`, `balances`) decides what is a recommendation. Each applied move is a live migration with its normal time cost; none if the move is cold.
- UI: Cluster > Configure > vSphere DRS (Off/Manual/Partial/Full radio, migration threshold slider 1 to 5 maps to HOT_RAM 0.95 down to 0.8) and Cluster > Monitor > DRS > Recommendations table with Apply Recommendations.

Maintenance mode:

- The evacuation engine exists. `enterMaintenance(clusterId, deviceId)` sets `draining` and, on Full or Partial DRS, picks targets automatically; with `off` or `manual` the player migrates by hand and the node waits in `draining`. Exit maintenance returns the node to `active`. No new state; the actions are thin wrappers over `setNodeState` (`cluster.ts:406`) in a new `src/sim/90-actions/vmwhere.ts`.
- Rule: entering maintenance with a VM that cannot move (no room, or cold-only before the live year) refuses with a list of blocking VMs, as real vSphere reports.
- UI: right-click host > Maintenance Mode > Enter, the host icon with the hazard stripe, and the real "Enter maintenance mode" dialog with "Move powered-off and suspended virtual machines" tick.

Alarms with thresholds:

- `Cluster.alarmRules: { cpu: number; ram: number; disk: number }`, defaults `{ cpu: CPU_RATIO, ram: HOT_RAM, disk: DISK_FULL }` (the current constants) in `clusterDefaults`; `summarize` in `alarms.ts` reads them instead of the constants. Editable on Standard and above. Alarms already carry severity; add `acknowledged: boolean` stored in `Cluster.acks: string[]` (alarm keys), default `[]`.
- UI: Cluster > Configure > Alarm Definitions (table: Alarm name, Defined in, Warning, Critical) and Monitor > Issues > Triggered Alarms with Acknowledge and Reset to green.

Resource pools:

- `Cluster.pools: { id: string; name: string; vcpuLimit: number | null; ramLimitGb: number | null; shares: "low" | "normal" | "high" }[]`, default `[]`; `Workload.poolId: string | null`, default `null`.
- Effect: a pool limit caps the sum of booked resources of its members; `createVm` and resize into a full pool refuse with `error.poolFull`. Under contention (node `nodeUsage` above `HOT_RAM`), members of a `high` pool keep their performance and `low` pools raise the slow-site chance used by `slowedAt` (the same slowness path as overselling, `tickets.ts` `SLOW_PENALTY`). Pools exist only on Enterprise.
- UI: the inventory tree with a Resource Pool node under the cluster; Edit Settings dialog with CPU and Memory Shares, Reservation, Limit.

### 3.7 HyperVee: Replica and Virtual Switch Manager

Replica (Hyper-V Replica, Manager > Enable Replication wizard):

- Same state as Proxmocks replication (`Workload.replica`), reused code in `src/sim/60-infra/replica.ts`. Differences: HyperVee clusters are one standalone host or a failover cluster, so the replica goes to "a second host" (a device in the cluster or a standalone second HyperVee server in the same zone). Frequency is the real Hyper-V choice: 30 seconds, 5 minutes, 15 minutes (mapped to hourly sim steps: every tick for the first two, every hour for the third); bandwidth cost scales with the frequency.
- Unplanned failover: when the primary host is down the player runs Failover on the replica (`failoverReplica` action), which starts the VM on the second host from `lastAt`, losing data since then; planned failover (host healthy) loses nothing and reverses direction. Without the action the VM stays down, so the replica gives a faster recovery than restore from backup but is not automatic (HyperVee has no HA before its cluster year).
- UI: Hyper-V Manager > VM > right click Replication > Enable Replication; Replication Health in the details pane (Normal/Warning/Critical from `lastAt` age).

Virtual Switch Manager (Hyper-V Manager > Virtual Switch Manager):

- `Cluster.switches: { id: string; name: string; type: "external" | "internal" | "private"; nic: string | null }[]`, default one `External` switch named "Default Switch" bound to the host's first NIC; `Workload.switchId: string | null`, default `null` (treated as the default switch). Deserialize fills the default switch.
- Effect: a VM on a private or internal switch has no uplink, so a service on it is offline, with a hint in the VM's settings. An external switch bound to a port that is down or unplugged takes its VMs offline too, using the same uplink status the sim already tracks (`src/sim/60-infra/network.ts`, verify the function in M10). This is the decision: a mis-bound switch is a visible outage.
- UI: Virtual Switch Manager dialog (list on the left: New virtual network switch, Virtual Switches; right: Name, Connection type radio, External network dropdown), and VM Settings > Network Adapter > Virtual switch dropdown.

### 3.8 OpenVeeZee: beancounters, burst, checkpoint and restore

Beancounters (`/proc/user_beancounters`, OpenVZ and SolusVM panels):

- Derived, not stored: for each container, the rows `kmemsize`, `privvmpages`, `oomguarpages`, `numproc`, `numtcpsock`, with held, maxheld, barrier, limit, failcnt. `failcnt` is accumulated: `Workload.failcnt: Record<string, number>`, default `{}`, filled by deserialize; each hour a container whose node is oversold past the point of contention (`nodeUsage` ram or cpu above `HOT_RAM`) increments `privvmpages` and `numproc` failcnt by one per hour of contention, scaled by the container's share. `maxheld` is the highest `used` seen (`Workload.peak` is cheap: store as `Workload.maxheld: number`, default 0).
- Link to overselling: OpenVeeZee nodes use the oversell ratio that the panel-host-sim lane adds (`panel-features.md`, Overselling on panel hosts) and the existing cluster overcommit. This lane reads the ratio through the shared helper that lane exports and does not invent its own.
- Effect: failcnt rising on a container means its processes fail; sustained failcnt for 6 hours triggers a slow-site ticket chance (same path as `slowedAt`) and, above 24 failcounts in a day, `oom` kills the service for one hour with a happiness hit using the existing outage ticket. The player fixes it by raising the container's barrier (resize), moving it, or lowering the oversell.
- UI: container > Resources tab, `/proc/user_beancounters` as a monospace table (uid, resource, held, maxheld, barrier, limit, failcnt) in the OpenVZ Web Panel (SolusVM-like) look, failcnt cells in red when non-zero.

Burst memory (VZ "burstable" RAM):

- `Workload.burstGb: number`, default 0. A container's `ramGb` is its guarantee; `burstGb` is how far above it can go while the node has free RAM. Booked RAM counts only the guarantee, so burst is how a cheap plan survives a peak. Burst costs nothing but is lost first when the node runs hot: containers using burst are the first to collect failcnt on `privvmpages`.
- Range: 0 to 2 × `ramGb`. Resize dialog gets a Burst field; the product pages (packages lane) can later price it.

Live checkpoint and restore (vzctl chkpnt and restore):

- `freezeWorkload`/`thawWorkload` in `src/sim/90-actions/vms.ts`. A frozen container keeps its booking but frees its used resources, so its node load falls (`nodeUsage` skips frozen workloads). This is the platform power operation (vzctl chkpnt) and is unrelated to the customer hold of `panel-host-sim` (`suspendService`, `heldServices`), which on OpenVeeZee is the SolusVM-style "Suspend" account action; the two flags are independent and a held container may also be frozen. It is down for the customer, so it needs the same care as stop. Differences from stop: it resumes in `1 minute` (stop and start takes a boot), and it works for a live migration substitute: on OpenVeeZee (`MigrateMode` "cold") the move is checkpoint, copy, restore, so the downtime drops to the checkpoint time (`diskGb ÷ (Gbit × LAN_GB_PER_HOUR)` hours, at least 1 minute) instead of a full cold boot. State: `Workload.frozen?: boolean`, default `false`.
- Numbers: checkpoint and restore 1 minute plus 2 seconds per GB of RAM in use, resumed through the same `busyUntil` path as a restore.
- UI: container row actions Checkpoint and Restore next to Stop and Start (the vzctl chkpnt and restore verbs, so the label "Suspend" stays with the account hold), status "frozen" in the list.

### 3.9 Horizont: floating IPs, security groups, volumes

Floating IPs:

- Uses the sim's address pool (`src/sim/60-infra/addresses.ts`, `src/sim/90-actions/addresses.ts`, `buyAddresses`). `Cluster.floating: { ip: string; workloadId: string | null }[]`, default `[]`. Action `allocateFloatingIp(clusterId)` takes one address from the player's pool (charging the normal address price) and `associateFloatingIp(ip, workloadId | null)` points it at an instance; `deallocate` returns it.
- Effect: a service reachable through a floating IP keeps its address when the instance is replaced or moved to another cluster in the zone; the address change on migration (`renumber` in `migration.ts:5`) is skipped, so no customer DNS breaks. An instance without a floating IP renumbers on migrate as today. This is the player's decision: pay for an address to avoid a renumber ticket.
- UI: Project > Network > Floating IPs, the real table (IP Address, Mapped Fixed IP Address, Pool, Status) with Allocate IP To Project and Associate/Disassociate.

Security groups:

- `Cluster.groups: { id: string; name: string; allow: ("web" | "ssh" | "mail" | "db" | "rdp")[] }[]`, with a default group "default" allowing `ssh`; `Workload.groupIds: string[]`, default `["default"]`. The same macro list and effect as the Proxmocks firewall in 3.5 (halved breach risk when the group does not allow the vulnerable port, outage when it blocks what the service needs), through the shared helper `exposureFactor(s, workload)` in `src/sim/60-infra/exposure.ts` used by both.
- UI: Project > Network > Security Groups, the real list with Manage Rules; the rules table is a read-only list of the chosen macros plus an Add Rule row limited to the same five choices (this keeps the cut rules editor cut).

Volumes:

- `Cluster.volumes: { id: string; name: string; gb: number; attachedTo: string | null }[]`, default `[]`. Volumes are block storage separate from the instance: creating one books `gb` on the cluster's first working datastore (or node disk, as for VM disks, `datastoreOn`), attaching it adds it to the instance's data disk (no change to `Workload.diskGb`, tracked as `volumeGb` on the workload for lost-data accounting).
- Effect: a volume survives deleting its instance (the Horizont rule, and the player's reason for using it): `deleteVm` keeps attached volumes as detached. A customer's data on a volume is not lost when the instance's node dies if the volume's datastore is up, matching economy.md Datastores "Failure". Detaching a volume from a running instance needs a stopped instance before the year Horizont allows hot detach (`platforms.ts` hypervisor traits; use the datastore live year).
- Numbers: volumes cost nothing extra; they count toward datastore capacity and the 4-datastore limit; a volume is 1 to 1000 GB.
- UI: Project > Volumes > Volumes, the real table (Name, Description, Size, Status, Group, Type, Attached To, Bootable) with Create Volume, Manage Attachments.

### 3.10 IPMI System Event Log

- `Device.log` already stores `{ hour, key }`. Extend the log with a `sev: "info" | "warn" | "crit"` and a record id, in the `pushLog` signature (`power.ts:34`) with a default of `info`; `deserialize` fills old entries as `info` and an id from their index. New events: power on/off, fan failed, PSU failed/restored (power.ts), temperature threshold crossing (`sensors.ts`, add at inlet 35 °C warning and 40 °C critical from the existing inlet value), drive failed (already `ipmi.log.failed.<kind>`), BMC login lockout (already), cluster node state changes (`setNodeState`), unclean shutdown (already).
- Cap the log at the existing `LOG_MAX`; add the `Clear log` action in `src/sim/90-actions/hardware.ts` (a player action, so it goes through the actions folder).
- UI: `IpmiPage` `LogTab` gets the real iDRAC/iLO System Event Log look: columns Severity (icon), Date/Time, Description; a Clear Log button; Severity filter. Era look follows the existing `Brand` switch in `IpmiPage.tsx:54`.

### 3.11 Deferred: Proxmocks HA groups and Horizont projects with quotas

Both ship as the final milestones, planned here and built only after the user lifts the deferral in panel-features.md.

HA groups (Proxmox Datacenter > HA > Groups and Resources):

- `Cluster.haGroups: { id: string; name: string; nodes: { deviceId: string; priority: number }[]; restricted: boolean }[]`, default `[]`; `Workload.haGroup: string | null`, default `null`. `failover` in `ha.ts` picks the surviving node with the highest priority from the group before `pickNode`; a restricted group never starts the VM outside its nodes. When the preferred node returns, a VM in a group migrates back (failback) after one hour. Requires quorum (3.3).
- UI: Datacenter > HA with the Groups and Resources tables and the real Create: HA Group dialog (ID, Restricted, Nofailback, node list with priority).

Projects with quotas (OpenStack Horizon Identity > Projects):

- `Cluster.projects: { id: string; name: string; customerId: string | null; quota: { instances: number; vcpu: number; ramGb: number; volumeGb: number; floatingIps: number } }[]`, default one project "admin" with no limits; `Workload.projectId`, default `"admin"`. Create and resize refuse with `error.quotaExceeded` when a project exceeds its quota; the project can be tied to a customer so the customer's growth requests become quota increases the player grants or refuses. Depends on the multi-tenant behaviour listed as missing in panel-features.md, so it stays last.
- UI: Identity > Projects table and the Modify Quotas dialog with the real tabs (Compute, Volume, Network).

## 4. Milestones

Each milestone is one pull request, green on its own (`npm run typecheck`, `npm test`, `npm run build`), with its seeded tests in `tests/`, its English keys in `src/i18n/ui-hypervisors-backups.ts` plus the five mirrored language files, and economy.md updated. Test files are named after the feature, one seeded suite per feature (repo rule).

1. **Backup jobs and restore points, sim only.** `BackupJob`, `RestorePoint`, retention, repository space, readers migrated from `cluster.backup`/`backupAt`, deserialize conversion, the old `Backups` block kept working through `setBackup`. Tests: `tests/backup-jobs.test.ts` (schedule hits the hour, weekly on Sunday only, retention keeps N points and the base, repository space equals the point sum, full repository fails the job, an old save with `backup: { every: "daily" }` loads as one job, `restoreHours` and data-loss settlement unchanged on a one-point history).
2. **Proxmocks Backup tab and Backup console jobs UI.** Datacenter > Backup screen, per-VM Backup panel, Backup console job table with the three skins, restore point calendar. Tests: `tests/backup-jobs.test.ts` extended with `saveJob`/`deleteJob`/`runJobNow` actions; `tests/i18n.test.ts` passes.
3. **Restore test, offsite copy, failed job alerts.** `testRestore`, bit rot draw, offsite weekly copy over WAN, `event.backupFailed`, console buttons and columns. Tests: `tests/backup-verify.test.ts` (seeded bad point fails an untested restore and is skipped after a test, offsite copy counts for datacenter loss, alert fires once per day, WAN copy time).
4. **Proxmocks cluster quorum.** Derived quorum, `error.noQuorum` on mutating actions, HA suspended, QDevice, Cluster tab. Tests: `tests/quorum.test.ts` (two nodes lose one, three nodes lose one stay quorate, QDevice restores a vote, read-only refusals, failover does not run without quorum, running VMs stay up).
5. **Proxmocks storage replication and Ceph panel.** `Workload.replica`, `setReplication`, replicated failover with data loss since `lastAt`, `Cluster.ceph`, Datacenter > Ceph and Storage. Tests: `tests/replication.test.ts`, `tests/ceph.test.ts` (replica books space, failover from a replica, pool capacity ÷ size, read-only at one copy, rebalance hours).
6. **Per-VM firewall and shared exposure helper.** `Workload.firewall`, `src/sim/60-infra/exposure.ts`, breach multiplier in `security.ts`, self-inflicted outage. Tests: `tests/firewall.test.ts` (risk halves with the matching macro closed, outage when a needed macro is blocked, null firewall unchanged).
7. **VMwhere licence editions.** `Cluster.licence.tier` (shared with `panel-host-sim`), gates, upgrade action, Administration > Licensing. Tests: `tests/vmwhere-editions.test.ts` (each gate refuses on Essentials, upgrade charges the fee, old VMwhere cluster loads as Essentials).
8. **VMwhere DRS and maintenance mode.** `Cluster.drs`, recommendations, `enterMaintenance`/`exitMaintenance`, blocker list, UI. Tests: `tests/drs.test.ts`, `tests/maintenance-mode.test.ts` (Manual only recommends, Full applies, `ha.balance` true loads as Full, a blocked evacuation refuses with the VM list, an emptied node reaches maintenance).
9. **VMwhere alarm thresholds and resource pools.** `alarmRules`, `acks`, pools and limits, UI. Tests: extend `tests/alarms.test.ts` (custom threshold fires earlier, acknowledge hides until cleared, defaults reproduce today's alarms) and `tests/resource-pools.test.ts`.
10. **HyperVee Replica and Virtual Switch Manager.** `src/sim/60-infra/replica.ts` shared with milestone 5, `failoverReplica`, switches and their outage rule, UI. Tests: `tests/hypervee-replica.test.ts`, `tests/vswitch.test.ts`.
11. **OpenVeeZee beancounters, burst and checkpoint/restore.** Failcnt accumulation from contention, burst, freeze/thaw, checkpoint migration. Tests: `tests/beancounters.test.ts` (failcnt rises only above the contention line, burst is lost first, an oversold node raises more failcnt than a balanced one), `tests/suspend.test.ts`.
12. **Horizont floating IPs, security groups, volumes.** Address pool use, no renumber on a floating IP, volume survival, UI. Tests: `tests/horizont-network.test.ts`, `tests/horizont-volumes.test.ts`.
13. **IPMI System Event Log.** Severity and id on `pushLog`, new event sources, `Clear log`, UI. Tests: `tests/sel.test.ts` (fan and PSU events, inlet crossing logged once, clear empties, old log entries load as info).
14. **Deferred: Proxmocks HA groups.** Tests: `tests/ha-groups.test.ts` (priority order, restricted group never leaves its nodes, failback after one hour, requires quorum).
15. **Deferred: Horizont projects with quotas.** Tests: `tests/horizont-projects.test.ts` (quota refusal on create and resize, default admin project unlimited, customer tie).

Order inside the lane: 1 to 3 (backups) are the independent spine. 4 to 6 are Proxmocks and need only 1 for the shared job-refusal tests. 7 must precede 8 and 9. 10 reuses code from 5. 11 needs the oversell helper from panel-host-sim. 13 stands alone and can ship any time.

## 5. Files touched

Hotspot marker: `[HOT]` means other lanes edit the same file; this lane keeps its changes there to one block and rebases on origin/main before the pull request.

New files (no collisions):

- `src/sim/60-infra/backups.ts`, `src/sim/60-infra/replica.ts`, `src/sim/60-infra/exposure.ts`, `src/sim/90-actions/backups.ts`, `src/sim/90-actions/vmwhere.ts`, `src/sim/90-actions/horizont.ts`
- UI: `src/ui/apps/browser/consoles/proxmocks/{BackupTab,Replication,Ceph,Firewall}.tsx`, `vmwhere/{Licensing,Drs,AlarmDefs,Pools}.tsx`, `hypervee/{Replication,SwitchManager}.tsx`, `openveezee/Beancounters.tsx`, `openstash/{FloatingIps,SecurityGroups,Volumes}.tsx`, `backup/{Jobs,Calendar}.tsx`
- `src/i18n/ui-hypervisors-backups.ts` and `src/i18n/{de,es,fr,it,pt}/ui-hypervisors-backups.ts`
- Tests listed in section 4.

Per milestone edits:

1. `src/sim/60-infra/cluster.ts` [HOT] (Cluster fields, `clusterDefaults`, `workloadDefaults`), `src/sim/85-products/products.ts` [HOT] (stamping loop, `backupPool`), `src/sim/60-infra/usage.ts` [HOT] (`backupFlows`), `src/sim/90-actions/vms.ts`, `src/sim/60-infra/incidents.ts`, `src/sim/90-actions/clusters.ts` (`setBackup`), `src/sim/91-save/compute.ts` [HOT save], `src/sim/91-save/save.ts` [HOT save] (deserialize conversion), `src/sim/50-state.ts` [HOT] only if a top-level field is needed (not expected), `src/i18n/en.ts` [HOT registration, one line], `docs/design/economy.md`.
2. `src/ui/apps/browser/consoles/PanelBase.tsx` [HOT] (the `Backups` block replaced, `restore` row action), `proxmocks/Proxmocks.tsx`, `backup/BackupConsole.tsx`, `backup/backup.css`, `proxmocks/proxmocks.css`, `src/sim/80-business/consoles.ts` [HOT] (feature flags if a console gets a distinct job screen).
3. `src/sim/60-infra/backups.ts`, `src/sim/60-infra/incidents.ts`, `src/sim/alerts.ts` (no change expected; the event is not a stop), `src/sim/88-tick/tick.ts` [HOT tick] (call site only), `backup/BackupConsole.tsx`.
4. `src/sim/60-infra/ha.ts`, `src/sim/60-infra/cluster.ts` [HOT], `src/sim/90-actions/clusters.ts`, `src/sim/90-actions/snapshots.ts`, `src/sim/90-actions/datastores.ts`, `proxmocks/Proxmocks.tsx`.
5. `src/sim/60-infra/cluster.ts` [HOT], `ha.ts`, `src/sim/90-actions/vms.ts`, `proxmocks/Proxmocks.tsx`, `HypervisorBase.tsx` [HOT] (storage list shows the pool), `src/sim/88-tick/tick.ts` [HOT] (hourly replication step).
6. `src/sim/60-infra/security.ts`, `exposure.ts`, `cluster.ts` [HOT], `proxmocks/Proxmocks.tsx`.
7. `src/sim/10-catalog/platforms.ts` [HOT] (edition rows), `src/sim/90-actions/software.ts`, `cluster.ts` [HOT], `vmwhere/VmWhere.tsx`, `ha.ts`, `alarms.ts`.
8. `src/sim/60-infra/ha.ts`, `src/sim/60-infra/cluster.ts` [HOT], `src/sim/90-actions/vmwhere.ts`, `vmwhere/VmWhere.tsx`, `src/ui/apps/locations/Clusters.tsx` (only if its drain buttons share the new action).
9. `src/sim/60-infra/alarms.ts`, `cluster.ts` [HOT], `HypervisorBase.tsx` [HOT] (`AlarmList` acknowledge), `vmwhere/VmWhere.tsx`, `src/sim/90-actions/clusters.ts`.
10. `src/sim/60-infra/replica.ts`, `network.ts`, `hypervee/HyperVee.tsx`, `cluster.ts` [HOT], `src/sim/88-tick/tick.ts` [HOT].
11. `src/sim/60-infra/usage.ts` [HOT] (frozen workloads skipped), `cluster.ts` [HOT], `src/sim/90-actions/vms.ts`, `openveezee/OpenVeeZee.tsx`, `PanelBase.tsx` [HOT] (row actions Checkpoint/Restore), `src/sim/80-business/consoles.ts` [HOT] (freeze feature flag, not the hold), `src/sim/88-tick/tick.ts` [HOT].
12. `src/sim/60-infra/addresses.ts`, `src/sim/90-actions/addresses.ts`, `src/sim/60-infra/migration.ts`, `cluster.ts` [HOT], `openstash/Horizont.tsx`, `exposure.ts`.
13. `src/sim/60-infra/power.ts`, `sensors.ts`, `oob.ts`, `src/sim/50-state.ts` [HOT] (Device.log entry shape only), `src/sim/91-save/save.ts` [HOT save], `src/sim/90-actions/hardware.ts`, `src/ui/apps/browser/ipmi/IpmiPage.tsx`, `src/i18n/ipmi.ts` (no new keys there; new keys go to the lane file).
14, 15. `ha.ts`, `cluster.ts` [HOT], `Proxmocks.tsx`, `Horizont.tsx`, `consoles.ts` [HOT].

Shared hotspot summary for this lane: `PanelBase.tsx` (m2, m11), `HypervisorBase.tsx` (m5, m9), `50-state.ts` (m13 shape only), `91-save` (m1, m13), `en.ts` registration (every milestone, one line the first time only), `consoles.ts` (m2, m11, m14, m15), `products.ts` (m1), tick `88-tick/tick.ts` (m3, m5, m10, m11), `platforms.ts` (m7), `cluster.ts` (nearly every milestone, the main merge risk: each milestone adds fields in a separate block at the end of `Cluster` and `Workload`).

## 6. Dependencies

Lanes that should land first:

- **readouts**: the task log in `PanelBase.tsx` (start/finish hours from `busyUntil`) is where backup runs, replication runs and restore tests show up. Milestones 1 to 3 work without it; the task log rows for backup runs are added when readouts lands (a follow-up edit, not a blocker). The log viewer there also takes the failed-backup entries.
- **panel-host-sim**: milestone 11 (OpenVeeZee failcnt from overselling) needs the oversell ratio helper. If it has not landed, ship 11 with failcnt from the existing cluster overcommit alone and add the ratio as a one-line follow-up.
- **panel-host-sim**, also for milestone 7: VMwhere editions use its licence-tier catalog and `Cluster.licence` (its M5), so M7 lands after panel-host-sim M5.
- **mail-dns-vpn-storage**: milestone 3 uses its system-mail helper for failed job mail. Milestone 3 ships with the event alone if the helper is missing. Its MinnIO/OwnClod work could become an offsite target later; not planned here.
- **packages-provisioning**: VM templates and flavors are theirs. Milestones 11 (burst field) and 12 (volume size) add fields that the package screens can later read; no ordering requirement.

This lane blocks: none of the other lanes. The oversell ratio in `panel-host-sim` is read, not owned. `web-services` and `game-servers` touch `PanelBase.tsx` and `consoles.ts` in other regions; merge conflicts there are mechanical.

Lanes to coordinate with on the shared type `Cluster` in `cluster.ts`: panel-host-sim (oversell ratio field), packages-provisioning (packages on a software installation). Each adds its fields in its own block.

## 7. Open questions

1. **Does a Proxmocks cluster of two nodes losing one node go read-only?** This is real Proxmox behaviour and creates a strong hardware decision (buy a third node or a QDevice), but it can look unfair to a player who never saw a warning. Recommendation: yes, with a cluster-creation warning in the Cluster tab and a yellow alarm for any cluster of two nodes without a QDevice.
2. **Should bad backup points exist at all?** They make the restore test worth pressing, but add a chance of silent data loss. Recommendation: keep it, at the 1% per point rate, since the alternative is a button without a decision.
3. **VMwhere editions price multipliers (1, 2, 4).** This is a pricing decision against economy.md "Platforms and licenses". Recommendation: ×1, ×2, ×4 of the existing 600 fee per node, to be tuned in `npm run balance`.
4. **Firewall and security group effect size (breach risk ×0.5).** Recommendation: ×0.5, with the self-inflicted outage as the counterweight; revisit after a balance run.
5. **Whether the deferred milestones 14 and 15 stay deferred** once quorum (m4) and the sim's multi-tenant pieces exist. Recommendation: lift the HA groups deferral after milestone 4 ships, keep projects with quotas deferred until a customer-owned project type exists.
