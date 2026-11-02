import { hashRng, rand } from "../00-core/rng";
import { ascii, companyDomain } from "../30-customers/domains";
import { deskById, type DeskId } from "../10-catalog/desks";
import type { GameState } from "../50-state";
import { hostStatus, type SiteStatus } from "../80-business/website";
import { monthlyValue, profileStats, type Ticket, type TicketKind } from "./tickets";

export type Priority = "low" | "normal" | "high" | "urgent";

// Empty members means every support employee; channelId is the channel whose mail lands here.
export interface Department { id: string; name: string; members: string[]; autoAssign: boolean; channelId: string | null }
// Evaluated at import: OsTickit ticket filters, Zendusk triggers, Freshdusk creation rules.
export interface DeskRule { when: TicketKind | "*"; set: { deptId?: string; assignee?: string; priority?: Priority } }
// self: installed in a web space of a panel host, with the release it runs.
export type DeskHosting = { kind: "legacy" } | { kind: "hosted" } | { kind: "self"; clusterId: string; version: string };
export interface DeskState {
  id: DeskId;
  // legacy: a desk bought in the Pear Store before desks were websites, up always.
  hosting: DeskHosting;
  tenant: string | null;
  departments: Department[];
  rules: DeskRule[];
  addons: Partial<Record<"chat" | "phone", boolean>>;
  // The last sequential ticket number handed out.
  lastRef: number;
}

// The machine id of a self-hosted desk on its web space.
export const DESK_MACHINE = "desk";

// A cancelling customer paying at least this much a month is high priority (docs/design/economy.md, Support desks).
export const HIGH_VALUE_MONTHLY = 50;

// The priority a desk shows: the agent's override, else derived from the kind and the customer.
export function priorityOf(s: Pick<GameState, "customers" | "services">, t: Pick<Ticket, "kind" | "topic" | "customerId"> & { priority?: Priority }): Priority {
  if (t.priority) return t.priority;
  const c = s.customers.find((x) => x.id === t.customerId);
  if (t.kind === "outage") return c && profileStats(c.profile).budget === "high" ? "urgent" : "high";
  if (t.kind === "appeal" || t.kind === "notice" || (t.kind === "legal" && t.topic === "takedown")) return "high";
  if (t.kind === "cancellation" && monthlyValue(s.services, t.customerId) >= HIGH_VALUE_MONTHLY) return "high";
  return t.kind === "howTo" ? "low" : "normal";
}

// A self-hosted desk follows its web space like the shop; a hosted or legacy desk is up; no desk is down.
export function deskStatus(s: GameState): SiteStatus {
  const h = s.desk?.hosting;
  if (!h) return "down";
  return h.kind === "self" ? hostStatus(s, h.clusterId, DESK_MACHINE) : "up";
}

// Whether a ticket can be worked: one only a mailbox holds always can, one the desk imported or its portal took only
// while the desk is up.
export const deskReachable = (s: GameState, t: Pick<Ticket, "channelId" | "via">): boolean => !(t.channelId || t.via === "web") || deskStatus(s) !== "down";

// The next ticket number in the desk's style: sequential, or random digits unused by any ticket.
export function nextRef(s: GameState, t: Pick<Ticket, "id">): string {
  const d = s.desk!, f = deskById(d.id)!.ref;
  if (f.kind === "sequential") return String(++d.lastRef);
  const used = new Set(s.tickets.map((t) => t.ref)), lo = 10 ** ((f.digits ?? 6) - 1);
  for (let i = 0; ; i++) {
    const ref = String(lo + Math.floor(rand(hashRng(s.seed, Number(t.id.slice(3)) || 0, i, 61)) * 9 * lo));
    if (!used.has(ref)) return ref;
  }
}

// A new desk: one Support department and one channel on the primary mailbox that has fetched every ticket at its creation hour.
export function openDesk(s: GameState, id: DeskId, hosting: DeskHosting = { kind: "legacy" }, tenant: string | null = null): void {
  const channel = { id: `ch${s.nextId++}`, accountId: s.mail.primary, desk: id, after: "keep" as const, folder: null, since: 0 };
  s.mail = { ...s.mail, channels: [...s.mail.channels.filter((c) => !s.desk || c.desk !== s.desk.id), channel] };
  s.desk = {
    id, hosting, tenant, rules: [], addons: {}, lastRef: 0,
    departments: [{ id: "support", name: "Support", members: [], autoAssign: false, channelId: channel.id }],
  };
  for (const t of [...s.tickets].sort((a, b) => a.createdAt - b.createdAt)) Object.assign(t, { channelId: channel.id, ref: nextRef(s, t), deptId: "support" });
}

// Removing the desk drops its channels and configuration; tickets keep their numbers and leave the desk.
export function dropDesk(s: GameState): void {
  if (!s.desk) return;
  const id = s.desk.id;
  s.mail = { ...s.mail, channels: s.mail.channels.filter((c) => c.desk !== id) };
  for (const t of s.tickets) if (t.channelId) Object.assign(t, { channelId: null, deptId: null });
  s.desk = null;
}

// The tenant name a sign-up form suggests: the company domain without its ending.
export const defaultTenant = (s: GameState): string => ascii(companyDomain(s).split(".")[0]) || "hosting";
