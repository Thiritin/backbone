import { describe, expect, it } from "vitest";
import { SKILLS, skillById, skillFor } from "../src/sim/10-catalog/research";
import { STORE } from "../src/sim/10-catalog/store";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { install, research } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { SKILL_PAGES } from "../src/ui/desktop/intro-text";

const runTo = (s: GameState, hour: number) => {
  const events: SimEvent[] = [];
  while (s.hour < hour) events.push(...tick(s));
  return events;
};

describe("research", () => {
  it("is a tree: every prerequisite exists in an earlier tier and every gated item has one skill", () => {
    for (const k of SKILLS) for (const n of k.needs) expect(skillById(n)!.tier).toBeLessThan(k.tier);
    expect(new Set(SKILLS.map((k) => k.tier)).size).toBeGreaterThanOrEqual(3);
    for (const id of ["Staff", "Marketing", "Market", "Nagiosaurus"]) expect(SKILLS.filter((k) => k.opens.includes(id))).toHaveLength(1);
    for (const k of SKILLS) for (const id of k.opens) expect(STORE.some((i) => i.id === id)).toBe(true);
  });

  it("has a two to four page explainer for every skill", () => {
    for (const k of SKILLS) {
      expect(SKILL_PAGES[k.name]?.length).toBeGreaterThanOrEqual(2);
      expect(SKILL_PAGES[k.name].length).toBeLessThanOrEqual(4);
      const first = SKILL_PAGES[k.name][0];
      expect(first.title).toBe("Now available");
      expect(first.blocks[0]).toMatchObject({ kind: "checks" });
    }
  });

  it("enforces prerequisites and know-how, and runs one training at a time", () => {
    const s = newGame(11);
    expect(research(s, "nope")).toEqual({ ok: false, error: "error.unknownSkill" });
    expect(research(s, "monitoring")).toEqual({ ok: false, error: "error.noKnowHow" });
    s.knowHow = 1000;
    expect(research(s, "network")).toEqual({ ok: false, error: "error.missingSkill" });
    expect(research(s, "monitoring")).toEqual({ ok: true });
    expect(s.knowHow).toBe(950);
    expect(s.training).toEqual({ id: "monitoring", doneAt: s.hour + 5 * 24 });
    expect(research(s, "people")).toEqual({ ok: false, error: "error.trainingBusy" });
  });

  it("learns the skill when the training ends and opens its Pear Store item", () => {
    const s = newGame(12);
    s.knowHow = 50;
    research(s, "monitoring");
    expect(install(s, "Nagiosaurus")).toEqual({ ok: false, error: "error.needsResearch" });
    const doneAt = s.training!.doneAt;
    expect(runTo(s, doneAt - 1).some((e) => e.key === "event.trainingDone")).toBe(false);
    expect(s.unlocks).not.toContain("monitoring");
    const events = runTo(s, doneAt);
    expect(events).toContainEqual({ app: "Research", key: "event.trainingDone", params: { id: "monitoring", skill: "Monitoring" } });
    expect(s.unlocks).toContain("monitoring");
    expect(s.training).toBeNull();
    expect(research(s, "monitoring")).toEqual({ ok: false, error: "error.researched" });
    expect(install(s, "Nagiosaurus")).toEqual({ ok: true });
  });

  it("keeps a running training across a save and migrates old saves", () => {
    const s = newGame(13);
    s.knowHow = 100;
    research(s, "people");
    expect(deserialize(serialize(s))).toEqual(s);

    const raw = JSON.parse(serialize(newGame(14)));
    delete raw.training;
    delete raw.registration;
    raw.unlocks = ["Market", "monitoring"];
    raw.installed = ["Locations", "Unlocks", "Sales"];
    const old = deserialize(JSON.stringify(raw));
    expect(old.training).toBeNull();
    expect(old.installed).toEqual(["Locations", "Research", "Browser", "Website", "Marketing", "Security", "Applications"]);
    expect([...old.unlocks].sort()).toEqual(["market", "marketing", "marketingBasics", "monitoring", "people", "products"]);
    expect(skillFor("Market")!.id).toBe("market");
  });
});
