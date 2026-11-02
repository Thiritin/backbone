import type { Company, GameState, PostalAddress } from "../50-state";
import type { ActionResult } from "./hardware";
import { STARTER_APPS } from "../10-catalog/store";
import { LEGAL_FORMS, officeOpen, registerNumber } from "../80-business/office";
import { bankById, planById } from "../10-catalog/banks";
import { renameStartBox } from "../42-mail/model";

// Logo marks by id; the UI draws each one as an icon on a tile in the chosen colour.
export const COMPANY_LOGOS = ["server", "cloud", "zap", "globe", "rocket", "database", "cpu", "shield", "leaf", "mountain", "waves", "flame", "wolf", "fox", "cat", "toaster"];
export const COMPANY_COLORS = [
  "oklch(0.55 0.15 255)", "oklch(0.58 0.12 210)", "oklch(0.6 0.14 160)", "oklch(0.72 0.15 95)",
  "oklch(0.65 0.17 50)", "oklch(0.58 0.2 25)", "oklch(0.6 0.19 350)", "oklch(0.55 0.17 295)", "oklch(0.4 0.03 260)",
];
export const NAME_MAX = 32;
export const TAGLINE_MAX = 60;

export function setCompany(s: GameState, patch: Partial<Company>): ActionResult {
  const name = patch.name?.trim();
  if (name !== undefined && (name.length === 0 || name.length > NAME_MAX)) return { ok: false, error: "error.companyName" };
  const tagline = patch.tagline?.trim();
  if (tagline !== undefined && tagline.length > TAGLINE_MAX) return { ok: false, error: "error.companyTagline" };
  if (patch.logo !== undefined && !COMPANY_LOGOS.includes(patch.logo)) return { ok: false, error: "error.companyLogo" };
  if (patch.color !== undefined && !COMPANY_COLORS.includes(patch.color)) return { ok: false, error: "error.companyColor" };
  const old = s.company.name;
  s.company = { ...s.company, ...patch, ...(name !== undefined && { name }), ...(tagline !== undefined && { tagline }) };
  if (name !== undefined) renameStartBox(s, old);
  return { ok: true };
}

export const addressComplete = (a: PostalAddress): boolean => !!(a.street.trim() && a.zip.trim() && a.city.trim());

// Why the trade office would turn the application down, if it would.
export function registrationError(s: GameState, name: string, owner: string, form: string, address: PostalAddress): string | null {
  if (s.registration) return "error.registered";
  if (!officeOpen(s.hour)) return "error.officeClosed";
  if (!name.trim() || name.trim().length > NAME_MAX) return "error.companyName";
  if (!owner.trim()) return "error.ownerName";
  if (!addressComplete(address)) return "error.companyAddress";
  if (!(form in LEGAL_FORMS)) return "error.legalForm";
  if (form !== "sole") return "error.registerSole";
  if (!s.bank) return "error.noBank";
  if (!planById(bankById(s.bank.id)!, s.bank.plan)?.forms.includes(form)) return "error.bankPlan";
  return null;
}

// The trade office registers the company under its name and bills its fee by letter; Pear One installs the starter apps.
export function registerCompany(s: GameState, name: string, owner: string, form: string, address: PostalAddress): ActionResult {
  const error = registrationError(s, name, owner, form, address);
  if (error) return { ok: false, error };
  setCompany(s, { name, address: { street: address.street.trim(), zip: address.zip.trim(), city: address.city.trim() } });
  s.registration = { hour: s.hour, owner: owner.trim(), form, number: registerNumber(s.seed) };
  s.installed = [...new Set([...s.installed, ...STARTER_APPS])];
  return { ok: true };
}
