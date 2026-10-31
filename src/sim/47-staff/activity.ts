import type { GameState } from "../50-state";

// economy.md, Time per action. Ticket work takes MINUTES from 40-support/tickets.ts; staff divide both by their speed.
export const ACTION_MINUTES = {
  checkInvoice: 6, reminder: 15, dunning: 30, final: 30, collections: 30, suspend: 60, unsuspend: 15,
  // Minutes of a marketing manager's workday each task needs for its full effect; campaigns come first.
  campaigns: 180, reviews: 60,
  // A technician does one operation per work hour.
  techOp: 60,
  // The steps of a custom order (30-market/manual.ts).
  orderQuote: 5, orderAccount: 5, orderInvoice: 10, orderDomain: 5, orderProvision: 15, orderProvisionPackage: 8,
};

// key and params are an i18n line; serviceId null is the whole customer, as for invoices.
export interface ActivityEntry {
  hour: number; customerId: string; serviceId: string | null;
  // Employee or bot name; null is the player.
  by: string | null;
  key: string; params: Record<string, string | number>; minutes: number;
}

export const ACTIVITY_DAYS = 90;
export const ACTIVITY_MAX = 3000;

// Keeps the last 90 days, at most 3000 entries, so saves stay small.
export function logActivity(s: GameState, entry: Omit<ActivityEntry, "hour">): void {
  if (!entry.customerId) return;
  const since = s.hour - ACTIVITY_DAYS * 24;
  s.activity = [...s.activity.filter((a) => a.hour > since), { hour: s.hour, ...entry, minutes: Math.round(entry.minutes) }].slice(-ACTIVITY_MAX);
}

// Newest first. A service's log includes what was done for the whole customer.
export const activityFor = (s: GameState, customerId: string, serviceId?: string): ActivityEntry[] =>
  s.activity.filter((a) => a.customerId === customerId && (serviceId === undefined || a.serviceId === null || a.serviceId === serviceId)).reverse();
