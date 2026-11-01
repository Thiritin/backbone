import { isOfficeRouter, modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { inNet, ipNum, ipStr, lanOf } from "../60-infra/lan";
import { isOwnRouter, mountedRouter } from "../60-infra/routers";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Puts a small-office router from the basement's storage on the shelf of the mounted one. The cables stay on their ports
// and the replaced router goes into storage.
export function installRouter(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.store) return fail("error.alreadyMounted");
  if (d.transitTo) return fail("error.inTransit");
  if (!isOfficeRouter(modelById(d.model))) return fail("error.notOfficeRouter");
  const loc = s.locations.find((l) => l.id === d.store);
  if (!loc || loc.dc) return fail("error.basementOnly");
  const old = mountedRouter(s, loc.id);
  if (!old) return fail("error.noRouter");
  const move = (e: { device: string; port: number }) => (e.device === old.id ? { ...e, device: d.id } : e);
  s.cables = s.cables.map((c) => ({ ...c, a: move(c.a), b: move(c.b) }));
  const plugged = old.components.filter((c) => c.kind === "psu").map((c) => c.plugged);
  // The new router takes over the network settings and port shares; it knows none of the old one's leases or reservations.
  const lan = old.lan && { ...old.lan, leases: [], reservations: [] };
  Object.assign(d, { rackId: old.rackId, slot: old.slot, store: null, name: old.name, on: true, ...(lan && { lan }),
    components: d.components.map((c) => (c.kind === "psu" ? { ...c, plugged: plugged.shift() ?? c.plugged } : c)) });
  Object.assign(old, { rackId: null, slot: 0, store: loc.id, name: d.name });
  return { ok: true, id: d.id };
}

// Settings in an own router's web interface (WebFigg, J-Webb).
const own = (s: GameState, id: string): Device | string => {
  const d = s.devices.find((x) => x.id === id);
  return !d ? "error.unknownDevice" : isOwnRouter(d) ? d : "error.notOwnRouter";
};
const ipv4 = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split(".").every((x) => Number(x) <= 255);
const local = (ip: string) => { const [a, b] = ip.split(".").map(Number); return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168); };

// The router's address and prefix make its network; the pool runs between two addresses in it. The router restarts its
// DHCP server, so every lease starts over.
export function setOwnRouterLan(s: GameState, routerId: string, gateway: string, prefix: number, from: string, to: string): ActionResult {
  const d = own(s, routerId);
  if (typeof d === "string") return fail(d);
  if (!Number.isInteger(prefix) || prefix < 16 || prefix > 30) return fail("error.badPrefix");
  const size = 2 ** (32 - prefix), base = Math.floor(ipNum(gateway) / size) * size, cidr = `${ipStr(base)}/${prefix}`;
  const inside = (ip: string) => ipv4(ip) && inNet(cidr, ip) && ipNum(ip) !== base && ipNum(ip) !== base + size - 1;
  if (!ipv4(gateway) || !local(gateway) || !inside(gateway)) return fail("error.badAddress");
  if (!inside(from) || !inside(to) || ipNum(from) > ipNum(to) || (ipNum(gateway) >= ipNum(from) && ipNum(gateway) <= ipNum(to))) return fail("error.badPool");
  const lan = lanOf(s, d)!;
  d.lan = { ...lan, cidr, gateway, pool: [from, to], leases: [], reservations: lan.reservations.filter((r) => inNet(cidr, r.ip)) };
  return { ok: true, id: d.id };
}

// Remote access: the router's VPN lets the desk into the network behind it.
export function setRemoteAccess(s: GameState, routerId: string, on: boolean): ActionResult {
  const d = own(s, routerId);
  if (typeof d === "string") return fail(d);
  d.lan = { ...lanOf(s, d)!, vpn: on };
  return { ok: true, id: d.id };
}
