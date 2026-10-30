import { describe, expect, it } from "vitest";
import { checkDone } from "../src/sim/checklist";
import type { GameState } from "../src/sim/50-state";
import { listed } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { startGame } from "../src/sim/90-actions/start";
import { setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const run = (s: GameState, days: number) => { for (let i = 0; i < days * 24; i++) tick(s); };
const leads = (s: GameState, from = 0) => s.sales.requests.filter((r) => r.customerId === null && r.createdAt >= from);

describe("company website", () => {
  it("starts with nothing listed and lists a line only once a control plane sells it", () => {
    const s = startGame(1);
    expect(s.marketing.lines).toEqual([]);
    expect(checkDone(s, "website")).toBe(false);
    expect(setLine(s, "webHosting", true)).toEqual({ ok: false, error: "error.needsPanel" });
    expect(setLine(s, "vps", true)).toEqual({ ok: false, error: "error.needsPlatform" });
    expect(setLine(s, "cloud", true)).toEqual({ ok: false, error: "error.needsPlatform" });
    expect(setLine(s, "domain", true)).toEqual({ ok: false, error: "error.unknownSiteLine" });
    expect(s.marketing.lines).toEqual([]);

    const ready = readyGame(1);
    ready.marketing = { ...ready.marketing, lines: [] };
    expect(setLine(ready, "cloud", true)).toEqual({ ok: false, error: "error.needsHaCluster" });
    expect(setLine(ready, "webHosting", true).ok).toBe(true);
    expect(setLine(ready, "webHosting", true).ok).toBe(true);
    expect(ready.marketing.lines).toEqual(["webHosting"]);
    expect(checkDone(ready, "launch")).toBe(true);
    ready.marketing = { ...ready.marketing, launched: false };
    expect(checkDone(ready, "launch")).toBe(false);
  });

  it("brings no leads for unlisted lines", () => {
    const off = readyGame(3);
    off.marketing = { ...off.marketing, lines: [] };
    run(off, 60);
    expect(leads(off)).toHaveLength(0);

    const web = readyGame(3);
    web.marketing = { ...web.marketing, lines: [] };
    setLine(web, "webHosting", true);
    run(web, 60);
    expect(leads(web).length).toBeGreaterThan(0);
    expect(leads(web).every((r) => r.product === "webHosting")).toBe(true);
  });

  it("keeps existing customers when a line comes off the website", () => {
    const s = readyGame(4);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    expect(provisionService(s, cus, "vps", { label: "Box", clusterId: s.clusters[0].id }).ok).toBe(true);
    const before = s.services.map((v) => v.id);
    expect(setLine(s, "vps", false).ok).toBe(true);
    expect(listed(s, "vps")).toBe(false);
    expect(s.services.map((v) => v.id)).toEqual(before);
    const from = s.hour;
    run(s, 60);
    expect(s.services.find((v) => v.customerId === cus)?.endedAt).toBeNull();
    expect(leads(s, from).some((r) => r.product === "vps")).toBe(false);
  });

  it("lists every line an old save could sell and keeps a saved list", () => {
    const s = readyGame(2);
    const old = JSON.parse(serialize(s));
    delete old.marketing.lines;
    expect(deserialize(JSON.stringify(old)).marketing.lines)
      .toEqual(["webHosting", "vps", "gameServer", "ssl"]);

    s.marketing = { ...s.marketing, lines: ["vps"] };
    expect(deserialize(serialize(s)).marketing.lines).toEqual(["vps"]);
  });
});
