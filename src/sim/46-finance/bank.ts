// docs/design/plans/billing-by-hand.md, 9b: the company's bank account. Cash stays s.cash, the account's balance.
import { t } from "../../i18n/en";
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart, nowMinutes, yearOf } from "../00-core/time";
import { bankById, DEFAULT_BANK, IBAN_YEAR, tanMethods, TRANSFER_HOURS, type Bank, type BankId, type TanMethod } from "../10-catalog/banks";
import { deliverMail } from "../40-support/tickets";
import type { Doc, GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

// A card applied for is ready at readyAt; due is what it spent since the last bill, booked as these entries when billed.
export interface Card { appliedAt: number; readyAt: number; limit: number; spent: LedgerEntry[]; feeAt: number }
export interface StandingOrder { id: string; name: string; account: string; amount: number; reference: string; day: number }
// A transfer the player sent; the money left at hour and reaches the payee at arriveAt.
export interface Outgoing { id: string; hour: number; arriveAt: number; name: string; account: string; amount: number; reference: string; payableId?: string }
// What the transfer form holds; account is an IBAN, or an account number with its bank code before IBAN.
export interface Draft { name: string; account: string; code?: string; amount: number; reference: string; payableId?: string }
// A transfer waiting for its TAN: the list position asked for (iTAN), the code texted (mTAN) and the minute the text arrives.
export interface Pending { draft: Draft; index: number | null; code: string | null; sendAt: number | null }
export interface BankAccount {
  id: BankId; number: string; pin: string; opened: number; tan: TanMethod;
  card: Card | null;
  // The overdraft limit, and the hour an application for one is decided.
  overdraft: number; overdraftAt: number | null;
  // Suppliers that debit themselves, and the transfers the bank sends every month.
  mandates: string[]; standingOrders: StandingOrder[];
  tans: { list: number; codes: string[]; used: number[] };
  pending: Pending | null;
  // Wrong TANs in a row; three lock the account until lockedUntil.
  wrong: number; lockedUntil: number;
  outgoing: Outgoing[];
  // Overdraft interest run up since the last month start.
  interest: number;
  // Whether the welcome email with the PIN went out; the first hour of the account sends it.
  welcomed: boolean;
}

export const TAN_COUNT = 100;
export const WRONG_LIMIT = 3;
export const LOCK_HOURS = 24;
export const APPROVAL_HOURS = 3 * 24;
export const MIN_CARD_LIMIT = 500;
export const MIN_OVERDRAFT = 500;
const HOURS_PER_YEAR = 8760;
const cents = (v: number) => Math.round(v * 100) / 100;
const digits = (r: ReturnType<typeof hashRng>, n: number) => Array.from({ length: n }, () => Math.floor(rand(r) * 10)).join("");

// The list's TANs come from the game seed, so the same game prints the same list.
export const tanCodes = (seed: number, list: number): string[] => {
  const r = hashRng(seed, 0x7a4, list);
  return Array.from({ length: TAN_COUNT }, () => String(100000 + Math.floor(rand(r) * 900000)));
};

export function openAccount(s: GameState, id: BankId): BankAccount {
  const r = hashRng(s.seed, 0xba4c, id.length);
  const bank = bankById(id)!;
  return {
    id, number: `${1 + Math.floor(rand(r) * 9)}${digits(r, 9)}`, pin: `${1 + Math.floor(rand(r) * 9)}${digits(r, 4)}`, opened: s.hour, tan: tanMethods(bank, yearOf(s.hour)).at(-1)?.method ?? "itan",
    card: null, overdraft: 0, overdraftAt: null, mandates: [], standingOrders: [],
    tans: { list: 1, codes: tanCodes(s.seed, 1), used: [] }, pending: null, wrong: 0, lockedUntil: 0, outgoing: [], interest: 0, welcomed: false,
  };
}

export const bankOf = (s: GameState): Bank | undefined => (s.bank ? bankById(s.bank.id) : undefined);
// What the company can spend: the balance and the overdraft.
export const spendable = (s: GameState): number => s.cash + (s.bank?.overdraft ?? 0);

// The IBAN of a German account: DE, two check digits (ISO 7064 mod 97), the bank code and the account number.
export function iban(code: string, account: string): string {
  const bban = `${code}${account.padStart(10, "0")}`;
  const mod = [...`${bban}131400`].reduce((m, d) => (m * 10 + Number(d)) % 97, 0);
  return `DE${String(98 - mod).padStart(2, "0")}${bban}`;
}
export const ownIban = (s: GameState): string => (s.bank ? iban(bankById(s.bank.id)!.code, s.bank.number) : "");
export const ibanEra = (s: GameState): boolean => yearOf(s.hour) >= IBAN_YEAR;
// An IBAN printed in groups of four.
export const groupIban = (v: string): string => v.replace(/(.{4})/g, "$1 ").trim();

// The TAN list as printed on the desktop: number and TAN in columns.
export function tanListText(s: GameState): string {
  const b = s.bank!;
  const rows = b.tans.codes.map((c, i) => `${String(i + 1).padStart(3, "0")}  ${b.tans.used.includes(i) ? "------" : c}`);
  const cols = 4, height = Math.ceil(rows.length / cols);
  const lines = Array.from({ length: height }, (_, y) => Array.from({ length: cols }, (_, x) => rows[x * height + y] ?? "").join("    ").trimEnd());
  return [`${bankById(b.id)!.name}  ${t("bank.tanList.no", { n: b.tans.list })}  ${b.number}`, "", ...lines].join("\n");
}

// The TAN list lies on the desktop next to Getting started; a new list replaces it.
export function placeTanList(s: GameState): void {
  if (!s.bank || s.bank.tan !== "itan") return;
  const body = tanListText(s), title = t("doc.tans");
  const doc = s.docs.find((d) => d.id === "tans");
  if (doc) { s.docs = s.docs.map((d) => (d.id === "tans" ? { ...d, body, title } : d)); return; }
  const guide = s.docs.find((d) => d.kind === "guide");
  const spot = { x: (guide?.x ?? 16) + 100, y: guide?.y ?? 46 };
  const taken = (x: number, y: number) => s.docs.some((d) => Math.abs(d.x - x) < 100 && Math.abs(d.y - y) < 100);
  while (taken(spot.x, spot.y)) spot.y += 100;
  s.docs = [...s.docs, { id: "tans", kind: "note", title, body, ...spot } satisfies Doc];
}

// The bank's welcome email carries the account number and PIN; the TAN list goes on the desktop.
function welcome(s: GameState): void {
  const bank = bankOf(s)!;
  s.bank = { ...s.bank!, welcomed: true };
  deliverMail(s, bank.name, "bankWelcome", { bank: bank.name, number: s.bank.number, pin: s.bank.pin, url: `www.${bank.host}` });
  placeTanList(s);
}

// Old saves bank at Sparklasse, registered or not; a game that has not registered opens its account at registration.
export const legacyBank = (s: GameState): BankAccount | null => (s.registration ? openAccount({ ...s, hour: s.registration.hour }, DEFAULT_BANK) : null);

// The next unused TAN on the list, picked from the seed and how many are used.
export function nextTanIndex(s: GameState): number {
  const b = s.bank!, free = b.tans.codes.map((_, i) => i).filter((i) => !b.tans.used.includes(i));
  return free[Math.floor(rand(hashRng(s.seed, b.tans.list, b.tans.used.length)) * free.length)];
}

// A used TAN is struck from the list; the last one used brings a new list.
export function useTan(s: GameState, index: number): void {
  const b = s.bank!;
  const used = [...b.tans.used, index];
  s.bank = used.length >= TAN_COUNT
    ? { ...b, tans: { list: b.tans.list + 1, codes: tanCodes(s.seed, b.tans.list + 1), used: [] } }
    : { ...b, tans: { ...b.tans, used } };
  if (used.length >= TAN_COUNT) deliverMail(s, bankOf(s)!.name, "bankTanList", { bank: bankOf(s)!.name, n: s.bank.tans.list });
  placeTanList(s);
}

// The money leaves now and reaches the payee after the bank's transfer time.
export function send(s: GameState, d: Draft, category = "transfers", key = "ledger.transfer"): Outgoing {
  const out: Outgoing = { id: `out${s.nextId++}`, hour: s.hour, arriveAt: s.hour + TRANSFER_HOURS[bankOf(s)!.speed], name: d.name, account: d.account, amount: d.amount, reference: d.reference, ...(d.payableId && { payableId: d.payableId }) };
  s.cash = cents(s.cash - d.amount);
  s.ledger = [...s.ledger, { hour: s.hour, category, key, params: { name: d.name, reference: d.reference }, amount: -d.amount }];
  s.bank = { ...s.bank!, outgoing: [...s.bank!.outgoing, out] };
  return out;
}

// The mTAN text arrives a minute after the transfer asks for it.
export function tanTick(s: GameState): void {
  const p = s.bank?.pending;
  if (!p || p.sendAt === null || nowMinutes(s) < p.sendAt) return;
  s.bank = { ...s.bank!, pending: { ...p, sendAt: null } };
  deliverMail(s, bankOf(s)!.name, "bankMtan", { bank: bankOf(s)!.name, code: p.code!, amount: p.draft.amount, name: p.draft.name });
}

// Hourly: the account fee and overdraft interest at each month start, interest on a negative balance, card and overdraft decisions.
export function bankTick(s: GameState): SimEvent[] {
  const b = s.bank, bank = bankOf(s);
  if (!b || !bank) return [];
  const events: SimEvent[] = [];
  const book = (category: string, key: string, params: LedgerEntry["params"], amount: number) => {
    s.cash = cents(s.cash + amount);
    s.ledger = [...s.ledger, { hour: s.hour, category, key, params, amount }];
  };
  if (!b.welcomed) welcome(s);
  let next: BankAccount = { ...s.bank!, interest: s.cash < 0 && bank.overdraft ? b.interest - (s.cash * bank.overdraft) / HOURS_PER_YEAR : b.interest };
  if (isMonthStart(s.hour)) {
    if (bank.monthly > 0) book("fees", "ledger.bankFee", { bank: bank.name }, -bank.monthly);
    if (next.interest >= 0.01) book("fees", "ledger.overdraftInterest", { bank: bank.name }, -cents(next.interest));
    next = { ...next, interest: 0 };
  }
  s.bank = next;
  return events;
}
