// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { DesktopIcons } from "../src/ui/desktop/DesktopIcons";
import { Dock } from "../src/ui/desktop/Dock";
import { MenuBar } from "../src/ui/desktop/MenuBar";
import { useStore } from "../src/ui/store";
import { newGame } from "./fixtures";

const s = () => useStore.getState();
afterEach(() => { cleanup(); act(() => s().setBell(false)); });

describe("desktop shell", () => {
  it("Exit leaves on a single click", () => {
    useStore.setState({ game: newGame(1), surface: "desktop", windows: [] });
    render(<DesktopIcons />);
    fireEvent.click(screen.getByText(t("desktop.icon.exit")));
    expect(s().surface).toBe("world");
  });

  it("the menu bar has no dark mode button", () => {
    useStore.setState({ game: newGame(1), surface: "desktop", windows: [] });
    render(<MenuBar onBell={() => {}} />);
    expect(screen.queryByRole("button", { name: /dark/i })).toBeNull();
  });

  it("money shows a dash until a bank account exists", () => {
    const g = newGame(1);
    useStore.setState({ game: { ...g, bank: null }, surface: "desktop", windows: [] });
    const { unmount } = render(<MenuBar onBell={() => {}} />);
    expect(document.querySelector(".mb-cash")!.textContent).toBe("–");
    unmount();
    useStore.setState({ game: { ...g, bank: {} as never } });
    render(<MenuBar onBell={() => {}} />);
    expect(document.querySelector(".mb-cash")!.textContent).not.toBe("–");
  });

  it("a newly unlocked app lands at the end of the dock", () => {
    const g = newGame(1);
    const order = () => [...document.querySelectorAll(".dock-app[data-app]")].map((e) => e.getAttribute("data-app"));
    useStore.setState({ game: { ...g, installed: ["Browser", "Chat", "Books"] }, windows: [] });
    const { unmount } = render(<Dock />);
    const before = order();
    unmount();
    // Shop sits before Browser in the registry but was unlocked after it.
    useStore.setState({ game: { ...g, installed: ["Browser", "Chat", "Books", "Shop"] } });
    render(<Dock />);
    expect(order()).toEqual([...before, "Shop"]);
  });

  it("the bell panel pauses the clock and restores the speed", () => {
    useStore.setState({ speed: 8 });
    act(() => s().setBell(true));
    expect(s().speed).toBe(0);
    act(() => s().setBell(false));
    expect(s().speed).toBe(8);
  });

  it("the bell panel keeps a pause the player set", () => {
    useStore.setState({ speed: 0 });
    act(() => s().setBell(true));
    act(() => s().setBell(false));
    expect(s().speed).toBe(0);
  });

  it("windows cascade wraps after five", () => {
    useStore.setState({ game: newGame(1), surface: "desktop", windows: [] });
    for (const app of ["Browser", "Chat", "Notes", "Books", "Post", "News"]) act(() => s().openApp(app, undefined, true));
    const xs = s().windows.map((w) => w.x);
    expect(Math.max(...xs)).toBeLessThan(136 + 5 * 32);
  });
});
