import { yearOf } from "../00-core/time";
import { modelById, SERVER_BRANDS, shopModels, SWITCH_BRAND } from "../10-catalog/hardware";
import { BASEMENT, DATACENTERS, LEAD_DAYS, RACK_MODELS, SPACE_SIZES, spacePrice } from "../20-world/datacenters";
import type { BondMode, Device, End, GameState, RackModel } from "../50-state";
import { freePositions, freeSlots, locationOf, moveCost, peerOf, resaleValue } from "../60-infra/status";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
const ROLE = { server: "srv", switch: "sw", gateway: "gw", patch: "pp" } as const;
const roleOf = (modelId: string) => ROLE[modelById(modelId).kind];
const cents = (v: number) => Math.round(v * 100) / 100;

// fra1, fra2: the city's first three letters and the location's number within that city.
function prefix(s: GameState, locationId: string): string {
  const loc = s.locations.find((l) => l.id === locationId)!;
  const inCity = s.locations.filter((l) => l.city === loc.city);
  return `${loc.city.slice(0, 3).toLowerCase()}${inCity.indexOf(loc) + 1}`;
}

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
const rackUnits = (model: RackModel) => RACK_MODELS.find((m) => m.id === model)!.units;

export function addLocation(s: GameState, dcId: string, space: "positions" | "cage" | "suite", positions: number): ActionResult {
  const dc = DATACENTERS.find((d) => d.id === dcId);
  if (!dc) return fail("error.unknownDatacenter");
  if (!SPACE_SIZES[space]?.includes(positions)) return fail("error.unknownSize");
  if (space === "cage" && !dc.cages) return fail("error.noCages");
  if (s.cash < spacePrice(dc, space, positions)) return fail("error.noCash");
  const loc = { id: newId(s, "loc"), dc: dc.id, city: dc.city, name: dc.name, space, positions, readyAt: s.hour + 24 * LEAD_DAYS[space] };
  s.locations.push(loc);
  const name = nextName(`${prefix(s, loc.id)}-gw`, s.devices.map((d) => d.name));
  s.devices.push({ id: newId(s, "dev"), model: "handoff", brand: SWITCH_BRAND, rackId: null, slot: 0, panel: loc.id, name, bond: "failover", groups: [], price: 0, boughtAt: s.hour });
  return { ok: true, id: loc.id };
}

export function closeLocation(s: GameState, locationId: string): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  if (loc.space === "basement") return fail("error.cannotClose");
  if (s.racks.some((r) => r.locationId === locationId)) return fail("error.locationNotEmpty");
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
  const rack = { id: newId(s, "rack"), model, locationId, position, name, arriveAt: null, price: spec.price, boughtAt: s.hour };
  s.racks.push(rack);
  book(s, "hardware", "ledger.hardware", { model: `${spec.units}U rack`, device: name }, -spec.price);
  return { ok: true, id: rack.id };
}

// Cables to anything outside the rack, the carrier panel included, are unplugged; the rack is offline until it arrives.
export function moveRack(s: GameState, rackId: string, toLocationId: string, position: number): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.arriveAt !== null) return fail("error.rackMoving");
  const error = placeError(s, toLocationId, rack.model, position);
  if (error) return fail(error);
  const to = s.locations.find((l) => l.id === toLocationId)!;
  const move = moveCost(s, rackId, toLocationId);
  if (s.cash < move.price) return fail("error.noCash");
  const inside = new Set(s.devices.filter((d) => d.rackId === rackId).map((d) => d.id));
  unplug(s, inside, (id) => inside.has(id));
  Object.assign(rack, { locationId: toLocationId, position, arriveAt: s.hour + move.hours });
  book(s, "moving", "ledger.move", { rack: rack.name, location: to.name }, -move.price);
  return { ok: true, id: rack.id };
}

export function sellRack(s: GameState, rackId: string): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (s.devices.some((d) => d.rackId === rackId)) return fail("error.rackNotEmpty");
  s.racks = s.racks.filter((r) => r.id !== rackId);
  book(s, "sales", "ledger.sale", { device: rack.name }, resaleValue(s, rack.price, rack.boughtAt));
  return { ok: true };
}

// Bought units go to storage.
export function buyDevice(s: GameState, modelId: string, brand: string, qty = 1): ActionResult {
  const model = shopModels(yearOf(s.hour)).find((m) => m.id === modelId);
  if (!model) return fail("error.notInShop");
  const isServer = model.kind === "server";
  if (isServer && !(SERVER_BRANDS as readonly string[]).includes(brand)) return fail("error.unknownBrand");
  if (!Number.isInteger(qty) || qty < 1) return fail("error.badQuantity");
  const total = model.price * qty;
  if (s.cash < total) return fail("error.noCash");
  const b = isServer ? brand : SWITCH_BRAND;
  const ids: string[] = [];
  for (let i = 0; i < qty; i++) {
    const name = nextName(roleOf(modelId), s.devices.map((d) => d.name));
    const id = newId(s, "dev");
    s.devices.push({ id, model: modelId, brand: b, rackId: null, slot: 0, panel: null, name, bond: "failover", groups: [], price: model.price, boughtAt: s.hour });
    ids.push(id);
  }
  book(s, "hardware", "ledger.hardware", { model: model.name, qty }, -total);
  return { ok: true, id: ids[0] };
}

function mountError(s: GameState, d: Device, rackId: string, slot: number): string | null {
  if (d.rackId || d.panel) return "error.alreadyMounted";
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return "error.unknownRack";
  if (rack.arriveAt !== null) return "error.rackMoving";
  const h = modelById(d.model).height;
  if (!Number.isInteger(slot) || slot < 1 || slot + h - 1 > rackUnits(rack.model)) return "error.outOfBounds";
  if (!freeSlots(s, rackId, h).includes(slot)) return "error.slotTaken";
  return null;
}

// A device takes a name from its new location unless it already has one there.
function mount(s: GameState, d: Device, rackId: string, slot: number) {
  const base = prefix(s, s.racks.find((r) => r.id === rackId)!.locationId);
  if (!d.name.startsWith(`${base}-`)) d.name = nextName(`${base}-${roleOf(d.model)}`, s.devices.map((x) => x.name));
  Object.assign(d, { rackId, slot });
}

export function mountDevice(s: GameState, deviceId: string, rackId: string, slot: number): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const error = mountError(s, d, rackId, slot);
  if (error) return fail(error);
  mount(s, d, rackId, slot);
  return { ok: true, id: d.id };
}

// Stored units go into the lowest free run of slots, each directly on top of the previous one.
export function mountStack(s: GameState, modelId: string, brand: string, rackId: string, count: number): ActionResult {
  const stored = s.devices.filter((d) => d.model === modelId && d.brand === brand && !d.rackId && !d.panel);
  if (!Number.isInteger(count) || count < 1 || stored.length < count) return fail("error.notInStorage");
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (rack.arriveAt !== null) return fail("error.rackMoving");
  const h = modelById(modelId).height;
  const free = new Set(freeSlots(s, rackId, h));
  const start = [...free].find((slot) => Array.from({ length: count }, (_, i) => slot + i * h).every((x) => free.has(x)));
  if (start === undefined) return fail("error.noRoom");
  stored.slice(0, count).forEach((d, i) => mount(s, d, rackId, start + i * h));
  return { ok: true, id: stored[0].id };
}

export function unmountDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.rackId) return fail("error.notMounted");
  unplug(s, new Set([d.id]));
  Object.assign(d, { rackId: null, slot: 0 });
  return { ok: true };
}

export function sellDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind === "gateway") return fail("error.cannotSell");
  unplug(s, new Set([d.id]));
  s.devices = s.devices.filter((x) => x.id !== deviceId);
  book(s, "sales", "ledger.sale", { device: d.name }, resaleValue(s, d.price, d.boughtAt));
  return { ok: true };
}

export function connect(s: GameState, a: End, b: End): ActionResult {
  const da = s.devices.find((x) => x.id === a.device);
  const db = s.devices.find((x) => x.id === b.device);
  if (!da || !db) return fail("error.unknownDevice");
  const ma = modelById(da.model), mb = modelById(db.model);
  const pa = ma.ports[a.port], pb = mb.ports[b.port];
  if (!pa || !pb) return fail("error.unknownPort");
  if (da.id === db.id) return fail("error.sameDevice");
  if (peerOf(s, a) || peerOf(s, b)) return fail("error.portInUse");
  const la = locationOf(s, da), lb = locationOf(s, db);
  if (!la || !lb) return fail("error.notMounted");
  if (s.racks.some((r) => (r.id === da.rackId || r.id === db.rackId) && r.arriveAt !== null)) return fail("error.rackMoving");
  if (la.id !== lb.id) return fail("error.otherLocation");
  if (pa.media !== pb.media) return fail("error.mediaMismatch");
  // A patch panel is passive, so the speed check happens between the devices on either side of it.
  if (ma.kind !== "patch" && mb.kind !== "patch" && pa.gbit !== pb.gbit) return fail("error.speedMismatch");
  const kind = pa.media === "rj45" ? "copper" : da.rackId === db.rackId ? "dac" : "fiber";
  const id = newId(s, "cab");
  s.cables.push({ id, a: { ...a }, b: { ...b }, kind });
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
