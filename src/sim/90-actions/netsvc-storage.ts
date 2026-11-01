import { bump, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { EXPIRY_CHOICES, PRIVATE_LOSS, PUBLIC_GAIN, bucketsOf, isOwnclod, putBuckets, putShares, sharesOf, storageServices, type BucketPolicy } from "../60-infra/netsvc-storage";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const happier = (s: GameState, customerId: string, d: number) => { s.customers = s.customers.map((c) => { if (c.id !== customerId) return c; const n = { ...c }; bump(n, d); return n; }); };
const resolve = (s: GameState, serviceId: string, topic: string) => { s.tickets = s.tickets.map((t) => (t.serviceId === serviceId && t.topic === topic && !isFinal(t) ? { ...t, status: "resolved", updatedAt: s.hour } : t)); };

// Opening a bucket answers the customer who asked for it; closing one again costs a little.
export function setBucketPolicy(s: GameState, serviceId: string, bucketId: string, policy: BucketPolicy): ActionResult {
  const v = storageServices(s).find((x) => x.id === serviceId);
  if (!v) return fail("error.unknownService");
  const list = bucketsOf(s, v), b = list.find((x) => x.id === bucketId);
  if (!b || !["private", "readonly", "public"].includes(policy)) return fail("error.badBucket");
  if (b.policy === policy) return { ok: true };
  const opens = policy === "public" && b.policy !== "public", closes = b.policy === "public" && policy !== "public";
  putBuckets(s, v, list.map((x) => (x.id === bucketId ? { ...x, policy, publicSince: policy === "public" ? s.hour : null } : x)));
  if (opens) {
    if (s.tickets.some((t) => t.serviceId === v.id && t.topic === "bucketPublic" && !isFinal(t))) { resolve(s, v.id, "bucketPublic"); happier(s, v.customerId, PUBLIC_GAIN); }
  } else if (closes) happier(s, v.customerId, -PRIVATE_LOSS);
  return { ok: true };
}

// Chooses how many drives of an erasure set may fail; more parity leaves less room for data.
export function setParity(s: GameState, clusterId: string, parity: number): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c || (c.panel ?? c.platform) !== "minnio") return fail("error.unknownCluster");
  if (parity !== 2 && parity !== 4) return fail("error.badParity");
  s.netsvc = { ...s.netsvc, ec: { ...s.netsvc.ec, [clusterId]: parity } };
  return { ok: true };
}

export function deleteShare(s: GameState, serviceId: string, shareId: string): ActionResult {
  const v = storageServices(s).find((x) => x.id === serviceId);
  if (!v || !isOwnclod(s, v)) return fail("error.unknownService");
  if (!sharesOf(s, v).some((x) => x.id === shareId)) return fail("error.badShare");
  putShares(s, v, sharesOf(s, v).filter((x) => x.id !== shareId));
  return { ok: true };
}

// Sets or clears the expiry of one link, in days from now; zero removes it.
export function setShareExpiry(s: GameState, serviceId: string, shareId: string, days: number): ActionResult {
  const v = storageServices(s).find((x) => x.id === serviceId);
  if (!v || !isOwnclod(s, v)) return fail("error.unknownService");
  if (!sharesOf(s, v).some((x) => x.id === shareId) || !Number.isInteger(days) || days < 0) return fail("error.badShare");
  putShares(s, v, sharesOf(s, v).map((x) => (x.id === shareId ? { ...x, expiresAt: days > 0 ? s.hour + days * 24 : null } : x)));
  return { ok: true };
}

// Renews an expired link for the policy's days (30 without a policy) and answers the customer who asked.
export function extendShare(s: GameState, serviceId: string, shareId: string): ActionResult {
  const days = s.netsvc.policy.shareExpiryDays || 30, r = setShareExpiry(s, serviceId, shareId, days);
  if (r.ok) { resolve(s, serviceId, "linkExpired"); }
  return r;
}

// The admin default: new links expire after this many days, and links without an expiry get it now.
export function setSharePolicy(s: GameState, days: number): ActionResult {
  if (!EXPIRY_CHOICES.includes(days)) return fail("error.badShare");
  s.netsvc = { ...s.netsvc, policy: { ...s.netsvc.policy, shareExpiryDays: days } };
  if (days > 0) for (const v of storageServices(s)) {
    const list = sharesOf(s, v);
    if (list.some((x) => x.expiresAt === null)) putShares(s, v, list.map((x) => (x.expiresAt === null ? { ...x, expiresAt: s.hour + days * 24 } : x)));
  }
  return { ok: true };
}
