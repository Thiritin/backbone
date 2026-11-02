import type { GameState } from "../50-state";
import { isIpv4, ownerOf, putZone, secondaryChoices, syncZone, TTLS, zoneOf, type DnsRecord, type DnsType } from "../60-infra/netsvc-dns";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const TYPES: DnsType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

// The record name relative to its zone, or null when it lies outside it.
function relative(zone: string, raw: string): string | null {
  let n = raw.trim().toLowerCase();
  if (n.endsWith(".")) { if (!(n === `${zone}.` || n.endsWith(`.${zone}.`))) return null; n = n.slice(0, -1); }
  if (n === zone || n === "") return "@";
  if (n.endsWith(`.${zone}`)) n = n.slice(0, -zone.length - 1);
  return /^(@|[a-z0-9_*]([a-z0-9._-]*[a-z0-9])?)$/.test(n) ? n : null;
}

export type RecordDraft = Omit<DnsRecord, "id"> & { id?: string };

// The record with its name made relative to the zone and its data trimmed, or null when it is not a valid record.
export function cleanRecord(zone: string, rec: RecordDraft): Omit<DnsRecord, "id"> | null {
  const name = relative(zone, rec.name), data = rec.data.trim();
  if (!name || !TYPES.includes(rec.type) || !TTLS.includes(rec.ttl) || !data) return null;
  if (rec.type === "A" && !isIpv4(data)) return null;
  if (rec.type === "AAAA" && !/^[0-9a-f:]*:[0-9a-f:]*$/i.test(data)) return null;
  if (rec.type === "CNAME" && name === "@") return null;
  if (rec.type === "MX" && !/^\d{1,5} [a-z0-9._-]+$/i.test(data)) return null;
  return { type: rec.type, name, ttl: rec.ttl, data };
}

// Saves a record; a record without an id is new. The change applies at once, and a wrong address for the site takes it offline.
export function saveRecord(s: GameState, zone: string, rec: RecordDraft): ActionResult {
  if (!ownerOf(s, zone)) return fail("error.unknownZone");
  const clean = cleanRecord(zone, rec);
  if (!clean) return fail("error.badRecord");
  const z = zoneOf(s, zone), id = rec.id ?? `r${s.nextId++}`, next: DnsRecord = { id, ...clean };
  if (rec.id && !z.records.some((r) => r.id === rec.id)) return fail("error.badRecord");
  putZone(s, zone, { ...z, records: rec.id ? z.records.map((r) => (r.id === id ? next : r)) : [...z.records, next] });
  syncZone(s, zone);
  return { ok: true, id };
}

export function deleteRecord(s: GameState, zone: string, id: string): ActionResult {
  if (!ownerOf(s, zone)) return fail("error.unknownZone");
  const z = zoneOf(s, zone);
  if (!z.records.some((r) => r.id === id)) return fail("error.badRecord");
  putZone(s, zone, { ...z, records: z.records.filter((r) => r.id !== id) });
  syncZone(s, zone);
  return { ok: true };
}

// Names the server that answers for a zone when the primary is down; null removes it.
export function setSecondary(s: GameState, zone: string, clusterId: string | null): ActionResult {
  const v = ownerOf(s, zone);
  if (!v) return fail("error.unknownZone");
  if (clusterId !== null && !secondaryChoices(s, v).some((c) => c.id === clusterId)) return fail("error.badSecondary");
  putZone(s, zone, { ...zoneOf(s, zone), secondary: clusterId });
  return { ok: true };
}
