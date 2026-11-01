import { describe, expect, it } from "vitest";
import { stepsDone } from "../src/sim/30-market/manual";
import { orderLead } from "../src/sim/30-market/orders";
import { can } from "../src/sim/80-business/bookkeeping";
import { tick } from "../src/sim/88-tick/tick";
import { installBooks, uninstallBooks, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { quoteOrder } from "../src/sim/90-actions/orders";
import { readyGame } from "./fixtures";

describe("capabilities", () => {
  it("follow the installed programs", () => {
    const s = readyGame(9);
    s.cash = 50_000;
    s.books = { vendor: null, installedAt: 0, edition: null, seats: 0 };
    s.shop = { ...s.shop, variant: null };
    expect(can(s, "customers")).toBe(false);
    s.shop = { ...s.shop, variant: "whmCache" };
    expect(["customers", "invoices", "payments", "reminders"].every((c) => can(s, c as never))).toBe(true);
    expect(can(s, "payables") || can(s, "quotes") || can(s, "tax")).toBe(false);
    installBooks(s, "lexwear");
    expect(can(s, "quotes") && can(s, "payables") && can(s, "statement")).toBe(true);
    expect(can(s, "tax")).toBe(false);
    upgradeBooks(s, "financial-office-pro");
    expect(can(s, "tax") && can(s, "statistics")).toBe(true);
  });

  it("leave Books off the desktop without a program, and the ticket keeps its plain quote step", () => {
    const s = readyGame(9);
    s.cash = 50_000;
    installBooks(s, "lexwear");
    expect(s.installed).toContain("Books");
    expect(uninstallBooks(s).ok).toBe(true);
    expect(s.installed).not.toContain("Books");
    expect(s.books.vendor).toBeNull();
    expect(uninstallBooks(s).ok).toBe(false);
    expect(can(s, "quotes")).toBe(false);
    const r = orderLead(s, "smallBiz", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
    s.sales.requests = s.sales.requests.map((x) => (x.id === r.id ? { ...x, budget: 100, owned: false } : x));
    expect(quoteOrder(s, r.ticketId!, 10, 0)).toMatchObject({ ok: true });
    for (let i = 0; i < 60 && !stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote; i++) tick(s);
    expect(stepsDone(s, s.sales.requests.find((x) => x.id === r.id)!).quote).toBe(true);
  });
});
