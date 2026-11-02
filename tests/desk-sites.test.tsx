import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { subscribeDesk } from "../src/sim/90-actions/desk-install";
import { HostedDeskSite } from "../src/ui/apps/browser/sites/desks/HostedDeskSite";
import { SelfDeskSite } from "../src/ui/apps/browser/sites/desks/SelfDeskSite";
import { newGame, registered } from "./fixtures";

const year = (y: number): GameState => registered({ ...newGame(1), hour: hourOf(new Date(Date.UTC(y, 5, 1))), cash: 1e6 });
const go = () => {};

describe("desk vendor sites", () => {
  it("shows each hosted vendor's pages in every generation", () => {
    for (const [id, years] of [["zendusk", [2007, 2012, 2019]], ["freshdusk", [2011, 2014, 2019]]] as const) {
      for (const y of years) {
        const s = year(y);
        const html = (path: string) => renderToString(<HostedDeskSite game={s} id={id} path={path} go={go} />);
        expect(html("/")).toContain("Product");
        expect(html("/pricing")).toContain("per agent a month");
        expect(html("/signup")).toContain("Create my help desk");
        expect(html("/account")).toContain("You have no help desk here yet.");
        subscribeDesk(s, "pxl", id);
        expect(html("/account")).toContain(`pxl.${id}.com`);
        expect(html("/signup")).toContain("Cancel subscription");
      }
    }
  });

  it("lists the release to download on the self-hosted desks' sites", () => {
    const html = (y: number, id: "ostickit" | "freescoot", path: string) => renderToString(<SelfDeskSite game={year(y)} id={id} path={path} go={go} />);
    expect(html(2014, "ostickit", "/download")).toContain("ostickit-v1.9.zip");
    expect(html(2016, "ostickit", "/")).toContain("dsw-late");
    expect(html(2026, "ostickit", "/versions")).toContain("1.18");
    expect(html(2019, "freescoot", "/news")).toContain("FreeScoot 1.0");
    expect(html(2019, "freescoot", "/features")).toContain("AGPL");
  });
});
