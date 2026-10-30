# VMwhere: datastores, snapshots and templates

Addendum to `shop.md` section 6. It covers the three top vSphere gaps for VMwhere vSphear: shared datastores, VM snapshots, and templates with cloning. The numbers move into `economy.md` once built.

## 1. Shared datastores

A datastore is a server the player attaches to a VMwhere cluster as shared storage. Any server with drives qualifies: the Storage 2U chassis are the intended pick, so storage hardware gets a purpose. The server must sit in the cluster's zone, belong to no cluster and run no software. Attaching takes the server out of normal use; detaching needs it empty.

| Value | Amount |
| --- | --- |
| Datastore capacity | usable RAID disk times the disk overcommit (2x), same as a node |
| NFS | from 2005, free, runs at the storage server's port speed (1 Gbit before 2011, then 10) |
| iSCSI | from 2006 (software initiator in VI3), free, port speed like NFS |
| Fibre Channel SAN | from 2005, €700 per cluster node once for the host adapter, 4 Gbit from 2005, 8 from 2008, 16 from 2011 |
| Datastores per cluster | up to 4 |
| Attach time | 1 hour |

- **Placement.** A VM's disk lives either on its node (local) or on one datastore. A new VM in a cluster with a datastore that has room goes to the datastore; otherwise local, as today.
- **Live migration.** Before 2012 a VMwhere VM moves live only when its disk is on a datastore both nodes see, which is any datastore of its cluster. A local-disk VM makes a cold move as today. From 2012 (shared-nothing vMotion) local-disk VMs move live too. Other hypervisors keep today's rules.
- **High availability.** Failover restarts only VMs whose disk is on a datastore. A local-disk VM on a dead node stays down until the node works again, in every year.
- **Moving a disk** between local and a datastore (Storage vMotion): before 2007 the VM is offline for the copy, disk ÷ (Gbit × 450 GB/h), at least 1 hour; from 2007 it moves with no downtime.
- **Failure.** A datastore server that fails takes every VM on it down. Its RAID protects it as on any server; a lost datastore loses every disk on it.

## 2. Snapshots

A snapshot freezes a VM's disk and, for the player's own VMs, its installed OS and software. From 2005 (ESX redo logs; full snapshot trees from 2006).

| Value | Amount |
| --- | --- |
| Snapshots per VM | up to 3 |
| Taking one | instant, no downtime |
| Delta growth | 5% of the VM's disk per day, up to 100%, booked on the VM's storage |
| Revert | instant, the VM restarts; everything since the snapshot is gone |
| Delete | instant, frees the delta |

- **Revert** clears corruption from a pulled plug when the snapshot is older than the corruption, and returns an own VM's OS and software to their state then. A lost disk loses its snapshots with it.
- **Sprawl.** Deltas grow until deleted, so old snapshots eat datastore room.

## 3. Templates and cloning

A template is a stopped own VM marked as a template: it keeps its disk, OS and software and cannot start. From 2005 (VirtualCenter 1).

| Value | Amount |
| --- | --- |
| Making a template | instant, VM must be stopped |
| Clone time | disk ÷ (Gbit × 450 GB/h) of the template's storage, at least 1 hour |
| Clone result | a new own VM with the template's size, OS and software, on any node with room |

- **Why clone.** A fresh VM needs its OS install (1 to 2 hours) and every software install (2 to 5 hours each); a clone is ready after its copy.
- A template can turn back into a VM.

## 4. Build order

Each milestone lands on main with seeded tests, `newGame` defaults, `deserialize` fills and a CHANGELOG bullet.

1. **Datastores.** `Cluster.datastores`, `Workload.datastore`; actions `attachDatastore`, `detachDatastore`, `moveDisk`; booking, live migration and failover rules; Datastores tab in the VMwhere console becomes interactive.
2. **Snapshots.** `Workload.snapshots`; actions `takeSnapshot`, `revertSnapshot`, `deleteSnapshot`; daily delta growth; Snapshots panel on the VM.
3. **Templates.** `Workload.template`; actions `makeTemplate`, `makeVm`, `cloneTemplate`; templates list and clone button in the console.

## 5. Decisions

1. Failover is strict: a VMwhere cluster without a datastore restarts nothing on failover, old saves included.
2. Proxmocks and HyperVee get datastores and the same live-migration rule as a later task.
