import { describe, expect, it } from "vitest";
import { dateOf, hourOf } from "../src/sim/00-core/time";
import { newGame, type GameState } from "../src/sim/50-state";
import { openVulns } from "../src/sim/60-infra/vulns";
import { NEWS } from "../src/sim/80-business/news";
import { tick } from "../src/sim/88-tick/tick";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { AUTO_UPDATE_HOUR, setAutoUpdate } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const start = (panel: string, y: number) => {
  const s = { ...withServer(newGame(1)), cash: 100_000 }, id = panelServer(s, "dev3", panel);
  s.hour = year(y);
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, version: 2005, updatedAt: 0 } : c));
  return { s, id };
};
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
// Ticks up to the hour before the night update, then through it.
const toNight = (s: GameState) => { while (dateOf(s.hour + 1).getUTCHours() !== AUTO_UPDATE_HOUR) tick(s); };

describe("automatic updates", () => {
  it("are refused before the software's year and for software without them", () => {
    const early = start("cpanic", 2007);
    expect(err(setAutoUpdate(early.s, early.id, true))).toBe("error.noAutoUpdate");
    const free = start("freepanel", 2030);
    expect(err(setAutoUpdate(free.s, free.id, true))).toBe("error.noAutoUpdate");
    expect(err(setAutoUpdate(free.s, "nope", true))).toBe("error.unknownCluster");
  });

  it("are off by default and switch on from the year", () => {
    const { s, id } = start("cpanic", 2008);
    expect(cluster(s, id).autoUpdate).toBeFalsy();
    expect(err(setAutoUpdate(s, id, true))).toBe("ok");
    expect(cluster(s, id).autoUpdate).toBe(true);
  });

  it("update a due cluster at night, closing its vulnerabilities", () => {
    const { s, id } = start("cpanic", 2030);
    expect(openVulns(s, id).length).toBeGreaterThan(0);
    setAutoUpdate(s, id, true);
    toNight(s);
    expect(cluster(s, id).version).toBe(2005);
    tick(s);
    expect(cluster(s, id)).toMatchObject({ version: 2030, updatedAt: s.hour });
    expect(openVulns(s, id)).toEqual([]);
  });

  it("leave the cluster alone when off", () => {
    const { s, id } = start("cpanic", 2030);
    toNight(s);
    tick(s);
    expect(cluster(s, id).version).toBe(2005);
  });

  it("stay off for an old save without the setting", () => {
    const { s, id } = start("pleskit", 2030);
    setAutoUpdate(s, id, true);
    const data = JSON.parse(serialize(s));
    for (const c of data.clusters) delete c.autoUpdate;
    const back = deserialize(JSON.stringify(data));
    expect(cluster(back, id).autoUpdate).toBeFalsy();
    toNight(back);
    tick(back);
    expect(cluster(back, id).version).toBe(2005);
  });

  it("are announced in the news in the year they arrive", () => {
    expect(NEWS.find((n) => n.id === "autoUpdate.cpanic")).toMatchObject({ key: "event.news.autoUpdate", at: year(2008) + 9, params: { name: "cPanic" } });
  });
});
