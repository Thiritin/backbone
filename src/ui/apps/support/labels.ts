import { CircleHelp, HeartHandshake, Copyright, DoorOpen, KeyRound, Landmark, LockKeyholeOpen, Receipt, ShieldAlert, ShoppingCart, TrendingUp, Truck, Undo2, Wrench, ZapOff, type LucideIcon } from "lucide-react";
import { dateOf } from "../../../sim/00-core/time";
import { BUSINESS_DAY, type Patience } from "../../../sim/00-core/workhours";
import type { Product } from "../../../sim/30-customers/customers";
import type { TicketKind, TicketStatus } from "../../../sim/40-support/tickets";

export const KINDS: { id: TicketKind; label: string; icon: LucideIcon }[] = [
  { id: "outage", label: "Outage", icon: ZapOff },
  { id: "howTo", label: "How-to", icon: CircleHelp },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "upgrade", label: "Upgrade", icon: TrendingUp },
  { id: "cancellation", label: "Cancellation", icon: DoorOpen },
  { id: "abuse", label: "Abuse", icon: ShieldAlert },
  { id: "appeal", label: "Suspension appeal", icon: LockKeyholeOpen },
  { id: "notice", label: "Notice", icon: Copyright },
  { id: "legal", label: "Legal request", icon: Landmark },
  { id: "refund", label: "Refund", icon: Undo2 },
  { id: "order", label: "Order", icon: ShoppingCart },
  { id: "extortion", label: "Ransom demand", icon: KeyRound },
  { id: "migration", label: "Migration", icon: Truck },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "sponsor", label: "Sponsoring", icon: HeartHandshake },
];
export const kindOf = (id: TicketKind) => KINDS.find((k) => k.id === id)!;

export const STATUS: Record<TicketStatus, string> = { open: "Open", waiting: "Waiting on customer", escalated: "Escalated", resolved: "Resolved", closed: "Closed" };
export const statusOf = (tk: { status: TicketStatus; outcome: string | null }): string => (tk.outcome === "withdrawn" ? "Never mind" : STATUS[tk.status]);

export const PRODUCT: Record<Product, string> = {
  webHosting: "Web hosting", domain: "Domain", ssl: "SSL", dns: "DNS", gameServer: "Game server", vps: "VPS",
  vpn: "VPN", dedicated: "Dedicated", storage: "Storage", cloud: "Cloud", colocation: "Colocation", gpu: "GPU server",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

// "3 Feb 14:20"; hour may be fractional.
export function stamp(hour: number): string {
  const d = dateOf(hour);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const monthYear = (hour: number): string => {
  const d = dateOf(hour);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// "5 d 3 h" or "5 d" from 48 hours up, "30 h" below.
export const span = (hours: number): string => {
  const h = Math.abs(hours);
  return h >= 48 ? `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ""}` : `${h} h`;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "15:00" today, "Mon 13:00" on a later day, "Now" once past due.
export function due(at: number, hour: number): string {
  if (hour > at) return "Now";
  const d = dateOf(at), time = `${pad(d.getUTCHours())}:00`;
  return Math.floor(at / 24) === Math.floor(hour / 24) ? time : `${WEEKDAYS[d.getUTCDay()]} ${time}`;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

// "1 business day", "4 business hours", "4 hours, around the clock".
export function patience({ hours, clock }: Patience): string {
  if (!hours) return "Immediately";
  if (clock === "always") return `${plural(hours, "hour")}, around the clock`;
  return hours % BUSINESS_DAY ? plural(hours, "business hour") : plural(hours / BUSINESS_DAY, "business day");
}

export const noticed = (e: Patience): string => (e.hours ? `After ${patience(e)}` : "Immediately");

export const initials =(name: string): string => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const moodClass = (h: number): string => (h >= 60 ? "ok" : h >= 30 ? "warn" : "bad");
