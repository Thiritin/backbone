import { describe, expect, it } from "vitest";
import { hourOf, hourOfMonth, yearOf } from "../src/sim/00-core/time";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { SERVER_OS } from "../src/sim/10-catalog/server-os";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { versionAt, versionInfo, versionsOf } from "../src/sim/10-catalog/software-versions";
import type { GameState } from "../src/sim/50-state";
import { dpkg } from "../src/sim/60-infra/apt";
import { clusterFactor, lifecycleTick, supportOf, supportOn, unsupportedFactor, WARN_DAYS } from "../src/sim/60-infra/lifecycle";
import { securityTick } from "../src/sim/60-infra/security";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { newGame, panelServer, withServer } from "./fixtures";

const at = hourOfMonth;
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const setOs = (s: GameState, version: string) => {
  s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, os: { ...d.os!, id: "lunix", version } } : d));
};
// A panel host on the basement server with one web space, its panel on the newest release but left unpatched since 2005.
function host(seed: number): { s: GameState; c: string } {
  const s = { ...withServer(newGame(seed)), cash: 100_000 }, c = panelServer(s, "dev3"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
  provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: c });
  s.hour = year(2030);
  s.clusters = s.clusters.map((x) => (x.id === c ? { ...x, version: 2005, updatedAt: 0, channel: "edge" } : x));
  s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, software: d.software.map((x) => ({ ...x, version: versionAt(x.id, s.hour).version })) } : d));
  return { s, c };
}
const daysToHack = (s: GameState): number => {
  let d = 0;
  for (; d < 400 && !s.security.hacked.length; d++) { s.hour += 24; securityTick(s); }
  return d;
};

describe("software lifecycle", () => {
  it("passes the end of updates, then the end of security updates", () => {
    expect(supportOf("lunix", "8", at("2017-01"))).toBe("supported");
    expect(supportOf("lunix", "8", at("2018-06"))).toBe("updatesEnded");
    expect(supportOf("lunix", "8", at("2020-06"))).toBe("securityEnded");
    expect(supportOf("lunix", "no-such", at("2030-01"))).toBe("supported");
  });

  it("never ends the newest release while it is the newest", () => {
    const newest = [...SOFTWARE.map((x) => x.id), ...SERVER_OS.map((o) => o.id)]
      .map((id) => ({ id, v: versionsOf(id).at(-1)! })).filter(({ v }) => v.securityUntil !== null);
    expect(newest.length).toBeGreaterThan(0);
    for (const { id, v } of newest) expect(supportOf(id, v.version, v.securityUntil! + 24), `${id} ${v.version}`).toBe("supported");
  });

  it("raises the machine's compromise chance with the years past the end of security updates", () => {
    const { s, c } = host(1), cl = s.clusters.find((x) => x.id === c)!;
    setOs(s, versionAt("lunix", s.hour).version);
    expect(unsupportedFactor(s, "dev3")).toBe(1);
    setOs(s, "8");
    expect(supportOn(s, "dev3", "lunix")).toBe("securityEnded");
    s.hour = versionInfo("lunix", "8")!.securityUntil! + 2 * 365 * 24;
    expect(unsupportedFactor(s, "dev3")).toBeCloseTo(2);
    s.hour = year(2040);
    expect(clusterFactor(s, cl)).toBe(3);
  });

  it("gets an unsupported host compromised sooner", () => {
    let base = 0, ended = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const a = host(seed), b = host(seed);
      setOs(a.s, versionAt("lunix", a.s.hour).version);
      setOs(b.s, "8");
      const da = daysToHack(a.s), db = daysToHack(b.s);
      expect(db).toBeLessThanOrEqual(da);
      base += da;
      ended += db;
    }
    expect(ended).toBeLessThan(base);
  });

  it("shows the passed end in dpkg -l", () => {
    const { s } = host(1);
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, software: d.software.map((x) => ({ ...x, version: versionsOf(x.id)[0]?.version ?? x.version })) } : d));
    expect(s.devices.find((d) => d.id === "dev3")!.software.some((x) => supportOf(x.id, x.version, s.hour) === "securityEnded")).toBe(true);
    expect(dpkg(s, "dev3", ["-l"]).output.join("\n")).toContain("(Security updates ended)");
  });

  it("has the vendor write once per version ninety days before security updates end", () => {
    const { s } = host(1);
    setOs(s, "8");
    const end = versionInfo("lunix", "8")!.securityUntil!, name = SERVER_OS.find((o) => o.id === "lunix")!.name;
    s.hour = end - WARN_DAYS * 24 - 1;
    const mails = () => s.tickets.filter((x) => x.topic === "securityEnding");
    lifecycleTick(s);
    expect(mails()).toEqual([]);
    s.hour++;
    lifecycleTick(s);
    expect(mails().map((x) => x.mail)).toEqual([{ from: name, params: { software: name, version: "8", until: end } }]);
    s.hour++;
    lifecycleTick(s);
    expect(mails().length).toBe(1);
  });
});
