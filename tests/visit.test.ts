import { describe, expect, it } from "vitest";
import { goHome, pathTiles, pointAt, useVisit, walkSeconds } from "../src/ui/world/visit";

const line = (n: number) => Array.from({ length: n + 1 }, (_, x) => ({ x, y: 0 }));

describe("player visit timing", () => {
  it("walks 6 tiles per second", () => expect(walkSeconds(line(6))).toBe(1));
  it("takes at most 2 seconds", () => { expect(walkSeconds(line(40))).toBe(2); expect(walkSeconds(line(12))).toBe(2); });
  it("takes no time when already there", () => { expect(walkSeconds([{ x: 3, y: 3 }])).toBe(0); expect(pathTiles([{ x: 3, y: 3 }])).toBe(0); });
  it("finds the middle tile at half the time", () => {
    const path = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }];
    expect(pointAt(path, 0.5)).toEqual({ x: 4, y: 0 });
    expect(pointAt(path, 0)).toEqual(path[0]);
    expect(pointAt(path, 1)).toEqual(path[2]);
    expect(pointAt(line(6), 0.5)).toEqual({ x: 3, y: 0 });
  });
});

describe("figure returns to its seat", () => {
  it("walks back after a visit and sits when it arrives", () => {
    const seat = { x: 1, y: 1 }, mail = { x: 5, y: 1 };
    useVisit.getState().set({ at: { locationId: "l", pt: mail }, walk: null });
    goHome("l", seat, [mail, seat]);
    const w = useVisit.getState().walk!;
    expect(w.to).toEqual(seat);
    w.run();
    expect(useVisit.getState().at).toBeNull();
  });
  it("sits at once when already at the seat", () => {
    useVisit.getState().set({ at: { locationId: "l", pt: { x: 1, y: 1 } }, walk: null });
    goHome("l", { x: 1, y: 1 }, [{ x: 1, y: 1 }]);
    expect(useVisit.getState().at).toBeNull();
    expect(useVisit.getState().walk).toBeNull();
  });
});
