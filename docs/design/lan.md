# Local networks

Today every machine gets a private address computed from its id (`privateIp` in `src/sim/60-infra/addresses.ts`), switches forward between all their ports, and a port group is a button in the inspector. This plan makes the local network something the player builds and runs: a router they mount in the rack and log into, DHCP that hands out leases, static addresses typed into the installer or set with `ip` on a running server, per-location address plans, and managed switches with their own web interfaces next to cheap unmanaged ones that have none.

The business layer stays as it is: uplinks, transit, peering, DDoS, public addresses and billing (gdd.md, Network and DDoS; Addresses and internet). This plan sits below it, between the cables and "this server is online".

## What the player does

**The first evening.** A new game starts with an empty 24U rack, a line jack on the carrier panel, and a Fritz!Bocks 5050 in the basement's storage, the router the flat came with. The player mounts it on a shelf in the rack (1U), cables its DSL port to the line jack and a server to one of its four LAN ports. The desk reaches the router over Wi-Fi, so it takes no port. Without a router nothing in the basement reaches the internet, whatever line is booked.

**Finding the server.** The server installs with DHCP, the default in the installer, and gets a lease from the router. The inspector shows the server's MAC address and no private address. To reach the server's panel or `ssh` into it, the player opens `http://fritz.bocks` (printed on the router's label in the inspector, with its password), logs in, and reads the address under Home network, Devices. The 5050 runs a firmware from 2004 that registers no names, so `ssh node001` fails with `Could not resolve hostname` until the player uses the address or buys a Fritz!Bocks 7390, which registers DHCP names as `node001.fritz.bocks`.

**Fixing an address.** A server that holds a cluster, a panel with customer sites, or a switch's management port wants an address that never moves. The player has three ways to get one:

1. A reservation in the router's DHCP (Fritz!OZ: "Always assign this network device the same IPv4 address").
2. A static address in the Debiant installer's "Configure the network" step: address, netmask, gateway, name server.
3. A static address on a running server, in `/etc/network/interfaces` followed by `/etc/init.d/networking restart` (or `systemctl restart networking` from Debiant 8), or with `ip addr add` and `ip route add default via`, which last until the next reboot.

**Picking a range.** Each router's LAN is the location's address plan. The Fritz!Bocks ships with 192.168.178.0/24, gateway .1, pool .20 to .200. The player changes it in the router's IPv4 settings. A changed range takes effect for DHCP clients at their next renewal; every static address in the old range keeps its old address and loses the gateway, which is the outage a real renumbering causes.

**Switches.** An unmanaged switch (D-Lunk, Nettgear without a T) has no address and no settings; it forwards between all its ports. A managed switch takes a DHCP lease on its management interface like any other device, so the player finds it in the router's device list by its model name and MAC, then opens its web interface in the Browser. Port groups move out of the inspector into that interface, next to VLANs, port settings and the configuration save. A managed switch that gets no lease falls back to its factory address (Sysko 192.168.1.254), which the desk cannot reach from 192.168.178.x; the way back is the console cable (`rollover`, already in the game) or a desk address in that range.

## Simulation

### Where the truth lives

Every address fact is stored on the device that holds it, and every view (inspector, Network app, router device list, `ip a`) is derived from those devices. There is no separate address plan to keep in sync.

| Device | New state | Default |
| --- | --- | --- |
| Router (gateway kind) | `lan: { cidr, gateway, pool: [from, to], leaseHours, dns: boolean }`, `reservations: { mac, ip }[]`, `leases: { mac, ip, until, name }[]`, `shares: { ip, kind: "web" \| "exposed" }[]` | Fritz!Bocks: 192.168.178.0/24, .1, .20 to .200, 240 hours. Datacenter handoff: the location's 10.n.0.0/24, fixed. |
| Server, BMC, KVM, switch management | `iface: { mode: "dhcp" \| "static", ip?, prefix?, gw?, dns? }` persistent, plus `runtime?: same` set by `ip` and cleared on boot | `dhcp` |
| Managed switch | `vlans: Record<port, { untagged: number, tagged: number[] }>`, `running` and `saved` copies of `groups` and `vlans` | Every port untagged in VLAN 1 |

MAC addresses are computed from the device id and the port (`macOf(id, port)`), never stored; the vendor prefix follows the brand, so a Dwell NIC and a Sysko switch look different in the device list.

Leases are the one piece of state the tick moves: a DHCP client renews at half its lease time while it is on and has a path to the server; a lease past `until` frees its address. The pool hands out the lowest free address, and a known MAC gets its old address back while its lease lives. So a server that is off for longer than the lease, or a replaced router (a bought Fritz!Bocks keeps the old one's settings but none of its leases), shuffles addresses, and anything that held on to the old address breaks.

### The derived layer

A new `src/sim/60-infra/lan.ts` answers four questions, memoised per tick the way `linkStatus` is:

- `segmentOf(s, end)`: the broadcast domain an end sits in. A breadth-first walk over cables, as `reachesGateway` does today, that passes through unmanaged switches on every port and through managed switches only between ports that share the frame's VLAN (untagged on one side, tagged or untagged on the other). Patch panels and the line jack pass through.
- `addressOf(s, deviceId)`: the address the device actually holds: runtime, then static, then a live lease; null without one. Windoors without a lease takes 169.254.x.x, Debiant takes nothing.
- `conflicts(s, segment)`: two holders of one address in a segment. Both answer at random, which the player sees as packet loss in `ping` and a flapping site.
- `gatewayOf(s, deviceId)`: the router whose LAN the device is in, reached in its segment, with the device's address inside that LAN and its gateway set to the router's address.

`computeLinkStatus` in `status.ts` keeps its cable check and adds one rule: a server is online only when `gatewayOf` finds its router. That one choke point carries the change to everything that reads `linkStatus`: `clusterReachable`, `lineOffered`, `serviceOnline` through the workloads, the checklist's `onlineServers`, and the saturation and traffic paths in `network.ts`. A wrong gateway, an address outside the range, an expired lease and an address conflict all show up as the same outage the game already prices.

`privateIp`, `ipmiIp` and `oobIp` go, and their twelve callers ask `addressOf` instead (`terminal.ts` `resolveTarget`, `browser.ts` IP branch, `index.ts` console rows, `apt.ts`, `ui/search/hits.ts`, `products/parts.tsx`, `HypervisorBase.tsx`, `network/Addresses.tsx`, and their tests). A device with no address is not found by address, which is the point.

Clusters gain one rule: a node is a member at the address it joined with. A node whose address changes (a DHCP shuffle, a typo in `interfaces`) drops out of its cluster, and the cluster's console shows it as unreachable until the address is back or the node is re-added. This is the reason players will learn to reserve or fix addresses on cluster nodes, and the tutorial does not need to explain it.

### Routers in the rack

Gateways of the small-office line (`home-router`, the Fritz!Bocks models) change from height 0 on the carrier panel to height 1 in a rack, drawn as a box on a shelf. The carrier panel keeps a new provider device, `line-jack`, 0U, one port with the media `dsl`; the router's WAN port has the same media, so nothing else can be cabled to the jack (`connectError` already refuses a media mismatch). `lineUp` moves from the panel to the router: a router passes traffic when its WAN port reaches a jack and the location's line is active. The datacenter `handoff` stays on the panel as today and becomes a DHCP server with a fixed range, so a datacenter server installed with DHCP works the day it is cabled, and a static address there is optional.

`home-router` becomes the Fritz!Bocks 5050: price 0, not sold, the numbers of today's home router. The other Fritz!Bocks models keep their prices, and `isOfficeRouter` keys on the AVN brand instead of height 0. Installing a bought one from storage still swaps it with the mounted one and keeps the cables on the same ports (`Storage.tsx`, gdd.md Routers), now with the LAN settings copied and the leases dropped.

### Port shares

A basement machine that serves the internet through the line's shared address needs a port share on the router, as on a real Fritz!Bocks. Today `hasPublicAddress` in `addresses.ts` counts every basement machine as reachable while a line is live; it changes to count a machine on the shared address only when the router has a share to it. Machines that hold an address of their own (from a business line's /29, or in a datacenter) need no share, since the router routes those addresses without translating them.

Fritz!OZ lists shares under Internet, Permit access. A share names a device and one of two kinds:

| Share | Ports | Effect |
| --- | --- | --- |
| Web server | TCP 80 and 443 | The device can sell and serve web hosting on the shared address |
| Exposed host | Everything | The same, and the device counts as an exposed instance in the Security app with its open vulnerabilities |

A port goes to one device. A second Web server share on the same router is refused with Fritz!OZ's own message ("Port 80 is already shared with node001"), so a dynamic line carries one web host. A second web host in the basement needs the business line, whose /29 gives it an address of its own, or the panel's sites moved onto the first host. This fits the existing rule that a dynamic line sells only web hosting, and it makes the business line's static addresses worth what they cost.

Creating a share ticks "Always assign this network device the same IPv4 address" for its device, as Fritz!OS does, so a share survives lease expiry. The share points at the device's address, though: a device later switched to a static address outside the reservation, or a router swapped for a new one (which copies shares but drops leases and reservations), leaves the share pointing at nothing, and the sites behind it go dark until the share is fixed.

`hasPublicAddress` feeds `clusterReachable` and `lineOffered` in `cluster.ts`, so a missing share both stops new web hosting sales and takes the running sites on that machine offline, with the outage penalty the game already applies. A VM gets its share to its own LAN address, the same as a server.

### Unmanaged and managed switches

`DeviceModel` gets `managed: boolean`. Every switch in the catalog today is managed (the Nettgear GS108T line is a smart switch in reality too). New unmanaged models, all without SFP, port groups, VLANs or a management address:

| Model | Ports | Year | Price |
| --- | --- | --- | --- |
| D-Lunk DES-1008D | 8 × 100M, desktop | 2005 | €25 |
| Nettgear GS108 | 8 × 1G, desktop | 2005 | €75 |
| D-Lunk DGS-1024D | 24 × 1G, 1U | 2006 | €180 |
| Nettgear GS116 | 16 × 1G, desktop | 2008 | €110 |

Desktop switches sit on a shelf like the Fritz!Bocks. Prices go into economy.md, Hardware, power and failures, with a check in `npm run balance` that the basement's first switch is still affordable in month two.

`setPortGroup` is refused on an unmanaged switch, and a server bonded for load balance behind one falls back to one port with the warning it shows today. Port groups and VLANs are set through the switch's web interface, which calls the same actions; the inspector keeps the read-only port list and loses its group editor (`Inspector.tsx:478`).

`LOCKOUT_CHANCE` stays for group changes. A VLAN change gets a deterministic lockout on top: moving the port the desk reaches the switch through out of the management VLAN locks the player out at once, as on a real switch. Recovery is the existing console path.

Running and saved configuration: changes apply at once to `running`; Save copies it to `saved`. A reboot (firmware update, power loss, a failed power supply) loads `saved`, so an unsaved VLAN plan disappears on the first power cut. Fritz!OZ and the unmanaged gear save on every change.

## Shell

`terminal.ts` gets these commands on a Lunix server, all reading and writing through `lan.ts` and a new `src/sim/90-actions/lan.ts`:

| Command | Effect |
| --- | --- |
| `ip a`, `ip addr show` | Interfaces with MAC, state and addresses, in iproute2's layout |
| `ip addr add <ip>/<prefix> dev <if>`, `ip addr del` | Sets or clears the runtime address |
| `ip route`, `ip route add default via <gw>` | Shows or sets the runtime gateway |
| `ip link set <if> up\|down` | Brings the interface up or down |
| `ifconfig` | The same facts in net-tools' layout, since a 2005 admin types it |
| `dhclient <if>` | Renews the lease now and prints the DHCPDISCOVER to DHCPACK lines, or `No DHCPOFFERS received.` |
| `ifup`, `ifdown`, `/etc/init.d/networking restart`, `systemctl restart networking` | Applies `/etc/network/interfaces` |

Interfaces are `eth0` and `eth1`, `enp1s0f0` and `enp1s0f1` from Debiant 9, and `bond0` over both when the server is bonded. `/etc/network/interfaces` and `/etc/resolv.conf` join the generated base tree in `shell.ts`: the file is written from `iface` and parsed back when networking restarts; a line the parser cannot read fails the restart with ifupdown's error and leaves the old setting, so a typo costs a retry, never a broken save. Edits to the file go through `editFiles` as today and change nothing until the restart.

The desk keeps `ping`, `traceroute` and `ssh`, now resolved through `addressOf` and the router's DNS. The desk itself holds the router's first pool address over Wi-Fi.

## Installer

The Debiant installer's hostname step (`installer.tsx:106`) becomes "Configure the network": the hostname, then "Auto-configure networking with DHCP?" Yes runs DHCP and shows the address it got, or "Network autoconfiguration failed" (`error.noAutoconf`, already there) with the choice to retry, configure by hand, or continue without a network. By hand asks for the address, netmask, gateway and name server, as the real installer does. `installOs` takes the chosen `iface` and stores it with the OS. Windoors Setup has no network step; its Server Manager gets a Network adapter page with the same choice.

## Management interfaces in the Browser

`browser.ts` gets two page kinds, `router` and `switch`, resolved by the device's current address and, for the Fritz!Bocks, by `fritz.bocks`. They are never listed in yahoy.com (`index.ts` `siteIndex` leaves them out, as it leaves out the IPMI and KVM pages). The IP branch in `resolve` gains the reach check it lacks today: a management page loads only when the desk reaches the address (`pathTo` from the desk's segment), otherwise the browser shows its timeout page. That check applies to the IPMI and KVM pages too.

Each managed device's inspector gets a Management link that opens its address in the Browser while it has one. The router's label card shows its default address and password, as the sticker on the bottom of a real one does. The login form takes that password; changing it is an open point below.

| Real interface | Parody | Device | Phase |
| --- | --- | --- | --- |
| FRITZ!OS | Fritz!OZ at fritz.bocks | AVN Fritz!Bocks | 1 |
| Cisco small business web UI | Sysko Device Mangler | Sysko Catalust | 3 |
| HP ProCurve web agent | ProSwerve | Hewlett-Packet switches | 3 |
| Netgear ProSafe web UI | ProSafe-ish | Nettgear GS108T line | 3 |
| MikroTik WebFig | WebFigg | MicroTick routers and switches | 4 |
| Juniper J-Web | J-Webb | Junipurr | 4 |

The switch interfaces share one component tree (`src/ui/apps/browser/mgmt/Switch.tsx`: System, Ports, Port groups, VLANs, Save) with a theme per brand in CSS, the way the hypervisor consoles share `HypervisorBase.tsx`. Fritz!OZ is its own page (`mgmt/FritzOz.tsx`): Overview, Home network with Devices and the IPv4 settings, DHCP with reservations, System with firmware. The brand names above are proposals.

## Tutorial and first hour

`checklist.ts` `TUTORIAL` gains `mountRouter` (the router is mounted and its WAN port reaches the line jack) between `mountServer` and `internet`, `findAddress` (the player opened the router's device list with the first server in it) before `website`, and `shareWeb` (the web host has a Web server share, or holds an address of its own) right after `setup`. `shareWeb` ticks by itself on a business line, so only dynamic-line players see it. The guide routes `mountRouter` to Locations with the router selected in storage, and `findAddress` and `shareWeb` to the Browser at `fritz.bocks`. first-hour.md changes its Minute 0 line (the router is in storage, not beside the rack), the Getting started table (one more row, no cost), and the beat sheet row "cabled to the router". `tests/checklist.test.ts` and `tests/first-server.test.ts` follow.

A player who installs with DHCP and keeps the defaults never has to touch an address to reach the first customer; the router login, and on a dynamic line the web share, are the new required steps, and every later network skill is a fix for a problem the game creates on its own (a shuffled cluster, a full pool, a VLAN that needs a managed switch).

## Saves

`SAVE_VERSION` stays 3; `deserialize` fills the defaults as it does for every field. Every server, BMC and managed switch gets `iface: dhcp`, every router its model's default LAN with no leases, every managed switch VLAN 1 everywhere with `saved` equal to `running`. A basement router on the carrier panel moves into the first free U of the basement rack, or into storage when the rack is full, and a `line-jack` with a cable to the router's WAN port is added. The first tick hands out leases, so a loaded game is online again within its first minutes. Old private addresses are not kept.

## What it touches

| Area | Files |
| --- | --- |
| Catalog | `10-catalog/hardware.ts` (`managed`, unmanaged models, router height, `line-jack`, Fritz!Bocks 5050, `isOfficeRouter`), `10-catalog/economy.ts` if the start cash moves |
| State | `50-state.ts` (`Device` fields, `newGame` with the router in storage and the jack on the panel) |
| Derived | new `60-infra/lan.ts`; `status.ts` (`computeLinkStatus`, `lineUp`, `reachesGateway` replaced by `segmentOf`); `addresses.ts` (`privateIp`, `ipmiIp`, `oobIp` removed, `hasPublicAddress` on port shares); `oob.ts` (`machineNet` reads the lease; lockout by VLAN); `cluster.ts` (member address); `terminal.ts`, `shell.ts` |
| Actions | new `90-actions/lan.ts` (`setIface`, `setRuntimeIface`, `setRouterLan`, `reserveAddress`, `setPortShare`, `setPortVlan`, `saveSwitchConfig`); `hardware.ts` (`setPortGroup` refused on unmanaged switches, router swap); `console.ts` (`installOs` with `iface`) |
| Tick | `88-tick/tick.ts` calls `leaseTick` before `networkTick` |
| Save | `91-save/save.ts` defaults and the router move |
| Browser | `80-business/browser.ts` (page kinds, `fritz.bocks`, reach check), `80-business/index.ts`, `ui/apps/browser/mgmt/` |
| UI | `locations/Inspector.tsx` (MAC, label card, Management link, group editor removed), `art/fronts.tsx` (shelf devices), `console/installer.tsx`, the Windoors Server Manager page, `network/Addresses.tsx` (public addresses only) |
| Text | new `src/i18n/lan.ts` and `ui-browser-mgmt.ts` with the same files in de, es, fr, it, pt; `terminal.ts` and `console.ts` keys |
| Guide | `checklist.ts`, `ui/apps/guide.ts`, docs/design/first-hour.md, gdd.md (Racks, Addresses), economy.md (switch prices) |
| Tests | new `tests/lan.test.ts` (leases, renewal, shuffle on expiry and router swap, reservations, conflicts, wrong gateway, renumbering), `tests/port-share.test.ts` (web hosting gated on a share on a dynamic line, one Web server share per router, no share needed for an own address, a stale share after a router swap, an exposed host in the Security list), `tests/lan-shell.test.ts` (`ip`, `ifconfig`, `dhclient`, interfaces file, runtime lost on reboot), `tests/switch-web.test.ts` (VLAN segments, groups through the interface, deterministic lockout, unsaved config lost on reboot), `tests/router-rack.test.ts` (offline without a mounted router, jack media, old save move); updates to `routers.test.ts`, `terminal.test.ts`, `browser-resolve.test.ts`, `install-network.test.ts`, `addresses.test.ts`, `checklist.test.ts`, `first-server.test.ts`, `save.test.ts` |

## Phases

1. **Router and DHCP.** Router in the rack with the line jack, the Fritz!Bocks 5050 at start, `lan.ts` with leases and `addressOf` for servers, `computeLinkStatus` on `gatewayOf`, `privateIp` and friends replaced, Fritz!OZ with devices, IPv4 settings, reservations and port shares, `hasPublicAddress` on the shares, the reach check in the Browser, the label card and the three guide steps. Every machine stays on DHCP; the game plays as today plus the router and, on a dynamic line, one web host per basement.
2. **Static addresses.** The installer's network step, `iface` static, the shell commands and `/etc/network/interfaces`, conflicts, cluster member addresses, the Windoors adapter page.
3. **Switches.** `managed`, the unmanaged models, management addresses by DHCP with the factory fallback, VLAN-aware `segmentOf`, the switch web interfaces for Sysko, Hewlett-Packet and Nettgear, port groups moved out of the inspector, running and saved configuration.
4. **Datacenters.** Own routers in a datacenter behind the handoff (MicroTick and Junipurr interfaces), routing between VLANs on layer 3 switches, VMs bridged onto the location's LAN and drawing from its pool, and the private networks customers ask for in gdd.md as VLANs on these switches.

Phase 1 shipped as planned with these differences. Every gateway serves DHCP, so datacenter edge routers and the handoff keep their machines online; outside the basement the network is the location's 10.n.0.0/16 rather than a /24. Leases are granted at once and stored by the hourly tick, which renews them at half the lease time and drops expired ones. A VM is reached through its host's share and keeps its address from `machineAddress` until phase 4 bridges it onto the LAN. Exposed host works the same as Web server; its Security app entry is left for later. The 7390's DNS names and the failing `ssh node001` are left for phase 2, so names resolve as before. The firmware page only shows the version. A router swapped out goes to storage, and a rack moved to a datacenter leaves its router behind. The tutorial runs setup, findAddress, shareWeb, then website. The Fritz!OZ refusal for a second share names no device.

Phase 1 changes the most callers and goes first; 2 and 3 both build on `lan.ts` and touch different files, so they can run side by side once 1 is merged. Each phase lands green with its tests, and its changelog bullet waits for the release.

## Open points

- **Reaching datacenter LANs from the desk.** The desk sits in the basement LAN. Today it reaches datacenter servers as if they were next door; a stricter rule (on site, a VPN, or a link between zones) belongs with phase 4.
- **Late game friction.** Reading leases off a router does not scale to three hundred servers. The likely answer is an IPAM page in the Network app that lists static addresses and reservations across locations, as a research unlock.
- **Passwords.** Whether the player can change the router and switch passwords, and whether a device left on its default password counts as an exposed instance in the Security app.
- **Bonding in the shell.** Bond mode is still an inspector setting; it could move into `/etc/network/interfaces` the way port groups move into the switch.
- **Loops.** Two cables between unmanaged switches cause a broadcast storm in reality, and managed switches run spanning tree. It is a good trap and is left out until the rest plays well.
- **IPv6.** Router advertisements and SLAAC from 2013 on home lines are flavour for `ip a` until a product needs them.
