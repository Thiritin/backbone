import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { DUE_DAYS, billingTick } from "../src/sim/45-billing/billing";
import { tick } from "../src/sim/88-tick/tick";
import { sendInvoice } from "../src/sim/90-actions/billing";
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
