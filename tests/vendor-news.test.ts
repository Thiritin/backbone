import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf, START_YEAR } from "../src/sim/00-core/time";
import { brandFrom, manufacturerByName, modelById } from "../src/sim/10-catalog/hardware";
import { NEWS, newsTick } from "../src/sim/80-business/news";
import { vendorReleases, VENDORS } from "../src/sim/80-business/vendors";

const at = (month: number) => hourOf(new Date(Date.UTC(Math.floor(month / 12), month % 12, 1, 9)));
const brand = (name: string) => manufacturerByName(name)!;
const names = (name: string, month: number) => vendorReleases(brand(name), month).map((r) => r.model.name);
const sw48 = brandFrom(modelById("sw-48"), "Sysko"), mx80 = brandFrom(modelById("mx80"), "Junipurr");

describe("vendor news", () => {
  it("lists a brand's releases up to the month, newest first", () => {
    expect(names("Sysko", sw48 - 1)).not.toContain("Catalust 2960S-48TD");
    expect(names("Sysko", sw48)).toContain("Catalust 2960S-48TD");
    expect(names("Sysko", sw48)).not.toContain("Nexxus 3064");
    expect(names("Junipurr", mx80)).toContain("MX80");
    expect(names("Junipurr", 2030 * 12)).not.toContain("Edge router S");
    expect(names("Eatin", 2005 * 12)).toEqual(expect.arrayContaining(["UPS 1500 VA", "Switched PDU 8"]));
    for (const v of VENDORS) {
      const out = vendorReleases(v, 2016 * 12);
      expect(out.every((r, i) => r.month <= 2016 * 12 && (i === 0 || out[i - 1].month >= r.month))).toBe(true);
      for (const r of out) expect(t(r.key, r.params)).toMatch(new RegExp(`^${v.name} ships the .+\\.$`));
    }
  });

  it("announces a release in the News app on its month and links to the brand's news page", () => {
    const s = newGame(3);
    s.hour = at(mx80) - 24;
    expect(newsTick(s).filter((e) => e.key === "event.news.vendor" && e.params.brand === "Junipurr")).toEqual([]);
    s.hour = at(mx80);
    const [e] = newsTick(s).filter((x) => x.key === "event.news.vendor" && x.params.brand === "Junipurr");
    expect(e.params.url).toBe("www.junipurr.net/news");
    expect(t("event.news.vendor.text", e.params)).toContain("MX80");
    expect(newsTick(s).filter((x) => x.key === "event.news.vendor")).toEqual([]);
  });

  it("announces a brand's shifted release month and nothing that exists at the start", () => {
    const hp = brand("Hewlett-Packet"), first = vendorReleases(hp).filter((r) => r.month > START_YEAR * 12).at(-1)!;
    expect(first.month).toBe(brandFrom(first.model, "Dwell") + (hp.fromShift ?? 0));
    expect(NEWS.find((d) => d.id === `vendor.hewlett-packet.${first.month}`)?.at).toBe(at(first.month));
    expect(NEWS.filter((d) => d.key === "event.news.vendor" && d.at <= at(START_YEAR * 12))).toEqual([]);
  });
});
