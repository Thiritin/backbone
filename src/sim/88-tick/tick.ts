import { addressBills, addressTick } from "../60-infra/addresses";
import { billSuppliers, invoicing, payablesTick } from "../46-finance/payables";
import { lettersTick } from "../40-support/letters";
import { paperworkTick } from "../80-business/paperwork";
import { netsvcTick } from "../60-infra/netsvc";
import { binomial, rand } from "../00-core/rng";
import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import { businessPowerPrice } from "../10-catalog/economy";
import { billingTick } from "../45-billing/billing";
import { fraudTick } from "../45-billing/fraud";
import { opsTick } from "../40-support/notices";
import { supportTick, workTick } from "../40-support/tick";
import { abandonTickets } from "../40-support/abandon";
import { financeTick } from "../46-finance/finance";
import { bankTick, tanTick } from "../46-finance/bank";
import { staffTick } from "../47-staff/staff";
import { techTick } from "../47-staff/technicians";
import { autoUpdateTick } from "../90-actions/software";
import { snapshotTick } from "../90-actions/snapshots";
import { closeLocation, noticeEnd } from "../90-actions/hardware";
import { officeOpen } from "../80-business/office";
import { fairsTick } from "../80-business/fairs";
import { communityTick } from "../80-business/sponsoring";
import { marketingTick } from "../80-business/marketing";
import { newsTick } from "../80-business/news";
import { walkTick } from "../80-business/walk";
import { deliverLicences, lexwearTick } from "../80-business/lexwear";
import { salesTick } from "../30-market/sales";
import { usedTick } from "../80-business/used";
import { ordersTick } from "../30-market/manual";
import { domainsTick } from "../30-customers/registry";
import { registrarTick } from "../30-customers/registrar";
import { mailTick } from "../80-business/mail";
import { computeTick } from "../60-infra/cluster";
import { haltTick, powerTick, pushLog, tripTick } from "../60-infra/power";
import { installNetTick } from "../60-infra/oob";
import { haTick } from "../60-infra/ha";
import { migrationTick } from "../60-infra/migration";
import { maintenanceTick } from "../60-infra/maintenance";
import { freezeTick } from "../60-infra/usage";
import { statsTick } from "../60-infra/stats";
import { networkTick } from "../60-infra/network";
import { appsTick } from "../60-infra/apps";
import { webpanelTick } from "../60-infra/webpanel";
import { gamesTick } from "../85-products/games-tick";
import { securityTick } from "../60-infra/security";
import { usageTick } from "../60-infra/usage";
import { productsTick } from "../85-products/products";
import { COMPONENTS, manufacturerByName, modelById, specOf } from "../10-catalog/hardware";
import { familyById, familyFailure } from "../10-catalog/families";
import { lessorName } from "../10-catalog/leasing";
import { BURNIN_BONUS_HOURS, BURNIN_FACTOR } from "../10-catalog/burnin";
import { burninTick } from "../60-infra/burnin";
import { THERMAL, thermalTick, throttled } from "../60-infra/thermal";
import { FAILURE_FACTOR, unsupported } from "../10-catalog/lifecycle";
import { skillById } from "../10-catalog/research";
import { KNOW_HOW, storeItem, subscriptionEntry } from "../10-catalog/store";
import { capacityAt, DATACENTERS, datacenterById, flatMonthly, homeLineById, HOUSEHOLD_FACTOR } from "../20-world/datacenters";
import type { Component, Device, GameState, LedgerEntry } from "../50-state";
import { scoreTick } from "../80-business/scores";
import { trendTick } from "../80-business/trend";
import { arrayLost, busyDevices, dcAvailability, drawWatts, driveGb, drivesOf, fits, isDrive, HOURS_PER_YEAR, locationOf, locationRent, powered, readOnlySweep } from "../60-infra/status";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

const cents = (v: number) => Math.round(v * 100) / 100;

// A cancelled contract closes its location when the notice period ends. A location still holding hardware rolls one more month.
function contractsEnd(state: GameState, events: SimEvent[]): void {
  for (const c of state.contracts) {
    if (c.endsAt === null || c.endsAt > state.hour) continue;
    const loc = state.locations.find((l) => l.id === c.locationId);
    if (closeLocation(state, c.locationId).ok) { events.push({ app: "Locations", key: "event.contractEnded", params: { location: loc?.name ?? "" } }); continue; }
    c.endsAt = noticeEnd(state.hour, 0);
    events.push({ app: "Locations", key: "event.contractRolled", params: { location: loc?.name ?? "" } });
  }
}

// Drops the lease and makes its devices owned.
export function endLease(s: GameState, leaseId: string) {
  s.leases = s.leases.filter((l) => l.id !== leaseId);
  s.devices = s.devices.map((d) => (d.lease === leaseId ? { ...d, lease: null } : d));
}

// Euros of power drawn in one hour: every powered device at the business price × the datacenter's power factor, or the household price in the basement.
// Racks on a flat-rate contract pay it monthly instead.
export function powerPerHour(s: GameState): number {
  const price = businessPowerPrice(yearOf(s.hour));
  const busy = busyDevices(s), flat = new Set(s.racks.filter((r) => r.flatKw).map((r) => r.id));
  return readOnlySweep(s, () => s.devices.filter((d) => d.on && !flat.has(d.rackId ?? "") && powered(s, d.id))).reduce((sum, d) => {
    const loc = locationOf(s, d)!;
    return sum + (drawWatts(d, busy) / 1000) * price * (loc.dc ? datacenterById(loc.dc).powerFactor : HOUSEHOLD_FACTOR);
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

// Each component of a running device fails at its yearly rate for its age, × the manufacturer's factor, × its part maker's,
// × 1 + its hot hours ÷ THERMAL.wearHours, × 1.2 once the device is out of support, × 0.9 for a year after a passed full burn-in.
export function failureChance(s: GameState, d: Device, c: Component): number {
  const spec = COMPONENTS[c.kind];
  const yearly = modelById(d.model).failYearly ?? (s.hour - c.installedAt < spec.life * HOURS_PER_YEAR ? spec.before : spec.after);
  const hot = 1 + (d.hotHours ?? 0) / THERMAL.wearHours;
  const old = unsupported(d.model, s.hour) ? FAILURE_FACTOR : 1;
  const burned = d.burnedInAt !== null && s.hour - d.burnedInAt < BURNIN_BONUS_HOURS ? BURNIN_FACTOR : 1;
  const family = familyById(c.sku);
  return (yearly * (manufacturerByName(d.brand)?.failureFactor ?? 1) * (family ? familyFailure(family) : 1) * hot * old * burned) / HOURS_PER_YEAR;
}

// Records failed components on a device: a drive failure the array can't survive loses its data and stops any rebuild.
// The failure is always recorded; the notification needs the monitoring unlock.
export function failComponents(s: GameState, d: Device, ids: string[], events: SimEvent[] = []): Device {
  const broke = d.components.filter((c) => ids.includes(c.id) && c.failedAt === null);
  if (!broke.length) return d;
  const next: Device = { ...d, components: d.components.map((c) => (broke.includes(c) ? { ...c, failedAt: s.hour } : c)) };
  for (const c of broke) pushLog(next, s.hour, `ipmi.log.failed.${c.kind}`);
  if (broke.some(isDrive) && arrayLost(next)) Object.assign(next, { dataLost: s.hour, rebuild: null });
  if (d.refund && s.hour < d.refund.until) {
    s.cash = Math.round((s.cash + d.refund.amount) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key: "ledger.usedRefund", params: { device: d.label ?? d.name }, amount: d.refund.amount }];
    events.push({ app: "Locations", key: "event.usedRefund", params: { device: d.label ?? d.name, amount: d.refund.amount } });
    next.refund = null;
  }
  if (s.unlocks.includes("monitoring")) {
    for (const c of broke) events.push({ app: "Locations", key: "event.componentFailed", params: { device: d.label ?? d.name, component: c.kind } });
  }
  return next;
}

function wear(s: GameState, events: SimEvent[]) {
  // powered() reads the devices from before this sweep, so its rack power can be memoised.
  s.devices = readOnlySweep(s, () => s.devices.map((d) => {
    if (!d.components.length || !d.on || !powered(s, d.id)) return d;
    if (throttled(s, d)) d = { ...d, hotHours: (d.hotHours ?? 0) + 1 };
    const broke = d.components.filter((c) => c.failedAt === null && rand(s.rng) < failureChance(s, d, c));
    return broke.length ? failComponents(s, d, broke.map((c) => c.id), events) : d;
  }));
}

// Finished swaps put a new component in; a drive in an array that survived starts a rebuild. Finished rebuilds end.
function service(s: GameState, events: SimEvent[]) {
  s.devices = s.devices.map((d) => {
    let next = d;
    if (d.maintenance && d.maintenance.doneAt <= s.hour) {
      events.push({ app: "Locations", key: "event.workDone", params: { device: d.label ?? d.name } });
      const old = d.components.find((c) => c.id === d.maintenance!.componentId);
      // Installing or removing a part changed the device when it started; the work only keeps it busy.
      if (!old) next = { ...d, maintenance: null };
      else {
        const top = Math.max(...d.components.map((c) => Number(c.id.slice(1)) || 0)), id = `c${top + 1}`;
        const isDrive = drivesOf(d).includes(old), spec = d.maintenance.spec;
        const rebuild = isDrive && d.raid !== "none" && !arrayLost(d) ? { componentId: id, doneAt: s.hour + rebuildHours(d) } : d.rebuild;
        // A swap of every CPU socket replaces the others too.
        const swapped = [old.id, ...(d.maintenance.others ?? [])];
        next = {
          ...d, maintenance: null, rebuild,
          components: d.components.map((c) => {
            const i = swapped.indexOf(c.id);
            return i < 0 ? c : {
              ...specOf({ kind: c.kind, size: spec?.size ?? c.size, ff: spec?.ff ?? c.ff, vendor: spec?.vendor ?? c.vendor, gen: spec?.gen ?? c.gen }),
              id: `c${top + 1 + i}`, installedAt: s.hour, failedAt: null,
            };
          }),
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
  const minutes = 60 - state.minute;
  state.hour++;
  state.minute = 0;
  tanTick(state);
  haltTick(state);
  installNetTick(state);
  const events: SimEvent[] = [...tripTick(state), ...thermalTick(state, minutes)];
  // The store shallow-copies the state before ticking, so arrays and their items are replaced rather than changed.
  if (state.racks.some((r) => r.arriveAt !== null && r.arriveAt <= state.hour)) {
    state.racks = state.racks.map((r) => {
      if (r.arriveAt === null || r.arriveAt > state.hour) return r;
      const loc = state.locations.find((l) => l.id === r.locationId)!;
      events.push({ app: "Locations", key: "event.rackArrived", params: { rack: r.name, location: loc.name } });
      return { ...r, arriveAt: null };
    });
  }
  if (state.racks.some((r) => r.extraKwAt && r.extraKwAt.at <= state.hour)) {
    state.racks = state.racks.map((r) => (r.extraKwAt && r.extraKwAt.at <= state.hour ? { ...r, extraKw: r.extraKwAt.kw, extraKwAt: null } : r));
  }
  if (state.racks.some((r) => r.flatKwAt && r.flatKwAt.at <= state.hour)) {
    state.racks = state.racks.map((r) => (r.flatKwAt && r.flatKwAt.at <= state.hour ? { ...r, flatKw: r.flatKwAt.kw, flatKwAt: null } : r));
  }
  if (state.devices.some((d) => d.arriveAt !== null && d.arriveAt <= state.hour)) {
    const arrived = new Map<string, number>();
    state.devices = state.devices.map((d) => {
      if (d.arriveAt === null || d.arriveAt > state.hour) return d;
      if (!d.chassisId) arrived.set(d.transitTo!, (arrived.get(d.transitTo!) ?? 0) + 1);
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
  if (!state.registration && officeOpen(state.hour) && !officeOpen(state.hour - 1)) events.push({ app: "Browser", key: "event.officeOpen", params: {} });
  if (state.training && state.training.doneAt <= state.hour) {
    const skill = skillById(state.training.id)!;
    state.unlocks = [...state.unlocks, skill.id];
    state.training = null;
    events.push({ app: "Research", key: "event.trainingDone", params: { id: skill.id, skill: skill.name } });
  }
  state.rng = { ...state.rng };
  wear(state, events);
  burninTick(state, events);
  if (state.devices.some((d) => d.maintenance || d.rebuild)) service(state, events);
  events.push(...powerTick(state));
  const monthStart = isMonthStart(state.hour);
  if (monthStart) {
    competitorsCancel(state);
  }
  if (state.waitlist.length) updateHolds(state, events);
  contractsEnd(state, events);
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
    for (const r of state.racks.filter((x) => x.flatKw)) {
      const dc = datacenterById(state.locations.find((l) => l.id === r.locationId)!.dc!);
      bills.push({ hour: state.hour, category: "rent", key: "ledger.flatPower", params: { rack: r.name, kw: r.flatKw }, amount: -flatMonthly(dc, r.flatKw, yearOf(state.hour)) });
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
      if (item && item.monthly > 0) bills.push(subscriptionEntry(state, item));
    }
    if (power > 0) bills.unshift({ hour: state.hour, category: "power", key: "ledger.power", params: {}, amount: -power });
    const dc = state.locations.find((l) => l.dc);
    const direct = invoicing(state) ? billSuppliers(state, bills, { upstream: line.isp, datacenter: dc && datacenterById(dc.dc!).name }) : bills;
    const rent = bills.filter((b) => b.category === "rent").reduce((sum, b) => sum - b.amount, 0);
    const leasing = bills.filter((b) => b.category === "leasing").reduce((sum, b) => sum - b.amount, 0);
    const subscriptions = cents(bills.filter((b) => b.category === "subscriptions").reduce((sum, b) => sum - b.amount, 0));
    state.cash = cents(state.cash + direct.reduce((n, b) => n + b.amount, 0));
    state.powerDue = 0;
    state.ledger = [...state.ledger, ...direct];
    if (bills.length) events.push({ app: "Finance", key: "event.bills", params: { power, rent, leasing: cents(leasing), subscriptions, total: cents(power + rent + leasing + subscriptions) } });
    state.knowHow = cents(state.knowHow + knowHowPerMonth(state));
  }
  events.push(...addressTick(state));
  events.push(...netsvcTick(state));
  events.push(...opsTick(state));
  events.push(...freezeTick(state));
  events.push(...haTick(state));
  events.push(...maintenanceTick(state));
  events.push(...computeTick(state));
  snapshotTick(state);
  events.push(...communityTick(state));
  events.push(...migrationTick(state));
  events.push(...productsTick(state));
  events.push(...usageTick(state));
  gamesTick(state);
  statsTick(state);
  events.push(...billingTick(state));
  events.push(...fraudTick(state));
  events.push(...lexwearTick(state));
  events.push(...ordersTick(state));
  events.push(...domainsTick(state));
  events.push(...registrarTick(state));
  mailTick(state);
  events.push(...networkTick(state));
  events.push(...securityTick(state));
  events.push(...appsTick(state));
  events.push(...webpanelTick(state));
  events.push(...supportTick(state));
  abandonTickets(state);
  events.push(...financeTick(state));
  events.push(...bankTick(state));
  paperworkTick(state);
  lettersTick(state);
  payablesTick(state);
  events.push(...staffTick(state));
  events.push(...techTick(state));
  events.push(...autoUpdateTick(state));
  events.push(...fairsTick(state));
  events.push(...marketingTick(state));
  events.push(...newsTick(state));
  events.push(...walkTick(state));
  events.push(...salesTick(state));
  events.push(...usedTick(state));
  scoreTick(state);
  trendTick(state);
  return events;
}

// One game minute: queued hand work lands at its minute, and the sixtieth minute is the hourly tick.
export function tickMinute(state: GameState): SimEvent[] {
  if (state.minute >= 59) return tick(state);
  state.minute++;
  haltTick(state);
  installNetTick(state);
  const tripped = tripTick(state);
  tanTick(state);
  return [...tripped, ...thermalTick(state), ...workTick(state), ...deliverLicences(state)];
}
