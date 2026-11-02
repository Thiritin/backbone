// The records the company's own hosts imply in its zone (docs/design/plans/mail-core.md, Routing). They are derived on every
// read, so they follow an address change or a removed host at once and old saves get them without a migration.
import { WEBMAIL } from "../10-catalog/webmail";
import type { GameState } from "../50-state";
import { mailAddress, publicV4, publicV6 } from "./addresses";
import { isOwnVm, type Cluster } from "./cluster";
import type { CompanyRecord } from "./company-zone";
import { panelMachine } from "./licence";
import { familyOf } from "./vulns";

const TTL = 3600;

// The front end at webmail.<domain>, picked as webmail.ts picks it.
function webmailCluster(s: GameState): Cluster | undefined {
  const all = s.clusters.filter((c) => WEBMAIL.some((w) => !w.admin && w.id === (familyOf(c) ?? c.switching?.to)));
  return all.find((c) => c.id === s.webmail.default) ?? all[0];
}

export function managedRecords(s: GameState): CompanyRecord[] {
  if (!s.company.domain) return [];
  const out: CompanyRecord[] = [];
  const add = (type: "A" | "AAAA", name: string, data: string | null | undefined) => {
    if (data && !out.some((r) => r.type === type && r.name === name)) out.push({ id: `m:${type}:${name}`, type, name, ttl: TTL, data, managed: true });
  };
  const machine = (name: string, id: string | null) => {
    if (!id) return;
    add("A", name, publicV4(s, id)?.ip);
    add("AAAA", name, publicV6(s, id));
  };
  const cluster = (name: string, id: string | undefined) => {
    const c = s.clusters.find((x) => x.id === id);
    if (c) machine(name, panelMachine(c));
  };
  const m = s.company.mail;
  if (m.kind === "self") add("A", "mail", mailAddress(s, m.clusterId)?.ip);
  cluster("webmail", webmailCluster(s)?.id);
  if (s.desk?.hosting.kind === "self") cluster("support", s.desk.hosting.clusterId);
  if (s.shop.install) cluster("portal", s.shop.install.clusterId);
  for (const d of s.devices) if (d.hostname) machine(d.hostname, d.id);
  for (const w of s.workloads) if (isOwnVm(w) && w.hostname) machine(w.hostname, w.id);
  return out;
}
