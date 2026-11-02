import { describe, expect, it } from "vitest";
import { LARGE, MEDIUM } from "../src/sim/10-catalog/bookkeeping";
import { billingTick, isUnpaid } from "../src/sim/45-billing/billing";
import { tick } from "../src/sim/88-tick/tick";
import { cancelDraft, markPaid, reopenInvoice, sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { withServer, newGame } from "./fixtures";

// A drafted domain invoice of 12 for one customer.
const drafted = () => {
  const s = withServer(newGame(9));
  const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
  addService(s, c, "domain", "mueller.de", 12, "year");
  tick(s);
  return { s, inv: () => s.invoices[0] };
};

describe("invoice status by hand", () => {
  it("drops a draft and refuses anything sent", () => {
    const { s, inv } = drafted();
    const id = inv().id;
    expect(cancelDraft(s, id)).toEqual({ ok: true });
    expect(s.invoices.find((i) => i.id === id)).toBeUndefined();
    expect(cancelDraft(s, id)).toEqual({ ok: false, error: "error.invoiceSent" });
  });

  it("marks a sent invoice paid without money and reopens it", () => {
    const { s, inv } = drafted();
    sendInvoice(s, inv().id);
    const cash = s.cash;
    expect(markPaid(s, inv().id)).toEqual({ ok: true });
    expect(inv()).toMatchObject({ status: "paid", paidAt: s.hour, payAt: null });
    expect(s.cash).toBe(cash);
    expect(markPaid(s, inv().id)).toEqual({ ok: false, error: "error.invoiceSettled" });
    expect(reopenInvoice(s, inv().id)).toEqual({ ok: true });
    expect(inv()).toMatchObject({ status: "open", paidAt: null });
    expect(isUnpaid(inv())).toBe(true);
    s.hour = inv().dueAt + 1;
    markPaid(s, inv().id);
    reopenInvoice(s, inv().id);
    expect(inv().status).toBe("overdue");
  });

  it("books the chosen transfer and keeps a booked invoice closed", () => {
    const { s, inv } = drafted();
    sendInvoice(s, inv().id);
    Object.assign(inv(), { payStep: 0, payAt: s.hour + 1 });
    s.hour++; billingTick(s);
    expect(s.transfers).toHaveLength(1);
    expect(markPaid(s, inv().id, s.transfers[0].id)).toEqual({ ok: true });
    expect(inv().status).toBe("paid");
    expect(s.transfers[0].matchedAt).toBe(s.hour);
    expect(reopenInvoice(s, inv().id)).toEqual({ ok: false, error: "error.transferChanged" });
  });

  it("sells the dunning levels overview with the top editions only", () => {
    expect(LARGE).toContain("dunning");
    expect(MEDIUM).not.toContain("dunning");
  });
});
