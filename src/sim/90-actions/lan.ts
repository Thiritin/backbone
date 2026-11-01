// docs/design/lan.md: what the player sets in Fritz!OZ, the basement router's web interface.
import { isOfficeRouter, modelById } from "../10-catalog/hardware";
import type { Device, GameState, IfaceConfig, PortShare, RouterLan } from "../50-state";
import { addressOf, grantsOf, inNet, lanOf, macOf } from "../60-infra/lan";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const fritz = (s: GameState, routerId: string): { d: Device; lan: RouterLan } | string => {
  const d = s.devices.find((x) => x.id === routerId);
  if (!d) return "error.unknownDevice";
  const lan = isOfficeRouter(modelById(d.model)) ? lanOf(s, d) : null;
  return lan ? { d, lan } : "error.notOfficeRouter";
};
const ipv4 = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split(".").every((x) => Number(x) <= 255);
const last = (ip: string) => Number(ip.split(".")[3]);

// "Always assign this network device the same IPv4 address": fixes the address the device holds now, or frees it.
export function reserveAddress(s: GameState, routerId: string, mac: string, on: boolean): ActionResult {
  const r = fritz(s, routerId);
  if (typeof r === "string") return fail(r);
  const ip = grantsOf(s, routerId).get(mac)?.ip ?? r.lan.leases.find((l) => l.mac === mac && l.until > s.hour)?.ip;
  if (on && !ip) return fail("error.noAddress");
  const rest = r.lan.reservations.filter((x) => x.mac !== mac);
  r.d.lan = { ...r.lan, reservations: on ? [...rest, { mac, ip: ip! }] : rest };
  return { ok: true, id: routerId };
}

// Takes the share on an address away.
export function dropPortShare(s: GameState, routerId: string, ip: string): ActionResult {
  const r = fritz(s, routerId);
  if (typeof r === "string") return fail(r);
  r.d.lan = { ...r.lan, shares: r.lan.shares.filter((x) => x.ip !== ip) };
  return { ok: true, id: routerId };
}

// Shares a port with a device on the router's network. A port goes to one device, so a second device is refused; a share
// also fixes the device's address.
export function setPortShare(s: GameState, routerId: string, deviceId: string, kind: PortShare["kind"]): ActionResult {
  const r = fritz(s, routerId);
  if (typeof r === "string") return fail(r);
  const ip = addressOf(s, deviceId);
  if (!ip || !grantsOf(s, routerId).has(macOf(s, deviceId))) return fail("error.noAddress");
  if (r.lan.shares.some((x) => x.ip !== ip)) return fail("error.portShared");
  const mac = macOf(s, deviceId);
  r.d.lan = { ...r.lan, shares: [{ ip, kind }], reservations: [...r.lan.reservations.filter((x) => x.mac !== mac), { mac, ip }] };
  return { ok: true, id: routerId };
}

// The IPv4 settings: the router's own address, whose /24 becomes the network, and the DHCP pool's first and last address.
// The router restarts its network, so every lease starts over in the new range; shares keep the address they point at.
export function setRouterLan(s: GameState, routerId: string, gateway: string, from: number, to: number): ActionResult {
  const r = fritz(s, routerId);
  if (typeof r === "string") return fail(r);
  const [a, b] = gateway.split(".").map(Number);
  const local = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  if (!ipv4(gateway) || !local || last(gateway) === 0 || last(gateway) === 255) return fail("error.badAddress");
  const net = gateway.split(".").slice(0, 3).join(".");
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 254 || from > to || (last(gateway) >= from && last(gateway) <= to)) return fail("error.badPool");
  const cidr = `${net}.0/24`;
  r.d.lan = { ...r.lan, cidr, gateway, pool: [`${net}.${from}`, `${net}.${to}`], leases: [], reservations: r.lan.reservations.filter((x) => inNet(cidr, x.ip)) };
  return { ok: true, id: routerId };
}

// Opening the router's device list ticks the tutorial's findAddress once the first server is in it.
export function viewDevices(s: GameState, routerId: string): ActionResult {
  const r = fritz(s, routerId);
  if (typeof r === "string") return fail(r);
  const first = s.devices.find((d) => modelById(d.model).kind === "server");
  if (first && grantsOf(s, routerId).has(macOf(s, first.id)) && !s.checklist.includes("findAddress")) s.checklist = [...s.checklist, "findAddress"];
  return { ok: true, id: routerId };
}

const server = (s: GameState, deviceId: string): Device | string => {
  const d = s.devices.find((x) => x.id === deviceId);
  return !d ? "error.unknownDevice" : modelById(d.model).kind !== "server" ? "error.notServerNet" : d;
};
const badSetting = (c: IfaceConfig) => (c.mode !== "dhcp" && c.mode !== "static") || [c.ip, c.gw, c.dns].some((x) => x !== undefined && !ipv4(x))
  || (c.prefix !== undefined && (!Number.isInteger(c.prefix) || c.prefix < 0 || c.prefix > 32));

// lan.md, Static addresses: the network setting a server's OS stores, from ifup, a networking restart or the Windoors
// adapter page. It applies at once and replaces what ip set since boot.
export function setIface(s: GameState, deviceId: string, iface: IfaceConfig): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (badSetting(iface)) return fail("error.badIp");
  d.iface = iface.mode === "dhcp" ? { mode: "dhcp" } : iface;
  delete d.runtime;
  return { ok: true, id: deviceId };
}

// What ip, dhclient or ifdown set on a running server: in force until its next boot. null drops it.
export function setRuntimeIface(s: GameState, deviceId: string, runtime: (IfaceConfig & { down?: true }) | null): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (runtime && badSetting(runtime)) return fail("error.badIp");
  if (runtime) d.runtime = { ...runtime, boot: d.bootUntil ?? null };
  else delete d.runtime;
  return { ok: true, id: deviceId };
}
