import { CircleHelp, DoorOpen, Receipt, ShieldAlert, TrendingUp, ZapOff, type LucideIcon } from "lucide-react";
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

export const initials = (name: string): string => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const moodClass = (h: number): string => (h >= 60 ? "ok" : h >= 30 ? "warn" : "bad");
