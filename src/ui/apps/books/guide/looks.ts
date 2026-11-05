import type { BooksVendor } from "../../../../sim/10-catalog/bookkeeping";

// How the install guide is drawn: the booklet of the 2005 desktop programs, the help article of the later ones, the
// onboarding checklist of the web programs and the manual chapter of the register program.
export type GuideLook = "booklet" | "help" | "checklist" | "manual";
export const HELP_FROM = 2015;
export function guideLook(v: BooksVendor, year: number): GuideLook {
  if (v.id === "gnucache") return "manual";
  if (v.deployment === "browser") return "checklist";
  return year < HELP_FROM ? "booklet" : "help";
}

// The installer's frame: grey setup of 2005 to 2009, wizard of 2010 to 2015, flat from 2016, the register program's own
// setup, and the sign-up of a web program.
export type InstallerLook = "grey" | "wizard" | "flat" | "inno" | "signup";
export function installerLook(v: BooksVendor, year: number): InstallerLook {
  if (v.deployment === "browser") return "signup";
  if (v.id === "gnucache") return "inno";
  return year <= 2009 ? "grey" : year <= 2015 ? "wizard" : "flat";
}

