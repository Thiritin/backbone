import { yearOf } from "../00-core/time";
import { DELIST_HOURS, freeBlock, LIR_FEES, transferPrice } from "../10-catalog/addresses";
import type { GameState } from "../50-state";
import { buyLineExtra, buyProvider, dynamicLine, holderOf, lineActive, machineLocation, v6Offered } from "../60-infra/addresses";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const book = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "rent", key, params, amount: -amount }];
};

// Rents more addresses from a datacenter's provider, billed monthly; the home line brings its own.
export function buyAddresses(s: GameState, locationId: string, v: 4 | 6, count: number): ActionResult {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return fail("error.unknownLocation");
  if (!loc.dc && (v === 6 || !lineActive(s) || dynamicLine(s))) return fail("error.addressesFromLine");
  if (v === 6 && !v6Offered(s, loc)) return fail("error.noIpv6");
  if (!Number.isInteger(count) || count < 1 || count > 64) return fail("error.addressCount");
  for (let i = 0; i < count; i++) if (loc.dc) buyProvider(s, loc, v); else buyLineExtra(s, loc);
  return { ok: true };
}

// Gives a free provider address back; it is no longer billed from the next month.
export function releaseAddress(s: GameState, id: string): ActionResult {
  const a = s.ips.addresses.find((x) => x.id === id);
  if (!a) return fail("error.unknownAddress");
  if (a.source !== "provider" && a.source !== "lineExtra") return fail("error.addressNotRented");
  if (a.holder) return fail("error.addressInUse");
  s.ips = { ...s.ips, addresses: s.ips.addresses.filter((x) => x.id !== id) };
  return { ok: true };
}

// Assigns a free address to a server, VM or service in its location, or frees it with machineId null.
export function assignAddress(s: GameState, id: string, machineId: string | null): ActionResult {
  const a = s.ips.addresses.find((x) => x.id === id);
  if (!a) return fail("error.unknownAddress");
  if (a.holder?.startsWith("gw:")) return fail("error.addressInUse");
  if (machineId === null) {
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((x) => (x.id === id ? { ...x, holder: null } : x)) };
    return { ok: true };
  }
  if (a.holder) return fail("error.addressInUse");
  if (machineLocation(s, machineId)?.id !== a.locationId) return fail("error.addressElsewhere");
  const holder = holderOf(s, machineId);
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((x) => (x.id === id ? { ...x, holder } : x)) };
  return { ok: true };
}

// Asks the blocklists to drop a listed address; it works once nothing sends spam from it.
export function requestDelist(s: GameState, id: string): ActionResult {
  const a = s.ips.addresses.find((x) => x.id === id);
  if (!a) return fail("error.unknownAddress");
  if (!a.listed) return fail("error.notListed");
  if (a.source === "line" && dynamicLine(s)) return fail("error.dynamicRange");
  if (a.delistAt !== null) return fail("error.delistRequested");
  if (a.spam > 0) return fail("error.stillSpamming");
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((x) => (x.id === id ? { ...x, delistAt: s.hour + DELIST_HOURS } : x)) };
  return { ok: true };
}

// Joins RIPE as a LIR: a sign-up fee, a yearly fee and the free block of the year. Needs a rented location to announce from.
export function joinLir(s: GameState): ActionResult {
  if (s.ips.lir) return fail("error.alreadyLir");
  if (!s.locations.some((l) => l.dc)) return fail("error.lirNeedsDatacenter");
  if (s.cash < LIR_FEES.signup) return fail("error.noCash");
  book(s, "ledger.lirSignup", {}, LIR_FEES.signup);
  s.ips = { ...s.ips, lir: { since: s.hour, asn: 200000 + (s.seed % 9000) * 7 } };
  const free = freeBlock(s.hour)!;
  addBlock(s, free.size, free.prefix);
  return { ok: true };
}

// Buys a /24 on the transfer market.
export function buyBlock(s: GameState): ActionResult {
  if (!s.ips.lir) return fail("error.needsLir");
  const price = 256 * transferPrice(yearOf(s.hour));
  if (s.cash < price) return fail("error.noCash");
  book(s, "ledger.blockBought", { size: 256 }, price);
  addBlock(s, 256, 24);
  return { ok: true };
}

function addBlock(s: GameState, size: number, prefix: number): void {
  // Third octets on multiples of eight keep a /21 aligned.
  const n = s.nextId++, second = 1 + ((n * 37) % 254), third = (n * 8) % 248;
  s.ips = { ...s.ips, blocks: [...s.ips.blocks, { id: `blk${n}`, prefix: `185.${second}.${third}.0/${prefix}`, size, locationId: null, boughtAt: s.hour }] };
}

// Announces a block from a rented location; its addresses become free there. A block with addresses in use stays put.
export function announceBlock(s: GameState, blockId: string, locationId: string): ActionResult {
  const b = s.ips.blocks.find((x) => x.id === blockId), loc = s.locations.find((l) => l.id === locationId);
  if (!b) return fail("error.unknownBlock");
  if (!loc?.dc) return fail("error.lirNeedsDatacenter");
  if (s.ips.addresses.some((a) => a.blockId === b.id && a.holder)) return fail("error.addressInUse");
  s.ips = { ...s.ips, blocks: s.ips.blocks.map((x) => (x.id === b.id ? { ...x, locationId } : x)), addresses: s.ips.addresses.filter((a) => a.blockId !== b.id) };
  return { ok: true };
}
