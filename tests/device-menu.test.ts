import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { buyDevice } from "./fixtures";
import { tidy, type MenuItem } from "../src/ui/desktop/menu";
import { deviceMenu, type DeviceUi } from "../src/ui/apps/locations/deviceMenu";
import { useStore } from "../src/ui/store";
import { withServer } from "./fixtures";

const ui: DeviceUi = { power: () => {}, op: () => {}, front: () => {}, plug: () => {}, rename: () => {}, unmount: () => {}, sell: () => {} };
const labels = (g: GameState, id: string, extra: Partial<DeviceUi> = {}) =>
  tidy(deviceMenu(g, g.devices.find((d) => d.id === id)!, { ...ui, ...extra })).map((e) => e?.label ?? "-");

describe("device menu", () => {
  it("lists a free mounted server's actions, the second power supply with its price, and removal last", () => {
    const g = withServer(newGame(7));
    expect(labels(g, "dev3", { open: () => {} })).toEqual([
      "Show details", "-", "Shut down", "Reboot", "At the server", "-", "Burn-in", "-",
      "Add second power supply, 250 €", "Rename…", "-", "Unmount", "Sell…",
    ]);
  });

  it("routes a server's power through its management controller when it has one", () => {
    const g = withServer(newGame(7));
    Object.assign(g.devices.find((d) => d.id === "dev3")!, { model: "g2-compute" });
    expect(labels(g, "dev3").slice(0, 6)).toEqual(["Shut down via iDRAQ", "Reboot via iDRAQ", "Reset via iDRAQ", "Power cycle via iDRAQ", "Power off via iDRAQ", "At the server"]);
    g.devices.find((d) => d.id === "dev3")!.bmcHung = true;
    expect(labels(g, "dev3").slice(0, 4)).toEqual(["Shut down", "Reboot", "Reset iDRAQ", "At the server"]);
    const front = deviceMenu(g, g.devices.find((d) => d.id === "dev3")!, ui).find((e) => e && e.label === "At the server");
    expect(front && front.items?.map((e) => e && e.label)).toEqual(["Press power button"]);
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
