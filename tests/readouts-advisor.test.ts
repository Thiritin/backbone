import { describe, expect, it } from "vitest";
import { advisorChecks } from "../src/sim/80-business/readouts";
import { newJob } from "../src/sim/60-infra/backups";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host(year = 2016) {
  const s = readyGame(1);
  skipTo(s, year);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id, "pleskit");
  return { s, c: s.clusters.find((x) => x.id === id)! };
}

describe("Pleskit Advisor", () => {
  it("scores a fresh host 100 minus the backup finding", () => {
    const { s, c } = host();
    expect(c.jobs).toEqual([]);
    const kinds = advisorChecks(s, c).checks.map((x) => x.kind).filter((k) => k !== "auto");
    expect(kinds).toEqual(["backup"]);
    c.jobs = [newJob("j1", "x")];
    expect(advisorChecks(s, c).checks.map((x) => x.kind)).not.toContain("backup");
  });

  it("lowers the score by each finding's penalty", () => {
    const { s, c } = host();
    c.jobs = [newJob("j1", "x")];
    const base = advisorChecks(s, c).score;
    s.security.offline.push(c.id);
    expect(advisorChecks(s, c).score).toBe(base - 5);
    s.security.offline = [];
    c.jobs = [];
    expect(advisorChecks(s, c).score).toBe(base - 15);
  });

  it("caps vulnerability penalties and keeps the score between 0 and 100", () => {
    const { s, c } = host(2024);
    c.version = 2005;
    c.php = "4.3";
    s.security.offline.push(c.id);
    const r = advisorChecks(s, c);
    expect(r.checks.filter((x) => x.kind.startsWith("vuln")).reduce((n, x) => n + x.penalty, 0)).toBeLessThanOrEqual(40);
    expect(r.checks.some((x) => x.kind === "update")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
