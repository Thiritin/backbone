import { expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { feedByDay } from "../src/sim/80-business/news";

it("groups published news by day", () => {
  const s = newGame(1), h = hourOf(new Date(Date.UTC(2009, 0, 1, 9)));
  s.news = [`freeSsl@${h}`, `freeSsl@${h + 2}`, `freeSsl@${h + 30}`];
  const d = feedByDay(s);
  expect(d.get("2009-01-01")).toHaveLength(2);
  expect(d.get("2009-01-02")).toHaveLength(1);
});
