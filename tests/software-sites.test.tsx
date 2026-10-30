import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { IndexSite } from "../src/ui/apps/browser/sites/index/IndexSite";
import { productOf, type SitePage } from "../src/ui/apps/browser/sites/software/SoftwareSite";
import { SITE_VIEWS } from "../src/ui/apps/browser/sites/software/registry";
import { readyGame, skipTo } from "./fixtures";

const PAGES: SitePage[] = ["home", "features", "pricing", "download"];

describe("software sites", () => {
  it("mounts every site in both eras on every page", () => {
    for (const [id, View] of Object.entries(SITE_VIEWS)) {
      const p = productOf(id === "lunix" || id === "windoors" ? "os" : "software", id)!;
      expect(p.site.eras.map((e) => e.look)).toEqual(["early", "late"]);
      for (const { look, from } of p.site.eras) for (const page of PAGES) {
        const html = renderToString(<View p={p} look={look} page={page} year={from} go={() => {}} />);
        expect(html).toContain(page === "pricing" ? (p.sw?.pricing === "free" || p.os?.fee === 0 ? "Free" : "€") : "<nav");
        if (page === "download" && p.sw?.install.kind !== "gui" && p.sw) expect(html).toContain(p.sw.install.commands[0].split(" ")[0]);
      }
    }
  });

  it("notes the Windoors license where the software needs it", () => {
    const html = renderToString(<SITE_VIEWS.tcadmen p={productOf("software", "tcadmen")!} look="early" page="pricing" year={2005} go={() => {}} />);
    expect(html).toContain("runs on Windoors Server");
    expect(renderToString(<SITE_VIEWS.cpanic p={productOf("software", "cpanic")!} look="early" page="pricing" year={2005} go={() => {}} />)).not.toContain("runs on Windoors Server");
  });

  it("mounts the index in both eras", () => {
    const s = readyGame(1);
    expect(renderToString(<IndexSite game={s} path="/dir/" go={() => {}} />)).toContain("yx-early");
    expect(renderToString(<IndexSite game={s} path="/dir/virtualization" go={() => {}} />)).toContain("OpenVeeZee");
    const late = newGame(1);
    skipTo(late, 2013);
    expect(renderToString(<IndexSite game={late} path="/dir/" go={() => {}} />)).toContain("yx-late");
  });
});
