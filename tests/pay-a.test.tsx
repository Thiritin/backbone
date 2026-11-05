// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { euro } from "../src/sim/00-core/money";
import { yearOf } from "../src/sim/00-core/time";
import { storeItem, subscriptionEntry } from "../src/sim/10-catalog/store";
import { leaseOffers } from "../src/sim/10-catalog/leasing";
import { openAccount } from "../src/sim/46-finance/bank";
import { HARDWARE_SHOP, type Method } from "../src/sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../src/sim/50-state";
import { keysOf, vendorName } from "../src/sim/80-business/vendor-shop";
import { unitPrice, type CartLine } from "../src/sim/90-actions/hardware";
import { buyLicence } from "../src/sim/90-actions/licences";
import { methodsFor, placeOrder } from "../src/sim/90-actions/purchase";
import { install } from "../src/sim/90-actions/store";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { Checkout } from "../src/ui/apps/browser/sites/shared/Checkout";
import { feeLine, PayButton } from "../src/ui/apps/browser/sites/shared/PayButton";
import { Cart } from "../src/ui/apps/shop/Cart";
import { useStore } from "../src/ui/store";
import { newGame, orderDetails, withCard } from "./fixtures";

afterEach(cleanup);
const banked = (): GameState => {
  const s = newGame(2);
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 20_000;
  return s;
};
const METHODS = ["transfer", "onAccount", "card", "debit"] as const;
const radio = (label: string) => screen.getByRole("radio", { name: (n) => n.startsWith(label) });
const opened = () => {
  const openApp = vi.fn();
  useStore.setState({ openApp });
  return openApp;
};

describe("hardware cart", () => {
  const SYSKO: CartLine = { model: "sw-8", brand: "Sysko", qty: 1 };

  it("lists the methods methodsFor allows, starts on an offered one and pays by it with a link to the invoice", () => {
    const s = banked(), total = unitPrice(SYSKO, yearOf(s.hour)), openApp = opened();
    useStore.setState({ game: s, cart: [SYSKO] });
    render(<Cart />);
    const on = methodsFor(s, "hardware", feeLine(s, total), HARDWARE_SHOP);
    for (const m of METHODS) expect((radio(t(`purchase.method.${m}`)) as HTMLButtonElement).disabled).toBe(!on.includes(m));
    expect(radio(t("purchase.method.transfer")).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: t("shop.pay", { price: euro(total) }) }));
    const doc = useStore.getState().game.payables.at(-1)!;
    expect(doc.method).toBe("transfer");
    expect(screen.getByRole("status").textContent).toContain(t("payA.ordered"));
    fireEvent.click(screen.getByRole("button", { name: t("purchase.doc.invoice") }));
    expect(openApp).toHaveBeenCalledWith("Preview", { kind: "payable", id: doc.id });
  });

  it("never starts a card-only cart on a card the company does not have", () => {
    const s = banked(), line: CartLine = { model: "g1-compute", brand: "SuperMacro", qty: 1 };
    useStore.setState({ game: s, cart: [line] });
    const { container } = render(<Cart />);
    const card = radio(t("purchase.method.card")) as HTMLButtonElement, transfer = radio(t("purchase.method.transfer")) as HTMLButtonElement;
    expect(card.disabled && transfer.disabled).toBe(true);
    expect(transfer.textContent).toContain(t("payA.off.cardOnly"));
    expect(card.getAttribute("aria-checked")).toBe("false");
    const offers = leaseOffers(s, unitPrice(line, yearOf(s.hour)));
    expect(container.querySelector<HTMLButtonElement>(".shop-cart-foot .btn.primary")!.disabled).toBe(!offers.length);
  });
});

describe("buy button", () => {
  it("asks for the method, passes the chosen one to the action and links the invoice", () => {
    const s = banked(), item = storeItem("keepassive")!, amount = -subscriptionEntry(s, item).amount, openApp = opened();
    useStore.setState({ game: s });
    const run = vi.fn((m?: Method) => useStore.getState().act(install, "keepassive", m));
    render(<PayButton className="b" supplier="pear" name="Pear" amount={amount} run={run}>Get</PayButton>);
    fireEvent.click(screen.getByRole("button", { name: "Get" }));
    const on = methodsFor(s, "pear", feeLine(s, amount), "Pear");
    for (const m of METHODS) expect((screen.getByLabelText(new RegExp(t(`purchase.method.${m}`))) as HTMLInputElement).disabled).toBe(!on.includes(m));
    expect((screen.getByLabelText(new RegExp(t("purchase.method.transfer"))) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText(new RegExp(t("purchase.method.onAccount"))));
    fireEvent.click(screen.getAllByRole("button", { name: "Get" }).at(-1)!);
    expect(run).toHaveBeenCalledWith("onAccount");
    const doc = useStore.getState().game.payables.at(-1)!;
    expect(doc.method).toBe("onAccount");
    fireEvent.click(screen.getByRole("button", { name: t("purchase.doc.invoice") }));
    expect(openApp).toHaveBeenCalledWith("Preview", { kind: "payable", id: doc.id });
  });

  it("runs a free purchase at once", () => {
    useStore.setState({ game: banked() });
    const run = vi.fn(() => ({ ok: true as const }));
    render(<PayButton className="b" supplier="shopVendor" name="x" amount={0} run={run}>Get</PayButton>);
    fireEvent.click(screen.getByRole("button", { name: "Get" }));
    expect(run).toHaveBeenCalledWith();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("checkout with an offer", () => {
  it("starts on the supplier's default method and links the document of the placed order", () => {
    const s = withCard(banked()), vendor = vendorName("pleskit"), lines: LedgerEntry[] = feeLine(s, 50), kinds: string[] = [];
    s.bank = { ...s.bank!, cards: [vendor] };
    useStore.setState({ game: s });
    const place = (d: { payment: { kind: string } }) => {
      const g = structuredClone(useStore.getState().game);
      const r = placeOrder(g, { supplier: "software", name: vendor, lines, method: d.payment.kind as Method });
      useStore.setState({ game: g });
      kinds.push(d.payment.kind);
      return r;
    };
    const { container } = render(<Checkout game={s} btn="b" offer={{ supplier: "software", lines, name: vendor }} place={place} confirm={() => ({ bank: null, next: "" })} />);
    fireEvent.submit(container.querySelector("form")!);
    expect((screen.getByRole("radio", { name: (n) => n.startsWith(t("purchase.method.card")) }) as HTMLInputElement).checked).toBe(true);
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.click(screen.getByRole("button", { name: t("checkout.placeOrder") }));
    expect(kinds).toEqual(["card"]);
    expect(screen.getByRole("status").textContent).toContain(t("payA.paid"));
  });
});

describe("chosen methods in the sim", () => {
  it("books a Pear install and a shop module by the method passed", () => {
    const s = banked();
    s.shop = { ...s.shop, variant: "modemBill" };
    expect(install(s, "keepassive", "onAccount").ok).toBe(true);
    expect(buyLicence(s, "shop-link", "onAccount").ok).toBe(true);
    expect(s.payables.map((p) => p.method)).toEqual(["onAccount", "onAccount"]);
  });

  it("ships licence keys at once for an order on account", () => {
    const s = withCard(Object.assign(banked(), { cash: 10_000 }));
    addToCart(s, "pleskit", "webAdmin");
    const r = checkout(s, "pleskit.com", orderDetails(s, "transfer"), "onAccount");
    expect(r.ok).toBe(true);
    const p = s.payables.at(-1)!;
    expect([p.method, p.paidAt, p.keys]).toEqual(["onAccount", null, undefined]);
    expect(keysOf(s, "pleskit.com").length).toBeGreaterThan(0);
  });
});
