import { cardReady, cardSpent } from "../46-finance/bank";
import { bill, debitAllowed, shopBlocked, type Method, type Payable, type SupplierId } from "../46-finance/payables";
import type { LedgerEntry, GameState } from "../50-state";
import { INVOICE_AFTER, paidOrders, type ActionResult } from "./hardware";

const total = (lines: LedgerEntry[]) => -lines.reduce((n, e) => n + e.amount, 0);
const room = (s: GameState, lines: LedgerEntry[]) => cardReady(s) && cardSpent(s) + total(lines) <= s.bank!.card!.limit;

// The only place with method rules: cash before the company has a bank account, then transfer, plus the methods its terms
// allow. Direct debit needs the supplier's name and a mandate with it.
export function methodsFor(s: GameState, supplier: SupplierId, lines: LedgerEntry[], name?: string): Method[] {
  if (!s.bank) return ["cash"];
  const out: Method[] = ["transfer"];
  if (supplier !== "hardware" || paidOrders(s) >= INVOICE_AFTER) out.push("onAccount");
  if (room(s, lines)) out.push("card");
  if (name && debitAllowed(name) && s.bank.mandates.includes(name)) out.push("debit");
  return out;
}

// Checks the method against the company's means, then issues the one document for the order. A credit (negative total) is
// money coming back and needs no check.
export function placeOrder(s: GameState, o: { supplier: SupplierId; name: string; lines: LedgerEntry[]; method: Method; order?: string; doc?: Payable["doc"] }): ActionResult & { payable?: string } {
  const amount = total(o.lines), { method } = o;
  const fail = (error: string) => ({ ok: false as const, error });
  if (amount > 0) {
    if (method === "cash" ? s.bank || s.cash < amount : false) return fail("error.noCash");
    if (method !== "cash" && !s.bank) return fail("error.noBank");
    if (o.supplier === "hardware" && shopBlocked(s)) return fail("error.shopUnpaid");
    if (method === "onAccount" && o.supplier === "hardware" && paidOrders(s) < INVOICE_AFTER) return fail("error.noInvoice");
    if (method === "card" && !cardReady(s)) return fail("error.noCard");
    if (method === "card" && !room(s, o.lines)) return fail("error.cardLimit");
    if (method === "debit" && !debitAllowed(o.name)) return fail("error.debitAbroad");
  }
  const p = bill(s, o);
  return { ok: true, id: p.id, payable: p.id };
}
