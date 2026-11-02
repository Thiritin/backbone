import { nowHours } from "../00-core/time";
import { settled, visible, type CompanyRecord } from "../60-infra/company-zone";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { cleanRecord, type RecordDraft } from "./netsvc-dns";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Deletions that have reached the world no longer need their tombstone.
const prune = (zone: CompanyRecord[], hour: number): CompanyRecord[] => zone.filter((r) => !(r.gone && settled(r, hour)));

// Adds a record to the company zone or changes one; a record without an id is new. The world sees the change once the TTL of what it replaces has passed.
export function setCompanyRecord(s: GameState, rec: RecordDraft): ActionResult {
  const domain = s.company.domain;
  if (!domain) return fail("error.needsDomain");
  const clean = cleanRecord(domain, rec), hour = nowHours(s), old = rec.id ? s.company.zone.find((r) => r.id === rec.id && !r.gone) : undefined;
  if (!clean || (rec.id && !old)) return fail("error.badRecord");
  const id = rec.id ?? `z${s.nextId++}`, next: CompanyRecord = { id, ...clean, at: hour, was: old ? visible(old, hour) : null };
  s.company = { ...s.company, zone: prune(old ? s.company.zone.map((r) => (r.id === id ? next : r)) : [...s.company.zone, next], hour) };
  return { ok: true, id };
}

// Deletes a record; the world keeps resolving it for its TTL.
export function removeCompanyRecord(s: GameState, id: string): ActionResult {
  const old = s.company.zone.find((r) => r.id === id && !r.gone), hour = nowHours(s);
  if (!old) return fail("error.badRecord");
  const was = visible(old, hour);
  const zone = was ? s.company.zone.map((r): CompanyRecord => (r.id === id ? { ...old, at: hour, was, gone: true } : r)) : s.company.zone.filter((r) => r.id !== id);
  s.company = { ...s.company, zone: prune(zone, hour) };
  return { ok: true };
}
