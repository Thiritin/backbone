// GDD, Racks, hardware and cabling (Remote access) and Network and DDoS (Out-of-band management). Numbers in economy.md,
// Hardware, power and failures.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { hasBmc, isOobPort, modelById, OOB_PORT, oobPorts, type OobPort } from "../10-catalog/hardware";
import type { Device, End, GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { pullPlug, pushLog } from "./power";
import { peerOf, powered, routeOut, working } from "./status";
import { affects, exposureDays, instanceRisk, rank, vulnsFor, type OpenVuln } from "./vulns";

export const CONTINUE_HOURS = 2 / 60;
export const GEAR_RECOVER_HOURS = 5 / 60;
// A switch or router reboots onto new firmware for this long and hangs with FIRMWARE_HANG; a port group change locks the player out with LOCKOUT_CHANCE.
export const FIRMWARE_HOURS = 10 / 60;
export const FIRMWARE_HANG = 0.1;
export const LOCKOUT_CHANCE = 0.02;
export const ATX_PRICE = 25;
export const UPLINK_MONTHLY = { dsl: 20, modem: 30 } as const;
export const MODEM_FROM = 2008;
export const OOB_FAMILY = "oob";

const byId = (s: GameState, id: string) => s.devices.find((x) => x.id === id);
const kindOf = (d: Device) => modelById(d.model).kind;
const num = (id: string) => Number(id.replace(/\D/g, "")) || 0;
export const isMgmtDevice = (d: Device): boolean => ["kvm", "console", "oob"].includes(kindOf(d));
// Switches and rack routers: the gear firmware updates can hang and port group changes can lock.
export const isGear = (d: Device): boolean => { const m = modelById(d.model); return m.kind === "switch" || (m.kind === "gateway" && m.height > 0); };

// The ports of a kind on a device, as cable ends.
export const oobEnds = (d: Device, kind: OobPort): End[] =>
  oobPorts(modelById(d.model)).flatMap((p, i) => (p === kind ? [{ device: d.id, port: OOB_PORT + i }] : []));
const peersAt = (s: GameState, d: Device, kind: OobPort): End[] => oobEnds(d, kind).flatMap((e) => peerOf(s, e) ?? []);
// The device on the other end of a console port.
export const consoleHolder = (s: GameState, d: Device): Device | undefined => {
  const e = peersAt(s, d, "console")[0];
  return e && byId(s, e.device);
};

// Whether a management device answers from afar: it works and has a way in, its own uplink, or its network jack on an OOB switch
// that answers or on a data switch with a working route out.
export function oobUp(s: GameState, id: string, seen = new Set<string>()): boolean {
  const d = byId(s, id);
  if (!d || !isMgmtDevice(d) || !working(s, id)) return false;
  if (d.uplink) return true;
  seen.add(id);
  return peersAt(s, d, "net").some((e) => {
    const peer = byId(s, e.device)!;
    if (!isOobPort(e.port)) return !!routeOut(s, peer.id);
    return kindOf(peer) === "oob" && !seen.has(peer.id) && oobUp(s, peer.id, seen);
  });
}

export type ConsoleKind = "bmc" | "kvm" | "serial";
// How a device's console is reached from afar: a server's own controller, a KVM or a console server; null without one.
export function consoleVia(s: GameState, id: string): { kind: ConsoleKind; device: Device } | null {
  const d = byId(s, id);
  if (!d) return null;
  if (kindOf(d) === "server" && hasBmc(d.model, d.brand) && !d.bmcHung && powered(s, d.id)) return { kind: "bmc", device: d };
  const h = consoleHolder(s, d);
  if (!h || !oobUp(s, h.id)) return null;
  return { kind: kindOf(h) === "kvm" ? "kvm" : "serial", device: h };
}
// A switch or router's mgmt port on an OOB switch that answers.
export function mgmtVia(s: GameState, id: string): Device | null {
  const d = byId(s, id), e = d && peersAt(s, d, "mgmt")[0], sw = e && byId(s, e.device);
  return sw && oobUp(s, sw.id) ? sw : null;
}
// A KVM that switches this server's power: one that answers, with its own ATX adapter or the one fitted to the server.
export function kvmPower(s: GameState, d: Device): Device | null {
  const h = consoleHolder(s, d);
  return h && kindOf(h) === "kvm" && (modelById(h.model).atx || d.atx) && oobUp(s, h.id) ? h : null;
}

// Fixing a stuck boot or hung or locked gear: over the console where there is one (a locked device also over its mgmt port), by hand otherwise.
export const remoteFix = (s: GameState, d: Device): Device | "bmc" | null => {
  const via = consoleVia(s, d.id);
  if (via) return via.kind === "bmc" ? "bmc" : via.device;
  return d.locked && !d.hung ? mgmtVia(s, d.id) : null;
};

// A port group change on a switch locks the player out with LOCKOUT_CHANCE.
export function lockoutRoll(s: GameState, d: Device): void {
  if (rand(hashRng(s.seed, s.hour, num(d.id), 43)) >= LOCKOUT_CHANCE) return;
  d.locked = true;
  pushLog(d, s.hour, "ipmi.log.lockedOut");
}
// New firmware hangs a switch or router with FIRMWARE_HANG.
export const firmwareHangs = (s: GameState, d: Device): boolean => isGear(d) && rand(hashRng(s.seed, s.hour, num(d.id), 44)) < FIRMWARE_HANG;

// The i18n key and params of what a device's console shows.
export function consoleScreen(d: Device, state: string): { key: string; params: Record<string, string> } {
  const host = d.hostname ?? d.label ?? d.name;
  const key = !d.on || state === "nopower" ? "term.console.dark" : d.setup ? "term.console.setup" : d.stuck && state !== "booting" ? "term.console.stuck"
    : state === "hung" ? "term.console.hung" : state === "booting" ? "term.console.booting" : d.bootFrom === "usb" ? "term.console.installer" : "term.console.login";
  return { key, params: { host } };
}

// A management device on the internet: a KVM on a data switch with no firewall on its way out, or a console server or OOB switch
// with its own uplink or the same unguarded way out.
export function exposed(s: GameState, d: Device): boolean {
  if (!isMgmtDevice(d) || !d.rackId) return false;
  if (d.uplink && kindOf(d) !== "kvm") return true;
  return peersAt(s, d, "net").some((e) => {
    if (isOobPort(e.port)) return false;
    const r = routeOut(s, e.device);
    return !!r && !r.some((h) => h.kind === "firewall");
  });
}

// The vulnerabilities of family "oob" a device's firmware is open to, worst first.
export function firmwareVulns(s: GameState, d: Device, hour: number = s.hour): OpenVuln[] {
  if (!d.fw) return [];
  const open: OpenVuln[] = [];
  for (let y = d.fw.version; y <= yearOf(hour); y++) {
    for (const v of vulnsFor(OOB_FAMILY, y, s.seed)) if (v.patchedAt <= hour && affects(d.fw, v)) open.push({ ...v, days: exposureDays(d.fw, v, hour) });
  }
  return open.sort((a, b) => rank(b.severity) - rank(a.severity) || b.days - a.days);
}
export const firmwareDue = (s: GameState, d: Device): boolean => !!d.fw && d.fw.version < yearOf(s.hour);

// The management devices the Security app lists.
export const exposedDevices = (s: GameState): Device[] => s.devices.filter((d) => exposed(s, d));

// The devices whose console, mgmt port or power a management device holds.
export const targetsOf = (s: GameState, d: Device): Device[] =>
  oobPorts(modelById(d.model)).flatMap((p, i) => {
    const e = p === "kvm" || p === "serial" || (p === "net" && kindOf(d) === "oob") ? peerOf(s, { device: d.id, port: OOB_PORT + i }) : null;
    const t = e && byId(s, e.device);
    return t && !isMgmtDevice(t) ? [t] : [];
  });

// Daily: each exposed management device with open vulnerabilities risks a takeover; the intruder cuts the servers it holds and
// changes the passwords of the gear behind it, which locks the player out.
export function oobSecurityTick(s: GameState): SimEvent[] {
  if (s.hour % 24 !== 0) return [];
  const events: SimEvent[] = [];
  for (const d of exposedDevices(s)) {
    const risk = instanceRisk(firmwareVulns(s, d));
    if (risk <= 0 || !working(s, d.id) || rand(hashRng(s.seed, num(d.id), s.hour / 24, 93)) >= risk) continue;
    const hit = targetsOf(s, d);
    for (const t of hit) {
      if (kindOf(t) === "server") { if (t.on) pullPlug(s, t); }
      else { t.locked = true; pushLog(t, s.hour, "ipmi.log.lockedOut"); }
    }
    events.push({ app: "Security", key: "event.oobHacked", params: { device: d.label ?? d.name, count: hit.length } });
  }
  return events;
}
