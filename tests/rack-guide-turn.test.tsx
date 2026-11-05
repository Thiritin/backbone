// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

describe("rack panel card step", () => {
  it("turns an open front view to the back when the cabling step opens", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    useStore.setState({ game: withServer(newGame(1)) });
    const r = render(<RackPanel rackId="rack2" onClose={() => {}} guide="mount" />);
    expect(r.container.querySelectorAll("[data-end]").length).toBe(0);
    r.rerender(<RackPanel rackId="rack2" onClose={() => {}} device="dev3" guide="cable" />);
    expect(r.container.querySelectorAll("[data-end]").length).toBeGreaterThan(0);
  });
});

describe("rack panel mount step", () => {
  it("drops the free-unit outline once a device is racked", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const s = withServer(newGame(1));
    const dev = s.devices.find((d) => d.rackId === "rack2")!;
    useStore.setState({ game: { ...s, devices: s.devices.map((d) => (d === dev ? { ...d, rackId: null } : d)) } });
    const r = render(<RackPanel rackId="rack2" onClose={() => {}} guide="mount" />);
    expect(r.container.querySelectorAll("[data-guide]").length).toBeGreaterThan(0);
    useStore.setState({ game: s });
    r.rerender(<RackPanel rackId="rack2" onClose={() => {}} guide="mount" />);
    expect(r.container.querySelectorAll("[data-guide]").length).toBe(0);
  });
});
