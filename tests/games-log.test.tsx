import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { gameLog, gameOf, playersOf } from "../src/sim/60-infra/games";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { GameDetails } from "../src/ui/apps/browser/consoles/GamePanel";
import { panelVm, readyGame, skipTo } from "./fixtures";

function server() {
  const s = readyGame(1);
  skipTo(s, 2012);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "multikraft");
  const r = provisionService(s, addCustomer(s, "Ada Lang", "hobbyDev"), "gameServer", { label: "ada", spec: sizeSpec("gameServer", 0, 2012), clusterId: id, title: "blockcraft" });
  if (!r.ok) throw new Error(r.error);
  s.hour += 24 * 3 + 20;
  return { s, serviceId: r.id! };
}

describe("game console log", () => {
  it("is the same for a seed and an hour", () => {
    const { s, serviceId } = server();
    expect(gameLog(s, serviceId, s.hour, 200)).toEqual(gameLog(s, serviceId, s.hour, 200));
  });

  it("joins minus leaves equals the players gained over the window", () => {
    const { s, serviceId } = server();
    const lines = gameLog(s, serviceId, s.hour, 10_000), count = (k: string) => lines.filter((l) => l.key === k).length;
    expect(count("games.log.join") - count("games.log.leave")).toBe(playersOf(s, serviceId)!.players - playersOf(s, serviceId, s.hour - 24)!.players);
  });

  it("writes a crash line after a crash and the restart notice with auto-restart", () => {
    const { s, serviceId } = server();
    expect(gameLog(s, serviceId, s.hour, 10_000).some((l) => l.key === "games.log.crash")).toBe(false);
    const g = gameOf(s, serviceId)!;
    g.crashedAt = s.hour - 2;
    g.auto = true;
    const keys = gameLog(s, serviceId, s.hour, 10_000).map((l) => l.key);
    expect(keys).toContain("games.log.crash");
    expect(keys).toContain("games.log.autoRestart");
  });

  it("draws the Console tab of each panel", () => {
    const { s, serviceId } = server();
    for (const panel of ["tcadmen", "multikraft", "pterodaktyl"]) {
      const html = renderToString(<GameDetails game={s} serviceId={serviceId} panel={panel} />);
      expect(html).toContain("Console");
    }
  });
});
