// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { modelById } from "../src/sim/10-catalog/hardware";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { useStore } from "../src/ui/store";
import { customersOnDevice } from "../src/sim/60-infra/incidents";
import { useDeviceMenu } from "../src/ui/apps/locations/Inspector";
import { newGame, readyGame, withServer } from "./fixtures";

let forced: string | null = null;
vi.mock("../src/sim/checklist", async (orig) => {
  const m = await orig<typeof import("../src/sim/checklist")>();
  return { ...m, nextGoal: (g: never, c: never) => forced ?? m.nextGoal(g, c), cardBoard: (g: never) => ({ ...m.cardBoard(g), current: forced ? { id: "x", goals: [forced], chapter: 1 } : m.cardBoard(g).current }) };
});

const dev = () => useStore.getState().game.devices.find((d) => modelById(d.model).kind === "server")!;
const router = () => useStore.getState().game.devices.find((d) => modelById(d.model).kind === "gateway")!;
const mount = (side?: "back") => {
  const r = render(<RackPanel rackId={dev().rackId!} onClose={() => {}} {...(side ? { port: { device: dev().id, port: 0 } } : {})} />);
  return r.container;
};
const btn = (c: HTMLElement, label: string) => c.querySelector(`.wr-face:not(.out) [role=button][aria-label="${label}"]`) as SVGElement;
const down = (el: Element) => fireEvent.pointerDown(el, { button: 0 });
const up = (el: Element) => fireEvent.pointerUp(el, { button: 0 });
const tap = (el: Element) => { down(el); up(el); fireEvent.click(el); };

beforeEach(() => { vi.useFakeTimers(); useStore.setState({ game: withServer(newGame(1)) }); });
afterEach(() => { forced = null; cleanup(); vi.useRealTimers(); });

describe("rack front buttons", () => {
  it("presses at once without selecting the device or opening its tag", () => {
    const d = dev();
    d.on = true; d.bootUntil = undefined; d.setup = false; useStore.setState({ game: { ...useStore.getState().game } });
    const c = mount();
    tap(btn(c, t("art.shutDown")));
    expect(dev().haltUntil).toBeDefined();
    expect(c.querySelector(".rack-dev[aria-pressed=true]")).toBeNull();
    expect(c.querySelector(".wr-tag")).toBeNull();
  });

  it("boots a server that is off and shuts it down cleanly when on", () => {
    const g = useStore.getState().game, d = dev();
    d.on = false; d.bootUntil = undefined; useStore.setState({ game: { ...g } });
    const c = mount();
    tap(btn(c, t("art.powerOn")));
    expect(dev().on).toBe(true);
    expect(dev().bootUntil).toBeGreaterThan(0);
    expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.starting", { name: dev().label ?? dev().name }));
    // a second press while it boots only reports that it is still starting
    const before = dev().haltUntil;
    tap(btn(c, t("art.shutDown")));
    expect(dev().haltUntil).toBe(before);
    expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.stillStarting", { name: dev().label ?? dev().name }));
  });

  it("shuts a running server down on a press and cuts the power on a 2 s hold", () => {
    const g = useStore.getState().game, d = dev();
    d.on = true; d.bootUntil = undefined; d.setup = false; useStore.setState({ game: { ...g } });
    const c = mount();
    tap(btn(c, t("art.shutDown")));
    expect(dev().haltUntil).toBeDefined();
    expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.halting", { name: dev().label ?? dev().name }));
    useStore.setState({ game: { ...useStore.getState().game, devices: useStore.getState().game.devices.map((x) => (x.id === d.id ? { ...x, on: true, haltUntil: undefined } : x)) } });
    const b = btn(c, t("art.shutDown"));
    down(b);
    act(() => { vi.advanceTimersByTime(1900); });
    expect(dev().on).toBe(true);
    act(() => { vi.advanceTimersByTime(200); });
    expect(dev().on).toBe(false);
    expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.off", { name: dev().label ?? dev().name }));
    up(b);
  });

  it("reboots hard with the reset pinhole", () => {
    const g = useStore.getState().game, d = dev();
    d.on = true; d.bootUntil = undefined; d.setup = false; useStore.setState({ game: { ...g } });
    const c = mount();
    tap(btn(c, t("art.reset")));
    expect(dev().on).toBe(true);
    expect(dev().bootUntil).toBeGreaterThan(g.hour);
  });

  it("is inert when the player is not on site", () => {
    const g = useStore.getState().game, d = dev(), loc = g.locations.find((l) => l.id === g.racks.find((r) => r.id === d.rackId)!.locationId)!;
    d.on = true; d.bootUntil = undefined; d.setup = false;
    (loc as { dc?: unknown }).dc = "skyblink-eygelshoven";
    g.player.doing = "travel"; g.player.until = g.hour + 5;
    useStore.setState({ game: { ...g } });
    const c = mount();
    const b = btn(c, t("art.shutDown"));
    expect(b.querySelector("title")?.textContent).toBe(t("art.away"));
    tap(b);
    expect(dev().on).toBe(true);
    expect(dev().haltUntil).toBeUndefined();
  });

  it("switches the router from the rocker on the back", () => {
    const g = useStore.getState().game, r = router();
    r.on = true; useStore.setState({ game: { ...g } });
    const c = mount("back");
    tap(btn(c, t("art.rocker")));
    expect(router().on).toBe(false);
  });

  it("draws a filling ring while the power button is held", () => {
    const d = dev();
    d.on = true; d.bootUntil = undefined; d.setup = false; useStore.setState({ game: { ...useStore.getState().game } });
    const c = mount(), b = btn(c, t("art.shutDown"));
    down(b);
    expect(c.querySelector(".wr-face:not(.out) animate")).not.toBeNull();
    up(b);
    expect(c.querySelector(".wr-face:not(.out) animate")).toBeNull();
  });

  describe("with customers on the server", () => {
    const host = () => {
      const g = readyGame(1), d = g.devices.find((x) => modelById(x.model).kind === "server")!;
      d.on = true; d.bootUntil = undefined; d.setup = false;
      useStore.setState({ game: g });
      return mount();
    };
    const count = () => customersOnDevice(useStore.getState().game, dev().id).length;

    it("asks first, stops nothing on cancel and names the customers after the stamp", () => {
      const c = host(), n = count();
      expect(n).toBeGreaterThan(0);
      tap(btn(c, t("art.shutDown")));
      expect(c.querySelector("[data-slip=customers]")?.textContent).toContain(t("world.affected", { count: count() }));
      expect(dev().haltUntil).toBeUndefined();
      fireEvent.click(c.querySelector("[data-slip-cancel]")!);
      expect(c.querySelector("[data-slip=customers]")).toBeNull();
      expect(dev().haltUntil).toBeUndefined();
      tap(btn(c, t("art.shutDown")));
      fireEvent.click(c.querySelector("[data-slip-stamp]")!);
      expect(dev().haltUntil).toBeDefined();
      expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.customers", { line: t("world.out.halting", { name: dev().label ?? dev().name }), count: n }));
    });

    it("asks before a reset too", () => {
      const c = host();
      tap(btn(c, t("art.reset")));
      expect(c.querySelector("[data-slip=customers]")).not.toBeNull();
    });
  });

  it("marks the control the guide card needs on the drawn front", () => {
    const d = dev();
    d.on = false; d.bootUntil = undefined; useStore.setState({ game: { ...useStore.getState().game } });
    forced = "mountServer";
    expect(mount().querySelectorAll(".wr-face:not(.out) [data-guide]").length).toBe(1);
    cleanup(); forced = "plugStick";
    expect(mount().querySelector(".wr-face:not(.out) rect[data-guide]")).not.toBeNull();
    cleanup(); forced = "bootUsb";
    expect(mount().querySelector(".wr-face:not(.out) [data-guide]")).not.toBeNull();
  });

  it("asks before the router goes off while customers are behind it", () => {
    const g = readyGame(1), r = g.devices.find((x) => modelById(x.model).kind === "gateway")!;
    r.on = true; useStore.setState({ game: g });
    const c = mount("back");
    tap(btn(c, t("art.rocker")));
    expect(c.querySelector("[data-slip=customers]")).not.toBeNull();
    expect(router().on).toBe(true);
  });

  it("names the affected customers in the desktop confirm", () => {
    const g = readyGame(1), d = g.devices.find((x) => modelById(x.model).kind === "server")!;
    d.on = true; d.bootUntil = undefined; d.setup = false;
    useStore.setState({ game: g });
    let pending: { text: string } | null = null;
    function H() {
      const game = useStore((s) => s.game), menus = useDeviceMenu(game, () => {}, () => {}, undefined, true);
      pending = menus.pending ?? null;
      return <button onClick={() => menus.front(game.devices.find((x) => x.id === d.id)!, "hold")}>go</button>;
    }
    const { getByText } = render(<H />);
    fireEvent.click(getByText("go"));
    expect(pending!.text).toContain(t("world.affected", { count: customersOnDevice(useStore.getState().game, d.id).length }));
  });
});
