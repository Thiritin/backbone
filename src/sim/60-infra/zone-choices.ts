// The values the registrar's DNS page offers for records that route traffic, as the registrar editors of the time offered
// their presets: the company's own hosts and addresses and the MX hosts of the mail services it books.
import { mxSetAt } from "../10-catalog/mail-providers";
import { deskRecords } from "../40-support/desk-records";
import type { GameState } from "../50-state";
import { machineOf } from "./cluster";
import { PARKING } from "./company-zone";
import { panelMachine } from "./licence";
import { defaultRecords, type DnsRecord, type DnsType } from "./netsvc-dns";
import { managedRecords } from "./zone-hosts";

// priority is the MX priority the provider prints for its host.
export interface RecordChoice { value: string; label: string; priority?: number }

export function recordChoices(s: GameState, type: DnsType): RecordChoice[] {
  const d = s.company.domain, managed = managedRecords(s), out: RecordChoice[] = [];
  const add = (c: RecordChoice) => { if (!out.some((x) => x.value === c.value)) out.push(c); };
  if (!d) return out;
  if (type === "A" || type === "AAAA") {
    const v = type === "A" ? 4 : 6;
    for (const r of managed.filter((x) => x.type === type)) {
      const names = managed.filter((x) => x.type === type && x.data === r.data).map((x) => x.name);
      add({ value: r.data, label: `${r.data} (${names.join(", ")})` });
    }
    for (const a of s.ips.addresses) if (a.v === v && a.holder === null) add({ value: a.ip, label: a.ip });
    for (const p of PARKING) if (p.type === type) add({ value: p.data, label: p.data });
  }
  if (type === "CNAME") {
    add({ value: "@", label: d });
    for (const r of managed) add({ value: `${r.name}.${d}`, label: `${r.name}.${d}` });
    for (const r of deskRecords(s)) if (r.type === "CNAME") add({ value: r.data, label: r.data });
  }
  if (type === "MX") {
    if (managed.some((r) => r.name === "mail")) add({ value: `mail.${d}`, label: `mail.${d}`, priority: 10 });
    for (const t of s.mail.tenants) {
      if (t.domain !== d || t.endsAt !== null || t.host === "self") continue;
      for (const [priority, host] of mxSetAt(t.host, d, s.hour)) add({ value: host, label: host, priority });
    }
    // Each mail server also answers on its machine's own name.
    for (const c of s.clusters) {
      const id = c.kind === "mail" ? panelMachine(c) : null, host = id && machineOf(s, id)?.hostname;
      if (host && managed.some((r) => r.name === host)) add({ value: `${host}.${d}`, label: `${host}.${d}`, priority: 20 });
    }
  }
  return out;
}

// The values a zone editor offers for a record of one zone: the company presets for its own domain, then what the zone's
// default and current records already point at. MX values carry their priority, as the zone editors store them.
export function zoneChoices(s: GameState, zone: string, type: DnsType, records: DnsRecord[]): string[] {
  const own = zone === s.company.domain ? recordChoices(s, type).map((c) => (type === "MX" ? `${c.priority ?? 10} ${c.value}` : c.value)) : [];
  const rest = [...defaultRecords(s, zone), ...records].filter((r) => r.type === type).map((r) => r.data);
  return [...new Set([...own, ...rest])];
}
