import { yearOf } from "../00-core/time";
import { bareParts, brandsOf, isOfficeRouter, COMPONENT_KINDS, COMPONENTS, componentParts, deliveryHours, dualPsuModel, fits as chassisFits, hasBmc, isDriveKind, modelById, partOffers, priceOf, samePart, shopModels, SWITCH_BRAND, slotsOf, type ComponentKind, type DeviceModel, type FormFactor, type PartSpec } from "../10-catalog/hardware";
import { leaseOffers, lessorName } from "../10-catalog/leasing";
import { greySurcharge, workFactor } from "../10-catalog/lifecycle";
import { bareChassisPrice, CHASSIS_FLOOR, partPrice, partsPrice, presetPrice } from "../10-catalog/parts";
import { BASEMENT, DATACENTERS, HOME_LINES, LEAD_DAYS, nextAz, RACK_MODELS, rackUnits, SHARE_RACKS, SPACE_SIZES, spacePrice } from "../20-world/datacenters";
import { deviceDefaults, type BondMode, type Component, type Device, type End, type GameState, type RackModel, type RaidLevel, type RebuildRate } from "../50-state";
import { arrayLost, BOOT_HOURS, connectError, drivesOf, fits, freePositions, holdsData, freeSlots, HOURS_PER_YEAR, hotKind, hotSwappable, locationOf, moveCost, pluggedIn, deviceValue, resaleValue, spotOf, travelCost, working } from "../60-infra/status";
import { claimRepair } from "../46-finance/finance";
import { BMC_RESET_HOURS, hardReboot, pullPlug, pushLog } from "../60-infra/power";
import { hasPdu, pduOf } from "../60-infra/pdu";
import { handJob, type HandJob, type How } from "../60-infra/handwork";
import { endLease, rebuildHours } from "../88-tick/tick";
import { cardsFree, serverTaken } from "../60-infra/cluster";
import { nodeName } from "../30-customers/hostnames";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
const ROLE = { server: "srv", switch: "sw", firewall: "fw", gateway: "gw", patch: "pp", ups: "ups", pdu: "pdu", part: "part" } as const;
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

// For a share, size is n for 1/n of a rack; the location then has one position, taken by the provider's rack.
export function addLocation(s: GameState, dcId: string, space: "share" | "positions" | "cage" | "suite", size: number): ActionResult {
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
  s.devices.push({ id: newId(s, "dev"), model: "handoff", brand: SWITCH_BRAND, rackId: null, slot: 0, panel: loc.id, name, bond: "failover", groups: [], price: 0, boughtAt: s.hour, lease: null, store: null, transitTo: null, arriveAt: null, ...deviceDefaults("handoff", s.hour) });
  const shareRack = space === "share" && SHARE_RACKS.find((m) => m.size === size)!;
  if (shareRack) {
    const rackName = nextName(`${prefix(s, loc.id)}-rack`, s.racks.map((r) => r.name));
    s.racks.push({ id: newId(s, "rack"), model: shareRack.id, locationId: loc.id, position: 1, name: rackName, arriveAt: null, price: 0, boughtAt: s.hour, provided: true, feedB: false, highDensity: false });
  }
  return { ok: true, id: loc.id };
}

// Waits for space that is not free yet; tick holds it for 7 days once it is.
export function joinWaitlist(s: GameState, dcId: string, space: "share" | "positions" | "cage" | "suite", size: number): ActionResult {
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
  const rack = { id: newId(s, "rack"), model, locationId, position, name, arriveAt: null, price: spec.price, boughtAt: s.hour, provided: false, feedB: false, highDensity: false };
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

// extras are parts added to each unit; a bare chassis is the model without CPUs, RAM and drives. part is the size of a spare from the Parts tab.
export interface CartLine {
  model: string; brand: string; qty: number;
  extras?: { kind: ComponentKind; size?: number; ff?: string; qty: number }[];
  bare?: boolean;
  part?: PartSpec;
}

// A bare chassis never costs less than this share of the preset.
export const BARE_FLOOR = CHASSIS_FLOOR;
const extraParts = (line: CartLine): PartSpec[] =>
  (line.extras ?? []).flatMap((e) => Array.from({ length: e.qty }, (): PartSpec => ({ kind: e.kind, ...(e.size !== undefined ? { size: e.size } : {}), ...(e.ff ? { ff: e.ff as FormFactor } : {}) })));
// The parts one unit of the line is built from.
export const lineParts = (line: CartLine): PartSpec[] => {
  const m = modelById(line.model);
  return [...(line.bare ? bareParts(m) : componentParts(m)), ...extraParts(line)];
};
// What one unit costs in a year: the preset, or the preset minus its CPUs, RAM and drives, plus the extras, all at that year's
// part prices; a part alone costs its part price.
export function unitPrice(line: CartLine, year: number): number {
  const m = modelById(line.model);
  if (m.kind === "part") return partPrice(m.id.slice(5) as ComponentKind, line.part?.size, line.part?.ff, year);
  return (line.bare ? bareChassisPrice(m, year, line.brand) : presetPrice(m, year, line.brand)) + partsPrice(extraParts(line), year);
}

function lineError(s: GameState, line: CartLine): string | null {
  const { model: modelId, brand, qty } = line;
  const model = shopModels(yearOf(s.hour)).find((m) => m.id === modelId);
  if (!model) return "error.notInShop";
  if (!brandsOf(model).includes(brand)) return "error.unknownBrand";
  if (!Number.isInteger(qty) || qty < 1) return "error.badQuantity";
  const offers = partOffers(yearOf(s.hour));
  if (line.part && (model.kind !== "part" || line.part.kind !== modelId.slice(5) || !offers.some((o) => samePart(o, line.part!)))) return "error.notInShop";
  if (!line.bare && !line.extras?.length) return null;
  if (model.kind !== "server") return "error.notBuildable";
  if (line.extras?.some((e) => !COMPONENT_KINDS.includes(e.kind) || !Number.isInteger(e.qty) || e.qty < 1)) return "error.badQuantity";
  if (line.extras?.some((e) => e.ff !== undefined && !FORMS.includes(e.ff as FormFactor))) return "error.wrongFormFactor";
  const error = chassisFits(model, lineParts(line));
  if (error) return error;
  return extraParts(line).every((p) => offers.some((o) => samePart(o, p))) ? null : "error.notInShop";
}
const FORMS: FormFactor[] = ["3.5", "2.5", "nvme"];

// Puts qty new units into storage at the manufacturer's price and returns their ids. With wait hours they are in transit to the
// zone first; spares taken out of a device arrive at once.
export function stock(s: GameState, line: CartLine, lease: string | null, store: string, wait = 0): string[] {
  const { model: modelId, brand, qty } = line;
  const price = unitPrice(line, yearOf(s.hour)), custom = line.bare || line.extras?.length;
  return Array.from({ length: qty }, () => {
    const name = nextName(`${prefix(s, store)}-${roleOf(modelId)}`, s.devices.map((d) => d.name));
    const id = newId(s, "dev");
    s.devices.push({ id, model: modelId, brand, rackId: null, slot: 0, panel: null, name, bond: "failover", groups: [], price, boughtAt: s.hour, lease, ...(wait ? { store: null, transitTo: store, arriveAt: s.hour + wait } : { store, transitTo: null, arriveAt: null }),
      ...deviceDefaults(modelId, s.hour, custom ? lineParts(line) : undefined), ...(line.part ? { part: line.part } : {}),
      ...(modelById(modelId).kind === "server" ? { hostname: nodeName(s) } : {}) });
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
export function buyDevice(s: GameState, modelId: string, brand: string, qty: number, locationId: string, rest: Pick<CartLine, "extras" | "bare" | "part"> = {}): ActionResult {
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

function mountError(s: GameState, d: Device, rackId: string, slot: number): string | null {
  if (d.transitTo) return "error.inTransit";
  if (!d.store) return "error.alreadyMounted";
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
}

export function mountDevice(s: GameState, deviceId: string, rackId: string, slot: number): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const error = mountError(s, d, rackId, slot);
  if (error) return fail(error);
  mount(s, d, rackId, slot);
  return { ok: true, id: d.id };
}

// Stored units go into the lowest free run of slots, or the run starting at fromSlot, each directly on top of the previous one.
export function mountStack(s: GameState, modelId: string, brand: string, rackId: string, count: number, fromSlot?: number): ActionResult {
  const rack = spotOf(s, rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.moving) return fail("error.rackMoving");
  if (modelById(modelId).kind === "part") return fail("error.notMountable");
  if (isOfficeRouter(modelById(modelId))) return fail("error.panelRouter");
  if (modelById(modelId).kind === "pdu" && (count > 1 || hasPdu(s, rackId))) return fail("error.pduInstalled");
  const same = (d: Device) => d.model === modelId && d.brand === brand;
  const stored = s.devices.filter((d) => same(d) && d.store === rack.locationId);
  if (!Number.isInteger(count) || count < 1 || stored.length < count) {
    return fail(s.devices.filter((d) => same(d) && d.store).length >= count ? "error.notInZone" : "error.notInStorage");
  }
  const h = modelById(modelId).height;
  const free = new Set(freeSlots(s, rackId, h));
  const start = [...free].filter((slot) => fromSlot === undefined || slot === fromSlot).find((slot) => Array.from({ length: count }, (_, i) => slot + i * h).every((x) => free.has(x)));
  if (start === undefined) return fail("error.noRoom");
  stored.slice(0, count).forEach((d, i) => mount(s, d, rackId, start + i * h));
  return { ok: true, id: stored[0].id };
}

export function unmountDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId) return fail("error.notMounted");
  const rack = spotOf(s, d.rackId)!;
  if (rack.moving) return fail("error.rackMoving");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  unplug(s, new Set([d.id]));
  Object.assign(d, { rackId: null, slot: 0, store: rack.locationId });
  return { ok: true };
}

// Ships stored units from one zone to another at the cost and time of a rack move, once per shipment.
export function shipStock(s: GameState, deviceIds: string[], toLocationId: string): ActionResult {
  const units = [...new Set(deviceIds)].map((id) => s.devices.find((d) => d.id === id));
  if (!units.length) return fail("error.emptyShipment");
  if (units.some((d) => !d)) return fail("error.unknownDevice");
  if (units.some((d) => !d!.store)) return fail("error.notInStorage");
  const from = units[0]!.store!;
  if (units.some((d) => d!.store !== from)) return fail("error.mixedZones");
  const to = s.locations.find((l) => l.id === toLocationId);
  if (!to) return fail("error.unknownLocation");
  if (to.id === from) return fail("error.sameZone");
  const trip = travelCost(s, from, to.id);
  if (s.cash < trip.price) return fail("error.noCash");
  for (const d of units) Object.assign(d!, { store: null, transitTo: to.id, arriveAt: s.hour + trip.hours });
  book(s, "moving", "ledger.ship", { count: units.length, location: to.name }, -trip.price);
  return { ok: true, id: units[0]!.id };
}

export function sellDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind === "gateway" && !modelById(d.model).price) return fail("error.cannotSell");
  if (d.lease) return fail("error.leased");
  if (d.transitTo) return fail("error.inTransit");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  unplug(s, new Set([d.id]));
  s.devices = s.devices.filter((x) => x.id !== deviceId);
  book(s, "sales", "ledger.sale", { device: d.name }, deviceValue(s, d));
  return { ok: true };
}

export function connect(s: GameState, a: End, b: End): ActionResult {
  const error = connectError(s, a, b);
  if (error) return fail(error);
  const da = s.devices.find((x) => x.id === a.device)!, db = s.devices.find((x) => x.id === b.device)!;
  const kind = modelById(da.model).ports[a.port].media === "rj45" ? "copper" : da.rackId === db.rackId ? "dac" : "fiber";
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
  d.groups = unique.length ? d.groups.filter((g) => !g.some((p) => unique.includes(p))) : [];
  if (unique.length >= 2) d.groups.push(unique);
  return { ok: true };
}

// A hard power-off, the pulled plug: workloads that ran may corrupt. Switching on boots the server.
export function setPower(s: GameState, deviceId: string, on: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (on && !d.on) { d.bootUntil = s.hour + BOOT_HOURS; d.on = true; pushLog(d, s.hour, "ipmi.log.powerOn"); }
  else if (!on && d.on) pullPlug(s, d);
  return { ok: true };
}

// A technician is on site at once, so the datacenter's hand work options do not apply.
const onSite = (how: How | boolean) => how === true || how === "tech";

// Stops the operating system cleanly: the workloads stop, no data is at risk, and the server is off. Needs a responsive OS.
export function shutdown(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (!d.on) return fail("error.alreadyOff");
  if (!working(s, deviceId)) return fail("error.unresponsive");
  d.on = false;
  pushLog(d, s.hour, "ipmi.log.shutdown");
  return { ok: true };
}

// Reboots (reset) or cycles the power (powerCycle) through the management controller, or with a technician at the machine.
function reboot(s: GameState, deviceId: string, key: "ipmi.log.reset" | "ipmi.log.cycle", technician: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (!d.on) return fail("error.alreadyOff");
  // A switched PDU in the rack cycles the power without a controller; a reset still needs one.
  const viaPdu = key === "ipmi.log.cycle" && !!pduOf(s, d);
  if (!technician && !viaPdu && !hasBmc(d.model, d.brand)) return fail("error.noBmc");
  if (!technician && !viaPdu && d.bmcHung) return fail("error.bmcHung");
  hardReboot(s, d, key);
  return { ok: true };
}
export const reset = (s: GameState, deviceId: string, technician = false): ActionResult => reboot(s, deviceId, "ipmi.log.reset", technician);
export const powerCycle = (s: GameState, deviceId: string, technician = false): ActionResult => reboot(s, deviceId, "ipmi.log.cycle", technician);

// Pulls the plug on site: instant in the basement, after the hand work's wait (remote hands billed for an hour) in a datacenter.
export function pullPower(s: GameState, deviceId: string, how: How | boolean = false): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (!d.on) return fail("error.alreadyOff");
  if (d.hands) return fail("error.handsBusy");
  const loc = locationOf(s, d);
  if (pduOf(s, d) || !loc?.dc || onSite(how)) return setPower(s, deviceId, false);
  const job = handJob(s, d.label ?? d.name, loc, how, 0);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost) return fail("error.noCash");
  d.hands = { kind: "pull", doneAt: s.hour + job.commit() };
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

// Plugs a power supply into the rack's power strip or pulls it. A switched-on device that gets its first live supply boots.
export function setPlugged(s: GameState, deviceId: string, componentId: string, plugged: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const c = d.components.find((x) => x.id === componentId && x.kind === "psu");
  if (!c) return fail("error.unknownComponent");
  if (!d.rackId) return fail("error.notMounted");
  const before = pluggedIn(d);
  c.plugged = plugged;
  if (d.on && !before && pluggedIn(d)) d.bootUntil = s.hour + BOOT_HOURS;
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
  if (d.on && (d.rackId || d.panel)) return fail("error.powerOffFirst");
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
  greySurcharge(d.model, s.hour, partPrice(part.model.slice(5) as ComponentKind, part.part?.size, part.part?.ff, yearOf(s.hour)));

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
  const model = modelById(d.model);
  const parts = s.devices.filter((x) => x.model === `part-${c.kind}` && x.store === rack.locationId && spareFits(model, d, x, c))
    .sort((a, b) => (a.part?.size ?? 0) - (b.part?.size ?? 0));
  const part = parts.find((x) => !x.lease) ?? parts[0];
  if (!part) return fail("error.noPart");
  if (d.on && !hotSwappable(d, c)) return fail("error.powerOffFirst");
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const swap = SWAP_HOURS * workFactor(d.model, s.hour), grey = greyMarket(s, d, part);
  const job = handJob(s, d.label ?? d.name, loc, how, swap);
  if ("error" in job) return fail(job.error);
  if (s.cash < job.cost + grey) return fail("error.noCash");
  const wait = job.commit();
  if (grey) book(s, "maintenance", "ledger.greyMarket", { device: d.label ?? d.name, component: c.kind }, -grey);
  if (!d.used) claimRepair(s, d.label ?? d.name, c, part.price, job.bill);
  s.devices = s.devices.filter((x) => x.id !== part.id);
  d.maintenance = { componentId, partId: part.id, doneAt: s.hour + wait, ...(part.part ? { spec: part.part } : {}) };
  return { ok: true, id: part.id };
}

// Whether a spare can take the component's place: at least its size, a drive its bays take, and nothing over the chassis limits.
export function spareFits(model: DeviceModel, d: Device, spare: Device, c: Component): boolean {
  const p = spare.part;
  if (!p) return true;
  if ((p.size ?? 0) < (c.size ?? 0)) return false;
  return !chassisFits(model, d.components.map((x) => (x === c ? asSpec({ kind: c.kind, size: p.size ?? c.size, ff: p.ff ?? c.ff }) : asSpec(x))));
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
  if (d.on && !hot) return { error: "error.powerOffFirst" };
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const job = handJob(s, d.label ?? d.name, loc, how, (hot ? 0 : INSTALL_HOURS) * workFactor(d.model, s.hour));
  if ("error" in job) return job;
  return s.cash < job.cost ? { error: "error.noCash" } : job;
}
function startWork(s: GameState, d: Device, partId: string, job: HandJob) {
  const wait = job.commit();
  if (wait > 0) d.maintenance = { componentId: "", partId, doneAt: s.hour + wait };
}
const asSpec = (c: { kind: ComponentKind; size?: number; ff?: FormFactor }): PartSpec => ({ kind: c.kind, ...(c.size !== undefined ? { size: c.size } : {}), ...(c.ff ? { ff: c.ff } : {}) });
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
  const model = modelById(d.model), kind = part.model.slice(5) as ComponentKind, spec: PartSpec = { ...part.part, kind };
  const used = d.components.filter((c) => sameSlots(c.kind, kind)).length;
  if (slot !== undefined && (!Number.isInteger(slot) || slot < 0 || slot >= slotsOf(model, kind))) return fail("error.unknownSlot");
  if (slot !== undefined && slot < used) return fail("error.partSlotTaken");
  const error = chassisFits(model, [...d.components.map(asSpec), spec]);
  if (error) return fail(error);
  const w = handsOn(s, d, hotKind(d, kind), how);
  if ("error" in w) return fail(w.error);
  const grey = greyMarket(s, d, part);
  if (s.cash < w.cost + grey) return fail("error.noCash");
  startWork(s, d, partId, w);
  if (grey) book(s, "maintenance", "ledger.greyMarket", { device: d.label ?? d.name, component: kind }, -grey);
  s.devices = s.devices.filter((x) => x.id !== partId);
  const id = `c${Math.max(0, ...d.components.map((c) => Number(c.id.slice(1)) || 0)) + 1}`;
  const at = d.components.map((c) => sameSlots(c.kind, kind)).lastIndexOf(true);
  d.components.splice(at < 0 ? d.components.length : at + 1, 0, { id, ...spec, installedAt: s.hour, failedAt: null, ...(kind === "psu" && d.rackId ? { plugged: false } : {}) });
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
