// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { hourOfMonth } from "../src/sim/00-core/time";
import { gmialUrl } from "../src/sim/10-catalog/mail-consumer";
import { FREEMAIL_DOMAINS } from "../src/sim/30-customers/addresses";
import { boxOf } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { setAccountPrefs } from "../src/sim/90-actions/mailbox";
import { Gmial } from "../src/ui/apps/browser/sites/mail/gmial/Gmial";
import { GOGGLE_SESSION } from "../src/ui/apps/browser/sites/mail/goggle/GoggleSite";
import { writeSession } from "../src/ui/session";
import { useStore } from "../src/ui/store";
import { goggleBox, mail } from "./gmial.helpers";

const game = () => useStore.getState().game;
let went: string[] = [];
// Gmial stays mounted across its own pages, as in the Browser, so a held send survives the move to the Inbox.
function show(s: GameState, a: string, page = "") {
  writeSession(GOGGLE_SESSION, a);
  useStore.setState({ game: s });
  const View = () => {
    const g = useStore((x) => x.game);
    const [url, setUrl] = useState(gmialUrl(s.company.domain!, page)), r = resolve(g, url);
    return <Gmial game={g} path={r.path} go={(u) => { went.push(u); setUrl(u); }} />;
  };
  return render(<View />);
}
const tabNames = () => [...document.querySelectorAll(".gml-tabs li")].map((x) => x.textContent);
const root = () => document.querySelector<HTMLElement>(".gml")!;

beforeEach(() => { sessionStorage.clear(); went = []; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Gmial by year", () => {
  it.each([
    ["2007-03", "classic", [], ["labs", "themes", "inbox"]],
    ["2008-11", "classic", ["labs", "themes"], ["inbox"]],
    ["2011-12", "redesign", ["labs", "themes", "inbox"], []],
    ["2014-03", "tabs", ["labs", "inbox"], []],
    ["2019-03", "material", ["labs", "inbox"], []],
    ["2023-03", "pill", ["inbox", "themes"], ["labs"]],
  ])("%s wears the %s look", (ym, look, has, lacks) => {
    const { s, a, address } = goggleBox(71, ym);
    mail(s, address, "Hello");
    show(s, a, "settings");
    expect(root().dataset.look).toBe(look);
    const names = tabNames(), label = (k: string) => t(`gmial.set.${k}`);
    for (const k of has) expect(names).toContain(label(k));
    for (const k of lacks) expect(names).not.toContain(label(k));
    expect(!!document.querySelector(".gml-bar")).toBe(look === "redesign");
    expect(!!document.querySelector(".gml-apps")).toBe(look === "material" || look === "pill");
    expect(!!document.querySelector(".gml-welcome")).toBe(look === "pill");
  });

  it("splits the Inbox into tabs from 2013 and shows the free edition's ad in Promotions", () => {
    const { s, a, address } = goggleBox(72, "2012-06", "free");
    s.hour = hourOfMonth("2014-03");
    mail(s, address, "Big sale", { kind: "promotion" });
    mail(s, address, "Ticket", { kind: "support" });
    show(s, a, "inbox?tab=promotions");
    expect(document.querySelectorAll(".gml-cats li")).toHaveLength(3);
    expect(document.querySelector(".gml-adrow .gml-adchip")?.textContent).toBe(t("gmial.adChip"));
    expect(document.querySelector(".gml-list")?.textContent).toContain("Big sale");
    expect(document.querySelector(".gml-list")?.textContent).not.toContain("Ticket");
  });

  it("lists Priority Inbox sections and marks a support mail important on arrival", () => {
    const { s, a, address } = goggleBox(73, "2011-03");
    mail(s, address, "Server down", { kind: "support" });
    mail(s, address, "Lunch?");
    setAccountPrefs(s, a, { inbox: "priority" });
    show(s, a);
    expect(document.querySelector('[data-section="important"]')?.textContent).toContain("Server down");
    expect(document.querySelector('[data-section="rest"]')?.textContent).toContain("Lunch?");
  });

  it("ignores shortcuts until they are switched on in General settings", () => {
    const { s, a, address } = goggleBox(74, "2009-03");
    mail(s, address, "Hello");
    show(s, a);
    fireEvent.keyDown(root(), { key: "c" });
    expect(went).toEqual([]);
    fireEvent.click(screen.getByRole("link", { name: t("gmial.settings") }));
    fireEvent.click(screen.getByLabelText(t("gmial.gen.keysOn")));
    fireEvent.click(screen.getByRole("button", { name: t("gmial.set.save") }));
    expect(game().mail.accounts.find((x) => x.id === a)?.prefs?.keys).toBe("on");
    fireEvent.click(screen.getByRole("link", { name: new RegExp(`^${t("gmial.view.inbox")}`) }));
    fireEvent.keyDown(root(), { key: "c" });
    expect(went.at(-1)).toContain("compose");
    fireEvent.keyDown(root(), { key: "?" });
    expect(screen.getByRole("dialog", { name: t("gmial.keys.title") })).toBeTruthy();
  });

  it("cancels a send undone within the period and sends it after the period", () => {
    vi.useFakeTimers();
    const { s, a } = goggleBox(75, "2016-03");
    setAccountPrefs(s, a, { undo: 10 });
    const sent = () => boxOf(game(), a).filter((m) => m.folder === "sent").length;
    const write = (subject: string) => {
      fireEvent.click(screen.getByRole("link", { name: t("gmial.compose") }));
      fireEvent.change(document.querySelector('[name="to"]')!, { target: { value: `pal@${FREEMAIL_DOMAINS[0]}` } });
      fireEvent.change(document.querySelector('[name="subject"]')!, { target: { value: subject } });
      fireEvent.click(screen.getByRole("button", { name: t("gmial.compose.send") }));
    };
    show(s, a);
    write("First");
    act(() => { vi.advanceTimersByTime(5000); });
    expect(sent()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: t("gmial.undo") }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(sent()).toBe(0);
    expect(boxOf(game(), a).find((m) => m.draft)?.own?.subject).toBe("First");
    write("Second");
    act(() => { vi.advanceTimersByTime(11000); });
    expect(sent()).toBe(1);
    expect(screen.queryByRole("button", { name: t("gmial.undo") })).toBeNull();
  });

  it("cycles Superstars through the enabled star types", () => {
    const { s, a, address } = goggleBox(76, "2009-03");
    const id = mail(s, address, "Stars");
    setAccountPrefs(s, a, { labs: "superstars", stars: "0,1" });
    show(s, a);
    const star = () => fireEvent.click(document.querySelector(".gml-list .gml-star")!);
    const m = () => boxOf(game(), a).find((x) => x.id === id)!;
    star();
    expect([m().star, m().flag]).toEqual([true, undefined]);
    star();
    expect([m().star, m().flag]).toEqual([true, 1]);
    star();
    expect(m().star).toBeFalsy();
  });
});
