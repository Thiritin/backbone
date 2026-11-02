import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IndexSite } from "../src/ui/apps/browser/sites/index/IndexSite";
import { productOf, type SitePage } from "../src/ui/apps/browser/sites/software/SoftwareSite";
import { SITE_VIEWS } from "../src/ui/apps/browser/sites/software/registry";
import { readyGame, skipTo, newGame } from "./fixtures";
import { licensingAt } from "../src/sim/10-catalog/server-os";
import { BINARIES } from "../src/sim/10-catalog/platforms";

const PAGES: SitePage[] = ["home", "features", "pricing", "download"];
const ONE_LOOK = new Set(["wireguarded", "vsftpeed", "postfixit", "mailpig", "squirrelmeal"]);

describe("software sites", () => {
  it("mounts every site in both eras on every page", () => {
    for (const [id, View] of Object.entries(SITE_VIEWS)) {
      const p = productOf(id === "lunix" || id === "windoors" ? "os" : "software", id)!;
      expect(p.site.eras.map((e) => e.look)).toEqual(ONE_LOOK.has(id) ? ["early"] : ["early", "late"]);
      for (const { look, from } of p.site.eras) for (const page of PAGES) {
        const html = renderToString(<View p={p} look={look} page={page} year={from} hour={0} go={() => {}} />);
        expect(html).toContain(page === "pricing" ? (licensingAt((p.sw ?? p.os)!, 2005).kind === "free" ? "Free" : "€") : "<nav");
        if (page === "download" && p.sw?.install.kind !== "gui" && p.sw) expect(html).toContain(p.sw.install.commands[0].split(" ")[0]);
      }
    }
  });

  it("documents each software's command line tool and leaves it off the OS sites", () => {
    for (const [id, View] of Object.entries(SITE_VIEWS)) {
      const p = productOf(id === "lunix" || id === "windoors" ? "os" : "software", id)!;
      for (const { look, from } of p.site.eras) {
        const home = renderToString(<View p={p} look={look} page="home" year={from} hour={0} go={() => {}} />);
        expect(home.includes('href="#docs"')).toBe(!!p.sw);
        if (!p.sw) continue;
        const html = renderToString(<View p={p} look={look} page="docs" year={from} hour={0} go={() => {}} />);
        expect(html).toContain(`<code>${BINARIES[id]}</code>`);
        expect(html).toContain("Prints the installed version and the update channel.");
      }
    }
  });

  it("notes the Windoors license where the software needs it", () => {
    const html = renderToString(<SITE_VIEWS.tcadmen p={productOf("software", "tcadmen")!} look="early" page="pricing" year={2005} hour={0} go={() => {}} />);
    expect(html).toContain("runs on Windoors Server");
    expect(renderToString(<SITE_VIEWS.cpanic p={productOf("software", "cpanic")!} look="early" page="pricing" year={2005} hour={0} go={() => {}} />)).not.toContain("runs on Windoors Server");
  });

  it("says what a software without a web console gives after install", () => {
    const gets = { bound: "port 53", knut: "port 53", wireguarded: "VPN gateway", vsftpeed: "FTP server", postfixit: "mail server" };
    for (const [id, text] of Object.entries(gets)) {
      const p = productOf("software", id)!, View = SITE_VIEWS[id];
      for (const { look, from } of p.site.eras) expect(renderToString(<View p={p} look={look} page="download" year={from} hour={0} go={() => {}} />)).toContain(text);
    }
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
