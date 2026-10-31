import { Apple, CircleHelp, HeartHandshake, Copyright, DoorOpen, KeyRound, Landmark, LockKeyholeOpen, Receipt, ShieldAlert, ShoppingCart, TrendingUp, Truck, Undo2, Wrench, ZapOff, type LucideIcon } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { dateOf } from "../../../sim/00-core/time";
import { BUSINESS_DAY, type Patience } from "../../../sim/00-core/workhours";
import type { Product } from "../../../sim/30-customers/customers";
import type { TicketKind, TicketStatus } from "../../../sim/40-support/tickets";

export const KINDS: { id: TicketKind; label: string; icon: LucideIcon }[] = [
  { id: "outage", label: t("support.kind.outage"), icon: ZapOff },
  { id: "howTo", label: t("support.kind.howTo"), icon: CircleHelp },
  { id: "billing", label: t("support.kind.billing"), icon: Receipt },
  { id: "upgrade", label: t("support.kind.upgrade"), icon: TrendingUp },
  { id: "cancellation", label: t("support.kind.cancellation"), icon: DoorOpen },
  { id: "abuse", label: t("support.kind.abuse"), icon: ShieldAlert },
  { id: "appeal", label: t("support.kind.appeal"), icon: LockKeyholeOpen },
  { id: "notice", label: t("support.kind.notice"), icon: Copyright },
  { id: "legal", label: t("support.kind.legal"), icon: Landmark },
  { id: "refund", label: t("support.kind.refund"), icon: Undo2 },
  { id: "order", label: t("support.kind.order"), icon: ShoppingCart },
  { id: "extortion", label: t("support.kind.extortion"), icon: KeyRound },
  { id: "migration", label: t("support.kind.migration"), icon: Truck },
  { id: "maintenance", label: t("support.kind.maintenance"), icon: Wrench },
  { id: "sponsor", label: t("support.kind.sponsor"), icon: HeartHandshake },
  { id: "pear", label: t("walk.from"), icon: Apple },
];
export const kindOf = (id: TicketKind) => KINDS.find((k) => k.id === id)!;

export const STATUS: Record<TicketStatus, string> = {
  open: t("support.status.open"),
  waiting: t("support.status.waiting"),
  escalated: t("support.status.escalated"),
  resolved: t("support.status.resolved"),
  closed: t("support.status.closed"),
};
export const statusOf = (tk: { status: TicketStatus; outcome: string | null }): string => (tk.outcome === "withdrawn" ? t("support.status.withdrawn") : STATUS[tk.status]);

export const PRODUCT: Record<Product, string> = {
  webHosting: t("support.product.webHosting"),
  domain: t("support.product.domain"),
  ssl: t("support.product.ssl"),
  dns: t("support.product.dns"),
  gameServer: t("support.product.gameServer"),
  vps: t("support.product.vps"),
  vpn: t("support.product.vpn"),
  dedicated: t("support.product.dedicated"),
  storage: t("support.product.storage"),
  cloud: t("support.product.cloud"),
  colocation: t("support.product.colocation"),
  gpu: t("support.product.gpu"),
};

const monthShort = (d: Date) => d.toLocaleDateString(LOCALE, { month: "short", timeZone: "UTC" });
const pad = (n: number) => String(n).padStart(2, "0");

// "3 Feb 14:20"; hour may be fractional.
export function stamp(hour: number): string {
  const d = dateOf(hour);
  return `${d.getUTCDate()} ${monthShort(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const monthYear = (hour: number): string => {
  const d = dateOf(hour);
  return `${monthShort(d)} ${d.getUTCFullYear()}`;
};

// "5 d 3 h" or "5 d" from 48 hours up, "30 h" below.
export const span = (hours: number): string => {
  const h = Math.abs(hours);
  return h >= 48 ? (h % 24 ? t("support.spanDaysHours", { d: Math.floor(h / 24), h: h % 24 }) : t("support.spanDays", { d: Math.floor(h / 24) })) : t("support.spanHours", { h });
};

// "15:00" today, "Mon 13:00" on a later day, "Now" once past due.
export function due(at: number, hour: number): string {
  if (hour > at) return t("support.now");
  const d = dateOf(at), time = `${pad(d.getUTCHours())}:00`;
  return Math.floor(at / 24) === Math.floor(hour / 24) ? time : `${d.toLocaleDateString(LOCALE, { weekday: "short", timeZone: "UTC" })} ${time}`;
}

// "1 business day", "4 business hours", "4 hours, around the clock".
export function patience({ hours, clock }: Patience): string {
  if (!hours) return t("support.immediately");
  if (clock === "always") return t("support.aroundTheClock", { n: hours });
  return hours % BUSINESS_DAY ? t("support.businessHours", { n: hours }) : t("support.businessDays", { n: hours / BUSINESS_DAY });
}

export const noticed = (e: Patience): string => (e.hours ? t("support.after", { p: patience(e) }) : t("support.immediately"));

export const initials =(name: string): string => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const moodClass = (h: number): string => (h >= 60 ? "ok" : h >= 30 ? "warn" : "bad");
