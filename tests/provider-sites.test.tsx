// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { DATACENTERS, PROVIDERS } from "../src/sim/20-world/datacenters";
import { openAccount } from "../src/sim/46-finance/bank";
import { displayHost, orderUrl, providerDomain, resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { contractNo, PortalShell } from "../src/ui/apps/browser/sites/providers/portal/Portal";
import { OrderForm, routeOf } from "../src/ui/apps/browser/sites/providers/ProviderSite";
import { useStore } from "../src/ui/store";
import { ProviderSite } from "../src/ui/apps/browser/sites/providers/registry";
import { freeFloor, newGame, skipTo } from "./fixtures";

describe("colocation provider sites", () => {
  it("gives every provider its own host, reached bare and with www.", () => {
    const s = newGame(7);
    expect(new Set(PROVIDERS.map((p) => p.host)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) {
      expect(resolve(s, p.host).page).toEqual({ kind: "provider", id: p.id });
      expect(resolve(s, displayHost(p.host)).page).toEqual({ kind: "provider", id: p.id });
      expect(providerDomain(p.host)).toBe(true);
    }
  });

  it("lists every provider on the index under a link that reaches its site", () => {
    const s = newGame(7);
    const cat = siteIndex(s).find((c) => c.rows.length === PROVIDERS.length && c.rows.every((r) => resolve(s, r.url).page.kind === "provider"));
    expect(cat?.rows.map((r) => resolve(s, r.url).page)).toEqual(PROVIDERS.map((p) => ({ kind: "provider", id: p.id })));
  });

  it("deep-links the order form with the datacenter and space preselected", () => {
    const s = newGame(7), dc = DATACENTERS.find((d) => d.id === "hetzler-nbg")!;
    const r = resolve(s, orderUrl(dc, "share", 4));
    expect(r.page).toEqual({ kind: "provider", id: "hetzler" });
    expect(routeOf("hetzler", r.path)).toEqual({ page: "order", dc: "hetzler-nbg", space: "share", size: 4 });
    expect(routeOf("hetzler", "/sites/equinox-fr5")).toEqual({ page: "notfound" });
    expect(routeOf("hetzler", "/account/contracts")).toEqual({ page: "account", sub: ["contracts"] });
  });

  it.each([2005, 2020])("renders every page of every provider in the %i look", (year) => {
    const s = newGame(7);
    skipTo(s, year);
    for (const p of PROVIDERS) {
      const dc = DATACENTERS.find((d) => d.provider === p.id)!;
      for (const path of ["/", "/sites", `/sites/${dc.id}`, `/order?dc=${dc.id}&space=share&size=2`, "/account"]) {
        const html = renderToString(<ProviderSite game={s} id={p.id} path={path} go={() => {}} />);
        expect(html).toContain(path === "/" ? "ps ps-" : path === "/account" ? "password" : dc.name);
      }
    }
  });
});

const FR5 = DATACENTERS.find((d) => d.id === "equinox-fr5")!, EQUINOX = PROVIDERS.find((p) => p.id === "equinox")!;
afterEach(cleanup);

// Orders a 1/2 rack at FR5 through the form, paying by the method labelled pay.
function order(pay: string) {
  const s = freeFloor({ ...newGame(7), cash: 1_000_000 });
  s.bank = openAccount(s, "sparklasse");
  useStore.setState({ game: s });
  const View = () => <OrderForm game={useStore((x) => x.game)} p={EQUINOX} route={{ page: "order", dc: FR5.id, space: "share", size: 2 }} />;
  render(<View />);
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
  fireEvent.click(screen.getByText(t("providers.next")));
  fill(t("checkout.firstName"), "Tin");
  fill(t("checkout.lastName"), "Becker");
  fill(t("checkout.street"), "Kellerweg 1");
  fill(t("checkout.zip"), "60311");
  fill(t("checkout.city"), "Frankfurt");
  fill(t("checkout.email"), "tin@example.com");
  fireEvent.click(screen.getByText(t("checkout.continue")));
  fireEvent.click(screen.getByLabelText(pay));
  fireEvent.click(screen.getByText(t("checkout.continue")));
  expect(screen.getByText(FR5.name)).toBeTruthy();
  fireEvent.click(screen.getByText(t("checkout.placeOrder")));
  expect(screen.getByText(t("checkout.thanks"))).toBeTruthy();
  const g = useStore.getState().game;
  expect(screen.getByText(t("checkout.number", { order: contractNo(g.contracts[0]) }))).toBeTruthy();
  return g;
}

describe("colocation order and customer portal", () => {
  it("rents the space by direct debit and gives the site a mandate", () => {
    const g = order(t("bank.supplier.mandate"));
    expect(g.contracts.map((c) => c.dc)).toEqual([FR5.id]);
    expect(g.contracts[0].billing?.address).toEqual({ street: "Kellerweg 1", zip: "60311", city: "Frankfurt" });
    expect(g.bank!.mandates).toEqual([FR5.name]);
  });

  it("rents the space on invoice without a mandate", () => {
    const g = order(t("providers.byInvoice"));
    expect(g.contracts.map((c) => c.dc)).toEqual([FR5.id]);
    expect(g.bank!.mandates).toEqual([]);
  });

  it("shows the billing address of the order and the payment method of each site in the portal profile", () => {
    const g = order(t("providers.byInvoice"));
    const html = renderToString(<PortalShell game={g} p={EQUINOX} route={{ page: "account", sub: ["profile"] }} go={() => {}} signOut={() => {}} />);
    expect(html).toContain("Kellerweg 1");
    expect(html).toContain(FR5.name);
    expect(html).toContain(t("accounts.pay.transfer"));
    expect(html).toContain(t("accounts.pay.debit"));
  });
});
