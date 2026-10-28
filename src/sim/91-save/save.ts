import { RENAMED_MODELS } from "../10-catalog/hardware";
import { yearOf } from "../00-core/time";
import { capacityAt, DATACENTERS, nextAz, seedDcs } from "../20-world/datacenters";
import { skillById, skillFor } from "../10-catalog/research";
import { STARTER_APPS, WIDGETS } from "../10-catalog/store";
import { deviceDefaults, newGame, SAVE_VERSION, type Device, type GameState } from "../50-state";
import { clusterDefaults, workloadDefaults } from "../60-infra/cluster";
import { fillDomains } from "../30-customers/domains";
import { fillLines } from "../80-business/website";

// ponytail: plain JSON in localStorage; compress once saves approach the ~5 MB limit.
export const serialize = (state: GameState): string => JSON.stringify(state);

const REPAIR_FLOOR = 0.8;

const learned = (id: string): string[] => {
  const skill = skillById(id) ?? skillFor(id);
  return skill ? [...skill.needs.flatMap(learned), skill.id] : [id];
};
const INFRA = ["nextId", "locations", "racks", "devices", "cables"] as const;

// Old saves keep loading: every field missing from a save takes its new-game default.
// A version 1 save (the basement shelf, or no infrastructure at all) gets the version 2 starting infrastructure.
export function deserialize(raw: string): GameState {
  const data = JSON.parse(raw) as Partial<GameState>;
  if (typeof data.seed !== "number") throw new Error("save has no seed");
  const base = newGame(data.seed);
  if ((data.version ?? 1) < 2) for (const k of INFRA) delete data[k];
  const locations: GameState["locations"] = [];
  for (const l of data.locations ?? base.locations) locations.push({ ...l, az: l.az ?? nextAz(locations, l.city), extraCircuit: l.extraCircuit ?? false });
  // Older saves had one stockroom; its units go to the first location.
  const stored = (d: Device) => d.store !== undefined ? d.store : !d.rackId && !d.panel ? locations[0].id : null;
  // Old devices get the components of their model, installed when they were bought.
  const devices = (data.devices ?? base.devices).map((d) => {
    const model = RENAMED_MODELS[d.model] ?? d.model;
    return {
      ...deviceDefaults(model, d.boughtAt ?? 0), ...d, model, lease: d.lease ?? null, store: stored(d), transitTo: d.transitTo ?? null, arriveAt: d.arriveAt ?? null,
    };
  });
  const racks = (data.racks ?? base.racks).map((r) => ({ ...r, provided: r.provided ?? false, feedB: r.feedB ?? false, highDensity: r.highDensity ?? false }));
  const cables = (data.cables ?? base.cables).map((c) => ({ ...c, color: c.color ?? null }));
  // Competitors fill datacenters the save has not seen yet as if the game had started this year. A datacenter far below
  // last year's capacity can't come from play (competitors refill every month), so it is reseeded for this year too.
  const year = yearOf(data.hour ?? 0);
  const seeded = seedDcs(data.seed, year);
  const dcs = Object.fromEntries(DATACENTERS.map((dc) => {
    const kept = data.dcs?.[dc.id];
    return [dc.id, kept && kept.others >= REPAIR_FLOOR * capacityAt(dc, year - 1) ? kept : seeded[dc.id]];
  }));
  return fillLines(fillDomains({
    ...base, ...data, dcs, locations, devices, racks, cables, rng: { ...base.rng, ...data.rng }, version: SAVE_VERSION,
    billingRules: { ...base.billingRules, ...data.billingRules },
    company: { ...base.company, ...data.company },
    network: { ...base.network, ...data.network },
    ops: { ...base.ops, ...data.ops },
    security: { ...base.security, ...data.security },
    marketing: { ...base.marketing, ...data.marketing, awareness: { ...base.marketing.awareness, ...data.marketing?.awareness } },
    // Saves from before the Pear Store keep every widget they showed.
    // The Research app was called Unlocks.
    // Saves from before the Sales and Website apps get them in the dock.
    installed: data.installed ? [...new Set([...data.installed.map((id) => (id === "Unlocks" ? "Research" : id)), "Sales", "Website"])] : [...STARTER_APPS, ...WIDGETS.map(([id]) => id)],
    // Older saves researched Pear Store items directly; each becomes its skill and that skill's prerequisites.
    unlocks: [...new Set((data.unlocks ?? []).flatMap(learned))],
    customers: (data.customers ?? []).map((c) => ({ ...c, history: c.history ?? [] })),
    services: (data.services ?? []).map((v) => ({ ...v, zone: v.zone ?? null, plan: v.plan ?? null, sla: v.sla ?? "basic" })),
    // Saves from before clusters keep their services unplaced, which leaves them online.
    sales: { ...base.sales, ...data.sales },
    staff: (data.staff ?? []).map((e) => ({ ...e, location: e.location ?? null, hours: e.hours ?? 8, hoursFrom: e.hoursFrom ?? 0 })),
    techRules: { ...base.techRules, ...data.techRules },
    clusters: (data.clusters ?? []).map((c) => clusterDefaults(c, data.hour ?? 0)), workloads: (data.workloads ?? []).map(workloadDefaults), downHours: data.downHours ?? {},
    invoices: (data.invoices ?? []).map((i) => ({ ...i, suspendedAt: i.suspendedAt ?? (i.suspended ? data.hour ?? 0 : null), extendedUntil: i.extendedUntil ?? null })),
  }), data.marketing?.lines);
}
