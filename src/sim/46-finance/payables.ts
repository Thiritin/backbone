// docs/design/plans/billing-by-hand.md, 9b milestone 4: supplier invoices the player pays on the bank's site, and what each
// supplier does when one stays unpaid.
import { hashRng, rand } from "../00-core/rng";
import { storeItem } from "../10-catalog/store";
import { deliverMail } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import { groupIban, iban, ibanEra } from "./bank";

export type SupplierId = "upstream" | "power" | "datacenter" | "pear" | "registrar" | "hardware" | "card";
// throttle slows the home line, cut takes it off the internet, dark switches the locations' power off, licence stops the Pear
// subscriptions, domains lets the domains lapse, noShip stops hardware orders, card blocks the credit card.
export type Effect = "throttle" | "cut" | "dark" | "licence" | "domains" | "noShip" | "card";

// Each supplier's consequence: the effect that starts the given days after the due date, the worst one last.
export const CONSEQUENCES: Record<SupplierId, { days: number; effect: Effect }[]> = {
  upstream: [{ days: 7, effect: "throttle" }, { days: 14, effect: "cut" }],
  power: [{ days: 30, effect: "dark" }],
  datacenter: [{ days: 30, effect: "dark" }],
  pear: [{ days: 14, effect: "licence" }],
  registrar: [{ days: 14, effect: "domains" }],
  hardware: [{ days: 0, effect: "noShip" }],
  card: [{ days: 14, effect: "card" }],
};
export const PAY_DAYS = 14;
export const THROTTLE = 0.25;
// The bank code every supplier banks at; each supplier's account comes from its id.
const SUPPLIER_CODE = "60050101";

// held keeps what a consequence took away (Pear apps, domain expiry dates) so payment gives it back.
export interface Payable {
  id: string; supplier: SupplierId; name: string; number: string; amount: number; issuedAt: number; dueAt: number; paidAt: number | null;
  consequence: Effect | null; lines: LedgerEntry[]; sent: number; held?: Record<string, number>;
}

export const supplierAccount = (supplier: SupplierId): string => {
  const r = hashRng(supplier.length * 7919 + supplier.charCodeAt(0) * 31 + supplier.charCodeAt(supplier.length - 1));
  return String(1_000_000_000 + Math.floor(rand(r) * 8_999_999_999));
};
export const supplierIban = (supplier: SupplierId): string => iban(SUPPLIER_CODE, supplierAccount(supplier));
export const supplierCode = SUPPLIER_CODE;

export const open = (s: GameState): Payable[] => s.payables.filter((p) => p.paidAt === null);
export const overdue = (s: GameState, p: Payable): boolean => p.paidAt === null && s.hour > p.dueAt;
// The consequence a supplier applies right now, if any of its invoices has run long enough past due.
export function effectOf(s: GameState, supplier: SupplierId): Effect | null {
  let worst: Effect | null = null, rank = -1;
  for (const p of s.payables) {
    if (p.supplier !== supplier || p.paidAt !== null) continue;
    CONSEQUENCES[supplier].forEach((c, i) => { if (s.hour >= p.dueAt + c.days * 24 && i > rank) { rank = i; worst = c.effect; } });
  }
  return worst;
}
export const lineCut = (s: GameState): boolean => effectOf(s, "upstream") === "cut";
export const lineFactor = (s: GameState): number => (effectOf(s, "upstream") === "throttle" ? THROTTLE : 1);
export const shopBlocked = (s: GameState): boolean => effectOf(s, "hardware") === "noShip";
export const cardBlocked = (s: GameState): boolean => effectOf(s, "card") === "card";

const cents = (v: number) => Math.round(v * 100) / 100;
const book = (s: GameState, lines: LedgerEntry[]) => {
  s.cash = cents(s.cash + lines.reduce((n, e) => n + e.amount, 0));
  s.ledger = [...s.ledger, ...lines.map((e) => ({ ...e, hour: s.hour }))];
};

// A supplier's invoice by email; a supplier with a mandate debits it at once. Returns the payable.
export function invoice(s: GameState, supplier: SupplierId, name: string, lines: LedgerEntry[], days = PAY_DAYS): Payable {
  const amount = cents(-lines.reduce((n, e) => n + e.amount, 0));
  const id = `pay${s.nextId++}`;
  const p: Payable = { id, supplier, name, number: `${supplier.slice(0, 2).toUpperCase()}-${id.slice(3)}`, amount, issuedAt: s.hour, dueAt: s.hour + days * 24, paidAt: null, consequence: null, lines, sent: 0 };
  if (s.bank?.mandates.includes(supplier)) {
    book(s, lines);
    p.sent = amount;
    p.paidAt = s.hour;
    deliverMail(s, name, "debit", { name, number: p.number, amount });
  } else deliverMail(s, name, "invoice", { name, number: p.number, amount, due: p.dueAt, iban: ibanEra(s) ? groupIban(supplierIban(supplier)) : "", account: supplierAccount(supplier), code: SUPPLIER_CODE });
  s.payables = [...s.payables, p];
  return p;
}

// Which supplier sends each monthly bill line; lines of no supplier here stay direct debits (leases, addresses).
const SUPPLIER_OF: Record<string, SupplierId> = {
  "ledger.power": "power", "ledger.space": "datacenter", "ledger.feed": "datacenter", "ledger.flatPower": "datacenter",
  "ledger.homeLine": "upstream", "ledger.subscription": "pear", "ledger.subscriptionSeats": "pear",
};
export const UTILITY = "E.OFF";
export const HARDWARE_SHOP = "Alternatte";

// Turns the month's bills into one invoice per supplier and returns the lines still debited directly.
export function billSuppliers(s: GameState, bills: LedgerEntry[], names: Partial<Record<SupplierId, string>>): LedgerEntry[] {
  const by = new Map<SupplierId, LedgerEntry[]>();
  for (const b of bills) {
    const sup = SUPPLIER_OF[b.key];
    if (sup) by.set(sup, [...(by.get(sup) ?? []), b]);
  }
  for (const [sup, lines] of by) invoice(s, sup, names[sup] ?? (sup === "power" ? UTILITY : sup === "pear" ? "Pear" : sup), lines);
  return bills.filter((b) => !SUPPLIER_OF[b.key]);
}

// Suppliers that bill by invoice once the company banks; a game without an account keeps the direct debit of old.
export const invoicing = (s: GameState): boolean => !!s.bank;

// The payable a transfer pays: the one the form came from, or an open one of the payee whose number the reference names.
export function payableFor(s: GameState, account: string, reference: string, payableId?: string): Payable | undefined {
  if (payableId) return s.payables.find((p) => p.id === payableId && p.paidAt === null);
  return open(s).find((p) => (account === supplierIban(p.supplier) || account === supplierAccount(p.supplier)) && reference.includes(p.number));
}

// A transfer to a payable books its lines, scaled to the part it pays.
export function bookPayment(s: GameState, p: Payable, amount: number): void {
  const share = Math.min(1, amount / p.amount);
  const lines = p.lines.map((e) => ({ ...e, amount: cents(e.amount * share) }));
  const rest = cents(-amount - lines.reduce((n, e) => n + e.amount, 0));
  if (lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], amount: cents(lines[lines.length - 1].amount + rest) };
  book(s, lines);
  s.payables = s.payables.map((x) => (x.id === p.id ? { ...x, sent: cents(x.sent + amount) } : x));
}

// The money reached the supplier: a fully paid invoice is settled and its consequence lifted.
export function arrived(s: GameState, payableId: string): void {
  const p = s.payables.find((x) => x.id === payableId);
  if (!p || p.paidAt !== null || p.sent < p.amount - 0.005) return;
  lift(s, p);
  s.payables = s.payables.map((x) => (x.id === p.id ? { ...x, paidAt: s.hour, consequence: null, held: undefined } : x));
}

function lift(s: GameState, p: Payable): void {
  const held = p.held ?? {};
  if (p.consequence === "licence") s.installed = [...new Set([...s.installed, ...Object.keys(held)])];
  if (p.consequence === "domains") s.domains = s.domains.map((d) => (d.name in held ? { ...d, expiresAt: Math.max(held[d.name], d.expiresAt) } : d));
}

// Hourly: consequences start on overdue invoices; a dark location stays dark an hour at a time until the bill is paid.
export function payablesTick(s: GameState): void {
  if (!s.payables.some((p) => p.paidAt === null)) return;
  s.payables = s.payables.map((p) => {
    if (p.paidAt !== null) return p;
    const effect = CONSEQUENCES[p.supplier].reduce<Effect | null>((e, c) => (s.hour >= p.dueAt + c.days * 24 ? c.effect : e), null);
    if (effect === p.consequence) return p;
    let held = p.held;
    if (effect === "licence") {
      const apps = s.installed.filter((id) => (storeItem(id)?.monthly ?? 0) > 0);
      held = Object.fromEntries(apps.map((id) => [id, 1]));
      s.installed = s.installed.filter((id) => !apps.includes(id));
    }
    if (effect === "domains") {
      held = Object.fromEntries(s.domains.map((d) => [d.name, d.expiresAt]));
      s.domains = s.domains.map((d) => ({ ...d, expiresAt: Math.min(d.expiresAt, s.hour) }));
    }
    deliverMail(s, p.name, `consequence.${effect}`, { name: p.name, number: p.number, amount: cents(p.amount - p.sent) });
    return { ...p, consequence: effect, held };
  });
  const dark = new Set<string>();
  for (const sup of ["power", "datacenter"] as const) {
    if (effectOf(s, sup) !== "dark") continue;
    for (const l of s.locations) if (sup === "power" ? !l.dc : !!l.dc) dark.add(l.id);
  }
  if (dark.size) s.ops = { ...s.ops, dark: { ...s.ops.dark, ...Object.fromEntries([...dark].map((id) => [id, Math.max(s.ops.dark[id] ?? 0, s.hour + 1)])) } };
}
