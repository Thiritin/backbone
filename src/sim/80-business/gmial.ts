// Gmial by year (docs/design/plans/webmail-consumer.md, 4.5 and milestone 9): looks, Labs, stars, Inbox types and tabs,
// the Priority rule, Undo Send, Snooze, Smart Reply and the Mail Goggles sums. Settings live in the account's prefs.
import { hashRng, rand } from "../00-core/rng";
import { dateOf, hourOfMonth } from "../00-core/time";
import { categoryOf, importantOf, type GmialCategory } from "../10-catalog/mail-consumer";
import { stepAt, type Steps } from "../10-catalog/mail-providers";
import { mailHooks } from "../42-mail/caps";
import { boxOf, tenantOf, view } from "../42-mail/model";
import type { MailAccount, MailKind, Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import { createMailFolder } from "../90-actions/mailmsg";
import { IMPORTANT, importantLabel } from "./mail-search";

export type GmialLook = "classic" | "redesign" | "tabs" | "material" | "pill";
const LOOKS: Steps<GmialLook> = [["2004-04", "classic"], ["2011-11", "redesign"], ["2013-05", "tabs"], ["2018-04", "material"], ["2022-07", "pill"]];
export const gmialLook = (hour: number): GmialLook => stepAt(LOOKS, hour);

const since = (hour: number, ym: string) => hour >= hourOfMonth(ym);
export const GMIAL = {
  keys: "2007-10", themes: "2008-11", important: "2010-01", priority: "2010-08", priorityUntil: "2019-01", clips: "2006-01",
  blackBarUntil: "2013-11", promoAdUntil: "2017-01", undoSetting: "2015-06", undoAlways: "2018-04",
} as const;

export type LabId = "superstars" | "preview" | "canned" | "nested" | "goggles" | "snakey" | "undo" | "noop";
// graduates: on for everyone from that month; keeps: stays as the player set it when the Labs tab closes.
export const LABS: { id: LabId; from: string; graduates?: string; keeps?: true }[] = [
  { id: "superstars", from: "2008-08", keeps: true }, { id: "preview", from: "2009-08", keeps: true }, { id: "canned", from: "2008-11", keeps: true },
  { id: "nested", from: "2008-06", graduates: "2010-01" }, { id: "goggles", from: "2008-10" }, { id: "snakey", from: "2008-06" },
  { id: "undo", from: "2009-03", graduates: GMIAL.undoSetting }, { id: "noop", from: "2008-06" },
];
const LABS_FROM = "2008-06", LABS_UNTIL = "2020-01";
export const labsOpen = (hour: number): boolean => since(hour, LABS_FROM) && !since(hour, LABS_UNTIL);
export const labsShown = (hour: number) => LABS.filter((l) => since(hour, l.from) && !(l.graduates && since(hour, l.graduates)));
const list = (a: MailAccount, k: string, fallback = "") => String(a.prefs?.[k] ?? fallback).split(",").filter(Boolean);
export const labFlags = (a: MailAccount): string[] => list(a, "labs");

export function labOn(hour: number, a: MailAccount, id: LabId): boolean {
  const l = LABS.find((x) => x.id === id)!;
  if (l.graduates && since(hour, l.graduates)) return true;
  return since(hour, l.from) && labFlags(a).includes(id) && (labsOpen(hour) || !!l.keeps);
}

export const keysOn = (hour: number, a: MailAccount): boolean => since(hour, GMIAL.keys) && a.prefs?.keys === "on";

export const THEMES = ["classic", "terminal", "shiny", "ninja"] as const;
export const themeOf = (hour: number, a: MailAccount): string => (since(hour, GMIAL.themes) && THEMES.includes(a.prefs?.theme as never) ? String(a.prefs!.theme) : "classic");

export const inboxType = (hour: number, a: MailAccount): "default" | "priority" =>
  a.prefs?.inbox === "priority" && since(hour, GMIAL.priority) && !since(hour, GMIAL.priorityUntil) ? "priority" : "default";

// Superstars: 0 is the yellow star, 1 to 7 the colour flags Pear Mail sets. A click moves to the next enabled one, then off.
export const STAR_TYPES = [0, 1, 2, 3, 4, 5, 6, 7];
export const starsOf = (a: MailAccount): number[] => list(a, "stars", "0").map(Number).filter((n) => STAR_TYPES.includes(n));
export function nextStar(m: Pick<Message, "star" | "flag">, enabled: number[]): { star: boolean; flag: number | null } {
  const n = enabled[enabled.indexOf(m.star ? m.flag ?? 0 : -1) + 1];
  return n === undefined ? { star: false, flag: null } : { star: true, flag: n || null };
}

// Seconds the page holds a sent message: a Lab from 2009, an opt-in setting from June 2015, always on from 2018.
export const UNDO_PERIODS = [5, 10, 20, 30];
export function undoPeriod(hour: number, a: MailAccount): number {
  const p = Number(a.prefs?.undo ?? 0), set = UNDO_PERIODS.includes(p) ? p : 0;
  if (since(hour, GMIAL.undoAlways)) return set || 5;
  if (since(hour, GMIAL.undoSetting)) return set;
  return labOn(hour, a, "undo") ? set || 10 : 0;
}

// The Inbox tabs from 2013: Primary always, the others as the player picked them; a message of a hidden tab stays in Primary.
export const CATEGORIES: GmialCategory[] = ["primary", "social", "promotions", "updates", "forums"];
export const tabsOf = (a: MailAccount): GmialCategory[] => ["primary", ...CATEGORIES.slice(1).filter((c) => list(a, "tabs", "social,promotions").includes(c))];
export function tabOf(s: GameState, m: Message): GmialCategory {
  const viaGroup = s.mail.groups.some((g) => `${g.local}@${s.mail.tenants.find((x) => x.id === g.tenant)?.domain}` === m.to);
  return categoryOf(m.kind, viaGroup);
}

// Snooze choices of the 2018 look: hours the conversation comes back.
export function snoozeChoices(hour: number): { id: "today" | "tomorrow" | "weekend" | "week"; until: number }[] {
  const d = dateOf(hour), h = d.getUTCHours(), dow = d.getUTCDay(), day = Math.floor(hour) - h, at = (days: number, hh: number) => day + days * 24 + hh;
  return [
    ...(h < 17 ? [{ id: "today" as const, until: at(0, 18) }] : []), { id: "tomorrow" as const, until: at(1, 8) },
    ...(dow >= 1 && dow <= 5 ? [{ id: "weekend" as const, until: at(6 - dow, 8) }] : []), { id: "week" as const, until: at((8 - dow) % 7 || 7, 8) },
  ];
}

// Smart Reply chips by kind: i18n keys gmial.smart.<id>.
const SMART: Partial<Record<MailKind, string[]>> = {
  support: ["onIt", "letMeCheck", "thanks"], order: ["thanks", "received", "willDo"], invoice: ["thanks", "received", "gotIt"],
  bank: ["thanks", "received", "gotIt"], promotion: ["noThanks", "thanks", "gotIt"], newsletter: ["noThanks", "thanks", "gotIt"],
};
export const smartReplies = (kind: MailKind): string[] => SMART[kind] ?? ["thanks", "gotIt", "willDo"];

// Mail Goggles: late at night a send waits for five sums, the same ones within an hour.
export const gogglesLate = (hour: number): boolean => { const h = dateOf(hour).getUTCHours(); return h >= 22 || h < 4; };
export function gogglesQuiz(seed: number, hour: number): [number, number][] {
  const r = hashRng(seed, Math.floor(hour), 4711), n = () => 10 + Math.floor(rand(r) * 90);
  return Array.from({ length: 5 }, () => [n(), n()]);
}

const ADDRESS = /[^\s<>,;"]+@[^\s<>,;"]+/g;
// The Priority rule on arrival: Goggle mailboxes label an important message Important, so the marker and IMAP agree.
mailHooks.arrive = (s, a, m) => {
  if (m.folder !== "inbox" || !since(s.hour, GMIAL.important) || tenantOf(s, a)?.host !== "goggle") return;
  const mine = boxOf(s, a.id).filter((x) => x.from === `acct:${a.id}`);
  const wroteTo = new Set(mine.flatMap((x) => [x.to, ...(x.cc ?? [])].join(",").toLowerCase().match(ADDRESS) ?? []));
  const answered = new Set(mine.some((x) => x.thread === m.thread) ? [m.id] : []);
  if (!importantOf({ ...m, from: view(s, m).fromAddress.toLowerCase() }, wroteTo, answered)) return;
  if (!importantLabel(s, a.id)) createMailFolder(s, a.id, IMPORTANT);
  const id = importantLabel(s, a.id)?.id;
  if (id) m.labels = [...new Set([...(m.labels ?? []), id])];
};
