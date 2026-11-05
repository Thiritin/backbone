// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { modelById } from "../src/sim/10-catalog/hardware";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

const dev = () => useStore.getState().game.devices.find((d) => modelById(d.model).kind === "server")!;
const router = () => useStore.getState().game.devices.find((d) => modelById(d.model).kind === "gateway")!;
const mount = (side?: "back") => {
  const r = render(<RackPanel rackId={dev().rackId!} onClose={() => {}} {...(side ? { port: { device: dev().id, port: 0 } } : {})} />);
  return r.container;
};
const front = (c: HTMLElement, id: string) => c.querySelector(`.wr-face:not(.out) .rack-dev[aria-label="${useStore.getState().game.devices.find((d) => d.id === id)!.name}"]`) as SVGGElement;
const btn = (c: HTMLElement, label: string) => c.querySelector(`.wr-face:not(.out) [role=button][aria-label="${label}"]`) as SVGElement;
const down = (el: Element) => fireEvent.pointerDown(el, { button: 0 });
const up = (el: Element) => fireEvent.pointerUp(el, { button: 0 });
const tap = (el: Element) => { down(el); up(el); fireEvent.click(el); };
const select = (c: HTMLElement, id: string) => fireEvent.click(front(c, id));

beforeEach(() => { vi.useFakeTimers(); useStore.setState({ game: withServer(newGame(1)) }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("rack front buttons", () => {
  it("does nothing on a server that is not selected, the first click selects it", () => {
    const c = mount(), d = dev(), on = d.on;
    tap(btn(c, on ? t("art.shutDown") : t("art.powerOn")));
    expect(dev().on).toBe(on);
    expect(c.querySelector(".rack-dev[aria-pressed=true]")).not.toBeNull();
  });

  it("boots a selected server that is off and shuts it down cleanly when on", () => {
    const g = useStore.getState().game, d = dev();
    d.on = false; d.bootUntil = undefined; useStore.setState({ game: { ...g } });
    const c = mount();
    select(c, d.id);
    tap(btn(c, t("art.powerOn")));
    expect(dev().on).toBe(true);
    expect(dev().bootUntil).toBeGreaterThan(0);
    expect(c.querySelector(".wr-out")?.textContent).toBe(t("world.out.starting", { name: dev().label ?? dev().name }));
    // a second press while it boots is ignored by the unresponsive OS
    const before = dev().haltUntil;
    tap(btn(c, t("art.shutDown")));
    expect(dev().haltUntil).toBe(before);
  });

  it("shuts a running server down on a press and cuts the power on a 2 s hold", () => {
    const g = useStore.getState().game, d = dev();
    d.on = true; d.bootUntil = undefined; d.setup = false; useStore.setState({ game: { ...g } });
    const c = mount();
    select(c, d.id);
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
    select(c, d.id);
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
    select(c, d.id);
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
    select(c, r.id);
    tap(btn(c, t("art.rocker")));
    expect(router().on).toBe(false);
  });
});
