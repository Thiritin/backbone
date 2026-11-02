import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { clientExitSkin, lookOf } from "../src/ui/apps/browser/sites/portal/clientexit";
import { ClientExit } from "../src/ui/apps/browser/sites/shopvendors/clientexit";
import { useStore } from "../src/ui/store";
import { installWithKey, readyGame } from "./fixtures";

const game = (ym: string): GameState => {
  const s = readyGame(11);
  s.hour = hourOfMonth(ym);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  installWithKey(s, "clientExit", true);
  useStore.setState({ game: s });
  return s;
};
const { Bare, Login } = clientExitSkin as Required<typeof clientExitSkin>;
const site = (s: GameState, path: string) => renderToString(<ClientExit game={s} path={path} go={() => {}} />);
const props = (s: GameState, area: "admin" | "store", major: string) =>
  ({ game: s, variant: "clientExit" as const, route: { area, query: new URLSearchParams() }, open: () => {}, version: `${major}.0`, major, browse: () => {} });

describe("ClientExit", () => {
  it("sells its keys at clientexit.com", () => {
    const s = game("2009-05");
    expect(hostOf("clientExit")).toBe("clientexit.com");
    expect(resolve(s, "www.clientexit.com/account").page).toEqual({ kind: "shopVendor", id: "clientExit" });
  });

  it("picks the admin look from the installed major", () => {
    expect(["2", "3", "4", "5", "6", "7"].map((m) => lookOf(m, 0))).toEqual(["classic", "classic", "desk", "flat", "flat", "seven"]);
  });

  it("lists the owned key with its updates term and the leases on the pricing page", () => {
    const html = site(game("2009-05"), "/pricing");
    expect(html).toContain("Owned licence, version 3");
    expect(html).toContain("12 months included, then 50 € a year");
    expect(html).toContain("Branded");
    expect(html).toContain("Add to cart");
  });

  it("offers renewal, the paid upgrade and Copy key for the installed key", () => {
    const s = game("2010-05");
    s.hour = hourOfMonth("2011-06");
    const html = site(s, "/account");
    expect(html).toContain("Renew updates for 50 €");
    expect(html).toContain("Upgrade to 4 for 250 €");
    expect(html).toContain("Copy key");
    expect(html).toContain("cxv-v2");
  });

  it("wraps the locked licence screen and the closed store in its own frames", () => {
    const s = game("2012-05");
    expect(renderToString(<Bare {...props(s, "admin", "4")}>x</Bare>)).toContain("cxe-desk cxe-admin");
    expect(renderToString(<Bare {...props(s, "store", "7")}>x</Bare>)).toContain("cxe-seven cxe-store");
    expect(renderToString(<Login {...props(s, "admin", "5")} onLogin={() => {}} />)).toContain("cxe-flat cxe-login");
  });
});
