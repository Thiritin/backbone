// economy.md, Power outages and Legal requests: grid outages per location, server seizures and the incident log.
import { noticeChance, segmentOf } from "../10-catalog/attention";
import { hashRng, rand, type Rng } from "../00-core/rng";
import { modelById } from "../10-catalog/hardware";
import { datacenterById } from "../20-world/datacenters";
import type { Customer } from "../30-customers/customers";
import { bump, createTicket, profileStats } from "../40-support/tickets";
import type { Device, GameState, Location, Rack } from "../50-state";
import { addReview, announceReview, starsFor, type ReviewReason } from "../80-business/marketing";
import type { SimEvent } from "../88-tick/tick";
import { insideVm, isOwnVm, moveControlPlaneOff, pickNode, vmOf, type Workload } from "./cluster";
import type { Incident } from "./ops";
import { losePower } from "./power";
import { bootHours, deviceWatts, HOURS_PER_YEAR, isPlugged, locationOf, psusOf } from "./status";

export const GRID = {
  // Outages a year: the household line in the basement fails more often than a datacenter's utility feed.
  basementPerYear: 3, datacenterPerYear: 1.5,
  // Median 20 minutes, 10% over 2 hours.
  medianMinutes: 20, sigma: 1.4, maxMinutes: 12 * 60,
  generatorFails: 0.02,
  // A datacenter's own UPS bridges this long, also on sites without a generator.
  siteUpsMinutes: 15,
  // A datacenter feed fails on its own, behind the site's UPS and generator.
  feedPerYear: 0.3, feedMedianMinutes: 30,
};
// A datacenter hall's cooling fails at times; the room then heats up (thermal.ts).
export const COOLING = { perYear: 0.3, medianMinutes: 40, sigma: 1, maxMinutes: 8 * 60 };
export const REFUND_CHANCE = { low: 0.1, medium: 0.15, high: 0.3 } as const;
// An outage this long or longer brings refund requests.
export const REFUND_MIN_DARK = 60;
export const SEIZE_MONTHS = [3, 24] as const;
export const DATA_LOSS = -60, RESTORED = -15;
const HOURS_PER_MONTH = 730;

// Cluster backups always land on another cluster.
export const hasBackupElsewhere = (s: GameState, workloadId: string): boolean => (s.workloads.find((w) => w.id === workloadId)?.backupAt ?? null) !== null;

// economy.md, Reviews: 10% of affected customers write one, 20% below happiness 40.
export function maybeReview(s: GameState, c: Customer, reason: ReviewReason, r: Rng, events: SimEvent[], stars = starsFor(c.happiness, r)): void {
  if (rand(r) >= (c.happiness < 40 ? 0.2 : 0.1)) return;
  announceReview(s, addReview(s, c.id, stars, reason), events);
}

const atLocation = (s: GameState, w: Workload, locId: string): boolean => {
  const vm = vmOf(s, w);
  if (vm) return atLocation(s, vm, locId);
  if (w.deviceId) {
    const d = s.devices.find((x) => x.id === w.deviceId);
    return !!d && locationOf(s, d)?.id === locId;
  }
  return s.racks.some((r) => r.id === w.rackId && r.locationId === locId);
};

const onDevices = (s: GameState, w: Workload, ids: Set<string>): boolean => {
  const vm = vmOf(s, w);
  return vm ? onDevices(s, vm, ids) : !!w.deviceId && ids.has(w.deviceId);
};

function customersOf(s: GameState, workloads: Workload[]): Customer[] {
  const ids = new Set(workloads.map((w) => s.services.find((v) => v.id === w.serviceId)?.customerId));
  return s.customers.filter((c) => ids.has(c.id) && c.churnedAt === null);
}

function record(s: GameState, inc: Omit<Incident, "id">): Incident {
  const full = { id: `inc${s.nextId++}`, ...inc };
  s.ops = { ...s.ops, incidents: [...s.ops.incidents, full] };
  return full;
}

// Minutes the UPS units among these devices carry their load.
const upsOf = (devices: Device[]): number => {
  const on = devices.filter((d) => d.rackId && d.on);
  const wh = on.reduce((n, d) => n + (modelById(d.model).batteryWh ?? 0), 0);
  const watts = on.reduce((n, d) => n + deviceWatts(d), 0);
  return wh && watts ? (wh / watts) * 60 : 0;
};

// Minutes the location's own UPS units carry its current load.
export const upsMinutes = (s: GameState, locId: string): number => upsOf(s.devices.filter((d) => locationOf(s, d)?.id === locId));

// Running servers lose power uncleanly and boot once it is back.
function cutPower(s: GameState, devices: Device[], dark: number): void {
  for (const d of devices.filter((x) => x.on)) {
    losePower(s, d);
    d.bootUntil = s.hour + dark / 60 + bootHours(s, d);
  }
}

function outageFallout(s: GameState, workloads: Workload[], dark: number, r: Rng, events: SimEvent[]): void {
  const services = new Set(workloads.map((w) => w.serviceId));
  for (const c of customersOf(s, workloads)) {
    const svc = s.services.find((v) => v.customerId === c.id && services.has(v.id))!;
    // A customer who never noticed the dark minutes asks for nothing.
    if (rand(r) >= noticeChance(s.seed, c.id, segmentOf(c.profile, svc.product), s.hour, dark)) continue;
    if (dark >= REFUND_MIN_DARK && rand(r) < REFUND_CHANCE[profileStats(c.profile).budget]) createTicket(s, c, "refund", svc.id, "outage");
    maybeReview(s, c, "outage", r, events);
  }
}

const normal = (r: Rng) => Math.sqrt(-2 * Math.log(1 - rand(r))) * Math.cos(2 * Math.PI * rand(r));

// One grid outage at a location: the site and the location's UPS carry what they can, the rest goes dark.
export function gridOutage(s: GameState, loc: Location, minutes: number, r: Rng, events: SimEvent[]): Incident {
  const site = loc.dc ? datacenterById(loc.dc).backup : "none";
  const generatorFails = site === "ups+generator" && rand(r) < GRID.generatorFails;
  const bridged = upsMinutes(s, loc.id) + (site === "none" ? 0 : GRID.siteUpsMinutes);
  const dark = site === "ups+generator" && !generatorFails ? 0 : Math.max(0, Math.round(minutes - bridged));
  const workloads = dark ? s.workloads.filter((w) => atLocation(s, w, loc.id)) : [];
  const hit = customersOf(s, workloads);
  const here = dark ? s.devices.filter((d) => d.rackId && locationOf(s, d)?.id === loc.id) : [];
  const devices = here.map((d) => d.label ?? d.name);
  // The cut reads the servers as they ran, so it comes before the location goes dark.
  cutPower(s, here, dark);
  if (dark) s.ops = { ...s.ops, dark: { ...s.ops.dark, [loc.id]: s.hour + dark / 60 } };
  const inc = record(s, {
    hour: s.hour, cause: generatorFails && dark ? "generator" : "grid", locationId: loc.id, minutes, dark, devices,
    customers: hit.map((c) => c.id), agency: null, returnAt: null,
  });
  events.push({ app: "Support", key: dark ? "event.gridDark" : "event.gridCarried", params: { location: loc.name, minutes: dark || minutes } });
  outageFallout(s, workloads, dark, r, events);
  return inc;
}

// One feed of a rack fails. Servers with a live supply on each feed of a dual-fed rack stay up, single-supply servers
// hang on feed A, and the rack's own UPS carries what it can.
export function feedFailure(s: GameState, rack: Rack, feed: "A" | "B", minutes: number, r: Rng, events: SimEvent[]): Incident {
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const inRack = s.devices.filter((d) => d.rackId === rack.id);
  const dual = (d: Device) => rack.feedB && psusOf(d).filter((c) => isPlugged(c) && c.failedAt === null).length >= 2;
  const dark = Math.max(0, Math.round(minutes - upsOf(inRack)));
  const here = dark && feed === "A" ? inRack.filter((d) => d.on && !dual(d) && !modelById(d.model).batteryWh) : [];
  const ids = new Set(here.map((d) => d.id));
  const workloads = s.workloads.filter((w) => onDevices(s, w, ids));
  cutPower(s, here, dark);
  const inc = record(s, {
    hour: s.hour, cause: "feed", locationId: loc.id, minutes, dark: here.length ? dark : 0, devices: here.map((d) => d.label ?? d.name),
    customers: customersOf(s, workloads).map((c) => c.id), agency: null, returnAt: null,
  });
  events.push({ app: "Support", key: here.length ? "event.feedDark" : "event.feedCarried", params: { rack: rack.name, feed, minutes: here.length ? dark : minutes } });
  outageFallout(s, workloads, dark, r, events);
  return inc;
}

// Servers that shut themselves off from heat are back after dark minutes.
export function heatIncident(s: GameState, loc: Location, devices: Device[], hour: number, dark: number, events: SimEvent[]): Incident {
  const ids = new Set(devices.map((d) => d.id));
  const workloads = s.workloads.filter((w) => onDevices(s, w, ids));
  const inc = record(s, {
    hour, cause: "heat", locationId: loc.id, minutes: dark, dark, devices: devices.map((d) => d.label ?? d.name),
    customers: customersOf(s, workloads).map((c) => c.id), agency: null, returnAt: null,
  });
  outageFallout(s, workloads, dark, hashRng(s.seed, s.hour, Number(loc.id.replace(/\D/g, "")) || 0, 95), events);
  return inc;
}

export function gridTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  s.locations.forEach((loc, i) => {
    if (loc.readyAt > s.hour || !s.devices.some((d) => d.rackId && locationOf(s, d)?.id === loc.id)) return;
    const r = hashRng(s.seed, s.hour, i, 91);
    if (rand(r) >= (loc.dc ? GRID.datacenterPerYear : GRID.basementPerYear) / HOURS_PER_YEAR) return;
    const minutes = Math.max(5, Math.min(GRID.maxMinutes, Math.round(GRID.medianMinutes * Math.exp(GRID.sigma * normal(r)))));
    gridOutage(s, loc, minutes, r, events);
  });
  s.locations.forEach((loc, i) => {
    if (!loc.dc || loc.readyAt > s.hour || !s.devices.some((d) => d.rackId && locationOf(s, d)?.id === loc.id)) return;
    const r = hashRng(s.seed, s.hour, i, 94);
    if (rand(r) >= COOLING.perYear / HOURS_PER_YEAR) return;
    const minutes = Math.max(5, Math.min(COOLING.maxMinutes, Math.round(COOLING.medianMinutes * Math.exp(COOLING.sigma * normal(r)))));
    s.ops = { ...s.ops, cooling: { ...s.ops.cooling, [loc.id]: s.hour + minutes / 60 } };
    events.push({ app: "Support", key: "event.coolingFailed", params: { location: loc.name, minutes } });
  });
  for (const rack of s.racks) {
    const loc = s.locations.find((l) => l.id === rack.locationId);
    if (!loc?.dc || rack.arriveAt !== null || loc.readyAt > s.hour) continue;
    for (const feed of rack.feedB ? (["A", "B"] as const) : (["A"] as const)) {
      const r = hashRng(s.seed, s.hour, Number(rack.id.replace(/\D/g, "")), feed === "A" ? 92 : 93);
      if (rand(r) >= GRID.feedPerYear / HOURS_PER_YEAR) continue;
      feedFailure(s, rack, feed, Math.max(5, Math.min(GRID.maxMinutes, Math.round(GRID.feedMedianMinutes * Math.exp(GRID.sigma * normal(r))))), r, events);
    }
  }
  return events;
}

// The agency takes the server with every disk in it. The control plane moves to another node, and each workload restarts
// on another node of its cluster if one has room (a full node would freeze): from its backup if it has one, otherwise empty. Customers lose their data without a backup.
export function seize(s: GameState, deviceId: string, agency: string, r: Rng, events: SimEvent[]): Incident | null {
  const d = s.devices.find((x) => x.id === deviceId);
  const loc = d && locationOf(s, d);
  if (!d || !loc) return null;
  const [lo, hi] = SEIZE_MONTHS;
  const returnAt = s.hour + Math.round((lo + rand(r) * (hi - lo)) * HOURS_PER_MONTH);
  // A panel VM on the server takes its web spaces with it.
  const own = s.workloads.filter((w) => w.deviceId === d.id);
  const workloads = own.flatMap((w) => (isOwnVm(w) ? insideVm(s, w.id) : [w]));
  const hit = customersOf(s, workloads);
  s.devices = s.devices.filter((x) => x.id !== d.id);
  s.cables = s.cables.filter((c) => c.a.device !== d.id && c.b.device !== d.id);
  for (const c of s.clusters) if (c.controlPlane === d.id) moveControlPlaneOff(s, c.id, d.id);
  s.clusters = s.clusters.map((c) => (c.nodes.some((n) => n.deviceId === d.id) ? { ...c, nodes: c.nodes.filter((n) => n.deviceId !== d.id) } : c));
  s.ops = { ...s.ops, seized: [...s.ops.seized, { device: { ...d, rackId: null, slot: 0, panel: null, store: null, software: [] }, locationId: loc.id, at: s.hour, returnAt, agency }] };
  const lost = new Set<string>();
  for (const w of workloads) if (!hasBackupElsewhere(s, (vmOf(s, w) ?? w).id)) lost.add(w.serviceId);
  for (const w of own) {
    const cluster = w.clusterId ? s.clusters.find((c) => c.id === w.clusterId) : undefined;
    const to = cluster && pickNode(s, cluster, w, null, cluster.placement, true);
    if (to) s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, deviceId: to, placedAt: s.hour } : x));
  }
  for (const c of hit) {
    const svc = s.services.find((v) => v.customerId === c.id && workloads.some((w) => w.serviceId === v.id))!;
    const dataLost = s.services.some((v) => v.customerId === c.id && lost.has(v.id));
    bump(c, dataLost ? DATA_LOSS : RESTORED);
    createTicket(s, c, dataLost ? "refund" : "outage", svc.id, dataLost ? "dataLoss" : "down");
    maybeReview(s, c, dataLost ? "dataLoss" : "outage", r, events);
  }
  events.push({ app: "Support", key: "event.seized", params: { device: d.label ?? d.name, agency, location: loc.name } });
  return record(s, {
    hour: s.hour, cause: "seizure", locationId: loc.id, minutes: 0, dark: 0, devices: [d.label ?? d.name],
    customers: hit.map((c) => c.id), agency, returnAt,
  });
}

// A returned server goes into storage at the location it was taken from, or the first location if that one is gone.
export function returnSeized(s: GameState): SimEvent[] {
  const back = s.ops.seized.filter((x) => x.returnAt <= s.hour);
  if (!back.length) return [];
  s.ops = { ...s.ops, seized: s.ops.seized.filter((x) => x.returnAt > s.hour) };
  return back.map((x) => {
    const loc = s.locations.find((l) => l.id === x.locationId) ?? s.locations[0];
    s.devices = [...s.devices, { ...x.device, store: loc.id }];
    return { app: "Locations", key: "event.seizedBack", params: { device: x.device.label ?? x.device.name, location: loc.name } };
  });
}
