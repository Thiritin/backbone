// GDD, Infrastructure consoles: the zones of a DNS service, their records and the site outage a wrong address causes.
// Numbers in economy.md, Tickets and work rates and Noticing outages.
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import { ascii } from "../30-customers/domains";
import { createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { serviceAddress } from "./addresses";
import { controlPlaneUp, supports, type Cluster } from "./cluster";

export type DnsType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
export interface DnsRecord { id: string; type: DnsType; name: string; ttl: number; data: string }
// A zone is stored only once the player edits it. `ask` is the address the customer wants www to point to.
export interface ZoneEdit { records: DnsRecord[]; secondary: string | null; typoAt: number | null; ask?: { ip: string; ticketId: string } }

export const TTLS = [300, 3600, 86400];
export const DNS_TICKET_HOURS = 4; // hours a site stays on a wrong address before the customer writes in
export const ASK_CHANCE = 0.1; // monthly chance per DNS service of a request to move www

export const isIpv4 = (x: string): boolean => /^(\d{1,3})(\.\d{1,3}){3}$/.test(x) && x.split(".").every((n) => Number(n) <= 255);

const dnsServices = (s: GameState): Service[] => s.services.filter((v) => v.product === "dns" && v.endedAt === null);

// The zone names of a DNS service: the customer's domain and numbered siblings of it.
export function dnsZones(s: GameState, v: Service | undefined): string[] {
  const cu = v && s.customers.find((x) => x.id === v.customerId);
  const domain = cu && s.services.find((x) => x.customerId === cu.id && x.domain)?.domain;
  const stem = domain ? domain.slice(0, domain.lastIndexOf(".")) : ascii(cu?.name ?? "") || "zone", tld = domain ? domain.slice(domain.lastIndexOf(".") + 1) : "com";
  return Array.from({ length: v?.spec.zones ?? 0 }, (_, i) => `${stem}${i ? i + 1 : ""}.${tld}`);
}

// The web hosting service a zone serves: the one on that domain, or the customer's first one for the main zone.
export function zoneWeb(s: GameState, v: Service, zone: string): Service | undefined {
  const webs = s.services.filter((x) => x.customerId === v.customerId && x.product === "webHosting" && x.endedAt === null);
  return webs.find((x) => x.domain === zone) ?? (zone === dnsZones(s, v)[0] ? webs[0] : undefined);
}

export const ownerOf = (s: GameState, zone: string): Service | undefined => dnsServices(s).find((v) => dnsZones(s, v).includes(zone));
const webIp = (s: GameState, zone: string): string | undefined => { const v = ownerOf(s, zone), w = v && zoneWeb(s, v, zone); return w ? serviceAddress(s, w.id)?.ip : undefined; };

// What a zone holds until the player edits it.
export function defaultRecords(s: GameState, zone: string): DnsRecord[] {
  const ip = webIp(s, zone), rec = (i: number, type: DnsType, name: string, data: string): DnsRecord => ({ id: `d${i}`, type, name, ttl: 3600, data });
  return [
    rec(1, "NS", "@", `ns1.${zone}`), rec(2, "NS", "@", `ns2.${zone}`),
    ...(ip ? [rec(3, "A", "@", ip), rec(4, "A", "www", ip)] : []),
    rec(5, "MX", "@", `10 mail.${zone}`), rec(6, "TXT", "@", "v=spf1 mx -all"),
  ];
}

export const zoneOf = (s: GameState, zone: string): ZoneEdit => s.netsvc.zones[zone] ?? { records: defaultRecords(s, zone), secondary: null, typoAt: null };
export const putZone = (s: GameState, zone: string, z: ZoneEdit): void => { s.netsvc = { ...s.netsvc, zones: { ...s.netsvc.zones, [zone]: z } }; };

// Marks the zone's site offline while an apex or www address points anywhere but its host (or the address the customer asked for), and restores it otherwise.
export function syncZone(s: GameState, zone: string): void {
  const v = ownerOf(s, zone), web = v && zoneWeb(s, v, zone), ip = webIp(s, zone);
  if (!web || !ip) return;
  const z = zoneOf(s, zone);
  const ok = z.records.every((r) => r.type !== "A" || (r.name !== "@" && r.name !== "www") || r.data === ip || (r.name === "www" && r.data === z.ask?.ip));
  const broken = { ...s.netsvc.broken };
  if (!ok && !broken[web.id]) broken[web.id] = { cause: "dns", since: s.hour };
  if (ok && broken[web.id]?.cause === "dns") delete broken[web.id];
  const typoAt = ok ? null : z.typoAt ?? s.hour;
  s.netsvc = { ...s.netsvc, broken };
  if (typoAt !== z.typoAt || s.netsvc.zones[zone]) putZone(s, zone, { ...z, typoAt });
  const www = z.records.find((r) => r.type === "A" && r.name === "www");
  if (ok && z.ask && www?.data === z.ask.ip) s.tickets = s.tickets.map((t) => (t.id === z.ask!.ticketId && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t));
}

// Hourly: a site that stays on a wrong address makes the customer write in. Monthly: some customers ask for www to move.
export function dnsTick(s: GameState): void {
  const month = isMonthStart(s.hour);
  for (const v of dnsServices(s)) {
    const cust = s.customers.find((c) => c.id === v.customerId);
    if (!cust || cust.churnedAt !== null) continue;
    dnsZones(s, v).forEach((zone, i) => {
      const web = zoneWeb(s, v, zone), z = zoneOf(s, zone), ip = webIp(s, zone);
      if (!web || !ip) return;
      const open = z.ask && s.tickets.some((t) => t.id === z.ask!.ticketId && !isFinal(t));
      if (z.typoAt !== null && s.hour - z.typoAt >= DNS_TICKET_HOURS && !open) {
        putZone(s, zone, { ...z, ask: { ip, ticketId: createTicket(s, cust, "howTo", web.id, "dnsChange").id } });
      } else if (month && !open && rand(hashRng(s.seed, s.hour, Number(v.id.replace(/\D/g, "")), 291 + i)) < ASK_CHANCE) {
        const r = hashRng(s.seed, s.hour, i, 292), next = `198.51.100.${1 + Math.floor(rand(r) * 250)}`;
        putZone(s, zone, { ...z, ask: { ip: next, ticketId: createTicket(s, cust, "howTo", web.id, "dnsChange").id } });
      }
    });
  }
}

// The address a ticket asks for, shown in its text.
export const askedIp = (s: GameState, ticketId: string): string => Object.values(s.netsvc.zones).find((z) => z.ask?.ticketId === ticketId)?.ask?.ip ?? "";

const primaryOf = (s: GameState, v: Service): string | undefined => s.workloads.find((w) => w.serviceId === v.id)?.clusterId ?? undefined;

// The DNS servers a zone of this service can have as its secondary: every other one.
export const secondaryChoices = (s: GameState, v: Service): Cluster[] => s.clusters.filter((c) => supports(c, "dns") && c.id !== primaryOf(s, v));

// Whether every zone of the service has a secondary that is up, so the zones keep answering with the primary down.
export function dnsCovered(s: GameState, serviceId: string): boolean {
  const v = s.services.find((x) => x.id === serviceId), zones = v ? dnsZones(s, v) : [];
  return zones.length > 0 && zones.every((z) => { const c = s.clusters.find((x) => x.id === zoneOf(s, z).secondary); return !!c && controlPlaneUp(s, c); });
}

// The zones another server answers for, by the cluster serving them.
export const slavesServed = (s: GameState, clusterId: string): string[] => dnsServices(s).flatMap((v) => dnsZones(s, v)).filter((z) => zoneOf(s, z).secondary === clusterId);
