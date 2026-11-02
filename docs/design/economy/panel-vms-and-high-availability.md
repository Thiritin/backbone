# Panel VMs and high availability

A panel VM is one of the player's own VMs on a hypervisor cluster with a panel installed. Its booking is the web hosting capacity of its panel host, less the panel's control plane. Values live in `src/sim/90-actions/clusters.ts` and `src/sim/60-infra/ha.ts`.

| Value | Amount |
| --- | --- |
| Suggested size in the setup and the Products app | 2 vCPU, 2 GB RAM, 50 GB disk, about 7 web spaces of 2 GB; the basement server keeps room for the smaller game server next to it |
| Smallest size | 1 vCPU, 1 GB RAM, 10 GB disk, and at least the panel's control plane disk; smaller CPU or RAM than the panel needs installs and freezes the VM |
| Resize | Any size that still holds the web spaces' bookings plus the panel and fits on the VM's server |
| Use | What its web spaces use plus the panel's control plane |
| Failover downtime | 5 minutes per VM restarted on another node, added to each affected service's down hours |
| Hot node | 90% of installed RAM in use, more busy vCPUs than physical cores, or booked beyond what it can book |
| Auto-balancing | One VM per hot node an hour, the smallest running one, to the idlest node that is not hot |

- **High availability** is the tier 3 research of 400 know-how and 14 days after Product management and Monitoring. Each hypervisor cluster then has three switches, all off by default: live migration, auto-balancing (needs live migration) and automatic failover.
- **Live migration** needs the switch on and a hypervisor that supports it; otherwise a VM migration is cold and takes the VM offline for (disk + RAM) ÷ (link Gbit/s × 450 GB per hour), at least one hour. Moving web spaces between panel hosts in a zone stays instant.
- **Cloud servers** need a hypervisor cluster with failover on.
- **The Virtual machines and Network apps** cost nothing in the Pear Store. Virtual machines installs once a hypervisor is installed or installing; Network is available from the start, and buying transit and peering in it needs Network operations.

### Datastores

A datastore is a server attached to a VMwhere cluster as shared storage for VM disks. Values live in `src/sim/10-catalog/platforms.ts`.

| Value | Amount |
| --- | --- |
| Eligible server | Any server with drives in the cluster's zone that belongs to no cluster and runs no software |
| Capacity | Usable RAID disk times the disk overcommit (2x), as on a node |
| NFS | From 2005, free, at the server's fastest port speed |
| iSCSI | From 2006, free, at the server's fastest port speed |
| Fibre Channel | From 2005, €700 per cluster node once at attach for the host adapters, 4 Gbit, 8 from 2008, 16 from 2011 |
| Datastores per cluster | Up to 4 |
| Attach time | 1 hour |

- **Placement.** A new VM's disk goes on the cluster's first working datastore with room; otherwise on its node, which then books the disk. A VM that moves to another cluster takes its disk to its new node.
- **Live migration.** Before 2012 a VMwhere VM moves live only with its disk on a datastore of its cluster and to a node of the same cluster; a VM with its disk on its node moves cold. From 2012 every VMwhere VM moves live. Other hypervisors keep their rules.
- **Failover.** On VMwhere only VMs with their disk on a working datastore restart on another node; a VM with its disk on the dead node stays down until the node works again, in every year.
- **Moving a disk** between its node and a datastore, or between datastores, takes the VM offline before 2007 for disk ÷ (Gbit × 450 GB per hour), at least one hour, at the slower datastore's speed; from 2007 it moves with no downtime.
- **Failure.** A datastore server that stops working takes every VM on it down. A datastore that loses its data loses every disk on it.
- **Detaching** needs the datastore empty.

### Proxmocks cluster quorum

A Proxmocks cluster of two or more nodes holds quorum while more than half of its votes are up. Every node casts one vote, and a QDevice (a free server in the cluster's zone with no software, set with `setQdevice`) casts one more. Without quorum the cluster is read-only: creating or deleting VMs, migrating, snapshots, restores, node state changes, backup jobs and datastore attachment refuse with `error.noQuorum`, and failover is suspended. Running VMs stay up. A two-node cluster loses quorum when either node dies; a third node or a QDevice prevents that.

### Proxmocks HA groups

A Proxmocks cluster holds up to eight HA groups, each a set of nodes with priorities (`saveHaGroup`). A VM in a group (`setHaGroup`) fails over to the highest priority node with room; a restricted group never starts the VM outside its nodes, so it stays down when they are all unavailable. When a better node is available again the VM moves back after one hour, with the downtime of a cold move when it cannot move live, unless the group is set to Nofailback. Changes need quorum.

### Horizont projects and quotas

An OpenStash cluster starts with one unlimited project, admin. Projects (`saveProject`, up to ten) carry a quota on instances, vCPU, RAM, volume storage and floating IPs; an empty limit is no limit. Creating or resizing an instance, creating a volume and allocating a floating IP refuse with `error.quotaExceeded` when the project would pass a limit. A project can be tied to a customer, moves instances with `setInstanceProject` when the target has room, and is deleted only when empty.

### Storage replication and Ceph

A VM of a Proxmocks cluster (from the year of its cluster support) can replicate its disk to another active node with `setReplication`: every 15 minutes, hourly or daily (03:00 UTC). The replica books the VM's disk on the target node and each copy sends `BACKUP_CHANGED` of the filled disk over the LAN. When the VM's node dies with its data (`lostDisk`), failover restarts the VM on the replica node and closes the loss with the data written since the last copy lost (the lag since `lastAt` plus half an interval). A disk on shared storage or a Ceph pool takes no replica.

A cluster of three or more Proxmocks nodes can build a Ceph pool with `setCeph` (size 2 or 3). Its capacity is the usable disk of all nodes divided by the size, and it must hold the disks of the cluster's VMs. Every node down costs one copy: at one copy the pool is read-only (mutating actions refuse with `error.cephReadOnly`). VMs on the pool fail over like VMs on a datastore, also when the dead node lost its data. After a node returns the pool rebalances for `diskUsed / (Gbit * LAN_GB_PER_HOUR)` hours, with a warning alarm.

### Per-VM firewall

An own VM on a Proxmocks cluster can switch its firewall on and tick the port macros it lets through (web, ssh, mail, db, rdp); every other port is dropped. A host in that VM serves its own ports (a panel serves web, a mail host serves mail): blocking one takes the service offline until the macro is ticked again. When the firewall closes a port the host's software listens on but does not serve (SSH, for instance), the hourly and daily compromise chances are halved (`FIREWALL_RISK`). A VM without a firewall behaves as before. The firewall costs no money.

### HyperVee replica and virtual switches

A HyperVee VM from 2012 can replicate to a second host: another node of its cluster, or a node of another HyperVee cluster in the same zone. The frequency is 30 seconds, 5 minutes or 15 minutes. The sim copies on the hour for all three; the shorter intervals send 4 and 2 times the changed data of the 15 minute one and lose less on a takeover (half an interval of writes plus the time since the last copy). The replica books the VM disk on the second host.

Failover is a player action, since HyperVee has no automatic recovery before its cluster year. With a healthy primary the roles swap, nothing is lost and the VM is down for an hour. With a dead primary the VM starts on the replica host, writes since the last copy are lost and the replica is dropped. Replication Health reads Normal up to 2 hours since the last copy, Warning up to 12 hours, then Critical.

A HyperVee cluster has virtual switches, up to 8, starting with one external Default Switch. A VM on an internal or private switch has no uplink and is offline. A VM on an external switch bound to a host port is offline while that port is unplugged or its far end is dead; a switch bound to no port follows whichever port is connected. Deleting a switch moves its VMs back to the default.

### OpenVeeZee beancounters, burst and checkpoint

A container shows its beancounters: kmemsize, privvmpages, oomguarpages, numproc and numtcpsock with held, maxheld, barrier, limit and failcnt. Memory is in 4 KB pages. Failcnt is stored on the container for privvmpages and numproc; the rest is derived from its use.

Each hour a node with more than 90% of its RAM in use takes burst memory back first: only containers with a burst allowance collect privvmpages failcnt. A node out of RAM makes every container fail privvmpages; busy vCPUs past the cores slow the node but never touch the beancounters. The increment is 40 times the container's share of the node RAM, at least 1, per hour. Six hours in a row slow the site like any other slowdown. Each hour a node out of RAM has the OOM killer stop one container for an hour, the one furthest past its barrier, else the largest. It frees its RAM, shows "OOM killed" in the console, and the hour counts as downtime. The player fixes it by raising the container's size, moving it or selling less of the node.

Burst memory ranges from 0 to twice the container's RAM, in steps of a quarter GB. It is not booked and costs nothing.

Checkpoint freezes a container: it stays on its node, holds no CPU or RAM and is offline. A container is created from an OS template the player has downloaded and runs its OS at once, without an installer or ISO. Restore resumes it within a minute plus two seconds per GB of RAM in use, which counts as downtime. A cold move of a container on OpenVeeZee is a checkpoint, a copy and a restore, so it is down only for the copy of its disk over the link (at least 1 minute) instead of a full boot.

### Snapshots

A snapshot freezes a VM's disk on a VMwhere cluster and, for the player's own VMs, its installed OS and software. Values live in `src/sim/10-catalog/platforms.ts`.

| Value | Amount |
| --- | --- |
| Snapshots per VM | Up to 3 |
| Taking one | Instant, no downtime; not on a lost or corrupted disk or while the VM is busy |
| Delta growth | 5% of the VM's disk a day, counted hourly, up to the whole disk |
| Revert | Instant, the VM restarts for 10 minutes; newer snapshots are gone and the reverted one starts an empty delta |
| Delete | Instant, frees the delta |

- **Booking.** Deltas book disk on the VM's storage: its datastore, or its node for a local disk. They grow past the storage's room, since room is only checked at placement, and move with the disk.
- **Revert** clears the corruption of a pulled plug when the snapshot is older than the corruption, and closes the loss report item as a restore from backup would. An own VM gets its OS and software back as they were; a VM that hosts a panel needs that panel in the snapshot.
- **Loss.** A disk lost with its server or datastore loses its snapshots, and a lost disk cannot revert. A VM that leaves VMwhere loses its snapshots.

### Backup jobs and restore points

A cluster has up to 4 backup jobs. Each job copies a set of its workloads (all by default) to a backup cluster at its hour (02:00 by default), daily or weekly on Sundays, and writes one restore point per workload.

| Value | Amount |
| --- | --- |
| Default retention | keep last 3, weekly 0 |
| Retention range | last 1 to 14, weekly 0 to 8 |
| First point of a job | a full copy: the disk size times the fill |
| Later points | an increment of 10% of the full copy |
| Pruning | the newest `last` points stay, plus the newest point of each of `weekly` older weeks; the oldest point kept becomes the full copy |
| Repository use | the sum of all restore points written to the cluster; the old flat 1.3 pool factor is gone |
| Full repository | the run stops, the job is marked failed with reason full and the failure alert goes out |
| Target not reachable | the run fails with reason unreachable |
| Restore | uses the newest point, so the age penalty in Data loss and backups is unchanged |

Restore tests, offsite copies and alerts:

| Value | Amount |
| --- | --- |
| Bad point | 1% of new points are bad, drawn from the game seed; a point that took the internet path to an offsite repository is bad with 3% |
| Restore test | reads the point back at the restore speed (volume size divided by the link) and leaves the workload running; the point then shows as verified or bad |
| Restoring an untested bad point | takes the full restore time, then the workload comes back empty and the customer takes the no-backup hit |
| Tested bad point | is no backup: the restore reads the point before it |
| Offsite copy | Sundays three hours after the job's hour; the newest point goes to a backup cluster in another zone at 45 GB per hour; both repositories hold it |
| Failure alert | one per job per day, only when the job sends notifications |
| Backup elsewhere | a backup survives its repository cluster losing every server only through an offsite copy |

A save from before jobs turns its single schedule into one job named Backup and gives each backed-up workload one point.

### Templates

A template is a stopped own VM on a VMwhere cluster kept to clone ready VMs from. Actions live in `src/sim/90-actions/templates.ts`.

| Value | Amount |
| --- | --- |
| Making a template | Instant; the VM must be stopped, not busy, with no install running and nothing hosted inside it |
| Turning it back | Instant, into a stopped VM |
| Clone time | Disk ÷ (Gbit × 450 GB/h) of the template's storage, at least 1 hour: its datastore's speed, else its node's fastest port |
| Clone result | A new own VM with the template's size, OS and software, on the host picked or the one the scheduler picks |
| Clone cost | The once licences a fresh install of its OS and software would buy |

- **Templates** keep their disk booking, OS, software and snapshots. They never start, cannot be migrated, are not balanced, and failover leaves them on a dead node.
- **Clones** put their disk where a new VM's goes, a datastore with room first. They are busy for the copy; each software they carry runs as its own cluster once the copy is done. A template running mail cannot be cloned.

### VMwhere editions, DRS and pools

A new VMwhere cluster starts on Essentials; a cluster from an older save is on Enterprise. Moving up an edition costs the VMwhere licence fee per node times the step in levels (Essentials 1, Standard 2, Enterprise 4), paid once.

| Edition | Adds |
| --- | --- |
| Essentials | Live migration, snapshots, datastores |
| Standard | High availability failover, alarm thresholds, manual DRS |
| Enterprise | Partially and fully automated DRS, resource pools |

DRS Manual and Partial keep up to five recommended moves for the player to apply, Full applies them. A host enters maintenance mode only when every running VM can move live. A pool caps the booked vCPUs and RAM of its members. On a hot node a high pool keeps its performance and a low pool keeps 90% of the node's performance.


### Horizont floating IPs, security groups and volumes

A floating IP is one more address rented from the datacenter of an OpenStash cluster, billed like any rented address. It points at one instance, or at none. A service on a floating IP keeps its address when it moves to another location, so no renumbering happens and no customer is told to change DNS. An address that is not floating is renumbered as before.

An instance has security groups. A new instance joins the default group, which lets only SSH through. The groups of an instance add up, and a port outside them is dropped, so a panel or mail host in a default-only instance is offline until a group lets its web or mail port through; a group that closes a port the software listens on but does not serve halves the breach chance, like the Proxmocks firewall. A project has up to 10 groups; the default group stays and a group in use cannot be deleted.

A volume is 1 to 1000 GB of block storage that counts toward the capacity of the first working datastore with room, or sits on a node disk when the cluster has no datastore. It costs nothing extra. It survives deleting the instance it is attached to and is detached afterwards. Before 2012 a volume leaves only a stopped instance.

### IPMI System Event Log

Each server's management controller keeps its last 20 events, each with a severity (information, warning or critical) and a number. Failed parts and shutdowns from heat are critical; lost power, a stalled operating system or controller, a lost power supply input, a lockout and an inlet temperature of 35 degrees or more are warnings. The inlet temperature is checked every hour, and a crossing of 35 or 40 degrees is logged once, with a note when it returns below 35. A change of a cluster node's state (active, cordoned, draining, maintenance) is logged on its server. The player can clear the log.
