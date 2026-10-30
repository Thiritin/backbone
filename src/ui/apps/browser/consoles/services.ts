// What the DNS, VPN, storage and mail software holds, read from the customers' services on a cluster.
import { ascii, companyDomain } from "../../../../sim/30-customers/domains";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { vmState } from "../../products/parts";

export interface Tenant { id: string; hostname: string; customer: string; zones: string[]; users: number; diskGb: number; running: boolean }

export function tenants(game: GameState, c: Cluster): Tenant[] {
  return game.workloads.filter((w) => w.clusterId === c.id).map((w) => {
    const v = game.services.find((x) => x.id === w.serviceId), cu = v && game.customers.find((x) => x.id === v.customerId);
    const domain = cu && game.services.find((x) => x.customerId === cu.id && x.domain)?.domain;
    const stem = domain ? domain.slice(0, domain.lastIndexOf(".")) : ascii(cu?.name ?? "") || "zone", tld = domain ? domain.slice(domain.lastIndexOf(".") + 1) : "com";
    const zones = Array.from({ length: v?.spec.zones ?? 0 }, (_, i) => `${stem}${i ? i + 1 : ""}.${tld}`);
    return { id: w.id, hostname: w.hostname ?? w.id, customer: cu?.name ?? "", zones, users: v?.spec.users ?? 0, diskGb: w.diskGb, running: vmState(game, w) === "running" };
  });
}

// The company's own mailboxes: one per employee plus the shared ones.
export function mailboxes(game: GameState): string[] {
  const domain = companyDomain(game);
  return ["admin", "support", "billing", ...game.staff.map((e) => ascii(e.name.split(" ")[0]))].map((x) => `${x}@${domain}`);
}

// A stable fake key or serial from an id, so the same machine always prints the same values.
export function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const wgKey = (seed: string): string => Array.from({ length: 43 }, (_, i) => B64[hash(`${seed}:${i}`) % 64]).join("") + "=";
