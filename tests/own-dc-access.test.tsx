import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HALL, hallKw } from "../src/sim/20-world/properties";
import { roomPower } from "../src/sim/60-infra/status";
import { editHallError, hallPath, unmaintained } from "../src/sim/90-actions/hall";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { HallItemKind } from "../src/sim/50-state";
import type { AreaId } from "../src/sim/50-state";
import { HallPlan } from "../src/ui/apps/locations/HallPlan";
import { useStore } from "../src/ui/store";
import { HallStrip } from "../src/ui/world/hall-parts";
import { ownHall, place } from "./own-dc-hall";

type E = ReturnType<typeof ownHall>;
const put = (e: E, kind: HallItemKind, area: AreaId, x: number, y: number, facing: "n" | "e" | "s" | "w" = "s") =>
  editHallError(e.s, e.hallId, { place: [{ kind, area, x, y, facing }] })?.key;
// Adds an item without the validator, as an old save holds it.
const cram = (e: E, kind: HallItemKind, area: AreaId, x: number, y: number, facing: "n" | "e" | "s" | "w") =>
  e.hall().items.push({ id: `old${e.hall().items.length}`, kind, area, x, y, facing, price: 1, builtAt: 0 });

describe("own datacenter: doors and maintenance access", () => {
  it("joins every area by a door and walks across two rooms", () => {
    const e = ownHall();
    place(e, { kind: "ups", area: "battery", x: 2, y: 0, facing: "s" });
    expect(unmaintained(e.s, e.hallId)).toEqual([]);
    const entry = { x: 1, y: 5 };
    for (const to of [{ x: 18, y: 2 }, { x: 18, y: 6 }]) expect(hallPath(e.s, e.hallId, entry, to)?.length).toBeGreaterThan(16);
    expect(hallPath(e.s, e.hallId, entry, { x: 18, y: 2 })!.some((p) => p.x === 16 && p.y === 1)).toBe(true);
  });

  it("refuses to sit on a door or in front of one", () => {
    const e = ownHall();
    expect(put(e, "transformer", "xfmr", 0, 0, "s")).toBe("error.occupied");
  });

  it.each([
    ["crac", "hall", 5, 2], ["transformer", "xfmr", 4, 0], ["generator", "xfmr", 4, 0], ["switchgear", "xfmr", 4, 0], ["ups", "battery", 2, 0], ["battery", "battery", 2, 0], ["nocdesk", "hall", 5, 2],
  ] as const)("keeps the service front of a %s free", (kind, area, x, y) => {
    const e = ownHall();
    place(e, { kind, area, x, y, facing: "s" });
    expect(unmaintained(e.s, e.hallId)).toEqual([]);
    // The same kind straight in front of it takes the front away.
    expect(put(e, kind, area, x, y + HALL.items[kind].d, "s")).toBe("error.noAccess");
  });

  it("keeps two tiles in front of large gear", () => {
    const e = ownHall();
    place(e, { kind: "generator", area: "xfmr", x: 4, y: 0, facing: "s" });
    expect(put(e, "switchgear", "xfmr", 4, 3, "e")).toBe("error.noAccess");
  });

  it("refuses an item that cuts another one off", () => {
    const e = ownHall();
    expect(put(e, "switchgear", "xfmr", 1, 2, "e")).toBe("error.noAccess");
  });

  it("loads an old crammed save unchanged and flags the gear", () => {
    const e = ownHall();
    // The two transformers wall off the door of the transformer room from the fronts of all three.
    cram(e, "transformer", "xfmr", 0, 2, "e");
    cram(e, "transformer", "xfmr", 1, 0, "s");
    const before = JSON.stringify(e.hall().items);
    const s = deserialize(serialize(e.s));
    expect(JSON.stringify(s.properties.find((p) => p.hall)!.hall!.items)).toBe(before);
    const bad = unmaintained(s, e.hallId);
    expect(bad.length).toBe(3);
    expect(bad).toEqual(expect.arrayContaining(["item:old2", "item:old3"]));
    // Each flagged transformer gives half its capacity.
    const p = s.properties.find((x) => x.hall)!, full = hallKw(p), cut = hallKw(p, new Set(bad.map((r) => r.slice(5))));
    expect(cut).toBeLessThan(full);
    expect(roomPower(s, s.locations.find((l) => l.id === e.hallId)!).limitWatts).toBe(1000 * cut);
    expect(cut).toBe(full * HALL.service.derate);
  });

  it("shows the derated capacity in the hall plan and the edit strip", () => {
    const e = ownHall();
    cram(e, "transformer", "xfmr", 0, 2, "e");
    cram(e, "transformer", "xfmr", 1, 0, "s");
    const p = e.s.properties.find((x) => x.hall)!, loc = e.s.locations.find((l) => l.id === e.hallId)!;
    const kw = roomPower(e.s, loc).limitWatts / 1000;
    expect(kw).toBeLessThan(hallKw(p));
    expect(renderToString(<HallPlan game={e.s} p={p} />)).toContain(`/ ${kw}`);
    // Server rendering reads the store's initial state.
    Object.assign(useStore.getInitialState(), { game: e.s });
    expect(renderToString(<HallStrip loc={loc} onDone={() => {}} />)).toContain(`kW 0 / ${kw}`);
  });
});
