import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import type { Dict } from "../src/i18n/lang";
import { hourOfMonth } from "../src/sim/00-core/time";
import { SITES } from "../src/sim/10-catalog/sites";
import { versionInfo, versionsOf } from "../src/sim/10-catalog/software-versions";
import { feed, newsTick } from "../src/sim/80-business/news";
import { PlainSite, productOf, type SitePage } from "../src/ui/apps/browser/sites/software/SoftwareSite";
import { SITE_VIEWS } from "../src/ui/apps/browser/sites/software/registry";
import { newGame } from "./fixtures";

const packs = import.meta.glob<{ default: Dict }>("../src/i18n/*/ui-releases*.ts", { eager: true });
const kindOf = (id: string) => (id === "lunix" || id === "windoors" ? "os" : "software");
const page = (id: string, at: number, pg: SitePage) => {
  const p = productOf(kindOf(id), id)!, View = SITE_VIEWS[id] ?? PlainSite;
  return p.site.eras.map(({ look, from }) => renderToString(<View p={p} look={look} page={pg} year={from} hour={at} go={() => {}} />));
};

describe("vendor versions and news", () => {
  it("lists only the versions released by now", () => {
    const at = hourOfMonth("2013-01");
    for (const html of page("cpanic", at, "versions")) {
      expect(html).toContain("11.34");
      expect(html).not.toContain("11.36");
      expect(html).toContain("End of life");
    }
  });

  it("posts the announcement in its release month", () => {
    const v = versionInfo("cpanic", "11.36")!;
    for (const html of page("cpanic", v.release - 1, "news")) expect(html).not.toContain("cPanic 11.36 released");
    for (const html of page("cpanic", v.release, "news")) {
      expect(html).toContain("cPanic 11.36 released");
      expect(html.indexOf("cPanic 11.36 released")).toBeLessThan(html.indexOf("cPanic 11.34 released"));
    }
  });

  it("shows both pages on every software and OS site", () => {
    for (const id of Object.keys(SITES)) {
      const last = versionsOf(id).at(-1)!;
      for (const html of page(id, hourOfMonth("2026-11"), "versions")) expect(html).toContain(last.version);
      for (const html of page(id, hourOfMonth("2026-11"), "news")) expect(html).toContain(`${productOf(kindOf(id), id)!.name} ${last.version}`);
    }
  });

  it("has two to four headline features for every version in every language", () => {
    const keys = Object.keys(SITES).flatMap((id) => versionsOf(id).map((v) => `swnews.${id}.${v.version}`));
    const count = (d: Dict, k: string) => d[k]?.({}).split("|").filter(Boolean).length ?? 0;
    for (const k of keys) expect([2, 3, 4], k).toContain(count(en, k));
    for (const lang of ["de", "es", "fr", "it", "pt"]) {
      const dict: Dict = Object.assign({}, ...Object.entries(packs).filter(([p]) => p.includes(`/${lang}/`)).map(([, m]) => m.default));
      expect(keys.filter((k) => count(dict, k) !== count(en, k)), lang).toEqual([]);
    }
  });

  it("announces a new major in the game news on its release day", () => {
    const s = newGame(3), major = versionInfo("proxmocks", "9.0")!, minor = versionInfo("proxmocks", "8.4")!;
    s.hour = minor.release + 10;
    expect(newsTick(s).filter((e) => String(e.params.name).startsWith("Proxmocks"))).toEqual([]);
    s.hour = major.release + 10;
    expect(newsTick(s)).toContainEqual({ app: "News", key: "event.news.swVersion", params: { name: "Proxmocks 9.0", url: "www.proxmocks.com/news" } });
    expect(feed(s)[0].params.name).toBe("Proxmocks 9.0");
  });
});
