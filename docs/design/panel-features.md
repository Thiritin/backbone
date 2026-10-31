# Panel features

This document lists the server management features each console could gain so it feels like the product it parodies, then plans which of them to build and how they connect to sales and the simulation (from "Plan" on). Today most panels (cPanic, Pleskit, DirectAdmen, FreePanel, TCAdmen, MultiKraft, Pterodaktyl, PowerDNZ, Mailpig, MinnIO, OwnClod, OpenVeePeeN, AnyConnekt) are skins over the shared `RowsTable`, `Nodes` and Software/Backups tabs in `PanelBase.tsx`. The hypervisors (Proxmocks, VMwhere, HyperVee, OpenVeeZee, Horizont) are deeper, with stats, snapshots, templates, datastores and migration.

Tags:

- **[UI]** is a new screen over state the sim already has.
- **[Sim]** needs new state and actions in `src/sim/90-actions`, a default in `newGame` and a seeded test.

## Shared across all panels

These belong in `PanelBase.tsx` so every console gets them in its own look.

- **Task log** [UI]: each action with its start and finish hour, read from `busyUntil` and `migrating.doneAt`. Proxmocks and VMwhere already plan one; every panel can show its own variant.
- **Account suspend and unsuspend** [Sim]: suspending a customer for non-payment or abuse, tied to `habit`, `shady` and abuse requests.
- **Packages** [Sim]: named specs saved on a software installation that accounts are created from (see Packages and products below).
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


## Plan

A feature is built when it gives the player a decision or makes an existing sim event visible. Features that only copy the look of the real product are cut or deferred.

What the sim has today:

- Game servers are sold by vCPU, RAM and disk with a game server usage curve (economy.md, Usage curves and overcommit). There are no game titles.
- Overcommit exists for clusters (`src/sim/60-infra/usage.ts`), not for panel hosts.
- Panel licences are priced (economy.md, Platforms and licenses).
- Payment habits and shady customers exist (`habit`, `shady` in `src/sim/30-customers/customers.ts`).
- A custom order runs the steps quote, account, invoice, domain and provision (`src/sim/30-market/manual.ts`). Each step is one button in Support > Custom order.
- Shop systems, modules and provisioning automation are built (`shop.md`). The styled shop console in the Browser is still open.
- There is no product catalog. Every order is a custom spec the customer names, priced in the quote.

## Packages and products

Selling uses two layers, as the real tools do: a shop product points at a panel package.

**Packages live in the panel.** A package is a named `Spec` saved on a software installation. Each console shows it in its own screen:

| Console | Screen | Package holds |
| --- | --- | --- |
| cPanic | WHM > Add a Package | Disk, traffic, mailboxes |
| DirectAdmen | User Packages | Disk, traffic, mailboxes |
| Pleskit | Service Plans | Disk, traffic, mailboxes |
| FreePanel | Account Plans | Disk, traffic, mailboxes |
| TCAdmen | Game services | Game title and slots |
| MultiKraft | Plans | Game title and RAM |
| Pterodaktyl | Nests and eggs | Game title, RAM and CPU limit |
| Proxmocks, VMwhere, HyperVee, OpenVeeZee, Horizont | VM templates and flavors (existing templates) | vCPU, RAM, disk |

**Products live in the shop console.** A product is a package, a monthly price and a server group (`shop.md`, section 4). Products are what the order form offers, so the shop console is where the player decides what to sell and at what price.

**Before a shop system**, the hand-rolled order form offers a short product list edited in Marketing > Products, next to the product lines the website already presents. Email orders stay custom specs and are priced in the quote as today.

## Manual customer accounts

Early on the player creates every account and service by hand in the software it belongs to. Shop modules and automation take that work over, which is the progression `shop.md` already describes.

| Stage | Account step | Provision step |
| --- | --- | --- |
| No shop system | Customers app > New customer | The panel's own create form: cPanic WHM "Create a New Account", Proxmocks "Create VM", TCAdmen "Add Service" |
| Shop system without the module | Shop console > Add client | The panel's create form |
| Shop system with the module | Created by the shop | The shop provisions after the player confirms |
| With "Provisioning automation" | Automatic | Automatic |

Rules:

- Every create form starts with an Order field. Picking an open order fills the name, email, domain and spec, so the player never retypes what the email says.
- The fields the player sets are the decisions: the host or node, the package (or a custom spec) and the username. Picking a smaller package than the order asks for oversells by hand, with the existing slowdown risk.
- The step buttons in Support > Custom order become links to the matching form. The order thread still checks each step off as it is done.
- Order volume in the first months is a few orders a week, so manual work is a fair cost before a shop system.
- The actions `createAccount` and the provision step stay in `src/sim/90-actions`. The forms call them with the extra fields (host, package, username), so existing tests and old saves keep working.

## Game titles and slots

Game servers get a title, and the unit they are sold in follows the era:

| Years | Unit | Console |
| --- | --- | --- |
| 2005 to about 2012 | Slots per title, 12 to 32 per server | TCAdmen |
| About 2011 to 2018 | RAM per server, 1 to 4 GB | MultiKraft |
| 2018 on | RAM and CPU plans | Pterodaktyl |

- Each title converts slots to resources (for example 0.05 vCPU and 32 MB per slot), so capacity, overcommit and pricing keep working on resources.
- Players online is the usage curve load times slots. It is a readout with no new state.
- A server whose players online reach its slots at peak raises the chance of an upgrade request.
- Titles arrive and fade by era. When a new title launches, demand moves to it, and customers left on an old title churn a little faster.
- A service without a title or slots shows RAM only, so old saves load unchanged.

## Suspend

Suspend and unsuspend go into `PanelBase.tsx`, named as each product names them (cPanic "Suspend", Pleskit "Suspend subscription", Proxmocks "Stop and lock").

- Suspending a customer who is late or bad at paying stops their workloads. It frees capacity and stops losses, costs happiness, and leads to churn if the invoice stays unpaid. Paying unsuspends the service.
- Suspending a shady customer stops their abuse notices, which gives the player something to do about abuse.

## Overselling on panel hosts

Cluster overcommit extends to panel hosts as an oversell ratio per host. The panel shows booked and used resources. A higher ratio fits more accounts on a host, and peak hours slow its sites (`slowedAt`), which costs reviews.

## Signature mechanics

One mechanic per product makes each console worth choosing:

- **cPanic, AutoSSL:** certificates renew on their own. Without it, an expiry incident takes the site down. This justifies the per-account licence.
- **Pleskit, WordPrass Toolkit mass update:** connects to app versions and generated vulnerabilities, so one click trades breakage risk against breach risk.
- **Proxmocks, backup jobs:** a schedule and retention replace one-off backups. Retention uses datastore space.
- **VMwhere, DRS and maintenance mode:** automate the migrations the player does by hand, which pays back the licence.
- **Mailpig and Postfixit, blacklist incident:** a shady customer on a mail host gets its IP listed and every mail customer there loses happiness. Suspending the customer and waiting out the delisting delay fixes it.
- **Game panels, auto-restart:** a crashed server restarts on its own, which cuts the downtime gamers punish.
- **DirectAdmen, resellers:** deferred, since a reseller is a new customer type that buys a block of capacity and resells it.

## Cut and deferred

- Cut, since they carry no decision: the cron editor, the firewall rules editor, the DNSSEC switch, the network topology graph, the extensions catalog and BIOS boot order.
- Deferred, since the sim has no multi-tenant or priority logic yet: Horizont projects and quotas, and Proxmocks HA groups.

## Build order

1. Readouts in `PanelBase.tsx`: the task log, usage bars, log viewer and licence page.
2. The package store per software installation, with the cPanic Add a Package screen.
3. Panel create forms for cPanic, Proxmocks and TCAdmen with the Order field, replacing the provision button.
4. The New customer form in the Customers app, replacing the account button.
5. The shop console page in the Browser, with products and Add client.
6. Game titles and slots in TCAdmen packages, with players online.
7. Suspend.
8. The oversell ratio on panel hosts.
9. Package and create screens for the remaining panels, one pull request each.
10. Signature mechanics, one pull request each.
