// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState, LedgerEntry } from "../src/sim/50-state";
import { methodsFor, placeOrder } from "../src/sim/90-actions/purchase";
import { Checkout } from "../src/ui/apps/browser/sites/shared/Checkout";
import { PayMethods } from "../src/ui/apps/browser/sites/shared/PayMethods";
import { SupplierInvoice } from "../src/ui/apps/preview/SupplierInvoice";
import { newGame } from "./fixtures";

afterEach(cleanup);
const line = (amount: number): LedgerEntry => ({ hour: 0, category: "hardware", key: "ledger.hardware", params: {}, amount });
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
    render(<PayMethods game={s} supplier="hardware" lines={lines} value="transfer" onChange={() => {}} />);
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
    render(<PayMethods game={newGame(1)} supplier="landlord" lines={[line(-100)]} value="cash" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("shows the card limit once the card is full", () => {
    const s = banked();
    s.bank!.card = { limit: 50, readyAt: 0, spent: [] } as unknown as NonNullable<GameState["bank"]>["card"];
    render(<PayMethods game={s} supplier="landlord" lines={[line(-100)]} value="transfer" onChange={() => {}} />);
    expect(screen.getByText(t("purchase.off.cardLimit"))).toBeTruthy();
  });

  it("drives the shared checkout payment step", () => {
    const s = banked();
    render(<Checkout game={s} btn="b" total="1" offer={{ supplier: "landlord", lines: [line(-100)] }} place={() => ({ ok: true })} confirm={() => ({ bank: null, next: "" })} />);
    expect(screen.getByRole("list")).toBeTruthy();
  });
});
