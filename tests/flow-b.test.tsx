// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { tick } from "../src/sim/88-tick/tick";
import { booksVendor } from "../src/sim/10-catalog/bookkeeping";
import { hourOf } from "../src/sim/00-core/time";
import { bootFromUsb } from "../src/sim/90-actions/console";
import { buyBooks } from "../src/sim/90-actions/bookkeeping";
import { newGame } from "../src/sim/50-state";
import { cardBoard } from "../src/sim/checklist";
import { stepOf } from "../src/ui/apps/guide";
import { hostOf, useInstaller } from "../src/ui/apps/console/installer";
import { Editions } from "../src/ui/apps/browser/sites/books/VendorShop";
import { TerminalApp } from "../src/ui/apps/terminal/TerminalApp";
import { ShopApp } from "../src/ui/apps/shop/ShopApp";
import { NextStrip } from "../src/ui/world/NextStrip";
import { NoteApp } from "../src/ui/apps/NoteApp";
import { useStore } from "../src/ui/store";
import { withServer, withStick } from "./fixtures";

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe("deep-link targets", () => {
  it("points each card at its own page", () => {
    const s = newGame(1);
    expect(stepOf(s, "downloadIso").focus).toEqual({ kind: "url", id: "www.debiant.org/download" });
    expect(stepOf(s, "domain").focus?.id).toBe("www.namecheep.com/");
    expect(stepOf(s, "buyServer")).toMatchObject({ app: "Shop", focus: { kind: "class", id: "server" } });
  });

  it("types the ssh login in the Terminal and waits for Enter", () => {
    localStorage.setItem("raid0.shell", "1");
    useStore.setState({ game: newGame(5), windows: [] });
    render(<TerminalApp />);
    act(() => useStore.getState().openApp("Terminal", { kind: "ssh", id: "192.168.1.20" }));
    expect((screen.getByLabelText(t("misc1.terminal.command")) as HTMLInputElement).value).toBe("ssh root@192.168.1.20");
  });

  it("focuses the Server class in the Shop with the price sorted up", () => {
    const s = newGame(6);
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    useStore.setState({ game: s, windows: [] });
    render(<ShopApp />);
    act(() => useStore.getState().openApp("Shop", { kind: "class", id: "server" }));
    expect(screen.getByRole("heading", { name: t("shop.class.Servers") })).toBeTruthy();
    expect((screen.getByLabelText(t("shop.sortBy")) as HTMLSelectElement).value).toBe("priceLow");
  });

  it("shows sub-progress on the install card", () => {
    const s = newGame(2);
    s.checklist = [...s.checklist, "downloadIso", "writeStick"];
    const card = cardBoard(s).cards.find((c) => c.id === "installOs")!;
    expect(card.goals.length).toBe(5);
  });
});

describe("automatic install", () => {
  it("installs Debiant with DHCP and the default hostname from the boot menu row", () => {
    const s = withServer(newGame(4));
    withStick(s, "dev3");
    expect(bootFromUsb(s, "dev3").ok).toBe(true);
    const m = s.devices.find((d) => d.id === "dev3")!;
    useStore.setState({ game: s });
    const hook = renderHook(() => useInstaller(useStore.getState().game, m, "lunix", "9"));
    render(<>{hook.result.current.view}</>);
    fireEvent.click(screen.getByText(t("console.autoInstall")));
    for (let h = 0; h < 3; h++) tick(useStore.getState().game);
    const d = useStore.getState().game.devices.find((x) => x.id === "dev3")!;
    expect(d.os?.id).toBe("lunix");
    expect(d.hostname ?? hostOf(m)).toBe(hostOf(m));
  });
});

describe("accounting download", () => {
  it("installs the books from the vendor page once the download is ready", () => {
    const s = newGame(31);
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
    s.cash = 50_000;
    const v = booksVendor("lexwear")!;
    expect(buyBooks(s, "lexwear").ok).toBe(true);
    useStore.setState({ game: { ...s } });
    const view = () => <Editions game={useStore.getState().game} v={v} />;
    render(view());
    expect(screen.queryByText(t("books-vendors.install"))).toBeNull();
    useStore.setState({ game: { ...s, hour: s.books.download!.readyAt } });
    cleanup();
    render(view());
    fireEvent.click(screen.getAllByText(t("books-vendors.install"))[0]);
    expect(useStore.getState().game.books.vendor).toBe("lexwear");
  });

  it("shows the card in the room and drops it with the card window", () => {
    useStore.setState({ game: newGame(5), windows: [] });
    useStore.getState().openApp("Getting started");
    render(<NextStrip />);
    expect(screen.getByText(t("guide.step.bank"))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t("apps.close")));
    expect(useStore.getState().windows.some((w) => w.app === "Getting started")).toBe(false);
    expect(screen.queryByText(t("guide.step.bank"))).toBeNull();
  });

  it("marks the code the bank asks for on the TAN list", () => {
    const s = newGame(5);
    s.bank = { id: "sparklasse", tan: "itan", tans: { list: 1, codes: ["AAA", "BBB", "CCC"], used: [0] }, pending: null } as never;
    s.docs = [...s.docs, { id: "tans", kind: "note", title: "TAN", body: "", x: 0, y: 0 }];
    useStore.setState({ game: s });
    render(<NoteApp id="tans" />);
    expect(document.querySelector(".tan-cell.now")?.textContent).toContain("BBB");
  });
});
