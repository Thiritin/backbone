import { addressBills, addressTick } from "../60-infra/addresses";
import { binomial, rand } from "../00-core/rng";
import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { businessPowerPrice } from "../10-catalog/economy";
import { billingTick } from "../45-billing/billing";
import { opsTick } from "../40-support/notices";
import { supportTick } from "../40-support/tick";
import { abandonTickets } from "../40-support/abandon";
import { financeTick } from "../46-finance/finance";
import { staffTick } from "../47-staff/staff";
import { techTick } from "../47-staff/technicians";
import { fairsTick } from "../80-business/fairs";
import { marketingTick } from "../80-business/marketing";
import { salesTick } from "../30-market/sales";
import { ordersTick } from "../30-market/manual";
import { domainsTick } from "../30-customers/registry";
import { computeTick } from "../60-infra/cluster";
import { haTick } from "../60-infra/ha";
import { freezeTick } from "../60-infra/usage";
import { networkTick } from "../60-infra/network";
import { securityTick } from "../60-infra/security";
import { usageTick } from "../60-infra/usage";
import { productsTick } from "../85-products/products";
import { COMPONENTS, manufacturerByName, modelById } from "../10-catalog/hardware";
import { lessorName } from "../10-catalog/leasing";
import { skillById } from "../10-catalog/research";
import { KNOW_HOW, storeItem, subscriptionPrice } from "../10-catalog/store";
import { capacityAt, DATACENTERS, datacenterById, homeLineById, HOUSEHOLD_FACTOR } from "../20-world/datacenters";
import type { Component, Device, GameState, LedgerEntry } from "../50-state";
import { arrayLost, dcAvailability, driveGb, drivesOf, fits, isDrive, HOURS_PER_YEAR, locationOf, locationRent, powered } from "../60-infra/status";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

const cents = (v: number) => Math.round(v * 100) / 100;

// Drops the lease and makes its devices owned.
export function endLease(s: GameState, leaseId: string) {
  s.leases = s.leases.filter((l) => l.id !== leaseId);
  s.devices = s.devices.map((d) => (d.lease === leaseId ? { ...d, lease: null } : d));
}

// Euros of power drawn in one hour: every powered device at the business price × the datacenter's power factor, or the household price in the basement.
export function powerPerHour(s: GameState): number {
  const price = businessPowerPrice(yearOf(s.hour));
  return s.devices.filter((d) => d.on && powered(s, d.id)).reduce((sum, d) => {
    const loc = locationOf(s, d)!;
    return sum + (modelById(d.model).watts / 1000) * price * (loc.dc ? datacenterById(loc.dc).powerFactor : HOUSEHOLD_FACTOR);
  }, 0);
}

export const CANCEL_CHANCE = 0.015;
export const FREE_TARGET = 0.04;
export const HOLD_HOURS = 7 * 24;

const setOthers = (s: GameState, id: string, others: number) => {
  s.dcs = { ...s.dcs, [id]: { others } };
};

// Every competitor position cancels with a small chance each month.
function competitorsCancel(s: GameState) {
  for (const dc of DATACENTERS) setOthers(s, dc.id, s.dcs[dc.id].others - binomial(s.rng, s.dcs[dc.id].others, CANCEL_CHANCE));
}

// In the first 3 months of an expansion phase competitors take a sixth of the new positions a month; otherwise they fill
// free space down to a random level between 0% and 4% of capacity. Held and player space is never taken.
function competitorsTake(s: GameState) {
  const year = yearOf(s.hour), month = dateOf(s.hour).getUTCMonth();
  for (const dc of DATACENTERS) {
    const { capacity, free } = dcAvailability(s, dc.id);
    const phase = capacity - capacityAt(dc, year - 1);
    const take = phase > 0 && month < 3 ? Math.round(phase / 6) : free - Math.floor(rand(s.rng) * FREE_TARGET * capacity);
    if (take > 0) setOthers(s, dc.id, s.dcs[dc.id].others + Math.min(free, take));
  }
}

// Expired holds are released; waiting entries whose space is free get it held, in the order they joined.
function updateHolds(s: GameState, events: SimEvent[]) {
  for (const w of s.waitlist) {
    const name = datacenterById(w.dc).name;
    if (w.heldUntil !== null && w.heldUntil <= s.hour) {
      s.waitlist = s.waitlist.filter((x) => x.id !== w.id);
      events.push({ app: "Locations", key: "event.holdExpired", params: { datacenter: name } });
    } else if (w.heldUntil === null && fits(s, w.dc, w.space, w.size)) {
      s.waitlist = s.waitlist.map((x) => (x.id === w.id ? { ...x, heldUntil: s.hour + HOLD_HOURS } : x));
      events.push({ app: "Locations", key: "event.spaceHeld", params: { datacenter: name, days: HOLD_HOURS / 24 } });
    }
  }
}

export const REBUILD_MBPS = { low: 50, medium: 150, high: 400 } as const;
// ponytail: drives count as 70% full until workloads fill them; rebuild time then follows real usage.
export const DRIVE_USED_SHARE = 0.7;
export const FEED_PRICE = { feedB: 0.4, highDensity: 0.6 } as const;

export const rebuildHours = (d: Device): number => {
  return (driveGb(d) * 1000 * DRIVE_USED_SHARE) / REBUILD_MBPS[d.rebuildRate] / 3600;
};

// Each component of a running device fails at its yearly rate for its age, × the manufacturer's factor, × 2 while a fan is out.
export function failureChance(s: GameState, d: Device, c: Component): number {
  const spec = COMPONENTS[c.kind];
  const yearly = s.hour - c.installedAt < spec.life * HOURS_PER_YEAR ? spec.before : spec.after;
  const hot = d.components.some((x) => x.kind === "fan" && x.failedAt !== null) ? 2 : 1;
  return (yearly * (manufacturerByName(d.brand)?.failureFactor ?? 1) * hot) / HOURS_PER_YEAR;
}

// Records failed components on a device: a drive failure the array can't survive loses its data and stops any rebuild.
// The failure is always recorded; the notification needs the monitoring unlock.
export function failComponents(s: GameState, d: Device, ids: string[], events: SimEvent[] = []): Device {
  const broke = d.components.filter((c) => ids.includes(c.id) && c.failedAt === null);
  if (!broke.length) return d;
  const next: Device = { ...d, components: d.components.map((c) => (broke.includes(c) ? { ...c, failedAt: s.hour } : c)) };
  if (broke.some(isDrive) && arrayLost(next)) Object.assign(next, { dataLost: s.hour, rebuild: null });
  if (s.unlocks.includes("monitoring")) {
    for (const c of broke) events.push({ app: "Locations", key: "event.componentFailed", params: { device: d.label ?? d.name, component: c.kind } });
  }
  return next;
}

function wear(s: GameState, events: SimEvent[]) {
  s.devices = s.devices.map((d) => {
    if (!d.components.length || !d.on || !powered(s, d.id)) return d;
    const broke = d.components.filter((c) => c.failedAt === null && rand(s.rng) < failureChance(s, d, c));
    return broke.length ? failComponents(s, d, broke.map((c) => c.id), events) : d;
  });
}

// Finished swaps put a new component in; a drive in an array that survived starts a rebuild. Finished rebuilds end.
function service(s: GameState) {
  s.devices = s.devices.map((d) => {
    let next = d;
    if (d.maintenance && d.maintenance.doneAt <= s.hour) {
      const old = d.components.find((c) => c.id === d.maintenance!.componentId);
      // Installing or removing a part changed the device when it started; the work only keeps it busy.
      if (!old) next = { ...d, maintenance: null };
      else {
        const id = `c${Math.max(...d.components.map((c) => Number(c.id.slice(1)) || 0)) + 1}`;
        const isDrive = drivesOf(d).includes(old), spec = d.maintenance.spec;
        const rebuild = isDrive && d.raid !== "none" && !arrayLost(d) ? { componentId: id, doneAt: s.hour + rebuildHours(d) } : d.rebuild;
        next = {
          ...d, maintenance: null, rebuild,
          components: d.components.map((c) => (c.id === old.id ? { id, kind: c.kind, installedAt: s.hour, failedAt: null, size: spec?.size ?? c.size, ff: spec?.ff ?? c.ff } : c)),
        };
      }
    }
    if (next.rebuild && next.rebuild.doneAt <= s.hour) next = { ...next, rebuild: null };
    return next;
  });
}

// Every contract running at the month start earns its product's know-how.
export const knowHowPerMonth = (s: GameState): number =>
  s.services.filter((v) => v.endedAt === null).reduce((sum, v) => sum + KNOW_HOW[v.product], 0);

export function tick(state: GameState): SimEvent[] {
  state.powerDue += powerPerHour(state);
  state.hour++;
  const events: SimEvent[] = [];
  // The store shallow-copies the state before ticking, so arrays and their items are replaced rather than changed.
  if (state.racks.some((r) => r.arriveAt !== null && r.arriveAt <= state.hour)) {
    state.racks = state.racks.map((r) => {
      if (r.arriveAt === null || r.arriveAt > state.hour) return r;
      const loc = state.locations.find((l) => l.id === r.locationId)!;
      events.push({ app: "Locations", key: "event.rackArrived", params: { rack: r.name, location: loc.name } });
      return { ...r, arriveAt: null };
    });
  }
  if (state.devices.some((d) => d.arriveAt !== null && d.arriveAt <= state.hour)) {
    const arrived = new Map<string, number>();
    state.devices = state.devices.map((d) => {
      if (d.arriveAt === null || d.arriveAt > state.hour) return d;
      arrived.set(d.transitTo!, (arrived.get(d.transitTo!) ?? 0) + 1);
      return { ...d, store: d.transitTo, transitTo: null, arriveAt: null };
    });
    for (const [id, count] of arrived) {
      events.push({ app: "Locations", key: "event.stockArrived", params: { count, location: state.locations.find((l) => l.id === id)!.name } });
    }
  }
  const next = state.homeLine.next;
  if (next && next.at <= state.hour) {
    state.homeLine = { id: next.id, next: null };
    const line = homeLineById(next.id);
    events.push({ app: "Locations", key: "event.lineReady", params: { line: line.name, isp: line.isp } });
  }
  if (state.training && state.training.doneAt <= state.hour) {
    const skill = skillById(state.training.id)!;
    state.unlocks = [...state.unlocks, skill.id];
    state.training = null;
    events.push({ app: "Research", key: "event.trainingDone", params: { id: skill.id, skill: skill.name } });
  }
  state.rng = { ...state.rng };
  wear(state, events);
  if (state.devices.some((d) => d.maintenance || d.rebuild)) service(state);
  const monthStart = isMonthStart(state.hour);
  if (monthStart) {
    competitorsCancel(state);
  }
  if (state.waitlist.length) updateHolds(state, events);
  if (monthStart) competitorsTake(state);
  if (monthStart) {
    const d = dateOf(state.hour);
    events.push({ app: "Finance", key: "event.monthStart", params: { month: d.getUTCMonth(), year: d.getUTCFullYear() } });
    const power = cents(state.powerDue);
    const bills: LedgerEntry[] = state.locations.filter((l) => l.dc)
      .map((l) => ({ hour: state.hour, category: "rent", key: "ledger.space", params: { location: l.name }, amount: -locationRent(state, l) }));
    for (const r of state.racks) {
      const loc = state.locations.find((l) => l.id === r.locationId)!;
      if (!loc.dc) continue;
      for (const feed of ["feedB", "highDensity"] as const) {
        if (r[feed]) bills.push({ hour: state.hour, category: "rent", key: "ledger.feed", params: { rack: r.name, feed }, amount: -Math.round(FEED_PRICE[feed] * datacenterById(loc.dc).positionPrice) });
      }
    }
    const line = homeLineById(state.homeLine.id);
    bills.push(...addressBills(state));
    if (line.monthly > 0) bills.push({ hour: state.hour, category: "rent", key: "ledger.homeLine", params: { line: line.name, isp: line.isp }, amount: -line.monthly });
    const leases = state.leases.map((l) => ({ ...l, paid: l.paid + 1 }));
    for (const l of leases) bills.push({ hour: state.hour, category: "leasing", key: "ledger.lease", params: { lessor: lessorName(l.lessor), paid: l.paid, months: l.months }, amount: -l.monthly });
    state.leases = leases;
    for (const l of leases.filter((x) => x.paid >= x.months)) endLease(state, l.id);
    for (const id of state.installed) {
      const item = storeItem(id);
      if (item && item.monthly > 0) bills.push({ hour: state.hour, category: "subscriptions", key: "ledger.subscription", params: { name: item.name }, amount: -subscriptionPrice(item, yearOf(state.hour)) });
    }
    if (power > 0) bills.unshift({ hour: state.hour, category: "power", key: "ledger.power", params: {}, amount: -power });
    const rent = bills.filter((b) => b.category === "rent").reduce((sum, b) => sum - b.amount, 0);
    const leasing = bills.filter((b) => b.category === "leasing").reduce((sum, b) => sum - b.amount, 0);
    const subscriptions = cents(bills.filter((b) => b.category === "subscriptions").reduce((sum, b) => sum - b.amount, 0));
    state.cash = cents(state.cash - power - rent - leasing - subscriptions);
    state.powerDue = 0;
    state.ledger = [...state.ledger, ...bills];
    if (bills.length) events.push({ app: "Finance", key: "event.bills", params: { power, rent, leasing: cents(leasing), subscriptions, total: cents(power + rent + leasing + subscriptions) } });
    state.knowHow = cents(state.knowHow + knowHowPerMonth(state));
  }
  events.push(...addressTick(state));
  events.push(...opsTick(state));
  events.push(...freezeTick(state));
  events.push(...haTick(state));
  events.push(...computeTick(state));
  events.push(...productsTick(state));
  events.push(...usageTick(state));
  events.push(...billingTick(state));
  events.push(...ordersTick(state));
  events.push(...domainsTick(state));
  events.push(...networkTick(state));
  events.push(...securityTick(state));
  events.push(...supportTick(state));
  abandonTickets(state);
  events.push(...financeTick(state));
  events.push(...staffTick(state));
  events.push(...techTick(state));
  events.push(...fairsTick(state));
  events.push(...marketingTick(state));
  events.push(...salesTick(state));
  return events;
}
