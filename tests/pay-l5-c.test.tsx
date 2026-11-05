// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { yearOf } from "../src/sim/00-core/time";
import { FLYER_NAME, FLYER_SIZES, flyerPrice } from "../src/sim/10-catalog/flyers";
import { modelById, OOB_PORT, oobPorts } from "../src/sim/10-catalog/hardware";
import { HARDWARE_SHOP, type Method, type SupplierId } from "../src/sim/46-finance/payables";
import { AD, JOB_BOARD, staffPrice } from "../src/sim/47-staff/staff";
import { device, type GameState } from "../src/sim/50-state";
import { AGENCY_TITLE } from "../src/sim/80-business/browser";
import { OWNED } from "../src/sim/80-business/marketing";
import { designQuote } from "../src/sim/80-business/website";
import { ATX_PRICE } from "../src/sim/60-infra/oob";
import { connect } from "../src/sim/90-actions/hardware";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { defaultMethod, methodsFor } from "../src/sim/90-actions/purchase";
import { AgencySite } from "../src/ui/apps/browser/sites/marketing/AgencySite";
import { FlyerlarmSite } from "../src/ui/apps/browser/sites/marketing/FlyerlarmSite";
import { RemoteCard } from "../src/ui/apps/locations/RemoteCard";
import { MarketingApp } from "../src/ui/apps/marketing/MarketingApp";
import { StaffApp } from "../src/ui/apps/staff/StaffApp";
import { useStore } from "../src/ui/store";
import { readyGame, settle, withCard } from "./fixtures";

const openApp = vi.fn();
const put = (s: GameState) => useStore.setState({ game: s, openApp });
const game = () => useStore.getState().game;
beforeEach(() => { openApp.mockClear(); sessionStorage.clear(); });
afterEach(cleanup);

const label = (m: Method) => t(`purchase.method.${m}`);
const rows = () => [...document.querySelectorAll<HTMLLabelElement>(".pay-methods label")];
const radio = (m: Method) => rows().find((l) => l.querySelector("span")!.textContent === label(m))!.querySelector("input")!;
const lines = (amount: number) => [{ hour: 0, category: "", key: "", params: {}, amount: -amount }];

// The enabled radios are exactly the methods methodsFor offers, and the checked one is the default when it is offered.
function offers(supplier: SupplierId, name: string, amount: number) {
  const s = game(), on = methodsFor(s, supplier, lines(amount), name), d = defaultMethod(s, name, lines(amount));
  expect(rows().filter((l) => !l.querySelector("input")!.disabled).map((l) => l.querySelector("span")!.textContent)).toEqual(on.map(label));
  const checked = rows().find((l) => l.querySelector("input")!.checked)!;
  expect(checked.querySelector("input")!.disabled).toBe(false);
  expect(checked.querySelector("span")!.textContent).toBe(label(on.includes(d) ? d : on[0]));
}

// Picks a method and runs the order; the new payable carries it and the outcome opens its document in Preview.
function orders(m: Method, click: () => void) {
  const n = game().payables.length;
  fireEvent.click(radio(m));
  act(click);
  const p = game().payables[n];
  expect(p.method).toBe(m);
  return p;
}
function opens(p: { id: string; paidAt: number | null }) {
  expect(screen.getByText(t(p.paidAt !== null ? "purchase.done.paid" : "purchase.done.ordered"), { exact: false })).toBeTruthy();
  fireEvent.click(document.querySelector(".order-done button")!);
  expect(openApp).toHaveBeenCalledWith("Preview", { kind: "payable", id: p.id });
}

const banked = () => withCard(readyGame(3));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: t("checkout.placeOrder") }));

describe("agency quote", () => {
  const Live = () => <AgencySite game={useStore((s) => s.game)} path="/quote" go={() => {}} />;

  it("offers only cash before the company banks", () => {
    const s = readyGame(3);
    s.bank = null;
    put(s);
    render(<Live />);
    fireEvent.click(screen.getByText(t("agency.quote.orderNew")));
    offers("services", AGENCY_TITLE, designQuote(s));
    expect(rows().map((l) => l.querySelector("span")!.textContent)).toEqual([label("cash")]);
    expect(screen.getByRole("button", { name: t("payD.pay") })).toBeTruthy();
  });

  it("passes the chosen method to the redesign and links its document", () => {
    const s = banked();
    setUpChannel(s, "website");
    put(s);
    render(<Live />);
    fireEvent.click(screen.getByText(t("agency.quote.orderRedo")));
    offers("services", AGENCY_TITLE, designQuote(s));
    opens(orders("card", confirm));
  });
});

describe("marketing channels", () => {
  it("sets up a channel with the chosen method", () => {
    const s = banked();
    s.unlocks = [...s.unlocks, "marketing"];
    setUpChannel(s, "website");
    put(s);
    render(<MarketingApp />);
    fireEvent.click(screen.getAllByText(t("marketing.setUp")).find((b) => b.tagName === "BUTTON" && !(b as HTMLButtonElement).disabled)!);
    offers("services", AGENCY_TITLE, Math.max(...Object.values(OWNED).map((d) => d.setup)));
    opens(orders("transfer", confirm));
  });
});

describe("staff job ad", () => {
  it("posts an ad with the chosen method", () => {
    const s = banked();
    put(s);
    render(<StaffApp />);
    fireEvent.click(screen.getAllByText(t("misc.jobMarket"))[0]);
    const year = yearOf(s.hour);
    fireEvent.click(screen.getByText(t("misc.standardAd")));
    offers("services", JOB_BOARD, staffPrice(AD.standard.price, year));
    opens(orders("onAccount", confirm));
  });
});

describe("flyer order", () => {
  it("orders with the chosen method and opens the orders page with its document", () => {
    const s = banked(), go = vi.fn();
    put(s);
    render(<FlyerlarmSite game={useStore.getState().game} path="/flyers" go={go} />);
    fireEvent.click(screen.getByText(t("flyers.order")));
    offers("services", FLYER_NAME, flyerPrice(FLYER_SIZES[1], yearOf(s.hour)));
    const p = orders("card", confirm);
    expect(p.name).toBe(FLYER_NAME);
    expect(go).toHaveBeenCalledWith(expect.stringContaining(`/orders?doc=${p.id}`));
    cleanup();
    render(<FlyerlarmSite game={game()} path={`/orders?doc=${p.id}`} go={go} />);
    opens(p);
  });
});

describe("ATX adapter", () => {
  // dev3 behind an IP-KVN 8 that switches its console only, as in the remote access suite.
  const kvm = (s: GameState) => {
    s.devices.push(device("dev93", "ipkvn-8", "Avoscent", "rack2", 3, null, "fra1-dev93", modelById("ipkvn-8").price));
    const oob = (id: string, kind: string) => OOB_PORT + oobPorts(modelById(s.devices.find((d) => d.id === id)!.model)).indexOf(kind as never);
    connect(s, { device: "dev93", port: oob("dev93", "net") }, { device: "dev4", port: 1 });
    connect(s, { device: "dev93", port: oob("dev93", "kvm") }, { device: "dev3", port: oob("dev3", "console") });
    settle(s);
    return s;
  };
  const Live = () => { const g = useStore((s) => s.game); return <RemoteCard game={g} device={g.devices.find((d) => d.id === "dev3")!} />; };

  it("fits the adapter with the chosen method", () => {
    put(kvm(banked()));
    render(<Live />);
    fireEvent.click(screen.getByText("ATX", { exact: false }));
    offers("hardware", HARDWARE_SHOP, ATX_PRICE);
    opens(orders("card", confirm));
  });
});
