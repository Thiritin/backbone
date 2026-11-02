import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { issueInvoice } from "../src/sim/30-market/manual";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame } from "../src/sim/50-state";
import { setBillingRules } from "../src/sim/90-actions/billing";
import { buyBooks, finishBooksSetup } from "../src/sim/90-actions/bookkeeping";
import { finishShopSetup } from "../src/sim/90-actions/portal";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { openShop, readyGame } from "./fixtures";

describe("setup wizard", () => {
  it("runs after a Books program is set up and stays done once closed", () => {
    const s = newGame(31);
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    s.cash = 5_000;
    s.bank = openAccount(s, "sparklasse");
    expect(finishBooksSetup(s)).toEqual({ ok: false, error: "error.booksNotDownloaded" });
    expect(buyBooks(s, "collmix", "basic")).toEqual({ ok: true });
    expect(s.books.setupDone).toBe(false);
    expect(finishBooksSetup(s)).toEqual({ ok: true });
    expect(deserialize(serialize(s)).books.setupDone).toBe(true);
  });

  it("numbers invoices in the chosen format for Books and the shop", () => {
    const s = readyGame(7);
    s.hour = hourOf(new Date(Date.UTC(2006, 10, 2, 10)));
    const c = addCustomer(s, "Erika", "smallBiz");
    const n = s.invoices.length + 1;
    expect(issueInvoice(s, c, []).number).toBe(`2006-${String(n).padStart(4, "0")}`);
    expect(setBillingRules(s, { numbering: "month" })).toEqual({ ok: true });
    expect(issueInvoice(s, c, []).number).toBe(`2006-11-${String(n + 1).padStart(4, "0")}`);
    setBillingRules(s, { numbering: "plain" });
    expect(issueInvoice(s, c, []).number).toBe(String(10000 + n + 2));
    expect(setBillingRules(s, { numbering: "roman" as never })).toEqual({ ok: false, error: "error.billingRule" });
  });

  it("runs again for each shop system and old saves load with numbering by year", () => {
    const s = openShop(readyGame(7));
    expect(s.shop.setupDone).toBe(false);
    expect(finishShopSetup(s)).toEqual({ ok: true });
    openShop(s, "blessta");
    expect(s.shop.setupDone).toBe(false);
    const raw = JSON.parse(serialize(s));
    delete raw.billingRules.numbering;
    delete raw.books.setupDone;
    const back = deserialize(JSON.stringify(raw));
    expect(back.billingRules.numbering).toBe("year");
    expect(back.books.setupDone).toBeUndefined();
  });
});
