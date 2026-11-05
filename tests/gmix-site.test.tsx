// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth, nextMonthStart } from "../src/sim/00-core/time";
import { GMIX_DOMAIN } from "../src/sim/42-mail/new";
import type { GameState } from "../src/sim/50-state";
import { defaultBookmarks, providerDomain, resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { gmixSuggestions } from "../src/sim/80-business/mail-provider";
import { tick } from "../src/sim/88-tick/tick";
import { acceptGmixOffer, signUpGmix } from "../src/sim/90-actions/mail-provider";
import { GmixSite } from "../src/ui/apps/browser/sites/mail/gmix/GmixSite";
import { useStore } from "../src/ui/store";
import { idOf, mailLedger } from "./company-mail.helpers";
import { startGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const start = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
const address = (s: GameState) => `${start(s).local}@${GMIX_DOMAIN}`;

let went: string[] = [];
function show(s: GameState, path: string) {
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [url, setUrl] = useState(`www.gmix.net${path}`), r = resolve(g, url);
    const go = (u: string) => { went.push(u); setUrl(u); };
    // Keyed by address, so a navigation mounts a fresh page as the Browser does.
    return r.page.kind === "mailProvider" ? <GmixSite key={url} game={g} path={r.path} go={go} /> : <p>{r.page.kind}</p>;
  };
  return render(<View />);
}
const type = (name: string, value: string) => fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });
const cell = (row: string, col: number) => document.querySelector(`tr[data-row="${row}"]`)!.querySelectorAll("td")[col].textContent;

beforeEach(() => { sessionStorage.clear(); went = []; });
afterEach(cleanup);

describe("GMix site", () => {
  it("answers on gmix.net and gmix.com, sits in the index and is the start box's webmail bookmark", () => {
    const s = startGame(1);
    expect(resolve(s, "gmix.net").page).toEqual({ kind: "mailProvider", id: "gmix" });
    expect(resolve(s, "www.gmix.com/plans").page).toEqual({ kind: "mailProvider", id: "gmix" });
    expect(providerDomain("gmix.com")).toBe(true);
    const row = siteIndex(s).find((c) => c.title === t("sim.index.cat.mailProviders"))!.rows[0];
    expect(resolve(s, row.url).page.kind).toBe("mailProvider");
    expect(defaultBookmarks(s).find((b) => b.title === t("sim.index.webmail"))?.url).toBe("www.gmix.net/");
  });

  it("wears the portal look of its year", () => {
    for (const [ym, look] of [["2005-06", "frames"], ["2012-06", "navigator"], ["2019-06", "flat"]] as const) {
      const s = startGame(2);
      s.hour = at(ym);
      const { container } = show(s, "/");
      expect(container.querySelector(".gx")!.className).toBe(`gx gx-${look}`);
      expect(screen.getAllByText(t("gmix.login.submit")).length).toBe(look === "navigator" ? 3 : 1);
      cleanup();
    }
  });

  it("shows the tier rows of each year", () => {
    const s = startGame(3);
    s.hour = at("2006-01");
    show(s, "/plans");
    expect(cell("attach", 0)).toBe(t("gmix.value.mb", { mb: 5 }));
    expect(cell("imap", 0)).toBe(t("gmix.value.no"));
    expect(cell("price", 1)).toBe(t("gmix.value.perMonth", { price: 2.99 }));
    cleanup();
    s.hour = at("2016-01");
    show(s, "/plans");
    expect(cell("attach", 0)).toBe(t("gmix.value.mb", { mb: 20 }));
    expect(cell("imap", 0)).toBe(t("gmix.value.yes"));
    expect(cell("price", 2)).toBe(t("gmix.value.perMonth", { price: 6.49 }));
  });

  it("refuses a wrong password, fills a saved login and offers ad-free to a free box in 2018", () => {
    const s = startGame(4);
    s.hour = at("2019-03");
    show(s, "/");
    type("address", address(s));
    type("password", "wrong-pw");
    fireEvent.click(screen.getByText(t("gmix.login.submit")));
    expect(screen.getByRole("alert").textContent).toBe(t("error.mailLogin"));
    cleanup();
    s.installed = [...s.installed, "keepassive"];
    s.logins = { ...s.logins, [`mail:${address(s)}`]: [address(s), start(s).password] };
    show(s, "/login");
    expect((document.querySelector('input[name="password"]') as HTMLInputElement).value).toBe(start(s).password);
    fireEvent.click(screen.getByText(t("gmix.login.submit")));
    expect(went.at(-1)).toBe("www.gmix.net/welcome");
    expect(screen.getByText(t("gmix.adfree.go")).className).toContain("gx-big");
  });

  it("offers free names for a taken one at sign-up", () => {
    const s = startGame(5);
    show(s, "/signup");
    type("local", start(s).local);
    type("password", "Secret-pw1");
    type("repeat", "Secret-pw1");
    fireEvent.click(screen.getByText(t("gmix.signup.submit")));
    const suggestions = gmixSuggestions(useStore.getState().game, start(s).local);
    expect(suggestions.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(suggestions[0]));
    fireEvent.click(screen.getByText(t("gmix.signup.submit")));
    expect(useStore.getState().game.mail.accounts.some((a) => a.local === suggestions[0])).toBe(true);
    expect(went.at(-1)).toBe("www.gmix.net/account");
  });

  it("sends the reset code by post and takes it once the letter has arrived", () => {
    const s = startGame(6);
    show(s, "/reset");
    type("address", address(s));
    fireEvent.click(screen.getByText(t("gmix.reset.request")));
    expect(screen.getByText(t("gmix.reset.sent"))).toBeTruthy();
    const g = useStore.getState().game, letter = g.letters.find((l) => l.id === start(g).reset!.letter)!;
    while (!g.letters.find((l) => l.id === letter.id)!.arrived) tick(g);
    cleanup();
    show(g, "/reset");
    type("code", start(g).reset!.code);
    type("new", "fresh-pw");
    fireEvent.click(screen.getByText(t("gmix.reset.save")));
    expect(screen.getByText(t("gmix.reset.done"))).toBeTruthy();
    expect(start(useStore.getState().game).password).toBe("fresh-pw");
  });

  it("bills a taken retention offer for three month starts, once", () => {
    const s = startGame(7);
    s.cash = 10_000;
    const r = signUpGmix(s, { local: "offer.box", title: "Box", password: "secret-pw", plan: "top" });
    const tenant = s.mail.tenants.find((x) => x.admin === idOf(r))!.id;
    expect(acceptGmixOffer(s, tenant).ok).toBe(true);
    expect(acceptGmixOffer(s, tenant).ok).toBe(false);
    const amounts: number[] = [];
    for (let i = 0; i < 4; i++) {
      // Only the month-start tick bills, so the hours before it are skipped.
      s.hour = nextMonthStart(s.hour) - 1;
      tick(s);
      amounts.push(...mailLedger(s).filter((e) => e.params?.name === "GMix").map((e) => -e.amount));
    }
    expect(amounts).toEqual([0.99, 0.99, 0.99, 4.99]);
  });
});

describe("GMix start page with a stored login", () => {
  it("opens the inbox of the starter box and keeps the form for other addresses", () => {
    const s = startGame(1);
    s.logins = { [`mail:${address(s)}`]: [address(s), start(s).password] };
    show(s, "/");
    expect(went.at(-1)).toBe("www.gmix.net/mail/inbox");
  });
});
