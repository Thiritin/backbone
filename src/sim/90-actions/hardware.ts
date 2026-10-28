import { yearOf } from "../00-core/time";
import { CITIES, RACK_U_PER_MONTH } from "../10-catalog/economy";
import { modelById, SERVER_BRANDS, shopModels, SWITCH_BRAND } from "../10-catalog/hardware";
import type { BondMode, Device, End, GameState } from "../50-state";
import { freeSlots, peerOf } from "../60-infra/status";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;
const ROLE = { server: "srv", switch: "sw", gateway: "gw", patch: "pp" } as const;
export const RENTED_RACK_UNITS = 42;

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

function place(s: GameState, modelId: string, rackId: string, slot: number, brand: string): Device {
  const rack = s.racks.find((r) => r.id === rackId)!;
  const base = `${prefix(s, rack.locationId)}-${ROLE[modelById(modelId).kind]}`;
  const device: Device = { id: newId(s, "dev"), model: modelId, brand, rackId, slot, name: nextName(base, s.devices.map((d) => d.name)), bond: "failover", groups: [] };
  s.devices.push(device);
  return device;
}

export function rentRack(s: GameState, city: string): ActionResult {
  if (!CITIES.some((c) => c.name === city)) return fail("error.unknownCity");
  const rentPerMonth = RENTED_RACK_UNITS * RACK_U_PER_MONTH;
  if (s.cash < rentPerMonth) return fail("error.noCash");
  let loc = s.locations.find((l) => l.kind === "rented" && l.city === city);
  if (!loc) {
    loc = { id: newId(s, "loc"), kind: "rented", city, name: `${city} colocation` };
    s.locations.push(loc);
  }
  const rackBase = `${prefix(s, loc.id)}-rack`;
  const rack = { id: newId(s, "rack"), locationId: loc.id, name: nextName(rackBase, s.racks.map((r) => r.name)), units: RENTED_RACK_UNITS, shelf: false, rentPerMonth };
  s.racks.push(rack);
  place(s, "handoff", rack.id, RENTED_RACK_UNITS, SWITCH_BRAND);
  return { ok: true, id: rack.id };
}

export function buyDevice(s: GameState, modelId: string, rackId: string, slot: number, brand?: string): ActionResult {
  const model = shopModels(yearOf(s.hour)).find((m) => m.id === modelId);
  if (!model) return fail("error.notInShop");
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return fail("error.unknownRack");
  if (model.shelf !== rack.shelf) return fail(model.shelf ? "error.needsShelf" : "error.needsRack");
  if (!Number.isInteger(slot) || slot < 1 || slot + model.height - 1 > rack.units) return fail("error.outOfBounds");
  if (!freeSlots(s, rackId, model.height).includes(slot)) return fail("error.slotTaken");
  const isServer = model.kind === "server";
  const b = isServer ? (brand ?? SERVER_BRANDS[0]) : SWITCH_BRAND;
  if (isServer && !(SERVER_BRANDS as readonly string[]).includes(b)) return fail("error.unknownBrand");
  if (s.cash < model.price) return fail("error.noCash");
  const device = place(s, modelId, rackId, slot, b);
  s.cash -= model.price;
  s.ledger.push({ hour: s.hour, category: "hardware", key: "ledger.hardware", params: { model: model.name, device: device.name }, amount: -model.price });
  return { ok: true, id: device.id };
}

export function removeDevice(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (modelById(d.model).kind === "gateway") return fail("error.cannotRemove");
  // ponytail: no refund; selling at book value (economy.md, Buying and selling) comes with the used market.
  s.devices = s.devices.filter((x) => x.id !== deviceId);
  s.cables = s.cables.filter((c) => c.a.device !== deviceId && c.b.device !== deviceId);
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
  const ra = s.racks.find((r) => r.id === da.rackId)!, rb = s.racks.find((r) => r.id === db.rackId)!;
  if (ra.locationId !== rb.locationId) return fail("error.otherLocation");
  if (pa.media !== pb.media) return fail("error.mediaMismatch");
  // A patch panel is passive, so the speed check happens between the devices on either side of it.
  if (ma.kind !== "patch" && mb.kind !== "patch" && pa.gbit !== pb.gbit) return fail("error.speedMismatch");
  const kind = pa.media === "rj45" ? "copper" : ra.id === rb.id ? "dac" : "fiber";
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
