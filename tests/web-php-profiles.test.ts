import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { Profile } from "../src/sim/30-customers/customers";
import { newGame, type GameState } from "../src/sim/50-state";
import { PHP_ABUSE, phpAbuse, phpTickets } from "../src/sim/60-infra/php";
import { phpOldestInUse, phpRunning, siteBroken, webpanelTick } from "../src/sim/60-infra/webpanel";
import { provisionService, upgradePhp } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setAccountPhp, setPhpPool } from "../src/sim/90-actions/webpanel";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// A panel host in a year with one site per app release; the host runs the newest PHP of that year.
function world(seed = 1, y = 2012, releases: number[] = [2006, 2011], profile: Profile = "hobbyDev") {
  const s = withServer(newGame(seed));
  s.hour = year(y);
  const host = panelServer(s, "dev3");
  s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, php: "5.3" } : c));
  const ids = releases.map((rel, i) => {
    const cus = addCustomer(s, `Customer ${i}`, profile);
    return ok(provisionService(s, cus, "webHosting", { label: `site${i}.de`, spec: { ...sizeSpec("webHosting", 0, 2005), app: "wordpass", appVersion: rel, appUpdatedAt: year(rel) }, clusterId: host }));
  });
  return { s, host, ids };
}
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
// The daily tick on its own, since a full day also lets customers update their apps.
const day = (s: GameState) => { webpanelTick(s); };

describe("PHP profiles", () => {
  it("refuse unreleased and newer versions, more than two, and unknown hosts", () => {
    const { s, host } = world();
    expect(setPhpPool(s, host, ["8.0"])).toEqual({ ok: false, error: "error.phpNotAvailable" });
    expect(setPhpPool(s, host, ["5.3"])).toEqual({ ok: false, error: "error.phpNotAvailable" });
    expect(setPhpPool(s, host, ["4.4", "5.1", "5.2"])).toEqual({ ok: false, error: "error.phpPoolFull" });
    expect(setPhpPool(s, "nope", [])).toEqual({ ok: false, error: "error.unknownCluster" });
    expect(setPhpPool(s, host, ["5.2", "4.4"])).toEqual({ ok: true });
    expect(s.webpanel.phpPool[host]).toEqual(["5.2", "4.4"]);
    expect(setAccountPhp(s, "none", "5.2")).toEqual({ ok: false, error: "error.notPanelHost" });
  });

  it("move an account only to an installed version", () => {
    const { s, host, ids } = world();
    expect(setAccountPhp(s, ids[0], "5.2")).toEqual({ ok: false, error: "error.phpNotInstalled" });
    setPhpPool(s, host, ["5.2"]);
    expect(setAccountPhp(s, ids[0], "5.2")).toEqual({ ok: true });
    expect(phpRunning(s, cluster(s, host), ids[0])).toBe("5.2");
  });

  it("rebuild the host's sites slowly for an hour when the pool changes", () => {
    const { s, host } = world();
    setPhpPool(s, host, ["5.2"]);
    expect(cluster(s, host).phpUntil).toBe(s.hour + 1);
  });

  it("break a site whose app is too old for the newest PHP unless a legacy version carries it", () => {
    const { s, host, ids } = world(1, 2013, [2006, 2012]);
    const c = cluster(s, host);
    expect(siteBroken(s, c, ids[0])).toBe(true);
    expect(siteBroken(s, c, ids[1])).toBe(false);
    setPhpPool(s, host, ["5.2"]);
    expect(siteBroken(s, cluster(s, host), ids[0])).toBe(true);
    setAccountPhp(s, ids[0], "5.2");
    expect(siteBroken(s, cluster(s, host), ids[0])).toBe(false);
  });

  it("slow a broken site every day and withdraw the ticket once it runs again", () => {
    const { s, host, ids } = world(3, 2013, Array.from({ length: 40 }, () => 2006));
    day(s);
    const slow = s.services.filter((v) => ids.includes(v.id) && v.slowedAt !== undefined && v.slowedAt >= s.hour).length;
    expect(slow).toBe(40);
    const tickets = s.tickets.filter((t) => t.topic === "phpBroken");
    expect(tickets.length).toBeGreaterThan(5);
    expect(tickets.length).toBeLessThan(25);
    setPhpPool(s, host, ["5.2"]);
    for (const id of ids) setAccountPhp(s, id, "5.2");
    day(s);
    expect(s.tickets.filter((t) => t.topic === "phpBroken" && t.status === "open")).toHaveLength(0);
  });

  it("draw the same broken sites from the same seed", () => {
    const run = () => { const { s } = world(5, 2013, Array.from({ length: 30 }, () => 2006)); day(s); return s.tickets.filter((t) => t.topic === "phpBroken").map((t) => t.serviceId); };
    expect(run()).toEqual(run());
  });

  it("keep the previous version on upgrade and put the sites that need it on it", () => {
    const { s, host, ids } = world(1, 2013, [2006, 2012]);
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, php: "5.2" } : c));
    s.hour = year(2013) + 24;
    expect(upgradePhp(s, host, true)).toEqual({ ok: true });
    const c = cluster(s, host);
    expect(c.php).toBe("5.4");
    expect(s.webpanel.phpPool[host]).toEqual(["5.2"]);
    expect(phpRunning(s, c, ids[0])).toBe("5.2");
    expect(phpRunning(s, c, ids[1])).toBe("5.4");
    expect(siteBroken(s, c, ids[0])).toBe(false);
  });

  it("drop the previous version on upgrade by default", () => {
    const { s, host } = world(1, 2013, [2012]);
    s.clusters = s.clusters.map((c) => (c.id === host ? { ...c, php: "5.2" } : c));
    expect(upgradePhp(s, host)).toEqual({ ok: true });
    expect(s.webpanel.phpPool[host]).toBeUndefined();
  });

  it("count tickets and abuse by the oldest version still in use", () => {
    const { s, host, ids } = world(1, 2013, [2012]);
    const c = cluster(s, host), base = phpTickets(s, c);
    expect(phpAbuse(s, s.services.find((v) => v.id === ids[0])!.customerId)).toBe(1);
    s.hour = year(2018);
    s.clusters = s.clusters.map((x) => (x.id === host ? { ...x, php: "7.2" } : x));
    setPhpPool(s, host, ["5.3"]);
    setAccountPhp(s, ids[0], "5.3");
    expect(phpOldestInUse(s, cluster(s, host))).toBe("5.3");
    expect(phpTickets(s, cluster(s, host))).toBeGreaterThan(base);
    expect(phpAbuse(s, s.services.find((v) => v.id === ids[0])!.customerId)).toBe(PHP_ABUSE);
    setPhpPool(s, host, []);
    expect(phpOldestInUse(s, cluster(s, host))).toBe("7.2");
  });
});
