// GDD, Support, Retention offers; economy.md, Happiness and churn.
import { chance } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { BUSINESS_PROFILES } from "../10-catalog/attention";
import { activeServices, type Customer, type Service } from "../30-customers/customers";
import { limits, reprice } from "../30-customers/pricing";
import { grownSpec, serviceMarket, sizeOf } from "../30-market/spec";
import type { GameState } from "../50-state";
import { bookable, nodeUsed, vmRoom, workloadsOf, type Workload } from "../60-infra/cluster";
import { workloadPerf } from "../85-products/products";
import { moveTargets, offerMigration, type MoveTarget } from "../90-actions/moves";
import { bump, credit, HOURS_PER_MONTH, serviceMonthly, type Ticket } from "./tickets";
import { outgoing } from "./replies";
import { serviceOnline } from "./status";

// Why the customer writes in; a cancellation ticket carries it as its topic ("leave" is any other reason).
export type CancelReason = "price" | "outage" | "slow" | "other";
export type RetentionId = "half" | "free" | "d3" | "d6" | "d12" | "upgrade" | "fix" | "move";
export type Odds = "unlikely" | "even" | "likely";
export interface RetentionCard { id: RetentionId; chance: number; odds: Odds; cost: number; spec?: Service["spec"]; serviceId?: string; target?: string; months?: number }

export const RETENTION_IDS: RetentionId[] = ["half", "free", "d3", "d6", "d12", "upgrade", "fix", "move"];
const DISCOUNTS: RetentionId[] = ["half", "free", "d3", "d6", "d12"];
export const DISCOUNT = 0.2, DISCOUNT_MONTHS = { d3: 3, d6: 6, d12: 12 } as const;
export const CHANCE_MIN = 0.05, CHANCE_MAX = 0.95, EVEN_FROM = 0.4, LIKELY_FROM = 0.6;
// One size up is the smaller of the upgrade factors an upgrade ticket asks for.
export const UPGRADE_FACTOR = 1.5;
// Happiness a kept customer gains from an offer that is not a credit (a credit adds 30 per share, see tickets.ts).
export const KEPT_BUMP = 10;
export const FIX_DAYS = 3;
// The work arg of the promise's check, three days after the apology.
export const FIX_CHECK = "fixcheck";

export const reasonOf = (t: Pick<Ticket, "topic">): CancelReason => (t.topic === "price" || t.topic === "outage" || t.topic === "slow" ? t.topic : "other");
export const oddsOf = (p: number): Odds => (p >= LIKELY_FROM ? "likely" : p >= EVEN_FROM ? "even" : "unlikely");
const cents = (v: number) => Math.round(v * 100) / 100;

// What drove the customer to cancel: a recent outage or slowness first, then a price above what they find fair.
export function cancelReason(s: GameState, c: Customer): CancelReason {
  const services = activeServices(s.services, c.id);
  const last = s.tickets.filter((t) => t.customerId === c.id && t.kind === "outage" && t.createdAt > s.hour - HOURS_PER_MONTH).at(-1);
  if (services.some((v) => !serviceOnline(s, v.id)) || (last && last.topic !== "slow")) return "outage";
  if (last) return "slow";
  return services.some((v) => v.period === "hour" && v.price * HOURS_PER_MONTH > limits(s, c, v).fair) ? "price" : "other";
}

export function retentionChance(c: Customer, reason: CancelReason, id: RetentionId): number {
  const discount = DISCOUNTS.includes(id), cause = reason === "outage" || reason === "slow", business = BUSINESS_PROFILES.includes(c.profile);
  let p = (c.happiness - 10) / 100;
  if (reason === "price") p += discount ? 0.3 : id === "move" ? -0.1 : 0;
  if (cause) p += id === "move" || id === "fix" ? 0.3 : discount ? -0.2 : 0;
  if (discount && !business) p += 0.1;
  if (id === "move" && business) p += 0.1;
  return Math.min(CHANCE_MAX, Math.max(CHANCE_MIN, p));
}

const inDatacenter = (s: GameState, clusterId: string): boolean => !!s.locations.find((l) => l.az === s.clusters.find((c) => c.id === clusterId)?.az)?.dc;

// Whether the workload's host has the disk and RAM for the bigger size: a node for a VM, the panel VM's disk for a web space.
function roomFor(s: GameState, w: Workload, size: ReturnType<typeof sizeOf>): boolean {
  if (!w.clusterId) return false;
  const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined, c = s.clusters.find((x) => x.id === w.clusterId);
  if (d) {
    const cap = bookable(s, d), used = nodeUsed(s, d.id);
    return (["ramGb", "diskGb"] as const).every((k) => used[k] - w[k] + size[k] <= cap[k] + 1e-9);
  }
  if (!c?.vm) return false;
  const { cap, used } = vmRoom(s, c);
  return used.diskGb - w.diskGb + size.diskGb <= cap.diskGb + 1e-9;
}

interface Plan { c: Customer; reason: CancelReason; hourly: Service[]; monthly: number; hourlyMonthly: number; upgrade?: { v: Service; w: Workload; spec: Service["spec"] }; move?: { v: Service; target: MoveTarget } }

function plan(s: GameState, t: Ticket): Plan | null {
  const c = s.customers.find((x) => x.id === t.customerId);
  if (t.kind !== "cancellation" || !c || c.churnedAt !== null) return null;
  const services = activeServices(s.services, c.id), hourly = services.filter((v) => v.period === "hour");
  const sum = (list: Service[]) => list.reduce((n, v) => n + serviceMonthly(v), 0);
  // The ticket's service, otherwise the customer's biggest one.
  const focus = services.find((v) => v.id === t.serviceId) ?? [...services].sort((a, b) => serviceMonthly(b) - serviceMonthly(a))[0];
  const p: Plan = { c, reason: reasonOf(t), hourly, monthly: sum(services), hourlyMonthly: sum(hourly) };
  const w = focus && workloadsOf(s, focus.id).find((x) => x.clusterId);
  if (focus && w) {
    const spec = grownSpec(s.seed, 0, focus.product, focus.spec, UPGRADE_FACTOR);
    if (JSON.stringify(spec) !== JSON.stringify(focus.spec) && roomFor(s, w, sizeOf(spec))) p.upgrade = { v: focus, w, spec };
    const offered = s.tickets.some((x) => x.kind === "migration" && x.serviceId === focus.id && x.status === "waiting");
    const target = offered ? undefined : moveTargets(s, w.id).find((x) => x.clusterId !== w.clusterId && inDatacenter(s, x.clusterId));
    if (target) p.move = { v: focus, target };
  }
  return p;
}

// The cards of a cancellation ticket: what each offer costs and how likely the customer is to stay. An offer is left out when it
// cannot work: the customer's price would stay above their maximum, the server has no room for the upgrade, no datacenter host
// takes the service, or the reason is not an outage or slowness.
export function retentionOptions(s: GameState, t: Ticket): RetentionCard[] {
  const p = plan(s, t);
  if (!p) return [];
  const { c, reason } = p, cards: RetentionCard[] = [];
  const dear = (factor: number) => p.hourly.some((v) => v.price * HOURS_PER_MONTH * factor > limits(s, c, v).max);
  const add = (id: RetentionId, cost: number, extra: Partial<RetentionCard> = {}) => {
    const chance = retentionChance(c, reason, id);
    cards.push({ id, chance, odds: oddsOf(chance), cost: cents(cost), ...extra });
  };
  if (p.monthly > 0 && !dear(1 - 1 / 24)) add("half", 0.5 * p.monthly);
  if (p.monthly > 0 && !dear(1 - 1 / 12)) add("free", p.monthly);
  if (p.hourlyMonthly > 0 && !dear(1 - DISCOUNT)) for (const id of ["d3", "d6", "d12"] as const) add(id, DISCOUNT * DISCOUNT_MONTHS[id] * p.hourlyMonthly, { months: DISCOUNT_MONTHS[id] });
  if (!dear(1)) {
    if (p.upgrade) {
      const { v, spec } = p.upgrade, year = yearOf(s.hour);
      add("upgrade", serviceMarket({ ...v, spec }, year) - serviceMarket(v, year), { spec, serviceId: v.id });
    }
    if (reason === "outage" || reason === "slow") add("fix", 0);
    if (p.move) add("move", 0, { target: p.move.target.name, serviceId: p.move.v.id });
  }
  return cards;
}

// Staff offer the cheapest option that is at least even; with none, the cancellation goes through.
export function cheapestOption(s: GameState, t: Ticket): RetentionId | null {
  const ok = retentionOptions(s, t).filter((o) => o.chance >= EVEN_FROM);
  return ok.length ? ok.reduce((a, b) => (b.cost < a.cost ? b : a)).id : null;
}

// The email an offer sends; the three discounts share one.
const MAIL: Record<RetentionId, string> = { half: "half", free: "free", d3: "discount", d6: "discount", d12: "discount", upgrade: "upgrade", fix: "fix", move: "move" };
export function sendOffer(s: GameState, t: Ticket, c: Customer, id: RetentionId, by?: string): void {
  const what = `retain.${MAIL[id]}`, mail = outgoing(s, t, c, what);
  const months = id === "d3" || id === "d6" || id === "d12" ? DISCOUNT_MONTHS[id] : 0;
  t.replies = [...t.replies, { hour: s.hour, template: what, right: true, ...mail, params: { ...mail.params, months, fixDays: FIX_DAYS }, ...(by && { by }) }];
}

function grant(s: GameState, p: Plan, id: RetentionId): void {
  const { c } = p;
  if (id === "half") credit(s, c, 0.5);
  else if (id === "free") credit(s, c, 1);
  else if (id === "d3" || id === "d6" || id === "d12") {
    for (const v of p.hourly) {
      const was = v.discount?.was ?? v.price, months = Math.max(v.discount?.months ?? 0, DISCOUNT_MONTHS[id]);
      reprice(s, v, was * (1 - DISCOUNT) * HOURS_PER_MONTH, true);
      s.services = s.services.map((x) => (x.id === v.id ? { ...x, discount: { was, months } } : x));
    }
    bump(c, KEPT_BUMP);
  } else if (id === "upgrade" && p.upgrade) {
    const { v, w, spec } = p.upgrade;
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...sizeOf(spec) } : x));
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec } : x));
    bump(c, KEPT_BUMP);
  } else if (id === "move" && p.move) {
    offerMigration(s, p.move.v.id, p.move.target.to, true);
    bump(c, KEPT_BUMP);
  }
}

// The customer answers an offer: they stay with the card's chance. The fix promise waits three days for its check.
export function applyRetention(s: GameState, t: Ticket, id: RetentionId): "retained" | "offerRefused" | "waiting" {
  const p = plan(s, t), card = retentionOptions(s, t).find((o) => o.id === id);
  if (!p || !card) return "offerRefused";
  if (id === "fix") {
    Object.assign(t, { status: "waiting", updatedAt: s.hour, work: { op: "resolve", arg: FIX_CHECK, doneAt: (s.hour + FIX_DAYS * 24) * 60 } });
    return "waiting";
  }
  if (!chance(s.rng, card.chance)) return "offerRefused";
  grant(s, p, id);
  return "retained";
}

// Whether the services behind the ticket are online and at full speed again.
export function causeGone(s: GameState, t: Ticket): boolean {
  const services = activeServices(s.services, t.customerId).filter((v) => !t.serviceId || v.id === t.serviceId);
  return services.every((v) => serviceOnline(s, v.id) && workloadsOf(s, v.id).every((w) => workloadPerf(s, w, v.product) >= 1));
}

// Three days after the apology the customer checks: the fault must be gone, then they stay with the chance of the promise.
export function settleFix(s: GameState, t: Ticket, c: Customer): "retained" | "offerRefused" | "fixFailed" {
  if (!causeGone(s, t)) return "fixFailed";
  if (!chance(s.rng, retentionChance(c, reasonOf(t), "fix"))) return "offerRefused";
  bump(c, KEPT_BUMP);
  return "retained";
}

// Monthly: a discount runs its months, then the price returns unless the player changed it meanwhile.
export function endDiscounts(s: GameState): void {
  if (!s.services.some((v) => v.discount)) return;
  s.services = s.services.map((v) => {
    if (!v.discount) return v;
    const { discount, ...rest } = v, months = discount.months - 1;
    if (months > 0) return { ...rest, discount: { ...discount, months } };
    return Math.abs(v.price / (discount.was * (1 - DISCOUNT)) - 1) < 1e-6 ? { ...rest, price: discount.was } : rest;
  });
}
