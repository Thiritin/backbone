import { rand } from "../00-core/rng";
import { monthIndexOf, yearOf } from "../00-core/time";
import { boardVendor, brandOnSale, brandsOf, cpuOptions, offersPart, isOfficeRouter, COMPONENT_KINDS, COMPONENTS, componentParts, deliveryHours, dualPsuModel, fits as chassisFits, genOf, hasBmc, isDriveKind, modelById, oobPortOf, partOffers, priceOf, samePart, shopModels, specOf, SWITCH_BRAND, slotsOf, vendorsOf, type ComponentKind, type DeviceModel, type FormFactor, type PartSpec } from "../10-catalog/hardware";
import type { Vendor } from "../10-catalog/cpus";
import { leaseOffers, lessorName } from "../10-catalog/leasing";
import { greySurcharge, workFactor } from "../10-catalog/lifecycle";
import { partPrice, partsPrice, presetPrice } from "../10-catalog/parts";
import { BASEMENT, DATACENTERS, datacenterById, EXTRA_POWER_LEAD_DAYS, EXTRA_STEP_KW, FLAT_CONTRACTS, HOME_LINES, maxExtraKw, LEAD_DAYS, nextAz, RACK_MODELS, rackUnits, SHARE_RACKS, SPACE_SIZES, spacePrice } from "../20-world/datacenters";
import { deviceDefaults, type BondMode, type Component, type Device, type End, type GameState, type RackModel, type RaidLevel, type RebuildRate } from "../50-state";
import { arrayLost, bootHours, connectError, drivesOf, energized, fits, flatOffer, freePositions, holdsData, nodesOf, freeSlots, HOURS_PER_YEAR, hotKind, hotSwappable, isPlugged, locationOf, moveCost, psusOf, deviceValue, resaleValue, spotOf, travelCost, working } from "../60-infra/status";
import { claimRepair } from "../46-finance/finance";
import { atFront, BMC_RESET_HOURS, bootUp, halt, hardReboot, plugCords, pullPlug, pushLog, rollStuck, type FrontOp } from "../60-infra/power";
import { hasPdu, pduOf } from "../60-infra/pdu";
import { kvmPower, lockoutRoll } from "../60-infra/oob";
import { handJob, present, trip as drive, type HandJob, type How } from "../60-infra/handwork";
import { drive as driveTo } from "./travel";
import { endLease, rebuildHours } from "../88-tick/tick";
import { cardsFree, serverTaken, vmById } from "../60-infra/cluster";
import { renumber, renumberError } from "../60-infra/addresses";
import { plannedFor } from "../60-infra/maintenance";
import { announceNow } from "./maintenance";
import { freeName } from "./clusters";
import { nodeName } from "../30-customers/hostnames";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
const ROLE = { server: "srv", switch: "sw", firewall: "fw", gateway: "gw", patch: "pp", ups: "ups", pdu: "pdu", part: "part", kvm: "kvm", console: "con", oob: "oob", chassis: "twin" } as const;
const roleOf = (modelId: string) => ROLE[modelById(modelId).kind];
const cents = (v: number) => Math.round(v * 100) / 100;

// Device and rack names start with the zone: fra1-srv-01.
const prefix = (s: GameState, locationId: string): string => s.locations.find((l) => l.id === locationId)!.az;

function nextName(base: string, taken: string[]): string {
  const n = Math.max(0, ...taken.filter((x) => x.startsWith(`${base}-`)).map((x) => Number(x.slice(base.length + 1)) || 0)) + 1;
  return `${base}-${String(n).padStart(2, "0")}`;
}

const book = (s: GameState, category: string, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger.push({ hour: s.hour, category, key, params, amount });
};
const unplug = (s: GameState, deviceIds: Set<string>, keep = (_: string) => false) => {
  s.cables = s.cables.filter((c) => !((deviceIds.has(c.a.device) && !keep(c.b.device)) || (deviceIds.has(c.b.device) && !keep(c.a.device))));
};

// A rack at a site that only bills flat starts on the smaller contract.
const flatDefault = (s: GameState, locationId: string): number => (flatOffer(s, locationId) === "flat" ? FLAT_CONTRACTS[0].kw : 0);

// For a share, size is n for 1/n of a rack; the location then has one position, taken by the provider's rack.
export function addLocation(s: GameState, dcId: string, space: "share" | "cage" | "suite", size: number): ActionResult {
  const dc = DATACENTERS.find((d) => d.id === dcId);
  if (!dc) return fail("error.unknownDatacenter");
  if (!SPACE_SIZES[space]?.includes(size)) return fail("error.unknownSize");
  if (space === "cage" && !dc.cages) return fail("error.noCages");
  // A waitlist hold for exactly this space reserves it; otherwise the space must be free now.
  const hold = s.waitlist.find((w) => w.dc === dcId && w.space === space && w.size === size && w.heldUntil !== null);
  if (!hold && !fits(s, dcId, space, size)) return fail("error.noSpace");
  if (s.cash < spacePrice(dc, space, size)) return fail("error.noCash");
  if (hold) s.waitlist = s.waitlist.filter((w) => w.id !== hold.id);
  const positions = space === "share" ? 1 : size;
  const loc = { id: newId(s, "loc"), dc: dc.id, city: dc.city, az: nextAz(s.locations, dc.city), name: dc.name, space, positions, readyAt: s.hour + 24 * LEAD_DAYS[space], extraCircuit: false };
  s.locations.push(loc);
  const name = nextName(`${prefix(s, loc.id)}-gw`, s.devices.map((d) => d.name));
  s.devices.push({ id: newId(s, "dev"), model: "handoff", brand: SWITCH_BRAND, rackId: null, slot: 0, panel: loc.id, name, bond: "none", groups: [], price: 0, boughtAt: s.hour, lease: null, store: null, transitTo: null, arriveAt: null, ...deviceDefaults("handoff", s.hour) });
  const shareRack = space === "share" && SHARE_RACKS.find((m) => m.size === size)!;
  if (shareRack) {
    const rackName = nextName(`${prefix(s, loc.id)}-rack`, s.racks.map((r) => r.name));
    s.racks.push({ id: newId(s, "rack"), model: shareRack.id, locationId: loc.id, position: 1, name: rackName, arriveAt: null, price: 0, boughtAt: s.hour, provided: true, feedB: false, highDensity: false, extraKw: 0, extraKwAt: null, flatKw: 0, flatKwAt: null });
  }
  return { ok: true, id: loc.id };
}

// Waits for space that is not free yet; tick holds it for 7 days once it is.
export function joinWaitlist(s: GameState, dcId: string, space: "share" | "cage" | "suite", size: number): ActionResult {
  const dc = DATACENTERS.find((d) => d.id === dcId);
  if (!dc) return fail("error.unknownDatacenter");
  if (!SPACE_SIZES[space]?.includes(size)) return fail("error.unknownSize");
  if (space === "cage" && !dc.cages) return fail("error.noCages");
  if (fits(s, dcId, space, size)) return fail("error.spaceAvailable");
  const entry = { id: newId(s, "wait"), dc: dcId, space, size, since: s.hour, heldUntil: null };
  s.waitlist = [...s.waitlist, entry];
  return { ok: true, id: entry.id };
}

export function leaveWaitlist(s: GameState, id: string): ActionResult {
  if (!s.waitlist.some((w) => w.id === id)) return fail("error.unknownWaitlist");
  s.waitlist = s.waitlist.filter((w) => w.id !== id);
  return { ok: true };
}

export function closeLocation(s: GameState, locationId: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  if (loc.space === "basement") return fail("error.cannotClose");
  if (s.devices.some((d) => d.store === locationId || d.transitTo === locationId)) return fail("error.storageNotEmpty");
  const racks = s.racks.filter((r) => r.locationId === locationId);
  if (racks.some((r) => !r.provided || s.devices.some((d) => d.rackId === r.id))) return fail("error.locationNotEmpty");
  s.racks = s.racks.filter((r) => r.locationId !== locationId);
  const panel = new Set(s.devices.filter((d) => d.panel === locationId).map((d) => d.id));
  unplug(s, panel);
  s.devices = s.devices.filter((d) => !panel.has(d.id));
  s.locations = s.locations.filter((l) => l.id !== locationId);
  return { ok: true };
}

// The target position must exist and be free, and the basement only takes racks up to 24U.
function placeError(s: GameState, locationId: string, model: RackModel, position: number): string | null {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return "error.unknownLocation";
  if (loc.space === "basement" && rackUnits(model) > BASEMENT.maxUnits) return "error.rackTooTall";
  if (!freePositions(s, locationId).includes(position)) return "error.positionTaken";
  return null;
}

export function buyRack(s: GameState, locationId: string, model: RackModel, position: number): ActionResult {
  const spec = RACK_MODELS.find((m) => m.id === model);
  if (!spec) return fail("error.unknownRackModel");
  const error = placeError(s, locationId, model, position);
  if (error) return fail(error);
  if (s.cash < spec.price) return fail("error.noCash");
  const name = nextName(`${prefix(s, locationId)}-rack`, s.racks.map((r) => r.name));
  const rack = { id: newId(s, "rack"), model, locationId, position, name, arriveAt: null, price: spec.price, boughtAt: s.hour, provided: false, feedB: false, highDensity: false, extraKw: 0, extraKwAt: null, flatKw: flatDefault(s, locationId), flatKwAt: null };
  s.racks.push(rack);
  book(s, "hardware", "ledger.hardware", { model: `${spec.units}U rack`, device: name }, -spec.price);
  return { ok: true, id: rack.id };
}

// Cables to anything outside the rack, the carrier panel included, are unplugged; the rack is offline until it arrives.
export function moveRack(s: GameState, rackId: string, toLocationId: string, position: number): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.provided) return fail("error.providedRack");
  if (rack.arriveAt !== null) return fail("error.rackMoving");
  const error = placeError(s, toLocationId, rack.model, position);
  if (error) return fail(error);
  const to = s.locations.find((l) => l.id === toLocationId)!;
  // A cluster and its customers' workloads stay in their zone.
  const from = s.locations.find((l) => l.id === rack.locationId)!;
  if (to.az !== from.az && (s.workloads.some((w) => w.rackId === rackId) || s.devices.some((d) => d.rackId === rackId && serverTaken(s, d.id)))) return fail("error.rackInUse");
  const move = moveCost(s, rackId, toLocationId);
  if (s.cash < move.price) return fail("error.noCash");
  const inside = new Set(s.devices.filter((d) => d.rackId === rackId).map((d) => d.id));
  unplug(s, inside, (id) => inside.has(id));
  Object.assign(rack, { locationId: toLocationId, position, arriveAt: s.hour + move.hours });
  // Feeds belong to rented positions, so the basement has none.
  if (!to.dc) Object.assign(rack, { feedB: false, highDensity: false });
  // The power contract belongs to the position too; the new one starts on its site's default.
  if (to.id !== from.id) Object.assign(rack, { flatKw: flatDefault(s, to.id), flatKwAt: null });
  book(s, "moving", "ledger.move", { rack: rack.name, location: to.name }, -move.price);
  return { ok: true, id: rack.id };
}

export function sellRack(s: GameState, rackId: string): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.provided) return fail("error.providedRack");
  if (s.devices.some((d) => d.rackId === rackId) || s.workloads.some((w) => w.rackId === rackId)) return fail("error.rackNotEmpty");
  s.racks = s.racks.filter((r) => r.id !== rackId);
  book(s, "sales", "ledger.sale", { device: rack.name }, resaleValue(s, rack.price, rack.boughtAt));
  return { ok: true };
}

// extras are parts added to each unit. part is the size of a spare from the Parts tab.
export interface CartLine {
  model: string; brand: string; qty: number;
  extras?: { kind: ComponentKind; size?: number; ff?: string; sku?: string; qty: number }[];
  part?: PartSpec;
  // The CPU maker of a server's board and CPUs; the model's preset maker when left out.
  vendor?: Vendor;
  // The CPU part in every socket (cpus.ts); the line's default when left out.
  cpu?: string;
}

// Extra CPUs are the line's vendor and the chassis's generation.
const extraParts = (line: CartLine): PartSpec[] => {
  const m = modelById(line.model), cpu = { vendor: boardVendor(m, componentParts(m, line.vendor)), gen: genOf(m) };
  return (line.extras ?? []).flatMap((e) => Array.from({ length: e.qty }, (): PartSpec =>
    ({ kind: e.kind, ...(e.size !== undefined ? { size: e.size } : {}), ...(e.ff ? { ff: e.ff as FormFactor } : {}), ...(e.sku ? { sku: e.sku } : {}), ...(e.kind === "cpu" ? cpu : {}) })));
};
// The parts one unit of the line is built from.
export const lineParts = (line: CartLine): PartSpec[] => {
  const m = modelById(line.model);
  return [...componentParts(m, line.vendor, line.cpu), ...extraParts(line)];
};
// What one unit costs in a year: the preset, or the preset minus its CPUs, RAM and drives, plus the extras, all at that year's
// part prices; a part alone costs its part price.
export function unitPrice(line: CartLine, year: number): number {
  const m = modelById(line.model);
  if (m.kind === "part") return partPrice(m.id.slice(5) as ComponentKind, line.part?.size, line.part?.ff, year, line.part);
  return presetPrice(m, year, line.brand, line.vendor, line.cpu) + partsPrice(extraParts(line), year);
}

function lineError(s: GameState, line: CartLine): string | null {
  const { model: modelId, brand, qty } = line;
  const model = shopModels(yearOf(s.hour)).find((m) => m.id === modelId);
  if (!model) return "error.notInShop";
  if (!brandsOf(model).includes(brand)) return "error.unknownBrand";
  if (!brandOnSale(model, brand, monthIndexOf(s.hour))) return "error.notInShop";
  if (!Number.isInteger(qty) || qty < 1) return "error.badQuantity";
  if (line.vendor !== undefined && !vendorsOf(model).includes(line.vendor)) return "error.wrongVendor";
  if (line.cpu !== undefined && !cpuOptions(model, line.vendor ?? vendorsOf(model)[0], yearOf(s.hour)).some((c) => c.id === line.cpu)) return "error.notInShop";
  const offers = partOffers(yearOf(s.hour));
  if (line.part && (model.kind !== "part" || line.part.kind !== modelId.slice(5) || !offers.some((o) => offersPart(o, line.part!)))) return "error.notInShop";
  if (!line.extras?.length) return null;
  if (model.kind !== "server") return "error.notBuildable";
  if (line.extras?.some((e) => !COMPONENT_KINDS.includes(e.kind) || !Number.isInteger(e.qty) || e.qty < 1)) return "error.badQuantity";
  if (line.extras?.some((e) => e.ff !== undefined && !FORMS.includes(e.ff as FormFactor))) return "error.wrongFormFactor";
  const error = chassisFits(model, lineParts(line));
  if (error) return error;
  return extraParts(line).every((p) => offers.some((o) => offersPart(o, p))) ? null : "error.notInShop";
}
const FORMS: FormFactor[] = ["3.5", "2.5", "nvme"];

// Puts qty new units into storage at the manufacturer's price and returns their ids. With wait hours they are in transit to the
// zone first; spares taken out of a device arrive at once.
export function stock(s: GameState, line: CartLine, lease: string | null, store: string, wait = 0): string[] {
  const { model: modelId, brand, qty } = line;
  const price = unitPrice(line, yearOf(s.hour));
  return Array.from({ length: qty }, () => {
    const name = nextName(`${prefix(s, store)}-${roleOf(modelId)}`, s.devices.map((d) => d.name));
    const id = newId(s, "dev");
    const at = wait ? { store: null, transitTo: store, arriveAt: s.hour + wait } : { store, transitTo: null, arriveAt: null };
    s.devices.push({ id, model: modelId, brand, rackId: null, slot: 0, panel: null, name, bond: "none", groups: [], price, boughtAt: s.hour, lease, ...at,
      ...deviceDefaults(modelId, s.hour, lineParts(line)), ...(line.part ? { part: line.part } : {}),
      ...(modelById(modelId).kind === "server" ? { hostname: nodeName(s) } : {}) });
    // The chassis carries the price; its nodes come with it.
    const nodes = modelById(modelId).nodes;
    for (let k = 0; nodes && k < nodes.count; k++) {
      const node = nextName(`${prefix(s, store)}-srv`, s.devices.map((d) => d.name));
      s.devices.push({ id: newId(s, "dev"), model: nodes.model, brand, rackId: null, slot: 0, panel: null, name: node, bond: "none", groups: [], price: 0, boughtAt: s.hour, lease, ...at,
        ...deviceDefaults(nodes.model, s.hour), chassisId: id, hostname: nodeName(s) });
    }
    return id;
  });
}

const lineTotal = (s: GameState, line: CartLine) => unitPrice(line, yearOf(s.hour)) * line.qty;
// Orders wait for delivery, except while the company owns no server: the first purchases arrive at once.
export const deliveryWait = (s: GameState): number => (s.devices.some((d) => modelById(d.model).kind === "server") ? deliveryHours(yearOf(s.hour)) : 0);

function buyLine(s: GameState, line: CartLine, locationId: string, wait: number): string {
  const ids = stock(s, line, null, locationId, wait);
  book(s, "hardware", "ledger.hardware", { model: modelById(line.model).name, qty: line.qty }, -lineTotal(s, line));
  return ids[0];
}

// A small-office router only fits the basement's carrier panel.
const officeError = (s: GameState, modelId: string, locationId: string): string | null =>
  isOfficeRouter(modelById(modelId)) && s.locations.find((l) => l.id === locationId)?.dc ? "error.basementOnly" : null;

// Bought units go to the storage of the zone at locationId, which may not be ready yet.
export function buyDevice(s: GameState, modelId: string, brand: string, qty: number, locationId: string, rest: Pick<CartLine, "extras" | "part" | "vendor"> = {}): ActionResult {
  const line = { model: modelId, brand, qty, ...rest };
  if (!s.locations.some((l) => l.id === locationId)) return fail("error.unknownLocation");
  const error = lineError(s, line) ?? officeError(s, modelId, locationId);
  if (error) return fail(error);
  if (s.cash < lineTotal(s, line)) return fail("error.noCash");
  return { ok: true, id: buyLine(s, line, locationId, deliveryWait(s)) };
}

// Pays in cash or leases the whole cart; the lease offer must be one leaseOffers makes for the cart total right now.
export function buyCart(s: GameState, lines: CartLine[], payment: { kind: "cash" } | { kind: "lease"; offerId: string }, locationId: string): ActionResult {
  if (!s.locations.some((l) => l.id === locationId)) return fail("error.unknownLocation");
  if (!lines.length) return fail("error.emptyCart");
  const error = lines.map((l) => lineError(s, l) ?? officeError(s, l.model, locationId)).find((e) => e);
  if (error) return fail(error);
  const total = lines.reduce((sum, l) => sum + lineTotal(s, l), 0);
  if (payment.kind === "cash") {
    if (s.cash < total) return fail("error.noCash");
    const wait = deliveryWait(s);
    return { ok: true, id: lines.map((l) => buyLine(s, l, locationId, wait))[0] };
  }
  const offer = leaseOffers(s, total).find((o) => o.id === payment.offerId);
  if (!offer) return fail("error.offerExpired");
  const wait = deliveryWait(s);
  const lease = { id: newId(s, "lease"), lessor: offer.lessor, monthly: offer.monthly, months: offer.months, startedAt: s.hour, paid: 0, devices: [] as string[] };
  lease.devices = lines.flatMap((l) => stock(s, l, lease.id, locationId, wait));
  s.leases = [...s.leases, lease];
  return { ok: true, id: lease.devices[0] };
}

// Pays the remaining payments at once; the devices become owned.
export function buyOutLease(s: GameState, leaseId: string): ActionResult {
  const lease = s.leases.find((l) => l.id === leaseId);
  if (!lease) return fail("error.unknownLease");
  const rest = cents((lease.months - lease.paid) * lease.monthly);
  if (s.cash < rest) return fail("error.noCash");
  endLease(s, lease.id);
  book(s, "leasing", "ledger.leaseBuyout", { lessor: lessorName(lease.lessor) }, -rest);
  return { ok: true };
}

// A chassis's nodes stand, travel and wait where the chassis does.
function carry(s: GameState, chassis: Device) {
  for (const n of nodesOf(s, chassis.id)) Object.assign(n, { rackId: chassis.rackId, slot: chassis.slot, store: chassis.store, transitTo: chassis.transitTo, arriveAt: chassis.arriveAt });
}
const withNodes = (s: GameState, d: Device): Device[] => [d, ...nodesOf(s, d.id)];

export function mountError(s: GameState, d: Device, rackId: string, slot: number): string | null {
  if (d.chassisId) return "error.inChassis";
  if (d.transitTo) return "error.inTransit";
  if (!d.store) return "error.alreadyMounted";
  if (d.maintenance) return "error.handWork";
  if (modelById(d.model).kind === "part") return "error.notMountable";
  if (isOfficeRouter(modelById(d.model))) return "error.panelRouter";
  const spot = spotOf(s, rackId);
  if (!spot) return "error.unknownRack";
  if (spot.moving) return "error.rackMoving";
  if (d.store !== spot.locationId) return "error.notInZone";
  const m = modelById(d.model);
  if (m.kind === "pdu" && hasPdu(s, rackId)) return "error.pduInstalled";
  if (!Number.isInteger(slot) || slot < 1 || slot + m.height - 1 > spot.units) return "error.outOfBounds";
  if (!freeSlots(s, rackId, m.height).includes(slot)) return "error.slotTaken";
  return null;
}

// A device takes a name from its new location unless it already has one there.
function mount(s: GameState, d: Device, rackId: string, slot: number) {
  const base = prefix(s, spotOf(s, rackId)!.locationId);
  if (!d.name.startsWith(`${base}-`)) d.name = nextName(`${base}-${roleOf(d.model)}`, s.devices.map((x) => x.name));
  Object.assign(d, { rackId, slot, store: null });
  for (const c of d.components) if (c.kind === "psu") c.plugged = false;
  carry(s, d);
  for (const n of nodesOf(s, d.id)) if (!n.name.startsWith(`${base}-`)) n.name = nextName(`${base}-${roleOf(n.model)}`, s.devices.map((x) => x.name));
}

// Hours to rack, cable and set up a device: 30 minutes for 1U, 15 more for each further unit.
export const mountHours = (modelId: string): number => 0.25 + 0.25 * modelById(modelId).height;

// At a datacenter racking and unracking is hand work: the devices are busy until it is done. In the basement it is done at once.
function rackWork(s: GameState, devices: Device[], locationId: string, how: How | boolean): ActionResult | (() => void) {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc?.dc) return () => {};
  const work = devices.reduce((n, d) => n + mountHours(d.model), 0);
  const job = handJob(s, devices.map((d) => d.label ?? d.name).join(", "), loc, how, work);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  return () => {
    const doneAt = s.hour + job.commit();
    for (const d of devices) d.maintenance = { componentId: "", partId: "", doneAt, mount: true };
  };
}

// how picks who does the hand work at a datacenter: remote hands by default, the player, a friend, or a technician (true).
export function mountDevice(s: GameState, deviceId: string, rackId: string, slot: number, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const error = mountError(s, d, rackId, slot);
  if (error) return fail(error);
  const done = rackWork(s, [d], d.store!, how);
  if (typeof done !== "function") return done;
  mount(s, d, rackId, slot);
  done();
  return { ok: true, id: d.id };
}

// Stored units go into the lowest free run of slots, or the run starting at fromSlot, each directly on top of the previous one.
export function mountStack(s: GameState, modelId: string, brand: string, rackId: string, count: number, fromSlot?: number, how: How | boolean = false): ActionResult {
  const rack = spotOf(s, rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.moving) return fail("error.rackMoving");
  if (modelById(modelId).kind === "part") return fail("error.notMountable");
  if (modelById(modelId).chassis) return fail("error.inChassis");
  if (isOfficeRouter(modelById(modelId))) return fail("error.panelRouter");
  if (modelById(modelId).kind === "pdu" && (count > 1 || hasPdu(s, rackId))) return fail("error.pduInstalled");
  const same = (d: Device) => d.model === modelId && d.brand === brand;
  const stored = s.devices.filter((d) => same(d) && d.store === rack.locationId && !d.maintenance);
  if (!Number.isInteger(count) || count < 1 || stored.length < count) {
    return fail(s.devices.filter((d) => same(d) && d.store).length >= count ? "error.notInZone" : "error.notInStorage");
  }
  const h = modelById(modelId).height;
  const free = new Set(freeSlots(s, rackId, h));
  const start = [...free].filter((slot) => fromSlot === undefined || slot === fromSlot).find((slot) => Array.from({ length: count }, (_, i) => slot + i * h).every((x) => free.has(x)));
  if (start === undefined) return fail("error.noRoom");
  const done = rackWork(s, stored.slice(0, count), rack.locationId, how);
  if (typeof done !== "function") return done;
  stored.slice(0, count).forEach((d, i) => mount(s, d, rackId, start + i * h));
  done();
  return { ok: true, id: stored[0].id };
}

// Slides a device whose power cords are all unplugged to another free position in its rack; its network cables stay attached.
export function moveInRack(s: GameState, deviceId: string, slot: number): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (d.chassisId) return fail("error.inChassis");
  if (!d.rackId) return fail("error.notMounted");
  const spot = spotOf(s, d.rackId)!, h = modelById(d.model).height;
  if (spot.moving) return fail("error.rackMoving");
  if (psusOf(d).some(isPlugged)) return fail("error.unplugFirst");
  if (!Number.isInteger(slot) || slot < 1 || slot + h - 1 > spot.units) return fail("error.outOfBounds");
  if (!freeSlots({ ...s, devices: s.devices.filter((x) => x.id !== d.id) }, d.rackId, h).includes(slot)) return fail("error.slotTaken");
  d.slot = slot;
  carry(s, d);
  return { ok: true };
}

export function unmountDevice(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (d.chassisId) return fail("error.inChassis");
  if (!d.rackId) return fail("error.notMounted");
  const rack = spotOf(s, d.rackId)!;
  if (rack.moving) return fail("error.rackMoving");
  if (d.maintenance) return fail("error.handWork");
  if (withNodes(s, d).some((x) => serverTaken(s, x.id))) return fail("error.serverInUse");
  const done = rackWork(s, [d], rack.locationId, how);
  if (typeof done !== "function") return done;
  unplug(s, new Set(withNodes(s, d).map((x) => x.id)));
  Object.assign(d, { rackId: null, slot: 0, store: rack.locationId });
  carry(s, d);
  done();
  return { ok: true };
}

// Ships stored units from one zone to another at the cost and time of a rack move, once per shipment.
export function shipStock(s: GameState, deviceIds: string[], toLocationId: string): ActionResult {
  const units = [...new Set(deviceIds)].map((id) => s.devices.find((d) => d.id === id));
  if (!units.length) return fail("error.emptyShipment");
  if (units.some((d) => !d)) return fail("error.unknownDevice");
  if (units.some((d) => d!.chassisId)) return fail("error.inChassis");
  if (units.some((d) => !d!.store)) return fail("error.notInStorage");
  if (units.some((d) => d!.maintenance)) return fail("error.handWork");
  const from = units[0]!.store!;
  if (units.some((d) => d!.store !== from)) return fail("error.mixedZones");
  const to = s.locations.find((l) => l.id === toLocationId);
  if (!to) return fail("error.unknownLocation");
  if (to.id === from) return fail("error.sameZone");
  const trip = travelCost(s, from, to.id);
  if (s.cash < trip.price) return fail("error.noCash");
  for (const d of units) { Object.assign(d!, { store: null, transitTo: to.id, arriveAt: s.hour + trip.hours }); carry(s, d!); }
  book(s, "moving", "ledger.ship", { count: units.length, location: to.name }, -trip.price);
  return { ok: true, id: units[0]!.id };
}

// Hours of racking, power and cabling at the far end of a server move: two to four.
export const MOVE_INSTALL_HOURS = { min: 2, max: 4 };

// Ships loaded servers with their workloads into the first racks with room at another location. They are driven over when a drive
// reaches the target (couriered overseas) and installed by hand work at the far end, which starts once both the servers and the
// hands are there; they are offline until the install is done; the affected customers get a maintenance window unless one planned a
// day ahead already covers the move, and their services are renumbered from the target's pool. A cluster moves whole or not at all.
// "self" has the player drive the load for the fare and install it on arrival; a friend takes a load from home without shipping.
export function moveServer(s: GameState, deviceIds: string | string[], locationId: string, how: How | boolean = false): ActionResult {
  const list = [...new Set([deviceIds].flat())], found = list.map((id) => s.devices.find((x) => x.id === id));
  if (!list.length) return fail("error.emptyShipment");
  if (found.some((d) => !d)) return fail("error.unknownDevice");
  const servers = found as Device[];
  if (servers.some((d) => modelById(d.model).kind !== "server")) return fail("error.moveServerOnly");
  if (servers.some((d) => !d.rackId)) return fail("error.notMounted");
  const from = locationOf(s, servers[0])!, to = s.locations.find((l) => l.id === locationId);
  if (servers.some((d) => locationOf(s, d)!.id !== from.id)) return fail("error.mixedZones");
  if (!to) return fail("error.unknownLocation");
  if (to.id === from.id) return fail("error.sameZone");
  if (to.readyAt > s.hour) return fail("error.locationNotReady");
  if (servers.some((d) => d.maintenance)) return fail("error.busy");
  if (servers.some((d) => d.burnin)) return fail("error.burninRunning");
  if (servers.some((d) => spotOf(s, d.rackId!)!.moving)) return fail("error.rackMoving");
  const own = s.clusters.filter((c) => c.nodes.some((n) => list.includes(n.deviceId)));
  if (own.some((c) => c.nodes.some((n) => !list.includes(n.deviceId)))) return fail("error.clusterSpans");
  // The clusters that move with the servers: their own and the panel hosts inside their VMs.
  const hosted = new Set(own.map((c) => c.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of s.clusters) if (!hosted.has(c.id) && c.vm && hosted.has(vmById(s, c.vm)?.clusterId ?? "")) { hosted.add(c.id); grew = true; }
  }
  const hosts = s.workloads.filter((w) => list.includes(w.deviceId ?? "") || (w.clusterId && hosted.has(w.clusterId)));
  if (hosts.some((w) => w.busyUntil > s.hour || w.migrating)) return fail("error.workloadBusy");
  const ids = [...new Set(hosts.map((w) => w.serviceId))].filter((id) => s.services.some((v) => v.id === id && v.endedAt === null));
  const spotFor = (d: Device) => s.racks.filter((r) => r.locationId === to.id && r.arriveAt === null)
    .map((rack) => ({ rack, slot: freeSlots(s, rack.id, modelById(d.model).height)[0] })).find((x) => x.slot !== undefined);
  if (!spotFor(servers[0])) return fail("error.noRoom");
  const noAddress = renumberError(s, ids, from, to);
  if (noAddress) return fail(noAddress);
  const work = servers.reduce((sum) => sum + MOVE_INSTALL_HOURS.min + Math.floor(rand(s.rng) * (MOVE_INSTALL_HOURS.max - MOVE_INSTALL_HOURS.min + 1)), 0);
  const name = servers.map((d) => d.label ?? d.name).join(", ");
  let job: HandJob, price = 0, transit = 0;
  if (how === "self") {
    if (!present(s, from.id)) return fail("error.notThere");
    if (s.player.until > s.hour) return fail("error.away");
    const fare = driveTo(s, to.id);
    if (!fare) return fail("error.tooFar");
    job = { cost: fare.fee, bill: 0, wait: fare.hours + work, commit: () => {
      book(s, "maintenance", "ledger.drive", { place: to.name }, -fare.fee);
      s.player = { at: to.id, until: s.hour + fare.hours + work, doing: "travel" };
      return fare.hours + work;
    } };
  } else {
    const hands = handJob(s, name, to, how, work);
    if ("error" in hands) return fail(hands.error);
    job = hands;
    // A friend loads the servers at home; any other load is shipped.
    if (how !== "friend" || from.dc) {
      const ship = travelCost(s, from.id, to.id);
      price = ship.price;
      transit = drive(from.city, to.city)?.hours ?? ship.hours;
    }
  }
  if (s.cash < price + job.cost) return fail("error.noCash");
  const hours = Math.max(transit + work, job.commit());
  const told = new Set(ids.filter((id) => plannedFor(s, s.services.find((v) => v.id === id)!, hours)));
  if (ids.some((id) => !told.has(id))) for (const d of servers) announceNow(s, { kind: "device", id: d.id }, hours);
  const cables = s.cables.filter((c) => list.includes(c.a.device) || list.includes(c.b.device));
  unplug(s, new Set(list));
  for (const d of servers) {
    // ponytail: room for the later servers is checked while mounting; a failure midway relies on act's clone.
    const spot = spotFor(d);
    if (!spot) return fail("error.noRoom");
    mount(s, d, spot.rack.id, spot.slot);
    for (const c of d.components) if (c.kind === "psu") c.plugged = true;
    Object.assign(d, { bootUntil: s.hour + hours, maintenance: { componentId: "", partId: "", doneAt: s.hour + hours } });
  }
  // Cables between moving servers go along; the hands patch the rest to the same kind of device at the target, in the server's rack first.
  for (const c of cables) {
    if (list.includes(c.a.device) && list.includes(c.b.device)) { connect(s, c.a, c.b); continue; }
    const [mine, far] = list.includes(c.a.device) ? [c.a, c.b] : [c.b, c.a], kind = modelById(s.devices.find((x) => x.id === far.device)!.model).kind;
    const rack = s.devices.find((x) => x.id === mine.device)!.rackId;
    const pool = s.devices.filter((x) => x.rackId && locationOf(s, x)?.id === to.id && modelById(x.model).kind === kind)
      .sort((x, y) => Number(y.rackId === rack) - Number(x.rackId === rack));
    pool.some((x) => modelById(x.model).ports.some((_, port) => connect(s, mine, { device: x.id, port }).ok));
  }
  // A cluster still named after the location it leaves takes the new location's name.
  for (const id of hosted) {
    const c = s.clusters.find((x) => x.id === id)!, n = c.name.slice(from.name.length + 1);
    const name = c.name.startsWith(`${from.name} `) && /^\d+$/.test(n) ? freeName(s, to.name) : c.name;
    s.clusters = s.clusters.map((x) => (x.id === id ? { ...x, az: to.az, name } : x));
  }
  s.services = s.services.map((v) => (ids.includes(v.id) ? { ...v, zone: to.az } : v));
  renumber(s, ids, from, to, (id) => told.has(id));
  if (price > 0) book(s, "moving", "ledger.moveServer", { device: name, location: to.name }, -price);
  return { ok: true, id: servers[0].id };
}

export function sellDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind === "gateway" && !modelById(d.model).price) return fail("error.cannotSell");
  if (d.lease) return fail("error.leased");
  if (d.chassisId) return fail("error.inChassis");
  if (d.transitTo) return fail("error.inTransit");
  const gone = new Set(withNodes(s, d).map((x) => x.id));
  if ([...gone].some((id) => serverTaken(s, id))) return fail("error.serverInUse");
  unplug(s, gone);
  s.devices = s.devices.filter((x) => !gone.has(x.id));
  s.files = Object.fromEntries(Object.entries(s.files).filter(([id]) => !gone.has(id)));
  book(s, "sales", "ledger.sale", { device: d.name }, deviceValue(s, d));
  return { ok: true };
}

export function connect(s: GameState, a: End, b: End): ActionResult {
  const error = connectError(s, a, b);
  if (error) return fail(error);
  const da = s.devices.find((x) => x.id === a.device)!, db = s.devices.find((x) => x.id === b.device)!;
  const ma = modelById(da.model), mb = modelById(db.model), serial = [oobPortOf(ma, a.port), oobPortOf(mb, b.port)].includes("serial");
  const kind = serial ? "rollover" : (ma.ports[a.port] ?? mb.ports[b.port] ?? { media: "rj45" }).media === "rj45" ? "copper" : da.rackId === db.rackId ? "dac" : "fiber";
  const id = newId(s, "cab");
  s.cables.push({ id, a: { ...a }, b: { ...b }, kind, color: null });
  return { ok: true, id };
}

export function disconnect(s: GameState, cableId: string): ActionResult {
  if (!s.cables.some((c) => c.id === cableId)) return fail("error.unknownCable");
  s.cables = s.cables.filter((c) => c.id !== cableId);
  return { ok: true };
}

export function setBond(s: GameState, deviceId: string, mode: BondMode): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server") return fail("error.notServer");
  d.bond = mode;
  return { ok: true };
}

// 2 to 8 ports form a group and replace any group they overlap. One port removes the group that contains it;
// an empty list removes every group on the switch.
export function setPortGroup(s: GameState, switchId: string, ports: number[]): ActionResult {
  const d = s.devices.find((x) => x.id === switchId);
  if (!d) return fail("error.unknownDevice");
  const model = modelById(d.model);
  if (model.kind !== "switch") return fail("error.notSwitch");
  const unique = [...new Set(ports)].sort((x, y) => x - y);
  if (unique.some((p) => !Number.isInteger(p) || !model.ports[p])) return fail("error.unknownPort");
  if (unique.length > 8) return fail("error.groupSize");
  if (d.locked) return fail("error.lockedOut");
  d.groups = unique.length ? d.groups.filter((g) => !g.some((p) => unique.includes(p))) : [];
  if (unique.length >= 2) d.groups.push(unique);
  lockoutRoll(s, d);
  return { ok: true };
}

// A hard power-off, the pulled plug: workloads that ran may corrupt. Switching on boots the server.
export function setPower(s: GameState, deviceId: string, on: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (on && d.maintenance?.mount) return fail("error.handWork");
  if (on && !d.on) bootUp(s, d);
  else if (!on && d.on) pullPlug(s, d);
  return { ok: true };
}

// A technician is on site at once, so the datacenter's hand work options do not apply.
const onSite = (how: How | boolean) => how === true || how === "tech";

// Stops the operating system cleanly: the workloads stop, no data is at risk, and the server is off once the OS has halted.
// Needs a responsive OS; a shutdown already under way counts as done.
export function shutdown(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (!d.on) return fail("error.alreadyOff");
  if (d.haltUntil !== undefined) return { ok: true };
  if (!working(s, deviceId)) return fail("error.unresponsive");
  halt(s, d);
  return { ok: true };
}

// A clean shutdown and a boot right after the halt: nothing is cut, so nothing corrupts.
export function reboot(s: GameState, deviceId: string): ActionResult {
  const r = shutdown(s, deviceId);
  const d = s.devices.find((x) => x.id === deviceId);
  if (!r.ok || d?.haltUntil === undefined) return r;
  d.bootUntil = d.haltUntil + bootHours(s, d);
  d.haltUntil = undefined;
  pushLog(d, s.hour, "ipmi.log.powerOn");
  return r;
}

// Why the server cannot be switched from afar: no switched PDU in its rack, no KVM that switches its power and no management controller that answers.
function remoteError(s: GameState, d: Device): string | null {
  if (pduOf(s, d) || kvmPower(s, d)) return null;
  return !hasBmc(d.model, d.brand) ? "error.noBmc" : d.bmcHung ? "error.bmcHung" : null;
}

// Switches the server on or hard off through its management controller or the rack's switched PDU.
export function remotePower(s: GameState, deviceId: string, on: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId) return fail("error.notMounted");
  if (!on && !d.on) return fail("error.alreadyOff");
  const error = remoteError(s, d);
  if (error) return fail(error);
  return setPower(s, deviceId, on);
}

// Named so replays can log them (90-actions/index.ts).
export const powerOn = (s: GameState, deviceId: string): ActionResult => remotePower(s, deviceId, true);
export const powerOff = (s: GameState, deviceId: string): ActionResult => remotePower(s, deviceId, false);

// Pulls the plug on site through the hand work sheet: instant in the basement, after the hand work's wait in a datacenter.
export function pullPower(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.on) return fail("error.alreadyOff");
  const loc = locationOf(s, d);
  if (pduOf(s, d) || !loc?.dc || onSite(how)) return setPower(s, deviceId, false);
  const job = handJob(s, d.label ?? d.name, loc, how, 0);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  d.hands = { kind: "pull", doneAt: s.hour + job.commit() };
  return { ok: true };
}

// Reboots (reset) or cycles the power (powerCycle) through the management controller, or with a technician at the machine.
function hardRestart(s: GameState, deviceId: string, key: "ipmi.log.reset" | "ipmi.log.cycle", technician: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (!d.on) return fail("error.alreadyOff");
  // A switched PDU in the rack cycles the power without a controller; a reset still needs one.
  const viaPdu = (key === "ipmi.log.cycle" && !!pduOf(s, d)) || !!kvmPower(s, d);
  if (!technician && !viaPdu && !hasBmc(d.model, d.brand)) return fail("error.noBmc");
  if (!technician && !viaPdu && d.bmcHung) return fail("error.bmcHung");
  hardReboot(s, d, key);
  return { ok: true };
}
export const reset = (s: GameState, deviceId: string, technician = false): ActionResult => hardRestart(s, deviceId, "ipmi.log.reset", technician);
export const powerCycle = (s: GameState, deviceId: string, technician = false): ActionResult => hardRestart(s, deviceId, "ipmi.log.cycle", technician);

// Works the server's front panel or its power cords through the hand work sheet: at once in the basement or with the
// player on site, after the remote hands' response time (billed for an hour) or the friend's trip in a datacenter.
export function atServer(s: GameState, deviceId: string, op: FrontOp, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId) return fail("error.notMounted");
  if (d.hands) return fail("error.handsBusy");
  const cords = psusOf(d);
  if ((op === "hold" || op === "reset") && !d.on) return fail("error.alreadyOff");
  if (op === "power" && d.on && !working(s, deviceId)) return fail("error.unresponsive");
  if (op === "pull" && !cords.some(isPlugged)) return fail("error.unplugged");
  if (op === "plug" && cords.every(isPlugged)) return fail("error.plugged");
  const job = handJob(s, d.label ?? d.name, locationOf(s, d), how, 0);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  // d.hands only finishes in the hourly power tick, so work without a wait applies now.
  const wait = job.commit();
  if (wait > 0) d.hands = { kind: op, doneAt: s.hour + wait };
  else atFront(s, d, op);
  return { ok: true };
}

// Resets a hung management controller on site: 15 minutes at the machine, plus the hand work's wait and, for remote hands, an hour's fee in a datacenter.
export function resetBmc(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.bmcHung) return fail("error.bmcFine");
  if (d.hands) return fail("error.handsBusy");
  const job = handJob(s, d.label ?? d.name, locationOf(s, d), how, BMC_RESET_HOURS * workFactor(d.model, s.hour), 1);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  d.hands = { kind: "bmcreset", doneAt: s.hour + job.commit() };
  return { ok: true };
}

// Plugs one power supply into the rack's power strip or pulls it.
export function setPlugged(s: GameState, deviceId: string, componentId: string, plugged: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const c = d.components.find((x) => x.id === componentId && x.kind === "psu");
  if (!c) return fail("error.unknownComponent");
  if (!d.rackId) return fail("error.notMounted");
  plugCords(s, d, plugged, [c.id]);
  return { ok: true };
}

export const LABEL_MAX = 40;
// An empty label clears it.
export function setLabel(s: GameState, deviceId: string, label: string | null): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const text = label?.trim() || null;
  if (text && text.length > LABEL_MAX) return fail("error.labelTooLong");
  d.label = text;
  return { ok: true };
}

export function setCableColor(s: GameState, cableId: string, color: string | null): ActionResult {
  const c = s.cables.find((x) => x.id === cableId);
  if (!c) return fail("error.unknownCable");
  if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return fail("error.badColor");
  s.cables = s.cables.map((x) => (x.id === cableId ? { ...x, color } : x));
  return { ok: true };
}

// Drives each level needs: RAID 1 two or more, RAID 5 three, RAID 6 four, RAID 10 an even four or more.
const raidFits = (level: RaidLevel, n: number) =>
  ({ none: n >= 1, "1": n >= 2, "5": n >= 3, "6": n >= 4, "10": n >= 4 && n % 2 === 0 })[level];

// Rebuilding the array wipes it, so the server must be off and its data counts as lost.
export function setRaid(s: GameState, deviceId: string, level: RaidLevel): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server") return fail("error.notServer");
  if (!(level in { none: 1, "1": 1, "5": 1, "6": 1, "10": 1 }) || !raidFits(level, drivesOf(d).length)) return fail("error.raidLevel");
  if (d.on && (d.rackId || d.panel) && !d.setup) return fail("error.raidInSetup");
  if (d.raid === level) return { ok: true };
  Object.assign(d, { raid: level, rebuild: null, dataLost: holdsData(s, d) ? s.hour : d.dataLost });
  return { ok: true };
}

export function setRebuildRate(s: GameState, deviceId: string, rate: RebuildRate): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind !== "server") return fail("error.notServer");
  if (!["low", "medium", "high"].includes(rate)) return fail("error.unknownRate");
  d.rebuildRate = rate;
  return { ok: true };
}

export const SWAP_HOURS = 0.25;

// The grey market surcharge for a spare going into a device that is out of support.
const greyMarket = (s: GameState, d: Device, part: Device): number =>
  greySurcharge(d.model, s.hour, partPrice(part.model.slice(5) as ComponentKind, part.part?.size, part.part?.ff, yearOf(s.hour), part.part));

// Swaps a failed or worn component for a spare from the zone's storage: 15 minutes in the basement, or the remote hands'
// response time plus 15 minutes at a datacenter, billed for at least one hour. A technician on site swaps it in 15 minutes.
// The player or a friend can do it instead, after the drive.
export function replaceComponent(s: GameState, deviceId: string, componentId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const c = d.components.find((x) => x.id === componentId);
  if (!c) return fail("error.unknownComponent");
  const rack = spotOf(s, d.rackId);
  if (!rack) return fail("error.notMounted");
  if (rack.moving) return fail("error.rackMoving");
  if (d.maintenance) return fail("error.busy");
  const spares = replaceSpares(s, d, c, rack.locationId), part = spares[0];
  if (!part) return fail("error.noPart");
  if (energized(d) && !hotSwappable(d, c)) return fail("error.powerOffFirst");
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const swap = SWAP_HOURS * spares.length * workFactor(d.model, s.hour), grey = spares.reduce((n, x) => n + greyMarket(s, d, x), 0);
  const job = handJob(s, d.label ?? d.name, loc, how, swap);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost + grey) return fail("error.noCash");
  const wait = job.commit();
  if (grey) book(s, "maintenance", "ledger.greyMarket", { device: d.label ?? d.name, component: c.kind }, -grey);
  if (!d.used) claimRepair(s, d.label ?? d.name, c, spares.reduce((n, x) => n + x.price, 0), job.bill);
  s.devices = s.devices.filter((x) => !spares.includes(x));
  const others = spares.length > 1 ? d.components.filter((x) => x.kind === "cpu" && x !== c).map((x) => x.id) : [];
  d.maintenance = { componentId, partId: part.id, doneAt: s.hour + wait, ...(part.part ? { spec: part.part } : {}), ...(others.length ? { others } : {}) };
  if (!d.on) rollStuck(s, d);
  return { ok: true, id: part.id };
}

// Whether a spare can take the component's place: at least its size, a drive its bays take, and nothing over the chassis limits.
// A CPU is checked in every socket, since a CPU of another spec replaces them all.
export function spareFits(model: DeviceModel, d: Device, spare: Device, c: Component): boolean {
  const p = spare.part;
  if (!p) return true;
  if ((p.size ?? 0) < (c.size ?? 0)) return false;
  const next = (x: Component) => asSpec({ ...x, size: p.size ?? x.size, ff: p.ff ?? x.ff, vendor: p.vendor ?? x.vendor, gen: p.gen ?? x.gen });
  return !chassisFits(model, d.components.map((x) => (x === c || (c.kind === "cpu" && x.kind === "cpu") ? next(x) : asSpec(x))));
}

// The spares in the zone's storage a replacement takes, unleased first: the smallest that fits, or for a CPU of another spec than
// the one it replaces, one per socket so every socket matches. None when the storage cannot cover it.
export function replaceSpares(s: GameState, d: Device, c: Component, zone: string): Device[] {
  const model = modelById(d.model);
  const fit = s.devices.filter((x) => x.model === `part-${c.kind}` && x.store === zone && spareFits(model, d, x, c))
    .sort((a, b) => (a.part?.size ?? 0) - (b.part?.size ?? 0) || Number(!!a.lease) - Number(!!b.lease));
  if (c.kind !== "cpu") return fit.length ? [fit.find((x) => !x.lease) ?? fit[0]] : [];
  const spec = (x: Device) => asSpec({ ...c, ...x.part });
  const sockets = d.components.filter((x) => x.kind === "cpu").length;
  for (const x of fit) {
    const set = fit.filter((y) => samePart(spec(y), spec(x)));
    const need = samePart(spec(x), asSpec(c)) ? 1 : sockets;
    if (set.length >= need) return set.slice(0, need);
  }
  return [];
}

// A second feed or a high-density feed for a rack in a rented position.
export function setFeed(s: GameState, rackId: string, feed: "b" | "highDensity", on: boolean): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.provided) return fail("error.providedRack");
  if (!s.locations.find((l) => l.id === rack.locationId)!.dc) return fail("error.noFeeds");
  if (feed === "b") rack.feedB = on;
  else if (feed === "highDensity") rack.highDensity = on;
  else return fail("error.unknownFeed");
  return { ok: true };
}

// Books extra power (kW above the share's base limit) on a provided share; it takes effect after the lead time and is billed monthly with the rent.
export function setExtraPower(s: GameState, rackId: string, kw: number): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (!rack.provided) return fail("error.ownRack");
  const dc = datacenterById(s.locations.find((l) => l.id === rack.locationId)!.dc!);
  const size = SHARE_RACKS.find((m) => m.id === rack.model)!.size;
  if (!Number.isInteger(kw / EXTRA_STEP_KW) || kw < 0 || kw > maxExtraKw(dc, size)) return fail("error.extraPowerRange");
  rack.extraKwAt = kw === rack.extraKw ? null : { kw, at: s.hour + 24 * EXTRA_POWER_LEAD_DAYS };
  return { ok: true };
}

// A rack position's power contract: 0 for metered or one of the flat-rate contracts' kW, taking effect after the lead time.
export function setFlatPower(s: GameState, rackId: string, kw: number): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  const offer = flatOffer(s, rack.locationId);
  if (offer === "metered") return fail("error.noFlatPower");
  if (kw === 0 ? offer === "flat" : !FLAT_CONTRACTS.some((c) => c.kw === kw)) return fail("error.flatPowerRange");
  rack.flatKwAt = kw === rack.flatKw ? null : { kw, at: s.hour + 24 * EXTRA_POWER_LEAD_DAYS };
  return { ok: true };
}

export const CIRCUIT_PRICE = 400;

export function buyCircuit(s: GameState, locationId: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  if (loc.space !== "basement") return fail("error.notBasement");
  if (loc.extraCircuit) return fail("error.alreadyBought");
  if (s.cash < CIRCUIT_PRICE) return fail("error.noCash");
  loc.extraCircuit = true;
  book(s, "hardware", "ledger.circuit", {}, -CIRCUIT_PRICE);
  return { ok: true };
}

// Fills an empty second power supply bay: the device becomes its dual-supply build, and the new supply waits to be plugged in.
// The supply is bought at the build's price difference and installed like any spare.
export function addSecondPsu(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const to = dualPsuModel(d.model);
  if (!to) return fail("error.noSecondPsu");
  const price = priceOf(to, d.brand) - priceOf(modelById(d.model), d.brand);
  if (s.cash < price) return fail("error.noCash");
  const zone = d.rackId ? locationOf(s, d)?.id : d.store;
  if (!zone) return fail("error.inTransit");
  const spare = stock(s, { model: "part-psu", brand: "Generic", qty: 1 }, null, zone)[0];
  const r = installPart(s, deviceId, spare);
  if (!r.ok) { s.devices = s.devices.filter((x) => x.id !== spare); return r; }
  d.price += price;
  book(s, "hardware", "ledger.secondPsu", { device: d.label ?? d.name }, -price);
  return r;
}

export const INSTALL_HOURS = 0.5;

const sameSlots = (a: ComponentKind, b: ComponentKind) => a === b || (isDriveKind(a) && isDriveKind(b));

// Checks hands-on work on a device. One in storage is worked on at once. One in a rack must be off unless the part swaps hot; it takes
// the hand work's wait at a datacenter (remote hands bill at least an hour), plus 30 minutes for a part that needs the server off.
function handsOn(s: GameState, d: Device, hot: boolean, how: How | boolean): { error: string } | HandJob {
  if (d.maintenance) return { error: "error.busy" };
  if (!d.rackId) return d.store ? { cost: 0, bill: 0, wait: 0, commit: () => 0 } : { error: "error.inTransit" };
  const rack = spotOf(s, d.rackId)!;
  if (rack.moving) return { error: "error.rackMoving" };
  if (energized(d) && !hot) return { error: "error.powerOffFirst" };
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const job = handJob(s, d.label ?? d.name, loc, how, (hot ? 0 : INSTALL_HOURS) * workFactor(d.model, s.hour));
  if ("error" in job) return job;
  return s.cash < job.cost ? { error: "error.noCash" } : job;
}
function startWork(s: GameState, d: Device, partId: string, job: HandJob) {
  const wait = job.commit();
  if (wait > 0) d.maintenance = { componentId: "", partId, doneAt: s.hour + wait };
  if (d.rackId && !d.on) rollStuck(s, d);
}
const asSpec = specOf;
// A second power supply makes a build with a dual-supply sibling its sibling, and dropping to one supply makes it the single build again.
function syncPsuBuild(d: Device) {
  const psus = d.components.filter((c) => c.kind === "psu").length;
  const dual = dualPsuModel(d.model);
  if (psus === 2 && dual) d.model = dual.id;
  else if (psus === 1 && d.model.endsWith("-2psu")) d.model = d.model.slice(0, -5);
}

// Puts a spare from the device's zone into a free slot. Drives in a RAID array, power supplies and fans go in with the device running;
// RAM, CPUs and the rest need it off. slot is the index of a free slot of that kind, and the next free one when left out.
export function installPart(s: GameState, deviceId: string, partId: string, slot?: number, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const zone = d.rackId ? locationOf(s, d)?.id : d.store;
  const part = s.devices.find((x) => x.id === partId);
  if (!part || modelById(part.model).kind !== "part" || !zone || part.store !== zone) return fail("error.noPart");
  const model = modelById(d.model), kind = part.model.slice(5) as ComponentKind;
  // A CPU without a vendor takes the board's, and fills the free sockets with the zone's other spares of its spec.
  const specFor = (x: Device): PartSpec => (kind === "cpu" ? { vendor: boardVendor(model, d.components), gen: genOf(model), ...x.part, kind } : { ...x.part, kind });
  const spec = specFor(part);
  const used = d.components.filter((c) => sameSlots(c.kind, kind)).length;
  // Replayed and UI actions pass a left-out slot as null.
  if (slot === null) slot = undefined;
  if (slot !== undefined && (!Number.isInteger(slot) || slot < 0 || slot >= slotsOf(model, kind))) return fail("error.unknownSlot");
  if (slot !== undefined && slot < used) return fail("error.partSlotTaken");
  const set = kind !== "cpu" ? [part]
    : [part, ...s.devices.filter((x) => x !== part && x.model === part.model && x.store === zone && samePart(specFor(x), spec)).slice(0, Math.max(0, slotsOf(model, kind) - used - 1))];
  const error = chassisFits(model, [...d.components.map(asSpec), ...set.map(() => spec)]);
  if (error) return fail(error);
  const w = handsOn(s, d, hotKind(d, kind), how);
  if ("error" in w) return fail(w.error);
  const grey = set.reduce((n, x) => n + greyMarket(s, d, x), 0);
  if (s.cash < w.cost + grey) return fail("error.noCash");
  startWork(s, d, partId, w);
  if (grey) book(s, "maintenance", "ledger.greyMarket", { device: d.label ?? d.name, component: kind }, -grey);
  s.devices = s.devices.filter((x) => !set.includes(x));
  const top = Math.max(0, ...d.components.map((c) => Number(c.id.slice(1)) || 0)), id = `c${top + 1}`;
  const at = d.components.map((c) => sameSlots(c.kind, kind)).lastIndexOf(true);
  d.components.splice(at < 0 ? d.components.length : at + 1, 0, ...set.map((_, i): Component =>
    ({ id: `c${top + 1 + i}`, ...spec, installedAt: s.hour, failedAt: null, ...(kind === "psu" && d.rackId ? { plugged: false } : {}) })));
  if (isDriveKind(kind) && d.rackId && d.raid !== "none" && !d.rebuild && !arrayLost(d)) d.rebuild = { componentId: id, doneAt: s.hour + rebuildHours(d) };
  syncPsuBuild(d);
  return { ok: true, id };
}

// Takes a part out of its slot. A working part goes back to the zone's storage; a failed or worn one is scrapped.
// A drive can only leave an array that still fits its RAID level.
export function removePart(s: GameState, deviceId: string, componentId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const c = d.components.find((x) => x.id === componentId);
  if (!c) return fail("error.unknownComponent");
  if (c.kind === "board" || c.kind === "nic") return fail("error.notRemovable");
  if (c.kind === "gpu" && c.failedAt === null && cardsFree(s, d) < 1) return fail("error.cardInUse");
  const zone = d.rackId ? locationOf(s, d)?.id : d.store;
  if (!zone) return fail("error.inTransit");
  if (isDriveKind(c.kind) && d.raid !== "none" && !raidFits(d.raid, drivesOf(d).length - 1)) return fail("error.raidLevel");
  const w = handsOn(s, d, hotSwappable(d, c), how);
  if ("error" in w) return fail(w.error);
  startWork(s, d, "", w);
  d.components = d.components.filter((x) => x.id !== componentId);
  if (d.rebuild?.componentId === componentId) d.rebuild = null;
  syncPsuBuild(d);
  if (c.failedAt === null && s.hour - c.installedAt < COMPONENTS[c.kind].life * HOURS_PER_YEAR) {
    const spec = asSpec(c);
    stock(s, { model: `part-${c.kind}`, brand: "Generic", qty: 1, ...(spec.size !== undefined || spec.ff ? { part: spec } : {}) }, null, zone);
  }
  return { ok: true };
}

// Orders another internet line for the basement; it goes live after its install days. Ordering the current line cancels a pending switch.
export function orderHomeLine(s: GameState, lineId: string): ActionResult {
  // Ordering the current line, or none before the first one, cancels a pending order.
  if (s.homeLine.id === lineId) {
    if (!s.homeLine.next) return fail("error.lineActive");
    s.homeLine = { ...s.homeLine, next: null };
    return { ok: true };
  }
  const line = HOME_LINES.find((l) => l.id === lineId);
  if (!line) return fail("error.unknownLine");
  if (line.from > yearOf(s.hour)) return fail("error.lineNotYet");
  if (s.homeLine.next?.id === lineId) return fail("error.lineOrdered");
  s.homeLine = { ...s.homeLine, next: { id: lineId, at: s.hour + 24 * line.installDays } };
  return { ok: true };
}
