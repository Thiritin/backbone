import { describe, expect, it } from "vitest";
import { addressLines, mailedAddress } from "../src/sim/30-customers/addresses";
import { hostFor, invoiceOf, stepsDone } from "../src/sim/30-market/manual";
import { offerPrice, setupFee } from "../src/sim/30-market/spec";
import { domainFee } from "../src/sim/30-customers/registry";
const DOMAIN_FEE = domainFee(2005);
import { invoiceTotal } from "../src/sim/45-billing/billing";
import { matchTransfer } from "../src/sim/90-actions/billing";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { orderLead } from "../src/sim/30-market/orders";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { attachQuote, convertQuote, createAccount, createQuote, deleteQuote, editQuote, invoiceOrder, provisionOrder, quoteOrder, registerOrderDomain } from "../src/sim/90-actions/orders";
import type { SalesRequest } from "../src/sim/30-market/market";
import { owner, readyGame } from "./fixtures";

const web = { product: "webHosting" as const, size: 0, sla: "basic" as const };
const idOf = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok || !r.id) throw new Error(r.error); return r.id; };
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };

function order(s: GameState, budget = 100) {
  const r = orderLead(s, "smallBiz", "Frankfurt", [], web, true);
  s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget, owned: false } : x));
  return { id: r.ticketId!, req: () => s.sales.requests.find((x) => x.id === r.id)! };
}
// An order whose quote the customer took.
function accepted(s: GameState) {
  const o = order(s);
  if (!quoteOrder(s, o.id, 10, 0).ok) throw new Error("quote");
  for (let i = 0; i < 60 && !stepsDone(s, o.req()).quote; i++) tick(s);
  return o;
}

// Registers the domain and sets up the service: the steps after the confirmation.
function finish(s: GameState, id: string, req: () => SalesRequest) {
  idOf({ ...registerOrderDomain(s, id, ...owner(s, id)), id: "ok" });
  run(s, 1);
  idOf({ ...provisionOrder(s, id, hostFor(s, req())!), id: "ok" });
  run(s, 1);
}
const sent = (r: SalesRequest) => r.thread.filter((m) => m.from === "you").map((m) => m.key.replace(/\.\d$/, ""));

describe("free order of steps", () => {
  it("opens the account first and assigns the quote made after to it", () => {
    const s = readyGame(9);
    const { id, req } = order(s);
    const customers = s.customers.length;
    expect(createAccount(s, id, mailedAddress(s.seed, req())).ok).toBe(true);
    run(s, 1);
    const c = req().customerId!;
    expect(c).not.toBeNull();
    expect(stepsDone(s, req())).toMatchObject({ quote: false, account: true });
    const q = idOf(createQuote(s, id));
    expect(s.quotes.find((x) => x.id === q)!.customerId).toBe(c);
    expect(attachQuote(s, q, id).ok).toBe(true);
    for (let i = 0; i < 60 && !stepsDone(s, req()).quote; i++) tick(s);
    idOf(convertQuote(s, q));
    finish(s, id, req);
    expect(s.customers).toHaveLength(customers + 1);
    expect(invoiceOf(s, req())).toMatchObject({ status: "open", customerId: c });
    expect(sent(req())).toEqual(["reply.order.quote", "reply.order.done"]);
  });

  it("takes the quote first and sends one email once everything is done", () => {
    const s = readyGame(9);
    const { id, req } = accepted(s);
    expect(sent(req())).toEqual(["reply.order.quote"]);
    expect(createAccount(s, id, mailedAddress(s.seed, req())).ok).toBe(true);
    run(s, 1);
    idOf(invoiceOrder(s, id));
    run(s, 1);
    expect(invoiceOf(s, req())!.status).toBe("draft");
    idOf({ ...registerOrderDomain(s, id, ...owner(s, id)), id: "ok" });
    run(s, 1);
    // Account, confirmation and domain sent nothing yet.
    expect(sent(req())).toEqual(["reply.order.quote"]);
    idOf({ ...provisionOrder(s, id, hostFor(s, req())!), id: "ok" });
    run(s, 1);
    expect(sent(req())).toEqual(["reply.order.quote", "reply.order.done"]);
    const mail = req().thread.at(-1)!, inv = invoiceOf(s, req())!;
    expect(mail.params).toMatchObject({ invoice: inv.number, total: invoiceTotal(inv) });
    expect(inv.status).toBe("open");
    expect(s.tickets.find((x) => x.id === id)!.status).toBe("waiting");
  });
});

describe("order steps", () => {
  it("signs the order email with the sender's postal address", () => {
    const s = readyGame(7);
    const { req } = order(s);
    const a = mailedAddress(s.seed, req());
    expect(a).toMatchObject({ contact: req().contact, company: req().company });
    expect(addressLines(a)).toEqual([a.contact, a.company, a.street, `${a.zip} ${a.city}`, a.email]);
    expect(a.zip).toMatch(/^\d{5}$/);
    // Stable for the seed: the same order reads the same.
    const t = readyGame(7);
    expect(mailedAddress(t.seed, order(t).req())).toEqual(a);
  });

  it("creates the customer with the address entered and refuses one without", () => {
    const s = readyGame(8);
    const { id, req } = accepted(s);
    expect(createAccount(s, id)).toEqual({ ok: false, error: "error.addressMissing" });
    const a = { ...mailedAddress(s.seed, req()), street: "Gartenweg 4 " };
    expect(createAccount(s, id, { ...a, zip: " " })).toEqual({ ok: false, error: "error.addressMissing" });
    expect(createAccount(s, id, a).ok).toBe(true);
    run(s, 1);
    const c = s.customers.find((x) => x.id === req().customerId)!;
    expect(c.address).toMatchObject({ street: "Gartenweg 4 ", zip: a.zip, city: a.city, email: a.email });
    expect(s.services.some((v) => v.customerId === c.id)).toBe(false);
    expect(stepsDone(s, req()).account).toBe(true);
  });

  it("sends a quote dropped on the ticket, takes the answer and converts it to the first invoice", () => {
    const s = readyGame(9);
    const { id, req } = order(s);
    const made = idOf(createQuote(s, id));
    let q = s.quotes.find((x) => x.id === made)!;
    expect(q).toMatchObject({ ticketId: id, customerId: null, status: "draft", monthly: Math.round(offerPrice(s, "webHosting", req().spec) * 100) / 100, setup: setupFee(s, "webHosting") });
    // A second Create quote opens the same draft.
    expect(createQuote(s, id)).toEqual({ ok: true, id: q.id });
    expect(editQuote(s, q.id, 12.5, 20).ok).toBe(true);
    q = s.quotes.find((x) => x.id === made)!;
    expect(q.lines.map((l) => [l.key, l.amount])).toEqual([["invoice.line.setupFee", 20], ["invoice.line.firstMonth", 12.5], ["invoice.line.domain", DOMAIN_FEE]]);
    expect(convertQuote(s, q.id)).toEqual({ ok: false, error: "error.quoteNotAccepted" });
    expect(attachQuote(s, q.id, "tk0")).toEqual({ ok: false, error: "error.quoteOtherOrder" });
    expect(attachQuote(s, q.id, id).ok).toBe(true);
    expect(req()).toMatchObject({ quote: 12.5, setup: 20 });
    expect(s.quotes.find((x) => x.id === q.id)).toMatchObject({ status: "sent", sentAt: s.hour });
    expect(attachQuote(s, q.id, id)).toEqual({ ok: false, error: "error.quoteSentAlready" });
    for (let i = 0; i < 60 && !stepsDone(s, req()).quote; i++) tick(s);
    expect(s.quotes.find((x) => x.id === q.id)!.status).toBe("accepted");
    expect(convertQuote(s, q.id)).toEqual({ ok: false, error: "error.needsAccount" });
    expect(createAccount(s, id, mailedAddress(s.seed, req())).ok).toBe(true);
    run(s, 1);
    expect(s.quotes.find((x) => x.id === q.id)!.customerId).toBe(req().customerId);
    const conv = idOf(convertQuote(s, q.id));
    const inv = invoiceOf(s, req())!;
    expect(inv).toMatchObject({ id: conv, status: "draft", customerId: req().customerId });
    expect(invoiceTotal(inv)).toBe(32.5 + DOMAIN_FEE);
    expect(stepsDone(s, req()).invoice).toBe(true);
    // The draft confirms the order and goes out with the setup; the customer pays it by bank transfer.
    const mails = req().thread.length;
    finish(s, id, req);
    expect(req().thread.slice(mails).map((m) => m.key)).toEqual([expect.stringMatching(/order\.done/)]);
    expect(s.tickets.find((x) => x.id === id)!.status).toBe("waiting");
    expect(invoiceOf(s, req())).toMatchObject({ status: "open", bank: true });
    s.invoices = s.invoices.map((i) => (i.id === inv.id ? { ...i, payStep: 0, payAt: s.hour } : i));
    run(s, 1);
    const tr = s.transfers.find((x) => x.forInvoice === inv.id)!;
    expect(invoiceOf(s, req())!.status).toBe("open");
    expect(matchTransfer(s, tr.id, inv.id, true).ok).toBe(true);
    run(s, 1);
    expect(s.tickets.find((x) => x.id === id)!).toMatchObject({ status: "resolved", outcome: "accepted" });
  });

  it("carries an accepted quote forward to the first invoice once", () => {
    const s = readyGame(9);
    const { id, req } = order(s);
    const q = idOf(createQuote(s, id));
    const status = () => s.quotes.find((x) => x.id === q)!;
    expect(convertQuote(s, q)).toEqual({ ok: false, error: "error.quoteNotAccepted" });
    expect(attachQuote(s, q, id).ok).toBe(true);
    expect(convertQuote(s, q)).toEqual({ ok: false, error: "error.quoteNotAccepted" });
    for (let i = 0; i < 60 && status().status === "sent"; i++) tick(s);
    expect(createAccount(s, id, mailedAddress(s.seed, req())).ok).toBe(true);
    run(s, 1);
    expect(status().status).toBe("accepted");
    const inv = idOf(convertQuote(s, q));
    expect(s.invoices.find((i) => i.id === inv)).toMatchObject({ status: "draft", customerId: req().customerId, lines: status().lines });
    expect(status()).toMatchObject({ status: "invoiced", invoiceId: inv });
    expect(req().invoiceId).toBe(inv);
    expect(convertQuote(s, q)).toEqual({ ok: false, error: "error.quoteInvoiced" });
    expect(s.invoices.filter((i) => i.customerId === req().customerId)).toHaveLength(1);
  });

  it("deletes only quotes that were never sent", () => {
    const s = readyGame(9);
    const { id } = order(s);
    const q = idOf(createQuote(s, id));
    expect(deleteQuote(s, q).ok).toBe(true);
    expect(s.quotes).toEqual([]);
    const r = idOf(createQuote(s, id));
    expect(attachQuote(s, r, id).ok).toBe(true);
    expect(deleteQuote(s, r)).toEqual({ ok: false, error: "error.quoteSentAlready" });
  });

  it("marks the quote declined when the customer turns it down", () => {
    const s = readyGame(10);
    const { id } = order(s, 0.01);
    const q = idOf(createQuote(s, id));
    expect(attachQuote(s, q, id).ok).toBe(true);
    for (let i = 0; i < 60 && s.quotes.find((x) => x.id === q)!.status === "sent"; i++) tick(s);
    expect(s.quotes.find((x) => x.id === q)!.status).toBe("declined");
  });

  it("with the Helpdesk link runs the account and the first invoice from one Send", () => {
    const s = readyGame(9);
    s.books = { vendor: "lexwear", installedAt: s.hour, edition: "financial-office-pro", seats: 0 };
    const { id, req } = order(s);
    const q = idOf(createQuote(s, id));
    expect(attachQuote(s, q, id).ok).toBe(true);
    for (let i = 0; i < 60 && !req().invoiceId; i++) tick(s);
    const c = s.customers.find((x) => x.id === req().customerId)!;
    expect(c.address).toEqual(mailedAddress(s.seed, req()));
    // The quote shows it was carried forward on its own.
    expect(s.quotes.find((x) => x.id === q)).toMatchObject({ status: "invoiced", customerId: c.id, invoiceId: req().invoiceId });
    expect(invoiceOf(s, req())).toMatchObject({ status: "draft", customerId: c.id });
    expect(stepsDone(s, req())).toMatchObject({ quote: true, account: true, invoice: true, provision: false });
  });

  it("loads a save from before quotes and modules", () => {
    const s = readyGame(3);
    const data = JSON.parse(serialize(s));
    delete data.quotes;
    delete data.modules;
    const back = deserialize(JSON.stringify(data));
    expect(back.quotes).toEqual([]);
    expect(back.modules).toEqual([]);
  });
});
