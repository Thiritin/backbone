// GDD, Racks, hardware and cabling (Remote management, Hangs and pulled plugs). Numbers in economy.md, Hardware, power and failures.
import { hashRng, rand } from "../00-core/rng";
import { hasBmc, modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { hostOfVm, isOwnVm, type Workload } from "./cluster";
import { rebuildHours, type SimEvent } from "../88-tick/tick";
import { reportLoss } from "../85-products/products";
import { BOOT_HOURS, booting, deviceHealth, drivesOf, HOURS_PER_YEAR, powered, pluggedIn, psusOf, working } from "./status";

// An unclean stop corrupts the data of the workloads that ran with this chance.
export const CORRUPT_CHANCE = 0.15;
// Share of recovered workloads that come back fine; the rest need a restore from backup.
export const RECOVER_FINE = 0.7;
export const RECOVER_HOURS = 0.5;
export const BMC_RESET_HOURS = 0.25;
// Yearly hang rates: the operating system doubles while degraded or hot and triples while frozen from RAM overcommit; the BMC triples after six years.
export const HANG_YEARLY = 0.01;
export const BMC_HANG_YEARLY = 0.01;
export const BMC_OLD_YEARS = 6;
export const LOG_MAX = 20;

export function pushLog(d: Pick<Device, "log">, hour: number, key: string): void {
  d.log = [...d.log, { hour, key }].slice(-LOG_MAX);
}

export function hangChance(s: GameState, d: Device): number {
  const state = deviceHealth(s, d.id).state;
  const factor = (state === "degraded" || state === "hot" ? 2 : 1) * (s.frozen.includes(d.id) ? 3 : 1);
  return (HANG_YEARLY * factor) / HOURS_PER_YEAR;
}

export function bmcHangChance(s: GameState, d: Device): number {
  return (BMC_HANG_YEARLY * (s.hour - d.boughtAt >= BMC_OLD_YEARS * HOURS_PER_YEAR ? 3 : 1)) / HOURS_PER_YEAR;
}

// Workloads that were running on the device, if it was up.
const ranOn = (s: GameState, d: Device) => d.on && powered(s, d.id) && !booting(s, d)
  ? s.workloads.filter((w) => w.deviceId === d.id && !w.stopped && !w.corrupted) : [];

// An unclean stop rolls for corruption: an array with its redundancy intact resyncs, anything else leaves the workloads
// corrupted until they are recovered or restored.
function uncleanStop(s: GameState, d: Device): "ipmi.log.resync" | "ipmi.log.corrupted" | null {
  const ran = ranOn(s, d);
  if (!ran.length || rand(s.rng) >= CORRUPT_CHANCE) return null;
  if (d.raid !== "none" && !d.rebuild && !drivesOf(d).some((c) => c.failedAt !== null)) {
    d.rebuild = { componentId: "", doneAt: s.hour + rebuildHours(d) };
    return "ipmi.log.resync";
  }
  const ids = new Set(ran.map((w) => w.id));
  s.workloads = s.workloads.map((w) => (ids.has(w.id) ? { ...w, corrupted: true, noticed: false } : w));
  return "ipmi.log.corrupted";
}

export function losePower(s: GameState, d: Device): void {
  const outcome = uncleanStop(s, d);
  d.hung = false;
  pushLog(d, s.hour, "ipmi.log.pulled");
  if (outcome) pushLog(d, s.hour, outcome);
}

// Cuts the power: the server is off and its OS no longer hung.
export function pullPlug(s: GameState, d: Device): void {
  losePower(s, d);
  d.on = false;
}

export function bootUp(s: GameState, d: Device): void {
  d.bootUntil = s.hour + BOOT_HOURS;
  d.on = true;
  pushLog(d, s.hour, "ipmi.log.powerOn");
}

// Plugs power cords into the rack's power strip or pulls them, every cord unless named. A running server that loses its
// last live supply stops uncleanly but stays switched on, so it boots once a cord is back.
export function plugCords(s: GameState, d: Device, plugged: boolean, ids = psusOf(d).map((c) => c.id)): void {
  const components = d.components.map((c) => (ids.includes(c.id) ? { ...c, plugged } : c));
  const before = pluggedIn(d), after = pluggedIn({ ...d, components });
  // The roll reads the server as it ran, so it comes before the cords move.
  if (d.on && before && !after) losePower(s, d);
  d.components = components;
  if (d.on && !before && after) d.bootUntil = s.hour + BOOT_HOURS;
}

export type FrontOp = "power" | "hold" | "reset" | "pull" | "plug";

// A hand at the server: the power button boots it or shuts it down cleanly, a hung or booting OS ignores the press,
// holding the button cuts the power, the reset button reboots it hard, and the cords leave or join the power strip.
export function atFront(s: GameState, d: Device, op: FrontOp): void {
  if (op === "power" && !d.on) bootUp(s, d);
  else if (op === "power") { if (working(s, d.id)) { d.on = false; pushLog(d, s.hour, "ipmi.log.shutdown"); } }
  else if (op === "hold") { if (d.on) pullPlug(s, d); }
  else if (op === "reset") { if (d.on) hardReboot(s, d, "ipmi.log.reset"); }
  else plugCords(s, d, op === "plug");
}

// Reboots without losing power or after a ten second cycle: the same roll, then the server boots again.
export function hardReboot(s: GameState, d: Device, key: "ipmi.log.reset" | "ipmi.log.cycle"): void {
  const outcome = uncleanStop(s, d);
  d.hung = false;
  d.bootUntil = s.hour + BOOT_HOURS;
  pushLog(d, s.hour, key);
  if (outcome) pushLog(d, s.hour, outcome);
}

// Hourly: waiting hand tasks finish, servers and their controllers may hang, recoveries finish and new corruption is announced.
export function powerTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const monitoring = s.unlocks.includes("monitoring");
  const name = (d: Device) => d.label ?? d.name;
  s.devices = s.devices.map((d) => {
    const server = modelById(d.model).kind === "server";
    if (!server && !d.hands) return d;
    const n: Device = { ...d };
    let changed = false;
    if (d.hands && d.hands.doneAt <= s.hour) {
      if (d.hands.kind !== "bmcreset") atFront(s, n, d.hands.kind);
      else { n.bmcHung = false; pushLog(n, s.hour, "ipmi.log.bmcReset"); }
      n.hands = null;
      changed = true;
    }
    const seed = Number(d.id.replace(/\D/g, "")) || 0;
    if (server && n.on && !n.hung && powered(s, d.id) && !booting(s, d) && rand(hashRng(s.hour, seed, 1)) < hangChance(s, d)) {
      n.hung = true;
      pushLog(n, s.hour, "ipmi.log.hung");
      if (monitoring) events.push({ app: "Locations", key: "event.serverHung", params: { device: name(d) } });
      changed = true;
    }
    if (server && hasBmc(d.model, d.brand) && !n.bmcHung && powered(s, d.id) && rand(hashRng(s.hour, seed, 2)) < bmcHangChance(s, d)) {
      n.bmcHung = true;
      pushLog(n, s.hour, "ipmi.log.bmcHung");
      if (monitoring) events.push({ app: "Locations", key: "event.bmcHung", params: { device: name(d) } });
      changed = true;
    }
    return changed ? n : d;
  });
  const finished = s.workloads.filter((w) => w.recoverDoneAt !== undefined && w.recoverDoneAt <= s.hour);
  if (finished.length) {
    const fine = new Set<string>(), lost = new Map<string, Workload[]>();
    for (const w of finished) {
      const device = s.devices.find((x) => x.id === w.deviceId);
      if (!device) continue;
      if (rand(s.rng) < RECOVER_FINE) {
        fine.add(w.id);
        events.push({ app: "Locations", key: "event.recovered", params: { device: name(device) } });
        s.devices = s.devices.map((x) => { if (x.id !== device.id) return x; const y = { ...x }; pushLog(y, s.hour, "ipmi.log.recovered"); return y; });
      } else lost.set(device.id, [...(lost.get(device.id) ?? []), w]);
    }
    const done = new Set(finished.map((w) => w.id));
    s.workloads = s.workloads.map((w) => (done.has(w.id) ? { ...w, recoverDoneAt: undefined, ...(fine.has(w.id) ? { corrupted: false } : { recoverFailed: true }) } : w));
    for (const [id, ws] of lost) {
      // A corrupted panel VM takes the web spaces inside it along.
      const items = ws.flatMap((w) => (isOwnVm(w) ? s.workloads.filter((x) => x.clusterId === hostOfVm(s, w.id)?.id) : [w]));
      if (items.length) reportLoss(s, s.devices.find((x) => x.id === id)!, items, s.hour, events);
    }
  }
  const fresh = s.workloads.filter((w) => w.corrupted && !w.noticed && w.deviceId);
  if (fresh.length) {
    for (const id of new Set(fresh.map((w) => w.deviceId!))) {
      const device = s.devices.find((x) => x.id === id)!;
      events.push({ app: "Locations", key: "event.dataCorrupted", params: { device: name(device), deviceId: device.id, count: fresh.filter((w) => w.deviceId === id).length } });
    }
    s.workloads = s.workloads.map((w) => (w.corrupted && !w.noticed && w.deviceId ? { ...w, noticed: true } : w));
  }
  return events;
}
