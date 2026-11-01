import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { newGame } from "../src/sim/50-state";
import { hostPerf, PHP_SLOW } from "../src/sim/60-infra/php";
import { rebuildHost, setPhpPool } from "../src/sim/90-actions/webpanel";
import { updateDue } from "../src/sim/90-actions/software";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { panelServer, withServer } from "./fixtures";

const DA = SOFTWARE.find((x) => x.id.startsWith("direct"))!.id;

describe("DirectAdmen CustomBuild", () => {
  const base = () => {
    const s = withServer(newGame(1));
    s.hour = hourOf(new Date(Date.UTC(2013, 0, 1)));
    const host = panelServer(s, "dev3", DA);
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, php: "5.3" } : c));
    return { s, host };
  };

  it("slows the host's sites for an hour on a rebuild", () => {
    const { s, host } = base();
    const c = () => s.clusters.find((x) => x.id === host)!;
    expect(hostPerf(s, c())).toBe(1);
    expect(rebuildHost(s, host)).toEqual({ ok: true });
    expect(c().phpUntil).toBe(s.hour + 1);
    expect(hostPerf(s, c())).toBeLessThanOrEqual(PHP_SLOW);
    s.hour += 2;
    expect(hostPerf(s, c())).toBe(1);
  });

  it("sets the second PHP through the pool and rebuilds", () => {
    const { s, host } = base();
    expect(setPhpPool(s, host, ["5.2"])).toEqual({ ok: true });
    expect(s.webpanel.phpPool[host]).toEqual(["5.2"]);
    expect(s.clusters.find((x) => x.id === host)!.phpUntil).toBe(s.hour + 1);
    expect(setPhpPool(s, host, [])).toEqual({ ok: true });
    expect(s.webpanel.phpPool[host]).toEqual([]);
  });

  it("refuses a rebuild on a host that is no panel host", () => {
    const { s } = base();
    expect(rebuildHost(s, "nope")).toEqual({ ok: false, error: "error.unknownCluster" });
  });

  it("offers the panel update only when a newer release is out", () => {
    const { s, host } = base();
    const c = s.clusters.find((x) => x.id === host)!;
    expect(updateDue(s, c)).toBe(false);
    s.hour = hourOf(new Date(Date.UTC(2016, 0, 1)));
    expect(updateDue(s, c)).toBe(true);
  });
});
