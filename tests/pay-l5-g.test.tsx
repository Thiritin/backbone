// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { PROFILE_IDS } from "../src/sim/80-business/marketing";
import { joinLir, lirError } from "../src/sim/90-actions/addresses";
import { asnError, exchangeError, registerAsn } from "../src/sim/90-actions/network";
import { methodsFor } from "../src/sim/90-actions/purchase";
import { PayStep } from "../src/ui/apps/browser/sites/shared/PayStep";
import { MarketApp } from "../src/ui/apps/market/MarketApp";
import { Ripe } from "../src/ui/apps/network/Addresses";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

const openApp = vi.fn();
const put = (s: GameState) => useStore.setState({ game: s, openApp, banners: [] });
const game = () => useStore.getState().game;
const confirm = () => document.querySelector<HTMLButtonElement>(".pay-step-buttons .primary")!;
const checked = () => document.querySelector<HTMLInputElement>(".pay-methods input:checked")!.closest("label")!.querySelector("span")!.textContent;
const banked = (seed: number) => {
  const s = readyGame(seed);
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 50_000;
  return s;
};
beforeEach(() => { openApp.mockClear(); sessionStorage.clear(); });
afterEach(cleanup);

describe("purchase checks", () => {
  it("report the error the action returns before any payment", () => {
    const s = banked(40);
    s.unlocks = s.unlocks.filter((u) => u !== "network");
    expect(asnError(s)).toBe("error.needsNetwork");
    expect(registerAsn(s)).toEqual({ ok: false, error: "error.needsNetwork" });
    s.unlocks.push("network");
    expect(asnError(s)).toBeNull();
    expect(exchangeError(s, "nope")).toBe("error.noExchange");
  });
});

describe("pay step outcomes", () => {
  it("names the reason and keeps confirm off for a purchase known to fail", () => {
    const s = banked(41);
    s.locations = s.locations.filter((l) => !l.dc);
    put(s);
    expect(lirError(s)).toBe("error.lirNeedsDatacenter");
    render(<Ripe game={s} />);
    fireEvent.click(screen.getByRole("button", { name: t("misc.join") }));
    expect(screen.getByRole("alert").textContent).toBe(t("error.lirNeedsDatacenter"));
    expect(confirm().disabled).toBe(true);
  });

  it("shows a failed order inline without a notification", () => {
    const s = banked(42);
    s.locations = s.locations.filter((l) => !l.dc);
    put(s);
    const buy = { supplier: "registry" as const, name: "RIPE NCC", amount: 100, run: () => useStore.getState().act(joinLir) };
    render(<PayStep game={s} buy={buy} onClose={() => {}} />);
    act(() => confirm().click());
    expect(screen.getByRole("alert").textContent).toBe(t("error.lirNeedsDatacenter"));
    expect(useStore.getState().banners).toEqual([]);
  });

  it("names the method it switched to when the shown one goes away", () => {
    const s = banked(43), name = "Engel & Vogel", lines = [{ hour: 0, category: "", key: "", params: {}, amount: -100 }];
    s.bank!.mandates = [name];
    expect(methodsFor(s, "landlord", lines, name)).toContain("debit");
    const buy = { supplier: "landlord" as const, name, amount: 100, run: () => ({ ok: true as const }) };
    const { rerender } = render(<PayStep game={s} buy={buy} onClose={() => {}} />);
    expect(checked()).toBe(t("purchase.method.debit"));
    expect(screen.queryByRole("status")).toBeNull();
    const after = structuredClone(s);
    after.bank!.mandates = [];
    rerender(<PayStep game={after} buy={buy} onClose={() => {}} />);
    expect(checked()).not.toBe(t("purchase.method.debit"));
    expect(screen.getByRole("status").textContent).toBe(t("payG.methodNow", { method: checked()! }));
  });

  it("keeps the study's outcome once its card shows the study", () => {
    put(banked(44));
    render(<MarketApp />);
    fireEvent.click(screen.getByRole("button", { name: (n) => n.startsWith(t("misc1.market.profiles")) }));
    fireEvent.click(screen.getAllByRole("button", { name: t("misc1.market.buyStudy") })[0]);
    act(() => confirm().click());
    expect(game().marketing.studies).toContain(PROFILE_IDS[0]);
    fireEvent.click(document.querySelector(".order-done button")!);
    expect(openApp).toHaveBeenCalledWith("Preview", { kind: "payable", id: game().payables.at(-1)!.id });
  });
});
