import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import {
  ASN_FEE, carriersAt, COMMITS, EXCHANGE_FEES, exchangeAt, exchangeById, FIBER_GBIT, LEAD_HOURS, peerById, PEERS, speedsIn,
  ZONE_LINK_LEAD_HOURS, type Protection, type ZoneLinkKind,
} from "../10-catalog/network";
import { datacenterById } from "../20-world/datacenters";
import type { GameState, Location } from "../50-state";
import { acceptChance, activeExchanges, coolingDown, type Network, type Uplink } from "../60-infra/network";
import { locationOf, peerOf } from "../60-infra/status";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const cents = (v: number) => Math.round(v * 100) / 100;
const set = (s: GameState, patch: Partial<Network>) => { s.network = { ...s.network, ...patch }; };
const pay = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "transit", key, params, amount: -amount }];
};

// The location as a datacenter zone the player may buy network for, or the error why not.
function zone(s: GameState, locationId: string): Location | string {
  if (!s.unlocks.includes("network")) return "error.needsNetwork";
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return "error.unknownLocation";
  if (!loc.dc) return "error.basementUplink";
  return loc;
}

// The first free router port at least gbit fast in the zone: no cable in it and no uplink on it.
export function freeRouterPort(s: GameState, locationId: string, gbit: number): { device: string; port: number } | null {
  const taken = new Set(s.network.uplinks.flatMap((u) => u.links.map((l) => `${l.device}:${l.port}`)));
  for (const d of s.devices) {
    const m = modelById(d.model);
    if (m.kind !== "gateway" || locationOf(s, d)?.id !== locationId) continue;
    const port = m.ports.findIndex((p, i) => p.gbit >= gbit && !taken.has(`${d.id}:${i}`) && !peerOf(s, { device: d.id, port: i }));
    if (port >= 0) return { device: d.id, port };
  }
  return null;
}

function addLink(s: GameState, u: Uplink, gbit: number): ActionResult {
  if (!speedsIn(yearOf(s.hour)).includes(gbit)) return fail("error.speedLater");
  const port = freeRouterPort(s, u.locationId, gbit);
  if (!port) return fail("error.noRouterPort");
  const link = { id: `lnk${s.nextId++}`, gbit, ...port, readyAt: s.hour + LEAD_HOURS };
  set(s, { uplinks: [...s.network.uplinks.filter((x) => x.id !== u.id), { ...u, links: [...u.links, link] }] });
  return { ok: true, id: link.id };
}

// Signs a transit contract with a carrier on site: one link of gbit, with a commit share from COMMITS.
export function orderTransit(s: GameState, locationId: string, carrierId: string, gbit: number, commit: number): ActionResult {
  const loc = zone(s, locationId);
  if (typeof loc === "string") return fail(loc);
  if (!carriersAt(datacenterById(loc.dc!)).some((c) => c.id === carrierId)) return fail("error.carrierAbsent");
  if (!COMMITS.some((c) => c.share === commit)) return fail("error.unknownCommit");
  const u: Uplink = { id: `up${s.nextId++}`, locationId, kind: "transit", partner: carrierId, commit, links: [], samples: [] };
  return addLink(s, u, gbit);
}

// Adds a port at the zone's exchange; the first port in a zone opens the exchange uplink there.
export function orderExchangePort(s: GameState, locationId: string, gbit: number): ActionResult {
  const loc = zone(s, locationId);
  if (typeof loc === "string") return fail(loc);
  const x = exchangeAt(datacenterById(loc.dc!));
  if (!x) return fail("error.noExchange");
  if (!s.network.memberships.includes(x.id)) return fail("error.notMember");
  const u = s.network.uplinks.find((v) => v.kind === "exchange" && v.partner === x.id && v.locationId === locationId)
    ?? { id: `up${s.nextId++}`, locationId, kind: "exchange" as const, partner: x.id, commit: 0, links: [], samples: [] };
  return addLink(s, u, gbit);
}

export function addUplinkLink(s: GameState, uplinkId: string, gbit: number): ActionResult {
  const u = s.network.uplinks.find((x) => x.id === uplinkId);
  return u ? addLink(s, u, gbit) : fail("error.unknownUplink");
}

export function cancelUplink(s: GameState, uplinkId: string): ActionResult {
  if (!s.network.uplinks.some((u) => u.id === uplinkId)) return fail("error.unknownUplink");
  set(s, { uplinks: s.network.uplinks.filter((u) => u.id !== uplinkId) });
  return { ok: true, id: uplinkId };
}

// Registers your own AS number, which exchanges ask for.
export function registerAsn(s: GameState): ActionResult {
  if (!s.unlocks.includes("network")) return fail("error.needsNetwork");
  if (s.network.asn) return fail("error.hasAsn");
  if (s.cash < ASN_FEE) return fail("error.noCash");
  const asn = 20000 + Math.floor(rand(hashRng(s.seed, 0xa5)) * 40000);
  pay(s, "ledger.asn", { asn }, ASN_FEE);
  set(s, { asn });
  return { ok: true, id: String(asn) };
}

export function joinExchange(s: GameState, exchangeId: string): ActionResult {
  if (!s.unlocks.includes("network")) return fail("error.needsNetwork");
  const x = exchangeById(exchangeId);
  if (!x) return fail("error.noExchange");
  if (!s.network.asn) return fail("error.needsAsn");
  if (s.network.memberships.includes(x.id)) return fail("error.alreadyMember");
  if (s.cash < EXCHANGE_FEES.setup) return fail("error.noCash");
  pay(s, "ledger.exchangeJoin", { exchange: x.name }, EXCHANGE_FEES.setup);
  set(s, { memberships: [...s.network.memberships, x.id] });
  return { ok: true, id: x.id };
}

export function acceptPeering(s: GameState, requestId: string): ActionResult {
  const r = s.network.requests.find((x) => x.id === requestId);
  if (!r) return fail("error.unknownRequest");
  set(s, { requests: s.network.requests.filter((x) => x.id !== r.id), sessions: [...s.network.sessions, { peer: r.peer, exchange: r.exchange, since: s.hour }] });
  return { ok: true, id: r.peer };
}

export function rejectPeering(s: GameState, requestId: string): ActionResult {
  const r = s.network.requests.find((x) => x.id === requestId);
  if (!r) return fail("error.unknownRequest");
  set(s, { requests: s.network.requests.filter((x) => x.id !== r.id), declined: { ...s.network.declined, [r.peer]: s.hour } });
  return { ok: true, id: r.peer };
}

// Asks a network for a session on an exchange you have a port at; a no keeps you from asking again for a while.
export function requestPeering(s: GameState, peerId: string, exchangeId: string): ActionResult {
  const p = peerById(peerId);
  if (!p || p.policy === "routeServer") return fail("error.unknownPeer");
  if (!activeExchanges(s).includes(exchangeId) || !p.exchanges.includes(exchangeId)) return fail("error.peerNotThere");
  if (s.network.sessions.some((x) => x.peer === p.id && x.exchange === exchangeId)) return fail("error.alreadyPeering");
  if (coolingDown(s, p.id)) return fail("error.peerDeclined");
  const yes = rand(hashRng(s.seed, s.hour, 0xacc, PEERS.indexOf(p))) < acceptChance(s, p);
  const requests = s.network.requests.filter((r) => r.peer !== p.id);
  if (yes) set(s, { requests, sessions: [...s.network.sessions, { peer: p.id, exchange: exchangeId, since: s.hour }] });
  else set(s, { requests, declined: { ...s.network.declined, [p.id]: s.hour } });
  return { ok: true, id: yes ? "accepted" : "declined" };
}

export function endPeering(s: GameState, peerId: string, exchangeId: string): ActionResult {
  if (!s.network.sessions.some((x) => x.peer === peerId && x.exchange === exchangeId)) return fail("error.unknownPeer");
  set(s, { sessions: s.network.sessions.filter((x) => !(x.peer === peerId && x.exchange === exchangeId)) });
  return { ok: true, id: peerId };
}

// Leases a link between two datacenter zones: a wavelength of gbit, or dark fiber within a region.
export function orderZoneLink(s: GameState, a: string, b: string, kind: ZoneLinkKind, gbit: number): ActionResult {
  const la = zone(s, a), lb = zone(s, b);
  if (typeof la === "string") return fail(la);
  if (typeof lb === "string") return fail(lb);
  if (a === b) return fail("error.linkSameZone");
  if (kind === "fiber" && la.city !== lb.city) return fail("error.fiberRegion");
  const speed = kind === "fiber" ? FIBER_GBIT : gbit;
  if (kind === "wave" && !speedsIn(yearOf(s.hour)).includes(gbit)) return fail("error.speedLater");
  const id = `zl${s.nextId++}`;
  set(s, { zoneLinks: [...s.network.zoneLinks, { id, a, b, kind, gbit: speed, readyAt: s.hour + ZONE_LINK_LEAD_HOURS, carried: 0 }] });
  return { ok: true, id };
}

export function cancelZoneLink(s: GameState, id: string): ActionResult {
  if (!s.network.zoneLinks.some((z) => z.id === id)) return fail("error.unknownZoneLink");
  set(s, { zoneLinks: s.network.zoneLinks.filter((z) => z.id !== id) });
  return { ok: true, id };
}

export function setProtection(s: GameState, protection: Protection): ActionResult {
  if (!s.unlocks.includes("network")) return fail("error.needsNetwork");
  set(s, { protection });
  return { ok: true, id: protection };
}

// Drops all traffic to the attacked address, or lets it through again.
export function setBlackhole(s: GameState, attackId: string, on: boolean): ActionResult {
  if (!s.network.attacks.some((a) => a.id === attackId)) return fail("error.unknownAttack");
  set(s, { attacks: s.network.attacks.map((a) => (a.id === attackId ? { ...a, blackholed: on } : a)) });
  return { ok: true, id: attackId };
}

