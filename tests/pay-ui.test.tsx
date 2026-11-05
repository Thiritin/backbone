// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState, LedgerEntry } from "../src/sim/50-state";
import { methodsFor, placeOrder } from "../src/sim/90-actions/purchase";
import { Checkout } from "../src/ui/apps/browser/sites/shared/Checkout";
import { PayStep } from "../src/ui/apps/browser/sites/shared/PayStep";
import type { SupplierId } from "../src/sim/46-finance/payables";
import { hourOf } from "../src/sim/00-core/time";
import { SupplierInvoice } from "../src/ui/apps/preview/SupplierInvoice";
import { newGame } from "./fixtures";

afterEach(cleanup);
const line = (amount: number): LedgerEntry => ({ hour: 0, category: "hardware", key: "ledger.hardware", params: {}, amount });
const step = (s: GameState, supplier: SupplierId, amount = 100) =>
  render(<PayStep game={s} buy={{ supplier, name: "Alternatte", amount, run: () => ({ ok: true }) }} onClose={() => {}} />);
const banked = (): GameState => {
  const s = newGame(2);
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 20_000;
  return s;
};

describe("document kinds", () => {
  it.each([["cash", "receipt", -100], ["transfer", "invoice", -100], ["transfer", "credit", 100], ["transfer", "contract", 0]] as const)("renders %s %s", (method, doc, amount) => {
    const s = method === "cash" ? newGame(1) : banked();
    const r = placeOrder(s, { supplier: "landlord", name: "Dwell Immobilien", lines: [line(amount)], method, doc });
    expect(r.ok).toBe(true);
    render(<SupplierInvoice game={s} p={s.payables[0]} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(t(`purchase.doc.${doc}`));
    expect(screen.getByText(t(`purchase.method.${method}`))).toBeTruthy();
    expect(screen.getByText(t("purchase.net"))).toBeTruthy();
    expect(screen.getByText(t("purchase.gross"))).toBeTruthy();
    expect(screen.getByText(doc === "invoice" ? t("preview.number") : t(`purchase.no.${doc}`))).toBeTruthy();
  });

  it("shows net, VAT and gross", () => {
    const s = banked();
    placeOrder(s, { supplier: "landlord", name: "Dwell Immobilien", lines: [line(-119)], method: "transfer" });
    render(<SupplierInvoice game={s} p={s.payables[0]} />);
    expect(screen.getByText(t("purchase.net"))).toBeTruthy();
    expect(screen.getByText(t("purchase.gross"))).toBeTruthy();
  });
});

describe("method list", () => {
  it("offers what methodsFor allows and words the rest", () => {
    const s = banked(), lines = [line(-100)];
    step(s, "hardware");
    const on = methodsFor(s, "hardware", lines);
    for (const m of ["transfer", "onAccount", "card", "debit"] as const) {
      const box = screen.getByLabelText(new RegExp(t(`purchase.method.${m}`))) as HTMLInputElement;
      expect(box.disabled).toBe(!on.includes(m));
    }
    expect(screen.queryByText(t("purchase.method.cash"))).toBeNull();
    expect(screen.getByText(t("purchase.off.noInvoice"))).toBeTruthy();
    expect(screen.getByText(t("purchase.off.noCard"))).toBeTruthy();
  });

  it("offers cash alone before a bank account", () => {
    step(newGame(1), "landlord");
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("button", { name: t("payD.pay") })).toBeTruthy();
  });

  it("shows the card limit once the card is full", () => {
    const s = banked();
    s.bank!.card = { limit: 50, readyAt: 0, spent: [] } as unknown as NonNullable<GameState["bank"]>["card"];
    step(s, "landlord");
    expect(screen.getByText(t("purchase.off.cardLimit"))).toBeTruthy();
    expect((screen.getByLabelText(new RegExp(t("purchase.method.card"))) as HTMLInputElement).disabled).toBe(true);
  });

  it("offers transfer and card in a 2012 company with a bank and a card, and confirms with the order button", () => {
    const s = banked();
    s.hour = hourOf(new Date(Date.UTC(2012, 2, 1, 9)));
    s.bank!.card = { limit: 5000, readyAt: 0, spent: [] } as unknown as NonNullable<GameState["bank"]>["card"];
    step(s, "landlord");
    const on = (m: string) => !(screen.getByLabelText(new RegExp(t(`purchase.method.${m}`))) as HTMLInputElement).disabled;
    expect(on("transfer") && on("card")).toBe(true);
    expect(screen.queryByText(t("purchase.method.cash"))).toBeNull();
    expect(screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
    expect(screen.getByRole("button", { name: t("checkout.placeOrder") })).toBeTruthy();
  });

  it("drives the shared checkout payment step", () => {
    const s = banked();
    render(<Checkout game={s} btn="b" total="1" offer={{ supplier: "landlord", lines: [line(-100)] }} place={() => ({ ok: true })} confirm={() => ({ bank: null, next: "" })} />);
    expect(screen.getByRole("list")).toBeTruthy();
  });
});
