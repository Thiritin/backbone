import { describe, expect, it } from "vitest";
import { serviceMbps } from "../src/sim/60-infra/network";
import { TASK_WINDOW_HOURS, panelTasks } from "../src/sim/80-business/readouts";
import { panelVm, readyGame, skipTo } from "./fixtures";

function host() {
  const s = readyGame(1);
  skipTo(s, 2006);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((y) => y.kind === "cloud")!.id), c = s.clusters.find((x) => x.id === id)!;
  return { s, c };
}

describe("panel task log", () => {
  it("lists an install in progress with its finish hour", () => {
    const { s, c } = host();
    c.switching = { kind: "panel", to: "cpanic", doneAt: s.hour + 3 };
    const row = panelTasks(s, c).find((x) => x.text === "install")!;
    expect(row.status).toBe("running");
    expect(row.finish).toBe(s.hour + 3);
    expect(row.start).toBe(s.hour);
  });

  it("lists a finished update inside the window and not outside", () => {
    const { s, c } = host();
    c.switching = null;
    c.updatedAt = s.hour - 10;
    expect(panelTasks(s, c).some((x) => x.text === "update" && x.status === "done")).toBe(true);
    c.updatedAt = s.hour - TASK_WINDOW_HOURS - 1;
    expect(panelTasks(s, c).some((x) => x.text === "update")).toBe(false);
  });

  it("gives the same rows twice for the same state", () => {
    const { s, c } = host();
    expect(panelTasks(s, c)).toEqual(panelTasks(s, c));
  });

  it("serviceMbps with the default hour equals the explicit current hour", () => {
    const { s } = host();
    for (const v of s.services.slice(0, 5)) expect(serviceMbps(s, v)).toBe(serviceMbps(s, v, s.hour));
  });
});
