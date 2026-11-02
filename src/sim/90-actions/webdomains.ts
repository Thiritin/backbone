// docs/design/web-hosting.md, 4.5: the zone editor and cron screens of a web space.
import type { GameState } from "../50-state";
import { putZone, syncZone } from "../60-infra/netsvc-dns";
import { webspaceOf, type Webspace } from "../60-infra/webspace";
import { parseSchedule, scheduleHours, webZone, zoneNames } from "../60-infra/webzone";
import { cleanRecord, type RecordDraft } from "./netsvc-dns";
import type { ActionResult } from "./hardware";
import { createCron } from "./webspace";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The web space, or the error for an unknown one or a host that is offline.
function open(s: GameState, id: string): Webspace | ActionResult {
  const ws = webspaceOf(s, id), w = s.workloads.find((x) => x.id === id);
  if (!ws || !w) return fail("error.unknownWorkload");
  return s.security.offline.includes(w.clusterId ?? "") ? fail("webspace.error.offline") : ws;
}
const isFail = (x: Webspace | ActionResult): x is ActionResult => "ok" in x;

// Saves a record in one of the web space's zones; a record without an id is new. The zone is the one PowerDNZ shows.
export function saveWebRecord(s: GameState, workloadId: string, zone: string, rec: RecordDraft): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!zoneNames(ws).includes(zone)) return fail("error.unknownZone");
  const clean = cleanRecord(zone, rec);
  if (!clean) return fail("error.badRecord");
  const z = webZone(s, ws, zone), id = rec.id ?? `r${s.nextId++}`;
  if (rec.id && !z.records.some((r) => r.id === rec.id)) return fail("error.badRecord");
  const next = { id, ...clean };
  putZone(s, zone, { ...z, records: rec.id ? z.records.map((r) => (r.id === id ? next : r)) : [...z.records, next] });
  syncZone(s, zone);
  return { ok: true, id };
}

export function deleteWebRecord(s: GameState, workloadId: string, zone: string, id: string): ActionResult {
  const ws = open(s, workloadId);
  if (isFail(ws)) return ws;
  if (!zoneNames(ws).includes(zone)) return fail("error.unknownZone");
  const z = webZone(s, ws, zone);
  if (!z.records.some((r) => r.id === id)) return fail("error.badRecord");
  putZone(s, zone, { ...z, records: z.records.filter((r) => r.id !== id) });
  syncZone(s, zone);
  return { ok: true };
}

// Adds a job from the five crontab fields; it runs at most hourly.
export function createCronJob(s: GameState, workloadId: string, schedule: string, command: string): ActionResult {
  const f = parseSchedule(schedule);
  if (!f) return fail("webspace.error.cronSchedule");
  return createCron(s, workloadId, command, scheduleHours(f), f.join(" "));
}
