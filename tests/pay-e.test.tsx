// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { BOOKS_VENDORS } from "../src/sim/10-catalog/bookkeeping";
import { PROFILE_IDS } from "../src/sim/80-business/marketing";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { buyBooks } from "../src/sim/90-actions/bookkeeping";
import { addLocation, buyCircuit, buyDevice, buyRack, CIRCUIT_PRICE, orderCrossConnect } from "../src/sim/90-actions/hardware";
import { buyStudy } from "../src/sim/90-actions/market";
import { buyModule } from "../src/sim/90-actions/shop";
import { PayStep } from "../src/ui/apps/browser/sites/shared/PayStep";
import { freeFloor, newGame, withCard } from "./fixtures";
import { shopGame } from "./portal-helpers";

afterEach(cleanup);
const banked = (s = newGame(5)): GameState => {
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 50_000;
  return s;
};
const radio = (label: string) => screen.getByRole("radio", { name: (n) => n.startsWith(label) }) as HTMLInputElement;
const last = (s: GameState) => s.payables.at(-1)!;

describe("pay step", () => {
  it("turns cash off with its reason while the cash is short of the total", () => {
    const s = newGame(5);
    s.bank = null;
    s.cash = 50;
    render(<PayStep game={s} buy={{ supplier: "hardware", name: "Alternatte", amount: 100, run: () => ({ ok: true }) }} onClose={() => {}} />);
    expect(radio(t("purchase.method.cash")).disabled).toBe(true);
    expect(screen.getByText(t("payE.off.noCash"))).toBeTruthy();
    expect((screen.getByRole("button", { name: t("checkout.placeOrder") }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers cash that covers the total", () => {
    const s = newGame(5);
    s.bank = null;
    s.cash = 500;
    render(<PayStep game={s} buy={{ supplier: "hardware", name: "Alternatte", amount: 100, run: () => ({ ok: true }) }} onClose={() => {}} />);
    expect(radio(t("purchase.method.cash")).checked).toBe(true);
    expect(screen.queryByText(t("payE.off.noCash"))).toBeNull();
  });

  it("shows a failed purchase in the step", () => {
    render(<PayStep game={banked()} buy={{ supplier: "hardware", name: "Alternatte", amount: 100, run: () => ({ ok: false, error: "error.cardLimit" }) }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: t("checkout.placeOrder") }));
    expect(screen.getByRole("alert").textContent).toBe(t("error.cardLimit"));
    expect(screen.getByRole("button", { name: t("checkout.placeOrder") })).toBeTruthy();
  });
});

describe("purchase actions take the picked method", () => {
  it("bills a basement circuit by card and refuses it over the card limit", () => {
    const s = withCard(banked(), 100);
    const loc = s.locations.find((l) => l.space === "basement")!.id;
    expect(buyCircuit(s, loc, "card")).toEqual({ ok: false, error: "error.cardLimit" });
    expect(s.locations.find((l) => l.id === loc)!.extraCircuit).toBe(false);
    s.bank!.card!.limit = 10_000;
    expect(buyCircuit(s, loc, "card").ok).toBe(true);
    expect(last(s)).toMatchObject({ method: "card", amount: CIRCUIT_PRICE });
  });

  it("bills a floor rack, a cross-connect and a spare part by the picked method", () => {
    const s = freeFloor(withCard(banked()));
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 15)));
    const r = addLocation(s, "equinox-fr5", "share", 2);
    if (!r.ok) throw new Error(r.error);
    const cage = addLocation(s, "equinox-fr5", "cage", 4);
    if (!cage.ok) throw new Error(cage.error);
    expect(buyRack(s, cage.id!, "rack-42", 1, "card").ok).toBe(true);
    expect(last(s).method).toBe("card");
    expect(orderCrossConnect(s, s.contracts[0].id, "cogentle", undefined, "card").ok).toBe(true);
    expect(last(s)).toMatchObject({ method: "card", name: "Equinox FR5" });
    expect(buyDevice(s, "g1-compute", "Dwell", 1, cage.id!, {}, "card").ok).toBe(true);
    expect(last(s).method).toBe("card");
  });

  it("bills a market study, a shop module and a bookkeeping licence by the picked method", () => {
    const s = withCard(banked());
    expect(buyStudy(s, PROFILE_IDS[0], "card").ok).toBe(true);
    expect(last(s).method).toBe("card");
    const shop = withCard(banked(shopGame("ubersmyth", 2007)));
    const panel = shop.clusters.find((c) => c.kind === "panel" && c.panel)!;
    expect(buyModule(shop, panel.panel!, "card").ok).toBe(true);
    expect(last(shop).method).toBe("card");
    const b = banked();
    const v = BOOKS_VENDORS.find((x) => x.deployment === "desktop" && x.from <= 2005 && x.editions[0].price > 0)!;
    expect(buyBooks(b, v.id, v.editions[0].id, "transfer").ok).toBe(true);
    expect(last(b)).toMatchObject({ method: "transfer", name: v.name });
  });
});
