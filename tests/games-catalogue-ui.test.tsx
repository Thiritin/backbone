import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { GameDetails, TitleCatalogue } from "../src/ui/apps/browser/consoles/GamePanel";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { writeTitleConfig } from "../src/sim/90-actions/games";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function world(year: number) {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, year);
  return { s, cluster: panelServer(s, two, "tcadmen") };
}

describe("title catalogue screens", () => {
  it("list each title's status and the requests lost to it", () => {
    const { s } = world(2014);
    s.gameLost = { rost: [s.hour - 1, s.hour - 2] };
    ok(writeTitleConfig(s, "tcadmen", "terrarea"));
    const html = renderToString(<TitleCatalogue game={deserialize(serialize(s))} panel="tcadmen" />);
    expect(html).toContain("Counter-Strife 1.6");
    expect(html).toContain("Offered");
    expect(html).toContain("Config ready on");
    expect(html).toContain("Write config for");
    expect(html).toContain("Requests declined: 2");
  });

  it("offer the switch the customer asked for in the server settings", () => {
    const { s, cluster } = world(2014), customer = addCustomer(s, "Ada Lang", "hobbyDev");
    const id = ok(provisionService(s, customer, "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, 2014), clusterId: cluster, title: "counterstrife" }));
    const plain = renderToString(<GameDetails game={s} serviceId={id} panel="pterodaktyl" />);
    expect(plain).not.toContain("Switch to");
    s.gameServers = s.gameServers.map((g) => ({ ...g, switchTo: "teamfortune" }));
    expect(renderToString(<GameDetails game={s} serviceId={id} panel="pterodaktyl" />)).toContain("Switch to Team Fortune");
  });
});
