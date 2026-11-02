import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DATACENTERS, PROVIDERS } from "../src/sim/20-world/datacenters";
import { displayHost, orderUrl, providerDomain, resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { routeOf } from "../src/ui/apps/browser/sites/providers/ProviderSite";
import { ProviderSite } from "../src/ui/apps/browser/sites/providers/registry";
import { newGame, skipTo } from "./fixtures";

describe("colocation provider sites", () => {
  it("gives every provider its own host, reached bare and with www.", () => {
    const s = newGame(7);
    expect(new Set(PROVIDERS.map((p) => p.host)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) {
      expect(resolve(s, p.host).page).toEqual({ kind: "provider", id: p.id });
      expect(resolve(s, displayHost(p.host)).page).toEqual({ kind: "provider", id: p.id });
      expect(providerDomain(p.host)).toBe(true);
    }
  });

  it("lists every provider on the index under a link that reaches its site", () => {
    const s = newGame(7);
    const cat = siteIndex(s).find((c) => c.rows.length === PROVIDERS.length && c.rows.every((r) => resolve(s, r.url).page.kind === "provider"));
    expect(cat?.rows.map((r) => resolve(s, r.url).page)).toEqual(PROVIDERS.map((p) => ({ kind: "provider", id: p.id })));
  });

  it("deep-links the order form with the datacenter and space preselected", () => {
    const s = newGame(7), dc = DATACENTERS.find((d) => d.id === "hetzler-nbg")!;
    const r = resolve(s, orderUrl(dc, "share", 4));
    expect(r.page).toEqual({ kind: "provider", id: "hetzler" });
    expect(routeOf("hetzler", r.path)).toEqual({ page: "order", dc: "hetzler-nbg", space: "share", size: 4 });
    expect(routeOf("hetzler", "/sites/equinox-fr5")).toEqual({ page: "notfound" });
    expect(routeOf("hetzler", "/account/contracts")).toEqual({ page: "account" });
  });

  it("renders every page of every provider in both looks", () => {
    for (const year of [2005, 2020]) {
      const s = newGame(7);
      skipTo(s, year);
      for (const p of PROVIDERS) {
        const dc = DATACENTERS.find((d) => d.provider === p.id)!;
        for (const path of ["/", "/sites", `/sites/${dc.id}`, `/order?dc=${dc.id}&space=share&size=2`, "/account"]) {
          const html = renderToString(<ProviderSite game={s} id={p.id} path={path} go={() => {}} />);
          expect(html).toContain(path === "/" ? "ps ps-" : path === "/account" ? "password" : dc.name);
        }
      }
    }
  });
});
