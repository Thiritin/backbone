// docs/design/lan.md, The derived layer: the broadcast domain each router serves, the leases it hands out and the address
// every device holds. Every machine takes its address by DHCP; a lease is granted the moment a client is in the router's
// domain, and the hourly tick stores and renews it.
import { BMC_NAME, hasBmc, homeLan, isManaged, isManagedUps, isOfficeRouter, isOobPort, jacksOf, modelById, OOB_PORT, oobPortOf, oobPorts, type DeviceModel } from "../10-catalog/hardware";
import type { Device, End, GameState, IfaceConfig, PortShare, RouterLan } from "../50-state";
import { isOwnRouter, mountedRouter, ownLan, uplinkPort } from "./routers";
import { linkStatus, locationOf, peerOf, powered, sweepGroups, sweepMemo, working } from "./status";
import type { Workload } from "./cluster";
import { egress, ingress, MGMT_VLAN, routesTo, switchIp } from "./switches";

export type Iface = "eth" | "bmc";
export interface Grant { mac: string; ip: string; name: string; deviceId: string | null; iface: Iface }

// The host name Fritz!OZ shows for the player's own computer, which reaches the basement router over Wi-Fi.
export const DESK_NAME = "desk";
export const FRITZ_HOST = "fritz.bocks";

// Every router hands out addresses: a Fritz!Bocks its home network, the others their location's datacenter range.
export const servesDhcp = (m: DeviceModel): boolean => m.kind === "gateway";
// Fritz!OZ from the 7390 on registers the names its DHCP clients send under fritz.bocks; the older firmware registers none.
export const registersNames = (m: DeviceModel): boolean => isOfficeRouter(m) && m.from >= 2010;
export const ipNum = (ip: string): number => ip.split(".").reduce((n, x) => n * 256 + Number(x), 0);
export const ipStr = (n: number): string => [24, 16, 8, 0].map((b) => Math.floor(n / 2 ** b) % 256).join(".");
export function inNet(cidr: string, ip: string): boolean {
  const [base, bits] = cidr.split("/"), size = 2 ** (32 - Number(bits));
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && Math.floor(ipNum(ip) / size) === Math.floor(ipNum(base) / size);
}

// A datacenter's routers hand out the location's 10.n.0.0/16, n counting the locations from 1.
export function lanOf(s: GameState, d: Device): RouterLan | null {
  const m = modelById(d.model);
  if (!servesDhcp(m)) return null;
  if (d.lan) return d.lan;
  if (isOfficeRouter(m)) return homeLan();
  if (isOwnRouter(d)) return ownLan(d);
  const loc = locationOf(s, d), n = loc ? s.locations.indexOf(loc) + 1 : 0;
  return { cidr: `10.${n}.0.0/16`, gateway: `10.${n}.0.1`, pool: [`10.${n}.0.20`, `10.${n}.255.200`], leaseHours: 240, reservations: [], leases: [], shares: [] };
}

// MAC addresses follow the device and its interface; the first three bytes name the maker.
const OUI: Record<string, string> = { Dwell: "00:14:22", "Hewlett-Packet": "00:1b:78", SuperMacro: "00:25:90", Lenovoid: "00:1a:6b", Gigabutt: "00:1d:7d", Sysko: "00:1a:a1", AVN: "00:04:0e", Avoscent: "00:10:e3", OpenGearbox: "00:13:c6", Rarytan: "00:0d:5d" };
export function macOf(s: GameState, id: string, iface: Iface = "eth"): string {
  let h = 2166136261;
  for (const c of `${id}:${iface}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const oui = id === DESK_NAME ? "00:0d:93" : OUI[s.devices.find((d) => d.id === id)?.brand ?? ""] ?? "00:16:3e";
  return `${oui}:${[16, 8, 0].map((b) => ((h >>> b) & 255).toString(16).padStart(2, "0")).join(":")}`;
}

// A VM on a hypervisor cluster; web spaces and other platforms' workloads use their host's address.
export const isVm = (s: GameState, w: Workload): boolean => !!w.clusterId && s.clusters.find((c) => c.id === w.clusterId)?.kind === "cloud";
function vmsOn(s: GameState, hostId: string): Workload[] {
  const by = sweepGroups(s, "vmsOn", () => s.workloads.filter((w) => w.deviceId && isVm(s, w)), (w) => w.deviceId!);
  return by ? by.get(hostId) ?? [] : s.workloads.filter((w) => w.deviceId === hostId && isVm(s, w));
}

// The DHCP clients in a router's broadcast domain, in device order: every end its LAN ports reach through powered switches,
// firewalls, OOB switches and patch panels. The router sends untagged frames, and managed switches forward them only within
// a VLAN (switches.ts). A server asks with its NIC on an untagged port and, on standby power, its management controller;
// KVMs, console servers and OOB switches with their network jack; a managed switch with its interface in MGMT_VLAN.
const domainOf = (s: GameState, routerId: string): Set<string> => sweepMemo(s, `domain:${routerId}`, () => computeDomain(s, routerId));
function computeDomain(s: GameState, routerId: string): Set<string> {
  const router = s.devices.find((d) => d.id === routerId), rm = router && modelById(router.model);
  if (!router || !rm || !working(s, routerId)) return new Set();
  const found = new Set<string>(), seen = new Set<string>([routerId]);
  const queue: { at: End; tag: number | null }[] = rm.ports.flatMap((_, port) => {
    const at = port === uplinkPort(router) ? null : peerOf(s, { device: routerId, port });
    return at ? [{ at, tag: null }] : [];
  });
  while (queue.length) {
    const { at, tag } = queue.shift()!, d = s.devices.find((x) => x.id === at.device);
    if (!d) continue;
    const m = modelById(d.model), sw = isManaged(m) && working(s, d.id) ? d : null;
    const vlan = sw ? ingress(sw, at.port, tag) : tag;
    const key = `${m.kind === "patch" ? `${d.id}:${at.port}` : d.id}:${vlan}`;
    if (vlan === undefined || seen.has(key)) continue;
    seen.add(key);
    let exits: number[] = [];
    if (m.kind === "patch") exits = [at.port < jacksOf(m) ? at.port + jacksOf(m) : at.port - jacksOf(m)];
    else if (m.kind === "server" || m.kind === "kvm" || m.kind === "console") {
      if (vlan === null && (m.kind === "server" ? !isOobPort(at.port) : oobPortOf(m, at.port) === "net")) found.add(d.id);
    } else if (!working(s, d.id)) continue;
    else if (m.kind === "gateway") { if (vlan === null && d.id !== routerId && isOwnRouter(d) && at.port === uplinkPort(d)) found.add(d.id); }
    else if (isManagedUps(m)) { if (vlan === null) found.add(d.id); }
    else if (m.kind === "oob") { found.add(d.id); exits = oobPorts(m).map((_, i) => OOB_PORT + i); }
    else if ((m.kind === "switch" || m.kind === "firewall") && !isOobPort(at.port)) {
      exits = m.ports.map((_, i) => i);
      if (sw && vlan === MGMT_VLAN) found.add(d.id);
    }
    for (const port of exits) {
      const p = peerOf(s, { device: d.id, port });
      for (const v of p ? (sw ? routesTo(sw, vlan!) : [vlan]) : []) {
        const out = sw ? egress(sw, port, v!) : v;
        if (out !== undefined) queue.push({ at: p!, tag: out });
      }
    }
  }
  return found;
}

// The setting a server's interface runs with: what ip or ifdown set in this boot, else what its OS stores.
export function ifaceOf(d: Device): IfaceConfig & { down?: true } {
  const r = d.runtime;
  return r && r.boot === (d.bootUntil ?? null) ? r : d.iface ?? { mode: "dhcp" };
}
const isStatic = (d: Device) => ifaceOf(d).mode === "static";

// A server with a static setting asks for no lease; one whose interface is down asks for nothing.
function clients(s: GameState, routerId: string): Grant[] {
  const router = s.devices.find((d) => d.id === routerId), rm = router && modelById(router.model), found = domainOf(s, routerId);
  if (!router || !rm || !found.size) return [];
  const home = locationOf(s, router), desk = isOfficeRouter(rm) && home && mountedRouter(s, home.id)?.id === routerId;
  const out: Grant[] = desk ? [{ mac: macOf(s, DESK_NAME), ip: "", name: DESK_NAME, deviceId: null, iface: "eth" }] : [], vms: Grant[] = [];
  for (const d of s.devices) {
    if (!found.has(d.id)) continue;
    const name = d.hostname ?? d.name;
    if (working(s, d.id) && !isStatic(d) && !ifaceOf(d).down) out.push({ mac: macOf(s, d.id), ip: "", name, deviceId: d.id, iface: "eth" });
    if (modelById(d.model).kind === "server" && hasBmc(d.model, d.brand) && powered(s, d.id)) {
      out.push({ mac: macOf(s, d.id, "bmc"), ip: "", name: `${(BMC_NAME[d.brand] ?? "bmc").toLowerCase()}-${name}`, deviceId: d.id, iface: "bmc" });
    }
    // A running VM's interface is bridged onto its host's port and asks for an address of its own, after the devices, so a
    // new VM never takes an address a device was just given.
    if (working(s, d.id)) for (const w of vmsOn(s, d.id)) if (!w.stopped) vms.push({ mac: macOf(s, w.id), ip: "", name: w.hostname ?? w.id, deviceId: w.id, iface: "eth" });
  }
  return [...out, ...vms];
}

// The address each client in the domain holds, by MAC: its live lease, else its reservation, else the lowest free address
// in the pool. A client the pool has no room for gets none.
function computeGrants(s: GameState, routerId: string): Map<string, Grant> {
  const router = s.devices.find((d) => d.id === routerId), lan = router && lanOf(s, router);
  const out = new Map<string, Grant>();
  if (!lan) return out;
  const held = new Map(lan.leases.filter((l) => l.until > s.hour && inNet(lan.cidr, l.ip)).map((l) => [l.mac, l.ip]));
  const reserved = new Map(lan.reservations.filter((r) => inNet(lan.cidr, r.ip)).map((r) => [r.mac, r.ip]));
  const taken = new Set([lan.gateway, ...held.values()]), fixed = new Set(reserved.values());
  let next = ipNum(lan.pool[0]);
  const last = ipNum(lan.pool[1]);
  for (const c of clients(s, routerId)) {
    let ip = held.get(c.mac);
    if (!ip) {
      const own = reserved.get(c.mac);
      if (own && !taken.has(own)) ip = own;
      else {
        while (next <= last && (taken.has(ipStr(next)) || fixed.has(ipStr(next)))) next++;
        if (next > last) continue;
        ip = ipStr(next);
      }
      taken.add(ip);
    }
    out.set(c.mac, { ...c, ip });
  }
  return out;
}
export const grantsOf = (s: GameState, routerId: string): Map<string, Grant> => sweepMemo(s, `grants:${routerId}`, () => computeGrants(s, routerId));

const dhcpRouters = (s: GameState): Device[] => sweepMemo(s, "dhcpRouters", () => s.devices.filter((d) => (d.rackId || d.panel) && servesDhcp(modelById(d.model))));
// Every grant by MAC with the router that made it, the first router winning.
const grantBook = (s: GameState): Map<string, { router: string; ip: string }> => sweepMemo(s, "grantBook", () => {
  const book = new Map<string, { router: string; ip: string }>();
  for (const r of dhcpRouters(s)) for (const g of grantsOf(s, r.id).values()) if (!book.has(g.mac)) book.set(g.mac, { router: r.id, ip: g.ip });
  return book;
});

// The servers in a router's domain that hold a static address, by device id.
const staticsIn = (s: GameState, routerId: string): Map<string, string> => sweepMemo(s, `statics:${routerId}`, () => {
  const ids = domainOf(s, routerId);
  return new Map(s.devices.filter((d) => ids.has(d.id) && working(s, d.id) && isStatic(d) && ifaceOf(d).ip && !ifaceOf(d).down).map((d) => [d.id, ifaceOf(d).ip!]));
});

// Two holders of one address in a router's domain, the router's own address included: both answer at random, so neither
// counts as online and a ping to the address loses packets. Keys are deviceId:iface.
export const conflictsOf = (s: GameState, routerId: string): Set<string> => sweepMemo(s, `conflicts:${routerId}`, () => {
  const router = s.devices.find((d) => d.id === routerId)!, held = new Map<string, string[]>([[lanOf(s, router)!.gateway, [`${routerId}:router`]]]);
  const hold = (ip: string, key: string) => held.set(ip, [...(held.get(ip) ?? []), key]);
  for (const g of grantsOf(s, routerId).values()) if (g.deviceId) hold(g.ip, `${g.deviceId}:${g.iface}`);
  for (const [id, ip] of staticsIn(s, routerId)) hold(ip, `${id}:eth`);
  return new Set([...held.values()].filter((keys) => keys.length > 1).flat());
});

// The router a static setting on the device reaches: one whose domain holds the device, whose range holds the address and
// whose own address is the gateway, inside the setting's prefix.
export function staticRouter(s: GameState, deviceId: string, c: IfaceConfig & { down?: true }): Device | undefined {
  if (c.mode !== "static" || !c.ip || !c.gw || c.down) return undefined;
  return dhcpRouters(s).find((r) => {
    const lan = lanOf(s, r)!;
    return domainOf(s, r.id).has(deviceId) && inNet(lan.cidr, c.ip!) && c.gw === lan.gateway && c.ip !== lan.gateway && inNet(`${c.ip}/${c.prefix ?? 24}`, c.gw!);
  });
}

// The router whose network a device's interface has an address in: the one that granted its lease, or for a static
// address the one in its domain whose range holds it and whose address is its gateway. An address conflict counts as none.
export function gatewayOf(s: GameState, deviceId: string, iface: Iface = "eth"): string | null {
  const d = iface === "eth" ? s.devices.find((x) => x.id === deviceId) : undefined;
  if (d && isStatic(d)) {
    const r = working(s, deviceId) ? staticRouter(s, deviceId, ifaceOf(d)) : undefined;
    return r && !conflictsOf(s, r.id).has(`${deviceId}:eth`) ? r.id : null;
  }
  const r = grantBook(s).get(macOf(s, deviceId, iface))?.router;
  return r && !conflictsOf(s, r).has(`${deviceId}:${iface}`) ? r : null;
}

// Whether the address a device's interface holds is also held by another in its domain.
export const conflicted = (s: GameState, deviceId: string, iface: Iface = "eth"): boolean =>
  dhcpRouters(s).some((r) => conflictsOf(s, r.id).has(`${deviceId}:${iface}`));

// The address a device's interface holds; null without one. A static setting holds its address while the interface is up; a
// managed switch without a lease answers on its factory address.
export function addressOf(s: GameState, id: string, iface: Iface = "eth"): string | null {
  const own = iface === "eth" ? s.devices.find((x) => x.id === id) : undefined;
  if (own && isStatic(own)) return ifaceOf(own).down ? null : ifaceOf(own).ip ?? null;
  const g = grantBook(s).get(macOf(s, id, iface));
  if (g) return g.ip;
  const d = iface === "eth" ? s.devices.find((x) => x.id === id) : undefined;
  return d ? switchIp(d) : null;
}

// What answers on an address: a router on its own address, or the device whose interface holds it.
export function holderOf(s: GameState, ip: string): { deviceId: string; iface: Iface | "router" } | null {
  for (const r of dhcpRouters(s)) {
    if (lanOf(s, r)!.gateway === ip && working(s, r.id)) return { deviceId: r.id, iface: "router" };
    for (const g of grantsOf(s, r.id).values()) if (g.ip === ip && g.deviceId) return { deviceId: g.deviceId, iface: g.iface };
    for (const [id, own] of staticsIn(s, r.id)) if (own === ip) return { deviceId: id, iface: "eth" };
  }
  return null;
}

// Whether the desk reaches a device (lan.md, Reaching datacenter networks from the desk): on the basement router's network
// and on a datacenter handoff's, which the provider routes to the player; behind an own router only over its VPN.
export function deskReaches(s: GameState, deviceId: string, iface: Iface | "router" = "eth"): boolean {
  const router = iface === "router" ? deviceId : gatewayOf(s, deviceId, iface);
  const d = s.devices.find((x) => x.id === router), home = s.locations.find((l) => !l.dc);
  if (!d || !working(s, d.id)) return false;
  if (home && mountedRouter(s, home.id)?.id === d.id) return true;
  if (isOwnRouter(d)) return !!lanOf(s, d)?.vpn && linkStatus(s, d.id).online;
  return !!locationOf(s, d)?.dc;
}

// The pool addresses a router has left: neither granted, reserved, held by a stored lease nor its own.
export function freeAddresses(s: GameState, routerId: string): number {
  const router = s.devices.find((d) => d.id === routerId), lan = router && lanOf(s, router);
  if (!lan) return 0;
  const from = ipNum(lan.pool[0]), to = ipNum(lan.pool[1]);
  const taken = new Set([lan.gateway, ...[...grantsOf(s, routerId).values()].map((g) => g.ip), ...lan.reservations.map((r) => r.ip),
    ...lan.leases.filter((l) => l.until > s.hour).map((l) => l.ip)]);
  return to - from + 1 - [...taken].filter((ip) => ipNum(ip) >= from && ipNum(ip) <= to).length;
}

// Every lease a router lists: the clients in its domain, then stored leases of clients that are gone, until they run out.
export function leasesOf(s: GameState, routerId: string): (Grant & { active: boolean })[] {
  const router = s.devices.find((d) => d.id === routerId), lan = router && lanOf(s, router);
  if (!lan) return [];
  const live = [...grantsOf(s, routerId).values()].map((g) => ({ ...g, active: true }));
  const macs = new Set(live.map((g) => g.mac));
  const gone = lan.leases.filter((l) => l.until > s.hour && !macs.has(l.mac)).map((l) => ({ mac: l.mac, ip: l.ip, name: l.name, deviceId: null, iface: "eth" as const, active: false }));
  return [...live, ...gone];
}

// The port share that reaches a machine from the basement line: one pointing at its address, or at its host's for a
// workload; a VM takes a share on its own address too.
export function shareOf(s: GameState, id: string): PortShare | undefined {
  const home = s.locations.find((l) => !l.dc), router = home && mountedRouter(s, home.id), lan = router && lanOf(s, router);
  if (!lan) return undefined;
  const w = s.workloads.find((x) => x.id === id), ips = [w && isVm(s, w) ? addressOf(s, id) : null, addressOf(s, w ? w.deviceId ?? "" : id)];
  return lan.shares.find((x) => ips.includes(x.ip));
}

// The password on a router's label: a word and four digits, fixed for the device.
const WORDS = ["anker", "birke", "dachs", "eiche", "falke", "ginster", "heide", "igel", "kiefer", "lerche", "mohn", "nelke"];
export function routerPassword(s: GameState, routerId: string): string {
  let h = s.seed >>> 0;
  for (const c of routerId) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${WORDS[h % WORDS.length]}${String(h % 10000).padStart(4, "0")}`;
}

// Hourly: every router stores the leases it granted, renews those past half their time and drops the ones that ran out.
export function leaseTick(s: GameState): void {
  s.devices = s.devices.map((d) => {
    const lan = (d.rackId || d.panel) ? lanOf(s, d) : null;
    if (!lan) return d;
    const grants = grantsOf(s, d.id);
    let changed = false;
    const leases = lan.leases.flatMap((l) => {
      const g = grants.get(l.mac);
      if (g && (l.ip !== g.ip || l.until - s.hour < lan.leaseHours / 2 || l.name !== g.name)) { changed = true; return [{ mac: l.mac, ip: g.ip, until: s.hour + lan.leaseHours, name: g.name }]; }
      if (!g && l.until <= s.hour) { changed = true; return []; }
      return [l];
    });
    const known = new Set(lan.leases.map((l) => l.mac));
    for (const g of grants.values()) if (!known.has(g.mac)) { changed = true; leases.push({ mac: g.mac, ip: g.ip, until: s.hour + lan.leaseHours, name: g.name }); }
    return changed ? { ...d, lan: { ...lan, leases } } : d;
  });
}
