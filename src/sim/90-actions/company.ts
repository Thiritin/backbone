import type { Company, GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { STARTER_APPS } from "../10-catalog/store";
import { LEGAL_FORMS, OFFICE_ACCOUNT, OFFICE_CODE, officeOpen, REGISTRATION_FEE, registerNumber } from "../80-business/office";
import { iban, ibanEra, send, spendable, type Draft } from "../46-finance/bank";
import { t } from "../../i18n/en";
import { bankById, monthlyFee } from "../10-catalog/banks";
import { startTransfer } from "./bank";

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
  s.company = { ...s.company, ...patch, ...(name !== undefined && { name }), ...(tagline !== undefined && { tagline }) };
  return { ok: true };
}

// Why the trade office would turn the application down, if it would.
export function registrationError(s: GameState, name: string, owner: string, form: string): string | null {
  if (s.registration) return "error.registered";
  if (!officeOpen(s.hour)) return "error.officeClosed";
  if (!name.trim() || name.trim().length > NAME_MAX) return "error.companyName";
  if (!owner.trim()) return "error.ownerName";
  if (!(form in LEGAL_FORMS)) return "error.legalForm";
  if (form !== "sole") return "error.registerSole";
  if (!s.bank) return "error.noBank";
  if (monthlyFee(bankById(s.bank.id)!, form) === null) return "error.bankForm";
  if (REGISTRATION_FEE > spendable(s)) return "error.noCash";
  return null;
}

// The fee transfer to the office, filled in from the application.
export const officeDraft = (s: GameState, name: string): Draft => ibanEra(s)
  ? { name: t("bank.office.payee"), account: iban(OFFICE_CODE, OFFICE_ACCOUNT), amount: REGISTRATION_FEE, reference: t("bank.office.reference", { name: name.trim() }) }
  : { name: t("bank.office.payee"), account: OFFICE_ACCOUNT, code: OFFICE_CODE, amount: REGISTRATION_FEE, reference: t("bank.office.reference", { name: name.trim() }) };

// The office form fills in the fee transfer on the bank's site; the TAN that sends it completes the registration.
export function applyForRegistration(s: GameState, name: string, owner: string, form: string): ActionResult {
  const error = registrationError(s, name, owner, form);
  if (error) return { ok: false, error };
  return startTransfer(s, { ...officeDraft(s, name), registration: { name: name.trim(), owner: owner.trim(), form } });
}

// The trade office registers the company under its name once the fee is sent, and Pear One installs the starter apps.
export function registerCompany(s: GameState, name: string, owner: string, form: string): ActionResult {
  const error = registrationError(s, name, owner, form);
  if (error) return { ok: false, error };
  send(s, officeDraft(s, name));
  setCompany(s, { name });
  s.registration = { hour: s.hour, owner: owner.trim(), form, number: registerNumber(s.seed) };
  s.installed = [...new Set([...s.installed, ...STARTER_APPS])];
  return { ok: true };
}
