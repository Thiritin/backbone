import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "../src/sim/80-business/browser";
import { ARTICLES, articleBySlug, wikiUrl } from "../src/ui/apps/browser/sites/wiki/articles";
import { STEP_WIKI } from "../src/ui/apps/guide";
import { search } from "../src/ui/search/hits";
import { readyGame } from "./fixtures";

describe("Wikipedio", () => {
  it("serves every article on the wiki host", () => {
    const s = readyGame(1);
    for (const a of ARTICLES) expect(resolve(s, wikiUrl(a.slug)).page.kind).toBe("wiki");
  });

  it("has an article for every guide step and alert that links one", () => {
    const alertSheet = readFileSync("src/ui/desktop/AlertSheet.tsx", "utf8");
    const alertSlugs = [...alertSheet.matchAll(/"event\.\w+": "(\w+)"/g)].map((m) => m[1]);
    for (const slug of [...Object.values(STEP_WIKI), ...alertSlugs]) expect(articleBySlug(slug!), slug).toBeDefined();
  });

  it("lists articles in the search", () => {
    const hit = search(readyGame(1), "RAID").find((h) => h.title === "RAID");
    expect(hit).toMatchObject({ app: "Browser", target: { kind: "url", id: wikiUrl("RAID") } });
  });
});
