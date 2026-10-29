import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { buyDevice } from "../src/sim/90-actions/hardware";
import { tidy, type MenuItem } from "../src/ui/desktop/menu";
import { deviceMenu, type DeviceUi } from "../src/ui/apps/locations/deviceMenu";
import { useStore } from "../src/ui/store";
import { withServer } from "./fixtures";

const ui: DeviceUi = { power: () => {}, plug: () => {}, setup: () => {}, rename: () => {}, unmount: () => {}, sell: () => {} };
const labels = (g: GameState, id: string, extra: Partial<DeviceUi> = {}) =>
  tidy(deviceMenu(g, g.devices.find((d) => d.id === id)!, { ...ui, ...extra })).map((e) => e?.label ?? "-");

describe("device menu", () => {
  it("lists a free mounted server's actions, the second power supply with its price, and removal last", () => {
    const g = withServer(newGame(7));
    expect(labels(g, "dev3", { open: () => {} })).toEqual([
      "Show details", "-", "Power off", "Unplug power supply", "-", "Add Software…", "-",
      "Add second power supply, 250 €", "Rename…", "-", "Unmount", "Sell…",
    ]);
  });

  it("offers power and sale only for a device in storage", () => {
    const g = { ...withServer(newGame(7)), cash: 10_000 };
    const id = buyDevice(g, "g1-compute-2psu", "Dwell", 1, "loc1");
    if (!id.ok) throw new Error(id.error);
    const items = tidy(deviceMenu(g, g.devices.find((d) => d.id === id.id)!, ui)).filter((e): e is MenuItem => !!e);
    expect(items.map((e) => e.label)).toEqual(["Power off", "Rename…", "Sell…"]);
    expect(items[0].disabled).toBe(true);
  });

  it("runs its sim items through the store", () => {
    const g = withServer(newGame(7));
    useStore.setState({ game: g });
    const add = tidy(deviceMenu(g, g.devices.find((d) => d.id === "dev3")!, ui)).find((e) => e?.label.startsWith("Add second"));
    add!.run!();
    expect(useStore.getState().game.devices.find((d) => d.id === "dev3")!.model).toBe("g1-compute-2psu");
  });
});
