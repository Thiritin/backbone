// GDD, Infrastructure consoles: MinnIO buckets and erasure sets, OwnClod shared links. Numbers in economy.md, Happiness and churn
// and Hardware, power and failures.
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart } from "../00-core/time";
import type { Service } from "../30-customers/customers";
import type { SimEvent } from "../88-tick/tick";
import { bump, createTicket, isFinal } from "../40-support/tickets";
import type { Component, Device, GameState } from "../50-state";
import { drivesOf } from "./status";
import { effParity } from "./cluster";

export type BucketPolicy = "private" | "readonly" | "public";
export interface Bucket { id: string; name: string; policy: BucketPolicy; usedGb: number; publicSince: number | null }
export interface Share { id: string; name: string; createdAt: number; expiresAt: number | null; password: boolean }

export const MAX_BUCKETS = 5;
export const PUBLIC_REQUEST = 0.06, EXPOSURE = 0.04, EXPOSURE_LOSS = 25, PUBLIC_GAIN = 3, DECLINE_LOSS = 2, PRIVATE_LOSS = 1;
export const DEGRADED_HOURS = 72, HEAL_GB_PER_HOUR = 40;
export const LEAK_AGE_DAYS = 90, LEAK_LOSS = 20, LINK_TICKET = 0.1, LINK_KEEP_DAYS = 30;
export const EXPIRY_CHOICES = [0, 7, 30, 90];
const WORDS = ["backup", "media", "logs", "assets", "archive"];

const numOf = (id: string) => Number(id.replace(/\D/g, ""));
const familyOf = (c: { panel: string | null; platform: string | null }): string | null => c.panel ?? c.platform;
const family = (s: GameState, v: Service): string | null => {
  const c = s.clusters.find((x) => s.workloads.some((w) => w.serviceId === v.id && w.clusterId === x.id));
  return c ? familyOf(c) : null;
};
const live = (s: GameState, v: Service) => s.customers.find((c) => c.id === v.customerId && c.churnedAt === null);

export const storageServices = (s: GameState): Service[] => s.services.filter((v) => v.product === "storage" && v.endedAt === null);
export const storageOnCluster = (s: GameState, clusterId: string): Service[] => storageServices(s).filter((v) => s.workloads.some((w) => w.serviceId === v.id && w.clusterId === clusterId));
export const isOwnclod = (s: GameState, v: Service): boolean => family(s, v) === "ownclod";

// Stored GB of a service: its booked disk, filled from 30% at signup by a fifth a year. A rougher curve than the web spaces use,
// since usage.ts cannot be imported from here without a module cycle.
export function serviceUsedGb(s: GameState, v: Service): number {
  const years = Math.max(0, s.hour - v.startedAt) / 8760;
  return Math.round(v.spec.diskGb * Math.min(1, 0.3 + 0.2 * years) * 10) / 10;
}

const stemOf = (s: GameState, v: Service): string => (s.customers.find((c) => c.id === v.customerId)?.name ?? "data").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "data";

// Until a bucket changes, the list is derived: one private bucket that holds the whole service. Stored lists keep the first bucket live.
export function bucketsOf(s: GameState, v: Service): Bucket[] {
  const stored = s.netsvc.buckets[v.id];
  const first: Bucket = { id: "b1", name: `${stemOf(s, v)}-data`, policy: "private", usedGb: serviceUsedGb(s, v), publicSince: null };
  if (!stored) return [first];
  return stored.map((b) => (b.id === "b1" ? { ...b, usedGb: serviceUsedGb(s, v) } : b));
}
export const putBuckets = (s: GameState, v: Service, list: Bucket[]): void => { s.netsvc = { ...s.netsvc, buckets: { ...s.netsvc.buckets, [v.id]: list } }; };

// Erasure sets: the drives of a MinnIO cluster form sets of up to 16; the parity is how many of them can fail.
export const ecParity = (s: GameState, clusterId: string): number => s.netsvc.ec[clusterId] ?? 2;

export interface EcDrive { deviceId: string; component: Component; online: boolean; healing: number | null }
export interface EcHealth { drives: EcDrive[]; set: number; failed: number; parity: number; state: "healthy" | "degraded" | "offline"; since: number | null; healing: number | null }

export function ecHealth(s: GameState, clusterId: string): EcHealth {
  const c = s.clusters.find((x) => x.id === clusterId);
  const devices = (c?.nodes ?? []).map((n) => s.devices.find((d) => d.id === n.deviceId)).filter((d): d is Device => !!d);
  const used = storageOnCluster(s, clusterId).reduce((n, v) => n + serviceUsedGb(s, v), 0), total = devices.reduce((n, d) => n + drivesOf(d).length, 0);
  const healHours = Math.max(1, used / Math.max(1, total) / HEAL_GB_PER_HOUR);
  const drives: EcDrive[] = devices.flatMap((d) => {
    const oldest = Math.min(...drivesOf(d).map((x) => x.installedAt));
    return drivesOf(d).map((x) => {
      const age = s.hour - x.installedAt, healing = x.failedAt === null && x.installedAt > oldest && age < healHours ? age / healHours : null;
      return { deviceId: d.id, component: x, online: x.failedAt === null, healing };
    });
  });
  const failed = drives.filter((x) => !x.online).length, set = Math.min(16, drives.length), parity = effParity(ecParity(s, clusterId), set);
  const heals = drives.filter((x) => x.healing !== null);
  return {
    drives, set, failed, parity, state: failed === 0 ? "healthy" : failed <= parity ? "degraded" : "offline",
    since: failed ? Math.min(...drives.filter((x) => !x.online).map((x) => x.component.failedAt!)) : null,
    healing: heals.length ? Math.min(...heals.map((x) => x.healing!)) : null,
  };
}

const happier = (s: GameState, customerId: string, d: number) => { s.customers = s.customers.map((c) => { if (c.id !== customerId) return c; const n = { ...c }; bump(n, d); return n; }); };

// Hourly: a degraded set slows its customers and, left alone, wears on them; a set that lost more than its parity is offline.
function ecTick(s: GameState): void {
  const day = s.hour % 24 === 0;
  for (const c of s.clusters) {
    if (familyOf(c) !== "minnio") continue;
    const h = ecHealth(s, c.id), services = storageOnCluster(s, c.id);
    if (h.state === "offline") {
      const add = Object.fromEntries(services.filter((v) => !s.netsvc.broken[v.id]).map((v) => [v.id, { cause: "storage" as const, since: s.hour }]));
      if (Object.keys(add).length) s.netsvc = { ...s.netsvc, broken: { ...s.netsvc.broken, ...add } };
    } else {
      const broken = { ...s.netsvc.broken };
      for (const v of services) if (broken[v.id]?.cause === "storage") delete broken[v.id];
      if (Object.keys(broken).length !== Object.keys(s.netsvc.broken).length) s.netsvc = { ...s.netsvc, broken };
    }
    if (h.state !== "degraded") continue;
    const ids = new Set(services.map((v) => v.id));
    s.services = s.services.map((v) => (ids.has(v.id) ? { ...v, slowedAt: s.hour } : v));
    if (day && h.since !== null && s.hour - h.since > DEGRADED_HOURS) for (const v of services) happier(s, v.customerId, -1);
  }
}

// Monthly: new buckets, requests to open one up, and the chance a public one gets found.
function bucketTick(s: GameState, events: SimEvent[]): void {
  for (const v of storageServices(s)) {
    const cust = live(s, v);
    if (!cust) continue;
    const r = hashRng(s.seed, s.hour, numOf(v.id), 311);
    let list = bucketsOf(s, v);
    if (list.length < MAX_BUCKETS && rand(r) < 0.2) {
      const id = `b${list.length + 1}`;
      list = [...list, { id, name: `${stemOf(s, v)}-${WORDS[(list.length - 1) % WORDS.length]}`, policy: "private", usedGb: Math.round(v.spec.diskGb * 0.1 * 10) / 10, publicSince: null }];
      putBuckets(s, v, list);
    }
    for (const b of list.filter((x) => x.policy === "public")) {
      if (rand(r) >= EXPOSURE) continue;
      happier(s, v.customerId, -EXPOSURE_LOSS);
      events.push({ app: "Support", key: "event.bucketExposed", params: { customer: cust.name, service: v.label, bucket: b.name } });
    }
    const open = s.tickets.some((t) => t.serviceId === v.id && t.topic === "bucketPublic" && !isFinal(t));
    if (!open && list.some((b) => b.policy === "private") && rand(r) < PUBLIC_REQUEST) createTicket(s, cust, "howTo", v.id, "bucketPublic");
  }
}

export const sharesOf = (s: GameState, v: Service): Share[] => s.netsvc.shares[v.id] ?? [];
export const putShares = (s: GameState, v: Service, list: Share[]): void => { s.netsvc = { ...s.netsvc, shares: { ...s.netsvc.shares, [v.id]: list } }; };
export const shareExpired = (s: GameState, x: Share): boolean => x.expiresAt !== null && x.expiresAt <= s.hour;

// Monthly: customers hand out links, some leak. Daily: expired links ask to be extended or fall away.
function shareTick(s: GameState, events: SimEvent[], month: boolean): void {
  const day = s.hour % 24 === 0, days = s.netsvc.policy.shareExpiryDays;
  for (const v of storageServices(s)) {
    const cust = live(s, v);
    if (!cust || !isOwnclod(s, v)) continue;
    const r = hashRng(s.seed, s.hour, numOf(v.id), 312), users = Math.max(3, Math.round(v.spec.diskGb / 2));
    let list = [...sharesOf(s, v)];
    if (day) {
      for (const x of list) {
        const gone = x.expiresAt !== null ? s.hour - x.expiresAt : -1;
        if (gone >= 0 && gone < 24 && rand(hashRng(s.seed, s.hour, numOf(x.id), 313)) < LINK_TICKET && !s.tickets.some((t) => t.serviceId === v.id && t.topic === "linkExpired" && !isFinal(t))) createTicket(s, cust, "howTo", v.id, "linkExpired");
      }
      list = list.filter((x) => !(x.expiresAt !== null && s.hour - x.expiresAt > LINK_KEEP_DAYS * 24));
    }
    if (month) {
      for (const x of list) {
        if (x.expiresAt !== null || s.hour - x.createdAt < LEAK_AGE_DAYS * 24) continue;
        if (rand(r) < (x.password ? 0.003 : 0.015)) {
          happier(s, v.customerId, -LEAK_LOSS);
          events.push({ app: "Support", key: "event.linkLeaked", params: { customer: cust.name, service: v.label, link: x.name } });
        }
      }
      const n = Math.round(users * 0.5 * (0.5 + rand(r))), at = list.length;
      for (let i = 0; i < n; i++) {
        list.push({ id: `l${s.hour}-${at + i}`, name: `${stemOf(s, v)}-${WORDS[(at + i) % WORDS.length]}-${at + i + 1}`, createdAt: s.hour, expiresAt: days > 0 ? s.hour + days * 24 : rand(r) < 0.3 ? s.hour + (7 + Math.floor(rand(r) * 80)) * 24 : null, password: rand(r) < 0.25 });
      }
    }
    if (day || month) putShares(s, v, list);
  }
}

export function storageTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [], month = isMonthStart(s.hour);
  ecTick(s);
  if (month) bucketTick(s, events);
  if (month || s.hour % 24 === 0) shareTick(s, events, month);
  return events;
}
