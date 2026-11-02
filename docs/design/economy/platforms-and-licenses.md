# Platforms and licenses

Every server and every one of the player's own VMs runs an operating system, and software on it must run on that system and share no TCP port with the software already there; at most one hypervisor runs on a machine. A hypervisor ("Cloud" below) runs on every node of a hypervisor cluster and sells VPS, game servers and, with failover on, cloud servers. A panel runs on a panel host, a bare-metal server or one of the player's own VMs, and sells web hosting. Service software runs the same way as a panel, on one bare-metal server or one of the player's VMs, and sells one line each: a game panel sells game servers, a DNS server DNS, a VPN server VPN and a storage server storage. Game servers also run on a hypervisor; DNS, VPN and storage need their own software. A DNS, VPN or storage service already on a hypervisor keeps running there. Dedicated servers, colocation, domains and certificates need neither. Values live in `src/sim/10-catalog/platforms.ts`; fees are monthly, in euros, and change only with the licence eras and the licence price rises (Prices over time), except where a license lists a one-time price first.

| Software | Kind | OS | License | Install | How-to tickets | Live migration | Control plane |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cPanic | Panel | Lunix | €12 per server (Dedicated), from June 2019 the editions Solo to Premier (€0.40 per web space) | 3 h | ×0.8 |  | 0.5 vCPU, 1 GB, 10 GB |
| Pleskit | Panel | Lunix, Windoors | €12 per panel host | 3 h | ×0.9 |  | 0.5 vCPU, 0.5 GB, 10 GB |
| DirectAdmen | Panel | Lunix | €100 lifetime per major or Standard at €4 per panel host, from September 2019 the editions Personal to Standard | 2 h | ×1.2 |  | 0.1 vCPU, 0.1 GB, 2 GB |
| FreePanel | Panel | Lunix | Free | 2 h | ×1.5 |  | 0.1 vCPU, 0.1 GB, 2 GB |
| OpenVeeZee | Cloud | Lunix | Free | 3 h | ×1.4 | No | 0.1 vCPU, 0.1 GB, 2 GB |
| OpenStash | Cloud | Lunix | Free | 8 h | ×1.3 | Yes | 4 vCPU, 8 GB, 50 GB |
| VMwhere | Cloud | Lunix | €600 once per CPU socket, from December 2023 €96 a year per physical core with 16 cores per CPU at least | 5 h | ×0.7 | Yes | 1 vCPU, 2 GB, 10 GB |
| Proxmocks | Cloud | Lunix | Free | 3 h | ×1.0 | Yes | 0.25 vCPU, 1 GB, 10 GB |
| HyperVee | Cloud | Windoors | €20 per node | 4 h | ×0.9 | No | 1 vCPU, 2 GB, 32 GB |
| TCAdmen | Game | Windoors | €25 per server | 2 h | ×0.9 | No | 0.25 vCPU, 0.5 GB, 5 GB |
| MultiKraft | Game | Lunix, Windoors | €20 per server, from 2020 €1.20 per game server beyond 25 | 2 h | ×1.0 | No | 0.1 vCPU, 0.25 GB, 1 GB |
| Pterodaktyl | Game | Lunix | Free | 3 h | ×1.2 | No | 0.25 vCPU, 0.5 GB, 5 GB |
| Bound | DNS | Lunix, Windoors | Free | 2 h | ×1.3 | No | 0.1 vCPU, 0.25 GB, 2 GB |
| PowerDNZ | DNS | Lunix | Free | 2 h | ×1.0 | No | 0.25 vCPU, 0.5 GB, 5 GB |
| Knut DNS | DNS | Lunix | Free | 1 h | ×1.1 | No | 0.1 vCPU, 0.25 GB, 2 GB |
| OpenVeePeeN | VPN | Lunix, Windoors | Free | 2 h | ×1.3 | No | 0.25 vCPU, 1 GB, 2 GB |
| Sysko AnyConnekt | VPN | Lunix | €30 per server | 3 h | ×0.7 | No | 0.5 vCPU, 1 GB, 5 GB |
| WireGuarded | VPN | Lunix | Free | 1 h | ×0.9 | No | 0.1 vCPU, 0.1 GB, 1 GB |
| vsFTPeed | Storage | Lunix | Free | 1 h | ×1.4 | No | 0.05 vCPU, 0.05 GB, 0.1 GB |
| OwnClod | Storage | Lunix | Free | 2 h | ×1.2 | No | 0.5 vCPU, 1 GB, 10 GB |
| MinnIO | Storage | Lunix, Windoors | Free | 2 h | ×1.0 | No | 0.5 vCPU, 1 GB, 10 GB |

| Software | Kind | Control plane |
| --- | --- | --- |
| SquirrelMeal | Webmail | 0.05 vCPU, 0.1 GB, 0.1 GB |
| Postfixit Admin | Webmail | 0.05 vCPU, 0.1 GB, 0.5 GB |
| Backula | Backup | 0.5 vCPU, 1 GB, 10 GB |
| Veeham Backup | Backup | 2 vCPU, 4 GB, 60 GB |
| Proxmocks Backup Server | Backup | 1 vCPU, 2 GB, 32 GB |

**Control plane growth.** The control plane column is what the software takes in its first year (the From column of the table below, 2010 for OpenStash, 2005 or 2008 for the rest). Panels and hypervisors grow RAM and disk with the square root of the server RAM growth (`vpsPlanGb`) since that year, half as fast as server RAM: cPanic takes 1 GB and 10 GB in 2005 and 2.83 GB and 28 GB in 2026. RAM rounds to 0.01 GB and disk to whole GB, and the vCPU stays flat. Game panels, DNS, VPN, storage, mail, webmail and backup software stay at their first-year size. A panel VM sized in an earlier year keeps running as the panel grows: the growth comes out of the room the VM holds for web spaces, RAM can run over as on any overbooked VM, only disk refuses new web spaces, and installing or resizing needs only the disk for this year's panel. A VM whose software and web spaces ask for more vCPU or RAM than it has is frozen (see What runs over). A mail server also books 1 GB × `vpsPlanGb` of disk for every company mailbox it holds (8 GB a mailbox in 2026); customers' mailboxes live in their web space disk and are not booked again.

| Operating system | License | Install | Boot |
| --- | --- | --- | --- |
| Debiant GNU/Lunix | Free | 1 h | 20 min |
| Windoors Server | €600 once per machine, from October 2016 €4 per core (16 per server and 8 per CPU at least) or vCPU | 2 h | 40 min |
| VMwhere App Suite | €25 per VMwhere cluster | | |

Windoors Server and VMwhere are bought once per machine when the install starts, until Windoors moves to 4 euros a month per physical core of a server or per vCPU of a VM in October 2016 and VMwhere to 96 euros a year per physical core in December 2023. A reinstall on the same machine pays nothing; a new machine, a VM from a template included, pays again, and the install is refused without the cash. The App Suite bills 25 euros a month per VMwhere cluster that has it. The OS install and boot add to every install's time to serve. A panel on a hypervisor node is allowed when no port collides. Values live in `src/sim/10-catalog/server-os.ts`.

**Licence eras.** Each licensed product sells what its vendor sold at the game month, from `licensing` in the catalog (docs/design/plans/software-licences.md, Licence models over time). A perpetual key covers the major on sale when it was bought and never bills again; an upgrade to the next major costs the full price, or half (€300 for Windoors, VMwhere and Veeham Backup) for a holder of the previous major's key bought within the last 12 months. A yearly key renews on the same day a year later and shows at a twelfth in monthly bills. A server pays for at least the minimum cores of a per-core era; a VM pays per vCPU. Veeham Backup sells €600 per CPU socket once from 2008 and €480 a year per server from 2018. Prices keep the game's euro scale, where a real list price divides by about three: cPanel's licence of about $35 a server reads €12, and its 2019 editions keep the €2 to €10 and €0.40 per web space the game already charged. When a vendor stops selling an option the shop drops it that day, and a key already bought keeps working. A subscription key whose edition is no longer sold renews as the first edition on sale that fits its account count, so a cPanic Dedicated key moves to Solo, Admin, Pro or Premier at its first renewal from June 2019; the vendor emails the change 30 days before.

**Split cores.** OpenVeeZee and Proxmocks give a guest a fraction of a core through containers and CPU limits, so a VM books exactly the vCPUs it sold. OpenStash, VMwhere and HyperVee give a VM whole vCPUs: a VM books its vCPUs rounded up and uses that much CPU at load. Web spaces, game servers, DNS zones, VPN gateways and storage volumes run as containers in their software and keep their fraction everywhere. A customer who scales a VPS below one core asks for tenths of a core (at least 0.2), so 0.75 of one core becomes 0.8.

| Software | From | Imports from same | Imports from other | Clusters from |
| --- | --- | --- | --- | --- |
| cPanic | 2005 | 2005 | 2012 | Never |
| Pleskit | 2005 | 2005 | 2015 | Never |
| DirectAdmen | 2005 | 2010 | Never | Never |
| FreePanel | 2005 | Never | Never | 2009 |
| OpenVeeZee | 2005 | 2005 | Never | Never |
| OpenStash | 2010 | 2010 | Never | 2010 |
| VMwhere | 2005 | 2005 | Never | 2005 |
| Proxmocks | 2008 | 2008 | Never | 2008 |
| HyperVee | 2008 | 2008 | Never | 2012 |
| TCAdmen | 2005 | Never | Never | Never |
| MultiKraft | 2010 | Never | Never | Never |
| Pterodaktyl | 2016 | Never | Never | Never |
| Bound, PowerDNZ, OpenVeePeeN, Sysko AnyConnekt, vsFTPeed | 2005 | Never | Never | Never |
| OwnClod | 2010 | Never | Never | Never |
| Knut DNS | 2011 | Never | Never | Never |
| MinnIO | 2016 | Never | Never | Never |
| WireGuarded | 2018 | Never | Never | Never |

Game panel anchors: TCAdmin has been sold since 2004 at about USD 30 a month per server (TCAdmen, €25 a month); Multicraft has been sold since 2010 at about USD 25 a month per host (MultiKraft, €20 a month); Pterodactyl's repository was created in December 2015 and its 1.0 came in 2020, and it is free (Pterodaktyl, from 2016).

Service software anchors: BIND (Bound) and PowerDNS (PowerDNZ) both predate 2005 and are free; Knot DNS (Knut DNS) was first released in 2011. OpenVPN (OpenVeePeeN) is free and dates from 2001, Cisco AnyConnect (Sysko AnyConnekt) was licensed per appliance, and WireGuard (WireGuarded) reached its first stable releases around 2018 before landing in Linux 5.6 in 2020. vsftpd (vsFTPeed) is free and older than 2005, ownCloud (OwnClod) was founded in 2010 and MinIO (MinnIO) shipped its S3 server from about 2016.

Anchors: cPanel could copy accounts between servers with WHM's "Copy an account" since 2005 and gained its transfer tool for other panels around 2012; Plesk's Migration Manager appeared with Plesk 7.5.6 in 2005 and the Plesk Migrator extension (2015) imports cPanel, Confixx and others; DirectAdmin moves accounts through backup and restore since about 2010; ISPConfig 3 introduced multiserver setups in March 2009, which is where FreePanel clusters from, while cPanel and Plesk never clustered web serving (only DNS). Hypervisor years follow the products: OpenStack 2010, VMware ESX long before 2005, Proxmox VE 2008, Hyper-V 2008 (clustering of Hyper-V hosts from the 2012 release).

- **Licenses** on a subscription are billed per key on the day of the month the key was bought, one ledger line per key in the category "licenses" naming the product and the key, unassigned keys included. A per-account edition such as cPanic Premier charges its fee for every account on its panel host. The vendor emails one receipt per product. A renewal the bank cannot pay keeps the software running for `LAPSE_GRACE_DAYS`, then the key lapses and the vendor emails it; the next hour with the money renews it for a month from then. A cancelled key runs to the end of its paid month and expires. A key bought once is never billed again. The App Suite and the balancer are billed on the 1st per cluster.
- **How-to tickets:** a customer's how-to rate is multiplied by the average factor of the software serving each of their workloads (the panel for web spaces, the service software for game servers, DNS, VPN and storage, the hypervisor for the rest).
- **Booking:** software sets no limit on what a node books. Every hypervisor and panel books vCPU and RAM past the physical amounts and disk up to twice the usable RAID disk (see Usage curves and overcommit). Ballooning decides one thing: a resize of one of the player's own VMs that only grows its RAM is live on a hypervisor that balloons (Proxmocks and VMwhere, HyperVee from 2012; OpenStash and OpenVeeZee never); any other resize restarts the VM for 10 minutes.
- **Software in a VM** gets 95% of the VM's vCPU and RAM (`IN_VM` in 10-catalog/platforms.ts): a panel VM's web hosting room is 0.95 times its booked vCPU and RAM, less the panel, with its full disk. The same panel on bare metal gets the whole server.
- **Control plane:** a hypervisor's control plane runs on one node of the cluster, the first one added, and counts against what it can book and what it uses. A bare-metal panel host runs its panel on its server; a panel VM runs its panel inside the VM, so the panel counts against the VM's booking. While that node is down, or while the cluster switches software, nothing can be sold, started, migrated or restored on the cluster. Draining moves the control plane to another node once the drained node is empty, and the player can move it to any working node with room.
- **Installing** goes on a machine: a free mounted server, or one of the player's own VMs for a panel, with room for the control plane on it. A hypervisor on a server makes it a one-server hypervisor cluster named after its location; servers with the same installed hypervisor join a cluster once nothing runs on them. A panel VM can be created while its cluster's hypervisor is still installing; its panel starts installing once the hypervisor is done. The control plane is busy for the install hours in the table, and nothing can be placed on the cluster until it is done. An install costs nothing up front; the license is billed from the next 1st of the month.
- **Switching** software is an uninstall and an install. Uninstalling needs the machine empty of what the software serves; a VM stays, empty, and the player deletes it separately.
- **Selling:** the website, order emails and leads only carry product lines that an installed control plane on a cluster with nodes sells. Placement refuses with "No cluster runs a hosting panel" or "No cluster runs a virtualization platform" when no cluster in scope has the right software, and with the capacity error when it has but no node has room.
- **Years and traits.** Software cannot be installed before its `from` year (`error.softwareNotYet`); old saves keep what they have. `migration.same` and `migration.other` are the years from which the software imports a web space from the same software and from another panel (null never), `cluster` the year from which a panel host takes a second server (null never). Panels cluster by joining an empty server that runs the same panel in the zone, through the same join flow as a hypervisor node; a panel host in a VM stays on one server. The clustering years of hypervisors are recorded for reference; hypervisor clusters can grow from the day the hypervisor is installed. There is no replication trait: no panel of the period replicated sites between hosts.
- **Game server panels** (kind "game") run containers for game servers on a server or in one of the player's own VMs, one panel per machine like a web panel. A game panel sells game servers and nothing else, at the how-to factor of its software. Hypervisor clusters keep selling game servers as plain virtual machines, so a game server order goes to a game panel with room first and to a hypervisor cluster otherwise. Game panels ship one release a year like every software and have 1.5 vulnerabilities per release; a compromised game panel takes its game servers down until the player cleans it up (Security advisories, Generated vulnerabilities). A license per game is not modelled yet; the panels bill only their own fee, per server.
- A new game starts with no software installed. Old saves keep the panel and platform they had, and saves from before platforms load with FreePanel and Proxmocks installed.

**Migration in the first build.** Inside a zone, links count as 1 Gbit/s, which moves 450 GB an hour. Virtual machines move live on platforms with live migration; on HyperVee they are offline for (disk + RAM) ÷ 450 GB per hour, rounded up to whole hours. Web spaces move between panel hosts as the hand task above; game servers and storage volumes move without a lost hour. Moves between zones need a ready zone link (Network, zone links): it moves 450 GB an hour for every Gbit/s of its speed, and parallel links add up. A VM moves live over 10 Gbit/s or more and is otherwise offline for the transfer; a web space's hand task takes the copy time on top. Without a zone link, a move into a rented location goes over the internet at the slower side's uplink (the home line's upload speed in the basement, the location's transit and datacenter bandwidth elsewhere), at most 45 GB an hour (`WAN_GB_PER_HOUR`), always cold, so two rented locations always reach each other this way: a 40 GB VPS on a 10 Mbit/s line (4.5 GB an hour) is offline for 9 hours. Without a home line the move is refused. A workload with a lost disk can't migrate; it is restored instead.

**Migration offers.** The player can ask a customer to agree to a move (gdd/support.md, Support, Migration offers). The customer answers when their reply time is up: below happiness 40 they decline, otherwise they accept and name a window from the segment of Noticing outages. Players want the first 02:00 to 06:00 after the answer, businesses the next weekday from 18:00 to 22:00 (never the day of the answer), private customers any time, so their move runs at once. The accepted move runs at the first hour of the window as the move above, with its downtime. A customer whose service moves from the basement into a datacenter gains 5 happiness. A move that has not run within 48 hours of the window's start costs 10 happiness and reopens the ticket. The numbers are `DECLINE_BELOW`, `BASEMENT_BONUS`, `MISSED_PENALTY` and `MISSED_AFTER_HOURS` in `src/sim/90-actions/moves.ts`, the windows `MOVE_WINDOW` in `src/sim/10-catalog/attention.ts`.

### SSL certificates and AutoSSL

From 2016 every web space on a panel host has a certificate of its own that lives 90 days; a domain with a certificate bought through the registrar is not affected. The first expiry of each domain is spread over the first 90 days. A certificate that runs out slows the site until it is renewed.

| Effect | Value |
| --- | --- |
| AutoSSL (cPanic hosts only, switched on by the player) | Renews in the last 30 days; each daily attempt fails with 3% and is retried the next day |
| Without AutoSSL, the customer renews on the last day | High skill 60%, medium 30%, low 5% |
| Expiry | The site is slowed every day, the customer loses 12 happiness once and 60% open a ticket |
| Renewing by hand (any panel) | 5 minutes of the player's time; ends the incident and gives +5 happiness if a ticket was open |
| Check now (cPanic with AutoSSL on) | 5 minutes of the player's time; renews every certificate due within 30 days |

AutoSSL is what makes the per-web-space cPanic licence worth its price: a host of 200 web spaces sees about 800 renewals a year, and most of them lapse without it.
