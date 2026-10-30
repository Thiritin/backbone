// GDD, Racks, hardware and cabling (Remote access) and Network and DDoS (Out-of-band management). Numbers in economy.md,
// Hardware, power and failures.
import { hashRng, rand } from "../00-core/rng";
import { nowHours, yearOf } from "../00-core/time";
import { hasBmc, isOobPort, modelById, OOB_PORT, oobPorts, type OobPort } from "../10-catalog/hardware";
import { softwareById } from "../10-catalog/platforms";
import { SERVER_OS, serverOsById, type ServerOsId } from "../10-catalog/server-os";
import type { Device, End, GameState, MachineState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { pullPlug, pushLog } from "./power";
import { machineOf, vmById } from "./cluster";
import { booting, deviceHealth, osBootHours, peerOf, powered, routeOut, working } from "./status";
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

// docs/design/software.md, sections 4 and 7: what a machine's screen shows, from the power to the shell. post and booting
// split the boot: the OS's own boot minutes are its end. bootMenu is the installer the media starts, with the operating
// systems it holds. login covers both OSes until someone logs in: loggedIn turns a Windoors logon into its desktop, while a
// Lunix login is followed by the shell that runLine drives.
export type MachineScreen =
  | { kind: "dark" | "post" | "stuck" | "setup" | "notFound" | "desktop" | "hung" }
  | { kind: "bootMenu"; media: ServerOsId[] }
  | { kind: "osInstall"; os: ServerOsId; progress: number }
  | { kind: "booting" | "login"; os: ServerOsId }
  | { kind: "installing"; software: string; progress: number };

const share = (doneAt: number, hours: number, now: number) => Math.max(0, Math.min(1, 1 - (doneAt - now) / hours));

// The OS that is up on the disk: installing, installing software or at the login.
function upScreen(s: GameState, m: MachineState, loggedIn: boolean): MachineScreen {
  const now = nowHours(s);
  if (!m.os) return { kind: "notFound" };
  const sw = m.software.find((x) => x.doneAt !== null && x.doneAt > now);
  if (sw) return { kind: "installing", software: sw.id, progress: share(sw.doneAt!, softwareById(sw.id).installHours, now) };
  return loggedIn && m.os.id === "windoors" ? { kind: "desktop" } : { kind: "login", os: m.os.id };
}

export function machineScreen(s: GameState, machineId: string, loggedIn = false): MachineScreen {
  const now = nowHours(s), vm = vmById(s, machineId);
  if (vm) {
    const os = vm.os ?? null;
    if (vm.stopped || !vm.deviceId || !working(s, vm.deviceId)) return { kind: "dark" };
    if (os && os.installedAt > now) return { kind: "osInstall", os: os.id, progress: share(os.installedAt, serverOsById(os.id).installHours, now) };
    if (vm.media) return { kind: "bootMenu", media: [vm.media] };
    return upScreen(s, { os, software: vm.software ?? [] }, loggedIn);
  }
  const d = byId(s, machineId);
  if (!d) return { kind: "dark" };
  const state = deviceHealth(s, d.id).state;
  if (!d.on || state === "nopower") return { kind: "dark" };
  if (d.setup) return { kind: "setup" };
  if (d.os && d.os.installedAt > now) return { kind: "osInstall", os: d.os.id, progress: share(d.os.installedAt, serverOsById(d.os.id).installHours, now) };
  if (d.stuck && state !== "booting") return { kind: "stuck" };
  if (state === "hung") return { kind: "hung" };
  if (booting(s, d)) return d.os && d.bootFrom === "disk" && (d.bootUntil ?? 0) - now <= osBootHours(s, d) ? { kind: "booting", os: d.os.id } : { kind: "post" };
  if (d.bootFrom === "usb") return { kind: "bootMenu", media: SERVER_OS.map((o) => o.id) };
  return upScreen(s, d, loggedIn);
}

// The OS on the machine answers on the network: booted, not installing an OS, not hung.
export const osUp = (s: GameState, machineId: string): ServerOsId | null => {
  const x = machineScreen(s, machineId);
  return x.kind === "login" || x.kind === "installing" ? machineOf(s, machineId)!.os!.id : null;
};

const SCREEN_KEY: Record<MachineScreen["kind"], string> = {
  dark: "term.console.dark", post: "term.console.booting", stuck: "term.console.stuck", setup: "term.console.setup", bootMenu: "term.console.installer",
  notFound: "term.console.notFound", osInstall: "term.console.osInstall", booting: "term.console.booting", login: "term.console.login",
  desktop: "term.console.login", installing: "term.console.login", hung: "term.console.hung",
};

// The i18n key and params of the first line a device's console shows, for the Terminal's console command and the KVM page.
export function consoleScreen(s: GameState, d: Device): { key: string; params: Record<string, string> } {
  return { key: SCREEN_KEY[machineScreen(s, d.id).kind], params: { host: d.hostname ?? d.label ?? d.name } };
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
