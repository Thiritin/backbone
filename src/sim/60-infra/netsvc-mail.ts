// GDD, Infrastructure consoles: the deferred mail queue of an address. Numbers in economy.md, Addresses and internet.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import type { GameState } from "../50-state";
import { t } from "../../i18n/en";
import { DELIST_HOURS, SPAM } from "../10-catalog/addresses";
import { bump } from "../40-support/tickets";
import { isSuspended } from "../45-billing/billing";
import { mailAddress, serviceAddress } from "./addresses";
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

// GDD, Happiness and churn: a listed mail address costs its mail customers 3 happiness on the first day and 1 on each further day, at most 10 an episode.
export const LISTING_FIRST = 3, LISTING_DAILY = 1, LISTING_CAP = 10;
const REPEAT_DAYS = 30;

// Active shady customers whose services send from an address, with the thousands of spam mails they add a day.
export function spamSenders(s: GameState, addressId: string): { service: Service; customerId: string; thousands: number }[] {
  return s.services
    .filter((v) => v.endedAt === null && serviceAddress(s, v.id)?.id === addressId)
    .filter((v) => { const c = s.customers.find((x) => x.id === v.customerId); return c?.shady && c.churnedAt === null && !isSuspended(s, c.id); })
    .map((v) => ({ service: v, customerId: v.customerId, thousands: SPAM.shady }))
    .sort((a, b) => idNo(a.service.id) - idNo(b.service.id));
}

// Hours a delisting takes: every listing in the last 30 days before this one adds a day.
export function delistHours(s: GameState, addressId: string): number {
  const m = mailStateOf(s, addressId);
  const before = m.listings.filter((h) => h !== m.since && s.hour - h < REPEAT_DAYS * 24).length;
  return DELIST_HOURS * Math.min(4, 1 + before);
}

// Daily, after the reputation run: the happiness a listing costs and the history that delays the next delisting.
export function listingTick(s: GameState): void {
  const mail = { ...s.netsvc.mail };
  const ids = new Set([...Object.keys(mail), ...s.clusters.filter((c) => c.kind === "panel").flatMap((c) => mailAddress(s, c.id)?.id ?? [])]);
  for (const id of ids) {
    const cur = mailStateOf(s, id), listed = !!s.ips.addresses.find((a) => a.id === id)?.listed;
    if (!listed) {
      if (cur.since !== undefined || cur.hit) mail[id] = { ...cur, hit: 0, since: undefined };
      continue;
    }
    const first = cur.since === undefined, loss = Math.min(first ? LISTING_FIRST : LISTING_DAILY, LISTING_CAP - cur.hit);
    const hit = new Set(mailServices(s, id).map((v) => v.customerId));
    if (loss > 0) s.customers = s.customers.map((c) => {
      if (!hit.has(c.id)) return c;
      const n = { ...c };
      bump(n, -loss);
      return n;
    });
    mail[id] = { ...cur, hit: cur.hit + Math.max(0, loss), since: first ? s.hour : cur.since, listings: first ? [...cur.listings.filter((h) => s.hour - h < 120 * 24), s.hour] : cur.listings };
  }
  s.netsvc = { ...s.netsvc, mail };
}
