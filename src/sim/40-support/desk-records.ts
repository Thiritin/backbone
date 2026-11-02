// The desk's records in the company zone (docs/design/plans/support-desk.md, Domain records): what the player adds at the
// registrar, and whether the world sees it yet.
import { nowHours } from "../00-core/time";
import { deskById, tenantHost } from "../10-catalog/desks";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { publicV4 } from "../60-infra/addresses";
import { recordAt } from "../60-infra/company-zone";
import { panelMachine } from "../60-infra/licence";
import type { DnsType } from "../60-infra/netsvc-dns";
import { deskStatus } from "./desk";

// host maps support.<domain> to the desk; spf and dkim let a hosted desk send as the company's domain.
export type DeskRecordRole = "host" | "spf" | "dkim";
export interface DeskRecord { role: DeskRecordRole; type: DnsType; name: string; data: string; ok: boolean }

const bare = (x: string) => x.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\.$/, "");

// The address a self-hosted desk's A record points to: its panel host's public IPv4, or "" while it has none.
function hostAddress(s: GameState, clusterId: string): string {
  const c = s.clusters.find((x) => x.id === clusterId), m = c && panelMachine(c);
  return (m && publicV4(s, m)?.ip) || "";
}

// The records the desk in use needs, each with whether the world resolves it at the hour. A legacy desk has no site.
export function deskRecords(s: GameState, hour = nowHours(s)): DeskRecord[] {
  const h = s.desk?.hosting, d = s.desk && deskById(s.desk.id);
  if (!h || !d || h.kind === "legacy") return [];
  const has = (type: DnsType, name: string, data: string) => !!data && recordAt(s, type, name, hour).some((r) => bare(r.data) === data);
  if (h.kind === "self") {
    const ip = hostAddress(s, h.clusterId);
    return [{ role: "host", type: "A", name: "support", data: ip, ok: has("A", "support", ip) }];
  }
  const target = tenantHost(d, s.desk!.tenant ?? ""), spf = `include:${d.sender!.spf}`;
  return [
    { role: "host", type: "CNAME", name: "support", data: target, ok: has("CNAME", "support", target) },
    { role: "spf", type: "TXT", name: "@", data: `v=spf1 ${spf} ~all`, ok: recordAt(s, "TXT", "@", hour).some((r) => /^v=spf1\b/.test(bare(r.data)) && bare(r.data).split(/\s+/).includes(spf)) },
    ...d.sender!.dkim.map((k): DeskRecord => ({ role: "dkim", type: "CNAME", name: k.name, data: k.target, ok: has("CNAME", k.name, k.target) })),
  ];
}

// Whether support.<domain> leads to the desk: the host record resolves and the desk is up.
export const deskMapped = (s: GameState, hour = nowHours(s)): boolean =>
  deskStatus(s) !== "down" && deskRecords(s, hour).some((r) => r.role === "host" && r.ok);

// The address customers reach the desk on: support.<domain> once mapped, else a hosted desk's tenant address; null for a
// self-hosted desk without its record, which answers only on its host's own name.
export function deskAddress(s: GameState, hour = nowHours(s)): string | null {
  const d = s.desk && deskById(s.desk.id);
  if (!d || s.desk!.hosting.kind === "legacy") return null;
  if (deskMapped(s, hour)) return `support.${companyDomain(s)}`;
  return s.desk!.hosting.kind === "hosted" ? tenantHost(d, s.desk!.tenant ?? "") : null;
}

// Whether the desk answers on a host name: support.<domain> once mapped, and a hosted desk's tenant address always.
export function deskHostReachable(s: GameState, host: string, hour = nowHours(s)): boolean {
  host = bare(host);
  if (host === `support.${companyDomain(s)}`) return deskMapped(s, hour);
  const d = s.desk && deskById(s.desk.id);
  return !!d && s.desk!.hosting.kind === "hosted" && host === tenantHost(d, s.desk!.tenant ?? "");
}

// Whether a hosted desk's replies go out as the company's domain; without the SPF and DKIM records they go out "via" the
// vendor. A self-hosted desk sends through the company's own mailbox.
export const senderVerified = (s: GameState, hour = nowHours(s)): boolean =>
  s.desk?.hosting.kind !== "hosted" || deskRecords(s, hour).filter((r) => r.role !== "host").every((r) => r.ok);
