import type { Company, GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { STARTER_APPS } from "../10-catalog/store";
import { LEGAL_FORMS, officeOpen, registerNumber } from "../80-business/office";
import { banksOpen, DEFAULT_BANK, monthlyFee, type BankId } from "../10-catalog/banks";
import { openAccount } from "../46-finance/bank";
import { yearOf } from "../00-core/time";

// Logo marks by id; the UI draws each one as an icon on a tile in the chosen colour.
export const COMPANY_LOGOS = ["server", "cloud", "zap", "globe", "rocket", "database", "cpu", "shield", "leaf", "mountain", "waves", "flame", "wolf", "fox", "cat", "toaster"];
export const COMPANY_COLORS = [
  "oklch(0.55 0.15 255)", "oklch(0.58 0.12 210)", "oklch(0.6 0.14 160)", "oklch(0.72 0.15 95)",
  "oklch(0.65 0.17 50)", "oklch(0.58 0.2 25)", "oklch(0.6 0.19 350)", "oklch(0.55 0.17 295)", "oklch(0.4 0.03 260)",
];
export const NAME_MAX = 32;
export const TAGLINE_MAX = 60;

// Any saved change ticks the company step of Getting started.
export function setCompany(s: GameState, patch: Partial<Company>): ActionResult {
  const name = patch.name?.trim();
  if (name !== undefined && (name.length === 0 || name.length > NAME_MAX)) return { ok: false, error: "error.companyName" };
  const tagline = patch.tagline?.trim();
  if (tagline !== undefined && tagline.length > TAGLINE_MAX) return { ok: false, error: "error.companyTagline" };
  if (patch.logo !== undefined && !COMPANY_LOGOS.includes(patch.logo)) return { ok: false, error: "error.companyLogo" };
  if (patch.color !== undefined && !COMPANY_COLORS.includes(patch.color)) return { ok: false, error: "error.companyColor" };
  s.company = { ...s.company, ...patch, ...(name !== undefined && { name }), ...(tagline !== undefined && { tagline }) };
  if (!s.checklist.includes("company")) s.checklist = [...s.checklist, "company"];
  return { ok: true };
}

// The trade office registers the company under its name during office hours, the chosen bank opens its account and Pear One
// installs the starter apps.
export function registerCompany(s: GameState, name: string, owner: string, form: string, bank: BankId = DEFAULT_BANK): ActionResult {
  if (s.registration) return { ok: false, error: "error.registered" };
  if (!officeOpen(s.hour)) return { ok: false, error: "error.officeClosed" };
  if (!owner.trim()) return { ok: false, error: "error.ownerName" };
  if (!(form in LEGAL_FORMS)) return { ok: false, error: "error.legalForm" };
  const chosen = banksOpen(yearOf(s.hour)).find((b) => b.id === bank);
  if (!chosen) return { ok: false, error: "error.unknownBank" };
  if (monthlyFee(chosen, form) === null) return { ok: false, error: "error.bankForm" };
  const named = setCompany(s, { name });
  if (!named.ok) return named;
  s.checklist = s.checklist.filter((id) => id !== "company");
  s.registration = { hour: s.hour, owner: owner.trim(), form, number: registerNumber(s.seed) };
  s.installed = [...new Set([...s.installed, ...STARTER_APPS])];
  s.bank = openAccount(s, bank);
  return { ok: true };
}
