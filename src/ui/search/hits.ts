import { t } from "../../i18n/en";
import { fqdn } from "../../sim/30-customers/domains";
import { subjectParams } from "../../sim/40-support/notices";
import type { GameState } from "../../sim/50-state";
import { isOwnVm } from "../../sim/60-infra/cluster";
import { privateIp, publicV4 } from "../../sim/60-infra/addresses";
import { adminUrl, companyUrl, resolve } from "../../sim/80-business/browser";
import { registrarHost, REGISTRARS } from "../../sim/10-catalog/registrars";
import { APPS, appFor } from "../apps/registry";
import { vmLabel } from "../apps/products/parts";
import { rank, type Rankable } from "./rank";

export const GROUPS = ["Apps", "Customers", "Services", "Machines", "Tickets", "Sites and consoles", "Locations", "Settings"] as const;
export type Group = (typeof GROUPS)[number];

export interface Hit extends Rankable {
  group: Group; id: string; title: string; sub?: string;
  // The app to open and the focus it gets.
  app: string; target?: { kind: string; id: string };
}

export const PER_GROUP = 6, TOTAL = 24;
export const SETTINGS_SECTIONS = ["Company", "Appearance", "Sound", "Notifications"];

// Every tickets list in a long game is long; the newest are the ones worth finding.
const TICKETS = 300;

function collect(s: GameState): Hit[] {
  const has = (app: string) => s.installed.includes(app);
  const hits: Hit[] = [];
  const add = (h: Omit<Hit, "id"> & { id?: string }) => hits.push({ ...h, id: h.id ?? h.title });

  for (const a of APPS) {
    if (a.hidden || !has(a.name)) continue;
    const shown = appFor(s, a.name).name;
    add({ group: "Apps", title: shown, keys: [...new Set([a.name, shown])], app: a.name });
  }

  const customers = new Map(s.customers.map((c) => [c.id, c]));
  for (const c of s.customers.filter((x) => !x.sponsor)) add({ group: "Customers", id: c.id, title: c.name, keys: [c.name], recent: c.since, app: "Customers", target: { kind: "customer", id: c.id } });

  for (const v of s.services) {
    if (v.endedAt !== null) continue;
    const host = v.hostname ? fqdn(s, v.hostname) : undefined, who = customers.get(v.customerId)?.name;
    add({
      group: "Services", id: v.id, title: v.hostname ?? v.domain ?? v.label, sub: [...new Set([v.label, v.domain, who])].filter((x) => x && x !== (v.hostname ?? v.domain ?? v.label)).join(" · "),
      keys: [v.hostname, host, v.label, v.domain].filter((x): x is string => !!x), recent: v.startedAt, app: "Customers", target: { kind: "customer", id: v.customerId },
    });
  }

  const addresses = (id: string) => [privateIp(s, id), publicV4(s, id)?.ip].filter((x): x is string => !!x);
  for (const d of s.devices) {
    if (!d.hostname) continue;
    const name = d.label ?? d.name;
    add({ group: "Machines", id: d.id, title: d.hostname, sub: name, keys: [d.hostname, name, ...addresses(d.id)], recent: d.boughtAt, app: "Locations", target: { kind: "device", id: d.id } });
  }
  if (has("Virtual machines")) {
    for (const w of s.workloads) {
      if (!isOwnVm(w) || !w.hostname) continue;
      const name = vmLabel(s, w).name;
      add({ group: "Machines", id: w.id, title: w.hostname, sub: name === w.hostname ? undefined : name, keys: [w.hostname, name, ...addresses(w.id)], recent: w.placedAt, app: "Virtual machines", target: { kind: "workload", id: w.id } });
    }
  }

  for (const tk of s.tickets.slice(-TICKETS)) {
    const subject = t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(s, tk));
    add({ group: "Tickets", id: tk.id, title: subject, sub: customers.get(tk.customerId)?.name, keys: [subject], recent: tk.createdAt, app: "Support", target: { kind: "ticket", id: tk.id } });
  }

  const site = (title: string, url: string, sub?: string) => {
    if (resolve(s, url).page.kind !== "notfound") add({ group: "Sites and consoles", title, sub, keys: [title, url], app: "Browser", target: { kind: "url", id: url } });
  };
  site(companyUrl(s).replace(/\/$/, ""), companyUrl(s), s.company.name);
  site("Admin", adminUrl(s));
  for (const r of REGISTRARS) site(r.name, `www.${registrarHost(r)}/`, "Domains");
  for (const v of s.services) if (v.domain && v.endedAt === null) site(v.domain, v.domain, customers.get(v.customerId)?.name);
  for (const d of s.devices) if (d.hostname) site(fqdn(s, d.hostname), fqdn(s, d.hostname), d.label ?? d.name);
  for (const w of s.workloads) if (isOwnVm(w) && w.hostname) site(fqdn(s, w.hostname), fqdn(s, w.hostname), vmLabel(s, w).name);

  for (const l of s.locations) add({ group: "Locations", id: l.id, title: l.name, sub: l.city, keys: [l.name, l.city], app: "Locations", target: { kind: "location", id: l.id } });

  for (const name of SETTINGS_SECTIONS) {
    add({ group: "Settings", title: name, keys: [name], app: "Settings", target: name === "Notifications" ? { kind: "notifications", id: "" } : { kind: "section", id: name } });
  }
  return hits;
}

// The ranked results for a query: up to PER_GROUP per group in group order, TOTAL altogether.
export function search(s: GameState, query: string): Hit[] {
  if (!query.trim()) return [];
  const all = collect(s);
  return GROUPS.flatMap((g) => rank(query, all.filter((h) => h.group === g)).slice(0, PER_GROUP)).slice(0, TOTAL);
}
