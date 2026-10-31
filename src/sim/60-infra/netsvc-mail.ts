// GDD, Infrastructure consoles: the deferred mail queue of an address. Numbers in economy.md, Addresses and internet.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { t } from "../../i18n/en";
import { mailAddress } from "./addresses";
import { workloadsUp } from "./cluster";
import type { MailState } from "./netsvc";

export const QUEUE_CAP = 20_000;
export const QUEUE_LIST = 30;
const idNo = (id: string) => Number(id.replace(/\D/g, ""));

export const mailsPerBox = (year: number): number => Math.round(25 + 1.75 * (year - 2005));

export const mailStateOf = (s: GameState, addressId: string): MailState => s.netsvc.mail[addressId] ?? { deferred: 0, hit: 0, listings: [] };

// A long queue means more customers notice their mail missing: up to three times the bounce chance.
export const bounceFactor = (s: GameState, addressId: string): number => 1 + Math.min(2, mailStateOf(s, addressId).deferred / 2000);

// The active mail customers' services whose mail leaves from an address.
export function mailServices(s: GameState, addressId: string): Service[] {
  const ids = new Set(s.clusters.filter((c) => c.kind === "panel" && mailAddress(s, c.id)?.id === addressId).map((c) => c.id));
  const onHost = new Set(s.workloads.filter((w) => w.clusterId && ids.has(w.clusterId) && w.serviceId).map((w) => w.serviceId));
  return s.services.filter((v) => onHost.has(v.id) && v.endedAt === null && v.spec.mailboxes > 0 && s.customers.find((c) => c.id === v.customerId)?.churnedAt === null);
}

// Daily, after the reputation run: mail piles up while the address is listed or the host is down, and drains by half a day otherwise.
export function mailQueueTick(s: GameState): void {
  const ids = new Set([...Object.keys(s.netsvc.mail), ...s.clusters.filter((c) => c.kind === "panel").flatMap((c) => mailAddress(s, c.id)?.id ?? [])]);
  const mail = { ...s.netsvc.mail }, perBox = mailsPerBox(yearOf(s.hour));
  for (const id of ids) {
    const svcs = mailServices(s, id), cur = mailStateOf(s, id);
    const blocked = s.ips.addresses.find((a) => a.id === id)?.listed || svcs.some((v) => !workloadsUp(s, v.id));
    const perDay = svcs.reduce((n, v) => n + v.spec.mailboxes * perBox, 0);
    const deferred = blocked ? Math.min(QUEUE_CAP, cur.deferred + perDay) : Math.floor(cur.deferred / 2);
    if (deferred !== cur.deferred) mail[id] = { ...cur, deferred };
  }
  s.netsvc = { ...s.netsvc, mail };
}

export interface QueueEntry { id: string; sender: string; recipient: string; bytes: number; hour: number; reason: string }

// The queue lines the consoles list: a readout of the count, made up from the address and the day and never stored.
export function queueEntries(s: GameState, addressId: string): QueueEntry[] {
  const a = s.ips.addresses.find((x) => x.id === addressId), n = Math.min(QUEUE_LIST, mailStateOf(s, addressId).deferred);
  return Array.from({ length: n }, (_, i) => {
    const r = hashRng(s.seed, idNo(addressId), Math.floor(s.hour / 24), i, 271), pick = () => Math.floor(rand(r) * 1e9);
    const id = pick().toString(16).toUpperCase().padStart(8, "0") + (pick() % 256).toString(16).toUpperCase().padStart(2, "0");
    const mx = `mx${pick() % 90 + 1}.mail${pick() % 400}.example`;
    return {
      id, sender: `user${pick() % 90 + 1}@shop${pick() % 300}.example`, recipient: `person${pick() % 900}@${mx.split(".").slice(1).join(".")}`,
      bytes: 800 + (pick() % 90_000), hour: s.hour - (pick() % 48),
      reason: a?.listed ? t("netsvc.reasonBlocked", { mx, ip: a.ip }) : t("netsvc.reasonTimeout", { mx }),
    };
  });
}
