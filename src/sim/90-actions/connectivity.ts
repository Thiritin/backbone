// docs/design/gdd/connectivity.md: the provider panel on rented racks and provider cables between them.
import { rackUnits } from "../20-world/datacenters";
import { PANEL_JACKS, PROVIDER_CABLE, PROVIDER_PANEL } from "../10-catalog/uplinks";
import { device, type End, type GameState } from "../50-state";
import { freeJack, isProviderPanel, jackRoles, panelOf, rentedFloor } from "../60-infra/panels";
import { freeSlots, heightIn } from "../60-infra/status";
import type { SimEvent } from "../88-tick/tick";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Gives every rack on a rented floor its provider panel in the top unit and takes it off racks that left one. A device in
// the top unit moves to the rack's first free units, or to the location's storage. Lines and cross-connects from before
// panels land on a free jack. Returns the names of the devices that moved.
export function syncProviderPanels(s: GameState): string[] {
  const moved: string[] = [];
  const keep = (d: { rackId: string | null }) => s.racks.some((r) => r.id === d.rackId && r.model !== "shelf" && rentedFloor(s, r));
  const gone = new Set(s.devices.filter((d) => isProviderPanel(d) && !keep(d)).map((d) => d.id));
  if (gone.size) {
    const off = (e: End) => gone.has(e.device);
    s.devices = s.devices.filter((d) => !gone.has(d.id));
    s.cables = s.cables.filter((c) => !off(c.a) && !off(c.b));
    s.providerCables = s.providerCables.filter((o) => !off(o.a) && !off(o.b));
  }
  for (const r of s.racks) {
    if (r.model === "shelf" || !rentedFloor(s, r) || panelOf(s, r.id)) continue;
    const top = rackUnits(r.model);
    for (const d of s.devices.filter((x) => x.rackId === r.id && x.slot + heightIn(s, r.id, x.model) - 1 >= top)) {
      const h = heightIn(s, r.id, d.model);
      d.rackId = null;
      const to = freeSlots(s, r.id, h).filter((x) => x + h - 1 < top)[0];
      if (to) Object.assign(d, { rackId: r.id, slot: to });
      else {
        Object.assign(d, { slot: 0, store: r.locationId });
        s.cables = s.cables.filter((c) => c.a.device !== d.id && c.b.device !== d.id);
      }
      moved.push(d.label ?? d.name);
    }
    s.devices.push(device(`dev${s.nextId++}`, PROVIDER_PANEL, "Pandoot", r.id, top, null, `${r.name}-pp`, 0));
  }
  const rackOf = (deviceId: string) => s.devices.find((d) => d.id === deviceId)?.rackId;
  const uplinks = s.network.uplinks.map((u) => ({ ...u, links: [...u.links] }));
  s.network = { ...s.network, uplinks };
  for (const u of uplinks) u.links.forEach((l, i) => {
    const rack = !l.jack && rackOf(l.device), jack = rack && freeJack(s, rack);
    if (jack) u.links[i] = { ...l, jack };
  });
  s.crossConnects = [...s.crossConnects];
  s.crossConnects.forEach((x, i) => {
    const loc = !x.jack && s.contracts.find((c) => c.id === x.contractId)?.locationId;
    const jack = loc && s.racks.filter((r) => r.locationId === loc).map((r) => freeJack(s, r.id)).find(Boolean);
    if (jack) s.crossConnects[i] = { ...x, jack };
  });
  return moved;
}

// Orders a cable from a jack on one rented rack's panel to a jack on another's in the same building. It is billed on completion.
export function orderProviderCable(s: GameState, rackA: string, jackA: number, rackB: string, jackB: number): ActionResult {
  const ra = s.racks.find((r) => r.id === rackA), rb = s.racks.find((r) => r.id === rackB);
  if (!ra || !rb) return fail("error.unknownRack");
  if (ra.id === rb.id) return fail("error.providerCableSameRack");
  const la = s.locations.find((l) => l.id === ra.locationId)!, lb = s.locations.find((l) => l.id === rb.locationId)!;
  if (!la.dc || la.dc !== lb.dc) return fail("error.otherBuilding");
  if (la.id === lb.id && la.space !== "share") return fail("error.cableByHand");
  const pa = panelOf(s, ra.id), pb = panelOf(s, rb.id);
  if (!pa || !pb) return fail("error.noProviderPanel");
  const ok = (j: number) => Number.isInteger(j) && j >= 0 && j < PANEL_JACKS;
  if (!ok(jackA) || !ok(jackB)) return fail("error.unknownPort");
  if (jackRoles(s, pa.id)[jackA] !== "free" || jackRoles(s, pb.id)[jackB] !== "free") return fail("error.jackTaken");
  const id = `pc${s.nextId++}`;
  s.providerCables = [...s.providerCables, { id, a: { device: pa.id, port: jackA }, b: { device: pb.id, port: jackB }, fee: PROVIDER_CABLE.fee, dueAt: s.hour + PROVIDER_CABLE.leadHours }];
  return { ok: true, id };
}

export function cancelProviderCable(s: GameState, id: string): ActionResult {
  if (!s.providerCables.some((o) => o.id === id)) return fail("error.unknownProviderCable");
  s.providerCables = s.providerCables.filter((o) => o.id !== id);
  return { ok: true, id };
}

// Installs the orders that are due: the cable links the two jacks and the fee is booked.
export function providerCableTick(s: GameState): SimEvent[] {
  const due = s.providerCables.filter((o) => o.dueAt <= s.hour);
  if (!due.length) return [];
  s.providerCables = s.providerCables.filter((o) => o.dueAt > s.hour);
  const name = (e: End) => s.devices.find((d) => d.id === e.device)?.name ?? "";
  for (const o of due) {
    s.cables = [...s.cables, { id: `cab${s.nextId++}`, a: o.a, b: o.b, kind: "provider", color: null }];
    s.cash = Math.round((s.cash - o.fee) * 100) / 100;
    s.ledger = [...s.ledger, { hour: s.hour, category: "rent", key: "ledger.providerCable", params: { a: name(o.a), b: name(o.b) }, amount: -o.fee }];
  }
  return due.map((o) => ({ app: "Locations", key: "event.providerCable", params: { a: name(o.a), b: name(o.b) } }));
}
