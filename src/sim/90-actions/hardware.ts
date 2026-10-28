import { yearOf } from "../00-core/time";
import { brandsFor, modelById, priceOf, shopModels, SWITCH_BRAND } from "../10-catalog/hardware";
import { leaseOffers, lessorName } from "../10-catalog/leasing";
import { BASEMENT, DATACENTERS, datacenterById, HOME_LINES, LEAD_DAYS, nextAz, RACK_MODELS, rackUnits, SHARE_RACKS, SPACE_SIZES, spacePrice } from "../20-world/datacenters";
import { deviceDefaults, type BondMode, type Device, type End, type GameState, type RackModel, type RaidLevel, type RebuildRate } from "../50-state";
import { BOOT_HOURS, connectError, drivesOf, fits, freePositions, holdsData, freeSlots, hotSwappable, moveCost, resaleValue, travelCost } from "../60-infra/status";
import { claimRepair } from "../46-finance/finance";
import { endLease } from "../88-tick/tick";
import { serverTaken } from "../60-infra/cluster";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
const ROLE = { server: "srv", switch: "sw", firewall: "fw", gateway: "gw", patch: "pp", part: "part" } as const;
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

export interface CartLine { model: string; brand: string; qty: number }

function lineError(s: GameState, { model: modelId, brand, qty }: CartLine): string | null {
  const model = shopModels(yearOf(s.hour)).find((m) => m.id === modelId);
  if (!model) return "error.notInShop";
  if (!brandsFor(model.kind).includes(brand)) return "error.unknownBrand";
  if (!Number.isInteger(qty) || qty < 1) return "error.badQuantity";
  return null;
}

// Puts qty new units into storage at the manufacturer's price and returns their ids.
function stock(s: GameState, { model: modelId, brand, qty }: CartLine, lease: string | null, store: string): string[] {
  const model = modelById(modelId);
  const price = priceOf(model, brand);
  return Array.from({ length: qty }, () => {
    const name = nextName(roleOf(modelId), s.devices.map((d) => d.name));
    const id = newId(s, "dev");
    s.devices.push({ id, model: modelId, brand, rackId: null, slot: 0, panel: null, name, bond: "failover", groups: [], price, boughtAt: s.hour, lease, store, transitTo: null, arriveAt: null, ...deviceDefaults(modelId, s.hour) });
    return id;
  });
}

const lineTotal = (line: CartLine) => priceOf(modelById(line.model), line.brand) * line.qty;

// Bought units go to the storage of the zone at locationId, which may not be ready yet.
export function buyDevice(s: GameState, modelId: string, brand: string, qty: number, locationId: string): ActionResult {
  const line = { model: modelId, brand, qty };
  if (!s.locations.some((l) => l.id === locationId)) return fail("error.unknownLocation");
  const error = lineError(s, line);
  if (error) return fail(error);
  if (s.cash < lineTotal(line)) return fail("error.noCash");
  const ids = stock(s, line, null, locationId);
  book(s, "hardware", "ledger.hardware", { model: modelById(modelId).name, qty }, -lineTotal(line));
  return { ok: true, id: ids[0] };
}

// Pays in cash or leases the whole cart; the lease offer must be one leaseOffers makes for the cart total right now.
export function buyCart(s: GameState, lines: CartLine[], payment: { kind: "cash" } | { kind: "lease"; offerId: string }, locationId: string): ActionResult {
  if (!s.locations.some((l) => l.id === locationId)) return fail("error.unknownLocation");
  if (!lines.length) return fail("error.emptyCart");
  const error = lines.map((l) => lineError(s, l)).find((e) => e);
  if (error) return fail(error);
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  if (payment.kind === "cash") {
    if (s.cash < total) return fail("error.noCash");
    const ids = lines.map((l) => (buyDevice(s, l.model, l.brand, l.qty, locationId) as { id: string }).id);
    return { ok: true, id: ids[0] };
  }
  const offer = leaseOffers(s, total).find((o) => o.id === payment.offerId);
  if (!offer) return fail("error.offerExpired");
  const lease = { id: newId(s, "lease"), lessor: offer.lessor, monthly: offer.monthly, months: offer.months, startedAt: s.hour, paid: 0, devices: [] as string[] };
  lease.devices = lines.flatMap((l) => stock(s, l, lease.id, locationId));
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
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return "error.unknownRack";
  if (rack.arriveAt !== null) return "error.rackMoving";
  if (d.store !== rack.locationId) return "error.notInZone";
  const h = modelById(d.model).height;
  if (!Number.isInteger(slot) || slot < 1 || slot + h - 1 > rackUnits(rack.model)) return "error.outOfBounds";
  if (!freeSlots(s, rackId, h).includes(slot)) return "error.slotTaken";
  return null;
}

// A device takes a name from its new location unless it already has one there.
function mount(s: GameState, d: Device, rackId: string, slot: number) {
  const base = prefix(s, s.racks.find((r) => r.id === rackId)!.locationId);
  if (!d.name.startsWith(`${base}-`)) d.name = nextName(`${base}-${roleOf(d.model)}`, s.devices.map((x) => x.name));
  Object.assign(d, { rackId, slot, store: null });
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
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.arriveAt !== null) return fail("error.rackMoving");
  if (modelById(modelId).kind === "part") return fail("error.notMountable");
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
  const rack = s.racks.find((r) => r.id === d.rackId)!;
  if (rack.arriveAt !== null) return fail("error.rackMoving");
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
  if (modelById(d.model).kind === "gateway") return fail("error.cannotSell");
  if (d.lease) return fail("error.leased");
  if (d.transitTo) return fail("error.inTransit");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  unplug(s, new Set([d.id]));
  s.devices = s.devices.filter((x) => x.id !== deviceId);
  book(s, "sales", "ledger.sale", { device: d.name }, resaleValue(s, d.price, d.boughtAt));
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

export function setPower(s: GameState, deviceId: string, on: boolean): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId && !d.panel) return fail("error.notMounted");
  if (on && !d.on) d.bootUntil = s.hour + BOOT_HOURS;
  d.on = on;
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

// Swaps a failed or worn component for a spare from the zone's storage: 15 minutes in the basement, or the remote hands'
// response time plus 15 minutes at a datacenter, billed for at least one hour.
export function replaceComponent(s: GameState, deviceId: string, componentId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const c = d.components.find((x) => x.id === componentId);
  if (!c) return fail("error.unknownComponent");
  const rack = s.racks.find((r) => r.id === d.rackId);
  if (!rack) return fail("error.notMounted");
  if (rack.arriveAt !== null) return fail("error.rackMoving");
  if (d.maintenance) return fail("error.busy");
  const parts = s.devices.filter((x) => x.model === `part-${c.kind}` && x.store === rack.locationId);
  const part = parts.find((x) => !x.lease) ?? parts[0];
  if (!part) return fail("error.noPart");
  if (d.on && !hotSwappable(d, c)) return fail("error.powerOffFirst");
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const hands = loc.dc ? datacenterById(loc.dc).remoteHands : null;
  const bill = hands ? Math.max(1, SWAP_HOURS) * hands.perHour : 0;
  if (s.cash < bill) return fail("error.noCash");
  if (hands) book(s, "maintenance", "ledger.remoteHands", { device: d.label ?? d.name, hours: Math.max(1, SWAP_HOURS) }, -bill);
  claimRepair(s, d.label ?? d.name, c, part.price, bill);
  s.devices = s.devices.filter((x) => x.id !== part.id);
  d.maintenance = { componentId, partId: part.id, doneAt: s.hour + (hands ? hands.responseHours : 0) + SWAP_HOURS };
  return { ok: true, id: part.id };
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

// Orders another internet line for the basement; it goes live after its install days. Ordering the current line cancels a pending switch.
export function orderHomeLine(s: GameState, lineId: string): ActionResult {
  const line = HOME_LINES.find((l) => l.id === lineId);
  if (!line) return fail("error.unknownLine");
  if (line.from > yearOf(s.hour)) return fail("error.lineNotYet");
  if (s.homeLine.next?.id === lineId) return fail("error.lineOrdered");
  if (s.homeLine.id === lineId) {
    if (!s.homeLine.next) return fail("error.lineActive");
    s.homeLine = { id: lineId, next: null };
    return { ok: true };
  }
  s.homeLine = { id: s.homeLine.id, next: { id: lineId, at: s.hour + 24 * line.installDays } };
  return { ok: true };
}
