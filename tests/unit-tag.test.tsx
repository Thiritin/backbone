// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { modelById, modelName } from "../src/sim/10-catalog/hardware";
import { useDeviceMenu } from "../src/ui/apps/locations/Inspector";
import { useStore } from "../src/ui/store";
import { UnitTag } from "../src/ui/world/rack/UnitTag";
import { newGame, withServer } from "./fixtures";

let renamed = false, sold = 0, results: string[] = [];
function Harness({ id }: { id: string }) {
  const game = useStore((s) => s.game);
  const menus = useDeviceMenu(game, () => {}, () => {}, undefined, true);
  (globalThis as { menus?: typeof menus }).menus = menus;
  return game.devices.some((d) => d.id === id) ? <UnitTag deviceId={id} renaming={renamed} onRenaming={() => {}} menus={menus} onSold={() => { sold++; }} onResult={(r, n) => results.push(`${r}:${n}`)} /> : null;
}

function mount(game = withServer(newGame(1))) {
  const dev = game.devices.find((d) => modelById(d.model).kind === "server" && d.rackId)!;
  useStore.setState({ game });
  const view = render(<Harness id={dev.id} />);
  return { dev, view };
}

afterEach(() => { cleanup(); renamed = false; sold = 0; results = []; });

describe("asset tag", () => {
  it("shows name, brand and model, rack unit and inventory number", () => {
    const { dev, view } = mount();
    const m = modelById(dev.model), text = view.container.textContent!;
    expect(text).toContain(`${dev.brand} ${modelName(m, dev.brand)}`);
    expect(view.container.querySelector("[data-unit]")!.textContent).toBe(t("world.tagUnit", { n: dev.slot }));
    expect(view.container.querySelector("[data-inv]")!.textContent).toBe(t("world.tagInv", { n: dev.id.replace(/\D/g, "").padStart(4, "0") }));
  });

  it("carries no buttons and no pictogram grid", () => {
    const { view } = mount();
    expect(view.container.querySelectorAll("button").length).toBe(0);
    expect(view.container.querySelector(".wk-grid, .wk-power, [data-cart], [data-ports]")).toBeNull();
  });

  it("adds a red line only when a part failed", () => {
    const { dev, view } = mount();
    expect(view.container.querySelector("[data-fault]")).toBeNull();
    cleanup();
    const g = withServer(newGame(1));
    g.devices.find((d) => d.id === dev.id)!.components[0].failedAt = 1;
    const second = mount(g);
    expect(second.view.container.querySelector("[data-fault]")).not.toBeNull();
  });

  it("shows an inline name field while renaming", () => {
    renamed = true;
    const { view } = mount();
    expect(view.container.querySelector("input")).not.toBeNull();
  });

  it("commits a rename on Enter, refuses an empty name and cancels on Escape", () => {
    renamed = true;
    const { dev, view } = mount();
    const field = () => view.container.querySelector("input")!;
    fireEvent.change(field(), { target: { value: "web-01" } });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(results).toEqual([]);
    expect(useStore.getState().game.devices.find((d) => d.id === dev.id)!.label ?? null).toBeNull();
    fireEvent.change(field(), { target: { value: "  " } });
    fireEvent.blur(field());
    expect(results).toEqual(["empty:"]);
    fireEvent.change(field(), { target: { value: "web-01" } });
    fireEvent.blur(field());
    expect(results).toEqual(["empty:", "renamed:web-01"]);
    expect(useStore.getState().game.devices.find((d) => d.id === dev.id)!.label).toBe("web-01");
  });

  it("confirms a sale from the menu on a slip, and the stamp removes the device", () => {
    const { dev, view } = mount();
    expect(view.container.querySelector("[data-slip=sell]")).toBeNull();
    const menus = (globalThis as { menus?: ReturnType<typeof useDeviceMenu> }).menus!;
    const entry = menus.entries(dev, false, {}).find((e) => e && "label" in e && e.label === t("locations-1.sell"));
    act(() => { (entry as { run: () => void }).run(); });
    expect(view.container.querySelector("[data-slip=sell]")).not.toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    fireEvent.click(view.container.querySelector("[data-slip-cancel]")!);
    expect(view.container.querySelector("[data-slip=sell]")).toBeNull();
    act(() => { (entry as { run: () => void }).run(); });
    fireEvent.click(view.container.querySelector("[data-slip-stamp]")!);
    expect(useStore.getState().game.devices.some((d) => d.id === dev.id)).toBe(false);
    expect(sold).toBe(1);
  });
});
