// GDD, Properties: renting sections of an office building, buying one, refits, notice, and the monthly rent and upkeep.
import { yearOf } from "../00-core/time";
import { nextAz } from "../20-world/datacenters";
import {
  DEPOSIT_MONTHS, FIT_POSITIONS, holdsDesks, listingById, NOTICE_MONTHS, priceFor, REFIT, rentFor, sectionIds, takenSections, UPKEEP_PER_SECTION, type Listing,
} from "../20-world/properties";
import { cents } from "../45-billing/billing";
import type { GameState, LedgerEntry, Property, SectionFit } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { closeLocation, noticeEnd, type ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

const book = (s: GameState, category: string, key: string, params: LedgerEntry["params"], amount: number) => {
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category, key, params, amount }];
};

// An office is a location from its first section on: the room the staff work in and the zone its server rooms form.
const placeOffice = (s: GameState, p: Property, readyAt: number) => {
  if (p.locationId) return;
  const city = s.locations[0]?.city ?? "Frankfurt", id = `loc${s.nextId++}`;
  s.locations = [...s.locations, { id, dc: null, city, az: nextAz(s.locations, city), name: p.building.name, space: "office", positions: 0, readyAt, extraCircuit: false }];
  p.locationId = id;
};

const ownedIn = (s: GameState, buildingId: string) => s.properties.find((p) => p.buildingId === buildingId);

// Section ids of a building nobody holds: neither another tenant nor the company.
export const freeSections = (s: GameState, l: Listing): string[] => {
  const taken = takenSections(s.seed, l), mine = new Set(ownedIn(s, l.id)?.sections.map((x) => x.id) ?? []);
  return sectionIds(l).map((x) => x.id).filter((id) => !taken.has(id) && !mine.has(id));
};

// The first section in a building makes it the office; further ones expand it. One office at a time.
export function rentSection(s: GameState, buildingId: string, sectionId: string): ActionResult {
  const l = listingById(buildingId), year = yearOf(s.hour);
  if (!l || l.from > year) return fail("error.unknownBuilding");
  const section = sectionIds(l).find((x) => x.id === sectionId);
  if (!section || !freeSections(s, l).includes(sectionId)) return fail("error.sectionTaken");
  let p = ownedIn(s, l.id);
  if (!p && s.properties.some((x) => x.kind !== "basement")) return fail("error.oneOffice");
  if (p?.noticeAt != null) return fail("error.noticeGiven");
  const rent = p?.kind === "own" ? 0 : rentFor(l, year), deposit = rent * DEPOSIT_MONTHS;
  if (s.cash < deposit) return fail("error.noCash");
  if (!p) {
    p = { id: `prop${s.nextId++}`, kind: "office", buildingId: l.id, building: { name: l.name, street: l.street, zip: l.zip, city: l.city }, sections: [], deposit: 0, noticeAt: null, boughtFor: null, locationId: null };
    s.properties = [...s.properties, p];
  }
  p.sections = [...p.sections, { id: sectionId, floor: section.floor, fit: "desks", since: s.hour, refitUntil: s.hour, rent }];
  placeOffice(s, p, s.hour);
  if (deposit) { p.deposit += deposit; book(s, "rent", "ledger.officeDeposit", { building: l.name }, -deposit); }
  return { ok: true, id: p.id };
}

// The lease ends at the month start after the notice period; the tick returns the deposit then.
export function giveNotice(s: GameState, propertyId: string): ActionResult {
  const p = s.properties.find((x) => x.id === propertyId);
  if (!p) return fail("error.unknownProperty");
  if (p.kind !== "office") return fail("error.notRented");
  if (p.noticeAt !== null) return fail("error.noticeGiven");
  p.noticeAt = s.hour;
  return { ok: true };
}

// Buying takes over every section other tenants do not hold; rent stops and the deposit comes back.
export function buyBuilding(s: GameState, buildingId: string): ActionResult {
  const l = listingById(buildingId), year = yearOf(s.hour), price = l && priceFor(l, year);
  if (!l || l.from > year) return fail("error.unknownBuilding");
  if (price == null) return fail("error.buildingNotForSale");
  let p = ownedIn(s, l.id);
  if (p?.kind === "own") return fail("error.buildingOwned");
  if (!p && s.properties.some((x) => x.kind !== "basement")) return fail("error.oneOffice");
  const back = p?.deposit ?? 0;
  if (s.cash + back < price) return fail("error.noCash");
  if (!p) {
    p = { id: `prop${s.nextId++}`, kind: "own", buildingId: l.id, building: { name: l.name, street: l.street, zip: l.zip, city: l.city }, sections: [], deposit: 0, noticeAt: null, boughtFor: null, locationId: null };
    s.properties = [...s.properties, p];
  }
  const fresh = freeSections(s, l).map((id) => ({ id, floor: sectionIds(l).find((x) => x.id === id)!.floor, fit: null, since: s.hour, refitUntil: s.hour, rent: 0 }));
  Object.assign(p, { kind: "own", noticeAt: null, boughtFor: price, deposit: 0, sections: [...p.sections.map((x) => ({ ...x, rent: 0 })), ...fresh] });
  placeOffice(s, p, s.hour);
  if (back) book(s, "rent", "ledger.officeDepositBack", { building: l.name }, back);
  book(s, "other", "ledger.buildingBought", { building: l.name }, -price);
  return { ok: true, id: p.id };
}

// The section is closed for the refit's days. A server room or closet adds rack positions to the property's office zone.
export function refitSection(s: GameState, propertyId: string, sectionId: string, fit: SectionFit): ActionResult {
  const p = s.properties.find((x) => x.id === propertyId), x = p?.sections.find((k) => k.id === sectionId);
  if (!p || !x) return fail("error.unknownProperty");
  if (!(fit in REFIT)) return fail("error.unknownFit");
  if (x.fit === fit) return fail("error.sameFit");
  if (x.refitUntil > s.hour) return fail("error.refitting");
  if (p.noticeAt !== null) return fail("error.noticeGiven");
  if (holdsDesks(x.fit) && !holdsDesks(fit) && s.staff.some((e) => e.desk?.propertyId === p.id && e.desk.sectionId === x.id)) return fail("error.desksInUse");
  const loc = s.locations.find((l) => l.id === p.locationId), gone = x.fit ? FIT_POSITIONS[x.fit] : 0;
  if (gone && loc && s.racks.some((r) => r.locationId === loc.id && r.position > loc.positions - gone)) return fail("error.racksInRoom");
  const { cost, days } = REFIT[fit];
  if (s.cash < cost) return fail("error.noCash");
  book(s, "other", "ledger.refit", { building: p.building.name }, -cost);
  if (loc) loc.positions -= gone;
  x.fit = fit;
  x.refitUntil = s.hour + 24 * days;
  if (FIT_POSITIONS[fit]) {
    placeOffice(s, p, x.refitUntil);
    s.locations.find((l) => l.id === p.locationId)!.positions += FIT_POSITIONS[fit];
  }
  return { ok: true };
}

// Rent for rented sections and upkeep for owned ones, billed with the month's other rent.
export const propertyBills = (s: GameState): LedgerEntry[] =>
  s.properties.flatMap((p): LedgerEntry[] =>
    p.kind === "office" ? [{ hour: s.hour, category: "rent", key: "ledger.officeRent", params: { building: p.building.name, n: p.sections.length }, amount: -p.sections.reduce((n, x) => n + x.rent, 0) }]
    : p.kind === "own" ? [{ hour: s.hour, category: "rent", key: "ledger.upkeep", params: { building: p.building.name, n: p.sections.length }, amount: -UPKEEP_PER_SECTION * p.sections.length }]
    : []).filter((b) => b.amount !== 0);

// At the month start the notice period ends: the deposit returns, desks there clear and the server rooms close. Racks still standing roll one more month.
export function propertiesEnd(s: GameState, events: SimEvent[]): void {
  for (const p of s.properties) {
    if (p.noticeAt === null || noticeEnd(p.noticeAt, NOTICE_MONTHS) > s.hour) continue;
    if (p.locationId && !closeLocation(s, p.locationId).ok) { p.noticeAt = noticeEnd(p.noticeAt, 0); events.push({ app: "Locations", key: "event.contractRolled", params: { location: p.building.name } }); continue; }
    if (p.deposit) book(s, "rent", "ledger.officeDepositBack", { building: p.building.name }, p.deposit);
    s.properties = s.properties.filter((x) => x.id !== p.id);
    s.staff = s.staff.map((e) => (e.desk?.propertyId === p.id ? { ...e, desk: null } : e));
    events.push({ app: "Locations", key: "event.leaseEnded", params: { building: p.building.name } });
  }
}
