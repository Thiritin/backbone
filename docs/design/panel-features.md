# Panel features

This document lists the server management features each console could gain so it feels like the product it parodies. Today most panels (cPanic, Pleskit, DirectAdmen, FreePanel, TCAdmen, MultiKraft, Pterodaktyl, PowerDNZ, Mailpig, MinnIO, OwnClod, OpenVeePeeN, AnyConnekt) are skins over the shared `RowsTable`, `Nodes` and Software/Backups tabs in `PanelBase.tsx`. The hypervisors (Proxmocks, VMwhere, HyperVee, OpenVeeZee, Horizont) are deeper, with stats, snapshots, templates, datastores and migration.

Tags:

- **[UI]** is a new screen over state the sim already has.
- **[Sim]** needs new state and actions in `src/sim/90-actions`, a default in `newGame` and a seeded test.

## Shared across all panels

These belong in `PanelBase.tsx` so every console gets them in its own look.

- **Task log** [UI]: each action with its start and finish hour, read from `busyUntil` and `migrating.doneAt`. Proxmocks and VMwhere already plan one; every panel can show its own variant.
- **Account suspend and unsuspend** [Sim]: suspending a customer for non-payment or abuse, tied to `habit`, `shady` and abuse requests.
- **Packages and plans** [Sim]: named limits for disk, bandwidth, domains and mailboxes that accounts are assigned to. Overselling a plan is a risk the player chooses.
- **Usage bars per account** [UI]: disk and bandwidth used against the limit, turning red near the cap.
- **Log viewer** [UI]: access, error and auth logs generated from incidents and abuse events.
- **License page** [Sim]: the license tier, account cap and expiry. An expired license shows a banner and blocks new accounts.
- **Update channel** [Sim]: Stable, Release and Edge. Edge brings features sooner and raises the chance an update breaks something.

## Web panels

### cPanic (cPanel and WHM)

- A WHM admin side and a cPanic customer side, with "Log in as user" from the account list [UI].
- Account Functions: Create, Terminate, Modify and Suspend [Sim].
- Account transfer from another server [Sim].
- EasyApachy profiles that pick PHP versions [Sim].
- AutoSSL status per domain, with an expiry incident when it fails [Sim].
- Service Manager for httpd, exim and named, with restart [UI].
- The customer side as an icon grid: File Manager, Email Accounts, Zone Editor and phpMyAdmin [UI].

### Pleskit (Plesk)

- Subscriptions that hold domains, with service plans [Sim].
- A Pleskit Advisor score for the server [UI].
- WordPrass Toolkit with mass update and a vulnerability flag per site [Sim].
- An extensions catalog [UI].
- A banned IPs list in the style of Fail2ban [Sim].

### DirectAdmen

- Three login levels: Admin, Reseller and User [Sim].
- Reseller accounts that resell the player's capacity as a new customer type [Sim].
- A CustomBuild page with software versions and a rebuild button [Sim].
- A Message System for tickets [UI].

### FreePanel (Webmin and Virtualmin)

- A module tree with System, Servers, Networking and Hardware [UI].
- A Virtual Servers list [UI].
- Scheduled Cron Jobs [Sim].
- A firewall rules editor [Sim].
- A System Information dashboard [UI].

## Hypervisors

### Proxmocks VE

- HA groups with node priorities [Sim].
- Backup jobs with a schedule and retention, replacing one-off backups [Sim].
- A firewall per VM [Sim].
- Storage replication between nodes [Sim].
- Cluster quorum: losing the majority turns the cluster read-only [Sim].
- A shared storage panel in the style of Ceph [Sim].

### VMwhere vSphear

- DRS that balances load at a Manual, Partial or Full level [Sim].
- Maintenance mode that evacuates a host [Sim].
- EVC warnings when a migration crosses CPU generations [UI].
- Alarms with thresholds [Sim].
- Resource pools [Sim].
- License editions that gate features [Sim].

### HyperVee

- Checkpoints as the HyperVee name for snapshots [UI].
- Replica to a second host [Sim].
- A Virtual Switch Manager [Sim].
- The Integration Services version per VM [UI].

### OpenVeeZee (containers)

- Container templates [UI].
- Beancounters whose failcnt counters show contention from overselling [Sim].
- Burst memory [Sim].
- Live suspend and resume [Sim].

### Horizont (OpenStash)

- Projects with quotas per tenant [Sim].
- A flavors catalog [UI].
- Floating IPs [Sim].
- Security groups [Sim].
- Volumes that attach to and detach from instances [Sim].
- A network topology graph [UI].

## Game panels

These apply to TCAdmen, MultiKraft and Pterodaktyl.

- Player count and slots per server [Sim].
- A live console with log lines [UI].
- A mod and plugin installer [Sim].
- Scheduled restarts [Sim].
- Crash detection with automatic restart [Sim].
- A game version picker. A new release brings a wave of upgrade requests, and customers left on the old version churn [Sim].
- Pterodaktyl only: node daemon status and port allocations [Sim].

## Infrastructure consoles

### PowerDNZ

- A zones list, a records editor and a DNSSEC switch [Sim].
- Secondary servers [Sim].
- A query stats chart [UI].
- A zone typo incident that takes a customer's site down [Sim].

### Mailpig and Postfixit

- A mail queue with the deferred count, flush and delete [Sim].
- Blacklist status. A spamming account gets the IP listed, delisting takes time, and every mail customer on that IP suffers meanwhile [Sim].
- SPF and DKIM checks per domain [UI].
- Mailbox quotas [Sim].

### OpenVeePeeN and AnyConnekt

- Connected sessions [UI].
- User certificates with revoke [Sim].
- A throughput chart [UI].
- A certificate expiry incident [Sim].

### MinnIO and OwnClod

- Buckets with access policies [Sim].
- Usage over time [UI].
- Erasure coding health, where a failed drive shows as degraded [Sim].
- Shared links in OwnClod and quotas per user [Sim].

### Backup console

- Jobs, retention and a calendar of restore points [Sim].
- A restore test button [Sim].
- An offsite copy target [Sim].
- Mail alerts for failed jobs [Sim].

### IPMI and KVM

- Sensor readings for temperatures, fans and power supplies [UI].
- A System Event Log [Sim].
- Power cycle [UI].
- Virtual media mounting for OS installs [UI].
- BIOS boot order [Sim].

## Order

1. The shared task log, usage bars and log viewer, since they are UI only and reach every panel.
2. Suspend and packages, since they tie the panels into billing, abuse and overselling decisions.
3. One signature feature per product: the cPanic WHM and user split, WordPrass Toolkit in Pleskit, Proxmocks HA groups, VMwhere DRS, the mail blacklist incident and game player slots.
