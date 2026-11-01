import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { tick } from "../src/sim/88-tick/tick";
import { feed, NEWS, newsTick } from "../src/sim/80-business/news";
import { deserialize, serialize } from "../src/sim/91-save/save";

const at = (year: number, month = 0, hour = 9) => hourOf(new Date(Date.UTC(year, month, 1, hour)));
// The news of the hour a game reaches the given date.
const on = (s: ReturnType<typeof newGame>, hour: number) => { s.hour = hour; return newsTick(s); };

describe("news", () => {
  it("announces a software on 1 January of its first year", () => {
    const s = newGame(1), from = SOFTWARE.find((x) => x.id === "proxmocks")!.from;
    expect(on(s, at(from) - 1)).toEqual([]);
    const [e] = on(s, at(from));
    expect(e).toMatchObject({ app: "News", key: "event.news.software", params: { name: "Proxmocks" } });
    expect(t(`${e.key}.text`, e.params)).toContain("Heize online");
  });

  it("announces nothing for what exists at the start", () => {
    const s = newGame(1);
    expect(NEWS.every((d) => d.at > at(2005))).toBe(true);
    expect(on(s, at(2005))).toEqual([]);
  });

  it("announces a server generation on the day it reaches the shop", () => {
    const s = newGame(1);
    const e = on(s, at(2008)).find((x) => x.key === "event.news.generation")!;
    expect(e).toMatchObject({ key: "event.news.generation", params: { gen: 2, cores: 8 } });
    expect(t(`${e.key}.title`, e.params)).toBe("G2 servers in the shop");
  });

  it("announces IPv6, RIPE's last /8 and run-out and the website designs on their dates", () => {
    const keys = (hour: number) => on(newGame(1), hour).map((e) => e.key);
    expect(keys(at(2010))).toContain("event.news.ipv6Dc");
    expect(keys(at(2013))).toContain("event.news.ipv6Home");
    expect(keys(at(2012, 8))).toEqual(["event.news.ripeLast"]);
    expect(keys(at(2019, 10))).toEqual(["event.news.ripeOut"]);
    expect(keys(at(2009))).toContain("event.news.design");
    expect(keys(at(2013))).toContain("event.news.design");
    expect(keys(at(2011))).not.toContain("event.news.design");
  });

  it("gives every announcement a headline and a sentence from a punned outlet", () => {
    for (const d of NEWS) {
      expect(t(`${d.key}.title`, d.params)).not.toBe(`${d.key}.title`);
      expect(t(`${d.key}.text`, d.params)).toMatch(/^(Heize online|Golem\.dy|Handelsblah) /);
    }
  });

  it("does not repeat an announcement", () => {
    const s = newGame(1);
    expect(on(s, at(2008)).length).toBeGreaterThan(0);
    expect(on(s, at(2008))).toEqual([]);
    expect(s.news.filter((e) => e.startsWith("generation.2@"))).toHaveLength(1);
  });

  it("lists the published news newest first", () => {
    const s = newGame(1);
    on(s, at(2008));
    on(s, at(2010));
    const hours = feed(s).map((n) => n.hour);
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    expect(new Set(hours)).toEqual(new Set([at(2010), at(2008)]));
  });

  it("loads a save without news and does not replay what already happened", () => {
    const s = newGame(1);
    s.hour = at(2015, 5, 0);
    const raw = JSON.parse(serialize(s));
    delete raw.news;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.news).toEqual([]);
    const events = Array.from({ length: 48 }, () => tick(loaded)).flat();
    expect(events.filter((e) => e.app === "News" && e.key !== "event.news.swVersion")).toEqual([]);
  });
});
