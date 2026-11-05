// docs/design/plans/billing-by-hand.md, 9b milestone 4: supplier invoices the player pays on the bank's site, and what each
// supplier does when one stays unpaid.
import { hashRng, rand } from "../00-core/rng";
import { registrarById, registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { storeItem } from "../10-catalog/store";
import { deliverMail } from "../42-mail/sources";
import type { SimEvent } from "../88-tick/tick";
import type { GameState, LedgerEntry } from "../50-state";
import { ALL_DATACENTERS as DATACENTERS, COUNTRY, datacenterById } from "../20-world/datacenters";
import { cardReady, cardSpent, groupIban, iban, ibanEra } from "./bank";

export type SupplierId = "upstream" | "power" | "datacenter" | "pear" | "registrar" | "hardware" | "card" | "office" | "notary" | "register" | "chamber" | "books" | "tax" | "software" | "landlord" | "shopVendor" | "network" | "services" | "contractor" | "marketplace" | "registry";
// throttle slows the home line, cut takes it off the internet, dark switches the locations' power off, licence stops the Pear
// subscriptions, domains lets the domains lapse, noShip stops hardware orders, card blocks the credit card.
export type Effect = "throttle" | "cut" | "dark" | "licence" | "domains" | "noShip" | "card";

// Each supplier's consequence: the effect that starts the given days after the due date, the worst one last.
export const CONSEQUENCES: Record<SupplierId, { days: number; effect: Effect }[]> = {
  upstream: [{ days: 7, effect: "throttle" }, { days: 14, effect: "cut" }],
  power: [{ days: 30, effect: "dark" }],
  datacenter: [{ days: 30, effect: "dark" }],
  pear: [{ days: 14, effect: "licence" }],
  registrar: [{ days: 30, effect: "domains" }],
  hardware: [{ days: 0, effect: "noShip" }],
  card: [{ days: 14, effect: "card" }],
  office: [], notary: [], register: [], chamber: [], tax: [],
  // The bookkeeping program keeps working unpaid; an open Taxware update only stops new modules.
  books: [],
  // An unpaid licence order just never sends its keys.
  software: [],
  landlord: [], shopVendor: [], network: [], services: [], contractor: [], marketplace: [], registry: [],
};
// The pun name each new supplier trades under unless the order names another.
export const SUPPLIER_NAMES: Partial<Record<SupplierId, string>> = { landlord: "Engel & Vogel", shopVendor: "Taxware", network: "DE-KICKS", registry: "RIPE NCC", services: "Pear" };
export const PAY_DAYS = 14;
export const THROTTLE = 0.25;
// The bank code every supplier banks at; each supplier's account comes from its id.
export const SUPPLIER_CODE = "60050101";

// held keeps what a consequence took away (Pear apps, domain expiry dates) so payment gives it back.
export interface Payable {
  id: string; supplier: SupplierId; name: string; number: string; amount: number; issuedAt: number; dueAt: number; paidAt: number | null;
  consequence: Effect | null; lines: LedgerEntry[]; sent: number; held?: Record<string, number>;
  // Warnings already raised, so each fires once.
  warned?: string[];
  // How it was paid and what kind of document it is; saves from before leave them out, read as transfer and invoice.
  method?: Method; doc?: Doc; order?: string;
  // What Books counts as paid: the payments out assigned to it there. sent is what the supplier received.
  booked: number;
  // A licence order paid by transfer, whose keys the vendor sends once the money arrives.
  keys?: { order: string; lines: { product: string; edition: string | null; qty: number; to?: string; replaces?: string }[]; mailTo?: string };
}

export const supplierAccount = (supplier: SupplierId): string => {
  const r = hashRng(supplier.length * 7919 + supplier.charCodeAt(0) * 31 + supplier.charCodeAt(supplier.length - 1));
  return String(1_000_000_000 + Math.floor(rand(r) * 8_999_999_999));
};
export const supplierIban = (supplier: SupplierId): string => iban(SUPPLIER_CODE, supplierAccount(supplier));
export const supplierCode = SUPPLIER_CODE;
// The supplier holding an account: by IBAN, or by account number at the suppliers' bank code. No one else banks.
export const supplierAt = (account: string, code?: string): SupplierId | undefined => (Object.keys(CONSEQUENCES) as SupplierId[])
  .find((sup) => account === supplierIban(sup) || (account === supplierAccount(sup) && (code ?? SUPPLIER_CODE) === SUPPLIER_CODE));

// A supplier's customer portal, where the player sets up a direct debit mandate; a registrar's sits on its own site.
export function supplierHost(name: string): string {
  const r = REGISTRARS.find((x) => x.name === name);
  return r ? registrarHost(r) : `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.de`;
}
export const supplierUrl = (name: string): string => `www.${supplierHost(name)}/account`;

// How a supplier gets its money: by transfer, from the company card as the invoice is issued, or by SEPA direct debit.
export type Method = "cash" | "transfer" | "onAccount" | "card" | "debit";
export type Doc = "invoice" | "receipt" | "credit" | "contract";
export type PayMethod = "transfer" | "card" | "debit";
export const PAY_METHODS: PayMethod[] = ["transfer", "card", "debit"];
export const payMethod = (s: GameState, name: string): PayMethod => (s.bank?.mandates.includes(name) ? "debit" : s.bank?.cards.includes(name) ? "card" : "transfer");
// A datacenter's country is its city's; any other supplier is German when its site is under .de.
export function supplierCountry(name: string): string {
  const dc = DATACENTERS.find((d) => d.name === name);
  return dc ? COUNTRY[dc.city] ?? "" : supplierHost(name).endsWith(".de") ? "DE" : "";
}
// SEPA direct debit is only offered by German suppliers.
export const debitAllowed = (name: string): boolean => supplierCountry(name) === "DE";

// Whom the company buys from on account: a supplier that invoiced it, a datacenter under contract, the registrar partner and
// the utility.
export const isSupplier = (s: GameState, name: string): boolean => name === UTILITY || s.payables.some((p) => p.name === name)
  || s.contracts.some((c) => datacenterById(c.dc).name === name) || (!!s.registrar && registrarById(s.registrar.id)?.name === name);

export const open = (s: GameState): Payable[] => s.payables.filter((p) => p.paidAt === null);
export const overdue = (s: GameState, p: Payable): boolean => p.paidAt === null && s.hour > p.dueAt;
// The same in Books, which goes by the payments assigned there.
export const unbooked = (p: Payable): boolean => p.booked < p.amount - 0.005;
export const lateInBooks = (s: GameState, p: Payable): boolean => unbooked(p) && s.hour > p.dueAt;
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

export interface Bill { supplier: SupplierId; name: string; lines: LedgerEntry[]; method: Method; paper?: boolean; days?: number; order?: string; doc?: Doc }

// One vendor document by method: cash, card and debit settle at once (a debit also leaves a bank booking, a card the monthly
// statement), transfer and on account stay open until paid. Negative lines make a credit note, no lines a contract.
export function bill(s: GameState, b: Bill): Payable {
  const { supplier, name, lines, method } = b;
  const amount = cents(-lines.reduce((n, e) => n + e.amount, 0)) + 0;
  const doc: Doc = b.doc ?? (amount < 0 ? "credit" : method === "cash" ? "receipt" : "invoice");
  const id = `pay${s.nextId++}`;
  const p: Payable = { id, supplier, name, number: `${supplier.slice(0, 2).toUpperCase()}-${id.slice(3)}`, amount, issuedAt: s.hour, dueAt: s.hour + (b.days ?? PAY_DAYS) * 24, paidAt: null, consequence: null, lines, sent: 0, booked: 0, method, doc, ...(b.order ? { order: b.order } : {}) };
  const from = { source: `supplier:${supplier}`, att: [{ k: "invoice" as const, id }] };
  const params = { name, number: p.number, amount: Math.abs(amount), payable: id };
  const settle = () => Object.assign(p, { sent: amount, paidAt: s.hour, booked: amount });
  if (doc === "credit" || doc === "contract" || method === "cash") {
    book(s, lines);
    settle();
    deliverMail(s, name, doc === "invoice" ? "receipt" : doc, params, from);
  } else if (method === "debit") {
    book(s, lines);
    settle();
    const debit = { id: `out${s.nextId++}`, hour: s.hour, arriveAt: s.hour, name, account: ibanEra(s) ? supplierIban(supplier) : supplierAccount(supplier), amount, reference: p.number, payableId: id, matched: id, arrived: true as const, debit: true as const };
    s.bank = { ...s.bank!, outgoing: [...s.bank!.outgoing, debit] };
    deliverMail(s, name, "debit", params, from);
  } else if (method === "card") {
    const card = s.bank!.card!;
    s.bank = { ...s.bank!, card: { ...card, spent: [...card.spent, ...lines.map((e) => ({ ...e, hour: s.hour }))] } };
    settle();
    deliverMail(s, name, "cardPaid", params, from);
  } else if (!b.paper) deliverMail(s, name, "invoice", { ...params, due: p.dueAt, iban: ibanEra(s) ? groupIban(supplierIban(supplier)) : "", account: supplierAccount(supplier), code: SUPPLIER_CODE, url: supplierUrl(name) }, from);
  s.payables = [...s.payables, p];
  return p;
}

// Whether a vendor charge can be placed: a company with a bank account owes it as a payable, otherwise the till must hold it.
export const canPay = (s: GameState, amount: number): boolean => !!s.bank || s.cash >= amount;

// A charge that falls due inside the simulation (a fee at an incident, a monthly bill): cash before the company banks, else an open transfer.
export function billDue(s: GameState, supplier: SupplierId, name: string, lines: LedgerEntry[]): void {
  if (lines.some((l) => l.amount !== 0)) bill(s, { supplier, name, lines, method: s.bank ? "transfer" : "cash" });
}

// A supplier's invoice by email with the invoice attached, or on paper when a letter brings it; a supplier with a mandate
// debits it at once, one paid by card charges the card when it is ready and has the room.
export const invoice = (s: GameState, supplier: SupplierId, name: string, lines: LedgerEntry[], days = PAY_DAYS, paper = false): Payable => {
  const m = payMethod(s, name), room = cardReady(s) && cardSpent(s) - lines.reduce((n, e) => n + e.amount, 0) <= (s.bank?.card?.limit ?? 0);
  return bill(s, { supplier, name, lines, days, paper, method: m === "card" && !room ? "transfer" : m, doc: "invoice" });
};

// Which supplier sends each monthly bill line; lines of no supplier here stay direct debits (leases, addresses).
const SUPPLIER_OF: Record<string, SupplierId> = {
  "ledger.power": "power", "ledger.powerUse": "power", "ledger.dcPower": "datacenter", "ledger.space": "datacenter", "ledger.feed": "datacenter", "ledger.flatPower": "datacenter",
  "ledger.homeLine": "upstream", "ledger.subscription": "pear", "ledger.subscriptionSeats": "pear",
};
export const UTILITY = "E.OFF";
// The pun name of the builders, movers and technicians the company hires.
export const CONTRACTOR = "Baukraft";
export const HARDWARE_SHOP = "Alternatte";

// The month's lines no supplier invoices (leases, addresses, properties, modules): one document per payee, debited from the
// bank or paid in cash before there is one.
const LANDLORD = new Set(["ledger.officeRent", "ledger.officeLine", "ledger.upkeep", "ledger.hallUpkeep"]);
const NETWORK = new Set(["ledger.addresses"]);
const DIRECT_SUPPLIER = (key: string): SupplierId => (key === "ledger.lease" ? "hardware" : LANDLORD.has(key) ? "landlord" : NETWORK.has(key) ? "network" : key === "ledger.lirYearly" ? "registry" : "services");
export function billDirect(s: GameState, lines: LedgerEntry[]): void {
  const by = new Map<string, { supplier: SupplierId; name: string; lines: LedgerEntry[] }>();
  for (const l of lines) {
    const supplier = DIRECT_SUPPLIER(l.key), name = l.key === "ledger.lease" ? String(l.params.lessor) : SUPPLIER_NAMES[supplier] ?? supplier;
    const g = by.get(`${supplier}|${name}`) ?? { supplier, name, lines: [] };
    g.lines.push(l);
    by.set(`${supplier}|${name}`, g);
  }
  for (const g of by.values()) bill(s, { ...g, method: s.bank ? "debit" : "cash" });
}

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

// The payable a transfer pays at the account's holder: the one the form came from, else the open one the reference names,
// else the holder's oldest open one.
export function payableFor(s: GameState, account: string, reference: string, payableId?: string, code?: string): Payable | undefined {
  const sup = supplierAt(account, code), words = reference.split(/[\s,;:]+/);
  const mine = open(s).filter((p) => p.supplier === sup && p.sent < p.amount - 0.005);
  return mine.find((p) => p.id === payableId) ?? mine.find((p) => words.includes(p.number)) ?? mine[0];
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
export function payablesTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (!s.payables.some((p) => p.paidAt === null)) return events;
  // Power and domains go last: a warning once the bill is overdue and a reminder a week before the cut. Each fires once,
  // when its hour is first reached, so a skipped hour still warns.
  s.payables = s.payables.map((p) => {
    if (p.paidAt !== null) return p;
    const warned = new Set(p.warned ?? []);
    let last: SimEvent | null = null;
    for (const c of CONSEQUENCES[p.supplier]) {
      if (c.effect !== "dark" && c.effect !== "domains") continue;
      const steps: [string, number, number][] = [["due", p.dueAt + 1, c.days], ...(c.days > 7 ? [["soon", p.dueAt + (c.days - 7) * 24, 7] as [string, number, number]] : [])];
      for (const [name, at, days] of steps) {
        const key = `${c.effect}:${name}`;
        if (warned.has(key) || s.hour < at) continue;
        warned.add(key);
        if (s.hour < p.dueAt + c.days * 24) last = { app: "Books", key: `event.billThreat.${c.effect}`, params: { name: p.name, days } };
      }
    }
    if (warned.size === (p.warned?.length ?? 0)) return p;
    if (last) events.push(last);
    return { ...p, warned: [...warned] };
  });
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
    if (effect === "dark" || effect === "domains") events.push({ app: "Books", key: `event.billCut.${effect}`, params: { name: p.name } });
    deliverMail(s, p.name, `consequence.${effect}`, { name: p.name, number: p.number, amount: cents(p.amount - p.sent) }, { source: `supplier:${p.supplier}` });
    return { ...p, consequence: effect, held };
  });
  const dark = new Set<string>();
  for (const sup of ["power", "datacenter"] as const) {
    if (effectOf(s, sup) !== "dark") continue;
    for (const l of s.locations) if (sup === "power" ? !l.dc : !!l.dc) dark.add(l.id);
  }
  if (dark.size) s.ops = { ...s.ops, dark: { ...s.ops.dark, ...Object.fromEntries([...dark].map((id) => [id, Math.max(s.ops.dark[id] ?? 0, s.hour + 1)])) } };
  return events;
}
