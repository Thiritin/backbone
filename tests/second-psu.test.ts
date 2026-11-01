import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { type GameState } from "../src/sim/50-state";
import { psuInlets } from "../src/ui/art/backs";
import { addSecondPsu, mountDevice, setPlugged } from "../src/sim/90-actions/hardware";
import { buyDevice, newGame } from "./fixtures";
import { withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

describe("second power supply", () => {
  it("fills the empty bay for the price difference and waits to be plugged in", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 10_000 };
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, id, "rack2", 20));
    const d = s.devices.find((x) => x.id === id)!;
    const paid = d.price, cash = s.cash;
    const psu = ok(addSecondPsu(s, id));
    expect(d.model).toBe("g1-compute-2psu");
    expect(s.cash).toBe(cash - 250);
    expect(d.price).toBe(paid + 250);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.secondPsu", amount: -250 });
    const psus = d.components.filter((c) => c.kind === "psu");
    expect(psus.map((c) => c.id).at(-1)).toBe(psu);
    expect(psus[1].plugged).toBe(false);
    expect(new Set(d.components.map((c) => c.id)).size).toBe(d.components.length);
    expect(psuInlets(modelById(d.model), "back", 400, 20)).toHaveLength(2);
    ok(setPlugged(s, id, psu, true));
  });

  it("refuses a device without a free bay or without the cash", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 10_000 };
    const dual = ok(buyDevice(s, "g1-compute-2psu", "Dwell", 1, "loc1"));
    expect(addSecondPsu(s, dual)).toEqual({ ok: false, error: "error.noSecondPsu" });
    const one = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    s.cash = 100;
    expect(addSecondPsu(s, one)).toEqual({ ok: false, error: "error.noCash" });
  });
});
