import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { phpAt } from "../src/sim/10-catalog/platforms";
import { newGame } from "../src/sim/50-state";
import { feed, NEWS, newsTick } from "../src/sim/80-business/news";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const at = (year: number) => hourOf(new Date(Date.UTC(year, 0, 1, 9)));
const on = (s: ReturnType<typeof newGame>, hour: number) => { s.hour = hour; return newsTick(s); };
const KEYS = ["models", "shape", "feature", "desk", "training", "homeLines", "ports", "freeSsl"].map((k) => `event.news.${k}`);

describe("news of unlocks", () => {
  it("announces each new kind of unlock once, on 1 January of its year", () => {
    const s = newGame(3);
    const defs = NEWS.filter((d) => KEYS.includes(d.key)).sort((a, b) => a.at - b.at);
    expect(new Set(defs.map((d) => d.key))).toEqual(new Set(KEYS));
    for (const hour of new Set(defs.map((d) => d.at))) {
      const events = on(s, hour);
      for (const d of defs.filter((x) => x.at === hour)) expect(events.filter((e) => e.key === d.key && e.params === d.params)).toHaveLength(1);
      expect(on(s, hour).filter((e) => KEYS.includes(e.key))).toEqual([]);
    }
    for (const d of defs) expect(s.news.filter((e) => e.startsWith(`${d.id}@`))).toHaveLength(1);
  });

  it("names what arrives", () => {
    const s = newGame(3);
    const years = new Map([2007, 2008, 2011, 2012, 2016].map((y) => [y, on(s, at(y))]));
    const of = (year: number, key: string) => years.get(year)!.filter((e) => e.key === key).map((e) => t(`${e.key}.text`, e.params));
    expect(of(2007, "event.news.desk")).toEqual([expect.stringContaining("Zendusk")]);
    expect(of(2007, "event.news.homeLines")).toEqual([expect.stringContaining("VDSL 50 (Deutsche Telekomm)")]);
    const y2008 = years.get(2008)!.map((e) => t(`${e.key}.text`, e.params)).join("\n");
    expect(y2008).toContain("L2 switch 48, L3 switch 48");
    expect(y2008).toContain("Twin node servers");
    expect(y2008).toContain("10 Gbit/s ports");
    expect(of(2011, "event.news.training")).toEqual([expect.stringContaining("GPU computing")]);
    expect(of(2012, "event.news.feature").join(" ")).toMatch(/HyperVee balloons guest RAM.*HyperVee runs as one cluster|HyperVee runs as one cluster.*HyperVee balloons/);
    expect(of(2016, "event.news.freeSsl")).toHaveLength(1);
  });

  it("lists the yearly releases of the installed software only", () => {
    const s = readyGame(7);
    const [e] = on(s, at(2009)).filter((x) => x.key === "event.news.release");
    const php = phpAt(2009) !== phpAt(2008) ? [`PHP ${phpAt(2009)}`] : [];
    expect(e.params).toEqual({ year: 2009, names: ["FreePanel", "Proxmocks", ...php].join("|") });
    expect(t("event.news.release.text", e.params)).not.toMatch(/cPanic|Pleskit|VMwhere/);
    expect(feed(deserialize(serialize(s))).find((x) => x.key === "event.news.release")?.params).toEqual(e.params);
  });

  it("leaves out software that is new this year and PHP without a panel", () => {
    const s = readyGame(7);
    s.clusters = s.clusters.filter((c) => c.kind !== "panel");
    expect(on(s, at(2008)).filter((x) => x.key === "event.news.release")).toEqual([]);
    expect(on(s, at(2010)).find((x) => x.key === "event.news.release")!.params.names).toBe("Proxmocks");
  });

  it("sends no release news without installed software", () => {
    const s = newGame(3);
    expect(on(s, at(2010)).filter((x) => x.key === "event.news.release")).toEqual([]);
  });
});
