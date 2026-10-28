import { CircleHelp, Copyright, DoorOpen, Landmark, LockKeyholeOpen, Receipt, ShieldAlert, TrendingUp, Undo2, ZapOff, type LucideIcon } from "lucide-react";
import { dateOf } from "../../../sim/00-core/time";
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
];
export const kindOf = (id: TicketKind) => KINDS.find((k) => k.id === id)!;

export const STATUS: Record<TicketStatus, string> = { open: "Open", waiting: "Waiting on customer", escalated: "Escalated", resolved: "Resolved", closed: "Closed" };

export const PRODUCT: Record<Product, string> = {
  webHosting: "Web hosting", domain: "Domain", ssl: "SSL", dns: "DNS", gameServer: "Game server", vps: "VPS",
  vpn: "VPN", dedicated: "Dedicated", storage: "Storage", cloud: "Cloud", colocation: "Colocation",
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

export const initials = (name: string): string => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const moodClass = (h: number): string => (h >= 60 ? "ok" : h >= 30 ? "warn" : "bad");
