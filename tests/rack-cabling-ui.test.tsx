// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

// The basement server and router with no cable and no power cord yet.
function bare() {
  const s = withServer(newGame(1));
  s.cables = [];
  for (const d of s.devices) for (const c of d.components) if (c.kind === "psu") c.plugged = false;
  useStore.setState({ game: s });
  return s;
}
const back = () => render(<RackPanel rackId="rack2" onClose={() => {}} port={{ device: "dev3", port: 0 }} />).container;

describe("rack back cabling", () => {
  it("marks the router line, router LAN, server NIC and server power until cabled, and tags the unpowered server", () => {
    bare();
    const c = back();
    expect(c.querySelectorAll(".wr-face:not(.out) .rack-need").length).toBe(4);
    expect(c.textContent).toContain(t("locations-1.stNoPower"));
  });

  // jsdom has no layout: one screen pixel per SVG unit.
  const ctm = () => ({ a: 1, d: 1, e: 0, f: 0 });
  const seated = () => {
    const s = bare();
    s.devices.find((d) => d.id === "dev3")!.components.forEach((c) => { if (c.kind === "psu") c.plugged = true; });
    useStore.setState({ game: { ...s } });
    (SVGSVGElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = ctm;
    document.elementFromPoint = () => null;
    return back();
  };
  const pull = (c: HTMLElement, dist: number) => {
    const el = c.querySelector(".rack-seated")!, at = (k: string) => Number(el.getAttribute(k));
    const x = at("x") + at("width") / 2, y = at("y") + at("height") / 2;
    fireEvent(el, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: x, clientY: y }));
    fireEvent(window, new MouseEvent("pointermove", { clientX: x - dist, clientY: y }));
    fireEvent(window, new MouseEvent("pointerup", { clientX: x - dist, clientY: y }));
  };
  // Unplugging takes effect at once: no order, the cord is out.
  const plugs = () => useStore.getState().game.devices.find((d) => d.id === "dev3")!.components.filter((x) => x.kind === "psu" && x.plugged).length;

  it("keeps the cord seated when the plug is pulled less than the threshold", () => {
    const c = seated(), n = plugs();
    pull(c, 5);
    expect(plugs()).toBe(n);
  });

  it("unplugs the cord when the plug is pulled past the threshold", () => {
    const c = seated(), n = plugs();
    pull(c, 40);
    expect(plugs()).toBe(n - 1);
  });

  it("unplugs from the keyboard with Delete on a focused cord", () => {
    const c = seated(), n = plugs();
    fireEvent.keyDown(c.querySelector(".rack-seated")!, { key: "Delete" });
    expect(plugs()).toBe(n - 1);
  });

  it("takes a data port as the cable in hand with Enter", () => {
    bare();
    const held: unknown[] = [];
    const c = render(<RackPanel rackId="rack2" onClose={() => {}} port={{ device: "dev3", port: 0 }} onHand={(e) => held.push(e)} />).container;
    fireEvent.keyDown(c.querySelector('.wr-face:not(.out) [data-end="dev3:0"]')!, { key: "Enter" });
    expect(held).toEqual([{ device: "dev3", port: 0 }]);
  });
});
