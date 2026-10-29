// Remote access actions (GDD, Racks, hardware and cabling, Remote access; Network and DDoS, Out-of-band management).
import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { GameState } from "../50-state";
import { handJob, type How } from "../60-infra/handwork";
import {
  ATX_PRICE, CONTINUE_HOURS, FIRMWARE_HOURS, firmwareDue, firmwareHangs, GEAR_RECOVER_HOURS, MODEM_FROM, remoteFix,
} from "../60-infra/oob";
import { pushLog } from "../60-infra/power";
import { locationOf, working } from "../60-infra/status";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Continues a boot stuck at the firmware prompt: over a console in 2 minutes, otherwise as hand work on site.
export function continueBoot(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.stuck || !d.on) return fail("error.notStuck");
  if (d.hands) return fail("error.handsBusy");
  if (how === false && remoteFix(s, d)) {
    d.stuck = false;
    d.bootUntil = Math.max(d.bootUntil ?? 0, s.hour + CONTINUE_HOURS);
    pushLog(d, s.hour, "ipmi.log.continued");
    return { ok: true };
  }
  const job = handJob(s, d.label ?? d.name, locationOf(s, d), how, CONTINUE_HOURS, 1);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  d.hands = { kind: "continue", doneAt: s.hour + job.commit() };
  return { ok: true };
}

// Brings back a hung or locked switch or router: over its console (a locked one also over its mgmt port) in 5 minutes, otherwise by hand.
export function recoverGear(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.hung && !d.locked) return fail("error.gearFine");
  if (d.hands) return fail("error.handsBusy");
  if (how === false && remoteFix(s, d)) {
    d.hung = false;
    d.locked = false;
    d.bootUntil = s.hour + GEAR_RECOVER_HOURS;
    pushLog(d, s.hour, "ipmi.log.gearRecovered");
    return { ok: true };
  }
  const job = handJob(s, d.label ?? d.name, locationOf(s, d), how, GEAR_RECOVER_HOURS, 1);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  d.hands = { kind: "recover", doneAt: s.hour + job.commit() };
  return { ok: true };
}

// Flashes the year's firmware release onto network or management gear; it reboots, and a switch or router can hang.
export function updateFirmware(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.fw) return fail("error.noFirmware");
  if (!d.rackId) return fail("error.notMounted");
  if (!firmwareDue(s, d)) return fail("error.upToDate");
  if (!working(s, d.id)) return fail(d.locked ? "error.lockedOut" : "error.unresponsive");
  d.fw = { version: yearOf(s.hour), updatedAt: s.hour };
  d.bootUntil = s.hour + FIRMWARE_HOURS;
  pushLog(d, s.hour, "ipmi.log.firmware");
  if (firmwareHangs(s, d)) { d.hung = true; pushLog(d, s.hour, "ipmi.log.hung"); }
  return { ok: true };
}

// Fits an ATX power adapter so a console-only KVM can switch the server's power.
export function fitAtx(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server") return fail("error.notServer");
  if (d.atx) return fail("error.atxFitted");
  if (s.cash < ATX_PRICE) return fail("error.noCash");
  d.atx = true;
  s.cash = Math.round((s.cash - ATX_PRICE) * 100) / 100;
  s.ledger.push({ hour: s.hour, category: "hardware", key: "ledger.atxAdapter", params: { device: d.label ?? d.name }, amount: -ATX_PRICE });
  return { ok: true };
}

// Orders or cancels the own way in of a console server or OOB switch: a management DSL line, or from 2008 a cellular modem
// in a console server. Both bill monthly.
export function setUplink(s: GameState, deviceId: string, uplink: "dsl" | "modem" | null): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const kind = modelById(d.model).kind;
  if (kind !== "console" && kind !== "oob") return fail("error.noUplink");
  if (uplink === "modem" && (kind !== "console" || yearOf(s.hour) < MODEM_FROM)) return fail("error.noModem");
  if (uplink) d.uplink = uplink;
  else delete d.uplink;
  return { ok: true };
}
