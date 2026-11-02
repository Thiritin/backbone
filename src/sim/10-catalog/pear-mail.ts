// Pear Mail has no update of its own: its build is the newest one the installed Pear OS release and the date allow
// (docs/design/plans/mail-client.md, Eras).
import { monthIndexOf } from "../00-core/time";
import { OS_RELEASES } from "./os";

export type MailFeature = "smartMailboxes" | "rules" | "junk" | "threads" | "notes" | "todos" | "stationery" | "detectors" | "quickPeek"
  | "autoSetup" | "autoCheck" | "columns" | "conversations" | "favourites" | "flagColours" | "archive" | "tokens" | "providerTiles"
  | "banners" | "vip" | "previewLines" | "domainDetect" | "undoSend" | "sendLater" | "remindMe" | "categories";

export interface MailBuild { version: string; os: string; year: number; month: number; adds: MailFeature[] }

export const MAIL_BUILDS: MailBuild[] = [
  { version: "2", os: "aqua", year: 2003, month: 10, adds: ["smartMailboxes", "rules", "junk", "threads"] },
  { version: "3", os: "leopard", year: 2007, month: 10, adds: ["notes", "todos", "stationery", "detectors", "quickPeek", "autoSetup", "autoCheck"] },
  { version: "5", os: "leopard", year: 2011, month: 7, adds: ["columns", "conversations", "favourites", "flagColours", "archive", "tokens"] },
  { version: "6", os: "leopard", year: 2012, month: 7, adds: ["providerTiles", "banners", "vip"] },
  { version: "8", os: "yosemite", year: 2014, month: 10, adds: ["previewLines"] },
  { version: "14", os: "bigsur", year: 2020, month: 11, adds: ["domainDetect"] },
  { version: "16", os: "bigsur", year: 2022, month: 10, adds: ["undoSend", "sendLater", "remindMe"] },
  { version: "26", os: "tahoe", year: 2025, month: 9, adds: ["categories"] },
];

const rank = (osId: string): number => OS_RELEASES.findIndex((r) => r.id === osId);

export function mailBuild(osId: string, hour: number): MailBuild {
  const now = monthIndexOf(hour), os = rank(osId);
  return MAIL_BUILDS.filter((b) => rank(b.os) <= os && b.year * 12 + b.month - 1 <= now).at(-1) ?? MAIL_BUILDS[0];
}

export const mailHas = (build: MailBuild, f: MailFeature): boolean =>
  MAIL_BUILDS.slice(0, MAIL_BUILDS.indexOf(build) + 1).some((b) => b.adds.includes(f));
