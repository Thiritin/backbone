// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { modelById } from "../src/sim/10-catalog/hardware";
import { ContextMenuHost, closeMenu } from "../src/ui/desktop/ContextMenu";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { getPlug, setPlug } from "../src/ui/world/rack/cartPlug";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

const dev = () => useStore.getState().game.devices.find((d) => modelById(d.model).kind === "server")!;
const mount = () => {
  const r = render(<div className="desktop"><RackPanel rackId={dev().rackId!} onClose={() => {}} /><ContextMenuHost /></div>);
  return r.container;
};
const face = (c: HTMLElement) => c.querySelector(`.wr-face:not(.out) .rack-dev[aria-label="${dev().name}"]`) as SVGElement;
const labels = () => Array.from(document.querySelectorAll("[role=menuitem]")).map((e) => e.textContent ?? "");
const has = (re: RegExp) => labels().some((l) => re.test(l));

beforeEach(() => { vi.useFakeTimers(); useStore.setState({ game: withServer(newGame(1)) }); setPlug(null); });
afterEach(() => { act(() => closeMenu()); cleanup(); vi.useRealTimers(); });

describe("world device menu", () => {
  it("has no power, maintenance or technician entries", () => {
    const c = mount();
    fireEvent.contextMenu(face(c), { clientX: 10, clientY: 10 });
    const all = labels().join("|");
    expect(all).toContain(t("world.console"));
    expect(all).toContain(t("world.ports"));
    expect(all).toContain(t("locations-1.rename"));
    for (const k of ["powerOff", "powerOn", "powerCycle", "planMaintenance"]) expect(all).not.toContain(t(`locations-1.${k}` as "locations-1.powerOff"));
    expect(has(/Restart|Shut down|Power on|Maintenance|technician/i)).toBe(false);
  });

  it("opens with Shift+F10 and the Menu key on a focused device", () => {
    const c = mount();
    expect(face(c).getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(face(c), { key: "F10", shiftKey: true });
    expect(labels().length).toBeGreaterThan(3);
    act(() => closeMenu());
    expect(labels().length).toBe(0);
    fireEvent.keyDown(face(c), { key: "ContextMenu" });
    expect(labels().length).toBeGreaterThan(3);
  });

  it("names the menu and starts renaming on F2", () => {
    const c = mount();
    fireEvent.contextMenu(face(c), { clientX: 10, clientY: 10 });
    expect(document.querySelector("[role=menu]")!.getAttribute("aria-label")).toBe(t("world.menu"));
    expect(labels()).toContain(`${t("locations-1.rename")}F2`);
    act(() => closeMenu());
    fireEvent.keyDown(face(c), { key: "F2" });
    expect(c.querySelector("input")).not.toBeNull();
  });

  it("shows the reason after a comma on disabled entries", () => {
    useStore.setState({ game: { ...useStore.getState().game, devices: useStore.getState().game.devices.map((d) => (d.id === dev().id ? { ...d, on: false } : d)) } });
    const c = mount();
    fireEvent.contextMenu(face(c), { clientX: 10, clientY: 10 });
    expect(labels()).toContain(`${t("locations-1.burnIn")}, ${t("world.serverOff")}`);
  });

  it("plugs the crash cart into the server and opens it", () => {
    const c = mount();
    fireEvent.contextMenu(face(c), { clientX: 10, clientY: 10 });
    const item = Array.from(document.querySelectorAll("[role=menuitem]")).find((e) => e.textContent === t("world.console")) as HTMLElement;
    fireEvent.click(item);
    expect(getPlug()).toBe(dev().id);
    expect(c.querySelector(`[data-cart-panel="${dev().id}"]`)).not.toBeNull();
  });

  it("opens at the finger after a 500 ms touch press and the release click does not toggle the device", () => {
    const c = mount();
    const el = face(c);
    fireEvent.pointerDown(el, { pointerType: "touch", button: 0, clientX: 30, clientY: 40 });
    act(() => { vi.advanceTimersByTime(499); });
    expect(labels().length).toBe(0);
    act(() => { vi.advanceTimersByTime(2); });
    expect(labels().length).toBeGreaterThan(3);
    fireEvent.pointerUp(el, { pointerType: "touch" });
    fireEvent.click(el);
    expect(el.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector<HTMLElement>(".ctx")!.style.left).toBe("30px");
  });

  it("a short touch tap does not open the menu", () => {
    const c = mount();
    fireEvent.pointerDown(face(c), { pointerType: "touch", button: 0 });
    fireEvent.pointerUp(face(c), { pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(600); });
    expect(labels().length).toBe(0);
  });
});
