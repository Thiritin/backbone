# Clusters and products

Servers join clusters, and products draw their resources from clusters. Everything is virtualized, so adding a server to a cluster adds capacity for every product running on it.

**Clusters.** A cluster is a named pool of servers, such as "Webhosting 1" or "HA Cloud". Its capacity is the sum of its servers' CPU, RAM and storage; booking CPU and RAM past it is always allowed, only the disk limits what products can book (see Overprovisioning is always allowed). Its tier sets what it costs to run and how it handles failures:

- **Consumer cluster:** no failover. Cheap, and fine for customers who shrug off a day of downtime.
- **High-availability cluster:** keeps spare capacity in reserve and spreads servers over two switches or two locations. Costs more, and is sold to customers who can't tolerate outages.

**Everything runs on clusters.** Every product runs as workloads on a cluster, so draining, replicas, keep-apart rules and failover work the same for all of them. Web hosting runs inside shared web server instances with the control panel, and DNS, game servers, load balancers, databases and Kubernetes run as instances too. Object storage runs on a storage cluster made of storage nodes. Two things stay outside: a dedicated server is a whole node taken out of the scheduler's pool and handed to one customer (OpenStack's bare-metal service, Ironic), and colocation is the customer's own hardware using your space, power and ports. The basement server starts as a one-node cluster, which is why a second node and the HA unlock matter.

**Workloads.** Every contract runs as one or more workloads, placed on the servers (nodes) of a cluster:

| Workload | Uses | Moves to another node by |
| --- | --- | --- |
| Virtual machine | vCPUs, RAM, disk | Live migration; customers don't notice |
| Web space | A slice of a web server's CPU, RAM and disk | Copying its files; a few seconds offline |
| Game server | Mostly CPU and traffic | Restarting on the new node; players are kicked |
| Storage volume | Disk | Copying its data; slow, and uses bandwidth |
| GPU server | vCPUs, RAM, disk and whole GPU cards | Moving to a node with enough free cards |
| Dedicated server | A whole node | It can't move; the customer rents that machine |

**GPU servers.** From 2011 a GPU 4U server carries four GPU cards, and a hypervisor cluster with a free card on one of its nodes can sell GPU servers once the team has learned GPU computing in Research. A GPU server is a virtual machine that books 1, 2, 4 or 8 whole cards of one node together with its vCPUs, RAM and disk, so no order for more cards than a node holds can be placed. Cards are parts of the server: they sit in PCIe slots, add their watts to the rack's power, fail like other parts and cannot be taken out while a virtual machine uses them. Demand for GPU servers is small until deep learning in 2017 and generative AI in 2023, and the News app announces both and every new card. Card prices and the rental market are in economy/prices-over-time.md, Prices over time.

**Placement.** The cluster's scheduler picks a node for every new workload, the way OpenStack does. Each cluster has a policy: *pack* fills one node before the next, so fewer servers draw full power, and *spread* keeps every node equally loaded, so a failed node hits fewer customers. Each cluster also sets two rules in its settings, in the spirit of Ceph's default placement rules:

- **Replicas:** how many copies of each workload's disk the cluster keeps (1 to 3). More replicas survive more failed nodes and cost that much more storage.
- **Spread across:** host or rack. A cluster lives in one availability zone, so a customer's workloads and the replicas of one disk go to different hosts or racks within it wherever the cluster has room, and fall back to hosts when it doesn't. Spreading across zones is the customer's choice: they book in two zones. The node view flags workloads placed against the rule. CPU, RAM and disk can be overcommitted per cluster (see Usage and overcommit). A workload has to fit on one node, so a cluster can have enough free RAM in total and still refuse a big VM. The Rebalance button moves small workloads around to make room.

**Node states.** Each node in a cluster has one of four states:

| State | Meaning | OpenStack |
| --- | --- | --- |
| Active | Takes new workloads | Compute service enabled |
| Cordoned | Keeps its workloads but takes no new ones | Compute service disabled |
| Draining | The scheduler moves every workload to other nodes | Live-migrating every instance off the host |
| Maintenance | Empty; safe to upgrade, re-cable, swap or remove | Disabled and empty |

Draining stops with a message when the rest of the cluster has no disk for what the node holds, and says how much is missing; CPU and RAM never stop it. Uncordoning returns the node to Active. Migrations share the links between nodes, so the scheduler moves a few at a time.

**OpenStack as the model.** Virtual machines and cloud servers follow OpenStack, so players who know it recognise everything and players who don't learn something real. The game uses plain names on screen and keeps the OpenStack concept behind each one:

| In the game | OpenStack concept | How it plays |
| --- | --- | --- |
| Cluster | Compute region or cell | A pool of nodes with one scheduler |
| Node | Compute host (Nova) | A server that runs instances |
| Instance size | Flavor | vCPUs, RAM and disk; requests name a size |
| Location (datacenter) | Availability zone | Every booking names one; a cluster lives in one |
| City | Region | Holds one or more zones |
| Hardware class | Host aggregate | Nodes tagged NVMe, ARM or high-memory; sizes can require a class |
| Placement policy | Scheduler filters and weighers | Filters drop nodes that can't fit; *pack* or *spread* weighs the rest |
| Overcommit | CPU, RAM and disk allocation ratios | No limit on CPU and RAM, disk (thin provisioning) up to 2:1 |
| Keep apart | Server group (anti-affinity or soft anti-affinity) | A customer's instances land on different nodes, strictly or when possible |
| Disk replicas and spread | Ceph-backed volumes with CRUSH failure domains | 1 to 3 copies spread across hosts, racks or locations |
| Volume | Block storage (Cinder) | Disks that outlive an instance and move with it |
| Image | Image service (Glance) | The operating systems you offer; each one is a convenience point |
| Private network | Project network (Neutron, VLAN or VXLAN) | Overlay networks are the VXLAN unlock |
| Public IP | Floating IP | Each one uses an address from your pool |
| Customer account | Project (Keystone) with quotas | Cloud quotas and quota requests |
| Restart after a failure | Evacuation, instance HA (Masakari) | Part of HA clusters |
| Load balancer | Octavia | Runs as instances on the cluster |
| Object storage | Swift or Ceph RGW | Runs on storage nodes |
| DNS hosting | Designate | Two DNS workloads per cluster |
| Managed databases | Trove | Database instances you patch and back up |
| Managed Kubernetes | Magnum | Needs a Kubernetes engineer |

**Software on machines.** Software is installed on a machine: a server or one of the player's own VMs. Each machine runs an operating system, Debiant GNU/Lunix or Windoors Server, and holds a list of installed software that must run on that system. Two software on one machine must not share a TCP port, a machine runs at most one hypervisor, and VMs take no hypervisor. A server takes its OS from the installer on its screen (see Server console) and its software from its shell once the OS is up: typed at its console or over ssh from the Terminal, by `apt-get install` with the package or by the line the software's website prints; Windoors answers no ssh. Its status line names what it runs. One of the player's own VMs takes its OS from the same installer on its own console: a Console tile in the VMs app and a Console button on the hypervisor's page open the virtual console, whose bar loads or ejects the installer ISO and starts or stops the VM. A VM has no BIOS and no boot menu: with the ISO of an OS in it boots that installer, otherwise its own disk, and the install ejects the ISO as it starts. A VM made in one click from a hypervisor console starts from a template with its software's OS, and a VMwhere cluster with the App Suite (25 euros a month) deploys a VM with its OS and software in one step. Reinstalling or erasing a panel VM with web spaces on it needs the VM's hostname typed and loses the data like a dead array, booked on the VM's host server. The software's management services take a fixed slice of CPU, RAM and disk on the machine. Installing takes the software's install hours; uninstalling needs the machine empty of what it serves. Booking vCPU and RAM is never limited by the software (see Overprovisioning below). A custom VM can be resized later: growing only its RAM is live on a hypervisor that balloons guest memory (Proxmocks, VMwhere, HyperVee from 2012), and any other resize restarts the VM for 10 minutes. Software inside a VM runs 5% slower than on bare metal, so a panel VM holds 5% less vCPU and RAM than its booking.

**Hypervisor clusters and panel hosts.** A hypervisor installed on a server forms a one-server hypervisor cluster; a server running the same hypervisor joins another cluster of its zone once nothing runs on it, and a server with a different hypervisor or none is refused. Clusters host virtual machines: the customers' VMs (VPS, game servers, DNS, VPN, storage and cloud servers) and the player's own VMs, which the player books with any vCPU, RAM and disk in the hypervisor console's creation wizard and then fills from the installer ISO on its console; a VM with a panel is a panel VM. Web hosting runs on panel hosts. A panel host is either a bare-metal server with a panel installed, whose capacity is the server, or one of the player's own VMs on a hypervisor cluster with a panel installed, whose capacity is the VM's booked vCPU, RAM and disk; the player sizes the VM and can resize it as long as its disk still holds its web spaces and its server has the disk for it. Licences are per panel host as the software's pricing says. PHP versions, PHP upgrades and security advisories apply per panel host. Web hosting on a bare-metal panel server dies with that server; on a panel VM it moves with the VM, so a panel VM on a cluster with failover survives a server failure.

**High availability.** The High availability research (tier 3, after Product management and Monitoring; it replaced Virtualization, which used to open the Virtual machines app) gives every hypervisor cluster three switches. Live migration moves running VMs without downtime, on a hypervisor that can (HyperVee cannot); without it a move is cold and the VM is offline while its disk and RAM copy over. Auto-balancing needs live migration and moves the smallest running VM off a node that runs hot (90% of its installed RAM in use, more busy vCPUs than cores, or booked beyond its bookable capacity) to the idlest node that is not hot, one VM per node an hour. Automatic failover restarts the VMs of a failed node on other nodes with room within about five minutes, counted as five minutes of downtime, and moves the control plane first when its node failed; VMs that fit nowhere stay down and the player hears about them once. Without failover, a failed node's VMs stay down until the node is repaired or the player cold-migrates them. Cloud servers need a cluster with failover on.

**CPU vendors in a cluster.** A node's vCPU is its cores, and the speed of one core decides how busy the same customers make it and whether demanding customers notice a slow core (economy/usage-curves-and-overcommit.md, Core speed). A VM moves live only between nodes whose boards share a vendor, and auto-balancing skips nodes of another vendor. The High availability card has a Compatibility mode switch (the EVC analogue): with it on in both clusters a VM moves live across vendors, and every node of the cluster holds 10% less vCPU. Failover restarts VMs on any node, since a restart is not a live move. A share of VPS, game server and cloud orders needs x86 (economy/balancing.md, x86 orders), so an Ampear node takes only the rest, and the order shows x86 in its spec.

**Server view.** Selecting a server in a location shows everything about it in one place. Its ports work like a switch's: each port with its speed, link state, bond group and the device and port at the other end. Below that come live utilization of CPU, RAM, disk and network against the hardware and the overcommit limits, the workloads running on it with their customers, and the control-plane roles it hosts. The node card puts booked vCPU, RAM and disk next to the CPU, RAM and disk in use, row by row. Each workload row shows its customer, its service (the domain for web hosting) and three small CPU, RAM and disk gauges of use against its booking, sorted by CPU; a gauge at 90% or more turns amber, and a workload that ran its CPU flat out for most of the last day is marked Pegged. A menu on each row moves the workload to another node with room (live or with downtime as the platform allows), stops or starts it, or opens it in Virtual machines.

**Overprovisioning is always allowed.** Booking more vCPU and RAM than a server, a cluster or a panel VM has never refuses a placement, a resize or a migration, whatever the software, since most workloads don't use all of theirs; it only costs performance. The owner's rule: a cluster must never claim to have no room when room is there, a web hosting package needs minimal resources, and overprovisioning is not something that depends on the software. The one hard limit is disk, at twice the usable RAID disk of a node and at the VM's own disk inside a panel VM, because data has to sit somewhere; the order, the placement or the resize fails with a message about the disk. Automatic placement prefers a node whose installed RAM the booking still fits and otherwise takes the idlest node. The capacity bars in Products, Virtual machines and Locations show booked against physical, without a cap line, and run past 100% in the warning colour. As the CPU in use nears the cores, everyone on the node slows down, more steeply past them, and a node overloaded several times over for hours lets its sites time out. When the RAM actually in use passes the installed RAM, the server swaps and slows down; a little further past it, the host kills its largest VM for an hour, one at a time, which is an outage for that VM's customers, until the player moves or stops workloads, adds RAM or the load drops. The console shows a killed VM as OOM killed. The cheap tier 2 training **Memory reservation** adds a per-cluster switch that refuses placements and moves that would book more RAM than a node has installed; it is the only way RAM refuses a booking.

**Usage and overcommit.** Customers rarely use everything they booked at once, so a cluster can sell more than it physically has. Every workload follows a usage curve for its customer type over the hours of the week: game servers sleep through the working week and run hot on weekend afternoons and evenings, online shops are busy from morning to 22:00, news sites peak at breakfast, and backups run at night. The load on a node is the sum of its workloads' curves. As long as that sum stays below the hardware, overcommitting is free money. When the peaks line up, it isn't: CPU contention slows every customer on the node, RAM pressure swaps and then kills workloads, and a full thin-provisioned disk pool stops writes. Mixing customer types on a cluster flattens the peak, and a cluster of nothing but game servers melts every Saturday night. The cluster view shows booked capacity next to the forecast peak for the coming week, and sale seasons, game launches and breaking news push the curves higher for a while.

**When a node fails.** In a high-availability cluster its workloads restart on other nodes within minutes. In a consumer cluster they stay down until the node is repaired. Disks and power supplies often warn before they die, which gives a careful player time to drain the node first. A workload stuck on a switched-off or failed server whose cluster's control plane is down can be recovered by hand to another cluster in the same location.

**Automation.** Unlocks turn these chores into rules: drain a node automatically when it reports a hardware warning, rebalance every night, and restart workloads elsewhere when a node fails.

**Product catalog**

| Product | Runs on | Needs | Notes |
| --- | --- | --- | --- |
| Web hosting | Cluster | Control panel license |  |
| Domains |  | Reseller account, later your own registrar | Can be resold; needs DNS hosting |
| DNS hosting | Cluster | Two DNS workloads on different nodes | Tiny load, but if both go down every customer domain stops resolving |
| SSL certificates |  | Certificate reseller account | Can be resold; often bought with domains |
| Game servers | Cluster | A license per game | Gamers attract DDoS attacks |
| VPS | Cluster | Virtualization platform | Fixed size, monthly |
| Cloud servers | HA cluster | Cloud platform license | Hourly, within a quota; late game |
| VPN | Cluster |  | Uses a lot of bandwidth |
| Dedicated servers | Whole machines | Spare servers in racks | Individuals rent small machines, companies big ones |
| Storage hosting | Storage servers |  | Backups and file hosting; uses a lot of bandwidth |
| Object storage | Storage servers |  | Billed per TB stored and per TB downloaded |
| Managed databases | Cluster | Database license or open source | You run backups and updates; database tickets |
| Load balancers | Cluster |  | Sold with cloud servers; small load, many connections |
| Managed Kubernetes | Cluster | A Kubernetes engineer on staff | Each engineer looks after a limited number of customer clusters |
| CDN | Clusters in several cities | Presence in 3+ locations |  |
| Colocation | Your racks in a datacenter | Datacenter space | Customers rent a rack share or a full rack; you wire their uplinks |
| Add-ons |  | Unlocked per product | Backups, extra IPs, priority support, DDoS protection |

**Colocation.** Customers rent space in your racks: 1/8, 1/4 or 1/2 of a rack or a full rack, the same sizes the datacenters rent to you. A request names the size, the power it needs and its uplinks, such as 2 × 1G or 2 × 10G. You assign a rack with enough free units and power, and the game marks that section as the customer's and puts a patch panel at its top. The customer's hardware is a closed block that draws its power. Your job is to cable the panel's requested ports to your switches. The service is online once every requested uplink reaches the internet at its speed, and it counts against the rack's power limit like your own servers.

Worth adding later: email hosting.

**How the first build plays.** These decisions hold until the parts above them are built:

- A cluster has a name, a zone and a placement policy, and takes every cluster product. Its name says what the player uses it for, such as "Webhosting 1"; there are no cluster kinds.
- Every service with hardware runs as one workload. The scheduler books what the service asks for against the node's cores × 8, its installed RAM and usable disk × 2 (RAM × 1.5 when the player picks the node), and skips nodes that are cordoned, draining, in maintenance or not working.
- A service is online when every workload's server reaches the internet, still holds the data written since the workload was placed, and the customer is not suspended. Domains, certificates and services from saves made before clusters have no workload and stay online.
- Draining moves every workload that fits at once and the rest each hour as room appears; an empty node goes into maintenance. A workload moved off a node that lost its data starts on a fresh disk and comes back online.
- Dedicated servers take a whole mounted server that no cluster or other customer uses. Colocation takes free units at the top of a datacenter rack and adds its watts to the rack, and it is online while the rack has power.
- Servers in a cluster or rented out can't be unmounted or sold, and their racks can't move to another zone.
- The game starts with an empty basement rack and no internet. The player buys the first server in the Shop, mounts it in Locations, plugs in its power and mounts the flat's router from storage with its DSL port on the line jack, cables the server to it, and orders a home line in Locations, which goes live after its install days. Once the server is online, the player opens its console in Locations, presses F11 during POST, boots from the USB stick and installs a panel (simplest, web hosting only) or a hypervisor, then books a VM on the hypervisor and installs a panel in it; the panel's install follows the hypervisor's. The first order email arrives within two weeks of the first panel host finishing its install while the line is live.
- The Guide walks through these steps in order (buy a server, mount and power it, add internet, install software, register your domain, switch on a product, set up company email, first customer) and checks each one off when the game state shows it done. Registering the domain means signing a registrar contract and registering the company domain in Network, Domains; company email is booked in Settings, Email.

- A hypervisor cluster runs nothing until the player installs its hypervisor; a panel host is created with its panel and runs it once the install hours pass. The installed software decides what sells: web hosting needs a panel host with room, VM products need a hypervisor cluster, dedicated servers and colocation need neither.
- The website, order emails and leads only offer product lines that the company can deliver and that the player switched on in Marketing under Products: a panel host or hypervisor cluster the internet reaches, a spare server for dedicated, a datacenter rack for colocation. A dynamic home line sells web hosting only. A new game sells nothing until the setup is done.
- Load follows the usage curves; an overloaded node slows its customers and draws "really slow" tickets instead of killing workloads.
- A cluster backs up daily or weekly to another cluster. A lost array opens an incident report, and every lost workload can be restored from its backup or on an empty disk. Archiving a report takes it off the incident list and out of the open count, and its lost workloads stay restorable from the VM. Customers without a backup send one refund request per incident to Support, and refusing it loses them.
- The hypervisor console in the Browser, at the address of a server running the hypervisor, is where VMs are made, watched, resized, moved and deleted; where the hypervisor supports it, servers running the same hypervisor are joined into a cluster there. Moves between zones wait for links between locations. The Network app is free and available from the start for the location's lines and ports; buying transit and peering needs the Network operations research.

Still to build on top of this: surges in the usage curves, migration times shared between moves, two DNS workloads on different nodes, replicas and keep-apart rules, backup retention settings and hourly backups, distributed storage pools, quotas and self-service for cloud customers, and the uplinks of colocation customers.

**Software choices.** Some products need software bought on the market. Each choice offers four balanced options. The cheap ones are tempting early, but switching later means a migration with downtime and tickets.

| Control panel (web hosting) | Pricing model | Trade-off |
| --- | --- | --- |
| "cPanic" (cPanel) | Per hosted account, in tiers | Customers know it; gets expensive as you grow |
| "Pleskit" (Plesk) | Per server, by number of domains | Good value at mid size |
| "DirectAdmen" (DirectAdmin) | Per server, flat tiers | Cheap; fewer features, more tickets |
| "FreePanel" (open-source panels) | Free | No license fee; more admin work and tickets |

| Cloud platform (cloud servers) | Pricing model | Trade-off |
| --- | --- | --- |
| "OpenStash" (OpenStack) | Free | Every feature above; needs the most admin work until you have staff for it |
| "VMwhere" (VMware) | Per CPU core, yearly | Polished and few tickets; the license bill grows with every node |
| "Proxmocks" (Proxmox) | Free, optional support per socket | Easy to run; no quotas or self-service until the shop unlock |
| "HyperVee" (Hyper-V) | Per server, with an OS license | Business customers like it; Linux customers don't |

Software exists from a year: a panel or hypervisor cannot be installed before its first year (OpenVeeZee, the free container platform, and VMwhere from 2005, Proxmocks and HyperVee 2008, OpenStash 2010), and an old save keeps whatever it has installed. Each panel has traits the picker shows as labels. A panel imports web spaces from the same panel and from other panels from a year of its own, or never: cPanic imports from cPanic from 2005 and from other panels from 2012, Pleskit from 2005 and 2015, DirectAdmen from itself from 2010 and from no other, FreePanel from none. Most panels run web hosting on a single host; FreePanel clusters from 2009, so a second server running FreePanel can join a FreePanel host, and its sites stay up while any of its servers works. No panel of the period replicated sites between hosts, and the game has no replication.

**Migrating a web space.** Moving a web space to another panel host is a hand task that the player runs from the web space's menu or hands to a technician trained on panels. It takes 2 hours between hosts of the same panel and 4 between different panels, plus 3 minutes for each GB of web storage, and half of that when the target's migration tool applies; the hours are shown with each target. The site stays up while it is copied and is unreachable for the last 10 minutes. It costs no money, and a web space on a clustered host moves between its servers by itself.

Game servers work the same way: each game has its own license terms (one-time, per server or per player slot) and its own demand.

Game servers can run on a game server panel ("TCAdmen" from 2005, "MultiKraft" from 2010, the free "Pterodaktyl" from 2016) or in a plain VM on a hypervisor. An order goes to a game panel with room first. A game panel gets updates and vulnerabilities like any software, and while one is compromised its game servers are down until the player cleans it up. The per-game license is not built yet; a panel bills its own fee per server.

**Consoles.** Every panel host, hypervisor node, panel VM, mail host and game panel answers in the Browser at its hostname under the company domain (`node001.<company domain>`, `vm002.<company domain>`) with a login page styled after the product it imitates, without real logos: cPanic has a blue header and an orange button, Pleskit a dark sidebar, DirectAdmen grey with green, FreePanel plain forms, OpenStash Horizont a red sidebar, VMwhere vSphear a blue tree, Proxmocks VE an orange and grey tree, HyperVee Manager a Windows-style list, OpenVeeZee a plain web panel, Postfixit and Mailpig a plain mail admin, and the game panels a dark look. Login is one click. The console lists the software's objects (web spaces, virtual machines, game servers, the mailbox count) with status and usage and offers only the actions its software has; each calls the same action as the desktop apps, which keep working. A console on a host that is down cannot be reached; a console on a hacked host shows a defaced page and nothing else. Every console the company runs is listed in the site index under the company's name. `consoleFeatures(softwareId, year)` returns the matrix:

| Feature | cPanic | Pleskit | DirectAdmen | FreePanel | Horizont | vSphear | Proxmocks VE | HyperVee | Game panels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| List objects, status, usage | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Create and delete | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Stop and start | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Migrate to another host | by hand from 2012 | by hand from 2015 | no | no | yes (live) | yes (live) | yes (live) | cold only | no |
| Resize | yes | yes | yes | no | yes | yes | yes | yes | no |
| Backups and restore | yes | yes | yes | no | no | yes | yes | no | Pterodaktyl only |
| Update the software | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Take sites offline, clean up | yes | yes | yes | yes | no | no | no | no | yes |
| Cluster view (nodes) | no | no | no | from 2009 | yes | yes | yes | from 2012 | no |

A panel migrates from the year its tool imports a web space from another panel (the `migration.other` year of the software); hypervisors migrate live or cold by the software's `live` trait. OpenVeeZee follows HyperVee without the cluster view. The mail servers list their mailbox count, update and nothing else. The console shows the hours a migration takes before the player confirms it. FreePanel has no restore on purpose; the player restores the VM from the hypervisor console. A hacked host shows only the defaced page, so cleaning it up stays in the Products app.

**Storage, backups and data loss.** Workload disks live on their server's RAID array (see RAID), and later on distributed storage pools. If more drives fail before a rebuild finishes than the RAID level survives, or a drive fails without RAID, the data on them is gone. Every affected workload is marked "Lost disk", and the game opens an incident report that lists the lost disks, the affected volumes, workloads and customers, and the age of each one's last backup, so nothing has to be hunted down across apps.

Backups are on-site: backup rules per cluster set how often (hourly, daily, weekly) and how long to keep them, and they write to backup servers in the same zone, mostly at night. A lost disk with a backup can be restored, from the incident report or from the virtual machine manager, and only the data since that backup is gone. Without a backup the customer's data is lost for good.

Data loss hurts. Affected customers ask for a refund, and unhappy ones leave reviews. A refund calms them, but some still write a review: often a 3-star one, sometimes worse. Most customers never write a review at all.

**Virtual machine manager.** A desktop app for running workloads, branded after the virtualization platform you chose: its name and logo in the menu bar and window change with the platform (Proxmocks, VMwhere, OpenStash, HyperVee). It has the usual inventory tree of zone, cluster, host and VM. VMs can be started, stopped, restarted and migrated live or cold to a host you pick, and restored from a backup point. Hosts can be cordoned, drained or put into maintenance. Storage shows each server's RAID health, rebuild progress and rebuild rate, and later the distributed pools. The incidents tab lists open incident reports. It uses the same window design as every other app.

**Requests instead of price lists.** Customers ask for the resources they need, such as disk and mailboxes for a site or vCPUs, RAM and disk for a server. You decide what to build and offer, and customers come to you with requests, by email at first and later through your shop. Each customer picks a host by its size, its scores and hidden factors. Your job is choosing which requests to accept and at what price.

**Where requests come from.** Every request arrives as an email in the Support app, and answering one takes a few minutes of your time like a ticket. There are few of them early on, and more as the company grows. A lead who wants a standard product (a basic SLA and no big budget) writes an **order email** that names the resources it wants, and you work it in steps (see Custom orders); you may also decline it, and an order left unanswered past its due time goes to a competitor. Everyone else (a business SLA, a big budget, the shady VPS request) writes an order email too, in their own words and with their SLA shown on the ticket, and is worked in the same steps; only an expansion is a **sales request** that you answer with a quote. Once a **shop system** is active in Marketing, three in four standard orders skip the inbox: the shop sells a product at its price, bills the setup fee and the first term at once, and places the service through its module when orders are automatic; otherwise the order waits in Support as an accepted order. The other quarter still write an order email, and a shop order that cannot be placed, for lack of a location, product or room, is cancelled. Later the **shop** unlocks: customers order there themselves, and it accepts every request it can serve as long as the target cluster stays below a limit you set.

**The company website.** A new company has no website. Marketing lists it under Channels, which is always open, as the first sales channel. The player builds the first site there with one Build button: a hand-written HTML page that costs nothing and is ready three days later, with a notification. The card then asks the player to buy a domain for the company at NameCheep (the partner under contract once one exists) and gives no link: the player finds the registrar in the Browser. Before launching, the player picks the host, rented at Strateaux or an own web panel host with room, and confirms with Launch, which needs the built site, the domain and a picked host. Saves from before this step count a site as launched when they have a domain and listed lines. Once launched the site is shown in the Browser at www.<company domain>: the company's name and logo, a short pitch, the contact address sales@ the domain and the product lines on offer, and Marketing gains a Products section. Products switches each line on or off; SSL sits indented under web hosting as its add-on, can only be listed while web hosting is, and comes off with it. The Channels card keeps the domain, the host, a tagline of up to 60 characters (shown under the name on the site, empty by default), the web design, the shop and email orders. A line can only be switched on while some installed control plane sells it, and the switch says what is missing otherwise; switching a line off is always allowed. Every new customer comes through the website: organic leads, referrals, forum posts, campaigns, fairs, the first order email and the shady VPS request are all people who looked at it, and a lead whose product is not listed leaves without writing. The lead flows themselves do not change, so Marketing's numbers count everyone who looks, and the listed lines decide who writes. Existing customers keep their services, renewals and upgrades when their line comes off the website. At the start the site is a small business page: each listed line shows its name and a one-sentence description, and the page ends in one call to action, "Contact us", with the sales address. Once a shop is active, each line also shows "from €X a month" ("a year" for domains and SSL), the price of its smallest size this year at the market's rates, and the call to action goes away when email orders are switched off. The site looks home-made in the style of 2005 until the Web design channel is bought in Marketing, which redesigns it in the company colour. A new game lists nothing, and the Getting started step after the domain is to launch the site and put a product on it. Saves from before the website list every line they could sell when loaded. The site needs a host. A new company rents one from "Strateaux" at €9.90 a month, billed from the launch on; a rented host is always up. The player can instead move the site onto any web hosting panel host of their own (a bare-metal panel server or a panel VM), instantly and for free, if the host has room for a small web space. The site is then only as reliable as that host: it is down while the host is off, failed, offline for patching or compromised, and slow while the host performs below full speed (overload, a PHP upgrade) or has over 90% of its RAM booked. A down site brings no website leads and no shop orders and builds no awareness, a slow site brings half of them, and the first hour of every outage of an own host sends one notification. The web design ages: it belongs to a design generation (2005, 2009, 2013, 2017, 2021, 2025, one every four years) and is fine one generation behind, then costs the website leads and shop orders 20% for each further generation, down to 40% of them. A redesign costs the web design price again and brings the design to the current generation; it is not available while the design is current. The Browser shows the site in the look of its generation (a table layout with a visitor counter in 2005, glossy buttons in 2009, a flat hero in 2013, cards and a large header in 2017, a minimal page that follows the theme in 2021, and the same with a chat bubble that answers nothing in 2025), its design year with the Redesign button, and a Hosting card with the host, the site state and a segmented control to move the site. Every web hosting customer also has a small site of their own, generated from their name and business, which is up, slow, defaced (their host was compromised) or down with their web space.

| Request | From | Example |
| --- | --- | --- |
| New customer | A lead that chose you | "A VPS with 4 vCPUs and 8 GB for our shop backend" |
| Expansion | An existing customer that grew | "Our news site needs twice the RAM" |
| Quota increase | A cloud customer | "Raise our quota to 64 vCPUs for the Black Friday sale" |

**The request card.** Every request shows:

- the customer's name and type, for example "Bloomfield Florist, sole proprietor";
- what they want, with resources, location and contract length;
- the SLA they ask for (uptime and response time);
- the monthly revenue, or the expected revenue for hourly cloud usage;
- their requirements with a check or a cross each;
- a bar per resource of the target cluster (CPU, RAM, storage, bandwidth) showing usage before and after. A bar is green below 70%, orange from 70% and red from 90%.

You accept or decline. A declined customer goes to a competitor. Requests you can't serve still arrive, greyed out with what's missing ("needs a location in London", "needs two carriers"), so you can see what demand you are leaving on the table. The Market app adds them up.

**Growth.** Every customer has a growth path with a ceiling. A blog stays about the same size forever, a news site grows to a few times its start, and a startup can grow fifty-fold or shut down. When a customer nears the size they rent, an expansion request follows.

**Cloud servers.** Cloud customers rent virtual machines by the hour and start and stop them as they like. Each cloud customer has a quota (vCPUs, RAM, storage), and their usage moves up and down within it. Raising the quota takes a request with a reason, which you approve, cut down or decline. Quotas can add up to more than the cluster holds, because customers rarely use all of it at once; if they do, their new machines fail to start and they get unhappy.

**Quoting a price.** Every request comes with a market reference: what this kind of customer expects to pay for this service in that year, adjusted for its SLA and features. When you answer, you quote your own monthly price, and the market reference stays next to the field so you can go slightly above or below it. The customer replies by email. Close to the reference, most accept. Well above it, they write that they don't have the budget and will look for another provider, and the deal is lost. A customer who says they can't make it is usually gone, though a lower counter-offer sometimes wins them back. Existing customers accept more for the same service, because switching is a hassle for them. Shop orders are charged at the shop product's price.

**Changing prices.** You can raise the price of a running service. Customers judge a raise by its percentage, so a small step costs little at once while a big jump costs a lot. Every customer also has a maximum they will pay, which the player never sees. While a service costs more than the market, happiness wears down every month, and past the maximum it drops fast enough that the customer leaves within a few months. After a noticeable raise, or while a raised price stays high, customers may write a billing ticket saying the new price is too expensive; you can explain the price, give a credit or revert it. A retention offer only works on a customer who is still reasonably happy and whose price, less the free month, is within their maximum. Anyone else refuses and leaves.

**Agencies first.** Agencies host many small websites for their clients and grow with them. Winning an agency with a very good web hosting offer pays off later, when its clients need VPS and more. Marketing can target agencies directly, and a discount offered in a campaign is quoted back to you when the agency writes in.

**Billing.** Services are billed for every hour they run and invoiced once a month for the month that just ended. Hours a service is down are not billed, so an outage costs you its revenue. Business and Premium SLAs pay credits on top. Usage such as traffic over the included amount, object storage and CDN traffic is billed per TB on the same invoice. Domains and SSL certificates are the exception: they are paid a year in advance and renewed each year, and a customer who doesn't renew is gone.

**Books.** Billing happens in Books, the bookkeeping program Lexwear Office. Each month's invoices arrive there as drafts, and a draft is only due, and only paid, once the player sends it as PDF. A customer pays by bank transfer, which lands in the Bank tab and moves the cash. The invoice stays open until the player matches the transfer to it. A shorter amount is booked as a partial payment, and the next reminder brings the rest, unless the player books it as paid in full. A larger amount pays the invoice and leaves the rest as the customer's credit. Most transfers name the invoice number, but some private customers and gamers write a bare word or their own name, and a few low-budget payers send a few cents short or a rounded amount. A reminder on an invoice whose payment is waiting unmatched costs 5 happiness and brings a billing ticket.

**Products.** The Products tab in Books holds the packages the player sells, listed by line. New product adds one at the line's middle size, with the player's rate as the monthly price and the line's setup fee. Each product has a name that is unique within its line, a size, an SLA, a price per term for each billing cycle it offers, a setup fee, and can be hidden. Once a shop system is chosen, Books shows the catalog read-only.

**Commitment.** Each contract has a minimum term: none for cloud servers, one month for hosting and VPS, twelve months for dedicated servers and colocation. Customers only leave when their term runs out, unless a missed SLA lets them leave early.

**Features.** Each product line has features you switch on in its settings once the unlocks and the infrastructure allow them. Customers require some features and want others: a request whose required features are missing arrives greyed out, and every wanted feature you offer makes customers likelier to pick you and adds to the price.

| Feature | Needs |
| --- | --- |
| High availability | An HA cluster |
| Replicas | 2 or 3 replicas in the cluster settings |
| Spread across racks | Nodes in at least two racks |
| Spread across locations | The cluster stretched over two locations |
| Backups | A backup cluster or storage servers |
| DDoS protection | On-demand or always-on protection on the location |
| Private network | The private networks unlock |
| Two carriers | Uplinks from two carriers at the location |

| Customer | Requires | Wants |
| --- | --- | --- |
| Private individual |  | Backups |
| Gamer, small game server |  | DDoS protection |
| Gamer, game server of 8 GB or more | DDoS protection | A location in their country |
| Hobby developer |  | Private network |
| Sole proprietor |  | Backups |
| Small business | Backups | High availability |
| Agency or startup |  | Private network, replicas |
| Doctor's or law office | Backups, high availability | A location in their country |
| Online shop | High availability, backups | DDoS protection, replicas |
| Enterprise | High availability, replicas, spread across racks, private network | Two carriers, spread across locations, DDoS protection |
