// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { booksVendor, type BooksVendorId } from "../src/sim/10-catalog/bookkeeping";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { booksKey, BOOKS_GUIDE, fillSetup, guideOf, guideTicked, needsActivation, needsKey, setupOf } from "../src/sim/80-business/books-guide";
import { acceptBooksLicence, activateBooks, buyBooks, createBooksCompany, enterBooksKey, enterOpening, installBooks } from "../src/sim/90-actions/bookkeeping";
import { BooksProgram } from "../src/ui/apps/books/BooksApp";
import { InstallGuide } from "../src/ui/apps/books/guide/InstallGuide";
import { Installer } from "../src/ui/apps/books/guide/Installer";
import { guideLook, installerLook } from "../src/ui/apps/books/guide/looks";
import { useStore } from "../src/ui/store";

const IDS = Object.keys(BOOKS_GUIDE) as BooksVendorId[];
const game = (year: number): GameState => {
  const s = newGame(17);
  s.hour = hourOf(new Date(Date.UTC(year, 2, 10, 10)));
  s.cash = 50_000;
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  return s;
};
// Buys the program; a desktop one is downloaded, and installed when asked.
function own(s: GameState, id: BooksVendorId, install = true): void {
  expect(buyBooks(s, id)).toEqual({ ok: true });
  if (s.books.download) s.books.download.readyAt = s.hour;
  if (install && booksVendor(id)!.deployment === "desktop") expect(installBooks(s, id)).toEqual({ ok: true });
}
const put = (s: GameState) => reactAct(() => useStore.setState({ game: { ...s } }));
const ticked = () => [...document.querySelectorAll(".bg-step.ticked")].map((x) => x.getAttribute("data-step"));

beforeEach(() => vi.useRealTimers());
afterEach(() => { cleanup(); sessionStorage.clear(); useStore.setState({ game: newGame(7) }); });

describe("install guide", () => {
  it.each(IDS)("%s ticks follow the state", (id) => {
    const s = game(2018);
    own(s, id);
    put(s);
    render(<InstallGuide />);
    const before = guideOf(s).filter((x) => guideTicked(s, x)).map((x) => x.id);
    expect(ticked()).toEqual(before);
    expect(screen.getAllByRole("listitem").length).toBe(guideOf(s).length);
    expect(document.querySelector(".bg-step.current")).not.toBeNull();
    // The sim finishes the steps; the guide shows them ticked and keeps the optional ones open.
    if (booksVendor(id)!.deployment === "desktop") acceptBooksLicence(s);
    if (needsKey(id)) enterBooksKey(s, booksKey(s, id));
    if (booksVendor(id)!.deployment === "browser" || needsActivation(id)) activateBooks(s);
    createBooksCompany(s, { chart: "skr04", fiscalStart: 4, method: "ist" });
    enterOpening(s);
    put(s);
    expect(ticked()).toEqual(guideOf(s).filter((x) => guideTicked(s, x)).map((x) => x.id));
    expect(ticked()).toEqual(expect.arrayContaining(["company", "method", "chart"].filter((x) => guideOf(s).some((y) => y.id === x))));
  });

  it("draws each product in the look of its era", () => {
    const look = (id: BooksVendorId, y: number) => guideLook(booksVendor(id)!, y);
    expect(look("lexwear", 2006)).toBe("booklet");
    expect(look("lexwear", 2018)).toBe("help");
    expect(look("gnucache", 2006)).toBe("manual");
    expect(look("collmix", 2018)).toBe("checklist");
    const inst = (id: BooksVendorId, y: number) => installerLook(booksVendor(id)!, y);
    expect([inst("lexwear", 2006), inst("lexwear", 2012), inst("lexwear", 2018), inst("gnucache", 2012), inst("collmix", 2018)]).toEqual(["grey", "wizard", "flat", "inno", "signup"]);
    const s = game(2006);
    own(s, "lexwear"); put(s);
    render(<InstallGuide />);
    expect(document.querySelector("[data-look=booklet]")).not.toBeNull();
  });

  it("buttons call the actions", () => {
    const s = game(2006);
    own(s, "lexwear"); put(s);
    render(<InstallGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Accept licence agreement" }));
    expect(setupOf(useStore.getState().game).licence).toBe(true);
    const field = screen.getByLabelText("Serial number");
    fireEvent.change(field, { target: { value: "WRONG" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter serial number" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(setupOf(useStore.getState().game).key).toBe("");
    fireEvent.change(field, { target: { value: booksKey(useStore.getState().game, "lexwear").toLowerCase() } });
    fireEvent.click(screen.getByRole("button", { name: "Enter serial number" }));
    expect(setupOf(useStore.getState().game).key).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    fireEvent.change(screen.getByLabelText("Chart of accounts"), { target: { value: "skr04" } });
    fireEvent.click(screen.getByRole("button", { name: "Create company" }));
    const u = setupOf(useStore.getState().game);
    expect([u.activated, u.company, u.chart]).toEqual([true, true, "skr04"]);
    expect(ticked()).toEqual(expect.arrayContaining(["licence", "key", "activate", "company", "chart", "method"]));
  });

  it("shows a finished setup collapsed", () => {
    const s = game(2018);
    own(s, "lexwear"); s.books.setupDone = true; fillSetup(s); put(s);
    render(<InstallGuide />);
    expect(screen.queryAllByRole("listitem").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(ticked().length).toBeGreaterThan(5);
    expect(screen.queryByRole("button", { name: "Accept licence agreement" })).toBeNull();
  });
});

describe("installer", () => {
  const next = () => fireEvent.click(screen.getByRole("button", { name: "Next >" }));
  it("runs the pages of a desktop program and installs it", () => {
    vi.useFakeTimers();
    const s = game(2006);
    own(s, "lexwear", false); put(s);
    const close = vi.fn();
    render(<Installer id="lexwear" onClose={close} />);
    const page = () => document.querySelector(".bki")!.getAttribute("data-page");
    expect(page()).toBe("welcome");
    next();
    expect(page()).toBe("licence");
    expect((screen.getByRole("button", { name: "Next >" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    next();
    expect(page()).toBe("key");
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "nope" } });
    next();
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: booksKey(s, "lexwear").toLowerCase() } });
    next();
    expect(page()).toBe("type");
    expect(useStore.getState().game.books.vendor).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(page()).toBe("progress");
    const g = useStore.getState().game;
    expect(g.books.vendor).toBe("lexwear");
    expect([setupOf(g).licence, setupOf(g).key !== ""]).toEqual([true, true]);
    reactAct(() => { vi.advanceTimersByTime(10_000); });
    expect(page()).toBe("finish");
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(close).toHaveBeenCalled();
  });

  it("resumes where it was closed", () => {
    const s = game(2006);
    own(s, "lexwear", false); put(s);
    const { unmount } = render(<Installer id="lexwear" onClose={() => {}} />);
    next();
    fireEvent.click(screen.getByRole("checkbox"));
    next();
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "ABC" } });
    unmount();
    render(<Installer id="lexwear" onClose={() => {}} />);
    expect(document.querySelector(".bki")!.getAttribute("data-page")).toBe("key");
    expect((screen.getByLabelText("Serial number") as HTMLInputElement).value).toBe("ABC");
  });

  it("skips the serial number page for the register program", () => {
    const s = game(2012);
    own(s, "gnucache", false); put(s);
    render(<Installer id="gnucache" onClose={() => {}} />);
    expect(document.querySelector(".bki-inno")).not.toBeNull();
    expect(screen.queryByText("Serial number")).toBeNull();
  });

  it("signs up for a web program", () => {
    const s = game(2018);
    own(s, "collmix"); put(s);
    const close = vi.fn();
    render(<Installer id="collmix" inline onClose={close} />);
    const page = () => document.querySelector(".bki")!.getAttribute("data-page");
    expect(page()).toBe("register");
    fireEvent.change(screen.getByLabelText("E-mail address"), { target: { value: "me@example.org" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(page()).toBe("confirm");
    fireEvent.click(screen.getByRole("button", { name: "Confirm e-mail" }));
    expect(setupOf(useStore.getState().game).activated).toBe(true);
    expect(page()).toBe("company");
    fireEvent.click(within(document.querySelector(".bki-page")!).getByRole("button", { name: "Create company" }));
    expect(setupOf(useStore.getState().game).company).toBe(true);
    expect(page()).toBe("plan");
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(close).toHaveBeenCalled();
  });
});

describe("books program", () => {
  beforeEach(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
  it("opens on the guide until the setup is done", () => {
    const s = game(2006);
    own(s, "lexwear"); put(s);
    render(<BooksProgram />);
    expect(document.querySelector(".bg")).not.toBeNull();
    expect(screen.queryByText("Einrichtungsassistent")).toBeNull();
    cleanup();
    s.books.setupDone = true; fillSetup(s); put(s);
    render(<BooksProgram />);
    expect(document.querySelector(".bg")).toBeNull();
  });

  it("treats an unset setup state as unfinished", () => {
    const s = game(2006);
    own(s, "lexwear"); delete s.books.setupDone; put(s);
    render(<BooksProgram />);
    expect(document.querySelector(".bg")).not.toBeNull();
  });

  it("offers no tax button where the program has no tax screen", () => {
    const s = game(2018);
    own(s, "lexwear"); put(s);
    render(<InstallGuide go={() => {}} canGo={() => false} />);
    expect(screen.queryByRole("button", { name: "Open tax data" })).toBeNull();
  });
});
