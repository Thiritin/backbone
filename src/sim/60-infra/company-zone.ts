// The company domain's own DNS zone, edited on the registrar's DNS page. A change reaches the world after the TTL of what it replaces.
import type { GameState } from "../50-state";
import type { DnsRecord, DnsType } from "./netsvc-dns";

// at is the game hour of the last change; was is what the world still sees until that change propagates (null for a new record); gone marks a deletion still propagating.
export interface CompanyRecord extends DnsRecord { at?: number; was?: DnsRecord | null; gone?: true }

// Seconds a resolver caches the absence of a record, so a new one takes this long to appear.
export const NEW_RECORD_TTL = 3600;

// The registrar's parking records every new zone starts with.
export const PARKING: CompanyRecord[] = [
  { id: "p1", type: "A", name: "@", ttl: 3600, data: "198.51.100.80" },
  { id: "p2", type: "CNAME", name: "www", ttl: 3600, data: "@" },
];

const strip = ({ id, type, name, ttl, data }: DnsRecord): DnsRecord => ({ id, type, name, ttl, data });

export const settled = (r: CompanyRecord, hour: number): boolean => r.at === undefined || (hour - r.at) * 3600 >= (r.was ? r.was.ttl : NEW_RECORD_TTL);

// What the world resolves for one record at an hour.
export const visible = (r: CompanyRecord, hour: number): DnsRecord | null => (settled(r, hour) ? (r.gone ? null : strip(r)) : r.was ?? null);

// The records of a type and name the world sees at an hour.
export const recordAt = (s: GameState, type: DnsType, name: string, hour: number): DnsRecord[] =>
  s.company.zone.map((r) => visible(r, hour)).filter((r): r is DnsRecord => !!r && r.type === type && r.name === name);

// The records the registrar's DNS page lists.
export const zoneRecords = (s: GameState): CompanyRecord[] => s.company.zone.filter((r) => !r.gone);

// The mail exchangers the world sees for the domain, best priority first.
export const mxHostsAt = (s: GameState, hour: number): string[] =>
  recordAt(s, "MX", "@", hour).map((r) => r.data.split(" ")).sort((a, b) => Number(a[0]) - Number(b[0])).map((p) => p[1].toLowerCase().replace(/\.$/, ""));
