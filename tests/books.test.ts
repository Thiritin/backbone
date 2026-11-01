import { describe, expect, it } from "vitest";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { newGame } from "../src/sim/50-state";
import { ALREADY_PAID_HAPPINESS, DUE_DAYS, billingTick, owed } from "../src/sim/45-billing/billing";
import type { Profile } from "../src/sim/30-customers/customers";
import { tick } from "../src/sim/88-tick/tick";
import { matchTransfer, sendInvoice, sendReminder } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withServer } from "./fixtures";

describe("customer addresses", () => {
  it("come from the order's sender and city", () => {
    const s = withServer(newGame(5));
    const id = addCustomer(s, "Renner IT", "smallBiz", "prompt", { contact: "Tobias Renner", company: "Renner IT", city: "Munich" });
    const a = s.customers.find((c) => c.id === id)!.address;
    expect(a).toMatchObject({ contact: "Tobias Renner", company: "Renner IT", email: "renner@renner-it.de" });
    expect(a.zip).toMatch(/^\d{5}$/);
    expect(a.street).toMatch(/ \d+$/);
  });

  it("give private customers a personal mailbox and no company", () => {
    const s = withServer(newGame(5));
    const id = addCustomer(s, "Anna Bauer", "private", "prompt", { contact: "Anna Bauer", company: null, city: "London" });
    const a = s.customers.find((c) => c.id === id)!.address;
    expect(a.company).toBeUndefined();
    expect(a.email).toMatch(/^anna\.bauer@/);
    expect(a.street).toMatch(/^\d+ /);
  });

  it("are filled for saves from before addresses, the same on every load", () => {
    const s = withServer(newGame(5));
    addCustomer(s, "Bäckerei Krause", "soleProp");
    const raw = JSON.parse(serialize(s));
    delete raw.customers[0].address;
    const a = deserialize(JSON.stringify(raw)).customers[0].address;
    expect(a.company).toBe("Bäckerei Krause");
    expect(a.contact).toMatch(/\w+ \w+/);
    expect(deserialize(JSON.stringify(raw)).customers[0].address).toEqual(a);
  });
});

describe("draft invoices", () => {
  const drafted = () => {
    const s = withServer(newGame(9));
    const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
    addService(s, c, "domain", "mueller.de", 12, "year");
    tick(s);
    return { s, inv: () => s.invoices[0] };
  };

  it("are issued each run and never pay while unsent", () => {
    const { s, inv } = drafted();
    expect(inv()).toMatchObject({ status: "draft", payAt: null });
    const cash = s.cash;
    while (s.hour < 90 * 24) { s.hour++; billingTick(s); }
    expect(inv().status).toBe("draft");
    expect(inv().reminders).toEqual([]);
    expect(s.cash).toBe(cash);
  });

  it("are due 14 days after they are sent and roll when the money comes", () => {
    const { s, inv } = drafted();
    s.hour += 50;
    expect(sendInvoice(s, inv().id)).toEqual({ ok: true });
    expect(inv()).toMatchObject({ status: "open", issuedAt: s.hour, dueAt: s.hour + DUE_DAYS * 24 });
    expect(inv().payAt).toBeGreaterThan(s.hour);
    expect(s.activity.at(-1)).toMatchObject({ key: "activity.sendInvoice", params: { invoice: inv().number } });
    expect(sendInvoice(s, inv().id)).toEqual({ ok: false, error: "error.invoiceSent" });
  });
});

describe("bank transfers", () => {
  // A sent invoice of 12 whose money arrives on the next hour.
  const paying = (profile: Profile = "agency") => {
    const s = withServer(newGame(9));
    const c = addCustomer(s, "Müller Webdesign", profile, "prompt");
    addService(s, c, "domain", "mueller.de", 12, "year");
    tick(s);
    sendInvoice(s, s.invoices[0].id);
    Object.assign(s.invoices[0], { payStep: 0, payAt: s.hour + 1 });
    const bill = (hours: number) => { for (let h = 0; h < hours; h++) { s.hour++; billingTick(s); } };
    return { s, c, bill, inv: () => s.invoices[0], customer: () => s.customers.find((x) => x.id === c)! };
  };

  it("arrive when the customer pays and pay the invoice once matched", () => {
    const { s, bill, inv } = paying();
    const cash = s.cash;
    bill(1);
    expect(s.transfers).toHaveLength(1);
    expect(s.transfers[0]).toMatchObject({ hour: s.hour, from: "Müller Webdesign", amount: 12, invoiceId: null, forInvoice: inv().id });
    expect(s.cash).toBe(cash + 12);
    expect(inv().status).toBe("open");
    bill(30 * 24);
    expect(s.transfers).toHaveLength(1);
    expect(matchTransfer(s, s.transfers[0].id, inv().id)).toEqual({ ok: true });
    expect(inv()).toMatchObject({ status: "paid", paidAt: s.hour });
    expect(s.transfers[0]).toMatchObject({ invoiceId: inv().id, matchedAt: s.hour });
    expect(s.cash).toBe(cash + 12);
    expect(matchTransfer(s, s.transfers[0].id, inv().id)).toEqual({ ok: false, error: "error.transferMatched" });
  });

  it("book a short amount as a partial payment, and the reminder brings the rest", () => {
    const { s, bill, inv } = paying();
    bill(1);
    s.transfers[0].amount = 9.9;
    matchTransfer(s, s.transfers[0].id, inv().id);
    expect(inv()).toMatchObject({ status: "open", received: 9.9 });
    expect(owed(inv())).toBe(2.1);
    bill(DUE_DAYS * 24 + 7 * 24);
    expect(sendReminder(s, inv().id)).toEqual({ ok: true });
    expect(s.tickets.filter((t) => t.topic === "alreadyPaid")).toHaveLength(0);
    bill(10 * 24);
    expect(s.transfers[1]).toMatchObject({ amount: 2.1, reference: "books.ref.invoice", params: { number: inv().number } });
    matchTransfer(s, s.transfers[1].id, inv().id);
    expect(inv().status).toBe("paid");
  });

  it("settle a short amount in full when the player writes the difference off", () => {
    const { s, bill, inv } = paying();
    bill(1);
    s.transfers[0].amount = 11.95;
    matchTransfer(s, s.transfers[0].id, inv().id, true);
    expect(inv().status).toBe("paid");
  });

  it("pay the invoice from a larger amount and keep the rest as credit", () => {
    const { s, bill, inv, customer } = paying();
    bill(1);
    s.transfers[0].amount = 15;
    matchTransfer(s, s.transfers[0].id, inv().id);
    expect(inv().status).toBe("paid");
    expect(customer().credit).toBe(3);
  });

  it("make a reminder on a paid but unmatched invoice cost happiness and bring a billing ticket", () => {
    const { s, bill, inv, customer } = paying();
    bill(DUE_DAYS * 24 + 7 * 24);
    expect(inv().status).toBe("overdue");
    const happy = customer().happiness;
    expect(sendReminder(s, inv().id)).toEqual({ ok: true });
    expect(customer().happiness).toBe(happy - ALREADY_PAID_HAPPINESS);
    expect(s.tickets.filter((t) => t.kind === "billing" && t.topic === "alreadyPaid")).toHaveLength(1);
    expect(s.transfers).toHaveLength(1);
  });

  it("carry odd references and short amounts from private payers only now and then", () => {
    const refs = (profile: Profile) => {
      const s = withServer(newGame(11));
      for (let i = 0; i < 200; i++) addService(s, addCustomer(s, `Kim Roth ${i}`, profile, "prompt"), "domain", `kim${i}.de`, 9.9, "year");
      tick(s);
      for (const inv of s.invoices) { sendInvoice(s, inv.id); Object.assign(inv, { payStep: 0, payAt: s.hour + 1 }); }
      s.hour++;
      billingTick(s);
      return { bare: s.transfers.filter((t) => t.reference !== "books.ref.invoice").length, short: s.transfers.filter((t) => t.amount < 9.9).length };
    };
    const priv = refs("private"), big = refs("enterprise");
    expect(priv.bare).toBeGreaterThan(30);
    expect(priv.bare).toBeLessThan(90);
    expect(priv.short).toBeGreaterThan(10);
    expect(priv.short).toBeLessThan(55);
    expect(big.bare).toBeLessThan(8);
    expect(big.short).toBe(0);
  });

  it("leave invoices of old saves paying by themselves", () => {
    const s = withServer(newGame(9));
    addService(s, addCustomer(s, "Ada", "private", "prompt"), "domain", "ada.de", 12, "year");
    tick(s);
    const raw = JSON.parse(serialize(s));
    delete raw.transfers;
    Object.assign(raw.invoices[0], { status: "open", dueAt: s.hour + DUE_DAYS * 24, payStep: 0, payAt: s.hour + 5 });
    const old = deserialize(JSON.stringify(raw));
    expect(old.transfers).toEqual([]);
    const cash = old.cash;
    for (let h = 0; h < 6; h++) { old.hour++; billingTick(old); }
    expect(old.invoices[0].status).toBe("paid");
    expect(old.transfers).toEqual([]);
    expect(old.cash).toBe(cash + 12);
  });
});

describe("the Books app", () => {
  it("replaces Billing in saves that had it in the dock", () => {
    const s = newGame(9);
    expect(STARTER_APPS).not.toContain("Billing");
    const raw = JSON.parse(serialize(s));
    raw.installed = ["Browser", "Billing", "Customers"];
    const installed = deserialize(JSON.stringify(raw)).installed;
    expect(installed).toContain("Books");
    expect(installed).not.toContain("Billing");
  });
});
