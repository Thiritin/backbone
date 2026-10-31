import type { GameState } from "../50-state";
import { isIpv4, ownerOf, putZone, syncZone, TTLS, zoneOf, type DnsRecord, type DnsType } from "../60-infra/netsvc-dns";
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

// Saves a record; a record without an id is new. The change applies at once, and a wrong address for the site takes it offline.
export function saveRecord(s: GameState, zone: string, rec: Omit<DnsRecord, "id"> & { id?: string }): ActionResult {
  if (!ownerOf(s, zone)) return fail("error.unknownZone");
  const name = relative(zone, rec.name), data = rec.data.trim();
  if (!name || !TYPES.includes(rec.type) || !TTLS.includes(rec.ttl) || !data) return fail("error.badRecord");
  if (rec.type === "A" && !isIpv4(data)) return fail("error.badRecord");
  if (rec.type === "AAAA" && !/^[0-9a-f:]*:[0-9a-f:]*$/i.test(data)) return fail("error.badRecord");
  if (rec.type === "CNAME" && name === "@") return fail("error.badRecord");
  const z = zoneOf(s, zone), id = rec.id ?? `r${s.nextId++}`, next: DnsRecord = { id, type: rec.type, name, ttl: rec.ttl, data };
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
