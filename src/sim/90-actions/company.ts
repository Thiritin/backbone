import type { Company, GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// Logo marks by id; the UI draws each one as an icon on a tile in the chosen colour.
export const COMPANY_LOGOS = ["server", "cloud", "zap", "globe", "rocket", "database", "cpu", "shield", "leaf", "mountain", "waves", "flame"];
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
