# Clustering removal: handoff

This note records what was removed from the game on 2026-10-30, where each function went, and what was left alone so the hypervisor clustering feature can be built on top later.

## Goal

At the start of the game nothing is a cluster. A server runs its software, and the player manages it in that software's web console in the Browser. Clustering comes back later as a feature of hypervisor software only: joining servers in the hypervisor's console, then high availability, automatic relocation and anti-affinity for customers with several VMs, sold as an extended licence and supported by some hypervisors only.

## What was done

### Removed apps

- The Products app is deleted (`src/ui/apps/products/ProductsApp.tsx`, `PanelHosts.tsx`). Its store item and window size are gone, and the Product management skill no longer opens an app.
- The Virtual machines app is deleted (`src/ui/apps/vms/VmApp.tsx`). Its store item, the "Needs hypervisor" store state and the `error.needsHypervisor` blocker are gone.
- Old saves drop both ids from `installed` in `deserialize`.

### Where each function went

| Function | Before | Now |
| --- | --- | --- |
| Pricing (rates per unit, setup fees) | Products, Pricing | Marketing, Pricing section, open with Product management (`src/ui/apps/marketing/Rates.tsx`) |
| Incident reports of lost data | Products, Incidents | Security, Incidents tab; the open count is the Security dock badge |
| Product lines overview | Products, Product lines | Removed |
| Start, stop, restore, migrate, resize, console, delete VM | Virtual machines | Web console, objects tab (already there) |
| New VM, new software VM, new panel VM | Virtual machines, Products | Web console of the hypervisor, objects tab (already there) |
| Backup schedule and target | Products, cluster detail | Web console, Software tab, for software with backups |
| PHP upgrade and patch | Products, panel host detail | Web console, Software tab; also still in Locations and Security |
| Sites offline and clean-up menu | Products, panel host detail | Security (`sitesMenu` lives in `SecurityApp.tsx`); sites offline also in the web console |
| Remove host, resize panel VM | Products, panel host detail | Web console, Software tab (already there) |
| Memory reservation toggle | Locations, Clusters tab | Locations, server card in the inspector |
| "Open in Virtual machines" on workloads and services | Locations, Customers | "Open web console", which opens the console at the machine's private address (`consoleEntry` in `src/ui/apps/products/parts.tsx`) |
| "Open Basement 1" on a server | Locations device menu | "Open web console" |
| Search hit for one of the player's VMs | Virtual machines | Locations, on the server the VM runs on |
| Notifications for installs, migrations, backups and failover | Products, Virtual machines | Locations |

`workloadActions` moved from `VmApp.tsx` to `src/ui/apps/vms/migrate.ts`.

### Removed cluster surfaces

- Locations has no Clusters tab. The server card in the inspector shows the software name instead of the cluster name.
- The "Join cluster" device menu entry and the add-node buttons are gone. Nothing in the UI joins two servers any more.
- Placement (pack or spread), the cluster maintenance windows and the cluster capacity card were only in the removed views.

### Sim changes

- `installHypervisor` names the cluster after the server, like `installPanel`, instead of `<Location> 1`.
- Events that named the Products or Virtual machines app now name Locations.

## What was not touched

The cluster model in the simulation is unchanged, because the hypervisor and VM work runs in parallel. Internally every installed software is still a `Cluster` (`src/sim/60-infra/cluster.ts`) with one node per server. A server now belongs to one cluster per software it runs, so a panel next to a hypervisor is a second cluster on the same node (software.md, section 3). These pieces still exist in the sim and in tests, but no longer have a UI:

- `addNode`, `joinableServers`, `joinableClusters`: joining servers into one cluster.
- `setHa` and the `Ha` flags (live migration, balancing, failover), `ha.ts`.
- `setCompatMode`, `setPlacement`, `moveControlPlane`.
- Cluster maintenance windows (`target.kind === "cluster"`).
- `licenseCost` and the licence display.

Still reachable in the UI, because old saves can hold multi-node clusters or because they act on one server:

- "Remove from cluster" in the device menu, shown only for clusters with more than one node.
- Cordon, uncordon and drain in the device menu.
- The Nodes tab of a hypervisor console for software with `cluster` support.

Other leftovers:

- `src/ui/apps/products/parts.tsx` and `products.css` stay in the old folder, because consoles, Locations, Customers and Network import from them.
- The `Product management` skill keeps its id `products`; Provisioning automation and High availability still need it.
- `docs/design/gdd.md`, `economy.md` and `research.md` still describe the Products and Virtual machines apps.

## Next: hypervisor clustering

1. Decide which hypervisors support clustering and from which year (`Software.cluster` already exists in the catalog).
2. Add a cluster licence or upgrade in the software licence model.
3. In the hypervisor console, join servers that run the same hypervisor (reuse `addNode` and `joinableServers`).
4. Move HA, placement, compatibility mode and control plane moves into that console.
5. Add anti-affinity for customers with several VMs, so one server outage does not take all of them down.
