// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { tick } from "../src/sim/88-tick/tick";
import { useDeviceMenu } from "../src/ui/apps/locations/Inspector";
import { useStore } from "../src/ui/store";
import { ARM_MS, UnitTag } from "../src/ui/world/rack/UnitTag";
import { deviceHealth, working } from "../src/sim/60-infra/status";
import { POWER } from "../src/ui/apps/locations/Inspector";
import { POWER_LABEL } from "../src/ui/apps/locations/power";
import { newGame, readyGame, withServer } from "./fixtures";

let forced: string | null = null;
vi.mock("../src/sim/checklist", async (orig) => {
  const m = await orig<typeof import("../src/sim/checklist")>();
  return { ...m, nextGoal: (g: never, c: never) => forced ?? m.nextGoal(g, c), cardBoard: (g: never) => ({ ...m.cardBoard(g), current: forced ? { id: "x", goals: [forced], chapter: 1 } : m.cardBoard(g).current }) };
});

function Harness({ id }: { id: string }) {
  const game = useStore((s) => s.game);
  const menus = useDeviceMenu(game, () => {}, () => {}, undefined, true);
  return game.devices.some((d) => d.id === id) ? <UnitTag deviceId={id} renaming={false} onRenaming={() => {}} menus={menus} back={false} onPorts={() => {}} onCart={() => {}} onSold={() => {}} /> : null;
}

function mount(game = withServer(newGame(1)), only?: string) {
  const dev = game.devices.find((d) => modelById(d.model).kind === "server" && d.rackId && d.id === (only ?? d.id))!;
  useStore.setState({ game });
  const view = render(<Harness id={dev.id} />);
  const on = () => useStore.getState().game.devices.find((d) => d.id === dev.id)?.on;
  return { dev, view, on, power: () => view.container.querySelector<HTMLElement>(".wk-power")! };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("unit tag", () => {
  it("draws power, console and port keys and a grid of pictogram keys, no text list", () => {
    const { view } = mount();
    expect(view.container.querySelector("[data-power=on]")).not.toBeNull();
    expect(view.container.querySelector("[data-cart]")).not.toBeNull();
    expect(view.container.querySelector("[data-ports]")).not.toBeNull();
    expect(view.container.querySelectorAll(".wk-grid .wk-ic").length).toBeGreaterThan(4);
    expect(view.container.querySelector(".wr-line")).toBeNull();
  });

  it("arms on the first press without shutting down, and disarms after the timeout", () => {
    const { on, power } = mount();
    fireEvent.click(power());
    expect(power().getAttribute("aria-pressed")).toBe("true");
    expect(on()).toBe(true);
    act(() => { vi.advanceTimersByTime(ARM_MS + 100); });
    expect(power().getAttribute("aria-pressed")).toBe("false");
    expect(on()).toBe(true);
  });

  it("asks on a slip, not a dialog, when a shutdown would take machines offline; cancel keeps it on, the stamp shuts it down", () => {
    const { on, power, view } = mount();
    const press = () => { fireEvent.click(power()); act(() => { vi.advanceTimersByTime(1000); }); fireEvent.click(power()); };
    press();
    expect(view.container.querySelector("[data-slip=offline]")).not.toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(on()).toBe(true);
    fireEvent.click(view.container.querySelector("[data-slip-cancel]")!);
    expect(view.container.querySelector("[data-slip=offline]")).toBeNull();
    expect(on()).toBe(true);
    press();
    fireEvent.click(view.container.querySelector("[data-slip-stamp]")!);
    for (let i = 0; i < 400 && on(); i++) act(() => { useStore.getState().act((g) => { tick(g); return { ok: true }; }); });
    expect(on()).toBe(false);
  });

  it("disarms when the server goes off from elsewhere", () => {
    const { dev, on, power } = mount();
    fireEvent.click(power());
    expect(power().getAttribute("aria-pressed")).toBe("true");
    act(() => { useStore.setState((s) => ({ game: { ...s.game, devices: s.game.devices.map((d) => (d.id === dev.id ? { ...d, on: false } : d)) } })); });
    expect(on()).toBe(false);
    expect(power().getAttribute("aria-pressed")).toBe("false");
  });

  it("sells through the slip: the key opens it, the stamp removes the device", () => {
    const { dev, view } = mount();
    fireEvent.click(view.container.querySelector("[data-sell]")!);
    expect(view.container.querySelector("[data-slip=sell]")).not.toBeNull();
    expect(view.container.querySelector("[data-slip-stamp]")).not.toBeNull();
    fireEvent.click(view.container.querySelector("[data-slip-stamp]")!);
    expect(useStore.getState().game.devices.some((d) => d.id === dev.id)).toBe(false);
  });

  it("flips a submenu key out as a row of keys", () => {
    const { view } = mount();
    const key = view.container.querySelector<HTMLElement>(".wk-grid [aria-expanded]")!;
    expect(view.container.querySelector(".wk-flip")).toBeNull();
    fireEvent.click(key);
    expect(view.container.querySelectorAll(".wk-flip .wk").length).toBeGreaterThan(0);
    fireEvent.click(key);
    expect(view.container.querySelector(".wk-flip")).toBeNull();
  });

  const restart = (view: ReturnType<typeof mount>["view"]) => view.container.querySelector<HTMLButtonElement>(`[data-key="${POWER_LABEL.reboot}"]`)!;

  it("restart says why it is unavailable for the machine's state, and is enabled when it is up", () => {
    const off = withServer(newGame(1));
    const dev = off.devices.find((d) => modelById(d.model).kind === "server" && d.rackId)!;
    dev.on = false;
    const a = mount(off);
    expect(restart(a.view).disabled).toBe(true);
    expect(restart(a.view).title).toBe(`${POWER_LABEL.reboot}: ${POWER.off[0]}`);
    cleanup();

    const on = withServer(newGame(1));
    const d2 = on.devices.find((d) => modelById(d.model).kind === "server" && d.rackId)!;
    d2.on = true;
    const b = mount(on);
    const up = working(on, d2.id);
    expect(restart(b.view).disabled).toBe(!up);
    if (!up) expect(restart(b.view).title).toBe(`${POWER_LABEL.reboot}: ${POWER[deviceHealth(on, d2.id).state][0]}`);
    cleanup();

    const ready = readyGame(1);
    const d3 = ready.devices.find((d) => modelById(d.model).kind === "server" && d.rackId && d.on && working(ready, d.id));
    expect(d3).toBeDefined();
    expect(restart(mount(ready, d3!.id).view).disabled).toBe(false);
  });
  it("marks the key the current guide card needs", () => {
    const g = readyGame(1);
    const d = g.devices.find((x) => modelById(x.model).kind === "server" && x.rackId && x.on && working(g, x.id))!;
    const marks = (goal: string | null) => { forced = goal; const { view } = mount(g, d.id); const r = [...view.container.querySelectorAll("[data-guide]")].map((e) => e.getAttribute("data-key") ?? (e.hasAttribute("data-cart") ? "console" : "")); cleanup(); return r; };
    expect(marks(null)).toEqual([]);
    expect(marks("bootUsb")).toEqual(["console", POWER_LABEL.reboot.replace(/(\.\.\.|…)$/, "")]);
    expect(marks("installOs")).toEqual(["console"]);
    forced = null;
  });

  it("reboots at once with no customers and asks on a slip when customers exist", () => {
    for (const customers of [0, 1]) {
      const g = readyGame(1);
      const d = g.devices.find((x) => modelById(x.model).kind === "server" && x.rackId && x.on && working(g, x.id))!;
      g.customers = customers ? [{} as never] : [];
      const { view } = mount(g, d.id);
      fireEvent.click(view.container.querySelector<HTMLElement>(`[data-key="${POWER_LABEL.reboot}"]`)!);
      expect(view.container.querySelector("[data-slip=offline]") !== null).toBe(customers === 1);
      cleanup();
    }
  });
});
