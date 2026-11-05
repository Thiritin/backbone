// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { euro } from "../src/sim/00-core/money";
import { hourOf } from "../src/sim/00-core/time";
import { LIR_FEES } from "../src/sim/10-catalog/addresses";
import { ASN_FEE } from "../src/sim/10-catalog/network";
import { deskById } from "../src/sim/10-catalog/desks";
import { deskItem, subscriptionEntry } from "../src/sim/10-catalog/store";
import { PROVIDER_CABLE } from "../src/sim/10-catalog/uplinks";
import { datacenterById } from "../src/sim/20-world/datacenters";
import { SUPPLIER_NAMES, type Method, type SupplierId } from "../src/sim/46-finance/payables";
import type { GameState } from "../src/sim/50-state";
import { panelOf } from "../src/sim/60-infra/panels";
import { tick } from "../src/sim/88-tick/tick";
import { orderProviderCable } from "../src/sim/90-actions/connectivity";
import { subscribeDesk } from "../src/sim/90-actions/desk-install";
import { addLocation } from "../src/sim/90-actions/hardware";
import { methodsFor } from "../src/sim/90-actions/purchase";
import { startMethod } from "../src/ui/apps/browser/sites/shared/OrderDone";
import { HostedDeskSite } from "../src/ui/apps/browser/sites/desks/HostedDeskSite";
import { Properties } from "../src/ui/apps/locations/Properties";
import { NetworkTab } from "../src/ui/apps/locations/NetworkTab";
import { ProviderJack } from "../src/ui/apps/locations/ProviderJack";
import { Ripe } from "../src/ui/apps/network/Addresses";
import { useStore } from "../src/ui/store";
import { freeFloor, newGame, withCard } from "./fixtures";

afterEach(cleanup);
const g = () => useStore.getState().game;
const line = (amount: number) => [{ hour: 0, category: "", key: "", params: {}, amount: -amount }];
const method = (m: Method) => t(`purchase.method.${m}`);

function show<P extends object>(s: GameState, Screen: ComponentType<P & { game: GameState }>, props: P) {
  useStore.setState({ game: s, windows: [] });
  const View = () => <Screen {...props} game={useStore((x) => x.game)} />;
  return render(<View />);
}

// A banked company in a share at FR5 with a card, so transfer, on account and card are on offer.
function game(year = 2010): GameState {
  const s = withCard(freeFloor({ ...newGame(3), cash: 1e7 }));
  s.hour = hourOf(new Date(Date.UTC(year, 0, 1, 9)));
  s.unlocks = ["network"];
  return s;
}
function shareRack(s: GameState) {
  const r = addLocation(s, "equinox-fr5", "share", 8);
  if (!r.ok) throw new Error(r.error);
  s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
  return s.racks.find((x) => x.locationId === r.id)!;
}

// The open pay step offers exactly methodsFor, starts on an available method, and places the order with the one picked.
function payWith(supplier: SupplierId, name: string, amount: number, pick: Method, confirm = t("checkout.placeOrder")) {
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  const on = methodsFor(g(), supplier, line(amount), name);
  expect(radios.filter((r) => !r.disabled).map((r) => r.parentElement!.textContent)).toEqual(on.map(method));
  const start = radios.find((r) => r.checked)!;
  expect(start.disabled).toBe(false);
  expect(start.parentElement!.textContent).toBe(method(startMethod(g(), { supplier, lines: line(amount), name })!));
  fireEvent.click(screen.getByLabelText(method(pick)));
  fireEvent.click(screen.getByRole("button", { name: confirm }));
}

// The outcome names the payable's state and its button opens the document in Preview.
function opensDoc() {
  const p = g().payables.at(-1)!;
  expect(screen.getByText(t(p.paidAt !== null && p.doc !== "contract" ? "purchase.done.paid" : "purchase.done.ordered"), { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: t(`purchase.doc.${p.doc ?? "invoice"}`) }));
  expect(useStore.getState().windows.some((w) => w.app === "Preview")).toBe(true);
  return p;
}

describe("pay step in properties, network and desk screens", () => {
  it("rents an office section with the picked method", () => {
    const s = game();
    show(s, Properties, {});
    fireEvent.click(document.querySelector<HTMLButtonElement>(".prop-sec.free")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".prop-actions .btn.primary")!);
    const n = s.properties.length;
    payWith("landlord", SUPPLIER_NAMES.landlord!, 0, "card");
    expect(g().properties).toHaveLength(n + 1);
    expect(opensDoc()).toMatchObject({ supplier: "landlord", method: "card" });
  });

  it("joins the RIPE NCC on account", () => {
    const s = game();
    shareRack(s);
    show(s, Ripe, {});
    fireEvent.click(screen.getByRole("button", { name: t("misc.join") }));
    payWith("network", SUPPLIER_NAMES.network!, LIR_FEES.signup, "onAccount");
    expect(g().ips.lir).toBeTruthy();
    expect(opensDoc()).toMatchObject({ method: "onAccount", paidAt: null });
  });

  it("registers an AS number by transfer from the exchange card", () => {
    const s = game(), r = shareRack(s);
    show(s, NetworkTab, { loc: s.locations.find((l) => l.id === r.locationId)! });
    fireEvent.click(screen.getByRole("button", { name: t("locations-2.registerAsn", { fee: euro(ASN_FEE) }) }));
    payWith("network", SUPPLIER_NAMES.network!, ASN_FEE, "transfer");
    expect(g().network.asn).toBeTruthy();
    expect(opensDoc()).toMatchObject({ method: "transfer" });
  });

  it("orders a provider cable by card, links its order confirmation and bills it on completion with that card", () => {
    const s = game(), a = shareRack(s);
    shareRack(s);
    show(s, ProviderJack, { device: panelOf(s, a.id)!, port: 0 });
    fireEvent.click(document.querySelector<HTMLButtonElement>(".loc-connect .btn.primary")!);
    payWith("network", datacenterById("equinox-fr5").name, PROVIDER_CABLE.fee, "card");
    expect(g().providerCables).toMatchObject([{ method: "card" }]);
    expect(opensDoc()).toMatchObject({ doc: "contract", amount: 0, supplier: "network", name: datacenterById("equinox-fr5").name });
    const after = g();
    while (after.providerCables.length) tick(after);
    expect(after.payables.at(-1)).toMatchObject({ method: "card", amount: PROVIDER_CABLE.fee });
  });

  it("subscribes a hosted desk with the picked method and shows its invoice on the account page", () => {
    const s = game(2014);
    let url = "";
    show(s, HostedDeskSite, { id: "freshdusk" as const, path: "/signup", go: (u: string) => { url = u; } });
    fireEvent.click(screen.getByRole("button", { name: t("desk-sites.create") }));
    payWith("services", deskById("freshdusk")!.name, -subscriptionEntry(s, deskItem(deskById("freshdusk")!)).amount, "card");
    expect(url).toMatch(/\/account$/);
    cleanup();
    show(g(), HostedDeskSite, { id: "freshdusk" as const, path: "/account", go: () => {} });
    expect(opensDoc()).toMatchObject({ method: "card", supplier: "services" });
  });
});

describe("method on actions", () => {
  it("passes the method of a desk subscription and a provider cable order", () => {
    const s = game(2014);
    expect(subscribeDesk(s, "acme", "freshdusk", "transfer").ok).toBe(true);
    expect(s.payables.at(-1)).toMatchObject({ method: "transfer", paidAt: null });
    const a = shareRack(s), b = shareRack(s);
    expect(orderProviderCable(s, a.id, 0, b.id, 0, "card").ok).toBe(true);
    expect(orderProviderCable(s, a.id, 1, b.id, 1).ok).toBe(true);
    s.cash = 1e7;
    while (s.providerCables.length) tick(s);
    expect(s.payables.slice(-2).map((p) => p.method)).toEqual(["card", "transfer"]);
  });
});
