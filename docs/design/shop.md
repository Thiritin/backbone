# Shop systems, stock and server groups

Status: approved 2026-10-30. Milestones 1 to 3, 5 and the Marketing part of 4 are built. Milestone 6 is built as shop breaches (WHMCache in May 2012, a 2% monthly risk for ModemBill from 2011, BoxBillin' from 2015 to 2021 and any shop running a version past its end of security updates), each lowering every customer's happiness by 15. The power-off prompt from section 5 and a styled shop console in the Browser are open.

The website stays the marketing presentation of product lines (Marketing > Products, `src/sim/80-business/website.ts`). Selling moves into a separate channel: a shop system the player picks from pun-named variants of the order and provisioning software hosters used from 2005 on. The game already bills customers itself, so a shop system here is the order form, the stock and the provisioning modules. Its billing side is not modelled.

## 1. What exists today

- Orders arrive by email until a shop system is active. Every shop system needs the research "Shop systems". Orders that are not email orders are shop orders: they buy a shop product at its price and bill the setup fee plus the first term at once. With a shop and email orders on, 25% of order leads still write an email; email orders can only be switched off with an active shop. Leads that need a quote (a higher SLA, a high budget, a reseller block or a line the shop does not sell) arrive as quote requests in the shop admin instead of by email, with the same 25% email share while email orders are on; with email orders off nothing arrives by email. A shop quote request has no envelope in the mailbox, and its notification opens the shop admin's Quotes page.
- `s.autoOrders` places shop orders through the shop's module, otherwise they wait in Support as accepted orders, and it runs accepted quotes without the player, gated by `canAutomate` (research "Provisioning automation", 150 know-how, needs "Shop systems").
- Every storefront checkout is a shop order (`s.shop.orders`): number, client, items, invoice and status pending, active, fraud or cancelled. A checkout the fraud screening declines is a fraud order. Shop admin > Orders lists them by status; the detail page has Accept, Cancel, Mark as Fraud and Delete. Accept runs the module's Create for every item, which needs the module for the item's server and a product with a server group, and bills the order; an order whose invoice was already written in Support is finished there. An order turns active once all items are set up, by Accept, automation or by hand in Support. Orders older than a year are dropped unless pending.
- A client's service opens its own page in the shop admin: product, cycle, price, next due date, server, package, status (active, suspended, cancelled while a termination with notice runs, terminated), and the access data (username, password behind a reveal button, panel or server address, name servers of a registered domain). The module commands Suspend, Unsuspend, Terminate (with notice), Change Package and Change Password need the shop's module for the software the service runs on; without it the player works on the panel. Each shop system shows only the commands and the status and button words of the real product (`shared/terms.ts`), for example ClientExit's Activate and Cancel or Blessta's Accept and Canceled.
- The shop emails its customers from templates (`src/sim/80-business/shop-mail.ts`): Order Confirmation when an order is placed, the Hosting Account Welcome Email with the access data when Create succeeds, Invoice Created for order and monthly invoices, Invoice Payment Confirmation when an invoice is paid, the reminder and three overdue notices with the dunning steps, suspension and unsuspension, the cancellation confirmation for a termination with notice and Service Termination when the service ends, Quote Delivery when a shop quote is sent, and Password Changed. Only shop customers and leads get them. A sent email is stored as template, parameters and hour, rendered through `t()` when opened, and kept for a year; while the company's own mail server cannot deliver it is logged as failed. The admin's Emails page switches each template on or off and shows the log, the client page shows that client's emails, a service has Resend Welcome Email and a shop invoice has Resend. Without a delivered Welcome Email the service still owes its access data, which brings the follow-up ticket.
- The admin's Apps & Integrations page (each system's own name for it) lists every provisioning module released so far, the payment gateways and the Books link. A provisioning module is included, for sale at the system's module price or not offered (`moduleOffer`: no modules for sale at all, or one the system lacks, such as BoxBillin' for VMwhere, dedicated servers and colocation); it is bought there. Gateways and the Books link show their price and open the vendor's site, where they are bought and then registered with the emailed key. A product binds only a server group whose servers all have their module, or none: then it is manual and its orders wait for the player.
- A shop order that cannot be placed is cancelled (`lost.noCapacity`). Lost sales carry no reputation hit, but they fill the lost-sales list and the market research reasons, which reads as a penalty, and the player has no way to say "sold out".
- `targetFor` (`src/sim/30-market/sales.ts`) picks any fitting software installation in any zone. There is no way to keep a server out of sales.
- Cordon, uncordon and drain are in the Locations device menu, keyed by server, and `setNodeState` writes the state into every software installation on that server.

## 2. Shop systems

### 2.1 Unlock and setup

- New research "Shop systems", tier 1, 60 know-how, 4 days, no prerequisite. A first year yields about 300 know-how, so it is reachable in the first months.
- The shop runs on the website's host (`setSiteHost`). While the site is down the shop takes no orders and leads behave as if there were no shop.
- A shop key is bought on the vendor's website in the Browser. The shop is installed from the software page of a panel host in its console, by picking the variant and entering a key, or without one on the vendor's trial. Installing another variant replaces the current one. Switching takes 3 days of setup, during which only email orders arrive; keys of the old variant stay in My account.
- Old saves with the hand-rolled order form load with no shop, its custom scripts dropped and email orders on.

### 2.2 Modules

A module connects the shop to one software (a panel, hypervisor, game panel, DNS, VPN or storage software) or to the registrar and certificate side. Without the module for a group's software, an order for that group waits in the order queue for the player to provision by hand. With the module and "Provisioning automation", the shop provisions it.

Modules, Shop link and payment method licences belong to the variant they were bought for, on its vendor's site or in its admin. A switch to another variant starts without them, and switching back brings them back.

### 2.3 Variants

Prices are game euros at the start of each variant; the licensing eras, editions and caps over time are in `docs/design/software-versions.md`, section Shop systems. "Modules" lists what is included; "Extra" is what a missing module costs.

| Variant (real product) | Available | Licence | Included modules | Extra modules | Stock | Upside | Downside |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ModemBill (ModernBill) | 2005, sold until 2010 | €250 key or lease from €15 a month | cPanic, Pleskit, registrars | none sold | manual | cheapest real shop | Parallax buys it in 2008; no updates and no new modules after 2011 |
| ClientExit (ClientExec) | 2005 on | €250 key and €50 a year for updates, or lease from €13 a month | cPanic, DirectAdmen, registrars | €150 once (third party) | manual and auto | cheap to own | few modules; no game panel modules before 2010 |
| WHMCache (WHMCS) | 2005 on | €15 a month leased, or a €250 key (€325 from 2007) and €45 a year; from 2020 a lease by active clients | every panel, registrars, certificates, game panels from 2008 | hypervisor modules from ModulesGardn, €200 once per hypervisor | manual and auto | widest panel coverage, the default choice | 2012 breach event; from 2020 the lease scales with active customers (€18 up to 250, €30 up to 500, €50 up to 1,000, then €15 per further 1,000) |
| Blessta (Blesta) | 2007 on | €13 a month leased, keys from 2010 | cPanic, Pleskit, DirectAdmen, registrars, Proxmocks from 2010 | €100 once | manual and auto | no breach events, source included | few hypervisor and game modules |
| HostBull (HostBill) | 2009 on | €16 a month leased, a €600 key from 2013 | every panel, hypervisor, game panel, DNS, VPN and storage software, registrars, certificates | none | manual and auto | everything included | the €600 key from 2013 costs the most up front |
| Ubersmyth (Ubersmith) | 2006 on | €1,000 setup and a lease by managed servers from €100 a month | dedicated servers (OOB power and install), colocation (rack units, PDU ports), DNS | €300 once per panel or hypervisor | manual and auto | the only one that auto-provisions dedicated servers and colocation | expensive for small hosters |
| OrderBocks by ResellerKlub (OrderBox) | 2006 on | free | registrars, certificates, cPanic | none sold | manual | no upfront cost | takes 6% of the monthly revenue of customers who ordered through it |
| BoxBillin' (BoxBilling, later FOSSBilling) | 2011 on | free | registrars | free community modules, each costs 12 staff hours to integrate | manual and auto | no licence | abandoned 2015, rising breach risk until the FossBillin' revival in 2022 |

Notes:

- "Stock: manual" means the player sets a number per product; "auto" also allows stock that follows free capacity (section 3).
- The WHMCache breach (May 2012) and BoxBillin' risk use the existing breach system (`src/sim/60-infra/breach.ts`) as a security incident with customer data lost. They come last in the build order.
- Licences are billed on the 1st with the other software licences.

## 3. Stock and capacity

Stock is set per product (section 4b): off, a number of units the player tops up, or free capacity on variants with auto stock. A product sells while its stock lasts and its server group has room.

- A visitor who finds no fitting plan in stock counts as a sold-out visitor for the month, shown in the shop console. Sold-out visits are not lost sales and never become email orders.
- A shop order is taken only while a target has room. Capacity is not reserved: a shop order that cannot be set up later, or is not set up within 72 hours, is cancelled and refunded, counts as a sold-out visit and never as a lost sale.
- Cordoned, draining and maintenance installations count as no capacity.

Customers ordering on their own is the base of every shop. Orders wait in the order queue for the player. With "Provisioning automation" and the module for the target software, the shop provisions them at once. `s.autoOrders` becomes this switch.

## 4. Server groups

Server groups live in the shop console ("Servers", as in WHMCS). A group is a name, a list of servers and a fill mode.

- A member is one software installation: a panel, a hypervisor, a game panel or another software on one server, or a whole multi-node hypervisor cluster. A cluster only joins its own location's servers, because it exists for live migration within one location; a group can span locations.
- The group's kind is its first member's (panel, hypervisor, game, DNS, VPN or storage); the add list offers only installations of that kind, and the group serves the lines that kind serves (`SERVES` in `platforms.ts`). An installation is in at most one group.
- Each member row shows its accounts, its booked RAM and an "Active" switch. An inactive member takes no new shop orders; its services keep running and the player can still provision onto it by hand. The arrows set the member order.
- "Distribution" chooses "Spread evenly" (the active member with the fewest accounts) or "Fill one server first" (the first active member in list order with room). Only WHMCache, HostBull and Blessta show the choice; the other systems always spread. Placement inside a cluster (pack or spread) is unchanged.
- A product chooses its group in the product editor and places only on that group's active members. A product without a group is manual: its orders wait for the player.
- A new shop creates one group per installed software kind with every installation active, and a new product takes the first group that serves its line.
- Locations and hardware never carry group or stock settings. Dedicated servers and colocation are sold from hardware stock (free servers, free rack units), which only Ubersmyth automates.

## 4b. Products and product groups

A shop with a variant sells plans. A product belongs to a product group and has a line, a spec, a price for each billing cycle the variant supports, a setup fee, stock, a server group, an optional package name and a setup mode (on payment, on accept, by hand). With automatic cycle prices, the default for a new product, the monthly price is the only input and every other offered cycle costs N times the monthly price less that cycle's discount from the shop settings ("Laufzeitrabatte", 0% until the player sets one); changing a discount reprices every such product. "Manage prices manually" makes every cycle's price editable, and a product without a monthly price is always manual. A form visit buys the smallest plan whose spec covers what the visitor wanted. When none covers it, the largest plan is sold if its monthly price is at most 1.35 times what the visitor expected, otherwise the visit counts as sold out and not as a lost sale. A visitor for a line without plans asks for a quote instead of ordering. Every price is the market's unless a product sets its own; the player has no per-unit rates. The cycle discounts sit in the shop's Settings screen.

Email quotes start at the market rate.

Once a shop is active, quotes are written in the shop admin (Billing > Quotes, named after the variant's wording) and Books lists them read-only. A quote carries its origin, `books` or `shop`; a Books draft from before the shop stays editable in Books.

## 5. Cordon, drain and evacuate at software level

Cordon, drain and evacuate act on one software installation on one server (a node of a cluster), not on the server:

- **Cordon**: the installation takes no new placements. Other software on the same server is unaffected.
- **Drain**: workloads move off with live migration only, over the following hours. Workloads that cannot move live stay and are listed. Once empty, the node goes to maintenance.
- **Evacuate**: everything moves now, cold where live is not possible, with the downtime the migration model already computes. Workloads that fit nowhere stay and are listed.
- **Uncordon** returns the node to active from any of these states.

Where:

- In the software's web console, on the Nodes tab (hypervisors) or the Software tab (everything else), per node.
- In the shop console, per group member, as a shortcut.
- The Locations device menu loses Cordon, Uncordon and Drain. It shows the server's hardware actions only. Powering off or hardware maintenance on a server with running software asks to open the software console first.
- The technician drain task becomes a remote admin task on the installation, since draining needs no one on site.

`setNodeState` changes from "every cluster on this server" to one installation. Old saves keep their node states per cluster as they are.

## 6. vSphere gaps

VMwhere vSphear is in the game from 2005. Real releases: ESX 2.5 with VirtualCenter 1.x (2005), Virtual Infrastructure 3 (2006), 3.5 (2007), vSphere 4.0 (2009), 4.1 (2010), 5.0 (2011), 5.1 (2012). Features the game has: live migration (vMotion) with compatibility mode as a partial EVC, failover after 5 minutes (HA), auto-balance of hot nodes (basic DRS), memory reservation, maintenance mode after drain, cluster backups, manual and automatic updates, GPU passthrough, 2x disk overcommit per node.

Missing, with the year it appeared and its value to the game:

| Feature | Real since | Value |
| --- | --- | --- |
| Shared datastores (SAN, NFS, iSCSI) and VMs on shared storage | 2005 | High. Real vMotion and HA needed shared storage until 2012; would give storage hardware a purpose. |
| Snapshots, and backup from snapshots (VCB 2006, VDR 2009, VDP 2012) | 2005 | High. Customer restores, upgrade safety, sellable add-on. |
| Templates and cloning | 2005 | High. Faster VM provisioning, ties into shop auto-provisioning. |
| DRS automation levels, affinity and anti-affinity rules; VM-host rules (4.1) | 2006 | High. Anti-affinity is already the planned next clustering step. |
| HA admission control (capacity reserved for failover), restart priority, VM monitoring (4.0) | 2006 | High. Today failover can strand VMs as stuck. |
| Resource pools with shares, reservations and limits | 2006 | Medium. Customer tiers, noisy neighbours. |
| Storage vMotion | 2007 | Medium. Needs shared datastores. |
| Update Manager baselines with rolling remediation in maintenance mode | 2007 | Medium. Uses software-level drain from section 5. |
| Full EVC baselines per CPU generation | 2008 | Low. Compatibility mode covers most of it. |
| Distributed switch, port groups and VLANs; network I/O control (4.1) | 2009 | Medium. Customer network isolation. |
| Thin provisioning per disk | 2009 | Medium. Replaces the flat 2x overcommit with a choice per VM. |
| Hot-add CPU and RAM | 2009 | Medium. Upgrades without downtime. |
| Fault Tolerance (lockstep second VM, 1 vCPU) | 2009 | Low. Premium SLA product. |
| Distributed power management | 2009 | Low. Power bill savings at night. |
| Host profiles | 2009 | Low. Quicker setup of new nodes. |
| vApps (multi-VM units) | 2009 | Low. |
| Linked mode across vCenters | 2009 | Low. |
| Roles and permissions per admin | 2005 | Medium. Staff access, security incidents. |
| Alarms and performance charts | 2005 | Medium. Monitoring today only shows event lines. |
| Memory ballooning, page sharing, compression (4.1) | 2005 | Medium. `balloon` exists only as data; would make RAM overcommit real. |
| Storage I/O control (4.1), Storage DRS and datastore clusters (5.0) | 2010 | Low. Needs shared datastores. |
| vCloud Director multi-tenancy and self-service | 2010 | Medium. A shop module target for HostBull. |
| Site Recovery Manager and vSphere Replication (5.1) | 2008 | Low. Disaster recovery product. |
| Editions (Standard, Enterprise, Enterprise Plus) gating features; vRAM licensing (2011) and its rollback (2012) | 2009 | Medium. Gives the "extended licence" planned for clustering a historical shape and an era event. |
| Shared-nothing vMotion (live move with local disks) | 2012 | Explains why live moves before 2012 should need shared storage. |
| vCenter appliance and Auto Deploy | 2011 | Low. |

## 7. Build order

Each milestone lands on main with seeded tests, `newGame` defaults, `deserialize` fills and a CHANGELOG bullet.

1. **Shop catalog and choice.** Catalog of variants and modules in `src/sim/10-catalog/shops.ts`; research "Shop systems"; state `s.shop` (variant, owned modules, switch timer); actions `installShop`, `buyModule` in `src/sim/90-actions/shop.ts`; licence billing. The first variants are the pun-named systems of section 2.3.
2. **Stock limits.** Stock setting per line, reservation on order, sold-out visitors instead of lost sales, `autoOrders` routed through modules.
3. **Server groups.** Group state and actions (`createGroup`, `addToGroup`, `removeFromGroup`, `setGroupSale`, `setGroupDeploy`); `targetFor` filtering; auto stock from group capacity and reserve.
4. **Shop UI.** The shop is installed from a panel host's software page and run from its admin at `portal.<company domain>/admin`: stock per line under Options, server groups and modules under Servers, payment methods under Invoices (built). The Marketing app has no shop section.
5. **Software-level cordon, drain, evacuate.** Per-installation `setNodeState`, evacuate action, console buttons, removal from the Locations device menu, technician task moved to an admin task.
6. **Era events.** ModemBill sunset, WHMCache 2012 breach and 2020 pricing, BoxBillin' abandonment and revival.

The vSphere gaps are not part of this build. Each can become its own task after approval; shared datastores, snapshots and templates, and affinity rules come first.

## 8. Open questions

